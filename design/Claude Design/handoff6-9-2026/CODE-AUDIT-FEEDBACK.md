# Code Audit → Design Feedback: Community Translations / "Help Us"

> **From:** Claude Code · **To:** Claude (Design) · **Date:** 2026-06-09
> **Audited against:** the live codebase (`frontend/` React 18 + i18next, `backend/` Django/DRF,
> Render deploy via committed `frontend/dist`, Neon Postgres). Replies are keyed to the
> README's surface/state names (§2–§6) as requested in §0.3.
> **Verdict up front:** the architecture you assumed is ~80% real and the core promise
> ("instant, no redeploy") is genuinely workable. But one foundational assumption is wrong
> (there are **no untranslated strings** — all 13 catalogs are complete), one navigation
> assumption is wrong (**Settings is admin-only** in the build), and Spread-the-word
> conflates two different features. Details below, worst first.

---

## 1. 🔴 The "untranslated" state doesn't exist — the progress model needs reframing (§3)

**Fact from the code:** all 13 locale catalogs are 100% complete. I diffed every locale's
key set against `en.json` (555 leaf keys across 42 namespaces): **0 missing keys in every
locale**. A parity discipline enforces this — every new key ships in all 13 locales.
(~32–38 strings per locale are *intentionally* identical to English — "OK", "Email" — not
gaps.)

So these designed elements describe a state the product is never in:

- the `N of M translated` progress meter ("12 of 240")
- the mono **untranslated-count badges** on category headers
- **"untranslated rows sort first"**
- the muted **"— untranslated"** placeholder in the Current column
- the **all-done** celebration ("You've translated everything here")

**The feature is "improve," not "fill in."** Suggested reframe (needs your design pass):

- **Current column** → label it **"Current wording"** and always show the live value
  (override → bundled). It's what members see in the app today — the thing they're
  improving.
- **The member's own pending suggestion** is a *third* piece of state the row must show
  (you already half-have it via the Saved ✓ / Edit loop — but design the case where a
  member returns later: their suggestion ≠ current wording, both visible).
- **Progress meter** → "You've suggested **N** of **M** phrases" (member-personal), or drop
  it for a per-category "**N** with your suggestion" badge. Untranslated-first sorting
  becomes "phrases you haven't touched first" (or "fewest community suggestions first").
- **All-done** → "You've suggested something for every phrase" — keep the celebratory
  design (heart-hands, quote), reword the copy. It's now genuinely rare/earned.
- **Source note** copy should also shift: not "no need to finish" (nothing is unfinished)
  but e.g. *"Every phrase already has a translation — suggest anything you'd say more
  naturally."*

Real numbers for your mocks: **555 phrases**, 12 target languages.

## 2. 🔴 Settings is admin-only in the build — D36's section-nav presumes panes that don't exist (§1)

**Fact from the code:** the Settings menu item renders only for org admins
(`App.tsx` — `isAdmin && onSettings`), and the Settings dialog contains *only* admin
app-settings: daily-push time, status manager, calendar events. There is **no Account pane
and no Notifications pane** — language, theme, daily-push opt-out, and notifications all
live as direct items in the account menu today.

D36's nav (Account · Notifications · Task statuses · Calendar & holidays · Help Us)
therefore implies a bigger migration than the log records:

1. Settings must become **member-visible** with **role-filtered sections** — members see
   Account · Notifications · Help Us; org admins additionally see Task statuses ·
   Calendar & holidays. (Otherwise members can never reach Help Us, which defeats the
   feature.)
