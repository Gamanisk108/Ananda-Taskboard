# ✅ ANSWERS (2026-06-07)
- **DN1 Radii:** Standardize **11px card / 8px control everywhere** (drop mobile 13/10 + auth 14/10).
- **DN2 Weekly mini badge:** **Full pill (99px)**.
- **DN3 Holidays:** **Settings** (move out of the Team tab).
- **DN4 List filters:** **Global Overview** shows *All Projects + All Sub-projects*; an **individual project view** shows *only All Sub-projects* (project already scoped).
- **DN5 Archive:** **Account menu** (lean top bar).
- **DN6 Theme control:** **Toggle by the logo only** (remove the account-menu Theme dropdown).
- **DN7 👥 groups:** **Keep for now** (revisit later).
- **DN8 New-task button:** **"Create task"**.
- **DN9 New-task status:** **Status selector, default To Do**.
- **DN10 Edit-task header:** **Inline editable title + pen + #id chip** (no separate Task-name field).
- **DN11 Task-popup layout:** **Fix order + STICKY footer** — fixed header → scrollable body (fields → Subtasks → Comments) → footer pinned to modal bottom with `border-top`, never scrolls out. Apply to the **subtask popup** too and reuse the pattern anywhere relevant.
- **DN12 Assignee copy:** **"+ Add person or group…" everywhere**.
- **DN13 Button spec:** **Keep the canonical-app button metrics** (6px 9px, 14/500 secondary; etc.) as the standard.
- **DN2-scope (selects):** **Full migration to custom popovers** (build a single-select popover; replace all native `<select>`).
- **Emoji→icons:** use the recommended lucide set (already applied for the chrome ones).

---

# DECISIONS NEEDED — answer all in one sitting
> Only the items I should NOT decide myself: either the **design files disagree** and `DESIGN-DECISIONS-LOG.md` (D1–D19) doesn't cover it, or it's a **design choice** (live build does X, design implies Y, and which is "right" is your call). Everything else in `PIXEL-AUDIT-REPORT.md` is an unambiguous fix-to-the-design and needs no decision here.
>
> Fill in each `MY CHOICE:` line. Next session I'll apply your choices across all files and generate `LOG-UPDATES-for-Claude-Design.md` in the exact D-entry format.

---

## DN1 — Module corner radii disagree across the design files
The design references don't agree on control/card radii (`getComputedStyle` + CSS tokens):
- `app/Ananda Taskboard.html`, `help-onboarding`, `multitenancy`: **`--r-card:11px` · `--r-ctl:8px`**
- `mobile/ananda-mobile.css`: **`--r-card:13px` · `--r-ctl:10px`**
- `auth/ananda-auth.css`: **`--r-card:14px` · `--r-ctl:10px`**

- **A)** Standardize everything to the app values **11px / 8px** (one token set everywhere).
- **B)** Keep platform-specific: web = 11/8, **mobile rounder = 13/10**, **auth card = 14** (intentional).
- **C)** Other (specify).

Files: app vs mobile vs auth CSS. Viewport: all.
**MY CHOICE: ____**

---

## DN2 — Weekly bar inner count badge (`.wk-bar .mini`) radius
- `app/Ananda Taskboard.html`: **`border-radius:99px`** (full pill)
- `help-onboarding/ananda-help.css`: **`border-radius:4px`** (rounded rect)

- **A)** Pill **99px** (app)   · **B)** Rounded **4px** (help)

Files: app vs help CSS. Viewport: 1440 (Weekly).
**MY CHOICE: ____**

---

## DN3 — Where do Holidays live: Team or Settings?
- **Live build:** Holidays is a **tab inside Team & Permissions**; Settings has a "Calendar events" section instead.
- **Design (MASTER-HANDOFF):** "Settings (statuses, **holidays**)".

- **A)** Holidays under **Settings** (match handoff)   · **B)** Holidays as a **Team** tab (match live)   · **C)** Both/elsewhere (specify)

Evidence: `LIVE__team__1440__light.png`, `LIVE__settings__1440__light.png`. Viewport: 1440.
**MY CHOICE: ____**

---

## DN4 — Global Overview filter bar: include Project / Sub-project filters?
- **Live:** the filter bar adds **"All projects ▾"** and **"All sub-projects ▾"** selects (useful in the aggregate "Global Overview").
- **Design list spec (CLAUDE.md):** filter bar = Assignee · Status · Priority · Deadline · Recurrence only (no project filters).

- **A)** Keep Project/Sub-project filters **on Global Overview only** (drop them on single-project views).
- **B)** Match the design exactly — **remove** them everywhere.
- **C)** Keep them on all views.

Evidence: `LIVE__list__1440__light__clean.png`. Viewport: 1440.
**MY CHOICE: ____**

