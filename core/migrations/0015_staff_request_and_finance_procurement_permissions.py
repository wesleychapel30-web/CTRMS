from django.db import migrations


PERMISSIONS = {
    "document:view_own": ("View Own Documents", "Access documents linked to own records.", "document"),
    "request:create": ("Create Request", "Submit new assistance requests.", "request"),
    "request:update_own": ("Update Own Request", "Edit own requests subject to workflow locking.", "request"),
    "request:upload_own": ("Upload Docs to Own Request", "Upload documents to own requests.", "request"),
    "request:view_own": ("View Own Requests", "View requests created by the current user.", "request"),
    "procurement:approve": ("Approve Procurement Request", "Approve procurement workflow steps.", "procurement"),
}

ROLE_GRANTS = {
    "staff": [
        "document:view_own",
        "request:create",
        "request:update_own",
        "request:upload_own",
        "request:view_own",
    ],
    "finance_officer": [
        "procurement:approve",
    ],
}


def grant_permissions(apps, schema_editor):
    Permission = apps.get_model("core", "Permission")
    RoleDefinition = apps.get_model("core", "RoleDefinition")
    RolePermission = apps.get_model("core", "RolePermission")

    permission_objects = {}
    for key, (name, description, module) in PERMISSIONS.items():
        permission, _ = Permission.objects.get_or_create(
            key=key,
            defaults={"name": name, "description": description, "module": module},
        )
        permission_objects[key] = permission

    for role_key, permission_keys in ROLE_GRANTS.items():
        role = RoleDefinition.objects.filter(key=role_key).first()
        if role is None:
            continue
        for permission_key in permission_keys:
            RolePermission.objects.get_or_create(role=role, permission=permission_objects[permission_key])


def revoke_permissions(apps, schema_editor):
    RoleDefinition = apps.get_model("core", "RoleDefinition")
    RolePermission = apps.get_model("core", "RolePermission")

    for role_key, permission_keys in ROLE_GRANTS.items():
        role = RoleDefinition.objects.filter(key=role_key).first()
        if role is None:
            continue
        RolePermission.objects.filter(role=role, permission__key__in=permission_keys).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0014_backfill_recordtimelineentry"),
    ]

    operations = [
        migrations.RunPython(grant_permissions, revoke_permissions),
    ]
