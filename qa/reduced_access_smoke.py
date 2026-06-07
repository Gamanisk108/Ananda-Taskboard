"""Playwright E2E for the reduced-access parity features (Trash / Settings / Bulk).

Verifies that a non-admin MEMBER (mara@ananda.test) can reach Trash, the bulk
tool (status/deadline only), and the personal daily-push toggle — while admin-only
surfaces stay hidden. Assumes the single-server build is running at BASE and demo
data is seeded, plus one task pre-trashed by Mara.

Run via: python qa/reduced_access_smoke.py http://localhost:PORT
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8003"
SHOTS = Path(__file__).parent / "shots"
SHOTS.mkdir(exist_ok=True)

results = []


def check(name, cond):
    results.append((name, bool(cond)))
    print(("PASS" if cond else "FAIL"), "-", name)


def login(page, email, pw):
    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    page.fill('input[type="email"]', email)
    page.fill('input[type="password"]', pw)
    page.click('button:has-text("Sign in")')
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # ---------- MEMBER (mara) ----------
    ctx = browser.new_context()
    page = ctx.new_page()
    login(page, "mara@ananda.test", "taskboard123")
    page.screenshot(path=str(SHOTS / "ra_01_member_board.png"), full_page=True)

    check("member: Trash button visible", page.locator('button:has-text("Trash")').count() > 0)
    check("member: NO Team button", page.locator('button:has-text("Team")').count() == 0)

    page.click(".usermenu-btn"); page.wait_for_timeout(250)
    page.screenshot(path=str(SHOTS / "ra_02_member_menu.png"), full_page=True)
    check("member menu: has Bulk migrate", page.locator('.usermenu-item:has-text("Bulk migrate")').count() > 0)
    check("member menu: has Daily reminder toggle",
          page.locator('.usermenu-item:has-text("Daily reminder") input[type="checkbox"]').count() > 0)
    check("member menu: NO admin Settings", page.locator('.usermenu-item:has-text("Settings")').count() == 0)

    page.click('.usermenu-item:has-text("Bulk migrate")')
    page.wait_for_timeout(600)
    page.screenshot(path=str(SHOTS / "ra_03_member_bulk.png"), full_page=True)
    labels = page.locator(".modal label").all_inner_texts()
    check("bulk: Set status present", any("Set status" in l for l in labels))
    check("bulk: Set deadline present", any("Set deadline" in l for l in labels))
    check("bulk: Move to HIDDEN", not any("Move to" in l for l in labels))
    check("bulk: Reassign to HIDDEN", not any("Reassign to" in l for l in labels))
    check("bulk: Archive selected HIDDEN", page.locator('.modal button:has-text("Archive selected")').count() == 0)
    page.locator(".modal-head button").first.click()
    page.wait_for_timeout(300)

    page.click('button:has-text("Trash")')
    page.wait_for_timeout(600)
    page.screenshot(path=str(SHOTS / "ra_04_member_trash.png"), full_page=True)
    check("trash: shows Mara's own deleted task", page.locator('text=Mara trashed note').count() > 0)
    check("trash: no project/sub-project sections for member",
          page.locator('.modal h3:has-text("Projects")').count() == 0)
    if page.locator('button:has-text("Restore")').count() > 0:
        page.locator('button:has-text("Restore")').first.click()
        modal_row = page.locator(".modal").get_by_text("Mara trashed note")
        gone = True
        try:
            modal_row.wait_for(state="detached", timeout=5000)
        except Exception:
            gone = modal_row.count() == 0
        check("trash: task restored (gone from trash modal)", gone)
    page.close()
    ctx.close()

    # ---------- ADMIN sanity (full bulk controls still present) ----------
    actx = browser.new_context()
    apage = actx.new_page()
    login(apage, "admin@ananda.test", "taskboard123")
    apage.click(".usermenu-btn"); apage.wait_for_timeout(250)
    apage.click('.usermenu-item:has-text("Bulk migrate")')
    apage.wait_for_timeout(600)
    alabels = apage.locator(".modal label").all_inner_texts()
    check("admin bulk: Move to present", any("Move to" in l for l in alabels))
    check("admin bulk: Reassign to present", any("Reassign to" in l for l in alabels))
    check("admin bulk: Archive selected present", apage.locator('.modal button:has-text("Archive selected")').count() > 0)
    apage.close()
    actx.close()

    browser.close()

passed = sum(1 for _, ok in results if ok)
print(f"\n=== reduced-access QA: {passed}/{len(results)} checks passed ===")
sys.exit(0 if passed == len(results) else 1)
