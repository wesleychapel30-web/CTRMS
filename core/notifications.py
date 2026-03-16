"""
Email Notification System
Handles all email communications
"""
from email.utils import formataddr

from django.core.mail import EmailMultiAlternatives, get_connection
from django.conf import settings
from django.db import models
from django.utils.timezone import now
import logging

from common.models import SystemSettings

logger = logging.getLogger(__name__)


class NotificationTemplate(models.Model):
    """Email notification template model"""
    
    TEMPLATE_TYPES = [
        ('REQUEST_SUBMITTED', 'Request Submitted Confirmation'),
        ('REQUEST_APPROVED', 'Request Approval Notification'),
        ('REQUEST_REJECTED', 'Request Rejection Notification'),
        ('PAYMENT_PROCESSED', 'Payment Processed Confirmation'),
        ('REMINDER_PAYMENT', 'Payment Reminder'),
        ('EVENT_INVITATION', 'Event Invitation'),
        ('EVENT_REMINDER', 'Event Reminder'),
        ('APPROVAL_REQUIRED', 'Approval Required Alert'),
        ('SYSTEM_ALERT', 'System Alert'),
        ('STATUS_CHANGED', 'Status Changed Notification'),
        ('INVITATION_STATUS_UPDATE', 'Invitation Status Update'),
        ('REMINDER_ALERT', 'Reminder Alert'),
    ]
    
    name = models.CharField(max_length=255)
    template_type = models.CharField(max_length=50, choices=TEMPLATE_TYPES, unique=True)
    subject = models.CharField(max_length=255)
    html_content = models.TextField()
    plain_text_content = models.TextField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.name} ({self.template_type})"
    
    class Meta:
        db_table = 'notification_template'
        ordering = ['template_type']


class EmailLog(models.Model):
    """Log of all sent emails"""
    
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('SENT', 'Sent'),
        ('FAILED', 'Failed'),
        ('BOUNCED', 'Bounced'),
    ]
    
    recipient = models.EmailField()
    subject = models.CharField(max_length=255)
    template_type = models.CharField(max_length=50)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    related_object_type = models.CharField(max_length=50, blank=True)
    related_object_id = models.CharField(max_length=255, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    retry_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.recipient} - {self.subject}"
    
    class Meta:
        db_table = 'email_log'
        ordering = ['-created_at']


