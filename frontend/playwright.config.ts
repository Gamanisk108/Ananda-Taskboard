import { defineConfig, devices } from "@playwright/test";

/**
 * Visual-regression config for Ananda Taskboard.
 *
 * Purpose: catch design-vs-build pixel drift automatically (the manual
 * 2026-06-07 fidelity audit found many regressions that a baseline would have
 * caught). Snapshots are committed; CI fails on any visual diff.
 *
 * Run against a deployed build or local preview:
 *   PW_BASE_URL=https://ananda-taskboard.onrender.com npm run test:visual
 *   (defaults to http://localhost:4173 — `npm run preview`)
 *
 * First-time / intentional design change: regenerate baselines with
 *   npm run test:visual:update
 *
 * NOTE: requires `npm i -D @playwright/test && npx playwright install` once.
 * These tests are isolated from vitest (which only runs the src test files) and
 * from `tsc -b` (tsconfig.app includes only `src`).
 */
const BASE_URL = process.env.PW_BASE_URL || "http://localhost:4173";

export default defineConfig({
  testDir: "./tests/visual",
  testMatch: "**/*.visual.ts",
  snapshotDir: "./tests/visual/__snapshots__",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  expect: {
    // small tolerance for AA/font rendering; tighten if flaky-free
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled" },
  },
  use: {
    baseURL: BASE_URL,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "tablet-834", use: { ...devices["Desktop Chrome"], viewport: { width: 834, height: 1112 } } },
    { name: "mobile-390", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
  ],
});
