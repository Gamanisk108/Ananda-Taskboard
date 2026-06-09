# PIXEL-FIDELITY AUDIT — Live build vs. design references

**Date:** 2026-06-07
**Live build audited:** https://ananda-taskboard.onrender.com/ (Render deploy; logged in as `admin@ananda.test`)
**Design references (source of truth):** `handoff6-6-26eod_COMPLETE/` — `app/`, `mobile/`, `multitenancy/`, `auth/`, `help-onboarding/`
**Tie-breaker:** `DESIGN-DECISIONS-LOG.md` (D1–D19). Where the log dictates the correct version, the item is tagged **[per Dxx]**.

> Direction of comparison: the **design references are the spec; the live build must match them.** Every item below is a place the live build diverges from the design (or where design files disagree among themselves). Screenshots in `audit/screenshots/` (`LIVE__*` = live build, others = design references).

## Severity legend
- 🔴 **BUG/BROKEN** — wrong, missing, or contradicts a logged decision (D1–D19).
- 🟠 **VISUAL** — wrong font/color/spacing/alignment/icon/location vs design.
- 🟡 **POLISH** — minor; cross-file or low-impact.
- ❓ **NEEDS DECISION** — design files disagree and the log doesn't cover it (see DECISIONS-NEEDED.md).

---

## ✅ MERGED + DEPLOYED + RE-AUDITED LIVE (2026-06-07)
Merged to `main`, rebuilt `frontend/dist`, deployed to Render, and **re-verified on the live build** (new bundle `index-BIg_kmFx.js`):
- ✅ proj-pills render in List (Project + Sub-project tinted pills) and Board.
- ✅ Global Overview tab = line-art **Globe** (no 🌐). No stray chrome emoji.
- ✅ **`/api/statuses` no longer 500s** (CONN_HEALTH_CHECKS) — page loads statuses cleanly.
- ✅ New task: inline-editable **title + pen** header (DN10), **Status pill + selector** (DN9), **"+ Add link"** list (D4), **sticky footer**, **"Create task"** button (DN8/DN11).
- ✅ Edit task: **Delete far-left in red** (D5); **styled "Please confirm" dialog** on delete (no native `confirm()`); sticky footer; #id chip.
- No console errors on any checked screen.
- 🟡 **Follow-up:** the Links field **label** still reads "Links (one URL per line)" — update the `task.links` string (13 locales) to just "Links" now that it's a row list.

**Second deploy (verified live):** D15 ✅ (top bar lean = Platform·Approvals·Team·Projects; account menu = **Help at top + Trash**; theme dropdown gone, DN6) · auth screens now show the **lotus mark** (P1) · Bulk-migrate rows use proj-pills · proj-pills render at 390 too. Responsive re-check: phone List is still a side-scrolling desktop table (mobile `.tcard` layout not built — the major remaining mobile work).

---

## ⚙️ FIXES APPLIED (2026-06-07, branch `feat/audit-fixes-2026-06-07` — PR open)
Committed + pushed; **build ✅ · tsc ✅ · vitest 73/73 ✅ · pytest ✅** (eslint 26 = 25 pre-existing + 1 react-refresh consistent with auth.tsx). These take effect on the live build only after the PR merges to `main` + Render redeploys — that's when the "double-check against the HTML designs" re-audit can run.
- 🔧 **DB:** `CONN_HEALTH_CHECKS=True` for Postgres → fixes the intermittent `/api/statuses` 500 (Neon idle-drop).
- 🔧 **Emoji → line-art** (G/B1): 🌐→Globe, 🎉→CircleCheck, 🧹→Trash2, 🙏 removed (welcome+help, 13 locales), 📋→ClipboardList, 📁 removed, ✅→CircleCheck; eslint emoji-allow tightened to `['👥','🙂']`.
- 🔧 **Delete-left + red** (D5/E8): TaskModal footer.
- 🔧 **Custom confirm dialog** (I1): new `ConfirmProvider`/`useConfirm`; all **11** native `window.confirm()` replaced.
- 🔧 **proj-pills** (C1/D1b): List + Board now use a tinted `ProjPill`. (Follow-up: Trash/Copy-summary/Bulk rows.)
- 🔧 **Sticky modal footer** (DN11): Modal `footer` prop (fixed header → scrollable body → pinned footer); TaskModal body scrolls fields→Subtasks→Comments. **New-task button = "Create task"** (DN8).
- 🔧 **Help "Admin" chip removed** (D17) · **account-menu theme dropdown removed** (DN6, single logo toggle) · **Welcome "Skip" removed** (D16, single "Got it").
- 🛠️ **Tooling:** Playwright visual-regression scaffold; `.coderabbit.yaml`; `delete_org` mgmt command.

**Decisions all resolved** (DN1–DN13 + emoji + select-migration) — see `DECISIONS-NEEDED.md` answers + finalized `LOG-UPDATES-for-Claude-Design.md` (D20–D34).

**Still to implement (the larger features; all unblocked by the DN answers):** D4 Links textarea→list · D15 Help/Trash/Archive→account menu + What's-New dot · D6/D7/D13 Unscheduled rebuild · **DN2 full native `<select>`→custom-popover migration** · subtask D11/D12 rebuild (breadcrumb header, Share, Links, sticky footer, parent.index ids) · DN9 new-task status selector · DN10 inline-title header · proj-pills on remaining surfaces · i18n missing keys · DN1 radii in the design-bundle CSS. The **re-audit against the HTML designs runs once these deploy.**

**Deploy actions (you):** add email env on Render (EMAIL_BACKEND/EMAIL_HOST_PASSWORD/DEFAULT_FROM_EMAIL); run the test-org purge one-liner; merge PR → deploy to ship the above.

---

## EXECUTIVE SUMMARY

The live deployed build is **behind the design references in several substantive ways** — it largely reflects an older state of the canonical app and has not picked up multiple logged decisions (D4, D5, D6, D7, D13, D15) plus the emoji rule. Highest-impact findings:

