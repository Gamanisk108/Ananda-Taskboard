"""Task-level visibility: the "sees" breadth (own/subproject/project), exclusions
(deny > assignment > allow), and live tier inheritance — all via the engine's
visible_tasks_q / access_map, plus a couple of admin-API smoke checks."""

import pytest
from rest_framework.test import APIClient

from accounts.models import Group, Tier, User
from permissions.engine import access_map, visible_subproject_ids, visible_tasks_q
from permissions.models import AccessGrant, Exclusion
from projects.models import Project, SubProject
from tasks.models import Task


# --- fixtures ---------------------------------------------------------------

@pytest.fixture
def admin(db):
    return User.objects.create_superuser(email="a@example.com", name="Ada", password="pw-strong-123")


@pytest.fixture
def member(db):
    return User.objects.create_user(email="m@example.com", name="Mara", password="pw-strong-123")


@pytest.fixture
def other(db):
    return User.objects.create_user(email="o@example.com", name="Omar", password="pw-strong-123")


@pytest.fixture
def karuna(db):
    p = Project.objects.create(name="Karuna Devi")
    mk = SubProject.objects.create(project=p, name="Marketing")
    wh = SubProject.objects.create(project=p, name="Warehouse")
    return {"project": p, "general": p.subprojects.get(is_default=True), "marketing": mk, "warehouse": wh}


def grant(*, user=None, group=None, tier=None, subproject=None, project=None, level="member", sees="subproject"):
    return AccessGrant.objects.create(
        user=user, group=group, tier=tier, subproject=subproject, project=project, level=level, sees=sees
    )


def view_access(user, sees):
    """Set the member's single View Access breadth (own/subproject/project/org) by
    assigning them a tier with that `default_sees`. This — not per-grant sees — is
    what the engine reads for how many tasks a member can see."""
    tier = Tier.objects.create(name=f"VA-{sees}-{user.id}", default_sees=sees)
    user.tier = tier
    user.save(update_fields=["tier"])
    return tier


def task(sp, title, *, assignees=(), groups=()):
    t = Task.objects.create(subproject=sp, title=title)
    if assignees:
        t.assignees.set(assignees)
    if groups:
        t.assignee_groups.set(groups)
    return t


def visible_ids(user):
    return set(Task.objects.filter(visible_tasks_q(user)).distinct().values_list("id", flat=True))


def login(user):
    api = APIClient()
    res = api.post("/api/auth/login", {"email": user.email, "password": "pw-strong-123"}, format="json")
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    return api


# --- sees breadth -----------------------------------------------------------

def test_admin_sees_every_task(admin, member, karuna):
    t1 = task(karuna["marketing"], "A")
    t2 = task(karuna["warehouse"], "B")
    assert visible_ids(admin) == {t1.id, t2.id}


def test_no_grant_sees_no_tasks(member, karuna):
    task(karuna["marketing"], "A")
    assert visible_ids(member) == set()


def test_assignment_alone_confers_visibility(member, karuna):
    # No grant anywhere, but assigned to a task → must see exactly that task (never an
    # "orphaned assignment" where someone is handed invisible work).
    mine = task(karuna["marketing"], "assigned to me", assignees=[member])
    task(karuna["marketing"], "not mine")
    assert visible_ids(member) == {mine.id}


def test_group_assignment_alone_confers_visibility(member, karuna):
    g = Group.objects.create(name="Seva")
    g.members.add(member)
    via_group = task(karuna["marketing"], "group task", groups=[g])
    task(karuna["marketing"], "unrelated")
    assert visible_ids(member) == {via_group.id}


def test_assignment_visibility_still_loses_to_deny(member, karuna):
    # deny > assignment, even with no grant in play.
    t = task(karuna["marketing"], "assigned but denied", assignees=[member])
    Exclusion.objects.create(user=member, excluded_task=t)
    assert visible_ids(member) == set()


