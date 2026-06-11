# Handoff: Ananda Taskboard — Rulings 2026-06-11 (D49, D50, D51)

## Overview
Three design decisions ruled on 2026-06-11, to be implemented against the **existing**
Ananda Taskboard codebase. This is **not** a greenfield feature — each item is a change to a
surface that already ships. Implement them in the app's established environment using its
existing components, classes, and tokens.

- **D49** — Full-screen task view on **phones**: blessed sticky footer + Share moves to a header icon.
- **D50** — **APR-4 fix**: members can now see their own tasks that are awaiting admin approval
  (in-place pill + account-menu entry + a "Waiting for approval" list).
- **D51** — **Regression fix**: status pills restored to the compact (responsive) List rows.

The single source of truth for these decisions is **`DESIGN-DECISIONS-LOG.md`** at the project
root (entries D49, D50, D51). If anything here and the log disagree, the log wins — read it.

## About the design files
The files in this bundle are **design references created in HTML** — prototypes showing the
intended look and behavior, **not production code to copy verbatim**. The task is to **recreate
these changes inside the Ananda Taskboard app** using its existing patterns, components, classes
and design tokens (the same `.trow` / `.tcard` / `.lst` / `proj-pill` / `status-pill` / `.fs-head`
vocabulary the app already uses).

Critically, per the project's **RULE #0 (fidelity-first)**: the canonical chrome already exists in
`Ananda Taskboard.html` (web) and the mobile module (`mobile/`). **Reproduce the existing surface
exactly, then layer the change on top.** Do not ship a simplified version of any surface.

These reference builds work by taking the **real module output** (the app's own
`taskDetail()`, `listCompact()`, `compactRow()`, `approvalsScreen()`, and the web `appShell()`)
and applying a **surgical DOM transform** — so the diff you need to implement is exactly the
transform, nothing else. See `rulings-screens.js` (phone) and `web-ruling.js` (web).

## Fidelity
**High-fidelity.** Final colors, typography, spacing, classes and interaction details. Recreate
pixel-accurately using the codebase's existing libraries/components. Exact tokens are listed below
and all reference CSS additions are in `rulings.css` / the `<style>` block of `web-board.html`.

---

## D49 · Full-screen task view (phones) — sticky footer + Share in header

**Surface:** the phone full-screen task views — **edit** (`taskDetail()`) and **create**
(`newTask()`) in `mobile/screens-flows.js`. **Web dialogs are unchanged** (web keeps the D5 footer
Delete · Share · Cancel · Save). This ruling is **phones only**.

### Edit view
- **Header (`.fs-head`):** back chevron · title (+ pen/edit affordance) · `#id` chip ·
  **Share = a ghost icon at the right end** (where Save previously sat).
  - Share icon button: `42 × 42`, `border-radius: var(--r-ctl)` (**8px**), `color: var(--muted)`,
    icon `20×20`, stroke `currentColor`, `stroke-width: 1.9`, round caps/joins. No fill, no border.
    (Reference class `.rul-share` in `rulings.css`.)
- **Sticky footer (`.rul-foot`)** pinned under the scroll body, `flex: none`,
  `border-top: 1px solid var(--border)`, `background: var(--surface)`,
  `padding: 11px 14px 24px` (the 24px bottom clears the home indicator), `display:flex; gap:9px`:
  - **Delete** — far **left**, red outline:
    `background: var(--surface)`, `border: 1px solid color-mix(in srgb, var(--danger) 40%, transparent)`,
    `color: var(--danger)`.
  - flexible spacer (`flex:1`)
  - **Cancel** — secondary: `background: var(--surface)`, `border: 1px solid var(--border)`,
    `color: var(--text)`.
  - **Save** — primary filled: `background: var(--primary)`, `color: var(--primary-ink)`,
    `box-shadow: var(--shadow-1)`.
  - All footer buttons: `border-radius: var(--r-ctl)` (8px), `padding: 10px 14px`,
    `font-weight: 600`, `font-size: 14px`.
- **The old body-bottom full-width Delete button is removed** — Delete lives **only** in the footer.

### Create view
- **Same sticky footer**, but: spacer · **Cancel** · **"Create task"** (primary; label per **D27**).
  No Delete, no Share (nothing to share yet).
- **The old body-end full-width "Create task" button is removed** — it moves into the footer.

### Behavior
- **Back chevron stays pure navigation.** Cancel (footer) and back both trigger the
  **unsaved-changes confirm** when the form is dirty (the app's existing confirm rule —
  `openConfirm`).
- Save persists; on a member's edit/create that requires approval, it routes through the approval
  flow and shows the submit toast (see D50).

**Reference builders:** `R.q1Final` (edit), `R.q1FinalNew` (create) in `rulings-screens.js`.

---

## D50 · APR-4 — member visibility of pending-approval tasks (A + C)

**Problem being fixed (APR-4):** when a member creates or edits a task, it goes to an admin for
approval. Today it vanishes from the member's board, so it looks like it **failed to save**. Fix:
the task never disappears, and there's a durable, findable record of what's pending.

