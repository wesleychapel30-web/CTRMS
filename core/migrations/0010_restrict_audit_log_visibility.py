from django.db import migrations


def restrict_audit_view_permission(apps, schema_editor):
    RoleDefinition = apps.get_model("core", "RoleDefinition")
    Permission = apps.get_model("core", "Permission")
    RolePermission = apps.get_model("core", "RolePermission")

    try:
        audit_permission = Permission.objects.get(key="audit:view")
    except Permission.DoesNotExist:
        return

    allowed_role_keys = {"admin", "director"}
    RolePermission.objects.filter(permission=audit_permission).exclude(role__key__in=allowed_role_keys).delete()

    for role_key in allowed_role_keys:
        try:
            role = RoleDefinition.objects.get(key=role_key)
        except RoleDefinition.DoesNotExist:
            continue
        RolePermission.objects.get_or_create(role=role, permission=audit_permission)


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0009_grant_director_report_export"),
    ]

    operations = [
        migrations.RunPython(restrict_audit_view_permission, migrations.RunPython.noop),
    ]

