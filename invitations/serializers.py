from django.urls import reverse
import re
from rest_framework import serializers
from core.models import AuditLog
from core.timeline import get_invitation_timeline_entries, serialize_timeline_entries
from .models import Invitation, InvitationReminder, InvitationAttachment


class InvitationAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.get_full_name', read_only=True)
    filename = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()

    def get_filename(self, obj: InvitationAttachment) -> str:
        try:
            return (obj.file.name or '').split('/')[-1]
        except Exception:
            return ''

    def get_download_url(self, obj: InvitationAttachment) -> str:
        request = self.context.get("request")
        url = reverse("invitation-attachment-download", kwargs={"pk": obj.pk})
        return request.build_absolute_uri(url) if request else url

    class Meta:
        model = InvitationAttachment
        fields = ('id', 'file', 'filename', 'download_url', 'attachment_type', 'uploaded_by', 'uploaded_by_name', 'uploaded_at')
        read_only_fields = ('id', 'uploaded_by', 'uploaded_by_name', 'uploaded_at')


class InvitationReminderSerializer(serializers.ModelSerializer):
    """Serializer for InvitationReminder model"""
    
    reminder_type_display = serializers.CharField(source='get_reminder_type_display', read_only=True)
    channel_display = serializers.CharField(source='get_channel_display', read_only=True)
    
    class Meta:
        model = InvitationReminder
        fields = ('id', 'reminder_type', 'reminder_type_display', 'channel', 'channel_display',
                 'sent_at', 'status', 'recipient', 'error_message')
        read_only_fields = ('id', 'sent_at')


class InvitationHistoryEntrySerializer(serializers.Serializer):
    id = serializers.CharField()
    action_type = serializers.CharField()
    action_label = serializers.CharField()
    label = serializers.CharField()
    actor_name = serializers.CharField()
    description = serializers.CharField()
    comment = serializers.CharField()
    from_status = serializers.CharField(required=False, allow_blank=True)
    to_status = serializers.CharField(required=False, allow_blank=True)
    created_at = serializers.DateTimeField()


class InvitationSerializer(serializers.ModelSerializer):
    """Serializer for Invitation model"""
    
    reminders = InvitationReminderSerializer(many=True, read_only=True)
    attachments = InvitationAttachmentSerializer(many=True, read_only=True)
    history = serializers.SerializerMethodField()
    timeline_entries = serializers.SerializerMethodField()
    reviewed_by_name = serializers.CharField(source='reviewed_by.get_full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    is_upcoming = serializers.BooleanField(read_only=True)

    def _split_comment(self, description: str) -> tuple[str, str]:
        for marker in (' Comment: ', ' Reason: ', ' Notes: '):
            if marker in description:
                body, comment = description.split(marker, 1)
                return body.strip(), comment.strip()
        return description.strip(), ''

    def _extract_status_transition(self, description: str) -> tuple[str, str]:
        match = re.search(r'\(([^()]+?) -> ([^()]+?)\)', description)
        if not match:
            return '', ''
        return match.group(1).strip(), match.group(2).strip()

    def _label_for_history(self, description: str) -> str:
        description_lower = description.lower()
        if 'confirmed attendance' in description_lower or 'accepted invitation' in description_lower or 'declined invitation' in description_lower:
            return 'Invitation Status'
        if 'reverted invitation decision' in description_lower or 'updated invitation status' in description_lower:
            return 'Invitation Status'
        return 'Invitation Status'

    def _action_label(self, entry: AuditLog, description: str) -> str:
        description_lower = description.lower()
        if 'accepted invitation' in description_lower:
            return 'Invitation accepted'
        if 'declined invitation' in description_lower:
            return 'Invitation declined'
        if 'confirmed attendance' in description_lower:
            return 'Attendance confirmed'
        if 'reverted invitation decision' in description_lower:
            return 'Decision reverted'
        if 'updated invitation status' in description_lower:
            return 'Status updated'
        if 'created invitation' in description_lower:
            return 'Invitation created'
        if entry.action_type == AuditLog.ActionType.CREATE:
            return 'Invitation created'
        return entry.get_action_type_display()

    def get_history(self, obj: Invitation):
        view = self.context.get('view')
        if getattr(view, 'action', None) != 'retrieve':
            return []

        history = AuditLog.objects.filter(
            content_type='Invitation',
            object_id=str(obj.id),
        ).select_related('user').order_by('-created_at')

        results = []
        for entry in history:
            description, comment = self._split_comment(entry.description or '')
            from_status, to_status = self._extract_status_transition(description)
            results.append({
                'id': str(entry.id),
                'action_type': entry.action_type,
                'action_label': self._action_label(entry, description),
                'label': self._label_for_history(description),
                'actor_name': entry.user.get_full_name() or entry.user.username,
                'description': description,
                'comment': comment,
                'from_status': from_status,
                'to_status': to_status,
                'created_at': entry.created_at,
            })
        return InvitationHistoryEntrySerializer(results, many=True).data

    def get_timeline_entries(self, obj: Invitation):
        view = self.context.get('view')
        if getattr(view, 'action', None) != 'retrieve':
            return []
        request = self.context.get("request")
        viewer = getattr(request, "user", None)
        return serialize_timeline_entries(get_invitation_timeline_entries(obj, viewer))
    
    class Meta:
        model = Invitation
        fields = ('id', 'inviting_organization', 'event_title', 'description', 'location',
                 'event_date', 'event_duration_hours', 'status', 'status_display',
                 'reviewed_by', 'reviewed_by_name', 'review_notes', 'reviewed_at',
                 'contact_person', 'contact_email', 'contact_phone', 'rsvp_required',
                 'expected_attendees', 'special_requirements', 'reminder_3_days_sent',
                 'reminder_1_day_sent', 'reminders', 'attachments', 'history', 'timeline_entries', 'is_upcoming', 'created_at', 'updated_at')
        read_only_fields = ('id', 'reviewed_by', 'reviewed_at', 'reminder_3_days_sent',
                           'reminder_1_day_sent', 'reminders', 'attachments', 'history', 'timeline_entries', 'created_at', 'updated_at')


class InvitationCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating Invitation"""
    
    class Meta:
        model = Invitation
        fields = ('inviting_organization', 'event_title', 'description', 'location', 
                 'event_date', 'event_duration_hours', 'contact_person', 'contact_email',
                 'contact_phone', 'rsvp_required', 'expected_attendees', 'special_requirements')
    
    def validate_event_date(self, value):
        from django.utils import timezone
        if value <= timezone.now():
            raise serializers.ValidationError("Event date must be in the future")
        return value


class InvitationStatusUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating invitation status"""
    
    class Meta:
        model = Invitation
        fields = ('status', 'review_notes')


class InvitationCalendarSerializer(serializers.ModelSerializer):
    """Serializer for calendar view"""
    
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    is_upcoming = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Invitation
        fields = ('id', 'event_title', 'event_date', 'location', 'status', 'status_display',
                 'inviting_organization', 'contact_person', 'is_upcoming')
