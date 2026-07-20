import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import Group, User


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def member(db):
    return User.objects.create_user(email="m@example.com", name="Mara", password="pw-strong-123")


@pytest.fixture
def admin(db):
    return User.objects.create_superuser(email="a@example.com", name="Ada", password="pw-strong-123")


def auth(api, user, password="pw-strong-123"):
    res = api.post("/api/auth/login", {"email": user.email, "password": password}, format="json")
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    return res


# --- self-service language (PATCH /api/me) ---------------------------------

def test_member_sets_own_language(api, member):
    auth(api, member)
    res = api.patch("/api/me", {"language": "hi"}, format="json")
    assert res.status_code == 200 and res.data["language"] == "hi"
    member.refresh_from_db()
    assert member.language == "hi"


def test_me_returns_language(api, member):
    member.language = "it"; member.save()
    auth(api, member)
    assert api.get("/api/me").data["language"] == "it"


def test_unsupported_language_rejected(api, member):
    auth(api, member)
    assert api.patch("/api/me", {"language": "xx"}, format="json").status_code == 400


def test_blank_language_clears_preference(api, member):
    member.language = "it"; member.save()
    auth(api, member)
    res = api.patch("/api/me", {"language": ""}, format="json")
    assert res.status_code == 200 and res.data["language"] == ""


def test_language_patch_requires_auth(api):
    assert api.patch("/api/me", {"language": "hi"}, format="json").status_code in (401, 403)


# --- model -----------------------------------------------------------------

def test_email_normalized_lowercase(db):
    u = User.objects.create_user(email="MixedCase@Example.COM", name="X", password="pw-strong-123")
    assert u.email == "mixedcase@example.com"


def test_create_user_requires_email(db):
    with pytest.raises(ValueError):
        User.objects.create_user(email="", name="X", password="pw")


def test_member_is_not_admin(member):
    assert member.is_admin is False
    assert member.role == User.Role.MEMBER


def test_superuser_is_admin(admin):
    assert admin.is_admin is True
    assert admin.role == User.Role.ADMIN
    assert admin.is_staff and admin.is_superuser


# --- auth ------------------------------------------------------------------

def test_login_returns_tokens(api, member):
    res = api.post("/api/auth/login", {"email": "m@example.com", "password": "pw-strong-123"}, format="json")
    assert res.status_code == 200
    assert "access" in res.data and "refresh" in res.data


def test_login_wrong_password_rejected(api, member):
    res = api.post("/api/auth/login", {"email": "m@example.com", "password": "nope"}, format="json")
    assert res.status_code == 401


def test_login_unknown_email_rejected(api, db):
    res = api.post("/api/auth/login", {"email": "ghost@example.com", "password": "x"}, format="json")
    assert res.status_code == 401


def test_refresh_issues_new_access(api, member):
    login = api.post("/api/auth/login", {"email": "m@example.com", "password": "pw-strong-123"}, format="json")
    res = api.post("/api/auth/refresh", {"refresh": login.data["refresh"]}, format="json")
    assert res.status_code == 200
    assert "access" in res.data


# --- /api/me ---------------------------------------------------------------

def test_me_requires_auth(api):
    res = api.get("/api/me")
    assert res.status_code == 401


def test_me_returns_current_user(api, member):
    auth(api, member)
    res = api.get("/api/me")
    assert res.status_code == 200
    assert res.data["email"] == "m@example.com"
    assert res.data["is_admin"] is False
    # stable tree shape exists even before projects/grants are built
    assert "tree" in res.data
    assert "projects" in res.data["tree"]


def test_me_reflects_admin_role(api, admin):
    auth(api, admin)
    res = api.get("/api/me")
    assert res.data["is_admin"] is True


# --- group model -----------------------------------------------------------

def test_group_membership_is_many_to_many(db, member, admin):
    g = Group.objects.create(name="Seva Volunteers")
    g.members.add(member, admin)
    assert g.members.count() == 2
    assert member.member_groups.filter(name="Seva Volunteers").exists()


