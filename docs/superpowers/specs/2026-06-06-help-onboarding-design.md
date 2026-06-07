# Help, FAQ & Onboarding — Design Spec

_Date: 2026-06-06 · Status: **built & verified** · Branch: feature/calendar-holidays_

## Goal

Give Ananda Taskboard users in-app help that an **extremely non-technical, low-patience**
audience can use, and a mechanism that keeps that help **in sync with the app as features
change** — without relying on anyone remembering to update docs.

Four deliverables (all built):
1. **Skippable onboarding** — a one-card welcome on first login.
2. **Always-available Help center** — a `?` button opening a searchable, sectioned panel.
3. **FAQ** — a "Common questions" sub-section inside the Help center.
4. **What's New** — auto-surfacing of newly added features to existing users.

## Key constraint discovered

`backend/test_i18n_catalogs.py` requires **all 13 locale catalogs to have identical keys
with non-empty values**. Therefore long-form help text must NOT live in the JSON catalogs
(can't ship English-only there). This drives the two-tier content design below.

## Architecture

### Two-tier content

- **UI labels** (short strings: `?` tooltip, "Help & FAQ", "Search help…", the five section
  labels, chips, "Got it", "Skip", "Contact us", "Show welcome again") → `help.*` and
  `onboarding.*` in **all 13** `src/locales/*.json` (English values now, translated later;
  parity test stays green). Synced via a small script, not 13 hand-edits.
- **Article + FAQ bodies** (the long text) → `src/help/content/en.ts`, a plain TS module.
  Loader `src/help/content/index.ts` returns the active locale's content and **falls back to
  English** per-key when no `<locale>.ts` is registered. Makes "English now, add languages
  later with no code change" true and keeps long text out of the parity-checked catalogs.

### Source of truth: `src/help/registry.ts`

```ts
export type HelpCategory = "views" | "tasks" | "account" | "admin" | "faq";

export interface HelpArticle {
  id: string;                  // stable slug == content key
  category: HelpCategory;      // which collapsible sub-section it lives under
  surface?: string;            // i18n key of the control it documents (e.g. "view.board");
                               // omitted for general FAQ entries not tied to one button
  roles?: ("admin" | "member")[]; // who sees it (default: everyone)
  addedISO?: string;           // "2026-06-06" → drives What's New (lexical compare)
}
export const ARTICLES: HelpArticle[] = [ ... ];
export const CATEGORIES = [ /* views, tasks, account, admin, faq + i18n label keys */ ];
export function isAdminOnly(a): boolean;  // roles set and excludes "member" → admin-only
```

`surface` ties an article to a real, user-visible control whose label already exists as an
i18n key. This is the hook the tripwire test uses. (Note: `surface` is **optional** — general
FAQ entries like "Why can't I see a project?" have none.)

### The self-updating guarantee: `src/help/help.test.ts`

Pure-logic test (`.ts`, runs in the existing Node vitest + in backend CI). It reads the
`nav`, `view`, `menu` key groups straight from `en.json` and asserts:

- **Coverage:** every *actionable* feature key (`nav.*` / `view.*` / `menu.*`) is either
  documented by an article (`surface` match) **or** explicitly listed in an `IGNORE` set
  (with a comment saying why — e.g. pure labels/hints). A new button adds a new key →
  if undocumented and not consciously ignored, **the build goes red**.
- **Integrity:** every `surface` is a real i18n key; every article id has English content;
  no duplicate ids; no orphaned content; `addedISO` (if present) is a valid date.
- **Categories:** every article has a known category; every category label key exists in
  `en.json`; no empty categories; `isAdminOnly` flags admin articles correctly.

This is the "self-updating" mechanism — not auto-generation, but an enforced tripwire that
makes stale help a build failure, plus What's New that auto-surfaces flagged items to users.

### What's New

Articles with `addedISO` newer than the user's stored `at-help-seen` (localStorage) are
"new": the `?` shows a dot and the panel lists them at the top with a purple **New** badge.
Opening the panel captures the pre-open value (so the list still shows), then persists
`at-help-seen = latestVersion()` and clears the dot. **A brand-new browser is initialised to
`latestVersion()` on first load** (and the value persisted), so first-time users start
"caught up" — only features added *after* their first load surface later, not every existing
one. Per-user, client-side, zero backend.

### Onboarding: `src/components/WelcomeCard.tsx`

One centered modal on first login (only when `localStorage["at-onboarded"]` unset): title +
short intro + 3 plain bullets (open a project tab → switch List/Board/Weekly/Monthly → big
**+ New task**) + **Got it** and **Skip** (both dismiss and set the flag; shows once ever).
A "Show welcome again" link in the Help panel clears the flag and replays it.

### Help panel: `src/components/HelpCenter.tsx`

Uses the existing `Modal` (wide). A search box at top; below it the content is organised into
**collapsible, counted sub-sections** (the "wall of information" fix), rendered in `CATEGORIES`
order and **collapsed by default** for a compact, scannable landing:

- **Getting around** — the four views (List / Board / Weekly / Monthly)
- **Everyday tasks** — New task, Share view, Copy summary, Archive
- **Your account** — Notifications, Language, Theme
- **For admins** — Projects, Team, Approvals, Trash, Settings, History, Restore points,
  Bulk migrate, Holidays
- **Common questions** — general FAQ entries (no single control)

What's New (when present) renders above the sections. Searching ignores the sections and
shows a **flat** result list across everything. Each article row expands its body on click.

**Admin marking:** admin-only articles do **not** carry "(admins)" in their titles. Instead
they sit under the "For admins" section *and* show a subtle muted grey **"Admin"** chip (with
an "Admin only" tooltip) — so they still read correctly in flat search results and What's New.

**Contact us:** the footer has a `mailto:` link to **Hanuman@anandala.org** (held in a single
named constant `HELP_CONTACT_EMAIL` in `HelpCenter.tsx`) alongside "Show welcome again".

Styling lives in `App.css` under `.help-*` (theme-variable based, with row/section hover
states); reuses `Modal`, `section-title`, `muted`, `empty`, `btn-ghost` so it looks native.

### Wiring in `App.tsx`

A `?` button (lucide `CircleHelp`) in `topbar-actions`, with a What's-New dot, opens
`<HelpCenter>`; `<WelcomeCard>` mounts once logged in. State: `showHelp`, `showWelcome`
(init from `at-onboarded`), `helpSeen` (init from `at-help-seen` ?? `latestVersion()`). Both
components gated behind the `me` auth check.

## Components summary

| File | Purpose |
|---|---|
| `src/help/registry.ts` | Article metadata + category map + surface map (source of truth) |
| `src/help/content/en.ts` | English article + FAQ text |
| `src/help/content/index.ts` | Locale loader, per-key English fallback |
| `src/help/help.test.ts` | Coverage tripwire + integrity + category checks |
| `src/components/HelpCenter.tsx` | `?` panel: search, collapsible sections, What's New, Contact us |
| `src/components/WelcomeCard.tsx` | Skippable first-login card |
| `src/App.css` (`.help-*`) | Panel styling + hover states |
| locale-sync (inline python) | Sync `help.*` / `onboarding.*` across the 13 catalogs |

## Testing & QA (done)

- **Unit:** `help.test.ts` — coverage + integrity + category checks (part of the 72 frontend
  vitest tests, all green).
- **Existing:** `backend/test_i18n_catalogs.py` stays green (proves label sync worked).
- **Code health:** `npx fallow` (no new dead-code/duplication; HelpCenter CRAP is the
  accepted free-tier ceiling), eslint, prettier — all clean.
- **Browser QA (Playwright):** verified live in light + dark — welcome show/dismiss/skip/replay
  (once-only), `?` open, search, expand article + FAQ, collapsible sections + counts, Admin
  chip, Contact us `mailto`, What's New surface + clear. Member-role hiding is unit-tested
  (admin-login only live); flagged for a human member-login check.

## Revision history

- **v1 (approved):** flat "How-to guides" + "FAQ" sections; `faq?: boolean` on articles.
- **v2 (this doc, post-feedback):** reorganised into 5 collapsible counted sub-sections
  (replacing the flat list — the "wall of information" fix); `faq` boolean replaced by a
  required `category`; `surface` made optional; "(admins)" titles replaced by a grey "Admin"
  chip under a "For admins" section; added a "Contact us" mailto footer; new-user What's-New
  baseline so first-timers start caught up.

## Out of scope (YAGNI)

Spotlight tours, embedded video, backend persistence of help state, AI doc generation,
per-article deep links. Can be added later; none needed for v1.

## Not part of this feature (separate side tasks, same session)

- **Status rename "Ready for Review" → "Review"** (DB `Status` row via migration `0025`,
  `Task.Status` enum via `0024`, frontend `statuses.ts` fallback). The original status
  *addition* is recorded in `design/Claude Design/design-change-handoff.md`; that entry now
  describes the old name and could note the rename.
- **`holidays_feed.py` fix** — Janmashtami labelled "Janmashtami (Babaji Commemoration Day)"
  to match the test + Ananda lineage (part of the calendar-holidays WIP).
