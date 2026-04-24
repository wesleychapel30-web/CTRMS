import logging
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import FileResponse
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response

logger = logging.getLogger(__name__)
from .models import Request, RequestDocument, RequestHistory
from core.models import AuditLog, User
from core.notification_center import NotificationPayload, get_recipients_for_roles, notify_users
from core.rbac import drf_any_permission_required, drf_permission_required, user_has_permission, user_has_role
from core.timeline import can_compose_timeline_entry, create_record_comment, create_request_timeline_entry
from .services import suggest_request_category
from .serializers import (
    RequestSerializer, RequestCreateUpdateSerializer,
    RequestApprovalSerializer, RequestReportSerializer,
    RequestDocumentSerializer
)


def _create_history_entry(*, request_obj: Request, action: str, performed_by, comment: str = "", from_status: str = "", to_status: str = ""):
    try:
        RequestHistory.objects.create(
            request=request_obj,
            action=action,
            performed_by=performed_by,
            comment=comment or "",
            from_status=from_status or "",
            to_status=to_status or "",
        )
    except Exception:
        logger.exception(
            "Failed to create history entry for request %s (action=%s, from=%s, to=%s)",
            getattr(request_obj, "request_id", "?"),
            action,
            from_status,
            to_status,
        )


def _notification_recipients_for_request(request_obj: Request, role_keys):
    recipients = list(get_recipients_for_roles(role_keys))
    if request_obj.created_by and request_obj.created_by.is_active:
        recipients.append(request_obj.created_by)
    return recipients


REQUEST_EDITABLE_STATUSES = {
    Request.Status.DRAFT,
    Request.Status.PENDING,
    Request.Status.UNDER_REVIEW,
    Request.Status.NEEDS_CLARIFICATION,
}

REQUEST_ALLOWED_TRANSITIONS = {
    Request.Status.DRAFT: {
        Request.Status.PENDING,
        Request.Status.CANCELLED,
        Request.Status.ARCHIVED,
    },
    Request.Status.PENDING: {
        Request.Status.UNDER_REVIEW,
        Request.Status.CANCELLED,
        Request.Status.ARCHIVED,
    },
    Request.Status.UNDER_REVIEW: {
        Request.Status.DIRECTOR_APPROVED,
        Request.Status.DIRECTOR_REJECTED,
        Request.Status.NEEDS_CLARIFICATION,
        # Legacy direct approval for backward compatibility
        Request.Status.APPROVED,
        Request.Status.REJECTED,
        Request.Status.CANCELLED,
        Request.Status.ARCHIVED,
    },
    Request.Status.NEEDS_CLARIFICATION: {
        Request.Status.UNDER_REVIEW,
        Request.Status.CANCELLED,
    },
    Request.Status.DIRECTOR_APPROVED: {
        Request.Status.FINANCE_PROCESSING,
        # Inventory route ends here
        Request.Status.APPROVED,
        Request.Status.CANCELLED,
    },
    Request.Status.DIRECTOR_REJECTED: {
        Request.Status.UNDER_REVIEW,
        Request.Status.ARCHIVED,
    },
    Request.Status.FINANCE_PROCESSING: {
        Request.Status.FINANCE_QUERY,
        Request.Status.PENDING_PAYMENT,
        Request.Status.CANCELLED,
    },
    Request.Status.FINANCE_QUERY: {
        Request.Status.FINANCE_PROCESSING,
        Request.Status.CANCELLED,
    },
    Request.Status.PENDING_PAYMENT: {
        Request.Status.PARTIALLY_PAID,
        Request.Status.PAID,
        Request.Status.CANCELLED,
    },
    Request.Status.APPROVED: {
        Request.Status.UNDER_REVIEW,
        Request.Status.PARTIALLY_PAID,
        Request.Status.PAID,
        Request.Status.FINANCE_PROCESSING,
        Request.Status.CANCELLED,
    },
    Request.Status.PARTIALLY_PAID: {
        Request.Status.PARTIALLY_PAID,
        Request.Status.PAID,
        Request.Status.CANCELLED,
    },
    Request.Status.REJECTED: {Request.Status.UNDER_REVIEW, Request.Status.ARCHIVED},
    Request.Status.CANCELLED: {Request.Status.PENDING, Request.Status.ARCHIVED},
    Request.Status.ARCHIVED: {Request.Status.PENDING},
}


def _validate_request_transition(current_status: str, target_status: str) -> str | None:
    if current_status == target_status:
        return None
    allowed_targets = REQUEST_ALLOWED_TRANSITIONS.get(current_status, set())
    if target_status in allowed_targets:
        return None
    rules_summary = "; ".join(
        f"{source} -> {', '.join(sorted(targets))}"
        for source, targets in REQUEST_ALLOWED_TRANSITIONS.items()
    )
    return (
        f"Invalid request status transition: {current_status} -> {target_status}. "
        f"Allowed transitions: {rules_summary}."
    )


def _parse_payment_date(raw_value):
    parsed = timezone.now()
    if raw_value:
        try:
            parsed = datetime.fromisoformat(str(raw_value).replace('Z', '+00:00'))
            if timezone.is_naive(parsed):
                parsed = timezone.make_aware(parsed)
        except ValueError:
            raise ValueError('Payment date must be a valid ISO-8601 datetime')
    return parsed


def _parse_decimal_amount(raw_value, *, field_name: str, allow_zero: bool = True):
    try:
        parsed = Decimal(str(raw_value))
    except (InvalidOperation, TypeError):
        raise ValueError(f"{field_name} must be a valid number")
    if parsed < 0:
        raise ValueError(f"{field_name} must be 0 or greater")
    if not allow_zero and parsed == 0:
        raise ValueError(f"{field_name} must be greater than 0")
    return parsed


