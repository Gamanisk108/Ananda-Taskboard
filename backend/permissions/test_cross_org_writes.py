"""Cross-tenant WRITE isolation: for every place a client-supplied id can point
at another organization's row (sub-project reparent, access grants/exclusions,
bulk move/assign, task approve/reject, user edit, restore points, audit log),
an org's admin must never be able to reach or affect org B via org A's
credentials. Companion to test_api_isolation.py, which covers READS.

Regression coverage for the 2026-07-19 deep security audit
(_sec-fix-briefs.json / DEEP-audit-report.md, ananda-taskboard section).
"""

from datetime import date, timedelta

import pytest

from accounts.models import Membership, User
from permissions.models import AuditLog
from permissions.test_api_isolation import build_org, _client
from projects.models import SubProject
from tasks.models import Task

PW = "pw-strong-123"


@pytest.fixture
def worlds(db):
    d = date.today() + timedelta(days=3)
    return build_org("AAA", d), build_org("BBB", d)


def _named_subproject(world):
    """The org's real (non-default) sub-project, e.g. 'AAA-Sub'."""
    return SubProject.objects.filter(project__organization=world["org"], is_default=False).get()


# --- restore points: platform-superuser-only safe closure --------------------

def test_org_admin_cannot_use_restore_points(worlds):
    """2026-07-19 critical fix #1: restore points have zero org scoping (a
    restore hard-deletes+replaces EVERY org's board), so — until the full
    per-org migration lands — the endpoint is locked to the platform
    superuser only. An ordinary org admin (not a Django superuser) must be
    refused outright, not merely scoped."""
    A, _B = worlds
    api = _client(A["admin"])
    h = {"HTTP_X_ORG_ID": str(A["org"].id)}
    assert api.get("/api/restore-points", **h).status_code == 403
    assert api.post("/api/restore-points", {"label": "x"}, format="json", **h).status_code == 403


# --- UserDetailView.patch: target must be a member of the caller's org ------

def test_org_admin_cannot_patch_foreign_org_user(worlds):
    """2026-07-19 critical fix #2: PATCH /api/users/<pk> only ever used the
    caller-vs-target Membership lookup to special-case the OWNER role — a
    target user who simply isn't a member of the active org sailed straight
    through to the writable `password`/`role`/`is_active` serializer. Any
    org admin could reset the password of (or otherwise mutate) any user
    account on the platform by guessing a sequential id."""
    A, B = worlds
    api = _client(A["admin"])
    h = {"HTTP_X_ORG_ID": str(A["org"].id)}
    old_hash = B["member"].password
    res = api.patch(
        f"/api/users/{B['member'].id}",
        {"password": "hacked-password-123", "role": "admin"},
        format="json", **h,
    )
    assert res.status_code == 404
    B["member"].refresh_from_db()
    assert B["member"].password == old_hash
    assert B["member"].role == User.Role.MEMBER


# --- is_staff/is_superuser must never come from the org-scoped `role` field --

def test_promoting_member_never_grants_platform_superuser(worlds):
    """2026-07-19 critical fix (companion to #2): promoting a team member to
    org-admin used to set the REAL Django is_staff/is_superuser flags, which
    grant platform-wide power far beyond the promoter's own org."""
    A, _B = worlds
    api = _client(A["admin"])
    h = {"HTTP_X_ORG_ID": str(A["org"].id)}
    res = api.patch(f"/api/users/{A['member'].id}", {"role": "admin"}, format="json", **h)
    assert res.status_code == 200
    A["member"].refresh_from_db()
    assert A["member"].role == User.Role.ADMIN  # the per-org concept still works
    assert A["member"].is_staff is False
    assert A["member"].is_superuser is False


# --- task approve/reject must be org-scoped, not just "some org's admin" ----

def test_org_admin_cannot_approve_or_reject_foreign_org_task(worlds):
    """2026-07-19 critical fix #3: approve/reject fetched the task with a raw,
    unscoped Task.objects.filter(pk=pk) — IsAdmin only proves the caller
    admins SOME org, not that this task's org is theirs."""
    A, B = worlds
    api = _client(A["admin"])
    h = {"HTTP_X_ORG_ID": str(A["org"].id)}
    assert api.post(f"/api/tasks/{B['pending_task']}/approve", {}, format="json", **h).status_code == 404
    assert api.post(f"/api/tasks/{B['pending_task']}/reject", {}, format="json", **h).status_code == 404
    unchanged = Task.objects.get(pk=B["pending_task"])
    assert unchanged.approval_state == Task.Approval.PENDING


# --- audit log must be scoped, not global -----------------------------------

def test_audit_log_does_not_leak_other_org(worlds):
    """2026-07-19 high fix: GET /api/audit had no organization filter at all —
    any org's local admin read every organization's permission/security
    events (names, emails, role changes)."""
    A, B = worlds
    api_b = _client(B["admin"])
    hb = {"HTTP_X_ORG_ID": str(B["org"].id)}
    # A distinctive action in org B that lands in the audit log.
    api_b.patch(f"/api/users/{B['member'].id}", {"role": "admin"}, format="json", **hb)
    assert AuditLog.objects.filter(organization=B["org"]).exists()

    api_a = _client(A["admin"])
    ha = {"HTTP_X_ORG_ID": str(A["org"].id)}
    feed = api_a.get("/api/audit", **ha)
    assert feed.status_code == 200
    assert all(B["tag"] not in row["summary"] for row in feed.data), \
        f"org A's audit feed leaked an org B entry: {feed.data}"


