from celery import shared_task

from invitations.services import send_due_invitation_reminders


@shared_task
def send_due_invitation_reminders_task(reminder_type: str = "both") -> dict:
    return send_due_invitation_reminders(reminder_type=reminder_type)

