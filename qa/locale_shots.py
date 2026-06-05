"""Screenshot every UI language to eyeball rendering / overflow / script support.
Logs in as the demo admin, then switches language via the account-menu picker
(select[data-testid=language-select]) and captures the board for all 13 locales,
plus the New-Task modal for a couple of overflow-prone scripts."""
import os
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8000"
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots")
os.makedirs(SHOTS, exist_ok=True)
LANGS = ["en", "it", "es", "fr", "de", "pt", "zh", "hi", "bn", "ta", "te", "mr", "gu"]
MODAL_LANGS = {"de", "ta"}  # German (long words) + Tamil (complex script)


def set_language(page, code):
    """Open the account menu and pick a language; retry, since the menu
    re-renders (and can close) when the language PATCH refreshes `me`."""
    for _ in range(3):
        page.locator("button.usermenu-btn").first.click()
        sel = page.locator("select[data-testid=language-select]")
        try:
            sel.wait_for(state="visible", timeout=3000)
        except Exception:  # noqa: BLE001
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)
            continue
        sel.select_option(code)
        page.wait_for_timeout(500)
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        return True
    return False


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto(BASE)
        page.wait_for_load_state("networkidle")

        # login
        page.fill("input[type=email]", "admin@ananda.test")
        page.fill("input[type=password]", "taskboard123")
        page.press("input[type=password]", "Enter")
        page.wait_for_selector("button.usermenu-btn", timeout=15000)
        page.wait_for_load_state("networkidle")

        results = []
        for code in LANGS:
            ok = set_language(page, code)
            page.wait_for_timeout(300)
            page.screenshot(path=f"{SHOTS}/locale_{code}.png")
            results.append(f"board: locale_{code}.png" + ("" if ok else "  [switch FAILED]"))

            if code in MODAL_LANGS:
                try:
                    page.click("text=/New task/i", timeout=2500)
                    page.wait_for_selector("[data-testid=task-save]", timeout=4000)
                    page.wait_for_timeout(400)
                    page.screenshot(path=f"{SHOTS}/locale_{code}_modal.png")
                    results.append(f"modal: locale_{code}_modal.png")
                    page.keyboard.press("Escape")
                    page.wait_for_timeout(300)
                except Exception as e:  # noqa: BLE001
                    results.append(f"modal {code}: SKIPPED ({type(e).__name__})")

        browser.close()
        print("\n".join(results))


if __name__ == "__main__":
    main()
