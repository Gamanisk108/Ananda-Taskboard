# Handoff: Ananda Taskboard — Full Design System (Web + Responsive/Mobile + Auth + Multi‑tenancy)

## Overview
Ananda Taskboard is the in‑house, data‑dense task board used by the Ananda community ("Temple of Light" aesthetic). This package captures the **complete visual + interaction design** across four modules:

1. **Web app** (`web/Ananda Taskboard.html`) — the primary desktop board: chrome, List / Board / Weekly / Monthly views, and every dialog (Task popup, Team & Permissions, Manage Projects, Settings, Export, Copy summary, Approvals, Trash, Restore points, History, Day detail).
2. **Responsive / Mobile** (`mobile/…`) — a design‑canvas of phone screens mirroring the web app (built as JS screen‑builder modules + one CSS file).
3. **Auth** (`auth/…`) — sign‑in / sign‑up / account screens.
4. **Multi‑tenancy** (`multitenancy/…`) — organization / workspace switching and provisioning screens.

It also includes the standalone, self‑contained bundles a stakeholder can open directly: `bundles/Ananda Taskboard - Web.html`, `bundles/Ananda Taskboard - Responsive.html`, `bundles/Ananda Taskboard - Signup.html`.

## ⚠️ How to use this handoff (read first)
- The HTML files here are **design references / prototypes** built in plain HTML+CSS+JS. **Do not ship them or copy their markup wholesale.** Recreate their *look and behavior* inside the real app's existing environment (e.g. React + TypeScript — components live in `frontend/src/components`, e.g. `TaskModal.tsx`, `TeamAdmin.tsx`, `Settings.tsx`) using the codebase's established patterns. If no codebase exists yet, choose the most appropriate framework and implement there.
- **Features win, styling follows.** Where the prototype and the real app differ in *what exists* (which buttons, menu items, fields, flows, data), **defer to the real app's features.** This handoff dictates *appearance and the specific UX rules called out below* — not the entire feature set.
- The prototype's data (people, projects, sample tasks, holidays) is illustrative only.

## Fidelity
**High‑fidelity.** Colors, typography, spacing, component treatments and interaction rules are final. Recreate pixel‑faithfully using the app's component library. Both **light and dark** themes are first‑class and must both be implemented.

---

## Design Tokens

### Fonts
- **Display / headings:** `Fraunces` (Google Fonts), weights 500/600/700. Screen titles, dialog `<h2>`, calendar month/week titles, project names in History.
- **UI / body:** `Instrument Sans`, weights 400/500/600/700. All UI text, labels, buttons.
- **Mono / numbers:** `Red Hat Mono` (**must have a plain zero** — no dot, no slash). Dates, counts, IDs, timestamps, task `#id`, all count badges. Apply `font-variant-numeric: tabular-nums`.
- **Section‑header labels** (e.g. "ADD TEAM MEMBER", "PROJECTS", "STATUS") use the **UI sans font, UPPERCASE**, ~11.5px, weight 700, letter‑spacing .06em, muted — **never** the Fraunces serif.

### Color tokens — Light theme
```
--bg:#f6efde;  --canvas:#fbf6ea;  --surface:#fffdf8;  --surface-2:#faf5e8;
--sunk:#efe5cc; --border:#e4d8bb; --border-strong:#d8c89e;
--text:#23262b; --muted:#5a6172;  --faint:#8a8270;
--primary:#1e3a6e;  --dome:#2c5499;  --azure:#7fa8d9;  --primary-weak:#e9f0f9;
--gold:#c9a24b; --gold-deep:#7a5c22; --wood:#a9824e;
/* status colors (5) */
--todo:#6b7280;    /* To Do — gray            */
--doing:#2c64a8;   /* In Progress — BLUE       */
--delayed:#bb3b28; /* Delayed — RED            */
--review:#7a5aa6;  /* Ready for Review — PURPLE */
--done:#3f7d54;    /* Done — green             */
/* alerts + calendar context */
--danger:#b4452f; --warn:#7a5c22; --ring-soon:#d99a1f; --bar-soon:#ffd21e;
--holiday:#94886f; /* muted, icon-less calendar holiday text */
--overdue-bg:#b4452f2e; --soon-bg:#e0a72e38;
```

