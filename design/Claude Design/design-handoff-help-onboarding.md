# Design Handoff — Help, FAQ & Onboarding (+ status relabel)

**For:** Claude Design — desktop web **and** responsive (mobile) browser versions.
**Purpose:** A **standalone** handoff for the in-app Help/FAQ/onboarding feature built
2026-06-06, kept separate from the rolling `design-change-handoff.md` so that log stays
focused on its earlier scope. Same convention: each change says what it is, the state to
**draw**, desktop + responsive notes, and the file. Several items are **new components/states
to design**.

**Status:** built and **live-Playwright-QA'd in light + dark** (admin login). Screenshots were
working artifacts and not retained — states are described below. Spec of record:
`docs/superpowers/specs/2026-06-06-help-onboarding-design.md`.

---

## Entry — 2026-06-06 — Help center, onboarding, What's New

### 1. Help "?" button in the top bar — NEW nav affordance
- **What:** a new **`?` (CircleHelp) button** in the header action row (`topbar-actions`),
  visible to **everyone** (not admin-gated), sitting just before the separator + **+ New task**.
- **What's-New dot:** when unseen new features exist, a small **accent dot** (purple
  `#6d4aff`) sits at the button's top-right corner.
- **Draw:** the `?` ghost button (icon + "Help" label, label hidden at narrow widths like the
  other top-bar buttons), and the dot variant. Light + dark.
- File: `frontend/src/App.tsx`.

### 2. Welcome card — NEW onboarding component (skippable, once-ever)
- **Trigger:** first login only (until dismissed; `localStorage["at-onboarded"]`).
- **Appearance:** a centered `Modal` titled **"Welcome to Ananda Taskboard 🙏"**, a short
  intro line, then **3 plain bullets with emoji** — 🗂️ open a project tab · 🔀 switch
  List/Board/Weekly/Monthly · ➕ the big **+ New task** button — a muted helper line
  ("reopen anytime from the ? Help button"), and two buttons: **Skip** (ghost) and **Got it**
  (primary). Both dismiss; shows once ever.
- **Draw:** the welcome card with its 3 emoji bullets and Skip / Got it footer. Light + dark,
  centered, standard (~520px) modal width.
- File: `frontend/src/components/WelcomeCard.tsx`.

### 3. Help center panel — NEW component (the main one to design)
- **What:** the `?` opens a **wide `Modal` titled "Help & FAQ"** containing a search box plus
  the help content organised into **collapsible, counted sub-sections**.
- **Landing (no search):** a **search input** (autofocus), then the sections **collapsed by
  default** — each a row with a **right/down chevron**, a **bold label**, and a **count pill**
  on the right. Section order + counts:
  **Getting around (4) · Everyday tasks (4) · Your account (3) · For admins (9) · Common
  questions (5).** This compact, scannable landing is the deliberate fix for an earlier
  "wall of text" version.
- **Expanded section:** the header gets a subtle hover/active background; its articles list
  beneath, each an **article row** (bold title + chevron) that **expands its body** (1–2 short
  paragraphs) on click. Rows have a hover background.
- **What's New block:** when unseen dated features exist, a **"✨ What's new"** section renders
  **above** the collapsible sections, listing those articles with a purple **"New"** pill.
- **Search:** typing filters across **all** sections into a **flat result list** (sections
  hidden); empty query restores sections. No matches → a muted **"No help found…"** empty state.
- **Footer:** a left **"🙏 Show welcome again"** ghost button and a right **"✉ Contact us"**
  link (`mailto:Hanuman@anandala.org`).
- **Draw (states to spec):** (a) collapsed landing with 5 counted section rows; (b) one section
  expanded with article rows; (c) an article expanded showing body text; (d) What's New block
  with New pills; (e) flat search results; (f) no-results empty state; (g) footer with both
  actions. **Light + dark.**
- File: `frontend/src/components/HelpCenter.tsx`, styles in `frontend/src/App.css` (`.help-*`).

### 4. "Admin" chip on admin-only help — NEW chip variant
- **What:** help articles for admin tools (Projects, Team, Approvals, Trash, Settings, History,
  Restore points, Bulk migrate, Holidays) no longer say "(admins)" in their titles. They sit
  under the **"For admins"** section **and** carry a small **muted grey "ADMIN" pill** (with an
  "Admin only" tooltip) on the title row — so they still read as admin-only in **flat search
  results** and **What's New**, where there's no section header.
- **Draw:** the grey uppercase "Admin" chip (muted, distinct from the purple "New" chip), shown
  on an article row; and an article carrying **both** chips at once (e.g. the holidays article
  in What's New). Light + dark.
- File: `frontend/src/components/HelpCenter.tsx`, `App.css` (`.help-chip`, `.help-chip-admin`,
  `.help-chip-new`).

### 5. Status relabel — "Ready for Review" → **"Review"**
- **What:** the 5th status (purple `#7A5AA6`, between Delayed and Done) is **renamed to
  "Review"** everywhere — Kanban column header, status pill, List-view summary strip, and
  status filter. Color, order, and behavior unchanged.
- **Draw:** update any design reference that shows the status name to read **"Review"** (the
  rolling log's earlier "Ready for Review" entry now describes the old name). Column order:
  To Do · In Progress · Delayed · **Review** · Done.
- File: `backend/tasks/models.py`, `backend/tasks/migrations/0024…`, `0025_rename_review_label.py`,
  `frontend/src/statuses.ts`.

### 6. Holiday text — Janmashtami label (minor, text only)
- **What:** the holiday chip for Janmashtami now reads **"Janmashtami (Babaji Commemoration
  Day)"** (Ananda/SRF lineage observance). No visual change — same muted holiday chip as the
  rolling log's holidays entry; only the longer text (mind wrapping in narrow day cells).
- File: `backend/tasks/holidays_feed.py`.

### Translation flag (not visual)
New UI strings were added to **all 13 locales** as **English placeholders** (parity test
stays green; real translations later): `help.*` (`title`, `open`, `search`, `whatsNew`,
`newBadge`, `noResults`, `replayWelcome`, `adminChip`, `adminOnly`, `contact`, and
`help.cat.{views,tasks,account,admin,faq}`) and `onboarding.*` (`title`, `intro`, `b1`–`b3`,
`help`, `gotIt`, `skip`). Help **article/FAQ body text** is English-only for now and falls
back to English per-key until `content/<locale>.ts` files are added (no design impact).

### NOT design-relevant (internal — ignore for design)
The help **registry/tripwire** (`src/help/registry.ts`, `help.test.ts` — a test that fails CI
when a new feature button has no help article), the two-tier content loader
(`src/help/content/*`), the What's-New `localStorage` baseline logic, and the status-rename
data migration. These keep help in sync and drive behavior but need no design treatment.
