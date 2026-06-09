# HANDOFF — Help & Onboarding · Subtasks · Unscheduled Tasks
### Ananda Taskboard · design reference → production implementation

---

## 0. READ THIS FIRST — why details get missed, and how to stop it

These design files are **HTML/CSS/JS prototypes** (a wireframe set). They are the
**source of truth for *what to build*, not code to paste** into the React/TSX app.
Details get lost in handoff for four concrete reasons — each has a fix:

1. **Re-implementation from memory instead of from the spec.** If Claude Code is told
   “add subtasks” and works from a screenshot or a sentence, it rebuilds from its own
   assumptions and silently drops the 30+ micro-decisions below.
   **Fix:** point it at THIS file + the prototype files, and tell it to implement
   *every* item in the checklist — not its idea of the feature.

2. **Two different codebases.** The prototype is plain JS strings; the app is React +
   real components. Translation loses the exact markup/classes/field order unless the
   spec is explicit.
   **Fix:** the spec below names every field, in order, with copy — translate 1:1.

3. **No single enumerated list.** Decisions were made across dozens of review rounds.
   If they live only in chat, they don’t survive.
   **Fix:** they are ALL enumerated here. Treat each checkbox as acceptance criteria.

4. **“Looks done” ≠ “is done.”** Many fixes are invisible at a glance (custom dropdowns
   vs native, exact status order, a red Delete that was rendering dark, a button border
   that needed `!important`). A quick visual pass passes them; a real diff doesn’t.
   **Fix:** use the **Acceptance checklist (§7)** as a literal QA gate before declaring done.

**If deployments still aren’t updating:** that’s almost always a build/deploy issue, not a
code issue — confirm the branch actually built, the bundle hash changed, and the CDN/app
cache was busted. Our prototype had the *same class* of problem (the browser served stale
CSS until each file got a `?v=N` bump). Verify the deploy pipeline picked up the new commit
before assuming the change “didn’t work.”

---

## 1. What to say to Claude Code (paste this)

> Implement the designs in `design_handoff … /help-onboarding/`. The files there
> (`Ananda Taskboard - Help & Subtasks.html`, `help-screens.js`, `ananda-help.css`) are
> **design references**, not code to copy — recreate them in our existing React/TSX app
> using our real components and tokens. **Do not approximate or simplify.**
>
> Work feature by feature from `HANDOFF.md`. For each feature, implement **every** item in
> its checklist, then verify against the **Acceptance checklist** at the end before moving on.
> Where the design reuses an existing app surface (List view, Task Popup, calendar, filter
> bar, status pill), reuse the **real component**, don’t rebuild a lighter copy.
>
> Pay special attention to: the 5-status pipeline incl. purple **Review**; all dropdowns
> being our **custom** control (never native `<select>`); the **Links list** replacing the
> textarea; **time-requires-a-date** validation; and titles using Instrument Sans (Fraunces
> is wordmark-only). Also read `notes-for-claude-code.md` for behavior rules.
>
> When done, give me a short diff summary mapping each HANDOFF checklist item to the
> file/line you changed, and flag anything you could NOT do.

That last sentence is the most important — requiring a **checklist-to-diff mapping** forces
it to account for every item instead of doing the easy 80%.

---

## 2. Fidelity

**High-fidelity.** Final colors, type, spacing, copy, and interaction states are all
intentional. Recreate pixel-faithfully using the app’s existing libraries/components.

---

## 3. Global rules (apply to EVERY surface here)

- **Status pipeline = 5 statuses, fixed order:** To Do (gray `#6b7280`) · In Progress
  (blue `#2c64a8`) · Delayed (red `#bb3b28`) · **Review (purple `#7a5aa6`)** · Done
  (green `#3f7d54`). “Review” was renamed from “Ready for Review” and sits 2nd-to-last.
- **No native dropdowns anywhere.** Every `<select>`-like control is the custom control:
  a bordered trigger (thin tan border `#e4d8bb`, rounded `8px`, caret inset ~11px right)
  that opens a custom popover (options with a check on the selected one). This includes
  Project, Sub-project, Status “Change to…”, Priority, the “+ Add person or group…”
  assignee picker, and all filter/sort triggers.
