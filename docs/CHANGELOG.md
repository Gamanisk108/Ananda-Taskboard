# Changelog

All notable changes to Ananda Taskboard. Newest first.

## [In review 2026-06-10] — Full review sweep: fixes, mobile shell, professional layer
The 2026-06-10 full review (punch-list: `qa/qa-2026-06-10-findings.md`); PRs
#8 (conformance) → #9 (mobile shell) → #10 (professional layer), pending merge.
- **Fixed broken:** PWA install icons never existed (manifest pointed at absent
  `pwa-192/512.png` — now generated from the real lotus mark + apple-touch-icon;
  off-brand template favicon replaced); Unscheduled-tasks modal rendered an
  empty box (`.rise` ancestor transform trapped the fixed backdrop — Modal now
  portals to `<body>`); the Archive toggle was a silent no-op (`viewProps`
  never passed `showArchived`).
- **Design conformance:** DN5 Archive→account menu · DN4 filter scoping (Project
  filter only on Global Overview; stale scope filters reset) · DN3 leftover Team
  Holidays tab removed · proj-pills on Copy-summary + Approvals · login wordmark
  in Fraunces + gold tagline · dark-mode Unscheduled button AA contrast · modal
  tables scroll instead of clipping (D42) · `.tcard` left-aligned.
- **Approvals:** reject (single + bulk) now confirms; pending-count badge on the
  nav button.
- **Translation moderation (new):** contributors can withdraw their own
  suggestion; superadmin can dismiss a variant from the poll (2 new DELETE
  endpoints, 5 pytest cases, confirm dialogs).
- **Mobile native-feel shell:** 54px app bar (hamburger · brand · + · kebab),
  drawer with account actions + `.duser` footer, bottom tab bar (4 views,
  line-art), full-screen modal variant for 27 dialogs with hardware-Back
  support. (Compact `.trow` Trash/Approvals rows deferred.)
- **Professional layer:** hosted `/privacy` + `/terms` pages (linked from Login
  + Settings) · in-app account deletion (`POST /api/me/delete`, password
  re-auth, sole-admin guard, 5 pytest cases) · read-only demo account command
  (`create_demo_account`) · env-gated Sentry on backend+frontend (dormant until
  DSN set).
- **Hygiene:** boot no longer fires an unauthenticated `/api/me` (red console
  401 on every load); `platform.tier` mistranslation fixed in 12 locales;
  20 new i18n keys ×13 locales.

## [Shipped 2026-06-10] — Help Us v2 fidelity + Settings, Events/Holidays, media uploads
Built from `design/Claude Design/handoff6-9-2026` (D44–D48) + Gordon's rulings;
deployed to Render across PRs #2–#6 (each browser-QA'd light+dark, then verified live).
- **Settings = popup modal, role-filtered panes:** Account (read-only email as text
  D45, Light/Dark theme segmented D48, in-pane change-password sub-view + new
  `POST /api/auth/password/change`), Notifications (daily-digest / deadline-reminder
  / assignment-change toggles over free PWA push), Task statuses (drag-reorder,
  circle swatch, "Task Complete" pill, 5 statuses), Events & Holidays.
- **Events & Holidays (D47):** renamed + tabbed; per-member **personal vs org-wide**
  scope for both events and holidays (admins add team-wide or personal, members
  manage their own; `CalendarEvent.owner` + `PersonalHoliday` model). New
  **Italian holidays** set (default on). Segmented controls gained an outline.
- **Help Us hub:** 3 cards (Spread the word deferred, D48), one-word verbs,
  full-width centered CTAs. Contributor: invisible `{{placeholders}}` shown as a
  `___` blank (re-inserted on save), saved-row lock-in, 555 personal-coverage,
  prayer-hands all-done (D43). Review poll: matches-current flag, free-text
  override, top-5 collapse, softened confirm, de-duplicated live row.
- **Media attachments (Cloudflare R2):** images/docs/short-video on tasks,
  subtasks, and bug reports — list + drag/click upload popup; client-side image
  compression; presigned direct-to-R2 upload; private bucket served via signed
  links; ≤5/item; report media 90-day purge. **Dormant until R2 env+CORS set —
  see `docs/r2-media-setup.md`.**
- **i18n:** all new keys across 13 locales (European/zh authored; Indic
  best-effort, flagged for native review). boto3 added.

## [Unreleased] — "Help Us" + Community Translations (functional v1, 2026-06-09)
Built per `design/Claude Design/Ananda Taskboard Help Us Handoff/` + the code
audit rulings in its `CODE-AUDIT-FEEDBACK.md` (§12). Visual fidelity pass
deferred until Claude Design's revised handoff lands.
- **Backend:** new `translations` app (per-member suggestions, unique per
  key+locale+user; live overrides, one per key+locale; superuser review/approve/
  clear endpoints) + new `feedback` app (problem reports w/ compressed
  screenshot stored in Postgres + 90-day purge on the daily job; feature
  suggestions; owner email notify). 18 new pytest tests.
- **Runtime i18n overrides:** string resolution is now override → bundled →
  English; approvals go live with no redeploy (boot fetch + window-focus
  refetch via TanStack Query).
- **Settings rework (D36):** member-visible with role-filtered section-nav —
  Account · Notifications · Task statuses (admin) · Calendar & holidays (admin)
  · Help Us. Language picker, notification enable, and daily-push toggle moved
  from the account menu into panes.
- **Help Us hub (D36/D40/D41):** four ask-cards; Improve translations
  (per-row save/edit loop, personal-coverage meter, search, exact-normalized
  fuzzy-merge fan-out, {{placeholder}} chips + validation); Report a problem
  (mono TB-ref); Suggest a feature; Spread the word (signup-link referral +
  `?signup` deep link).
