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

## Users & Groups
- `GET /api/users` — active users + accessible sub-project ids (any auth user;
  powers assignee picker). `POST` (admin) creates a member `{name,email,password,
  role}`. `PATCH /api/users/{id}` (admin) — name/role/is_active/password reset;
  can't demote/deactivate self.
- `GET/POST/PATCH/DELETE /api/groups` (admin) — Groups; body `{name, member_ids}`.

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

## Comments (step 8)
- `GET /api/tasks/{id}/comments` · `POST {text}` — any user with visibility to
  the task (incl. Viewers). Hidden task → 404. Empty text → 400.

## Subtasks / checklist (Phase 2)
- `GET /api/tasks/{id}/subtasks` · `POST {title}` — view by anyone with task
  visibility; add by admin/member/assignee (viewers 403; hidden task 404).
- `PATCH/DELETE /api/subtasks/{id}` — `{title, is_done, position}`; same edit rights.

## Webhooks (Phase 2, admin)
- `GET/POST/PATCH/DELETE /api/webhooks` — `{url, events, active}`. `events` is a
  comma-separated list of event names (blank/`*` = all). On a matching task event
  the seam POSTs `{event, data}` to the URL.

## Export (step 9)
- `GET /api/export?fmt=csv|xlsx&project=&subproject=&status=` — permission-
  filtered, approved-only. CSV is formula-injection sanitized; empty → header-only
  valid file. Returns a file download.

## Notifications (step 10)
- `GET /api/push/config` → `{vapid_public_key}`.
- `POST /api/push/subscribe` (PushSubscription JSON) · `DELETE` `{endpoint}`.
- `GET /api/summary/groupchat?date=` → `{text}` plain-text paste-ready summary.
- `POST /api/jobs/daily-push` — header `X-Daily-Push-Secret`; runs the daily push
  (silent for users with nothing; once per local day). Returns counts.
