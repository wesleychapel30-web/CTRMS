from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers
from django.urls import reverse

from core.models import AuditLog
from core.rbac import get_user_role_keys, user_has_permission

from .approval_engine import get_latest_approval_instance, get_pending_decision, serialize_approval_history
from .models import (
    ApprovalDecision,
    ApprovalInstance,
    ApprovalWorkflowStep,
    ApprovalWorkflowTemplate,
    Branch,
    BudgetAccount,
    Department,
    EnterpriseAttachment,
    FinanceInvoice,
    GoodsReceipt,
    GoodsReceiptLine,
    InventoryLedgerEntry,
    Organization,
    PaymentRequest,
    ProcurementRequest,
    ProcurementRequestLine,
    Product,
    PurchaseOrder,
    PurchaseOrderLine,
    Vendor,
    Warehouse,
)


AUDIT_TONE_BY_ACTION = {
    AuditLog.ActionType.CREATE: "info",
    AuditLog.ActionType.UPDATE: "warning",
    AuditLog.ActionType.APPROVE: "success",
    AuditLog.ActionType.REJECT: "danger",
    AuditLog.ActionType.DELETE: "danger",
}
PRIVILEGED_APPROVER_ROLES = {"super_admin", "admin", "director"}


def _serialize_audit_timeline(content_type: str, object_id) -> list[dict[str, str | None]]:
    logs = (
        AuditLog.objects.filter(content_type=content_type, object_id=str(object_id))
        .select_related("user")
        .order_by("-created_at")[:20]
    )
    return [
        {
            "id": str(log.id),
            "label": log.get_action_type_display(),
            "title": content_type,
            "actor_name": log.user.get_full_name() or log.user.username,
            "created_at": log.created_at.isoformat(),
            "body": log.description or "",
            "status_text": None,
            "tone": AUDIT_TONE_BY_ACTION.get(log.action_type, "neutral"),
        }
        for log in logs
    ]


def _serialize_enterprise_attachments(target_type: str, target_id, context) -> list[dict[str, object]]:
    attachments = (
        EnterpriseAttachment.objects.filter(target_type=target_type, target_id=target_id)
        .select_related("uploaded_by")
        .order_by("uploaded_at")
    )
    return EnterpriseAttachmentSerializer(attachments, many=True, context=context).data


def _get_pending_procurement_decision(procurement_request: ProcurementRequest) -> ApprovalDecision | None:
    return get_pending_decision(getattr(procurement_request, "approval_instance", None))


def _get_record_approval_instance(target_type: str, record_id):
    return get_latest_approval_instance(target_type=target_type, target_id=record_id)


def _user_can_progress_approval_instance(instance: ApprovalInstance | None, user, permission_key: str) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if not user_has_permission(user, permission_key):
        return False
    if instance is None:
        return True

    pending_decision = get_pending_decision(instance)
    if pending_decision is None:
        return False

    user_role_keys = get_user_role_keys(user)
    if user_role_keys.intersection(PRIVILEGED_APPROVER_ROLES):
        return True

    required_role = getattr(getattr(pending_decision, "step", None), "role", None)
    if required_role is None:
        return True
    return getattr(required_role, "key", "") in user_role_keys


def _user_can_approve_procurement_request(procurement_request: ProcurementRequest, user) -> bool:
    if procurement_request.status != ProcurementRequest.Status.SUBMITTED:
        return False
    return _user_can_progress_approval_instance(getattr(procurement_request, "approval_instance", None), user, "procurement:approve")


def _user_can_revert_approval_instance(instance: ApprovalInstance | None, user, permission_key: str) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if not user_has_permission(user, permission_key):
        return False
    if instance is None:
        return False

    latest_decision = (
        instance.decisions.select_related("actor")
        .exclude(status=ApprovalDecision.DecisionStatus.PENDING)
        .order_by("-step__sequence", "-decided_at")
        .first()
    )
    if latest_decision is None:
        return False

    user_role_keys = get_user_role_keys(user)
    if user_role_keys.intersection(PRIVILEGED_APPROVER_ROLES):
        return True

    return bool(latest_decision.actor_id and latest_decision.actor_id == getattr(user, "id", None))


