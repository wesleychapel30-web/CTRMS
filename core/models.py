from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
from django.core.exceptions import ValidationError
from datetime import timedelta
import uuid


class User(AbstractUser):
    """Custom user model with role-based access control"""
    
    class Role(models.TextChoices):
        DIRECTOR = 'director', _('Director')
        ADMIN = 'admin', _('Administrator')
        STAFF = 'staff', _('Staff')
        FINANCE_OFFICER = 'finance_officer', _('Finance Officer')
        AUDITOR = 'auditor', _('Auditor / Viewer')
        IT_ADMIN = 'it_admin', _('IT / System Admin')
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.STAFF,
        help_text=_('User role for RBAC')
    )
    phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    department = models.CharField(max_length=100, blank=True, null=True)
    is_active_staff = models.BooleanField(default=True)
    is_archived = models.BooleanField(default=False, db_index=True)
    force_password_change = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'auth_user'
        verbose_name = _('User')
        verbose_name_plural = _('Users')
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.get_full_name()} ({self.get_role_display()})"

    def get_role_keys(self) -> set[str]:
        keys = {(self.role or "").strip()} if getattr(self, "role", "") else set()
        if self.pk:
            keys.update(
                self.role_assignments.select_related("role").values_list("role__key", flat=True)
            )
        return {key for key in keys if key}

    def has_role(self, role_key: str) -> bool:
        if not role_key:
            return False
        return role_key in self.get_role_keys()

    @property
    def is_director(self):
        return self.has_role(self.Role.DIRECTOR)
    
    @property
    def is_admin(self):
        return self.has_role(self.Role.ADMIN)

    @property
    def is_staff_user(self):
        return self.has_role(self.Role.STAFF)

    @property
    def is_finance_officer(self):
        return self.has_role(self.Role.FINANCE_OFFICER)

    @property
    def is_auditor(self):
        return self.has_role(self.Role.AUDITOR)

    @property
    def is_it_admin(self):
        return self.has_role(self.Role.IT_ADMIN)

    def clean(self):
        super().clean()
        if not self.is_active:
            return
        limit = ROLE_LIMITS.get(self.role)
        if limit is None:
            return
        current = active_user_count_for_role(self.role, exclude_user_id=self.pk)
        if current >= limit:
            raise ValidationError({"role": f"Maximum {limit} active users are allowed for role {self.role}."})


ROLE_LIMITS = {
    User.Role.DIRECTOR: 3,
    User.Role.ADMIN: 2,
}


def active_user_count_for_role(role_key: str, *, exclude_user_id=None) -> int:
    qs = (
        User.objects.filter(is_active=True)
        .filter(models.Q(role=role_key) | models.Q(role_assignments__role__key=role_key))
        .distinct()
    )
    if exclude_user_id:
        qs = qs.exclude(id=exclude_user_id)
    return qs.count()


