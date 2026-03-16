from __future__ import annotations

from django.db import transaction

from core.models import Permission, RoleDefinition, RolePermission, User


DEFAULT_ROLES = [
    ("director", "Director", "Decision authority: approves/rejects requests and manages invitations."),
    ("admin", "Administrator", "System management: users, requests, invitations, reports, settings."),
    ("staff", "Staff", "Restricted view: track own request details and status."),
    ("finance_officer", "Finance Officer", "Payments and disbursement tracking."),
    ("auditor", "Auditor / Viewer", "Read-only visibility for reports, logs, and records."),
    ("it_admin", "IT / System Admin", "Technical administration: settings and RBAC maintenance."),
]


DEFAULT_PERMISSIONS: list[tuple[str, str, str, str]] = [
    # key, name, description, module
    ("dashboard:view", "View Dashboard", "Access dashboard analytics.", "dashboard"),
    ("search:global", "Global Search", "Search across requests and invitations.", "search"),
    ("audit:view", "View Activity Logs", "View audit/activity logs.", "audit"),
    ("report:view", "View Reports", "View reports and analytics.", "report"),
    ("report:export", "Export Reports", "Export reports to PDF/Excel/CSV.", "report"),
    ("settings:update", "Update System Settings", "Update system and organization settings.", "settings"),
    ("user:manage", "Manage Users", "Create/update/disable users and reset passwords.", "user"),
    ("user:create", "Create Users", "Create new user accounts.", "user"),
    ("user:update", "Update Users", "Update user profile and role data.", "user"),
    ("user:deactivate", "Deactivate Users", "Activate/deactivate user accounts.", "user"),
    ("user:reset_password", "Reset User Password", "Reset user credentials.", "user"),
    ("user:assign_role", "Assign User Roles", "Assign primary and additional roles to users.", "user"),
    ("profile:change_password", "Change Own Password", "Allow users to change their own password.", "profile"),
    ("rbac:manage", "Manage Roles & Permissions", "Edit role-permission mappings.", "rbac"),
    ("document:view_all", "View All Documents", "Access documents across the institution.", "document"),
    ("document:view_own", "View Own Documents", "Access documents linked to own records.", "document"),
    ("request:create", "Create Request", "Submit new assistance requests.", "request"),
    ("request:view_all", "View All Requests", "View all requests.", "request"),
    ("request:view_own", "View Own Requests", "View requests created by the current user.", "request"),
    ("request:update_all", "Update Any Request", "Edit requests (subject to workflow locking).", "request"),
    ("request:update_own", "Update Own Request", "Edit own requests (subject to workflow locking).", "request"),
    ("request:upload_all", "Upload Docs to Any Request", "Upload documents to any request.", "request"),
    ("request:upload_own", "Upload Docs to Own Request", "Upload documents to own requests.", "request"),
    ("request:approve", "Approve Request", "Approve requests (Director-only policy).", "request"),
    ("request:reject", "Reject Request", "Reject requests (Director-only policy).", "request"),
    ("request:cancel", "Cancel Request", "Cancel requests (soft cancel).", "request"),
    ("request:restore", "Restore Request", "Restore previously cancelled/archived requests.", "request"),
    ("request:reverse", "Reverse Request", "Reverse a request back to review state (admin control).", "request"),
    ("payment:view", "View Payments", "View payment/disbursement details.", "payment"),
    ("payment:record", "Record Payments", "Record disbursements and payment references.", "payment"),
    ("invitation:create", "Create Invitation", "Create invitation entries.", "invitation"),
    ("invitation:view_all", "View All Invitations", "View all invitations.", "invitation"),
    ("invitation:view_own", "View Own Invitations", "View invitations created by the current user.", "invitation"),
    ("invitation:update_all", "Update Any Invitation", "Edit invitations.", "invitation"),
    ("invitation:update_own", "Update Own Invitation", "Edit own invitations.", "invitation"),
    ("invitation:upload_all", "Upload Attachments to Any Invitation", "Upload invitation attachments.", "invitation"),
    ("invitation:upload_own", "Upload Attachments to Own Invitation", "Upload attachments to own invitations.", "invitation"),
    ("invitation:accept", "Accept Invitation", "Accept invitations.", "invitation"),
    ("invitation:decline", "Decline Invitation", "Decline invitations.", "invitation"),
    ("invitation:confirm", "Confirm Attendance", "Confirm attendance.", "invitation"),
    ("invitation:complete", "Mark Invitation Completed", "Mark an event completed.", "invitation"),
    ("invitation:revert", "Revert Invitation Decision", "Revert invitation decision to prior review stage.", "invitation"),
    ("reminder:send", "Send Reminders", "Trigger due reminders (admin task).", "reminder"),
]


