from django.core.management.base import BaseCommand

from invitations.services import send_due_invitation_reminders


class Command(BaseCommand):
    help = "Send due invitation reminders (in-app + optional email records)."

    def add_arguments(self, parser):
        parser.add_argument("--type", default="both", choices=["both", "3_days", "1_day"])

    def handle(self, *args, **options):
        reminder_type = options["type"]
        result = send_due_invitation_reminders(reminder_type=reminder_type)
        self.stdout.write(self.style.SUCCESS(str(result)))

