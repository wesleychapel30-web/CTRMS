#!/bin/sh
set -e

export DJANGO_SETTINGS_MODULE=${DJANGO_SETTINGS_MODULE:-ctrms_config.settings}
export PORT=${PORT:-8000}

python manage.py migrate --noinput
python manage.py bootstrap_ctrms
python manage.py collectstatic --noinput

exec gunicorn ctrms_config.wsgi:application \
  --bind "0.0.0.0:${PORT}" \
  --workers "${WEB_CONCURRENCY:-3}" \
  --timeout "${GUNICORN_TIMEOUT:-60}"

