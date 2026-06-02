import pytest
from rest_framework.test import APIClient

from accounts.models import Group, User
from permissions.engine import (
    can_act_as_member,
    level_for_subproject,
    visible_project_ids,
    visible_subproject_ids,
    visible_subprojects,
)
from permissions.models import AccessGrant
from permissions.tree import visible_tree
from projects.models import Project, SubProject


# --- fixtures ---------------------------------------------------------------

@pytest.fixture
def admin(db):
    return User.objects.create_superuser(email="a@example.com", name="Ada", password="pw-strong-123")


@pytest.fixture
def member(db):
    return User.objects.create_user(email="m@example.com", name="Mara", password="pw-strong-123")


@pytest.fixture
def karuna(db):
    """Project with default 'General' + Marketing + Warehouse sub-projects."""
    p = Project.objects.create(name="Karuna Devi")
    mk = SubProject.objects.create(project=p, name="Marketing")
    wh = SubProject.objects.create(project=p, name="Warehouse")
    return {"project": p, "general": p.subprojects.get(is_default=True), "marketing": mk, "warehouse": wh}


def grant(user=None, group=None, subproject=None, project=None, level="member"):
    return AccessGrant.objects.create(
        user=user, group=group, subproject=subproject, project=project, level=level
    )


def login(user):
    api = APIClient()
    res = api.post("/api/auth/login", {"email": user.email, "password": "pw-strong-123"}, format="json")
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    return api


# --- no grants → nothing ----------------------------------------------------

def test_no_grant_user_sees_nothing(member, karuna):
    assert visible_subprojects(member) == {}
    assert visible_subproject_ids(member) == []
    assert visible_project_ids(member) == []
    assert visible_tree(member) == {"projects": [], "show_global_overview": False}


# --- admin sees all ---------------------------------------------------------

def test_admin_sees_all_at_member_level(admin, karuna):
    vis = visible_subprojects(admin)
    assert set(vis.keys()) == {karuna["general"].id, karuna["marketing"].id, karuna["warehouse"].id}
    assert all(level == "member" for level in vis.values())


# --- single sub-project: no overview tabs -----------------------------------

def test_one_subproject_user_no_overviews(member, karuna):
    grant(user=member, subproject=karuna["marketing"], level="member")
    tree = visible_tree(member)
    assert len(tree["projects"]) == 1
    proj = tree["projects"][0]
    assert proj["show_project_overview"] is False
    assert tree["show_global_overview"] is False
    assert [sp["name"] for sp in proj["subprojects"]] == ["Marketing"]


# --- no cross-leak ----------------------------------------------------------

def test_marketing_only_user_never_sees_warehouse(member, karuna):
    grant(user=member, subproject=karuna["marketing"], level="member")
    ids = visible_subproject_ids(member)
    assert karuna["warehouse"].id not in ids
    assert karuna["general"].id not in ids


# --- project visibility -----------------------------------------------------

def test_project_visible_with_one_subproject(member, karuna):
    grant(user=member, subproject=karuna["marketing"], level="viewer")
    assert visible_project_ids(member) == [karuna["project"].id]


def test_project_overview_when_two_subprojects(member, karuna):
    grant(user=member, subproject=karuna["marketing"], level="member")
    grant(user=member, subproject=karuna["warehouse"], level="member")
    tree = visible_tree(member)
    assert tree["projects"][0]["show_project_overview"] is True
    assert tree["show_global_overview"] is False


def test_global_overview_when_two_projects(member, karuna):
    other = Project.objects.create(name="Alliance Electric")
    grant(user=member, subproject=karuna["marketing"], level="member")
    grant(user=member, subproject=other.subprojects.first(), level="viewer")
    tree = visible_tree(member)
    assert tree["show_global_overview"] is True
    assert len(tree["projects"]) == 2


# --- most-permissive wins ---------------------------------------------------

def test_direct_viewer_plus_group_member_is_member(member, karuna):
    g = Group.objects.create(name="Alliance")
    g.members.add(member)
    grant(user=member, subproject=karuna["marketing"], level="viewer")
    grant(group=g, subproject=karuna["marketing"], level="member")
    assert visible_subprojects(member)[karuna["marketing"].id] == "member"


