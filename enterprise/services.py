from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from core.models import AuditLog
from core.notification_center import NotificationPayload, get_recipients_for_roles, notify_users

from .approval_engine import (
    ApprovalEngineError,
    add_approval_comment,
    approve_record_step,
    get_latest_approval_instance,
    register_record_for_approval,
    reject_record_step,
    revert_record_step,
)
from .models import (
    ApprovalInstance,
    BudgetAccount,
    Department,
    FinanceInvoice,
    GoodsReceipt,
    GoodsReceiptLine,
    InventoryLedgerEntry,
    PaymentRequest,
    ProcurementRequestLine,
    ProcurementRequest,
    Product,
    PurchaseOrder,
    PurchaseOrderLine,
    Warehouse,
)


class EnterpriseWorkflowError(ValueError):
    """Raised when a requested enterprise workflow transition is invalid."""


def _raise_workflow_error(reason: Exception) -> None:
    raise EnterpriseWorkflowError(str(reason)) from reason


def _record_audit(*, actor, action_type: str, content_type: str, object_id: str, description: str) -> None:
    if not actor:
        return
    AuditLog.objects.create(
        user=actor,
        action_type=action_type,
        content_type=content_type,
        object_id=object_id,
        description=description,
    )


def _notify_role_keys(*, role_keys: list[str], title: str, message: str, href: str | None, created_by=None) -> None:
    recipients = list(get_recipients_for_roles(role_keys))
    if not recipients:
        return
    notify_users(
        recipients=recipients,
        payload=NotificationPayload(kind="event", title=title, message=message, href=href),
        created_by=created_by,
    )


def _coerce_decimal(value, *, default: str = "0.00") -> Decimal:
    if value is None or value == "":
        return Decimal(default)
    return Decimal(str(value))


def _approval_target(target_type: str, target_id):
    return get_latest_approval_instance(target_type=target_type, target_id=target_id)


def _register_finance_invoice_approval_if_configured(invoice: FinanceInvoice, *, actor):
    existing = _approval_target(ApprovalInstance.TargetType.FINANCE_INVOICE, invoice.id)
    if existing and existing.status == ApprovalInstance.Status.PENDING:
        return existing
    try:
        return register_record_for_approval(
            organization=invoice.organization,
            module_key=ApprovalInstance.TargetType.FINANCE_INVOICE,
            target_type=ApprovalInstance.TargetType.FINANCE_INVOICE,
            target_id=invoice.id,
            actor=actor,
            amount=invoice.amount,
            submission_note=f"Invoice {invoice.invoice_number} submitted for approval.",
        )
    except ApprovalEngineError:
        return None


def _register_payment_request_approval_if_configured(payment_request: PaymentRequest, *, actor):
    existing = _approval_target(ApprovalInstance.TargetType.PAYMENT_REQUEST, payment_request.id)
    if existing and existing.status == ApprovalInstance.Status.PENDING:
        return existing
    try:
        return register_record_for_approval(
            organization=payment_request.organization,
            module_key=ApprovalInstance.TargetType.PAYMENT_REQUEST,
            target_type=ApprovalInstance.TargetType.PAYMENT_REQUEST,
            target_id=payment_request.id,
            actor=actor,
            amount=payment_request.amount,
            submission_note=f"Payment request {payment_request.payment_request_number} submitted for approval.",
        )
    except ApprovalEngineError:
        return None


def _sync_procurement_request_lines(
    procurement_request: ProcurementRequest,
    *,
    line_items: list[dict[str, object]],
) -> None:
    ProcurementRequestLine.objects.filter(procurement_request=procurement_request).delete()
    lines: list[ProcurementRequestLine] = []
    for index, line_item in enumerate(line_items, start=1):
        product = line_item.get("product")
        quantity = _coerce_decimal(line_item.get("quantity"))
        unit_price = _coerce_decimal(line_item.get("unit_price"))
        unit_of_measure = str(line_item.get("unit_of_measure") or getattr(product, "unit_of_measure", "") or "unit").strip()
        lines.append(
            ProcurementRequestLine(
                procurement_request=procurement_request,
                line_number=index,
                product=product if isinstance(product, Product) else None,
                description=str(line_item.get("description") or "").strip(),
                unit_of_measure=unit_of_measure or "unit",
                quantity=quantity,
                unit_price=unit_price,
                line_total=quantity * unit_price,
            )
        )
    if not lines:
        raise EnterpriseWorkflowError("At least one procurement line is required.")
    ProcurementRequestLine.objects.bulk_create(lines)
    procurement_request.recalculate_total()


