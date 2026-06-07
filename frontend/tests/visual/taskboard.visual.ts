import { test, expect, type Page } from "@playwright/test";

/**
 * Visual-regression baseline for the key Ananda Taskboard surfaces.
 *
 * Mirrors the surfaces from the 2026-06-07 fidelity audit so design drift is
 * caught automatically. Each test captures a full-page screenshot compared
 * against a committed baseline (per project/viewport).
 *
 * Auth: uses the seed/test account. Override via env for other environments:
 *   PW_EMAIL, PW_PASSWORD.
 */
const EMAIL = process.env.PW_EMAIL || "admin@ananda.test";
const PASSWORD = process.env.PW_PASSWORD || "taskboard123";

async function login(page: Page) {
  await page.goto("/");
  // already logged in? the board/list chrome will be present
  if (await page.locator(".usermenu-btn").count()) return;
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.locator(".usermenu-btn").waitFor({ timeout: 15000 });
  // dismiss first-run welcome if present
  const gotIt = page.getByRole("button", { name: /got it/i });
  if (await gotIt.count()) await gotIt.click().catch(() => {});
}

async function setTheme(page: Page, theme: "light" | "dark") {
  const cur = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  if (cur !== theme) await page.locator('button[title="Theme"]').first().click().catch(() => {});
}

async function gotoView(page: Page, view: "list" | "board" | "weekly" | "monthly") {
  await page.goto(`/?project=global&view=${view}`);
  await page.locator("thead, .kanban, .wk, .month, [class*='board']").first().waitFor({ timeout: 10000 }).catch(() => {});
}

test.describe("Auth", () => {
  test("login screen", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveScreenshot("login.png", { fullPage: true });
  });
});

test.describe("Views (light)", () => {
  for (const view of ["list", "board", "weekly", "monthly"] as const) {
    test(`${view} view`, async ({ page }) => {
      await login(page);
      await setTheme(page, "light");
      await gotoView(page, view);
      await expect(page).toHaveScreenshot(`${view}-light.png`, { fullPage: true });
    });
  }
});

test.describe("Views (dark)", () => {
  test("list view dark", async ({ page }) => {
    await login(page);
    await gotoView(page, "list");
    await setTheme(page, "dark");
    await expect(page).toHaveScreenshot("list-dark.png", { fullPage: true });
  });
});

test.describe("Dialogs", () => {
  const dialogs: Array<[string, RegExp]> = [
    ["team", /^team$/i],
    ["settings", /settings/i],
    ["help", /help/i],
  ];
  for (const [name, re] of dialogs) {
    test(`${name} dialog`, async ({ page }) => {
      await login(page);
      await gotoView(page, "list");
      await page.getByRole("button", { name: re }).first().click();
      await page.locator("[class*='modal'], [role='dialog']").first().waitFor({ timeout: 8000 });
      await expect(page).toHaveScreenshot(`dialog-${name}.png`, { fullPage: true });
    });
  }
});