This is two coordinated parts — **A (in place)** and **C (account-menu entry → a list)** — on
**both web and phone**.

### A · In-place treatment (board / List)

A pending item **stays in its normal sorted position**, **read-only**, visually marked:

- **Row tint (warm gold):** `background: color-mix(in srgb, var(--gold) 9%, transparent)` — same
  vocabulary as the existing overdue(red)/due-soon(amber) row tints.
- **Pending NEW task** — shows a **"Pending approval" pill** in the **Status** slot:
  - Web: pill in the Status column, **no caret** (it is *not* a status and not interactive).
    `color: var(--warn)`, `background: color-mix(in srgb, var(--warn) 14%, var(--surface))`,
    `border: 1px solid color-mix(in srgb, var(--warn) 30%, transparent)`, `border-radius: var(--r-pill)`,
    `font-size: 12px`, `font-weight: 600`. (Reference `.pill-pending`.)
  - Phone compact row: **gold status rail** (`--sc: var(--gold)`) + the same tint; the pill takes
    the **status-pill slot in the D51 right column** (so the deadline stays on line 2).
    (Reference `.pend-pill`.)
- **Pending EDIT** (an edit awaiting approval): the row keeps showing the **last approved values**,
  plus a small **"Edit pending"** pill. Web: after the task name. Phone: **stacked beneath the live
  status pill** in the right column (keeps line 2 to a single line at 390px).
- **Summary strip:** gains a gold **"N Pending approval"** chip. Hidden at 0. Pending items are
  **NOT** counted into the regular task totals.
- The phone **task detail** already carries a "Pending approval" pill (in the existing
  `taskDetail()` mock) — opening a pending row shows the read-only detail with that pill.
- Pill **casing: sentence-case "Pending approval"** (matches the existing detail pill + app copy
  style). ⚠️ **OPEN ITEM** — stakeholder wrote "Pending Approval"; confirm Title vs sentence case
  before string freeze.

### C · Account-menu entry + its destination

- **Entry:** "Pending approval" with a **mono count badge**.
  - Web: first item under the account-menu header (`.um-item` + `.um-badge`).
  - Phone: in the **⋯ overflow**, exactly where **Approvals** sits for admins.
  - **Hidden at N = 0** (same rule as Unscheduled, D6).
- **Destination — "Waiting for approval" list** (⚠️ this surface is **new design, ruled this
  session** — implement as specified):
  - Reuses the **Approvals list methodology**, minus the admin approve/reject actions, scoped to
    *only the current member's* pending items.
  - **Controls:** a **Sort** select (default "Newest first") + a **Kind** select
    ("All kinds" / "New tasks" / "Edits"). **No full filter bar** — overkill at personal volume.
    (Use the house custom-select — never a native `<select>` caret; see RULE in CLAUDE.md.)
  - **Web (dialog, `max-width: 840`):** a `.lst` table with columns **Task · Project ·
    Sub-project · Assignees · Requested · Submitted**.
  - **Phone (full-screen route):** rows are the **List compact row (`.trow`) verbatim** — full
    width, gold status band left, priority icon + name on line 1, **project pill + sub-project
    pill** + "sent {date}" on line 2, and the **right column = the Requested chip (NEW/EDIT) with
    the assignee avatar(s) stacked beneath**. No chevron — rows are tappable end-to-end. Opening a
    row → read-only task detail with the pending pill.
  - **"Requested" column answers "what are they asking for":**
    - **NEW task** chip (azure/blue family): `color: var(--dome)`,
      `background: color-mix(in srgb, var(--dome) 13%, var(--surface))`,
      `border: 1px solid color-mix(in srgb, var(--dome) 26%, transparent)`.
    - **EDIT · n changes** chip (gold family): `color: var(--gold-deep)`,
      `background: color-mix(in srgb, var(--gold) 18%, var(--surface))`,
      `border: 1px solid color-mix(in srgb, var(--gold) 36%, transparent)`.
    - Chips: `border-radius: var(--r-pill)`, `padding: 2px 9px`, `font-size: 11px`,
      `font-weight: 700`, `text-transform: uppercase`, `letter-spacing: .04em`.
  - **Edits expand an old → new diff per changed field**, mono, e.g.
    `Deadline  Jun 14 → Jun 21  ·  Assignees  + Omar`. Web: a `.rq-diffrow` under the row,
    `font-family: var(--f-mono)`, `font-size: 11.5px`, `color: var(--muted)`,
    `background: var(--sunk)`; the `→` is `var(--gold-deep)`. Phone: a `.rq-diff` line under line 2.

### Behavior / states
- On submit, keep the **transient toast**: "Sent for approval — an admin will review." The pill +
  menu entry are the **durable** signals.
- Pending rows are **read-only** on the board until an admin approves; tapping/opening shows the
  read-only detail.
- When an admin approves → the task takes its real status and the pending markers clear; when
  rejected → per existing approvals behavior (out of scope of this visual ruling, follow current
  reject handling).

