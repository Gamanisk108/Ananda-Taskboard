# Items needing you — consolidated (2026-06-07)

Everything that needs your decision, Claude Design, or an action I can't take from here. Grouped. (Full per-item detail in `PIXEL-AUDIT-REPORT.md`; A/B/C design choices in `DECISIONS-NEEDED.md` DN1–DN13.)

---

## A. Design decisions — fill in `DECISIONS-NEEDED.md` (DN1–DN13)
Radii (DN1) · Weekly mini-badge radius (DN2) · Holidays location Team vs Settings (DN3) · Global-Overview project filters (DN4) · top-bar Archive (DN5) · theme control duplication (DN6) · 👥 group glyph keep/convert (DN7) · new-task button label (DN8) · new-task Status field (DN9) · edit-task header pattern (DN10) · task-popup section order (DN11) · "+ Add person…" copy (DN12) · one button spec (DN13).

---

## B. Send to Claude Design — emoji → line-art icon replacements
Per the rule (only project-picker emoji allowed), each stray emoji needs a line-art (lucide) replacement. My recommendations:

| Where | Current emoji | Recommended line-art | Notes |
|---|---|---|---|
| Welcome card title | 🙏 | **remove it** (title already leads with a `Sparkles` icon) | D18: "title drops the 🙏" |
| Approvals empty state | 🎉 | `CheckCircle2` (all-clear) or `Inbox` | empty/success state |
| Trash empty state | 🧹 | `Trash2` (muted, outline) or `Sparkles` | empty state |
| "Global Overview" tab | 🌐 | `Globe` | it's not a picked-project emoji |
| Export "Copy for Google Sheets" btn | 📄 | `ClipboardCopy` or `Sheet` | line-art button icon |
| Group indicator (assignee picker, list, copy-summary, history, team) | 👥 | `Users` — **REVISIT only** (you like it; design uses it too) | DN7 |

Also for Claude Design (icon/visual specifics): the **proj-pill** treatment everywhere (List/Board/Trash/Copy-summary currently dot+text), the **"Unscheduled Tasks"** emphasized button + CalendarOff icon (D6), and the **lotus mark** on auth screens (currently a navy dot).

---

## C. Operational / deploy blockers (server access needed — I can't do from here)
1. 🔴 **`/api/projects` returns 500 on the deploy** → Manage projects + Settings status list are empty. Needs the **Render logs / traceback** to fix. (Hypothesis: a missing/failed migration on the deploy — note the local `db.sqlite3` is also migration-behind: `no such column: accounts_user.theme`. Worth checking `migrate` ran cleanly on Render.)
2. 🔴 **Email delivery appears broken on the deploy** (signup verification never arrived at a readable inbox after ~70s) → blocks signup activation, invitations, password reset. Set/verify the **Resend API key / SMTP env** on Render + add a delivery smoke test.
3. 🧹 **Delete the 2 test orgs** I created (both unverified, on the Render DB): run in the Render shell —
   `python backend/manage.py delete_org --purge-unverified --dry-run` then `--yes --delete-orphan-users`
   (the new `delete_org` command is committed; I can't run it against prod from here).

---

## D. Ship the work I did (needs your go-ahead — outward-facing)
On branch **`feat/audit-fixes-2026-06-07`** (uncommitted): Playwright visual-regression scaffold (`frontend/playwright.config.ts`, `tests/visual/`, npm scripts, devDep), `.coderabbit.yaml`, `delete_org` command, gitignore. **Build ✅, tsc ✅, vitest 73/73 ✅, django check ✅.** To trigger **CodeRabbit** I need to commit + push + open a PR (CodeRabbit reviews PRs; it can't be run locally) — say the word and I'll do it.

---

## QA metrics (this run)
- ✅ `tsc -b` clean · ✅ `vitest` 73/73 · ✅ `vite build` clean · ✅ backend `pytest` all pass · ✅ `django check` clean.
- ⚠️ `eslint` 25 errors **pre-existing** (newer react-hooks/immutability rules — incl. the `set-state-in-effect` that Rule #9's TanStack migration resolves; out of scope).
- ⚠️ `fallow` maintainability 88.3 (good) but 87 over-threshold + 3 dead-code **pre-existing** (large-refactor signals; out of scope).