@transaction.atomic
def create_procurement_request(
    *,
    organization,
    actor,
    department: Department,
    budget_account: BudgetAccount | None,
    title: str,
    justification: str = "",
    needed_by_date=None,
    line_items: list[dict[str, object]],
) -> ProcurementRequest:
    procurement_request = ProcurementRequest.objects.create(
        organization=organization,
        department=department,
        budget_account=budget_account,
        requested_by=actor,
        title=title.strip(),
        justification=justification.strip(),
        needed_by_date=needed_by_date,
    )
    _sync_procurement_request_lines(procurement_request, line_items=line_items)
    _record_audit(
        actor=actor,
        action_type=AuditLog.ActionType.CREATE,
        content_type="ProcurementRequest",
        object_id=str(procurement_request.id),
        description=f"Created draft procurement request {procurement_request.request_number} with {len(line_items)} line item(s).",
    )
    return procurement_request


@transaction.atomic
def update_draft_procurement_request(
    procurement_request: ProcurementRequest,
    *,
    actor,
    department: Department,
    budget_account: BudgetAccount | None,
    title: str,
    justification: str = "",
    needed_by_date=None,
    line_items: list[dict[str, object]],
) -> ProcurementRequest:
    if procurement_request.status != ProcurementRequest.Status.DRAFT:
        raise EnterpriseWorkflowError("Only draft procurement requests can be edited.")

    procurement_request.department = department
    procurement_request.budget_account = budget_account
    procurement_request.title = title.strip()
    procurement_request.justification = justification.strip()
    procurement_request.needed_by_date = needed_by_date
    procurement_request.save(
        update_fields=[
            "department",
            "budget_account",
            "title",
            "justification",
            "needed_by_date",
            "updated_at",
        ]
    )
    _sync_procurement_request_lines(procurement_request, line_items=line_items)
    _record_audit(
        actor=actor,
        action_type=AuditLog.ActionType.UPDATE,
        content_type="ProcurementRequest",
        object_id=str(procurement_request.id),
        description=f"Updated draft procurement request {procurement_request.request_number} and refreshed {len(line_items)} line item(s).",
    )
    return procurement_request


@transaction.atomic
def submit_procurement_request(procurement_request: ProcurementRequest, *, actor) -> ProcurementRequest:
    if procurement_request.status != ProcurementRequest.Status.DRAFT:
        raise EnterpriseWorkflowError("Only draft procurement requests can be submitted.")

    procurement_request.recalculate_total()
    if procurement_request.total_amount <= 0:
        raise EnterpriseWorkflowError("Procurement request total must be greater than zero.")

    if procurement_request.budget_account and procurement_request.total_amount > procurement_request.budget_account.available_amount:
        raise EnterpriseWorkflowError("The procurement request exceeds the remaining available budget.")

    try:
        approval_instance = register_record_for_approval(
            organization=procurement_request.organization,
            module_key=ApprovalInstance.TargetType.PROCUREMENT_REQUEST,
            target_type=ApprovalInstance.TargetType.PROCUREMENT_REQUEST,
            target_id=procurement_request.id,
            actor=actor,
            amount=procurement_request.total_amount,
            submission_note=f"{procurement_request.request_number} submitted for approval.",
        )
    except ApprovalEngineError as exc:
        _raise_workflow_error(exc)

    procurement_request.approval_instance = approval_instance
    procurement_request.status = ProcurementRequest.Status.SUBMITTED
    procurement_request.submitted_at = timezone.now()
    procurement_request.save(update_fields=["approval_instance", "status", "submitted_at", "updated_at"])

    _record_audit(
        actor=actor,
        action_type=AuditLog.ActionType.CREATE,
        content_type="ProcurementRequest",
        object_id=str(procurement_request.id),
        description=f"Submitted procurement request {procurement_request.request_number}.",
    )
    _notify_role_keys(
        role_keys=["admin", "finance_officer"],
        title="Procurement approval required",
        message=f"{procurement_request.request_number} is awaiting approval.",
        href="/procurement",
        created_by=actor,
    )
    return procurement_request


