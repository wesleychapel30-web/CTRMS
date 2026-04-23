from __future__ import annotations

from decimal import Decimal
import os
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Sum
from django.utils import timezone
from django.utils.text import slugify


def generate_reference(prefix: str) -> str:
    date_token = timezone.now().strftime("%Y%m%d")
    unique_token = uuid.uuid4().hex[:6].upper()
    return f"{prefix}-{date_token}-{unique_token}"


class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=30, unique=True, db_index=True)
    slug = models.SlugField(unique=True)
    legal_name = models.CharField(max_length=255, blank=True)
    timezone = models.CharField(max_length=80, default="Africa/Dar_es_Salaam")
    currency_code = models.CharField(max_length=3, default="TZS")
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "enterprise_organization"
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.code or self.name)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


class Department(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="departments",
    )
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=30)
    description = models.TextField(blank=True)
    manager = models.ForeignKey(
        "core.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="managed_enterprise_departments",
    )
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "enterprise_department"
        ordering = ["organization__name", "name"]
        unique_together = [["organization", "code"]]
        indexes = [
            models.Index(fields=["organization", "is_active"]),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code} · {self.name}"


class Branch(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="branches",
    )
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=30)
    city = models.CharField(max_length=120, blank=True)
    country = models.CharField(max_length=120, blank=True)
    address = models.TextField(blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "enterprise_branch"
        ordering = ["organization__name", "name"]
        unique_together = [["organization", "code"]]
        indexes = [
            models.Index(fields=["organization", "is_active"]),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code} · {self.name}"


class Vendor(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        ON_HOLD = "on_hold", "On Hold"
        INACTIVE = "inactive", "Inactive"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="vendors",
    )
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=40)
    contact_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "enterprise_vendor"
        ordering = ["organization__name", "name"]
        unique_together = [["organization", "code"]]
        indexes = [
            models.Index(fields=["organization", "status"]),
        ]

    def __str__(self) -> str:
        return self.name


class Product(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="products",
    )
    sku = models.CharField(max_length=60)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    unit_of_measure = models.CharField(max_length=30, default="unit")
    standard_cost = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(0)],
    )
    reorder_level = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(0)],
    )
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "enterprise_product"
        ordering = ["organization__name", "name"]
        unique_together = [["organization", "sku"]]
        indexes = [
            models.Index(fields=["organization", "is_active"]),
        ]

    def __str__(self) -> str:
        return f"{self.sku} · {self.name}"

    @property
    def on_hand(self) -> Decimal:
        total = self.inventory_ledger.aggregate(total=Sum("quantity")).get("total")
        return total or Decimal("0.00")


class Warehouse(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="warehouses",
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="warehouses",
    )
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=40)
    location = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "enterprise_warehouse"
        ordering = ["organization__name", "name"]
        unique_together = [["organization", "code"]]
        indexes = [
            models.Index(fields=["organization", "is_active"]),
        ]

    def clean(self):
        super().clean()
        if self.branch_id and self.branch.organization_id != self.organization_id:
            raise ValidationError("Warehouse branch must belong to the same organization.")

    def __str__(self) -> str:
        return f"{self.organization.code} · {self.name}"


class BudgetAccount(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="budget_accounts",
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="budget_accounts",
    )
    code = models.CharField(max_length=40)
    name = models.CharField(max_length=255)
    fiscal_year = models.PositiveIntegerField(default=timezone.now().year)
    allocated_amount = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(0)])
    committed_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(0)],
    )
    spent_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(0)],
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "enterprise_budget_account"
        ordering = ["organization__name", "code"]
        unique_together = [["organization", "code", "fiscal_year"]]
        indexes = [
            models.Index(fields=["organization", "fiscal_year"]),
        ]

    def clean(self):
        super().clean()
        if self.department_id and self.department.organization_id != self.organization_id:
            raise ValidationError("Budget account department must belong to the same organization.")

    @property
    def available_amount(self) -> Decimal:
        return self.allocated_amount - self.committed_amount - self.spent_amount

    def __str__(self) -> str:
        return f"{self.code} · {self.name}"


