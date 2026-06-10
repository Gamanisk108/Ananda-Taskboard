# ⚠️ READ FIRST — Handoff v2 changelog (supersedes parts of README.md)

> **For:** Claude Code · **From:** Claude (Design) · **Date:** 2026-06-09
> This package was first handed off at **D43**. Since then we applied **your audit feedback**
> (`CODE-AUDIT-FEEDBACK.md`) and ran ~10 more design rounds. **`README.md` still describes the v1
> design** — where this changelog and `README.md` disagree, **this changelog wins.** The bundled
> HTML and `DESIGN-DECISIONS-LOG.md` are current; read **D44–D48** there for the authoritative,
> detailed rulings. Everything below is the diff so you don't have to hunt.

---

## A. The big reframe — Improve translations is "improve", not "fill in" (your §1)

- **All 13 language catalogs are already complete (555 keys).** The feature suggests *better*
  wording, never fills blanks. Consequences, all built:
  - Progress meter = **personal coverage**: "You've suggested **N** of **555**".
  - The right column is **"Current wording"** and **always shows the live value** — there is no
    "— untranslated" state anywhere.
  - Category badges count **phrases without *your* suggestion** (green check at personal 100%);
    rows you haven't touched sort first.
  - All-done celebration fires at **personal 100%**.
  - Source note: *"Every phrase already has a translation — suggest anything you'd say more
    naturally. Built-in interface text only; your board's own statuses and project names aren't
    included."*

## B. Placeholders are INVISIBLE to members (your §6 → final ruling)

- Members **never see token syntax** (`{{name}}`, `{{n}}`) and never see the variable as a word.
- **Display strips the variable entirely:** "Assigned to {{name}}" shows as **"Assigned to"**;
  "{{n}} tasks due soon" shows as **"tasks due soon"** — in the contributor rows **and** the
  review poll bars.
- Members translate only the visible text; **the build re-inserts the variable in its
  source-position slot.**
- The earlier "placeholder guard" error state is **removed** (nothing visible to break).
- **Build note / known v1 limit:** languages that need the variable in a *different position*
  than English can't express it this way — flag if that's a blocker for any of the 13 locales.
  Token syntax + slot re-insertion live at the API layer only.

## C. Settings is now fully fleshed out — 5 sections, role-filtered (your §2)

Settings is **member-visible** with a role-filtered left nav:
- **Members see:** Account · Notifications · Events & Holidays · Help Us.
- **Org admins also see:** Task statuses.
- **Superadmin:** Translation review still lives in the superadmin area (beside Platform
  overview), **not** in Settings.

New panes designed since v1 (all in the canvas, "Settings — …panes" sections):
- **Account** — name · read-only **email as static text** (D45, not a disabled field) · Language
  (custom select) · Theme = **Light/Dark only** (no "System") · **Change password** opens an
  in-pane sub-view (← back · current/new/confirm · Cancel+Update group, D39).
- **Notifications** — Daily digest toggle (default ON) + digest-time select (grays out when off) ·
  deadline reminders · assignment changes. Delivery = **PWA web push** (add-to-Home-Screen note).
- **Task statuses** (admin) — faithful repro of the canonical status manager: drag-reorder rows ·
  **circle** swatch · editable name · "Task Complete" pill on Done · add-row. **Five statuses**
  (Review purple, 2nd-to-last) — the canonical file's 4-status data is stale; use five.
- **Events & Holidays** (renamed from "Calendar & holidays") — see §D.

## D. Events & Holidays — renamed, tabbed, new permissions model (D47)

- Two in-pane tabs (**Events** / **Holidays**), each **Add-card-on-top, list-below**.
- **Member-visible.** Two scopes:
  - **Admin-set** events + holiday sets are **org-wide** and **locked for members** (lock icon;
    holiday sets shown to members as **read-only static rows**, not disabled checkboxes — D45).
  - **Every member can add personal** events & holidays — visible **only on their own board**
    (tagged "only on your board"), always editable by the owner.
- Lists group **Your …** first, then **Team …**. Edit/✕ = canonical listrow ghost pair (red ✕).
- **New holiday set: "Italian holidays"** (Capodanno, Liberazione Apr 25, Festa della Repubblica,
  Ferragosto, Ognissanti…), default ON — for the Ananda Assisi community. **CODE ACTION:** add to
  `HOLIDAY_SETS` in `Ananda Taskboard.html`; build supplies the real date table.
- **CODE ACTION:** needs a **personal-scope** events/holidays model (per-user rows alongside the
  org-wide ones).