class Permission(models.Model):
    """Permission keys stored separately from roles (RBAC)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    key = models.CharField(max_length=120, unique=True, db_index=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    module = models.CharField(max_length=60, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'permission'
        ordering = ['module', 'key']

    def __str__(self):
        return self.key


class RoleDefinition(models.Model):
    """Role definitions (role metadata + display labels)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    key = models.CharField(max_length=40, unique=True, db_index=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'role_definition'
        ordering = ['key']

    def __str__(self):
        return self.key


class RolePermission(models.Model):
    """Role-to-permission mapping (roles ≠ permissions)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.ForeignKey(RoleDefinition, on_delete=models.CASCADE, related_name='role_permissions')
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name='role_permissions')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'role_permission'
        unique_together = [['role', 'permission']]
        indexes = [
            models.Index(fields=['role', 'permission']),
        ]

    def __str__(self):
        return f"{self.role.key}: {self.permission.key}"


class UserRole(models.Model):
    """Additional role assignments per user (supports multi-role RBAC)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='role_assignments')
    role = models.ForeignKey(RoleDefinition, on_delete=models.CASCADE, related_name='user_assignments')
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_role_assignments',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_role'
        unique_together = [['user', 'role']]
        indexes = [
            models.Index(fields=['user', 'role']),
            models.Index(fields=['role', 'created_at']),
        ]

    def __str__(self):
        return f"{self.user.username}: {self.role.key}"

    def clean(self):
        super().clean()
        if not self.user_id or not self.role_id:
            return
        role_key = (self.role.key or "").strip()
        if not role_key:
            return
        if role_key == self.user.role:
            # Primary role already grants this role's permissions.
            return
        if not self.user.is_active:
            return
        limit = ROLE_LIMITS.get(role_key)
        if limit is None:
            return
        current = active_user_count_for_role(role_key, exclude_user_id=self.user_id)
        if current >= limit:
            raise ValidationError({"role": f"Maximum {limit} active users are allowed for role {role_key}."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class AuditLog(models.Model):
    """Audit trail for all user actions"""
    
    class ActionType(models.TextChoices):
        CREATE = 'create', _('Create')
        UPDATE = 'update', _('Update')
        DELETE = 'delete', _('Delete')
        APPROVE = 'approve', _('Approve')
        REJECT = 'reject', _('Reject')
        DOWNLOAD = 'download', _('Download')
        VIEW = 'view', _('View')
        LOGIN = 'login', _('Login')
        LOGOUT = 'logout', _('Logout')
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name='audit_logs')
    action_type = models.CharField(max_length=50, choices=ActionType.choices)
    content_type = models.CharField(max_length=100)  # Model name, e.g., 'Request', 'Invitation'
    object_id = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'audit_log'
        verbose_name = _('Audit Log')
        verbose_name_plural = _('Audit Logs')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['content_type', 'object_id']),
        ]
    
    def __str__(self):
        return f"{self.user} - {self.get_action_type_display()} on {self.content_type}"


