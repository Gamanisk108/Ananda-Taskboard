# Live QA findings — 2026-06-10 (full review session)

> **RESOLUTION STATUS (end of session):** every 🔴 and 🟠 below is FIXED in
> PRs #8/#9/#10 except the ❓ items (need Design/Gordon rulings). Also fixed
> beyond this list: the Archive toggle was a silent no-op on main (viewProps
> never passed showArchived — caught while verifying DN5). Deferred: compact
> `.trow` Trash/Approvals rows at 390; APR-4 member pending-feedback (❓);
> fs-task Save-in-header (❓). TRN-1's live QA suggestion ("Salvare (QA test)",
> it) is to be dismissed with the new endpoint after deploy.

Target: https://ananda-taskboard.onrender.com/ @ 99bcf7e (Help Us v2 live).
Protocol: pixel-first sweep (playbook §2a), permutation matrix (§7), light+dark, 1440/834/390.
Triage: 🔴 bug/broken · 🟠 visual · 🟡 polish · ❓ needs-decision.

## Findings

### Auth
- 🟠 **AUTH-1: Login wordmark font.** Live `h1` "Ananda Taskboard" renders Instrument Sans; design spec (`auth/ananda-auth.css` `.brandrow .nm` + `.authcard h1`) = Fraunces (`--f-display`) 600. Also missing the italic gold `.bytag` tagline of the design brandrow. Lotus mark itself IS present (design log line 283 "navy dot — BUILD stale" is itself stale).
  Evidence: qa-01-login-light-1440.png + getComputedStyle = "Instrument Sans".

### Views
- 🟠 **VIEW-1: `.btn-unscheduled` dark-mode contrast fail.** Dark theme keeps light-theme navy text `rgb(44,84,153)` on dark bg `#172744` ≈ 2.0:1 (AA needs 4.5:1). Fix: dark-token override (e.g. azure `--primary` like `.tb.on`). Evidence: qa-07-monthly-dark-1440.png + getComputedStyle.

### Help Us / Translations
- 🟡 **TRN-1 (moderation gap): suggestions cannot be removed.** `MySuggestionsView` PUT rejects empty text (overwrite-only); superadmin has approve (`/approve`) + override clear only — no dismiss-suggestion endpoint, no contributor retract. A junk/abusive suggestion can sit in the poll forever; the only "remedy" is approving other wording. Fix: DELETE on `translations/mine` (own row) + superadmin dismiss in ReviewView; "Remove" affordances in ImproveTranslations row + review expander. NOTE: my QA suggestion "Salvare (QA test)" (it, holidays.save+common.save) is live in the poll — clean up with this feature.
- ✅ Contributor flow (D44): personal coverage 1/696, current-wording col, +N similar fuzzy chips, untouched-first sort, per-row save — all conform + work live.
- ✅ Review poll: fuzzy fan-out grouping, Make-live bars, own-wording override, who-suggested expander — conform.

### PWA / boot
- 🔴 **PWA-1: manifest icons don't exist.** `manifest.webmanifest` references `pwa-192.png` + `pwa-512.png` (incl. maskable) but neither file exists in `frontend/public`/`dist` — the SPA fallback serves index.html as `text/html` for them (200). Console warns "icon … isn't a valid image" on every load; PWA install icon is broken on Android/desktop. Fix: generate real 192/512 (+maskable padding) PNGs from the actual lotus `logo.png` (asset-integrity: resize the real mark, never regenerate), add `apple-touch-icon` for iOS, rebuild dist.
- 🟡 **BOOT-1: console 401 noise.** Every fresh load fires an unauthenticated `/api/me` (token attach/refresh ordering) → red console error before recovery. Cosmetic but alarms anyone with devtools open; consider skipping the probe when no token is stored.

