# API Reference

> Living doc — endpoints are added here as each step implements them.
> Base path: `/api`. Auth: `Authorization: Bearer <access-token>` (JWT) except
> where noted. All endpoints enforce permissions server-side.

## Health
- `GET /api/health` → `{ "status": "ok", "service": "ananda-taskboard" }` (no auth)

## Auth (step 2)
- `POST /api/auth/login` — `{email, password}` → `{access, refresh}`
- `POST /api/auth/refresh` — `{refresh}` → `{access}`
- `GET  /api/me` — current user + visible project/sub-project tree + tab flags

_(more added per step: projects, grants, tasks, approvals, comments, export,
summary, push, jobs)_
