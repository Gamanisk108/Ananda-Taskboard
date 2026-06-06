"""Screenshot the admin dialogs + task modal to verify the .sheet/design styling."""
import os
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, "shots")
BASE = "http://localhost:8000"


def login(page):
    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    page.fill("input[type=email]", "admin@ananda.test")
    page.fill("input[type=password]", "taskboard123")
    page.press("input[type=password]", "Enter")
    page.wait_for_selector(".usermenu-btn", timeout=20000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(800)


def shot(page, name):
    page.wait_for_timeout(900)
    page.screenshot(path=os.path.join(SHOTS, name))
    print("wrote", name)


def close_modal(page):
    bd = page.locator(".modal-backdrop")
    if bd.count():
        bd.first.click(position={"x": 6, "y": 6}, timeout=2000)
        page.wait_for_timeout(300)


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        page = b.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=2)
        login(page)
        # Team
        page.locator("[data-testid=open-team]").click()
        shot(page, "admin_team.png")
        close_modal(page)
        # Projects (🗂️ button — 4th admin btn-ghost with LayoutGrid)
        page.locator("button[title]", has_text="").nth(0)
        # open account menu → Settings
        page.locator(".usermenu-btn").click()
        page.wait_for_timeout(300)
        page.locator(".usermenu-item", has_text="").first
        page.get_by_text("Settings", exact=False).first.click()
        shot(page, "admin_settings.png")
        b.close()


if __name__ == "__main__":
    main()
