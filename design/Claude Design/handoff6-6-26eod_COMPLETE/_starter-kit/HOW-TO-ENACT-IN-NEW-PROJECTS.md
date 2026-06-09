# How to enact these rules in a NEW Claude project

You have two routes. Use both for best results.

## Route A — Drop-in starter kit (works in any project, now)
1. In the new project, create a file named **`CLAUDE.md`** at the root and paste in
   `CLAUDE.md.template` from this folder, filling the `<PLACEHOLDERS>` for that product.
   → From then on, every conversation in that project automatically follows RULE #0 / #1 /
   etc. (a root `CLAUDE.md` is read at the start of each conversation).
2. Add an empty **`DESIGN-DECISIONS-LOG.md`** (copy the template here). Tell me to log to it.
3. Optional: add a `design_handoff_COMPLETE/MASTER-HANDOFF.md` once you have modules to hand off.

That's the whole mechanism — the rules live in the repo, not in your memory or mine.

## Route B — Save THIS project as a template (best for same product family)
Ask me to **save this project as a template**. That creates a reusable starting point that
already contains `CLAUDE.md`, `DESIGN-DECISIONS-LOG.md`, the module structure, and the
handoff scaffolding — so any project you start from it inherits the rules with nothing to
copy. New work begins already governed by RULE #0 and RULE #1.

## Keeping it working
- **Reference the rules out loud** when you kick off ("follow RULE #0; log to the decisions
  log") for the first few sessions — it reinforces the habit until it's automatic.
- **One log per project.** When a decision is cross-cutting, I record which older surfaces are
  now stale; on the next touch of those surfaces, they get brought current.
- **Hand off from the log, not from chat.** The `MASTER-HANDOFF.md` + `DESIGN-DECISIONS-LOG.md`
  are what a developer (or Claude Code) should implement from — never a screenshot or memory.
