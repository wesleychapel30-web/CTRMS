from __future__ import annotations

import json
from collections import defaultdict
from decimal import Decimal

from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.db import models
from django.http import FileResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from rest_framework import serializers as drf_serializers

from core.models import AuditLog
from core.rbac import require_any_permission, require_permission, user_has_permission

from .approval_engine import get_latest_approval_instance
from .models import (
    ApprovalInstance,
    BudgetAccount,
    Branch,
    Department,
    EnterpriseAttachment,
    FinanceInvoice,
    GoodsReceipt,
    InventoryLedgerEntry,
    Organization,
    PaymentRequest,
    ProcurementRequest,
    Product,
    PurchaseOrder,
    Vendor,
    Warehouse,
)
from .serializers import (
    ApprovalActionSerializer,
    ApprovalCommentSerializer,
    ApprovalInstanceSerializer,
    ApprovalWorkflowTemplateSerializer,
    BranchSerializer,
    BudgetAccountSerializer,
    ConvertPurchaseOrderSerializer,
    DepartmentSerializer,
    FinanceInvoiceSerializer,
    GoodsReceiptCreateSerializer,
    GoodsReceiptSerializer,
    InventoryLedgerEntrySerializer,
    InvoicePostSerializer,
    OrganizationSerializer,
    PaymentMarkPaidSerializer,
    PaymentRequestCreateSerializer,
    PaymentRequestSerializer,
    ProcurementRequestSerializer,
    ProcurementRequestUpsertSerializer,
    ProductSerializer,
    PurchaseOrderSerializer,
    RejectionActionSerializer,
    VendorSerializer,
    WarehouseSerializer,
    _get_invoice_actions,
    _get_payment_request_actions,
    _get_pending_procurement_decision,
    _get_purchase_order_actions,
    _get_procurement_request_actions,
)
from .services import (
    EnterpriseWorkflowError,
    add_invoice_approval_comment,
    add_payment_request_approval_comment,
    add_procurement_request_approval_comment,
    approve_invoice,
    approve_payment_request,
    approve_procurement_request,
    convert_procurement_request_to_purchase_order,
    create_payment_request,
    create_procurement_request,
    issue_purchase_order,
    mark_payment_request_paid,
    receive_purchase_order,
    reject_payment_request,
    reject_procurement_request,
    revert_invoice_approval,
    revert_payment_request_approval,
    revert_procurement_request_approval,
    submit_procurement_request,
    update_and_post_invoice,
    update_draft_procurement_request,
)


def _active_organization() -> Organization | None:
    return Organization.objects.filter(is_active=True).order_by("created_at").first() or Organization.objects.order_by("created_at").first()


def _serialize_chart_series(pairs):
    return [{"label": label, "value": value} for label, value in pairs]


def _monthly_invoice_trend(organization: Organization) -> list[dict[str, object]]:
    months: list[tuple[str, Decimal]] = []
    now = timezone.localdate()
    current_year = now.year
    current_month = now.month
    for offset in reversed(range(6)):
        month = current_month - offset
        year = current_year
        while month <= 0:
            month += 12
            year -= 1
        label = timezone.datetime(year, month, 1).strftime("%b")
        amount = (
            FinanceInvoice.objects.filter(
                organization=organization,
                invoice_date__year=year,
                invoice_date__month=month,
            )
            .exclude(status=FinanceInvoice.Status.DRAFT)
            .aggregate(total=models.Sum("amount"))
            .get("total")
            or Decimal("0.00")
        )
        months.append((label, float(amount)))
    return _serialize_chart_series(months)


def _recent_enterprise_activity(organization: Organization) -> list[dict[str, str]]:
    relevant_types = {"ProcurementRequest", "PurchaseOrder", "GoodsReceipt", "FinanceInvoice", "PaymentRequest"}
    logs = (
        AuditLog.objects.filter(content_type__in=relevant_types)
        .select_related("user")
        .order_by("-created_at")[:8]
    )
    tone_by_action = {
        AuditLog.ActionType.APPROVE: "success",
        AuditLog.ActionType.REJECT: "danger",
        AuditLog.ActionType.CREATE: "accent",
        AuditLog.ActionType.UPDATE: "warning",
    }
    return [
        {
            "title": log.content_type,
            "subtitle": log.description or f"{log.action_type} by {log.user.get_full_name() or log.user.username}",
            "date": timezone.localtime(log.created_at).strftime("%d %b %Y"),
            "tone": tone_by_action.get(log.action_type, "accent"),
        }
        for log in logs
    ]


def _json_error(message: str, *, status: int = 400, details=None):
    payload = {"success": False, "error": message}
    if details is not None:
        payload["details"] = details
    return JsonResponse(payload, status=status)


