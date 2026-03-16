from django.db import migrations


def add_profile_change_password_permission(apps, schema_editor):
    Permission = apps.get_model("core", "Permission")
    RoleDefinition = apps.get_model("core", "RoleDefinition")
    RolePermission = apps.get_model("core", "RolePermission")

    permission, _created = Permission.objects.get_or_create(
        key="profile:change_password",
        defaults={
            "name": "Change Own Password",
            "description": "Allow users to change their own password.",
            "module": "profile",
        },
    )

    updates = []
    if permission.name != "Change Own Password":
        permission.name = "Change Own Password"
        updates.append("name")
    if permission.description != "Allow users to change their own password.":
        permission.description = "Allow users to change their own password."
        updates.append("description")
    if permission.module != "profile":
        permission.module = "profile"
        updates.append("module")
    if updates:
        permission.save(update_fields=updates)

    for role_key in ["director", "admin", "staff", "finance_officer", "auditor", "it_admin"]:
        try:
            role = RoleDefinition.objects.get(key=role_key)
        except RoleDefinition.DoesNotExist:
            continue
        RolePermission.objects.get_or_create(role=role, permission=permission)


def remove_profile_change_password_permission(apps, schema_editor):
    Permission = apps.get_model("core", "Permission")
    RolePermission = apps.get_model("core", "RolePermission")

    try:
        permission = Permission.objects.get(key="profile:change_password")
    except Permission.DoesNotExist:
        return

    RolePermission.objects.filter(permission=permission).delete()
    permission.delete()


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0011_user_force_password_change_user_is_archived"),
    ]

    operations = [
        migrations.RunPython(add_profile_change_password_permission, remove_profile_change_password_permission),
    ]

