from __future__ import annotations

import os
from collections import OrderedDict

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q
from django.db.models.deletion import ProtectedError
from django.utils.text import slugify

from core.models import AuditLog, Notification, NotificationReceipt, RecordTimelineEntry, User
from enterprise.models import (
    ApprovalInstance,
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
    Product,
    ProcurementRequest,
    ProcurementRequestLine,
    PurchaseOrder,
    PurchaseOrderLine,
    Vendor,
)
from invitations.models import Invitation, InvitationAttachment, InvitationReminder
from requests.models import Request, RequestDocument, RequestHistory


DEMO_PRODUCT_SKUS = ("SKU-LAPTOP-001", "SKU-SCANNER-001", "SKU-SHELF-001")
DEMO_PRODUCT_NAMES = ("Operations Laptop", "Warehouse Scanner", "Storage Shelf Unit")
DEMO_DEPARTMENT_CODES = ("HR", "COMP", "CS")


class Command(BaseCommand):
    help = "Remove demo/sample operational data and normalize the system to a production baseline."

    def add_arguments(self, parser):
        parser.add_argument("--yes", action="store_true", help="Confirm cleanup execution.")
        parser.add_argument(
            "--purge-operational",
            action="store_true",
            help="Also remove all real operational request, invitation, procurement, finance, payment, inventory, notification, and audit records.",
        )

    def handle(self, *args, **options):
        if not options["yes"]:
            raise CommandError("Cleanup is intentionally gated. Re-run with --yes after confirming the target database.")

        counts: OrderedDict[str, int] = OrderedDict()
        warnings: list[str] = []

        with transaction.atomic():
            purge_operational = bool(options["purge_operational"])
            self._normalize_tzs_and_shell(counts)
            self._remove_enterprise_operational_records(counts, warnings, purge_operational=purge_operational)
            if purge_operational:
                self._remove_core_operational_records(counts, warnings)
                self._remove_notifications_and_activity(counts, warnings)
            else:
                self._remove_demo_notifications_and_activity(counts, warnings)
            self._remove_demo_reference_data(counts, warnings)
            self._remove_e2e_users(counts, warnings)

        self.stdout.write(self.style.SUCCESS("Production baseline cleanup complete."))
        for label, count in counts.items():
            self.stdout.write(f"{label}: {count}")
        for warning in warnings:
            self.stdout.write(self.style.WARNING(warning))

    def _delete_queryset(self, counts: OrderedDict[str, int], warnings: list[str], label: str, queryset) -> None:
        try:
            deleted, _ = queryset.delete()
            counts[label] = counts.get(label, 0) + deleted
        except ProtectedError as exc:
            warnings.append(f"{label}: skipped because related records still protect it ({exc}).")

    def _normalize_tzs_and_shell(self, counts: OrderedDict[str, int]) -> None:
        org_name = os.environ.get("CTRMS_ORG_NAME", os.environ.get("CTRMS_SITE_NAME", "CTRMS")).strip() or "CTRMS"
        org_code = os.environ.get("CTRMS_ENTERPRISE_ORG_CODE", "HQ").strip().upper() or "HQ"
        legal_name = os.environ.get("CTRMS_ORG_LEGAL_NAME", org_name).strip() or org_name
        timezone_name = os.environ.get("CTRMS_TIMEZONE", "Africa/Dar_es_Salaam").strip() or "Africa/Dar_es_Salaam"

        currency_updates = Organization.objects.exclude(currency_code="TZS").update(currency_code="TZS")
        counts["organizations_currency_normalized"] = currency_updates

        organization, created = Organization.objects.get_or_create(
            code=org_code,
            defaults={
                "name": org_name,
                "slug": slugify(org_code) or "hq",
                "legal_name": legal_name,
                "timezone": timezone_name,
                "currency_code": "TZS",
                "is_active": True,
            },
        )
        counts["organization_shell_created"] = 1 if created else 0

        demo_names = {"Enterprise Operations Group", "Enterprise Operations Group Ltd", ""}
        update_fields: list[str] = []
        if organization.name in demo_names:
            organization.name = org_name
            update_fields.append("name")
        if organization.legal_name in demo_names:
            organization.legal_name = legal_name
            update_fields.append("legal_name")
        if organization.timezone in {"Africa/Nairobi", ""}:
            organization.timezone = timezone_name
            update_fields.append("timezone")
        if not organization.is_active:
            organization.is_active = True
            update_fields.append("is_active")
        if update_fields:
            organization.save(update_fields=[*update_fields, "updated_at"])
        counts["organization_shell_normalized"] = 1 if update_fields else 0

        branch_city = os.environ.get("CTRMS_DEFAULT_CITY", "Dar es Salaam").strip() or "Dar es Salaam"
        branch_country = os.environ.get("CTRMS_DEFAULT_COUNTRY", "Tanzania").strip() or "Tanzania"
        branch_updates = Branch.objects.filter(Q(city="Nairobi") | Q(country="Kenya") | Q(address="Westlands Business Park")).update(
            city=branch_city,
            country=branch_country,
            address=os.environ.get("CTRMS_DEFAULT_ADDRESS", "").strip(),
        )
        counts["branch_demo_location_normalized"] = branch_updates

    def _remove_enterprise_operational_records(
        self,
        counts: OrderedDict[str, int],
        warnings: list[str],
        *,
        purge_operational: bool,
    ) -> None:
        if purge_operational:
            procurement_requests = ProcurementRequest.objects.all()
            purchase_orders = PurchaseOrder.objects.all()
            finance_invoices = FinanceInvoice.objects.all()
            payment_requests = PaymentRequest.objects.all()
            goods_receipts = GoodsReceipt.objects.all()
            ledger_entries = InventoryLedgerEntry.objects.all()
        else:
            e2e_users = User.objects.filter(username__startswith="e2e.")
            procurement_requests = ProcurementRequest.objects.filter(
                Q(request_number__startswith="PR-DEMO-")
                | Q(justification__icontains="enterprise execution pack")
                | Q(title__startswith="E2E ")
                | Q(requested_by__in=e2e_users)
                | Q(title__in=[
                    "Regional warehouse digitization",
                    "Operations team laptop refresh",
                    "Dispatch station modernization",
                ])
            )
            purchase_orders = PurchaseOrder.objects.filter(procurement_request__in=procurement_requests)
            finance_invoices = FinanceInvoice.objects.filter(purchase_order__in=purchase_orders)
            payment_requests = PaymentRequest.objects.filter(invoice__in=finance_invoices)
            goods_receipts = GoodsReceipt.objects.filter(purchase_order__in=purchase_orders)
            ledger_entries = InventoryLedgerEntry.objects.filter(
                Q(reference_number__in=goods_receipts.values_list("receipt_number", flat=True))
                | Q(product__sku__in=DEMO_PRODUCT_SKUS)
                | Q(notes__icontains="Seeded")
            )

        target_map = {
            EnterpriseAttachment.TargetType.PROCUREMENT_REQUEST: list(procurement_requests.values_list("id", flat=True)),
            EnterpriseAttachment.TargetType.GOODS_RECEIPT: list(goods_receipts.values_list("id", flat=True)),
            EnterpriseAttachment.TargetType.FINANCE_INVOICE: list(finance_invoices.values_list("id", flat=True)),
            EnterpriseAttachment.TargetType.PAYMENT_REQUEST: list(payment_requests.values_list("id", flat=True)),
        }
        attachment_query = Q()
        for target_type, target_ids in target_map.items():
            if target_ids:
                attachment_query |= Q(target_type=target_type, target_id__in=target_ids)
        if attachment_query:
            self._delete_queryset(counts, warnings, "enterprise_attachments_removed", EnterpriseAttachment.objects.filter(attachment_query))
        else:
            counts["enterprise_attachments_removed"] = 0

        approval_query = Q()
        approval_targets = {
            ApprovalInstance.TargetType.PROCUREMENT_REQUEST: target_map[EnterpriseAttachment.TargetType.PROCUREMENT_REQUEST],
            ApprovalInstance.TargetType.FINANCE_INVOICE: target_map[EnterpriseAttachment.TargetType.FINANCE_INVOICE],
            ApprovalInstance.TargetType.PAYMENT_REQUEST: target_map[EnterpriseAttachment.TargetType.PAYMENT_REQUEST],
        }
        for target_type, target_ids in approval_targets.items():
            if target_ids:
                approval_query |= Q(target_type=target_type, target_id__in=target_ids)
        if approval_query:
            self._delete_queryset(counts, warnings, "approval_instances_removed", ApprovalInstance.objects.filter(approval_query))
        else:
            counts["approval_instances_removed"] = 0

        self._delete_queryset(counts, warnings, "inventory_ledger_removed", ledger_entries)
        self._delete_queryset(counts, warnings, "payment_requests_removed", payment_requests)
        self._delete_queryset(counts, warnings, "finance_invoices_removed", finance_invoices)
        self._delete_queryset(counts, warnings, "goods_receipt_lines_removed", GoodsReceiptLine.objects.filter(goods_receipt__in=goods_receipts))
        self._delete_queryset(counts, warnings, "goods_receipts_removed", goods_receipts)
        self._delete_queryset(counts, warnings, "purchase_order_lines_removed", PurchaseOrderLine.objects.filter(purchase_order__in=purchase_orders))
        self._delete_queryset(counts, warnings, "purchase_orders_removed", purchase_orders)
        self._delete_queryset(counts, warnings, "procurement_request_lines_removed", ProcurementRequestLine.objects.filter(procurement_request__in=procurement_requests))
        self._delete_queryset(counts, warnings, "procurement_requests_removed", procurement_requests)

    def _remove_core_operational_records(self, counts: OrderedDict[str, int], warnings: list[str]) -> None:
        self._delete_queryset(counts, warnings, "record_timeline_entries_removed", RecordTimelineEntry.objects.all())
        self._delete_queryset(counts, warnings, "request_documents_removed", RequestDocument.objects.all())
        self._delete_queryset(counts, warnings, "request_history_removed", RequestHistory.objects.all())
        self._delete_queryset(counts, warnings, "requests_removed", Request.objects.all())
        self._delete_queryset(counts, warnings, "invitation_reminders_removed", InvitationReminder.objects.all())
        self._delete_queryset(counts, warnings, "invitation_attachments_removed", InvitationAttachment.objects.all())
        self._delete_queryset(counts, warnings, "invitations_removed", Invitation.objects.all())

    def _remove_notifications_and_activity(self, counts: OrderedDict[str, int], warnings: list[str]) -> None:
        self._delete_queryset(counts, warnings, "notification_receipts_removed", NotificationReceipt.objects.all())
        self._delete_queryset(counts, warnings, "notifications_removed", Notification.objects.all())
        self._delete_queryset(counts, warnings, "audit_logs_removed", AuditLog.objects.all())

    def _remove_demo_notifications_and_activity(self, counts: OrderedDict[str, int], warnings: list[str]) -> None:
        demo_text = (
            Q(title__icontains="PR-DEMO")
            | Q(message__icontains="PR-DEMO")
            | Q(title__icontains="E2E ")
            | Q(message__icontains="E2E ")
            | Q(message__icontains="SEED-PAY")
        )
        demo_notifications = Notification.objects.filter(demo_text)
        self._delete_queryset(counts, warnings, "demo_notification_receipts_removed", NotificationReceipt.objects.filter(notification__in=demo_notifications))
        self._delete_queryset(counts, warnings, "demo_notifications_removed", demo_notifications)

        demo_logs = AuditLog.objects.filter(
            Q(object_id__icontains="PR-DEMO")
            | Q(description__icontains="PR-DEMO")
            | Q(object_id__icontains="E2E")
            | Q(description__icontains="E2E")
            | Q(description__icontains="SEED-PAY")
            | Q(description__icontains="Alpha Industrial")
            | Q(user__username__startswith="e2e.")
        )
        self._delete_queryset(counts, warnings, "demo_audit_logs_removed", demo_logs)

    def _remove_demo_reference_data(self, counts: OrderedDict[str, int], warnings: list[str]) -> None:
        self._delete_queryset(
            counts,
            warnings,
            "demo_products_removed",
            Product.objects.filter(Q(sku__in=DEMO_PRODUCT_SKUS) | Q(name__in=DEMO_PRODUCT_NAMES)),
        )
        self._delete_queryset(
            counts,
            warnings,
            "demo_vendors_removed",
            Vendor.objects.filter(Q(code="VEND-ALPHA") | Q(email="procurement@alpha.example.com") | Q(name="Alpha Industrial Supplies")),
        )
        self._delete_queryset(
            counts,
            warnings,
            "demo_budget_accounts_removed",
            BudgetAccount.objects.filter(Q(code="OPS-CAPEX") | Q(name="Operations Capital Budget")),
        )
        self._delete_queryset(
            counts,
            warnings,
            "demo_departments_removed",
            Department.objects.filter(code__in=DEMO_DEPARTMENT_CODES),
        )

    def _remove_e2e_users(self, counts: OrderedDict[str, int], warnings: list[str]) -> None:
        self._delete_queryset(
            counts,
            warnings,
            "e2e_users_removed",
            User.objects.filter(Q(username__startswith="e2e.") | Q(email__endswith="@example.test")),
        )