def _parse_payload(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise drf_serializers.ValidationError({"body": [f"Invalid JSON payload: {exc.msg}"]}) from exc


def _validated_payload(request, serializer_class):
    serializer = serializer_class(data=_parse_payload(request))
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data


def _resolve_organization() -> Organization:
    organization = _active_organization()
    if organization is None:
        raise EnterpriseWorkflowError("No active enterprise organization is configured.")
    return organization


def _resolve_department(organization: Organization, department_id) -> Department:
    department = Department.objects.filter(organization=organization, id=department_id, is_active=True).first()
    if department is None:
        raise drf_serializers.ValidationError({"department": ["Select a valid active department."]})
    return department


def _resolve_budget_account(organization: Organization, budget_account_id) -> BudgetAccount | None:
    if not budget_account_id:
        return None
    budget_account = BudgetAccount.objects.filter(organization=organization, id=budget_account_id).first()
    if budget_account is None:
        raise drf_serializers.ValidationError({"budget_account": ["Select a valid budget account."]})
    return budget_account


def _resolve_vendor(organization: Organization, vendor_id) -> Vendor:
    vendor = Vendor.objects.filter(organization=organization, id=vendor_id).first()
    if vendor is None:
        raise drf_serializers.ValidationError({"vendor": ["Select a valid vendor."]})
    return vendor


def _resolve_warehouse(organization: Organization, warehouse_id) -> Warehouse:
    warehouse = Warehouse.objects.filter(organization=organization, id=warehouse_id, is_active=True).first()
    if warehouse is None:
        raise drf_serializers.ValidationError({"warehouse": ["Select a valid active warehouse."]})
    return warehouse


def _resolve_procurement_line_items(organization: Organization, validated_lines):
    product_ids = [str(line["product"]) for line in validated_lines if line.get("product")]
    products = Product.objects.filter(organization=organization, id__in=product_ids)
    product_map = {str(product.id): product for product in products}

    resolved_lines = []
    for line in validated_lines:
        product = None
        if line.get("product"):
            product = product_map.get(str(line["product"]))
            if product is None:
                raise drf_serializers.ValidationError({"lines": ["One or more selected products do not belong to the active organization."]})
        resolved_lines.append(
            {
                "product": product,
                "description": line["description"],
                "unit_of_measure": line.get("unit_of_measure") or getattr(product, "unit_of_measure", "") or "unit",
                "quantity": line["quantity"],
                "unit_price": line["unit_price"],
            }
        )
    return resolved_lines


def _procurement_request_queryset(organization: Organization):
    return (
        ProcurementRequest.objects.filter(organization=organization)
        .select_related(
            "department",
            "budget_account",
            "requested_by",
            "approval_instance",
            "purchase_order",
        )
        .prefetch_related(
            "lines__product",
            "approval_instance__decisions__step__role",
            "approval_instance__decisions__actor",
        )
    )


def _purchase_order_queryset(organization: Organization):
    return (
        PurchaseOrder.objects.filter(organization=organization)
        .select_related(
            "vendor",
            "warehouse",
            "warehouse__branch",
            "procurement_request",
        )
        .prefetch_related("lines__product")
    )


def _goods_receipt_queryset(organization: Organization):
    return (
        GoodsReceipt.objects.filter(organization=organization)
        .select_related("purchase_order", "warehouse", "warehouse__branch", "received_by")
        .prefetch_related("lines__product")
    )


def _finance_invoice_queryset(organization: Organization):
    return (
        FinanceInvoice.objects.filter(organization=organization)
        .select_related(
            "vendor",
            "purchase_order",
            "purchase_order__warehouse",
            "purchase_order__warehouse__branch",
            "budget_account",
            "budget_account__department",
        )
    )


def _payment_request_queryset(organization: Organization):
    return (
        PaymentRequest.objects.filter(organization=organization)
        .select_related(
            "invoice",
            "invoice__vendor",
            "invoice__purchase_order",
            "invoice__purchase_order__warehouse",
            "invoice__purchase_order__warehouse__branch",
            "invoice__budget_account",
            "invoice__budget_account__department",
            "requested_by",
        )
    )


def _record_attachment_permissions(target_type: str, *, upload: bool) -> tuple[str, ...]:
    if target_type == EnterpriseAttachment.TargetType.PROCUREMENT_REQUEST:
        return ("procurement:create", "procurement:approve", "purchase_order:issue") if upload else (
            "procurement:view_all",
            "procurement:create",
            "procurement:approve",
            "purchase_order:issue",
        )
    if target_type == EnterpriseAttachment.TargetType.GOODS_RECEIPT:
        return ("goods_receipt:record",) if upload else ("goods_receipt:view", "goods_receipt:record")
    if target_type == EnterpriseAttachment.TargetType.FINANCE_INVOICE:
        return ("invoice:post", "invoice:approve", "payment:record") if upload else (
            "invoice:post",
            "invoice:approve",
            "payment_request:approve",
            "payment:record",
        )
    if target_type == EnterpriseAttachment.TargetType.PAYMENT_REQUEST:
        return ("payment_request:approve", "payment:record") if upload else (
            "invoice:post",
            "invoice:approve",
            "payment_request:approve",
            "payment:record",
        )
    return ()


def _user_can_access_enterprise_attachment(user, attachment: EnterpriseAttachment, *, upload: bool = False) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    permission_keys = _record_attachment_permissions(attachment.target_type, upload=upload)
    return any(user_has_permission(user, key) for key in permission_keys)


def _create_enterprise_attachment(*, organization: Organization, target_type: str, target_id, file, attachment_type: str, uploaded_by):
    attachment = EnterpriseAttachment(
        organization=organization,
        target_type=target_type,
        target_id=target_id,
        file=file,
        attachment_type=attachment_type or "Supporting Document",
        uploaded_by=uploaded_by,
    )
    attachment.save()
    return attachment


def _serialize(serializer_class, instance, *, request, many=False):
    return serializer_class(instance, many=many, context={"request": request}).data


def _record_response(key: str, serializer_class, instance, *, request, status: int = 200, message: str | None = None):
    payload = {"success": True, key: _serialize(serializer_class, instance, request=request)}
    if message:
        payload["message"] = message
    return JsonResponse(payload, status=status)


def _approval_inbox_items(organization: Organization, user):
    items: list[dict[str, object]] = []

    procurement_requests = _procurement_request_queryset(organization).filter(status=ProcurementRequest.Status.SUBMITTED)
    for procurement_request in procurement_requests:
        available_actions = _get_procurement_request_actions(procurement_request, user)
        actionable = [action for action in available_actions if action in {"approve", "reject"}]
        if not actionable:
            continue
        pending_decision = _get_pending_procurement_decision(procurement_request)
        items.append(
            {
                "id": f"procurement-request-{procurement_request.id}",
                "module_key": "procurement",
                "module_label": "Procurement",
                "entity_type": "procurement_request",
                "record_id": str(procurement_request.id),
                "record_number": procurement_request.request_number,
                "title": procurement_request.title,
                "subtitle": procurement_request.justification or "Approval required before purchase order conversion.",
                "status": procurement_request.status,
                "status_display": procurement_request.get_status_display(),
                "department_name": procurement_request.department.name,
                "branch_name": "",
                "requested_by_name": procurement_request.requested_by.get_full_name() if procurement_request.requested_by else "",
                "amount": float(procurement_request.total_amount),
                "pending_step_name": pending_decision.step.name if pending_decision else "",
                "pending_role_key": pending_decision.step.role.key if pending_decision and pending_decision.step.role else "",
                "created_at": procurement_request.submitted_at.isoformat() if procurement_request.submitted_at else procurement_request.created_at.isoformat(),
                "available_actions": actionable,
                "href": f"/procurement?request={procurement_request.id}",
            }
        )

    payment_requests = _payment_request_queryset(organization).filter(status=PaymentRequest.Status.SUBMITTED)
    for payment_request in payment_requests:
        available_actions = _get_payment_request_actions(payment_request, user)
        actionable = [action for action in available_actions if action in {"approve", "reject"}]
        if not actionable:
            continue
        approval_instance = get_latest_approval_instance(
            target_type=ApprovalInstance.TargetType.PAYMENT_REQUEST,
            target_id=payment_request.id,
            statuses=[ApprovalInstance.Status.PENDING],
        )
        pending_step = approval_instance.decisions.select_related("step", "step__role").filter(
            status="pending"
        ).order_by("step__sequence").first() if approval_instance else None
        items.append(
            {
                "id": f"payment-request-{payment_request.id}",
                "module_key": "finance",
                "module_label": "Finance",
                "entity_type": "payment_request",
                "record_id": str(payment_request.id),
                "record_number": payment_request.payment_request_number,
                "title": payment_request.invoice.invoice_number,
                "subtitle": f"Payment request for {payment_request.invoice.vendor.name}",
                "status": payment_request.status,
                "status_display": payment_request.get_status_display(),
                "department_name": payment_request.invoice.budget_account.department.name if payment_request.invoice.budget_account and payment_request.invoice.budget_account.department else "",
                "branch_name": payment_request.invoice.purchase_order.warehouse.branch.name if payment_request.invoice.purchase_order.warehouse.branch else "",
                "requested_by_name": payment_request.requested_by.get_full_name() if payment_request.requested_by else "",
                "amount": float(payment_request.amount),
                "pending_step_name": pending_step.step.name if pending_step else "Finance payment approval",
                "pending_role_key": pending_step.step.role.key if pending_step and pending_step.step.role else "payment_request:approve",
                "created_at": payment_request.created_at.isoformat(),
                "available_actions": actionable,
                "href": f"/finance?payment={payment_request.id}",
            }
        )

    finance_invoices = _finance_invoice_queryset(organization).filter(status=FinanceInvoice.Status.POSTED)
    for invoice in finance_invoices:
        available_actions = _get_invoice_actions(invoice, user)
        actionable = [action for action in available_actions if action == "approve"]
        if not actionable:
            continue
        approval_instance = get_latest_approval_instance(
            target_type=ApprovalInstance.TargetType.FINANCE_INVOICE,
            target_id=invoice.id,
            statuses=[ApprovalInstance.Status.PENDING],
        )
        pending_step = approval_instance.decisions.select_related("step", "step__role").filter(
            status="pending"
        ).order_by("step__sequence").first() if approval_instance else None
        items.append(
            {
                "id": f"finance-invoice-{invoice.id}",
                "module_key": "finance",
                "module_label": "Finance",
                "entity_type": "finance_invoice",
                "record_id": str(invoice.id),
                "record_number": invoice.invoice_number,
                "title": invoice.purchase_order.po_number,
                "subtitle": f"Invoice approval for {invoice.vendor.name}",
                "status": invoice.status,
                "status_display": invoice.get_status_display(),
                "department_name": invoice.budget_account.department.name if invoice.budget_account and invoice.budget_account.department else "",
                "branch_name": invoice.purchase_order.warehouse.branch.name if invoice.purchase_order.warehouse.branch else "",
                "requested_by_name": invoice.posted_by.get_full_name() if invoice.posted_by else "",
                "amount": float(invoice.amount),
                "pending_step_name": pending_step.step.name if pending_step else "Finance invoice approval",
                "pending_role_key": pending_step.step.role.key if pending_step and pending_step.step.role else "invoice:approve",
                "created_at": invoice.posted_at.isoformat() if invoice.posted_at else invoice.created_at.isoformat(),
                "available_actions": actionable,
                "href": f"/finance?invoice={invoice.id}",
            }
        )

    return sorted(items, key=lambda item: item["created_at"], reverse=True)


def _apply_approval_filters(items, request):
    module_key = (request.GET.get("module") or "").strip().lower()
    status_value = (request.GET.get("status") or "").strip().lower()
    branch_value = (request.GET.get("branch") or "").strip().lower()
    department_value = (request.GET.get("department") or "").strip().lower()
    query = (request.GET.get("q") or "").strip().lower()
    date_from = request.GET.get("date_from")
    date_to = request.GET.get("date_to")

    filtered = items
    if module_key:
        filtered = [item for item in filtered if str(item["module_key"]).lower() == module_key]
    if status_value:
        filtered = [item for item in filtered if str(item["status"]).lower() == status_value]
    if branch_value:
        filtered = [item for item in filtered if str(item["branch_name"]).lower() == branch_value]
    if department_value:
        filtered = [item for item in filtered if str(item["department_name"]).lower() == department_value]
    if query:
        filtered = [
            item
            for item in filtered
            if query in " ".join(
                [
                    str(item["record_number"]),
                    str(item["title"]),
                    str(item["subtitle"]),
                    str(item["department_name"]),
                    str(item["branch_name"]),
                    str(item["requested_by_name"]),
                ]
            ).lower()
        ]
    if date_from:
        filtered = [item for item in filtered if str(item["created_at"])[:10] >= date_from]
    if date_to:
        filtered = [item for item in filtered if str(item["created_at"])[:10] <= date_to]
    return filtered


@login_required
@require_permission("dashboard:view")
def enterprise_overview_api(request):
    organization = _active_organization()
    if organization is None:
        return JsonResponse(
            {
                "success": True,
                "organization": None,
                "summary": {
                    "organizations": 0,
                    "departments": 0,
                    "active_workflows": 0,
                    "open_purchase_requests": 0,
                    "issued_purchase_orders": 0,
                    "inventory_units": 0,
                    "draft_invoices": 0,
                    "pending_payments": 0,
                    "committed_budget": 0,
                    "spent_budget": 0,
                    "my_pending_approvals": 0,
                },
                "charts": {"procurement_pipeline": [], "module_mix": [], "spend_trend": []},
                "timeline": [],
                "alerts": [],
            }
        )

    inventory_units = (
        InventoryLedgerEntry.objects.filter(organization=organization).aggregate(total=models.Sum("quantity")).get("total")
        or Decimal("0.00")
    )
    committed_budget = (
        BudgetAccount.objects.filter(organization=organization).aggregate(total=models.Sum("committed_amount")).get("total")
        or Decimal("0.00")
    )
    spent_budget = (
        BudgetAccount.objects.filter(organization=organization).aggregate(total=models.Sum("spent_amount")).get("total")
        or Decimal("0.00")
    )

    submitted_count = ProcurementRequest.objects.filter(
        organization=organization,
        status=ProcurementRequest.Status.SUBMITTED,
    ).count()
    alerts = []
    if submitted_count:
        alerts.append(
            {
                "title": "Approval queue active",
                "message": f"{submitted_count} procurement request(s) are waiting for workflow action.",
            }
        )
    low_budget_count = sum(1 for account in BudgetAccount.objects.filter(organization=organization) if account.available_amount <= 0)
    if low_budget_count:
        alerts.append(
            {
                "title": "Budget attention required",
                "message": f"{low_budget_count} budget account(s) have no remaining available balance.",
            }
        )

    pipeline = _serialize_chart_series(
        [
            ("Draft", ProcurementRequest.objects.filter(organization=organization, status=ProcurementRequest.Status.DRAFT).count()),
            ("Submitted", submitted_count),
            ("Approved", ProcurementRequest.objects.filter(organization=organization, status=ProcurementRequest.Status.APPROVED).count()),
            ("Converted", ProcurementRequest.objects.filter(organization=organization, status=ProcurementRequest.Status.CONVERTED).count()),
        ]
    )
    module_mix = _serialize_chart_series(
        [
            ("Procurement", ProcurementRequest.objects.filter(organization=organization).count()),
            ("Orders", PurchaseOrder.objects.filter(organization=organization).count()),
            ("Inventory", GoodsReceipt.objects.filter(organization=organization).count()),
            ("Finance", FinanceInvoice.objects.filter(organization=organization).count()),
        ]
    )

    return JsonResponse(
        {
            "success": True,
            "organization": OrganizationSerializer(organization).data,
            "summary": {
                "organizations": Organization.objects.count(),
                "departments": Department.objects.filter(organization=organization).count(),
                "active_workflows": organization.approval_workflows.filter(is_active=True).count(),
                "open_purchase_requests": ProcurementRequest.objects.filter(
                    organization=organization,
                    status__in=[ProcurementRequest.Status.DRAFT, ProcurementRequest.Status.SUBMITTED, ProcurementRequest.Status.APPROVED],
                ).count(),
                "issued_purchase_orders": PurchaseOrder.objects.filter(
                    organization=organization,
                    status__in=[PurchaseOrder.Status.ISSUED, PurchaseOrder.Status.PARTIALLY_RECEIVED],
                ).count(),
                "inventory_units": float(inventory_units),
                "draft_invoices": FinanceInvoice.objects.filter(
                    organization=organization,
                    status__in=[FinanceInvoice.Status.DRAFT, FinanceInvoice.Status.POSTED],
                ).count(),
                "pending_payments": PaymentRequest.objects.filter(
                    organization=organization,
                    status__in=[PaymentRequest.Status.SUBMITTED, PaymentRequest.Status.APPROVED],
                ).count(),
                "committed_budget": float(committed_budget),
                "spent_budget": float(spent_budget),
                "my_pending_approvals": len(_approval_inbox_items(organization, request.user)),
            },
            "charts": {
                "procurement_pipeline": pipeline,
                "module_mix": module_mix,
                "spend_trend": _monthly_invoice_trend(organization),
            },
            "timeline": _recent_enterprise_activity(organization),
            "alerts": alerts,
        }
    )


@login_required
@require_any_permission(["procurement:view_all", "procurement:create", "purchase_order:view_all"])
def procurement_workspace_api(request):
    organization = _active_organization()
    if organization is None:
        return JsonResponse(
            {
                "success": True,
                "organization": None,
                "summary": {},
                "requests": [],
                "purchase_orders": [],
                "approval_queue": [],
                "vendors": [],
                "departments": [],
                "budget_accounts": [],
                "products": [],
                "warehouses": [],
            }
        )

    procurement_requests = _procurement_request_queryset(organization).order_by("-created_at")[:16]
    purchase_orders = _purchase_order_queryset(organization).order_by("-created_at")[:16]
    approval_queue = (
        ApprovalInstance.objects.filter(organization=organization, status=ApprovalInstance.Status.PENDING)
        .prefetch_related("decisions__step__role", "decisions__actor")
        .order_by("-submitted_at")[:12]
    )
    vendors = organization.vendors.order_by("name")

    return JsonResponse(
        {
            "success": True,
            "organization": OrganizationSerializer(organization).data,
            "summary": {
                "draft_requests": ProcurementRequest.objects.filter(organization=organization, status=ProcurementRequest.Status.DRAFT).count(),
                "submitted_requests": ProcurementRequest.objects.filter(organization=organization, status=ProcurementRequest.Status.SUBMITTED).count(),
                "approved_requests": ProcurementRequest.objects.filter(organization=organization, status=ProcurementRequest.Status.APPROVED).count(),
                "converted_requests": ProcurementRequest.objects.filter(organization=organization, status=ProcurementRequest.Status.CONVERTED).count(),
                "issued_orders": PurchaseOrder.objects.filter(organization=organization, status=PurchaseOrder.Status.ISSUED).count(),
                "receiving_orders": PurchaseOrder.objects.filter(organization=organization, status=PurchaseOrder.Status.PARTIALLY_RECEIVED).count(),
            },
            "requests": _serialize(ProcurementRequestSerializer, procurement_requests, request=request, many=True),
            "purchase_orders": _serialize(PurchaseOrderSerializer, purchase_orders, request=request, many=True),
            "approval_queue": ApprovalInstanceSerializer(approval_queue, many=True).data,
            "vendors": VendorSerializer(vendors, many=True).data,
            "departments": DepartmentSerializer(
                Department.objects.filter(organization=organization, is_active=True).select_related("manager").order_by("name"),
                many=True,
            ).data,
            "budget_accounts": BudgetAccountSerializer(
                BudgetAccount.objects.filter(organization=organization).select_related("department").order_by("code"),
                many=True,
            ).data,
            "products": ProductSerializer(
                Product.objects.filter(organization=organization, is_active=True).order_by("name"),
                many=True,
            ).data,
            "warehouses": WarehouseSerializer(
                Warehouse.objects.filter(organization=organization, is_active=True).select_related("branch").order_by("name"),
                many=True,
            ).data,
        }
    )


@login_required
@require_any_permission(["inventory:view", "goods_receipt:record", "purchase_order:view_all"])
def inventory_workspace_api(request):
    organization = _active_organization()
    if organization is None:
        return JsonResponse(
            {
                "success": True,
                "organization": None,
                "summary": {},
                "warehouses": [],
                "receipts": [],
                "ledger": [],
                "products": [],
                "receivable_orders": [],
            }
        )

    products = list(Product.objects.filter(organization=organization, is_active=True).order_by("name")[:20])
    ledger_totals = defaultdict(Decimal)
    for row in InventoryLedgerEntry.objects.filter(organization=organization).values("product_id").annotate(total=models.Sum("quantity")):
        ledger_totals[str(row["product_id"])] = row["total"] or Decimal("0.00")
    for product in products:
        product.on_hand_value = ledger_totals.get(str(product.id), Decimal("0.00"))

    receivable_orders = _purchase_order_queryset(organization).filter(
        status__in=[PurchaseOrder.Status.ISSUED, PurchaseOrder.Status.PARTIALLY_RECEIVED]
    ).order_by("-created_at")

    return JsonResponse(
        {
            "success": True,
            "organization": OrganizationSerializer(organization).data,
            "summary": {
                "warehouses": Warehouse.objects.filter(organization=organization, is_active=True).count(),
                "receipts_posted": GoodsReceipt.objects.filter(organization=organization).count(),
                "inventory_lines": InventoryLedgerEntry.objects.filter(organization=organization).count(),
                "stock_alerts": sum(1 for product in products if getattr(product, "on_hand_value", Decimal("0.00")) <= product.reorder_level),
                "receivable_orders": receivable_orders.count(),
            },
            "warehouses": WarehouseSerializer(organization.warehouses.order_by("name"), many=True).data,
            "receipts": _serialize(
                GoodsReceiptSerializer,
                _goods_receipt_queryset(organization).order_by("-received_at")[:16],
                request=request,
                many=True,
            ),
            "ledger": InventoryLedgerEntrySerializer(
                InventoryLedgerEntry.objects.filter(organization=organization)
                .select_related("product", "warehouse")
                .order_by("-occurred_at")[:24],
                many=True,
            ).data,
            "products": ProductSerializer(products, many=True).data,
            "receivable_orders": _serialize(PurchaseOrderSerializer, receivable_orders[:16], request=request, many=True),
        }
    )


@login_required
@require_any_permission(["finance:view", "payment:view", "payment:record"])
def finance_workspace_api(request):
    organization = _active_organization()
    if organization is None:
        return JsonResponse(
            {
                "success": True,
                "organization": None,
                "summary": {},
                "budgets": [],
                "invoices": [],
                "payment_requests": [],
            }
        )

    budgets = list(BudgetAccount.objects.filter(organization=organization).select_related("department").order_by("code"))
    invoices = _finance_invoice_queryset(organization).order_by("-created_at")[:16]
    payment_requests = _payment_request_queryset(organization).order_by("-created_at")[:16]
    return JsonResponse(
        {
            "success": True,
            "organization": OrganizationSerializer(organization).data,
            "summary": {
                "draft_invoices": FinanceInvoice.objects.filter(organization=organization, status=FinanceInvoice.Status.DRAFT).count(),
                "posted_invoices": FinanceInvoice.objects.filter(organization=organization, status=FinanceInvoice.Status.POSTED).count(),
                "approved_invoices": FinanceInvoice.objects.filter(organization=organization, status=FinanceInvoice.Status.APPROVED).count(),
                "pending_payments": PaymentRequest.objects.filter(
                    organization=organization,
                    status__in=[PaymentRequest.Status.SUBMITTED, PaymentRequest.Status.APPROVED],
                ).count(),
                "paid_requests": PaymentRequest.objects.filter(organization=organization, status=PaymentRequest.Status.PAID).count(),
                "budget_risk_accounts": sum(1 for budget in budgets if budget.available_amount <= 0),
            },
            "budgets": BudgetAccountSerializer(budgets, many=True).data,
            "invoices": _serialize(FinanceInvoiceSerializer, invoices, request=request, many=True),
            "payment_requests": _serialize(PaymentRequestSerializer, payment_requests, request=request, many=True),
        }
    )


@login_required
@require_any_permission(["user:manage", "rbac:manage", "settings:update"])
def organization_workspace_api(request):
    organization = _active_organization()

    if request.method == "PATCH":
        if organization is None:
            return _json_error("No active organization found.", status=404)
        payload = _parse_payload(request)
        # Only update fields that are present and non-empty (required fields must stay set)
        required_fields = {"name", "timezone", "currency_code"}
        optional_fields = {"legal_name"}
        updated_fields = []
        for field in required_fields | optional_fields:
            if field not in payload:
                continue
            value = payload[field]
            if field in required_fields and not str(value).strip():
                continue  # skip — don't blank out a required field
            setattr(organization, field, value)
            updated_fields.append(field)
        if not updated_fields:
            return JsonResponse({"success": True, "organization": OrganizationSerializer(organization).data})
        organization.save(update_fields=[*updated_fields, "updated_at"])
        return JsonResponse({"success": True, "organization": OrganizationSerializer(organization).data})

    if organization is None:
        return JsonResponse(
            {
                "success": True,
                "organization": None,
                "organizations": [],
                "departments": [],
                "branches": [],
                "workflows": [],
            }
        )

    return JsonResponse(
        {
            "success": True,
            "organization": OrganizationSerializer(organization).data,
            "organizations": OrganizationSerializer(Organization.objects.order_by("name"), many=True).data,
            "departments": DepartmentSerializer(
                Department.objects.filter(organization=organization).select_related("manager").order_by("name"),
                many=True,
            ).data,
            "branches": BranchSerializer(organization.branches.order_by("name"), many=True).data,
            "workflows": ApprovalWorkflowTemplateSerializer(
                organization.approval_workflows.prefetch_related("steps__role").order_by("name"),
                many=True,
            ).data,
        }
    )


@login_required
@require_any_permission(["user:manage", "settings:update"])
def department_api(request):
    organization = _active_organization()
    if organization is None:
        return _json_error("No active organization found.", status=404)

    payload = _parse_payload(request)
    name = (payload.get("name") or "").strip()
    code = (payload.get("code") or "").strip()
    description = (payload.get("description") or "").strip()
    is_active = payload.get("is_active", True)

    if not name:
        return _json_error("Department name is required.", status=400)

    dept = Department(
        organization=organization,
        name=name,
        code=code,
        description=description,
        is_active=bool(is_active),
    )
    dept.save()
    return JsonResponse(
        {"success": True, "department": DepartmentSerializer(dept).data},
        status=201,
    )


@login_required
@require_any_permission(["user:manage", "settings:update"])
def department_detail_api(request, dept_id):
    organization = _active_organization()
    if organization is None:
        return _json_error("No active organization found.", status=404)

    dept = Department.objects.filter(organization=organization, id=dept_id).select_related("manager").first()
    if dept is None:
        return _json_error("Department not found.", status=404)

    if request.method == "DELETE":
        dept.delete()
        return JsonResponse({"success": True})

    payload = _parse_payload(request)
    updated_fields = []
    for field in ("name", "code", "description", "is_active"):
        if field in payload:
            setattr(dept, field, payload[field])
            updated_fields.append(field)
    if updated_fields:
        dept.save(update_fields=[*updated_fields, "updated_at"])
    return JsonResponse({"success": True, "department": DepartmentSerializer(dept).data})


@login_required
@require_any_permission(["user:manage", "settings:update"])
def branch_api(request):
    organization = _active_organization()
    if organization is None:
        return _json_error("No active organization found.", status=404)

    payload = _parse_payload(request)
    name = (payload.get("name") or "").strip()
    code = (payload.get("code") or "").strip()
    city = (payload.get("city") or "").strip()
    country = (payload.get("country") or "").strip()
    address = (payload.get("address") or "").strip()
    is_active = payload.get("is_active", True)

    if not name:
        return _json_error("Branch name is required.", status=400)

    branch = Branch(
        organization=organization,
        name=name,
        code=code,
        city=city,
        country=country,
        address=address,
        is_active=bool(is_active),
    )
    branch.save()
    return JsonResponse(
        {"success": True, "branch": BranchSerializer(branch).data},
        status=201,
    )


@login_required
@require_any_permission(["user:manage", "settings:update"])
def branch_detail_api(request, branch_id):
    organization = _active_organization()
    if organization is None:
        return _json_error("No active organization found.", status=404)

    branch = Branch.objects.filter(organization=organization, id=branch_id).first()
    if branch is None:
        return _json_error("Branch not found.", status=404)

    if request.method == "DELETE":
        branch.delete()
        return JsonResponse({"success": True})

    payload = _parse_payload(request)
    updated_fields = []
    for field in ("name", "code", "city", "country", "address", "is_active"):
        if field in payload:
            setattr(branch, field, payload[field])
            updated_fields.append(field)
    if updated_fields:
        branch.save(update_fields=[*updated_fields, "updated_at"])
    return JsonResponse({"success": True, "branch": BranchSerializer(branch).data})


@login_required
@require_any_permission(["inventory:view", "goods_receipt:record", "procurement:create", "procurement:view_all"])
def product_catalog_api(request):
    """List products (GET) or create a new product (POST)."""
    organization = _active_organization()
    if organization is None:
        return _json_error("No active organization found.", status=404)

    if request.method == "GET":
        include_inactive = request.GET.get("include_inactive") == "1"
        qs = Product.objects.filter(organization=organization)
        if not include_inactive:
            qs = qs.filter(is_active=True)
        products = list(qs.order_by("name"))
        ledger_totals = defaultdict(Decimal)
        for row in InventoryLedgerEntry.objects.filter(organization=organization).values("product_id").annotate(total=models.Sum("quantity")):
            ledger_totals[str(row["product_id"])] = row["total"] or Decimal("0.00")
        for p in products:
            p.on_hand_value = ledger_totals.get(str(p.id), Decimal("0.00"))
        return JsonResponse({"success": True, "products": ProductSerializer(products, many=True).data})

    if request.method != "POST":
        return _json_error("Method not allowed.", status=405)

    if not user_has_permission(request.user, "goods_receipt:record") and not user_has_permission(request.user, "inventory:view"):
        return _json_error("Permission denied.", status=403)

    payload = _parse_payload(request)
    sku = (payload.get("sku") or "").strip()
    name = (payload.get("name") or "").strip()
    if not sku:
        return _json_error("SKU is required.", status=400)
    if not name:
        return _json_error("Product name is required.", status=400)

    if Product.objects.filter(organization=organization, sku=sku).exists():
        return _json_error(f"A product with SKU '{sku}' already exists.", status=400)

    product = Product(
        organization=organization,
        sku=sku,
        name=name,
        description=payload.get("description", ""),
        unit_of_measure=payload.get("unit_of_measure", "unit") or "unit",
        standard_cost=payload.get("standard_cost", "0.00") or "0.00",
        reorder_level=payload.get("reorder_level", "0.00") or "0.00",
        is_active=bool(payload.get("is_active", True)),
    )
    try:
        product.full_clean()
        product.save()
    except Exception as exc:
        return _json_error(str(exc), status=400)

    product.on_hand_value = Decimal("0.00")
    AuditLog.objects.create(
        user=request.user,
        action_type=AuditLog.ActionType.CREATE,
        content_type="Product",
        object_id=str(product.id),
        description=f"Created product {product.sku} · {product.name}.",
    )
    return JsonResponse({"success": True, "product": ProductSerializer(product).data}, status=201)


@login_required
@require_any_permission(["inventory:view", "goods_receipt:record", "procurement:create", "procurement:view_all"])
def product_catalog_detail_api(request, product_id):
    """Retrieve (GET), update (PATCH), or deactivate (DELETE) a product."""
    organization = _active_organization()
    if organization is None:
        return _json_error("No active organization found.", status=404)

    product = Product.objects.filter(organization=organization, id=product_id).first()
    if product is None:
        return _json_error("Product not found.", status=404)

    if request.method == "GET":
        product.on_hand_value = product.on_hand
        return JsonResponse({"success": True, "product": ProductSerializer(product).data})

    if request.method == "DELETE":
        product.is_active = False
        product.save(update_fields=["is_active", "updated_at"])
        return JsonResponse({"success": True})

    if request.method != "PATCH":
        return _json_error("Method not allowed.", status=405)

    payload = _parse_payload(request)
    updated_fields = []
    for field in ("name", "description", "unit_of_measure", "standard_cost", "reorder_level", "is_active"):
        if field in payload:
            setattr(product, field, payload[field])
            updated_fields.append(field)
    if "sku" in payload:
        new_sku = (payload["sku"] or "").strip()
        if new_sku and new_sku != product.sku:
            if Product.objects.filter(organization=organization, sku=new_sku).exclude(id=product.id).exists():
                return _json_error(f"A product with SKU '{new_sku}' already exists.", status=400)
            product.sku = new_sku
            updated_fields.append("sku")
    if updated_fields:
        try:
            product.full_clean()
            product.save(update_fields=[*updated_fields, "updated_at"])
        except Exception as exc:
            return _json_error(str(exc), status=400)

    product.on_hand_value = product.on_hand
    return JsonResponse({"success": True, "product": ProductSerializer(product).data})


@login_required
@require_any_permission(["purchase_order:issue", "goods_receipt:record"])
def purchase_order_line_link_api(request, line_id):
    """PATCH: link or unlink a purchase order line to a catalog product."""
    from .models import PurchaseOrderLine
    organization = _active_organization()
    if organization is None:
        return _json_error("No active organization found.", status=404)

    line = PurchaseOrderLine.objects.select_related("purchase_order").filter(
        id=line_id, purchase_order__organization=organization
    ).first()
    if line is None:
        return _json_error("Purchase order line not found.", status=404)

    if line.purchase_order.status not in {PurchaseOrder.Status.DRAFT, PurchaseOrder.Status.ISSUED, PurchaseOrder.Status.PARTIALLY_RECEIVED}:
        return _json_error("Cannot re-link products on a fully received or cancelled order.", status=400)

    payload = _parse_payload(request)
    product_id = payload.get("product_id")
    if product_id is None:
        return _json_error("product_id is required.", status=400)

    if product_id == "" or product_id is None:
        line.product = None
    else:
        product = Product.objects.filter(organization=organization, id=product_id, is_active=True).first()
        if product is None:
            return _json_error("Product not found in catalog.", status=404)
        line.product = product

    line.save(update_fields=["product", "updated_at"])
    return JsonResponse({"success": True, "line_id": str(line.id), "product_id": str(line.product_id) if line.product_id else None})


@login_required
@require_any_permission(["procurement:approve", "payment_request:approve", "invoice:approve"])
def approval_inbox_api(request):
    organization = _active_organization()
    if organization is None:
        return JsonResponse({"success": True, "summary": {}, "items": [], "filters": {}})

    items = _apply_approval_filters(_approval_inbox_items(organization, request.user), request)
    filters = {
        "modules": sorted({item["module_key"] for item in items}),
        "statuses": sorted({item["status"] for item in items}),
        "branches": sorted({item["branch_name"] for item in items if item["branch_name"]}),
        "departments": sorted({item["department_name"] for item in items if item["department_name"]}),
    }
    return JsonResponse(
        {
            "success": True,
            "summary": {
                "pending_items": len(items),
                "procurement_items": sum(1 for item in items if item["module_key"] == "procurement"),
                "finance_items": sum(1 for item in items if item["module_key"] == "finance"),
                "total_amount": round(sum(float(item["amount"]) for item in items), 2),
            },
            "items": items,
            "filters": filters,
        }
    )


@login_required
@require_http_methods(["POST"])
@require_permission("procurement:create")
def procurement_request_create_api(request):
    try:
        organization = _resolve_organization()
        payload = _validated_payload(request, ProcurementRequestUpsertSerializer)
        department = _resolve_department(organization, payload["department"])
        budget_account = _resolve_budget_account(organization, payload.get("budget_account"))
        line_items = _resolve_procurement_line_items(organization, payload["lines"])
        procurement_request = create_procurement_request(
            organization=organization,
            actor=request.user,
            department=department,
            budget_account=budget_account,
            title=payload["title"],
            justification=payload.get("justification", ""),
            needed_by_date=payload.get("needed_by_date"),
            line_items=line_items,
        )
        procurement_request = _procurement_request_queryset(organization).get(id=procurement_request.id)
        return _record_response("request", ProcurementRequestSerializer, procurement_request, request=request, status=201)
    except drf_serializers.ValidationError as exc:
        return _json_error("Validation failed.", status=400, details=exc.detail)
    except EnterpriseWorkflowError as exc:
        return _json_error(str(exc), status=400)


@login_required
@require_http_methods(["PATCH"])
@require_permission("procurement:create")
def procurement_request_update_api(request, request_id):
    try:
        organization = _resolve_organization()
        procurement_request = _procurement_request_queryset(organization).filter(id=request_id).first()
        if procurement_request is None:
            return _json_error("Procurement request not found.", status=404)
        payload = _validated_payload(request, ProcurementRequestUpsertSerializer)
        department = _resolve_department(organization, payload["department"])
        budget_account = _resolve_budget_account(organization, payload.get("budget_account"))
        line_items = _resolve_procurement_line_items(organization, payload["lines"])
        procurement_request = update_draft_procurement_request(
            procurement_request,
            actor=request.user,
            department=department,
            budget_account=budget_account,
            title=payload["title"],
            justification=payload.get("justification", ""),
            needed_by_date=payload.get("needed_by_date"),
            line_items=line_items,
        )
        procurement_request = _procurement_request_queryset(organization).get(id=procurement_request.id)
        return _record_response("request", ProcurementRequestSerializer, procurement_request, request=request)
    except drf_serializers.ValidationError as exc:
        return _json_error("Validation failed.", status=400, details=exc.detail)
    except EnterpriseWorkflowError as exc:
        return _json_error(str(exc), status=400)


@login_required
@require_http_methods(["POST"])
@require_permission("procurement:create")
def procurement_request_submit_api(request, request_id):
    try:
        organization = _resolve_organization()
        procurement_request = _procurement_request_queryset(organization).filter(id=request_id).first()
        if procurement_request is None:
            return _json_error("Procurement request not found.", status=404)
        procurement_request = submit_procurement_request(procurement_request, actor=request.user)
        procurement_request = _procurement_request_queryset(organization).get(id=procurement_request.id)
        return _record_response("request", ProcurementRequestSerializer, procurement_request, request=request, message="Procurement request submitted for approval.")
    except EnterpriseWorkflowError as exc:
        return _json_error(str(exc), status=400)


@login_required
@require_http_methods(["POST"])
@require_permission("procurement:approve")
def procurement_request_approve_api(request, request_id):
    try:
        organization = _resolve_organization()
        procurement_request = _procurement_request_queryset(organization).filter(id=request_id).first()
        if procurement_request is None:
            return _json_error("Procurement request not found.", status=404)
        payload = _validated_payload(request, ApprovalActionSerializer)
        if "approve" not in _get_procurement_request_actions(procurement_request, request.user):
            return _json_error("You cannot approve this procurement request at its current workflow step.", status=403)
        procurement_request = approve_procurement_request(procurement_request, actor=request.user, comments=payload.get("comments", ""))
        procurement_request = _procurement_request_queryset(organization).get(id=procurement_request.id)
        message = (
            "Procurement request fully approved."
            if procurement_request.status == ProcurementRequest.Status.APPROVED
            else "Approval step recorded. The request remains in the shared approval workflow."
        )
        return _record_response("request", ProcurementRequestSerializer, procurement_request, request=request, message=message)
    except drf_serializers.ValidationError as exc:
        return _json_error("Validation failed.", status=400, details=exc.detail)
    except EnterpriseWorkflowError as exc:
        return _json_error(str(exc), status=400)


@login_required
@require_http_methods(["POST"])
@require_permission("procurement:approve")
def procurement_request_reject_api(request, request_id):
    try:
        organization = _resolve_organization()
        procurement_request = _procurement_request_queryset(organization).filter(id=request_id).first()
        if procurement_request is None:
            return _json_error("Procurement request not found.", status=404)
        payload = _validated_payload(request, RejectionActionSerializer)
        if "reject" not in _get_procurement_request_actions(procurement_request, request.user):
            return _json_error("You cannot reject this procurement request at its current workflow step.", status=403)
        procurement_request = reject_procurement_request(procurement_request, actor=request.user, comments=payload["comments"])
        procurement_request = _procurement_request_queryset(organization).get(id=procurement_request.id)
        return _record_response("request", ProcurementRequestSerializer, procurement_request, request=request, message="Procurement request rejected.")
    except drf_serializers.ValidationError as exc:
        return _json_error("Validation failed.", status=400, details=exc.detail)
    except EnterpriseWorkflowError as exc:
        return _json_error(str(exc), status=400)


@login_required
@require_http_methods(["POST"])
@require_permission("procurement:approve")
def procurement_request_revert_api(request, request_id):
    try:
        organization = _resolve_organization()
        procurement_request = _procurement_request_queryset(organization).filter(id=request_id).first()
        if procurement_request is None:
            return _json_error("Procurement request not found.", status=404)
        if "revert" not in _get_procurement_request_actions(procurement_request, request.user):
            return _json_error("This procurement request cannot be reverted right now.", status=403)
        payload = _validated_payload(request, ApprovalActionSerializer)
        procurement_request = revert_procurement_request_approval(
            procurement_request,
            actor=request.user,
            comments=payload.get("comments", ""),
        )
        procurement_request = _procurement_request_queryset(organization).get(id=procurement_request.id)
        return _record_response("request", ProcurementRequestSerializer, procurement_request, request=request, message="Procurement request returned to the shared approval workflow.")
    except drf_serializers.ValidationError as exc:
        return _json_error("Validation failed.", status=400, details=exc.detail)
    except EnterpriseWorkflowError as exc:
        return _json_error(str(exc), status=400)


@login_required
@require_http_methods(["POST"])
@require_permission("procurement:approve")
def procurement_request_comment_api(request, request_id):
    try:
        organization = _resolve_organization()
        procurement_request = _procurement_request_queryset(organization).filter(id=request_id).first()
        if procurement_request is None:
            return _json_error("Procurement request not found.", status=404)
        payload = _validated_payload(request, ApprovalCommentSerializer)
        procurement_request = add_procurement_request_approval_comment(procurement_request, actor=request.user, body=payload["body"])
        procurement_request = _procurement_request_queryset(organization).get(id=procurement_request.id)
        return _record_response("request", ProcurementRequestSerializer, procurement_request, request=request, message="Approval comment added.")
    except drf_serializers.ValidationError as exc:
        return _json_error("Validation failed.", status=400, details=exc.detail)
    except EnterpriseWorkflowError as exc:
        return _json_error(str(exc), status=400)


@login_required
@require_http_methods(["POST"])
@require_permission("purchase_order:issue")
def procurement_request_convert_api(request, request_id):
    try:
        organization = _resolve_organization()
        procurement_request = _procurement_request_queryset(organization).filter(id=request_id).first()
        if procurement_request is None:
            return _json_error("Procurement request not found.", status=404)
        if "convert_to_purchase_order" not in _get_procurement_request_actions(procurement_request, request.user):
            return _json_error("This procurement request cannot be converted right now.", status=403)
        payload = _validated_payload(request, ConvertPurchaseOrderSerializer)
        vendor = _resolve_vendor(organization, payload["vendor"])
        warehouse = _resolve_warehouse(organization, payload["warehouse"])
        purchase_order = convert_procurement_request_to_purchase_order(
            procurement_request,
            actor=request.user,
            vendor=vendor,
            warehouse=warehouse,
            notes=payload.get("notes", ""),
        )
        purchase_order = _purchase_order_queryset(organization).get(id=purchase_order.id)
        return _record_response("purchase_order", PurchaseOrderSerializer, purchase_order, request=request, status=201, message="Purchase order created from approved request.")
    except drf_serializers.ValidationError as exc:
        return _json_error("Validation failed.", status=400, details=exc.detail)
    except EnterpriseWorkflowError as exc:
        return _json_error(str(exc), status=400)


@login_required
@require_http_methods(["POST"])
@require_any_permission(["procurement:create", "procurement:approve", "purchase_order:issue"])
def procurement_request_attachment_upload_api(request, request_id):
    try:
        organization = _resolve_organization()
        procurement_request = _procurement_request_queryset(organization).filter(id=request_id).first()
        if procurement_request is None:
            return _json_error("Procurement request not found.", status=404)
        upload = request.FILES.get("file")
        attachment_type = request.POST.get("attachment_type", "Supporting Document")
        if not upload:
            return _json_error("Attachment file is required.", status=400)
        _create_enterprise_attachment(
            organization=organization,
            target_type=EnterpriseAttachment.TargetType.PROCUREMENT_REQUEST,
            target_id=procurement_request.id,
            file=upload,
            attachment_type=attachment_type,
            uploaded_by=request.user,
        )
        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.CREATE,
            content_type="ProcurementRequest",
            object_id=str(procurement_request.id),
            description=f"Uploaded attachment: {attachment_type}.",
        )
        procurement_request = _procurement_request_queryset(organization).get(id=procurement_request.id)
        return _record_response("request", ProcurementRequestSerializer, procurement_request, request=request, status=201, message="Attachment uploaded.")
    except ValidationError as exc:
        message = exc.messages[0] if getattr(exc, "messages", None) else "Attachment validation failed."
        return _json_error(message, status=400)


