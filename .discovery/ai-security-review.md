# AI task generation — security review (Phase 9)

Manual pass over the `ai/` app + `AiGenerateModal`, 2026-06-13. (The `/security-review`
slash command's git preprocessing errored on `origin/HEAD`; this is the equivalent
manual review.)

## Verdict: no critical/high issues. Findings below are notes + accepted risks.

### Secrets
- `ANTHROPIC_API_KEY` is server-only (`settings`, read in `generator._client()`),
  never serialized into any API response or sent to the client. ✓
- Feature is inert (503) when the key is unset — no half-configured failure mode. ✓

### AuthZ / tenancy
- Endpoint: `IsAuthenticated` + active org required (503/400 otherwise). ✓
- Projects/sub-projects offered to the model are scoped to the caller: admins → their
  org; members → their **visible** tree only (`visible_project_ids/subproject_ids`). No
  cross-org leakage (org isolation gate upstream). ✓
- Assignee suggestions come from the org's active members — data the member can
  already see via `/api/users`. No new disclosure. ✓
- **Save path is the real gate:** tasks are created via the normal `/api/tasks`, which
  enforces `can_act_as_member` on the sub-project. Even if the model proposes a sub the
  member can't post to, the save 403s. The generate step proposes; it never writes. ✓

### Input handling / injection
- Output is structured (forced `emit_tasks` tool) and **validated against real org ids**
  — hallucinated project/sub/member ids are dropped, priority clamped 1–5, sub implies
  project, title capped 200, new_project capped 100, source_file_index range-checked,
  assignee_ids type-guarded (CodeRabbit hardening). ✓
- Prompt/document text is untrusted → treated as data to the LLM; worst case the model
  proposes odd titles, which the user reviews before any task is created. No code/SQL/
  template execution path. ✓

### Files
- Caps enforced server-side: ≤ `AI_MAX_FILES` (8), each ≤ `AI_MAX_FILE_MB` (10 MB),
  type must be supported (PDF/Word/txt/md/image) else 400. ✓
- Extraction is in-memory, wrapped in try/except → "" on a malformed file (no crash). ✓
- Images client-compressed (~1.5 MB) before upload; stored only if the user keeps the
  attach toggle, via the existing presign→PUT→confirm R2 flow (perm-checked). ✓
- **Accepted risk:** worst-case in-memory per request ≈ 8 × 10 MB = 80 MB during read.
  Bounded by the caps; fine for this scale. Lower `AI_MAX_FILE_MB`/`AI_MAX_FILES` if
  memory pressure ever shows.

### Cost / abuse / rate limiting
- **TOCTOU race fixed** (CodeRabbit major): slot is reserved atomically under a
  per-user row lock (`reserve_generation` → `select_for_update` + re-check + insert),
  so concurrent requests can't both pass the cap. Refunded on any failure. ✓
- Per-user/day cap = 20 (`DAILY_LIMIT`). Haiku ≈ fractions of a cent/call → ≤ ~cents/
  user/day worst case. ✓
- **Note (future, not blocking):** no ORG-level daily cap — N members each get 20, so a
  large org's aggregate spend scales with headcount. Add an org cap if spend grows.

### Privacy (community-sensitive)
- In-UI notice tells users their text/files go to the AI provider. ✓
- No raw prompt/document text persisted server-side (only `AiGeneration` counts +
  whatever file the user explicitly attaches). ✓

## Recommended (non-blocking) follow-ups
1. Org-level daily generation cap (aggregate spend ceiling).
2. Consider lowering `AI_MAX_FILE_MB` if image-heavy use stresses memory.
3. Surface AI creations in the Activity tab UI (already `audit()`-logged server-side).
