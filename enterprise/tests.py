from __future__ import annotations

from decimal import Decimal

from django.core.management import call_command
from django.test import TestCase

from core.models import RoleDefinition, User
from core.rbac_defaults import seed_rbac_defaults

from .models import (
    ApprovalWorkflowStep,
    ApprovalWorkflowTemplate,
    ApprovalInstance,
    Branch,
    BudgetAccount,
    Department,
    Organization,
    ProcurementRequest,
    ProcurementRequestLine,
    Product,
    Vendor,
    Warehouse,
)
from .services import (
    add_invoice_approval_comment,
    add_payment_request_approval_comment,
    add_procurement_request_approval_comment,
    EnterpriseWorkflowError,
    approve_invoice,
    approve_payment_request,
    approve_procurement_request,
    convert_procurement_request_to_purchase_order,
    create_payment_request,
    issue_purchase_order,
    mark_payment_request_paid,
    post_invoice,
    receive_purchase_order,
    revert_invoice_approval,
    revert_payment_request_approval,
    revert_procurement_request_approval,
    submit_procurement_request,
)


class EnterpriseBootstrapCommandTests(TestCase):
    def setUp(self):
        seed_rbac_defaults(sync_role_permissions=True)
        self.actor = User.objects.create_user(
            username="bootstrap-admin",
            password="StrongPass123!",
            email="bootstrap-admin@example.com",
            role=User.Role.ADMIN,
            is_staff=True,
            is_active=True,
        )

    def test_bootstrap_enterprise_uses_production_baseline_by_default(self):
        call_command("bootstrap_enterprise", verbosity=0)

        self.assertTrue(Organization.objects.filter(code="HQ", currency_code="TZS").exists())
        self.assertTrue(Department.objects.filter(code="PROC").exists())
        self.assertTrue(Department.objects.filter(code="FIN").exists())
        self.assertTrue(Department.objects.filter(code="OPS").exists())
        self.assertTrue(ApprovalWorkflowTemplate.objects.filter(code="PR-STANDARD").exists())
        self.assertFalse(ProcurementRequest.objects.filter(request_number__startswith="PR-DEMO-").exists())
        self.assertFalse(Vendor.objects.filter(code="VEND-ALPHA").exists())
        self.assertFalse(Product.objects.filter(sku__startswith="SKU-LAPTOP").exists())
        self.assertFalse(BudgetAccount.objects.filter(code="OPS-CAPEX").exists())

    def test_bootstrap_enterprise_demo_records_are_opt_in(self):
        call_command("bootstrap_enterprise", include_demo=True, verbosity=0)

        self.assertTrue(ProcurementRequest.objects.filter(request_number__startswith="PR-DEMO-").exists())
        self.assertTrue(Vendor.objects.filter(code="VEND-ALPHA").exists())
        self.assertTrue(Product.objects.filter(sku="SKU-LAPTOP-001").exists())
        self.assertTrue(BudgetAccount.objects.filter(code="OPS-CAPEX").exists())


