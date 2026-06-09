# Handoff: Community Translations — the "Help Us" system

> **For:** Claude Code · **From:** Claude (Design) · **Date:** 2026-06-09
> **Design source:** `translations/Ananda Taskboard - Community Translations.html` (a pan/zoom design canvas with every surface + state, web & mobile, light & dark)
> **Decision log:** see `DESIGN-DECISIONS-LOG.md` entries **D36–D43** (this feature) and the standing rules **D30 / D34 / D35 / D39 / D42** + `design-constitution.md`.

---

## 0. What this is, and what I need back from you

This is a **new top-level area of Ananda Taskboard called "Help Us"** plus its three-part flagship feature, **Community Translations**. It lets ordinary members translate the app's UI into their language, lets the community converge on the best wording, and lets a superadmin push a winning translation live instantly. "Help Us" is also the permanent home for two more community asks (Report a problem, Suggest a feature) and a growth ask (Spread the word).

**Your job:**
1. Stand up the data model + surfaces below in the real codebase (`frontend/` React + `backend/`), using the app's **existing** component patterns — not by copying my HTML.
2. Wire the i18n plumbing (string catalog, locale resolution, live-override mechanism) described in §6.
3. **Give me design feedback**: where my mocks fight the real data, where a state is missing, where the backend makes something I drew impractical (or makes something better newly possible). Reply against the surface/state names I use here so we can talk precisely.

**The bundled HTML is a design reference** — a faithful prototype of look + behavior, rendered in plain HTML/CSS/JS. Recreate it in the app's React environment with the app's own components; do not ship the HTML.

**Fidelity: HIGH.** Colors, type, spacing, copy, and interaction states are final-intent. Match them. All values are tokenized (§5) — use the codebase's existing token equivalents where they exist; the names below map 1:1 to the prototype CSS variables.

---

## 1. Where it lives in the app (navigation)

- **Settings gains a left section-nav** (it was previously one long scrolling sheet). Sections: **Account · Notifications · Task statuses · Calendar & holidays · Help Us**. (D36)
  - Desktop: a 188px left rail inside the Settings dialog; the pane renders on the right.
  - Mobile: Settings is a **list route**; each item (incl. Help Us) pushes a **full-screen sub-route**.
- **"Help Us"** is the new section. It is a hub of **ask-cards**. A purple **"what's-new" dot** (`--new`) rides the Help Us nav item (and the account-menu Help row) while there are unseen ways to help.
- **Translation review** (the superadmin poll tool, §4) is **NOT** under Help Us — it lives beside **Platform overview** in the superadmin area, since it's an admin/curation surface, not a member contribution.

---

## 2. Surface: Help Us hub

