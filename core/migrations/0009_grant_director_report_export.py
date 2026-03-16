from django.db import migrations


def grant_director_report_export(apps, schema_editor):
    RoleDefinition = apps.get_model("core", "RoleDefinition")
    Permission = apps.get_model("core", "Permission")
    RolePermission = apps.get_model("core", "RolePermission")

    try:
        director_role = RoleDefinition.objects.get(key="director")
        export_permission = Permission.objects.get(key="report:export")
    except (RoleDefinition.DoesNotExist, Permission.DoesNotExist):
        return

    RolePermission.objects.get_or_create(role=director_role, permission=export_permission)


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0008_enforce_staff_read_only_permissions"),
    ]

    operations = [
        migrations.RunPython(grant_director_report_export, migrations.RunPython.noop),
    ]

