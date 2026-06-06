# Ananda Taskboard — QA Run (YYYY-MM-DD)

**Method:** Live browser QA via Playwright MCP against Vite dev (:5173) + Django API (:8000).
**Scope:** <what this run covers — full sweep, or a specific feature/fix>.
**Accounts:** <email (role/tier), …> — pw `<pw>`.

Findings are tagged **[BUG]** (broken), **[UX]** (rough), **[POLISH]** (minor). Caveat:
expert heuristic critique + functional testing, not a real user's lived reaction.

---

<!-- If you fix findings in the same session, fill this in; otherwise delete it. -->
## ✅ Resolution — findings addressed (YYYY-MM-DD)

| # | Finding | Fix | Files |
|---|---------|-----|-------|
| 1 | … | … | … |

Verified by: <backend tests> + <frontend tests> + typecheck + build.

---

## Executive summary

**Overall:** <one-paragraph health read>.

### 🔴 Bugs to fix (highest value)
1. **<title>** — <repro + root cause + recommended fix>. (shot: `shots/NN-name.png`)

### 🟡 UX / polish
- <item> • <item>

### ✅ Verified working
<comma-separated list of what passed>

### ⚡ Performance / fluidity
<DOMContentLoaded, API timings, reload-sentinel result, scroll/overflow behavior>

### Note on test data
<what data this run generated, and whether to clean it back to seed>

---

## Test log

### 1. <Area>
- ✅ <observation>
- **[BUG]** <finding> (shot: `shots/NN-name.png`)
- **[UX]** <finding>
- **[POLISH]** <finding>

<!-- Repeat a numbered section per area. Apply the QA lenses from README.md:
     light+dark, full tier/permission matrix, edge cases & multi-click,
     guardrail-gap hunting, performance/fluidity. -->
