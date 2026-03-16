import os
import secrets

from django.core.management.base import BaseCommand
from django.core.management import call_command

from common.models import OrganizationSettings, SystemSettings
from core.models import User, active_user_count_for_role


class Command(BaseCommand):
    help = "Bootstrap CTRMS with default settings and initial admin/director users."

    def handle(self, *args, **options):
        # Ensure RBAC tables exist and defaults are seeded (roles, permissions, mappings).
        # This is idempotent and safe to run repeatedly.
        try:
            call_command("bootstrap_rbac")
        except Exception:
            # Migrations might not be applied yet in some bootstrap flows.
            pass

        system = SystemSettings.objects.first()
        if system is None:
            system = SystemSettings.objects.create(
                site_name=os.environ.get("CTRMS_SITE_NAME", "CTRMS"),
                organization_name=os.environ.get("CTRMS_ORG_NAME", "CTRMS"),
                organization_email=os.environ.get("CTRMS_ORG_EMAIL", "support@example.com"),
                support_email=os.environ.get("CTRMS_SUPPORT_EMAIL", "support@example.com"),
            )
            self.stdout.write(self.style.SUCCESS("Created default SystemSettings."))

        organization = OrganizationSettings.objects.filter(is_active=True).first() or OrganizationSettings.objects.first()
        if organization is None:
            organization = OrganizationSettings.objects.create(
                organization_name=os.environ.get("CTRMS_ORG_NAME", system.organization_name or "CTRMS"),
                organization_email=os.environ.get("CTRMS_ORG_EMAIL", system.organization_email or "support@example.com"),
                organization_phone=os.environ.get("CTRMS_ORG_PHONE", ""),
                organization_address=os.environ.get("CTRMS_ORG_ADDRESS", ""),
                website_url=os.environ.get("CTRMS_ORG_WEBSITE", ""),
                primary_color=os.environ.get("CTRMS_PRIMARY_COLOR", "#2563eb"),
                secondary_color=os.environ.get("CTRMS_SECONDARY_COLOR", "#0ea5e9"),
                is_active=True,
            )
            self.stdout.write(self.style.SUCCESS("Created default OrganizationSettings."))
        elif not organization.is_active:
            organization.is_active = True
            organization.save(update_fields=["is_active"])

        admin_username = os.environ.get("CTRMS_ADMIN_USERNAME", "admin")
        admin_email = os.environ.get("CTRMS_ADMIN_EMAIL", "admin@example.com")
        admin_password = os.environ.get("CTRMS_ADMIN_PASSWORD")

        if not User.objects.filter(username=admin_username).exists():
            if not admin_password:
                admin_password = secrets.token_urlsafe(16)
                self.stdout.write(self.style.WARNING(f"Generated admin password: {admin_password}"))

            admin = User.objects.create_user(
                username=admin_username,
                email=admin_email,
                password=admin_password,
                role=User.Role.ADMIN,
                is_staff=True,
                is_superuser=True,
                is_active=True,
            )
            self.stdout.write(self.style.SUCCESS(f"Created admin user: {admin.username}"))
        else:
            self.stdout.write(f"Admin user already exists: {admin_username}")

        director_username = os.environ.get("CTRMS_DIRECTOR_USERNAME", "director")
        director_email = os.environ.get("CTRMS_DIRECTOR_EMAIL", "director@example.com")
        director_password = os.environ.get("CTRMS_DIRECTOR_PASSWORD")

        if active_user_count_for_role(User.Role.DIRECTOR) == 0:
            if not director_password:
                director_password = secrets.token_urlsafe(16)
                self.stdout.write(self.style.WARNING(f"Generated director password: {director_password}"))

            director = User.objects.create_user(
                username=director_username,
                email=director_email,
                password=director_password,
                role=User.Role.DIRECTOR,
                is_staff=True,
                is_superuser=False,
                is_active=True,
            )
            self.stdout.write(self.style.SUCCESS(f"Created director user: {director.username}"))
        else:
            self.stdout.write("Director user already exists.")

        self.stdout.write(self.style.SUCCESS("Bootstrap complete."))
