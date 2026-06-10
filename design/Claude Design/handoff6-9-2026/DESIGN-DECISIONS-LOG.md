# DESIGN DECISIONS LOG — Ananda Taskboard
> Per **RULE #1** (see `CLAUDE.md`): every decision from a Claude Design session is recorded
> here so it can be applied **retroactively** to older modules. This is the single source of
> truth for cross-cutting changes. When starting work, read this and bring stale surfaces up
> to date. Format per entry: **what changed (before → after) · exact spec · affected surfaces**.
>
> Affected-surface keys: **APP** = `Ananda Taskboard.html` (canonical web) · **MOB** =
> `mobile/` · **MT** = `multitenancy/` · **AUTH** = `auth/` · **HELP** = `help-onboarding/` ·
> **BUILD** = live React app (`frontend/` + `backend/`).

---

## GLOBAL conventions (apply to EVERY module)

### D1 · Status rename “Ready for Review” → “Review”
- Before: 5th status labeled “Ready for Review”. After: **“Review”**, color unchanged
  **purple `#7a5aa6`**, still 2nd-to-last (To Do · In Progress · Delayed · **Review** · Done).
- Spec: rename the label everywhere it appears — Kanban column, status pill, summary strip,
  status filter, any sample data, and all 13 locale strings. Color/order/behavior unchanged.
- Surfaces: **APP ✅ (done)** · **MOB ✅ (already “Review”)** · **MT / AUTH** check any status
  references · **HELP ✅**. Older handoff `design_handoff_ananda_taskboard/README.md` still
  says “Ready for Review” — **stale, update if reused**.

### D2 · No native dropdowns — custom control everywhere
- After: every `<select>`-like control is the **custom trigger + popover** (surface bg, tan
  border `#e4d8bb`, radius 8px, caret SVG inset ~11px; popover lists options w/ a check on
  the selected). Applies to Project, Sub-project, Status “Change to…”, Priority, the
  “+ Add person or group…” assignee picker, and all filter/sort triggers.
- Surfaces: **HELP ✅**. **APP / MOB / MT / AUTH** — audit for any remaining native selects
  and convert. (Hard UI rule already forbids native select carets; this extends it to a full
  custom popover.)

### D3 · Fonts — Instrument Sans for ALL titles; Fraunces wordmark-only
- After: dialog/calendar/section/screen titles use **Instrument Sans** (weight 700).
  **Fraunces** is used **only** for the “Ananda Taskboard” wordmark + its italic tagline.
- Surfaces: all. Audit any `--f-display`/Fraunces on headings and switch to `--f-ui`.

### D4 · Links field — textarea → structured list
- Before: `<textarea>` “Links (one URL per line)”. After: a **list of link rows** (chain
  icon · URL field · ✕ remove) + a **+ Add link** button.
- Surfaces: **HELP ✅ (Task Popup + Subtask editor)**. **APP** Task Popup `#mLinks` textarea
  (`Ananda Taskboard.html` ~line 2191) is **stale — migrate**. **MOB** task detail Links —
  migrate. Keep both in sync.

### D5 · Buttons — clear hierarchy
- After: primary = filled navy `#1e3a6e` + cream text `#fbf6ea` + **permanent** elevation
  shadow; secondary = surface + tan border; danger = surface + **red** border/text `#b4452f`;
  in dialog footers **Delete is on the LEFT in red**, Save (primary) on the right. All read as
  outlined buttons (not text links). (The `!important` overrides in the HELP prototype are an
  artifact of a base `button` reset — not needed with proper component styling.)
- Surfaces: all dialog footers.

### D35 · Form spacing rhythm — ONE consistent step, app-wide (philosophy)
- **Principle:** every pair of sibling form controls/rows is separated by exactly
  **one consistent vertical step** — the `--gap-form` token (**13px**). Never stack
  a `margin-bottom` AND a grid/flex `gap` on the same boundary (that was producing
  ~25px between Details and Requirements on phones, where a two-up `.row2` collapses
  to one column). A two-up row **owns** the step itself (`.row2` has the
  `margin-bottom` + uses `gap:var(--gap-form)`); the fields inside it carry **no**
  margin of their own.
- **Spec:** `--gap-form:13px` in `:root` (light + dark). `.field`, `.row2`,
  `.sheet-field`, `.rec-panel` all use it; `.row2 .field { margin-bottom:0 }`.
  New form elements MUST use `--gap-form`, not a hand-picked px value.
- **Why:** consistency reduces visual noise and scrolling; one token = one place to
  tune the whole app's form density.
- Surfaces: **APP ✅** (Task popup, subtask detail, Export/Import, Settings, Team,
  the mobile filter sheet — anything using `.field`/`.row2`). **MOB/MT/AUTH** —
  audit any local field margins (mobile `.field` was 15px, sheet 14px) and switch
  to the shared token so the rhythm matches across modules.

---

## CALENDAR