@transaction.atomic
def approve_procurement_request(procurement_request: ProcurementRequest, *, actor, comments: str = "") -> ProcurementRequest:
    if procurement_request.status != ProcurementRequest.Status.SUBMITTED:
        raise EnterpriseWorkflowError("Only submitted procurement requests can be approved.")
    if not procurement_request.approval_instance_id:
        raise EnterpriseWorkflowError("This procurement request has no approval instance.")

    try:
        _, next_decision = approve_record_step(procurement_request.approval_instance, actor=actor, comments=comments)
    except ApprovalEngineError as exc:
        _raise_workflow_error(exc)

    procurement_request.approval_instance.refresh_from_db()
    if next_decision is None and procurement_request.approval_instance.status == ApprovalInstance.Status.APPROVED:
        procurement_request.status = ProcurementRequest.Status.APPROVED
        procurement_request.approved_at = timezone.now()
        procurement_request.save(update_fields=["status", "approved_at", "updated_at"])
        if procurement_request.budget_account_id:
            procurement_request.budget_account.committed_amount += procurement_request.total_amount
            procurement_request.budget_account.save(update_fields=["committed_amount", "updated_at"])

    _record_audit(
        actor=actor,
        action_type=AuditLog.ActionType.APPROVE,
        content_type="ProcurementRequest",
        object_id=str(procurement_request.id),
        description=f"Approved procurement request {procurement_request.request_number}.",
    )
    _notify_role_keys(
        role_keys=["admin", "finance_officer"],
        title="Procurement request approved",
        message=f"{procurement_request.request_number} moved to the next enterprise workflow stage.",
        href="/procurement",
        created_by=actor,
    )
    return procurement_request


@transaction.atomic
def reject_procurement_request(procurement_request: ProcurementRequest, *, actor, comments: str = "") -> ProcurementRequest:
    if procurement_request.status != ProcurementRequest.Status.SUBMITTED:
        raise EnterpriseWorkflowError("Only submitted procurement requests can be rejected.")
    if not procurement_request.approval_instance_id:
        raise EnterpriseWorkflowError("This procurement request has no approval instance.")

    try:
        reject_record_step(procurement_request.approval_instance, actor=actor, comments=comments)
    except ApprovalEngineError as exc:
        _raise_workflow_error(exc)

    procurement_request.approval_instance.refresh_from_db()
    procurement_request.status = ProcurementRequest.Status.REJECTED
    procurement_request.rejected_at = timezone.now()
    procurement_request.save(update_fields=["status", "rejected_at", "updated_at"])

    _record_audit(
        actor=actor,
        action_type=AuditLog.ActionType.REJECT,
        content_type="ProcurementRequest",
        object_id=str(procurement_request.id),
        description=f"Rejected procurement request {procurement_request.request_number}.",
    )
    return procurement_request


@transaction.atomic
def revert_procurement_request_approval(procurement_request: ProcurementRequest, *, actor, comments: str = "") -> ProcurementRequest:
    approval_instance = getattr(procurement_request, "approval_instance", None)
    if approval_instance is None:
        raise EnterpriseWorkflowError("This procurement request is not linked to the approval engine.")
    if getattr(procurement_request, "purchase_order", None) is not None:
        raise EnterpriseWorkflowError("Converted procurement requests cannot be reverted.")
    try:
        revert_record_step(approval_instance, actor=actor, comments=comments)
    except ApprovalEngineError as exc:
        _raise_workflow_error(exc)

    procurement_request.status = ProcurementRequest.Status.SUBMITTED
    procurement_request.approved_at = None
    procurement_request.rejected_at = None
    procurement_request.save(update_fields=["status", "approved_at", "rejected_at", "updated_at"])
    description = f"Reverted approval decision for procurement request {procurement_request.request_number}."
    if comments.strip():
        description = f"{description} Note: {comments.strip()}"
    _record_audit(
        actor=actor,
        action_type=AuditLog.ActionType.UPDATE,
        content_type="ProcurementRequest",
        object_id=str(procurement_request.id),
        description=description,
    )
    return procurement_request


