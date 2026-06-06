# Build plan — Sign Up + Multi-Tenancy (Phase 1)

Status: AWAITING APPROVAL (Phase 4). No code until Gordon approves.
Complexity: **Large.** Single-tenant → full-isolation multi-tenant. The riskiest
piece is re-scoping `permissions/engine.py` (the one visibility chokepoint) and
turning global `is_admin` into per-org `is_org_admin`.

## Phase 2 (NOT now): email invitations to existing accounts; localize reset email.

## Superadmin (Gordon) cross-org viewing — ETHICAL MODEL (revised 2026-06-05)
Gordon's call: the platform owner must NOT be able to read the contents (tasks,
project data) of orgs he doesn't belong to — that's not ethical. He gets
metadata-only stats instead.
- **DONE — removed the cross-org data bypass:** engine `is_org_admin`/`_in_org`
  no longer special-case superuser; a superuser sees an org's data only via a
  real membership, like anyone. `/api/me` returns only the superuser's actual
  memberships (no all-orgs switcher).
- **DONE — metadata-only stats:** `GET /api/platform/orgs` (IsSuperUser) returns
  per-org name/city/country, admins (name+email), counts (projects/sub-projects/
  tasks/members), and the member roster with role + tier. NO task content. UI:
  `PlatformStats.tsx` modal behind a superuser-only 🌐 button. 5 tests incl.
  "stats never expose task content" + "superuser can't read another org's tasks".
- **Note:** Django `/admin` still has raw DB access (infra-level, Gordon owns the
  server). If desired later, lock that down too — not done here.
- **Future (Phase 2+):** richer console — activity, suspend/delete org.

---

## 1. Data model (new + changed)

**New — `accounts/models.py`:**
- `Organization`: name, city, country, slug, `created_by`→User,
  `is_active` (False until creator verifies email), created_at.
- `Membership`: `user`→User, `organization`→Organization,
  `role` (admin|member), `tier`→Tier (null), is_active, created_at.
  `unique_together(user, organization)`.

**Changed:**
- `User`: keep email/name/password/is_active/is_superuser. **Deprecate** global
  `role` + `tier` (kept as columns for the migration, no longer used for org
  logic). `is_active=False` on signup until verified. Drop the `is_admin`
  property's authority (replaced by `is_org_admin(user, org)`).
- `Project` (+`organization`→Organization, required).
- `accounts.Group` (+`organization`→Organization; name unique per org).
- `accounts.Tier` (+`organization`→Organization; name unique per org).
- SubProject / Task / AccessGrant / Exclusion: unchanged columns (reach org via
  Project), but all querysets filter by org through the engine.

## 2. Permission engine — `permissions/engine.py` (highest risk)
- Add `org` param: `access_map(user, org)`, `visible_tasks_q(user, org)`,
  `excluded_targets(user, org, …)`, `visible_subproject_ids(user, org)`, etc.
- New `is_org_admin(user, org)` = `user.is_superuser or Membership.objects
  .filter(user, organization=org, role=admin, is_active=True).exists()`.
  Replaces every `getattr(user, "is_admin", …)` in the engine.
- Grants/exclusions/tiers/groups resolved through the user's **membership in
  that org** (tier_id + group_ids come from the membership/org, not the user).
- `permissions/tree.py` `visible_tree(user, org)` scoped to org's projects.

## 3. Request org-context — `permissions/drf.py` (or middleware)
- Resolve active org from `X-Org-Id` header → `request.org`, `request.membership`.
- 403 if header missing/!member on org-scoped endpoints (signup/login/reset/
  verify/`/api/me`/memberships list are exempt — they set or read context).
- New permission class `IsOrgAdmin` replaces global `IsAdmin` on org endpoints.

## 4. API — `accounts/`
- `POST /api/auth/signup` {organization, name, email, password, city, country}
  → create inactive User + inactive Org + admin Membership → send verify email
  → 201. Public. Reject duplicate email (existing account → tell them to log in;
  invite-to-existing is Phase 2).