@login_required
@require_http_methods(["POST"])
@require_permission("purchase_order:issue")
def purchase_order_issue_api(request, purchase_order_id):
    try:
        organization = _resolve_organization()
        purchase_order = _purchase_order_queryset(organization).filter(id=purchase_order_id).first()
        if purchase_order is None:
            return _json_error("Purchase order not found.", status=404)
        if "issue" not in _get_purchase_order_actions(purchase_order, request.user):
            return _json_error("This purchase order cannot be issued in its current state.", status=403)
        purchase_order = issue_purchase_order(purchase_order, actor=request.user)
        purchase_order = _purchase_order_queryset(organization).get(id=purchase_order.id)
        return _record_response("purchase_order", PurchaseOrderSerializer, purchase_order, request=request, message="Purchase order issued.")
    except EnterpriseWorkflowError as exc:
        return _json_error(str(exc), status=400)


@login_required
@require_http_methods(["POST"])
@require_permission("goods_receipt:record")
def purchase_order_receive_api(request, purchase_order_id):
    try:
        organization = _resolve_organization()
        purchase_order = _purchase_order_queryset(organization).filter(id=purchase_order_id).first()
        if purchase_order is None:
            return _json_error("Purchase order not found.", status=404)
        if "record_goods_receipt" not in _get_purchase_order_actions(purchase_order, request.user):
            return _json_error("Goods cannot be received for this purchase order yet.", status=403)
        payload = _validated_payload(request, GoodsReceiptCreateSerializer)
        warehouse = _resolve_warehouse(organization, payload["warehouse"]) if payload.get("warehouse") else purchase_order.warehouse
        order_lines = {str(line.id): line for line in purchase_order.lines.all()}
        quantities_by_line = {}
        for line in payload["lines"]:
            line_id = str(line["purchase_order_line"])
            if line_id not in order_lines:
                raise drf_serializers.ValidationError({"lines": [f"Purchase order line {line_id} is not part of this order."]})
            quantities_by_line[line_id] = line["quantity_received"]
        receipt = receive_purchase_order(
            purchase_order,
            actor=request.user,
            warehouse=warehouse,
            notes=payload.get("notes", ""),
            quantities_by_line=quantities_by_line,
        )
        receipt = _goods_receipt_queryset(organization).get(id=receipt.id)
        return _record_response("goods_receipt", GoodsReceiptSerializer, receipt, request=request, status=201, message="Goods receipt posted and inventory updated.")
    except drf_serializers.ValidationError as exc:
        return _json_error("Validation failed.", status=400, details=exc.detail)
    except EnterpriseWorkflowError as exc:
        return _json_error(str(exc), status=400)


