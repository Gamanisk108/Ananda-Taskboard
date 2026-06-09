# Claude Design Brief — Community Translations ("Help Us")

**For:** Claude (Design) · **Date:** 2026-06-08 · **Product:** Ananda Taskboard
**Companion build spec (for the engineer agent, NOT you):**
`docs/superpowers/specs/2026-06-08-community-translations-design.md` — that file
holds the data model / API / runtime behavior. **Your job is the visual design**
of the surfaces below, in the Ananda Taskboard system, light + dark, desktop +
mobile, every state.

---

## 0. How to use this brief
- Follow **RULE #0** (project `CLAUDE.md`): reproduce existing app chrome with
  100% fidelity (top bar, Settings shell, modals, List table, custom popovers)
  before layering anything new. Pull real markup/classes from
  `app/Ananda Taskboard.html` and `mobile/` rather than re-inventing.
- Log every design decision in `DESIGN-DECISIONS-LOG.md` (RULE #1).
- Deliver HTML/CSS mockups consistent with the existing design bundle, plus a
  short notes block per surface (like the other handoff screens).

## 1. The feature in one paragraph
A community-translation tool. **Any logged-in member** can suggest better
translations of the app's UI strings **in their own language**; we collect
suggestions from many people; the **superadmin** reviews them through a **poll
graph** (a bar chart of the suggested variants per string) and approves a winner;
approved translations go **live with no redeploy**. It lives under a new **"Help
Us"** area in Settings — explicitly framed as the *first* of several future
"help us improve the app" asks, so design the container to hold more later.

## 2. Brand & system constraints (non-negotiable — from `CLAUDE.md`)
- **Type:** Instrument Sans for **all** UI and titles (h1–h3 weight 700,
  `--f-ui`). Red Hat Mono for numbers (counts, tallies). **Fraunces only** for the
  "Ananda Taskboard" wordmark — never for section/dialog titles.
- **Status pipeline** (if statuses appear anywhere): To Do (gray) · In Progress
  (blue) · Delayed (red) · **Review** (purple `#7a5aa6`) · Done (green).
- **No native `<select>` carets — ever.** Every dropdown is the custom trigger +
  popover (surface bg, tan border, caret inset ~11px, check on the selected
  option). Language pickers here MUST use that control.
- **Icons:** line-art (lucide); no emoji except the project picker.
- **proj-pills** for any project/sub-project reference (tinted by `--pc`).
- **Light + dark** from the same tokens. **Radii:** controls 8px, cards 11px (DN1).
- **Modals:** sticky footer; destructive actions far-left in red; breadcrumb
  headers replace titles where a panel swaps in place. Header stays on one line at
  small widths (collapse labels to icons).
- **Mobile design language** (match `mobile/` + `Responsive.html`): full-screen
  routes for deep tasks, **bottom sheets** for pickers, `⋯` overflow / nav drawer,
  compact rows. Don't render a desktop table on a phone.
- **Languages are all LTR** (en, it, es, fr, de, pt, zh, hi, bn, ta, te, mr, gu) —
  **no RTL needed**, but you MUST design for **CJK (中文) and Indic scripts
  (Devanagari/Tamil/Telugu/Gujarati/Bengali)** and for **long translations**
  (many languages run 30–40% longer than English) — no clipping or overlap.

## 3. Surfaces to design

### 3.1 Settings → "Help Us" landing (the container)
- A new **"Help Us" section/tab** in Settings. Purpose: a friendly hub of ways
  members can help improve the app. Design it as a **stack of "ask" cards**; only
  one exists now — **"Improve translations"** — but the layout must look right
  with 1 card and with 3–4 later.
- Each card: line-art icon · title · one-line blurb · primary CTA. Warm,
  invitational tone (Temple-of-Light aesthetic), not a chore.
- **Desktop:** within the Settings modal/shell, as its own tab alongside the
  existing ones. **Mobile:** a Settings sub-route; cards full-width.
- **States:** the single-card default; (future-proof) a 3-card version so spacing
  reads well either way.

### 3.2 Contributor — "Improve translations"
The workhorse screen. A member picks a language and suggests translations.
- **Language picker** (custom popover): defaults to the member's current UI
  language; **English is the read-only source column**, never a target.
- **Category accordion** — 9 sections, most-used first: Tasks & list · Calendar ·
  Status & board · Team & access · Projects & trash · Import / Export · Settings &
  navigation · Account & sign-in · Other & admin. Each **section header** shows a
  **count badge** of how many strings there are still **untranslated** (mono).
- **String rows** inside a section, **untranslated ones first**. Each row:
  - **English source** (read-only).
  - **Current translation** (or a muted "— untranslated").
  - **An input** for the member's suggestion (custom-styled, not a bare box).
  - **Per-row Save** with a brief **saved ✓** confirmation. (No "submit all" — see
    partial submission below.)
- **Fuzzy-merged rows:** near-duplicate English strings ("Add link" / "Add a
  link" / "Add link…") collapse into **one canonical row** with a subtle
  **"+N similar"** affordance that, on tap, reveals the exact variants it covers.
  Design that affordance + its expanded state.
- **Partial submission (important):** a member may translate **one, a few, or
  all** — never required to finish. Show an *informational* progress hint
  ("12 of 240 translated") but **no completion gate, no blocking, no nag.**
- **States to design:** loading; **all-done / nothing-untranslated** (a warm
  "you've translated everything — thank you" celebratory empty state); a row in
  the **just-saved** confirmation state; **save error** (inline, retry); the
  **fuzzy "+N similar" expanded** state; a **long-content** row (very long English
  + very long CJK/Devanagari suggestion) with no overflow.
- **Responsive:** desktop = a comfortable single column (English · current ·
  input) or two-pane; **mobile = full-screen route**, each row **stacks**
  (English on top, current beneath it muted, input full-width below), accordion
  section headers sticky, language picker as a **bottom sheet**. Keep the header
  one line.

### 3.3 Superadmin — "Translation review" (Platform area)
Lives beside the existing **Platform overview** (superadmin-only).
- **Locale picker** (custom popover) → a list of strings that have **≥1
  suggestion** (each with a pending-count badge).
- **Per-string review card:**
  - The **English source** + the **current approved override** if one exists
    (clearly marked, e.g. a "live" chip).
  - **THE POLL GRAPH:** a horizontal **bar chart of the variants** — one bar per
    distinct suggested translation, **length = number of submitters**, sorted
    most-popular first, the count in Red Hat Mono at the bar end. This is the
    owner's at-a-glance "what does the crowd say" view (they asked for a
    graph/poll, not a list of every raw answer). Build it on the existing
    **`.segbar`** vocabulary — no charting library.
  - **Approve** by clicking/tapping a bar (that variant becomes the live
    override). **Reject all / clear override** reverts to the bundled baseline.
  - An **expander** reveals individual submitters (name + their exact text) only
    on demand.
- **States to design:** loading; **no pending suggestions** (empty); a string
  **just approved** (confirmation; it shows the new live override); a string that
  **already has an override** (show current + "change winner"); the bar chart with
  **1 variant**, **2**, and **many** (8+, incl. a near-tie and very long
  translations); long CJK/Indic variants without breaking the bars.
- **Responsive:** desktop = locale list + review cards; **mobile = full-screen
  route**, bars stack full-width, approve via tap, the submitter detail in a
  **bottom sheet**.

## 4. The poll graph — design detail
- Bars use a single calm accent fill (not the status colors — these aren't
  statuses); the **leading/most-popular** bar reads slightly stronger; the
  **currently-approved** variant (if any) gets a distinct "live" treatment (check
  + tinted) so the owner sees consensus vs. what's already live at a glance.
- Counts in **Red Hat Mono**. Sort desc by count; stable order for ties.
- Make the **click-to-approve** target obvious (hover/tap affordance) and design
  the **confirmation** (a destructive-ish action since it goes live app-wide —
  consider a small confirm, per the app's confirm-popup rule).

## 5. Microcopy (suggested — refine in your voice)
- Section: **"Help Us"** · subtitle e.g. *"Small ways to make Ananda Taskboard
  better for everyone."*
- Card CTA: **"Improve translations"** · blurb *"Suggest better wording in your
  language — the community picks the best."*
- Contributor intro: *"Pick your language and suggest clearer wording. Do as many
  or as few as you like — every bit helps."*
- All-done empty: *"You've translated everything here — thank you 🙏"* (the one
  allowed decorative emoji context is the project picker; prefer a line-art heart
  or lotus here instead).
- Review: **"Translation review"**, **"Approve"**, **"Make this the live wording"**,
  **"Clear override"**, **"N people suggested this."**

## 6. States & responsive checklist (every surface)
Design and show: **empty · loading · populated · all-done · error · first-run ·
overflow/long-content**, in **light AND dark**, at **phone / tablet / desktop**.
Extra for this feature: **CJK + Devanagari/Tamil/Telugu/Gujarati/Bengali**
rendering and **long-string** behavior (no clipping, wrapping, or bar overflow).

## 7. Reuse, don't reinvent
Custom select popover · accordion (match any existing pattern) · `.tbl` rows ·
`.segbar` (for the poll bars) · proj-pill · badges/count pills · modal + bottom-
sheet + full-screen-route patterns from `mobile/`. Follow the existing Settings
shell and the Platform-overview layout for placement.

## 8. Out of scope (do NOT design)
Community upvoting; public/no-login submission; per-org translations; per-key
(context-specific) override editing. (These are deliberately excluded from v1.)

## 9. Deliverables expected
HTML/CSS mockups in the bundle style for: **(a)** Help Us landing, **(b)**
Improve-translations contributor screen with its states, **(c)** Translation
review screen with its states — each in **light + dark** and **desktop + mobile**
— plus `DESIGN-DECISIONS-LOG.md` entries for the new conventions you introduce.
