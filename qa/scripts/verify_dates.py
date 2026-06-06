"""Quick check that calendar month/weekday names localize (date-fns wiring).
Logs in, switches language, opens the Weekly view, screenshots the header."""
import os
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8000"
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots")


def set_language(page, code):
    page.locator("button.usermenu-btn").first.click()
    sel = page.locator("select[data-testid=language-select]")
    sel.wait_for(state="visible", timeout=5000)
    sel.select_option(code)
    page.wait_for_timeout(500)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto(BASE)
        page.wait_for_load_state("networkidle")
        page.fill("input[type=email]", "admin@ananda.test")
        page.fill("input[type=password]", "taskboard123")
        page.press("input[type=password]", "Enter")
        page.wait_for_selector("button.usermenu-btn", timeout=15000)

        for code in ["de", "ta", "hi"]:
            set_language(page, code)
            # view switcher = first .seg in the viewbar; Weekly is button index 2
            page.locator(".viewbar .seg").first.locator("button").nth(2).click()
            page.wait_for_timeout(700)
            page.screenshot(path=f"{SHOTS}/dates_{code}_weekly.png")
            print(f"dates_{code}_weekly.png")

        browser.close()


if __name__ == "__main__":
    main()