# --- bulk move / assign must validate the DESTINATION, not just the source --

def test_bulk_move_cannot_transplant_task_into_foreign_org(worlds):
    """2026-07-19 high fix: BulkTasksView 'move' only org-scoped the SOURCE
    tasks; the destination sub-project id was never checked, letting an
    admin relocate their own task into another tenant's sub-project tree."""
    A, B = worlds
    api = _client(A["admin"])
    h = {"HTTP_X_ORG_ID": str(A["org"].id)}
    dest = _named_subproject(B)
    res = api.post(
        "/api/tasks/bulk",
        {"ids": [A["approved_task"]], "action": "move", "value": dest.id},
        format="json", **h,
    )
    assert res.status_code == 400
    unchanged = Task.objects.get(pk=A["approved_task"])
    assert unchanged.subproject_id != dest.id


def test_bulk_assign_cannot_assign_foreign_org_user(worlds):
    """2026-07-19 high fix: bulk 'assign' set assignees straight from the
    client-supplied ids with no org check, letting a task be handed to (and
    push-notified) a user outside the org."""
    A, B = worlds
    api = _client(A["admin"])
    h = {"HTTP_X_ORG_ID": str(A["org"].id)}
    res = api.post(
        "/api/tasks/bulk",
        {"ids": [A["approved_task"]], "action": "assign", "value": [B["member"].id]},
        format="json", **h,
    )
    assert res.status_code == 400
    unchanged = Task.objects.get(pk=A["approved_task"])
    assert B["member"] not in unchanged.assignees.all()


# --- task/subtask assignees must be org members ------------------------------

def test_task_create_rejects_foreign_org_assignee(worlds):
    A, B = worlds
    api = _client(A["admin"])
    h = {"HTTP_X_ORG_ID": str(A["org"].id)}
    sp = _named_subproject(A)
    res = api.post(
        "/api/tasks",
        {"subproject": sp.id, "title": "Cross-org assignee", "assignees": [B["member"].id]},
        format="json", **h,
    )
    assert res.status_code == 400


# --- sub-project reparenting must stay inside the active org ----------------

def test_subproject_cannot_be_reparented_into_foreign_org_project(worlds):
    """2026-07-19 critical fix: SubProjectSerializer's `project` field was an
    unrestricted PrimaryKeyRelatedField — an admin could reparent (or create)
    a sub-project under another organization's project."""
    A, B = worlds
    api = _client(A["admin"])
    h = {"HTTP_X_ORG_ID": str(A["org"].id)}
    sp = _named_subproject(A)
    foreign_project_id = list(B["project_ids"])[0]
    res = api.patch(f"/api/subprojects/{sp.id}", {"project": foreign_project_id}, format="json", **h)
    assert res.status_code == 400
    sp.refresh_from_db()
    assert sp.project.organization_id == A["org"].id

    create_res = api.post(
        "/api/subprojects", {"project": foreign_project_id, "name": "Sneaky"}, format="json", **h,
    )
    assert create_res.status_code == 400


# --- access grants / exclusions must target the active org ------------------

def test_access_grant_cannot_target_foreign_org_subproject(worlds):
    A, B = worlds
    api = _client(A["admin"])
    h = {"HTTP_X_ORG_ID": str(A["org"].id)}
    dest = _named_subproject(B)
    res = api.post(
        "/api/grants",
        {"user": A["member"].id, "subproject": dest.id, "level": "member", "sees": "subproject"},
        format="json", **h,
    )
    assert res.status_code == 400


def test_access_grant_cannot_target_foreign_org_user(worlds):
    A, B = worlds
    api = _client(A["admin"])
    h = {"HTTP_X_ORG_ID": str(A["org"].id)}
    sp = _named_subproject(A)
    res = api.post(
        "/api/grants",
        {"user": B["member"].id, "subproject": sp.id, "level": "member", "sees": "subproject"},
        format="json", **h,
    )
    assert res.status_code == 400


def test_exclusion_cannot_target_foreign_org_task(worlds):
    A, B = worlds
    api = _client(A["admin"])
    h = {"HTTP_X_ORG_ID": str(A["org"].id)}
    res = api.post(
        "/api/exclusions",
        {"user": A["member"].id, "excluded_task": B["pending_task"]},
        format="json", **h,
    )
    assert res.status_code == 400


# --- group-chat daily summary must stay inside the active org ---------------

def test_groupchat_summary_does_not_leak_other_org(worlds):
    """2026-07-19 critical fix: build_summary_text gated on the DEPRECATED
    global `user.is_admin` (true for an admin of ANY org) and, even for a
    non-admin, called visible_tasks_q(user) with no org — merging visibility
    across every org the caller belongs to."""
    A, B = worlds
    api = _client(A["admin"])
    h = {"HTTP_X_ORG_ID": str(A["org"].id)}
    day = Task.objects.get(pk=A["approved_task"]).deadline or date.today()
    res = api.get(f"/api/summary/groupchat?date={day.isoformat()}", **h)
    assert res.status_code == 200
    assert A["tag"] in res.data["text"], f"vacuous test — org A's own task never showed up: {res.data['text']}"
    assert B["tag"] not in res.data["text"]
