# Community Translations ("Help Us") — Design Spec

**Date:** 2026-06-08
**Status:** Approved design → implementation plan next
**Owner decisions captured in:** brainstorming round 1 (this session)

## 1. Goal

Let any logged-in member suggest better translations for the app's UI strings in
their own language, collect suggestions from many people, and give the superadmin
a fast, visual review tool to pick the winning translation per string. Approved
translations go **live without a redeploy**. This ships under a new **"Help Us"**
area in Settings — framed as the first of several future "help us improve" asks.

Today all 13 locale catalogs are compile-time JSON baked into the bundle
(`frontend/src/locales/*.json`), merged by i18next at init. This feature adds a
**runtime override layer** on top of that baseline.

## 2. Decisions (locked)

| Topic | Decision |
|---|---|
| Go-live model | **Runtime DB overrides**, merged over the bundled JSON at app load. No redeploy to publish a fix. |
| String scope | **All** strings, deduplicated by English text, grouped into an **accordion by category**, most-used categories first; untranslated/English-still-showing rows surfaced first within a category. |
| Who submits | **Any logged-in member**, in their currently selected language. |
| Review | **Superadmin only**, in the **Platform** area, with a **poll bar-chart** of suggested variants per string. |
| Override granularity | By **English source text** (not by key) — approving `"Save"→"Guardar"` fixes every place "Save" appears. |
| Out of scope | Community upvoting; public/no-login submission; per-org translations. |
| Deferred escape hatch | Per-key (context-specific) overrides, only if a real collision appears. |

## 3. Data model (backend — new Django app `translations`)

> A dedicated `translations` app (not the frontend "i18n" name) holds both models,
> the serializers, the views, and its migrations.

```python
class TranslationSuggestion(models.Model):
    locale = models.CharField(max_length=8)          # e.g. "es" (must be in SUPPORTED_LANGUAGES)
    source_text = models.TextField()                  # the English baseline string
    source_hash = models.CharField(max_length=64, db_index=True)  # sha256(source_text), for fast grouping
    suggested_text = models.TextField()
    submitted_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints = [UniqueConstraint(fields=["locale", "source_hash", "submitted_by"],
                                        name="one_suggestion_per_user_per_string")]
        # Re-submitting updates the user's existing suggestion (upsert in the view).

class TranslationOverride(models.Model):
    locale = models.CharField(max_length=8)
    source_text = models.TextField()
    source_hash = models.CharField(max_length=64, db_index=True)
    text = models.TextField()                         # the approved translation
    approved_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)
    approved_at = models.DateTimeField(auto_now=True)
    class Meta:
        constraints = [UniqueConstraint(fields=["locale", "source_hash"],
                                        name="one_override_per_locale_string")]
```

`source_hash` = sha256 of the exact English string, so grouping/lookup never
depends on long-text equality. Both tables are **global** (not org-scoped) —
translations are shared platform-wide.

## 4. API

| Method · Path | Who | Purpose |
|---|---|---|
| `GET /api/i18n/overrides` | public (any authed) | `{ locale: { source_text: text, … }, … }` for all locales (or `?locale=xx`). Cached; read by the app at load. |
| `POST /api/translations/suggestions` | member | Body `{locale, source_text, suggested_text}` → upsert this user's suggestion for that string. Validates `locale ∈ SUPPORTED`. |
| `GET /api/translations/review?locale=xx` | superadmin | Aggregated: per `source_hash`, the English text, current override (if any), and the **variant distribution** `[{suggested_text, count}]` sorted desc, plus total submitters. Optional `?expand=hash` to list individual `{user, suggested_text}`. |
| `POST /api/translations/overrides` | superadmin | Body `{locale, source_text, text}` → upsert the approved override. |
| `DELETE /api/translations/overrides` | superadmin | Body `{locale, source_text}` → remove an override (revert to baseline). |

Permissions: `submit` = authenticated; `review/approve` = `is_superadmin`
(platform owner). Reuse the existing platform-admin gate used by PlatformStats.

## 5. Runtime merge (frontend `i18n.ts`)

1. Keep the static bundled resources exactly as today (the always-present baseline).
2. After init, fetch `GET /api/i18n/overrides` once (and after the user changes
   language). For each locale, convert the `{source_text: text}` map into a
   **key→text** bundle by walking the bundled English catalog: for every key whose
   English value equals `source_text`, set that key's value to the override. Apply
   via `i18n.addResourceBundle(locale, "translation", bundle, /*deep*/ true, /*overwrite*/ true)`.
