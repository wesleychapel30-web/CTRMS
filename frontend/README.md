# CTRMS Frontend

This folder contains the React + Tailwind frontend for the enterprise SaaS dashboard described in the product requirements.

## Included pages

- Login
- Dashboard
- Requests
- Request Details
- Invitations
- Invitation Details
- Calendar
- Reports
- Admin

## Implemented integration

- Django remains the backend and session-auth API provider.
- The React app now uses live endpoints for:
  - `/api/session/`, `/api/session/login/`, `/api/session/logout/`
  - `/api/dashboard-overview/`
  - `/api/requests/` and request action endpoints
  - `/api/invitations/` and invitation action endpoints
  - `/api/documents-data/`, `/api/activity-logs-data/`, `/api/user-management-data/`, `/api/system-settings-data/`
  - `/export/` downloads
- Vite proxies `/api`, `/media`, and `/export` to `http://127.0.0.1:8000` in development.

## Run

```bash
cd frontend
npm install
npm run dev
```

Run Django separately from the project root:

```bash
venv\Scripts\python.exe manage.py runserver
```