### Color tokens — Dark theme (`[data-theme="dark"]`)
```
--bg:#0c1526; --canvas:#0f1b30; --surface:#15223b; --surface-2:#172642;
--sunk:#1c2c49; --border:#27395b; --border-strong:#32466b;
--text:#eaf0fb; --muted:#9fb0cc; --faint:#7e8ca6;
--primary:#2c5499; --dome:#7fa8d9; --azure:#a9c6ec; --primary-weak:#1d3358;
--gold:#e0be6a; --gold-deep:#e0be6a; --wood:#c79f63;
--todo:#9aa3b2; --doing:#6aa2e0; --delayed:#e3705a; --review:#b08cd6; --done:#5fb27a;
--danger:#e07a63; --warn:#e0be6a; --ring-soon:#e0be6a; --bar-soon:#ffd21e; --holiday:#8b94a8;
--overdue-bg:#e0634a33; --soon-bg:#e0b04a2e;
```
Set `color-scheme: light` / `dark` on the root per theme so native controls match. The **theme toggle (moon/sun icon button) lives immediately to the right of the logo/wordmark**; the swap is instant (suppress transitions during the change so nothing lags). Persist the preference.

### Radii / shadow / spacing
```
--r-card:11px;  --r-ctl:8px;  --r-pill:999px;
--shadow-1:0 1px 2px rgba(30,58,110,.07);   /* dark: 0 1px 2px rgba(0,0,0,.3) */
--shadow-2:0 6px 22px rgba(30,58,110,.13);
--shadow-pop:0 12px 34px rgba(20,30,55,.18); /* dialogs/popovers */
```
Dense layout: table rows ~32px tall. Gaps 6–14px. Dialog body padding 18–20px. **Always lay out groups with flex/grid + `gap`**, never inline margins.

---

## Hard UI rules (the user has rejected violations repeatedly — honor these EVERYWHERE, web + mobile)

1. **Never leave a native `<select>` caret.** Every dropdown is a **custom dropdown** styled to match the filter chips (rounded `--r-ctl` / `--r-pill`, brand surface + border, a drawn chevron). No sharp‑cornered native popups anywhere. On web the helper is `openCustomSelect`; on mobile every `sel()` routes through `csSelect()`. If you must keep a real `<select>`, strip `appearance:none`, draw a custom chevron inset ~11px from the right edge (keep `padding-right:30px`), and set the background with `background-color:` **not** the `background:` shorthand (the shorthand wipes the caret image and it tiles). Never let a later rule apply `padding:` shorthand to a select (it resets `padding-right` and the caret overlaps text).
2. **Color swatch pickers are circles** (never square native inputs) and open a popover with a small **recommended brand palette** of circular swatches **plus** a custom color input. Recommended palette: `#c8762f #b4452f #bb3b28 #a23e6e #7a5aa6 #2c5499 #2563a8 #2f7d74 #3f7d54 #4f7a3c #c9a24b #6b7280`.
3. **Destructive actions** (delete forever, restore a board snapshot, remove a member, reject) open a **confirmation popup** that explains exactly what will happen.
4. **Header stays on one line** at small widths — collapse button labels to icon‑only (keep `title` tooltips); never wrap to a second row.
5. **No emojis as icons.** All chrome, toolbar, section‑header, and menu icons are **line‑art stroked SVG** (1.7 stroke, round caps/joins), consistent across web + mobile. (Project identity is now shown via **pills**, see rule 7 — not emoji swatches.)
6. **Every section/list/menu header gets a distinct line‑art icon** beside its name (Team, Projects, Trash, Approvals, Settings, etc.) — web and mobile.
7. **Projects & Sub‑projects render as pills everywhere they are listed** (lists, kanban cards, tables, grant rows) — a rounded pill tinted with the project color (`.proj-pill { --pc:<color> }`), **not** a bare color swatch. When a person has access to a *whole project*, their Sub‑project cell reads a lowercase **`all`** (styled muted/italic via `.sub-all`).
8. **All `(i)` / `(?)` indicators open a full text popup** with the description, closed by an X or click‑out. **Never tap‑and‑hold** on mobile (holding obscures the screen) — it's a tap‑to‑open popup on both platforms.
9. **Modal shell:** fixed header + scrollable body + `max-height` cap; close on **X / Esc / backdrop click**. The modal‑head close **X is a 28×28 circular hover target** (4px padding around a 14×14 icon) sitting **8px clear of the `#id` pill** — never a wide rectangle touching the pill.
10. **Popovers right‑justify to their anchor.** A popup aligns its **right edge to the trigger's right edge** by default and never overflows the viewport (min 16px from the edge). Apply any fixed `min-width` **before** measuring/positioning so the alignment math uses the final width.
11. **Bulk‑action buttons are disabled until rows are checked,** then relabel to show the count: **Restore N · Delete N · Approve N · Reject N** (count in a small pill). Destructive action on the **left**, primary on the **right**. A select‑all header checkbox drives them.
12. **Secondary buttons** are white/surface with a **tan rounded border** (matching the Task‑editing popup buttons); size width **tight to the text**, don't stretch full‑width unless the layout calls for it.