### D6 · “No date” → “Unscheduled Tasks”
- Before: calendar-header button “📋 No date (N)” + modal “No date — {N} tasks”. After:
  **“Unscheduled Tasks (N)”** button (line-art **calendar-with-X** icon, icon centered to
  label), **emphasized** (blue outline + tinted fill + navy count pill), **hidden at N=0**,
  wraps full-width on narrow widths. Modal/sheet titled **“Unscheduled tasks (N)”**.
- Locale keys `cal.noDate` / `cal.noDateTitle` → update copy to “Unscheduled …”.
- Surfaces: **HELP ✅**. **APP / MOB** Monthly+Weekly headers — apply.

### D7 · Unscheduled list = standard List methodology (no deadline/recurrence)
- Web: a **sortable column table** — Task · Project · Sub-project · Assignees · Status — with
  a filter bar **Assignee · Project · Status** (NO Deadline/Recurrence; those don’t apply to
  undated tasks). Mobile: the compact **`.crow`** list (Trash/Approvals aesthetic) in a bottom
  sheet over the live calendar, same filters + an A–Z sort, **no date/time**.
- Surfaces: **HELP ✅**. **APP / MOB** — apply.

### D8 · Weekly task-bar corner radius: pill → 5px
- Before: `.wk-bar{border-radius:var(--r-pill)}`. After: **`5px`** (softer, not a full pill).
- Surfaces: **APP ✅ (done, `Ananda Taskboard.html`)** · **HELP ✅** · **MOB** Weekly is
  agenda-style (no `.wk-bar`) → N/A.

### D9 · Done hidden from calendars
- Done tasks no longer appear on Monthly/Weekly, the Unscheduled list, or Copy Summary.
- Surfaces: APP/MOB calendar + summary logic.

### D10 · Mobile Monthly — holiday/event names are icon-only in cells
- Cells show **only** the star (holiday) / megaphone (event) **icon** (centered); the names
  appear in the **day’s task list when the day is tapped** (Monthly only). Web Monthly keeps
  inline names (cells are wide enough).
- Surfaces: **HELP ✅ (mobile)** · **MOB** — apply.

---

## TASK / SUBTASKS

### D11 · Subtasks are mini-tasks (NEW feature)
- In the Task Popup, a **Subtasks** section: header w/ status-count dots + a `done/total`
  progress bar (To-Do share is **empty track**). Rows are single-line: priority · title ·
  **aligned avatar column** (◇ for groups) · **status as the custom pill+popover** · ✕ delete
  · a title-only quick-add. Clicking a row **swaps the modal body** to a detail panel (never a
  stacked modal).
- Surfaces: **HELP ✅**. **APP** Task Popup already has a Subtasks section — reconcile to this
  exact row/控件 design. **MOB** task detail — apply.

### D12 · Subtask detail panel
- Header is a **breadcrumb** (no title): `← Back · {Parent} #142 › {Sub-task} #142.2` + a
  **Share** button + ✕. Subtask IDs are **parent.index** (`#142.2`). Field label is
  **“Sub-task name”**. Fields & controls mirror the Task Popup **exactly** (Status pill +
  “Change to…”, Priority custom popover, Assignees chip+add, Details|Requirements, dates,
  times, **Links list**). Footer: **Delete (left, red) · Save**. No “Back to subtasks” footer
  button (breadcrumb Back covers it). Mobile: breadcrumb stacks (Back/✕/Share on top row,
  Task › Sub-task below); two-up rows stack to one column.
- Behavior: subtasks capped one level deep (no sub-subtasks). Anyone assigned to a subtask
  (or in a group assigned) can edit it.

### D13 · Time requires a date (validation)
- A start/end time cannot be set without a **date** (start date or deadline). Times are
  **both-or-neither** (“Set both a start and end time, or neither.” blocks Save). Therefore
  **Unscheduled tasks never have a time** (no “Time” sort, no “All day” label).
- Surfaces: APP/MOB Task Popup + subtask editor validation.

### D14 · Unscheduled web-table assignees = avatar-only + name on hover
- In the Unscheduled table’s Assignees column, show the **overlapping mini-avatars only**,
  full name on hover (`title`) — not avatar+name chips.

---

## HELP / ONBOARDING (NEW feature module)

### D15 · Help lives in the account menu (not the top bar)
- **“Help & FAQ”** sits at the **top of the account menu** (Admin Ada ▾), above Settings/etc.;
  available to **everyone**. **Trash** also moved into the account menu. Top bar = Approvals ·
  Team · Projects (lean). A purple **What’s-New dot** (`--new #6d4aff`) rides the user pill +
  Help row when unseen features exist. Mobile: Help in the ⋯ overflow.

### D16 · Welcome card (once-ever)
- First-login modal: 3 line-art bullets (open a **Project** tab · switch views · **+ New
  task**), helper line pointing to **account-menu Help**, single **Got it** button (no Skip).

### D17 · Help center — scannable, not a wall of text
- Search + What’s-New block + **collapsible counted sections** (collapsed by default).
  Articles expand inline. **Search results expand inline** to the article body.
- **Admin articles carry NO chip** — they live under “For admins” and each body states
  “admins only”; typing **“admin”** in search surfaces every admin ticket. (Old grey “Admin”
  chip removed.)

