"""Backend-independent reskin verification: render qa/reskin_preview.html
(which links the real frontend/src/index.css + App.css) and screenshot it in
light + dark so the Temple-of-Light port can be eyeballed without the API."""
import os
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, "shots")
os.makedirs(SHOTS, exist_ok=True)
URL = "file:///" + os.path.join(HERE, "reskin_preview.html").replace("\\", "/")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1200},
                                device_scale_factor=2)
        page.goto(URL)
        page.wait_for_timeout(1500)  # let webfonts load
        for theme in ("light", "dark"):
            page.evaluate("(t)=>document.documentElement.setAttribute('data-theme',t)", theme)
            page.wait_for_timeout(400)
            out = os.path.join(SHOTS, f"reskin_{theme}.png")
            page.screenshot(path=out, full_page=True)
            print("wrote", out)
        browser.close()


if __name__ == "__main__":
    main()