---

## Roles, Access & Grants (core permission model — implemented this thread)

There are **two independent axes**: **Role** (what you can *do*) and **Access/Grants** (what you can *see*).

### Role — *editing privilege* (set on the Members tab)
Dropdown shows exactly three options, no inline explanation: **Viewer · Member · Admin**. An `(i)` popup beside the "Role" label explains:
- **Viewer** — view‑only; can read tasks and add comments, but cannot edit anything.
- **Member** — assignment‑based; sees and works only the tasks they're assigned or granted.
- **Admin** — full access; manages team, projects, settings, and every task.
- Helper note shown where roles surface outside Members: **"Roles are changed in the Members tab."**

### Access — *visibility scope* (set on the Members tab; renamed from "View Access" → just **"Access"** everywhere)
Four levels (each with an `(i)` popup line):
- **Tasks Only** — only tasks assigned to them.
- **Sub‑Project Only** — every task inside the sub‑project(s) granted.
- **Full Project** — the whole project, **plus any new sub‑projects added later**.
- **Organization** — every task across the entire organization (visibility only; does **not** change edit rights).

### Grants (the Access tab in Team)
- A grant adds a **Project, Sub‑project, or the whole Organization** to a person's/group's scope. **Grants do not determine editing privileges — those come from the user's Role (Viewer, Member, or Admin).** Surface this exactly, e.g. as an `(i)` popup by "Active grants" and the note: *"How much a person sees is set by their **Access** on the **Members** tab — a grant here just adds a **Project** or **Sub‑project** to their scope at the level chosen."*
- **Active grants** is a **sortable table** (click headers: Who · Project · Sub‑project · Role) with a **person multi‑select filter directly above the table**. Project cells use the **proj‑pill**; whole‑project grants show **`all`** in the Sub‑project cell.

### Project‑access tree (Add member → "Add to projects")
Critical UX: assigning someone to a **whole Project** implies *"include future sub‑projects too"* — when checked, its sub‑projects disable (inherited). Selecting **individual sub‑projects** implies *"do NOT auto‑add new ones I create later."* Implement as a tree where toggling the project locks/inherits its children, and unchecking it restores each child's prior explicit state (`data-user` flag pattern in the prototype).

---

## Status model (5 statuses — order matters)
`To Do → In Progress → Delayed → Ready for Review → Done`, i.e. **Ready for Review is purple and sits 2nd‑to‑last, immediately before Done.** Wire to the app's real status model; colors are semantic (`--todo / --doing / --delayed / --review / --done`). Status renders as a pill (`--sc:<color>` + leading dot) in lists, as columns on the board, as dots in the summary strip and filters.

---

## Calendar: Announcements & Holidays
- **Announcements** (user events, e.g. "Choir rehearsal", "birthday") show **first**, with a **megaphone line‑art icon**.
- **Holidays** are **auto‑populated context** (US Federal, US observances, Christian/religious, Hindu/yoga festivals, Ananda lineage days). They render **quiet and muted** (`--holiday`) with a **star line‑art icon**, **after** announcements. If both appear on a day they sit **side by side**.
- Day cells/headers cap visible items and show a **"+N more"** overflow; the **Day‑detail** sheet lists holidays (named, muted) above the task list.
- **Admin "Holidays" tab** (in Team) toggles which sets show for the whole org — quiet, icon‑less context, never tasks. Sets (with sample contents):
  - US Federal holidays — New Year's, MLK, Memorial Day, Juneteenth, July 4, Labor Day, Thanksgiving, Christmas… *(on)*
  - US observances — Mother's Day, Father's Day, Daylight Saving, Flag Day… *(on)*
  - Christian / religious — Easter, Ash Wednesday, Pentecost, Trinity Sunday, Advent… *(off by default)*
  - Hindu / yoga festivals — Diwali, Maha Shivaratri, Holi, Guru Purnima… *(on)*
  - Ananda lineage days — Yogananda's birthday, Founding of Ananda Village, Master's Mahasamadhi… *(on)*

---

## Screens / Views