A stack of **ask-cards**, each = line-art icon tile (azure tint) · title · one-line blurb · primary CTA. Built to read correctly with **1 card or 4** (don't let it look empty).

Cards, in order:
1. **Improve translations** → opens §3. (live)
2. **Report a problem** → opens a report form. (live)
3. **Suggest a feature** → opens an idea form. (live)
4. **Spread the word** → opens an invite surface. (live)

A single **devotional quote** sits between the title and the description as a light grace note (see §7): *"Many hands make a miracle." — Swami Kriyananda*.

**States:** hub with 1 card (only Improve translations) and hub with all 4. Mobile = full-screen route, cards full-width.

---

## 3. Surface: Improve translations (the member contributor)

The workhorse. A member picks a target language and suggests clearer wording, string by string.

**Layout (desktop = inside Settings/own dialog; mobile = full-screen route):**
- **Top bar:** a **language picker** (custom popover; defaults to the member's UI language) + a **progress meter** (`N of M translated`, mono numbers).
- **Search field** — jumps to any phrase across all categories; results render **grouped under their category accordions** with a cross-category count ("5 phrases match "done" across 3 categories").
- A short source note: *"English is the source language — pick any target above. No need to finish; every phrase helps."*
- **9 category accordions** (most-used first: Tasks & list · Calendar · Status & board · Team & access · Projects & trash · Import/Export · Settings & navigation · Account & sign-in · Other & admin). Each header shows a **mono untranslated-count badge**; a green check when the category is fully done. **Untranslated rows sort first.**

**A string row** (the core unit):
- **English source** (read-only, left) · **Current** translation or a muted "— untranslated" (right).
- An **input** (textarea) with a **per-row Save** button → becomes **`Saved ✓` + an Edit button**. **No "submit all."**
- A saved row stays **editable**: Edit re-opens the input and flips the button to **Update**, with a "Previously saved "…" — editing" hint. (Members must be able to change their mind later — this was an explicit requirement.)
- The input + its button share one row and are **flush on both top & bottom edges** (D39); the label sits above, the hint below.
- **Fuzzy-merge:** near-duplicate English strings ("Add link" / "Add a link" / "Add link…") collapse into **one canonical row** with a **"+N similar"** chip that expands to *"Also covers these near-identical phrases"* + the variants. (Save once, cover all.)

**States to build:** Type & Save · Saved ✓ (editable) · Edit→Update · Search (grouped results) · Fuzzy expanded · Save **error** (inline message + Retry) · **Loading** (skeleton rows) · **All-done** (celebratory empty: a line-art mark + thank-you + a Yogananda quote). Mobile: rows **stack** (English → current → input), language picker is a **bottom sheet**, section headers are **sticky**, inputs ≥16px (no iOS zoom).

> ⚠️ **One open asset:** the all-done celebratory icon is meant to be a **line-art "heart-hands" mark** (two hands forming a heart). I have not finalized it — a placeholder is in place. Don't invent one; I'll supply the SVG.

---

## 4. Surface: Translation review (superadmin) — the "poll graph"

Superadmin-only, beside Platform overview. Shows, per string, **what the crowd suggested** and lets the admin push a winner live.

**Layout:** a locale picker + a count ("18 phrases have suggestions"), then one **poll card per string**:
- Header: the string **key** (mono), the **English source**, and a **"Live"** line showing the currently-active wording (or "No approved wording yet — showing the bundled default").
- **The poll graph:** one **horizontal bar per distinct suggested variant**, **bar length = number of submitters**, sorted most-popular first, the count in **mono** at the bar end. This is built on the app's existing **`.segbar`** bar vocabulary — **no charting library**.
  - Calm **azure** fill (these are NOT statuses, so not status colors). The **leading** bar reads stronger; the **currently-live** variant gets a **green check + tint + "Live" chip**.
  - **Approve** = click a bar (a hover "✓ Make live" affordance marks the target). Because it goes live app-wide instantly, a **confirm popup** follows (the app's confirm-before-destructive/global rule).
- An **expander** ("See who suggested what") reveals individual submitters (avatar · name · their exact text) on demand — collapsed by default.
- **Clear override** (danger styling) reverts to the bundled baseline — destructive, so it also gets a styled confirm.

**States to build:** poll list · submitters expanded · go-live confirm · just-approved (banner + the new live wording) · existing-override ("change the winner") · **empty** (no pending) · **loading** · handles **1 / 2 / many** variants and near-ties · long CJK/Indic variants wrap without breaking bars. Mobile: bars stack full-width, approve via tap, submitter detail in a **bottom sheet**.

---

## 5. The three Help Us flows (Report / Suggest / Spread)

All open from the hub; web = real Settings dialog with a **sticky footer** (D30); mobile = full-screen route with a sticky action footer. Reuse the app's form vocabulary, **custom selects** (never a native `<select>` caret — D-brand), the segmented control, and D39 alignment.

- **Report a problem** — only **"What happened?"** is required. **Where** = custom select; **severity** = segmented (Minor / Slows me down / Blocks me); optional **screenshot** (thumbnail + remove); an **"Include technical details"** toggle (on; collects browser + current page, labeled "no personal data"). Success = clean confirmation with a **mono reference number** (no quote — kept matter-of-fact). States: form · filled · sent.
- **Suggest a feature** — idea-first: one-line **idea** required; optional detail + area (custom select); a **"Tell me when this ships"** toggle. Sets honest expectations ("We read every one"). Thank-you carries a Yogananda quote. States: form · filled · sent.
- **Spread the word** — mirrors the app's existing **Team → Invite**: email + optional note + Send, **or** a **join link** with a copy-row (input + button flush both edges per D39; **Copy → Copied ✓**) and share targets (copy / email / message). Note: *"anyone with the link can request to join — an admin approves"* (matches the multi-tenancy model). Sent = confirmation + a Kriyananda quote. States: form · link-copied · sent.

---

## 6. Data model & backend notes (what makes the above real)

This is the part I most need your read on. My mocks assume:

- **String catalog:** every UI string has a stable **key** (e.g. `task.markDone`, `filter.clear`) and an **English source** value. The catalog is the source of truth for *what can be translated* and drives the 9 categories + counts.
- **Suggestions:** `(key, locale, text, submitter, timestamp)`. Many per `(key, locale)`. The poll graph groups identical `text` and counts distinct submitters. The contributor's "current translation" for a row = that member's own latest suggestion (or empty).
- **Live override:** per `(key, locale)` there is at most one **approved/live** value. Approving in §4 sets it; "Clear override" removes it (falls back to the bundled/baseline translation, else English). **"Goes live instantly, no redeploy"** is a core promise — the app must resolve strings at runtime: **live override → bundled translation → English source.**
- **Fuzzy-merge** (§3) is a presentation-time grouping of near-identical English keys — confirm whether you'd rather model this as real key aliases or purely a UI nicety. **Flag if this should be backend-driven.**
- **Roles:** any member can suggest; **superadmin** approves. Report/Suggest create tickets/records; Spread issues an invite (reuse existing invite infra).
- **Scope (v1 — out):** upvoting suggestions, public/no-login submission, per-org (per-tenant) translations, per-key manual overrides outside the poll. Tell me if any of these are cheap enough to pull into v1.

**Where I need feedback:** Is the runtime resolution chain workable at your latency budget? Is "instant, no redeploy" realistic, or should "Make live" mean "next session"? Does grouping suggestions by exact-string match match how you'd store them, or do we need normalization (whitespace/casing) server-side? Anything in §3/§4 that's expensive enough that I should redesign the interaction?

---

## 7. Design system (tokens & conventions to honor)

**Brand:** "Temple of Light" / Ananda Connect. Light + dark from the same tokens (dark = a token swap, never a separate design).

**Fonts:** Instrument Sans (all UI + all titles/headings, weight 700) · Red Hat Mono (all numbers — plain zero) · **Fraunces ONLY** for the brand wordmark and the devotional **quote** flourish (italic). Never Fraunces for dialog/section/calendar titles. CJK/Indic fall back to the matching **Noto Sans** family.

**Color tokens (light → dark):**
| Token | Light | Dark | Use |
|---|---|---|---|
| `--primary` | `#1e3a6e` | `#2c5499` | primary buttons, brand navy |
| `--dome` | `#2c5499` | `#7fa8d9` | focus, hub accent, toggle-on |
| `--azure` | `#7fa8d9` | `#a9c6ec` | poll-bar fill (dark accent) |
| `--gold` / `--gold-deep` | `#c9a24b` / `#7a5c22` | `#e0be6a` / `#e0be6a` | quotes, gold tints |
| `--done` | `#3f7d54` | `#5fb27a` | Saved ✓, live winner, success |
| `--danger` | `#b4452f` | `#e07a63` | destructive, errors |
| `--new` | `#6d4aff` | `#9a82ff` | "what's-new" dot |
| `--surface` / `--surface-2` / `--sunk` | `#fffdf8` / `#faf5e8` / `#efe5cc` | `#15223b` / `#172642` / `#1c2c49` | cards / subtle / tracks |
| `--border` / `--border-strong` | `#e4d8bb` / `#d8c89e` | `#27395b` / `#32466b` | hairlines |
| `--text` / `--muted` / `--faint` | `#23262b` / `#5a6172` / `#8a8270` | `#eaf0fb` / `#9fb0cc` / `#7e8ca6` | text ramp |

**Status pipeline (for the faux List view behind dialogs — 5 statuses, order matters):** To Do `--todo` · In Progress `--doing` (blue) · Delayed `--delayed` (red) · **Review** `--review` (purple) · Done `--done` (green).

**Radius:** `--r-card:11px` · `--r-ctl:8px` · `--r-pill:999px`. **Form spacing:** one step, `--gap-form:13px`, between sibling form rows (D35). **Buttons:** `.btn-primary/secondary/ghost/danger` (see prototype). **Shadows:** `--shadow-1` (hairline) · `--shadow-2` (popover) · `--shadow-pop` (modal).

**Hard rules that apply here (from the log / constitution):**
- **Custom selects only** — strip native carets, draw a chevron ~11px from the right; set bg with `background-color:` not the shorthand; keep `padding-right:30px`. (D-brand)
- **Connected controls perfectly aligned** — side-by-side = flush both edges & equal height; stacked = align the shared edge; a field over a button *group* aligns as a unit (don't stretch one button to field height). (D39)
- **No hard-clipping of text** — ellipsis + a reachable full value (tooltip/expand), "+N" overflow, or wrap. Never `overflow:hidden` with no path to the full text. (D42)
- **Line-art icons; emoji never as chrome.** (D34 — the only emoji allowlist is the project-picker emoji.)
- **Every state designed** — empty / loading / error / first-run / overflow / disabled, light + dark. (constitution)
- **Devotional quotes** — sparing, Fraunces italic. Two treatments: **lite** (no box, no icon — working surfaces) and **boxed** (gold-tinted card, no icon — celebratory moments only). Roster: Yogananda, Lahiri Mahasaya, Sri Yukteswar, Babaji, Kriyananda; **Jesus only when uniquely/supremely relevant.** Accuracy is sacred — don't paraphrase. (D40/D43)
- **Reproduce existing agreed chrome with 100% fidelity** before layering new UI (the faux board behind any dialog is the **real List view** — filter bar, summary strip, proj-pills, all 5 statuses). (RULE #0)

---

## 8. Files in this bundle

| File | What it is |
|---|---|
| `Ananda Taskboard - Community Translations.html` | The full design canvas — every surface & state, web + mobile, light + dark. Open it; the toolbar toggles light/dark, and each artboard has notes. |
| `ananda-translations.css` | Base tokens + shared app chrome (topbar, modal, custom select, phone frame, List view). The design-system foundation. |
| `tr-feature.css` | Feature CSS: Settings section-nav, Help Us cards, contributor rows, the poll graph, the three flows, quotes. |
| `tr-base.js` | Shared chrome builders + the icon set + the `quote()` helper. |
| `tr-screens.js` | Help Us hub, contributor, and review (poll-graph) builders. |
| `tr-flows.js` | Report / Suggest / Spread builders. |
| `design-canvas.jsx`, `translations-canvas.jsx` | The pan/zoom canvas harness (presentation only — not part of the feature). |
| `assets/ananda-mark.png` | The navy lotus brand mark. |
| `DESIGN-DECISIONS-LOG.md` (project root) | Authoritative decisions D1–D43. **Read D36–D43 for this feature.** |
| `design-constitution.md` (project root) | The universal standing rules. |

**Note on the prototype's structure:** screens are assembled by string-building functions (`window.TR.*`, `window.TRF.*`) rather than components — that's a prototyping choice, not a recommendation. Model them as proper components in the app.

---

## 9. Suggested build order

1. **String catalog + runtime resolution** (override → bundled → English) — nothing else is real without it.
2. **Settings section-nav + Help Us hub** (cheap, unlocks the entry points).
3. **Improve translations** (contributor) — the highest-value surface; get the row + save + edit loop right first, then search/fuzzy/states.
4. **Translation review** (poll graph) — depends on suggestions existing.
5. **Report / Suggest / Spread** — independent; can be done any time after the hub.

Then come back to me with feedback per §0.3 and §6.