- **Fonts:** Instrument Sans for ALL UI **and all titles/headings** (dialogs, calendar,
  section headers). Red Hat Mono for numbers. **Fraunces ONLY** for the brand wordmark
  “Ananda Taskboard” + its italic tagline — never for titles.
- **Buttons:** primary = filled navy `#1e3a6e` w/ cream text `#fbf6ea` + a **permanent**
  elevation shadow; secondary = surface + tan border; danger = surface + **red** border &
  red text `#b4452f`. ⚠️ In the prototype a base `button` reset forced these transparent/
  dark and needed `!important` — in React just make sure the variant classes win (this
  is a non-issue with proper component styling; don’t copy the `!important` hacks).
- **Projects & sub-projects render as proj-pills** wherever listed (tinted by their color).
- **Light + dark** both ship from the same tokens (dark is a token swap).
- **Header stays one line** at small widths (collapse labels to icons; never wrap).

---

## 4. FEATURE — Help & FAQ + Onboarding

**4a. Help entry point (web + mobile)**
- [ ] Help lives as **“Help & FAQ” at the top of the account menu** (the Admin Ada ▾ pane),
      above Settings/History/etc. The top bar stays lean: Approvals · Team · Projects.
      Available to **everyone**, not admin-gated. (Mobile: Help is in the ⋯ overflow menu.)
- [ ] A purple **What’s-New dot** (`--new #6d4aff`) rides the user pill and the Help row
      when unseen features exist; clears once the panel is opened.

**4b. Welcome card (first login, once-ever)**
- [ ] Centered ~520px modal: brand badge, Instrument-Sans title “Welcome to Ananda
      Taskboard”, one-line intro, then **3 line-art bullets** — Open a **Project tab** ·
      Switch List/Board/Weekly/Monthly · Add work with **+ New task** (shows the real pill).
- [ ] Helper line: “Need a hand later? Find **? Help** in your account menu.” Single
      **Got it** button (no Skip). Shown once ever (persist a flag).

**4c. Help center modal (the “not a wall of text” design)**
- [ ] Wide modal “Help & FAQ”. Top: search box. Then a **What’s new** block (purple New
      pills, dated). Then **collapsible counted sections**, collapsed by default:
      Getting around (4) · Everyday tasks (4) · Your account (3) · For admins (9) ·
      Common questions (5). Each section row: chevron · icon · name · mono count pill.
- [ ] Expand a section → article rows; expand an article → 1–2 short paragraphs.
- [ ] **Admin-only articles are NOT chip-tagged.** They live under “For admins” and each
      article body states it’s admins-only; typing **“admin”** in search surfaces every
      admin ticket. (We removed the old grey “Admin” chip entirely.)
- [ ] **Search** filters to a flat result list; **each result is expandable inline** to its
      article body (web + mobile). Empty query restores sections; no matches → empty state.
- [ ] Footer: “Show welcome again” (left) · “Contact us” mailto (right).
- [ ] All icons are **line-art SVG** (the dev hand-off’s 📋/✨/🙏 placeholders are replaced).

---

## 5. FEATURE — Subtask editor (in the Task Popup)

