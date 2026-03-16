from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.core.exceptions import ValidationError
from django.utils import timezone
from datetime import timedelta
from django_filters.rest_framework import DjangoFilterBackend
from django_filters import rest_framework as drf_filters
from invitations.services import send_due_invitation_reminders
from core.models import AuditLog, User
from core.notification_center import NotificationPayload, get_recipients_for_roles, notify_users
from core.notifications import EmailNotificationService
from core.rbac import (
    drf_any_permission_required,
    drf_permission_required,
    user_has_any_permission,
    user_has_permission,
    user_has_role,
)
from .models import Invitation, InvitationAttachment
from .serializers import (
    InvitationSerializer, InvitationCreateUpdateSerializer,
    InvitationStatusUpdateSerializer, InvitationCalendarSerializer, InvitationAttachmentSerializer
)


def _get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0]
    return request.META.get('REMOTE_ADDR')


INVITATION_ALLOWED_TRANSITIONS = {
    Invitation.Status.PENDING_REVIEW: {
        Invitation.Status.ACCEPTED,
        Invitation.Status.DECLINED,
        Invitation.Status.CANCELLED,
    },
    Invitation.Status.ACCEPTED: {
        Invitation.Status.CONFIRMED_ATTENDANCE,
        Invitation.Status.PENDING_REVIEW,
        Invitation.Status.CANCELLED,
    },
    Invitation.Status.CONFIRMED_ATTENDANCE: {
        Invitation.Status.ACCEPTED,
        Invitation.Status.COMPLETED,
        Invitation.Status.CANCELLED,
    },
    Invitation.Status.DECLINED: {
        Invitation.Status.PENDING_REVIEW,
        Invitation.Status.ARCHIVED,
    },
    Invitation.Status.COMPLETED: {
        Invitation.Status.ARCHIVED,
    },
    Invitation.Status.CANCELLED: {
        Invitation.Status.ARCHIVED,
    },
}

INVITATION_TRANSITION_PERMISSIONS = {
    (Invitation.Status.PENDING_REVIEW, Invitation.Status.ACCEPTED): "invitation:accept",
    (Invitation.Status.PENDING_REVIEW, Invitation.Status.DECLINED): "invitation:decline",
    (Invitation.Status.ACCEPTED, Invitation.Status.CONFIRMED_ATTENDANCE): "invitation:confirm",
    (Invitation.Status.CONFIRMED_ATTENDANCE, Invitation.Status.COMPLETED): "invitation:complete",
    (Invitation.Status.ACCEPTED, Invitation.Status.PENDING_REVIEW): "invitation:revert",
    (Invitation.Status.DECLINED, Invitation.Status.PENDING_REVIEW): "invitation:revert",
    (Invitation.Status.CONFIRMED_ATTENDANCE, Invitation.Status.ACCEPTED): "invitation:revert",
}


def _required_invitation_permission(current_status: str, target_status: str) -> str | None:
    return INVITATION_TRANSITION_PERMISSIONS.get((current_status, target_status))


def _validate_invitation_transition(current_status: str, target_status: str) -> str | None:
    if current_status == target_status:
        return None
    allowed_targets = INVITATION_ALLOWED_TRANSITIONS.get(current_status, set())
    if target_status in allowed_targets:
        return None
    rules_summary = "; ".join(
        f"{source} -> {', '.join(sorted(targets))}"
        for source, targets in INVITATION_ALLOWED_TRANSITIONS.items()
    )
    return (
        f"Invalid invitation status transition: {current_status} -> {target_status}. "
        f"Allowed transitions: {rules_summary}."
    )


class InvitationFilter(drf_filters.FilterSet):
    """Filter for Invitation model"""
    
    event_date_from = drf_filters.DateTimeFilter(
        field_name='event_date',
        lookup_expr='gte',
        label='Event Date From'
    )
    event_date_to = drf_filters.DateTimeFilter(
        field_name='event_date',
        lookup_expr='lte',
        label='Event Date To'
    )
    is_upcoming = drf_filters.BooleanFilter(method='filter_is_upcoming')
    
    class Meta:
        model = Invitation
        fields = ['status', 'created_at']
    
    def filter_is_upcoming(self, queryset, name, value):
        """Filter upcoming events (within 7 days)"""
        if value:
            now = timezone.now()
            seven_days_later = now + timedelta(days=7)
            return queryset.filter(event_date__range=[now, seven_days_later])
        return queryset


