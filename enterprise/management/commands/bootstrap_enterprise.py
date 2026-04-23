from __future__ import annotations

import os
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.text import slugify

from core.models import RoleDefinition, User
from core.rbac_defaults import seed_rbac_defaults

from enterprise.models import (
    ApprovalWorkflowStep,
    ApprovalWorkflowTemplate,
    Branch,
    BudgetAccount,
    Department,
    FinanceInvoice,
    Organization,
    Product,
    ProcurementRequest,
    ProcurementRequestLine,
    PurchaseOrder,
    PurchaseOrderLine,
    Vendor,
    Warehouse,
)
from enterprise.services import (
    approve_invoice,
    approve_payment_request,
    approve_procurement_request,
    convert_procurement_request_to_purchase_order,
    create_payment_request,
    issue_purchase_order,
    mark_payment_request_paid,
    post_invoice,
    receive_purchase_order,
    submit_procurement_request,
)


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _repair_enterprise_slice(organization: Organization) -> None:
    for order_line in PurchaseOrderLine.objects.filter(purchase_order__organization=organization).select_related("procurement_request_line"):
        if order_line.line_total == 0 and order_line.procurement_request_line_id:
            order_line.line_total = order_line.procurement_request_line.line_total
            order_line.save(update_fields=["line_total", "updated_at"])

    for purchase_order in PurchaseOrder.objects.filter(organization=organization):
        purchase_order.recalculate_total()

    for invoice in FinanceInvoice.objects.filter(organization=organization).select_related("purchase_order"):
        if invoice.amount != invoice.purchase_order.total_amount:
            invoice.amount = invoice.purchase_order.total_amount
            invoice.save(update_fields=["amount", "updated_at"])
        if hasattr(invoice, "payment_request") and invoice.payment_request.amount != invoice.amount:
            invoice.payment_request.amount = invoice.amount
            invoice.payment_request.save(update_fields=["amount", "updated_at"])

    for budget in BudgetAccount.objects.filter(organization=organization):
        committed_from_approved_requests = sum(
            (
                procurement_request.total_amount
                for procurement_request in ProcurementRequest.objects.filter(
                    organization=organization,
                    budget_account=budget,
                    status=ProcurementRequest.Status.APPROVED,
                )
            ),
            Decimal("0.00"),
        )
        committed_from_open_invoices = sum(
            (
                invoice.amount
                for invoice in FinanceInvoice.objects.filter(
                    organization=organization,
                    budget_account=budget,
                    status__in=[FinanceInvoice.Status.DRAFT, FinanceInvoice.Status.POSTED, FinanceInvoice.Status.APPROVED],
                )
            ),
            Decimal("0.00"),
        )
        spent_from_paid_invoices = sum(
            (
                invoice.amount
                for invoice in FinanceInvoice.objects.filter(
                    organization=organization,
                    budget_account=budget,
                    status__in=[FinanceInvoice.Status.PAID, FinanceInvoice.Status.RECONCILED],
                )
            ),
            Decimal("0.00"),
        )
        budget.committed_amount = committed_from_approved_requests + committed_from_open_invoices
        budget.spent_amount = spent_from_paid_invoices
        budget.save(update_fields=["committed_amount", "spent_amount", "updated_at"])


