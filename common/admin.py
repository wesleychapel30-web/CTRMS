from django.contrib import admin
from .models import SystemSettings


@admin.register(SystemSettings)
class SystemSettingsAdmin(admin.ModelAdmin):
    """Admin interface for SystemSettings model"""
    
    fieldsets = (
        ('Email Configuration', {
            'fields': (
                'email_notifications_enabled',
                'smtp_server',
                'smtp_port',
                'smtp_username',
                'smtp_password',
                'smtp_use_tls',
                'smtp_use_ssl',
                'sender_name',
                'sender_email',
            )
        }),
        ('SMS Configuration (Optional)', {
            'fields': (
                'sms_notifications_enabled',
                'sms_api_key',
                'sms_provider',
            ),
            'classes': ('collapse',)
        }),
        ('Backup Settings', {
            'fields': (
                'auto_backup_enabled',
                'backup_frequency',
                'backup_retention_days',
            )
        }),
        ('General Settings', {
            'fields': (
                'site_name',
                'organization_name',
                'organization_email',
                'support_email',
            )
        }),
        ('Security', {
            'fields': ('enable_encryption',),
        }),
    )
    
    readonly_fields = ('updated_at',)
    
    def has_add_permission(self, request):
        # Allow only one instance of SystemSettings
        return self.model.objects.count() == 0
    
    def has_delete_permission(self, request, obj=None):
        return False