@transaction.atomic
def add_procurement_request_approval_comment(procurement_request: ProcurementRequest, *, actor, body: str) -> ProcurementRequest:
    approval_instance = getattr(procurement_request, "approval_instance", None)
    if approval_instance is None:
        raise EnterpriseWorkflowError("This procurement request is not linked to the approval engine.")
    try:
        add_approval_comment(approval_instance, actor=actor, body=body)
    except ApprovalEngineError as exc:
        _raise_workflow_error(exc)
    _record_audit(
        actor=actor,
        action_type=AuditLog.ActionType.UPDATE,
        content_type="ProcurementRequest",
        object_id=str(procurement_request.id),
        description=f"Logged approval comment for procurement request {procurement_request.request_number}.",
    )
    return procurement_request


@transaction.atomic
def convert_procurement_request_to_purchase_order(
    procurement_request: ProcurementRequest,
    *,
    actor,
    vendor,
    warehouse,
    notes: str = "",
) -> PurchaseOrder:
    if procurement_request.status != ProcurementRequest.Status.APPROVED:
        raise EnterpriseWorkflowError("Only approved procurement requests can be converted to purchase orders.")
    if hasattr(procurement_request, "purchase_order"):
        raise EnterpriseWorkflowError("This procurement request has already been converted into a purchase order.")

    purchase_order = PurchaseOrder.objects.create(
        organization=procurement_request.organization,
        procurement_request=procurement_request,
        vendor=vendor,
        warehouse=warehouse,
        budget_account=procurement_request.budget_account,
        notes=notes,
    )
    lines = []
    for request_line in procurement_request.lines.select_related("product").order_by("line_number"):
        lines.append(
            PurchaseOrderLine(
                purchase_order=purchase_order,
                procurement_request_line=request_line,
                line_number=request_line.line_number,
                product=request_line.product,
                description=request_line.description,
                unit_of_measure=request_line.unit_of_measure,
                quantity_ordered=request_line.quantity,
                unit_price=request_line.unit_price,
                line_total=request_line.line_total,
            )
        )
    PurchaseOrderLine.objects.bulk_create(lines)
    purchase_order.recalculate_total()

    procurement_request.status = ProcurementRequest.Status.CONVERTED
    procurement_request.converted_at = timezone.now()
    procurement_request.save(update_fields=["status", "converted_at", "updated_at"])

    _record_audit(
        actor=actor,
        action_type=AuditLog.ActionType.CREATE,
        content_type="PurchaseOrder",
        object_id=str(purchase_order.id),
        description=f"Created purchase order {purchase_order.po_number} from {procurement_request.request_number}.",
    )
    return purchase_order


@transaction.atomic
def issue_purchase_order(purchase_order: PurchaseOrder, *, actor) -> PurchaseOrder:
    if purchase_order.status != PurchaseOrder.Status.DRAFT:
        raise EnterpriseWorkflowError("Only draft purchase orders can be issued.")
    purchase_order.status = PurchaseOrder.Status.ISSUED
    purchase_order.issued_by = actor
    purchase_order.issued_at = timezone.now()
    purchase_order.save(update_fields=["status", "issued_by", "issued_at", "updated_at"])
    _record_audit(
        actor=actor,
        action_type=AuditLog.ActionType.UPDATE,
        content_type="PurchaseOrder",
        object_id=str(purchase_order.id),
        description=f"Issued purchase order {purchase_order.po_number}.",
    )
    return purchase_order


def _normalize_receipt_quantity(raw_value) -> Decimal:
    if raw_value is None:
        return Decimal("0.00")
    return Decimal(str(raw_value))


def _create_draft_invoice_for_purchase_order(purchase_order: PurchaseOrder) -> FinanceInvoice:
    return FinanceInvoice.objects.create(
        organization=purchase_order.organization,
        purchase_order=purchase_order,
        vendor=purchase_order.vendor,
        budget_account=purchase_order.budget_account,
        amount=purchase_order.total_amount,
    )


