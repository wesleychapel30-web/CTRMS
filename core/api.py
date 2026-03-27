"""
API Views for AJAX form submissions and data operations
Handles form submissions, exports, and data updates via AJAX
"""
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.contrib.auth.decorators import login_required
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.db import transaction
from django.db.models import Sum, Count, Q, Prefetch
from django.utils import timezone
from django.urls import reverse
from requests.models import Request
from requests.models import RequestDocument
from invitations.models import Invitation, InvitationAttachment
from core.models import (
    AuditLog,
    NotificationReceipt,
    Permission,
    RoleDefinition,
    RolePermission,
    ROLE_LIMITS,
    User,
    UserRole,
    active_user_count_for_role,
)
from core.notification_center import NotificationPayload, get_recipients_for_roles, mark_receipt_read, notify_users
from core.notifications import EmailNotificationService
from core.rbac import (
    get_user_permission_keys,
    get_user_role_keys,
    require_any_permission,
    require_permission,
    user_has_role,
    user_has_permission,
)
from core.rbac_defaults import CRITICAL_PERMISSION_KEYS, get_policy_bound_permissions
from core.rbac_service import get_user_additional_role_keys, sync_user_roles
from common.models import OrganizationSettings, SystemSettings
import json
from decimal import Decimal, InvalidOperation
from datetime import datetime, timedelta
from django.core.exceptions import ValidationError as DjangoValidationError

ACTIONABLE_NOTIFICATION_TITLES = {
    "Request submitted",
    "Pending approval",
    "Request approved",
    "Request rejected",
    "Payment recorded",
    "Invitation response",
    "Event reminder",
    "Overdue item",
}

POLICY_BOUND_PERMISSIONS = get_policy_bound_permissions()


def _policy_allowed_roles(permission_key: str) -> set[str]:
    rule = POLICY_BOUND_PERMISSIONS.get(permission_key) or {}
    return set(rule.get("allowed_roles") or [])


def _policy_violation_messages(role_key: str, desired_keys: set[str]) -> list[str]:
    messages: list[str] = []
    for permission_key, rule in POLICY_BOUND_PERMISSIONS.items():
        allowed_roles = set(rule.get("allowed_roles") or [])
        reason = str(rule.get("reason") or "This permission is fixed by policy.")
        if role_key in allowed_roles and permission_key not in desired_keys:
            messages.append(f"{permission_key} is fixed by policy for role {role_key}. {reason}")
        if role_key not in allowed_roles and permission_key in desired_keys:
            messages.append(f"{permission_key} cannot be assigned to role {role_key}. {reason}")
    return messages


def _active_users_retaining_permission_after_role_update(
    *,
    role_key: str,
    permission_key: str,
    desired_keys: set[str],
) -> int:
    active_users = User.objects.filter(is_active=True, is_archived=False).prefetch_related(
        Prefetch("role_assignments", queryset=UserRole.objects.select_related("role"))
    )

    current_mapping: dict[str, set[str]] = {}
    for assigned_role_key, permission_keys in (
        RolePermission.objects.select_related("role", "permission")
        .values_list("role__key", "permission__key")
    ):
        current_mapping.setdefault(assigned_role_key, set()).add(permission_keys)

    count = 0
    for user in active_users:
        if getattr(user, "is_superuser", False):
            count += 1
            continue

        role_keys = get_user_role_keys(user)
        if not role_keys:
            continue

        user_permission_keys: set[str] = set()
        for assigned_role_key in role_keys:
            if assigned_role_key == role_key:
                user_permission_keys.update(desired_keys)
            else:
                user_permission_keys.update(current_mapping.get(assigned_role_key, set()))

        if permission_key in user_permission_keys:
            count += 1

    return count


def _notification_receipts_queryset_for_user(user):
    is_staff_primary = getattr(user, "role", "") == User.Role.STAFF
    is_admin_or_director = user_has_role(user, User.Role.ADMIN) or user_has_role(user, User.Role.DIRECTOR)

    receipts_qs = (
        NotificationReceipt.objects.select_related("notification")
        .filter(user=user, notification__title__in=ACTIONABLE_NOTIFICATION_TITLES)
    )

    if is_staff_primary:
        receipts_qs = receipts_qs.exclude(notification__kind="audit").filter(
            Q(notification__href__startswith="/requests/")
            | Q(notification__href__startswith="/invitations/")
        )

    if not is_admin_or_director:
        receipts_qs = receipts_qs.exclude(notification__title__in={"Pending approval", "Overdue item"})

    return receipts_qs