1. 🔴 **`/api/projects` returns HTTP 500** on the deploy → Manage projects (and likely the Settings status list) can't load. *Server-side bug.*
2. 🔴 **proj-pills missing app-wide** — Project/Sub-project show as dot + plain text in List, Board cards, and Trash rows (design = tinted proj-pills). [CLAUDE.md core rule]
3. 🔴 **Help & Trash in the top bar**, account menu missing **Help & FAQ / Trash / Archive** and the What's-New dot. [D15]
4. 🔴 **"Unscheduled Tasks" feature unbuilt** — still old "No date" naming, plain button, "All day" rows + Time sort. [D6/D7/D13]
5. 🔴 **Links field is a textarea**, not the structured link-row list. [D4]
6. 🔴 **Footer Delete is on the right**; design = Delete far-left in red. [D5]  ·  Task-popup **footer renders mid-modal** above Subtasks/Comments.
7. 🔴 **Destructive delete uses a native `confirm()`**, not the custom styled confirm popup. [Hard UI rule]
8. 🔴 **Populated Trash is well behind design** — no bulk-select, no filters/sort, minimal rows (you were right it's more than emoji).
9. 🔴 **Welcome card** still has the 🙏 emoji + a web "Skip" button. [D16/D18]
10. 🔴/🟠 **Stray emoji** (🙏 welcome, 🎉 approvals, 🧹 trash, 🌐 Global Overview) — only project-picker emoji are allowed.
11. 🟠 **Native `<select>`** used for Project/Sub-project/Priority/filters; design = custom popovers. [D2]

**Confirmed matching / good:** brand fonts (Fraunces wordmark, Instrument Sans, Red Hat Mono) all load; 5-status order + colors incl. Review purple [D1]; dark mode is a clean token swap; List header cells pixel-match; Board column structure; Monthly grid (badges, today bracket, inline holiday names); admin dialogs (Approvals/Team/Projects/Settings/Trash) have their header icons; assignee chips (avatar+name) render correctly.

**More findings added in the autonomous deep pass:**
12. 🔴 **Destructive actions use native `window.confirm()`** (task & subtask delete) instead of the styled `openConfirm` popup (§I1).
13. 🔴 **Populated Trash** lacks bulk-select / filters / rich rows (§I2); 🔴 **Subtasks** populated row+detail miss priority/avatars/progress, breadcrumb #ids, "Sub-task name" label, Links field, Delete-left (§O, D11/D12).
14. 🔴 **Email delivery appears broken on the deploy** — signup verification never arrived at a readable yopmail inbox (~70s); blocks signup/invite/reset (§P5).
15. 🔴 **Phone (390) not built to the mobile design** — List stays a horizontal-scroll desktop table; no cards/drawer/sheets (§L). Tablet (834) reflows OK (minor status-pill wrap).
16. 🔴 **Help center:** admin articles still show the removed grey **ADMIN chip** + no What's-New block + 🙏 emoji (§M, D17).
17. 🔴 **More stray emoji:** 📄 (Export "Copy for Sheets"), 🧹 (Trash empty), 🙏 (Help footer) (§G/K).
18. 🔴 **Platform/Tier:** "Platform overview" dialog has **no header icon** + members column labeled **"Tier"** (should be "View Access") (§N).
- ✅ **Confirmed working:** superuser Platform overview lists **all orgs** (multi-org) with populated metadata + "pending verification" tags (§N3); dark-mode dialogs are a clean token swap; all admin dialogs (except Platform) have header icons; Help center largely built; assignee chips correct.

**Coverage note:** the live build was swept at desktop 1440 (light + dark dialog/list checks) and at 834 + 390; every top-bar/account dialog was opened; Task popup, assignee picker (0/2), subtasks (populated), Trash (empty+populated), Help (+search), signup/login, and the multi-org Platform popup were exercised. Per the populate-and-permute protocol (Rule #13), remaining permutations in §J (every status/priority set on rows, populated Approvals [needs a member submission], every dropdown option, all 13 locales, forgot-password screen, import dry-run, dark mode for every dialog, full per-screen mobile) are queued — several are blocked by the email-delivery bug (§P5).

**Items needing your judgment:** 13 — see `DECISIONS-NEEDED.md` (DN1–DN13).

**Prod cleanup:** 2 throwaway test orgs created during the audit (`Audit Test Org` / audittest@ananda.test, `Maple Grove Sangha` / anandaaudit2026@yopmail.com) — both unverified; delete server-side (no org-delete UI found).

---

## A. CHROME — top bar, account menu, theme toggle

### A1 🔴 Help & Trash in the top bar instead of the account menu — [per D15]
- **Live:** top bar = `Platform · Approvals · Team · Trash · Projects · Help`.
- **Design/D15:** **Help & FAQ** and **Trash** live in the **account menu** (Admin Ada ▾); top bar stays lean = `Approvals · Team · Projects`. Help available to everyone via the menu; a purple What's-New dot rides the user pill + Help row.
- **Fix:** move Help and Trash into the account menu; remove from top bar.
- Evidence: `LIVE__list__1440__light.png`.

### A2 🔴 Account menu missing Help & FAQ (top), Trash, Archive; no What's-New dot — [per D15]
- **Live account menu (Admin Ada ▾):** Settings · History · Restore points · Bulk migrate · Turn on notifications · Daily reminder ☑ · Language ▾ · Theme ▾ · Log out.
- **Design/D15:** **Help & FAQ at the TOP** of the menu (everyone), then admin tools; **Trash** and **Archive** grouped here (Settings · History · Archive · Restore points). A purple **What's-New dot** (`--new #6d4aff`) rides the user pill + Help row when unseen features exist.
- **Gaps:** no Help & FAQ row, no Trash row, no Archive row, no What's-New dot. (Live has extra rows — Bulk migrate, Turn on notifications, Daily reminder, Language, Theme — fine to keep; but Help/Trash/Archive belong here per D15.)
- Menu-item icons are correctly line-art. ✅
- Evidence: `LIVE__accountmenu__1440__light.png`.

### A3 🟡 Theme is both a top-bar toggle and an account-menu dropdown
- Live exposes theme via the moon icon next to the logo AND a "Theme: Light ▾" row in the account menu. Design has the single toggle next to the logo. Confirm whether the duplicate is intended.

---

## B. ONBOARDING — Welcome card

### B1 🔴 Welcome title still has the 🙏 emoji — [per D18]
- **Live:** modal title = "Welcome to Ananda Taskboard 🙏" (line-art icon AND a trailing 🙏 emoji).
- **Design:** the 🙏 placeholder was dropped; title is clean (help-onboarding notes: "Title drops the 🙏 emoji — dialog titles stay clean").
- **Fix:** remove the 🙏 emoji from the welcome title.

### B2 🔴 Web welcome shows a "Skip" button — [per D16]
- **Live (web, 1440):** footer has **Skip** + **Got it**.
- **Design/D16:** web welcome = a **single "Got it"** button, **no Skip**. (Skip/Got-it pair is the *mobile* welcome only.)
- **Fix:** remove "Skip" on web; keep single "Got it".

### B3 🟡 "+ New task" bullet shows a plain + icon, not the inline navy pill
- **Design:** the third bullet shows the **real navy "+ New task" pill inline**.
- **Live:** a plain line-art "+" icon tile.
- Evidence: `LIVE__list__1440__light.png`.

---

## C. LIST VIEW (desktop 1440, light)

### C1 🔴 Project / Sub-project render as plain text + dot, not proj-pills
- **Live:** Project & Sub-project columns = a small colored dot + plain text (`Instrument Sans 13px, weight 400`, transparent bg, no border, no radius).
- **Design:** both columns render as **proj-pills** (`Instrument Sans 11.5px, weight 600, border-radius 999px, padding 2px 9px`, tinted bg + tinted border via `--pc`). Project color tints the *pill*, not a separate dot.
- **Spec (CLAUDE.md):** "Projects & sub-projects render as proj-pills everywhere … never a bare color swatch."
- **Fix:** wrap Project/Sub-project values in the `.proj-pill` component in the List rows.
- Evidence: `LIVE__list__1440__light__clean.png` vs `app__list__1440__light.png`.

### C2 🟠 Filter bar differs from the design filter bar
- **Live filter bar:** `Search · All projects ▾ · All sub-projects ▾ · Any assignee ▾ · Any priority ▾ · Any status ▾ · Deadline: any ▾ · Recurring? any ▾`.
- **Design filter bar:** `Search · Assignee · Status · Priority (checkbox multi-selects w/ count pill) · Deadline · Recurrence (single) · Clear (only when active)`.
- Divergences: (a) live adds **All projects / All sub-projects** selects not in the design list bar; (b) live order is assignee→**priority→status**, design is assignee→**status→priority**; (c) copy: live **"Recurring? any"** vs design **"Recurrence: Any"**; live **"Deadline: any"** vs design **"Deadline: Any"**.
- ❓ Items (a) project/sub-project filters may be an intentional Global-Overview addition — see DECISIONS-NEEDED.
- Evidence: `LIVE__list__1440__light__clean.png`.

### C3 🟡 Top-right actions: live adds an "Archive" button + Export/Import are split-dropdowns
- **Live:** `Share view · Copy summary · Export ▾ · Import ▾ · Archive`.
- **Design:** `Share view · Copy summary · Export · Import` (no standalone Archive button; Archive is reached via the account menu per D15-adjacent grouping).
- Confirm whether a top-bar Archive button is intended — see DECISIONS-NEEDED.

### C-OK ✅ Confirmed matching in List
- List **header cells** match to the pixel: `Instrument Sans 10.5px / weight 700`, bg `#efe5cc`, color `#5a6172`, padding `8px 12px`, uppercase.
- **Brand fonts load correctly on live:** wordmark `.brand .name` = **Fraunces 600** (loaded), tagline = **Fraunces italic**, body UI = Instrument Sans, numbers = Red Hat Mono. (No font-fallback bug.)
- Summary strip shows all 5 statuses in order (To Do · In Progress · Delayed · Review · Done). ✅ [D1]

---

## D. BOARD VIEW (desktop 1440, light)

### D-OK ✅ Columns correct
- 5 columns in order **To Do · In Progress · Delayed · Review · Done** with dot + count pill. Review = purple. [D1] ✅
- Overdue cards get the red border ring; soon = amber. ✅

### D1b 🔴 Card sub-project is dot+text, not a proj-pill (same root cause as C1)
- Design board cards show the sub-project/project as a **tinted proj-pill**; live cards show a dot + plain text. Same fix as C1.

### D2b 🟡 Subtask progress not shown on cards (verify)
- Design board cards show a `done/total` subtask progress (e.g. "1/4 Done"). Not visible on live cards. Could be the seed data has no subtasks — re-confirm after opening a task with subtasks.

---

## E. TASK POPUP (New task + existing task, desktop 1440, light)

### E1 🔴 Links field is a `<textarea>`, not a structured link list — [per D4]
- **Live (New task & Task popup):** `Links (one URL per line)` **textarea**.
- **Design/D4:** a **list of link rows** (chain icon · URL field · ✕ remove) + a **"+ Add link"** button.
- Note: the *canonical app design* (`Ananda Taskboard.html` line ~2191) ALSO still has this textarea — D4 marks it stale and the **help-onboarding** Task Popup/Subtask editor as the correct version. So both the live build and the canonical-app reference need migration to the link-row list.
- Evidence: `LIVE__newtask__1440__light.png`.

### E2 🟠 Project / Sub-project / Priority are native `<select>`, not custom popovers — [per D2]
- **Live:** confirmed native `<select>` elements for Project, Sub-project, Priority.
- **Design/D2:** every dropdown is the **custom trigger + popover** (surface bg, tan border `#e4d8bb`, radius 8px, caret SVG inset ~11px; popover lists options with a check on the selected). Applies to Project, Sub-project, Status "Change to…", Priority, assignee picker, all filter/sort triggers.
- Note: the canonical-app reference also uses native selects (with a custom caret) — D2 (and the help module) are the correct target; live + canonical both need conversion to the custom popover. **Verify** the live native selects at least strip the native caret per the Hard UI rule.

### E3 🟠 Assignee control is "None assigned · Edit", not the "+ Add person or group…" picker
- **Live (New task):** Assignees row shows `None assigned   Edit`.
- **Design:** chips + a **"+ Add person or group…"** custom picker (same control in Task Popup and subtask editor).
- Evidence: `LIVE__newtask__1440__light.png`.

### E4 🟡 New-task primary button says "Save", design says "Create task"
- Design (responsive new-task notes): "…ending in a primary **Create task** button." Live footer = `Cancel · Save`.

### E5 🟡 New-task Status shows "Set after creating" (vs a status selector in the design new-task)
- Confirm intended; the design responsive New task shows a Status dropdown defaulting to "To Do".

### E6 🟠 Edit-task header pattern differs from design
- **Live (existing task):** header = `Edit task · #3` (generic), and the task name is a **separate "Task name" field** below; `#3` is plain text, not a chip.
- **Design:** the header **is** the inline-editable task title + a **pen icon** + a **#id chip** (no separate "Task name" field).
- Evidence: `LIVE__taskpopup__1440__light.png`.

### E7 🔴 Action footer is mid-modal; Subtasks & Comments render BELOW it — [layout vs design]
- **Live:** order is …fields → checkboxes → **footer (Share · Cancel · Delete · Save)** → **SUBTASKS (0)** → **COMMENTS (0)**. The Save/Delete bar is sandwiched mid-modal.
- **Design:** body order is …fields → **Subtasks** → **Comments**, with the action footer at the **very bottom**.
- Evidence: `LIVE__taskpopup_scrolled__1440__light.png`.

### E8 🔴 Footer Delete is on the right (Cancel · Delete · Save) — [per D5]
- **Live:** `⤢ Share` (left) · `Cancel · Delete · Save` (right), Delete red but right of Cancel.
- **Design/D5:** **Delete on the LEFT in red**, Save (primary) on the right.
- Note: the canonical-app reference has the same stale order; help subtask-detail has the correct Delete-left. Per D5, fix to Delete-left.

### E9 🟠 Subtasks/Comments headers are plain uppercase counts; design Subtasks header has status-count dots + a done/total progress bar
- **Live (0 subtasks):** `SUBTASKS (0)` + "Add a subtask…" quick-add + `Add`. `COMMENTS (0)` + "Add a comment… (type @ to mention)" + `Post`.
- **Design/D11:** Subtasks header carries **status-count dots + a `done/total` progress bar** (To-Do share = empty track); rows are mini-tasks (priority · title · aligned avatar column · status pill+popover · ✕). **Verify the live subtask ROW design on a task that has subtasks** (0-state hides the rows/progress).
- ✅ Status options (To Do·In Progress·Delayed·Review·Done) and Priority (Highest·High·Medium·Low·Lowest) are complete & correctly ordered in the live dropdowns. [D1]

### E10 ❓ "Pending approval" pill not shown on this task
- Live task #3 "Member proposal (pending)" shows no "Pending approval" pill (the "(pending)" is just in the name). Design shows a Pending-approval pill on genuinely pending tasks. **Verify** via an actually-pending task (Approvals) before concluding.

---

## F. ADMIN DIALOGS — header icons + contents (desktop 1440, light)

> Design `openSheet` gives these dialogs a leading 19px line-art header icon (`.sh-icn`): team · projects · settings · approvals · trash · restore · history · copy.

### F1 ✅ Approvals dialog has its header icon
- Header = line-art check-circle + "Approvals". Empty state: "Nothing waiting for approval. 🎉" (🎉 = decorative accent, per emoji-icon memory — low priority; confirm intended).

### F2 — Team & Permissions
- ✅ Header icon present (people icon).
- 🟠 **F2a "Admins ignore tiers" copy is stale** — the Tiers→**"View Access"** rename means this should read "Admins ignore **View Access** / see everything." (The picker labels are correctly "Access" / "Sub-Project Only".)
- ❓ **F2b Holidays + Activity are Team tabs** — design places **Holidays under Settings** (MASTER-HANDOFF: "Settings (statuses, holidays)"). Confirm whether Holidays should live in Team or Settings. (Tabs: Members · Groups · Access · Activity · Holidays.)
- 🟠 **F2c** Role/Access are native `<select>` (D2 → custom popovers); Access tree projects should be **proj-pills** (verify on Access tab).
- Evidence: `LIVE__team__1440__light.png`.

---

## G. EMOJI VIOLATIONS — only project-picker emoji are allowed
> **Rule (Gordon 2026-06-06):** the ONLY emoji allowed are the per-Project emoji chosen via the Emoji Picker. Every other emoji must be line-art (lucide). Exception parked for later: the **👥 group indicator** in the assignee picker is a "revisit later" item (the design itself uses 👥), not an immediate fix — see DECISIONS-NEEDED.

### G1 🔴 Stray emoji found in the live build (convert to line-art)
- 🙏 Welcome card title (see B1).
- 🎉 Approvals empty state ("Nothing waiting for approval. 🎉").
- 🌐 "Global Overview" project tab — should be a line-art globe (it is not a picked-project emoji).
- (Per the eslint `allow` list that must be emptied, also expect: 🧹 trash empty, ✅/📁/↳ import preview/success, 🙂 emoji-picker default-as-chrome.) Full DOM scan results appended below.

**DOM emoji scan (board view, logged in):** only stray graphical emoji = **🌐** on the "Global Overview" tab (`.pemoji`). Real projects render a **color dot** (no picked emoji), so 🌐 on the aggregate view is the one to convert to a line-art globe. Other states to re-scan: Welcome (🙏 ✓found), Approvals empty (🎉 ✓found), Trash empty (🧹 expected), Import preview (✅/📁 expected).

### G2 🟡 Dropdown carets use a text "▾" glyph, not the line-art SVG chevron
- Live "Export ▾", "Import ▾", and multi-select `.ms-caret` use the unicode `▾` (U+25BE) character. Design uses an **SVG chevron** caret inset ~11px. Convert text carets to the SVG chevron for line-art consistency + correct inset.

### F3 🔴 "Manage projects" is empty — `/api/projects` returns HTTP 500 (live build bug)
- Header icon present ✅ (grid icon). But the dialog shows **"No projects yet."** despite Karuna Devi / Sunday Service existing as project tabs.
- **Console:** `GET https://ananda-taskboard.onrender.com/api/projects → 500`. The project tabs load via the tasks aggregate, but the projects-management endpoint is erroring on the deployed build.
- **Design Manage projects** lists each project as a row: emoji button + **circular color swatch** + name input + "Created …" + **Delete** (opens move dialog); note "Changes save automatically." None of this is reachable while the API 500s.
- **Fix:** server-side — resolve the `/api/projects` 500 on the deploy; then re-audit the row design (color swatch must be a **circle** w/ recommended palette per Hard UI rule).
- Evidence: `LIVE__projects__1440__light.png`.

### F4 — Settings
- ✅ Header icon present (gear). Sections: Daily push time · Task statuses (Kanban columns) · Calendar events.
- 🔴 **F4a Task-statuses list appears empty** — only the "New status name…" add row shows; the existing 5 statuses (To Do…Done) are not listed as recolor/rename/reorder rows. Likely the same data-load failure as `/api/projects` (verify statuses endpoint). Design lets you edit each existing status inline.
- ❓ **F4b Holidays location** — design says "Settings (statuses, holidays)"; live puts **Holidays as a Team tab** and Settings has a **Calendar events** section instead. Decide canonical location (ties to F2b).
- 🟠 **F4c** Verify the status **color swatch is a circle** (Hard UI rule: circular swatch + recommended palette) — live swatch looks square/rounded.
- 🟠 Timezone / event Type are native `<select>` (D2 → custom popover).
- Evidence: `LIVE__settings__1440__light.png`.

### F5 — Trash
- ✅ Header icon present (trash-can). Body copy matches (7-day retention).
- 🔴 **F5a** Empty state "Trash is empty. 🧹" — **🧹 emoji violation** (convert to line-art).
- Evidence: `LIVE__trash__1440__light.png`.

### F6 ✅ Dialog header-icon summary
- Approvals · Team · Projects · Settings · Trash all carry their leading line-art header icon — matches the design's `openSheet({icon})`. **Still to verify:** Copy summary (design `icon:'copy'`), Restore points (`icon:'restore'`), History (`icon:'history'`), Bulk migrate, and the **confirm/delete dialogs** (`openConfirm` may not set an icon). Note: in the design, **Export/Import dialogs intentionally have NO header icon** — so their absence on live is correct, not a bug.

---

## H. CALENDAR VIEWS (Weekly / Monthly) + Unscheduled (desktop 1440, light)

### H1 🔴 "Unscheduled Tasks" feature not built — still the old "No date" — [per D6/D7/D13]
- **Live Weekly header button:** `No date (2)` — plain secondary button, plain "(2)" count, calendar icon.
- **Design/D6:** **"Unscheduled Tasks (N)"** button — renamed, **emphasized** (blue outline + tinted fill + **navy count pill**), line-art **calendar-with-X** icon, **hidden at N=0**, wraps full-width when narrow.
- **Live modal:** title `No date — 2 tasks`; a **`Sort: Time (timed first)`** control; rows are the old compact day-detail format with an **"All day"** label + status pill.
- **Design/D7+D13:** modal titled **"Unscheduled tasks (N)"**; body is the **standard sortable List table** — Task · Project · Sub-project · Assignees · Status — with filters Assignee · Project · Status and **NO deadline/recurrence**; **no "All day" label and no Time sort** (unscheduled tasks never have a time, D13).
- **Fix:** rename copy (`cal.noDate`/`cal.noDateTitle` → "Unscheduled …"), emphasize the button + navy count pill + CalendarOff icon + hide at 0, and rebuild the modal as the List-methodology table without date/time.
- Evidence: `LIVE__weekly__1440__light.png`, `LIVE__nodate_modal__1440__light.png`.

### H2 🟡 Weekly bar radius / Done-hidden — verify
- Weekly task bars appear ~5px rounded (D8 ✅ visually); confirm computed radius = 5px on live.
- D9 (Done hidden from Weekly/Monthly + Unscheduled + Copy Summary): no Done task in the visible range to confirm — re-check with a Done task dated in-range.

---

## I. DESTRUCTIVE CONFIRM + POPULATED STATES

### I1 🔴 Delete uses a native browser `confirm()`, not the custom confirm popup — [Hard UI rule / openConfirm]
- **Live:** clicking Delete on a task fires a **native `window.confirm("Delete this task?")`** browser dialog.
- **Design:** destructive actions use the app's **custom `openConfirm` popup** — a styled modal with a title, a **body explaining what will happen** (e.g. kept in Trash 7 days / "cannot be undone" for permanent), and a red danger confirm button.
- **Fix:** replace native confirms with the styled `openConfirm` component everywhere a destructive action occurs (delete task, delete project/sub-project, delete forever, restore board, etc.).
- This also means the design's confirm-dialog header/markup can't be compared — there is no custom confirm dialog in the live build to compare.

### I2 🔴 Populated Trash is well behind the design (the user was right)
- **Live (1 trashed task):** group heading "TASKS", one row = `Neon Test · 7d left` + `Restore` (secondary) + `Delete forever` (plain red text). That's it.
- **Design (mobile `.crow` Trash + canonical):** compact rows with a **bulk-select checkbox**, a **bulk action bar**, **filters + sort**, and rich rows (priority icon · title · **project/sub-project proj-pills** · assignees), grouped by type (Tasks / Projects / Sub-projects), each with a "7d left" badge.
- **Gaps:** no bulk-select, no bulk bar, no filters/sort, no proj-pills/priority on rows, "Delete forever" is red text not a bordered danger button (D5).
- Evidence: `LIVE__trash_populated__1440__light.png`.

### I3 — Assignee picker permutations (0 / 2)
- **Picker (expanded):** Search box + "Filter: any group" (native select) + "Assign a WHOLE group: 👥 Alliance" + a **checkbox list** (Admin Ada / Mara Member / Omar Member, no avatar circles in rows) + **Done**.
- 🟠 **I3a** Picker is a **checkbox list**, not the design's **"+ Add person or group…" search popover**; entry point is "None assigned · Edit" not "+ Add person or group…" (ties to E3). Picker rows lack **avatar circles** (design shows colored initial avatars in the list).
- ✅ **I3b** Resulting assignee **chips are correct** — colored avatar circle (initials) + name in a tinted pill (`MM Mara Member`, `OM Omar Member`). Matches design chip style at 2 assignees.
- ❓ **I3c** 👥 group emoji in "Assign a WHOLE group" — REVISIT item (you like it; design uses it too) — see DECISIONS-NEEDED.
- 🟠 **I3d** "Filter: any group" is a native `<select>` (D2 → custom popover).
- Evidence: `LIVE__assignee_picker__1440__light.png`, `LIVE__assignees_2__1440__light.png`.

### I4 🟠 Status "Change to…" is ALSO a native `<select>` (correction) — [per D2]
- Confirmed via DOM: the status control is a native `<select>` (options: "Change to…", To Do, In Progress, Delayed, Review, Done). So **every** task-popup dropdown — Project, Sub-project, **Status**, Priority — and the filter-bar controls are **native `<select>`s**, not the custom trigger+popover D2 requires. (Values/order are all correct; the status *pill* display is correct.) This is a comprehensive D2 gap across the app.

---

## J. PERMUTATION COVERAGE MATRIX — exercised vs. deferred
> Per Rule #13. This audit pass (live build, mostly desktop 1440) covered the items marked ✅. Items marked ⏳ are queued for the continued exhaustive pass and should be walked through every permutation (each value, 0/1/2/many, light+dark, each width).

**Exercised this pass:**
- ✅ Views: List, Board, Weekly, Monthly (desktop light); List (desktop dark).
- ✅ Onboarding: Welcome card (web).
- ✅ Task popup: New task + existing task; status/priority option lists; Links; footer; Subtasks(0)/Comments(0); assignee picker at **0 and 2**.
- ✅ Dialogs: Approvals (empty), Team (Members tab), Projects (500), Settings, Trash (**empty AND populated**), account menu.
- ✅ Destructive confirm (native confirm finding).
- ✅ Unscheduled ("No date") button + modal.
- ✅ Theme: light + dark (List).
- ✅ DOM emoji scan (board view).

**Deferred (continue exhaustively — every permutation):**
- ⏳ **Assignees:** 1 and **many** (overflow/stacking, +N), group-assigned (◇), avatar hover names.
- ⏳ **Every status × every row state:** set each of the 5 statuses on a task; overdue/soon/normal rows; recurring tasks; pending-approval tasks (populate via a member submission).
- ⏳ **Every priority** (Highest…Lowest) icon rendering on rows/cards.
- ⏳ **Subtasks populated** (1 / some / all-done) — row design, progress bar, status-count dots, detail panel (breadcrumb #id.index), time-validation error (D11/D12/D13). **Comments populated.**
- ⏳ **Every dropdown/filter option:** open & select each value in Assignee/Status/Priority/Deadline/Recurrence/Projects/Sub-projects filters; combine filters; Clear; sort orders. Export ▾ / Import ▾ menus. Language picker (all 13 locales — i18n). Theme menu values.
- ⏳ **Remaining dialogs:** Copy summary, Export (CSV), Import (CSV dry-run + preview states), Restore points, History, Bulk migrate, Archive, Platform (multi-tenancy), org switcher, invitations (send/accept), org settings.
- ⏳ **Auth module:** login (done visually) + **forgot password, reset, create account/signup, accept invitation** — vs `auth/` design.
- ⏳ **Help module:** Help center (landing/section/article/search/empty), What's-New dot, vs `help-onboarding/` design.
- ⏳ **Dark mode** for every dialog/popover/calendar (only List checked).
- ⏳ **Responsive:** live app at **834** and **390** for every screen vs `mobile/` + `Responsive.html` designs (compact `.crow`, nav drawer, bottom sheets, day sheet).
- ⏳ **Content extremes:** long titles/overflow, many tasks (scroll/+N), empty-search, error states.

---

## K. MORE DIALOGS (desktop 1440, light)

### K1 — Copy daily summary
- ✅ Header icon (copy). Day picker · Filter by project (chips) · person (checkboxes) · group · Preview textarea · Close / Copy to clipboard.
- 🟠 Project filter chips (Karuna Devi / Sunday Service) are **untinted plain pills** (proj-pill tinting missing — C1).
- ❓ 👥 group emoji ("Alliance") — revisit (DN7).
- Evidence: `LIVE__copysummary__1440__light.png`.

### K2 — Export tasks
- ✅ Has a header icon (download) — note the **design's Export had no header icon**, so this is additive, not a bug.
- 🔴 **K2a 📄 emoji** on the "Copy for Google Sheets" footer button — convert to line-art.
- 🟠 Format / Status / Priority / Assignee are native `<select>` (D2).
- Export column checkboxes (ID, Project, Sub-project, Title, Status, Priority, Approval, Deadline, Start/End time, Recurrence, Assignees, Details, Requirements, Links) all present. ✅
- Evidence: `LIVE__export_menu__1440__light.png`.

### K3 — Import tasks
- ✅ Header icon (upload). Paste-from-spreadsheet textarea + file upload + Format select + Preview import.
- 🟠 Format is native `<select>` (D2).
- ⏳ **Import preview / dry-run** state (design shows ✅/📁 row-status preview) not exercised — needs a CSV; re-audit (watch for ✅/📁 emoji → line-art).
- Evidence: `LIVE__import__1440__light.png`.

---

## L. RESPONSIVE (live build at 834 tablet + 390 phone)

### L1 🔴 Phone (390): List stays a horizontal-scroll desktop table — the mobile design is not built
- **Live @ 390:** header collapses to icons (✅), filters reflow to a 2-col grid (✅), but the **List remains the desktop `<table>` with horizontal scrolling**; the action-button row (Share/Copy/Export/Import/Archive) overflows; the account avatar wraps to its own line.
- **Design (`mobile/` + `app/Ananda Taskboard - Responsive.html`):** phone List = **`.tcard` task cards** (and compact `.crow` variants), with a **nav drawer / ⋯ overflow**, **bottom sheets** for filters/assignee/day-detail, and full-screen routes for task detail/new task. **None of these mobile layouts are present** in the live build.
- **Impact:** on a phone the app is a cramped, side-scrolling desktop, not the designed mobile experience. Tablets (834) fare better (reflowed desktop).
- **Fix:** implement the mobile breakpoint layouts from the `mobile/` + Responsive designs (cards, drawer, sheets).
- Evidence: `LIVE__list__390__light.png`, `LIVE__list__834__light.png`.

### L2 🟠 Tablet (834): minor squish — status pill wraps
- At 834 the "To Do" status pill is too narrow and wraps to two lines ("To\nDo"). Give the status pill a min-width / nowrap so it doesn't wrap when columns compress.
- Header-icon collapse + filter/action wrapping work correctly. ✅

### L4 🔴 Design-specified phone screens vs live (the design HAS them; the build doesn't)
Design refs: `mobile/Ananda Taskboard Mobile.html`, `app/Ananda Taskboard - Responsive.html` (evidence: `DESIGN__mobile_canvas__light.png`). Live @ 390: `LIVE__list__390__light.png`, `LIVE__board__390__light.png`.

| Screen | Design (mobile artboard) | Live @ 390 |
|---|---|---|
| List | `.tcard` task **cards** (+ compact `.crow`) | desktop **table, horizontal scroll** ❌ |
| Board | kanban **cards w/ subtask progress** | horizontal-scroll columns (cards OK-ish) |
| Task detail | **full-screen route**: breadcrumb ← back · editable title + **pen** + #id · Save | desktop **modal shrunk** ❌ |
| New task | **full-screen route** `✕ New task` … primary **Create task** | desktop modal shrunk ❌ |
| Nav | **drawer / ⋯ overflow** menu | icon row + overflow of action buttons ❌ |
| Filters / assignee / day-detail | **bottom sheets** | inline desktop controls ❌ |
| Trash / Approvals | compact **`.crow`** lists | desktop dialog ❌ |
- **Conclusion:** the phone design is fully specified but unbuilt; the live app is a responsive desktop, not the designed mobile app. (Also note a design-internal copy nit: mobile Task-detail assignee says "+ Add person…" while New task says "+ Add person or group…" — see DECISIONS-NEEDED candidate.)

### L3 ⏳ Per-screen responsive audit deferred
- Board / Weekly / Monthly / dialogs / Task popup at 390 + 834 vs the `mobile/`+`Responsive.html` artboards (compact `.crow`, kanban cards w/ subtask progress, agenda Weekly, Monthly day-sheet, bottom sheets) — queued for the continued pass.

---

## M. HELP & FAQ CENTER (desktop 1440, light)

### M-OK ✅ Largely built to design
- Header icon (help-circle) ✅; autofocus search; **collapsible counted sections** collapsed by default (Getting around 4 · Everyday tasks 4 · Your account 4 · For admins 9 · Common questions 5); **flat search results** ✅; footer "Show welcome again" / "Contact us".

### M1 🔴 Admin articles still show a grey "ADMIN" chip — [per D17]
- **Live:** searching "admin" returns Manage projects / Team & permissions / Approvals / Automatic calendar holidays each with a grey **`ADMIN`** chip.
- **Design/D17:** the grey "Admin" chip was **removed** — admin articles live under "For admins" and state "admins only" in the body; no chip.
- Evidence: `LIVE__help_search_admin__1440__light.png`.

### M2 🔴 No "What's New" block — [per D15/D17]
- **Design:** a **What's-New** block renders **above** the sections (unseen dated features w/ a purple "New" pill); a purple What's-New dot rides the user pill + Help row.
- **Live:** no What's-New block, no dot. (Consistent with A2.)

### M3 🔴 🙏 emoji on "Show welcome again" footer link
- Convert to line-art (emoji rule). "✉ Contact us" envelope is fine.

### M4 🟡 "Your account" section count = 4 (design D17 says 3)
- Content count delta; confirm intended article set.

---

## N. PLATFORM / MULTI-TENANCY (desktop 1440, light)

### N1 🔴 "Platform overview" dialog has NO leading header icon
- Unlike Approvals/Team/Projects/Settings/Trash, this dialog's header is just "Platform overview" + ✕ — **missing the line-art header icon**. Likely one of the "missing header icon" cases. Add a consistent header icon.

### N2 🔴 Members table column is "Tier" — should be "View Access" — [rename]
- Live column header **"Tier"** with values "Full Project" / "Sub-Project Only". The Tiers→**"View Access"** rename (see `view-access-model`) wasn't applied here. Same root issue as Team's "Admins ignore tiers" copy (F2a). Rename column to "View Access" (or "Access").
- Org card content (Ananda Los Angeles · 2 projects · 4 sub-projects · 8 tasks · 3 members · Admins) renders fine; "Metadata only — task contents stay private" note present. ✅
- Evidence: `LIVE__platform__1440__light.png`.

### N3 ✅ Superuser Platform overview lists ALL orgs (multi-org confirmed)
- After creating 2 more orgs via signup, the Platform popup now shows **3 org cards**: Ananda Los Angeles (populated: 2 projects · 4 sub-projects · 8 tasks · 3 members) + **Audit Test Org (pending verification)** + **Maple Grove Sangha (pending verification)** (0/0/0 · 1 member each). Unverified orgs get a **"(pending verification)"** tag. ✅ multi-org rendering + populated metadata both verified.
- 🔴 "Tier" column appears in every org's member table (N2 applies throughout).
- 🧹 **Cleanup needed:** two throwaway orgs now exist in prod — **"Audit Test Org"** (audittest@ananda.test) and **"Maple Grove Sangha"** (anandaaudit2026@yopmail.com) — both unverified. No org-delete UI was found; remove them server-side.
- Evidence: `LIVE__platform_multiorg__1440__light.png`.

### N4 ⏳ Org switcher / invite-accept still blocked
- A single account in **two** orgs (→ the org switcher) still couldn't be created because invite-accept needs email delivery (P5, broken on deploy). Re-test once email works or by seeding a cross-org membership.

---

## O. SUBTASKS POPULATED — rows + detail panel (desktop 1440, light) [D11/D12]

### O1 🟠 Subtask row missing priority + avatar column; status is native select; header lacks progress — [per D11]
- **Live row:** title · native "To Do ▾" select · red ✕. Header just "SUBTASKS (1)".
- **Design/D11:** row = priority icon · title · **aligned avatar column** (◇ for groups) · **status custom pill+popover** · ✕; header carries **status-count dots + a done/total progress bar** (To-Do share = empty track).
- Gaps: no priority icon, no avatar column, status is native `<select>` (D2), no progress bar / status-count dots.
- Evidence: `LIVE__subtask_populated__1440__light.png`.

### O2 ✅/🔴 Subtask detail swaps in place — but many D12 gaps
- ✅ Clicking a row **swaps the modal body** to the detail panel (not a stacked modal).
- 🔴 **Breadcrumb wrong:** live "← Subtasks › Audit test subtask"; design "← Back · {Parent} **#142** › {Sub-task} **#142.2**" (parent name + ids; subtask id = **parent.index**).
- 🔴 **Header not replaced:** live keeps "Edit task · #8" above the breadcrumb; design = breadcrumb **replaces** the title.
- 🔴 **No Share button** (design: breadcrumb + Share + ✕).
- 🔴 **Field label "Task name"** — design = **"Sub-task name"**.
- 🔴 **No Links field** — design mirrors the Task Popup exactly, **including the Links list**.
- 🔴 **Footer:** live has "← Back to subtasks" (left) + Delete + Save, Delete on the **right**; design = **Delete left in red · Save**, and **no "Back to subtasks" button** (breadcrumb Back covers it).
- 🟠 Status/Priority native `<select>` (D2). Assignees "None assigned · Edit" (E3).
- ⏳ Time-validation error (D13 both-or-neither) not yet triggered — queued.
- Evidence: `LIVE__subtask_detail__1440__light.png`.

---

## P. AUTH MODULE (logged out, desktop 1440, light) — vs `auth/` design

### P1 🟠 Brand mark on auth screens is a plain navy dot, not the lotus
- **Live (login, signup, verify):** the title is preceded by a small **filled navy circle/dot** (`●`) as the "logo".
- **Design (`auth/`):** the navy **lotus mark** (`assets/ananda-mark.png`) on the Temple-of-Light card.
- **Fix:** use the lotus mark on all auth screens.
- Evidence: `LIVE__login__1440__light.png`, `LIVE__signup__1440__light.png`.

### P2 — Login screen
- Fields: Email, Password, "Sign in" (primary, full-width), "Forgot password?", "New to Ananda Taskboard? Create an account". Layout matches the design's centered card on the soft canvas. (Compare radii to DN1 — auth card `--r-card:14px` in design.)
- ⏳ Compare exact spacing/typography to `auth/auth-source.html` render (see §Q cross-file).

### P3 — Signup ("Create your account")
- Fields: Organization name · City · Country · Your name · Email · Password · Create account · Back to sign in. Reasonable match to the design's signup.
- 🟠 Same dot-not-lotus mark (P1).

### P4 🔴/ℹ️ Signup requires email verification → blocks new-org + org-switch test on deployed
- After Create account → **"Check your email — we've sent a verification link to audittest@ananda.test. Click it to activate your account and team."** The account/org is inactive until the link is clicked.
- On the **deployed** build emails go via real SMTP (Resend); I can't read the inbox, so I **could not activate the 2nd org** → **org switching / multi-org / invite-accept remain untested on the deploy** (only one seeded org, no pending cross-org invite). Recommend re-testing on local (`backend/e2e_emails/` captures emails) or seeding a 2nd-org membership directly.
- Evidence: `LIVE__neworg_freshlogin__1440__light.png`.

### P6 — Forgot password ("Reset your password")
- Screen: email field + "Send reset link" + "← Back to sign in". Copy: "Enter your account email and we'll send you a link to set a new password." Matches the design's reset-request card.
- 🟠 Same dot-not-lotus mark (P1). The actual **reset form** (set new password) needs the emailed link → blocked by P5 (email not delivering).
- Evidence: `LIVE__forgotpw__1440__light.png`.

### P5 🔴 Email delivery appears broken on the deployed build (signup verification never arrives)
- Created a 2nd org with a **readable** `@yopmail.com` inbox; after **~70s** the verification email **never arrived**. Strongly suggests **email sending is not configured/working on the Render deploy** (no Resend/SMTP key, or failing silently).
- **Impact:** signup can't be completed (no activation), and by extension **invitations** and **password reset** likely don't deliver on the deploy. (Corroborates the `password-reset-followup` note that reset shipped to prod un-verified.)
- **Fix:** set/verify the email provider env (Resend API key / SMTP) on Render and confirm delivery; add a delivery smoke test (Phase-12 deploy verification).
- This blocks org-switching / multi-org / invite-accept testing via signup on the deploy.

---

## Q. CROSS-FILE STATIC DIFF — design references vs each other (tokens + components)
> From reading each module's CSS/tokens (`Ananda Taskboard.html` inline · `ananda-help.css` · `ananda-mobile.css` · `ananda-mt.css` · `ananda-auth.css`). This is design-file-vs-design-file consistency (the original brief's "shared component identical everywhere" check).

### Q-OK ✅ Color tokens match across all files
- Light + dark palettes (bg/canvas/surface/sunk/border/text/muted/primary/dome/azure/gold/wood/danger/warn + status colors **incl. Review `#7a5aa6` / dark `#b08cd6`**) are **identical** across app, help, mobile, mt (where defined). [D1 colors consistent]
- `.proj-pill` definition is consistent across module CSS (padding `2px 9px`, radius pill, `11.5px/600`, `--pc` tint). Status colors/order consistent.

### Q1 ❓ Radii disagree (→ DN1)
- `--r-card`/`--r-ctl`: app/help/mt = **11/8**; mobile = **13/10**; auth = **14/10**.

### Q2 ❓ Weekly `.wk-bar .mini` badge radius (→ DN2)
- app `99px` (pill) vs help `4px`.

### Q3 🟡 `--review` token absent in mt + auth CSS
- `multitenancy/ananda-mt.css` and `auth/ananda-auth.css` don't define `--review` (nor several status/calendar tokens). Harmless **today** (those modules show no status pills), but if a status pill ever renders there it'd break. Add the full status token set for safety. [D1]

### Q4 🟡 `--new` (What's-New purple) only in help CSS
- `--new:#6d4aff` (light) / `#9a82ff` (dark) defined in `ananda-help.css` only; the canonical app + other modules don't define it. Expected (D15 What's-New is a help-module feature not yet propagated) — propagate when D15 lands app-wide. [D15]

### Q5 🟡 `--shadow-card` inconsistency
- Defined in help/mt/auth CSS, not in mobile or the canonical app. Minor; standardize if cards reuse it cross-module.

### Q6 🟠 Button metrics differ: canonical app vs module `.btn`
- Module `.btn` (help/mt/auth/mobile): padding `8px 13px`, `13px/600`, radius `--r-ctl`.
- Canonical app: `.btn-primary` = `6px 11px`, `13px/600`; `.btn-secondary`/`.icon-btn` = `6px 9px`, **`14px/500`**. So app buttons are smaller-padded and the secondary weight/size differ from the module spec. Pick one button spec and apply everywhere (the module `.btn` is the more consistent set). [relates D5]

---

## R. i18n / LOCALIZATION (live, Español spot-check)

### R-OK ✅ 13 locales present; most chrome translates
- Language picker lists all **13** locales (en, it, es, fr, de, pt, zh, hi, bn, ta, te, mr, gu). Switching to Español translated: header nav (Plataforma · Aprobaciones · Equipo · Papelera · Proyectos · Nueva tarea), account menu (Configuración · Historial · Puntos de restauración · Migración masiva · Activar notificaciones · Recordatorio diario · Idioma · Tema · Cerrar sesión), view tabs (Lista · Tablero · Semana · Mes), filters, and table headers (TAREA · PROYECTO · SUBPROYECTO · ASIGNADOS · ESTADO · FECHA…). ✅

### R1 🔴 Untranslated strings (i18n gaps) in Español
- **"Help"** top-bar button stays English (should be "Ayuda").
- **Summary strip** stays English: "8 **TASKS** · 5 **OVERDUE** · 0 **DUE SOON** · 8 **TO DO** · 0 **IN PROGRESS** · 0 **DELAYED** · 0 **REVIEW** · 0 **DONE**".
- **Status pill labels** ("To Do" etc.) not translated in the list rows.
- **Fix:** add these keys to all 13 locale catalogs (note the `test_i18n_catalogs.py` parity requirement). Re-audit each locale per Rule #13.
- Evidence: `LIVE__i18n_es__1440__light.png`.

<!-- APPEND BELOW AS THE SWEEP CONTINUES -->