@transaction.atomic
def receive_purchase_order(
    purchase_order: PurchaseOrder,
    *,
    actor,
    warehouse: Warehouse | None = None,
    notes: str = "",
    quantities_by_line: dict[str, Decimal] | None = None,
) -> GoodsReceipt:
    if purchase_order.status not in {PurchaseOrder.Status.ISSUED, PurchaseOrder.Status.PARTIALLY_RECEIVED}:
        raise EnterpriseWorkflowError("Only issued purchase orders can be received into inventory.")

    warehouse = warehouse or purchase_order.warehouse
    receipt = GoodsReceipt.objects.create(
        organization=purchase_order.organization,
        purchase_order=purchase_order,
        warehouse=warehouse,
        received_by=actor,
        notes=notes,
    )

    created_lines: list[GoodsReceiptLine] = []
    for order_line in purchase_order.lines.select_related("product").order_by("line_number"):
        requested_quantity = None
        if quantities_by_line:
            requested_quantity = quantities_by_line.get(str(order_line.id))
        quantity_to_receive = _normalize_receipt_quantity(requested_quantity) if requested_quantity is not None else order_line.outstanding_quantity
        if quantity_to_receive <= 0:
            continue
        if quantity_to_receive > order_line.outstanding_quantity:
            raise EnterpriseWorkflowError("A receipt line cannot exceed the remaining purchase order quantity.")
        if order_line.product_id is None:
            raise EnterpriseWorkflowError(
                f"{order_line.description} must be linked to a catalog product before it can be received into inventory."
            )

        goods_line = GoodsReceiptLine.objects.create(
            goods_receipt=receipt,
            purchase_order_line=order_line,
            product=order_line.product,
            quantity_received=quantity_to_receive,
        )
        created_lines.append(goods_line)

        order_line.quantity_received += quantity_to_receive
        order_line.save(update_fields=["quantity_received", "updated_at"])
        InventoryLedgerEntry.objects.create(
            organization=purchase_order.organization,
            warehouse=warehouse,
            product=order_line.product,
            movement_type=InventoryLedgerEntry.MovementType.RECEIPT,
            quantity=quantity_to_receive,
            unit_cost=order_line.unit_price,
            reference_type="goods_receipt",
            reference_number=receipt.receipt_number,
            notes=f"Received against {purchase_order.po_number}.",
        )

    if not created_lines:
        raise EnterpriseWorkflowError("No receipt quantities were provided for this purchase order.")

    # Re-query against the database so prefetched purchase-order lines do not
    # leave us with stale quantity_received values after line updates.
    outstanding_exists = purchase_order.lines.filter(quantity_received__lt=F("quantity_ordered")).exists()
    purchase_order.status = (
        PurchaseOrder.Status.PARTIALLY_RECEIVED if outstanding_exists else PurchaseOrder.Status.RECEIVED
    )
    purchase_order.save(update_fields=["status", "updated_at"])

    if not hasattr(purchase_order, "finance_invoice") and purchase_order.status == PurchaseOrder.Status.RECEIVED:
        _create_draft_invoice_for_purchase_order(purchase_order)

    _record_audit(
        actor=actor,
        action_type=AuditLog.ActionType.CREATE,
        content_type="GoodsReceipt",
        object_id=str(receipt.id),
        description=f"Recorded goods receipt {receipt.receipt_number} for {purchase_order.po_number}.",
    )
    _notify_role_keys(
        role_keys=["finance_officer", "admin"],
        title="Goods receipt posted",
        message=f"{receipt.receipt_number} updated inventory and finance staging for {purchase_order.po_number}.",
        href="/inventory",
        created_by=actor,
    )
    return receipt


@transaction.atomic
def post_invoice(invoice: FinanceInvoice, *, actor) -> FinanceInvoice:
    if invoice.status != FinanceInvoice.Status.DRAFT:
        raise EnterpriseWorkflowError("Only draft invoices can be posted.")
    if invoice.purchase_order.status != PurchaseOrder.Status.RECEIVED:
        raise EnterpriseWorkflowError("An invoice can only be posted after the purchase order is fully received.")
    invoice.status = FinanceInvoice.Status.POSTED
    invoice.posted_by = actor
    invoice.posted_at = timezone.now()
    invoice.save(update_fields=["status", "posted_by", "posted_at", "updated_at"])
    _record_audit(
        actor=actor,
        action_type=AuditLog.ActionType.UPDATE,
        content_type="FinanceInvoice",
        object_id=str(invoice.id),
        description=f"Posted invoice {invoice.invoice_number}.",
    )
    _register_finance_invoice_approval_if_configured(invoice, actor=actor)
    return invoice