@login_required
@require_http_methods(["POST"])
@require_permission("goods_receipt:record")
def goods_receipt_attachment_upload_api(request, receipt_id):
    try:
        organization = _resolve_organization()
        receipt = _goods_receipt_queryset(organization).filter(id=receipt_id).first()
        if receipt is None:
            return _json_error("Goods receipt not found.", status=404)
        upload = request.FILES.get("file")
        attachment_type = request.POST.get("attachment_type", "Supporting Document")
        if not upload:
            return _json_error("Attachment file is required.", status=400)
        _create_enterprise_attachment(
            organization=organization,
            target_type=EnterpriseAttachment.TargetType.GOODS_RECEIPT,
            target_id=receipt.id,
            file=upload,
            attachment_type=attachment_type,
            uploaded_by=request.user,
        )
        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.CREATE,
            content_type="GoodsReceipt",
            object_id=str(receipt.id),
            description=f"Uploaded attachment: {attachment_type}.",
        )
        receipt = _goods_receipt_queryset(organization).get(id=receipt.id)
        return _record_response("goods_receipt", GoodsReceiptSerializer, receipt, request=request, status=201, message="Attachment uploaded.")
    except ValidationError as exc:
        message = exc.messages[0] if getattr(exc, "messages", None) else "Attachment validation failed."
        return _json_error(message, status=400)


