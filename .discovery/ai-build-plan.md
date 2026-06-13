---
feature: ai-task-generation
project: ananda-taskboard
status: awaiting-approval
last-updated: 2026-06-12
complexity: large
---

# AI Task Generation — Build Plan (Phase 2)

Built from the completed brainstorm (`ai-task-generation-brainstorm.md`). No code
until Gordon approves (Phase 4).

## Decisions locked
- All members · Claude **Haiku** · **20 generations/user/day** · doc upload allowed
  with in-UI notice · PDF + text + Word + **images**.
- Source files **attach to the generated tasks** (images compressed); AI suggests
  which file backs which task.
- Review popup **reuses the existing task layout EXACTLY**: Priority · Task Name ·
  Project · Sub-Project · Assignee · Status (same components, no new format).
- Entry: "✨ Generate with AI" button by the board add-task control.
- Spinner → full list (no streaming). AI does NOT auto-assign people (Assignee blank,
  user sets). New projects only proposed (reuse inline-create), never auto-made.

## Backend (new Django app `ai/`)
1. **Deps:** `anthropic` (SDK), `pypdf` (PDF text), `python-docx` (Word). txt = read.
   Images → base64 to Haiku vision input. `Pillow` only if server-side recompress
   needed (prefer client compression; keep server as size guard).
