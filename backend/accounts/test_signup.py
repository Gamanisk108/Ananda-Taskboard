"""Self-serve signup + email verification: creates an inactive account + org +
admin membership, gates login until verified, then activates both on confirm."""

import re

import pytest
from django.core import mail
from rest_framework.test import APIClient

from accounts.models import Membership, Organization, User
from accounts.tokens import email_verification_token
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api(db):
    return APIClient()


SIGNUP = {
    "organization": "Ananda Portland",
    "name": "Hriman",
    "email": "lead@portland.org",
    "password": "strong-pw-12345",
    "city": "Portland",
    "state": "Oregon",
    "country": "USA",
}


def test_signup_creates_inactive_account_org_and_owner_membership(api):
    res = api.post("/api/auth/signup", SIGNUP, format="json")
    assert res.status_code == 201
    user = User.objects.get(email="lead@portland.org")
    assert user.is_active is False
    org = Organization.objects.get(name="Ananda Portland")
    assert org.is_active is False and org.city == "Portland" and org.country == "USA"
    assert org.state == "Oregon"
    assert org.created_by_id == user.id
    m = Membership.objects.get(user=user, organization=org)
    # The org creator is now the OWNER (top authority), not a plain admin.
    assert m.role == Membership.Role.OWNER and m.is_active is True
    assert len(mail.outbox) == 1 and mail.outbox[0].to == ["lead@portland.org"]
    assert "verify" in mail.outbox[0].body


def test_cannot_login_until_verified(api):
    api.post("/api/auth/signup", SIGNUP, format="json")
    login = api.post("/api/auth/login", {"email": SIGNUP["email"], "password": SIGNUP["password"]}, format="json")
    assert login.status_code == 401  # inactive account is rejected


def test_verify_activates_account_and_org_then_login_works(api):
    api.post("/api/auth/signup", SIGNUP, format="json")
    user = User.objects.get(email=SIGNUP["email"])
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = email_verification_token.make_token(user)
    res = api.post("/api/auth/verify", {"uid": uid, "token": token}, format="json")
    assert res.status_code == 200
    user.refresh_from_db()
    assert user.is_active is True
    assert Organization.objects.get(created_by=user).is_active is True
    login = api.post("/api/auth/login", {"email": SIGNUP["email"], "password": SIGNUP["password"]}, format="json")
    assert login.status_code == 200 and "access" in login.data


def test_login_email_is_case_insensitive(api, db):
    """Emails are stored lowercased, so a capitalized login entry (e.g. mobile
    autocapitalize) must still authenticate rather than look like a wrong password."""
    User.objects.create_user(email="lead@portland.org", name="X", password="strong-pw-12345")
    login = api.post(
        "/api/auth/login",
        {"email": "Lead@Portland.ORG", "password": "strong-pw-12345"},
        format="json",
    )
    assert login.status_code == 200 and "access" in login.data


def test_duplicate_email_rejected(api, db):
    User.objects.create_user(email="lead@portland.org", name="X", password="strong-pw-12345")
    res = api.post("/api/auth/signup", SIGNUP, format="json")
    assert res.status_code == 400 and "email" in res.data


def test_weak_password_rejected(api):
    res = api.post("/api/auth/signup", {**SIGNUP, "password": "short"}, format="json")
    assert res.status_code == 400 and "password" in res.data


def test_verify_rejects_bad_token(api):
    api.post("/api/auth/signup", SIGNUP, format="json")
    user = User.objects.get(email=SIGNUP["email"])
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    res = api.post("/api/auth/verify", {"uid": uid, "token": "nope"}, format="json")
    assert res.status_code == 400 and res.data["detail"] == "invalid"
    user.refresh_from_db()
    assert user.is_active is False  # still gated


def test_reset_token_cannot_be_used_to_verify(api):
    # Distinct key_salt: a password-reset token must not validate as a verify token.
    from django.contrib.auth.tokens import default_token_generator
    api.post("/api/auth/signup", SIGNUP, format="json")
    user = User.objects.get(email=SIGNUP["email"])
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    reset_token = default_token_generator.make_token(user)
    res = api.post("/api/auth/verify", {"uid": uid, "token": reset_token}, format="json")
    assert res.status_code == 400


def test_full_flow_via_email_link(api):
    api.post("/api/auth/signup", SIGNUP, format="json")
    body = mail.outbox[0].body
    uid = re.search(r"uid=([^&\s]+)", body).group(1)
    token = re.search(r"token=([^&\s]+)", body).group(1)
    res = api.post("/api/auth/verify", {"uid": uid, "token": token}, format="json")
    assert res.status_code == 200
    assert User.objects.get(email=SIGNUP["email"]).is_active is True