@login_required
@require_http_methods(["POST"])
@require_permission("invoice:post")
def finance_invoice_post_api(request, invoice_id):
    try:
        organization = _resolve_organization()
        invoice = _finance_invoice_queryset(organization).filter(id=invoice_id).first()
        if invoice is None:
            return _json_error("Finance invoice not found.", status=404)
        payload = _validated_payload(request, InvoicePostSerializer)
        if "post" not in _get_invoice_actions(invoice, request.user):
            return _json_error("This invoice cannot be posted yet.", status=403)
        invoice = update_and_post_invoice(
            invoice,
            actor=request.user,
            amount=payload.get("amount"),
            invoice_date=payload.get("invoice_date"),
        )
        invoice = _finance_invoice_queryset(organization).get(id=invoice.id)
        return _record_response("invoice", FinanceInvoiceSerializer, invoice, request=request, message="Invoice posted for approval.")
    except drf_serializers.ValidationError as exc:
        return _json_error("Validation failed.", status=400, details=exc.detail)
    except EnterpriseWorkflowError as exc:
        return _json_error(str(exc), status=400)


@login_required
@require_http_methods(["POST"])
@require_permission("invoice:approve")
def finance_invoice_approve_api(request, invoice_id):
    try:
        organization = _resolve_organization()
        invoice = _finance_invoice_queryset(organization).filter(id=invoice_id).first()
        if invoice is None:
            return _json_error("Finance invoice not found.", status=404)
        if "approve" not in _get_invoice_actions(invoice, request.user):
            return _json_error("This invoice cannot be approved in its current state.", status=403)
        invoice = approve_invoice(invoice, actor=request.user)
        invoice = _finance_invoice_queryset(organization).get(id=invoice.id)
        message = (
            "Invoice approved and ready for payment request creation."
            if invoice.status == FinanceInvoice.Status.APPROVED
            else "Invoice approval step recorded. The invoice remains in the shared approval workflow."
        )
        return _record_response("invoice", FinanceInvoiceSerializer, invoice, request=request, message=message)
    except EnterpriseWorkflowError as exc:
        return _json_error(str(exc), status=400)