@login_required
@require_http_methods(["POST"])
@require_permission("request:create")
def submit_request_form(request):
    """
    Handle request submission via AJAX
    Validates and creates new request
    """
    try:
        data = json.loads(request.body)
        
        # Validate required fields
        required_fields = ['applicant_name', 'applicant_phone', 'category', 'amount_requested']
        for field in required_fields:
            if field not in data or not data[field]:
                return JsonResponse({'success': False, 'error': f'{field} is required'}, status=400)
        
        # Create request
        new_request = Request.objects.create(
            applicant_name=data.get('applicant_name'),
            applicant_email=data.get('applicant_email', 'unknown@example.com'),
            applicant_phone=data.get('applicant_phone'),
            category=data.get('category'),
            address=data.get('address', 'Address not provided'),
            amount_requested=float(data.get('amount_requested', 0)),
            description=data.get('description', ''),
            status=Request.Status.PENDING,
            created_by=request.user,
        )
        
        # Log the action
        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.CREATE,
            content_type='Request',
            object_id=str(new_request.id),
            ip_address=get_client_ip(request),
            description=f"Submitted request {new_request.request_id}."
        )
        
        return JsonResponse({
            'success': True,
            'message': 'Request submitted successfully',
            'request_id': new_request.request_id,
            'request_uuid': str(new_request.id)
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@login_required
@require_http_methods(["POST"])
@require_permission("request:approve")
def approve_request_ajax(request):
    """
    Handle request approval via AJAX
    Directors only
    """
    try:
        if not user_has_role(request.user, User.Role.DIRECTOR):
            return JsonResponse({'success': False, 'error': 'Only Directors can approve requests.'}, status=403)
        data = json.loads(request.body)
        request_uuid = data.get('request_id')
        
        try:
            req_obj = Request.objects.get(id=request_uuid)
        except Request.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Request not found'}, status=404)
        
        if req_obj.status not in [Request.Status.PENDING, Request.Status.UNDER_REVIEW]:
            return JsonResponse({'success': False, 'error': 'Request cannot be approved in current status'}, status=400)
        
        # Update request
        approved_amount_raw = data.get('approved_amount', req_obj.amount_requested)
        try:
            approved_amount = Decimal(str(approved_amount_raw))
        except (InvalidOperation, TypeError):
            return JsonResponse({'success': False, 'error': 'Approved amount must be a valid number'}, status=400)
        if approved_amount < 0:
            return JsonResponse({'success': False, 'error': 'Approved amount must be 0 or greater'}, status=400)
        req_obj.approved_amount = approved_amount
        req_obj.reviewed_by = request.user
        req_obj.status = Request.Status.APPROVED
        req_obj.review_notes = data.get('notes', '')
        req_obj.reviewed_at = timezone.now()
        req_obj.save()
        
        # Log the action
        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.APPROVE,
            content_type='Request',
            object_id=str(req_obj.id),
            ip_address=get_client_ip(request),
            description=f"Approved request {req_obj.request_id} for {approved_amount}."
        )
        
        return JsonResponse({
            'success': True,
            'message': 'Request approved successfully',
            'request_id': req_obj.request_id
        })
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@login_required
@require_http_methods(["POST"])
@require_permission("request:reject")
def reject_request_ajax(request):
    """
    Handle request rejection via AJAX
    Directors only
    """
    try:
        if not user_has_role(request.user, User.Role.DIRECTOR):
            return JsonResponse({'success': False, 'error': 'Only Directors can reject requests.'}, status=403)
        data = json.loads(request.body)
        request_uuid = data.get('request_id')
        
        try:
            req_obj = Request.objects.get(id=request_uuid)
        except Request.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Request not found'}, status=404)
        
        if req_obj.status not in [Request.Status.PENDING, Request.Status.UNDER_REVIEW]:
            return JsonResponse({'success': False, 'error': 'Request cannot be rejected in current status'}, status=400)
        
        # Update request
        req_obj.status = Request.Status.REJECTED
        req_obj.review_notes = data.get('reason', '')
        req_obj.reviewed_by = request.user
        req_obj.reviewed_at = timezone.now()
        req_obj.save()
        
        # Log the action
        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.REJECT,
            content_type='Request',
            object_id=str(req_obj.id),
            ip_address=get_client_ip(request),
            description=f"Rejected request {req_obj.request_id}. {data.get('reason', '').strip()}".strip()
        )
        
        return JsonResponse({
            'success': True,
            'message': 'Request rejected successfully',
            'request_id': req_obj.request_id
        })
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@login_required
@require_http_methods(["POST"])
@require_permission("payment:record")
def mark_as_paid_ajax(request):
    """
    Handle marking request as paid via AJAX
    """
    try:
        data = json.loads(request.body)
        request_uuid = data.get('request_id')
        
        try:
            req_obj = Request.objects.get(id=request_uuid)
        except Request.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Request not found'}, status=404)
        
        if req_obj.status != Request.Status.APPROVED:
            return JsonResponse({'success': False, 'error': 'Only approved requests can be marked as paid'}, status=400)

        disbursed_amount_raw = data.get('disbursed_amount', None)
        if disbursed_amount_raw is None or disbursed_amount_raw == "":
            disbursed_amount = req_obj.approved_amount or 0
        else:
            try:
                disbursed_amount = Decimal(str(disbursed_amount_raw))
            except (InvalidOperation, TypeError):
                return JsonResponse({'success': False, 'error': 'Disbursed amount must be a valid number'}, status=400)
            if disbursed_amount < 0:
                return JsonResponse({'success': False, 'error': 'Disbursed amount must be 0 or greater'}, status=400)

        approved_amount = Decimal(str(req_obj.approved_amount or 0))
        next_status = (
            Request.Status.PARTIALLY_PAID
            if approved_amount > 0 and disbursed_amount < approved_amount
            else Request.Status.PAID
        )

        # Update request
        req_obj.status = next_status
        req_obj.payment_date = timezone.now()
        req_obj.payment_method = data.get('payment_method', 'Bank Transfer')
        req_obj.payment_reference = data.get('payment_reference', '')
        req_obj.disbursed_amount = disbursed_amount
        req_obj.save()
        
        # Log the action
        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.UPDATE,
            content_type='Request',
            object_id=str(req_obj.id),
            ip_address=get_client_ip(request),
            description=f"Recorded payment for request {req_obj.request_id}."
        )
        
        return JsonResponse({
            'success': True,
            'message': 'Payment recorded',
            'request_id': req_obj.request_id
        })
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@login_required
@require_http_methods(["GET"])
@require_any_permission(["request:view_all", "request:view_own", "payment:view", "payment:record"])
def get_requests_data(request):
    """
    Get requests data for dynamic table updates
    Supports filtering by status, category
    """
    try:
        status_filter = request.GET.get('status')
        category_filter = request.GET.get('category')
        limit = int(request.GET.get('limit', 20))
        
        queryset = Request.objects.all().order_by('-created_at')
        if not user_has_permission(request.user, "request:view_all"):
            if user_has_permission(request.user, "payment:view") or user_has_permission(request.user, "payment:record"):
                queryset = queryset.filter(status__in=[Request.Status.APPROVED, Request.Status.PARTIALLY_PAID, Request.Status.PAID])
            else:
                queryset = queryset.filter(created_by=request.user)
        
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        if category_filter:
            queryset = queryset.filter(category=category_filter)
        
        data = []
        for req in queryset[:limit]:
            data.append({
                'id': str(req.id),
                'request_id': req.request_id,
                'applicant_name': req.applicant_name,
                'category': req.category,
                'amount_requested': float(req.amount_requested),
                'approved_amount': float(req.approved_amount or 0),
                'status': req.status,
                'created_at': req.created_at.isoformat(),
                'approved_at': req.reviewed_at.isoformat() if req.reviewed_at else None
            })
        
        return JsonResponse({
            'success': True,
            'count': len(data),
            'data': data
        })
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@login_required
@require_http_methods(["GET"])
@require_permission("dashboard:view")
def get_dashboard_stats(request):
    """
    Get real-time dashboard statistics
    Returns JSON with current KPIs
    """
    try:
        total_requests = Request.objects.count()
        approved_requests = Request.objects.filter(status=Request.Status.APPROVED).count()
        pending_requests = Request.objects.filter(status=Request.Status.PENDING).count()
        under_review = Request.objects.filter(status=Request.Status.UNDER_REVIEW).count()
        partially_paid = Request.objects.filter(status=Request.Status.PARTIALLY_PAID).count()
        paid_requests = Request.objects.filter(status=Request.Status.PAID).count()
        approved_equivalent = approved_requests + partially_paid + paid_requests
        
        total_approved_amount = Request.objects.filter(
            status__in=[Request.Status.APPROVED, Request.Status.PARTIALLY_PAID, Request.Status.PAID]
        ).aggregate(total=Sum('approved_amount'))['total'] or 0

        total_disbursed = Request.objects.filter(
            status__in=[Request.Status.PARTIALLY_PAID, Request.Status.PAID]
        ).aggregate(total=Sum('disbursed_amount'))['total'] or 0
        
        return JsonResponse({
            'success': True,
            'stats': {
                'total_requests': total_requests,
                'approved_requests': approved_requests,
                'pending_requests': pending_requests,
                'under_review': under_review,
                'approval_rate': round((approved_equivalent / total_requests * 100), 1) if total_requests > 0 else 0,
                'partially_paid_requests': partially_paid,
                'paid_requests': paid_requests,
                'total_approved_amount': float(total_approved_amount),
                'total_disbursed': float(total_disbursed),
                'timestamp': timezone.now().isoformat()
            }
        })
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@login_required
@require_http_methods(["POST"])
@require_permission("invitation:create")
def create_event_ajax(request):
    """
    Create event/invitation via AJAX
    """
    try:
        data = json.loads(request.body)
        
        # Validate required fields
        required_fields = ['event_title', 'event_date', 'location']
        for field in required_fields:
            if field not in data or not data[field]:
                return JsonResponse({'success': False, 'error': f'{field} is required'}, status=400)
        
        # Parse date
        event_date = datetime.fromisoformat(data.get('event_date').replace('Z', '+00:00'))
        
        # Create invitation
        invitation = Invitation.objects.create(
            inviting_organization=data.get('inviting_organization', 'Unknown Organization'),
            event_title=data.get('event_title'),
            event_date=event_date,
            location=data.get('location'),
            description=data.get('description', ''),
            status=Invitation.Status.PENDING_REVIEW,
            created_by=request.user,
            contact_person=data.get('contact_person', request.user.get_full_name() or request.user.username),
            contact_email=data.get('contact_email', request.user.email or 'unknown@example.com'),
            contact_phone=data.get('contact_phone', getattr(request.user, 'phone', '') or 'N/A')
        )
        
        # Log the action
        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.CREATE,
            content_type='Invitation',
            object_id=str(invitation.id),
            ip_address=get_client_ip(request),
            description=f"Created event {invitation.event_title}"
        )
        
        return JsonResponse({
            'success': True,
            'message': 'Event created successfully',
            'event_id': str(invitation.id),
            'event_name': invitation.event_title
        })
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


