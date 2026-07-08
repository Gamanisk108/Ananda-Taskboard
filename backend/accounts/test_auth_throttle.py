"""Rate limiting on the unauthenticated auth endpoints (login/signup/verify).

Fable plan 02: only password-reset was throttled; login/signup/verify had
none, which is a credential-stuffing / bulk-signup exposure on a live
multi-tenant app. Each view now uses the same ScopedRateThrottle pattern as
password-reset, with its own scope + rate.

The suite's real default rates (30/min login, 20/hour signup, 30/hour
verify_email — see config/settings.py) are too slow to exercise in a test
loop, so each test monkeypatches ScopedRateThrottle.THROTTLE_RATES for its
own scope to a small, fast, deterministic rate rather than looping dozens of
times against the production value. (The `_clear_throttle_cache` fixture in
the repo-root conftest.py already resets the cache before/after every test,
so these counts never bleed into other tests.)
"""

import pytest
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from accounts.models import User


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def member(db):
    return User.objects.create_user(email="m@example.com", name="Mara", password="pw-strong-123")


def _uid_token(user):
    return urlsafe_base64_encode(force_bytes(user.pk)), default_token_generator.make_token(user)


# --- login -------------------------------------------------------------

def test_login_blocked_after_configured_rate(api, monkeypatch, db):
    monkeypatch.setitem(ScopedRateThrottle.THROTTLE_RATES, "login", "2/min")
    body = {"email": "nobody@example.com", "password": "wrong-password"}
    first = api.post("/api/auth/login", body, format="json")
    second = api.post("/api/auth/login", body, format="json")
    third = api.post("/api/auth/login", body, format="json")
    assert first.status_code == 401  # bad creds, not throttled yet
    assert second.status_code == 401
    assert third.status_code == 429  # 3rd request within the window is throttled


def test_login_within_limit_still_succeeds(api, member, monkeypatch):
    monkeypatch.setitem(ScopedRateThrottle.THROTTLE_RATES, "login", "2/min")
    bad = api.post("/api/auth/login", {"email": member.email, "password": "wrong"}, format="json")
    good = api.post("/api/auth/login", {"email": member.email, "password": "pw-strong-123"}, format="json")
    assert bad.status_code == 401
    assert good.status_code == 200
    assert "access" in good.data


# --- signup --------------------------------------------------------------

def test_signup_blocked_after_configured_rate(api, monkeypatch, db):
    monkeypatch.setitem(ScopedRateThrottle.THROTTLE_RATES, "signup", "2/hour")

    def _signup(i):
        return api.post(
            "/api/auth/signup",
            {
                "organization": f"Org {i}",
                "name": "Signer",
                "email": f"signer{i}@example.com",
                "password": "strong-pw-12345",
            },
            format="json",
        )

    assert _signup(1).status_code == 201
    assert _signup(2).status_code == 201
    assert _signup(3).status_code == 429


# --- verify-email ----------------------------------------------------------

def test_verify_email_blocked_after_configured_rate(api, member, monkeypatch):
    monkeypatch.setitem(ScopedRateThrottle.THROTTLE_RATES, "verify_email", "2/hour")
    uid, token = _uid_token(member)
    bad_body = {"uid": uid, "token": "not-a-real-token"}
    first = api.post("/api/auth/verify", bad_body, format="json")
    second = api.post("/api/auth/verify", bad_body, format="json")
    third = api.post("/api/auth/verify", bad_body, format="json")
    assert first.status_code == 400 and first.data["detail"] == "invalid"
    assert second.status_code == 400
    assert third.status_code == 429
