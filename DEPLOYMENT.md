# Deployment (Production)

This project deploys as a single Django app that serves the built React SPA (from `frontend/dist`) and exposes the JSON API under `/api/`.

## Docker (Recommended)

1. Build and start:

```sh
docker compose up --build
```

2. Open the app:

`http://localhost:8000`

The container entrypoint runs:
`migrate`, `bootstrap_ctrms`, `collectstatic`, then starts Gunicorn.

`docker-compose.yml` also starts:
- `celery_worker` (background tasks)
- `celery_beat` (scheduled jobs, including invitation reminders)

Default credentials come from `docker-compose.yml` env vars:
- Admin: `admin` / `AdminPass123!`
- Director: `director` / `DirectorPass123!`

Change these before deploying publicly.

## Non-Docker (Linux Server)

1. Set environment variables (see `.env.example`):
- `DEBUG=False`
- `SECRET_KEY=...`
- `ALLOWED_HOSTS=...`
- `CSRF_TRUSTED_ORIGINS=...`
- `DATABASE_URL=...`

2. Build the frontend:

```sh
cd frontend
npm ci
npm run build
cd ..
```

3. Migrate + bootstrap + collect static:

```sh
python manage.py migrate
python manage.py bootstrap_ctrms
python manage.py collectstatic --noinput
```

4. Run Gunicorn:

```sh
gunicorn ctrms_config.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 60
```

## Media / Uploads

Uploads are stored under `media/`. In Docker, `media/` is persisted via the `media_data` volume.

For simple deployments without a separate reverse proxy, you can set `SERVE_MEDIA=True` (see `docker-compose.yml`) so Django serves `/media/` directly. For larger deployments, serve `/media/` via Nginx/S3 and keep `SERVE_MEDIA=False`.
