"""D50/APR-4: a member's own pending task never vanishes from their board,
and /api/approvals/mine lists their submissions awaiting review."""

import pytest
from rest_framework.test import APIClient

from accounts.models import Membership, Organization, User
from permissions.models import AccessGrant
from projects.models import Project, SubProject
from tasks.models import Task


@pytest.fixture
def api():
    return APIClient()

def auth(api, user):
    res = api.post("/api/auth/login", {"email": user.email, "password": "pw-strong-123"}, format="json")
    assert res.status_code == 200
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    return api


@pytest.fixture
def world(db):
    org = Organization.objects.create(name="Ananda LA", is_active=True)
    admin = User.objects.create_user(email="a@x.com", name="Ada", password="pw-strong-123")
    mara = User.objects.create_user(email="m@x.com", name="Mara", password="pw-strong-123")
    omar = User.objects.create_user(email="o@x.com", name="Omar", password="pw-strong-123")
    Membership.objects.create(user=admin, organization=org, role="admin")
    Membership.objects.create(user=mara, organization=org, role="member")
    Membership.objects.create(user=omar, organization=org, role="member")
    proj = Project.objects.create(organization=org, name="P")
    sub = SubProject.objects.create(project=proj, name="S")  # not trusted → member posts go pending
    AccessGrant.objects.create(user=mara, subproject=sub, level="member")
    AccessGrant.objects.create(user=omar, subproject=sub, level="member")
    live = Task.objects.create(subproject=sub, title="Live", approval_state=Task.Approval.APPROVED, created_by=admin)
    pend = Task.objects.create(subproject=sub, title="Mara pending", approval_state=Task.Approval.PENDING, created_by=mara)
    return {"org": org, "admin": admin, "mara": mara, "omar": omar, "sub": sub, "live": live, "pend": pend}


def titles(res):
    return {t["title"] for t in res.data}


def get(api, world, path):
    return api.get(path, HTTP_X_ORG_ID=str(world["org"].id))


def test_own_pending_task_stays_on_the_board(api, world):
    auth(api, world["mara"])
    res = get(api, world, "/api/tasks")
    assert titles(res) == {"Live", "Mara pending"}
    row = next(t for t in res.data if t["title"] == "Mara pending")
    assert row["approval_state"] == "pending"


def test_other_members_do_not_see_someone_elses_pending(api, world):
    auth(api, world["omar"])
    assert titles(get(api, world, "/api/tasks")) == {"Live"}


def test_admin_board_does_not_gain_pending_rows(api, world):
    # Admins keep their inbox-driven flow: the board stays approved-only
    # (their own submissions are auto-approved anyway).
    auth(api, world["admin"])
    assert titles(get(api, world, "/api/tasks")) == {"Live"}


def test_rejected_tasks_stay_off_the_board(api, world):
    world["pend"].approval_state = Task.Approval.REJECTED
    world["pend"].save(update_fields=["approval_state"])
    auth(api, world["mara"])
    assert titles(get(api, world, "/api/tasks")) == {"Live"}


def test_approvals_mine_lists_only_my_pending(api, world):
    Task.objects.create(subproject=world["sub"], title="Omar pending",
                        approval_state=Task.Approval.PENDING, created_by=world["omar"])
    auth(api, world["mara"])
    res = get(api, world, "/api/approvals/mine")
    assert res.status_code == 200
    assert titles(res) == {"Mara pending"}


def test_approvals_mine_empty_for_admin(api, world):
    auth(api, world["admin"])
    assert get(api, world, "/api/approvals/mine").data == []