@login_required
@require_http_methods(["POST"])
@require_permission("invoice:approve")
def finance_invoice_revert_api(request, invoice_id):
    try:
        organization = _resolve_organization()
        invoice = _finance_invoice_queryset(organization).filter(id=invoice_id).first()
        if invoice is None:
            return _json_error("Finance invoice not found.", status=404)
        if "revert" not in _get_invoice_actions(invoice, request.user):
            return _json_error("This invoice cannot be reverted in its current state.", status=403)
        payload = _validated_payload(request, ApprovalActionSerializer)
        invoice = revert_invoice_approval(invoice, actor=request.user, comments=payload.get("comments", ""))
        invoice = _finance_invoice_queryset(organization).get(id=invoice.id)
        return _record_response("invoice", FinanceInvoiceSerializer, invoice, request=request, message="Invoice returned to the shared approval workflow.")
    except drf_serializers.ValidationError as exc:
        return _json_error("Validation failed.", status=400, details=exc.detail)
    except EnterpriseWorkflowError as exc:
        return _json_error(str(exc), status=400)


@login_required
@require_http_methods(["POST"])
@require_permission("invoice:approve")
def finance_invoice_comment_api(request, invoice_id):
    try:
        organization = _resolve_organization()
        invoice = _finance_invoice_queryset(organization).filter(id=invoice_id).first()
        if invoice is None:
            return _json_error("Finance invoice not found.", status=404)
        payload = _validated_payload(request, ApprovalCommentSerializer)
        invoice = add_invoice_approval_comment(invoice, actor=request.user, body=payload["body"])
        invoice = _finance_invoice_queryset(organization).get(id=invoice.id)
        return _record_response("invoice", FinanceInvoiceSerializer, invoice, request=request, message="Approval comment added.")
    except drf_serializers.ValidationError as exc:
        return _json_error("Validation failed.", status=400, details=exc.detail)
    except EnterpriseWorkflowError as exc:
        return _json_error(str(exc), status=400)