def get_client_ip(request):
    """Get client IP address from request"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def _log_sensitive_user_action(request, target_user: User, description: str, action_type: str = AuditLog.ActionType.UPDATE):
    AuditLog.objects.create(
        user=request.user,
        action_type=action_type,
        content_type='User',
        object_id=str(target_user.id),
        ip_address=get_client_ip(request),
        description=description,
    )


def _serialize_user(user):
    permissions = sorted(get_user_permission_keys(user))
    role_keys = sorted(get_user_role_keys(user))
    additional_roles = sorted(set(role_keys) - {getattr(user, "role", "")})
    return {
        'id': str(user.id),
        'username': user.username,
        'email': user.email,
        'full_name': user.get_full_name() or user.username,
        'role': getattr(user, 'role', User.Role.STAFF),
        'primary_role': getattr(user, 'role', User.Role.STAFF),
        'roles': role_keys,
        'additional_roles': additional_roles,
        'department': getattr(user, 'department', '') or '',
        'is_staff': user.is_staff,
        'is_active_staff': getattr(user, 'is_active_staff', True),
        'is_active': user.is_active,
        'is_archived': getattr(user, 'is_archived', False),
        'force_password_change': getattr(user, 'force_password_change', False),
        'permissions': permissions,
    }


@ensure_csrf_cookie
@require_http_methods(["GET"])
def session_status(request):
    """Return current session user and ensure a CSRF cookie is present."""
    if request.user.is_authenticated:
        return JsonResponse({'authenticated': True, 'user': _serialize_user(request.user)})
    return JsonResponse({'authenticated': False, 'user': None})


@require_http_methods(["GET"])
def public_branding_data(request):
    """Public branding payload for login/header rendering."""
    organization = OrganizationSettings.objects.filter(is_active=True).first() or OrganizationSettings.objects.first()
    system = SystemSettings.objects.first()

    return JsonResponse(
        {
            "success": True,
            "branding": {
                "site_name": system.site_name if system else "CTRMS",
                "organization_name": (organization.organization_name if organization else (system.organization_name if system else "CTRMS")),
                "logo_url": organization.logo.url if organization and organization.logo else "",
                "favicon_url": organization.favicon.url if organization and organization.favicon else "",
                "banner_url": organization.banner_image.url if organization and organization.banner_image else "",
                "primary_color": organization.primary_color if organization else "#2563eb",
                "secondary_color": organization.secondary_color if organization else "#0ea5e9",
            },
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def session_login(request):
    """Log a user in using session authentication for the React frontend."""
    try:
        data = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        data = request.POST

    identifier = data.get('username', '').strip()
    password = data.get('password', '')
    username = identifier
    if identifier and '@' in identifier:
        matched_username = User.objects.filter(email__iexact=identifier).values_list('username', flat=True).first()
        if matched_username:
            username = matched_username

    user = authenticate(request, username=username, password=password)

    if user is None:
        return JsonResponse({'success': False, 'error': 'Invalid username or password'}, status=400)
    if getattr(user, "is_archived", False):
        return JsonResponse({'success': False, 'error': 'This account is archived. Contact an administrator.'}, status=403)

    login(request, user)
    return JsonResponse({'success': True, 'user': _serialize_user(user)})


@require_http_methods(["POST"])
@login_required
def session_logout(request):
    """Log out the current session user."""
    logout(request)
    return JsonResponse({'success': True})


@require_http_methods(["POST"])
@login_required
@require_permission("profile:change_password")
def change_own_password_api(request):
    """Allow the current user to change their own password."""
    try:
        data = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)

    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""

    if not current_password:
        return JsonResponse({'success': False, 'error': 'Current password is required'}, status=400)
    if not request.user.check_password(current_password):
        return JsonResponse({'success': False, 'error': 'Current password is incorrect'}, status=400)
    if len(new_password) < 8:
        return JsonResponse({'success': False, 'error': 'New password must be at least 8 characters'}, status=400)
    if current_password == new_password:
        return JsonResponse({'success': False, 'error': 'New password must be different from current password'}, status=400)

    request.user.set_password(new_password)
    request.user.force_password_change = False
    request.user.save(update_fields=["password", "force_password_change"])
    update_session_auth_hash(request, request.user)

    _log_sensitive_user_action(request, request.user, f"Changed password for {request.user.username}.")
    return JsonResponse({'success': True, 'user': _serialize_user(request.user)})


@login_required
@require_http_methods(["GET"])
@require_permission("dashboard:view")
def get_dashboard_overview(request):
    """Return dashboard KPIs, charts, and timeline data for the React app."""
    now = timezone.now()

    request_qs = Request.objects.all()
    invitation_qs = Invitation.objects.all()

    if not user_has_permission(request.user, "request:view_all"):
        if user_has_permission(request.user, "payment:view") or user_has_permission(request.user, "payment:record"):
            request_qs = request_qs.filter(status__in=[Request.Status.APPROVED, Request.Status.PARTIALLY_PAID, Request.Status.PAID])
        else:
            request_qs = request_qs.filter(created_by=request.user)

    if not user_has_permission(request.user, "invitation:view_all"):
        invitation_qs = invitation_qs.filter(created_by=request.user)

    draft_requests = request_qs.filter(status=Request.Status.DRAFT).count()
    total_requests = request_qs.count()
    approved_requests = request_qs.filter(status=Request.Status.APPROVED).count()
    pending_requests = request_qs.filter(status=Request.Status.PENDING).count()
    rejected_requests = request_qs.filter(status=Request.Status.REJECTED).count()
    partially_paid_requests = request_qs.filter(status=Request.Status.PARTIALLY_PAID).count()
    paid_requests = request_qs.filter(status=Request.Status.PAID).count()
    under_review = request_qs.filter(status=Request.Status.UNDER_REVIEW).count()
    approved_equivalent = approved_requests + partially_paid_requests + paid_requests

    upcoming_invitations = invitation_qs.filter(event_date__gte=now).count()
    events_next_week = invitation_qs.filter(event_date__range=[now, now + timedelta(days=7)]).count()

    total_requested = request_qs.aggregate(total=Sum('amount_requested'))['total'] or 0
    total_approved = request_qs.filter(
        status__in=[Request.Status.APPROVED, Request.Status.PARTIALLY_PAID, Request.Status.PAID]
    ).aggregate(total=Sum('approved_amount'))['total'] or 0
    total_disbursed = request_qs.filter(
        status__in=[Request.Status.PARTIALLY_PAID, Request.Status.PAID]
    ).aggregate(total=Sum('disbursed_amount'))['total'] or 0

    category_counts = []
    for category, label in Request.Category.choices:
        count = request_qs.filter(category=category).count()
        category_counts.append({'label': label, 'value': count})

    monthly_trend = []
    for offset in range(6, -1, -1):
        month_date = now - timedelta(days=30 * offset)
        monthly_trend.append({
            'label': month_date.strftime('%b'),
            'value': request_qs.filter(
                created_at__year=month_date.year,
                created_at__month=month_date.month,
            ).count(),
        })

    approval_rate = []
    for category, label in Request.Category.choices:
        total_in_category = request_qs.filter(category=category).count()
        approved_in_category = request_qs.filter(
            category=category,
            status__in=[Request.Status.APPROVED, Request.Status.PARTIALLY_PAID, Request.Status.PAID],
        ).count()
        value = round((approved_in_category / total_in_category) * 100, 1) if total_in_category else 0
        approval_rate.append({'label': label, 'value': value})

    timeline = []
    for invitation in invitation_qs.filter(event_date__gte=now).order_by('event_date')[:5]:
        tone = 'accent'
        if invitation.status == Invitation.Status.CONFIRMED_ATTENDANCE:
            tone = 'success'
        elif invitation.status == Invitation.Status.PENDING_REVIEW:
            tone = 'warning'
        elif invitation.status == Invitation.Status.DECLINED:
            tone = 'danger'
        timeline.append({
            'title': invitation.event_title,
            'subtitle': invitation.get_status_display(),
            'date': invitation.event_date.strftime('%b %d, %H:%M'),
            'tone': tone,
        })

    return JsonResponse({
        'success': True,
        'stats': {
            'total_requests': total_requests,
            'draft_requests': draft_requests,
            'pending_requests': pending_requests,
            'under_review': under_review,
            'approved_requests': approved_requests,
            'rejected_requests': rejected_requests,
            'partially_paid_requests': partially_paid_requests,
            'paid_requests': paid_requests,
            'upcoming_invitations': upcoming_invitations,
            'events_next_week': events_next_week,
            'total_requested': float(total_requested),
            'total_approved': float(total_approved),
            'total_disbursed': float(total_disbursed),
            'approval_rate': round((approved_equivalent / total_requests) * 100, 1) if total_requests else 0,
        },
        'charts': {
            'category_breakdown': category_counts,
            'monthly_trend': monthly_trend,
            'approval_rate': approval_rate,
        },
        'timeline': timeline,
    })


@login_required
@require_http_methods(["GET"])
@require_any_permission(["document:view_all", "document:view_own"])
def get_documents_data(request):
    """Return combined request and invitation documents."""
    can_view_all = user_has_permission(request.user, "document:view_all") or user_has_permission(request.user, "request:view_all") or user_has_permission(request.user, "invitation:view_all")

    request_docs_qs = RequestDocument.objects.select_related('request', 'request__created_by').order_by('-uploaded_at')
    invitation_docs_qs = InvitationAttachment.objects.select_related('invitation', 'invitation__created_by').order_by('-uploaded_at')

    if not can_view_all:
        request_docs_qs = request_docs_qs.filter(request__created_by=request.user)
        invitation_docs_qs = invitation_docs_qs.filter(invitation__created_by=request.user)

    request_documents = []
    for document in request_docs_qs[:200]:
        download_url = reverse("document-download", kwargs={"pk": document.pk})
        request_documents.append(
            {
                'id': str(document.id),
                'name': document.document.name.split('/')[-1],
                'type': document.document_type,
                'record_type': 'request',
                'linked_record': document.request.request_id,
                'url': download_url,
                'uploaded_at': document.uploaded_at.isoformat(),
            }
        )

    invitation_documents = []
    for document in invitation_docs_qs[:200]:
        download_url = reverse("invitation-attachment-download", kwargs={"pk": document.pk})
        invitation_documents.append(
            {
                'id': str(document.id),
                'name': document.file.name.split('/')[-1],
                'type': document.attachment_type,
                'record_type': 'invitation',
                'linked_record': document.invitation.event_title,
                'url': download_url,
                'uploaded_at': document.uploaded_at.isoformat(),
            }
        )
    return JsonResponse({'success': True, 'documents': request_documents + invitation_documents})


@login_required
@require_http_methods(["GET"])
@require_permission("audit:view")
def get_activity_logs_data(request):
    """Return recent audit logs."""
    if not (
        user_has_role(request.user, User.Role.ADMIN)
        or user_has_role(request.user, User.Role.DIRECTOR)
    ):
        return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=403)

    recent_logs = list(AuditLog.objects.select_related('user').order_by('-created_at')[:200])

    import uuid as _uuid

    request_ids = []
    invitation_ids = []
    for log in recent_logs:
        content_type = (log.content_type or '').lower()
        if content_type not in {'request', 'invitation'}:
            continue
        try:
            parsed = _uuid.UUID(str(log.object_id))
        except (ValueError, TypeError, AttributeError):
            continue
        if content_type == 'request':
            request_ids.append(parsed)
        else:
            invitation_ids.append(parsed)

    request_id_map = {}
    if request_ids:
        for req in Request.objects.filter(id__in=request_ids).only('id', 'request_id'):
            request_id_map[str(req.id)] = req.request_id

    invitation_title_map = {}
    if invitation_ids:
        for inv in Invitation.objects.filter(id__in=invitation_ids).only('id', 'event_title'):
            invitation_title_map[str(inv.id)] = inv.event_title

    action_verbs = {
        AuditLog.ActionType.CREATE: 'created',
        AuditLog.ActionType.UPDATE: 'updated',
        AuditLog.ActionType.DELETE: 'deleted',
        AuditLog.ActionType.APPROVE: 'approved',
        AuditLog.ActionType.REJECT: 'rejected',
        AuditLog.ActionType.DOWNLOAD: 'downloaded',
        AuditLog.ActionType.VIEW: 'viewed',
        AuditLog.ActionType.LOGIN: 'signed in',
        AuditLog.ActionType.LOGOUT: 'signed out',
    }

    def make_message(log):
        if log.description:
            return log.description

        verb = action_verbs.get(log.action_type, log.action_type.replace('_', ' '))
        content = (log.content_type or 'record').lower()

        if content == 'request':
            req_id = request_id_map.get(log.object_id) or log.object_id[:8]
            return f"{verb.capitalize()} request {req_id}."
        if content == 'invitation':
            title = invitation_title_map.get(log.object_id)
            if title:
                return f"{verb.capitalize()} invitation “{title}”."
            return f"{verb.capitalize()} invitation {log.object_id[:8]}."

        return f"{verb.capitalize()} {content} {log.object_id[:8]}."

    logs = [
        {
            'id': str(log.id),
            'user': log.user.get_full_name() or log.user.username,
            'action_type': log.action_type,
            'action_label': log.get_action_type_display(),
            'content_type': log.content_type,
            'object_id': log.object_id,
            'description': log.description,
            'message': make_message(log),
            'created_at': log.created_at.isoformat(),
        }
        for log in recent_logs
    ]
    return JsonResponse({'success': True, 'logs': logs})


@login_required
@require_http_methods(["GET"])
def get_user_management_data(request):
    """Return users and admin summary for the React admin page."""
    if not user_has_permission(request.user, "user:manage"):
        return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=403)

    users = []
    user_queryset = (
        User.objects.order_by('-created_at')
        .prefetch_related(
            Prefetch(
                'role_assignments',
                queryset=UserRole.objects.select_related('role'),
            )
        )
    )
    for user in user_queryset:
        role_keys = sorted(get_user_role_keys(user))
        users.append(
            {
                'id': str(user.id),
                'name': user.get_full_name() or user.username,
                'username': user.username,
                'email': user.email,
                'role': getattr(user, 'role', User.Role.STAFF),
                'role_label': user.get_role_display() if hasattr(user, 'get_role_display') else 'User',
                'roles': role_keys,
                'additional_roles': sorted(set(role_keys) - {user.role}),
                'department': user.department or '',
                'is_active': user.is_active,
                'is_active_staff': getattr(user, "is_active_staff", True),
                'is_archived': getattr(user, "is_archived", False),
                'force_password_change': getattr(user, "force_password_change", False),
                'last_login': user.last_login.isoformat() if user.last_login else None,
            }
        )
    summary = {
        'active_users': User.objects.filter(is_active=True, is_archived=False).count(),
        'directors': active_user_count_for_role(User.Role.DIRECTOR),
        'admins': active_user_count_for_role(User.Role.ADMIN),
        'audit_events_today': AuditLog.objects.filter(created_at__date=timezone.localdate()).count(),
        'departments': User.objects.exclude(department__isnull=True).exclude(department='').values('department').distinct().count(),
    }
    return JsonResponse({'success': True, 'summary': summary, 'users': users})


@login_required
@require_http_methods(["GET", "PATCH"])
def get_system_settings_data(request):
    """Return organization and system settings."""
    can_update_settings = user_has_permission(request.user, "settings:update")
    can_change_password = user_has_permission(request.user, "profile:change_password")

    def _coerce_bool(value):
        if isinstance(value, bool):
            return value
        if value is None:
            return False
        return str(value).strip().lower() in {"1", "true", "yes", "on"}

    if request.method == "PATCH":
        if not can_update_settings:
            return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=403)

        try:
            data = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)

        org_data = data.get('organization_settings') or {}
        system_data = data.get('system_settings') or {}

        organization = OrganizationSettings.objects.filter(is_active=True).first() or OrganizationSettings.objects.first()
        system = SystemSettings.objects.first()

        if system is None:
            system = SystemSettings.objects.create(
                site_name=system_data.get('site_name') or 'CTRMS',
                organization_name=system_data.get('organization_name') or org_data.get('organization_name') or 'CTRMS',
                organization_email=system_data.get('organization_email') or org_data.get('organization_email') or request.user.email or 'support@example.com',
                support_email=system_data.get('support_email') or request.user.email or 'support@example.com',
            )

        if organization is None:
            organization = OrganizationSettings.objects.create(
                organization_name=org_data.get('organization_name') or system.organization_name or 'CTRMS',
                organization_email=org_data.get('organization_email') or system.organization_email or request.user.email or 'support@example.com',
                organization_phone=org_data.get('organization_phone') or '',
                organization_address=org_data.get('organization_address') or '',
                website_url=org_data.get('website_url') or '',
                primary_color=org_data.get('primary_color') or '#2563eb',
                secondary_color=org_data.get('secondary_color') or '#0ea5e9',
                is_active=True,
            )
        else:
            if not organization.is_active:
                organization.is_active = True

        # Update organization settings (safe subset)
        for key in ['organization_name', 'organization_email', 'organization_phone', 'organization_address', 'website_url', 'primary_color', 'secondary_color']:
            if key in org_data:
                value = org_data.get(key)
                if key in {'organization_name', 'organization_email'} and not value:
                    continue
                setattr(organization, key, value or '')
        organization.save()

        # Update system settings (safe subset)
        for key in [
            'site_name',
            'organization_name',
            'organization_email',
            'support_email',
            'email_notifications_enabled',
            'sms_notifications_enabled',
            'backup_frequency',
            'backup_retention_days',
            'event_reminder_3_days_enabled',
            'event_reminder_1_day_enabled',
            'smtp_username',
            'smtp_use_tls',
            'smtp_use_ssl',
            'sender_name',
            'sender_email',
        ]:
            if key in system_data:
                value = system_data.get(key)
                if key in {'organization_name', 'organization_email', 'support_email'} and not value:
                    continue
                if key == 'backup_retention_days' and value is not None:
                    try:
                        value = int(value)
                    except (TypeError, ValueError):
                        return JsonResponse({'success': False, 'error': 'Retention days must be a number'}, status=400)
                if key in {'smtp_use_tls', 'smtp_use_ssl'}:
                    value = _coerce_bool(value)
                setattr(system, key, value)

        if 'smtp_host' in system_data:
            system.smtp_server = (system_data.get('smtp_host') or '').strip()
        if 'smtp_port' in system_data:
            try:
                system.smtp_port = int(system_data.get('smtp_port') or 0)
            except (TypeError, ValueError):
                return JsonResponse({'success': False, 'error': 'SMTP port must be a valid number.'}, status=400)
            if system.smtp_port <= 0:
                return JsonResponse({'success': False, 'error': 'SMTP port must be greater than 0.'}, status=400)
        if 'smtp_password' in system_data:
            smtp_password = (system_data.get('smtp_password') or '').strip()
            # Preserve existing password unless an explicit new value is provided.
            if smtp_password:
                system.smtp_password = smtp_password
        if _coerce_bool(system_data.get('clear_smtp_password')):
            system.smtp_password = ''

        # TLS and SSL should not both be enabled for a single SMTP transport.
        if system.smtp_use_ssl and system.smtp_use_tls:
            system.smtp_use_tls = False

        system.save()

        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.UPDATE,
            content_type='SystemSettings',
            object_id=str(system.id),
            ip_address=get_client_ip(request),
            description="Updated system settings",
        )

    if not can_update_settings and not can_change_password:
        return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=403)
    if not can_update_settings:
        return JsonResponse(
            {
                'success': True,
                'organization_settings': {
                    'organization_name': '',
                    'organization_email': '',
                    'organization_phone': '',
                    'organization_address': '',
                    'website_url': '',
                    'primary_color': '#2563eb',
                    'secondary_color': '#0ea5e9',
                    'logo_url': '',
                    'favicon_url': '',
                    'banner_url': '',
                },
                'system_settings': {
                    'site_name': '',
                    'organization_name': '',
                    'organization_email': '',
                    'support_email': '',
                    'email_notifications_enabled': False,
                    'sms_notifications_enabled': False,
                    'backup_frequency': 'weekly',
                    'backup_retention_days': 30,
                    'event_reminder_3_days_enabled': True,
                    'event_reminder_1_day_enabled': False,
                    'smtp_host': '',
                    'smtp_port': 587,
                    'smtp_username': '',
                    'smtp_password': '',
                    'smtp_password_configured': False,
                    'smtp_use_tls': True,
                    'smtp_use_ssl': False,
                    'sender_name': '',
                    'sender_email': '',
                },
            }
        )

    organization = OrganizationSettings.objects.filter(is_active=True).first() or OrganizationSettings.objects.first()
    system = SystemSettings.objects.first()

    return JsonResponse({
        'success': True,
        'organization_settings': {
            'organization_name': organization.organization_name if organization else '',
            'organization_email': organization.organization_email if organization else '',
            'organization_phone': organization.organization_phone if organization else '',
            'organization_address': organization.organization_address if organization else '',
            'website_url': organization.website_url if organization else '',
            'primary_color': organization.primary_color if organization else '',
            'secondary_color': organization.secondary_color if organization else '',
            'logo_url': organization.logo.url if organization and organization.logo else '',
            'favicon_url': organization.favicon.url if organization and organization.favicon else '',
            'banner_url': organization.banner_image.url if organization and organization.banner_image else '',
        },
        'system_settings': {
            'site_name': system.site_name if system else '',
            'organization_name': system.organization_name if system else '',
            'organization_email': system.organization_email if system else '',
            'support_email': system.support_email if system else '',
            'email_notifications_enabled': system.email_notifications_enabled if system else False,
            'sms_notifications_enabled': system.sms_notifications_enabled if system else False,
            'backup_frequency': system.backup_frequency if system else '',
            'backup_retention_days': system.backup_retention_days if system else 0,
            'event_reminder_3_days_enabled': system.event_reminder_3_days_enabled if system else True,
            'event_reminder_1_day_enabled': system.event_reminder_1_day_enabled if system else False,
            'smtp_host': system.smtp_server if (system and can_update_settings) else '',
            'smtp_port': system.smtp_port if (system and can_update_settings) else 587,
            'smtp_username': system.smtp_username if (system and can_update_settings) else '',
            'smtp_password': '',
            'smtp_password_configured': bool(system.smtp_password) if (system and can_update_settings) else False,
            'smtp_use_tls': system.smtp_use_tls if (system and can_update_settings) else True,
            'smtp_use_ssl': system.smtp_use_ssl if (system and can_update_settings) else False,
            'sender_name': system.sender_name if (system and can_update_settings) else ('CTRMS' if can_update_settings else ''),
            'sender_email': system.sender_email if (system and can_update_settings) else '',
        },
    })


@login_required
@require_http_methods(["POST"])
def send_test_email_api(request):
    """Send test email using current SMTP settings (Admin only)."""
    if not user_has_permission(request.user, "settings:update"):
        return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=403)

    try:
        data = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        data = {}

    recipient_email = (data.get('recipient_email') or request.user.email or '').strip()
    if not recipient_email:
        return JsonResponse({'success': False, 'error': 'Recipient email is required.'}, status=400)

    email_log = EmailNotificationService.send_test_email(recipient_email, requested_by=request.user)
    if email_log is None:
        return JsonResponse(
            {'success': False, 'error': 'Failed to send test email. Check SMTP configuration and notification settings.'},
            status=400,
        )

    AuditLog.objects.create(
        user=request.user,
        action_type=AuditLog.ActionType.UPDATE,
        content_type='SystemSettings',
        object_id='email-test',
        ip_address=get_client_ip(request),
        description=f"Sent SMTP test email to {recipient_email}.",
    )

    return JsonResponse({
        'success': True,
        'message': f'Test email sent to {recipient_email}.',
    })


@login_required
@require_http_methods(["GET"])
def get_notifications_data(request):
    """Return persistent notifications for the current user."""
    receipts_qs = _notification_receipts_queryset_for_user(request.user)
    receipts = list(receipts_qs.order_by("-notification__created_at")[:50])
    unread_count = sum(1 for receipt in receipts if not receipt.is_read)

    return JsonResponse({
        "success": True,
        "unread_count": unread_count,
        "notifications": [
            {
                "id": str(receipt.id),
                "title": receipt.notification.title,
                "message": receipt.notification.message,
                "created_at": receipt.notification.created_at.isoformat(),
                "href": receipt.notification.href or None,
                "kind": receipt.notification.kind,
                "is_read": receipt.is_read,
            }
            for receipt in receipts
        ],
    })


@login_required
@require_http_methods(["POST"])
def mark_notification_read_api(request, receipt_id):
    """Mark a notification as read for the current user."""
    try:
        receipt = NotificationReceipt.objects.select_related("notification").get(id=receipt_id, user=request.user)
    except NotificationReceipt.DoesNotExist:
        return JsonResponse({"success": False, "error": "Notification not found"}, status=404)

    mark_receipt_read(receipt=receipt)
    unread_count = _notification_receipts_queryset_for_user(request.user).filter(is_read=False).count()
    return JsonResponse({"success": True, "unread_count": unread_count})


@login_required
@require_http_methods(["GET"])
@require_permission("search:global")
def search_api(request):
    """Global search across requests and invitations for the top command bar."""
    query = (request.GET.get("q") or "").strip()
    if not query:
        return JsonResponse({"success": True, "results": []})

    req_qs = Request.objects.filter(
        Q(request_id__icontains=query)
        | Q(applicant_name__icontains=query)
        | Q(applicant_email__icontains=query)
    ).order_by("-created_at")[:8]
    if not user_has_permission(request.user, "request:view_all"):
        req_qs = req_qs.filter(created_by=request.user)

    inv_qs = Invitation.objects.filter(
        Q(event_title__icontains=query)
        | Q(inviting_organization__icontains=query)
        | Q(contact_person__icontains=query)
    ).order_by("-event_date")[:8]
    if not user_has_permission(request.user, "invitation:view_all"):
        inv_qs = inv_qs.filter(created_by=request.user)

    results = []
    for req in req_qs:
        results.append({
            "type": "request",
            "id": str(req.id),
            "title": req.request_id,
            "subtitle": f"{req.applicant_name} · {req.get_status_display()}",
            "href": f"/requests/{req.id}",
        })
    for inv in inv_qs:
        results.append({
            "type": "invitation",
            "id": str(inv.id),
            "title": inv.event_title,
            "subtitle": f"{inv.inviting_organization} · {inv.get_status_display()}",
            "href": f"/invitations/{inv.id}",
        })

    return JsonResponse({"success": True, "results": results[:12]})


@login_required
@require_http_methods(["POST"])
def upload_organization_assets_api(request):
    """Upload organization branding assets (Admin only)."""
    if not user_has_permission(request.user, "settings:update"):
        return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=403)

    organization = OrganizationSettings.objects.filter(is_active=True).first() or OrganizationSettings.objects.first()
    if organization is None:
        return JsonResponse({'success': False, 'error': 'Organization settings not initialized'}, status=400)

    updated_fields = []
    if request.FILES.get("logo"):
        organization.logo = request.FILES["logo"]
        updated_fields.append("logo")
    if request.FILES.get("favicon"):
        organization.favicon = request.FILES["favicon"]
        updated_fields.append("favicon")
    if request.FILES.get("banner_image"):
        organization.banner_image = request.FILES["banner_image"]
        updated_fields.append("banner_image")

    if not updated_fields:
        return JsonResponse({'success': False, 'error': 'No files uploaded'}, status=400)

    organization.save(update_fields=updated_fields + ["updated_at"])

    AuditLog.objects.create(
        user=request.user,
        action_type=AuditLog.ActionType.UPDATE,
        content_type='OrganizationSettings',
        object_id=str(organization.id),
        ip_address=get_client_ip(request),
        description="Updated organization branding assets",
    )

    notify_users(
        recipients=get_recipients_for_roles([User.Role.ADMIN]),
        payload=NotificationPayload(
            kind="system",
            title="Branding updated",
            message="Organization branding assets were updated.",
            href="/settings",
        ),
        created_by=request.user,
    )

    return JsonResponse({
        'success': True,
        'organization_settings': {
            'logo_url': organization.logo.url if organization.logo else '',
            'favicon_url': organization.favicon.url if organization.favicon else '',
            'banner_url': organization.banner_image.url if organization.banner_image else '',
        }
    })


@login_required
@require_http_methods(["POST"])
def create_user_api(request):
    """Create a new user (Admin only)."""
    has_manage = user_has_permission(request.user, "user:manage")
    has_create = user_has_permission(request.user, "user:create")
    has_assign_role = user_has_permission(request.user, "user:assign_role")
    if not (has_manage or (has_create and has_assign_role)):
        return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=403)

    try:
        data = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)

    username = (data.get('username') or '').strip()
    email = (data.get('email') or '').strip()
    full_name = (data.get('full_name') or '').strip()
    role = (data.get('role') or User.Role.STAFF).strip()
    department = (data.get('department') or '').strip()
    password = data.get('password') or ''
    force_password_change = bool(data.get('force_password_change', False))
    raw_additional_roles = data.get('additional_roles', [])

    if not username:
        return JsonResponse({'success': False, 'error': 'Username is required'}, status=400)
    if not email:
        return JsonResponse({'success': False, 'error': 'Email is required'}, status=400)
    valid_roles = {choice[0] for choice in User.Role.choices}
    if role not in valid_roles:
        return JsonResponse({'success': False, 'error': f'Role must be one of: {", ".join(sorted(valid_roles))}'}, status=400)
    if raw_additional_roles is None:
        raw_additional_roles = []
    if not isinstance(raw_additional_roles, list):
        return JsonResponse({'success': False, 'error': 'additional_roles must be a list'}, status=400)
    additional_roles = [str(item).strip() for item in raw_additional_roles if str(item).strip()]

    role_candidates = {role, *additional_roles}
    for role_key in role_candidates:
        limit = ROLE_LIMITS.get(role_key)
        if limit is None:
            continue
        current = active_user_count_for_role(role_key)
        if current >= limit:
            return JsonResponse({'success': False, 'error': f'Maximum {limit} active users are allowed for role {role_key}.'}, status=400)
    if not password or len(password) < 8:
        return JsonResponse({'success': False, 'error': 'Password must be at least 8 characters'}, status=400)
    if User.objects.filter(username=username).exists():
        return JsonResponse({'success': False, 'error': 'Username already exists'}, status=400)

    parts = [p for p in full_name.split(' ') if p]
    first_name = parts[0] if parts else ''
    last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''

    try:
        with transaction.atomic():
            user = User(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name,
                role=User.Role.STAFF,
                department=department,
                is_active=True,
                is_staff=False,
                is_archived=False,
                force_password_change=force_password_change,
            )
            user.set_password(password)
            user.save()
            sync_user_roles(
                user=user,
                primary_role=role,
                additional_roles=additional_roles,
                is_active=True,
                actor=request.user,
            )
    except DjangoValidationError as exc:
        message = exc.messages[0] if getattr(exc, "messages", None) else str(exc)
        return JsonResponse({'success': False, 'error': message}, status=400)

    _log_sensitive_user_action(
        request,
        user,
        f"Created user {username} ({role}).",
        action_type=AuditLog.ActionType.CREATE,
    )

    return JsonResponse({'success': True, 'user': _serialize_user(user)})


@login_required
@require_http_methods(["PATCH"])
def update_user_api(request, user_id):
    """Update an existing user (Admin only)."""
    has_manage = user_has_permission(request.user, "user:manage")
    has_update = user_has_permission(request.user, "user:update")
    has_assign_role = user_has_permission(request.user, "user:assign_role")
    has_deactivate = user_has_permission(request.user, "user:deactivate")
    has_reset_password = user_has_permission(request.user, "user:reset_password")

    if not (has_manage or has_update):
        return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=403)

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'User not found'}, status=404)

    try:
        data = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)

    def _to_bool(value):
        if isinstance(value, bool):
            return value
        if value is None:
            return False
        return str(value).strip().lower() in {"1", "true", "yes", "on"}

    if not has_manage:
        if ('role' in data or 'additional_roles' in data) and not has_assign_role:
            return JsonResponse({'success': False, 'error': 'Missing permission: user:assign_role'}, status=403)
        if ('is_active' in data or 'is_archived' in data or 'is_active_staff' in data) and not has_deactivate:
            return JsonResponse({'success': False, 'error': 'Missing permission: user:deactivate'}, status=403)
        if data.get('password') and not has_reset_password:
            return JsonResponse({'success': False, 'error': 'Missing permission: user:reset_password'}, status=403)
        if 'force_password_change' in data and not has_reset_password:
            return JsonResponse({'success': False, 'error': 'Missing permission: user:reset_password'}, status=403)

    target_role = (data.get('role') or user.role).strip()
    valid_roles = {choice[0] for choice in User.Role.choices}
    if target_role not in valid_roles:
        return JsonResponse({'success': False, 'error': f'Role must be one of: {", ".join(sorted(valid_roles))}'}, status=400)

    if 'additional_roles' in data:
        raw_additional_roles = data.get('additional_roles')
        if raw_additional_roles is None:
            raw_additional_roles = []
        if not isinstance(raw_additional_roles, list):
            return JsonResponse({'success': False, 'error': 'additional_roles must be a list'}, status=400)
        target_additional_roles = [str(item).strip() for item in raw_additional_roles if str(item).strip()]
    else:
        target_additional_roles = sorted(get_user_additional_role_keys(user))

    target_is_archived = _to_bool(data.get('is_archived')) if 'is_archived' in data else bool(getattr(user, "is_archived", False))
    target_is_active = _to_bool(data.get('is_active')) if 'is_active' in data else user.is_active
    target_is_active_staff = _to_bool(data.get('is_active_staff')) if 'is_active_staff' in data else bool(getattr(user, "is_active_staff", True))
    if target_is_archived:
        target_is_active = False

    password_changed = False
    target_force_password_change = bool(getattr(user, "force_password_change", False))
    if 'force_password_change' in data:
        target_force_password_change = _to_bool(data.get("force_password_change"))

    previous_role = user.role
    previous_additional_roles = sorted(get_user_additional_role_keys(user))
    previous_is_active = user.is_active
    previous_is_active_staff = bool(getattr(user, "is_active_staff", True))
    previous_is_archived = bool(getattr(user, "is_archived", False))
    previous_force_password_change = bool(getattr(user, "force_password_change", False))
    previous_email = user.email or ""
    previous_full_name = (user.get_full_name() or "").strip()
    previous_department = user.department or ""

    requested_password = data.get('password')
    try:
        with transaction.atomic():
            if 'email' in data:
                user.email = (data.get('email') or '').strip()
            if 'full_name' in data:
                full_name = (data.get('full_name') or '').strip()
                parts = [p for p in full_name.split(' ') if p]
                user.first_name = parts[0] if parts else ''
                user.last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''
            if 'department' in data:
                user.department = (data.get('department') or '').strip()

            if requested_password:
                password = str(requested_password)
                if len(password) < 8:
                    return JsonResponse({'success': False, 'error': 'Password must be at least 8 characters'}, status=400)
                user.set_password(password)
                password_changed = True
                if 'force_password_change' not in data:
                    target_force_password_change = True

            sync_user_roles(
                user=user,
                primary_role=target_role,
                additional_roles=target_additional_roles,
                is_active=target_is_active,
                actor=request.user,
            )

            user.is_archived = target_is_archived
            user.is_active_staff = target_is_active_staff
            user.force_password_change = target_force_password_change
            user.save(update_fields=["is_archived", "is_active_staff", "force_password_change", "updated_at"])
    except DjangoValidationError as exc:
        message = exc.messages[0] if getattr(exc, "messages", None) else str(exc)
        return JsonResponse({'success': False, 'error': message}, status=400)

    updated_full_name = (user.get_full_name() or "").strip()
    profile_changed = (
        previous_email != (user.email or "")
        or previous_full_name != updated_full_name
        or previous_department != (user.department or "")
    )

    updated_additional_roles = sorted(get_user_additional_role_keys(user))
    role_changed = previous_role != user.role
    additional_roles_changed = previous_additional_roles != updated_additional_roles
    active_changed = previous_is_active != user.is_active
    locked_changed = previous_is_active_staff != bool(getattr(user, "is_active_staff", True))
    archived_changed = previous_is_archived != bool(getattr(user, "is_archived", False))
    force_password_flag_changed = previous_force_password_change != bool(getattr(user, "force_password_change", False))

    if profile_changed:
        _log_sensitive_user_action(request, user, f"Updated profile details for user {user.username}.")

    if role_changed or additional_roles_changed:
        _log_sensitive_user_action(
            request,
            user,
            (
                f"Updated role assignment for user {user.username}: "
                f"primary={user.role}, additional={', '.join(updated_additional_roles) or 'none'}."
            ),
        )

    if active_changed:
        state_label = "Activated" if user.is_active else "Deactivated"
        _log_sensitive_user_action(request, user, f"{state_label} user {user.username}.")

    if locked_changed:
        state_label = "Unlocked" if bool(getattr(user, "is_active_staff", True)) else "Locked"
        _log_sensitive_user_action(request, user, f"{state_label} user {user.username}.")

    if archived_changed:
        state_label = "Archived" if bool(getattr(user, "is_archived", False)) else "Restored"
        _log_sensitive_user_action(request, user, f"{state_label} user {user.username}.")

    if password_changed:
        _log_sensitive_user_action(request, user, f"Reset password for user {user.username}.")

    if force_password_flag_changed and not password_changed:
        force_label = "enabled" if bool(getattr(user, "force_password_change", False)) else "cleared"
        _log_sensitive_user_action(request, user, f"{force_label.capitalize()} forced password change for user {user.username}.")

    if not any(
        [
            profile_changed,
            role_changed,
            additional_roles_changed,
            active_changed,
            locked_changed,
            archived_changed,
            password_changed,
            force_password_flag_changed,
        ]
    ):
        _log_sensitive_user_action(request, user, f"Updated user {user.username}.")

    return JsonResponse({'success': True, 'user': _serialize_user(user)})


@login_required
@require_http_methods(["POST"])
def reset_user_password_api(request, user_id):
    """Reset another user's password (admin permission only)."""
    has_manage = user_has_permission(request.user, "user:manage")
    has_reset_password = user_has_permission(request.user, "user:reset_password")
    if not (has_manage or has_reset_password):
        return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=403)

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'User not found'}, status=404)

    try:
        data = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)

    new_password = str(data.get("new_password") or "")
    if len(new_password) < 8:
        return JsonResponse({'success': False, 'error': 'Password must be at least 8 characters'}, status=400)

    force_password_change = data.get("force_password_change")
    if isinstance(force_password_change, bool):
        should_force_change = force_password_change
    elif force_password_change is None:
        should_force_change = True
    else:
        should_force_change = str(force_password_change).strip().lower() in {"1", "true", "yes", "on"}

    with transaction.atomic():
        user.set_password(new_password)
        user.force_password_change = should_force_change
        user.save(update_fields=["password", "force_password_change", "updated_at"])

    _log_sensitive_user_action(
        request,
        user,
        (
            f"Reset password for user {user.username}"
            f"{' and enabled forced password change' if should_force_change else ''}."
        ),
    )

    return JsonResponse({'success': True, 'user': _serialize_user(user)})


