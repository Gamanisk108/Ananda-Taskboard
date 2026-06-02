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

## Projects & Sub-projects (step 3) — admin write, others read (visibility-filtered)
- `GET    /api/projects` — list visible projects (admin: all; member: granted;
  each includes nested `subprojects`). `POST` (admin) creates a project +
  auto-creates its default 'General' sub-project.
- `GET/PUT/PATCH/DELETE /api/projects/{id}` — admin write.
- `GET /api/subprojects`, `POST` (admin). Fields: `name, color, description,
  members_post_without_approval, project`. `is_default` is read-only.
- `GET/PUT/PATCH/DELETE /api/subprojects/{id}` — admin write. PATCH the
  `members_post_without_approval` toggle to let a trusted team post live.

## Access grants (step 4) — admin only
- `GET/POST /api/grants`, `GET/PUT/PATCH/DELETE /api/grants/{id}`. Body: exactly
  one of `user`/`group` (target) + exactly one of `subproject`/`project` (scope,
  `project` = whole-project grant covering current + future sub-projects) +
  `level` (`member`|`viewer`). Invalid target/scope combos → 400.
- `GET /api/me` now returns `tree`: `{ projects: [{ id, name, color,
  show_project_overview, subprojects: [{ id, name, color, is_default, level }] }],
  show_global_overview }`. Overview flags follow the >1-to-consolidate rule.

## Tasks (step 5) — server-side authz on every op
- `GET /api/tasks` — visible + approved tasks. Filters: `?subproject= &project=
  &status= &member= &approval=`. Hidden sub-projects never appear.
- `POST /api/tasks` — create. Member needs Member-level on the sub-project
  (Viewers → 403; no access → 403, existence not revealed). Approval: admin or
  trusted sub-project → live; else `pending`. Body supports nested `recurrence`
  `{freq, interval, anchor, end_date?, count?}` (end_date XOR count) and `links`
  (list of URL strings).
- `GET/PUT/PATCH/DELETE /api/tasks/{id}` — task in a hidden sub-project → 404
  (IDOR-safe). Member content edit re-enters `pending` unless sub-project trusted.
- `POST /api/tasks/{id}/status` `{status}` — assignees or admins only; direct.
- `POST /api/tasks/{id}/approve` · `POST /api/tasks/{id}/reject` — admin only,
  idempotent + race-safe.
- `GET /api/approvals` — admin inbox of pending tasks.
- `POST /api/approvals` `{ids:[], action:'approve'|'reject'}` — bulk, idempotent.

## Calendar (step 7) — weekly/monthly timeline source
- `GET /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&project=&subproject=` —
  dated instances within the window: non-recurring tasks on their deadline,
  recurring tasks expanded per occurrence. Approved + visible only. Each instance
  carries project/sub-project name+color, status, `overdue`, `assignee_ids`.

_(more added per step: comments, export, summary, push, jobs)_