def _get_procurement_request_actions(procurement_request: ProcurementRequest, user) -> list[str]:
    if not user or not getattr(user, "is_authenticated", False):
        return []
    actions: list[str] = []
    if procurement_request.status == ProcurementRequest.Status.DRAFT and user_has_permission(user, "procurement:create"):
        actions.extend(["edit", "submit"])
    if _user_can_approve_procurement_request(procurement_request, user):
        actions.extend(["approve", "reject"])
    if (
        getattr(procurement_request, "purchase_order", None) is None
        and _user_can_revert_approval_instance(getattr(procurement_request, "approval_instance", None), user, "procurement:approve")
    ):
        actions.append("revert")
    if procurement_request.status == ProcurementRequest.Status.APPROVED and user_has_permission(user, "purchase_order:issue"):
        actions.append("convert_to_purchase_order")
    return actions


def _get_purchase_order_actions(purchase_order: PurchaseOrder, user) -> list[str]:
    if not user or not getattr(user, "is_authenticated", False):
        return []
    actions: list[str] = []
    if purchase_order.status == PurchaseOrder.Status.DRAFT and user_has_permission(user, "purchase_order:issue"):
        actions.append("issue")
    if purchase_order.status in {PurchaseOrder.Status.ISSUED, PurchaseOrder.Status.PARTIALLY_RECEIVED} and user_has_permission(user, "goods_receipt:record"):
        actions.append("record_goods_receipt")
    return actions


def _get_invoice_actions(invoice: FinanceInvoice, user) -> list[str]:
    if not user or not getattr(user, "is_authenticated", False):
        return []
    actions: list[str] = []
    if invoice.status == FinanceInvoice.Status.DRAFT and user_has_permission(user, "invoice:post"):
        actions.append("post")
    approval_instance = _get_record_approval_instance(ApprovalInstance.TargetType.FINANCE_INVOICE, invoice.id)
    if invoice.status == FinanceInvoice.Status.POSTED and _user_can_progress_approval_instance(approval_instance, user, "invoice:approve"):
        actions.append("approve")
    payment_request = getattr(invoice, "payment_request", None)
    if payment_request is None and _user_can_revert_approval_instance(approval_instance, user, "invoice:approve"):
        actions.append("revert")
    if (
        invoice.status == FinanceInvoice.Status.APPROVED
        and user_has_permission(user, "payment:record")
        and (payment_request is None or payment_request.status == PaymentRequest.Status.REJECTED)
    ):
        actions.append("create_payment_request")
    return actions


def _get_payment_request_actions(payment_request: PaymentRequest, user) -> list[str]:
    if not user or not getattr(user, "is_authenticated", False):
        return []
    actions: list[str] = []
    approval_instance = _get_record_approval_instance(ApprovalInstance.TargetType.PAYMENT_REQUEST, payment_request.id)
    if payment_request.status == PaymentRequest.Status.SUBMITTED and _user_can_progress_approval_instance(approval_instance, user, "payment_request:approve"):
        actions.extend(["approve", "reject"])
    if payment_request.status != PaymentRequest.Status.PAID and _user_can_revert_approval_instance(approval_instance, user, "payment_request:approve"):
        actions.append("revert")
    if payment_request.status == PaymentRequest.Status.APPROVED and user_has_permission(user, "payment:record"):
        actions.append("mark_paid")
    return actions


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ("id", "name", "code", "slug", "legal_name", "timezone", "currency_code", "is_active")