class EnterpriseWorkflowTests(TestCase):
    def setUp(self):
        seed_rbac_defaults(sync_role_permissions=True)
        self.actor = User.objects.create_user(
            username="opsadmin",
            password="StrongPass123!",
            email="opsadmin@example.com",
            role=User.Role.ADMIN,
            is_staff=True,
            is_active=True,
        )
        self.organization = Organization.objects.create(
            name="Test Enterprise",
            code="TEST-HQ",
            slug="test-enterprise",
            currency_code="KES",
        )
        self.department = Department.objects.create(
            organization=self.organization,
            name="Procurement",
            code="PROC",
            manager=self.actor,
        )
        self.branch = Branch.objects.create(
            organization=self.organization,
            name="HQ",
            code="HQ",
            city="Nairobi",
            country="Kenya",
        )
        self.warehouse = Warehouse.objects.create(
            organization=self.organization,
            branch=self.branch,
            name="Main Warehouse",
            code="MAIN",
        )
        self.budget = BudgetAccount.objects.create(
            organization=self.organization,
            department=self.department,
            code="CAPEX",
            name="Capital Budget",
            fiscal_year=2026,
            allocated_amount=Decimal("1000000.00"),
        )
        self.vendor = Vendor.objects.create(
            organization=self.organization,
            name="Vendor One",
            code="V-001",
        )
        self.product = Product.objects.create(
            organization=self.organization,
            sku="SKU-001",
            name="Warehouse Scanner",
            standard_cost=Decimal("25000.00"),
            reorder_level=Decimal("2.00"),
        )
        admin_role = RoleDefinition.objects.get(key="admin")
        finance_role = RoleDefinition.objects.get(key="finance_officer")
        self.workflow = ApprovalWorkflowTemplate.objects.create(
            organization=self.organization,
            name="Procurement Standard",
            code="PROC-STD",
            module_key=ApprovalWorkflowTemplate.ModuleKey.PROCUREMENT_REQUEST,
        )
        ApprovalWorkflowStep.objects.create(workflow=self.workflow, sequence=1, name="Admin Review", role=admin_role)
        ApprovalWorkflowStep.objects.create(workflow=self.workflow, sequence=2, name="Finance Review", role=finance_role)

    def _build_request(self, *, quantity: Decimal, unit_price: Decimal) -> ProcurementRequest:
        procurement_request = ProcurementRequest.objects.create(
            organization=self.organization,
            department=self.department,
            budget_account=self.budget,
            requested_by=self.actor,
            title="Scanner rollout",
        )
        ProcurementRequestLine.objects.create(
            procurement_request=procurement_request,
            line_number=1,
            product=self.product,
            description="Warehouse Scanner",
            unit_of_measure="unit",
            quantity=quantity,
            unit_price=unit_price,
        )
        procurement_request.recalculate_total()
        return procurement_request

    def _create_finance_workflow(self, *, module_key: str, code: str, name: str):
        admin_role = RoleDefinition.objects.get(key="admin")
        workflow = ApprovalWorkflowTemplate.objects.create(
            organization=self.organization,
            name=name,
            code=code,
            module_key=module_key,
        )
        ApprovalWorkflowStep.objects.create(workflow=workflow, sequence=1, name=f"{name} approval", role=admin_role)
        return workflow

    def test_vertical_slice_moves_budget_and_inventory(self):
        procurement_request = self._build_request(quantity=Decimal("3.00"), unit_price=Decimal("25000.00"))

        submit_procurement_request(procurement_request, actor=self.actor)
        approve_procurement_request(procurement_request, actor=self.actor, comments="Admin pass")
        approve_procurement_request(procurement_request, actor=self.actor, comments="Finance pass")

        procurement_request.refresh_from_db()
        self.assertEqual(procurement_request.status, ProcurementRequest.Status.APPROVED)

        purchase_order = convert_procurement_request_to_purchase_order(
            procurement_request,
            actor=self.actor,
            vendor=self.vendor,
            warehouse=self.warehouse,
        )
        issue_purchase_order(purchase_order, actor=self.actor)
        receive_purchase_order(purchase_order, actor=self.actor, warehouse=self.warehouse)

        purchase_order.refresh_from_db()
        self.assertEqual(purchase_order.status, purchase_order.Status.RECEIVED)
        self.assertEqual(self.product.on_hand, Decimal("3.00"))

        invoice = purchase_order.finance_invoice
        post_invoice(invoice, actor=self.actor)
        approve_invoice(invoice, actor=self.actor)
        create_payment_request(invoice, actor=self.actor)
        approve_payment_request(invoice.payment_request, actor=self.actor)
        mark_payment_request_paid(invoice.payment_request, actor=self.actor, payment_reference="BANK-001")

        self.budget.refresh_from_db()
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, invoice.Status.PAID)
        self.assertEqual(self.budget.committed_amount, Decimal("0.00"))
        self.assertEqual(self.budget.spent_amount, Decimal("75000.00"))

    def test_submit_rejects_when_budget_is_exceeded(self):
        procurement_request = self._build_request(quantity=Decimal("100.00"), unit_price=Decimal("25000.00"))

        with self.assertRaises(EnterpriseWorkflowError):
            submit_procurement_request(procurement_request, actor=self.actor)

    def test_rejected_request_cannot_convert_to_purchase_order(self):
        procurement_request = self._build_request(quantity=Decimal("1.00"), unit_price=Decimal("25000.00"))

        submit_procurement_request(procurement_request, actor=self.actor)
        from .services import reject_procurement_request

        reject_procurement_request(procurement_request, actor=self.actor, comments="Insufficient justification")

        with self.assertRaises(EnterpriseWorkflowError):
            convert_procurement_request_to_purchase_order(
                procurement_request,
                actor=self.actor,
                vendor=self.vendor,
                warehouse=self.warehouse,
            )

    def test_goods_cannot_be_received_before_purchase_order_is_issued(self):
        procurement_request = self._build_request(quantity=Decimal("1.00"), unit_price=Decimal("25000.00"))

        submit_procurement_request(procurement_request, actor=self.actor)
        approve_procurement_request(procurement_request, actor=self.actor, comments="Admin pass")
        approve_procurement_request(procurement_request, actor=self.actor, comments="Finance pass")
        purchase_order = convert_procurement_request_to_purchase_order(
            procurement_request,
            actor=self.actor,
            vendor=self.vendor,
            warehouse=self.warehouse,
        )

        with self.assertRaises(EnterpriseWorkflowError):
            receive_purchase_order(purchase_order, actor=self.actor, warehouse=self.warehouse)

    def test_payment_request_cannot_be_paid_before_approval(self):
        procurement_request = self._build_request(quantity=Decimal("2.00"), unit_price=Decimal("25000.00"))

        submit_procurement_request(procurement_request, actor=self.actor)
        approve_procurement_request(procurement_request, actor=self.actor, comments="Admin pass")
        approve_procurement_request(procurement_request, actor=self.actor, comments="Finance pass")
        purchase_order = convert_procurement_request_to_purchase_order(
            procurement_request,
            actor=self.actor,
            vendor=self.vendor,
            warehouse=self.warehouse,
        )
        issue_purchase_order(purchase_order, actor=self.actor)
        receive_purchase_order(purchase_order, actor=self.actor, warehouse=self.warehouse)
        invoice = purchase_order.finance_invoice
        post_invoice(invoice, actor=self.actor)
        approve_invoice(invoice, actor=self.actor)
        payment_request = create_payment_request(invoice, actor=self.actor)

        with self.assertRaises(EnterpriseWorkflowError):
            mark_payment_request_paid(payment_request, actor=self.actor, payment_reference="BANK-002")

    def test_full_receipt_from_prefetched_purchase_order_creates_finance_invoice(self):
        procurement_request = self._build_request(quantity=Decimal("2.00"), unit_price=Decimal("25000.00"))

        submit_procurement_request(procurement_request, actor=self.actor)
        approve_procurement_request(procurement_request, actor=self.actor, comments="Admin pass")
        approve_procurement_request(procurement_request, actor=self.actor, comments="Finance pass")
        purchase_order = convert_procurement_request_to_purchase_order(
            procurement_request,
            actor=self.actor,
            vendor=self.vendor,
            warehouse=self.warehouse,
        )
        issue_purchase_order(purchase_order, actor=self.actor)

        prefetched_purchase_order = (
            purchase_order.__class__.objects.filter(id=purchase_order.id).prefetch_related("lines__product").get()
        )
        receive_purchase_order(prefetched_purchase_order, actor=self.actor, warehouse=self.warehouse)

        purchase_order.refresh_from_db()
        self.assertEqual(purchase_order.status, purchase_order.Status.RECEIVED)
        self.assertTrue(hasattr(purchase_order, "finance_invoice"))
        self.assertEqual(purchase_order.finance_invoice.status, purchase_order.finance_invoice.Status.DRAFT)

    def test_manual_purchase_order_lines_cannot_be_received_into_inventory(self):
        procurement_request = ProcurementRequest.objects.create(
            organization=self.organization,
            department=self.department,
            budget_account=self.budget,
            requested_by=self.actor,
            title="Manual service line",
        )
        ProcurementRequestLine.objects.create(
            procurement_request=procurement_request,
            line_number=1,
            product=None,
            description="Third-party installation service",
            unit_of_measure="service",
            quantity=Decimal("1.00"),
            unit_price=Decimal("5000.00"),
        )
        procurement_request.recalculate_total()

        submit_procurement_request(procurement_request, actor=self.actor)
        approve_procurement_request(procurement_request, actor=self.actor, comments="Admin pass")
        approve_procurement_request(procurement_request, actor=self.actor, comments="Finance pass")
        purchase_order = convert_procurement_request_to_purchase_order(
            procurement_request,
            actor=self.actor,
            vendor=self.vendor,
            warehouse=self.warehouse,
        )
        issue_purchase_order(purchase_order, actor=self.actor)

        with self.assertRaises(EnterpriseWorkflowError):
            receive_purchase_order(purchase_order, actor=self.actor, warehouse=self.warehouse)

    def test_procurement_approval_history_is_created_by_shared_engine(self):
        procurement_request = self._build_request(quantity=Decimal("1.00"), unit_price=Decimal("25000.00"))

        submit_procurement_request(procurement_request, actor=self.actor)
        procurement_request.refresh_from_db()
        self.assertIsNotNone(procurement_request.approval_instance)
        self.assertEqual(procurement_request.approval_instance.target_type, ApprovalInstance.TargetType.PROCUREMENT_REQUEST)
        self.assertEqual(procurement_request.approval_instance.target_id, procurement_request.id)
        self.assertGreaterEqual(procurement_request.approval_instance.history_entries.count(), 2)

        approve_procurement_request(procurement_request, actor=self.actor, comments="Admin pass")
        approve_procurement_request(procurement_request, actor=self.actor, comments="Finance pass")

        procurement_request.refresh_from_db()
        history_entries = list(procurement_request.approval_instance.history_entries.values_list("title", flat=True))
        self.assertIn("Submitted for approval", history_entries)
        self.assertIn("Approval workflow completed", history_entries)

    def test_finance_invoice_and_payment_request_can_register_with_shared_engine(self):
        self._create_finance_workflow(
            module_key=ApprovalWorkflowTemplate.ModuleKey.FINANCE_INVOICE,
            code="FIN-INV-STD",
            name="Finance Invoice Approval",
        )
        self._create_finance_workflow(
            module_key=ApprovalWorkflowTemplate.ModuleKey.PAYMENT_REQUEST,
            code="FIN-PAY-STD",
            name="Payment Request Approval",
        )

        procurement_request = self._build_request(quantity=Decimal("2.00"), unit_price=Decimal("25000.00"))
        submit_procurement_request(procurement_request, actor=self.actor)
        approve_procurement_request(procurement_request, actor=self.actor, comments="Admin pass")
        approve_procurement_request(procurement_request, actor=self.actor, comments="Finance pass")

        purchase_order = convert_procurement_request_to_purchase_order(
            procurement_request,
            actor=self.actor,
            vendor=self.vendor,
            warehouse=self.warehouse,
        )
        issue_purchase_order(purchase_order, actor=self.actor)
        receive_purchase_order(purchase_order, actor=self.actor, warehouse=self.warehouse)

        invoice = purchase_order.finance_invoice
        post_invoice(invoice, actor=self.actor)

        invoice_instance = ApprovalInstance.objects.filter(
            target_type=ApprovalInstance.TargetType.FINANCE_INVOICE,
            target_id=invoice.id,
        ).order_by("-submitted_at").first()
        self.assertIsNotNone(invoice_instance)
        self.assertEqual(invoice_instance.status, ApprovalInstance.Status.PENDING)

        approve_invoice(invoice, actor=self.actor)
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, invoice.Status.APPROVED)

        payment_request = create_payment_request(invoice, actor=self.actor)
        payment_instance = ApprovalInstance.objects.filter(
            target_type=ApprovalInstance.TargetType.PAYMENT_REQUEST,
            target_id=payment_request.id,
        ).order_by("-submitted_at").first()
        self.assertIsNotNone(payment_instance)
        self.assertEqual(payment_instance.status, ApprovalInstance.Status.PENDING)

    def test_procurement_revert_and_comment_use_shared_approval_engine(self):
        procurement_request = self._build_request(quantity=Decimal("1.00"), unit_price=Decimal("25000.00"))

        submit_procurement_request(procurement_request, actor=self.actor)
        add_procurement_request_approval_comment(procurement_request, actor=self.actor, body="Please validate vendor readiness.")
        approve_procurement_request(procurement_request, actor=self.actor, comments="Admin pass")
        revert_procurement_request_approval(procurement_request, actor=self.actor, comments="Return to queue.")

        procurement_request.refresh_from_db()
        procurement_request.approval_instance.refresh_from_db()

        self.assertEqual(procurement_request.status, ProcurementRequest.Status.SUBMITTED)
        self.assertEqual(procurement_request.approval_instance.status, ApprovalInstance.Status.PENDING)
        titles = list(procurement_request.approval_instance.history_entries.values_list("title", flat=True))
        self.assertIn("Approval comment added", titles)
        self.assertTrue(any(title.startswith("Reverted to ") for title in titles))

    def test_invoice_revert_returns_record_to_posted_before_payment_request_exists(self):
        self._create_finance_workflow(
            module_key=ApprovalWorkflowTemplate.ModuleKey.FINANCE_INVOICE,
            code="FIN-INV-REV",
            name="Finance Invoice Revert",
        )

        procurement_request = self._build_request(quantity=Decimal("1.00"), unit_price=Decimal("25000.00"))
        submit_procurement_request(procurement_request, actor=self.actor)
        approve_procurement_request(procurement_request, actor=self.actor, comments="Admin pass")
        approve_procurement_request(procurement_request, actor=self.actor, comments="Finance pass")
        purchase_order = convert_procurement_request_to_purchase_order(
            procurement_request,
            actor=self.actor,
            vendor=self.vendor,
            warehouse=self.warehouse,
        )
        issue_purchase_order(purchase_order, actor=self.actor)
        receive_purchase_order(purchase_order, actor=self.actor, warehouse=self.warehouse)

        invoice = purchase_order.finance_invoice
        post_invoice(invoice, actor=self.actor)
        add_invoice_approval_comment(invoice, actor=self.actor, body="Need one more look.")
        approve_invoice(invoice, actor=self.actor)
        revert_invoice_approval(invoice, actor=self.actor, comments="Send it back to posted.")

        invoice.refresh_from_db()
        self.assertEqual(invoice.status, invoice.Status.POSTED)
        instance = ApprovalInstance.objects.filter(
            target_type=ApprovalInstance.TargetType.FINANCE_INVOICE,
            target_id=invoice.id,
        ).order_by("-submitted_at").first()
        self.assertIsNotNone(instance)
        assert instance is not None
        self.assertEqual(instance.status, ApprovalInstance.Status.PENDING)
        self.assertIn("Approval comment added", list(instance.history_entries.values_list("title", flat=True)))

    def test_payment_request_revert_returns_record_to_submitted(self):
        self._create_finance_workflow(
            module_key=ApprovalWorkflowTemplate.ModuleKey.FINANCE_INVOICE,
            code="FIN-INV-RUN",
            name="Finance Invoice Flow",
        )
        self._create_finance_workflow(
            module_key=ApprovalWorkflowTemplate.ModuleKey.PAYMENT_REQUEST,
            code="FIN-PAY-RUN",
            name="Payment Request Flow",
        )

        procurement_request = self._build_request(quantity=Decimal("1.00"), unit_price=Decimal("25000.00"))
        submit_procurement_request(procurement_request, actor=self.actor)
        approve_procurement_request(procurement_request, actor=self.actor, comments="Admin pass")
        approve_procurement_request(procurement_request, actor=self.actor, comments="Finance pass")
        purchase_order = convert_procurement_request_to_purchase_order(
            procurement_request,
            actor=self.actor,
            vendor=self.vendor,
            warehouse=self.warehouse,
        )
        issue_purchase_order(purchase_order, actor=self.actor)
        receive_purchase_order(purchase_order, actor=self.actor, warehouse=self.warehouse)

        invoice = purchase_order.finance_invoice
        post_invoice(invoice, actor=self.actor)
        approve_invoice(invoice, actor=self.actor)
        payment_request = create_payment_request(invoice, actor=self.actor)
        add_payment_request_approval_comment(payment_request, actor=self.actor, body="Confirm coding.")
        approve_payment_request(payment_request, actor=self.actor)
        revert_payment_request_approval(payment_request, actor=self.actor, comments="Return to pending approval.")

        payment_request.refresh_from_db()
        self.assertEqual(payment_request.status, payment_request.Status.SUBMITTED)
        instance = ApprovalInstance.objects.filter(
            target_type=ApprovalInstance.TargetType.PAYMENT_REQUEST,
            target_id=payment_request.id,
        ).order_by("-submitted_at").first()
        self.assertIsNotNone(instance)
        assert instance is not None
        self.assertEqual(instance.status, ApprovalInstance.Status.PENDING)
        self.assertIn("Approval comment added", list(instance.history_entries.values_list("title", flat=True)))