class RecordTimelineEntry(models.Model):
    """Persistent chatter/timeline entries for request and invitation records."""

    class EntryType(models.TextChoices):
        STATUS_CHANGE = 'status_change', _('Status Change')
        INTERNAL_NOTE = 'internal_note', _('Internal Note')
        DIRECTOR_COMMENT = 'director_comment', _('Director Comment')
        ADMIN_NOTE = 'admin_note', _('Admin Note')
        APPROVAL_ACTION = 'approval_action', _('Approval Action')
        REVERT_ACTION = 'revert_action', _('Revert Action')
        PAYMENT_ACTION = 'payment_action', _('Payment Action')
        SYSTEM_EVENT = 'system_event', _('System Event')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(
        'requests.Request',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='timeline_entries',
    )
    invitation = models.ForeignKey(
        'invitations.Invitation',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='timeline_entries',
    )
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='record_timeline_entries',
    )
    entry_type = models.CharField(max_length=40, choices=EntryType.choices, db_index=True)
    title = models.CharField(max_length=255)
    body = models.TextField(blank=True)
    old_status = models.CharField(max_length=60, blank=True)
    new_status = models.CharField(max_length=60, blank=True)
    is_internal = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'record_timeline_entry'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['request', '-created_at']),
            models.Index(fields=['invitation', '-created_at']),
            models.Index(fields=['entry_type', '-created_at']),
            models.Index(fields=['is_internal', '-created_at']),
        ]

    def clean(self):
        super().clean()
        if bool(self.request_id) == bool(self.invitation_id):
            raise ValidationError("Timeline entry must be linked to exactly one record.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        target = self.request_id or self.invitation_id or 'unknown'
        return f"{self.entry_type} on {target}"

# Import auth models so they're registered with Django
from django.conf import settings
import secrets

def generate_reset_token():
    """Generate a secure reset token"""
    return secrets.token_urlsafe(32)

class PasswordResetToken(models.Model):
    """Password reset token for email-based password recovery"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='password_reset_tokens'
    )
    token = models.CharField(
        max_length=255,
        unique=True,
        default=generate_reset_token
    )
    email = models.EmailField()
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'password_reset_token'
        verbose_name = _('Password Reset Token')
        verbose_name_plural = _('Password Reset Tokens')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['token']),
            models.Index(fields=['user', '-created_at']),
        ]
    
    def __str__(self):
        return f"Reset Token - {self.user.username}"

    @classmethod
    def create_for_user(cls, user, expires_in_hours=24):
        """Create a reset token and invalidate any previous unused token."""
        cls.objects.filter(user=user, is_used=False).update(is_used=True, used_at=timezone.now())
        return cls.objects.create(
            user=user,
            email=user.email,
            expires_at=timezone.now() + timedelta(hours=expires_in_hours),
        )
    
    @property
    def is_valid(self):
        return not self.is_used and timezone.now() < self.expires_at
    
    def mark_used(self):
        self.is_used = True
        self.used_at = timezone.now()
        self.save()


class UserPreferences(models.Model):
    """User notification and display preferences"""
    
    NOTIFICATION_FREQUENCY_CHOICES = [
        ('instant', _('Instant')),
        ('daily', _('Daily Digest')),
        ('weekly', _('Weekly Digest')),
        ('never', _('Never')),
    ]
    
    THEME_CHOICES = [
        ('light', _('Light Mode')),
        ('dark', _('Dark Mode')),
        ('auto', _('Auto (System)')),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='preferences'
    )
    
    # Notification Preferences
    email_notifications_enabled = models.BooleanField(default=True)
    request_notifications = models.CharField(
        max_length=20,
        choices=NOTIFICATION_FREQUENCY_CHOICES,
        default='instant'
    )
    approval_notifications = models.BooleanField(default=True)
    rejection_notifications = models.BooleanField(default=True)
    payment_notifications = models.BooleanField(default=True)
    event_notifications = models.BooleanField(default=True)
    
    # Quiet Hours
    quiet_hours_enabled = models.BooleanField(default=False)
    quiet_hours_start = models.TimeField(null=True, blank=True)
    quiet_hours_end = models.TimeField(null=True, blank=True)
    
    # Display Preferences
    theme = models.CharField(
        max_length=20,
        choices=THEME_CHOICES,
        default='light'
    )
    language = models.CharField(max_length=10, default='en')
    timezone = models.CharField(max_length=100, default='UTC')
    items_per_page = models.IntegerField(default=25)
    
    # Privacy
    profile_visibility = models.CharField(
        max_length=20,
        default='private'
    )
    allow_contact = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'user_preferences'
        verbose_name = _('User Preferences')
        verbose_name_plural = _('User Preferences')
    
    def __str__(self):
        return f"Preferences for {self.user.username}"


class Notification(models.Model):
    """Persistent in-app notifications (per-user via NotificationReceipt)."""

    class Kind(models.TextChoices):
        AUDIT = 'audit', _('Audit')
        EVENT = 'event', _('Event')
        SYSTEM = 'system', _('System')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.SYSTEM, db_index=True)
    title = models.CharField(max_length=255)
    message = models.TextField()
    href = models.CharField(max_length=500, blank=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_notifications',
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'notification'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['kind', '-created_at']),
        ]

    def __str__(self):
        return f"{self.kind}: {self.title}"


class NotificationReceipt(models.Model):
    """Per-user delivery/read state for notifications."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notification_receipts')
    notification = models.ForeignKey(Notification, on_delete=models.CASCADE, related_name='receipts')
    is_read = models.BooleanField(default=False, db_index=True)
    delivered_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'notification_receipt'
        unique_together = [['user', 'notification']]
        indexes = [
            models.Index(fields=['user', 'is_read', '-delivered_at']),
        ]

    def __str__(self):
        return f"{self.user.username}: {self.notification.title}"