class DepartmentSerializer(serializers.ModelSerializer):
    manager_name = serializers.CharField(source="manager.get_full_name", read_only=True)

    class Meta:
        model = Department
        fields = ("id", "name", "code", "description", "manager", "manager_name", "is_active")


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ("id", "name", "code", "city", "country", "address", "is_active")


class VendorSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Vendor
        fields = ("id", "name", "code", "contact_name", "email", "phone", "status", "status_display")


class ProductSerializer(serializers.ModelSerializer):
    on_hand = serializers.SerializerMethodField()

    def get_on_hand(self, obj):
        return getattr(obj, "on_hand_value", obj.on_hand)

    class Meta:
        model = Product
        fields = (
            "id",
            "sku",
            "name",
            "description",
            "unit_of_measure",
            "standard_cost",
            "reorder_level",
            "is_active",
            "on_hand",
        )


class WarehouseSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source="branch.name", read_only=True)

    class Meta:
        model = Warehouse
        fields = ("id", "name", "code", "location", "branch", "branch_name", "is_active")


class BudgetAccountSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)
    available_amount = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = BudgetAccount
        fields = (
            "id",
            "code",
            "name",
            "fiscal_year",
            "department",
            "department_name",
            "allocated_amount",
            "committed_amount",
            "spent_amount",
            "available_amount",
        )


class EnterpriseAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source="uploaded_by.get_full_name", read_only=True)
    filename = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()

    def get_filename(self, obj: EnterpriseAttachment) -> str:
        try:
            return (obj.file.name or "").split("/")[-1]
        except Exception:
            return ""

    def get_download_url(self, obj: EnterpriseAttachment) -> str:
        request = self.context.get("request")
        url = reverse("api_enterprise_attachment_download", kwargs={"attachment_id": obj.pk})
        return request.build_absolute_uri(url) if request else url

    class Meta:
        model = EnterpriseAttachment
        fields = (
            "id",
            "file",
            "filename",
            "download_url",
            "attachment_type",
            "uploaded_by",
            "uploaded_by_name",
            "uploaded_at",
        )
        read_only_fields = ("id", "uploaded_by", "uploaded_by_name", "uploaded_at")


class ApprovalWorkflowStepSerializer(serializers.ModelSerializer):
    role_key = serializers.CharField(source="role.key", read_only=True)
    role_name = serializers.CharField(source="role.name", read_only=True)

    class Meta:
        model = ApprovalWorkflowStep
        fields = ("id", "sequence", "name", "role_key", "role_name", "minimum_amount", "maximum_amount")


class ApprovalWorkflowTemplateSerializer(serializers.ModelSerializer):
    steps = ApprovalWorkflowStepSerializer(many=True, read_only=True)

    class Meta:
        model = ApprovalWorkflowTemplate
        fields = ("id", "name", "code", "module_key", "description", "is_active", "steps")


class ApprovalDecisionSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.get_full_name", read_only=True)
    step_name = serializers.CharField(source="step.name", read_only=True)
    role_key = serializers.CharField(source="step.role.key", read_only=True)

    class Meta:
        model = ApprovalDecision
        fields = ("id", "step_name", "role_key", "status", "actor_name", "comments", "decided_at")


class ApprovalInstanceSerializer(serializers.ModelSerializer):
    decisions = ApprovalDecisionSerializer(many=True, read_only=True)
    pending_step_name = serializers.SerializerMethodField()
    pending_role_key = serializers.SerializerMethodField()

    class Meta:
        model = ApprovalInstance
        fields = ("id", "target_type", "status", "current_step", "submitted_at", "completed_at", "pending_step_name", "pending_role_key", "decisions")

    def get_pending_step_name(self, obj):
        pending_decision = obj.decisions.filter(status=ApprovalDecision.DecisionStatus.PENDING).select_related("step").order_by("step__sequence").first()
        return pending_decision.step.name if pending_decision else ""

    def get_pending_role_key(self, obj):
        pending_decision = obj.decisions.filter(status=ApprovalDecision.DecisionStatus.PENDING).select_related("step__role").order_by("step__sequence").first()
        return getattr(getattr(pending_decision, "step", None), "role", None).key if pending_decision and pending_decision.step.role else ""


class ProcurementRequestLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = ProcurementRequestLine
        fields = ("id", "line_number", "description", "product", "product_name", "unit_of_measure", "quantity", "unit_price", "line_total")


class ProcurementRequestSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)
    budget_account_name = serializers.CharField(source="budget_account.name", read_only=True)
    requested_by_name = serializers.CharField(source="requested_by.get_full_name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    lines = ProcurementRequestLineSerializer(many=True, read_only=True)
    approval_instance = ApprovalInstanceSerializer(read_only=True)
    purchase_order_id = serializers.SerializerMethodField()
    purchase_order_number = serializers.SerializerMethodField()
    available_actions = serializers.SerializerMethodField()
    is_locked = serializers.SerializerMethodField()
    audit_timeline = serializers.SerializerMethodField()
    approval_history = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()

    class Meta:
        model = ProcurementRequest
        fields = (
            "id",
            "request_number",
            "title",
            "justification",
            "needed_by_date",
            "department",
            "department_name",
            "budget_account",
            "budget_account_name",
            "requested_by",
            "requested_by_name",
            "status",
            "status_display",
            "total_amount",
            "submitted_at",
            "approved_at",
            "rejected_at",
            "converted_at",
            "purchase_order_id",
            "purchase_order_number",
            "available_actions",
            "is_locked",
            "audit_timeline",
            "approval_history",
            "attachments",
            "lines",
            "approval_instance",
            "created_at",
        )

    def get_purchase_order_id(self, obj):
        purchase_order = getattr(obj, "purchase_order", None)
        return str(purchase_order.id) if purchase_order else None

    def get_purchase_order_number(self, obj):
        purchase_order = getattr(obj, "purchase_order", None)
        return getattr(purchase_order, "po_number", None)

    def get_available_actions(self, obj):
        request = self.context.get("request")
        return _get_procurement_request_actions(obj, getattr(request, "user", None))

    def get_is_locked(self, obj):
        return obj.status != ProcurementRequest.Status.DRAFT

    def get_audit_timeline(self, obj):
        return _serialize_audit_timeline("ProcurementRequest", obj.id)

    def get_approval_history(self, obj):
        return serialize_approval_history(getattr(obj, "approval_instance", None))

    def get_attachments(self, obj):
        return _serialize_enterprise_attachments(EnterpriseAttachment.TargetType.PROCUREMENT_REQUEST, obj.id, self.context)


class PurchaseOrderLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    outstanding_quantity = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = PurchaseOrderLine
        fields = (
            "id",
            "line_number",
            "description",
            "product",
            "product_name",
            "unit_of_measure",
            "quantity_ordered",
            "quantity_received",
            "outstanding_quantity",
            "unit_price",
            "line_total",
        )


class PurchaseOrderSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source="vendor.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    branch_name = serializers.CharField(source="warehouse.branch.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    procurement_request_number = serializers.CharField(source="procurement_request.request_number", read_only=True)
    lines = PurchaseOrderLineSerializer(many=True, read_only=True)
    available_actions = serializers.SerializerMethodField()
    is_locked = serializers.SerializerMethodField()
    audit_timeline = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = (
            "id",
            "po_number",
            "procurement_request",
            "procurement_request_number",
            "vendor",
            "vendor_name",
            "warehouse",
            "warehouse_name",
            "branch_name",
            "status",
            "status_display",
            "notes",
            "total_amount",
            "issued_at",
            "available_actions",
            "is_locked",
            "audit_timeline",
            "lines",
            "created_at",
        )

    def get_available_actions(self, obj):
        request = self.context.get("request")
        return _get_purchase_order_actions(obj, getattr(request, "user", None))

    def get_is_locked(self, obj):
        return obj.status != PurchaseOrder.Status.DRAFT

    def get_audit_timeline(self, obj):
        return _serialize_audit_timeline("PurchaseOrder", obj.id)


class GoodsReceiptLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = GoodsReceiptLine
        fields = ("id", "product", "product_name", "quantity_received")


class GoodsReceiptSerializer(serializers.ModelSerializer):
    purchase_order_number = serializers.CharField(source="purchase_order.po_number", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    received_by_name = serializers.CharField(source="received_by.get_full_name", read_only=True)
    lines = GoodsReceiptLineSerializer(many=True, read_only=True)
    ledger_entries = serializers.SerializerMethodField()
    audit_timeline = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()

    class Meta:
        model = GoodsReceipt
        fields = (
            "id",
            "receipt_number",
            "purchase_order",
            "purchase_order_number",
            "warehouse",
            "warehouse_name",
            "received_by",
            "received_by_name",
            "status",
            "notes",
            "received_at",
            "lines",
            "ledger_entries",
            "audit_timeline",
            "attachments",
        )

    def get_ledger_entries(self, obj):
        entries = InventoryLedgerEntry.objects.filter(reference_number=obj.receipt_number).select_related("product", "warehouse").order_by("-occurred_at")
        return InventoryLedgerEntrySerializer(entries, many=True).data

    def get_audit_timeline(self, obj):
        return _serialize_audit_timeline("GoodsReceipt", obj.id)

    def get_attachments(self, obj):
        return _serialize_enterprise_attachments(EnterpriseAttachment.TargetType.GOODS_RECEIPT, obj.id, self.context)


class InventoryLedgerEntrySerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    movement_type_display = serializers.CharField(source="get_movement_type_display", read_only=True)

    class Meta:
        model = InventoryLedgerEntry
        fields = (
            "id",
            "product",
            "product_name",
            "warehouse",
            "warehouse_name",
            "movement_type",
            "movement_type_display",
            "quantity",
            "unit_cost",
            "reference_type",
            "reference_number",
            "occurred_at",
        )


class FinanceInvoiceSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source="vendor.name", read_only=True)
    purchase_order_number = serializers.CharField(source="purchase_order.po_number", read_only=True)
    branch_name = serializers.CharField(source="purchase_order.warehouse.branch.name", read_only=True)
    department_name = serializers.CharField(source="budget_account.department.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    payment_request_id = serializers.SerializerMethodField()
    payment_request_number = serializers.SerializerMethodField()
    payment_request_status = serializers.SerializerMethodField()
    available_actions = serializers.SerializerMethodField()
    is_locked = serializers.SerializerMethodField()
    audit_timeline = serializers.SerializerMethodField()
    approval_history = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()

    class Meta:
        model = FinanceInvoice
        fields = (
            "id",
            "invoice_number",
            "purchase_order",
            "purchase_order_number",
            "vendor",
            "vendor_name",
            "branch_name",
            "department_name",
            "status",
            "status_display",
            "amount",
            "invoice_date",
            "posted_at",
            "approved_at",
            "paid_at",
            "payment_reference",
            "payment_request_id",
            "payment_request_number",
            "payment_request_status",
            "available_actions",
            "is_locked",
            "audit_timeline",
            "approval_history",
            "attachments",
        )

    def get_payment_request_id(self, obj):
        payment_request = getattr(obj, "payment_request", None)
        return str(payment_request.id) if payment_request else None

    def get_payment_request_number(self, obj):
        payment_request = getattr(obj, "payment_request", None)
        return getattr(payment_request, "payment_request_number", None)

    def get_payment_request_status(self, obj):
        payment_request = getattr(obj, "payment_request", None)
        return getattr(payment_request, "status", None)

    def get_available_actions(self, obj):
        request = self.context.get("request")
        return _get_invoice_actions(obj, getattr(request, "user", None))

    def get_is_locked(self, obj):
        return obj.status != FinanceInvoice.Status.DRAFT

    def get_audit_timeline(self, obj):
        return _serialize_audit_timeline("FinanceInvoice", obj.id)

    def get_approval_history(self, obj):
        return serialize_approval_history(_get_record_approval_instance(ApprovalInstance.TargetType.FINANCE_INVOICE, obj.id))

    def get_attachments(self, obj):
        return _serialize_enterprise_attachments(EnterpriseAttachment.TargetType.FINANCE_INVOICE, obj.id, self.context)


class PaymentRequestSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source="invoice.invoice_number", read_only=True)
    branch_name = serializers.CharField(source="invoice.purchase_order.warehouse.branch.name", read_only=True)
    department_name = serializers.CharField(source="invoice.budget_account.department.name", read_only=True)
    requested_by_name = serializers.CharField(source="requested_by.get_full_name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    available_actions = serializers.SerializerMethodField()
    audit_timeline = serializers.SerializerMethodField()
    approval_history = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()

    class Meta:
        model = PaymentRequest
        fields = (
            "id",
            "payment_request_number",
            "invoice",
            "invoice_number",
            "branch_name",
            "department_name",
            "status",
            "status_display",
            "amount",
            "requested_by",
            "requested_by_name",
            "approved_at",
            "paid_at",
            "payment_reference",
            "available_actions",
            "audit_timeline",
            "approval_history",
            "attachments",
            "created_at",
        )

    def get_available_actions(self, obj):
        request = self.context.get("request")
        return _get_payment_request_actions(obj, getattr(request, "user", None))

    def get_audit_timeline(self, obj):
        return _serialize_audit_timeline("PaymentRequest", obj.id)

    def get_approval_history(self, obj):
        return serialize_approval_history(_get_record_approval_instance(ApprovalInstance.TargetType.PAYMENT_REQUEST, obj.id))

    def get_attachments(self, obj):
        return _serialize_enterprise_attachments(EnterpriseAttachment.TargetType.PAYMENT_REQUEST, obj.id, self.context)


class ProcurementRequestLineInputSerializer(serializers.Serializer):
    product = serializers.UUIDField(required=False, allow_null=True)
    description = serializers.CharField(max_length=255)
    unit_of_measure = serializers.CharField(max_length=30, allow_blank=True, required=False)
    quantity = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"))
    unit_price = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.00"))


class ProcurementRequestUpsertSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    justification = serializers.CharField(required=False, allow_blank=True)
    needed_by_date = serializers.DateField(required=False, allow_null=True)
    department = serializers.UUIDField()
    budget_account = serializers.UUIDField(required=False, allow_null=True)
    lines = ProcurementRequestLineInputSerializer(many=True, min_length=1)


class ApprovalActionSerializer(serializers.Serializer):
    comments = serializers.CharField(required=False, allow_blank=True)


class RejectionActionSerializer(serializers.Serializer):
    comments = serializers.CharField(required=True, allow_blank=False)


class ApprovalCommentSerializer(serializers.Serializer):
    body = serializers.CharField(required=True, allow_blank=False)


class ConvertPurchaseOrderSerializer(serializers.Serializer):
    vendor = serializers.UUIDField()
    warehouse = serializers.UUIDField()
    notes = serializers.CharField(required=False, allow_blank=True)


class GoodsReceiptLineInputSerializer(serializers.Serializer):
    purchase_order_line = serializers.UUIDField()
    quantity_received = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"))


class GoodsReceiptCreateSerializer(serializers.Serializer):
    warehouse = serializers.UUIDField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    lines = GoodsReceiptLineInputSerializer(many=True, min_length=1)


class InvoicePostSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"), required=False)
    invoice_date = serializers.DateField(required=False)


class PaymentRequestCreateSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"), required=False)


class PaymentMarkPaidSerializer(serializers.Serializer):
    payment_reference = serializers.CharField(max_length=80)