@login_required
@require_http_methods(["POST"])
@require_permission("payment:record")
def finance_invoice_create_payment_request_api(request, invoice_id):
    try:
        organization = _resolve_organization()
        invoice = _finance_invoice_queryset(organization).filter(id=invoice_id).first()
        if invoice is None:
            return _json_error("Finance invoice not found.", status=404)
        if "create_payment_request" not in _get_invoice_actions(invoice, request.user):
            return _json_error("A payment request cannot be created for this invoice right now.", status=403)
        payload = _validated_payload(request, PaymentRequestCreateSerializer)
        payment_request = create_payment_request(invoice, actor=request.user, amount=payload.get("amount"))
        payment_request = _payment_request_queryset(organization).get(id=payment_request.id)
        return _record_response("payment_request", PaymentRequestSerializer, payment_request, request=request, status=201, message="Payment request created.")
    except drf_serializers.ValidationError as exc:
        return _json_error("Validation failed.", status=400, details=exc.detail)
    except EnterpriseWorkflowError as exc:
        return _json_error(str(exc), status=400)


@login_required
@require_http_methods(["POST"])
@require_any_permission(["invoice:post", "invoice:approve", "payment:record"])
def finance_invoice_attachment_upload_api(request, invoice_id):
    try:
        organization = _resolve_organization()
        invoice = _finance_invoice_queryset(organization).filter(id=invoice_id).first()
        if invoice is None:
            return _json_error("Finance invoice not found.", status=404)
        upload = request.FILES.get("file")
        attachment_type = request.POST.get("attachment_type", "Supporting Document")
        if not upload:
            return _json_error("Attachment file is required.", status=400)
        _create_enterprise_attachment(
            organization=organization,
            target_type=EnterpriseAttachment.TargetType.FINANCE_INVOICE,
            target_id=invoice.id,
            file=upload,
            attachment_type=attachment_type,
            uploaded_by=request.user,
        )
        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.CREATE,
            content_type="FinanceInvoice",
            object_id=str(invoice.id),
            description=f"Uploaded attachment: {attachment_type}.",
        )
        invoice = _finance_invoice_queryset(organization).get(id=invoice.id)
        return _record_response("invoice", FinanceInvoiceSerializer, invoice, request=request, status=201, message="Attachment uploaded.")
    except ValidationError as exc:
        message = exc.messages[0] if getattr(exc, "messages", None) else "Attachment validation failed."
        return _json_error(message, status=400)


