# Help, FAQ & Onboarding — Design Spec

_Date: 2026-06-06 · Status: approved, building · Branch: feature/calendar-holidays_

## Goal

Give Ananda Taskboard users in-app help that an **extremely non-technical, low-patience**
audience can use, and a mechanism that keeps that help **in sync with the app as features
change** — without relying on anyone remembering to update docs.

Four deliverables (all approved):
1. **Skippable onboarding** — a one-card welcome on first login.
2. **Always-available Help center** — a `?` button opening a searchable how-to panel.
3. **FAQ** — a section inside the Help center.
4. **What's New** — auto-surfacing of newly added features to existing users.

## Key constraint discovered

`backend/test_i18n_catalogs.py` requires **all 13 locale catalogs to have identical keys
with non-empty values**. Therefore long-form help text must NOT live in the JSON catalogs
(can't ship English-only there). This drives the two-tier content design below.

## Architecture

### Two-tier content

- **UI labels** (≤~15 short strings: `?` tooltip, "Help & FAQ", "Search help…", section
  headings, "Got it", "Skip", "New", "Show welcome again") → added to `help.*` and
  `onboarding.*` in **all 13** `src/locales/*.json` (English values now, translated later;
  parity test stays green). Synced via a small script, not 13 hand-edits.
- **Article + FAQ bodies** (the long text) → `src/help/content/en.ts`, a plain TS module.
  A loader `src/help/content/index.ts` returns the active locale's content and **falls back
  to English** when no `<locale>.ts` exists. This makes "English now, add languages later
  with no code change" true and keeps long text out of the parity-checked catalogs.

### Source of truth: `src/help/registry.ts`

```ts
export interface HelpArticle {
  id: string;                  // stable slug == content key
  surface: string;             // i18n key of the feature it documents, e.g. "view.board"
  roles?: ("admin" | "member")[]; // who sees it (default: both)
  faq?: boolean;               // also list under FAQ
  addedISO?: string;           // e.g. "2026-06-06" → drives What's New (lexical compare)
}
export const ARTICLES: HelpArticle[] = [ ... ];
```

`surface` ties each article to a real, user-visible control whose label already exists as an
i18n key. This is the hook the tripwire test uses.

### The self-updating guarantee: `src/help/help.test.ts`

Pure-logic test (`.ts`, runs in the existing Node vitest + in backend CI). It reads the
`nav`, `view`, `menu` key groups straight from `en.json` and asserts:

- **Coverage:** every *actionable* feature key (`nav.*` / `view.*` / `menu.*`) is either
  documented by an article (`surface` match) **or** explicitly listed in an `IGNORE` set
  (with a comment saying why — e.g. pure labels/hints). A new button adds a new key →
  if undocumented and not consciously ignored, **the build goes red**.
- **Integrity:** every article's `surface` is a real i18n key; every article id has English
  content; no duplicate ids; `addedISO` (if present) is a valid date.

This is the "self-updating" mechanism — not auto-generation, but an enforced tripwire that
makes stale help a build failure, plus What's New that auto-surfaces flagged items to users.

### What's New

Articles with `addedISO` newer than the user's stored `at-help-seen` (localStorage, the max
ISO they've seen) are "new": the `?` shows a dot and the panel lists them at top. Opening the
panel updates `at-help-seen` to the newest `addedISO`. Per-user, client-side, zero backend.

### Onboarding: `src/components/WelcomeCard.tsx`

One centered modal on first login (only when `localStorage["at-onboarded"]` unset): title +
3 plain bullets (open a project tab → switch List/Board/Weekly/Monthly → big **+ New task**)
+ **Got it** (sets the flag) and **Skip** (also sets it; shows once ever either way). A
"Show welcome again" link in the Help panel clears/replays it.

### Help panel: `src/components/HelpCenter.tsx`

Uses the existing `Modal` (wide). Search box filters guides + FAQ by title/body text. Sections:
What's New (if any) → How-to guides (role-filtered) → FAQ. Clicking an item expands its body.
Reuses `btn-secondary` / `section-title` / `muted` / `empty` classes — looks native.

### Wiring in `App.tsx`

A `?` button (lucide `CircleHelp`) in `topbar-actions` opens `<HelpCenter>`; `<WelcomeCard>`
mounts once logged in. Both gated behind the `me` auth check.

## Components summary

| File | Purpose | Depends on |
|---|---|---|
| `src/help/registry.ts` | Article metadata + surface map (source of truth) | types only |
| `src/help/content/en.ts` | English article + FAQ text | registry ids |
| `src/help/content/index.ts` | Locale loader, English fallback | content/*.ts |
| `src/help/help.test.ts` | Coverage tripwire + integrity | registry, en.json |
| `src/components/HelpCenter.tsx` | `?` panel: search, guides, FAQ, What's New | registry, content, Modal |
| `src/components/WelcomeCard.tsx` | Skippable first-login card | i18n |
| `scripts/sync-help-locales` (inline) | Copy `help.*`/`onboarding.*` into 13 catalogs | en.json |

## Testing & QA

- **Unit:** `help.test.ts` (coverage + integrity) and a loader-fallback test.
- **Existing:** `backend/test_i18n_catalogs.py` must stay green (proves label sync worked).
- **Code health:** `npx fallow`, eslint, prettier.
- **Browser QA (Playwright, standing rule):** login; open `?`; search; expand a guide + FAQ;
  trigger + dismiss/skip welcome; replay welcome; verify once-only; check console/network;
  light + dark; admin vs member article visibility.

## Out of scope (YAGNI)

Spotlight tours, embedded video, backend persistence of help state, AI doc generation,
per-article deep links. Can be added later; none needed for v1.
