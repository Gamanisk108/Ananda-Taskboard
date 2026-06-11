import { test, expect, type Page } from "@playwright/test";
import { sweepPage } from "./sweeps";

/**
 * At-a-glance geometry sweeps over every key surface (QA playbook §2a).
 * No screenshots — objective alignment/clipping assertions that fail with a
 * precise list of offenders. Catches the defect class that snapshot-driven QA
 * is structurally blind to (e.g. the off-center login Sign-in label).
 */

const EMAIL = process.env.PW_EMAIL || "admin@ananda.test";
const PASSWORD = process.env.PW_PASSWORD || "taskboard123";

async function login(page: Page) {
  await page.goto("/");
  if (await page.locator('.usermenu-btn, [data-testid="nav-drawer-btn"]').count()) return;
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.locator('.usermenu-btn, [data-testid="nav-drawer-btn"]').first().waitFor({ timeout: 15000 });
  const gotIt = page.getByRole("button", { name: /got it/i });
  if (await gotIt.count()) await gotIt.click().catch(() => {});
}

// Settings opener that works in both shells (desktop pill / phone drawer).
async function openSettings(page: Page) {
  const pill = page.locator(".usermenu-btn");
  if (await pill.isVisible().catch(() => false)) {
    await pill.click();
    await page.locator('[data-testid="open-settings"]').click();
  } else {
    await page.locator('[data-testid="nav-drawer-btn"]').click();
    await page.locator('.dnav [data-testid="open-settings"]').click();
  }
}

async function expectClean(page: Page) {
  const flags = await sweepPage(page);
  expect(flags, flags.map((f) => `[${f.kind}] "${f.label}" — ${f.detail}`).join("\n")).toEqual([]);
}

test.describe("Geometry sweeps", () => {
  test("login page", async ({ page }) => {
    await page.goto("/");
    await page.locator('input[type="email"]').waitFor();
    await expectClean(page);
  });

  test("signup page", async ({ page }) => {
    await page.goto("/?signup");
    await page.locator("form").waitFor();
    await expectClean(page);
  });

  test("list view", async ({ page }) => {
    await page.goto("/");
    await login(page);
    await page.goto("/?project=global&view=list");
    await page.locator("thead").first().waitFor({ timeout: 10000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    await expectClean(page);
  });

  test("settings panes", async ({ page }) => {
    await login(page);
    await openSettings(page);
    await page.locator(".set-nav").waitFor({ timeout: 8000 });
    for (const pane of ["account", "notifications", "statuses", "calendar", "helpus"]) {
      const nav = page.locator(`[data-testid="settings-nav-${pane}"]`);
      if (!(await nav.count())) continue;
      await nav.click();
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
      await expectClean(page);
    }
  });

  test("improve translations", async ({ page }) => {
    await login(page);
    await openSettings(page);
    await page.locator('[data-testid="settings-nav-helpus"]').click();
    await page.locator(".hu-stack").getByRole("button", { name: /^translate$/i }).click();
    await page.locator(".tr-row, .tr-sk").first().waitFor({ timeout: 10000 });
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    await expectClean(page);
  });

  test("translation review", async ({ page, viewport }) => {
    test.skip(!viewport || viewport.width < 900, "topbar nav is desktop-scoped");
    await login(page);
    await page.locator('[data-testid="open-tr-review"]').click();
    await page.locator(".rv-bar").waitFor({ timeout: 8000 });
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    await expectClean(page);
  });

  test("report a problem", async ({ page }) => {
    await login(page);
    await openSettings(page);
    await page.locator('[data-testid="settings-nav-helpus"]').click();
    await page.getByRole("button", { name: /^report/i }).click();
    await page.locator(".an-seg").waitFor({ timeout: 8000 });
    await expectClean(page);
  });

  // "Spread the word" is hidden for MVP (D48) — sweep removed with the card.
});