class ApprovalWorkflowTemplate(models.Model):
    class ModuleKey(models.TextChoices):
        PROCUREMENT_REQUEST = "procurement_request", "Procurement Request"
        FINANCE_INVOICE = "finance_invoice", "Finance Invoice"
        PAYMENT_REQUEST = "payment_request", "Payment Request"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="approval_workflows",
    )
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=40)
    module_key = models.CharField(max_length=50, choices=ModuleKey.choices, db_index=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "enterprise_approval_workflow_template"
        ordering = ["organization__name", "module_key", "name"]
        unique_together = [["organization", "code"]]
        indexes = [
            models.Index(fields=["organization", "module_key", "is_active"]),
        ]

    def __str__(self) -> str:
        return self.name


class ApprovalWorkflowStep(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(
        ApprovalWorkflowTemplate,
        on_delete=models.CASCADE,
        related_name="steps",
    )
    sequence = models.PositiveIntegerField()
    name = models.CharField(max_length=255)
    role = models.ForeignKey(
        "core.RoleDefinition",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approval_steps",
    )
    minimum_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
    )
    maximum_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "enterprise_approval_workflow_step"
        ordering = ["workflow__name", "sequence"]
        unique_together = [["workflow", "sequence"]]

    def clean(self):
        super().clean()
        if self.minimum_amount is not None and self.maximum_amount is not None and self.minimum_amount > self.maximum_amount:
            raise ValidationError("Workflow step minimum amount cannot exceed the maximum amount.")

    def __str__(self) -> str:
        return f"{self.workflow.code} · Step {self.sequence}"


class ApprovalInstance(models.Model):
    class TargetType(models.TextChoices):
        PROCUREMENT_REQUEST = "procurement_request", "Procurement Request"
        FINANCE_INVOICE = "finance_invoice", "Finance Invoice"
        PAYMENT_REQUEST = "payment_request", "Payment Request"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        CANCELLED = "cancelled", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="approval_instances",
    )
    workflow = models.ForeignKey(
        ApprovalWorkflowTemplate,
        on_delete=models.PROTECT,
        related_name="instances",
    )
    target_type = models.CharField(max_length=50, choices=TargetType.choices, db_index=True)
    target_id = models.UUIDField(db_index=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
    current_step = models.PositiveIntegerField(default=1)
    submitted_by = models.ForeignKey(
        "core.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submitted_approval_instances",
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "enterprise_approval_instance"
        ordering = ["-submitted_at"]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["target_type", "target_id"]),
        ]

    def clean(self):
        super().clean()
        if self.workflow.organization_id != self.organization_id:
            raise ValidationError("Approval workflow must belong to the same organization.")

    def __str__(self) -> str:
        return f"{self.get_target_type_display()} · {self.get_status_display()}"


