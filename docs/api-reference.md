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

_(more added per step: tasks, approvals, comments, export, summary, push, jobs)_