### D18 · Line-art icons, never emoji
- Every affordance uses stroked SVG line-art; the original hand-off’s 📋/✨/🙏/🗂️ placeholders
  are all replaced. Applies to any new surface.

---

## Process / packaging
### D19 · Decisions log + retroactive propagation (this entry)
- New **RULE #1**: log every decision here and retro-apply to older modules. The complete
  cross-module handoff lives in `design_handoff_COMPLETE/` with `MASTER-HANDOFF.md`.

---

## 2026-06-07 live-vs-design audit (D20–D34)
> Resolved 2026-06-07; merged from `audit/LOG-UPDATES-for-Claude-Design.md` (was staged, not
> yet logged). New surface key **BUILD** = live React app (`frontend/` + `backend/`).

### D20 · Corner radii — one token set
- Before: app/help/mt `--r-card:11px` / `--r-ctl:8px`; mobile `13/10`; auth `14/10`.
- After: **`--r-card:11px` · `--r-ctl:8px` everywhere**. Spec: set the mobile + auth token
  blocks to 11/8.
- Surfaces: APP · MOB · MT · AUTH · HELP · BUILD.

### D21 · Weekly bar count badge (`.wk-bar .mini`) radius
- Before: APP `99px` vs HELP `4px`. After: **`99px` (full pill)**.
- Surfaces: APP · HELP · BUILD.

### D22 · Holidays live under Settings
- Before: build shows Holidays as a **Team** tab. After: **Holidays under Settings** (Settings
  = statuses · calendar events · holidays). Remove the Holidays tab from Team.
- Surfaces: APP · BUILD (+ MOB if applicable).

### D23 · List filter-bar scope
- After: the **Global Overview** list shows **All Projects + All Sub-projects** filters; an
  **individual project** view shows **only All Sub-projects** (project already scoped). Other
  filters unchanged (Assignee · Status · Priority · Deadline · Recurrence).
- Surfaces: APP · BUILD.

### D24 · Archive moves into the account menu (extends D15)
- Before: standalone top-bar **Archive** button. After: **Archive in the account menu** (with
  Trash · Settings · History · Restore points); top bar stays lean (Approvals · Team ·
  Projects).
- Surfaces: APP · BUILD.

### D25 · Single theme control
- Before: theme exposed twice (logo toggle + account-menu dropdown). After: **theme toggle
  next to the logo only**; remove the account-menu Theme dropdown.
- Surfaces: APP · BUILD.

### D26 · Group glyph 👥 — keep for now
- Decision: **keep 👥** as the group marker for now (assignee picker, list, copy-summary,
  history, team); design already uses it. **Revisit later** (likely lucide `Users`). No change
  required now; it is NOT a live-vs-design mismatch.
- Surfaces: APP · MOB · HELP · BUILD.

### D27 · New-task primary button label
- Before: build "Save". After: **"Create task"** on the New-task dialog (the Edit dialog keeps
  "Save").
- Surfaces: APP · MOB · BUILD.

### D28 · New-task Status selector
- Before: build "Set after creating". After: a **Status selector defaulting to "To Do"** is
  available at creation.
- Surfaces: APP · MOB · BUILD.

### D29 · Edit-task header = inline-editable title
- Before: generic "Edit task · #N" header + a separate "Task name" field. After: the **header
  IS the inline-editable task title + a pen icon + a #id chip**; no separate name field.
- Surfaces: APP · MOB · HELP · BUILD.

### D30 · Task-popup layout — sticky footer
- Before: action footer rendered mid-modal with Subtasks/Comments below it. After: modal =
  **fixed header → scrollable body (fields → Subtasks → Comments) → footer pinned to the modal
  bottom with a `border-top`** (sticky; never scrolls out of view regardless of content
  length).
- Spec: apply to the **Task popup** AND the **Subtask detail** panel; reuse the pattern for any
  other long modal.
- Surfaces: APP · MOB · HELP · BUILD.

### D31 · Assignee-control copy unified
- Before: mobile Task-detail "+ Add person…" vs New-task/app "+ Add person or group…". After:
  **"+ Add person or group…" everywhere**.
- Surfaces: APP · MOB · HELP · BUILD.

### D32 · One button spec
- After: standardize on the **canonical-app button metrics** (secondary/icon `padding 6px 9px`,
  `14px/500`; primary `6px 11px`, `13px/600`) across all modules; drop the module `.btn`
  `8px 13px / 13px·600` variant.
- Surfaces: APP · MOB · MT · AUTH · HELP · BUILD.

### D33 · All dropdowns → custom popovers (resolves D2 scope)
- After: **every native `<select>` becomes a custom trigger + popover** (a single-select
  sibling of the existing MultiSelect) — Project, Sub-project, Status "Change to…", Priority,
  filters/sort, Language, etc.
- Surfaces: APP · MOB · MT · AUTH · HELP · BUILD.

