# Build Plan — "Help Us" + Community Translations (v1)

> Date: 2026-06-09 · Approved by Gordon ("continue on your own, go as far as you can")
> after the code audit (`design/.../design_handoff_community_translations/CODE-AUDIT-FEEDBACK.md`).
> Rulings applied: §1 personal-coverage progress · §2 member-visible Settings w/ role-filtered
> sections · §3 Spread-the-word = new-center referral · §4 screenshot = compressed-in-Postgres,
> 90-day purge.

## Scope (v1)

Backend: two new Django apps. Frontend: Settings section-nav (D36), Help Us hub,
Improve translations (D37), Translation review (D38), Report/Suggest/Spread (D41),
runtime override resolution, full 13-locale i18n for all new strings.
Out: mobile full-screen routes (modals are responsive; dedicated mobile treatment ships
with the app-wide mobile effort), upvoting, public submission, per-org translations.

## Build order

1. **Backend `translations` app** — `TranslationSuggestion` (unique per key+locale+user;
   re-save = update), `TranslationOverride` (unique per key+locale). Endpoints:
   - `GET/PUT /api/translations/mine?locale=` — member's own suggestions; PUT batch-upserts
     (fuzzy fan-out saves several keys at once).
   - `GET /api/translations/overrides?locale=` — the boot fetch (key→text map).
   - `GET /api/translations/review?locale=` (IsSuperUser) — per key: variants grouped by
     normalized text, distinct submitter counts + names, current live text.
   - `POST /api/translations/approve` / `DELETE /api/translations/override` (IsSuperUser).
   - Normalization: trim + collapse whitespace + strip trailing ellipsis; never casefold.
   - pytest: upsert/update, grouping, permissions, approve/clear.
2. **Backend `feedback` app** — `ProblemReport` (message, where, severity, tech JSON,
   screenshot data-URL ≤1 MB, org, user), `FeatureSuggestion` (idea, detail, area, notify
   flag). POST endpoints (IsAuthenticated) → mono ref `TB-NNNN`; email superusers
   (fail_silently); screenshot purge >90 days piggybacked on the existing
   `/api/jobs/daily-push` cron. pytest: create, ref format, size cap, purge.
3. **Frontend foundation** — `translationOverrides.ts` (fetch per locale + i18next
   `addResourceBundle`, TanStack Query, refetch on focus + after approve);
   `i18nCategories.ts` (42 namespaces → 9 categories + vitest completeness test);
   `placeholders.ts` ({{var}} extraction + validation + vitest).
4. **Settings rework** (`Settings.tsx`) — left section-nav (desktop rail / top list on
   narrow), role-filtered: Account (name/email display + language) · Notifications
   (enable-push + daily-push toggle) · Task statuses (existing StatusManager, admin) ·
   Calendar & holidays (existing EventsManager, admin) · Help Us. Settings opens for ALL
   users now; account menu drops the language/notification/daily-push items (absorbed) and
   shows Settings to everyone. Theme stays logo-side only (D25).
5. **Help Us hub** — 4 ask-cards + lite Kriyananda quote; purple what's-new dot
   (localStorage `at-helpus-seen`) on the menu item + nav.
6. **Improve translations** — language picker (house SingleSelect) · personal-coverage
   meter ("You've suggested N of M") · search w/ grouped results · 9 category accordions
   (suggested-count badges, unsuggested-first) · string rows (English source · current
   wording · suggestion input + per-row Save/Saved ✓/Edit/Update) · exact-normalized
   "+N similar" fan-out · placeholder chips + validation error · loading skeletons ·
   save-error + retry · all-done (boxed Yogananda quote; heart-hands icon PENDING from
   Design — placeholder line-art until supplied).
7. **Translation review** (superadmin; topbar next to Platform overview) — locale picker,
   poll cards on `.segbar` vocabulary (azure fill, leading stronger, live = green check +
   chip), click-bar → styled confirm → approve, expander for submitters, Clear override
   (danger + confirm), states: loading/empty/approved/override/near-tie.
8. **Three flows** — Report a problem (What happened? required · Where select · severity
   segmented · screenshot client-compressed · tech-details toggle · mono ref success);
   Suggest a feature (idea required · detail · area · notify toggle · boxed quote
   thank-you); Spread the word (referral: signup link copy-row D39 + share targets +
   note · boxed Kriyananda quote).
9. **i18n** — every new key in ALL 13 locales (namespaces: `helpus`, `trc` contributor,
   `trv` review, `fb` flows, `settings.*` additions).
10. **QA & gates** — vitest + pytest + `tsc` + ESLint + Ruff + `npm run build`;
    Playwright walk of the live flows (kill zombie servers first); CodeRabbit at the
    commit checkpoint. Update docs/CHANGELOG + BUILD-STATE.

## Risk notes

- Settings rework touches the account menu — regression-check language switching.
- New keys must keep the help-coverage test green (nav/view/menu groups unchanged).
- The all-done heart-hands SVG is explicitly Design-supplied (D43) — ship with the house
  placeholder, flagged in the report.