def test_sees_subproject_shows_all_tasks_in_scope(member, karuna):
    grant(user=member, subproject=karuna["marketing"])
    view_access(member, "subproject")
    mine = task(karuna["marketing"], "mine", assignees=[member])
    theirs = task(karuna["marketing"], "theirs")
    other_sp = task(karuna["warehouse"], "elsewhere")
    assert visible_ids(member) == {mine.id, theirs.id}
    assert other_sp.id not in visible_ids(member)


def test_sees_own_shows_only_assigned(member, other, karuna):
    grant(user=member, subproject=karuna["marketing"])
    view_access(member, "own")
    mine = task(karuna["marketing"], "mine", assignees=[member])
    theirs = task(karuna["marketing"], "theirs", assignees=[other])
    assert visible_ids(member) == {mine.id}
    assert theirs.id not in visible_ids(member)


def test_sees_own_includes_group_assigned(member, karuna):
    g = Group.objects.create(name="Seva")
    g.members.add(member)
    grant(user=member, subproject=karuna["marketing"])
    view_access(member, "own")
    via_group = task(karuna["marketing"], "group task", groups=[g])
    unrelated = task(karuna["marketing"], "nope")
    assert visible_ids(member) == {via_group.id}
    assert unrelated.id not in visible_ids(member)


def test_sees_project_widens_to_sibling_subprojects(member, karuna):
    # member with Full Project view access → can READ tasks in sibling Warehouse too
    grant(user=member, subproject=karuna["marketing"])
    view_access(member, "project")
    here = task(karuna["marketing"], "here")
    sibling = task(karuna["warehouse"], "sibling")
    ids = visible_ids(member)
    assert {here.id, sibling.id} <= ids
    # and the sibling sub-project becomes visible in the access map (read-only)
    amap = access_map(member)
    assert karuna["warehouse"].id in amap
    assert amap[karuna["warehouse"].id]["level"] == "viewer"


# --- exclusions (deny > assignment > allow) ---------------------------------

def test_exclude_task_hides_even_when_assigned(member, karuna):
    grant(user=member, subproject=karuna["marketing"], sees="subproject")
    t = task(karuna["marketing"], "secret", assignees=[member])
    Exclusion.objects.create(user=member, excluded_task=t)
    assert t.id not in visible_ids(member)  # deny beats assignment


def test_exclude_subproject_hides_tasks_and_tree(member, karuna):
    grant(user=member, project=karuna["project"])
    view_access(member, "subproject")
    wh_task = task(karuna["warehouse"], "wh")
    mk_task = task(karuna["marketing"], "mk")
    Exclusion.objects.create(user=member, excluded_subproject=karuna["warehouse"])
    assert visible_ids(member) == {mk_task.id}
    assert karuna["warehouse"].id not in visible_subproject_ids(member)  # gone from the tree too
    assert wh_task.id not in visible_ids(member)


def test_exclude_project_hides_whole_project(member, karuna):
    grant(user=member, project=karuna["project"], sees="subproject")
    task(karuna["marketing"], "mk")
    Exclusion.objects.create(user=member, excluded_project=karuna["project"])
    assert visible_ids(member) == set()
    assert visible_subproject_ids(member) == []


def test_exclude_assignee_hides_their_tasks(member, other, karuna):
    grant(user=member, subproject=karuna["marketing"])
    view_access(member, "subproject")
    with_other = task(karuna["marketing"], "co-assigned", assignees=[other])
    clean = task(karuna["marketing"], "clean")
    Exclusion.objects.create(user=member, excluded_user=other)
    assert visible_ids(member) == {clean.id}
    assert with_other.id not in visible_ids(member)


def test_exclude_assignee_hides_task_even_when_co_assigned_to_me(member, other, karuna):
    # The M2M-negation trap: a task assigned to BOTH me and an excluded person
    # must still be hidden (deny > assignment), not leak via my own assignee row.
    grant(user=member, subproject=karuna["marketing"])
    view_access(member, "subproject")
    co = task(karuna["marketing"], "co-assigned to me + other", assignees=[member, other])
    Exclusion.objects.create(user=member, excluded_user=other)
    assert co.id not in visible_ids(member)


