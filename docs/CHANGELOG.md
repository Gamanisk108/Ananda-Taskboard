# Changelog

All notable changes to Ananda Taskboard. Newest first.

## [Unreleased]
### Added
- **Step 11 — Hardening.** Consolidated §12 edge-case suite (`test_hardening.py`,
  14 tests): server-side authz (viewer can't status/approve/edit-hidden),
  revocation safety, rejected-task invisibility, emoji/RTL/special-char roundtrip,
  graceful over-limit 400, duplicate-name rules, color-exhaustion cycling, empty
  states, push graceful-failure. **137 tests total.** Manual API security review
  → `docs/security-review.md` (no high-severity issues; prod hardening notes).
- **Step 10 — Notifications.** `PushSubscription` model + Web Push send wrapper
  (no-op without VAPID, prunes dead endpoints). Daily-push builder (per-user
  assigned/approved/visible tasks due today + overdue, deduped, **silent if
  empty**, local-time/DST-safe, once-per-day guard via `last_daily_push`).
  Secret-gated `POST /api/jobs/daily-push` (GitHub Actions cron). `push/config`,
  `push/subscribe` (+DELETE). Group-chat summary `GET /api/summary/groupchat`
  (plain text, Project→Sub-project grouping, visibility-respecting). Frontend:
  🔔 enable-push, Copy-summary button, custom SW push/notificationclick handler.
  13 tests (123 total).
- **Step 9 — Export.** `GET /api/export?fmt=csv|xlsx` (+ project/subproject/status
  filters), permission-filtered, approved-only. CSV formula-injection sanitized
  (leading = + - @ / control chars → prefixed `'`); commas/quotes/newlines/emoji
  preserved; empty export still valid (header row). XLSX via openpyxl. Export
  CSV/XLSX buttons in the view toolbar (blob download with auth). 13 tests (110
  total).
- **Step 8 — Comments.** `GET/POST /api/tasks/{id}/comments` (visibility-gated:
  any user who can see the task, incl. Viewers, may comment; hidden task → 404).
  Comment section in the task modal. 5 tests (97 total).
- **Step 7 — Views API + frontend.** Backend `GET /api/calendar` (recurring-task
  expansion, overdue flag, visibility, 7 tests → 92 total) + `seed_demo` command.
  React 18 PWA frontend: JWT client w/ auto-refresh, auth context, login, app
  shell (project tabs + Global/Project overview tabs gated by the >1 rule),
  view switcher, **List** (filter/search, overdue red flag), **Weekly** &
  **Monthly** (color-coded count badges, click-day) timeline views, task
  create/edit modal (recurrence UI, status changer, links, delete), admin
  approvals inbox (bulk). Design-system tokens (warm palette, rounded, Bricolage/
  IBM Plex). Verified end-to-end against live API (permissions enforced).
- **Step 6 — Recurrence engine (test-first).** `tasks/recurrence.py`:
  `occurrence_dates` (daily/weekly/monthly/yearly + interval, fast-forward for
  long gaps) and `materialize_occurrences` (per-occurrence status, future-only
  rule edits). Explicit edge policy: monthly-31st skips short months (no
  roll-over), yearly Feb-29 only in leap years, `count` stops exactly (counted
  from anchor), `end_date` inclusive (no off-by-one), date-based so DST never
  shifts the day. **20 tests** incl. the ludicrous cases + materialization
  idempotency/status-preservation. 85 total — all passing.
- **Step 5 — Tasks core.** `Task`, `RecurrenceRule`, `TaskOccurrence`, `Comment`
  models. Task viewset with server-side authz: visibility via the engine,
  create/edit approval (admin/trusted → live, else pending; Member edits
  re-enter pending), status endpoint (assignees/admin only), idempotent race-safe
  approve/reject, admin approvals inbox + bulk action. Events emitted via the
  seam. **24 tests** (approval paths, viewer/no-access 403, pending-hidden,
  IDOR 404, cross-leak, status auth, double-approve idempotency, recurrence/links
  validation). 65 total — all passing.
- **Step 4 — Permission engine (highest-risk, test-first).** `AccessGrant` model
  (user XOR group → sub-project XOR whole-project, level member|viewer, DB check
  constraints), `permissions/engine.py` (`visible_subprojects` union +
  most-permissive, whole-project live expansion incl. future sub-projects,
  helpers), `permissions/tree.py` (visible tree + overview-tab flags), admin-only
  grant API, `/api/me` now returns the real tree. **18 engine tests** covering
  no-grant=nothing, no cross-leak, overview-tab gating, direct+group union,
  two-group conflict, stale-membership revocation, whole-project future coverage,
  level helpers, admin-only + validation. 41 tests total — all passing.
- **Step 3 — Projects & sub-projects.** `Project` + `SubProject` models
  (palette-based color auto-assignment, `members_post_without_approval` toggle),
  auto-created default 'General' sub-project via signal, DB constraint enforcing
  one default per project, admin CRUD viewsets (members read-only, visibility
  stubbed for step 4), Django admin with inline sub-projects. 11 tests — all
  passing (23 total).
- **Step 2 — Accounts & auth.** JWT login (`POST /api/auth/login`, email-keyed) +
  refresh, `GET /api/me` (current user + stable `tree` placeholder), user/group
  serializers, Django admin for `User` (custom create form) and `Group`. 12 tests
  (email normalization, login success/failure, refresh, me auth-gating, role
  flags, group M2M) — all passing.
- **Step 1 — Scaffold.** Django + DRF backend (apps: accounts, projects, tasks,
  permissions, notifications, exporting, events) with env-driven, DB-agnostic
  settings, JWT + CORS + DRF configured, custom email-login `User` + `Group`
  models, `/api/health`, event seam, pytest. React 18 + Vite 5 PWA frontend
  (vite-plugin-pwa, router, date-fns) with `/api` dev proxy. Docs skeleton,
  GitHub Actions daily-push cron, `.env.example`, `.gitignore`, README.