class EmailNotificationService:
    """Service for sending email notifications"""

    _templates_seeded = False

    DEFAULT_TEMPLATE_LIBRARY = {
        'REQUEST_SUBMITTED': {
            'name': 'Request Submitted Confirmation',
            'subject': 'Request {request_id} submitted',
            'html_content': '<p>Hello {applicant_name}, your request <strong>{request_id}</strong> has been submitted.</p>',
            'plain_text_content': 'Hello {applicant_name}, your request {request_id} has been submitted.',
        },
        'REQUEST_APPROVED': {
            'name': 'Request Approved Notification',
            'subject': 'Request {request_id} approved',
            'html_content': '<p>Hello {applicant_name}, your request <strong>{request_id}</strong> was approved for {approved_amount}.</p>',
            'plain_text_content': 'Hello {applicant_name}, your request {request_id} was approved for {approved_amount}.',
        },
        'REQUEST_REJECTED': {
            'name': 'Request Rejected Notification',
            'subject': 'Request {request_id} update',
            'html_content': '<p>Hello {applicant_name}, your request <strong>{request_id}</strong> was not approved. Reason: {reason}</p>',
            'plain_text_content': 'Hello {applicant_name}, your request {request_id} was not approved. Reason: {reason}',
        },
        'PAYMENT_PROCESSED': {
            'name': 'Payment Processed Confirmation',
            'subject': 'Payment processed for {request_id}',
            'html_content': '<p>Hello {applicant_name}, payment of {amount} was processed for request <strong>{request_id}</strong> on {payment_date}.</p>',
            'plain_text_content': 'Hello {applicant_name}, payment of {amount} was processed for request {request_id} on {payment_date}.',
        },
        'REMINDER_PAYMENT': {
            'name': 'Payment Reminder',
            'subject': 'Payment reminder for {request_id}',
            'html_content': '<p>Hello {applicant_name}, this is a reminder that {amount} is approved for request <strong>{request_id}</strong>. Days since approval: {days_since_approval}.</p>',
            'plain_text_content': 'Hello {applicant_name}, this is a reminder that {amount} is approved for request {request_id}. Days since approval: {days_since_approval}.',
        },
        'APPROVAL_REQUIRED': {
            'name': 'Approval Required Alert',
            'subject': 'Approval required for {request_id}',
            'html_content': '<p>Request <strong>{request_id}</strong> from {applicant_name} is awaiting review.</p>',
            'plain_text_content': 'Request {request_id} from {applicant_name} is awaiting review.',
        },
        'EVENT_INVITATION': {
            'name': 'Event Invitation',
            'subject': 'Invitation: {event_name}',
            'html_content': '<p>You have been invited to <strong>{event_name}</strong> on {event_date} at {location}.</p>',
            'plain_text_content': 'You have been invited to {event_name} on {event_date} at {location}.',
        },
        'EVENT_REMINDER': {
            'name': 'Event Reminder',
            'subject': 'Reminder: {event_name}',
            'html_content': '<p>Reminder for <strong>{event_name}</strong> on {event_date} at {location}.</p>',
            'plain_text_content': 'Reminder for {event_name} on {event_date} at {location}.',
        },
        'INVITATION_STATUS_UPDATE': {
            'name': 'Invitation Status Update',
            'subject': 'Invitation update: {event_name} is now {status}',
            'html_content': '<p>The invitation for <strong>{event_name}</strong> is now <strong>{status}</strong>. Notes: {notes}</p>',
            'plain_text_content': 'The invitation for {event_name} is now {status}. Notes: {notes}',
        },
        'REMINDER_ALERT': {
            'name': 'Reminder Alert',
            'subject': '{title}',
            'html_content': '<p>{message}</p><p><a href="{resource_url}">{resource_url}</a></p>',
            'plain_text_content': '{message}\n{resource_url}',
        },
        'SYSTEM_ALERT': {
            'name': 'System Alert',
            'subject': '[{site_name}] {alert_title}',
            'html_content': '<p>{alert_message}</p>',
            'plain_text_content': '{alert_message}',
        },
        'STATUS_CHANGED': {
            'name': 'Status Changed Notification',
            'subject': '{resource_type} status changed',
            'html_content': '<p>{resource_type} <strong>{resource_id}</strong> status changed to <strong>{status}</strong>.</p>',
            'plain_text_content': '{resource_type} {resource_id} status changed to {status}.',
        },
    }

    @staticmethod
    def _format_with_context(value, context):
        class SafeDict(dict):
            def __missing__(self, key):
                return f"{{{key}}}"

        return str(value or "").format_map(SafeDict(context))

    @staticmethod
    def _format_tzs(amount):
        return f"TZS {float(amount or 0):,.2f}"

    @staticmethod
    def _get_system_settings():
        try:
            return SystemSettings.objects.first()
        except Exception:
            return None

    @staticmethod
    def _is_email_enabled(system_settings):
        if system_settings is None:
            return True
        return bool(system_settings.email_notifications_enabled)

    @staticmethod
    def _resolve_from_email(system_settings):
        sender_email = ""
        sender_name = ""
        if system_settings is not None:
            sender_email = (
                system_settings.sender_email
                or system_settings.organization_email
                or system_settings.support_email
                or ""
            ).strip()
            sender_name = (system_settings.sender_name or system_settings.site_name or "").strip()

        if not sender_email:
            sender_email = (settings.DEFAULT_FROM_EMAIL or "").strip()
        if sender_name and sender_email:
            return formataddr((sender_name, sender_email))
        return sender_email or settings.DEFAULT_FROM_EMAIL

    @staticmethod
    def _build_email_connection(system_settings):
        if system_settings is None:
            return None
        host = (system_settings.smtp_server or "").strip()
        if not host:
            return None

        use_ssl = bool(system_settings.smtp_use_ssl)
        use_tls = bool(system_settings.smtp_use_tls and not use_ssl)
        return get_connection(
            backend="django.core.mail.backends.smtp.EmailBackend",
            host=host,
            port=system_settings.smtp_port or 587,
            username=(system_settings.smtp_username or "").strip() or None,
            password=(system_settings.smtp_password or "").strip() or None,
            use_tls=use_tls,
            use_ssl=use_ssl,
            fail_silently=False,
        )

    @classmethod
    def seed_default_templates(cls):
        """Create/update reusable email templates for reminders and alerts."""
        for template_type, template_data in cls.DEFAULT_TEMPLATE_LIBRARY.items():
            NotificationTemplate.objects.update_or_create(
                template_type=template_type,
                defaults={
                    "name": template_data["name"],
                    "subject": template_data["subject"],
                    "html_content": template_data["html_content"],
                    "plain_text_content": template_data["plain_text_content"],
                    "is_active": True,
                },
            )

    @classmethod
    def _ensure_default_templates(cls):
        if cls._templates_seeded:
            return
        try:
            cls.seed_default_templates()
            cls._templates_seeded = True
        except Exception:
            # Template table may not be ready during early startup.
            return

    @staticmethod
    def _get_template_data(template_type):
        EmailNotificationService._ensure_default_templates()
        template = NotificationTemplate.objects.filter(
            template_type=template_type,
            is_active=True
        ).first()
        if template:
            return {
                'subject': template.subject,
                'html_content': template.html_content,
                'plain_text_content': template.plain_text_content,
            }
        fallback = EmailNotificationService.DEFAULT_TEMPLATE_LIBRARY.get(template_type) or {}
        if not fallback:
            return None
        return {
            "subject": fallback.get("subject", ""),
            "html_content": fallback.get("html_content", ""),
            "plain_text_content": fallback.get("plain_text_content", ""),
        }
    
    @staticmethod
    def send_notification(recipient_email, template_type, context=None, obj_type=None, obj_id=None):
        """
        Send email notification using template
        
        Args:
            recipient_email: Email recipient
            template_type: Type of template to use
            context: Context data for template rendering
            obj_type: Related object type (Request, Invitation, etc)
            obj_id: Related object ID
        
        Returns:
            EmailLog instance or None
        """
        try:
            if not recipient_email:
                return None

            template_data = EmailNotificationService._get_template_data(template_type)
            if not template_data:
                logger.warning(f"Template not found: {template_type}")
                return None
            
            # Prepare context
            context = dict(context or {})
            system_settings = EmailNotificationService._get_system_settings()
            context.setdefault('site_name', system_settings.site_name if system_settings else 'CTRMS')
            context.setdefault('support_email', system_settings.support_email if system_settings else settings.DEFAULT_FROM_EMAIL)
            context['current_year'] = now().year
            
            # Render email content
            subject = EmailNotificationService._format_with_context(template_data['subject'], context)
            html_content = EmailNotificationService._format_with_context(template_data['html_content'], context)
            text_content = EmailNotificationService._format_with_context(template_data['plain_text_content'], context)
            
            # Create log entry
            email_log = EmailLog.objects.create(
                recipient=recipient_email,
                subject=subject,
                template_type=template_type,
                related_object_type=obj_type,
                related_object_id=obj_id,
                status='PENDING'
            )

            if not EmailNotificationService._is_email_enabled(system_settings):
                email_log.status = 'FAILED'
                email_log.error_message = 'Email notifications are disabled in system settings.'
                email_log.save(update_fields=['status', 'error_message'])
                return None
            
            # Send email
            try:
                connection = EmailNotificationService._build_email_connection(system_settings)
                msg = EmailMultiAlternatives(
                    subject=subject,
                    body=text_content,
                    from_email=EmailNotificationService._resolve_from_email(system_settings),
                    to=[recipient_email],
                    connection=connection,
                )
                msg.attach_alternative(html_content, "text/html")
                msg.send()
                
                email_log.status = 'SENT'
                email_log.sent_at = now()
                email_log.save(update_fields=['status', 'sent_at'])
                
                logger.info(f"Email sent to {recipient_email}: {subject}")
                return email_log
            
            except Exception as e:
                email_log.status = 'FAILED'
                email_log.error_message = str(e)
                email_log.save(update_fields=['status', 'error_message'])
                
                logger.error(f"Failed to send email to {recipient_email}: {e}")
                return None
        
        except Exception as e:
            logger.error(f"Error in send_notification: {e}")
            return None
    
    @staticmethod
    def send_request_submitted(request_obj):
        """Send request submitted confirmation"""
        return EmailNotificationService.send_notification(
            recipient_email=request_obj.applicant_email,
            template_type='REQUEST_SUBMITTED',
            context={
                'applicant_name': request_obj.applicant_name,
                'request_id': request_obj.request_id,
                'amount': EmailNotificationService._format_tzs(request_obj.amount_requested),
                'category': request_obj.get_category_display(),
            },
            obj_type='Request',
            obj_id=str(request_obj.id)
        )
    
    @staticmethod
    def send_request_approved(request_obj):
        """Send request approval notification"""
        return EmailNotificationService.send_notification(
            recipient_email=request_obj.applicant_email,
            template_type='REQUEST_APPROVED',
            context={
                'applicant_name': request_obj.applicant_name,
                'request_id': request_obj.request_id,
                'approved_amount': EmailNotificationService._format_tzs(request_obj.approved_amount),
                'approval_notes': request_obj.review_notes or 'Request has been approved.',
            },
            obj_type='Request',
            obj_id=str(request_obj.id)
        )
    
    @staticmethod
    def send_request_rejected(request_obj):
        """Send request rejection notification"""
        return EmailNotificationService.send_notification(
            recipient_email=request_obj.applicant_email,
            template_type='REQUEST_REJECTED',
            context={
                'applicant_name': request_obj.applicant_name,
                'request_id': request_obj.request_id,
                'reason': request_obj.review_notes or 'Your request does not meet our criteria.',
            },
            obj_type='Request',
            obj_id=str(request_obj.id)
        )
    
    @staticmethod
    def send_payment_processed(request_obj):
        """Send payment processed confirmation"""
        return EmailNotificationService.send_notification(
            recipient_email=request_obj.applicant_email,
            template_type='PAYMENT_PROCESSED',
            context={
                'applicant_name': request_obj.applicant_name,
                'request_id': request_obj.request_id,
                'amount': EmailNotificationService._format_tzs(request_obj.disbursed_amount),
                'payment_date': request_obj.payment_date.strftime('%Y-%m-%d') if request_obj.payment_date else 'TBD',
                'reference': request_obj.payment_reference or 'N/A',
            },
            obj_type='Request',
            obj_id=str(request_obj.id)
        )
    
    @staticmethod
    def send_approval_required_alert(request_obj, reviewer_email):
        """Send alert to reviewer that approval is required"""
        return EmailNotificationService.send_notification(
            recipient_email=reviewer_email,
            template_type='APPROVAL_REQUIRED',
            context={
                'request_id': request_obj.request_id,
                'applicant_name': request_obj.applicant_name,
                'amount': EmailNotificationService._format_tzs(request_obj.amount_requested),
                'category': request_obj.get_category_display(),
                'submitted_date': request_obj.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            },
            obj_type='Request',
            obj_id=str(request_obj.id)
        )
    
    @staticmethod
    def send_event_invitation(invitation_obj, recipient_email):
        """Send event invitation"""
        return EmailNotificationService.send_notification(
            recipient_email=recipient_email,
            template_type='EVENT_INVITATION',
            context={
                'event_name': invitation_obj.event_title,
                'event_date': invitation_obj.event_date.strftime('%Y-%m-%d %H:%M:%S'),
                'location': invitation_obj.location,
                'description': invitation_obj.description or 'Event details available in the system.',
            },
            obj_type='Invitation',
            obj_id=str(invitation_obj.id)
        )

    @staticmethod
    def send_invitation_status_alert(invitation_obj, recipient_email, status_label=None, notes=None):
        """Send invitation status update alert."""
        return EmailNotificationService.send_notification(
            recipient_email=recipient_email,
            template_type='INVITATION_STATUS_UPDATE',
            context={
                'event_name': invitation_obj.event_title,
                'event_date': invitation_obj.event_date.strftime('%Y-%m-%d %H:%M:%S'),
                'location': invitation_obj.location,
                'status': status_label or invitation_obj.get_status_display(),
                'notes': notes or invitation_obj.review_notes or 'No additional notes.',
            },
            obj_type='Invitation',
            obj_id=str(invitation_obj.id)
        )
    
    @staticmethod
    def send_event_reminder(invitation_obj, recipient_email):
        """Send event reminder"""
        return EmailNotificationService.send_notification(
            recipient_email=recipient_email,
            template_type='EVENT_REMINDER',
            context={
                'event_name': invitation_obj.event_title,
                'event_date': invitation_obj.event_date.strftime('%Y-%m-%d %H:%M:%S'),
                'location': invitation_obj.location,
            },
            obj_type='Invitation',
            obj_id=str(invitation_obj.id)
        )
    
    @staticmethod
    def send_payment_reminder(request_obj):
        """Send payment reminder"""
        return EmailNotificationService.send_notification(
            recipient_email=request_obj.applicant_email,
            template_type='REMINDER_PAYMENT',
            context={
                'applicant_name': request_obj.applicant_name,
                'request_id': request_obj.request_id,
                'amount': EmailNotificationService._format_tzs(request_obj.approved_amount),
                'days_since_approval': (now().date() - request_obj.reviewed_at.date()).days if request_obj.reviewed_at else 0,
            },
            obj_type='Request',
            obj_id=str(request_obj.id)
        )

    @staticmethod
    def send_test_email(recipient_email, requested_by=None):
        """Send SMTP test email using current system settings."""
        actor = "System administrator"
        if requested_by is not None:
            actor = requested_by.get_full_name() or requested_by.username

        return EmailNotificationService.send_notification(
            recipient_email=recipient_email,
            template_type='SYSTEM_ALERT',
            context={
                'alert_title': 'SMTP Test Email',
                'alert_message': f'This is a test email from CTRMS. Triggered by {actor}.',
            },
            obj_type='SystemSettings',
            obj_id=str(getattr(requested_by, 'id', '')),
        )
    
    @staticmethod
    def retry_failed_emails():
        """Retry sending failed emails"""
        failed_logs = EmailLog.objects.filter(
            status='FAILED',
            retry_count__lt=3
        )
        
        for log in failed_logs:
            try:
                system_settings = EmailNotificationService._get_system_settings()
                connection = EmailNotificationService._build_email_connection(system_settings)
                msg = EmailMultiAlternatives(
                    subject=log.subject,
                    body=log.subject,  # Simplified
                    from_email=EmailNotificationService._resolve_from_email(system_settings),
                    to=[log.recipient],
                    connection=connection,
                )
                msg.send()
                
                log.status = 'SENT'
                log.sent_at = now()
                log.save(update_fields=['status', 'sent_at'])
                
                logger.info(f"Retry succeeded for {log.recipient}")
            
            except Exception as e:
                log.retry_count += 1
                log.error_message = str(e)
                log.save(update_fields=['retry_count', 'error_message'])
                
                logger.warning(f"Retry failed for {log.recipient}: {e}")