class Command(BaseCommand):
    help = "Bootstrap the enterprise production baseline. Demo records are opt-in with --include-demo."

    def add_arguments(self, parser):
        parser.add_argument(
            "--include-demo",
            action="store_true",
            help="Create the sample procurement-to-finance flow. Intended for local demos only.",
        )

    def handle(self, *args, **options):
        seed_rbac_defaults(sync_role_permissions=True)

        admin_user = User.objects.filter(role=User.Role.ADMIN).order_by("created_at").first() or User.objects.filter(is_superuser=True).first()
        actor = admin_user or User.objects.order_by("created_at").first()

        organization = self._bootstrap_organization()
        departments = self._bootstrap_departments(organization, actor)
        warehouse = self._bootstrap_branch_and_warehouse(organization)
        self._bootstrap_workflows(organization)

        include_demo = options["include_demo"] or _env_bool("CTRMS_BOOTSTRAP_DEMO_DATA")
        if include_demo:
            self._bootstrap_demo_flow(organization, departments, warehouse, actor)
            message = "Enterprise baseline and optional demo flow bootstrapped."
        else:
            message = "Enterprise production baseline bootstrapped."

        _repair_enterprise_slice(organization)
        self.stdout.write(self.style.SUCCESS(message))

    def _bootstrap_organization(self) -> Organization:
        org_name = os.environ.get("CTRMS_ORG_NAME", os.environ.get("CTRMS_SITE_NAME", "CTRMS")).strip() or "CTRMS"
        org_code = os.environ.get("CTRMS_ENTERPRISE_ORG_CODE", "HQ").strip().upper() or "HQ"
        legal_name = os.environ.get("CTRMS_ORG_LEGAL_NAME", org_name).strip() or org_name
        timezone_name = os.environ.get("CTRMS_TIMEZONE", "Africa/Dar_es_Salaam").strip() or "Africa/Dar_es_Salaam"

        organization, _ = Organization.objects.get_or_create(
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

        update_fields: list[str] = []
        demo_names = {"Enterprise Operations Group", "Enterprise Operations Group Ltd"}
        if organization.name in demo_names or not organization.name:
            organization.name = org_name
            update_fields.append("name")
        if organization.legal_name in demo_names or not organization.legal_name:
            organization.legal_name = legal_name
            update_fields.append("legal_name")
        if organization.timezone in {"Africa/Nairobi", ""}:
            organization.timezone = timezone_name
            update_fields.append("timezone")
        if organization.currency_code != "TZS":
            organization.currency_code = "TZS"
            update_fields.append("currency_code")
        if not organization.is_active:
            organization.is_active = True
            update_fields.append("is_active")
        if update_fields:
            organization.save(update_fields=[*update_fields, "updated_at"])
        return organization

    def _bootstrap_departments(self, organization: Organization, actor: User | None) -> dict[str, Department]:
        departments = {}
        for code, name in [
            ("PROC", "Procurement"),
            ("FIN", "Finance"),
            ("OPS", "Operations"),
        ]:
            departments[code], _ = Department.objects.get_or_create(
                organization=organization,
                code=code,
                defaults={"name": name, "manager": actor},
            )
        return departments

    def _bootstrap_branch_and_warehouse(self, organization: Organization) -> Warehouse:
        branch_name = os.environ.get("CTRMS_DEFAULT_BRANCH_NAME", "Head Office").strip() or "Head Office"
        branch_city = os.environ.get("CTRMS_DEFAULT_CITY", "Dar es Salaam").strip() or "Dar es Salaam"
        branch_country = os.environ.get("CTRMS_DEFAULT_COUNTRY", "Tanzania").strip() or "Tanzania"
        branch_address = os.environ.get("CTRMS_DEFAULT_ADDRESS", "").strip()

        hq_branch, _ = Branch.objects.get_or_create(
            organization=organization,
            code="HQ-MAIN",
            defaults={
                "name": branch_name,
                "city": branch_city,
                "country": branch_country,
                "address": branch_address,
            },
        )
        branch_update_fields: list[str] = []
        if hq_branch.city in {"Nairobi", ""}:
            hq_branch.city = branch_city
            branch_update_fields.append("city")
        if hq_branch.country in {"Kenya", ""}:
            hq_branch.country = branch_country
            branch_update_fields.append("country")
        if hq_branch.address == "Westlands Business Park":
            hq_branch.address = branch_address
            branch_update_fields.append("address")
        if branch_update_fields:
            hq_branch.save(update_fields=[*branch_update_fields, "updated_at"])

        warehouse_name = os.environ.get("CTRMS_DEFAULT_WAREHOUSE_NAME", "Main Warehouse").strip() or "Main Warehouse"
        warehouse_location = os.environ.get("CTRMS_DEFAULT_WAREHOUSE_LOCATION", "").strip()
        warehouse, _ = Warehouse.objects.get_or_create(
            organization=organization,
            code="MAIN-WH",
            defaults={"name": warehouse_name, "branch": hq_branch, "location": warehouse_location},
        )
        if warehouse.location == "Ground Floor Dispatch" and warehouse_location != warehouse.location:
            warehouse.location = warehouse_location
            warehouse.save(update_fields=["location", "updated_at"])
        return warehouse

    def _bootstrap_workflows(self, organization: Organization) -> None:
        admin_role = RoleDefinition.objects.get_or_create(key="admin", defaults={"name": "Administrator", "description": ""})[0]
        finance_role = RoleDefinition.objects.get_or_create(key="finance_officer", defaults={"name": "Finance Officer", "description": ""})[0]

        workflow, _ = ApprovalWorkflowTemplate.objects.get_or_create(
            organization=organization,
            code="PR-STANDARD",
            defaults={
                "name": "Standard Procurement Approval",
                "module_key": ApprovalWorkflowTemplate.ModuleKey.PROCUREMENT_REQUEST,
                "description": "Administrative review followed by finance budget confirmation.",
                "is_active": True,
            },
        )
        ApprovalWorkflowStep.objects.get_or_create(
            workflow=workflow,
            sequence=1,
            defaults={"name": "Administrative review", "role": admin_role},
        )
        ApprovalWorkflowStep.objects.get_or_create(
            workflow=workflow,
            sequence=2,
            defaults={"name": "Finance budget confirmation", "role": finance_role},
        )

        finance_invoice_workflow, _ = ApprovalWorkflowTemplate.objects.get_or_create(
            organization=organization,
            code="FIN-INV-STD",
            defaults={
                "name": "Finance Invoice Approval",
                "module_key": ApprovalWorkflowTemplate.ModuleKey.FINANCE_INVOICE,
                "description": "Finance invoice approval powered by the shared approval engine.",
                "is_active": True,
            },
        )
        ApprovalWorkflowStep.objects.get_or_create(
            workflow=finance_invoice_workflow,
            sequence=1,
            defaults={"name": "Finance invoice confirmation", "role": finance_role},
        )

        payment_workflow, _ = ApprovalWorkflowTemplate.objects.get_or_create(
            organization=organization,
            code="FIN-PAY-STD",
            defaults={
                "name": "Payment Request Approval",
                "module_key": ApprovalWorkflowTemplate.ModuleKey.PAYMENT_REQUEST,
                "description": "Payment request approval powered by the shared approval engine.",
                "is_active": True,
            },
        )
        ApprovalWorkflowStep.objects.get_or_create(
            workflow=payment_workflow,
            sequence=1,
            defaults={"name": "Finance settlement authorization", "role": finance_role},
        )

    def _bootstrap_demo_flow(
        self,
        organization: Organization,
        departments: dict[str, Department],
        warehouse: Warehouse,
        actor: User | None,
    ) -> None:
        budget, _ = BudgetAccount.objects.get_or_create(
            organization=organization,
            code="OPS-CAPEX",
            fiscal_year=timezone.now().year,
            defaults={
                "name": "Operations Capital Budget",
                "department": departments["OPS"],
                "allocated_amount": Decimal("2500000.00"),
            },
        )
        vendor, _ = Vendor.objects.get_or_create(
            organization=organization,
            code="VEND-ALPHA",
            defaults={
                "name": "Alpha Industrial Supplies",
                "contact_name": "Grace Wanjiru",
                "email": "procurement@alpha.example.com",
                "phone": "+254700123456",
            },
        )

        product_specs = [
            ("SKU-LAPTOP-001", "Operations Laptop", Decimal("135000.00"), Decimal("5.00")),
            ("SKU-SCANNER-001", "Warehouse Scanner", Decimal("32000.00"), Decimal("8.00")),
            ("SKU-SHELF-001", "Storage Shelf Unit", Decimal("48000.00"), Decimal("4.00")),
        ]
        products = {}
        for sku, name, cost, reorder_level in product_specs:
            products[sku], _ = Product.objects.get_or_create(
                organization=organization,
                sku=sku,
                defaults={
                    "name": name,
                    "unit_of_measure": "unit",
                    "standard_cost": cost,
                    "reorder_level": reorder_level,
                },
            )

        request_specs = [
            {
                "request_number": "PR-DEMO-0001",
                "title": "Regional warehouse digitization",
                "status_target": "submitted",
                "lines": [
                    ("SKU-SCANNER-001", "Warehouse Scanner", Decimal("6.00"), Decimal("32000.00")),
                    ("SKU-SHELF-001", "Storage Shelf Unit", Decimal("2.00"), Decimal("48000.00")),
                ],
            },
            {
                "request_number": "PR-DEMO-0002",
                "title": "Operations team laptop refresh",
                "status_target": "approved",
                "lines": [
                    ("SKU-LAPTOP-001", "Operations Laptop", Decimal("4.00"), Decimal("135000.00")),
                ],
            },
            {
                "request_number": "PR-DEMO-0003",
                "title": "Dispatch station modernization",
                "status_target": "paid",
                "lines": [
                    ("SKU-SCANNER-001", "Warehouse Scanner", Decimal("3.00"), Decimal("32000.00")),
                    ("SKU-LAPTOP-001", "Operations Laptop", Decimal("2.00"), Decimal("135000.00")),
                ],
            },
        ]

        for spec in request_specs:
            procurement_request, created = ProcurementRequest.objects.get_or_create(
                request_number=spec["request_number"],
                defaults={
                    "organization": organization,
                    "department": departments["PROC"],
                    "budget_account": budget,
                    "requested_by": actor,
                    "title": spec["title"],
                    "justification": "Seeded from the enterprise execution pack to demonstrate the first vertical slice.",
                },
            )
            if created:
                for index, (sku, description, quantity, unit_price) in enumerate(spec["lines"], start=1):
                    ProcurementRequestLine.objects.create(
                        procurement_request=procurement_request,
                        line_number=index,
                        product=products[sku],
                        description=description,
                        unit_of_measure="unit",
                        quantity=quantity,
                        unit_price=unit_price,
                    )
                procurement_request.recalculate_total()

            if created and spec["status_target"] in {"submitted", "approved", "paid"}:
                submit_procurement_request(procurement_request, actor=actor)
            if created and spec["status_target"] in {"approved", "paid"}:
                approve_procurement_request(procurement_request, actor=actor, comments="Seed approval stage 1")
                approve_procurement_request(procurement_request, actor=actor, comments="Seed approval stage 2")
            if created and spec["status_target"] == "paid":
                purchase_order = convert_procurement_request_to_purchase_order(
                    procurement_request,
                    actor=actor,
                    vendor=vendor,
                    warehouse=warehouse,
                    notes="Created by enterprise bootstrap flow.",
                )
                issue_purchase_order(purchase_order, actor=actor)
                receive_purchase_order(purchase_order, actor=actor, warehouse=warehouse, notes="Seeded receipt.")
                invoice = purchase_order.finance_invoice
                post_invoice(invoice, actor=actor)
                approve_invoice(invoice, actor=actor)
                create_payment_request(invoice, actor=actor)
                approve_payment_request(invoice.payment_request, actor=actor)
                mark_payment_request_paid(invoice.payment_request, actor=actor, payment_reference="SEED-PAY-0003")
