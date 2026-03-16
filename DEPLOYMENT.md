# Deployment Guide

This project deploys as a single Django application that serves the built React frontend from `frontend/dist` and exposes the API under `/api/`.

## Deployment options

- Local full stack with `docker compose`
- Self-hosted production deployment with `docker-compose.prod.yml`
- GitHub release pipeline that publishes a production container image to GHCR

## 1. Local Docker deployment

Use this for full-stack local testing with PostgreSQL and Redis:

```sh
docker compose up --build
```

Services started:

- `web`
- `db`
- `redis`
- `celery_worker`
- `celery_beat`

The web container entrypoint automatically runs:

- `python manage.py migrate --noinput`
- `python manage.py bootstrap_ctrms`
- `python manage.py collectstatic --noinput`

App URL:

```text
http://localhost:8000
```

## 2. Self-hosted production deployment

The repository includes [docker-compose.prod.yml](docker-compose.prod.yml), which pulls a released image from GitHub Container Registry.

### Step 1: Prepare environment

Copy the template and update it with production values:

```sh
cp .env.example .env
```

At minimum, set:

- `DEBUG=False`
- `SECRET_KEY=<strong-random-value>`
- `ALLOWED_HOSTS=<your-domain-or-server-ip>`
- `CORS_ALLOWED_ORIGINS=https://<your-frontend-domain>`
- `CSRF_TRUSTED_ORIGINS=https://<your-frontend-domain>`
- `POSTGRES_PASSWORD=<strong-password>` if using the bundled Postgres service
- `CTRMS_IMAGE=ghcr.io/<repository-owner>/ctrms:<release-tag>`
- secure admin and director bootstrap passwords

Set `DATABASE_URL` only if you are using an external Postgres service. If you use the bundled `db` container from `docker-compose.prod.yml`, the compose file injects the correct internal connection string automatically.

### Step 2: Pull the release image

If the container package is private, authenticate first:

```sh
echo <github_pat> | docker login ghcr.io -u <github_username> --password-stdin
```

Then pull the image:

```sh
docker compose -f docker-compose.prod.yml pull
```

### Step 3: Start the stack

```sh
docker compose -f docker-compose.prod.yml up -d
```

### Step 4: Verify

```sh
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f web
```

## 3. Updating an existing deployment

After a new GitHub release is published:

1. Update `CTRMS_IMAGE` in `.env`
2. Pull the new image
3. Recreate containers

```sh
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

## 4. Rollback

To rollback, point `CTRMS_IMAGE` at the previous tag and recreate the stack:

```text
CTRMS_IMAGE=ghcr.io/<repository-owner>/ctrms:v1.0.0
```

Then run:

```sh
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

## 5. GitHub release workflow

The repository includes [`.github/workflows/release.yml`](.github/workflows/release.yml).

When you push a version tag like `v1.0.0`, GitHub Actions will:

1. install backend and frontend dependencies
2. run backend tests
3. run frontend tests
4. build the frontend
5. build and publish the Docker image to GHCR
6. create a GitHub Release

To trigger a release:

```sh
git tag v1.0.0
git push origin v1.0.0
```

Published image tags:

```text
ghcr.io/<repository-owner>/ctrms:v1.0.0
ghcr.io/<repository-owner>/ctrms:latest
```

## 6. Production checklist

- Set `DEBUG=False`
- Use a strong `SECRET_KEY`
- Use PostgreSQL in production
- Restrict `ALLOWED_HOSTS` to real domains or server IPs
- Restrict `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` to real HTTPS origins
- Set `SECURE_SSL_REDIRECT=True`
- Set `SESSION_COOKIE_SECURE=True`
- Set `CSRF_COOKIE_SECURE=True`
- Put the app behind HTTPS
- Change all seeded bootstrap passwords
- Back up the PostgreSQL volume and uploaded media

## 7. Notes on media and static files

- Static files are collected into `staticfiles/`
- Uploaded documents live under `media/`
- `docker-compose.prod.yml` keeps both in persistent named volumes
- For larger deployments, put `/media/` behind Nginx or object storage instead of serving directly from Django

## 8. Optional reverse proxy

For public production deployments, place a reverse proxy such as Nginx or Caddy in front of the `web` service to terminate TLS and forward traffic to port `8000`.

Typical responsibilities:

- HTTPS certificates
- gzip/brotli compression
- request size limits
- proxy headers
- static and media caching