- **Translation review (D38):** superadmin poll graph beside Platform overview —
  variant bars, submitter expander, styled go-live confirm, clear override,
  placeholder warnings.
- **i18n:** 129 new keys × all 13 locales (parity verified, 684 keys each).
- **Fix:** full-width buttons packed their label left (off-center "Sign in") —
  new `.btn-full` utility applied to all nine auth-surface buttons.

## [1.1] — post-launch iteration (deployed to Render + Neon Postgres)
Shipped since v1.0.0 (all live on `main`, browser-QA'd each step):
- **Persistence:** deployed single-server to Render; data on **Neon Postgres**
  (DATABASE_URL, SSL-aware parser) — survives redeploys. `/api/health` reports DB.
- **Task editing:** editable Project/Sub-project (move tasks); status change no
  longer closes the modal; Delete grouped with Cancel/Save; **Start date** +
  calendar **spanning** start→deadline (deadline-only spans from creation date).
- **List:** combinable filters (project/sub-project/assignee/status/recurring) +
  search + sort; separate Project & Sub-project & Assignee columns.
- **Assignees:** collapsed-with-search picker (by name; admin group filter +
  whole-group assign); initials on calendars with full-name hover.
- **Calendar:** Weekly = Google-Calendar spanning bars (lane-packed, initials,
  ⏰ due day); Monthly assignees + month-dated cells; **birthdays/events** as
  text (🎂/📌); **overdue = whole row/bar tinted red + ❗** in List/Weekly/Monthly.
- **Admin in-app:** Team (members/groups/grants), Manage Projects (colors,
  **emoji**, delete-with-move), Settings (push time, events), **Trash** (soft-delete
  + 7-day restore), approvals inbox (clickable). Account menu dropdown.
- **Copy Summary:** rebuilt — grouped **by person** (alpha), deadlines, project
  emoji, filters (project/person/group), live preview.
- **Phase 2:** assign-to-group (live); subtasks + webhooks (on a side branch).
- **Theme:** Ananda "Temple of Light" (Nayaswami blue / ivory / temple gold,
  Fraunces + Instrument Sans). **Mobile-responsive** layouts.
- **Ops:** Django admin backup access + dumpdata documented (deploy-runbook).

## [1.0.0] — 2026-06-02
### Verified
- **Step 12 — Verify.** End-to-end verification passed: `manage.py check` clean,
  **137 backend tests pass**, frontend production build clean (335 modules), and a
  live smoke test confirmed admin project listing, approvals inbox, CSV export
  (sanitized header), group-chat summary (grouped + OVERDUE flag), and the
  secret-gated daily-push job (200 with secret, 403 without). v1 feature-complete
  per the brief (Phase-2 items deferred: subtasks, native apps, webhooks, group
  task-assignment).

## [Unreleased]
### Security
- **Daily-push visibility leak fixed.** `tasks_for_user` now filters by the
  permission engine, not just assignment — an assignee without access to a task's
  sub-project no longer sees its title in their push. Regression test added.
  (Found in security review pass 2; see `docs/security-review.md`.)

### Added
- **Deploy-ready (open from anywhere).** `render.yaml` Blueprint = one free Render
  service serving app + API (no CORS), `Procfile`, gunicorn + whitenoise (prod
  static), production-only manifest storage. Beginner deploy walkthrough in the
  runbook. Local one-click `.bat` remains the no-account option.
- **webapp QA:** `qa/webapp_smoke.py` Playwright suite — 25/25 checks (admin flow,
  task create with Project/Sub-project/assignees, sortable columns, weekly/monthly,
  Team/Manage/Settings panels, and permission gating for a member-via-group user).
- **One-click launch (no PowerShell).** Django now serves the built React SPA from
  `frontend/dist`, so the whole app runs from a single server at
  `http://localhost:8000`. Root `Start Ananda Taskboard.bat` (double-click →
  migrate, open browser, run) and `Setup (run once first).bat` (install + build +
  seed). SPA fallback routing; `/api/*` still 404s correctly. Verified live.
- **Admin in-app (no Django dashboard needed).** Delete projects & sub-projects
  from Manage Projects; in-app **Settings** (⚙) for daily-push hour/minute +
  timezone (`AppSettings` singleton, `GET/PATCH /api/settings`, admin-only).
- **Phase 2 — assign tasks to whole Groups.** `Task.assignee_groups`; group
  members count as assigned for the daily push. Group picker in the task modal
  (admin). Tests for group-assignment + settings (validation, admin-only).
- **UX pass 2 — Team & Permissions admin.** Admin can add team members
  (name/email/starting password; free, no email service — Phase-2 email invites
  left as a clean future add), promote/disable members, reset passwords; create
  Groups and manage membership; and grant/revoke access (person *or* group →
  sub-project *or* whole project, Member/Viewer) — all in a new tabbed **Team**
  panel. Backend: `POST /api/users` + `PATCH /api/users/{id}` (admin, self-lockout
  guarded), `GroupViewSet` CRUD (`/api/groups`). 8 new tests. Verified live
  (create member → group → grant → member sees it via group).
- **UX pass 1.** Task modal now has separate **Project** and **Sub-project**
  dropdowns (cascading), an **assignee picker** (everyone listed; no-access users
  grayed with a hover note), and the title field is labeled **Task name**.
  List view: separate **Project** & **Sub-project** columns, an **Assignees**
  column, and click-to-sort headers + a "Most recent" toggle. New admin
  **Manage projects** panel (create/edit projects & sub-projects, names, colors,
  trusted toggle) — edits refresh the tab tree live. Backend `GET /api/users`
  (users + their accessible sub-project ids) with 2 tests.
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
