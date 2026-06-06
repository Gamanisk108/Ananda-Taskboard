from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width":1440,"height":950}, device_scale_factor=2)
    pg.goto("http://localhost:8000"); pg.wait_for_load_state("networkidle")
    pg.fill("input[type=email]","admin@ananda.test"); pg.fill("input[type=password]","taskboard123")
    pg.press("input[type=password]","Enter"); pg.wait_for_selector(".usermenu-btn",timeout=20000)
    pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(800)
    # Board (vivid red flag)
    pg.locator(".seg button").nth(1).click(); pg.wait_for_timeout(1000)
    pg.screenshot(path="qa/shots/refine_board.png"); print("wrote refine_board.png")
    # Team tier option descriptions
    pg.locator("[data-testid=open-team]").click(); pg.wait_for_timeout(1200)
    opts = pg.eval_on_selector_all("select option", "els => els.map(e=>e.textContent.trim()).filter(t=>t.includes('View'))")
    print("TIER_DESCRIPTIONS:", sorted(set(opts)))
    b.close()
