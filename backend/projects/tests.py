import pytest
from rest_framework.test import APIClient

from accounts.models import User
from projects.models import PALETTE, Project, SubProject


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def admin(db):
    return User.objects.create_superuser(email="a@example.com", name="Ada", password="pw-strong-123")


@pytest.fixture
def member(db):
    return User.objects.create_user(email="m@example.com", name="Mara", password="pw-strong-123")


def auth(api, user):
    res = api.post("/api/auth/login", {"email": user.email, "password": "pw-strong-123"}, format="json")
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")


# --- default sub-project ----------------------------------------------------

def test_project_gets_default_subproject(db):
    p = Project.objects.create(name="Karuna Devi")
    defaults = p.subprojects.filter(is_default=True)
    assert defaults.count() == 1
    assert defaults.first().name == "General"


def test_only_one_default_subproject_enforced(db):
    p = Project.objects.create(name="Sunday Service")
    from django.db import IntegrityError, transaction

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            SubProject.objects.create(project=p, name="Another", is_default=True)


# --- color auto-assignment --------------------------------------------------

def test_project_color_auto_assigned_from_palette(db):
    p = Project.objects.create(name="Alliance Electric")
    assert p.color in PALETTE


def test_distinct_projects_get_distinct_colors_until_exhaustion(db):
    colors = {Project.objects.create(name=f"P{i}").color for i in range(len(PALETTE))}
    assert len(colors) == len(PALETTE)  # all distinct before cycling


def test_explicit_color_respected(db):
    p = Project.objects.create(name="Custom", color="#123456")
    assert p.color == "#123456"


# --- API: admin write, member read-only ------------------------------------

def test_admin_can_create_project(api, admin):
    auth(api, admin)
    res = api.post("/api/projects", {"name": "Class Series"}, format="json")
    assert res.status_code == 201
    assert any(sp["is_default"] for sp in res.data["subprojects"])


def test_member_cannot_create_project(api, member):
    auth(api, member)
    res = api.post("/api/projects", {"name": "Nope"}, format="json")
    assert res.status_code == 403


def test_unauthenticated_cannot_list_projects(api, db):
    res = api.get("/api/projects")
    assert res.status_code == 401


def test_admin_sees_all_projects(api, admin, db):
    Project.objects.create(name="P1")
    Project.objects.create(name="P2")
    auth(api, admin)
    res = api.get("/api/projects")
    assert res.status_code == 200
    assert len(res.data) == 2


def test_member_sees_no_projects_without_grants(api, member, db):
    # Pre-step-4: members have no grants yet, so they see nothing (no leak).
    Project.objects.create(name="P1")
    auth(api, member)
    res = api.get("/api/projects")
    assert res.status_code == 200
    assert res.data == []


def test_admin_can_toggle_members_post_without_approval(api, admin, db):
    p = Project.objects.create(name="Karuna Devi")
    sp = p.subprojects.first()
    auth(api, admin)
    res = api.patch(f"/api/subprojects/{sp.id}", {"members_post_without_approval": True}, format="json")
    assert res.status_code == 200
    sp.refresh_from_db()
    assert sp.members_post_without_approval is True
