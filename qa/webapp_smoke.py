"""Playwright end-to-end smoke test (webapp-testing QA pass).

Drives a real browser against the single-server build (Django serving the SPA).
Assumes the server is already running at BASE and the demo data is seeded
(admin@ananda.test / mara@ananda.test / omar@ananda.test, pw taskboard123).

Run: backend\\venv\\Scripts\\python.exe qa\\webapp_smoke.py [base_url]
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8003"
SHOTS = Path(__file__).parent / "shots"
SHOTS.mkdir(exist_ok=True)

results = []


def check(name, cond):
    results.append((name, bool(cond)))
    print(("PASS" if cond else "FAIL"), "-", name)


def login(page, email, pw):
    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    page.fill('input[type="email"]', email)
    page.fill('input[type="password"]', pw)
    page.click('button:has-text("Sign in")')
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(800)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # ---------- ADMIN ---------- (isolated context = isolated localStorage)
    admin_ctx = browser.new_context()
    page = admin_ctx.new_page()
    login(page, "admin@ananda.test", "taskboard123")
    page.screenshot(path=str(SHOTS / "01_admin_board.png"), full_page=True)
    check("admin: board loads (New task button)", page.locator('button:has-text("New task")').count() > 0)
    check("admin: Team button visible", page.locator('button:has-text("Team")').count() > 0)
    check("admin: Manage projects visible", page.locator('button:has-text("Manage projects")').count() > 0)

    # New task modal: Project + Sub-project dropdowns + assignee list
    page.click('button:has-text("New task")')
    page.wait_for_timeout(500)
    page.screenshot(path=str(SHOTS / "02_new_task_modal.png"), full_page=True)
    labels = page.locator(".modal label").all_inner_texts()
    check("modal has 'Task name' label", any("Task name" in l for l in labels))
    check("modal has 'Project' label", any(l.strip() == "Project" for l in labels))
    check("modal has 'Sub-project' label", any("Sub-project" in l for l in labels))
    check("modal has 'Assignees' label", any("Assignees" in l for l in labels))
    # assignees are collapsed by default → click Edit, then the searchable list appears
    page.locator(".modal").get_by_role("button", name="Edit").first.click()
    page.wait_for_timeout(300)
    check("assignee search box appears", page.locator('.modal input[placeholder="Search by name…"]').count() > 0)
    check("assignee list appears after Edit", page.locator(".assignee-list .assignee-row").count() > 0)
    selects = page.locator(".modal select").count()
    check("modal has >=2 dropdowns (project+subproject)", selects >= 2)

    # Create a task
    page.fill('input[placeholder="e.g. Design spring flyer"]', "QA smoke task")
    page.click('.modal button:has-text("Save")')
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(800)
    page.screenshot(path=str(SHOTS / "03_after_create.png"), full_page=True)
    check("created task appears in list", page.locator('text=QA smoke task').count() > 0)

    # List has separate Project + Sub-project + Assignees columns
    page.wait_for_selector("table.tbl thead th")
    headers = [h.strip() for h in page.locator("table.tbl thead th").all_inner_texts()]
    print("   headers:", headers)
    H = [h.lower() for h in headers]  # headers are CSS-uppercased; compare case-insensitively
    check("list has Project column", "project" in H)
    check("list has Sub-project column", "sub-project" in H)
    check("list has Assignees column", "assignees" in H)

    # Weekly + Monthly views render
    page.click('button:has-text("Weekly")'); page.wait_for_timeout(500)
    page.screenshot(path=str(SHOTS / "04_weekly.png"), full_page=True)
    check("weekly view renders", page.locator(".week").count() > 0)
    page.click('button:has-text("Monthly")'); page.wait_for_timeout(500)
    page.screenshot(path=str(SHOTS / "05_monthly.png"), full_page=True)
    check("monthly view renders", page.locator(".month").count() > 0)
    page.click('button:has-text("List")'); page.wait_for_timeout(300)

    # Team panel
    page.click('button:has-text("Team")'); page.wait_for_timeout(600)
    page.screenshot(path=str(SHOTS / "06_team.png"), full_page=True)
    tabs = page.locator(".modal .seg button").all_inner_texts()
    check("team has Members/Groups/Access tabs", all(any(t in x for x in tabs) for t in ["Members", "Groups", "Access"]))
    page.keyboard.press("Escape")
    page.locator(".modal-head button").first.click()  # close
    page.wait_for_timeout(300)

    # Manage projects
    page.click('button:has-text("Manage projects")'); page.wait_for_timeout(600)
    page.screenshot(path=str(SHOTS / "07_manage_projects.png"), full_page=True)
    check("manage projects: add-project field", page.locator('input[placeholder="New project name…"]').count() > 0)
    check("manage projects: color pickers", page.locator('.modal input[type="color"]').count() > 0)
    page.locator(".modal-head button").first.click()
    page.wait_for_timeout(300)

    # Settings
    page.click('button[title="Settings"]'); page.wait_for_timeout(500)
    page.screenshot(path=str(SHOTS / "08_settings.png"), full_page=True)
    check("settings: timezone selector", page.locator('.modal select').count() > 0)
    page.locator(".modal-head button").first.click()
    page.close()
    admin_ctx.close()

    # ---------- VIEWER (omar) ---------- (fresh context, no shared storage)
    viewer_ctx = browser.new_context()
    page2 = viewer_ctx.new_page()
    # Omar: viewer on Karuna/Warehouse, but MEMBER on Sunday Service via the
    # Alliance group → he can create in Sunday only. Verify the gating precisely.
    login(page2, "omar@ananda.test", "taskboard123")
    page2.screenshot(path=str(SHOTS / "09_viewer_board.png"), full_page=True)
    check("non-admin: NO Team button", page2.locator('button:has-text("Team")').count() == 0)
    check("non-admin: NO Manage projects", page2.locator('button:has-text("Manage projects")').count() == 0)
    check("non-admin: NO Settings gear", page2.locator('button[title="Settings"]').count() == 0)
    # member-via-group can create — open modal and inspect writable project options
    check("omar can create (member via group)", page2.locator('button:has-text("New task")').count() > 0)
    page2.click('button:has-text("New task")')
    page2.wait_for_timeout(500)
    proj_opts = page2.locator('.modal select').first.locator("option").all_inner_texts()
    print("   omar writable projects:", proj_opts)
    check("omar writable: includes Sunday Service", any("Sunday Service" in o for o in proj_opts))
    check("omar writable: excludes viewer-only Karuna Devi", not any("Karuna Devi" in o for o in proj_opts))
    page2.close()
    viewer_ctx.close()

    browser.close()

# summary
passed = sum(1 for _, ok in results if ok)
print(f"\n=== webapp QA: {passed}/{len(results)} checks passed ===")
sys.exit(0 if passed == len(results) else 1)