2. **The Account and Notifications panes are currently unmocked.** If we build the
   section-nav as drawn, two of five sections are empty shells. Please design them (they'd
   absorb the account-menu's language picker, theme, daily-push toggle) — or explicitly
   defer them and tell me what the member-visible Settings shows in the interim.
3. Alternative if you want to decouple: put **Help Us directly in the account menu**
   (beside Help & FAQ, where the what's-new dot pattern already exists) and let the
   Settings section-nav land later with the Account/Notifications work. My recommendation
   is your original placement *plus* the Account/Notifications pane designs — but it's a
   real scope decision for Gordon, not a silent build choice.

Good news in the same area: the **what's-new dot mechanism already exists** (Help's
`whatsNew`/`helpSeen` in `App.tsx`) — riding it on Help Us is cheap.

## 3. 🔴 Spread the word conflates two different features (§5)

The card copy says *"Invite another Ananda center or seva team"* — that's recruiting a
**new organization** (a new tenant). The form mirrors **Team → Invite** — that's adding a
**member to your own org**, and in the build it's **org-admin-gated** (`IsAdmin` on the
invitations endpoint). And the join-link note (*"anyone with the link can request to join —
an admin approves"*) assumes a **request-to-join + approval queue that does not exist
anywhere** in the codebase: invitations are admin-initiated emailed tokens that
auto-accept; there is no JoinRequest model, no pending-requests surface.

Pick one per card (or make it two cards later):

- **"Invite another center" (recommended v1):** the self-serve **org signup flow already
  exists** (create org → verify email → active). Spread the word becomes a referral
  surface: share the signup URL via your copy-row + share targets, optionally an email
  that says "check out Ananda Taskboard." Zero new backend. Your sent-state + Kriyananda
  quote survive unchanged.
- **"Invite a member by link, admin approves":** a genuinely new feature — join-link
  model, request queue, an Approvals-like admin surface (which itself needs design). Not
  v1-cheap. If you want it, it deserves its own handoff.

Either way the current copy/form pairing can't ship as-is — the copy promises one thing,
the form does the other.

## 4. 🟠 Report a problem: the screenshot has nowhere to live, and reports have no reader (§5)

- **No file-upload infrastructure exists** (no `FileField`/media config anywhere), and the
  Render free-tier disk is **ephemeral** — uploaded files vanish on every deploy. The DB is
  Neon Postgres. Options: **drop the screenshot in v1** (my recommendation — the
  "Include technical details" toggle covers most diagnostic value), or store small images
  in Postgres (base64/bytea, hard cap ~1–2 MB, thumbnail client-side). Don't design around
  generous uploads.
- **Where do reports and suggestions GO?** The design creates records but mocks no surface
  that reads them. Cheapest honest v1: store in DB **and email the platform owner**
  (transactional email infra exists — invites and password resets already send). A
  superadmin inbox/triage surface is a worthwhile **v2 design ask** — flagging so it isn't
  forgotten.
- The **mono reference number**: zero-padded DB id (`TB-0042`) — trivial, keep it.

## 5. 🟠 Fuzzy-merge: cap it at exact-after-normalization, and decide the fan-out (§3, §6)

You asked whether fuzzy-merge should be backend-driven. My read: **be careful — distinct
keys often exist precisely because the same English needs different translations in
different contexts** ("Done" the status vs "done" mid-sentence; gender/case agreement in
it/es/fr/de/pt; Indic particle choices). Auto-collapsing near-identical English and
fanning one suggestion across all covered keys can silently produce wrong translations the
member never looked at.

Recommendation:

- **v1 = group only strings identical after trivial normalization** (trim, collapse
  whitespace, strip a trailing ellipsis). Keep your "+N similar" chip + expander exactly as
  drawn — it just fires less often. **No edit-distance fuzz.**
- **Storage stays per-key:** saving a merged row writes one suggestion row per covered key
  (presentation-time grouping, a shared normalization util, no alias modeling). This keeps
  the review tool and live overrides per-key, so wordings can diverge later if needed.
- **Mirror the grouping in Translation review** — if the contributor merges, the poll list
  must merge the same way, or the admin sees confusing near-duplicate polls.
- Server-side normalization for poll grouping (your §6 question): **yes, normalize
  whitespace; do NOT casefold** — casing is meaningful in several locales.

## 6. 🟠 Missing from the design: interpolation placeholders (§3 — a whole row state)

**51 of the 555 strings contain `{{placeholders}}`** (`{{name}}`, `{{n}}`, …). Members
*will* delete them, translate the variable name, or mangle the braces — and a broken
placeholder renders literally in the app. The design needs:

- placeholders rendered as **distinct chips/tokens** in the English source (and ideally in
  the Current wording);
- an **inline validation error on Save** — e.g. *"Keep `{{n}}` exactly as it is — it
  becomes a number"* — blocking save when a placeholder is missing or altered (this is a
  new row state alongside your Save-error state);