class InvitationViewSet(viewsets.ModelViewSet):
    """ViewSet for Invitation model"""
    
    queryset = Invitation.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = InvitationFilter
    search_fields = ['event_title', 'inviting_organization', 'contact_person']
    ordering_fields = ['event_date', 'created_at', 'status', 'event_title', 'inviting_organization']
    ordering = ['event_date']

    def get_permissions(self):
        extra = []
        if self.action in {"list", "retrieve", "calendar", "upcoming"}:
            extra = [drf_any_permission_required(["invitation:view_all", "invitation:view_own"])]
        elif self.action == "create":
            extra = [drf_permission_required("invitation:create")]
        elif self.action in {"update", "partial_update"}:
            extra = [drf_any_permission_required(["invitation:update_all", "invitation:update_own"])]
        elif self.action == "update_status":
            extra = [drf_any_permission_required(["invitation:accept", "invitation:decline", "invitation:confirm", "invitation:complete", "invitation:revert"])]
        elif self.action == "accept_invitation":
            extra = [drf_permission_required("invitation:accept")]
        elif self.action == "decline_invitation":
            extra = [drf_permission_required("invitation:decline")]
        elif self.action == "confirm_attendance":
            extra = [drf_permission_required("invitation:confirm")]
        elif self.action == "revert_decision":
            extra = [drf_permission_required("invitation:revert")]
        elif self.action == "mark_completed":
            extra = [drf_permission_required("invitation:complete")]
        elif self.action == "upload_attachment":
            extra = [drf_any_permission_required(["invitation:upload_all", "invitation:upload_own"])]
        elif self.action == "send_reminders":
            extra = [drf_permission_required("reminder:send")]

        return [cls() for cls in (self.permission_classes + extra)]

    def get_queryset(self):
        qs = Invitation.objects.all().select_related("created_by", "reviewed_by")
        user = getattr(self.request, "user", None)
        if not user or not user.is_authenticated:
            return qs.none()

        if (
            user_has_permission(user, "invitation:view_all")
            or user_has_permission(user, "invitation:update_all")
            or user_has_permission(user, "invitation:accept")
            or user_has_permission(user, "invitation:decline")
            or user_has_permission(user, "invitation:confirm")
            or user_has_permission(user, "invitation:complete")
            or user_has_permission(user, "invitation:revert")
        ):
            return qs
        return qs.filter(created_by=user)
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return InvitationCreateUpdateSerializer
        elif self.action == 'update_status':
            return InvitationStatusUpdateSerializer
        elif self.action == 'calendar':
            return InvitationCalendarSerializer
        return InvitationSerializer
    
    def create(self, request, *args, **kwargs):
        """Create a new invitation"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        invitation = serializer.instance

        notify_users(
            recipients=get_recipients_for_roles([User.Role.DIRECTOR]),
            payload=NotificationPayload(
                kind="event",
                title="Pending approval",
                message=f"Invitation “{invitation.event_title}” awaits Director response.",
                href=f"/invitations/{invitation.id}",
            ),
            created_by=request.user,
        )

        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.CREATE,
            content_type="Invitation",
            object_id=str(invitation.id),
            ip_address=_get_client_ip(request),
            description=f"Created invitation “{invitation.event_title}”.",
        )

        EmailNotificationService.send_event_invitation(
            invitation_obj=invitation,
            recipient_email=invitation.contact_email,
        )

        output_serializer = InvitationSerializer(invitation, context={"request": request})
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        return Response({"error": "Invitations cannot be deleted."}, status=status.HTTP_405_METHOD_NOT_ALLOWED)
    
    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        """Update invitation status (Director only)"""
        invitation = self.get_object()
        if not user_has_role(request.user, User.Role.DIRECTOR):
            return Response({'error': 'Only Directors can update invitation status.'}, status=status.HTTP_403_FORBIDDEN)
        before_status = invitation.status
        requested_status = request.data.get('status')
        if requested_status:
            transition_error = _validate_invitation_transition(before_status, requested_status)
            if transition_error:
                return Response({'error': transition_error}, status=status.HTTP_400_BAD_REQUEST)
            required_permission = _required_invitation_permission(before_status, requested_status)
            if required_permission and not user_has_permission(request.user, required_permission):
                return Response({'error': f'Missing permission: {required_permission}'}, status=status.HTTP_403_FORBIDDEN)
        serializer = InvitationStatusUpdateSerializer(invitation, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(reviewed_by=request.user, reviewed_at=timezone.now())

        recipients = list(get_recipients_for_roles([User.Role.ADMIN]))
        if invitation.created_by and invitation.created_by.is_active:
            recipients.append(invitation.created_by)
        notify_users(
            recipients=recipients,
            payload=NotificationPayload(
                kind="event",
                title="Invitation response",
                message=f"“{invitation.event_title}” is now {invitation.get_status_display()}.",
                href=f"/invitations/{invitation.id}",
            ),
            created_by=request.user,
        )
        
        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.UPDATE,
            content_type="Invitation",
            object_id=str(invitation.id),
            ip_address=_get_client_ip(request),
            description=f"Updated invitation status for “{invitation.event_title}” ({before_status} -> {invitation.status}).",
        )

        EmailNotificationService.send_invitation_status_alert(
            invitation_obj=invitation,
            recipient_email=invitation.contact_email,
            status_label=invitation.get_status_display(),
            notes=invitation.review_notes,
        )

        return Response(InvitationSerializer(invitation, context={"request": request}).data)
    
    @action(detail=True, methods=['post'])
    def accept_invitation(self, request, pk=None):
        """Accept an invitation (Director only)"""
        invitation = self.get_object()
        if not user_has_role(request.user, User.Role.DIRECTOR):
            return Response({'error': 'Only Directors can accept invitations.'}, status=status.HTTP_403_FORBIDDEN)
        transition_error = _validate_invitation_transition(invitation.status, Invitation.Status.ACCEPTED)
        if transition_error:
            return Response({'error': transition_error}, status=status.HTTP_400_BAD_REQUEST)

        invitation.status = Invitation.Status.ACCEPTED
        invitation.reviewed_by = request.user
        invitation.reviewed_at = timezone.now()
        invitation.review_notes = request.data.get('notes', '')
        invitation.save()

        recipients = list(get_recipients_for_roles([User.Role.ADMIN]))
        if invitation.created_by and invitation.created_by.is_active:
            recipients.append(invitation.created_by)
        notify_users(
            recipients=recipients,
            payload=NotificationPayload(
                kind="event",
                title="Invitation response",
                message=f"“{invitation.event_title}” was accepted.",
                href=f"/invitations/{invitation.id}",
            ),
            created_by=request.user,
        )
        
        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.UPDATE,
            content_type="Invitation",
            object_id=str(invitation.id),
            ip_address=_get_client_ip(request),
            description=f"Accepted invitation “{invitation.event_title}”.",
        )

        EmailNotificationService.send_invitation_status_alert(
            invitation_obj=invitation,
            recipient_email=invitation.contact_email,
            status_label=invitation.get_status_display(),
            notes=invitation.review_notes,
        )
        return Response(InvitationSerializer(invitation, context={"request": request}).data)
    
    @action(detail=True, methods=['post'])
    def decline_invitation(self, request, pk=None):
        """Decline an invitation (Director only)"""
        invitation = self.get_object()
        if not user_has_role(request.user, User.Role.DIRECTOR):
            return Response({'error': 'Only Directors can decline invitations.'}, status=status.HTTP_403_FORBIDDEN)
        transition_error = _validate_invitation_transition(invitation.status, Invitation.Status.DECLINED)
        if transition_error:
            return Response({'error': transition_error}, status=status.HTTP_400_BAD_REQUEST)

        invitation.status = Invitation.Status.DECLINED
        invitation.reviewed_by = request.user
        invitation.reviewed_at = timezone.now()
        invitation.review_notes = request.data.get('reason', '')
        invitation.save()

        recipients = list(get_recipients_for_roles([User.Role.ADMIN]))
        if invitation.created_by and invitation.created_by.is_active:
            recipients.append(invitation.created_by)
        notify_users(
            recipients=recipients,
            payload=NotificationPayload(
                kind="event",
                title="Invitation response",
                message=f"“{invitation.event_title}” was declined.",
                href=f"/invitations/{invitation.id}",
            ),
            created_by=request.user,
        )
        
        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.UPDATE,
            content_type="Invitation",
            object_id=str(invitation.id),
            ip_address=_get_client_ip(request),
            description=f"Declined invitation “{invitation.event_title}”.",
        )

        EmailNotificationService.send_invitation_status_alert(
            invitation_obj=invitation,
            recipient_email=invitation.contact_email,
            status_label=invitation.get_status_display(),
            notes=invitation.review_notes,
        )
        return Response(InvitationSerializer(invitation, context={"request": request}).data)
    
    @action(detail=True, methods=['post'])
    def confirm_attendance(self, request, pk=None):
        """Confirm attendance for an invitation"""
        invitation = self.get_object()
        if not user_has_role(request.user, User.Role.DIRECTOR):
            return Response({'error': 'Only Directors can confirm attendance.'}, status=status.HTTP_403_FORBIDDEN)
        transition_error = _validate_invitation_transition(invitation.status, Invitation.Status.CONFIRMED_ATTENDANCE)
        if transition_error:
            return Response({'error': transition_error}, status=status.HTTP_400_BAD_REQUEST)

        invitation.status = Invitation.Status.CONFIRMED_ATTENDANCE
        invitation.reviewed_by = request.user
        invitation.reviewed_at = timezone.now()
        invitation.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'updated_at'])

        recipients = list(get_recipients_for_roles([User.Role.ADMIN]))
        if invitation.created_by and invitation.created_by.is_active:
            recipients.append(invitation.created_by)
        notify_users(
            recipients=recipients,
            payload=NotificationPayload(
                kind="event",
                title="Invitation response",
                message=f"Attendance confirmed for “{invitation.event_title}”.",
                href=f"/invitations/{invitation.id}",
            ),
            created_by=request.user,
        )
        
        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.UPDATE,
            content_type="Invitation",
            object_id=str(invitation.id),
            ip_address=_get_client_ip(request),
            description=f"Confirmed attendance for “{invitation.event_title}”.",
        )

        EmailNotificationService.send_invitation_status_alert(
            invitation_obj=invitation,
            recipient_email=invitation.contact_email,
            status_label=invitation.get_status_display(),
            notes='Attendance confirmed.',
        )
        return Response(InvitationSerializer(invitation, context={"request": request}).data)

    @action(detail=True, methods=['post'])
    def revert_decision(self, request, pk=None):
        """Revert invitation decision based on current status."""
        invitation = self.get_object()

        if not (
            user_has_role(request.user, User.Role.DIRECTOR)
            or user_has_role(request.user, User.Role.ADMIN)
        ):
            return Response({'error': 'Only Directors or Administrators can revert invitation decisions.'}, status=status.HTTP_403_FORBIDDEN)

        if not user_has_permission(request.user, "invitation:revert"):
            return Response({'error': 'Missing permission: invitation:revert'}, status=status.HTTP_403_FORBIDDEN)

        revert_targets = {
            Invitation.Status.ACCEPTED: Invitation.Status.PENDING_REVIEW,
            Invitation.Status.DECLINED: Invitation.Status.PENDING_REVIEW,
            Invitation.Status.CONFIRMED_ATTENDANCE: Invitation.Status.ACCEPTED,
        }
        target_status = revert_targets.get(invitation.status)
        if not target_status:
            return Response(
                {'error': 'Revert decision is only available for Accepted, Declined, or Confirmed Attendance invitations.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user_has_role(request.user, User.Role.DIRECTOR) and not user_has_role(request.user, User.Role.ADMIN):
            if invitation.reviewed_by_id and invitation.reviewed_by_id != request.user.id:
                return Response({'error': 'Directors can only revert decisions they made.'}, status=status.HTTP_403_FORBIDDEN)

        transition_error = _validate_invitation_transition(invitation.status, target_status)
        if transition_error:
            return Response({'error': transition_error}, status=status.HTTP_400_BAD_REQUEST)

        before_status = invitation.status
        reason = (request.data.get("reason") or request.data.get("comment") or "").strip()

        invitation.status = target_status
        invitation.reviewed_by = request.user
        invitation.reviewed_at = timezone.now()
        invitation.review_notes = reason
        invitation.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'review_notes', 'updated_at'])

        recipients = list(get_recipients_for_roles([User.Role.ADMIN, User.Role.DIRECTOR]))
        if invitation.created_by and invitation.created_by.is_active:
            recipients.append(invitation.created_by)
        notify_users(
            recipients=recipients,
            payload=NotificationPayload(
                kind="event",
                title="Invitation response",
                message=f"Decision reverted for “{invitation.event_title}” ({before_status} -> {invitation.status}).",
                href=f"/invitations/{invitation.id}",
            ),
            created_by=request.user,
        )

        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.UPDATE,
            content_type="Invitation",
            object_id=str(invitation.id),
            ip_address=_get_client_ip(request),
            description=(
                f"Reverted invitation decision for “{invitation.event_title}” "
                f"({before_status} -> {invitation.status})"
                + (f". Reason: {reason}" if reason else ".")
            ),
        )

        EmailNotificationService.send_invitation_status_alert(
            invitation_obj=invitation,
            recipient_email=invitation.contact_email,
            status_label=invitation.get_status_display(),
            notes=reason or "Decision reverted.",
        )

        return Response(InvitationSerializer(invitation, context={"request": request}).data)
    
    @action(detail=True, methods=['post'])
    def mark_completed(self, request, pk=None):
        """Mark invitation as completed"""
        invitation = self.get_object()
        if not user_has_role(request.user, User.Role.DIRECTOR):
            return Response({'error': 'Only Directors can mark invitations as completed.'}, status=status.HTTP_403_FORBIDDEN)
        transition_error = _validate_invitation_transition(invitation.status, Invitation.Status.COMPLETED)
        if transition_error:
            return Response({'error': transition_error}, status=status.HTTP_400_BAD_REQUEST)

        invitation.status = Invitation.Status.COMPLETED
        invitation.reviewed_by = request.user
        invitation.reviewed_at = timezone.now()
        invitation.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'updated_at'])

        recipients = list(get_recipients_for_roles([User.Role.ADMIN]))
        if invitation.created_by and invitation.created_by.is_active:
            recipients.append(invitation.created_by)
        notify_users(
            recipients=recipients,
            payload=NotificationPayload(
                kind="event",
                title="Invitation response",
                message=f"“{invitation.event_title}” marked completed.",
                href=f"/invitations/{invitation.id}",
            ),
            created_by=request.user,
        )
        
        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.UPDATE,
            content_type="Invitation",
            object_id=str(invitation.id),
            ip_address=_get_client_ip(request),
            description=f"Marked invitation “{invitation.event_title}” as completed.",
        )

        EmailNotificationService.send_invitation_status_alert(
            invitation_obj=invitation,
            recipient_email=invitation.contact_email,
            status_label=invitation.get_status_display(),
            notes='Event marked completed.',
        )
        return Response(InvitationSerializer(invitation, context={"request": request}).data)

    @action(detail=True, methods=['post'])
    def upload_attachment(self, request, pk=None):
        invitation = self.get_object()
        attachment = request.FILES.get('file')
        attachment_type = request.data.get('attachment_type', 'Supporting Document')

        if not attachment:
            return Response({'error': 'Attachment file is required'}, status=status.HTTP_400_BAD_REQUEST)

        invitation_attachment = InvitationAttachment(
            invitation=invitation,
            file=attachment,
            attachment_type=attachment_type,
            uploaded_by=request.user,
        )
        try:
            invitation_attachment.save()
        except ValidationError as exc:
            return Response({'error': exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)

        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.CREATE,
            content_type="InvitationAttachment",
            object_id=str(invitation_attachment.id),
            ip_address=_get_client_ip(request),
            description=f"Uploaded an attachment for “{invitation.event_title}”.",
        )

        return Response(InvitationAttachmentSerializer(invitation_attachment, context={"request": request}).data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['get'])
    def calendar(self, request):
        """Get invitations for calendar view"""
        # Get query parameters
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        
        queryset = self.get_queryset()
        
        if year and month:
            queryset = queryset.filter(
                event_date__year=int(year),
                event_date__month=int(month)
            )
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """Get upcoming events (within 7 days)"""
        now = timezone.now()
        seven_days_later = now + timedelta(days=7)
        
        queryset = self.get_queryset().filter(
            event_date__range=[now, seven_days_later]
        )
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def send_reminders(self, request):
        """Send due reminders (Admin task)."""
        reminder_type = request.data.get('type', 'both')  # 'both', '3_days', or '1_day'
        payload = send_due_invitation_reminders(reminder_type=reminder_type)
        return Response(payload)


class InvitationAttachmentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = InvitationAttachment.objects.all()
    serializer_class = InvitationAttachmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["invitation", "attachment_type"]

    def get_permissions(self):
        extra = [drf_any_permission_required(["document:view_all", "document:view_own", "invitation:view_all", "invitation:view_own"])]
        return [cls() for cls in (self.permission_classes + extra)]

    def get_queryset(self):
        qs = InvitationAttachment.objects.select_related("invitation", "invitation__created_by").all()
        user = getattr(self.request, "user", None)
        if not user or not user.is_authenticated:
            return qs.none()
        if user_has_permission(user, "document:view_all") or user_has_permission(user, "invitation:view_all"):
            return qs
        return qs.filter(invitation__created_by=user)

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        attachment = self.get_object()
        file = attachment.file.open("rb")
        response = __import__("django.http", fromlist=["FileResponse"]).FileResponse(file)
        filename = (attachment.file.name or "").split("/")[-1]
        response["Content-Disposition"] = f'attachment; filename="{filename}"'

        AuditLog.objects.create(
            user=request.user,
            action_type=AuditLog.ActionType.DOWNLOAD,
            content_type="InvitationAttachment",
            object_id=str(attachment.id),
            ip_address=_get_client_ip(request),
            description=f"Downloaded an invitation attachment for “{attachment.invitation.event_title}”.",
        )

        return response