2. **Model `AiGeneration`** (per-org, per-user, timestamp) — powers the 20/day cap
   (count today's rows) + Activity-tab audit. No raw doc text stored.
3. **`POST /api/ai/generate`** (multipart: `prompt` + files[]):
   - Permission: any active member (IsAuthenticated + org).
   - Rate-guard: 403 + message if user already has 20 today.
   - Extract text per file; images kept as blocks. Build prompt with the org's
     project/sub-project list (id+name) so the model assigns to existing ones.
   - Call Haiku with a STRUCTURED tool/JSON schema → list of proposed tasks:
     `{title, priority, project_id, subproject_id, new_project?, source_file_index}`.
   - Upload files to R2 once (existing attachments pipeline), return file refs +
     proposed tasks + file→task mapping. Cap 25 tasks; note if truncated.
   - Log one `AiGeneration` row.
4. **Save = existing task-create path** (no new endpoint): frontend POSTs each
   confirmed task to `/api/tasks` then links the pre-uploaded R2 attachment(s) to it
   via the existing attachment-link endpoint. Member tasks follow normal approval.
5. **Security (Phase 9):** `ANTHROPIC_API_KEY` server-only env (never client); file
   size/type/count limits; strip/ignore non-allowed mime; per-user rate cap; the
   in-UI privacy notice; no persistence of raw extracted text beyond the attachment.

## Frontend
1. **`AiGenerateButton`** by the board add-task control → opens `AiGenerateModal`.
2. **`AiGenerateModal`**: textarea (prompt) + file dropzone (PDF/txt/docx/images),
   client-side image compress (~1600px, JPEG ~0.8), privacy notice line, "X/20 today"
   counter, Generate button → spinner.
3. **Review step (same modal)**: list of proposed tasks rendered with the EXISTING
   task-row components — Priority · Task Name · Project · Sub-Project · Assignee ·
   Status — each row editable, with its AI-suggested attachment shown + removable, a
   drop-row control, and inline-create for a proposed new project (reuse what shipped).
   Save → creates tasks + links attachments.
4. **Post-save**: modal stays open listing created tasks, each opening the normal
   TaskModal for further edits (per Gordon's "don't scatter them" requirement).
5. **States:** empty, loading, provider error/timeout, partial failure (one task
   fails to save — show which), oversized/unsupported file, cap reached.
6. i18n: all new strings ×13 locales (parity test).

## Build order
1. Backend `ai/` app + `AiGeneration` model + migration + rate-guard (TDD).
2. `/api/ai/generate` text-only (PDF/txt/docx) + structured output + tests.
3. Add image (vision) path + client compression + R2 attach-on-save.
4. Frontend modal (prompt + upload + generate) → review (reuse task row) → save.
5. Post-save edit list; states; i18n; audit to Activity tab.
6. Phases 6–13: tests, Fallow/lint/types, a11y, security review, live verify, deploy.

## Open / Gordon-action
- 🟡 Confirm `ANTHROPIC_API_KEY` set on Render (backend env). Needed to ship.
- 🟡 Spend: Haiku ~ fractions of a cent/generation; 20/user/day caps it. OK?
- **Assignees: IN v1** (Gordon 2026-06-12). Model gets the org member roster (id+name)
  and suggests assignees per task; pre-filled in the review row's existing Assignee
  field, user edits. AI suggestion only — never silently final.

## APPROVED 2026-06-12 (Gordon "Yes"). Building in 5 slices.

### STATUS 2026-06-12
- **Slice 1 DONE + deployed:** ai/ app + AiGeneration model + daily rate guard + 4 tests.
- **Slice 2 DONE + deployed:** POST /api/ai/generate (text extract + image vision +
  Haiku structured output + strict org-id validation + cap + 503 gate + audit), 11 tests.
  **LIVE-VERIFIED:** route up, returns 503 → so `ANTHROPIC_API_KEY` is NOT set on Render yet.
- **Slice 3 (prep) DONE:** `api.postForm` multipart helper shipped.
- **🟡 BLOCKER:** Gordon must set `ANTHROPIC_API_KEY` on Render (backend env). Until then
  the endpoint 503s and the feature can't be end-to-end verified. I have RENDER_API_KEY
  to set it but NOT the Anthropic key value — Gordon supplies it.

### Frontend slice (NEXT — spec, build once key is set so it verifies live)
Reuse, in this EXACT field order (memory feedback-reuse-existing-ui-patterns):
**Priority · Task Name · Project · Sub-Project · Assignee · Status.**
- **Helpers ready:** `attachments.ts` → `compressImageToBlob(file, maxBytes)` +
  `uploadAttachment("task", taskId, file)` (presign→PUT→confirm, compresses images).
  `api.postForm`. `writableProjects(me)` for the cascading pickers. `useUsers`,
  `useAdminGroups`, `useStatuses`.
- **`ai.ts`:** `generateTasks(prompt, files)` → compress image files via
  compressImageToBlob (~1.5 MB), build FormData (prompt + files[]), `api.postForm`.
- **`AiGenerateModal.tsx`:**
  1. Input step: prompt textarea + dropzone (accept PDF/txt/docx/images), privacy
     notice line, "X/20 today" counter (from /api/me or the generate response), Generate.
  2. Loading: single spinner.
  3. Review step: one row per proposed task using the SAME components — PriorityIcon+
     SingleSelect, title input, project SingleSelect (writableProjects + inline "+ New"
     reuse), sub SingleSelect, AssigneePicker (users/groups, subproject-scoped),
     StatusPillSelect. Per-row: show AI-suggested attachment (source_file_index) +
     remove; drop-row; new_project → reuse inline-create. Save button.
  4. Save: for each row → api.post("/api/tasks", payload); if source_file_index!=null →
     uploadAttachment("task", newId, files[idx]). Collect created.
  5. Post-save: keep modal open listing created tasks; each opens the normal TaskModal
     (don't scatter). Reuses onChanged to refresh the board.
- **Entry:** "✨ Generate with AI" button by the board add-task control.
- **States:** empty (no prompt/file) · loading · 503 "not configured" · 429 cap reached
  (show remaining) · per-row save failure (mark which) · oversized/unsupported file.
- **i18n:** all new strings ×13 locales (parity test).
- Then Phases 6–13 incl. **/security-review** (key handling, file limits, member
  can't assign past their access — save path enforces) + live verify with the key set.

## Complexity: LARGE (multi-day). Recommend shipping in the 5 build-order slices,
## each its own PR + deploy, not one mega-drop.
