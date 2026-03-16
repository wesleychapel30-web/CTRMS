from django.apps import AppConfig
from django.db.models.signals import post_migrate


class CoreConfig(AppConfig):
    name = 'core'
    default_auto_field = 'django.db.models.BigAutoField'
    
    def ready(self):
        # Ensure RBAC defaults exist after migrations (idempotent).
        from core.rbac_defaults import seed_rbac_defaults
        from core.notifications import EmailNotificationService

        def _seed(sender, **kwargs):
            try:
                seed_rbac_defaults()
                EmailNotificationService.seed_default_templates()
            except Exception:
                # Never block startup because of RBAC seeding. The management command can be run manually.
                return None

        post_migrate.connect(_seed, sender=self)