- the review tool flagging variants with placeholder problems (they shouldn't be
  approvable as-is).

Good news: there are **zero plural-suffix keys** (`_one`/`_other`) in the catalog today, so
no plural-form complexity in v1.

## 7. 🟢 The core promise is real: "instant, no redeploy" works (§6 — your headline question)

The app's i18n is **i18next** with all catalogs bundled at build time. Your resolution
chain maps 1:1 onto it:

- **live override** → `i18n.addResourceBundle(locale, "translation", overrides, deep, overwrite)` at runtime
- **bundled translation** → the static catalogs
- **English source** → `fallbackLng: "en"` (already configured)

Latency budget: one small authenticated GET at boot (overrides JSON; even hundreds of
overrides ≪ 10 KB) — negligible. With TanStack Query (already installed) we'd refetch on
window focus, so an approval propagates to **active sessions within a focus-change and to
everyone on next load**. It is *also* a perfect fit for this app's deploy model: the
frontend is a pre-built committed bundle, so catalog edits normally require
rebuild + commit + deploy — API-served overrides bypass that entirely.

One copy nuance: the confirm dialog's *"for everyone … right away"* is true-ish (instant
for the approver; seconds-to-next-focus for others). Keep the copy or soften to "from now
on" — your call; no redesign needed.

## 8. 🟢 More confirmations (things you assumed that ARE real)

- **Key shape** — real keys are exactly your dotted form (`task.markDone` style); 555 keys
  in 42 namespaces.
- **`.segbar`** exists in the build (`common.tsx` + `App.css`) — the poll graph can be
  built on the house vocabulary, no chart lib. ✓
- **Superadmin gate exists** — `User.is_superuser`, an `IsSuperUser` DRF permission, and
  the live **Platform overview** surface (`PlatformStats.tsx`, metadata-only). Translation
  review beside it is the right placement and trivially gated. ✓
- **Any member can suggest** — suggestions only need an authenticated user; per-row Save
  maps to a clean upsert. Your "saved row stays editable / Update" loop matches a
  one-row-per-(key, locale, member) model exactly: re-save = UPDATE. ✓
- **Custom select** — the house `SingleSelect` popover component exists; language picker
  defaulting to the member's UI language is trivial (per-user `language` field + the
  pref → browser → English resolver already exist). English excluded as a target ✓.
- **All-LTR locale set** matches the build's 13 locales exactly. ✓

## 9. 🟡 Smaller design inputs

- **Categories:** your 9 categories must map from 42 real namespaces — we'll keep a
  `namespace → category` table in code with a test that fails when a new namespace is
  unmapped (same self-updating pattern as the help-coverage test). Your category names are
  fine. But note real volumes: some categories will hold **100+ rows** (the `ta` namespace
  alone is 68 keys, `settings` is 52). Please confirm long-scroll-with-sticky-headers is
  the intent inside an open accordion, or spec a "show more" chunking.
- **Org-defined content is out of catalog scope** — status labels (DB rows, org-editable
  in Settings), project/sub-project names, tier names. Members may expect to translate
  their board's own statuses. Suggest a line in the source note: *"Built-in interface text
  only — your board's own statuses and project names aren't included."*
- **Suggestions are platform-global** (matches your v1 scope). Submitter names in the
  review expander cross org boundaries — acceptable since only the platform owner sees it
  (they already see all rosters), but worth knowing.
- **Two review-tool edge states to add (cheap):** a suggested variant that's *identical*
  to the current live/bundled wording (show a "matches current" treatment or filter
  server-side), and suggestions for keys that no longer exist after a deploy (we'll
  silently hide + housekeep; no design needed unless you want a "removed phrase" row).
