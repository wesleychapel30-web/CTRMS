from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
import uuid
import os


class Request(models.Model):
    """Request model for assistance requests (tuition, medical, construction, etc.)"""
    
    class Category(models.TextChoices):
        TUITION = 'tuition', _('Tuition')
        MEDICAL = 'medical', _('Medical Support')
        CONSTRUCTION = 'construction', _('Construction Aid')
        OTHER = 'other', _('Other')
    
    class Status(models.TextChoices):
        DRAFT = 'draft', _('Draft')
        PENDING = 'pending', _('Submitted')
        UNDER_REVIEW = 'under_review', _('Under Review')
        APPROVED = 'approved', _('Approved')
        REJECTED = 'rejected', _('Rejected')
        PARTIALLY_PAID = 'partially_paid', _('Partially Paid')
        PAID = 'paid', _('Paid / Completed')
        CANCELLED = 'cancelled', _('Cancelled')
        ARCHIVED = 'archived', _('Archived')
    
    # Primary Key and Identification
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request_id = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text=_('Auto-generated unique request ID')
    )
    
    # Applicant Information
    applicant_name = models.CharField(max_length=255)
    applicant_email = models.EmailField()
    applicant_phone = models.CharField(max_length=20)
    applicant_id = models.CharField(max_length=100, blank=True)  # National ID or Student ID
    applicant_organization = models.CharField(max_length=255, blank=True)
    applicant_role = models.CharField(max_length=100, blank=True)
    applicant_region = models.CharField(max_length=100, blank=True)
    address = models.TextField()
    
    # Request Details
    title = models.CharField(max_length=255, blank=True)
    category = models.CharField(
        max_length=50,
        choices=Category.choices,
        default=Category.OTHER
    )
    description = models.TextField()
    number_of_beneficiaries = models.PositiveIntegerField(null=True, blank=True)
    amount_requested = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    
    # Financial Tracking
    approved_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        null=True,
        blank=True
    )
    disbursed_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        default=0
    )
    remaining_balance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )
    
    # Status and Workflow
    status = models.CharField(
        max_length=50,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True
    )

    created_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_requests',
    )
    
    # Review Information
    reviewed_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_requests'
    )
    review_notes = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    
    # Payment Information
    payment_date = models.DateTimeField(null=True, blank=True)
    payment_method = models.CharField(
        max_length=100,
        blank=True,
        help_text=_('e.g., Bank Transfer, Check, Cash')
    )
    payment_reference = models.CharField(max_length=255, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'request'
        verbose_name = _('Request')
        verbose_name_plural = _('Requests')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['category', 'status']),
            models.Index(fields=['applicant_email']),
        ]
    
    def __str__(self):
        return f"{self.request_id} - {self.applicant_name}"
    
    def save(self, *args, **kwargs):
        # Auto-generate request_id if not present
        if not self.request_id:
            # Format: REQ-YYYY-MM-DD-XXXXXX
            date_str = timezone.now().strftime('%Y%m%d')
            count = Request.objects.filter(
                created_at__date=timezone.now().date()
            ).count() + 1
            self.request_id = f"REQ-{date_str}-{count:06d}"
        
        # Calculate remaining balance
        if self.approved_amount is not None:
            self.remaining_balance = self.approved_amount - self.disbursed_amount
        
        super().save(*args, **kwargs)


def request_document_path(instance, filename):
    """Generate file path for request documents"""
    return f'requests/{instance.request.request_id}/{filename}'


class RequestDocument(models.Model):
    """Document attachments for requests"""
    
    ALLOWED_EXTENSIONS = ('pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'xls', 'xlsx')
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(
        Request,
        on_delete=models.CASCADE,
        related_name='documents'
    )
    document = models.FileField(
        upload_to=request_document_path,
        help_text=_('Supported formats: PDF, JPG, PNG')
    )
    document_type = models.CharField(
        max_length=100,
        help_text=_('e.g., Invoice, Medical Report, ID Card')
    )
    uploaded_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_documents'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'request_document'
        verbose_name = _('Request Document')
        verbose_name_plural = _('Request Documents')
        ordering = ['uploaded_at']
    
    def __str__(self):
        return f"{self.request.request_id} - {self.document_type}"
    
    def save(self, *args, **kwargs):
        # Validate file extension
        if self.document:
            ext = os.path.splitext(self.document.name)[1][1:].lower()
            if ext not in self.ALLOWED_EXTENSIONS:
                raise ValidationError(
                    f"File extension '{ext}' not allowed. "
                    f"Allowed: {', '.join(self.ALLOWED_EXTENSIONS)}"
                )
            max_upload_size = getattr(settings, 'MAX_UPLOAD_SIZE', None)
            if max_upload_size and self.document.size > max_upload_size:
                raise ValidationError(
                    f"File size exceeds the maximum allowed upload size of {max_upload_size // (1024 * 1024)} MB."
                )
        super().save(*args, **kwargs)


class RequestHistory(models.Model):
    """Immutable timeline entries for request lifecycle events."""

    class Action(models.TextChoices):
        CREATED = 'created', _('Created')
        UPDATED = 'updated', _('Updated')
        SUBMITTED = 'submitted', _('Submitted')
        MOVED_TO_REVIEW = 'moved_to_review', _('Moved to review')
        APPROVED = 'approved', _('Approved')
        REJECTED = 'rejected', _('Rejected')
        PARTIALLY_PAID = 'partially_paid', _('Partially paid')
        PAID = 'paid', _('Paid')
        CANCELLED = 'cancelled', _('Cancelled')
        RESTORED = 'restored', _('Restored')
        REVERSED = 'reversed', _('Reversed')
        DOCUMENT_UPLOADED = 'document_uploaded', _('Document uploaded')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(Request, on_delete=models.CASCADE, related_name='history')
    action = models.CharField(max_length=40, choices=Action.choices, db_index=True)
    from_status = models.CharField(max_length=50, blank=True)
    to_status = models.CharField(max_length=50, blank=True)
    comment = models.TextField(blank=True)
    performed_by = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='request_history_entries',
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'request_history'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['request', '-created_at']),
            models.Index(fields=['action', '-created_at']),
        ]

    def __str__(self):
        return f"{self.request.request_id}: {self.action}"
