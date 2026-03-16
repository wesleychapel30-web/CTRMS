# CTRMS

CTRMS is a full-stack Request and Invitation Management System for institutional teams that need controlled approvals, payment tracking, invitation handling, notifications, audit trails, and role-based access.

The project uses a Django backend, a React frontend, and PostgreSQL/Redis-ready deployment tooling. In production, Django serves the built frontend from `frontend/dist` and exposes the API under `/api/`.

## What the system includes

- Role-based access control for staff, administrators, directors, finance, and audit-style access
- Request lifecycle management with approvals, rejection, payment tracking, and history
- Invitation workflows with reminders, attendance confirmation, and calendar views
- Notifications, activity logs, reporting, exports, and document uploads
- React + Tailwind application shell with Django-backed API endpoints
- Docker-based deployment and GitHub release automation

## Stack

- Backend: Django, Django REST Framework, Celery, PostgreSQL, Redis
- Frontend: React, TypeScript, Vite, Tailwind
- Deployment: Docker, Gunicorn, WhiteNoise, GitHub Actions, GHCR

## Quick start

### 1. Clone and install

```powershell
git clone https://github.com/wesleychapel30-web/CTRMS.git
cd CTRMS
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cd frontend
npm ci
cd ..
```

### 2. Configure environment

```powershell
Copy-Item .env.example .env
```

For local development you can leave `DATABASE_URL` unset and Django will use SQLite automatically.

### 3. Prepare the database

```powershell
python manage.py migrate
python manage.py bootstrap_ctrms
```

`bootstrap_ctrms` seeds default system settings, organization settings, RBAC defaults, and initial admin/director users if they do not already exist.

### 4. Run the app

Backend API:

```powershell
python manage.py runserver
```

Frontend dev server:

```powershell
cd frontend
npm run dev
```

If you want Django to serve the frontend directly, build it once:

```powershell
cd frontend
npm run build
cd ..
python manage.py runserver
```

## Local development modes

### Option A: Django + Vite

Use this while actively changing frontend code.

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`

Make sure the frontend origin is listed in:

- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`

### Option B: Docker

For a full local stack with PostgreSQL and Redis:

```powershell
docker compose up --build
```

This starts:

- `web`
- `db`
- `redis`
- `celery_worker`
- `celery_beat`

The container entrypoint runs:

- `python manage.py migrate`
- `python manage.py bootstrap_ctrms`
- `python manage.py collectstatic --noinput`

## Environment variables

The project reads its runtime configuration from `.env`. Start with [`.env.example`](.env.example).

Important settings:

- `DEBUG`
- `SECRET_KEY`
- `ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`
- `DATABASE_URL`
- `EMAIL_*`
- `CELERY_BROKER_URL`
- `CELERY_RESULT_BACKEND`
- `CTRMS_*` bootstrap values for site, organization, and initial users

## Testing and validation

Backend tests:

```powershell
python manage.py test
```

Frontend tests:

```powershell
cd frontend
npm run test
```

Frontend production build:

```powershell
cd frontend
npm run build
```

Django configuration check:

```powershell
python manage.py check
```

## Deployment

Deployment instructions are documented in [DEPLOYMENT.md](DEPLOYMENT.md).

This repository now includes:

- [docker-compose.prod.yml](docker-compose.prod.yml) for self-hosted production deployment
- [`.github/workflows/ci.yml`](.github/workflows/ci.yml) for validation on pushes and pull requests
- [`.github/workflows/release.yml`](.github/workflows/release.yml) for tagged releases and container publishing

### Release flow

Create and push a version tag:

```powershell
git tag v1.0.0
git push origin v1.0.0
```

The release workflow will:

- run backend and frontend validation
- build the Docker image
- publish it to GHCR
- create a GitHub Release

Published image pattern:

```text
ghcr.io/<repository-owner>/ctrms:<tag>
ghcr.io/<repository-owner>/ctrms:latest
```

## Project structure

```text
CTRMS/
|-- common/                 Shared system and organization settings
|-- core/                   Authentication, RBAC, notifications, audit APIs
|-- invitations/            Invitation workflows, reminders, calendar data
|-- requests/               Request workflows, documents, payment tracking
|-- ctrms_config/           Django settings, middleware, URL routing
|-- frontend/               React + TypeScript + Tailwind application
|-- static/                 Django-managed static assets
|-- .github/workflows/      CI and release automation
|-- docker-compose.yml      Local Docker stack
|-- docker-compose.prod.yml Production Docker stack
|-- DEPLOYMENT.md           Deployment guide
|-- .env.example            Environment template
```

## Useful commands

Install backend dependencies:

```powershell
pip install -r requirements.txt
```

Install frontend dependencies:

```powershell
cd frontend
npm ci
```

Run migrations:

```powershell
python manage.py migrate
```

Seed baseline data:

```powershell
python manage.py bootstrap_ctrms
```

Create a release tag:

```powershell
git tag v1.0.0
git push origin v1.0.0
```

## Security notes

- Do not commit `.env`
- Change all bootstrap passwords before exposing the app publicly
- Use PostgreSQL for production instead of SQLite
- Set `DEBUG=False` in production
- Set secure cookie and HTTPS-related variables before deployment
- Restrict `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, and `CSRF_TRUSTED_ORIGINS` to real domains in production

## Documentation

- [DEPLOYMENT.md](DEPLOYMENT.md)
- [SETUP.md](SETUP.md)
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)
- [MODERN_UI_QUICK_REFERENCE.md](MODERN_UI_QUICK_REFERENCE.md)