### D34 · Only project-picker emoji; chrome emoji → line-art (codifies the emoji rule)
- After: the **only** emoji allowed are per-Project emoji chosen via the Emoji Picker. Convert
  chrome emoji to lucide line-art: **🌐→Globe · 🎉→CircleCheck · 🧹→Trash2 · 🙏 removed ·
  📋→ClipboardList · 📁 removed · ✅→CircleCheck**. Keep 👥 (D26, revisit) + 🙂 (the picker
  default). eslint `no-emoji-icon` allow-list = `['👥','🙂']`.
- Surfaces: APP · MOB · MT · AUTH · HELP · BUILD.

---

## Build-conformance backlog (bring the live BUILD up to EXISTING decisions)
> Already correct in the design/log; the **build** must catch up. Tracked here so they aren't
> lost; not new decisions.
- **D4** Links textarea → structured link-row list — BUILD (+ APP reference) stale.
- **D5** Footer Delete → left + red — ✅ done in BUILD TaskModal; apply to other dialogs + APP
  reference.
- **D6/D7/D13** "Unscheduled Tasks" rename + emphasis + List-methodology table, no "All
  day"/Time sort — BUILD stale.
- **D15** Help & FAQ + Trash + Archive (D24) into the account menu; lean top bar; purple
  What's-New dot — BUILD stale.
- **D16/D18** Welcome card: single "Got it" on web (no Skip), 🙏 removed (✅) — BUILD partly
  done.
- **D17** Remove the grey "Admin" chip in Help search/articles — BUILD stale.
- **D11/D12** Subtask row (priority · avatars · status pill+popover · progress bar) + detail
  panel (breadcrumb `#142 › #142.2`, Share, "Sub-task name", Links list, Delete-left) — BUILD
  stale.
- **proj-pills everywhere** — ✅ List + Board done; extend to Trash / Copy-summary /
  Bulk-migrate.
- **Auth lotus mark** (currently a navy dot) — BUILD stale.
- **i18n** add Help / summary-strip / status-pill labels to all 13 locales.

---

## COMMUNITY TRANSLATIONS — "Help Us" (NEW feature module · 2026-06-08)
> Designed in `translations/Ananda Taskboard - Community Translations.html` (web + mobile,
> light + dark, all states). Reuses real app chrome verbatim (topbar, account menu, the List
> view as the faux board, `.modal`, custom selects, `.help-sec` accordion, phone status bar /
> app bar / full-screen route / bottom sheet, `.segbar`). Surfaces: **TRN** = this module ·
> apply to **APP/MOB/BUILD** when implemented.

### D36 · Settings gains a left section-nav; "Help Us" is a section in it
- Before: Settings is one long scrolling sheet of `section-title` blocks. After: the Settings
  dialog gets a **left section-nav** (Account · Notifications · Task statuses · Calendar &
  holidays · **Help Us**) so each area is its own pane; mobile Settings is a **list route**,
  each item a full-screen sub-route. **Help Us** is the first new pane — a hub of "ask" cards.
- **Help Us card** = line-art icon tile (azure tint) · title · one-line blurb · primary CTA;
  warm/invitational. Only **Improve translations** is live; future asks render as muted
  `Coming soon` cards so the stack reads right at 1 *or* 4 cards. A purple **What's-New dot**
  (`--new`) rides the Help Us nav item + the account-menu Help row while unseen.
- Surfaces: **TRN ✅** · **APP/MOB/BUILD** — add the section-nav + Help Us pane.

### D37 · Contributor — "Improve translations"
- **Language picker** = the house custom popover (never native); defaults to the member's UI
  language. **English is the read-only source**, never a target. All 12 targets are LTR
  (incl. CJK + Indic) — no RTL; CJK/Indic use a **Noto Sans** fallback stack.
- **9 category sections** (most-used first), reusing `.help-sec`; each header shows a **mono
  untranslated-count** badge (green check when 0). **Untranslated rows sort first.**
- **String row:** English source (read-only) · current translation (or muted "— untranslated")
  · an input · **per-row Save → `Saved ✓`**. **No "submit all".** A **saved row stays editable**
  (Saved ✓ + **Edit**; revising flips Save → **Update**) so a member can change their mind and
  re-save later — never locked. **Partial submission** is first-class: an informational
  `N of M translated` hint but **no completion gate / nag**. Save errors show **inline with Retry**.
- **Search:** a search field at the top jumps to any phrase across all 9 categories; results show
  source · current · input + the category each phrase belongs to.
- **Fuzzy-merge:** near-duplicate English ("Add link" / "Add a link" / "Add link…") collapses
  into one canonical row with a **`+N similar`** chip that expands to the exact variants.
- **All-done** = warm celebratory empty (line-art **lotus**, not 🙏 — honors the no-emoji
  rule D34) + thank-you. Loading = shimmer skeleton rows.
- **Mobile:** full-screen route; rows **stack** (English → current → input); language picker is
  a **bottom sheet**; section headers **sticky**; inputs ≥16px.
- Surfaces: **TRN ✅** · **APP/MOB/BUILD**.

### D38 · Superadmin — "Translation review" = a poll graph
- Lives beside **Platform overview** (superadmin-only). Locale picker (custom popover) → the
  strings with ≥1 suggestion.