**Reproduce the real Task Popup first (Rule #0), then add subtasks below the form.**

**5a. Subtasks section (inside the Task Popup, below the form, above Comments)**
- [ ] Header: “Subtasks (N)” + status-count dots + a **segmented progress bar** showing
      `done/total` (e.g. 2/4). To-Do’s share of the bar is **empty track**, not a fill.
- [ ] Each subtask **row** (single line): priority icon · title (truncates) · a **fixed
      avatar column** (avatars centered/aligned, ◇ for a group) · **status** as the custom
      pill that opens the custom status popover (NOT a native select) · ✕ delete.
- [ ] A title-only **quick-add** row at the bottom (“Add a subtask…” + Add).

**5b. Subtask detail panel (swaps the modal body in place — never a stacked modal)**
- [ ] Header is a **breadcrumb** replacing the title:
      `← Back · Design spring flyer #142 › Lay out A4 master #142.2` — plus a **Share**
      button and the close ✕. Subtask IDs are **parent.index** (`#142.2`).
- [ ] Fields mirror the Task Popup exactly, in order: **Sub-task name** · Status (pill +
      “Change to…” custom select) | **Priority** (custom popover) · **Assignees** (identical
      chip + “+ Add person or group…” control as the parent) · Details | Requirements ·
      Start date | Deadline · Start time | End time · **Links** · footer.
- [ ] **Footer:** **Delete** on the **left in red**; **Save** (primary) on the right. No
      “Back to subtasks” button in the footer (the breadcrumb Back covers it).
- [ ] **Time validation:** show “Set both a start and end time, or neither.” and block Save.
      (See §6 behavior: a time also requires a date.)
- [ ] Mobile: breadcrumb stacks — Back/✕/Share on a top row, then Task › Sub-task below;
      two-up field rows stack to one column.

**5c. Links control (replaces the free-text “one URL per line” textarea — Task Popup AND subtasks)**
- [ ] A **list of link rows**: chain icon · URL field · ✕ remove, with a **+ Add link**
      button. Migrate the existing Task Popup Links textarea to this too, so both match.

---

## 6. FEATURE — Unscheduled Tasks (calendar)

- [ ] On **Monthly & Weekly**, a right-aligned **“Unscheduled Tasks (N)”** button in the
      calendar header (line-art calendar-with-X icon, icon centered to label). It is
      **emphasized** (blue outline + tinted fill + navy count pill) and **hidden at N=0**.
      On narrow widths it wraps to a full-width second line.
- [ ] **Web** click → modal “Unscheduled tasks (N)” = a **sortable column table** using the
      standard List methodology: columns **Task · Project · Sub-project · Assignees · Status**
      (NO Deadline/Recurrence), with a filter bar **Assignee · Project · Status** above.
- [ ] **Mobile** → bottom sheet using the app’s compact **`.crow` list** (Trash/Approvals
      aesthetic): priority · name, then Project-pill / Sub-project beneath, avatar stack +
      status pill on the right. **No date/time.** Filter row: A–Z sort + Any assignee / Any
      project / Any status.
- [ ] Calendar views: **Done is hidden** from Monthly/Weekly, the Unscheduled list, and Copy
      Summary. Mobile Monthly cells show **only** the holiday/event icon (star/megaphone);
      names appear in the day’s list on tap. Web Monthly keeps inline names.

### Behavior rules (logic, not visual) — also in `notes-for-claude-code.md`
- [ ] **A start/end time requires a date.** Block saving a time unless a start date or
      deadline is set. Times are both-or-neither. Unscheduled tasks therefore never have a
      time (no “Time” sort, no “All day” label).

---

## 7. Acceptance checklist (QA gate — verify before declaring done)

- [ ] No native `<select>` renders anywhere; every dropdown is the custom control + popover.
- [ ] Status everywhere shows all **5** statuses in order, with **Review in purple**.
- [ ] Help & FAQ opens from the **account menu**; What’s-New dot behaves; welcome card is
      once-ever with a single **Got it**.
- [ ] Help center sections are **collapsed/counted**; admin articles have **no chip** but
      surface on a search for “admin”; search results **expand inline**.
- [ ] Subtask rows are single-line with an **aligned avatar column** and **custom status pill**;
      progress bar reads `done/total` with To-Do as empty track.
- [ ] Subtask detail uses the **breadcrumb header** (`#142 › #142.2`) with **Share**; footer is
      **Delete(left,red) … Save**; fields match the Task Popup 1:1; **Links is a list**.
- [ ] Time-without-date is blocked.
- [ ] “Unscheduled Tasks” button is emphasized + hidden at 0; web = sortable table (no
      deadline/recurrence cols); mobile = compact `.crow` sheet; Done hidden from calendars.
- [ ] Titles are Instrument Sans; Fraunces only on the wordmark/tagline.
- [ ] Light + dark both correct.
- [ ] **Deliver a checklist-item → file/line diff map, and list anything not done.**

---

## 8. Files in this bundle
- `Ananda Taskboard - Help & Subtasks.html` — the design canvas (all screens, web + mobile,
  light + dark, with per-section spec notes).
- `help-screens.js` — all screen builders (the exact markup/classes/copy to translate).
- `ananda-help.css` — all component styles + design tokens (`:root`).
- `notes-for-claude-code.md` — behavior/logic rules raised during review.
- `assets/ananda-mark.png` — the navy lotus brand mark.

> Tokens live at the top of `ananda-help.css` (`:root` for light, `[data-theme="dark"]`
> for dark). Status/priority/people maps are at the top of `help-screens.js`.
