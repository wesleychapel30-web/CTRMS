from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from django.utils.html import format_html
from .models import Request, RequestDocument, RequestHistory


class RequestDocumentInline(admin.TabularInline):
    """Inline admin for RequestDocument"""
    model = RequestDocument
    extra = 1
    readonly_fields = ('uploaded_by', 'uploaded_at', 'id')
    fields = ('document', 'document_type', 'uploaded_by', 'uploaded_at')


@admin.register(Request)
class RequestAdmin(admin.ModelAdmin):
    """Admin interface for Request model"""
    
    list_display = (
        'request_id',
        'applicant_name',
        'category',
        'amount_requested',
        'get_status_badge',
        'created_at'
    )
    list_filter = ('status', 'category', 'created_at', 'reviewed_at')
    search_fields = ('request_id', 'applicant_name', 'applicant_email', 'applicant_id')
    readonly_fields = ('request_id', 'created_at', 'updated_at', 'reviewed_at', 'remaining_balance')
    
    fieldsets = (
        (_('Request Information'), {
            'fields': ('request_id', 'applicant_name', 'category', 'description', 'created_at', 'updated_at')
        }),
        (_('Applicant Details'), {
            'fields': (
                'applicant_email', 'applicant_phone', 'applicant_id',
                'applicant_organization', 'applicant_role', 'applicant_region', 'address'
            )
        }),
        (_('Request Details'), {
            'fields': ('title', 'number_of_beneficiaries')
        }),
        (_('Financial Information'), {
            'fields': ('amount_requested', 'approved_amount', 'disbursed_amount', 'remaining_balance')
        }),
        (_('Review & Approval'), {
            'fields': ('status', 'reviewed_by', 'review_notes', 'reviewed_at')
        }),
        (_('Payment Information'), {
            'fields': ('payment_date', 'payment_method', 'payment_reference'),
            'classes': ('collapse',)
        }),
    )
    
    inlines = [RequestDocumentInline]
    
    ordering = ('-created_at',)
    
    def get_status_badge(self, obj):
        """Display status as a colored badge"""
        colors = {
            'pending': '#FFC107',
            'under_review': '#17A2B8',
            'approved': '#28A745',
            'rejected': '#DC3545',
            'paid': '#20C997',
            'cancelled': '#6C757D',
            'archived': '#343A40',
        }
        color = colors.get(obj.status, '#6C757D')
        return format_html(
            '<span style="padding: 5px 10px; background-color: {}; color: white; border-radius: 3px; font-weight: bold;">{}</span>',
            color,
            obj.get_status_display()
        )
    get_status_badge.short_description = _('Status')
    
    def save_model(self, request, obj, form, change):
        """Set reviewed_by and reviewed_at when status changes to approved/rejected"""
        if change and obj.status in ['approved', 'rejected'] and not obj.reviewed_by:
            obj.reviewed_by = request.user
            obj.reviewed_at = __import__('django.utils.timezone', fromlist=['now']).now()
        super().save_model(request, obj, form, change)


@admin.register(RequestDocument)
class RequestDocumentAdmin(admin.ModelAdmin):
    """Admin interface for RequestDocument model"""
    
    list_display = ('id', 'request', 'document_type', 'uploaded_by', 'uploaded_at')
    list_filter = ('document_type', 'uploaded_at')
    search_fields = ('request__request_id', 'document_type')
    readonly_fields = ('uploaded_by', 'uploaded_at', 'id')
    
    ordering = ('-uploaded_at',)


@admin.register(RequestHistory)
class RequestHistoryAdmin(admin.ModelAdmin):
    list_display = ("request", "action", "performed_by", "created_at")
    list_filter = ("action", "created_at")
    search_fields = ("request__request_id", "comment", "performed_by__username")
    readonly_fields = ("id", "request", "action", "from_status", "to_status", "comment", "performed_by", "created_at")
    ordering = ("-created_at",)

    def has_add_permission(self, request):
        return False
