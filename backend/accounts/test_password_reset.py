"""Self-service password reset: the public request/confirm endpoints.

Covers no-enumeration behavior, email delivery, token validation, password
rules, and a full round-trip (request → link → confirm → log in)."""

import re

import pytest
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient

from accounts.models import User


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    """ScopedRateThrottle keeps counts in the cache; clear it around each test
    so the per-IP rate limit doesn't bleed across the suite."""
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def member(db):
    return User.objects.create_user(email="m@example.com", name="Mara", password="pw-strong-123")


def _uid_token(user):
    return urlsafe_base64_encode(force_bytes(user.pk)), default_token_generator.make_token(user)


# --- request ---------------------------------------------------------------

def test_request_sends_email_to_known_user(api, member):
    res = api.post("/api/auth/password/request", {"email": "m@example.com"}, format="json")
    assert res.status_code == 200
    assert len(mail.outbox) == 1
    sent = mail.outbox[0]
    assert sent.to == ["m@example.com"]
    assert "uid=" in sent.body and "token=" in sent.body


def test_request_is_silent_for_unknown_email(api, db):
    res = api.post("/api/auth/password/request", {"email": "ghost@example.com"}, format="json")
    assert res.status_code == 200          # same response as a hit (no enumeration)
    assert mail.outbox == []               # but nothing is sent


def test_request_response_does_not_reveal_existence(api, member, db):
    hit = api.post("/api/auth/password/request", {"email": "m@example.com"}, format="json")
    miss = api.post("/api/auth/password/request", {"email": "ghost@example.com"}, format="json")
    assert hit.status_code == miss.status_code == 200
    assert hit.data == miss.data           # identical body


def test_request_skips_inactive_user(api, member):
    member.is_active = False
    member.save()
    res = api.post("/api/auth/password/request", {"email": "m@example.com"}, format="json")
    assert res.status_code == 200 and mail.outbox == []


def test_request_ignores_blank_email(api, db):
    res = api.post("/api/auth/password/request", {"email": ""}, format="json")
    assert res.status_code == 200 and mail.outbox == []


# --- confirm ---------------------------------------------------------------

def test_confirm_sets_new_password_and_allows_login(api, member):
    uid, token = _uid_token(member)
    res = api.post(
        "/api/auth/password/confirm",
        {"uid": uid, "token": token, "password": "brand-new-pw-9"},
        format="json",
    )
    assert res.status_code == 200
    member.refresh_from_db()
    assert member.check_password("brand-new-pw-9")
    login = api.post("/api/auth/login", {"email": "m@example.com", "password": "brand-new-pw-9"}, format="json")
    assert login.status_code == 200


def test_confirm_rejects_bad_token(api, member):
    uid, _ = _uid_token(member)
    res = api.post(
        "/api/auth/password/confirm",
        {"uid": uid, "token": "not-a-real-token", "password": "brand-new-pw-9"},
        format="json",
    )
    assert res.status_code == 400 and res.data["detail"] == "invalid"


def test_confirm_rejects_unparseable_uid(api, member):
    _, token = _uid_token(member)
    res = api.post(
        "/api/auth/password/confirm",
        {"uid": "@@@", "token": token, "password": "brand-new-pw-9"},
        format="json",
    )
    assert res.status_code == 400 and res.data["detail"] == "invalid"


def test_confirm_token_is_single_use(api, member):
    uid, token = _uid_token(member)
    first = api.post(
        "/api/auth/password/confirm",
        {"uid": uid, "token": token, "password": "brand-new-pw-9"},
        format="json",
    )
    assert first.status_code == 200
    # The token is tied to the old password hash, so it no longer validates.
    again = api.post(
        "/api/auth/password/confirm",
        {"uid": uid, "token": token, "password": "another-new-pw-9"},
        format="json",
    )
    assert again.status_code == 400


def test_confirm_rejects_short_password(api, member):
    uid, token = _uid_token(member)
    res = api.post(
        "/api/auth/password/confirm",
        {"uid": uid, "token": token, "password": "short"},
        format="json",
    )
    assert res.status_code == 400 and "password" in res.data


# --- full round-trip -------------------------------------------------------

def test_full_flow_request_then_confirm(api, member):
    api.post("/api/auth/password/request", {"email": "m@example.com"}, format="json")
    body = mail.outbox[0].body
    uid = re.search(r"uid=([^&\s]+)", body).group(1)
    token = re.search(r"token=([^&\s]+)", body).group(1)
    res = api.post(
        "/api/auth/password/confirm",
        {"uid": uid, "token": token, "password": "fresh-pw-from-email-1"},
        format="json",
    )
    assert res.status_code == 200
    member.refresh_from_db()
    assert member.check_password("fresh-pw-from-email-1")