@login_required
@require_http_methods(["POST"])
def deactivate_user_api(request, user_id):
    """Deactivate a user account while preserving records and links."""
    has_manage = user_has_permission(request.user, "user:manage")
    has_deactivate = user_has_permission(request.user, "user:deactivate")
    if not (has_manage or has_deactivate):
        return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=403)

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'User not found'}, status=404)

    previous_is_active = user.is_active
    previous_is_archived = bool(getattr(user, "is_archived", False))
    additional_roles = sorted(get_user_additional_role_keys(user))

    try:
        with transaction.atomic():
            sync_user_roles(
                user=user,
                primary_role=user.role,
                additional_roles=additional_roles,
                is_active=False,
                actor=request.user,
            )
    except DjangoValidationError as exc:
        message = exc.messages[0] if getattr(exc, "messages", None) else str(exc)
        return JsonResponse({'success': False, 'error': message}, status=400)

    user.refresh_from_db()
    if previous_is_active != user.is_active:
        _log_sensitive_user_action(request, user, f"Deactivated user {user.username}.")

    if previous_is_archived != bool(getattr(user, "is_archived", False)):
        state_label = "Archived" if bool(getattr(user, "is_archived", False)) else "Restored"
        _log_sensitive_user_action(request, user, f"{state_label} user {user.username}.")

    return JsonResponse({'success': True, 'user': _serialize_user(user)})


