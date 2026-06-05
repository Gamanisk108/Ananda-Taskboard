"""End-to-end: self-serve signup -> email verify -> login as new org admin ->
log in as the platform superuser -> open the metadata-only Platform view.

Servers (Django :8000 + Vite :5173) are started by with_server.py. The backend
runs with the file-based email backend so we can read the verification link the
same way a real user would (from the email)."""

import glob
import os
import quopri
import re
import sys

from playwright.sync_api import sync_playwright

EMAIL_DIR = r"C:\AI\Ananda Taskboard\backend\e2e_emails"
SHOTS = r"C:\AI\Ananda Taskboard\qa\e2e_shots"
BASE = "http://localhost:5173"

FOUNDER = {
    "organization": "Ananda Portland E2E",
    "city": "Portland",
    "country": "USA",
    "name": "E2E Founder",
    "email": "founder.e2e@portland.test",
    "password": "E2epass!23456",
}
SUPERUSER = {"email": "root.e2e@test.local", "password": "E2epass!23456"}

results = []


def check(label, ok):
    results.append((label, ok))
    print(("PASS" if ok else "FAIL"), "-", label)


def shot(page, name):
    page.screenshot(path=os.path.join(SHOTS, name), full_page=True)


def read_verify_link():
    files = sorted(glob.glob(os.path.join(EMAIL_DIR, "*")), key=os.path.getmtime)
    if not files:
        return None
    raw = open(files[-1], "rb").read()
    text = quopri.decodestring(raw).decode("utf-8", "replace")
    m = re.search(r"http://localhost:5173/\?verify\S*", text)
    return m.group(0) if m else None


def login(page, email, password):
    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    page.locator('input[type="email"]').first.fill(email)
    page.locator('input[type="password"]').first.fill(password)
    page.get_by_role("button", name="Sign in").click()
    page.wait_for_load_state("networkidle")


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        sig = {}
        page.on("response", lambda r: sig.__setitem__("signup", r.status) if "/api/auth/signup" in r.url else None)

        # 1. Login screen + go to signup ------------------------------------
        page.goto(BASE)
        page.wait_for_load_state("networkidle")
        shot(page, "01-login.png")
        check("login screen shows 'Create an account'", page.get_by_text("Create an account").count() > 0)
        page.get_by_role("button", name="Create an account").click()

        # 2. Fill the signup form -------------------------------------------
        page.wait_for_selector("form.login-card input")
        inputs = page.locator("form.login-card input")
        # DOM order: organization, city, country, name, email, password
        inputs.nth(0).fill(FOUNDER["organization"])
        inputs.nth(1).fill(FOUNDER["city"])
        inputs.nth(2).fill(FOUNDER["country"])
        inputs.nth(3).fill(FOUNDER["name"])
        inputs.nth(4).fill(FOUNDER["email"])
        inputs.nth(5).fill(FOUNDER["password"])
        shot(page, "02-signup-filled.png")
        page.get_by_role("button", name="Create account").click()

        # 3. "Check your email" confirmation --------------------------------
        try:
            page.wait_for_selector("text=Check your email", timeout=20000)
            ok = True
        except Exception:
            ok = False
        shot(page, "03-check-email.png")
        print("signup response status:", sig.get("signup"))
        check("signup shows 'Check your email'", ok)

        # 4. Read the verification link from the sent email -----------------
        link = read_verify_link()
        check("verification email contains a ?verify link", bool(link))
        if not link:
            browser.close()
            return

        # 5. Visit the verify link ------------------------------------------
        page.goto(link)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(800)
        shot(page, "04-verified.png")
        check("verify page shows 'Email verified'", page.get_by_text("Email verified").count() > 0)

        # 6. Log in as the new founder (admin of the new org) ---------------
        login(page, FOUNDER["email"], FOUNDER["password"])
        shot(page, "05-app-as-founder.png")
        # Admin of their org → the Team admin button is present.
        check("founder lands in the app as org admin (Team button visible)",
              page.locator('[data-testid="open-team"]').count() > 0)
        # Founder must NOT see the platform button (not a superuser).
        check("founder does NOT see the Platform button",
              page.locator('button[title="Platform"]').count() == 0)

        # 7. Switch to the platform superuser -------------------------------
        page.evaluate("() => localStorage.clear()")
        login(page, SUPERUSER["email"], SUPERUSER["password"])
        shot(page, "06-app-as-superuser.png")
        check("superuser sees the Platform button", page.locator('button[title="Platform"]').count() > 0)

        # 8. Open the Platform stats modal ----------------------------------
        page.locator('button[title="Platform"]').click()
        page.wait_for_timeout(800)
        shot(page, "07-platform-stats.png")
        body = page.content()
        check("platform view lists the new org", FOUNDER["organization"] in body)
        check("platform view shows the founder admin email", FOUNDER["email"] in body)
        check("platform view shows location (Portland)", "Portland" in body)

        browser.close()


if __name__ == "__main__":
    run()
    print("\n=== E2E SUMMARY ===")
    passed = sum(1 for _, ok in results if ok)
    print(f"{passed}/{len(results)} checks passed")
    sys.exit(0 if passed == len(results) else 1)
