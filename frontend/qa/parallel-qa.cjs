// Parallel headless-QA fan-out runner.
//
// Why: the Playwright MCP browser serializes (one browser per session). To QA many
// flows AT ONCE, fan out node+playwright workers — each its own chromium process,
// no shared lock. RAM is the limit (~150–300 MB/browser), so concurrency is CAPPED.
//
// Gordon's ceilings (2026-06-13): DEFAULT 5 concurrent, ABSOLUTE MAX 20 — never
// exceed 20 without his explicit OK. This runner clamps to [1, 20] no matter what.
//
// Usage:
//   const { runParallel, withPage, BASE, login } = require("./parallel-qa.cjs");
//   const tests = [
//     { name: "drag",   run: (pg) => withPage(pg, async () => { ... return PASS }) },
//     { name: "centering", run: ... },
//   ];
//   runParallel(tests, { concurrency: 5 }).then(printResults);
//
// Run:  node frontend/qa/parallel-qa.cjs            (runs the built-in smoke set)
//       QA_CONCURRENCY=8 node frontend/qa/parallel-qa.cjs
//       QA_RECORD=1 node frontend/qa/parallel-qa.cjs   (record a .webm per task)
//
// Video QA (universal rule, Gordon 2026-07-07): QA_RECORD=1 records each task's
// session to qa/videos/<task>/ — then Claude watches the recording via the /watch
// skill (balanced mode) to catch motion bugs screenshots can't: jank, flicker,
// mid-transition layout shift. See C:\AI\deep-dives\qa-testing-playbook.md §8.

const { chromium } = require("playwright");
const path = require("path");

const BASE = process.env.QA_BASE || "https://ananda-taskboard.onrender.com";
const HARD_MAX = 20;          // Gordon's absolute ceiling — do not raise in code.
const DEFAULT_CONCURRENCY = 5;

/** Clamp concurrency to [1, HARD_MAX]; default 5. */
function clampConcurrency(n) {
  const v = Number.isFinite(n) ? Math.floor(n) : DEFAULT_CONCURRENCY;
  return Math.max(1, Math.min(HARD_MAX, v));
}

/** Log in to the live app on a fresh page (demo admin). Dismisses the welcome modal. */
async function login(page, { email = "admin@ananda.test", password = "taskboard123" } = {}) {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.fill("input[type=email]", email);
  await page.fill("input[type=password]", password);
  await page.click(".login-card button.btn-primary");
  await page.waitForSelector("[data-testid=ai-generate], [data-testid=new-task]", { timeout: 25000 });
  for (let i = 0; i < 3; i++) {
    if (!(await page.$(".modal-backdrop"))) break;
    await page.keyboard.press("Escape");
    await page.waitForSelector(".modal-backdrop", { state: "detached", timeout: 2000 }).catch(() => {});
  }
}

/**
 * Run `tasks` (each {name, run(browser)->boolean|{pass,detail}}) with a bounded
 * pool. Each task gets its OWN browser; at most `concurrency` run at once.
 * `recordVideo: true` (or env QA_RECORD=1) records every page of every task to
 * `qa/videos/<task-name>/*.webm` (context-level; tasks are unchanged — the shim
 * only intercepts newPage). Returns [{name, pass, detail, error, videoDir?}].
 */
async function runParallel(tasks, { concurrency = DEFAULT_CONCURRENCY, recordVideo = process.env.QA_RECORD === "1" } = {}) {
  const limit = clampConcurrency(concurrency);
  const results = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= tasks.length) return;
      const t = tasks[i];
      const browser = await chromium.launch();
      let ctx = null;
      let videoDir;
      let handle = browser;
      try {
        if (recordVideo) {
          videoDir = path.join(__dirname, "videos", t.name.replace(/[^a-z0-9-]+/gi, "-").toLowerCase());
          ctx = await browser.newContext({ recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } } });
          handle = { newPage: () => ctx.newPage() }; // tasks only ever call newPage
        }
        const r = await t.run(handle);
        const pass = typeof r === "object" ? !!r.pass : !!r;
        results[i] = { name: t.name, pass, detail: typeof r === "object" ? r.detail : undefined, videoDir };
      } catch (e) {
        results[i] = { name: t.name, pass: false, error: e.message, videoDir };
      } finally {
        if (ctx) await ctx.close().catch(() => {}); // flushes the .webm to disk
        await browser.close().catch(() => {});
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

function printResults(results) {
  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? "  — " + r.detail : ""}${r.error ? "  ERROR: " + r.error : ""}${r.videoDir ? "  🎥 " + r.videoDir : ""}`);
  }
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} passed.`);
  if (failed) process.exitCode = 1;
}

module.exports = { runParallel, printResults, login, clampConcurrency, BASE, HARD_MAX, DEFAULT_CONCURRENCY };

// Built-in smoke set when run directly.
if (require.main === module) {
  const smoke = [
    { name: "login + board loads", run: async (b) => {
      const pg = await b.newPage(); await login(pg);
      return { pass: !!(await pg.$("[data-testid=ai-generate], [data-testid=new-task]")), detail: "authenticated" };
    } },
    { name: "modals centered (align-items:center)", run: async (b) => {
      const pg = await b.newPage(); await login(pg);
      await pg.click("[data-testid=new-task]"); await pg.waitForSelector(".modal-backdrop", { timeout: 10000 });
      const align = await pg.$eval(".modal-backdrop", (el) => getComputedStyle(el).alignItems);
      return { pass: align === "center", detail: "align=" + align };
    } },
    { name: "AI generator opens", run: async (b) => {
      const pg = await b.newPage(); await login(pg);
      await pg.click("[data-testid=ai-generate]");
      return { pass: !!(await pg.waitForSelector(".ai-input textarea", { timeout: 10000 }).catch(() => null)), detail: "modal open" };
    } },
  ];
  const concurrency = clampConcurrency(Number(process.env.QA_CONCURRENCY) || DEFAULT_CONCURRENCY);
  console.log(`Running ${smoke.length} QA tasks, concurrency ${concurrency} (default ${DEFAULT_CONCURRENCY}, max ${HARD_MAX})...\n`);
  runParallel(smoke, { concurrency }).then(printResults);
}