DEFAULT_ROLE_PERMISSIONS: dict[str, list[str]] = {
    "director": [
        "dashboard:view",
        "search:global",
        "audit:view",
        "report:view",
        "report:export",
        "request:view_all",
        "request:upload_all",
        "request:approve",
        "request:reject",
        "request:reverse",
        "invitation:view_all",
        "invitation:upload_all",
        "invitation:accept",
        "invitation:decline",
        "invitation:confirm",
        "invitation:complete",
        "invitation:revert",
        "document:view_all",
        "profile:change_password",
    ],
    "admin": [
        "dashboard:view",
        "search:global",
        "audit:view",
        "report:view",
        "report:export",
        "settings:update",
        "user:manage",
        "user:create",
        "user:update",
        "user:deactivate",
        "user:reset_password",
        "user:assign_role",
        "request:create",
        "request:view_all",
        "request:update_all",
        "request:upload_all",
        "request:cancel",
        "request:restore",
        "request:reverse",
        "payment:view",
        "payment:record",
        "invitation:create",
        "invitation:view_all",
        "invitation:update_all",
        "invitation:upload_all",
        "invitation:revert",
        "document:view_all",
        "reminder:send",
        "rbac:manage",
        "profile:change_password",
    ],
    "staff": [
        "request:view_own",
        "profile:change_password",
    ],
    "finance_officer": [
        "dashboard:view",
        "search:global",
        "payment:view",
        "payment:record",
        "report:view",
        "report:export",
        "document:view_all",
        "profile:change_password",
    ],
    "auditor": [
        "dashboard:view",
        "search:global",
        "report:view",
        "request:view_all",
        "invitation:view_all",
        "payment:view",
        "document:view_all",
        "profile:change_password",
    ],
    "it_admin": [
        "dashboard:view",
        "search:global",
        "settings:update",
        "user:manage",
        "user:create",
        "user:update",
        "user:deactivate",
        "user:reset_password",
        "user:assign_role",
        "rbac:manage",
        "report:view",
        "document:view_all",
        "profile:change_password",
    ],
}


@transaction.atomic
def seed_rbac_defaults() -> None:
    """Idempotently ensure RBAC defaults exist in DB."""
    role_map: dict[str, RoleDefinition] = {}
    for key, name, description in DEFAULT_ROLES:
        role, _created = RoleDefinition.objects.get_or_create(
            key=key,
            defaults={"name": name, "description": description},
        )
        if role.name != name or role.description != description:
            role.name = name
            role.description = description
            role.save(update_fields=["name", "description"])
        role_map[key] = role

    perm_map: dict[str, Permission] = {}
    for key, name, description, module in DEFAULT_PERMISSIONS:
        perm, _created = Permission.objects.get_or_create(
            key=key,
            defaults={"name": name, "description": description, "module": module},
        )
        if perm.name != name or perm.description != description or perm.module != module:
            perm.name = name
            perm.description = description
            perm.module = module
            perm.save(update_fields=["name", "description", "module"])
        perm_map[key] = perm

    for role_key, permission_keys in DEFAULT_ROLE_PERMISSIONS.items():
        role = role_map.get(role_key)
        if not role:
            continue
        for perm_key in permission_keys:
            perm = perm_map.get(perm_key)
            if not perm:
                continue
            RolePermission.objects.get_or_create(role=role, permission=perm)

    # Ensure role rows exist for every declared User.Role so permission checks don't crash.
    for legacy_role in [choice[0] for choice in User.Role.choices]:
        RoleDefinition.objects.get_or_create(key=legacy_role, defaults={"name": legacy_role, "description": ""})