### Member chrome assumptions (⚠️ OPEN ITEMS — confirm)
The references render as member **"Mara"**. Assumed and **awaiting confirmation**:
- Member **topbar drops Approvals** (admin-only); **keeps Team + Projects**.
- Member **account menu strips** History / Archive / Restore points / Trash / Preview-as-Viewer.

**Reference builders:** web `web-ruling.js` (`?v=a` board, `?v=c` menu, `?v=d` the dialog);
phone `R.q2PhoneInPlace`, `R.q2PhoneMenu`, `R.q2PhoneQueue` in `rulings-screens.js`.

---

## D51 · Responsive List — status pills restored to compact rows (regression fix)

**Issue:** the phone/responsive **compact List rows** (`compactRow()` / `.trow` in
`mobile/screens-views.js`) showed status only via the colored **left rail** — too subtle. The
canonical responsive card (`.tcard`, used elsewhere) has **always** shown the status pill. This was
a regression. Restore status to every compact row.

**Spec:**
- Every compact row gains a **right-aligned column** (`.rcol`,
  `display:flex; flex-direction:column; align-items:flex-end; justify-content:center; gap:5px`):
  - **Status pill on top** — the house `.status-pill` (dot + name), `--sc`-tinted, at compact
    scale: `font-size: 10.5px`, `padding: 1px 8px`, dot `6×6`.
  - **Assignee avatars stacked beneath** it.
- The **status rail stays** (at-a-glance color); the pill names it.
- The **chevron is dropped** to pay for the width — rows are tappable end-to-end ("fill width").
  ⚠️ Confirm you're OK losing the chevron affordance (ruled yes this session).
- All five statuses appear here as everywhere: **To Do (gray) · In Progress (blue) · Delayed (red)
  · Review (purple `#7a5aa6`) · Done (green)**.
- Day-divider groups, overdue/due-soon tints + badges, priority chevrons — **unchanged**.
- Pending rows (D50) put the **"Pending approval" pill in this same right slot**; pending EDIT
  stacks "Edit pending" beneath the live status pill here.

**Reference builder:** `R.listStatuses` (and `enhanceRows` it calls) in `rulings-screens.js`.

---

## Design tokens (use the app's existing variables — do not hardcode)
All references read the app's CSS custom properties. Key ones touched here:

| Token | Role |
|---|---|
| `--gold`, `--gold-deep` | pending tint, pending/edit accents, diff arrow |
| `--warn` | "Pending approval" pill |
| `--dome` | "New task" chip |
| `--danger` | footer Delete outline |
| `--primary`, `--primary-ink` | footer Save / Create |
| `--surface`, `--border`, `--muted`, `--text`, `--faint`, `--sunk`, `--canvas` | chrome |
| `--r-ctl` = **8px** | control radius (buttons, share icon) |
| `--r-card` = **11px** | card radius (note: references pin 11/8 — the **canonical** values; some stale copies carry 13/10 — use **11/8**, per D20) |
| `--r-pill` | pill/chip radius |
| `--f-ui` (Instrument Sans) | all UI + titles/headings |
| `--f-mono` (Red Hat Mono) | numbers, diff lines, count badges |
| `--shadow-1` | footer Save elevation |

**Status colors (the 5-status pipeline, order matters):** To Do (gray) · In Progress (blue) ·
Delayed (red) · **Review (purple `#7a5aa6`)** · Done (green).

## Assets
- `assets/ananda-mark.png` — navy lotus brand mark (already in the app).
- No new assets introduced. Share / chevron / approvals icons come from the app's existing inline
  SVG icon set (`M.svg(...)` on mobile, `TRB.I.*` on web).

## Files in this bundle
| File | What it is |
|---|---|
| `Ananda Taskboard - Rulings 06-11.html` | The full reference canvas (open this first; pan/zoom; each artboard is a final state with a Notes card). |
| `rulings-screens.js` | Phone builders — the surgical DOM transforms for D49/D50/D51 over the real mobile module. **This is the implementation diff.** |
| `web-ruling.js` | Web builders — D50 board (`?v=a`), account menu (`?v=c`), "Waiting for approval" dialog (`?v=d`). |
| `web-board.html` | Web reference host + the D50/D51 CSS additions in its `<style>`. |
| `rulings.css` | All phone CSS additions (footer, share icon, pending pills, right column, diff lines). |
| `ananda-mobile.css`, `screens-views.js`, `screens-flows.js` | The **real mobile module** the references build on (read for canonical markup/classes — RULE #0). |
| `ananda-translations.css`, `tr-base.js` | The **real web chrome** the references build on. |
| `DESIGN-DECISIONS-LOG.md` | **Source of truth.** Full D49/D50/D51 entries + every affected surface + open items. Read before implementing. |
| `assets/ananda-mark.png` | Brand mark. |

## Open items to resolve before string/visual freeze
1. **Pill casing:** "Pending approval" (sentence, current) vs "Pending Approval" (stakeholder note).
2. **Member chrome:** confirm topbar drops Approvals only; confirm member-menu item removals.
3. **Chevron removal** on compact rows (D51) — confirm.
4. **i18n:** new strings (pending pill ×2, menu item, dialog title/sub/columns/chips, toast) need
   translation across all 13 locales.
