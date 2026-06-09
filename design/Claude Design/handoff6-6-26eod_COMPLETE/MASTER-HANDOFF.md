# ★ MASTER HANDOFF — Ananda Taskboard (COMPLETE)
### Every module, current as of this package. Read this file top-to-bottom.

This package contains **the entire Ananda Taskboard design** as HTML/CSS/JS **design
references** — the canonical web app plus every feature module (mobile/responsive, auth,
multi-tenancy, and the Help/Onboarding/Subtasks/Unscheduled batch). They are the source of
truth for **what to build**. Your job is to recreate them **exactly** in the target
React/TSX codebase using its real components and tokens — **not** to ship the HTML, and
**not** to approximate.

---

## 1. ⌘ THE COMMAND — paste this verbatim into Claude Code

> You are implementing the Ananda Taskboard design with **zero tolerance for approximation**.
> The folder `design_handoff_COMPLETE/` contains the COMPLETE design as HTML/CSS/JS
> references. Recreate every screen in our React/TSX app using our existing components and
> design tokens. Treat the references as pixel- and behavior-exact specifications.
>
> **Process — do this in order, do not skip:**
> 1. Read `MASTER-HANDOFF.md` fully, then `CLAUDE.md` (project law), then each module’s own
>    `README.md` / `HANDOFF.md` / `notes-for-claude-code.md`.
> 2. Build a written **inventory of every screen, dialog, popover, row type, empty state,
>    and interaction** across all modules (use §4 of this file as the index). Confirm the
>    count back to me before writing code.
> 3. Implement **module by module, screen by screen**. For each screen, open the reference
>    file, read the exact markup/classes/copy in the `*-screens.js` builder and the matching
>    CSS, and reproduce it 1:1 — field order, labels, placeholder text, icons (line-art SVG,
>    never emoji), colors (hex), spacing, radii, shadows, hover/active/focus/empty/error
>    states, light AND dark.
> 4. Reuse the REAL existing component wherever a surface reappears (List view, Task Popup,
>    filter bar, status pill, calendar, proj-pills). Never ship a simplified copy. This is
>    **Rule #0** — recreate the agreed design with 100% fidelity before adding anything.
> 5. After each screen, check it against the **Global rules (§3)** and that module’s
>    acceptance checklist.
>
> **Hard requirements that are easy to miss — verify each explicitly:**
> - 5-status pipeline in fixed order with **Review = purple #7a5aa6** (renamed from “Ready
>   for Review”), 2nd-to-last before Done.
> - **No native `<select>` anywhere** — every dropdown is the custom trigger + popover.
> - **Links is a list** of removable rows + “Add link”, not a textarea (Task Popup + subtasks).
> - **A time requires a date**; times are both-or-neither; Unscheduled tasks have no time.
> - Titles use **Instrument Sans**; **Fraunces only** for the wordmark + tagline.
> - Custom select **carets** inset ~11px (never a native caret); color swatch pickers are
>   **circles** with a recommended palette; destructive actions get a **confirm popup**;
>   header never wraps.
> - Light + dark both ship from the same tokens.
>
> **Deliverable when done:** a table mapping **every screen and every checklist item** to the
> component/file you created or changed, plus an explicit list of anything you could NOT
> reproduce and why. Do not report “done” until every item is mapped.

> Why this matters: past handoffs missed details because they were implemented from memory
> or a screenshot instead of from the exact spec. The references below ARE the spec — read
> them, don’t guess.

---

## 2. Fidelity

**High-fidelity** throughout. Final colors, typography, spacing, copy, and interaction
states are all intentional and must be reproduced exactly.

---

## 3. GLOBAL DESIGN SYSTEM (applies to every module)

**Brand / “Temple of Light” aesthetic.**
- Fonts: **Instrument Sans** = all UI + all titles/headings. **Red Hat Mono** = numbers
  (plain zero). **Fraunces** = ONLY the “Ananda Taskboard” wordmark + its italic tagline.
- Logo: navy lotus mark (`assets/ananda-mark.png`).

**Status pipeline (5, order matters):** To Do `#6b7280` · In Progress `#2c64a8` ·
Delayed `#bb3b28` · **Review `#7a5aa6`** · Done `#3f7d54`. Status shows as a pill (dot +
name); changing it uses the custom popover.

**Priority:** Highest/High/Medium/Low/Lowest, each a distinct line-art chevron icon (red→blue).

**Controls:**
- **All dropdowns are custom** — a bordered trigger (surface bg, tan border `#e4d8bb`,
  radius 8px, caret SVG inset ~11px) that opens a custom popover (options + check on
  selected). Applies to Project, Sub-project, Status “Change to…”, Priority, the
  “+ Add person or group…” assignee picker, and all filter/sort triggers.
- **Buttons:** primary = filled navy `#1e3a6e` + cream text `#fbf6ea` + permanent
  elevation shadow; secondary = surface + tan border; danger = surface + red border/text
  `#b4452f`; ghost = transparent.
- **Proj-pills** for projects & sub-projects everywhere they’re listed (tinted by color).
- **Avatars:** circular initials; overlapping stacks where space is tight (name on hover).