# --- users endpoint --------------------------------------------------------

def test_users_endpoint_lists_active_users_with_access(api, admin, member):
    from permissions.models import AccessGrant
    from projects.models import Project, SubProject

    sp = SubProject.objects.create(project=Project.objects.create(name="P"), name="SP")
    AccessGrant.objects.create(user=member, subproject=sp, level="member")
    auth(api, admin)
    res = api.get("/api/users")
    assert res.status_code == 200
    by_email = {u["email"]: u for u in res.data}
    # member sees the granted sub-project; admin sees all
    assert sp.id in by_email["m@example.com"]["subproject_ids"]
    assert sp.id in by_email["a@example.com"]["subproject_ids"]


def test_users_requires_auth(api):
    assert api.get("/api/users").status_code == 401


def test_users_endpoint_without_org_context_denies_ordinary_member(api, member):
    # With no X-Org-Id header (org=None), an ordinary authenticated user must NOT
    # fall back to "every active user on the platform" — only the platform
    # superuser retains that pre-tenancy legacy view (see the branch below).
    auth(api, member)
    res = api.get("/api/users")
    assert res.status_code == 200
    assert res.data == []


def test_users_endpoint_without_org_context_still_works_for_superuser(api, admin, member):
    # Preserves the pre-tenancy legacy behavior this test suite already relies on
    # (test_users_endpoint_lists_active_users_with_access) for the platform owner.
    auth(api, admin)
    res = api.get("/api/users")
    assert res.status_code == 200
    emails = {u["email"] for u in res.data}
    assert {"a@example.com", "m@example.com"} <= emails


# --- member management (admin) ---------------------------------------------

def test_admin_creates_member_who_can_login(api, admin):
    auth(api, admin)
    res = api.post("/api/users", {"email": "new@example.com", "name": "New", "password": "starterpass1"}, format="json")
    assert res.status_code == 201
    # the new member can now log in
    fresh = APIClient()
    login = fresh.post("/api/auth/login", {"email": "new@example.com", "password": "starterpass1"}, format="json")
    assert login.status_code == 200


def test_create_member_requires_password(api, admin):
    auth(api, admin)
    res = api.post("/api/users", {"email": "x@example.com", "name": "X"}, format="json")
    assert res.status_code == 400


def test_member_cannot_create_member(api, member):
    auth(api, member)
    res = api.post("/api/users", {"email": "x@example.com", "name": "X", "password": "starterpass1"}, format="json")
    assert res.status_code == 403


def test_admin_can_promote_member(api, admin, member):
    auth(api, admin)
    res = api.patch(f"/api/users/{member.id}", {"role": "admin"}, format="json")
    assert res.status_code == 200
    member.refresh_from_db()
    # 2026-07-19 security fix: the deprecated global `role` field still moves
    # (legacy/no-org-header fallback + display), but is_staff/is_superuser —
    # the REAL Django platform-superuser flags — must never be derived from
    # it. Promoting a team member to org-admin used to also grant them real
    # platform-wide power (see permissions/test_cross_org_writes.py for the
    # dedicated regression test).
    assert member.is_admin
    assert member.is_staff is False
    assert member.is_superuser is False


def test_admin_cannot_demote_self(api, admin):
    auth(api, admin)
    res = api.patch(f"/api/users/{admin.id}", {"role": "member"}, format="json")
    assert res.status_code == 403


# --- groups (admin) --------------------------------------------------------

def test_admin_creates_group_with_members(api, admin, member):
    auth(api, admin)
    res = api.post("/api/groups", {"name": "Alliance", "member_ids": [member.id]}, format="json")
    assert res.status_code == 201
    g = Group.objects.get(name="Alliance")
    assert member in g.members.all()


def test_member_cannot_manage_groups(api, member):
    auth(api, member)
    assert api.get("/api/groups").status_code == 403
    assert api.post("/api/groups", {"name": "X"}, format="json").status_code == 403