@login_required
@require_http_methods(["POST"])
def reactivate_user_api(request, user_id):
    """Reactivate a user account and restore access."""
    has_manage = user_has_permission(request.user, "user:manage")
    has_deactivate = user_has_permission(request.user, "user:deactivate")
    if not (has_manage or has_deactivate):
        return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=403)

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'User not found'}, status=404)

    previous_is_active = user.is_active
    previous_is_archived = bool(getattr(user, "is_archived", False))
    additional_roles = sorted(get_user_additional_role_keys(user))

    removed_roles_due_to_capacity: list[str] = []

    try:
        with transaction.atomic():
            try:
                sync_user_roles(
                    user=user,
                    primary_role=user.role,
                    additional_roles=additional_roles,
                    is_active=True,
                    actor=request.user,
                )
            except DjangoValidationError as exc:
                # Keep strict role limits while allowing reactivation by dropping only blocked additional roles.
                primary_limit = ROLE_LIMITS.get(user.role)
                if primary_limit is not None:
                    primary_current = active_user_count_for_role(user.role, exclude_user_id=user.pk)
                    if primary_current >= primary_limit:
                        message = exc.messages[0] if getattr(exc, "messages", None) else str(exc)
                        raise DjangoValidationError(message)

                filtered_additional_roles: list[str] = []
                removed_roles_due_to_capacity = []
                for role_key in additional_roles:
                    limit = ROLE_LIMITS.get(role_key)
                    if limit is None:
                        filtered_additional_roles.append(role_key)
                        continue
                    current = active_user_count_for_role(role_key, exclude_user_id=user.pk)
                    if current >= limit:
                        removed_roles_due_to_capacity.append(role_key)
                    else:
                        filtered_additional_roles.append(role_key)

                if not removed_roles_due_to_capacity:
                    message = exc.messages[0] if getattr(exc, "messages", None) else str(exc)
                    raise DjangoValidationError(message)

                sync_user_roles(
                    user=user,
                    primary_role=user.role,
                    additional_roles=filtered_additional_roles,
                    is_active=True,
                    actor=request.user,
                )

            if bool(getattr(user, "is_archived", False)):
                user.is_archived = False
                user.save(update_fields=["is_archived", "updated_at"])
    except DjangoValidationError as exc:
        message = exc.messages[0] if getattr(exc, "messages", None) else str(exc)
        return JsonResponse({'success': False, 'error': message}, status=400)

    user.refresh_from_db()
    if previous_is_active != user.is_active:
        _log_sensitive_user_action(request, user, f"Activated user {user.username}.")

    if previous_is_archived and not bool(getattr(user, "is_archived", False)):
        _log_sensitive_user_action(request, user, f"Restored user {user.username}.")

    if removed_roles_due_to_capacity:
        _log_sensitive_user_action(
            request,
            user,
            (
                f"Removed additional role(s) from user {user.username} during reactivation due to role limits: "
                f"{', '.join(sorted(removed_roles_due_to_capacity))}."
            ),
        )

    response_payload = {'success': True, 'user': _serialize_user(user)}
    if removed_roles_due_to_capacity:
        response_payload['message'] = (
            "User reactivated. Additional roles removed due to role limits: "
            + ", ".join(sorted(removed_roles_due_to_capacity))
            + "."
        )
    return JsonResponse(response_payload)