@login_required
@require_http_methods(["POST"])
@require_permission("payment_request:approve")
def payment_request_approve_api(request, payment_request_id):
    try:
        organization = _resolve_organization()
        payment_request = _payment_request_queryset(organization).filter(id=payment_request_id).first()
        if payment_request is None:
            return _json_error("Payment request not found.", status=404)
        if "approve" not in _get_payment_request_actions(payment_request, request.user):
            return _json_error("This payment request cannot be approved in its current state.", status=403)
        payment_request = approve_payment_request(payment_request, actor=request.user)
        payment_request = _payment_request_queryset(organization).get(id=payment_request.id)
        message = (
            "Payment request approved."
            if payment_request.status == PaymentRequest.Status.APPROVED
            else "Payment approval step recorded. The payment request remains in the shared approval workflow."
        )
        return _record_response("payment_request", PaymentRequestSerializer, payment_request, request=request, message=message)
    except EnterpriseWorkflowError as exc:
        return _json_error(str(exc), status=400)


@login_required
@require_http_methods(["POST"])
@require_permission("payment_request:approve")
def payment_request_reject_api(request, payment_request_id):
    try:
        organization = _resolve_organization()
        payment_request = _payment_request_queryset(organization).filter(id=payment_request_id).first()
        if payment_request is None:
            return _json_error("Payment request not found.", status=404)
        if "reject" not in _get_payment_request_actions(payment_request, request.user):
            return _json_error("This payment request cannot be rejected in its current state.", status=403)
        payload = _validated_payload(request, RejectionActionSerializer)
        payment_request = reject_payment_request(payment_request, actor=request.user, comments=payload["comments"])
        payment_request = _payment_request_queryset(organization).get(id=payment_request.id)
        return _record_response("payment_request", PaymentRequestSerializer, payment_request, request=request, message="Payment request rejected.")
    except drf_serializers.ValidationError as exc:
        return _json_error("Validation failed.", status=400, details=exc.detail)
    except EnterpriseWorkflowError as exc:
        return _json_error(str(exc), status=400)


@login_required
@require_http_methods(["POST"])
@require_permission("payment_request:approve")
def payment_request_revert_api(request, payment_request_id):
    try:
        organization = _resolve_organization()
        payment_request = _payment_request_queryset(organization).filter(id=payment_request_id).first()
        if payment_request is None:
            return _json_error("Payment request not found.", status=404)
        if "revert" not in _get_payment_request_actions(payment_request, request.user):
            return _json_error("This payment request cannot be reverted in its current state.", status=403)
        payload = _validated_payload(request, ApprovalActionSerializer)
        payment_request = revert_payment_request_approval(payment_request, actor=request.user, comments=payload.get("comments", ""))
        payment_request = _payment_request_queryset(organization).get(id=payment_request.id)
        return _record_response("payment_request", PaymentRequestSerializer, payment_request, request=request, message="Payment request returned to the shared approval workflow.")
    except drf_serializers.ValidationError as exc:
        return _json_error("Validation failed.", status=400, details=exc.detail)
    except EnterpriseWorkflowError as exc:
        return _json_error(str(exc), status=400)


@login_required
@require_http_methods(["POST"])
@require_permission("payment_request:approve")
def payment_request_comment_api(request, payment_request_id):
    try:
        organization = _resolve_organization()
        payment_request = _payment_request_queryset(organization).filter(id=payment_request_id).first()
        if payment_request is None:
            return _json_error("Payment request not found.", status=404)
        payload = _validated_payload(request, ApprovalCommentSerializer)
        payment_request = add_payment_request_approval_comment(payment_request, actor=request.user, body=payload["body"])
        payment_request = _payment_request_queryset(organization).get(id=payment_request.id)
        return _record_response("payment_request", PaymentRequestSerializer, payment_request, request=request, message="Approval comment added.")
    except drf_serializers.ValidationError as exc:
        return _json_error("Validation failed.", status=400, details=exc.detail)
    except EnterpriseWorkflowError as exc:
        return _json_error(str(exc), status=400)


@login_required
@require_http_methods(["POST"])
@require_permission("payment:record")
def payment_request_mark_paid_api(request, payment_request_id):
    try:
        organization = _resolve_organization()
        payment_request = _payment_request_queryset(organization).filter(id=payment_request_id).first()
        if payment_request is None:
            return _json_error("Payment request not found.", status=404)
        if "mark_paid" not in _get_payment_request_actions(payment_request, request.user):
            return _json_error("This payment request cannot be marked as paid in its current state.", status=403)
        payload = _validated_payload(request, PaymentMarkPaidSerializer)
        payment_request = mark_payment_request_paid(payment_request, actor=request.user, payment_reference=payload["payment_reference"])
        payment_request = _payment_request_queryset(organization).get(id=payment_request.id)
        return _record_response("payment_request", PaymentRequestSerializer, payment_request, request=request, message="Payment marked as paid.")
    except drf_serializers.ValidationError as exc:
        return _json_error("Validation failed.", status=400, details=exc.detail)
    except EnterpriseWorkflowError as exc:
        return _json_error(str(exc), status=400)


@login_required
@require_http_methods(["POST"])
@require_any_permission(["payment_request:approve", "payment:record"])
def payment_request_attachment_upload_api(request, payment_request_id):
    try:
        organization = _resolve_organization()
        payment_request = _payment_request_queryset(organization).filter(id=payment_request_id).first()
        if payment_request is None:
            return _json_error("Payment request not found.", status=404)
        upload = request.FILES.get("file")
        attachment_type = request.POST.get("attachment_type", "Supporting Document")
        if not upload:
            return _json_error("Attachment file is required.", status=400)
        _create_enterprise_attachment(
            organization=organization,
            target_type=EnterpriseAttachment.TargetType.PAYMENT_REQUEST,
            target_id=payment_request.id,
            file=upload,
            attachment_type=attachment_type,
            uploaded_by=request.user,
        )
        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.CREATE,
            content_type="PaymentRequest",
            object_id=str(payment_request.id),
            description=f"Uploaded attachment: {attachment_type}.",
        )
        payment_request = _payment_request_queryset(organization).get(id=payment_request.id)
        return _record_response("payment_request", PaymentRequestSerializer, payment_request, request=request, status=201, message="Attachment uploaded.")
    except ValidationError as exc:
        message = exc.messages[0] if getattr(exc, "messages", None) else "Attachment validation failed."
        return _json_error(message, status=400)


@login_required
@require_http_methods(["GET"])
def enterprise_attachment_download_api(request, attachment_id):
    attachment = EnterpriseAttachment.objects.filter(id=attachment_id).select_related("uploaded_by").first()
    if attachment is None:
        return _json_error("Attachment not found.", status=404)
    if not _user_can_access_enterprise_attachment(request.user, attachment):
        return _json_error("You do not have permission to access this attachment.", status=403)

    try:
        file = attachment.file.open("rb")
    except FileNotFoundError:
        return _json_error("Attachment file is missing from storage.", status=404)
    filename = (attachment.file.name or "").split("/")[-1]
    inline = request.GET.get("disposition") == "inline"
    response = FileResponse(file, as_attachment=not inline, filename=filename)

    content_type_map = {
        EnterpriseAttachment.TargetType.PROCUREMENT_REQUEST: "ProcurementRequest",
        EnterpriseAttachment.TargetType.GOODS_RECEIPT: "GoodsReceipt",
        EnterpriseAttachment.TargetType.FINANCE_INVOICE: "FinanceInvoice",
        EnterpriseAttachment.TargetType.PAYMENT_REQUEST: "PaymentRequest",
    }
    AuditLog.objects.create(
        user=request.user,
        action_type=AuditLog.ActionType.DOWNLOAD,
        content_type=content_type_map.get(attachment.target_type, "EnterpriseAttachment"),
        object_id=str(attachment.target_id),
        description=f"Downloaded attachment: {attachment.attachment_type}.",
    )
    return response
