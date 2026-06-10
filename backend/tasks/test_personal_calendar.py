"""D47 personal-scope events & holidays + the Italian holiday set."""
import pytest
from rest_framework.test import APIClient

from accounts.models import Membership, Organization
from django.contrib.auth import get_user_model
from tasks.holidays_feed import AVAILABLE_SETS, DEFAULT_SETS

User = get_user_model()


@pytest.fixture
def org(db):
    return Organization.objects.create(name="Ananda Assisi", is_active=True)


def _member(org, email, role="member"):
    u = User.objects.create_user(email=email, password="pw-strong-123")
    Membership.objects.create(user=u, organization=org, role=role, is_active=True)
    return u


@pytest.fixture
def admin(org):
    return _member(org, "a@x.com", role="admin")


@pytest.fixture
def member(org):
    return _member(org, "m@x.com")


@pytest.fixture
def other(org):
    return _member(org, "o@x.com")


def _auth(user, org):
    c = APIClient()
    c.force_authenticate(user=user)
    return c, {"HTTP_X_ORG_ID": str(org.id)}


# ---- Italian holidays set --------------------------------------------------

def test_italian_set_registered_and_default_on():
    assert "italy" in AVAILABLE_SETS
    assert "italy" in DEFAULT_SETS


def test_italian_holidays_appear_in_range(member, org):
    c, h = _auth(member, org)
    r = c.get("/api/holidays/range?from=2026-06-01&to=2026-06-30", **h)
    assert r.status_code == 200
    italy = [x for x in r.json() if x["set"] == "italy"]
    # Festa della Repubblica — June 2.
    assert any(x["start"] == "2026-06-02" for x in italy)


# ---- personal vs org-wide events -------------------------------------------

def test_member_creates_personal_event(member, org):
    c, h = _auth(member, org)
    r = c.post("/api/events", {"personal": True, "kind": "single",
                               "date": "2026-07-04", "title": "My retreat"}, format="json", **h)
    assert r.status_code == 201, r.content
    assert r.json()["owner"] == member.id


def test_member_cannot_create_org_event(member, org):
    c, h = _auth(member, org)
    r = c.post("/api/events", {"kind": "single", "date": "2026-07-04", "title": "Team day"},
               format="json", **h)
    assert r.status_code == 403


def test_admin_creates_org_event_owner_null(admin, org):
    c, h = _auth(admin, org)
    r = c.post("/api/events", {"kind": "single", "date": "2026-07-04", "title": "Team day"},
               format="json", **h)
    assert r.status_code == 201, r.content
    assert r.json()["owner"] is None


def test_personal_event_invisible_to_others(member, other, org):
    c, h = _auth(member, org)
    c.post("/api/events", {"personal": True, "kind": "single",
                           "date": "2026-07-04", "title": "Private"}, format="json", **h)
    c2, h2 = _auth(other, org)
    titles = {e["title"] for e in c2.get("/api/events", **h2).json()}
    assert "Private" not in titles


def test_member_cannot_edit_org_event(admin, member, org):
    ca, ha = _auth(admin, org)
    ev = ca.post("/api/events", {"kind": "single", "date": "2026-07-04", "title": "Team day"},
                 format="json", **ha).json()
    cm, hm = _auth(member, org)
    r = cm.patch(f"/api/events/{ev['id']}", {"title": "Hijacked"}, format="json", **hm)
    assert r.status_code in (403, 404)


def test_member_edits_own_personal_event(member, org):
    c, h = _auth(member, org)
    ev = c.post("/api/events", {"personal": True, "kind": "single",
                                "date": "2026-07-04", "title": "Mine"}, format="json", **h).json()
    r = c.patch(f"/api/events/{ev['id']}", {"title": "Mine v2"}, format="json", **h)
    assert r.status_code == 200 and r.json()["title"] == "Mine v2"


# ---- personal holidays -----------------------------------------------------

def test_personal_holiday_crud_and_range(member, org):
    c, h = _auth(member, org)
    r = c.post("/api/holidays/personal", {"name": "Mom's birthday", "month": 6, "day": 15},
               format="json", **h)
    assert r.status_code == 201, r.content
    rng = c.get("/api/holidays/range?from=2026-06-01&to=2026-06-30", **h).json()
    assert any(x.get("personal") and x["title"] == "Mom's birthday" for x in rng)


def test_personal_holiday_invisible_to_others(member, other, org):
    c, h = _auth(member, org)
    c.post("/api/holidays/personal", {"name": "Secret", "month": 6, "day": 15}, format="json", **h)
    c2, h2 = _auth(other, org)
    rng = c2.get("/api/holidays/range?from=2026-06-01&to=2026-06-30", **h2).json()
    assert not any(x["title"] == "Secret" for x in rng)


def test_personal_holiday_rejects_bad_date(member, org):
    c, h = _auth(member, org)
    r = c.post("/api/holidays/personal", {"name": "Bad", "month": 13, "day": 1}, format="json", **h)
    assert r.status_code == 400