@login_required
@require_http_methods(["GET"])
@require_permission("rbac:manage")
def get_rbac_overview_api(request):
    """Return roles, permissions, and current role-permission mappings."""
    roles = list(RoleDefinition.objects.order_by("key").values("key", "name", "description"))
    permissions = list(Permission.objects.order_by("module", "key").values("key", "name", "description", "module"))

    mapping: dict[str, list[str]] = {}
    for rp in RolePermission.objects.select_related("role", "permission").all():
        mapping.setdefault(rp.role.key, []).append(rp.permission.key)

    for role_key in mapping:
        mapping[role_key] = sorted(set(mapping[role_key]))

    return JsonResponse(
        {
            "success": True,
            "roles": roles,
            "permissions": permissions,
            "mapping": mapping,
            "policy_bound_permissions": POLICY_BOUND_PERMISSIONS,
        }
    )


@login_required
@require_http_methods(["PUT"])
@require_permission("rbac:manage")
def update_role_permissions_api(request, role_key: str):
    """Set the permission keys for a given role (replaces mapping)."""
    try:
        role = RoleDefinition.objects.get(key=role_key)
    except RoleDefinition.DoesNotExist:
        return JsonResponse({"success": False, "error": "Role not found"}, status=404)

    try:
        data = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "error": "Invalid JSON"}, status=400)

    desired = data.get("permission_keys") or []
    if not isinstance(desired, list):
        return JsonResponse({"success": False, "error": "permission_keys must be a list"}, status=400)

    desired_keys = {str(item).strip() for item in desired if str(item).strip()}
    policy_messages = _policy_violation_messages(role.key, desired_keys)
    if policy_messages:
        return JsonResponse({"success": False, "error": " ".join(policy_messages)}, status=400)

    existing_keys = set(
        RolePermission.objects.filter(role=role).select_related("permission").values_list("permission__key", flat=True)
    )

    for permission_key in sorted(CRITICAL_PERMISSION_KEYS):
        if permission_key in existing_keys and permission_key not in desired_keys:
            remaining_holders = _active_users_retaining_permission_after_role_update(
                role_key=role.key,
                permission_key=permission_key,
                desired_keys=desired_keys,
            )
            if remaining_holders == 0:
                return JsonResponse(
                    {
                        "success": False,
                        "error": f"Cannot remove {permission_key}; at least one active user must retain this permission.",
                    },
                    status=400,
                )

    to_add = desired_keys - existing_keys
    to_remove = existing_keys - desired_keys

    if to_remove:
        RolePermission.objects.filter(role=role, permission__key__in=to_remove).delete()

    if to_add:
        perms = {p.key: p for p in Permission.objects.filter(key__in=to_add)}
        missing = sorted(to_add - set(perms.keys()))
        if missing:
            return JsonResponse({"success": False, "error": f"Unknown permission keys: {', '.join(missing)}"}, status=400)
        for perm in perms.values():
            RolePermission.objects.get_or_create(role=role, permission=perm)

    AuditLog.objects.create(
        user=request.user,
        action_type=AuditLog.ActionType.UPDATE,
        content_type="RBAC",
        object_id=role.key,
        ip_address=get_client_ip(request),
        description=f"Updated permissions for role {role.key}.",
    )

    return JsonResponse({"success": True, "role_key": role.key, "permission_keys": sorted(desired_keys)})
