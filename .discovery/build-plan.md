---
project: ananda-taskboard
status: built-v1.0.0
created: 2026-06-02
source-spec: taskboard-goal-brief.md
brainstorm: .discovery/brainstorm-progress.md
complexity: large
---

# Ananda Taskboard — Design Spec & Build Plan

A PWA task board for a small in-house team. Hierarchy **Project → Sub-project →
Task**; global Admins; visibility gated per Sub-project, grantable to individuals
or Groups; overviews appear only when there's >1 item to consolidate. Built to
the EXTREME edge-case QA standard (§12 of the brief) with living dev docs.

This document supersedes the open questions in the brief. All §14 decisions are
now resolved (see "Locked decisions").

---

## 1. Locked decisions (from brainstorm)

| # | Decision | Resolution |
|---|----------|-----------|
| 1 | Sub-projects | **Always-default** ('General'); UI hides the layer when it's the only one. Every Task lives under exactly one Sub-project (uniform model). |
| 2 | Access-level conflict | **Most-permissive wins** (Member > Viewer). Effective access = union of direct + group grants. |
| 3 | Approval scope | **Creation + content edits** → Pending Approval. Status changes by assignees stay direct. |
| 3b| Approval load (Gordon's caveat) | Per-Sub-project **"Members can post without approval"** toggle (default OFF) → trusted teams post live instantly. Plus ONE consolidated approvals inbox, batched notifications, bulk approve/reject. |
| 4 | Recurrence end | **Optional**: indefinite, OR end date, OR after N occurrences. Stops exactly. |
| 5 | Overdue | Flag in views (red) **and** include in daily push until resolved. |
| 6 | Export | **CSV + XLSX**, permission-respecting, CSV formula-injection sanitized. |
| 7 | Empty daily push | **Stay silent** when nothing due/overdue. |
| 8 | DB | **SQLite now**, DB-agnostic ORM → Postgres later is a config swap. |
| 8b| Hosting | **Render free tier** + **GitHub Actions cron** → secured endpoint wakes service & fires daily push. |
| + | Push transport | **Web Push (VAPID)** for Phase A PWA. Native iOS via Capacitor+APNs deferred to Phase B. |
| + | Aesthetic | Clean utilitarian / data-dense (Linear/Notion-adjacent, strong color-coding) **with rounded corners + softer/warmer palette**. |

---

## 2. Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│  React 18 + Vite 5  (PWA, Capacitor-ready)                   │
│  - Auth, Project/Sub-project tabs, List/Weekly/Monthly views │
│  - Service worker (offline shell + Web Push subscription)    │
│  - Talks to backend over REST (/api), JWT in memory + refresh│
└───────────────▲─────────────────────────────────────────────┘
                │ HTTPS /api  (Vite proxy in dev → :8000)
┌───────────────┴─────────────────────────────────────────────┐
│  Django + Django REST Framework                              │
│  - Auth (JWT), permission engine (the access-grant union)    │
│  - REST API (server-side authz on EVERY endpoint)           │
│  - Event layer (emit task.created / .approved / .status …)   │
│  - Recurrence engine (occurrence generation, DST-safe)       │
│  - Daily-push builder + Web Push sender                      │
│  - CSV/XLSX exporter (permission-filtered, sanitized)        │
│  - Group-chat summary generator (plain text)                 │
└───────────────▲─────────────────────────────────────────────┘
                │
        SQLite (DB-agnostic ORM)        GitHub Actions cron
                                        → POST /api/jobs/daily-push (secret)
```

**Key seams (built for, not over-built):**
- **Permission engine** — single module `permissions/engine.py` computing a
  user's visible Sub-projects + level. Every queryset and every endpoint runs
  through it. This is the highest-risk surface; it lives in ONE place.
- **Event layer** — `events/emit.py` fires typed events on task lifecycle
  changes. v1 just logs them; the seam lets Zapier webhooks bolt on later (§9)
  with no refactor.
- **Recurrence engine** — `recurrence/engine.py` turns a rule into concrete
  occurrences over a date window, timezone/DST-safe, per-occurrence status.

---

## 3. Data model (Django apps)

Apps: `accounts`, `projects`, `tasks`, `permissions`, `notifications`, `exporting`.

- **User** (accounts) — email (login), name, role (`admin` | `member`), is_active.
  Members get their capabilities from grants; Admins are global.
- **Group** (accounts) — name; M2M to Users. A user ∈ many groups.
- **PushSubscription** (notifications) — user, endpoint, p256dh, auth, created.
  Many per user (multi-device). Invalid ones pruned on 410/404 from push.
- **Project** (projects) — name, color, description.
- **SubProject** (projects) — name, color, description, project(FK),
  `members_post_without_approval` (bool, default False), is_default(bool).
- **AccessGrant** (permissions) — target = (user XOR group), subproject(FK),
  level (`member` | `viewer`), plus an Admin shortcut to grant a whole Project
  (materialized as grants for all current + future sub-projects; "whole-project"
  flag so future sub-projects auto-inherit).
- **Task** (tasks) — title, details, requirements, subproject(FK → resolves
  Project), assignees(M2M User), deadline(date, nullable), timeline_start/end,
  status (`todo|in_progress|done|delayed`), approval_state
  (`pending|approved|rejected`), created_by, created/updated, links (JSON list of
  URLs). recurrence_rule(FK, nullable).
- **RecurrenceRule** (tasks) — freq (`daily|weekly|monthly|yearly`), interval,
  end_date(nullable), count(nullable), anchor date.
- **TaskOccurrence** (tasks) — task(FK), date, status (independent per
  occurrence), generated/overridden flags. Materialized lazily over the queried
  window; edits to the rule affect FUTURE occurrences only.
- **Comment** (tasks) — task(FK), author, text (URLs for any media), created.

**Integrity rules baked in:** Task always has a SubProject (no orphan path);
a SubProject always has a Project; deleting a Project cascades with a confirm;
counts/roll-ups always de-duplicate a user across direct+group grants.

---

## 4. Permission engine (the highest-risk logic)

A single function `visible_subprojects(user) -> {subproject_id: level}`:
1. Admin → all sub-projects at `member` level.
2. Else: collect direct grants + grants of every group the user belongs to;
   include whole-project grants expanded to all that project's sub-projects.
3. Reduce to most-permissive level per sub-project (Member > Viewer).

Everything derives from this:
- **Project visible** ⇔ user has ≥1 of its sub-projects.
- **Project Overview tab** ⇔ ≥2 visible sub-projects in that project.
- **Global Overview tab** ⇔ ≥2 visible projects.
- Every list/search/export/push/summary query is filtered by this map.
- **Server-side authz on every endpoint** (not UI hiding): a request for a
  hidden sub-project's tasks → **403**, never data (IDOR-safe). Viewers blocked
  from create/approve/status-change at the API layer regardless of UI.

---

## 5. REST API (representative; full reference maintained in docs/)

```
POST   /api/auth/login, /api/auth/refresh
GET    /api/me                       → user + visible tree + tab flags
CRUD   /api/projects, /api/subprojects            (admin write)
CRUD   /api/groups, /api/grants                   (admin write)
GET    /api/tasks?level=&project=&subproject=&member=&group=&status=&from=&to=
POST   /api/tasks                    → member⇒pending unless sub-project trusted
PATCH  /api/tasks/:id                → content edit (re-enters pending if member)
POST   /api/tasks/:id/status         → assignee/admin only, direct
POST   /api/tasks/:id/approve|reject → admin only (idempotent; race-safe)
GET    /api/approvals                → admin inbox; POST /api/approvals/bulk
CRUD   /api/tasks/:id/comments       → any visibility
GET    /api/export?fmt=csv|xlsx&… (same filters; permission-filtered)
GET    /api/summary/groupchat?date=  → plain-text WhatsApp/Slack block
POST   /api/push/subscribe|unsubscribe
POST   /api/jobs/daily-push          → secret-gated (GitHub Actions cron)
```

Idempotency/locking on approve/reject and status to resolve §12 concurrency
races (double-approve, simultaneous done) to one consistent final state.

---

## 6. Frontend structure & views

- **Shell:** top-level tabs = visible Projects (+ Global Overview if ≥2). Inside
  a Project: sub-project tabs (+ Project Overview if ≥2). Layer auto-hides at one.
- **Views** (each runs at sub-project / project-rollup / global level):
  - **List** — spreadsheet table; search + filter (project, sub-project, member,
    group, deadline, status); sortable columns; overdue rows flagged red.
  - **Weekly** — one column per day; group/sort by project/sub-project/member/
    chrono/alpha; tasks show their color.
  - **Monthly** — calendar grid; color-coded count badges (by Project at
    global/project-overview level, by Sub-project inside a Project); click a day
    → that day's task list.
- **Approvals inbox** (admin) — consolidated, bulk approve/reject.
- **Export button** + **"Copy group-chat summary"** button.
- **Aesthetic:** data-dense Linear/Notion feel, rounded corners, softer/warmer
  palette; color tokens drive project/sub-project coding. Committed in Phase 3
  (frontend-design): typography, exact palette, spacing scale, component shapes.

---

## 7. Notifications, recurrence, export, summary

- **Daily push:** GH Actions cron → `/api/jobs/daily-push` (secret). Builds each
  user's list of today's + overdue tasks (permission-filtered, de-duped); sends
  Web Push. **Silent if empty.** Admin-set time, default 8:00 AM PST; DST-safe;
  fires once per user per day on the correct local day.
- **Approval requests:** batched notification to admins (not one ping per task).
- **Recurrence:** occurrences generated over the queried window; per-occurrence
  status; rule edits affect future only; end date/count stops exactly; Feb-29 /
  31st-of-month / month-&-year boundaries handled explicitly.
- **Export:** current view → CSV + XLSX; never includes hidden sub-projects;
  CSV formula-injection (`= + - @`) sanitized; commas/quotes/newlines/emoji safe;
  empty export still valid.
- **Group-chat summary:** plain text grouped Project → Sub-project → member,
  paste-ready for WhatsApp/Slack.

---

## 8. File / folder structure

```
Ananda Taskboard/
├─ backend/                 Django project
│  ├─ config/               settings (env-driven, DB-agnostic), urls, wsgi/asgi
│  ├─ accounts/  projects/  tasks/  permissions/  notifications/  exporting/
│  ├─ events/               emit.py (event seam)
│  ├─ manage.py  requirements.txt
│  └─ tests/                pytest; edge-case suites per §12
├─ frontend/                React 18 + Vite 5 PWA
│  ├─ src/{api,components,views,state,pwa}/  public/{manifest,sw}
│  └─ package.json  vite.config.ts (proxy /api → :8000)
├─ .github/workflows/daily-push.yml      cron → daily-push endpoint
├─ docs/                    living docs (README, architecture+ERD, API ref,
│                           deploy/ops runbook, permissions matrix, CHANGELOG,
│                           decision log)
└─ .discovery/             brainstorm-progress.md, build-plan.md (this file)
```

---

## 9. Build order (dependencies first)

1. **Scaffold** backend (Django+DRF) + frontend (Vite PWA) + docs skeleton + CI cron file.
2. **Accounts & auth** — User, Group, JWT login, /api/me.
3. **Projects & sub-projects** — models + admin CRUD + default-subproject logic.
4. **Permission engine** — grants, the union function, `/api/me` tree + tab flags.
   *(TDD here first — highest risk.)*
5. **Tasks core** — model, create/edit, approval workflow + trusted-toggle, status rules.
6. **Recurrence engine** — rules, occurrence generation, edge cases. *(TDD.)*
7. **Views API + frontend** — list/weekly/monthly, filters, overview tabs.
8. **Comments.**
9. **Export** — CSV/XLSX, sanitization, permission filtering.
10. **Notifications** — Web Push subscribe, daily-push builder, GH Actions cron,
    approval batching, group-chat summary.
11. **Hardening pass** — full §12 edge-case suite + `security-review` on the API.
12. **Verify** — end-to-end run, `verification-before-completion`.

Living docs updated at the end of each step (not written once at the end).

---

## 10. Dependencies

- Backend: Django, djangorestframework, djangorestframework-simplejwt,
  pywebpush, openpyxl (XLSX), python-dateutil (recurrence/DST), pytest-django.
- Frontend: react, react-dom, vite, react-router, a lightweight data/table layer,
  date-fns, vite-plugin-pwa, (Capacitor added in Phase B only).

---

## 11. QA standard (§12 — EXTREME, non-negotiable)

TDD for permission + recurrence logic; `verification-before-completion` before
any "done"; `security-review` on the API. Every test uses a real assertion (no
console.log fakes); each test proves what its name claims; edge cases enumerated
BEFORE writing tests and signed off at the test phase. Priority surfaces:
permission union & cross-leak, server-side authz/IDOR, recurrence/DST/boundaries,
approval & status concurrency races, export sanitization, data/UI extremes.

---

## 12. Phase 2 (deferred, not built now)

Subtasks · native store apps (Capacitor) · outbound webhooks/Zapier · assign a
whole Group to a task.

---

## Single approval point

This is the one approval gate. On approval I proceed: writing-plans →
frontend-design (Phase 3 visual commit) → execute build order §9 → §12 tests →
verify. No further approval needed mid-build unless the plan must change.
