# Claude Design reskin — integration plan + extreme QA/UX analysis

**Branch:** `feature/claude-design-reskin` (off deployed `409dd38`). Nothing auto-pushed/deployed.
**Source design:** `Ananda Taskboard (standalone) 6-3-2026.html` (FINAL). Decoded for analysis to
`_decoded_app.html` (full HTML), `_app.js` (124 KB app logic), CSS in the decoded HTML's `<style>`.

## What the design actually is (de-risking)
- A **vanilla-JS standalone** (`getElementById`/`innerHTML` imperative rendering) — a **visual + UX
  reference**, NOT portable React. So integration = port its **CSS / theme / markup structure / UX
  flows** into the existing React components; **keep all tested logic** (visibility, tiers,
  exclusions, import/export, i18n, groups filter, audit, recurrence, approvals…).
- It is a **faithful superset** of the live app (references tier/approval/archive/monitor/recurrence/
  comment/subtask) — so screens map ~1:1.

## Resolved unknowns
- **"DISPATCH"** = the view-router section (`renderCurrentView`), not a new feature/screen.
- **`doing`** in the design = key for label "In Progress". The live app uses **dynamic,
  admin-editable statuses** keyed `in_progress`. → **Adopt the design's status colors/ring/bar
  styling; do NOT rename the status key.** No migration. (If the user wants the literal label
  "Doing", that's a one-row edit in Settings → Statuses, not a code change.)

## New things the design introduces (vs current app)
1. **Dark mode** (light/dark theme tokens + smooth `theme-switching`). NEW. Needs: a theme toggle
   (place in the account menu next to Language), persisted (localStorage + optionally `User` pref),
   and `data-theme` on `<html>`. Default = light / follow OS.
2. **Refined visual system** — new `:root` tokens (canvas/surface/surface-2/sunk/border/muted +
   status colors `--todo/--doing/--delayed/--done`, `--ring-soon`, `--bar-soon`). Port into
   `frontend/src/index.css` + `App.css` token layer; keep variable names mapped.
3. **Emoji picker** with category tabs (emoji **centered**, fixed height) + skin tones. → implement
   with **emoji-mart native** (full Unicode, search, recents, tones; picks are real Unicode → paste
   into WhatsApp/Slack). Match the design's panel layout/styling.
4. **Avatar full-name tooltips** on assignee initials — Board cards + **Weekly** (both the spanning-bar
   avatar and the today-column avatar; the latter needs `pointer-events` enabled + the `data-tip` hook).
   Apply consistently to Monthly/List/Dispatch wherever initials render.
5. Chrome refinements: brand mark/logo (inlined PNG asset in the standalone — extract + add to
   `frontend/public`), refined topbar/tabs/subtabs/viewbar/filters styling.

## Integration order (chunked commits; full backend suite + tsc/build + webapp-testing per chunk)
1. **Theme foundation** — port CSS tokens (light+dark) into the React app's stylesheets; add the
   `data-theme` toggle (account menu) + persistence. Verify every existing screen still renders.
2. **Status styling** — map design's status colors onto the dynamic StatusPill/columns (keep keys).
3. **Chrome** — topbar/brand/tabs/viewbar/filters to match the design.
4. **Per-screen markup polish** — List, Board, Weekly, Monthly, Task modal, admin dialogs — align
   structure/spacing to the design; keep all fields/controls/logic.
5. **Emoji-mart** swap (ManageProjects emoji picker + anywhere emoji are chosen).
6. **Avatar tooltips** (board + weekly + others).
7. i18n: any NEW visible strings → add key to `en.json` + all 13 catalogs (parity test enforces).

## EXTREME QA / UX checklist (apply per screen)
- States: loading / empty / error / disabled / long-text / long translated strings / narrow mobile.
- Keyboard + focus rings; ESC closes modals; click-outside; tab order.
- Dark mode: contrast on every surface, pills, overdue/soon tints, focus rings, charts.
- Don't drop any current field/column/filter to match the design — if the design omits one,
  KEEP it and note it (flag below).
- Verify the new look doesn't break: drag-drop on Board, calendar spanning bars, recurrence panel,
  assignee picker expanded editor, import dry-run table, export dialog, audit Activity tab.
- i18n long languages (de/ta) must not overflow the new tighter chrome.

## OPEN QUESTIONS for the user (decide in the morning — proceeding on the marked default meanwhile)
1. **Dark mode default**: follow OS / always light / remember last? *(default: follow OS, remember last)*
2. **Theme toggle location**: account menu row (like Language)? *(default: yes, account menu)*
3. Does the design **drop any current control** intentionally (e.g., a filter, the priority chevrons,
   the "Monitor"/"Auto-complete" checkboxes)? *(default: KEEP everything; design = look only)*
4. Status **label** "In Progress" stays, or rename to "Doing"? *(default: keep "In Progress")*
5. The standalone's brand **lotus/logo** PNG — use it as the app logo? *(default: yes, extract + inline)*
6. Persist theme/lang as **per-user (backend)** or just localStorage? *(default: localStorage now;
   backend later — language is already backend.)*

## Decisions log (append as the port proceeds)
- (start) Branch created; design decoded; status-key rename rejected (styling-only); DISPATCH = router.
- **Dark mode SHIPPED** (`c…` commit): design dark palette mapped onto existing token names
  (additive `html[data-theme="dark"]`, zero component edits) + System/Light/Dark picker in the
  account menu (System follows OS), persisted in localStorage `at-theme`. i18n across 13 catalogs.
  Verified: bg ivory→navy, persists reload, switches back; 0 functional errors.
- **Avatar full-name tooltips ALREADY PRESENT in live app** — KanbanView (board cards) and
  WeeklyView (spanning-bar avatar) already use `title=` full names. No separate "today-column"
  avatar exists in the React app (that was a design-only element); Monthly has no avatars. So
  design tweak #2/#3 = already satisfied. (Optional later: swap native `title` for the design's
  styled `data-tip` tooltip — cosmetic only.)

## Remaining chunks (next session, larger / need budget)
- **emoji-mart native** picker (replace ManageProjects emoji input; npm i @emoji-mart/react @emoji-mart/data).
- **Chrome polish** (topbar/brand/tabs/viewbar/filters) + per-screen spacing to match the design.
- **Brand logo** (extract inlined PNG from the standalone → frontend/public) — pending Q5.
- Dark-mode contrast sweep across every dialog (pills, overdue/soon tints, focus rings) once chrome lands.
- Answer the 6 open questions; they gate the chrome/markup decisions.
