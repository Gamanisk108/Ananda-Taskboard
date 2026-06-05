"""Render the ACTUAL Claude Design standalone (the self-unpacking bundler HTML)
and screenshot it, light + dark, at several scroll depths — so the real design
target can be seen instead of guessed from its CSS."""
import os
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, "shots")
os.makedirs(SHOTS, exist_ok=True)
DESIGN = os.path.abspath(os.path.join(HERE, "..", "design", "Claude Design", "Ananda Taskboard - Web.html"))
URL = "file:///" + DESIGN.replace("\\", "/")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 950}, device_scale_factor=2)
        msgs = []
        page.on("console", lambda m: msgs.append(m.text))
        page.on("pageerror", lambda e: msgs.append("PAGEERR " + str(e)))
        page.goto(URL)
        page.wait_for_timeout(4000)  # let the bundler unpack + render
        # report what unpacked
        print("BODY classes / first content:", page.evaluate("() => document.querySelector('.topbar') ? 'APP RENDERED' : (document.getElementById('__bundler_loading')?.textContent || 'unknown')"))
        for m in msgs[:15]:
            print("  console:", m[:160])
        page.screenshot(path=os.path.join(SHOTS, "design_real_top.png"))
        print("wrote design_real_top.png")
        # scroll the inner content and capture the board lower down
        page.evaluate("() => { const c = document.querySelector('.content'); if (c) c.scrollTop = 700; }")
        page.wait_for_timeout(500)
        page.screenshot(path=os.path.join(SHOTS, "design_real_scrolled.png"))
        print("wrote design_real_scrolled.png")
        browser.close()


if __name__ == "__main__":
    main()
