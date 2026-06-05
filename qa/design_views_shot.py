"""Screenshot each view of the ACTUAL design standalone for side-by-side fidelity
checks against the app."""
import os
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, "shots")
DESIGN = os.path.abspath(os.path.join(HERE, "..", "design", "Ananda Taskboard - Web.html"))
URL = "file:///" + DESIGN.replace("\\", "/")
VIEWS = ["list", "board", "weekly", "monthly"]


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        page = b.new_page(viewport={"width": 1440, "height": 950}, device_scale_factor=2)
        page.goto(URL)
        page.wait_for_timeout(3500)
        for v in VIEWS:
            page.eval_on_selector(f'#viewSeg button[data-view="{v}"]', "el => el.click()")
            page.wait_for_timeout(700)
            page.screenshot(path=os.path.join(SHOTS, f"design_{v}.png"))
            print("wrote design_" + v + ".png")
        b.close()


if __name__ == "__main__":
    main()
