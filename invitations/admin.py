from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from django.utils.html import format_html
from .models import Invitation, InvitationReminder, InvitationAttachment


class InvitationReminderInline(admin.TabularInline):
    """Inline admin for InvitationReminder"""
    model = InvitationReminder
    extra = 0
    readonly_fields = ('reminder_type', 'channel', 'sent_at', 'status')
    fields = ('reminder_type', 'channel', 'sent_at', 'status', 'recipient')
    can_delete = False


class InvitationAttachmentInline(admin.TabularInline):
    model = InvitationAttachment
    extra = 0
    readonly_fields = ('uploaded_by', 'uploaded_at')
    fields = ('file', 'attachment_type', 'uploaded_by', 'uploaded_at')


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    """Admin interface for Invitation model"""
    
    list_display = (
        'event_title',
        'inviting_organization',
        'event_date',
        'get_status_badge',
        'contact_person',
        'get_upcoming_badge'
    )
    list_filter = ('status', 'event_date', 'created_at', 'rsvp_required')
    search_fields = ('event_title', 'inviting_organization', 'contact_person', 'contact_email')
    readonly_fields = ('created_at', 'updated_at', 'reviewed_at', 'get_event_info')
    
    fieldsets = (
        (_('Event Information'), {
            'fields': ('event_title', 'inviting_organization', 'description', 'location', 'event_date', 'event_duration_hours')
        }),
        (_('Contact Information'), {
            'fields': ('contact_person', 'contact_email', 'contact_phone')
        }),
        (_('Status & Review'), {
            'fields': ('status', 'reviewed_by', 'review_notes', 'reviewed_at')
        }),
        (_('Event Details'), {
            'fields': ('rsvp_required', 'expected_attendees', 'special_requirements'),
            'classes': ('collapse',)
        }),
        (_('Notification Status'), {
            'fields': ('reminder_3_days_sent', 'reminder_1_day_sent'),
            'classes': ('collapse',)
        }),
        (_('Timestamps'), {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    inlines = [InvitationReminderInline, InvitationAttachmentInline]
    
    ordering = ('event_date',)
    
    def get_status_badge(self, obj):
        """Display status as a colored badge"""
        colors = {
            'pending_review': '#FFC107',
            'accepted': '#28A745',
            'declined': '#DC3545',
            'confirmed_attendance': '#17A2B8',
            'completed': '#20C997',
        }
        color = colors.get(obj.status, '#6C757D')
        return format_html(
            '<span style="padding: 5px 10px; background-color: {}; color: white; border-radius: 3px; font-weight: bold;">{}</span>',
            color,
            obj.get_status_display()
        )
    get_status_badge.short_description = _('Status')
    
    def get_upcoming_badge(self, obj):
        """Display if event is upcoming (within 7 days)"""
        if obj.is_upcoming:
            return format_html(
                '<span style="padding: 5px 10px; background-color: #FF6B6B; color: white; border-radius: 3px;">⚠️ UPCOMING</span>'
            )
        return '-'
    get_upcoming_badge.short_description = _('Upcoming')
    
    def get_event_info(self, obj):
        """Display formatted event information"""
        return format_html(
            '<strong>Date:</strong> {} <br/>'
            '<strong>Duration:</strong> {} hours <br/>'
            '<strong>Location:</strong> {} <br/>'
            '<strong>Expected Attendees:</strong> {}',
            obj.event_date.strftime('%Y-%m-%d %H:%M'),
            obj.event_duration_hours,
            obj.location,
            obj.expected_attendees or 'Not specified'
        )
    get_event_info.short_description = _('Event Details')


@admin.register(InvitationReminder)
class InvitationReminderAdmin(admin.ModelAdmin):
    """Admin interface for InvitationReminder model"""
    
    list_display = ('invitation', 'reminder_type', 'channel', 'status', 'sent_at', 'recipient')
    list_filter = ('reminder_type', 'channel', 'status', 'sent_at')
    search_fields = ('invitation__event_title', 'recipient')
    readonly_fields = ('invitation', 'reminder_type', 'channel', 'sent_at', 'recipient')
    
    ordering = ('-sent_at',)
    
    def has_add_permission(self, request):
        return False


@admin.register(InvitationAttachment)
class InvitationAttachmentAdmin(admin.ModelAdmin):
    list_display = ('invitation', 'attachment_type', 'uploaded_by', 'uploaded_at')
    list_filter = ('attachment_type', 'uploaded_at')
    search_fields = ('invitation__event_title', 'attachment_type')
    readonly_fields = ('uploaded_by', 'uploaded_at')
