from django.contrib import admin

from .models import (
    ApprovalDecision,
    ApprovalInstance,
    ApprovalWorkflowStep,
    ApprovalWorkflowTemplate,
    Branch,
    BudgetAccount,
    Department,
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


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "currency_code", "timezone", "is_active")
    search_fields = ("name", "code")
    list_filter = ("is_active", "currency_code")


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "organization", "code", "manager", "is_active")
    search_fields = ("name", "code")
    list_filter = ("organization", "is_active")


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ("name", "organization", "code", "city", "country", "is_active")
    list_filter = ("organization", "is_active", "country")
    search_fields = ("name", "code", "city")


@admin.register(Vendor)
class VendorAdmin(admin.ModelAdmin):
    list_display = ("name", "organization", "code", "status")
    list_filter = ("organization", "status")
    search_fields = ("name", "code", "email")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "organization", "sku", "unit_of_measure", "standard_cost", "reorder_level", "is_active")
    list_filter = ("organization", "is_active")
    search_fields = ("name", "sku")


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ("name", "organization", "code", "branch", "location", "is_active")
    list_filter = ("organization", "is_active")
    search_fields = ("name", "code", "location")


@admin.register(BudgetAccount)
class BudgetAccountAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "organization", "department", "fiscal_year", "allocated_amount", "committed_amount", "spent_amount")
    list_filter = ("organization", "department", "fiscal_year")
    search_fields = ("code", "name")


class ApprovalWorkflowStepInline(admin.TabularInline):
    model = ApprovalWorkflowStep
    extra = 0


@admin.register(ApprovalWorkflowTemplate)
class ApprovalWorkflowTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "organization", "code", "module_key", "is_active")
    list_filter = ("organization", "module_key", "is_active")
    search_fields = ("name", "code")
    inlines = [ApprovalWorkflowStepInline]


@admin.register(ApprovalInstance)
class ApprovalInstanceAdmin(admin.ModelAdmin):
    list_display = ("workflow", "organization", "target_type", "status", "current_step", "submitted_by", "submitted_at")
    list_filter = ("organization", "target_type", "status")


@admin.register(ApprovalDecision)
class ApprovalDecisionAdmin(admin.ModelAdmin):
    list_display = ("instance", "step", "status", "actor", "decided_at")
    list_filter = ("status",)


class ProcurementRequestLineInline(admin.TabularInline):
    model = ProcurementRequestLine
    extra = 0


@admin.register(ProcurementRequest)
class ProcurementRequestAdmin(admin.ModelAdmin):
    list_display = ("request_number", "title", "organization", "department", "status", "requested_by", "total_amount", "created_at")
    list_filter = ("organization", "department", "status")
    search_fields = ("request_number", "title")
    inlines = [ProcurementRequestLineInline]


class PurchaseOrderLineInline(admin.TabularInline):
    model = PurchaseOrderLine
    extra = 0


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ("po_number", "organization", "vendor", "status", "total_amount", "issued_at")
    list_filter = ("organization", "status", "vendor")
    search_fields = ("po_number",)
    inlines = [PurchaseOrderLineInline]


class GoodsReceiptLineInline(admin.TabularInline):
    model = GoodsReceiptLine
    extra = 0


@admin.register(GoodsReceipt)
class GoodsReceiptAdmin(admin.ModelAdmin):
    list_display = ("receipt_number", "organization", "purchase_order", "warehouse", "received_by", "received_at")
    list_filter = ("organization", "warehouse")
    search_fields = ("receipt_number",)
    inlines = [GoodsReceiptLineInline]


@admin.register(InventoryLedgerEntry)
class InventoryLedgerEntryAdmin(admin.ModelAdmin):
    list_display = ("product", "warehouse", "movement_type", "quantity", "reference_number", "occurred_at")
    list_filter = ("organization", "warehouse", "movement_type")
    search_fields = ("product__name", "reference_number")


@admin.register(FinanceInvoice)
class FinanceInvoiceAdmin(admin.ModelAdmin):
    list_display = ("invoice_number", "organization", "vendor", "status", "amount", "invoice_date")
    list_filter = ("organization", "status", "vendor")
    search_fields = ("invoice_number",)


@admin.register(PaymentRequest)
class PaymentRequestAdmin(admin.ModelAdmin):
    list_display = ("payment_request_number", "organization", "invoice", "status", "amount", "created_at")
    list_filter = ("organization", "status")
    search_fields = ("payment_request_number", "invoice__invoice_number")
