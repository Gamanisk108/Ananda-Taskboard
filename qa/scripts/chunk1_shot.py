"""Screenshot the REAL running app's List view (chunk-1 design overhaul),
light + dark, to compare against design_real_top.png."""
import os
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, "shots")
BASE = "http://localhost:8000"


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        page = b.new_page(viewport={"width": 1440, "height": 950}, device_scale_factor=2)
        page.goto(BASE)
        page.wait_for_load_state("networkidle")
        # login
        page.fill("input[type=email]", "admin@ananda.test")
        page.fill("input[type=password]", "taskboard123")
        page.press("input[type=password]", "Enter")
        page.wait_for_selector(".usermenu-btn", timeout=20000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1200)
        page.screenshot(path=os.path.join(SHOTS, "app_chunk1_light.png"))
        print("wrote app_chunk1_light.png")
        # dark via the brand theme-toggle (first icon-btn in .brand)
        page.evaluate("() => document.documentElement.setAttribute('data-theme','dark')")
        page.wait_for_timeout(500)
        page.screenshot(path=os.path.join(SHOTS, "app_chunk1_dark.png"))
        print("wrote app_chunk1_dark.png")
        b.close()


if __name__ == "__main__":
    main()
