from django.urls import reverse
from rest_framework import serializers
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


class InvitationSerializer(serializers.ModelSerializer):
    """Serializer for Invitation model"""
    
    reminders = InvitationReminderSerializer(many=True, read_only=True)
    attachments = InvitationAttachmentSerializer(many=True, read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.get_full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    is_upcoming = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Invitation
        fields = ('id', 'inviting_organization', 'event_title', 'description', 'location',
                 'event_date', 'event_duration_hours', 'status', 'status_display',
                 'reviewed_by', 'reviewed_by_name', 'review_notes', 'reviewed_at',
                 'contact_person', 'contact_email', 'contact_phone', 'rsvp_required',
                 'expected_attendees', 'special_requirements', 'reminder_3_days_sent',
                 'reminder_1_day_sent', 'reminders', 'attachments', 'is_upcoming', 'created_at', 'updated_at')
        read_only_fields = ('id', 'reviewed_by', 'reviewed_at', 'reminder_3_days_sent',
                           'reminder_1_day_sent', 'reminders', 'attachments', 'created_at', 'updated_at')


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