---

## DN5 — Top-bar "Archive" button
- **Live:** a standalone **"Archive"** button sits in the top-right action row.
- **Design/D15 direction:** top bar lean; admin tools (Trash, etc.) live in the account menu.

- **A)** Move **Archive into the account menu** (lean top bar, consistent with D15).
- **B)** Keep the standalone **top-bar Archive button**.

Evidence: `LIVE__list__1440__light__clean.png`. Viewport: 1440.
**MY CHOICE: ____**

---

## DN6 — Theme control appears twice
- **Live:** a theme **toggle next to the logo** AND a **"Theme: Light ▾"** row in the account menu.
- **Design:** single toggle next to the logo.

- **A)** Toggle next to logo **only** (match design)   · **B)** Keep **both**   · **C)** Account-menu **only**

Evidence: `LIVE__accountmenu__1440__light.png`. Viewport: 1440.
**MY CHOICE: ____**

---

## DN7 — 👥 group indicator in the assignee picker (you flagged this to revisit)
The design itself uses 👥 for groups, so it's not a live-vs-design mismatch — but per the new "only project-picker emoji" rule it's technically off-brand.
- **A)** **Keep 👥 for now** (revisit later) — you said you like it.
- **B)** **Convert now** to a line-art group icon (e.g. lucide `Users`) everywhere groups appear (assignee picker, list, copy summary, history, team) and update the design too.

Evidence: `LIVE__assignee_picker__1440__light.png`.
**MY CHOICE: ____**

---

## DN8 — New-task primary button label
- **Live:** **"Save"**   ·   **Design (responsive new-task notes):** **"Create task"**

- **A)** "Create task"   · **B)** "Save"

Evidence: `LIVE__newtask__1440__light.png`.
**MY CHOICE: ____**

---

## DN9 — New-task Status field
- **Live:** shows **"Set after creating"** (no status chosen at creation).
- **Design (responsive new-task):** a **Status dropdown** defaulting to "To Do".

- **A)** Status selector at creation (default To Do)   · **B)** "Set after creating" (match live)

Evidence: `LIVE__newtask__1440__light.png`.
**MY CHOICE: ____**

---

## DN10 — Edit-task header pattern
- **Live:** header = generic **"Edit task · #3"** + a separate **"Task name"** field below.
- **Design:** the header **is** the inline-editable task title + a **pen icon** + a **#id chip** (no separate field).

- **A)** Inline-editable title + pen + #id chip (match design)   · **B)** Generic "Edit task · #N" header + Task-name field (match live)

Evidence: `LIVE__taskpopup__1440__light.png`.
**MY CHOICE: ____**

---

## DN11 — Task popup section order (footer vs Subtasks/Comments)
- **Live:** action footer (Share · Cancel · Delete · Save) renders **mid-modal**, with **Subtasks** & **Comments** *below* it.
- **Design:** Subtasks & Comments are part of the body; the action footer is **last** (at the very bottom).

- **A)** Footer last, Subtasks/Comments in the body above it (match design)   · **B)** Keep footer above Subtasks/Comments (match live)

Evidence: `LIVE__taskpopup_scrolled__1440__light.png`.
**MY CHOICE: ____**

---

## DN12 — Assignee-control copy: "+ Add person…" vs "+ Add person or group…"
Design-internal inconsistency: the mobile Task-detail says **"+ Add person…"** while New task (and the canonical app) says **"+ Add person or group…"**.
- **A)** Standardize on **"+ Add person or group…"** everywhere   · **B)** "+ Add person…"
Files: `mobile/` vs `app/` designs.
**MY CHOICE: ____**

## DN13 — One button spec (app vs module `.btn`)
Buttons differ across the design files (Q6): module `.btn` = padding `8px 13px`, `13px/600`; canonical app `.btn-secondary`/`.icon-btn` = `6px 9px`, `14px/500`; app `.btn-primary` = `6px 11px`, `13px/600`.
- **A)** Standardize on the **module `.btn`** spec (`8px 13px`, `13px/600`) everywhere
- **B)** Keep the canonical-app button metrics
- **C)** Other (specify)
**MY CHOICE: ____**

---

> NOTE: items NOT listed here are unambiguous fixes-to-design already itemized in `PIXEL-AUDIT-REPORT.md` (e.g. proj-pills missing, Links textarea→list [D4], Delete-left-red [D5], "Unscheduled Tasks" rename + emphasis [D6/D7/D13], Help/Trash → account menu [D15], stray emoji 🙏/🎉/🧹/🌐, native confirm → custom confirm popup, native selects → custom popovers [D2], `/api/projects` 500). Those will be applied to match the design without needing your input.