class ApprovalDecision(models.Model):
    class DecisionStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        SKIPPED = "skipped", "Skipped"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    instance = models.ForeignKey(
        ApprovalInstance,
        on_delete=models.CASCADE,
        related_name="decisions",
    )
    step = models.ForeignKey(
        ApprovalWorkflowStep,
        on_delete=models.PROTECT,
        related_name="decisions",
    )
    status = models.CharField(max_length=20, choices=DecisionStatus.choices, default=DecisionStatus.PENDING, db_index=True)
    actor = models.ForeignKey(
        "core.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approval_decisions",
    )
    comments = models.TextField(blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "enterprise_approval_decision"
        ordering = ["instance__submitted_at", "step__sequence"]
        unique_together = [["instance", "step"]]
        indexes = [
            models.Index(fields=["instance", "status"]),
        ]

    def clean(self):
        super().clean()
        if self.step.workflow_id != self.instance.workflow_id:
            raise ValidationError("Approval decision step must belong to the same workflow as the instance.")

    def __str__(self) -> str:
        return f"{self.instance_id} · {self.step.sequence} · {self.status}"


class ApprovalHistoryEntry(models.Model):
    class EventType(models.TextChoices):
        REGISTERED = "registered", "Registered"
        SUBMITTED = "submitted", "Submitted"
        COMMENT = "comment", "Comment"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        REVERTED = "reverted", "Reverted"
        STEP_ADVANCED = "step_advanced", "Step Advanced"
        COMPLETED = "completed", "Completed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    instance = models.ForeignKey(
        ApprovalInstance,
        on_delete=models.CASCADE,
        related_name="history_entries",
    )
    step = models.ForeignKey(
        ApprovalWorkflowStep,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="history_entries",
    )
    actor = models.ForeignKey(
        "core.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approval_history_entries",
    )
    event_type = models.CharField(max_length=30, choices=EventType.choices, db_index=True)
    title = models.CharField(max_length=255)
    body = models.TextField(blank=True)
    old_status = models.CharField(max_length=20, blank=True)
    new_status = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "enterprise_approval_history_entry"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["instance", "-created_at"]),
            models.Index(fields=["event_type", "-created_at"]),
        ]

    def clean(self):
        super().clean()
        if self.step_id and self.step.workflow_id != self.instance.workflow_id:
            raise ValidationError("Approval history step must belong to the same workflow as the instance.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.instance_id} · {self.event_type}"


class ProcurementRequest(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        CONVERTED = "converted", "Converted"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="procurement_requests",
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        related_name="procurement_requests",
    )
    budget_account = models.ForeignKey(
        BudgetAccount,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="procurement_requests",
    )
    approval_instance = models.OneToOneField(
        ApprovalInstance,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="procurement_request",
    )
    request_number = models.CharField(max_length=40, unique=True, db_index=True)
    title = models.CharField(max_length=255)
    justification = models.TextField(blank=True)
    needed_by_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT, db_index=True)
    requested_by = models.ForeignKey(
        "core.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="enterprise_procurement_requests",
    )
    total_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(0)],
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    converted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "enterprise_procurement_request"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["department", "status"]),
        ]

    def clean(self):
        super().clean()
        if self.department.organization_id != self.organization_id:
            raise ValidationError("Procurement request department must belong to the same organization.")
        if self.budget_account_id and self.budget_account.organization_id != self.organization_id:
            raise ValidationError("Procurement request budget account must belong to the same organization.")

    def save(self, *args, **kwargs):
        if not self.request_number:
            self.request_number = generate_reference("PR")
        super().save(*args, **kwargs)

    def recalculate_total(self) -> Decimal:
        total = self.lines.aggregate(total=Sum("line_total")).get("total") or Decimal("0.00")
        self.total_amount = total
        self.save(update_fields=["total_amount", "updated_at"])
        return total

    def __str__(self) -> str:
        return self.request_number


class ProcurementRequestLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    procurement_request = models.ForeignKey(
        ProcurementRequest,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    line_number = models.PositiveIntegerField(default=1)
    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="procurement_request_lines",
    )
    description = models.CharField(max_length=255)
    unit_of_measure = models.CharField(max_length=30, default="unit")
    quantity = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(0)])
    unit_price = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(0)])
    line_total = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(0)],
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "enterprise_procurement_request_line"
        ordering = ["procurement_request__created_at", "line_number"]
        unique_together = [["procurement_request", "line_number"]]

    def clean(self):
        super().clean()
        if self.product_id and self.product.organization_id != self.procurement_request.organization_id:
            raise ValidationError("Procurement line product must belong to the same organization.")

    def save(self, *args, **kwargs):
        self.line_total = (self.quantity or Decimal("0.00")) * (self.unit_price or Decimal("0.00"))
        if self.product_id and not self.unit_of_measure:
            self.unit_of_measure = self.product.unit_of_measure
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.procurement_request.request_number} · {self.line_number}"


