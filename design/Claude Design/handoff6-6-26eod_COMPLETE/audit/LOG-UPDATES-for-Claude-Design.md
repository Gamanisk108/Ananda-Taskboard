# LOG-UPDATES for Claude Design — new D-entries for DESIGN-DECISIONS-LOG.md
> **Status: FINAL** (decisions resolved 2026-06-07). Paste these into `DESIGN-DECISIONS-LOG.md` as D20+. Format per entry: **what changed (before → after) · exact spec · affected surfaces**.
>
> Surface keys: **APP** = `Ananda Taskboard.html` · **MOB** = `mobile/` · **MT** = `multitenancy/` · **AUTH** = `auth/` · **HELP** = `help-onboarding/` · **BUILD** = live React app (`frontend/`+`backend/`).

---

## A. New decisions (from the 2026-06-07 live-vs-design audit)

### D20 · Corner radii — one token set
- Before: app/help/mt `--r-card:11px`/`--r-ctl:8px`; mobile `13/10`; auth `14/10`.
- After: **`--r-card:11px` · `--r-ctl:8px` everywhere**. Spec: set mobile + auth token blocks to 11/8.
- Surfaces: APP · MOB · MT · AUTH · HELP · BUILD.

### D21 · Weekly bar count badge (`.wk-bar .mini`) radius
- Before: APP `99px` vs HELP `4px`. After: **`99px` (full pill)**.
- Surfaces: APP · HELP · BUILD.

### D22 · Holidays live under Settings
- Before: build shows Holidays as a **Team** tab. After: **Holidays under Settings** (Settings = statuses · calendar events · holidays). Remove the Holidays tab from Team.
- Surfaces: APP · BUILD (+ MOB if applicable).

### D23 · List filter-bar scope
- After: the **Global Overview** list shows **All Projects + All Sub-projects** filters; an **individual project** view shows **only All Sub-projects** (project already scoped). Other filters unchanged (Assignee · Status · Priority · Deadline · Recurrence).
- Surfaces: APP · BUILD.

### D24 · Archive moves into the account menu  (extends D15)
- Before: standalone top-bar **Archive** button. After: **Archive in the account menu** (with Trash · Settings · History · Restore points); top bar stays lean (Approvals · Team · Projects).
- Surfaces: APP · BUILD.

### D25 · Single theme control
- Before: theme exposed twice (logo toggle + account-menu dropdown). After: **theme toggle next to the logo only**; remove the account-menu Theme dropdown.
- Surfaces: APP · BUILD.

### D26 · Group glyph 👥 — keep for now
- Decision: **keep 👥** as the group marker for now (assignee picker, list, copy-summary, history, team); design already uses it. **Revisit later** (likely lucide `Users`). No change required now; it is NOT a live-vs-design mismatch.
- Surfaces: APP · MOB · HELP · BUILD.

### D27 · New-task primary button label
- Before: build "Save". After: **"Create task"** on the New-task dialog (the Edit dialog keeps "Save").
- Surfaces: APP · MOB · BUILD.

### D28 · New-task Status selector
- Before: build "Set after creating". After: a **Status selector defaulting to "To Do"** is available at creation.
- Surfaces: APP · MOB · BUILD.

### D29 · Edit-task header = inline-editable title
- Before: generic "Edit task · #N" header + a separate "Task name" field. After: the **header IS the inline-editable task title + a pen icon + a #id chip**; no separate name field.
- Surfaces: APP · MOB · HELP · BUILD.

### D30 · Task-popup layout — sticky footer
- Before: action footer rendered mid-modal with Subtasks/Comments below it. After: modal = **fixed header → scrollable body (fields → Subtasks → Comments) → footer pinned to the modal bottom with a `border-top`** (sticky; never scrolls out of view regardless of content length).
- Spec: apply to the **Task popup** AND the **Subtask detail** panel; reuse the pattern for any other long modal.
- Surfaces: APP · MOB · HELP · BUILD.

### D31 · Assignee-control copy unified
- Before: mobile Task-detail "+ Add person…" vs New-task/app "+ Add person or group…". After: **"+ Add person or group…" everywhere**.
- Surfaces: APP · MOB · HELP · BUILD.

### D32 · One button spec
- After: standardize on the **canonical-app button metrics** (secondary/icon `padding 6px 9px`, `14px/500`; primary `6px 11px`, `13px/600`) across all modules; drop the module `.btn` `8px 13px / 13px·600` variant.
- Surfaces: APP · MOB · MT · AUTH · HELP · BUILD.

### D33 · All dropdowns → custom popovers  (resolves D2 scope)
- After: **every native `<select>` becomes a custom trigger + popover** (a single-select sibling of the existing MultiSelect) — Project, Sub-project, Status "Change to…", Priority, filters/sort, Language, etc.
- Surfaces: APP · MOB · MT · AUTH · HELP · BUILD.

### D34 · Only project-picker emoji; chrome emoji → line-art  (codifies the emoji rule)
- After: the **only** emoji allowed are per-Project emoji chosen via the Emoji Picker. Convert chrome emoji to lucide line-art: **🌐→Globe · 🎉→CircleCheck · 🧹→Trash2 · 🙏 removed · 📋→ClipboardList · 📁 removed · ✅→CircleCheck**. Keep 👥 (D26, revisit) + 🙂 (the picker default). eslint `no-emoji-icon` allow-list = `['👥','🙂']`.
- Surfaces: APP · MOB · MT · AUTH · HELP · BUILD.

---

## B. Build-conformance items (bring the live build up to EXISTING log decisions)
> Already correct in the design/log; the **build** must catch up.
- **D4** Links textarea → structured link-row list — BUILD (+ APP reference) stale.
- **D5** Footer Delete → left + red — ✅ done in BUILD TaskModal; apply to other dialogs + APP reference.
- **D6/D7/D13** "Unscheduled Tasks" rename + emphasis + List-methodology table, no "All day"/Time sort — BUILD stale.
- **D15** Help & FAQ + Trash + Archive (D24) into the account menu; lean top bar; purple What's-New dot — BUILD stale.
- **D16/D18** Welcome card: single "Got it" on web (no Skip), 🙏 removed (✅) — BUILD partly done.
- **D17** Remove the grey "Admin" chip in Help search/articles — BUILD stale.
- **D11/D12** Subtask row (priority · avatars · status pill+popover · progress bar) + detail panel (breadcrumb `#142 › #142.2`, Share, "Sub-task name", Links list, Delete-left) — BUILD stale.
- **proj-pills everywhere** — ✅ List + Board done; extend to Trash / Copy-summary / Bulk-migrate.
- **Auth lotus mark** (currently a navy dot) — BUILD stale.
- **i18n** add Help / summary-strip / status-pill labels to all 13 locales.