@transaction.atomic
def update_and_post_invoice(
    invoice: FinanceInvoice,
    *,
    actor,
    amount: Decimal | None = None,
    invoice_date=None,
) -> FinanceInvoice:
    if invoice.status != FinanceInvoice.Status.DRAFT:
        raise EnterpriseWorkflowError("Only draft invoices can be posted.")
    if amount is not None:
        normalized_amount = _coerce_decimal(amount)
        if normalized_amount <= 0:
            raise EnterpriseWorkflowError("Invoice amount must be greater than zero.")
        if normalized_amount > invoice.purchase_order.total_amount:
            raise EnterpriseWorkflowError("Invoice amount cannot exceed the purchase order total.")
        invoice.amount = normalized_amount
    if invoice_date is not None:
        invoice.invoice_date = invoice_date
    invoice.save(update_fields=["amount", "invoice_date", "updated_at"])
    return post_invoice(invoice, actor=actor)


@transaction.atomic
def approve_invoice(invoice: FinanceInvoice, *, actor) -> FinanceInvoice:
    if invoice.status != FinanceInvoice.Status.POSTED:
        raise EnterpriseWorkflowError("Only posted invoices can be approved.")
    approval_instance = _approval_target(ApprovalInstance.TargetType.FINANCE_INVOICE, invoice.id)
    if approval_instance and approval_instance.status == ApprovalInstance.Status.PENDING:
        try:
            _, next_decision = approve_record_step(approval_instance, actor=actor, comments=f"Approved invoice {invoice.invoice_number}.")
        except ApprovalEngineError as exc:
            _raise_workflow_error(exc)
        approval_instance.refresh_from_db()
        if next_decision is not None or approval_instance.status != ApprovalInstance.Status.APPROVED:
            _record_audit(
                actor=actor,
                action_type=AuditLog.ActionType.APPROVE,
                content_type="FinanceInvoice",
                object_id=str(invoice.id),
                description=f"Recorded approval step for invoice {invoice.invoice_number}.",
            )
            return invoice

    invoice.status = FinanceInvoice.Status.APPROVED
    invoice.approved_by = actor
    invoice.approved_at = timezone.now()
    invoice.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])
    _record_audit(
        actor=actor,
        action_type=AuditLog.ActionType.APPROVE,
        content_type="FinanceInvoice",
        object_id=str(invoice.id),
        description=f"Approved invoice {invoice.invoice_number}.",
    )
    return invoice


@transaction.atomic
def revert_invoice_approval(invoice: FinanceInvoice, *, actor, comments: str = "") -> FinanceInvoice:
    approval_instance = _approval_target(ApprovalInstance.TargetType.FINANCE_INVOICE, invoice.id)
    if approval_instance is None:
        raise EnterpriseWorkflowError("This invoice is not linked to the approval engine.")
    if getattr(invoice, "payment_request", None) is not None:
        raise EnterpriseWorkflowError("Invoices with payment requests cannot be reverted.")
    try:
        revert_record_step(approval_instance, actor=actor, comments=comments)
    except ApprovalEngineError as exc:
        _raise_workflow_error(exc)

    invoice.status = FinanceInvoice.Status.POSTED
    invoice.approved_by = None
    invoice.approved_at = None
    invoice.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])
    description = f"Reverted approval decision for invoice {invoice.invoice_number}."
    if comments.strip():
        description = f"{description} Note: {comments.strip()}"
    _record_audit(
        actor=actor,
        action_type=AuditLog.ActionType.UPDATE,
        content_type="FinanceInvoice",
        object_id=str(invoice.id),
        description=description,
    )
    return invoice


@transaction.atomic
def add_invoice_approval_comment(invoice: FinanceInvoice, *, actor, body: str) -> FinanceInvoice:
    approval_instance = _approval_target(ApprovalInstance.TargetType.FINANCE_INVOICE, invoice.id)
    if approval_instance is None:
        raise EnterpriseWorkflowError("This invoice is not linked to the approval engine.")
    try:
        add_approval_comment(approval_instance, actor=actor, body=body)
    except ApprovalEngineError as exc:
        _raise_workflow_error(exc)
    _record_audit(
        actor=actor,
        action_type=AuditLog.ActionType.UPDATE,
        content_type="FinanceInvoice",
        object_id=str(invoice.id),
        description=f"Logged approval comment for invoice {invoice.invoice_number}.",
    )
    return invoice