class PurchaseOrder(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        ISSUED = "issued", "Issued"
        PARTIALLY_RECEIVED = "partially_received", "Partially Received"
        RECEIVED = "received", "Received"
        CLOSED = "closed", "Closed"
        CANCELLED = "cancelled", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="purchase_orders",
    )
    procurement_request = models.OneToOneField(
        ProcurementRequest,
        on_delete=models.PROTECT,
        related_name="purchase_order",
    )
    vendor = models.ForeignKey(
        Vendor,
        on_delete=models.PROTECT,
        related_name="purchase_orders",
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.PROTECT,
        related_name="purchase_orders",
    )
    budget_account = models.ForeignKey(
        BudgetAccount,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="purchase_orders",
    )
    po_number = models.CharField(max_length=40, unique=True, db_index=True)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.DRAFT, db_index=True)
    issued_by = models.ForeignKey(
        "core.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="issued_purchase_orders",
    )
    notes = models.TextField(blank=True)
    total_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(0)],
    )
    issued_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "enterprise_purchase_order"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["vendor", "status"]),
        ]

    def clean(self):
        super().clean()
        if self.procurement_request.organization_id != self.organization_id:
            raise ValidationError("Purchase order request must belong to the same organization.")
        if self.vendor.organization_id != self.organization_id:
            raise ValidationError("Purchase order vendor must belong to the same organization.")
        if self.warehouse.organization_id != self.organization_id:
            raise ValidationError("Purchase order warehouse must belong to the same organization.")
        if self.budget_account_id and self.budget_account.organization_id != self.organization_id:
            raise ValidationError("Purchase order budget account must belong to the same organization.")

    def save(self, *args, **kwargs):
        if not self.po_number:
            self.po_number = generate_reference("PO")
        super().save(*args, **kwargs)

    def recalculate_total(self) -> Decimal:
        total = self.lines.aggregate(total=Sum("line_total")).get("total") or Decimal("0.00")
        self.total_amount = total
        self.save(update_fields=["total_amount", "updated_at"])
        return total

    def __str__(self) -> str:
        return self.po_number


class PurchaseOrderLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    procurement_request_line = models.ForeignKey(
        ProcurementRequestLine,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="purchase_order_lines",
    )
    line_number = models.PositiveIntegerField(default=1)
    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="purchase_order_lines",
    )
    description = models.CharField(max_length=255)
    unit_of_measure = models.CharField(max_length=30, default="unit")
    quantity_ordered = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(0)])
    quantity_received = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(0)],
    )
    unit_price = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(0)])
    line_total = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(0)],
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "enterprise_purchase_order_line"
        ordering = ["purchase_order__created_at", "line_number"]
        unique_together = [["purchase_order", "line_number"]]

    def clean(self):
        super().clean()
        if self.product_id and self.product.organization_id != self.purchase_order.organization_id:
            raise ValidationError("Purchase order line product must belong to the same organization.")
        if self.quantity_received > self.quantity_ordered:
            raise ValidationError("Received quantity cannot exceed the ordered quantity.")

    @property
    def outstanding_quantity(self) -> Decimal:
        return self.quantity_ordered - self.quantity_received

    def save(self, *args, **kwargs):
        self.line_total = (self.quantity_ordered or Decimal("0.00")) * (self.unit_price or Decimal("0.00"))
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.purchase_order.po_number} · {self.line_number}"


