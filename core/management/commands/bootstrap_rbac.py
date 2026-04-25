from django.core.management.base import BaseCommand

from core.rbac_defaults import seed_rbac_defaults


class Command(BaseCommand):
    help = "Bootstrap RBAC roles, permissions, and default role-permission mappings."

    def add_arguments(self, parser):
        parser.add_argument(
            "--sync",
            action="store_true",
            help="Force-sync all role-permission mappings to current defaults (overwrites manual changes).",
        )

    def handle(self, *args, **options):
        seed_rbac_defaults(sync_role_permissions=options["sync"])
        if options["sync"]:
            self.stdout.write(self.style.SUCCESS("RBAC bootstrap complete (full sync applied)."))
        else:
            self.stdout.write(self.style.SUCCESS("RBAC bootstrap complete."))