- `POST /api/auth/verify` {uid, token} → activate User + their created Org → 200.
- `GET /api/me` → user + `memberships:[{org_id,name,role,tier}]` + active org's
  `tree` (from X-Org-Id) + org-scoped `groups`. No membership header → memberships
  list only (client then picks one).
- Existing user/group/tier/project/task endpoints: scope to `request.org`;
  member management creates User+Membership in the active org.

## 5. Data migration (Django migration, idempotent)
- Create "Ananda Los Angeles" org (city "Los Angeles", country "USA"),
  is_active=True.
- Attach all existing Projects → that org.
- For each existing User: Membership(user, org, role=old User.role, tier=old
  User.tier, is_active=True). Superuser stays superuser.
- Attach existing Groups + Tiers → that org.

## 6. Frontend — `frontend/src/`
- `state/auth.tsx`: hold `memberships` + `activeOrgId` (localStorage); expose
  `setActiveOrg`. On login/refresh, default active org = first membership.
- `api/client.ts`: send `X-Org-Id: <activeOrgId>` header in `raw()` (one place)
  + in the login/signup helpers as needed.
- `components/Signup.tsx`: org name, name, email, password, city, country →
  POST signup → "verify your email" screen (mirrors ForgotPassword's sent state).
- `App.tsx`: handle `?verify&uid=&token=` deep-link (same pattern as `?reset`) →
  activate → login. Add **org switcher** dropdown in the topbar when
  `memberships.length > 1`; switching changes activeOrgId → refetch /api/me.
- `components/Login.tsx`: add "Create an account" link → Signup.
- i18n: signup + verify + switcher strings × 13 locales (key parity test enforced).

## 7. Tests (rule 7 — auth/permissions = high stakes → integration tests)
Backend (pytest):
- signup creates inactive user+org+admin membership; no login until verified.
- verify activates user + org; then login works.
- **Isolation:** user in Org A cannot see Org B's projects/tasks via the engine
  (access_map/visible_tasks_q return nothing for the other org).
- org admin scoping: admin of A is not admin of B.
- super-admin sees across orgs.
- data migration: existing users → memberships in Ananda LA; projects attached.
- X-Org-Id resolution: missing/foreign org → 403.
Run full suite + i18n parity + tsc + build + Fallow before claiming done.

## PROGRESS (2026-06-05)
- **Step 1 — models + migration: DONE, green.** Organization, Membership;
  Project/Group/Tier org FK; seed migration folded dev data (5 users, 3 projects)
  into "Ananda Los Angeles". Model tests pass.
- **Step 2 — engine org-scoping: DONE, green.** `is_org_admin`, `_in_org` gate,
  per-org tier/groups; every engine fn takes optional `org` (None = legacy/global,
  keeps old tests green). 5 isolation tests prove tenant separation + membership
  gate beating stray grants + superuser cross-org.
- **Step 3 — signup + verify: DONE, green.** `/api/auth/signup`, `/api/auth/verify`,
  dedicated verification token (separate salt). 8 tests.
- **Step 4 — view wiring: CORE DONE.** OrgContextMiddleware (X-Org-Id → request.org);
  IsAdmin/IsAdminOrReadOnly now org-aware; tasks/views, projects/views,
  accounts (MeView memberships+per-org tree+is_admin, UsersView/UserDetailView
  org-scoped + membership mirror, Group/TierViewSet scoped), permissions grants +
  exclusions scoped.
  - **REMAINING (secondary, legacy org=None — correct for single-org Phase 1):**
    thread `org` into exporting/export.py + views, tasks/calendar.py,
    tasks/events_views.py, tasks/bulk.py, tasks/history_service.py for full
    superuser-cross-org correctness. notifications/daily.py + summary.py
    intentionally stay org=None (cross-org daily digest per user). AuditLog has no
    org column → audit feed stays global (low-sensitivity, admin-only); add org FK
    later if needed.
- **Step 5 — frontend: DONE.** types (OrgMembership, Me.memberships/active_org);
  client.ts (activeOrg localStorage + X-Org-Id header on every call + signup/verify
  methods); auth.tsx (default active org + switchOrg); Signup.tsx; VerifyEmail.tsx
  (?verify deep-link); Login "Create an account" link; App.tsx org switcher (topbar,
  shown when >1 membership) + ?verify gate; i18n signup/verify/org ×13 (parity green).
  tsc + production build green.

## E2E (Playwright, live servers) — 2026-06-05
Ran qa/e2e_signup.py against live Django+Vite: signup → file-based email → verify
link → login as new org admin → switch to superuser → Platform stats. 11/11 checks.
- **Bug the e2e caught (unit tests missed it):** TaskViewSet/Comment/Subtask
  get_queryset did `if not is_org_admin: filter(...)` → an org ADMIN got NO filter
  and saw EVERY org's tasks (cross-org leak). Fixed: always apply visible_tasks_q
  (engine already org-scopes admins); also `can_act_as_member` now scopes via
  access_map; `_require_visible_subproject` drops the admin bypass. Added
  view-level isolation tests (test_isolation.py) that reproduce it.
- **Settings:** added `EMAIL_FILE_PATH` (default BASE_DIR/sent_emails) so the
  file-based email backend works for local/E2E.
- **Process note:** ~114 zombie `runserver` procs had accumulated; a stale one on
  :8000 served pre-fix code and masked the fix for several runs. Killed all; clean
  server confirmed founder sees 0 tasks. (Consider a `taskkill` helper / always
  --noreload + explicit shutdown when running the app.)

## Hardening follow-ups (2026-06-05, post-E2E)
- **API-layer isolation suite** (`permissions/test_api_isolation.py`): for every
  org-scoped list endpoint, an org admin + member never see another org's rows;
  plus IDOR checks (other org's task/comments → 404). Building it surfaced more
  admin-bypass leaks, now fixed:
  - `CalendarView`, `exporting.export._queryset`, `ApprovalsView` (GET) — always
    run through `visible_tasks_q(user, org)` (were admin-bypassed → cross-org).
  - Write paths scoped too: `ApprovalsView.post`, `BulkTasksView`, `MarkDoneView`
    now restrict target tasks to `visible_tasks_q(user, org)`.
  - Still global by design: `/api/statuses` (universal Kanban columns).
- **Phase 1.1 DONE — events + history org-scoped:**
  - `CalendarEvent` gets an `organization` FK (migration 0020 + backfill 0021);
    `CalendarEventViewSet` + `/api/events/range` scoped to the active org.
  - `/api/history`: each snapshot row is tagged with `organization_id` and
    `HistoryView` filters by the active org (older untagged rows excluded, not
    leaked). Isolation suite now also covers `/api/events`, `/api/events/range`,
    `/api/history`. Only `/api/statuses` remains global (by design).
- **qa/kill-servers.ps1**: kills stray Django `runserver` + Vite procs and reports
  port 8000/5173 listeners (supports -WhatIf). Run before/after E2E so a stale
  server can't serve old code.

## VERIFY (final)
- backend full suite, i18n parity (26), tsc, vite build, Fallow (no dead code in my
  source; only minor untested-CRAP on new frontend fns, consistent with repo — no
  frontend test runner exists).
- NOTE: `backend/staticfiles/` (collectstatic output, vendored Django admin JS)
  is inflating Fallow's totals — it should be git-ignored / excluded from Fallow;
  not part of this feature.
- Manual end-to-end (next session): run app, sign up a new org, grab verify link
  from console email, verify, log in, confirm isolation + org switcher as superuser.

## 8. Build order (tested at each stop)
1. Models + data migration (+ migration test). 
2. Engine org-scoping + `is_org_admin` + org-context resolver (+ isolation tests).
3. Signup + verify endpoints (+ tests). 
4. Wire existing endpoints to request.org (+ regression run of full suite).
5. Frontend: auth state + header + Signup/verify + org switcher + i18n.
6. Full verification pass.

## Risks / call-outs
- Engine refactor touches every visibility path — staged + isolation tests first.
- `is_admin` is referenced across many views, not just the engine; step 4 is a
  careful sweep (grep `is_admin` / `IsAdmin`).
- Migration is one-way; run against the (near-empty) dev DB first.
- Estimated effort: large (multi-session). Approval gates the whole phase; after
  approval I execute autonomously, reporting at each build-order stop.
