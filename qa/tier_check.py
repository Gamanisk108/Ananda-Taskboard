from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page()
    pg.goto("http://localhost:8000"); pg.wait_for_load_state("networkidle")
    pg.fill("input[type=email]", "admin@ananda.test")
    pg.fill("input[type=password]", "taskboard123")
    pg.press("input[type=password]", "Enter")
    pg.wait_for_selector(".usermenu-btn", timeout=20000)
    pg.locator("[data-testid=open-team]").click()
    pg.wait_for_timeout(1200)
    opts = pg.eval_on_selector_all("select option", "els => [...new Set(els.map(e => e.textContent.trim()))]")
    has = [o for o in opts if o in ("Volunteer", "Coordinator", "Lead")]
    print("HAS_TIERS:", sorted(has), "| total_options:", len(opts))
    b.close()
