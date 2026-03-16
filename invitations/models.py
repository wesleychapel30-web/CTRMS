from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
from datetime import timedelta
import uuid
import os


class Invitation(models.Model):
    """Invitation and event management model for Director"""
    
    class Status(models.TextChoices):
        PENDING_REVIEW = 'pending_review', _('Pending Review')
        ACCEPTED = 'accepted', _('Accepted')
        DECLINED = 'declined', _('Declined')
        CONFIRMED_ATTENDANCE = 'confirmed_attendance', _('Confirmed Attendance')
        COMPLETED = 'completed', _('Completed')
        CANCELLED = 'cancelled', _('Cancelled')
        ARCHIVED = 'archived', _('Archived')
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Event Details
    inviting_organization = models.CharField(
        max_length=255,
        help_text=_('Name of the organization issuing the invitation')
    )
    event_title = models.CharField(max_length=255)
    description = models.TextField()
    location = models.TextField()
    
    # Event Timing
    event_date = models.DateTimeField(
        help_text=_('Date and time of the event')
    )
    event_duration_hours = models.IntegerField(
        default=2,
        help_text=_('Duration of the event in hours')
    )
    
    # Status
    status = models.CharField(
        max_length=50,
        choices=Status.choices,
        default=Status.PENDING_REVIEW,
        db_index=True
    )

    created_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_invitations',
    )
    
    # Review and Management
    reviewed_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_invitations'
    )
    review_notes = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    
    # Contact Information
    contact_person = models.CharField(max_length=255)
    contact_email = models.EmailField()
    contact_phone = models.CharField(max_length=20)
    
    # Additional Information
    rsvp_required = models.BooleanField(default=True)
    expected_attendees = models.IntegerField(null=True, blank=True)
    special_requirements = models.TextField(blank=True)
    
    # Notification Tracking
    reminder_3_days_sent = models.BooleanField(default=False)
    reminder_1_day_sent = models.BooleanField(default=False)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'invitation'
        verbose_name = _('Invitation')
        verbose_name_plural = _('Invitations')
        ordering = ['event_date']
        indexes = [
            models.Index(fields=['status', 'event_date']),
            models.Index(fields=['event_date']),
            models.Index(fields=['-created_at']),
        ]
    
    def __str__(self):
        return f"{self.event_title} - {self.event_date.strftime('%Y-%m-%d %H:%M')}"

    @property
    def event_end_time(self):
        return self.event_date + timedelta(hours=self.event_duration_hours)
    
    @property
    def is_upcoming(self):
        """Check if event is within the next 7 days"""
        now = timezone.now()
        seven_days_later = now + timedelta(days=7)
        return now <= self.event_date <= seven_days_later
    
    @property
    def is_overdue_for_3day_reminder(self):
        """Check if 3-day reminder should be sent"""
        if self.reminder_3_days_sent:
            return False
        reminder_time = self.event_date - timedelta(days=3)
        return timezone.now() >= reminder_time
    
    @property
    def is_overdue_for_1day_reminder(self):
        """Check if 1-day reminder should be sent"""
        if self.reminder_1_day_sent:
            return False
        reminder_time = self.event_date - timedelta(days=1)
        return timezone.now() >= reminder_time
    
    def send_3day_reminder(self):
        """Mark 3-day reminder as sent"""
        self.reminder_3_days_sent = True
        self.save(update_fields=['reminder_3_days_sent', 'updated_at'])
    
    def send_1day_reminder(self):
        """Mark 1-day reminder as sent"""
        self.reminder_1_day_sent = True
        self.save(update_fields=['reminder_1_day_sent', 'updated_at'])


def invitation_attachment_path(instance, filename):
    return f'invitations/{instance.invitation.id}/{filename}'


class InvitationAttachment(models.Model):
    """Documents attached to invitations such as official letters and programs."""

    ALLOWED_EXTENSIONS = ('pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invitation = models.ForeignKey(
        Invitation,
        on_delete=models.CASCADE,
        related_name='attachments'
    )
    file = models.FileField(upload_to=invitation_attachment_path)
    attachment_type = models.CharField(max_length=100, default='Supporting Document')
    uploaded_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_invitation_attachments'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'invitation_attachment'
        ordering = ['uploaded_at']

    def __str__(self):
        return f"{self.invitation.event_title} - {self.attachment_type}"

    def save(self, *args, **kwargs):
        if self.file:
            ext = os.path.splitext(self.file.name)[1][1:].lower()
            if ext not in self.ALLOWED_EXTENSIONS:
                raise ValidationError(
                    f"File extension '{ext}' not allowed. "
                    f"Allowed: {', '.join(self.ALLOWED_EXTENSIONS)}"
                )
            max_upload_size = getattr(settings, 'MAX_UPLOAD_SIZE', None)
            if max_upload_size and self.file.size > max_upload_size:
                raise ValidationError(
                    f"File size exceeds the maximum allowed upload size of {max_upload_size // (1024 * 1024)} MB."
                )
        super().save(*args, **kwargs)


class InvitationReminder(models.Model):
    """Track reminder notifications sent for invitations"""
    
    class ReminderType(models.TextChoices):
        THREE_DAYS = '3_days', _('3 Days Before')
        ONE_DAY = '1_day', _('1 Day Before')
    
    class Channel(models.TextChoices):
        EMAIL = 'email', _('Email')
        DASHBOARD = 'dashboard', _('Dashboard Alert')
        SMS = 'sms', _('SMS')
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invitation = models.ForeignKey(
        Invitation,
        on_delete=models.CASCADE,
        related_name='reminders'
    )
    reminder_type = models.CharField(
        max_length=20,
        choices=ReminderType.choices
    )
    channel = models.CharField(
        max_length=50,
        choices=Channel.choices
    )
    sent_at = models.DateTimeField(auto_now_add=True)
    recipient = models.EmailField(null=True, blank=True)
    status = models.CharField(
        max_length=50,
        choices=[
            ('sent', _('Sent')),
            ('failed', _('Failed')),
            ('pending', _('Pending')),
        ],
        default='pending'
    )
    error_message = models.TextField(blank=True)
    
    class Meta:
        db_table = 'invitation_reminder'
        verbose_name = _('Invitation Reminder')
        verbose_name_plural = _('Invitation Reminders')
        ordering = ['-sent_at']
        unique_together = [['invitation', 'reminder_type', 'channel']]
    
    def __str__(self):
        return f"{self.invitation} - {self.get_reminder_type_display()} ({self.get_channel_display()})"