- **Mobile dependency:** the build has no mobile full-screen routes or Settings
  list-route yet — mobile is the largest pending build chunk overall. Your mobile designs
  stand, but Help Us mobile ships with (or after) that effort; desktop-dialog-first.
- **Meta-i18n:** every UI string in Help Us itself lands in all 13 locales (parity is
  enforced) — so finalize copy before build, churn is 13× priced.

## 10. Your §6 scope questions, answered

| Question | Answer |
|---|---|
| Runtime resolution chain workable at latency budget? | **Yes** — one small boot fetch + i18next `addResourceBundle`; see §7. |
| "Instant, no redeploy" realistic? | **Yes** — instant for approver, next-focus/next-load for others. Keep the design. |
| Group by exact string match, or normalize server-side? | **Normalize whitespace server-side; never casefold.** Grouping stays per exact normalized text; storage stays per-key (§5). |
| Anything expensive enough to redesign the interaction? | **No** — both surfaces are cheap. The expensive items were navigation (Settings gating, §2) and the non-existent join-link flow (§3), both scope decisions rather than interaction redesigns. |
| Fuzzy-merge backend-driven or UI nicety? | **UI-side, exact-after-normalization only, with per-key fan-out on save** (§5). |
| v1 scope pulls? | **Pull in:** superadmin free-text override (an "Or enter your own wording…" affordance in the poll card) — the override model supports any text, it's pure UI, and real curators want it. **Keep out:** upvoting (cheap later — the poll already reads as votes), public/no-login (fights auth assumptions everywhere), per-org translations (real resolver work). |

## 11. Backend shape I intend to build (so your next pass can assume it)

New Django app `translations`, two models:

- **`TranslationSuggestion`** — `key · locale · text · user · created_at · updated_at`,
  unique on `(key, locale, user)` → a member's re-save updates their row (your
  Saved ✓ / Edit / Update loop, exactly).
- **`TranslationOverride`** — `key · locale · text · approved_by · approved_at`, unique on
  `(key, locale)` → at most one live value per string per locale; delete = "Clear
  override".

Endpoints: member GET/PUT own suggestions per locale · authenticated GET of all overrides
per locale (the boot fetch) · superadmin GET review feed (grouped variants + distinct
submitter counts, your poll data shape verbatim) · superadmin POST approve / DELETE
override. Report-a-problem and Suggest-a-feature each get a small model + create endpoint +
notification email; no read surface in v1 (§4).

— end of audit. Reply against these section numbers and I'll fold your rulings into the
build plan.

---

## 12. Gordon's rulings (2026-06-09, after reading this audit)

- **§1 (progress model) — RULED.** Members can always return and re-update their text
  (the forever-editable loop stands). The meter becomes **personal coverage**: an
  indicator that the member has made a submission for 100% of the phrases offered —
  i.e. "You've suggested **N** of **555**", per-category badges = phrases without your
  suggestion, celebration fires at personal 100%. Design the contributor surfaces around
  this framing.
- **§4 (screenshot) — RULED.** Screenshot upload stays in v1 **only** via the zero-cost
  path: client-side downscale/compress (~≤300 KB JPEG, hard cap 1 MB), stored in the
  existing Neon Postgres DB, **auto-purged after 90 days** by the existing daily job. No
  file hosting, no new paid service. The designed thumbnail + remove affordance is
  unchanged.
- **§2 (Settings gating) — RULED.** Go with the design's placement: Settings becomes
  **member-visible with role-filtered sections** (members: Account · Notifications ·
  Help Us; org admins additionally: Task statuses · Calendar & holidays). **Design ask:**
  draw the missing **Account** and **Notifications** panes — they absorb the account
  menu's language picker, theme, and daily-push/notification toggles.
- **§3 (Spread the word) — RULED.** v1 = **new-center referral**: the card shares the
  existing self-serve org-signup link (copy-row + email/message share targets, sent-state
  + quote as drawn). The member-invite form and the "join link an admin approves" concept
  are **cut from v1**; member-invite-by-link with an approval queue is a possible v2
  feature needing its own design. **Design ask:** rework the card's form to the referral
  framing (the copy was already right — "invite another Ananda center").
