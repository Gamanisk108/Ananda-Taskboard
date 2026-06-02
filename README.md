# Ananda Taskboard

A free, installable (PWA) task board for a small in-house team. Hierarchy
**Project → Sub-project → Task**, with list / weekly / monthly views, recurring
tasks, comments, an Admin-approval workflow, CSV/XLSX export, a daily push, and a
one-click group-chat summary. Global Admins; visibility gated per Sub-project and
grantable to individuals or Groups.

- **Backend:** Django + Django REST Framework (`backend/`)
- **Frontend:** React 18 + Vite 5 PWA, Capacitor-ready (`frontend/`)
- **DB:** SQLite (DB-agnostic; Postgres later via `DATABASE_URL`)
- **Push:** Web Push (VAPID); daily job fired by GitHub Actions cron

Full design + decisions: `.discovery/build-plan.md` and `taskboard-goal-brief.md`.
Build progress / resume point: `.discovery/BUILD-STATE.md`.

## Quick start (development)

### Backend
```bash
cd backend
py -3.13 -m venv venv
./venv/Scripts/python.exe -m pip install -r requirements.txt
./venv/Scripts/python.exe manage.py migrate
./venv/Scripts/python.exe manage.py createsuperuser   # creates a global Admin
./venv/Scripts/python.exe manage.py runserver         # http://localhost:8000
```
Health check: http://localhost:8000/api/health

### Frontend
```bash
cd frontend
npm install
npm run dev      # http://localhost:5173  (proxies /api → :8000)
```

Run both servers together; Vite proxies `/api` to Django.

## Documentation
- `docs/architecture.md` — system overview + data model / ERD
- `docs/api-reference.md` — endpoints, auth, payloads
- `docs/permissions-matrix.md` — role × capability
- `docs/deploy-runbook.md` — hosting, env vars, scheduled job, push setup
- `docs/design-system.md` — visual contract (typography, color, components)
- `docs/CHANGELOG.md` · `docs/decision-log.md`

## Testing
EXTREME edge-case standard (see `taskboard-goal-brief.md` §12). Backend:
```bash
cd backend && ./venv/Scripts/python.exe -m pytest
```
