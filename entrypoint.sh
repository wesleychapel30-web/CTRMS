#!/bin/sh
set -e

export DJANGO_SETTINGS_MODULE=${DJANGO_SETTINGS_MODULE:-ctrms_config.settings}
export PORT=${PORT:-8000}

python manage.py migrate --noinput
python manage.py bootstrap_ctrms

if [ "${CTRMS_CLEAN_PRODUCTION_BASELINE_ON_STARTUP:-false}" = "true" ]; then
  CLEAN_ARGS="--yes"
  if [ "${CTRMS_PURGE_OPERATIONAL_DATA:-false}" = "true" ]; then
    CLEAN_ARGS="$CLEAN_ARGS --purge-operational"
  fi
  python manage.py clean_production_baseline $CLEAN_ARGS
fi

python manage.py collectstatic --noinput

exec gunicorn ctrms_config.wsgi:application \
  --bind "0.0.0.0:${PORT}" \
  --workers "${WEB_CONCURRENCY:-3}" \
  --timeout "${GUNICORN_TIMEOUT:-60}"