### Top bar
- Left: navy lotus **logo** (`assets/ananda-mark.png`) + wordmark "Ananda **Taskboard**" (Fraunces 600; "Taskboard" in `--primary`, `--azure` in dark) + **theme toggle**.
- Right (`.actions`): line‑icon ghost buttons — Approvals, Team, Trash, **Projects (2×2 grid icon)** — a divider, then primary **New task** and a **user pill** ("Admin Ada" + avatar + caret). The user menu (right‑justified to the pill) includes Settings · History · Archive · Restore points · Turn on notifications · **Preview as Viewer** · **Preview as new Member** · Language · Log out. Ghost labels hide (icon‑only) on narrow widths.
- **Preview as Viewer / new Member** show a **preview banner** with a "Back to Admin" exit. Viewer preview opens tasks **read‑only**; new‑Member preview shows the empty state (below).

### Project tabs
- Project tabs are **colored pills** (name + mono count); the **pill border is always the project's designated color** (not only on hover/select). The active pill is additionally filled with a ~16% tint of the project color. "Global Overview" is a neutral pill. Sub‑tabs are smaller pills with a color dot + name + count. *(The small project emoji on each tab is intentional identity, not a UI icon — keep it.)*

### Summary strip
- One dense row: total tasks, OVERDUE (red), DUE SOON (amber), then per‑status counts each with a color dot (now including the purple **Review** count).

### Filters row (List/Board)
- **Assignee, Status, Priority are checkbox multi‑selects** (custom popover; placeholder text, then "first selection +N" with the count in a pill). **Deadline and Recurrence are single‑select custom dropdowns.** A **Clear** button appears only when any filter is active.

### List view
- Dense table: sticky header, **frozen Task column** on horizontal scroll, **sortable column headers**, plus **Project** and **Sub‑project** columns (proj‑pills). Overdue rows tint `--overdue-bg` + red date; due‑soon `--soon-bg`. **On hover, tinted rows deepen in *vibrancy*** (mix in more of the status color: `--overdue-bg-h` / `--soon-bg-h`) rather than darkening; plain rows swap to `--hover`. Inline‑editable status + assignee via popovers. **Created‑on** date shown (muted, mono).

### Board view (Kanban)
- Five columns (To Do / In Progress / Delayed / **Ready for Review** / Done) headed by a color dot + count. Cards draggable between columns; **clicking a card opens the Task popup** (moving is drag‑only). Cards show project/sub‑project **pills** and overdue/soon **status badges**.

### Weekly view
- 7 day columns. **Past** = cool gray wash (`--wk-past`), **today** = surface box with a continuous blue bracket spanning header+body (so it never breaks), **future** = warm tan (`--wk-future`). Today header shows a small blue **"Today" pill** centered between weekday and date. **Dark‑theme today text is readable** (uses `--text`, not a near‑black). Task bars span their days; **overdue bars** get a red ring with a 1px separator; **due‑soon** a yellow ring. Announcements/holidays appear in the day header (icons per the calendar section) with "+N more".

### Monthly view
- 7‑col grid. Same past/today/future scheme; today cell = surface box, blue 2px ring, "Today" pill top‑right. Overdue day cells: red inset ring + red tint; due‑soon: yellow ring + amber tint (`--mo-soon`). Holidays show a small muted tick; tap a day → Day detail.

### Status alert badges (everywhere a flag appears)
- **Overdue** = filled **red circle** with white "!". **Due soon** = filled **yellow circle** with a dark **clock** glyph.

### Dialogs (shared shell)
- Centered modal on dimmed backdrop (`rgba(13,21,38,.5)`), `--surface`, `--r-card`, `--shadow-pop`; fixed header (Fraunces `<h2>` + circular ghost X), scrollable body, close on X / Esc / backdrop. Wide dialogs cap ~720–760px; small confirms ~460px; Day detail ~520px.
- **Buttons:** `.btn-primary` (filled navy), `.btn-secondary` (surface + tan border, width tight to text), `.btn-ghost` (muted text), `.btn-danger` (surface + danger border/text). Disabled = ~42% opacity, no shadow.

### Task popup
- **Editable** (Member/Admin) and **read‑only** (Viewer) variants. Read‑only shows a **"View only" badge with an eye icon**, disabled fields, but **comments stay enabled**. Shows **Created‑on**. `#id` pill in the header with the circular close X 8px clear of it.

