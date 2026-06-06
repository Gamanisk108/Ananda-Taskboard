import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounts.models import Membership, Organization

User = get_user_model()


@pytest.fixture
def org(db):
    return Organization.objects.create(name="Ananda", is_active=True)


@pytest.fixture
def member(db, org):
    u = User.objects.create_user(email="m@x.com", password="pw")
    Membership.objects.create(user=u, organization=org, role="member", is_active=True)
    return u


def _auth(client, user, org):
    client.force_authenticate(user=user)
    return {"HTTP_X_ORG_ID": str(org.id)}


def test_range_returns_holidays_in_window(member, org):
    c = APIClient()
    hdrs = _auth(c, member, org)
    r = c.get("/api/holidays/range?from=2026-03-01&to=2026-03-31", **hdrs)
    assert r.status_code == 200
    titles = {h["title"] for h in r.json()}
    assert "Yogananda's Mahasamadhi" in titles
    assert all(h["holiday"] for h in r.json())


def test_range_respects_enabled_sets(member, org):
    org.enabled_holiday_sets = ["ananda_lineage"]
    org.save()
    c = APIClient()
    hdrs = _auth(c, member, org)
    r = c.get("/api/holidays/range?from=2026-01-01&to=2026-12-31", **hdrs)
    assert {h["set"] for h in r.json()} == {"ananda_lineage"}


def test_range_requires_auth():
    c = APIClient()
    r = c.get("/api/holidays/range?from=2026-01-01&to=2026-01-31")
    assert r.status_code in (401, 403)


def test_range_bad_date_is_400(member, org):
    c = APIClient()
    hdrs = _auth(c, member, org)
    r = c.get("/api/holidays/range?from=nope&to=2026-01-31", **hdrs)
    assert r.status_code == 400


@pytest.fixture
def admin(db, org):
    u = User.objects.create_user(email="a@x.com", password="pw")
    Membership.objects.create(user=u, organization=org, role="admin", is_active=True)
    return u


def test_settings_get_returns_enabled_and_available(member, org):
    c = APIClient()
    hdrs = _auth(c, member, org)
    r = c.get("/api/holidays/settings", **hdrs)
    assert r.status_code == 200
    body = r.json()
    assert "ananda_lineage" in body["available"]
    assert isinstance(body["enabled"], list)


def test_settings_patch_requires_admin(member, org):
    c = APIClient()
    hdrs = _auth(c, member, org)
    r = c.patch("/api/holidays/settings", {"enabled": ["us_federal"]}, format="json", **hdrs)
    assert r.status_code == 403


def test_settings_patch_admin_saves(admin, org):
    c = APIClient()
    hdrs = _auth(c, admin, org)
    r = c.patch("/api/holidays/settings",
                {"enabled": ["us_federal", "country:IT"]}, format="json", **hdrs)
    assert r.status_code == 200
    org.refresh_from_db()
    assert org.enabled_holiday_sets == ["us_federal", "country:IT"]


def test_settings_patch_rejects_unknown_set(admin, org):
    c = APIClient()
    hdrs = _auth(c, admin, org)
    r = c.patch("/api/holidays/settings", {"enabled": ["bogus"]}, format="json", **hdrs)
    assert r.status_code == 400