## E. Spread the word — DEFERRED post-MVP (D48)

- **Hidden from the live Help Us hub.** The hub ships **three** asks: **Improve translations ·
  Report a problem · Suggest a feature.** **Do not build Spread the word for MVP.**
- Design is preserved (canvas section relabeled "DEFERRED"; hub card commented out in `huPane()`).
  Revisit when invite/referral infra exists.

## F. The other two flows (your §3/§4 rulings)

- **Report a problem** — unchanged in shape; reference id format is **TB-0042** (zero-padded DB
  id). Screenshot stays: **client-side compress** (~≤300 KB JPEG, 1 MB cap, hint in the control),
  stored in Postgres, **90-day auto-purge**.
- **Suggest a feature** — "Tell me when this ships" subscribes **only the author**; deliver via
  the existing **PWA push** pipe (≈zero cost). Hint: "One notification if it ships — nothing else."

## G. Translation review (poll graph) — additions since v1

- **Free-text override:** an **"Or enter your own wording…"** affordance lets the curator type a
  value that isn't among the submitted variants (override model already supports arbitrary text).
- **Variant flags:** **"matches current"** (muted) on a variant equal to the live wording.
- **Scale:** with **100+ replies**, the card shows the **top-5 wordings** as bars; the long tail
  collapses into "Show all N wordings · M more replies".
- **Confirm copy** softened to "…becomes what everyone using <lang> sees **from now on** — no
  redeploy."
- **Clear override** is destructive → same styled confirm as go-live.

## H. Fuzzy-merge narrowed (your §5)

- Group **only strings identical after trivial normalization** (trim · collapse whitespace ·
  trailing ellipsis) — **never casefold**, never near-synonyms. "Add link…" merges into "Add
  link" (shown as "+1 similar", labeled "same text after trimming"); "Add a link" stays separate.
- One save fans out to every covered key; review groups the same way.

## I. New standing design rules logged since v1 (apply app-wide)

| # | Rule |
|---|---|
| **D45** | **No data field if it's not editable** — read-only values render as plain text (label · value · hint), never as a disabled input. Exception: a value paired with an explicit **Copy** action keeps field chrome (signals "selectable"). |
| **D46** | **Balanced wraps** — short multi-line copy (card blurbs, dialog subs, intros, empty states) uses `text-wrap: balance` so no lone word is stranded. Long body keeps `pretty`. |
| **D39** (reinforced) | Connected controls perfectly aligned — side-by-side flush both edges & equal height; stacked aligns the shared edge; a field over a button *group* aligns as a unit. |
| **D35** (reinforced) | One vertical spacing step (`--gap-form: 13px`) between sibling form blocks — no ad-hoc 8/10/12/16/18px. Settings panes were normalized to this. |
| **D43** | All-done celebratory icon = the **prayer-hands artwork** (`assets/prayer-hands-alpha.png`, transparent, theme-inverts in dark). Boxed quotes carry **no icon**; attribution centered. |

## J. Devotional quotes (D40 — recap, still active)

- Sparing, **Fraunces italic**. **Lite** treatment (no box, no icon) on working surfaces — on the
  Help Us hub it's an epigraph between title and description. **Boxed** treatment (gold card, no
  icon) only on celebratory/empty moments. Roster: Yogananda · Lahiri Mahasaya · Sri Yukteswar ·
  Babaji · Kriyananda; **Jesus only when uniquely/supremely relevant.** Accuracy is sacred.

---

## What to read, in order

1. **This file** — the diff from v1.
2. **`Ananda Taskboard - Community Translations.html`** — open it; toolbar toggles light/dark,
   every surface + state is an artboard with notes. This is the source of truth for look + behavior.
3. **`DESIGN-DECISIONS-LOG.md` → D36–D48** — the authoritative, detailed rulings (+ the standing
   rules D30/D34/D35/D39/D42/D45/D46 and `design-constitution.md`).
4. **`README.md`** — the v1 narrative for the parts this changelog doesn't touch (the poll-graph
   mechanics, the data model in §6, build order). Mind the supersedes above.
5. **`CODE-AUDIT-FEEDBACK.md`** — your own audit, for cross-reference.

## Still open for you (design feedback wanted)

- **§6 runtime resolution** (override → bundled → English) at your latency budget — is "instant,
  no redeploy" realistic, or should "Make live" mean next session?
- **B**: any of the 13 locales that need a different variable position than English?
- **D**: cheapest way to model personal-scope events/holidays alongside org-wide.
- Anything in the contributor/review interactions that's expensive enough that I should redesign it.
