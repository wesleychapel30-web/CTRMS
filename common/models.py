from django.db import models
from django.utils.translation import gettext_lazy as _
import uuid


class SystemSettings(models.Model):
    """Global system settings"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Email Settings
    email_notifications_enabled = models.BooleanField(default=True)
    smtp_server = models.CharField(max_length=255, blank=True)
    smtp_port = models.IntegerField(default=587)
    smtp_username = models.CharField(max_length=255, blank=True)
    smtp_password = models.CharField(max_length=255, blank=True)
    smtp_use_tls = models.BooleanField(default=True)
    smtp_use_ssl = models.BooleanField(default=False)
    sender_name = models.CharField(max_length=255, default='CTRMS')
    sender_email = models.EmailField(blank=True)
    
    # SMS Settings (Optional)
    sms_notifications_enabled = models.BooleanField(default=False)
    sms_api_key = models.CharField(max_length=500, blank=True)
    sms_provider = models.CharField(
        max_length=100,
        blank=True,
        choices=[
            ('twilio', _('Twilio')),
            ('nexmo', _('Nexmo')),
            ('custom', _('Custom')),
        ]
    )

    # Reminder Settings
    event_reminder_3_days_enabled = models.BooleanField(default=True)
    event_reminder_1_day_enabled = models.BooleanField(default=False)
    
    # Backup Settings
    auto_backup_enabled = models.BooleanField(default=True)
    backup_frequency = models.CharField(
        max_length=50,
        default='daily',
        choices=[
            ('daily', _('Daily')),
            ('weekly', _('Weekly')),
            ('monthly', _('Monthly')),
        ]
    )
    backup_retention_days = models.IntegerField(default=30)
    
    # General Settings
    site_name = models.CharField(max_length=255, default='CTRMS')
    organization_name = models.CharField(max_length=255)
    organization_email = models.EmailField()
    support_email = models.EmailField()
    
    # Encryption
    enable_encryption = models.BooleanField(default=True)
    
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'system_settings'
        verbose_name = _('System Settings')
        verbose_name_plural = _('System Settings')
    
    def __str__(self):
        return f"System Settings ({self.updated_at.strftime('%Y-%m-%d')})"

class OrganizationSettings(models.Model):
    """Organization branding and customization settings"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Branding
    organization_name = models.CharField(max_length=255, default='Chakou Trust')
    organization_slug = models.SlugField(unique=True, default='chakou-trust')
    organization_email = models.EmailField()
    organization_phone = models.CharField(max_length=20, blank=True)
    organization_address = models.TextField(blank=True)
    
    # Logo and Images
    logo = models.ImageField(
        upload_to='logos/',
        null=True,
        blank=True,
        help_text=_('Logo for navbar (recommended: 200x50px, PNG with transparent background)')
    )
    favicon = models.ImageField(
        upload_to='logos/',
        null=True,
        blank=True,
        help_text=_('Favicon for browser tab (recommended: 32x32px)')
    )
    banner_image = models.ImageField(
        upload_to='banners/',
        null=True,
        blank=True,
        help_text=_('Homepage banner image (recommended: 1920x400px)')
    )
    
    # Colors
    primary_color = models.CharField(
        max_length=7,
        default='#667eea',
        help_text=_('Primary brand color (hex format)')
    )
    secondary_color = models.CharField(
        max_length=7,
        default='#764ba2',
        help_text=_('Secondary brand color (hex format)')
    )
    accent_color = models.CharField(
        max_length=7,
        default='#f093fb',
        help_text=_('Accent color (hex format)')
    )
    
    # Social Links
    website_url = models.URLField(blank=True)
    facebook_url = models.URLField(blank=True)
    twitter_url = models.URLField(blank=True)
    instagram_url = models.URLField(blank=True)
    linkedin_url = models.URLField(blank=True)
    youtube_url = models.URLField(blank=True)
    
    # About
    about_us = models.TextField(blank=True)
    mission_statement = models.TextField(blank=True)
    
    # Footer
    footer_text = models.CharField(max_length=500, blank=True)
    show_social_links = models.BooleanField(default=True)
    
    # Settings
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'organization_settings'
        verbose_name = _('Organization Settings')
        verbose_name_plural = _('Organization Settings')
    
    def __str__(self):
        return f"{self.organization_name} Settings"
    
    @property
    def logo_url(self):
        """Return logo URL or None"""
        if self.logo:
            return self.logo.url
        return None