@transaction.atomic
def create_payment_request(
    invoice: FinanceInvoice,
    *,
    actor,
    amount: Decimal | None = None,
) -> PaymentRequest:
    if invoice.status != FinanceInvoice.Status.APPROVED:
        raise EnterpriseWorkflowError("A payment request can only be created from an approved invoice.")
    normalized_amount = _coerce_decimal(amount or invoice.amount)
    if normalized_amount <= 0:
        raise EnterpriseWorkflowError("Payment request amount must be greater than zero.")
    if normalized_amount > invoice.amount:
        raise EnterpriseWorkflowError("Payment request amount cannot exceed the approved invoice amount.")

    payment_request = getattr(invoice, "payment_request", None)
    if payment_request is None:
        payment_request = PaymentRequest.objects.create(
            organization=invoice.organization,
            invoice=invoice,
            amount=normalized_amount,
            requested_by=actor,
            status=PaymentRequest.Status.SUBMITTED,
        )
        action_type = AuditLog.ActionType.CREATE
        description = f"Created payment request {payment_request.payment_request_number} from invoice {invoice.invoice_number}."
    elif payment_request.status == PaymentRequest.Status.REJECTED:
        payment_request.amount = normalized_amount
        payment_request.requested_by = actor
        payment_request.status = PaymentRequest.Status.SUBMITTED
        payment_request.approved_by = None
        payment_request.approved_at = None
        payment_request.paid_by = None
        payment_request.paid_at = None
        payment_request.payment_reference = ""
        payment_request.save(
            update_fields=[
                "amount",
                "requested_by",
                "status",
                "approved_by",
                "approved_at",
                "paid_by",
                "paid_at",
                "payment_reference",
                "updated_at",
            ]
        )
        action_type = AuditLog.ActionType.UPDATE
        description = f"Resubmitted rejected payment request {payment_request.payment_request_number} for invoice {invoice.invoice_number}."
    else:
        raise EnterpriseWorkflowError("This invoice already has an active payment request.")

    _record_audit(
        actor=actor,
        action_type=action_type,
        content_type="PaymentRequest",
        object_id=str(payment_request.id),
        description=description,
    )
    _register_payment_request_approval_if_configured(payment_request, actor=actor)
    _notify_role_keys(
        role_keys=["finance_officer", "admin", "director"],
        title="Payment request awaiting approval",
        message=f"{payment_request.payment_request_number} is ready for finance approval.",
        href="/approvals",
        created_by=actor,
    )
    return payment_request


@transaction.atomic
def approve_payment_request(payment_request: PaymentRequest, *, actor) -> PaymentRequest:
    if payment_request.status != PaymentRequest.Status.SUBMITTED:
        raise EnterpriseWorkflowError("Only submitted payment requests can be approved.")
    approval_instance = _approval_target(ApprovalInstance.TargetType.PAYMENT_REQUEST, payment_request.id)
    if approval_instance and approval_instance.status == ApprovalInstance.Status.PENDING:
        try:
            _, next_decision = approve_record_step(
                approval_instance,
                actor=actor,
                comments=f"Approved payment request {payment_request.payment_request_number}.",
            )
        except ApprovalEngineError as exc:
            _raise_workflow_error(exc)
        approval_instance.refresh_from_db()
        if next_decision is not None or approval_instance.status != ApprovalInstance.Status.APPROVED:
            _record_audit(
                actor=actor,
                action_type=AuditLog.ActionType.APPROVE,
                content_type="PaymentRequest",
                object_id=str(payment_request.id),
                description=f"Recorded approval step for payment request {payment_request.payment_request_number}.",
            )
            return payment_request

    payment_request.status = PaymentRequest.Status.APPROVED
    payment_request.approved_by = actor
    payment_request.approved_at = timezone.now()
    payment_request.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])
    _record_audit(
        actor=actor,
        action_type=AuditLog.ActionType.APPROVE,
        content_type="PaymentRequest",
        object_id=str(payment_request.id),
        description=f"Approved payment request {payment_request.payment_request_number}.",
    )
    return payment_request


@transaction.atomic
def reject_payment_request(payment_request: PaymentRequest, *, actor, comments: str = "") -> PaymentRequest:
    if payment_request.status != PaymentRequest.Status.SUBMITTED:
        raise EnterpriseWorkflowError("Only submitted payment requests can be rejected.")
    approval_instance = _approval_target(ApprovalInstance.TargetType.PAYMENT_REQUEST, payment_request.id)
    if approval_instance and approval_instance.status == ApprovalInstance.Status.PENDING:
        try:
            reject_record_step(approval_instance, actor=actor, comments=comments)
        except ApprovalEngineError as exc:
            _raise_workflow_error(exc)
    payment_request.status = PaymentRequest.Status.REJECTED
    payment_request.approved_by = actor
    payment_request.approved_at = timezone.now()
    payment_request.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])
    description = f"Rejected payment request {payment_request.payment_request_number}."
    if comments.strip():
        description = f"{description} Reason: {comments.strip()}"
    _record_audit(
        actor=actor,
        action_type=AuditLog.ActionType.REJECT,
        content_type="PaymentRequest",
        object_id=str(payment_request.id),
        description=description,
    )
    return payment_request