- **THE POLL GRAPH** is built on the existing **`.segbar`** vocabulary (no charting lib): one
  **horizontal bar per distinct variant**, **length = number of submitters**, sorted
  most-popular first, count in **Red Hat Mono** at the bar end. A single **calm azure** fill
  (NOT status colors — these aren't statuses); the **leading** bar reads stronger; the
  **currently-live** variant gets a **green check + tint + `Live` chip**.
- **Approve** by clicking/tapping a bar (hover reveals a `✓ Make live` target). Because it goes
  live app-wide with **no redeploy**, a small **confirm popup** follows (app confirm rule).
  **Clear override** (danger styling) reverts to the bundled baseline. An **expander** shows
  individual submitters (name + exact text) on demand.
- States: loading · **no-pending** empty · just-approved (banner + new live wording) · existing
  override ("change winner") · **1 / 2 / many** variants incl. near-ties · long CJK/Indic
  variants wrap without breaking bars. **Mobile:** full-screen route, bars stack full-width,
  approve via tap, submitter detail in a **bottom sheet**.
- Out of scope (v1): upvoting, public/no-login submission, per-org translations, per-key
  overrides.
- Surfaces: **TRN ✅** · **APP/BUILD**.

### D39 · Connected controls must be perfectly aligned (hard UI rule, app-wide)
- **Rule:** a control placed next to a field it acts on — an input/textarea/select + its action
  button, or two side-by-side buttons/dropdowns — must be **perfectly aligned**. The required
  alignment depends on the layout:
  - **Side-by-side** (button beside the field): flush on **BOTH top and bottom edges**
    (identical height), never merely bottom-aligned with mismatched heights — they read as one
    connected control group.
  - **Stacked** (button *below* its control — still allowed, and often right on mobile or when the
    field is full-width): align the **shared vertical edge** instead — typically the button is
    left-aligned (or full-width) to the field's edge, sitting directly beneath it with consistent
    spacing. Whatever the orientation, edges must line up cleanly; "appropriate alignment" just
    means matching the axis the controls share.
  - **Stacked over a button GROUP** (a field above a row of actions — Save/Cancel, etc.): the
    rule applies to the **group as a unit**, not each button to the field. The buttons align to
    each other (flush top+bottom, equal height, even gap — see side-by-side) and the **group**
    aligns to the field's edge (left-aligned, full-width, or right-aligned per the surface's
    footer convention). Never stretch one button to the field's height or force every button to
    the field width — only the group's outer edge tracks the field. This rule must not flatten a
    legitimate footer/action-bar into a single oversized control.
- **How (side-by-side):** put the field and its button in one flex row with `align-items: stretch`
  (or a shared control-height) so the button matches the field's height; keep labels *above* and
  helper/hint text *below* the row so they never drag the button out of line.
- **How (stacked):** the button aligns to the field's left edge (or spans its width); don't center
  it under a left-aligned field.
- **Bug this fixed:** the contributor Save/Update/Edit button was `~34px` against a `38px`
  textarea and only bottom-aligned, so tops were off; in the re-edit state the "previously
  saved…" hint pushed the button below the textarea entirely.
- Surfaces: **TRN ✅** · retro-apply to **APP/MOB/BUILD** anywhere a button sits beside or below a
  field/select (task modal, filters, settings, auth).

### D40 · Devotional quotes — an "Ananda" brand-voice flourish (app-wide, sparing)
- **Idea:** sprinkle short, relevant quotes from the line of masters to make the app feel like an
  *Ananda* app. **Approved roster:** Paramhansa Yogananda, Lahiri Mahasaya, Swami Sri Yukteswar,
  Babaji, Swami Kriyananda — **and Jesus Christ used VERY sparingly**, only when a quote is
  *uniquely and supremely* relevant; lean heavily on the others.
- **Voice/type:** TWO treatments. **(a) Lite** (working surfaces like the Help Us hub): no box, no
  logo — a small **warm-gold Fraunces italic** line (12.5px, gold-deep/gold) with a quiet uppercase
  gold attribution; deliberately smaller + warmer than the gray functional description so they
  never compete. **(b) Boxed** (`TRB.quote`): gold-tinted card, **text + attribution only — NO
  icon/lotus mark** (2026-06-09: user removed it; quotes carry no iconography) — reserved for
  celebratory full-screen moments only (thank-you / all-done / empty). NOT a heading (no-Fraunces-
  titles rule still holds).
- **Placement (lite):** epigraph **between the title and the description** — hugs the title, with a
  clear gap before the description. (Explored next-to-title / between / below; user chose between.)
- **Placement rules:** at most **one per surface**, at a generous/celebratory moment (hub header,
  thank-you/empty states) — never stacked on dense working UI, never decorative filler. **Accuracy
  is sacred:** only use verified wording; if unsure, ask before shipping a quote.
- **Live placements (TRN):** Help Us hub (lite, between title & description) → Kriyananda *"Many
  hands make a miracle."*; Improve-translations all-done (boxed) → Yogananda (including others'
  happiness); Suggest-a-feature thank-you (boxed) → Yogananda (service); Spread-the-word sent
  (boxed) → Kriyananda (pulling together).