class RequestViewSet(viewsets.ModelViewSet):
    """ViewSet for Request model"""
    
    queryset = Request.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        'status': ['exact'],
        'category': ['exact'],
        'created_at': ['gte', 'lte', 'date'],
    }
    search_fields = ['request_id', 'applicant_name', 'applicant_email']
    ordering_fields = ['created_at', 'amount_requested', 'status', 'applicant_name', 'request_id', 'category']
    ordering = ['-created_at']

    def get_permissions(self):
        extra = []
        if self.action in {"list", "retrieve"}:
            extra = [drf_any_permission_required(["request:view_all", "request:view_own", "payment:view", "payment:record"])]
        elif self.action == "create":
            extra = [drf_permission_required("request:create")]
        elif self.action == "submit_request":
            extra = [drf_permission_required("request:create")]
        elif self.action == "start_review":
            extra = [drf_any_permission_required(["request:update_all", "request:update_own", "request:approve"])]
        elif self.action in {"update", "partial_update"}:
            extra = [drf_any_permission_required(["request:update_all", "request:update_own"])]
        elif self.action == "approve_request":
            extra = [drf_permission_required("request:approve")]
        elif self.action == "reject_request":
            extra = [drf_permission_required("request:reject")]
        elif self.action == "mark_as_paid":
            extra = [drf_permission_required("payment:record")]
        elif self.action == "add_payment":
            extra = [drf_permission_required("payment:record")]
        elif self.action == "mark_payment_completed":
            extra = [drf_permission_required("payment:record")]
        elif self.action == "upload_document":
            extra = [drf_any_permission_required(["request:upload_all", "request:upload_own"])]
        elif self.action == "timeline_entries":
            extra = [drf_any_permission_required(["request:view_all", "request:view_own", "request:update_all", "request:update_own", "request:approve", "request:reject"])]
        elif self.action in {"finance_start_processing", "finance_raise_query", "finance_mark_pending_payment"}:
            extra = [drf_any_permission_required(["payment:record", "payment:view"])]
        elif self.action == "request_clarification":
            extra = [drf_permission_required("request:approve")]
        elif self.action == "cancel":
            extra = [drf_permission_required("request:cancel")]
        elif self.action == "restore":
            extra = [drf_permission_required("request:restore")]
        elif self.action == "reverse":
            extra = [drf_permission_required("request:reverse")]
        elif self.action == "report":
            extra = [drf_permission_required("report:view")]
        elif self.action == "suggest_category":
            extra = [drf_permission_required("request:create")]

        return [cls() for cls in (self.permission_classes + extra)]

    def get_queryset(self):
        qs = (
            Request.objects.all()
            .select_related("created_by", "reviewed_by")
        )
        user = getattr(self.request, "user", None)
        if not user or not user.is_authenticated:
            return qs.none()

        if (
            user_has_permission(user, "request:view_all")
            or user_has_permission(user, "request:update_all")
            or user_has_permission(user, "request:approve")
            or user_has_permission(user, "request:reject")
        ):
            return qs

        if user_has_permission(user, "payment:view") or user_has_permission(user, "payment:record"):
            return qs.filter(status__in=[
                Request.Status.DIRECTOR_APPROVED,
                Request.Status.FINANCE_PROCESSING,
                Request.Status.FINANCE_QUERY,
                Request.Status.PENDING_PAYMENT,
                Request.Status.APPROVED,
                Request.Status.PARTIALLY_PAID,
                Request.Status.PAID,
            ])

        return qs.filter(created_by=user)
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return RequestCreateUpdateSerializer
        elif self.action == 'approve_request':
            return RequestApprovalSerializer
        elif self.action == 'report':
            return RequestReportSerializer
        return RequestSerializer
    
    def create(self, request, *args, **kwargs):
        """Create a new request"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        # Return full serializer with created object
        request_obj = serializer.instance
        _create_history_entry(
            request_obj=request_obj,
            action=RequestHistory.Action.CREATED,
            performed_by=request.user,
            to_status=request_obj.status,
        )
        create_request_timeline_entry(
            request_obj=request_obj,
            entry_type="system_event",
            actor=request.user,
            title="Request created",
            new_status=request_obj.status,
        )

        if request_obj.status == Request.Status.DRAFT:
            if request_obj.created_by and request_obj.created_by.is_active:
                notify_users(
                    recipients=[request_obj.created_by],
                    payload=NotificationPayload(
                        kind="event",
                        title="Request submitted",
                        message=f"{request_obj.request_id} saved as draft.",
                        href=f"/requests/{request_obj.id}",
                    ),
                    created_by=request.user,
                )
        else:
            _create_history_entry(
                request_obj=request_obj,
                action=RequestHistory.Action.SUBMITTED,
                performed_by=request.user,
                from_status=Request.Status.DRAFT,
                to_status=request_obj.status,
            )
            create_request_timeline_entry(
                request_obj=request_obj,
                entry_type="status_change",
                actor=request.user,
                title="Request submitted",
                old_status=Request.Status.DRAFT,
                new_status=request_obj.status,
            )
            notify_users(
                recipients=get_recipients_for_roles([User.Role.DIRECTOR]),
                payload=NotificationPayload(
                    kind="event",
                    title="Pending approval",
                    message=f"{request_obj.request_id} submitted and awaiting approval.",
                    href=f"/requests/{request_obj.id}",
                ),
                created_by=request.user,
            )
            if request_obj.created_by and request_obj.created_by.is_active:
                notify_users(
                    recipients=[request_obj.created_by],
                    payload=NotificationPayload(
                        kind="event",
                        title="Request submitted",
                        message=f"{request_obj.request_id} submitted successfully.",
                        href=f"/requests/{request_obj.id}",
                    ),
                    created_by=request.user,
                )

        output_serializer = RequestSerializer(request_obj, context={"request": request})
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def _ensure_editable(self, request_obj: Request):
        if request_obj.status not in REQUEST_EDITABLE_STATUSES:
            return Response({"error": "This request is locked and can no longer be edited."}, status=status.HTTP_400_BAD_REQUEST)
        return None

    def update(self, request, *args, **kwargs):
        request_obj = self.get_object()
        blocked = self._ensure_editable(request_obj)
        if blocked:
            return blocked
        before_status = request_obj.status
        response = super().update(request, *args, **kwargs)
        try:
            _create_history_entry(
                request_obj=request_obj,
                action=RequestHistory.Action.UPDATED,
                performed_by=request.user,
                from_status=before_status,
                to_status=request_obj.status,
            )
        except Exception:
            pass
        return response

    def partial_update(self, request, *args, **kwargs):
        request_obj = self.get_object()
        blocked = self._ensure_editable(request_obj)
        if blocked:
            return blocked
        before_status = request_obj.status
        response = super().partial_update(request, *args, **kwargs)
        try:
            _create_history_entry(
                request_obj=request_obj,
                action=RequestHistory.Action.UPDATED,
                performed_by=request.user,
                from_status=before_status,
                to_status=request_obj.status,
            )
        except Exception:
            pass
        return response

    def destroy(self, request, *args, **kwargs):
        return Response({"error": "Requests cannot be deleted. Use cancel/archive instead."}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    @action(detail=True, methods=['post'])
    def submit_request(self, request, pk=None):
        """Submit a draft request into the review queue."""
        request_obj = self.get_object()
        transition_error = _validate_request_transition(request_obj.status, Request.Status.PENDING)
        if transition_error:
            return Response({'error': transition_error}, status=status.HTTP_400_BAD_REQUEST)

        before_status = request_obj.status
        request_obj.status = Request.Status.PENDING
        request_obj.save(update_fields=["status", "updated_at"])

        _create_history_entry(
            request_obj=request_obj,
            action=RequestHistory.Action.SUBMITTED,
            performed_by=request.user,
            from_status=before_status,
            to_status=Request.Status.PENDING,
        )
        create_request_timeline_entry(
            request_obj=request_obj,
            entry_type="status_change",
            actor=request.user,
            title="Request submitted",
            old_status=before_status,
            new_status=Request.Status.PENDING,
        )

        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.UPDATE,
            content_type="Request",
            object_id=str(request_obj.id),
            description=f"Submitted draft request {request_obj.request_id}.",
        )

        notify_users(
            recipients=get_recipients_for_roles([User.Role.DIRECTOR]),
            payload=NotificationPayload(
                kind="event",
                title="Pending approval",
                message=f"{request_obj.request_id} submitted and awaiting approval.",
                href=f"/requests/{request_obj.id}",
            ),
            created_by=request.user,
        )
        if request_obj.created_by and request_obj.created_by.is_active:
            notify_users(
                recipients=[request_obj.created_by],
                payload=NotificationPayload(
                    kind="event",
                    title="Request submitted",
                    message=f"{request_obj.request_id} submitted successfully.",
                    href=f"/requests/{request_obj.id}",
                ),
                created_by=request.user,
            )

        return Response(RequestSerializer(request_obj, context={"request": request}).data)

    @action(detail=True, methods=['post'])
    def start_review(self, request, pk=None):
        """Move a submitted request into Under Review."""
        request_obj = self.get_object()
        transition_error = _validate_request_transition(request_obj.status, Request.Status.UNDER_REVIEW)
        if transition_error:
            return Response({'error': transition_error}, status=status.HTTP_400_BAD_REQUEST)

        before_status = request_obj.status
        request_obj.status = Request.Status.UNDER_REVIEW
        request_obj.save(update_fields=["status", "updated_at"])

        _create_history_entry(
            request_obj=request_obj,
            action=RequestHistory.Action.MOVED_TO_REVIEW,
            performed_by=request.user,
            from_status=before_status,
            to_status=Request.Status.UNDER_REVIEW,
            comment=(request.data.get("comment") or "").strip(),
        )
        create_request_timeline_entry(
            request_obj=request_obj,
            entry_type="status_change",
            actor=request.user,
            title="Request moved to under review",
            body=(request.data.get("comment") or "").strip(),
            old_status=before_status,
            new_status=Request.Status.UNDER_REVIEW,
        )

        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.UPDATE,
            content_type="Request",
            object_id=str(request_obj.id),
            description=f"Moved request {request_obj.request_id} to under review.",
        )

        notify_users(
            recipients=get_recipients_for_roles([User.Role.DIRECTOR]),
            payload=NotificationPayload(
                kind="event",
                title="Pending approval",
                message=f"{request_obj.request_id} is now under review.",
                href=f"/requests/{request_obj.id}",
            ),
            created_by=request.user,
        )

        return Response(RequestSerializer(request_obj, context={"request": request}).data)
    
    @action(detail=True, methods=['post'])
    @transaction.atomic
    def approve_request(self, request, pk=None):
        """Director approves a request. Routes to Finance queue (normal_funded) or final approval (inventory)."""
        request_obj = self.get_object()
        if not user_has_role(request.user, User.Role.DIRECTOR):
            return Response({'error': 'Only Directors can approve requests.'}, status=status.HTTP_403_FORBIDDEN)

        # Determine target status by route
        is_inventory = request_obj.workflow_route == Request.WorkflowRoute.INVENTORY
        target_status = Request.Status.APPROVED if is_inventory else Request.Status.DIRECTOR_APPROVED

        transition_error = _validate_request_transition(request_obj.status, target_status)
        if transition_error:
            return Response({'error': transition_error}, status=status.HTTP_400_BAD_REQUEST)

        before_status = request_obj.status
        serializer = RequestApprovalSerializer(request_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(
            status=target_status,
            reviewed_by=request.user,
            reviewed_at=timezone.now(),
        )

        history_action = RequestHistory.Action.APPROVED if is_inventory else RequestHistory.Action.DIRECTOR_APPROVED
        title = "Request approved" if is_inventory else "Director approved — forwarded to Finance"
        _create_history_entry(
            request_obj=request_obj,
            action=history_action,
            performed_by=request.user,
            from_status=before_status,
            to_status=target_status,
            comment=(request.data.get("review_notes") or "").strip(),
        )
        create_request_timeline_entry(
            request_obj=request_obj,
            entry_type="approval_action",
            actor=request.user,
            title=title,
            body=(request.data.get("review_notes") or "").strip(),
            old_status=before_status,
            new_status=target_status,
        )
        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.APPROVE,
            content_type="Request",
            object_id=str(request_obj.id),
            description=f"Director approved request {request_obj.request_id}.",
        )

        # Notify Finance for funded requests; notify Admin for inventory
        notify_roles = [User.Role.ADMIN] if is_inventory else [User.Role.ADMIN, User.Role.FINANCE_OFFICER]
        notify_users(
            recipients=_notification_recipients_for_request(request_obj, notify_roles),
            payload=NotificationPayload(
                kind="event",
                title=title,
                message=f"{request_obj.request_id} approved by Director.",
                href=f"/requests/{request_obj.id}",
            ),
            created_by=request.user,
        )

        return Response(RequestSerializer(request_obj, context={"request": request}).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def reject_request(self, request, pk=None):
        """Director rejects a request."""
        request_obj = self.get_object()
        if not user_has_role(request.user, User.Role.DIRECTOR):
            return Response({'error': 'Only Directors can reject requests.'}, status=status.HTTP_403_FORBIDDEN)
        transition_error = _validate_request_transition(request_obj.status, Request.Status.DIRECTOR_REJECTED)
        if transition_error:
            return Response({'error': transition_error}, status=status.HTTP_400_BAD_REQUEST)

        before_status = request_obj.status
        request_obj.status = Request.Status.DIRECTOR_REJECTED
        request_obj.review_notes = request.data.get('review_notes', '')
        request_obj.reviewed_by = request.user
        request_obj.reviewed_at = timezone.now()
        request_obj.save()

        _create_history_entry(
            request_obj=request_obj,
            action=RequestHistory.Action.DIRECTOR_REJECTED,
            performed_by=request.user,
            from_status=before_status,
            to_status=Request.Status.DIRECTOR_REJECTED,
            comment=(request.data.get("review_notes") or "").strip(),
        )
        create_request_timeline_entry(
            request_obj=request_obj,
            entry_type="approval_action",
            actor=request.user,
            title="Director rejected",
            body=(request.data.get("review_notes") or "").strip(),
            old_status=before_status,
            new_status=Request.Status.DIRECTOR_REJECTED,
        )
        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.REJECT,
            content_type="Request",
            object_id=str(request_obj.id),
            description=f"Director rejected request {request_obj.request_id}.",
        )
        notify_users(
            recipients=_notification_recipients_for_request(request_obj, [User.Role.ADMIN]),
            payload=NotificationPayload(
                kind="event",
                title="Request rejected",
                message=f"{request_obj.request_id} rejected by Director.",
                href=f"/requests/{request_obj.id}",
            ),
            created_by=request.user,
        )
        return Response(RequestSerializer(request_obj, context={"request": request}).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def request_clarification(self, request, pk=None):
        """Director returns a request for clarification."""
        request_obj = self.get_object()
        if not user_has_role(request.user, User.Role.DIRECTOR):
            return Response({'error': 'Only Directors can request clarification.'}, status=status.HTTP_403_FORBIDDEN)
        transition_error = _validate_request_transition(request_obj.status, Request.Status.NEEDS_CLARIFICATION)
        if transition_error:
            return Response({'error': transition_error}, status=status.HTTP_400_BAD_REQUEST)

        before_status = request_obj.status
        request_obj.status = Request.Status.NEEDS_CLARIFICATION
        request_obj.review_notes = request.data.get('review_notes', '')
        request_obj.reviewed_by = request.user
        request_obj.reviewed_at = timezone.now()
        request_obj.save()

        _create_history_entry(
            request_obj=request_obj,
            action=RequestHistory.Action.CLARIFICATION_REQUESTED,
            performed_by=request.user,
            from_status=before_status,
            to_status=Request.Status.NEEDS_CLARIFICATION,
            comment=(request.data.get("review_notes") or "").strip(),
        )
        create_request_timeline_entry(
            request_obj=request_obj,
            entry_type="approval_action",
            actor=request.user,
            title="Clarification requested",
            body=(request.data.get("review_notes") or "").strip(),
            old_status=before_status,
            new_status=Request.Status.NEEDS_CLARIFICATION,
        )
        notify_users(
            recipients=_notification_recipients_for_request(request_obj, [User.Role.ADMIN]),
            payload=NotificationPayload(
                kind="alert",
                title="Clarification needed",
                message=f"{request_obj.request_id} has been returned for clarification.",
                href=f"/requests/{request_obj.id}",
            ),
            created_by=request.user,
        )
        return Response(RequestSerializer(request_obj, context={"request": request}).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def finance_start_processing(self, request, pk=None):
        """Finance officer starts processing a director-approved funded request."""
        request_obj = self.get_object()
        if not (user_has_role(request.user, User.Role.FINANCE_OFFICER) or user_has_permission(request.user, 'payment:record')):
            return Response({'error': 'Finance officers can process requests.'}, status=status.HTTP_403_FORBIDDEN)
        if request_obj.workflow_route == Request.WorkflowRoute.INVENTORY:
            return Response({'error': 'Inventory requests do not require finance processing.'}, status=status.HTTP_400_BAD_REQUEST)
        transition_error = _validate_request_transition(request_obj.status, Request.Status.FINANCE_PROCESSING)
        if transition_error:
            return Response({'error': transition_error}, status=status.HTTP_400_BAD_REQUEST)

        before_status = request_obj.status
        request_obj.status = Request.Status.FINANCE_PROCESSING
        request_obj.finance_processed_by = request.user
        request_obj.finance_notes = request.data.get('finance_notes', '')
        request_obj.finance_processed_at = timezone.now()
        request_obj.save()

        _create_history_entry(
            request_obj=request_obj,
            action=RequestHistory.Action.FINANCE_PROCESSING,
            performed_by=request.user,
            from_status=before_status,
            to_status=Request.Status.FINANCE_PROCESSING,
            comment=(request.data.get("finance_notes") or "").strip(),
        )
        create_request_timeline_entry(
            request_obj=request_obj,
            entry_type="approval_action",
            actor=request.user,
            title="Finance processing started",
            body=(request.data.get("finance_notes") or "").strip(),
            old_status=before_status,
            new_status=Request.Status.FINANCE_PROCESSING,
        )
        return Response(RequestSerializer(request_obj, context={"request": request}).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def finance_raise_query(self, request, pk=None):
        """Finance officer raises a query on a request being processed."""
        request_obj = self.get_object()
        if not (user_has_role(request.user, User.Role.FINANCE_OFFICER) or user_has_permission(request.user, 'payment:record')):
            return Response({'error': 'Finance officers can raise queries.'}, status=status.HTTP_403_FORBIDDEN)
        transition_error = _validate_request_transition(request_obj.status, Request.Status.FINANCE_QUERY)
        if transition_error:
            return Response({'error': transition_error}, status=status.HTTP_400_BAD_REQUEST)

        before_status = request_obj.status
        request_obj.status = Request.Status.FINANCE_QUERY
        request_obj.finance_notes = request.data.get('finance_notes', '')
        request_obj.save()

        _create_history_entry(
            request_obj=request_obj,
            action=RequestHistory.Action.FINANCE_QUERY,
            performed_by=request.user,
            from_status=before_status,
            to_status=Request.Status.FINANCE_QUERY,
            comment=(request.data.get("finance_notes") or "").strip(),
        )
        create_request_timeline_entry(
            request_obj=request_obj,
            entry_type="approval_action",
            actor=request.user,
            title="Finance query raised",
            body=(request.data.get("finance_notes") or "").strip(),
            old_status=before_status,
            new_status=Request.Status.FINANCE_QUERY,
        )
        notify_users(
            recipients=_notification_recipients_for_request(request_obj, [User.Role.ADMIN]),
            payload=NotificationPayload(
                kind="alert",
                title="Finance query",
                message=f"{request_obj.request_id} has a finance query requiring attention.",
                href=f"/requests/{request_obj.id}",
            ),
            created_by=request.user,
        )
        return Response(RequestSerializer(request_obj, context={"request": request}).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def finance_mark_pending_payment(self, request, pk=None):
        """Finance officer marks a processed request as pending payment disbursement."""
        request_obj = self.get_object()
        if not (user_has_role(request.user, User.Role.FINANCE_OFFICER) or user_has_permission(request.user, 'payment:record')):
            return Response({'error': 'Finance officers can advance payment status.'}, status=status.HTTP_403_FORBIDDEN)
        transition_error = _validate_request_transition(request_obj.status, Request.Status.PENDING_PAYMENT)
        if transition_error:
            return Response({'error': transition_error}, status=status.HTTP_400_BAD_REQUEST)

        before_status = request_obj.status
        approved_amount_raw = request.data.get('approved_amount')
        if approved_amount_raw is not None:
            try:
                request_obj.approved_amount = Decimal(str(approved_amount_raw))
            except InvalidOperation:
                return Response({'error': 'Invalid approved amount.'}, status=status.HTTP_400_BAD_REQUEST)
        request_obj.status = Request.Status.PENDING_PAYMENT
        request_obj.finance_notes = request.data.get('finance_notes', request_obj.finance_notes)
        request_obj.save()

        _create_history_entry(
            request_obj=request_obj,
            action=RequestHistory.Action.PENDING_PAYMENT,
            performed_by=request.user,
            from_status=before_status,
            to_status=Request.Status.PENDING_PAYMENT,
            comment=(request.data.get("finance_notes") or "").strip(),
        )
        create_request_timeline_entry(
            request_obj=request_obj,
            entry_type="approval_action",
            actor=request.user,
            title="Payment scheduled",
            body=(request.data.get("finance_notes") or "").strip(),
            old_status=before_status,
            new_status=Request.Status.PENDING_PAYMENT,
        )
        notify_users(
            recipients=_notification_recipients_for_request(request_obj, [User.Role.ADMIN]),
            payload=NotificationPayload(
                kind="event",
                title="Payment pending",
                message=f"{request_obj.request_id} is pending payment disbursement.",
                href=f"/requests/{request_obj.id}",
            ),
            created_by=request.user,
        )
        return Response(RequestSerializer(request_obj, context={"request": request}).data)
    
    @action(detail=True, methods=['post'])
    @transaction.atomic
    def mark_as_paid(self, request, pk=None):
        """Record first payment for an approved request."""
        request_obj = self.get_object()
        payment_allowed_statuses = {Request.Status.APPROVED, Request.Status.PENDING_PAYMENT}
        if request_obj.status not in payment_allowed_statuses:
            return Response(
                {'error': 'Can only record payment for approved or pending-payment requests'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            parsed_payment_date = _parse_payment_date(request.data.get('payment_date'))
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        approved_amount = Decimal(str(request_obj.approved_amount or 0))
        disbursed_amount_raw = request.data.get('disbursed_amount', None)
        if disbursed_amount_raw is None or disbursed_amount_raw == "":
            disbursed_amount = approved_amount
        else:
            try:
                disbursed_amount = _parse_decimal_amount(disbursed_amount_raw, field_name='Disbursed amount')
            except ValueError as exc:
                return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        target_status = (
            Request.Status.PARTIALLY_PAID
            if approved_amount > 0 and disbursed_amount < approved_amount
            else Request.Status.PAID
        )
        transition_error = _validate_request_transition(request_obj.status, target_status)
        if transition_error:
            return Response({'error': transition_error}, status=status.HTTP_400_BAD_REQUEST)

        before_status = request_obj.status
        request_obj.status = target_status
        request_obj.payment_date = parsed_payment_date
        request_obj.payment_method = request.data.get('payment_method', '')
        request_obj.payment_reference = request.data.get('payment_reference', '')
        request_obj.disbursed_amount = disbursed_amount
        request_obj.save()

        history_action = (
            RequestHistory.Action.PARTIALLY_PAID
            if target_status == Request.Status.PARTIALLY_PAID
            else RequestHistory.Action.PAID
        )
        _create_history_entry(
            request_obj=request_obj,
            action=history_action,
            performed_by=request.user,
            from_status=before_status,
            to_status=target_status,
            comment=(
                f"Payment recorded: amount={disbursed_amount}, method={request_obj.payment_method or 'N/A'}, "
                f"reference={request_obj.payment_reference or 'N/A'}."
            ),
        )
        create_request_timeline_entry(
            request_obj=request_obj,
            entry_type="payment_action",
            actor=request.user,
            title="Payment recorded",
            body=(
                f"Payment recorded: amount={disbursed_amount}, method={request_obj.payment_method or 'N/A'}, "
                f"reference={request_obj.payment_reference or 'N/A'}."
            ),
            old_status=before_status,
            new_status=target_status,
        )

        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.UPDATE,
            content_type="Request",
            object_id=str(request_obj.id),
            description=f"Recorded payment for request {request_obj.request_id} ({before_status} -> {target_status}).",
        )

        notify_users(
            recipients=_notification_recipients_for_request(request_obj, [User.Role.ADMIN]),
            payload=NotificationPayload(
                kind="event",
                title="Payment recorded",
                message=(
                    f"{request_obj.request_id} is partially paid."
                    if target_status == Request.Status.PARTIALLY_PAID
                    else f"{request_obj.request_id} is fully paid."
                ),
                href=f"/requests/{request_obj.id}",
            ),
            created_by=request.user,
        )

        return Response(RequestSerializer(request_obj, context={"request": request}).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def add_payment(self, request, pk=None):
        """Add payment for a partially paid request."""
        request_obj = self.get_object()
        if request_obj.status != Request.Status.PARTIALLY_PAID:
            return Response(
                {'error': 'Can only add payment to partially paid requests'},
                status=status.HTTP_400_BAD_REQUEST
            )

        payment_amount_raw = request.data.get('payment_amount', None)
        if payment_amount_raw in {None, ""}:
            return Response({'error': 'payment_amount is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payment_amount = _parse_decimal_amount(payment_amount_raw, field_name='Payment amount', allow_zero=False)
            parsed_payment_date = _parse_payment_date(request.data.get('payment_date'))
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        approved_amount = Decimal(str(request_obj.approved_amount or 0))
        current_disbursed = Decimal(str(request_obj.disbursed_amount or 0))
        next_disbursed = current_disbursed + payment_amount

        target_status = (
            Request.Status.PAID
            if approved_amount > 0 and next_disbursed >= approved_amount
            else Request.Status.PARTIALLY_PAID
        )
        transition_error = _validate_request_transition(request_obj.status, target_status)
        if transition_error:
            return Response({'error': transition_error}, status=status.HTTP_400_BAD_REQUEST)

        before_status = request_obj.status
        request_obj.status = target_status
        request_obj.payment_date = parsed_payment_date
        request_obj.payment_method = request.data.get('payment_method', request_obj.payment_method or '')
        request_obj.payment_reference = request.data.get('payment_reference', request_obj.payment_reference or '')
        request_obj.disbursed_amount = next_disbursed
        request_obj.save()

        history_action = (
            RequestHistory.Action.PAID
            if target_status == Request.Status.PAID
            else RequestHistory.Action.PARTIALLY_PAID
        )
        _create_history_entry(
            request_obj=request_obj,
            action=history_action,
            performed_by=request.user,
            from_status=before_status,
            to_status=target_status,
            comment=f"Added payment: amount={payment_amount}.",
        )
        create_request_timeline_entry(
            request_obj=request_obj,
            entry_type="payment_action",
            actor=request.user,
            title="Payment recorded",
            body=f"Added payment: amount={payment_amount}.",
            old_status=before_status,
            new_status=target_status,
        )

        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.UPDATE,
            content_type="Request",
            object_id=str(request_obj.id),
            description=f"Added payment for request {request_obj.request_id} ({before_status} -> {target_status}).",
        )

        notify_users(
            recipients=_notification_recipients_for_request(request_obj, [User.Role.ADMIN]),
            payload=NotificationPayload(
                kind="event",
                title="Payment recorded",
                message=(
                    f"{request_obj.request_id} is fully paid."
                    if target_status == Request.Status.PAID
                    else f"{request_obj.request_id} remains partially paid."
                ),
                href=f"/requests/{request_obj.id}",
            ),
            created_by=request.user,
        )

        return Response(RequestSerializer(request_obj, context={"request": request}).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def mark_payment_completed(self, request, pk=None):
        """Mark payment workflow as completed."""
        request_obj = self.get_object()
        if request_obj.status not in {Request.Status.APPROVED, Request.Status.PARTIALLY_PAID}:
            return Response(
                {'error': 'Can only complete payment for approved or partially paid requests'},
                status=status.HTTP_400_BAD_REQUEST
            )

        final_amount_raw = request.data.get('final_disbursed_amount', None)
        approved_amount = Decimal(str(request_obj.approved_amount or 0))
        try:
            parsed_payment_date = _parse_payment_date(request.data.get('payment_date'))
            if final_amount_raw in {None, ""}:
                final_disbursed = approved_amount if approved_amount > 0 else Decimal(str(request_obj.disbursed_amount or 0))
            else:
                final_disbursed = _parse_decimal_amount(final_amount_raw, field_name='Final disbursed amount')
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        transition_error = _validate_request_transition(request_obj.status, Request.Status.PAID)
        if transition_error:
            return Response({'error': transition_error}, status=status.HTTP_400_BAD_REQUEST)

        before_status = request_obj.status
        request_obj.status = Request.Status.PAID
        request_obj.payment_date = parsed_payment_date
        request_obj.payment_method = request.data.get('payment_method', request_obj.payment_method or '')
        request_obj.payment_reference = request.data.get('payment_reference', request_obj.payment_reference or '')
        request_obj.disbursed_amount = final_disbursed
        request_obj.save()

        _create_history_entry(
            request_obj=request_obj,
            action=RequestHistory.Action.PAID,
            performed_by=request.user,
            from_status=before_status,
            to_status=Request.Status.PAID,
            comment=f"Marked payment completed with disbursed amount {final_disbursed}.",
        )
        create_request_timeline_entry(
            request_obj=request_obj,
            entry_type="payment_action",
            actor=request.user,
            title="Payment completed",
            body=f"Marked payment completed with disbursed amount {final_disbursed}.",
            old_status=before_status,
            new_status=Request.Status.PAID,
        )

        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.UPDATE,
            content_type="Request",
            object_id=str(request_obj.id),
            description=f"Marked payment completed for request {request_obj.request_id}.",
        )

        notify_users(
            recipients=_notification_recipients_for_request(request_obj, [User.Role.ADMIN]),
            payload=NotificationPayload(
                kind="event",
                title="Payment recorded",
                message=f"{request_obj.request_id} is fully paid.",
                href=f"/requests/{request_obj.id}",
            ),
            created_by=request.user,
        )

        return Response(RequestSerializer(request_obj, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """Cancel a request (soft cancel; record remains)."""
        request_obj = self.get_object()
        if request_obj.status == Request.Status.CANCELLED:
            return Response(RequestSerializer(request_obj, context={"request": request}).data)
        transition_error = _validate_request_transition(request_obj.status, Request.Status.CANCELLED)
        if transition_error:
            return Response({'error': transition_error}, status=status.HTTP_400_BAD_REQUEST)

        before_status = request_obj.status
        request_obj.status = Request.Status.CANCELLED
        request_obj.save(update_fields=["status", "updated_at"])

        _create_history_entry(
            request_obj=request_obj,
            action=RequestHistory.Action.CANCELLED,
            performed_by=request.user,
            from_status=before_status,
            to_status=Request.Status.CANCELLED,
            comment=(request.data.get("comment") or "").strip(),
        )
        create_request_timeline_entry(
            request_obj=request_obj,
            entry_type="status_change",
            actor=request.user,
            title="Request cancelled",
            body=(request.data.get("comment") or "").strip(),
            old_status=before_status,
            new_status=Request.Status.CANCELLED,
            is_internal=True,
        )

        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.UPDATE,
            content_type="Request",
            object_id=str(request_obj.id),
            description=f"Cancelled request {request_obj.request_id}.",
        )

        notify_users(
            recipients=_notification_recipients_for_request(request_obj, [User.Role.ADMIN, User.Role.DIRECTOR]),
            payload=NotificationPayload(
                kind="audit",
                title="Request cancelled",
                message=f"{request_obj.request_id} was cancelled.",
                href=f"/requests/{request_obj.id}",
            ),
            created_by=request.user,
        )

        return Response(RequestSerializer(request_obj, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        """Restore a cancelled/archived request back to pending."""
        request_obj = self.get_object()
        transition_error = _validate_request_transition(request_obj.status, Request.Status.PENDING)
        if transition_error:
            return Response({'error': transition_error}, status=status.HTTP_400_BAD_REQUEST)

        before_status = request_obj.status
        request_obj.status = Request.Status.PENDING
        request_obj.save(update_fields=["status", "updated_at"])

        _create_history_entry(
            request_obj=request_obj,
            action=RequestHistory.Action.RESTORED,
            performed_by=request.user,
            from_status=before_status,
            to_status=Request.Status.PENDING,
            comment=(request.data.get("comment") or "").strip(),
        )
        create_request_timeline_entry(
            request_obj=request_obj,
            entry_type="status_change",
            actor=request.user,
            title="Request restored",
            body=(request.data.get("comment") or "").strip(),
            old_status=before_status,
            new_status=Request.Status.PENDING,
            is_internal=True,
        )

        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.UPDATE,
            content_type="Request",
            object_id=str(request_obj.id),
            description=f"Restored request {request_obj.request_id}.",
        )

        notify_users(
            recipients=_notification_recipients_for_request(request_obj, [User.Role.ADMIN, User.Role.DIRECTOR]),
            payload=NotificationPayload(
                kind="audit",
                title="Request restored",
                message=f"{request_obj.request_id} was restored to pending review.",
                href=f"/requests/{request_obj.id}",
            ),
            created_by=request.user,
        )

        return Response(RequestSerializer(request_obj, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def reverse(self, request, pk=None):
        """Reverse a decision back to under review (admin control)."""
        request_obj = self.get_object()
        transition_error = _validate_request_transition(request_obj.status, Request.Status.UNDER_REVIEW)
        if transition_error:
            return Response({'error': transition_error}, status=status.HTTP_400_BAD_REQUEST)

        if not (
            user_has_role(request.user, User.Role.DIRECTOR)
            or user_has_role(request.user, User.Role.ADMIN)
        ):
            return Response({'error': 'Only Directors or Administrators can revert decisions.'}, status=status.HTTP_403_FORBIDDEN)

        if user_has_role(request.user, User.Role.DIRECTOR) and not user_has_role(request.user, User.Role.ADMIN):
            if request_obj.reviewed_by_id and request_obj.reviewed_by_id != request.user.id:
                return Response({'error': 'Directors can only revert decisions they made.'}, status=status.HTTP_403_FORBIDDEN)

        before_status = request_obj.status
        reason = (request.data.get("comment") or "").strip()
        request_obj.status = Request.Status.UNDER_REVIEW
        request_obj.review_notes = ""
        request_obj.reviewed_by = None
        request_obj.reviewed_at = None
        request_obj.approved_amount = None
        request_obj.save()

        _create_history_entry(
            request_obj=request_obj,
            action=RequestHistory.Action.REVERSED,
            performed_by=request.user,
            from_status=before_status,
            to_status=Request.Status.UNDER_REVIEW,
            comment=reason,
        )
        create_request_timeline_entry(
            request_obj=request_obj,
            entry_type="revert_action",
            actor=request.user,
            title="Decision reverted",
            body=reason,
            old_status=before_status,
            new_status=Request.Status.UNDER_REVIEW,
        )

        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.UPDATE,
            content_type="Request",
            object_id=str(request_obj.id),
            description=(
                f"Reverted decision for request {request_obj.request_id} "
                f"({before_status} -> {Request.Status.UNDER_REVIEW})"
                + (f". Reason: {reason}" if reason else ".")
            ),
        )

        notify_users(
            recipients=_notification_recipients_for_request(request_obj, [User.Role.ADMIN, User.Role.DIRECTOR]),
            payload=NotificationPayload(
                kind="audit",
                title="Request reversed",
                message=f"{request_obj.request_id} was moved back to under review.",
                href=f"/requests/{request_obj.id}",
            ),
            created_by=request.user,
        )

        return Response(RequestSerializer(request_obj, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def timeline_entries(self, request, pk=None):
        """Add a persistent chatter entry for this request."""
        request_obj = self.get_object()
        if not can_compose_timeline_entry(request.user):
            return Response({'error': 'Only Directors or Administrators can add notes to the request history.'}, status=status.HTTP_403_FORBIDDEN)

        mode = (request.data.get("mode") or "comment").strip().lower()
        body = (request.data.get("body") or request.data.get("comment") or "").strip()
        if not body:
            return Response({'error': 'Comment body is required.'}, status=status.HTTP_400_BAD_REQUEST)

        is_internal = mode == "internal_note"
        entry = create_record_comment(
            request_obj=request_obj,
            actor=request.user,
            body=body,
            internal=is_internal,
        )
        if not entry:
            return Response({'error': 'Unable to create timeline entry.'}, status=status.HTTP_400_BAD_REQUEST)

        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.UPDATE,
            content_type="Request",
            object_id=str(request_obj.id),
            description=f"Added {'internal note' if is_internal else 'comment'} to request {request_obj.request_id}.",
        )

        return Response(RequestSerializer(request_obj, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"])
    def suggest_category(self, request):
        """Suggest a request category based on free text (deterministic keyword rules)."""
        text = (request.data.get("text") or "").strip()
        suggested = suggest_request_category(text)
        label = dict(Request.Category.choices).get(suggested, "Other")
        return Response({"category": suggested, "category_display": label})
    
    @action(detail=False, methods=['get'])
    def report(self, request):
        """Get request report/statistics"""
        queryset = self.filter_queryset(self.get_queryset())
        
        # Calculate statistics
        total_requests = queryset.count()
        draft_requests = queryset.filter(status=Request.Status.DRAFT).count()
        pending_requests = queryset.filter(status='pending').count()
        under_review_requests = queryset.filter(status='under_review').count()
        approved_requests = queryset.filter(status='approved').count()
        rejected_requests = queryset.filter(status='rejected').count()
        partially_paid_requests = queryset.filter(status=Request.Status.PARTIALLY_PAID).count()
        paid_requests = queryset.filter(status='paid').count()
        
        total_amount_requested = sum(r.amount_requested for r in queryset)
        total_approved = sum(
            r.approved_amount or 0
            for r in queryset.filter(status__in=[Request.Status.APPROVED, Request.Status.PARTIALLY_PAID, Request.Status.PAID])
        )
        total_disbursed = sum(
            r.disbursed_amount
            for r in queryset.filter(status__in=[Request.Status.PARTIALLY_PAID, Request.Status.PAID])
        )
        
        # Group by category
        category_stats = {}
        category_breakdown = []
        for category in Request.Category.choices:
            cat_requests = queryset.filter(category=category[0])
            category_label = str(category[1])
            category_breakdown.append({'label': category_label, 'value': cat_requests.count()})
            category_stats[category_label] = {
                'count': cat_requests.count(),
                'total_amount': sum(r.amount_requested for r in cat_requests),
            }

        # Monthly trend (last 7 months)
        now = timezone.now()
        monthly_trend = []
        for offset in range(6, -1, -1):
            month_date = now - timedelta(days=30 * offset)
            monthly_trend.append({
                'label': month_date.strftime('%b'),
                'value': queryset.filter(
                    created_at__year=month_date.year,
                    created_at__month=month_date.month,
                ).count(),
            })

        # Approval rate by category (approved+partially paid+paid as approved)
        approval_rate = []
        for category, label in Request.Category.choices:
            total_in_category = queryset.filter(category=category).count()
            approved_in_category = queryset.filter(
                category=category,
                status__in=[Request.Status.APPROVED, Request.Status.PARTIALLY_PAID, Request.Status.PAID],
            ).count()
            value = round((approved_in_category / total_in_category) * 100, 1) if total_in_category else 0
            approval_rate.append({'label': str(label), 'value': value})
        
        return Response({
            'total_requests': total_requests,
            'draft_requests': draft_requests,
            'approved_requests': approved_requests,
            'pending_requests': pending_requests,
            'under_review_requests': under_review_requests,
            'rejected_requests': rejected_requests,
            'partially_paid_requests': partially_paid_requests,
            'paid_requests': paid_requests,
            'total_amount_requested': float(total_amount_requested),
            'total_approved': float(total_approved),
            'total_disbursed': float(total_disbursed),
            'category_stats': category_stats,
            'charts': {
                'category_breakdown': category_breakdown,
                'monthly_trend': monthly_trend,
                'approval_rate': approval_rate,
            }
        })
    
    @action(detail=True, methods=['post'])
    def upload_document(self, request, pk=None):
        """Upload a document for a request"""
        request_obj = self.get_object()
        if request_obj.status in {Request.Status.CANCELLED, Request.Status.ARCHIVED}:
            return Response(
                {'error': 'Cannot upload documents for cancelled or archived requests.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        document = request.FILES.get('document')
        document_type = request.data.get('document_type', 'Supporting Document')
        
        if not document:
            return Response(
                {'error': 'Document file is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        doc = RequestDocument(
            request=request_obj,
            document=document,
            document_type=document_type,
            uploaded_by=request.user
        )
        try:
            doc.save()
        except ValidationError as exc:
            return Response({'error': exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        
        _create_history_entry(
            request_obj=request_obj,
            action=RequestHistory.Action.DOCUMENT_UPLOADED,
            performed_by=request.user,
            comment=f"Uploaded document: {document_type}",
            from_status=request_obj.status,
            to_status=request_obj.status,
        )
        create_request_timeline_entry(
            request_obj=request_obj,
            entry_type="system_event",
            actor=request.user,
            title="Document uploaded",
            body=f"Uploaded document: {document_type}",
            old_status=request_obj.status,
            new_status=request_obj.status,
        )

        return Response(RequestDocumentSerializer(doc, context={"request": request}).data, status=status.HTTP_201_CREATED)


class RequestDocumentViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for RequestDocument model"""
    
    queryset = RequestDocument.objects.all()
    serializer_class = RequestDocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['request', 'document_type']

    def get_permissions(self):
        extra = [drf_any_permission_required(["document:view_all", "document:view_own", "request:view_all", "request:view_own"])]
        return [cls() for cls in (self.permission_classes + extra)]

    def get_queryset(self):
        qs = RequestDocument.objects.select_related("request", "request__created_by").all()
        user = getattr(self.request, "user", None)
        if not user or not user.is_authenticated:
            return qs.none()
        if user_has_permission(user, "document:view_all") or user_has_permission(user, "request:view_all"):
            return qs
        return qs.filter(request__created_by=user)
    
    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download a document"""
        document = self.get_object()
        try:
            file = document.document.open('rb')
        except FileNotFoundError:
            return Response(
                {'error': 'Document file is missing from storage.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        filename = (document.document.name or '').split('/')[-1]
        inline = request.query_params.get('disposition') == 'inline'
        response = FileResponse(
            file,
            as_attachment=not inline,
            filename=filename,
        )

        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.DOWNLOAD,
            content_type="RequestDocument",
            object_id=str(document.id),
            description=f"Downloaded a document for request {document.request.request_id}.",
        )
        return response
