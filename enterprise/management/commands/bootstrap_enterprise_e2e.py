from __future__ import annotations

import os

from django.core.management import call_command
from django.core.management.base import BaseCommand

from core.models import User
from core.rbac_defaults import seed_rbac_defaults
from core.rbac_service import sync_user_roles


class Command(BaseCommand):
    help = "Seed deterministic enterprise E2E users for browser automation."

    def handle(self, *args, **options):
        seed_rbac_defaults(sync_role_permissions=True)
        call_command("bootstrap_enterprise", include_demo=True)

        actor = (
            User.objects.filter(is_superuser=True).order_by("created_at").first()
            or User.objects.filter(role=User.Role.ADMIN).order_by("created_at").first()
            or User.objects.order_by("created_at").first()
        )
        password = os.environ.get("CTRMS_E2E_PASSWORD", "E2E-Enterprise-123!")

        user_specs = [
            {
                "username": "e2e.superadmin",
                "email": "e2e.superadmin@example.com",
                "first_name": "E2E",
                "last_name": "Super Admin",
                "department": "Executive",
                "primary_role": User.Role.ADMIN,
                "additional_roles": ["super_admin"],
            },
            {
                "username": "e2e.procurement",
                "email": "e2e.procurement@example.com",
                "first_name": "E2E",
                "last_name": "Procurement",
                "department": "Procurement",
                "primary_role": User.Role.STAFF,
                "additional_roles": ["procurement_officer"],
            },
            {
                "username": "e2e.inventory",
                "email": "e2e.inventory@example.com",
                "first_name": "E2E",
                "last_name": "Inventory",
                "department": "Operations",
                "primary_role": User.Role.STAFF,
                "additional_roles": ["operations_officer"],
            },
            {
                "username": "e2e.finance",
                "email": "e2e.finance@example.com",
                "first_name": "E2E",
                "last_name": "Finance",
                "department": "Finance",
                "primary_role": User.Role.FINANCE_OFFICER,
                "additional_roles": [],
            },
            {
                "username": "e2e.manager",
                "email": "e2e.manager@example.com",
                "first_name": "E2E",
                "last_name": "Manager",
                "department": "Operations",
                "primary_role": User.Role.STAFF,
                "additional_roles": ["department_manager"],
            },
        ]

        for spec in user_specs:
            user, _ = User.objects.get_or_create(
                username=spec["username"],
                defaults={
                    "email": spec["email"],
                    "first_name": spec["first_name"],
                    "last_name": spec["last_name"],
                    "department": spec["department"],
                    "is_active": True,
                    "is_archived": False,
                    "force_password_change": False,
                },
            )
            user.email = spec["email"]
            user.first_name = spec["first_name"]
            user.last_name = spec["last_name"]
            user.department = spec["department"]
            user.is_active = True
            user.is_archived = False
            user.force_password_change = False
            user.set_password(password)
            user.save()
            sync_user_roles(
                user=user,
                primary_role=spec["primary_role"],
                additional_roles=spec["additional_roles"],
                is_active=True,
                actor=actor,
            )

        self.stdout.write(self.style.SUCCESS("Enterprise E2E users bootstrapped."))