- Surfaces: **TRN ✅** · available app-wide via `TRB.quote` for **APP/MOB/BUILD** (empty states,
  onboarding, thank-yous) — curate per the rules above.

### D41 · Help Us — the three community flows are now LIVE (not "Coming soon")
> All open from the Help Us hub cards; web = real Settings dialog w/ sticky footer (D30), mobile =
> full-screen route w/ sticky action footer. Reuse the app form vocabulary (`.field`/`.sec-label`/
> `.note`), house custom selects (no native carets), the segmented control, and D39 alignment.
- **Report a problem** (`TRF.webReport`/`phoneReport`): only **What happened?** is required; **Where**
  = custom select, **severity** = segmented (Minor / Slows me down / Blocks me), optional
  **screenshot** (thumbnail + remove), and an **Include technical details** toggle (on; browser +
  current page, "no personal data"). Success = clean confirmation + **mono reference number**, no
  quote. States: form · filled · sent.
- **Suggest a feature** (`TRF.webFeature`/`phoneFeature`): idea-first — one-line **idea** required,
  optional detail + area (custom select), **Tell me when this ships** toggle. Honest expectation
  "We read every one." Thank-you carries a Yogananda quote (D40). States: form · filled · sent.
- **Spread the word** (`TRF.webSpread`/`phoneSpread`): mirrors **Team → Invite** — email + optional
  note + Send, **or** a **join link** (copy-row = input+button flush both edges per D39; Copy →
  `Copied ✓`) + share targets (copy/email/message). Note: "anyone with the link can request to
  join — an admin approves" (matches multi-tenancy). Sent = confirmation + Kriyananda quote.
  States: form · copied · sent.
- Also: **Settings section-nav "Calendar & holidays"** now uses a real **calendar icon** (was the
  grid icon); the **Help Us pane title** aligns its first line with the first nav item ("Account")
  per the alignment logic (was crowding the header divider).
- Surfaces: **TRN ✅** · **APP/MOB/BUILD** — build these three as real features off the Help Us hub.

### D42 · No hard-clipping of text — RESTORED (hard UI rule, app-wide) · 2026-06-09
> **Numbering correction (per DESIGN-SYNC 2026-06-09):** the 2026-06-08 rule "No hard-clipping
> of text" was originally logged as D36, then accidentally displaced when the 06-08/09 session
> reused D36 for "Settings section-nav + Help Us". It is restored here as **D42**. From now on
> cite **D42** for text clipping. **Never reuse an existing D-number — new decisions always take
> the next free number.**
- **Rule (summary, binding):** text never hard-clips. Every place text can overflow must do one
  of: **ellipsis + a reachable full text** (tooltip, expand, or detail view) · a **"+N" overflow**
  affordance · or **wrap**. Raw `overflow:hidden` truncation with no path to the full text is
  forbidden.
- ⚠️ **Verbatim text pending:** the original 2026-06-08 wording must be preserved verbatim — it
  lives at the bottom of the merged log (`handoff6-6-26eod_COMPLETE/DESIGN-DECISIONS-LOG.md`).
  **Gordon: paste/attach it and this summary will be replaced with the exact text.**
- Surfaces: ALL (APP/MOB/MT/AUTH/HELP/TRN/BUILD).

### D43 · All-done icon = official prayer-hands artwork · 2026-06-09 (final)
- The Improve-translations **all-done** screen uses the **user-provided prayer-hands artwork**,
  processed to a **transparent-alpha PNG** (`translations/assets/prayer-hands-alpha.png`, white
  background removed, trimmed, 54px) so there's no white box; dark theme = `invert(1)`. (A true
  SVG needs the original vector source — ask the user if wanted.) Per D34's official-icons
  principle, provided assets beat freehand drawings — a freehand SVG trace was attempted and
  rejected for fidelity.
- Boxed-quote attribution (— Paramhansa Yogananda etc.) is **centered** on its own line (user).
- History: lotus → heart-hands emoji → line-art heart-hands → line-art prayer hands → **official
  artwork (final)**. **No emoji — D34 stands.**
- Also per user: the **boxed quote carries NO icon** (lotus mark removed from `TRB.quote`) — see
  D40 amendment. And the all-done screen's rhythm: top padding 22px (was 46), icon→title 14px,
  title→body 10px, body→quote 24px.
- Surfaces: **TRN ✅** · APP/MOB/BUILD when these screens are built.

### D44 · Code-audit application — Community Translations / Help Us (2026-06-09)
> Applies `CODE-AUDIT-FEEDBACK.md` + Gordon's §12 rulings. All in the TRN canvas; build per below.
- **§1 RULED — personal coverage, not "untranslated":** all 13 catalogs are complete (555 keys);
  the feature is *improve*, not *fill in*. Meter → "You've suggested **N** of **555**"; category
  badges = phrases **without your suggestion** (green check at personal 100%); rows you haven't
  touched sort first; column is **"Current wording"** and always shows the live value; all-done →
  "You've suggested something for every phrase" (celebration design kept). Source note: *"Every
  phrase already has a translation — suggest anything you'd say more naturally. Built-in interface
  text only; your board's own statuses and project names aren't included."*
