# Security Review — Ananda Taskboard API

Manual audit against the brief §12 authorization/security bar. Re-run the
automated `/security-review` slash command on any future PR diff.

Date: 2026-06-02 · Reviewer: build (step 11)

## Summary
No high-severity issues. Authorization is enforced server-side on every endpoint
and is covered by tests (permissions, IDOR, viewer-write, revocation). Two
**recommended prod hardenings** (login throttling, secret rotation) are noted
below — neither blocks in-house launch.

## Findings & controls

| Area | Status | Notes |
|---|---|---|
| **AuthN** | ✅ | JWT (SimpleJWT), 30-min access + rotating 14-day refresh. Passwords hashed (Django PBKDF2). Email login. |
| **AuthZ (server-side)** | ✅ | Every task/comment/export/calendar/summary query filtered by the permission engine. Admin-only on projects, sub-projects, grants, approvals. Tested. |
| **IDOR / object access** | ✅ | Hidden sub-project task → **404** (not data). Tested (`test_member_cannot_read_task_in_hidden_subproject`, hardening suite). |
| **Privilege escalation** | ✅ | Viewers cannot create/edit/approve/change-status via API even if UI exposes it. Mass-assignment closed: `approval_state`, `created_by`, `status` are read-only on the serializer (status/approval have dedicated, authorized endpoints). |
| **SQL injection** | ✅ | Django ORM only; no raw SQL / string-built queries. |
| **CSV formula injection** | ✅ | Export sanitizes leading `= + - @` / control chars. Tested. |
| **XSS** | ✅ | React escapes by default; no `dangerouslySetInnerHTML`. API is JSON. `links` are rendered as plain text (not auto-linked) — if later auto-linked, reject non-http(s) schemes. |
| **CSRF** | ✅ | API auth is Bearer JWT (no cookies) → CSRF N/A for API. Django admin keeps CSRF. |
| **CORS** | ✅ | Restricted to `CORS_ALLOWED_ORIGINS` (env). |
| **Secrets** | ✅ | `.env` gitignored; `DJANGO_SECRET_KEY`, `VAPID_*`, `DAILY_PUSH_SECRET`, `DATABASE_URL` all env-driven. Dev defaults clearly marked "dev-only". |
| **Scheduled-job endpoint** | ✅ | `/api/jobs/daily-push` gated by `X-Daily-Push-Secret`; not enumerable without the secret. |
| **Push** | ✅ | Dead subscriptions pruned on 404/410; send is no-op without VAPID (no crash). |
| **Error handling** | ✅ | Over-long / invalid input → clean 400, not 500 (tested). |

## Review pass 2 — 2026-06-02 (admin features, launcher, Phase-2)
Covered: member create/update, Group API, app settings, group-assignment, SPA
serving, launcher scripts.

| Area | Status | Notes |
|---|---|---|
| `POST/PATCH /api/users` | ✅ | Admin-only; password ≥ 8; self-demote/deactivate blocked; serializer field-limited (no mass-assignment of is_superuser except via role). |
| `GroupViewSet`, `/api/settings` | ✅ | Admin-only; settings validate hour/minute range + timezone via ZoneInfo (no injection). |
| **Daily push visibility leak** | 🔧 **FIXED** | `tasks_for_user` filtered by assignment but NOT visibility — an assignee lacking access to the sub-project could see a task title in their push. Now filtered through `visible_subproject_ids`. Regression test added (`test_assigned_but_no_access_excluded_from_push`). |
| SPA file serving | ✅ | Path-traversal guarded (`resolve()` + must stay within `frontend/dist`, `is_file()` only). Serves only built assets. |
| `GET /api/users` info exposure | ⚠️ low | Endpoint still returns all users' name/email + accessible sub-project ids to any authenticated user (needed for the assignee picker; data itself stays gated). The **Export** and **Copy Summary** person-filter lists are now scoped client-side (`peopleInMyScope`) so reduced-access users only see people sharing a sub-project they can reach. Broader server-side scoping of the endpoint is the pending "scope #2" work; do it if the org grows. |
| Launcher `.bat` | ✅ | Local only; no user input interpolated; runs the venv interpreter. |
| Automated `/security-review` | ℹ️ | Requires a GitHub remote (origin) to diff; run it on PRs once the repo is pushed for deploy. |

## Recommended prod hardenings (not blocking)
1. **Login throttling.** Add a DRF `ScopedRateThrottle` to the login view (e.g.
   5/min/IP) to slow credential stuffing. Left out of the default config so the
   test suite (which logs in frequently) isn't rate-limited; enable via settings
   in production. See `deploy-runbook.md`.
2. **Secret rotation + `DEBUG=False`.** Production MUST set
   `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=false`, real `ALLOWED_HOSTS`, and a long
   random `DAILY_PUSH_SECRET`. Use a constant-time comparison if the secret is
   ever shortened (current long random secret makes timing attacks impractical).
3. **HTTPS + secure cookies.** Host provides TLS; set `SECURE_*` flags when the
   domain is fixed (HSTS, `SECURE_SSL_REDIRECT`).