**Tokens:** each module’s CSS defines `:root` (light) + `[data-theme="dark"]` (dark). The
authoritative token set is in `Ananda Taskboard.html` (the canonical app); module CSS files
mirror it. Light + dark are a token swap, not separate designs.

**House rules (from `CLAUDE.md` — read it in full):** Rule #0 fidelity-first; never a
native select caret; circular color-swatch pickers w/ recommended palette; section-header
labels in uppercase UI sans (not Fraunces); destructive actions need a confirm popup;
header stays one line at small widths.

---

## 4. MODULE INDEX — what’s in the box (every surface)

Each module is a self-contained design-canvas: an HTML file (open it to see all screens,
web + mobile, light + dark) backed by `*-screens.js` builders + a CSS file. **The builder
file is where the exact markup/classes/copy live — translate from there.**

### A. CANONICAL WEB APP — `app/Ananda Taskboard.html`  ← SOURCE OF TRUTH
The complete working web app. Everything else must stay consistent with it.
- **Views:** List (dense sortable table: Task w/ priority icon · Project pill · Sub-project
  pill · Assignees chips/◇ groups · Status pill+caret · Deadline mono · Recurs), Board
  (Kanban of the 5 statuses), Weekly (bar-calendar), Monthly (grid).
- **Filter bar:** search + Assignee/Status/Priority (checkbox multi-selects w/ count pills)
  + Deadline/Recurrence (single) + Clear (only when active). **Summary strip:** total ·
  Overdue (red) · Due soon (amber) · per-status counts (all 5).
- **Task Popup:** editable title + pen + #id · Pending-approval pill · Project | Sub-project
  · Status (pill + Change-to) | Priority · Assignees (chips + add) · Details | Requirements
  · Start date | Deadline · Start/End time · Links · Repeats · Monitor · Auto-complete ·
  footer · Subtasks · Comments.
- **Admin/dialogs:** Approvals, Team (roles/access/grants/groups), Projects, Settings
  (statuses, holidays), Trash, Restore points, History, Import (CSV dry-run), Export,
  Copy Summary, confirmations.

### B. MOBILE / RESPONSIVE — `mobile/`  (`Ananda Taskboard Mobile.html`, `screens-views.js`, `screens-flows.js`, `ananda-mobile.css`)
The phone app. Covers: List (`.tcard` task cards + `.trow`/`.crow` compact variants),
Board (kanban cards w/ subtask progress), Weekly, Monthly (+ day sheet), Task detail,
New task, Team, Projects, **Trash** (`.crow` compact list + bulk bar + filters/sort),
Approvals, Nav drawer / overflow menu, assignee picker, filter sheet, search, alt-nav.
This is the reference for the **compressed `.crow` aesthetic** and the `.tcard` list.

### C. MULTI-TENANCY & INVITATIONS — `multitenancy/`  (`Ananda Taskboard - Multi-tenancy.html`, `mt-screens.js`, `ananda-mt.css`)
Org switching, multi-org membership, invitations (send/accept), org settings — web + mobile.

### D. AUTH — `auth/`  (`auth-source.html`, `auth-screens.js`, `ananda-auth.css`)
Sign-up, log-in, accept-invitation, password flows.

### E. HELP / ONBOARDING / SUBTASKS / UNSCHEDULED — `help-onboarding/`  (THIS BATCH — newest)
See its own **`HANDOFF.md`** (exhaustive) + **`notes-for-claude-code.md`** (behavior rules).
- **Help & FAQ** in the account menu + What’s-New dot; **Welcome card** (once-ever);
  **Help center** (search, collapsible counted sections, expandable results, admin handled
  by section not chip).
- **Subtask editor:** subtasks-as-mini-tasks rows (aligned avatar column, custom status
  pill) + in-place detail panel (breadcrumb header `#142 › #142.2`, Share, Delete-left,
  Links list, all controls matching the Task Popup).
- **Unscheduled Tasks:** emphasized calendar-header button (hidden at 0); web = sortable
  table (Task·Project·Sub-project·Assignees·Status, no deadline/recurrence) + Assignee/
  Project/Status filters; mobile = compact `.crow` bottom sheet over the live calendar.
  Done hidden from calendars; mobile Monthly shows holiday/event icons only (names on tap).

---

## 5. Reference files (non-screen) included
- `CLAUDE.md` — project law (read first).
- `uploads-briefs/` — original design briefs & prior handoffs for background:
  Design brief, DESIGN-HANDOFF, FIDELITY-DEVIATIONS, multi-tenancy & help-onboarding handoffs.
- Each module folder keeps its own `design-canvas.jsx` (the canvas scaffold) — you don’t
  reimplement that; it’s just how the references render.

---

## 6. ACCEPTANCE PROTOCOL (the QA gate)
Do not declare a module done until:
- [ ] Every screen/dialog/popover/row/empty/error state in §4 for that module exists.
- [ ] All Global rules (§3) hold on every screen (status order+colors, custom dropdowns,
      fonts, buttons, pills, light+dark).
- [ ] The module’s own checklist (in its README/HANDOFF) passes.
- [ ] You produced the **screen/checklist → file/line diff map** and listed any gaps.

> If a deployment “doesn’t reflect changes,” verify the build ran, the bundle hash changed,
> and caches were busted — that’s a deploy issue, not a reason to re-approximate the design.