@transaction.atomic
def revert_payment_request_approval(payment_request: PaymentRequest, *, actor, comments: str = "") -> PaymentRequest:
    if payment_request.status == PaymentRequest.Status.PAID:
        raise EnterpriseWorkflowError("Paid payment requests cannot be reverted.")
    approval_instance = _approval_target(ApprovalInstance.TargetType.PAYMENT_REQUEST, payment_request.id)
    if approval_instance is None:
        raise EnterpriseWorkflowError("This payment request is not linked to the approval engine.")
    try:
        revert_record_step(approval_instance, actor=actor, comments=comments)
    except ApprovalEngineError as exc:
        _raise_workflow_error(exc)

    payment_request.status = PaymentRequest.Status.SUBMITTED
    payment_request.approved_by = None
    payment_request.approved_at = None
    payment_request.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])
    description = f"Reverted approval decision for payment request {payment_request.payment_request_number}."
    if comments.strip():
        description = f"{description} Note: {comments.strip()}"
    _record_audit(
        actor=actor,
        action_type=AuditLog.ActionType.UPDATE,
        content_type="PaymentRequest",
        object_id=str(payment_request.id),
        description=description,
    )
    return payment_request


@transaction.atomic
def add_payment_request_approval_comment(payment_request: PaymentRequest, *, actor, body: str) -> PaymentRequest:
    approval_instance = _approval_target(ApprovalInstance.TargetType.PAYMENT_REQUEST, payment_request.id)
    if approval_instance is None:
        raise EnterpriseWorkflowError("This payment request is not linked to the approval engine.")
    try:
        add_approval_comment(approval_instance, actor=actor, body=body)
    except ApprovalEngineError as exc:
        _raise_workflow_error(exc)
    _record_audit(
        actor=actor,
        action_type=AuditLog.ActionType.UPDATE,
        content_type="PaymentRequest",
        object_id=str(payment_request.id),
        description=f"Logged approval comment for payment request {payment_request.payment_request_number}.",
    )
    return payment_request


@transaction.atomic
def mark_payment_request_paid(payment_request: PaymentRequest, *, actor, payment_reference: str = "") -> PaymentRequest:
    if payment_request.status != PaymentRequest.Status.APPROVED:
        raise EnterpriseWorkflowError("Only approved payment requests can be marked as paid.")

    invoice = payment_request.invoice
    payment_request.status = PaymentRequest.Status.PAID
    payment_request.paid_by = actor
    payment_request.paid_at = timezone.now()
    payment_request.payment_reference = payment_reference
    payment_request.save(update_fields=["status", "paid_by", "paid_at", "payment_reference", "updated_at"])

    invoice.status = FinanceInvoice.Status.PAID
    invoice.paid_by = actor
    invoice.paid_at = timezone.now()
    invoice.payment_reference = payment_reference
    invoice.save(update_fields=["status", "paid_by", "paid_at", "payment_reference", "updated_at"])

    if invoice.budget_account_id:
        invoice.budget_account.committed_amount = max(Decimal("0.00"), invoice.budget_account.committed_amount - invoice.amount)
        invoice.budget_account.spent_amount += invoice.amount
        invoice.budget_account.save(update_fields=["committed_amount", "spent_amount", "updated_at"])

    _record_audit(
        actor=actor,
        action_type=AuditLog.ActionType.UPDATE,
        content_type="PaymentRequest",
        object_id=str(payment_request.id),
        description=f"Marked payment request {payment_request.payment_request_number} as paid.",
    )
    _notify_role_keys(
        role_keys=["admin", "finance_officer"],
        title="Payment completed",
        message=f"{payment_request.payment_request_number} has been paid and the budget ledger was updated.",
        href="/finance",
        created_by=actor,
    )
    return payment_request