### Approvals (populated via member-created task, verified end-to-end)
- 🟠 **APR-1: single Reject has no confirm dialog.** Clicking ✗ discards a member's submission instantly — violates the destructive-action-confirm rule (styled confirm exists app-wide). Add `useConfirm` to single reject (and verify Reject-all confirms).
- 🟡 **APR-2: no pending-count badge on the Approvals nav button.** Admin can't see work is waiting (Settings has a what's-new dot precedent; D15). Add count badge when >0 pending.
- 🟡 **APR-3: proj-pills missing in the "Where" column** (plain text + color dot). Same class as the Trash/Copy-summary pill rollout.
- 🟠/❓ **APR-4 (member UX): creating a task that needs approval gives the member no persistent feedback** — the task vanishes from their board until approved (a toast may flash; nothing durable). Consider a "Waiting for approval" pill/row or a member-visible pending list. Needs-decision on the design treatment.
- ✅ Flow verified end-to-end: member create → admin queue row (Open/✓/✗, Approve-all/Reject-all, "1 pending") → reject cleans up.

### Unscheduled Tasks
- 🔴 **UNS-1: Unscheduled modal shows NO TASKS — table clipped out of the painted card.** Live, 1440 light, Weekly+Monthly entry points: modal (`.card.modal.sheet.rise`) paints only header+filter bar (card h≈246px); the `UnscheduledTable` rows exist in DOM (2 rows, y≈319) but render outside the painted/clipped card area — user sees an empty white box and concludes there are no unscheduled tasks. Likely `.sheet` height/overflow regression (v2 CSS?). Evidence: qa-43/qa-44 + DOM probe (modal-body clientH=185, table present).

### Modal behavior
- ❓ **MOD-1: Escape-to-close contradicts the documented rule.** `common.tsx Modal` binds Escape→close ("app-wide expectation" per code comment), but project CLAUDE.md + memory state "Modal closes on backdrop click, not Escape." Verify against the design log (D-numbers) and either fix the code or fix the docs.

### Team & Permissions
- 🟠 **TEAM-1 (DN3 leftover): Holidays tab still in Team & Permissions** while v2 added the Settings → Events & Holidays pane — duplicate management surfaces for the same data. DN3 ruling: Settings is the home; remove the Team tab (verify nothing unique remains there first).
- 🟡 **TEAM-2: members-table right edge clipped at 1440** ("Active"/"Remove" column cut at modal edge — verify horizontal scroll affordance or widen; D42 no-hard-clip).

- 🟠 **TEAM-3: invite "Access" select overflows the card right edge at 390** (full label forces width past container; needs `min-width:0`/ellipsis per D42). Evidence: qa-46-team-390.png.

## Coverage log
- [x] Login 1440 light (pixel-read)
- [x] List/Board/Weekly/Monthly 1440 light + Monthly dark (pixel-read) — conform (proj-pills, 5 statuses, overdue tinting, holidays incl. Italian set, TODAY, pill badges)
- [x] Welcome first-login modal (line-art, Got it) — conforms
- [x] Settings all 5 panes dark (admin) + Account light (member, role-filtered correctly) — conform (D44–D48: static email, Light/Dark only, digest/timezone, events/holidays tabs+scopes, 6 holiday sets, 3-card Help Us hub, gold Fraunces quote)
- [x] Improve Translations (save → 1/696, fuzzy fan-out) + Translation Review (poll bars, own-wording, who-suggested) — functional end-to-end
- [x] Report-a-problem dark+light (attachments label fixed, tech-details toggle); presign endpoint auth-guards
- [x] Task modal light: DN9/DN10/DN11/D4/D5 conform; subtask+comment populated states; styled confirms; cleanup done
- [x] 5-status walk (To Do/In Progress/Delayed/Review/Done) via popover — colors+summary strip correct. NOTE: statuses left varied for later verification; REVERT to To Do at session end (Test Height, Test, Stock count, Design spring flyer).
- [x] Trash populated (proj-pills, 7d, Restore) → restore verified → empty state
- [x] Approvals populated end-to-end (member create → admin reject) — findings APR-1..4
- [x] Member role (Mara): nav hidden, menu reduced, Settings filtered
- [x] Export dialog, Copy summary (pill gap confirmed), Unscheduled (🔴 UNS-1), Team tabs (TEAM-1..3)
- [x] Mobile 390 baseline: List tcards ✓, drawer (admin-nav only), Team overflow finding
- [ ] DEFERRED to Phase-5 re-verify: History, Restore points, Bulk migrate, Import, Help center, Platform stats, Signup/Forgot/Reset screens, Task-statuses pane, 834 width, broader dark sweep, geometry sweeps (run with visual suite locally)