class GoodsReceipt(models.Model):
    class Status(models.TextChoices):
        POSTED = "posted", "Posted"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="goods_receipts",
    )
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.PROTECT,
        related_name="goods_receipts",
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.PROTECT,
        related_name="goods_receipts",
    )
    receipt_number = models.CharField(max_length=40, unique=True, db_index=True)
    received_by = models.ForeignKey(
        "core.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="received_goods_receipts",
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.POSTED, db_index=True)
    notes = models.TextField(blank=True)
    received_at = models.DateTimeField(default=timezone.now, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "enterprise_goods_receipt"
        ordering = ["-received_at"]
        indexes = [
            models.Index(fields=["organization", "received_at"]),
        ]

    def clean(self):
        super().clean()
        if self.purchase_order.organization_id != self.organization_id:
            raise ValidationError("Goods receipt purchase order must belong to the same organization.")
        if self.warehouse.organization_id != self.organization_id:
            raise ValidationError("Goods receipt warehouse must belong to the same organization.")

    def save(self, *args, **kwargs):
        if not self.receipt_number:
            self.receipt_number = generate_reference("GRN")
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.receipt_number


class GoodsReceiptLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    goods_receipt = models.ForeignKey(
        GoodsReceipt,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    purchase_order_line = models.ForeignKey(
        PurchaseOrderLine,
        on_delete=models.PROTECT,
        related_name="goods_receipt_lines",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="goods_receipt_lines",
    )
    quantity_received = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(0)])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "enterprise_goods_receipt_line"
        ordering = ["goods_receipt__received_at", "id"]

    def clean(self):
        super().clean()
        if self.purchase_order_line.purchase_order_id != self.goods_receipt.purchase_order_id:
            raise ValidationError("Goods receipt line must reference a line from the same purchase order.")
        if self.product_id != self.purchase_order_line.product_id:
            raise ValidationError("Goods receipt line product must match the purchase order line product.")
        if self.quantity_received > self.purchase_order_line.outstanding_quantity:
            raise ValidationError("Goods receipt quantity cannot exceed the purchase order line balance.")

    def __str__(self) -> str:
        return f"{self.goods_receipt.receipt_number} · {self.product.name}"


class InventoryLedgerEntry(models.Model):
    class MovementType(models.TextChoices):
        RECEIPT = "receipt", "Receipt"
        ISSUE = "issue", "Issue"
        ADJUSTMENT = "adjustment", "Adjustment"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="inventory_ledger_entries",
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.PROTECT,
        related_name="inventory_ledger_entries",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="inventory_ledger",
    )
    movement_type = models.CharField(max_length=20, choices=MovementType.choices, db_index=True)
    quantity = models.DecimalField(max_digits=14, decimal_places=2)
    unit_cost = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(0)])
    reference_type = models.CharField(max_length=50, blank=True)
    reference_number = models.CharField(max_length=80, blank=True)
    notes = models.TextField(blank=True)
    occurred_at = models.DateTimeField(default=timezone.now, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "enterprise_inventory_ledger_entry"
        ordering = ["-occurred_at"]
        indexes = [
            models.Index(fields=["organization", "warehouse", "product"]),
        ]

    def clean(self):
        super().clean()
        if self.warehouse.organization_id != self.organization_id:
            raise ValidationError("Inventory ledger warehouse must belong to the same organization.")
        if self.product.organization_id != self.organization_id:
            raise ValidationError("Inventory ledger product must belong to the same organization.")

    def __str__(self) -> str:
        return f"{self.product.name} · {self.quantity}"


class FinanceInvoice(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        POSTED = "posted", "Posted"
        APPROVED = "approved", "Approved"
        PAID = "paid", "Paid"
        RECONCILED = "reconciled", "Reconciled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="finance_invoices",
    )
    purchase_order = models.OneToOneField(
        PurchaseOrder,
        on_delete=models.PROTECT,
        related_name="finance_invoice",
    )
    vendor = models.ForeignKey(
        Vendor,
        on_delete=models.PROTECT,
        related_name="finance_invoices",
    )
    budget_account = models.ForeignKey(
        BudgetAccount,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="finance_invoices",
    )
    invoice_number = models.CharField(max_length=40, unique=True, db_index=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT, db_index=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(0)])
    invoice_date = models.DateField(default=timezone.localdate)
    posted_by = models.ForeignKey(
        "core.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="posted_finance_invoices",
    )
    approved_by = models.ForeignKey(
        "core.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_finance_invoices",
    )
    paid_by = models.ForeignKey(
        "core.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="paid_finance_invoices",
    )
    posted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    payment_reference = models.CharField(max_length=80, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "enterprise_finance_invoice"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["invoice_date", "status"]),
        ]

    def clean(self):
        super().clean()
        if self.purchase_order.organization_id != self.organization_id:
            raise ValidationError("Finance invoice purchase order must belong to the same organization.")
        if self.vendor.organization_id != self.organization_id:
            raise ValidationError("Finance invoice vendor must belong to the same organization.")
        if self.budget_account_id and self.budget_account.organization_id != self.organization_id:
            raise ValidationError("Finance invoice budget account must belong to the same organization.")

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            self.invoice_number = generate_reference("INV")
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.invoice_number


