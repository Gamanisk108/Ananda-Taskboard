---
feature: ai-task-generation
project: ananda-taskboard
status: round-1-complete
current-round: 2
total-rounds: 2
last-updated: 2026-06-12
---

# AI task generation — brainstorm

**Gordon's spec (verbatim, 2026-06-12):** "build an AI feature that allows users
to type into a chat box and upload documents and generate new To-Do tasks,
assigned to the proper project or (in very rare and extreme cases) generate a new
random project. Confirmation popup allows the user to adjust Task names and
assigned Project/sub-project. After confirming, they should save, and then the
user is invited to edit any of them further from that popup before closing it
(so they don't get scattered and hard to track down again)."

This is a LARGE build (new backend LLM integration + doc parsing + a review/edit
flow). It is **gated** on the Round-1 answers below before any code. Marked large
in the global /goal workflow → brainstorm first.

## Shape (as understood)
1. Entry point: a "Generate tasks with AI" surface — chat box + file upload.
2. Backend sends prompt + extracted document text to an LLM (Claude API), which
   returns a structured list of proposed tasks, each with a suggested
   project/sub-project (matched to existing ones; new project only in rare cases).
3. A **review popup**: user edits task names + reassigns project/sub-project per
   row, drops any they don't want, then Saves (creates real tasks).
4. After save, the same popup stays open showing the created tasks so the user can
   keep editing them in place (not scattered across the board).

## ROUND 1 — strategic foundation (need Gordon's answers)

1. **Who can use it?** Admins only, or all members? (Members creating tasks hit the
   approval flow — AI-generated member tasks would land in Pending Approval unless
   the sub-project is "trusted". Default suggestion: **all members**, respecting the
   existing approval rules.)

2. **Cost / model.** This calls the Claude API per generation (real $ per call).
   OK to use **Claude (Anthropic API)** with our key, and is there a per-user or
   per-day cap you want (e.g. N generations/day) to bound spend? (Default: Claude
   Haiku for cost, cap 20 generations/user/day.)

3. **Documents — privacy.** Uploaded docs get sent to the LLM (external service).
   For a spiritual community that may include sensitive material — is that
   acceptable with a clear in-UI notice, or should doc upload be **admin-only** /
   off by default? (Default: allowed, with a one-line "your text is sent to our AI
   provider to generate tasks" notice + no storage of the raw doc.)

4. **Document formats.** Which to support at launch? PDF + plain text + .docx is the
   common set; images (photos of a whiteboard/flyer) would need multimodal Claude.
   (Default: PDF + txt + docx at launch; images as a fast-follow.)

5. **Assignment intelligence.** How smart should project/sub-project matching be?
   (a) simple — LLM picks from the list of existing projects by name; (b) smarter —
   embeddings/semantic match. (Default: (a) — give the LLM the project/sub-project
   list and let it choose; cheap and good enough, user corrects in the review popup.)

6. **New-project creation.** You said "rare and extreme cases." Should the AI ever
   auto-create a project, or only ever **propose** one in the review popup that the
   user must confirm? (Default: never auto-create — propose as a row the user
   approves, reusing the inline-create flow we just built.)

7. **Scope of a generation.** Cap on tasks per run (to avoid a 200-task dump)?
   (Default: max 25 proposed tasks per generation, with a note if truncated.)

## ROUND 1 — ANSWERS (Gordon, 2026-06-12)
1. **Access:** ALL members (AI tasks follow existing approval rules).
2. **Model / cap:** Claude **Haiku**, **20 generations/user/day**.
3. **Doc privacy:** Allowed for all, with an in-UI notice; raw file not stored
   beyond what's attached (see #4).
4. **Formats:** PDF + text + Word + **images**. **NEW REQUIREMENT:** the uploaded
   source files attach to the relevant generated task(s) — **images compressed**
   before storage — via Taskboard's existing Attachments + R2 pipeline.
5. *(default)* Assignment: LLM picks from the existing project/sub-project list.
6. *(default)* New projects: only proposed in the review popup; never auto-created.
7. *(default)* Cap: 25 proposed tasks per generation.

### Implications of the file-attachment requirement
- Reuse the existing `Attachments` component + R2 storage (already live).
- **Mapping:** which uploaded file attaches to which generated task? The LLM maps
  document→tasks; default = attach each source file to every task it produced, and
  let the user re-assign/remove attachments in the review popup (Round 2 Q).
- **Image compression:** client-side downscale/compress before upload (e.g. canvas
  to ~1600px / JPEG ~0.8) to bound R2 size + cost. Confirm target in Round 2.
- Multimodal: images go to Haiku's vision input for task extraction AND are stored
  as attachments — two uses of the same upload.

## ROUND 2 — UX + technical specifics (pending)
1. **Entry point:** a floating "✨ Generate with AI" button on the board? an item in
   the "+ New task" menu? both? (Lean: a button near the board's add-task control.)
2. **Review popup layout:** table (dense, many tasks) vs cards (roomier, per-task
   attachments + project picker). Lean: cards — they fit the attachment + reassign
   controls better.
3. **File→task attachment mapping:** attach every source file to every generated
   task by default, user prunes? Or AI suggests which file backs which task?
4. **Image compression target** (max dimension / quality) + max upload size + count.
5. **Generation UX:** stream tasks in as they're parsed, or one spinner→full list?
6. **Partial save / edit-after-save:** confirmed flow — save creates real tasks, popup
   stays open listing them with inline edit + a link to each; reuses TaskModal?
7. **Audit + rate-limit UX:** log AI creations to the Activity tab; what the user sees
   when they hit the 20/day cap.
8. **States:** empty (no input), loading, partial error (one task fails), provider
   error/timeout, oversized/unsupported file.

## Notes
- Reuses the just-shipped **inline create Project/Sub-project** flow for the
  "propose new project" path.
- Anthropic API key handling + spend caps must pass the global Phase 9 security
  review before launch.
