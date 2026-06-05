"""Screenshot all four view tabs (List/Board/Weekly/Monthly) of the running app
after the design overhaul, for final verification before deploy."""
import os
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, "shots")
BASE = "http://localhost:8000"
VIEWS = ["list", "board", "weekly", "monthly"]


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        page = b.new_page(viewport={"width": 1440, "height": 950}, device_scale_factor=2)
        page.goto(BASE)
        page.wait_for_load_state("networkidle")
        page.fill("input[type=email]", "admin@ananda.test")
        page.fill("input[type=password]", "taskboard123")
        page.press("input[type=password]", "Enter")
        page.wait_for_selector(".usermenu-btn", timeout=20000)
        page.wait_for_load_state("networkidle")
        for v in VIEWS:
            # the view segment buttons render the localized label; click by order
            idx = VIEWS.index(v)
            page.locator(".seg button").nth(idx).click()
            page.wait_for_timeout(1100)
            page.screenshot(path=os.path.join(SHOTS, f"final_{v}.png"))
            print("wrote final_" + v + ".png")
        # open a task to verify the modal
        page.locator(".seg button").nth(0).click()
        page.wait_for_timeout(600)
        page.locator("tr[data-testid=task-row]").first.click()
        page.wait_for_timeout(900)
        page.screenshot(path=os.path.join(SHOTS, "final_modal.png"))
        print("wrote final_modal.png")
        b.close()


if __name__ == "__main__":
    main()
