from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from common.models import SystemSettings
from core.models import NotificationReceipt, User
from core.notification_center import NotificationPayload, get_recipients_for_roles, notify_users
from core.notifications import EmailNotificationService
from invitations.models import Invitation, InvitationReminder


def send_due_invitation_reminders(*, reminder_type: str = "both") -> dict:
    """
    Send due reminders (in-app + optional email channel records).

    This is idempotent because Invitation tracks reminder_*_sent flags and
    InvitationReminder has unique_together on (invitation, reminder_type, channel).
    """
    system = SystemSettings.objects.first()
    allow_3_day = system.event_reminder_3_days_enabled if system else True
    allow_1_day = system.event_reminder_1_day_enabled if system else False
    allow_email = system.email_notifications_enabled if system else False

    count_3day = 0
    count_1day = 0

    def _send_dashboard(invitation: Invitation, rtype: str):
        InvitationReminder.objects.get_or_create(
            invitation=invitation,
            reminder_type=rtype,
            channel=InvitationReminder.Channel.DASHBOARD,
            defaults={"status": "sent"},
        )

        notify_users(
            recipients=get_recipients_for_roles([User.Role.DIRECTOR, User.Role.ADMIN]),
            payload=NotificationPayload(
                kind="event",
                title="Event reminder",
                message=f"{invitation.event_title} is coming up on {timezone.localtime(invitation.event_date).strftime('%Y-%m-%d %H:%M')}.",
                href=f"/invitations/{invitation.id}",
            ),
            created_by=None,
        )

    def _send_email(invitation: Invitation, rtype: str):
        email_log = EmailNotificationService.send_event_reminder(
            invitation_obj=invitation,
            recipient_email=invitation.contact_email,
        )
        status_value = "sent" if email_log else "failed"

        reminder, created = InvitationReminder.objects.get_or_create(
            invitation=invitation,
            reminder_type=rtype,
            channel=InvitationReminder.Channel.EMAIL,
            defaults={"recipient": invitation.contact_email, "status": status_value},
        )
        if not created and reminder.status != status_value:
            reminder.status = status_value
            reminder.recipient = invitation.contact_email
            reminder.save(update_fields=["status", "recipient"])

    # 3-day reminders
    if allow_3_day and reminder_type in {"both", "3_days"}:
        invitations = Invitation.objects.filter(
            reminder_3_days_sent=False,
            status__in=[Invitation.Status.PENDING_REVIEW, Invitation.Status.ACCEPTED],
        )
        for invitation in invitations:
            if invitation.is_overdue_for_3day_reminder:
                _send_dashboard(invitation, InvitationReminder.ReminderType.THREE_DAYS)
                if allow_email:
                    _send_email(invitation, InvitationReminder.ReminderType.THREE_DAYS)
                invitation.send_3day_reminder()
                count_3day += 1

    # 1-day reminders
    if allow_1_day and reminder_type in {"both", "1_day"}:
        invitations = Invitation.objects.filter(
            reminder_1_day_sent=False,
            status__in=[
                Invitation.Status.PENDING_REVIEW,
                Invitation.Status.ACCEPTED,
                Invitation.Status.CONFIRMED_ATTENDANCE,
            ],
        )
        for invitation in invitations:
            if invitation.is_overdue_for_1day_reminder:
                _send_dashboard(invitation, InvitationReminder.ReminderType.ONE_DAY)
                if allow_email:
                    _send_email(invitation, InvitationReminder.ReminderType.ONE_DAY)
                invitation.send_1day_reminder()
                count_1day += 1

    # Overdue items: invitation date has passed but workflow is still open.
    overdue_invitations = Invitation.objects.filter(
        event_date__lt=timezone.now(),
        status__in=[
            Invitation.Status.PENDING_REVIEW,
            Invitation.Status.ACCEPTED,
            Invitation.Status.CONFIRMED_ATTENDANCE,
        ],
    )
    for invitation in overdue_invitations:
        href = f"/invitations/{invitation.id}"
        existing_unread = NotificationReceipt.objects.filter(
            user__in=get_recipients_for_roles([User.Role.DIRECTOR, User.Role.ADMIN]),
            is_read=False,
            notification__title="Overdue item",
            notification__href=href,
        ).exists()
        if existing_unread:
            continue

        notify_users(
            recipients=get_recipients_for_roles([User.Role.DIRECTOR, User.Role.ADMIN]),
            payload=NotificationPayload(
                kind="event",
                title="Overdue item",
                message=f"“{invitation.event_title}” passed its event time.",
                href=href,
            ),
            created_by=None,
        )

    # Light cleanup: mark completed automatically if event end time passed significantly.
    cutoff = timezone.now() - timedelta(hours=12)
    Invitation.objects.filter(status=Invitation.Status.CONFIRMED_ATTENDANCE, event_date__lt=cutoff).update(
        status=Invitation.Status.COMPLETED
    )

    return {
        "message": "Reminders processed",
        "3_day_reminders": count_3day,
        "1_day_reminders": count_1day,
    }
