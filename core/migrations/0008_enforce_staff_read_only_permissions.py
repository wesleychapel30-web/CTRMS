from django.db import migrations


def enforce_staff_permissions(apps, schema_editor):
    RoleDefinition = apps.get_model("core", "RoleDefinition")
    Permission = apps.get_model("core", "Permission")
    RolePermission = apps.get_model("core", "RolePermission")

    try:
        staff_role = RoleDefinition.objects.get(key="staff")
    except RoleDefinition.DoesNotExist:
        return

    allowed_keys = {"request:view_own"}

    RolePermission.objects.filter(role=staff_role).exclude(permission__key__in=allowed_keys).delete()

    allowed_permissions = Permission.objects.filter(key__in=allowed_keys)
    for permission in allowed_permissions:
        RolePermission.objects.get_or_create(role=staff_role, permission=permission)


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0007_alter_notificationtemplate_template_type"),
    ]

    operations = [
        migrations.RunPython(enforce_staff_permissions, migrations.RunPython.noop),
    ]