### Team & Permissions (tabs: Members · Groups · Access · Holidays)
- **Members:** table with Name · Email · **Role** (Viewer/Member/Admin) · **Access** (the 4 levels, `(i)` popup) · Status, plus reset‑pw and remove. Add‑member form sets Role, **Access**, **starting projects via the project‑access tree**, and a starting password.
- **Access:** Grant form + sortable/filterable **Active grants** table (see Grants above).
- **Holidays:** admin toggles for holiday sets (see Calendar above).

### New‑member empty state
- Centered card using **`assets/ananda-empty.svg`** (replaces the old 🌱 emoji), headline **"You're all set up!"** and copy explaining an admin hasn't added them to projects yet — their work appears once they're added or assigned.

### Other dialogs
- **Approvals:** task name is **clickable** (no separate Open button); bulk **Approve N / Reject N** disabled‑until‑checked with select‑all; a line‑art header icon; default sort **Newest** (no "Sort" label).
- **Trash:** projects/sub‑projects **expandable** (rotating chevron) revealing a day‑detail‑style list of what would be deleted; bulk **Restore N / Delete N**; line‑art header icon; default sort Newest.
- **Settings:** statuses are **drag‑to‑reorder** rows (handle, circular swatch, name; defaults can't be deleted).
- **Manage Projects:** auto‑saves (no Save buttons); circular swatch picker; **Created‑on** on projects and sub‑projects; default sub‑project can't be renamed/deleted; "trusted" toggle per sub‑project.
- **History:** working Prev/Next/date/Today (defaults to today); 1‑year retention note.

---

## Interactions & Behavior
- Popovers/menus: `--shadow-pop`, `--r-ctl`, close on outside‑click / Esc; **right‑justify to anchor** (rule 10).
- Drag: kanban cards and Settings status rows use HTML5 drag; dragged element ~45% opacity, drop target highlighted.
- Theme toggle: instant swap, persisted.
- Bulk actions wired by event delegation (no per‑row listeners) — see rule 11.
- Reduced motion / print: entrance animations must use the visible state as the base (animate *from* hidden) so non‑JS/print render content.

## Responsive / Mobile module
The mobile design lives as a design‑canvas of phone frames built from JS screen‑builders (`mobile/screens-views.js`, `mobile/screens-flows.js`) + `mobile/ananda-mobile.css`. It mirrors the web app feature‑for‑feature with the same tokens and all the hard rules above (custom dropdowns via `csSelect`, multi‑select checkbox filters, proj/sub pills, line‑art header icons, tap‑to‑open `(i)` popups, disabled‑until‑checked bulk actions, holidays/announcements, Access/Role model, read‑only Viewer detail, new‑member empty state). Use it as the small‑screen reference; recreate with the app's responsive patterns.

## Auth & Multi‑tenancy modules
- **Auth** (`auth/`): sign‑in / sign‑up / account screens in the same design language. `bundles/Ananda Taskboard - Signup.html` is the openable reference.
- **Multi‑tenancy** (`multitenancy/`): organization/workspace switching & provisioning. Same tokens and chrome.

## Assets
- `assets/ananda-mark.png` — navy lotus‑heart logo (interior recolored to Nayaswami navy `#1e3a6e`), transparent background.
- `assets/ananda-empty.svg` — empty‑state illustration for the new‑member screen.
- All other icons are inline stroked line‑art SVGs (1.7 stroke, round caps) — reproduce with the app's icon set in the same style.

## Files in this bundle
```
README.md                       ← this document
web/Ananda Taskboard.html       ← primary desktop design reference (all views + dialogs, light/dark)
mobile/                         ← responsive/mobile screen-builder modules + CSS
  Ananda Taskboard Mobile.html
  screens-views.js
  screens-flows.js
  ananda-mobile.css
auth/                           ← sign-in / sign-up / account screens
multitenancy/                   ← org / workspace switching + provisioning screens
assets/ananda-mark.png          ← logo
assets/ananda-empty.svg         ← empty-state illustration
bundles/                        ← standalone, self-contained HTML (open directly in a browser)
  Ananda Taskboard - Web.html
  Ananda Taskboard - Responsive.html
  Ananda Taskboard - Signup.html
```

## Notes for the implementer
- Treat this as a **theming + component‑styling + permission‑model pass** over the app. Map tokens to the app's theme system; restyle components to match; implement the Role/Access/Grants model and the 5‑status pipeline against the real data layer.
- The status colors and the Role/Access split are **semantic** — wire them to real models, never hardcode.
- Honor the 12 hard UI rules in every new surface you build, not just the ones shown.