def test_no_double_listing_overlapping_grants(member, karuna):
    g = Group.objects.create(name="Alliance")
    g.members.add(member)
    grant(user=member, subproject=karuna["marketing"], level="member")
    grant(group=g, subproject=karuna["marketing"], level="member")
    names = [sp["name"] for sp in visible_tree(member)["projects"][0]["subprojects"]]
    assert names.count("Marketing") == 1


def test_two_groups_conflict_resolves_most_permissive(member, karuna):
    g1 = Group.objects.create(name="G1")
    g2 = Group.objects.create(name="G2")
    g1.members.add(member)
    g2.members.add(member)
    grant(group=g1, subproject=karuna["warehouse"], level="viewer")
    grant(group=g2, subproject=karuna["warehouse"], level="member")
    assert level_for_subproject(member, karuna["warehouse"].id) == "member"


# --- stale membership -------------------------------------------------------

def test_remove_from_group_revokes_access_immediately(member, karuna):
    g = Group.objects.create(name="Seva")
    g.members.add(member)
    grant(group=g, subproject=karuna["warehouse"], level="member")
    assert karuna["warehouse"].id in visible_subproject_ids(member)
    g.members.remove(member)
    assert karuna["warehouse"].id not in visible_subproject_ids(member)


# --- whole-project grants ---------------------------------------------------

def test_whole_project_grant_covers_all_and_future(member, karuna):
    grant(user=member, project=karuna["project"], level="member")
    ids = set(visible_subproject_ids(member))
    assert ids == {karuna["general"].id, karuna["marketing"].id, karuna["warehouse"].id}
    shipping = SubProject.objects.create(project=karuna["project"], name="Shipping")
    assert shipping.id in visible_subproject_ids(member)  # auto-covered, computed live


def test_whole_project_grant_via_group(member, karuna):
    g = Group.objects.create(name="Alliance")
    g.members.add(member)
    grant(group=g, project=karuna["project"], level="viewer")
    assert level_for_subproject(member, karuna["marketing"].id) == "viewer"


# --- level helpers ----------------------------------------------------------

def test_can_act_as_member_only_when_member(member, karuna):
    grant(user=member, subproject=karuna["marketing"], level="viewer")
    assert can_act_as_member(member, karuna["marketing"].id) is False
    grant(user=member, subproject=karuna["warehouse"], level="member")
    assert can_act_as_member(member, karuna["warehouse"].id) is True


def test_level_for_hidden_subproject_is_none(member, karuna):
    assert level_for_subproject(member, karuna["warehouse"].id) is None


# --- /api/me integration ----------------------------------------------------

def test_me_endpoint_returns_visible_tree(member, karuna):
    grant(user=member, subproject=karuna["marketing"], level="member")
    me = login(member).get("/api/me")
    assert me.status_code == 200
    assert len(me.data["tree"]["projects"]) == 1
    assert me.data["tree"]["projects"][0]["name"] == "Karuna Devi"


# --- grant API: admin-only + validation -------------------------------------

def test_member_cannot_create_grant(member, karuna):
    out = login(member).post(
        "/api/grants",
        {"user": member.id, "subproject": karuna["marketing"].id, "level": "member"},
        format="json",
    )
    assert out.status_code == 403


def test_admin_creates_grant_and_validation(admin, member, karuna):
    api = login(admin)
    ok = api.post(
        "/api/grants",
        {"user": member.id, "subproject": karuna["marketing"].id, "level": "member"},
        format="json",
    )
    assert ok.status_code == 201
    bad = api.post(
        "/api/grants",
        {"user": member.id, "group": Group.objects.create(name="X").id,
         "subproject": karuna["marketing"].id, "level": "member"},
        format="json",
    )
    assert bad.status_code == 400
    bad2 = api.post("/api/grants", {"user": member.id, "level": "member"}, format="json")
    assert bad2.status_code == 400
