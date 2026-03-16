import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ctrms_config.settings")

app = Celery("ctrms_config")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