class PaymentRequest(models.Model):
    class Status(models.TextChoices):
        SUBMITTED = "submitted", "Submitted"
        APPROVED = "approved", "Approved"
        PAID = "paid", "Paid"
        REJECTED = "rejected", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="payment_requests",
    )
    invoice = models.OneToOneField(
        FinanceInvoice,
        on_delete=models.CASCADE,
        related_name="payment_request",
    )
    payment_request_number = models.CharField(max_length=40, unique=True, db_index=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SUBMITTED, db_index=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(0)])
    requested_by = models.ForeignKey(
        "core.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="requested_enterprise_payments",
    )
    approved_by = models.ForeignKey(
        "core.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_enterprise_payments",
    )
    paid_by = models.ForeignKey(
        "core.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="paid_enterprise_payments",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    payment_reference = models.CharField(max_length=80, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "enterprise_payment_request"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "status"]),
        ]

    def clean(self):
        super().clean()
        if self.invoice.organization_id != self.organization_id:
            raise ValidationError("Payment request invoice must belong to the same organization.")

    def save(self, *args, **kwargs):
        if not self.payment_request_number:
            self.payment_request_number = generate_reference("PAY")
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.payment_request_number


def enterprise_attachment_path(instance, filename):
    return f"enterprise/{instance.target_type}/{instance.target_id}/{filename}"


class EnterpriseAttachment(models.Model):
    class TargetType(models.TextChoices):
        PROCUREMENT_REQUEST = "procurement_request", "Procurement Request"
        GOODS_RECEIPT = "goods_receipt", "Goods Receipt"
        FINANCE_INVOICE = "finance_invoice", "Finance Invoice"
        PAYMENT_REQUEST = "payment_request", "Payment Request"

    ALLOWED_EXTENSIONS = ("pdf", "jpg", "jpeg", "png", "doc", "docx", "xls", "xlsx")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="attachments",
    )
    target_type = models.CharField(max_length=40, choices=TargetType.choices, db_index=True)
    target_id = models.UUIDField(db_index=True)
    file = models.FileField(upload_to=enterprise_attachment_path)
    attachment_type = models.CharField(max_length=100, default="Supporting Document")
    uploaded_by = models.ForeignKey(
        "core.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_enterprise_attachments",
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "enterprise_attachment"
        ordering = ["uploaded_at"]
        indexes = [
            models.Index(fields=["organization", "target_type", "target_id"]),
        ]

    def _resolve_target_model(self):
        target_models = {
            self.TargetType.PROCUREMENT_REQUEST: ProcurementRequest,
            self.TargetType.GOODS_RECEIPT: GoodsReceipt,
            self.TargetType.FINANCE_INVOICE: FinanceInvoice,
            self.TargetType.PAYMENT_REQUEST: PaymentRequest,
        }
        return target_models.get(self.target_type)

    def get_target_record(self):
        target_model = self._resolve_target_model()
        if target_model is None:
            return None
        return target_model.objects.filter(id=self.target_id).first()

    def clean(self):
        super().clean()
        target_record = self.get_target_record()
        if target_record is None:
            raise ValidationError("Attachment target record does not exist.")
        if getattr(target_record, "organization_id", None) != self.organization_id:
            raise ValidationError("Attachment target must belong to the same organization.")
        if self.file:
            ext = os.path.splitext(self.file.name)[1][1:].lower()
            if ext not in self.ALLOWED_EXTENSIONS:
                raise ValidationError(
                    f"File extension '{ext}' not allowed. Allowed: {', '.join(self.ALLOWED_EXTENSIONS)}"
                )
            max_upload_size = getattr(settings, "MAX_UPLOAD_SIZE", None)
            if max_upload_size and self.file.size > max_upload_size:
                raise ValidationError(
                    f"File size exceeds the maximum allowed upload size of {max_upload_size // (1024 * 1024)} MB."
                )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.get_target_type_display()} · {self.attachment_type}"
