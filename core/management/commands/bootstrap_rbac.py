from django.core.management.base import BaseCommand

from core.rbac_defaults import seed_rbac_defaults


class Command(BaseCommand):
    help = "Bootstrap RBAC roles, permissions, and default role-permission mappings."

    def handle(self, *args, **options):
        seed_rbac_defaults()
        self.stdout.write(self.style.SUCCESS("RBAC bootstrap complete."))

