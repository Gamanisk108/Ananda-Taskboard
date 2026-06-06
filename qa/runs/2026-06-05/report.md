# Ananda Taskboard — Full QA Run (2026-06-05)

**Method:** Live browser QA via Playwright MCP against Vite dev (:5173) + Django API (:8000).
**Accounts:** admin@ananda.test (admin), mara@ananda.test (member), omar@ananda.test (viewer) — pw `taskboard123`.

Findings are tagged **[BUG]** (broken), **[UX]** (rough), **[POLISH]** (minor). Caveat: this is expert heuristic critique + functional testing, not a real user's lived reaction.

---

## ✅ Resolution — all findings addressed (2026-06-05)

Every 🔴 bug and every 🟡 UX/polish item below was fixed in the same session. Verified by 178 backend tests + 28 frontend tests + typecheck + production build, all green.

| # | Finding | Fix | Files |
|---|---------|-----|-------|
| 1 | Dark-mode "Today" white block | Dark `--wk-today`/`--mo-today` tokens → faint azure wash; the border frame is the signpost | `frontend/src/index.css` |
| 2 | Orphaned assignment (assignee can't see task) | `visible_tasks_q` now treats direct assignment as a task-granular allow (deny still wins); dropped the empty-amap early return + redundant `own_sps` path. Regression tests added | `backend/permissions/engine.py`, `backend/permissions/test_visibility.py` |
| 3 | Double/triple-click creates duplicates | Synchronous in-flight guard on task save + new `useSubmitGuard` hook on comment / add-member / invite / add-group | `frontend/src/components/TaskModal.tsx`, `CommentSection.tsx`, `TeamAdmin.tsx`, `frontend/src/useSubmitGuard.ts` |
| 4 | Viewer gets a fully-editable form | View-only tasks render read-only (disabled `fieldset`, real project/sub-project as static text, Save/Delete hidden, "View only" badge) | `frontend/src/components/TaskModal.tsx` |
| 5 | Tall modals trap the user | Shared `Modal`: Escape + backdrop close; flex column with bounded height so the header/✕ stay put and the body scrolls | `frontend/src/components/common.tsx`, `frontend/src/App.css` |
| 🟡 | `<html lang>` not updated | Synced to the active language via i18next `languageChanged` | `frontend/src/App.tsx` |
| 🟡 | Own-row admin Role select fails-on-use | Disabled on the current user's own row, with a tooltip | `frontend/src/components/TeamAdmin.tsx` |
| 🟡 | Project nav wraps unbounded | `.tabs` capped at ~3 rows, then scrolls | `frontend/src/App.css` |
| 🟡 | JWT refresh-on-401 console noise | Single-flight refresh (concurrent 401s share one round-trip) | `frontend/src/api/client.ts` |
| 🟡 | Redundant `/api/me` + `/api/tasks` on load | **Investigated — working as intended:** the 2nd `/api/me` is a one-time org-bootstrap after login; the extra `/api/tasks` is a *distinct* unfiltered counts query vs. the views' filtered query — not a true duplicate. The single-flight refresh above removes the actual repeated noise | — |

**Live browser re-verification (Playwright MCP):**
- Bug #1 — dark Weekly + Monthly "today" now a faint azure wash framed by the border, badge legible: `shots/fix-01-dark-weekly-today.png`, `shots/fix-02-dark-monthly-today.png`.
- Bug #5 — Manage Projects modal (29 projects) measured at 849px ≤ 913px viewport, body scrolls internally, header + ✕ stay visible after scrolling to the bottom, **Escape closes**.
- Bug #4 — viewer (omar) opening "Stock count" gets the read-only form: "👁 View only" badge, real project "Karuna Devi" as static text (not the old mis-populated "Sunday Service"), all fields disabled, footer Close-only: `shots/fix-03-viewer-readonly-task.png`.
- Polish — project nav now bounded (scrollbar visible at ~3 rows); 0 console errors after login.
- Bug #2 (orphaned assignment) and Bug #3 (double-submit) verified by the engine/regression tests rather than UI timing.

---

## Executive summary

**Overall:** the app is functionally solid and fast. Auth, task CRUD, approvals, team/permissions, the four board views, projects, trash, archive, history, restore points, export/import, signup+verification, password reset, i18n, and multi-tenancy isolation all work. Backend permission enforcement is **airtight** (viewer edit → 403; self-admin-lockout blocked; cross-org isolation total, even from the platform owner). Most findings are **frontend presentation/guardrail gaps**, not data-integrity or security holes.

### 🔴 Bugs to fix (highest value)
1. **Dark-mode "Today" highlight is a white block** (Weekly + Monthly). Root cause + one-line fix identified: `index.css` dark block re-declares `--wk-today:#ffffff` / `--mo-today:#ffffff`. Matches user's reference photo (column body should stay dark, framed by the border).
2. **Orphaned assignment** — a user assigned to a task in a sub-project they have no grant on **cannot see that task** (engine-confirmed `can_see_task → False`). The assignee picker lets an admin create this dead-end with no warning. Auto-grant task-level visibility on assignment, or restrict/warn in the picker.
3. **Double/triple-click Save creates duplicate tasks** — submit buttons aren't disabled during the in-flight request (3 clicks → 3 tasks). Add an `isSubmitting` guard on all create/submit buttons.
4. **Viewers get a fully-editable task form** (Save + Delete) that only fails on submit (403). Render viewer-level tasks read-only; also the Project dropdown mis-populates to a postable project instead of the task's real one.
5. **Tall modals trap the user** — header + ✕ close aren't sticky and scroll off-screen; Escape and backdrop-click don't close any modal. Add sticky header/footer + wire Escape/backdrop-click to close.

### 🟡 UX / polish
- Escape & backdrop-click close no modals (app-wide). • Own-row admin Role select enabled but fails-on-use (disable it). • Project nav wraps unbounded (eats vertical space at scale). • `<html lang>` not updated on language switch. • Redundant `/api/me` + `/api/tasks` fetches on load. • JWT refresh-on-401 emits console-error noise (consider single-flight refresh).

### ✅ Verified working
Auth + invalid-login handling; List/Kanban/Weekly/Monthly; task CRUD + comments + subtasks; approvals; Team (members/groups/access/activity) + email invitations; **permission ladder Volunteer 1 → Coordinator 3 → Lead 30 → Admin 31** with backend 403 enforcement, group-grant stacking, and total multi-tenancy isolation; dark mode (except #1); Projects; Trash (delete/restore/7-day); Archive + Bulk migrate; Restore points; History (after backfill); Export (xlsx/csv/json + clipboard); Import (csv/tsv/json/xlsx + paste + preview); empty-title block; idempotent re-invite; self-admin-lockout guard; signup + email verification; password reset (end-to-end); i18n (13 locales); Platform (metadata-only, superuser-gated).

### ⚡ Performance / fluidity
Fast and fluid: DOMContentLoaded ~120ms; API calls 17–150ms (login ~700ms is one-time bcrypt). **No unwanted page reloads** on theme toggle, language switch, view changes, or CRUD (verified via reload sentinel). With 184 tasks / 29 projects, lists scroll in contained regions with no horizontal overflow.

### 🛠 Change applied this session (per user request)
Typography: display **serif (Fraunces)** now reserved to the brand title + "Love & Blessings…" subtitle; all other headings use the **UI sans (Instrument Sans)** matching the Weekly date display. One-line change in `frontend/src/index.css`.

### Note on test data
This run generated significant test data (tiered users vol/coord/lead/orphan@; QA Project Zeta; 25 StressProj + 25 StressSub; 35 Stress members; ~150 Stress tasks; 3 dupe + imported tasks; "QA New Org" tenant; 5 backfilled history days; 1 restore point). Say the word and I'll clean it back to the seeded demo set.

---

## Test log

### 1. Auth
- ✅ Login page renders clean, 0 console errors.
- ✅ Invalid login → "Incorrect email or password." (correct; 401 in console is the expected failed-auth response).
- ✅ Admin login → board loads, all API 200.
- **[POLISH]** Redundant fetches on load: `/api/me` called twice, `/api/tasks` 2–3× in quick succession (network log #80/81, #87/88/89). Minor wasted requests.

### 2. Admin board (List view)
- ✅ 29 tasks, stats bar (4 overdue / 2 due soon / status counts), 7 filter dropdowns, overdue + due-soon badges, subtask roll-up chips, assignee avatars all render.
- ✅ Warm cream theme, good typography/hierarchy — strong visual fidelity.
- **[Note]** DB is polluted with prior test data (many identical "QA smoke task" rows, "Smoke Project", "Smoke Admin", "New Person"). Not a bug, but a clean reseed would make the board readable.

### 3. Views
- ✅ Board (kanban): 4 columns w/ counts, overdue red borders, subtask progress bars, recurring icons, assignee avatars.
- ✅ Weekly: Gantt-style bars, TODAY (Jun 5) column highlighted, overdue red / upcoming amber.
- ✅ Monthly: calendar grid, overdue days tinted pink w/ count badges, TODAY highlighted, future-day counts amber.

### 4. Task detail / edit
- ✅ Modal: name, project/sub-project, status (applies immediately), priority, assignees, details, requirements, start/deadline dates, start/end times, links, repeats, monitor, auto-complete, subtasks (assignee+status each), comments (@mention).
- ✅ Post comment → "Comments (1)", text appears.
- ✅ Add subtask → count 3→4.
- ✅ Rename + Save → modal closes, new title persists in list. All writes 200.

### 5. Create task
- ✅ "New task" → fill name → Save → row count 29→30, task appears. Created with sensible defaults (no required project pick needed).

### 6. Approvals
- ✅ Modal lists member-created pending tasks ("Member proposal" by Mara), with Approve all / Reject all + per-row Open/✓/✕ and "1 pending" counter.
- ✅ Approve (✓) → row removed, counter cleared. Approved task moves to board.
- **[UX]** Pressing **Escape does not close the Approvals modal** — backdrop keeps intercepting clicks; must use the ✕ button. Escape-to-dismiss is a near-universal expectation. **Confirmed app-wide: Team modal also ignores Escape** — no modal supports Escape-to-close. Clicking the backdrop also does not dismiss. Recommend wiring Escape + backdrop-click to close on all modals.

### 7. Team & Permissions
- ✅ Members tab: invite (email+role+tier), add member (name/email/password/tier), table with role/tier/active/reset-pw.
- ✅ **Invitation email flow works end-to-end** — email written to `sent_emails/` with correct subject ("You're invited to join Ananda Los Angeles…"), recipient, and tokenized link `/?invite=1&token=…` (14-day expiry).
- ✅ Tiers: Volunteer (assigned tasks only) / Coordinator (assigned sub-project) / Lead (assigned project) / Admin (everything).
- ✅ Groups tab: Alliance + Test Crew with members, Add group / Delete.
- ✅ Access tab: grant/exclusion management by Person/Group/Tier with clear stacking explanation (tier→group→individual, deny>assignment>allow).
- ✅ Activity tab: read-only audit log (e.g. "Bulk: set 2 task(s) → status 'todo'"). History service works.

### 8b. Permission / tier validation
Test users created in "Ananda Los Angeles" org (pw taskboard123), each with a tier grant on the **same** Marketing sub-project / Karuna project so the breadth difference is isolated:
- ✅ **Admin (admin@)** — sees everything: 31 tasks across all projects; full nav (Platform/Approvals/Team/Trash/Projects + admin user-menu items Restore points/Bulk migrate).
- ✅ **Volunteer (vol@, sees=own on Marketing)** — sees **only her 1 assigned** Marketing task (of 3). Project tab count = 1. Header shows only Theme + New task; **all admin nav hidden**. Assignee filter scoped to herself + groups only. Correct.
- ✅ **Coordinator (coord@, sees=subproject)** — sees all **3** Marketing tasks (vs Volunteer's 1 on the *same* sub-project — breadth isolated and proven). Admin UI hidden.
- ✅ **Lead (lead@, sees=project)** — sees all **30** Karuna tasks across General/Marketing/Warehouse; only the Karuna project (not Sunday/Smoke). Admin UI hidden.
- ✅ **Omar (viewer on Warehouse + member on Sunday via Alliance group)** — sees **2** tasks: Stock count (Warehouse) + Weekly service prep (Sunday). Group-grant stacking works.
- **Breadth ladder proven:** Volunteer **1** → Coordinator **3** → Lead **30** → Admin **31**.
- ✅ **Backend enforces viewer read-only:** editing the Warehouse task as Omar → `PATCH /api/tasks/5` returns **403 Forbidden**. Server-side permission gate is solid (no client-trust hole).
- 🔴 **[UX/guardrail] Viewer is shown a fully-editable task form (Save + Delete) they cannot use.** As a viewer on Warehouse, Omar opens "Stock count" and gets every field editable plus Save/Delete; changes only fail *after* clicking Save (403 → "…permission to do that."). The form should render **read-only** for viewer-level tasks (disable inputs, hide/disable Save & Delete, show a "View only" badge) so the user isn't led into wasted effort + an error. **Also:** the Project dropdown mis-populates to "Sunday Service" (a project Omar *can* post to) instead of the task's real project "Karuna Devi" — because the picker is filtered to postable projects. Had the backend not enforced, saving would silently relocate the task to the wrong project — a data-integrity foot-gun. Fix the read-only presentation and never show a scope picker that can't represent the task's current scope.

🔴 **[BUG] "Orphaned assignment": a user assigned to a task in a sub-project they have no grant on cannot see that task.** Repro: assign a member (no grant on Marketing) to a Marketing task → the member sees **0 tasks / "No projects yet"**, including the very task assigned to them. The assignee picker in the task editor lists *all* org users regardless of their access, so an admin can hand someone work that is invisible to them, with no warning. This contradicts the engine's own documented precedence ("deny > assignment > allow", `permissions/engine.py` line ~89, which implies assignment grants visibility); in the implementation `sees=own` only surfaces assigned tasks *within an already-granted scope* (`own_sps` derives from grants, visible_tasks_q L282–292). **Expected (per user):** this state should be impossible — assigning a user to a task should either (a) auto-confer at least viewer visibility of that task, or (b) the assignee picker should restrict/΄warn for users without access to the sub-project. Recommend (a): treat direct assignment as an implicit allow at task granularity, so `can_see_task` returns true for any assignee not explicitly denied. **Confirmed at engine level:** for a fresh member with a membership but no grants, assigned to a task — `can_see_task(user, task, org) == False` and `visible_tasks_q` count == 0.

### 9. Edge cases & guardrails
- ✅ **Empty-title task** blocked by HTML5 required validation ("Please fill out this field"); modal stays open. Good.
- 🔴 **[BUG] Double/triple-click Save creates duplicate tasks.** Filling a name and rapidly clicking Save 3× fired **3× `POST /api/tasks` (all 201)** → 3 identical rows. The submit button isn't disabled/debounced during the in-flight request. Same risk applies to any create/submit button (invite, add member, comment). **Fix:** disable the submit button (and/or set an `isSubmitting` guard) on first click until the request resolves; ideally also de-dupe server-side. This is a common foot-gun on slower connections where users click twice.
- ✅ **Self-admin-lockout is guarded.** Backend (`accounts/views.py:156`) raises "You can't demote or deactivate your own admin account." Live test: setting own role→Member reverts to Admin, session intact. Last-admin protection holds transitively (you can demote *others* but never yourself, so ≥1 admin always remains). **[POLISH]** the own-row Role select is enabled and fails-on-use (403) rather than being disabled — same fail-after-attempt pattern as the viewer-edit form; disabling it would be cleaner.
- ✅ **Duplicate invitation is idempotent** — re-inviting an already-invited email resends but keeps a single invitation record (no duplicate rows). Good.

### 10. Feature areas (admin)
- ✅ **Projects management:** add project (appears instantly in nav), per-project color/emoji, sub-projects with "trusted" (post-without-approval) toggle, default "General" name locked, Save/Delete. Create verified.
- ✅ **Trash:** delete shows native "Delete this task?" confirm (guardrail); deleted item listed with "· 7d left" + 7-day retention note; **Restore** works (count restored, "Trash is empty 🧹"); "Delete forever" available.
- ✅ **Export:** modal with **3 formats — Excel (.xlsx), CSV, JSON** + "📋 Copy for Google Sheets"; archived-task inclusion; per-project/sub-project scope; group/status/priority/assignee filters; 15 selectable columns. CSV download verified — valid 15-col header + 34 rows.
- ✅ **Import:** accepts **CSV, TSV, JSON, Excel (.xlsx)** + spreadsheet paste; upsert-by-ID (missing projects auto-created); **Preview-before-Confirm** step (guardrail showing "1 create / 0 update"). Round-trip paste-import verified (new task created).

### 11. Typography change (applied this session, per user request)
- ✅ Per Gordon's directive: the display **serif (Fraunces, `--f-display`) is now reserved only for the brand title + "Love & Blessings…" subtitle**; all other headings (modal titles like "Manage projects"/"Edit task", section headings) now use the **UI sans (Instrument Sans, `--f-ui`) — the same font as the Weekly date display** ("May 31 – Jun 6, 2026"). One-line change: `frontend/src/index.css` global `h1,h2,h3` rule `var(--f-display)` → `var(--f-ui)`. Verified in-browser: brand `.name`/`.tagline` still Fraunces; "Manage projects" heading now Instrument Sans.

### 12. Archive / Bulk migrate / History / Restore points (admin)
- ✅ **Archive:** via Bulk migrate → select task(s) → "Archive selected" → native "Archive N task(s)?" confirm → archived task drops out of normal view (count 35→34). Toolbar **Show/Hide archive** toggle reveals archived items. Unarchive button present in task modal (code-confirmed `TaskModal.tsx:48`).
- ✅ **Bulk migrate:** modal with select-all + per-task checkboxes, Apply (move) + Archive selected.
- ✅ **Restore points:** "Save restore point now" → name prompt → point listed ("QA restore point manual · 4 projects · 6 sub-projects") with Restore action; notes auto-save daily (last 10) + manual saves forever. (Did not click Restore — it overwrites board state.)
- ✅ **History:** daily who-was-assigned snapshot with Prev/Next/Today nav. Initially empty ("records daily from go-live"). **Backfilled 5 days of snapshots via backend** (`snapshot_history_day`) → History then correctly renders per-day assignment data (e.g. "QA smoke task · Admin Ada, Mara Member · Delayed"). Feature works once data exists.
- ✅ **Admin-gating:** Trash, Approvals, Team, Projects, Platform, and the user-menu admin items (Restore points, Bulk migrate, History) are **hidden for non-admin tiers** — Volunteer/Coordinator/Lead/viewer headers showed only Theme + New task. Backend also enforces (viewer PATCH → 403).

### 13. Overflow / long-list stress (29 projects, 26 sub-projects, 44 members, 184 tasks generated)
- ✅ **Task list:** 184 rows scroll **inside `main.content`** (scrollH 6454 / clientH 648); header, filters, stats bar stay fixed. No page-level or horizontal overflow. Fluid.
- ✅ **Project nav:** 29 project pills **wrap** to ~3 rows; all reachable, no layout break. **[POLISH]** wrapping is unbounded — with very many projects the nav would consume large vertical space; consider a max-height + scroll or a "more" collapse.
- 🔴 **[UX] Tall modals: header + ✕ close button are not sticky.** With 29 projects the Manage Projects panel is **5523px** tall and `overflow-y: visible` (no internal body scroll). Content IS reachable — the fixed `.modal-backdrop` scrolls (scrollH 5587) — **but** scrolling down to reach the bottom rows pushes the title + ✕ close button off-screen (closeBtnTop −4639). Combined with **Escape-doesn't-close** and **backdrop-click-doesn't-close** (both found earlier), a user at the bottom of a tall modal has no visible way to close it without scrolling back to the top → feels trapped. Affects every large modal (Manage Projects, Team members, Export project list, Bulk migrate). **Fix:** sticky modal header (with close) + sticky footer (actions), scrollable body; and/or wire Escape + backdrop-click to close.

### 14. i18n
- ✅ Language switch (13 locales: en, it, es, fr, de, pt, zh, hi, bn, ta, te, mr, gu) is **instant, no reload**; UI re-translates (verified Spanish: Aprobaciones/Equipo/Papelera/Proyectos/Nueva tarea/Exportar/Importar).
- **[POLISH]** `<html lang>` attribute stays `"en"` after switching language — update it for a11y/spellcheck/SEO correctness.

### 15. Copy summary / Share view
- ✅ Copy summary fires a "summary" toast (clipboard write; read blocked by Playwright sandbox but action succeeds). Both Share view + Copy summary appear in the toolbar for member/tier users too (non-destructive, read-only — appropriate).

### 16. Signup + email verification + multi-tenancy
- ✅ **Signup** (org name, city, country, name, email, password) → "Check your email" screen + verification email on disk (Subject "Verify your Ananda Taskboard account", `?verify&uid=…&token=…`).
- ✅ **Verification link** → "Email verified. Your account and team are active."
- ✅ **Multi-tenancy isolation:** new founder logs in and sees **ZERO** Ananda LA data (no Karuna Devi/StressProj/members); empty project list; assignee filter shows only themselves; full admin nav for their OWN org but **no Platform/superuser** access. True tenant isolation — no cross-org leakage.

### 17. Password reset (was shipped-unverified — now verified)
- ✅ "Forgot password?" → email form → "Check your email" with **non-enumerating copy** ("If an account exists…") — good security. Email on disk (Subject "Reset your Ananda Taskboard password", `?reset&uid=…&token=…`, 1-hour expiry).
- ✅ Reset link → "Choose a new password" (password + confirm + 8-char min) → "Password updated."
- ✅ **Verified end-to-end:** signed in with the new password successfully.

### 18. Platform (superuser)
- ✅ Cross-org overview, **metadata only** ("task contents stay private to each organization") — per-org project/sub-project/task/member counts + admin list + member roster. Both orgs (Ananda Los Angeles + QA New Org) listed.
- ✅ **Superuser-gated:** the new org's admin (a normal org admin, not superuser) had no Platform button. Confirms platform power requires `is_superuser`, not org-admin.

### Mobile / responsive — OUT OF SCOPE
Per Gordon, mobile/responsive is not built yet; mobile QA was stopped and is intentionally not reported here.

### 8. Dark mode
- ✅ Theme toggle is **instant CSS swap, no page reload** (reload sentinel `window.__qaLoadId` survived). No flashing/FOUC observed on toggle.
- ✅ List, Kanban, and task-edit modal all render correctly in dark — good contrast, themed inputs, native date pickers adapt.
- 🔴 **[BUG] Dark mode: "Today" highlight in Weekly & Monthly views is a glaring WHITE block.** The today cell/column keeps a hardcoded light/white background that does NOT adapt to dark mode (screenshots 14-dark-monthly, 15-dark-weekly). The empty area of today's column/cell is pure white against the dark theme, and the "TODAY" badge becomes nearly illegible (light-on-light). **ROOT CAUSE CONFIRMED:** `frontend/src/index.css` — the `html[data-theme="dark"]` block re-declares `--wk-today:#ffffff;` (line 51) and `--mo-today:#ffffff;` (line 54), i.e. the today-highlight tokens were copied from the light theme but never darkened. `.wk-col.today` / `.wk-hcell.today` (App.css 167, 421) and `.mcell.today` (App.css 215) consume those vars, so today's column/cell renders pure white in dark mode. **Intended design (per user-supplied reference photo):** in dark mode the today *column body* should remain **dark**, highlighted only by the white/light border frame (`.wk-today-hl`, `--wk-today-line`) plus a light header cell — NOT a solid white column fill. The current bug is the full-height white column-body fill. **Fix:** in the `html[data-theme="dark"]` block, set the column-fill tokens dark/transparent so the border frame provides the highlight, e.g. `--wk-today: transparent;` (or `color-mix(in srgb, var(--azure) 12%, var(--surface))`) and `--mo-today: color-mix(in srgb, var(--azure) 14%, var(--surface));`. Keep the light header cell + `--wk-today-line` border as the signpost, matching the reference.
- **[POLISH]** Transparent JWT refresh-on-401 emits console `error` lines: when the in-memory access token expires mid-session, in-flight requests (`/api/users`, `/api/tasks`) each 401 once, then the client refreshes and retries (verified 200 on retry — data loads fine). Consider single-flighting the refresh (dedupe concurrent 401→refresh) and/or proactively refreshing before expiry to cut console noise.

