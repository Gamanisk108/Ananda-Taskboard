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
  // The login labels aren't htmlFor-associated, so target the inputs directly.
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.locator(".usermenu-btn").waitFor({ timeout: 15000 });
  // dismiss first-run welcome if present
  const gotIt = page.getByRole("button", { name: /got it/i });
  if (await gotIt.count()) await gotIt.click().catch(() => {});
  // Theme persists per-user server-side, so a prior dark test can bleed in.
  // Normalize every test to light unless it explicitly switches to dark.
  await setTheme(page, "light");
}

async function setTheme(page: Page, theme: "light" | "dark") {
  const cur = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  if (cur !== theme) await page.locator('button[title="Theme"]').first().click().catch(() => {});
}

async function gotoView(page: Page, view: "list" | "board" | "weekly" | "monthly") {
  await page.goto(`/?project=global&view=${view}`);
  await page.locator("thead, .kanban, .wk, .month, [class*='board'], .kan-card").first().waitFor({ timeout: 10000 }).catch(() => {});
  // Let async task data settle so screenshots aren't flaky on render timing.
  await page.waitForLoadState("networkidle").catch(() => {});
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

// Open the admin Team dialog regardless of nav layout: a top-bar button on
// desktop, or via the hamburger nav drawer on phones (≤700px).
async function openTeam(page: Page) {
  const top = page.locator('.topbar-actions button[title="Team"]');
  if (await top.count()) { await top.click(); return; }
  await page.locator('[data-testid="nav-drawer-btn"]').click();
  await page.locator('.dnav [data-testid="open-team"]').click();
}
// Settings / Help live in the account menu (D15).
async function openAccountItem(page: Page, re: RegExp) {
  await page.locator(".usermenu-btn").click();
  await page.getByRole("button", { name: re }).first().click();
}

test.describe("Dialogs", () => {
  test("team dialog", async ({ page }) => {
    await login(page);
    await gotoView(page, "list");
    await openTeam(page);
    await page.locator(".modal, [role='dialog']").first().waitFor({ timeout: 8000 });
    await expect(page).toHaveScreenshot("dialog-team.png", { fullPage: true });
  });
  for (const [name, re] of [["settings", /settings/i], ["help", /help|faq/i]] as Array<[string, RegExp]>) {
    test(`${name} dialog`, async ({ page }) => {
      await login(page);
      await gotoView(page, "list");
      await openAccountItem(page, re);
      await page.locator(".modal, [role='dialog']").first().waitFor({ timeout: 8000 });
      await expect(page).toHaveScreenshot(`dialog-${name}.png`, { fullPage: true });
    });
  }
});

// Help Us / Community Translations surfaces (D36–D43, built 2026-06-09).
// NOTE: these baselines capture the FUNCTIONAL v1 — regenerate deliberately
// when Claude Design's revised handoff lands and the fidelity pass is built.
test.describe("Help Us", () => {
  async function openHelpUs(page: Page) {
    await login(page);
    await gotoView(page, "list"); // settle the board behind the dialog (anti-flake)
    await page.locator(".usermenu-btn").click();
    await page.locator('[data-testid="open-settings"]').click();
    await page.locator('[data-testid="settings-nav-helpus"]').click();
    await page.locator(".hu-stack").waitFor({ timeout: 8000 });
  }

  test("settings → help us hub", async ({ page }) => {
    await openHelpUs(page);
    await expect(page).toHaveScreenshot("settings-helpus.png", { fullPage: true });
  });

  test("settings → help us hub (dark)", async ({ page }) => {
    // Theme toggles by the logo, BEHIND the modal backdrop — switch first.
    await login(page);
    await setTheme(page, "dark");
    await gotoView(page, "list"); // settle the board behind the dialog (anti-flake)
    await page.locator(".usermenu-btn").click();
    await page.locator('[data-testid="open-settings"]').click();
    await page.locator('[data-testid="settings-nav-helpus"]').click();
    await page.locator(".hu-stack").waitFor({ timeout: 8000 });
    await expect(page).toHaveScreenshot("settings-helpus-dark.png", { fullPage: true });
  });

  test("improve translations dialog", async ({ page }) => {
    await openHelpUs(page);
    await page.getByRole("button", { name: /start translating/i }).click();
    await page.locator(".tr-row").first().waitFor({ timeout: 10000 });
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page).toHaveScreenshot("dialog-translate.png", { fullPage: true });
  });

  test("report a problem dialog", async ({ page }) => {
    await openHelpUs(page);
    await page.getByRole("button", { name: /^report/i }).click();
    await page.locator(".an-seg").waitFor({ timeout: 8000 });
    await expect(page).toHaveScreenshot("dialog-report.png", { fullPage: true });
  });

  test("spread the word dialog", async ({ page }) => {
    await openHelpUs(page);
    await page.getByRole("button", { name: /invite/i }).first().click();
    await page.locator(".an-copyrow").waitFor({ timeout: 8000 });
    await expect(page).toHaveScreenshot("dialog-spread.png", { fullPage: true });
  });

  test("translation review (superadmin)", async ({ page, viewport }) => {
    test.skip(!viewport || viewport.width < 900, "topbar nav is desktop-scoped");
    await login(page);
    await gotoView(page, "list"); // settle the board behind the dialog (anti-flake)
    await page.locator('[data-testid="open-tr-review"]').click();
    await page.locator(".rv-bar").waitFor({ timeout: 8000 });
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page).toHaveScreenshot("dialog-tr-review.png", { fullPage: true });
  });
});

// Functional (not screenshot): the Floating-UI-positioned SingleSelect popover
// opens, portals out of any clipping ancestor, and is shifted to stay fully in
// the viewport. Desktop-scoped (the list filters are inline there; on phones
// they live in a bottom sheet, covered elsewhere).
test.describe("SingleSelect popover (floating-ui)", () => {
  test("opens, portals, stays in viewport", async ({ page, viewport }) => {
    test.skip(!viewport || viewport.width < 900, "list filters are inline on desktop only");
    await login(page);
    await gotoView(page, "list");
    await page.locator(".filters .ms.ss .ms-btn").first().click();
    const pop = page.locator(".ms-pop.ss-float");
    await expect(pop).toBeVisible();
    const box = (await pop.boundingBox())!;
    expect(box).not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.y).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport!.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport!.height + 1);
  });
});

test.describe("ColorPicker popover (floating-ui)", () => {
  test("palette opens, portals, in viewport", async ({ page, viewport }) => {
    test.skip(!viewport || viewport.width < 900, "desktop-scoped (Projects nav is a top-bar button)");
    await login(page);
    await gotoView(page, "list");
    await page.locator('.topbar-actions button[title="Projects"]').click();
    await page.locator(".modal").first().waitFor({ timeout: 8000 });
    await page.locator(".modal .swatch-btn").first().click();
    const pop = page.locator(".color-pop");
    await expect(pop).toBeVisible();
    await expect(pop.locator(".color-cell")).toHaveCount(12);
    const box = (await pop.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport!.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport!.height + 1);
  });
});
