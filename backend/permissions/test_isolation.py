"""Multi-tenant isolation: the engine must scope strictly to the given org, gate
on active membership (a stray cross-org grant must NOT leak), keep org admins
inside their own org, let a superuser see across orgs, and read tier from the
per-org membership."""

import pytest
from rest_framework.test import APIClient

from accounts.models import Membership, Organization, Tier, User
from permissions.engine import access_map, can_act_as_member, is_org_admin, visible_tasks_q
from permissions.models import AccessGrant
from projects.models import Project, SubProject
from tasks.models import Task


def make_org(name):
    return Organization.objects.create(name=name, is_active=True)


def make_member(email, org, role="member", tier=None):
    u = User.objects.create_user(email=email, name=email.split("@")[0], password="pw-strong-123")
    Membership.objects.create(user=u, organization=org, role=role, tier=tier)
    return u


def project_with_sub(org, name):
    p = Project.objects.create(name=name, organization=org)
    sp = SubProject.objects.create(project=p, name=f"{name} SP")
    return p, sp


def vis(user, org):
    return set(Task.objects.filter(visible_tasks_q(user, org)).distinct().values_list("id", flat=True))


@pytest.fixture
def two_orgs(db):
    return make_org("Ananda LA"), make_org("Ananda Assisi")


def test_member_sees_only_their_org(two_orgs):
    a, b = two_orgs
    _, spa = project_with_sub(a, "A")
    _, spb = project_with_sub(b, "B")
    ta = Task.objects.create(subproject=spa, title="task A")
    Task.objects.create(subproject=spb, title="task B")
    sub_va = Tier.objects.create(organization=a, name="Sub-Project Only", default_sees="subproject")
    m = make_member("m@x.com", a, tier=sub_va)
    AccessGrant.objects.create(user=m, subproject=spa, level="member", sees="subproject")
    assert spa.id in access_map(m, a)
    assert vis(m, a) == {ta.id}
    # Fully blind to org B.
    assert access_map(m, b) == {}
    assert vis(m, b) == set()


def test_membership_gate_beats_stray_grant(two_orgs):
    a, b = two_orgs
    _, spb = project_with_sub(b, "B")
    Task.objects.create(subproject=spb, title="task B")
    m = make_member("m@x.com", a)  # member of A only
    # A grant mistakenly pointing into org B must NOT leak without a membership.
    AccessGrant.objects.create(user=m, subproject=spb, level="member", sees="subproject")
    assert access_map(m, b) == {}
    assert vis(m, b) == set()


def test_org_admin_scoped_to_their_org(two_orgs):
    a, b = two_orgs
    _, spa = project_with_sub(a, "A")
    project_with_sub(b, "B")
    admin_a = make_member("admin@x.com", a, role="admin")
    assert is_org_admin(admin_a, a) is True
    assert is_org_admin(admin_a, b) is False
    assert spa.id in access_map(admin_a, a)   # admin sees all of A's sub-projects
    assert access_map(admin_a, b) == {}        # but is nothing in B


def test_superuser_has_no_cross_org_data_access(two_orgs):
    # Ethical boundary: the platform owner is NOT an org god. With no membership
    # they see no org's data and are admin of nothing — org contents stay private.
    # (Metadata-only stats come from the platform endpoint instead.)
    a, b = two_orgs
    project_with_sub(a, "A")
    project_with_sub(b, "B")
    su = User.objects.create_superuser(email="root@x.com", name="Root", password="pw-strong-123")
    assert is_org_admin(su, a) is False and is_org_admin(su, b) is False
    assert access_map(su, a) == {} and access_map(su, b) == {}
    assert vis(su, a) == set() and vis(su, b) == set()


def test_org_admin_can_only_act_in_their_own_org(two_orgs):
    a, b = two_orgs
    _, spa = project_with_sub(a, "A")
    _, spb = project_with_sub(b, "B")
    admin_a = make_member("admin@a.com", a, role="admin")
    assert can_act_as_member(admin_a, spa.id, a) is True       # own org
    assert can_act_as_member(admin_a, spb.id, a) is False      # another org's sub-project


def test_org_admin_task_list_api_is_scoped_to_their_org(two_orgs):
    # The bug this guards: an org admin's GET /api/tasks must NOT return other
    # orgs' tasks (the view used to skip the engine filter for admins).
    a, b = two_orgs
    _, spa = project_with_sub(a, "A")
    _, spb = project_with_sub(b, "B")
    Task.objects.create(subproject=spa, title="task in A")
    Task.objects.create(subproject=spb, title="task in B")
    admin_a = make_member("admin@a.com", a, role="admin")
    api = APIClient()
    res = api.post("/api/auth/login", {"email": admin_a.email, "password": "pw-strong-123"}, format="json")
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    r = api.get("/api/tasks", HTTP_X_ORG_ID=str(a.id))
    assert r.status_code == 200
    assert {t["title"] for t in r.data} == {"task in A"}


def test_tier_is_read_from_membership_per_org(two_orgs):
    a, _ = two_orgs
    _, spa = project_with_sub(a, "A")
    t = Task.objects.create(subproject=spa, title="x")
    tier = Tier.objects.create(organization=a, name="Coordinator")
    AccessGrant.objects.create(tier=tier, subproject=spa, level="member", sees="subproject")
    m = make_member("m@x.com", a)  # no tier yet
    assert vis(m, a) == set()
    mem = m.memberships.get(organization=a)
    mem.tier = tier
    mem.save(update_fields=["tier"])
    assert vis(m, a) == {t.id}  # tier inherited live, scoped to the org