- **§2 RULED — Settings member-visible, role-filtered:** members see Account · Notifications ·
  Help Us; org admins add Task statuses · Calendar & holidays. **Account pane** (name · read-only
  email · Language custom-select · Light/Dark/System segmented · change password) and
  **Notifications pane** (Daily digest toggle + time · deadline reminders · assignment changes)
  are now designed — they absorb the account-menu items.
- **§3 RULED — Spread the word = new-center referral:** share the self-serve **signup URL**
  (`/signup`) via copy-row + share targets, optional personal email ("Send a hello"). Member-invite
  + join-approval queue **cut from v1** (v2 candidate, own design). Note copy: "They create their
  own board — nothing here changes your team."
- **§4 RULED — screenshot stays:** client-side compress (~≤300 KB JPEG, 1 MB cap, hint in the
  attach control), stored in Postgres, 90-day auto-purge. Reference format **TB-0042**
  (zero-padded DB id).
- **"Tell me when this ships" cost (user 06-09):** subscribes only the suggestion's author —
  one notification to one member if it ships. Deliver via the existing **PWA push** (same pipe as
  the daily digest; zero marginal cost), email only as fallback. Hint added: "One notification if
  it ships — nothing else." No free-tier budget impact.
- **§5 — fuzzy-merge:** exact-after-normalization ONLY (trim · whitespace · trailing ellipsis;
  never casefold). "+N similar" copy now says "identical phrases (same text after trimming)".
  Storage fans out per covered key; review groups the same way.
- **§6 — placeholders (FINAL ruling, user 06-09): invisible to members.** Display strips
  `{{tokens}}` entirely — "Assigned to {{name}}" shows as **"Assigned to"**; review polls the same.
  Members translate only the visible text; **the build re-inserts the variable in its
  source-position slot**. The guard/error state is removed (nothing visible to break). Known v1
  limit (flag to Code): languages needing a different variable position can't express it —
  earlier iterations (token chips, word-chips, example-value pills) all rejected as confusing.
- **§7 — confirm copy** softened to "from now on" (honest propagation).
- **§10 pulls:** poll card gains **"Or enter your own wording…"** free-text override (curator);
  new variant flag **"matches current"** (muted). Upvoting / public submission / per-org
  translations stay out.
- **Poll scale (user 06-09):** with **100+ replies** per phrase, the card shows the **top-5
  wordings** as bars; the long tail collapses into "Show all N wordings · M more replies".
  Submitter expander unchanged (scrolls). Bars stay relative to the leader; counts mono.
