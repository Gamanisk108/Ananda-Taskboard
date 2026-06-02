# Task Board App — `/goal` Brief

> Hand this to **Claude Code** or **Cowork** and run `/goal`. It's scoped so the
> brainstorm phase has clear direction, the plan phase has constraints, and there's
> **one approval point** before any building. Prepared in Claude Chat (no file access);
> Code/Cowork own the actual build.

---

## 1. One-line summary

A spreadsheet-style **task board** for a small in-house team: multiple projects (each optionally split into sub-projects), **conditional roll-up overviews**, **per-sub-project permissions assignable to individuals or member Groups**, list + timeline views, recurring tasks, comments, an Admin-approval workflow, CSV/spreadsheet export, daily push notifications, and a one-click group-chat summary. **Built to an extreme edge-case QA standard (see §12).**

## 2. Vocabulary & hierarchy

Fixed terms for the whole build. Nesting is **capped at three levels** (plus Phase-2 subtasks) — no deeper:

- **Global Overview** — top-level tab consolidating **all visible Projects**. **Only appears when the user can see ≥2 Projects** (with one, it's redundant — go straight in).
- **Project** — a major, ongoing item with its **own tab**. Examples: *Alliance Electric, Karuna Devi, Sunday Service, Class Series*.
- **Project Overview** — a tab that rolls up a Project's sub-projects. **Only appears when the Project has ≥2 sub-projects visible to that user.**
- **Sub-project** — a table/tab **inside a Project**. Example: under *Karuna Devi* → *Marketing, Website, Shipping, Warehouse*. **Permissions are gated here** (see §6).
- **Task** — a unit of work under **exactly one** Sub-project. Has assignee(s), deadline, status, optional recurrence, comments.
- **Subtask** *(Phase 2)* — nested under a Task. Not in v1.

**Recommendation:** every Project gets a **default Sub-project** (e.g. "General"), so a Task *always* lives under a Sub-project (uniform data model). When a Project has only the default, the UI hides the sub-project layer so simple projects (e.g. Sunday Service) still feel flat. *(Confirm in §13.)*

## 3. Platform strategy (phased — same codebase)

- **Phase A (build now): PWA.** Installable web app = web **and** mobile in one. No app store. Push: solid on Android, functional-but-clunky on iOS.
- **Phase B (later): native via Capacitor.** Wrap the same code into iOS/Android store apps with native push. This is a packaging/submission step, **not** a rebuild.
- **Requirement for the build:** architect Phase A to be **Capacitor-ready** so Phase B is cheap.

## 4. Recommended stack

- **New project**, not built on the existing to-do app (different data model). **Reuse the stack only.**
- **Backend:** Django + Django REST Framework (auth, permissions, push-token storage, scheduled jobs, REST API). Use a **clean event layer** (see §9) so outbound webhooks can be added later without a refactor.
- **Frontend:** React 18 + Vite 5, built as a PWA, Capacitor-ready.
- **DB:** SQLite to start (fine for a small in-house team); migrate to Postgres only if it grows. *(Decide in plan phase.)*
- **Hosting:** a **free-tier** managed host for the Django backend (e.g. Render free tier, Fly.io, or Oracle Cloud Always Free). *(Decide in plan phase. A shared server is required for permissions + daily push; free tiers may cold-start when idle — fine for in-house use.)*

## 5. Core data model

- **User** — account, name, email, role, push token(s).
- **Group** — a named collection of Users (e.g. *Alliance, Seva Volunteers, Sunday Service*); a user can belong to many. Used to assign permissions in bulk.
- **Project** — name, **color**, description. Has one or more Sub-projects.
- **Sub-project** — name, **color**, description, **project** (one). Holds Tasks. **Unit of access.**
- **Access grant** — links a **User _or_ Group** to a **Sub-project** with a level (**Member** or **Viewer**). *This is the visibility gate.* Admins can grant a **whole Project** (all current + future sub-projects) as a shortcut.
- **Task** — title, details/description, requirements, **sub-project** (one → resolves its Project), **assignee(s)** (one or more), **deadline** (date), **timeline start/end**, **status**, **recurrence**, **approval state**, **links** (URLs only), created/updated/created-by.
  - **Status** — e.g. *To Do / In Progress / Done / Delayed*.
  - **Recurrence** — *none / daily / weekly / monthly / yearly* (interval + optional end date/count). Recurring tasks generate occurrences across the calendar; **each occurrence carries its own status**. Finalize specifics in brainstorm.
  - **Approval state** — *pending / approved / rejected* (drives §6 workflow).
- **Comment** — attached to a Task; author, text (URLs for any media), timestamp.
- **Subtask** *(Phase 2)* — nested under a Task.

## 6. Permissions & approvals

- **Admins are GLOBAL** (not per-project): an Admin manages everything and sees everything.
- **Visibility is gated at the Sub-project level.** Access is granted (level **Member** or **Viewer**) to specific sub-projects. A user sees a **Project** only if granted **≥1 of its sub-projects**, and sees **only the sub-projects they're granted**. Overviews roll up only what the user can see.
- **Groups (member tags) for bulk permissions.** Admins define **Groups** — named collections of users (e.g. *Alliance, Seva Volunteers, Sunday Service*). A grant can target a **Group** instead of an individual, so a whole team gets access to a sub-project at once. A user can be in multiple groups.
- **Effective access = the union** of a user's direct grants + all their groups' grants. **Access level is set per grant** (a user can be Member on one sub-project, Viewer on another). Where levels conflict, **most-permissive wins** (Member > Viewer). *(Confirm conflict rule → §13.)*
- **Grant shortcut:** Admins can grant **whole-Project access** (all current + future sub-projects); use per-sub-project grants for sensitive splits (e.g. *Warehouse* hidden from a *Marketing*-only group).
- **Project, group & member management:** **Admins** create projects/sub-projects, define groups, manage grants, and approve changes.
- **Task creation → Admin approval.** Members **can** create tasks, but a Member-created task starts in **Pending Approval**. An **Admin is notified** (see §8) and **approves** (it goes live) or **rejects**. Admin-created tasks go live immediately.
- **Status changes** (Done, Delayed, etc.): only the task's **assigned members** + **Admins** — **direct, no approval needed**.
- **Comments:** any user with **visibility** to a task can comment.
- Roles: **Admin** (global; manage everything; approve changes; change any status) · **Member** *(per granted sub-project)* (create tasks pending approval; comment on visible tasks; change status only on tasks assigned to them) · **Viewer** *(per granted sub-project)* (read + comment only).

## 7. Views

Two levels of tabs, mirroring a spreadsheet workbook — **overviews appear only when there's more than one thing to consolidate**:

- **Top level:** one tab per visible **Project**, plus a **Global Overview** tab **only if ≥2 Projects are visible**.
- **Inside a Project:** one tab per visible **Sub-project**, plus a **Project Overview** tab **only if ≥2 sub-projects are visible**.

Each view (List / Weekly / Monthly) can run at the **sub-project**, **project (rolled up)**, or **global** level:

- **List view:** spreadsheet-style table. **Search + filter** (project, sub-project, member, group, deadline, status); sortable columns.
- **Timeline — Weekly:** one column per day; **sortable/groupable** chronologically, alphabetically, by project, by sub-project, or by member; tasks show their color.
- **Timeline — Monthly:** calendar grid; each day shows **color-coded count badges** with a number per group. **Color semantics:** global/project-overview level colors by **Project**; inside a Project, colors by **Sub-project**. **Click a day → opens that day's full task list.**

## 8. Notifications

- **Daily push:** each morning, every user gets a push listing **their** tasks for the day (+ overdue) across all visible projects. Needs a scheduled server job + push service (web push / FCM for PWA+Android; APNs via Capacitor for iOS native).
- **Push time:** a single **admin-set** time. **Default 8:00 AM PST.**
- **Approval requests:** when a Member proposes a new task (or edit), the **Admin(s) are notified** to approve or reject.
- **Group-chat summary tool:** a button that generates a **plain-text** daily breakdown (grouped Project → Sub-project → member) formatted to paste straight into WhatsApp/Slack.

## 9. Export & integrations

- **Export (v1):** export the current view's tasks to **CSV** (and optionally XLSX), respecting the viewer's permissions and the current level (sub-project / project / global).
- **Webhooks / Zapier (future — architect for, don't build in v1):** the backend should emit events (task created, approved, status changed, etc.) through a **clean event layer** so **Zapier-compatible outbound webhooks** can be added later — for when/if you adopt dedicated PM or CRM software. Not built in v1 (keeps it free + simple); just keep the seam clean.

## 10. Constraints / non-goals (v1)

- **Essentially free to host and operate.** Use free hosting tiers, free push (Web Push / FCM), free SQLite-on-host, and a free scheduler for the daily job (host cron or GitHub Actions). Accept free-tier trade-offs (idle cold-starts, usage caps) — acceptable for in-house use. **One unavoidable cost:** the Apple Developer fee (~$99/yr), and *only* if/when you ship the native iOS app in Phase B. PWA + Android stay free.
- **Text only.** No file storage — media/attachments are **URLs** (Google Drive links etc.).
- In-house / small team, but **real accounts on one hosted backend**.
- **Nesting capped** at Project → Sub-project → Task (+ Phase-2 subtasks). No deeper.
- Smallest thing that meets the goal — no extra features or future-proofing beyond Capacitor-readiness and the webhook seam in §9.

## 11. Build practices — living documentation

Throughout this build (and a candidate workspace-wide rule), Code/Cowork **continuously maintain developer-friendly docs** to standard business practice — updated **as the build progresses**, not written once at the end:

- **README** (overview, setup, run)
- **Architecture overview + data model / ERD**
- **API reference** (endpoints, auth, payloads)
- **Deploy/ops runbook** (hosting, env vars, scheduled job, push setup)
- **Permissions matrix** (role × capability, including sub-project grants and group-based access)
- **CHANGELOG** + a short **decision log** (key choices and why)

> Make it durable: add the same instruction to `C:\AI\CLAUDE.md` so it applies to every future app build, not just this one.

## 12. QA & testing — EXTREME edge-case coverage

**Standard: exhaustive edge-case testing, not happy-path.** Treat any "looks done" as 80% complete. Use `test-driven-development` for permission/recurrence logic, `verification-before-completion` before claiming done, and run `security-review` on the API. Apply the workspace **AI-test audit** rigorously: (1) ask "what could go wrong / what are the edge cases" *before* writing tests; (2) **assertion integrity** — every test uses a real `expect()`/`assert`, never a `console.log` to fake a pass; (3) each test's body actually proves what its name claims. Examples below are **representative, not exhaustive** — the *principle* is exhaustive coverage; have `/goal` propose the full edge-case list at the test phase for sign-off.

**Permissions / access (highest risk — the layered union):**
- No-grant user sees **nothing**, anywhere (no project tabs, empty global view, empty search/export/push).
- One-sub-project user sees only it; **no** Project Overview, **no** Global Overview.
- Overlapping **direct + group** grants → most-permissive wins; no double-listing; counts **never double-count** a person in both.
- Conflicting levels across **two groups** → resolves per the rule.
- Remove a user from a group → access revoked **everywhere immediately** (stale-membership).
- A **whole-Project** grant auto-covers a **newly added** sub-project.
- Assigned to a task, then access to its sub-project revoked → defined, safe behavior.
- **No cross-leak:** a *Marketing*-only user never sees *Warehouse* in list, weekly, monthly counts, search, export, daily push, group summary, **or the raw API**.

**Authorization (server-side, not just UI hiding):**
- Every endpoint enforces permissions server-side — a direct API call for a hidden sub-project's tasks returns **403, not data** (IDOR / guessed IDs).
- A Viewer cannot create/approve/change-status **via the API** even when the UI hides the buttons.

**Recurrence / date / time (the ludicrous-but-real ones):**
- Yearly task on **Feb 29** in a non-leap year; monthly task on the **31st** in a 30-day or February month.
- Month- and year-boundary occurrences; a week spanning two months in the weekly view.
- **DST** transitions (PST↔PDT); 8 AM PST push for users in other timezones; push fires **once**, on the correct day.
- Per-occurrence status is independent; editing a rule affects **future, not past**; end date/count stops **exactly** (no off-by-one); overdue recurring occurrences handled.

**Approval workflow:**
- Pending task is invisible on the live board/counts until approved; a rejected task disappears.
- Multiple admins notified; **double-approve / double-reject** races resolve once.
- Assignee marks **done twice**, or two users act on one task at once → consistent final state.

**Export:**
- Export **never** includes hidden sub-projects.
- Fields with commas/quotes/newlines/emoji handled; **CSV formula injection** (leading `=` `+` `-` `@`) sanitized.
- Empty export still produces a valid file.

**Data / UI extremes:**
- Empty states everywhere (no projects / sub-projects / tasks / group members).
- Very long names, emoji, RTL text, and special characters in every text field.
- Duplicate project / sub-project / group names.
- A single day with a **huge** task count (badge overflow); **more projects than the color palette** (color exhaustion / collision behavior).
- Invalid/expired push tokens fail gracefully; session expiry mid-action.

## 13. Phase 2 (deferred)

- **Subtasks** (Task → Subtask).
- **Native store apps** via Capacitor (see §3).
- **Outbound webhooks / Zapier integration** (see §9).
- **Assign tasks to a whole Group** (not just individuals).

## 14. Open decisions for the brainstorm phase (don't block now)

- **Sub-projects: optional or always-default?** *(Recommend: every Project has a default Sub-project; UI hides the layer when it's the only one.)*
- **Conflicting access levels** — when direct and group grants (or two groups) disagree, which wins? *(Recommend: most-permissive — Member > Viewer.)*
- **Approval scope** — new task creation only, or also Member edits to existing tasks? *(Recommend: creation + content edits; status by assignees stays direct.)*
- **Overdue handling** — keep overdue tasks flagged in views + in the daily push? *(Recommend: yes.)*
- **Recurrence end condition** — indefinite or required end date/count? *(Recommend: optional end.)*
- **Export format** — CSV only, or CSV + XLSX? *(Recommend: both.)*
- **Daily push when a user has no tasks** — send a "nothing today" or stay silent? *(Recommend: stay silent.)*
- **Final DB + hosting choice.**

## 15. Kickoff line

> `/goal Build the task board app described in this brief (attached/pasted). New project, reuse the Django REST + React/Vite stack, PWA first and Capacitor-ready for later native. Hierarchy is Project → Sub-project → Task; Admins are global; visibility is gated per sub-project and grantable to individuals or member Groups (access level per grant); overviews appear only when there's >1 item to consolidate. Maintain living developer docs throughout (Section 11) and hold to the EXTREME edge-case QA standard in Section 12 — exhaustive permission, recurrence, timezone, concurrency, and security tests with real assertions. Resolve the Section 14 open decisions with me in the brainstorm phase, then give me a single approval point before executing.`