def test_exclude_group_hides_group_assigned_tasks(member, karuna):
    g = Group.objects.create(name="Leadership")
    grant(user=member, subproject=karuna["marketing"])
    view_access(member, "subproject")
    grp_task = task(karuna["marketing"], "leadership only", groups=[g])
    normal = task(karuna["marketing"], "normal")
    Exclusion.objects.create(user=member, excluded_group=g)
    assert visible_ids(member) == {normal.id}
    assert grp_task.id not in visible_ids(member)


# --- tiers: live inheritance + layering -------------------------------------

def test_tier_grant_is_inherited_live(member, karuna):
    tier = Tier.objects.create(name="Coordinator", default_sees="subproject")
    grant(tier=tier, subproject=karuna["marketing"], sees="subproject")
    t = task(karuna["marketing"], "x")
    assert visible_ids(member) == set()  # not on the tier yet
    member.tier = tier
    member.save(update_fields=["tier"])
    assert visible_ids(member) == {t.id}  # inherited immediately


def test_tier_exclusion_applies_to_member(member, karuna):
    tier = Tier.objects.create(name="Volunteer", default_sees="subproject")
    grant(tier=tier, subproject=karuna["marketing"], sees="subproject")
    member.tier = tier
    member.save(update_fields=["tier"])
    hidden = task(karuna["marketing"], "hidden")
    shown = task(karuna["marketing"], "shown")
    Exclusion.objects.create(tier=tier, excluded_task=hidden)
    assert visible_ids(member) == {shown.id}


def test_view_access_is_the_single_breadth_control(member, other, karuna):
    # Breadth comes from the member's ONE View Access level, not per-grant. "own" →
    # only assigned tasks; widening that level to "subproject" surfaces every task in
    # reach, live (no new grant needed).
    grant(user=member, subproject=karuna["marketing"])
    tier = view_access(member, "own")
    theirs = task(karuna["marketing"], "theirs", assignees=[other])
    assert theirs.id not in visible_ids(member)
    tier.default_sees = "subproject"
    tier.save(update_fields=["default_sees"])
    assert theirs.id in visible_ids(member)  # breadth widened live


# --- admin API smoke --------------------------------------------------------

def test_admin_can_crud_tier_and_exclusion(admin, member, karuna):
    api = login(admin)
    tier = api.post("/api/tiers", {"name": "Lead", "default_sees": "project"}, format="json")
    assert tier.status_code == 201
    exc = api.post("/api/exclusions", {"user": member.id, "excluded_subproject": karuna["warehouse"].id}, format="json")
    assert exc.status_code == 201
    # exactly-one-target validation
    bad = api.post("/api/exclusions",
                   {"user": member.id, "excluded_subproject": karuna["warehouse"].id, "excluded_project": karuna["project"].id},
                   format="json")
    assert bad.status_code == 400


def test_member_cannot_touch_tiers_or_exclusions(member):
    api = login(member)
    assert api.get("/api/tiers").status_code in (403, 401)
    assert api.post("/api/exclusions", {"user": member.id, "excluded_task": 1}, format="json").status_code in (403, 401)


# --- audit log --------------------------------------------------------------

def test_grant_and_exclusion_are_audited(admin, member, karuna):
    from permissions.models import AuditLog
    api = login(admin)
    api.post("/api/grants", {"user": member.id, "subproject": karuna["marketing"].id, "level": "member", "sees": "own"}, format="json")
    api.post("/api/exclusions", {"user": member.id, "excluded_subproject": karuna["warehouse"].id}, format="json")
    actions = set(AuditLog.objects.values_list("action", flat=True))
    assert {"grant.create", "exclusion.create"} <= actions
    feed = api.get("/api/audit")
    assert feed.status_code == 200 and len(feed.data) >= 2
    assert all(set(e.keys()) == {"id", "actor", "action", "summary", "created_at"} for e in feed.data)


def test_audit_log_is_admin_only(member):
    assert login(member).get("/api/audit").status_code in (401, 403)