- **Task statuses pane (user 06-09):** added to the Settings section-nav set — a **faithful
  reproduction of the canonical status manager** (`#statusList` in `Ananda Taskboard.html`):
  drag-to-reorder rows · circle swatch (swatches are circles, per the hard rule) · editable name
  input · "Task Complete" pill on Done · add-status row (swatch + name + Add status). Updated to
  the **five-status rule** (Review purple #7a5aa6, 2nd-to-last) — the canonical file's 4-status
  data is stale on this point. Admin-only (role-filtered nav, §2).
- **Calendar & holidays pane (user 06-09):** canonical Settings sections ported faithfully into
  the section-nav — event listrows (Edit/✕) · add-event card with full repeat panel (every/unit ·
  weekday buttons · ends) · the HOLIDAY_SETS as checkbox cards + Admin-only pill + member
  note. Native selects → custom selects (D33). ⚠️ canonical 🎂/🔁 event markers kept for fidelity —
  needs a D34 ruling (convert to line-art or allowlist).
- **Italian holidays set (user 06-09) → CODE ACTION:** add a new holiday set **"Italian holidays"**
  (Capodanno, Liberazione Apr 25, Festa della Repubblica, Ferragosto, Ognissanti…) to
  `HOLIDAY_SETS` in `Ananda Taskboard.html`, default ON, ordered after Hindu/yoga festivals and
  before Ananda lineage days (fits the Ananda Assisi community). Build supplies the real date
  table. Surfaces: TRN ✅ · APP/MOB/BUILD.
- **Quote placement comparison (user 06-09):** options 1 (next-to-title) and 3 (below-description)
  eliminated from the canvas; option 2 (epigraph) is the locked, sole-presented treatment.

### D47 · Events & Holidays — rename, tabs, and the personal-vs-team model · 2026-06-09
- **Rename:** Settings section "Calendar & holidays" → **"Events & Holidays"**; the pane splits
  into two in-pane tabs (**Events** / **Holidays**, house segmented control). Each tab: the
  **Add card on top, list below** (the app's usual format).
- **Permissions model (NEW):** the pane is **member-visible** (no longer admin-only).
  - **Admin-set** events + holiday sets apply **org-wide** and are **locked for members** (lock
    icon, no Edit/✕; holiday sets render as read-only static rows per D45 — never disabled
    checkboxes).
  - **Every member** can add **personal** events and holidays — visible **only on their own
    board** (tagged "only on your board"); always editable by their owner.
- Lists group **Your events/holidays** first, then **Team** items. Edit/✕ = the canonical listrow
  ghost pair (red ✕). Italian holidays set included (see CODE ACTION above).
- **CODE ACTION:** needs a personal-scope events/holidays model (per-user rows alongside the
  org-wide ones) + the member-visible Settings gating from §2/D44.
- **Margins (user 06-09):** Settings-pane vertical rhythm normalized to **D35** — every inter-block
  gap is `--gap-form` (13px); removed ad-hoc 8/10/12/16/18px. `.sec-label` now carries a
  `--gap-form` top margin so "Your events" / "Team events" sections breathe; tight label→content
  and card-title→form pairs intentionally stay smaller.
- Surfaces: **TRN ✅** · APP/MOB/BUILD.

### D48 · "Spread the word" deferred post-MVP · 2026-06-09
- **Decision:** the **Spread the word** Help Us ask is **hidden from the live hub for MVP** — its
  referral/email plumbing (signup-link sharing, personal-note emails, share targets) is beyond MVP
  scope. The hub ships with **three** asks: Improve translations · Report a problem · Suggest a feature.
- **Preserved, not deleted:** the flow builders (`TRF.webSpread` / `phoneSpread`) and the canvas
  section remain (section relabeled "DEFERRED post-MVP"); the hub card is commented out in
  `huPane()`. Re-enable = restore the one card object. Design is "done", just parked.
- **Build:** don't implement Spread the word for MVP; revisit when invite/referral infra is in.
- Surfaces: **TRN (hidden) ·** APP/MOB/BUILD — skip for MVP.
- **Saved-row treatment (user, 06-09):** a saved row **locks in** — the input is replaced by the
  static suggestion text + `Saved ✓` + **Edit** (Edit reopens the field → Update). At a glance:
  fields = not yet locked in. Input placeholder: *"Type your concise translation…"*.
- **Help Us card CTAs (user, 06-09):** uniform width (min 104px, centered label), no chevron;
  "Start translating" → **"Translate"**. One-word verbs across cards (Translate · Report ·
  Suggest · Invite) so the right edge stays tidy.
- **Help Us card layout (user, 06-09, final):** icon tile top-left · title · blurb · meta, then the
  CTA as a **full-width bottom row, center-justified** in the card (uniform 104px min button).
- **Notifications pane (user, 06-09):** Daily digest defaults **ON**; the digest-time field is
  always visible but **grayed/disabled when the toggle is off**. Delivery note in-pane: PWA web
  push — "no app store needed; on a phone, add to Home Screen and allow notifications."
- **Account pane (user, 06-09):** Theme is **Light / Dark only** (no "System" — the app has two
  themes). **Change password** gets its flow: an in-pane sub-view (← Account back link · current /
  new / confirm fields · right-aligned Cancel + Update password group per D39).

### D45 · No data field if it is not editable (hard UI rule, app-wide) · 2026-06-09
- **Rule:** a value the user cannot edit is **never presented inside field/input chrome** — it
  renders as **standalone text** (label above, plain value, optional hint below). Disabled-looking
  inputs mislead people into trying to edit and make forms feel broken.
- **Exception:** a value paired with an explicit **Copy** action (e.g. the share-link copy-row)
  may keep field appearance — there the chrome signals "selectable", not "editable".
- **First application:** Account pane email (was a disabled input → now static text + hint).
  Retro-audit: APP/MOB/BUILD anywhere a disabled input shows a read-only value.

### D46 · Balanced wraps for short UI copy (hard UI rule, app-wide) · 2026-06-09
- **Rule:** short copy that wraps onto 2–3 lines (card blurbs, dialog subtitles, intro sentences,
  empty-state paragraphs) uses **`text-wrap: balance`** so lines split evenly — never a lone word
  or short fragment ("every one") stranded on the last line. Long body text keeps
  `text-wrap: pretty` (balance is for short blocks only).
- First application: Help Us card blurbs · flow intros · dialog subs · success/empty paragraphs.
- Surfaces: TRN ✅ · retro-apply APP/MOB/BUILD.
- **Stale surfaces for Code's audit:** TRN canvas sections ct-* (reframe + placeholder state),
  rv-* (own-wording + flags + confirm copy), fl-spread (referral), hu-* (role-filtered nav +
  Account/Notifications panes). Mobile unchanged in structure; ships with the mobile chunk.

---

## WORKSPACE STRUCTURES (synced 2026-06-09)
- **`design-constitution.md`** (project root) — the universal 10-rule standing law; applies to
  all projects. Read alongside this log at session start.
- **`DESIGN-SYNC.md`** (project root) — the 2026-06-09 sync briefing (build state, output
  convention, standing rules digest).
- **Output convention, every session:** ① artifacts in one self-contained handoff folder
  `handoff<M-D-YY>` · ② decisions appended to this log · ③ a "what changed + which surfaces are
  now stale" note for Code's fidelity audit.