3. The fetch is non-blocking and best-effort: if it fails, the app shows the
   bundled baseline (no regression). Cache with a short TTL via TanStack Query.

This makes the override **by-English-text** model concrete: one approved
`source_text→text` updates every key sharing that English string.

## 6. Contributor UI — Settings → "Help Us" → "Improve translations"

- New **"Help Us"** section in Settings (a new tab/panel), with a short intro and
  the first ask ("Improve translations"); structured so future asks can be added.
- **Language picker** (defaults to the user's current language; English is shown
  as the read-only source, so you can't "translate English into English").
- **Accordion of categories** built **client-side** by flattening + deduping
  `en.json`. Category order (most-used first):
  1. Tasks & list (`list, task, tm, bulk, subtask, copy, view`)
  2. Calendar (`cal, day, holidays`)
  3. Status & board (`cs, kanban`) — note: the five **status labels** (To Do…Done)
     come from backend `Status` records, not `en.json`, so they are out of this
     inventory; translating them is a separate (deferred) concern.
  4. Team & access (`ta, ap, invite, approvals`)
  5. Projects & trash (`mp, trash, restore, del, modals, empty`)
  6. Import / Export (`import, export, expcol`)
  7. Settings & navigation (`settings, theme, menu, nav, tabs`)
  8. Account & sign-in (`login, signup, reset, verify, accept, org, onboarding`)
  9. Other & admin (`common, help, platform, history, emoji`)
- Each **row** = English text · current translation (or "— untranslated") · an
  input for the user's suggestion · a **per-row Save** button (saves that one
  suggestion immediately; no batching in v1, to keep state simple and feedback
  instant). **Untranslated rows sort to the top** of each category. A small count
  badge per category shows how many are still untranslated.
- Dedup note: exact-match dedup removes only ~37 of 555 (→ ~518 unique). The
  category accordion + untranslated-first ordering is the real manageability
  lever; dedup is a secondary tidy-up.

## 7. Superadmin review UI — Platform area → "Translation review"

- New panel beside the existing Platform overview (superadmin-gated, like PlatformStats).
- **Locale picker** → list of strings that have ≥1 suggestion (badge: # pending).
- Each string card shows the **English source**, the **current override** (if any),
  and a **horizontal bar chart** of variants: each distinct `suggested_text` as a
  bar whose length = submitter count, sorted desc (the "poll / bell-curve" view).
  Clicking a bar **approves** that variant (writes the override). A "Reject all"
  / "Clear override" control reverts to baseline. An expander reveals individual
  submitters only on demand.
- Built with the app's own primitives (no chart lib): bars are flex divs sized by
  `count/maxCount` — consistent with the existing `.segbar` pattern.

## 8. i18n / strings

All new UI chrome (Help Us intro, buttons, review labels) needs keys added to
**all 13 locale catalogs** (parity test). New keys use the existing namespacing
(e.g., `helpus.*`). The strings being *translated* are data, not new keys.

## 9. Testing

- **Backend (pytest):** suggestion upsert (one per user/string), superadmin-only
  gates on review/approve, override upsert/delete, the review aggregation
  (variant counts), locale validation.
- **Frontend (vitest):** the `en.json` flatten+dedup+categorize helper (pure
  function — inventory, ordering, untranslated detection); the override→bundle
  merge mapping (source_text→keys). 
- **Browser (Playwright):** submit a suggestion as a member; approve it as
  superadmin; confirm the string changes live after reload without a redeploy.

## 10. Build order (for the plan)

1. Backend models + migration + admin gate + endpoints + tests.
2. `i18n.ts` runtime merge + TanStack Query hook for overrides.
3. Frontend inventory helper (flatten/dedup/categorize) + tests.
4. Contributor UI (Help Us section + accordion + suggest).
5. Superadmin review UI (poll bars + approve) in Platform.
6. i18n keys across 13 locales; full QA pass (submit→approve→live) + permutations.

## 11. Risks / notes

- **Context collisions** (same English word, two correct translations by context):
  accepted risk for v1; reviewer catches egregious cases; per-key override is the
  deferred escape hatch.
- **Override endpoint caching:** short TTL + invalidate on approve so fixes appear
  fast without hammering the API.
- **Abuse/trolling:** mitigated by the review gate (nothing is live until the
  superadmin approves). No public submission in v1.
- **Deploy note:** new backend models → migration must run on Render; the override
  endpoint must be live before the frontend merge calls it (ship backend first or
  same deploy).
