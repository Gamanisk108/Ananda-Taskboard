"""API-layer multi-tenant isolation: for EVERY org-scoped list endpoint, an org's
admin (and member) must never see another org's rows. These are request→response
tests on purpose — the engine-level tests passed while a view leaked, because the
views had an `if not is_admin` shortcut that skipped the engine for admins.

Intentionally NOT covered (global by design):
  - /api/statuses  — universal Kanban columns, shared across all orgs by design.
"""

from datetime import date, timedelta

import pytest
from rest_framework.test import APIClient

from accounts.models import Group, Membership, Organization, Tier, User
from permissions.models import AccessGrant, Exclusion
from projects.models import Project, SubProject
from tasks.models import CalendarEvent, Comment, Subtask, Task

PW = "pw-strong-123"


def build_org(tag, deadline):
    org = Organization.objects.create(name=f"{tag}-Org", city=f"{tag}-City", country="X", is_active=True)
    proj = Project.objects.create(name=f"{tag}-Proj", organization=org)
    sub = SubProject.objects.create(project=proj, name=f"{tag}-Sub")
    admin = User.objects.create_user(email=f"admin_{tag}@x.com", name=f"{tag}-Admin", password=PW)
    Membership.objects.create(user=admin, organization=org, role="admin")
    member = User.objects.create_user(email=f"member_{tag}@x.com", name=f"{tag}-Member", password=PW)
    tier = Tier.objects.create(organization=org, name=f"{tag}-Tier")
    Membership.objects.create(user=member, organization=org, role="member", tier=tier)
    group = Group.objects.create(organization=org, name=f"{tag}-Group")
    grant = AccessGrant.objects.create(user=member, subproject=sub, level="member", sees="subproject")
    t_appr = Task.objects.create(subproject=sub, title=f"{tag}-task-approved",
                                 approval_state="approved", deadline=deadline)
    t_pend = Task.objects.create(subproject=sub, title=f"{tag}-task-pending", approval_state="pending")
    exc = Exclusion.objects.create(tier=tier, excluded_task=t_pend)
    comment = Comment.objects.create(task=t_appr, author=admin, text=f"{tag}-comment")
    subtask = Subtask.objects.create(task=t_appr, title=f"{tag}-subtask")
    event = CalendarEvent.objects.create(organization=org, kind="single", date=deadline, title=f"{tag}-event")
    return {
        "tag": tag, "org": org, "admin": admin, "member": member,
        "event_id": event.id,
        "project_ids": {proj.id},
        "subproject_ids": set(proj.subprojects.values_list("id", flat=True)),  # incl. default General
        "approved_task": t_appr.id, "pending_task": t_pend.id, "task_ids": {t_appr.id, t_pend.id},
        "user_ids": {admin.id, member.id},
        "group_ids": {group.id}, "tier_ids": {tier.id},
        "grant_id": grant.id, "exclusion_id": exc.id,
        "comment_id": comment.id, "subtask_id": subtask.id,
    }


@pytest.fixture
def worlds(db):
    d = date.today() + timedelta(days=3)
    A, B = build_org("AAA", d), build_org("BBB", d)
    # Snapshot daily history for the tasks' deadline day (both orgs' rows land in
    # one global HistoryDay, each tagged with its org).
    from tasks.history_service import snapshot_history_day
    snapshot_history_day(d)
    A["snap_day"] = B["snap_day"] = d.isoformat()
    return A, B


def _client(user):
    api = APIClient()
    res = api.post("/api/auth/login", {"email": user.email, "password": PW}, format="json")
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    return api


def test_org_admin_list_endpoints_never_leak_other_org(worlds):
    A, B = worlds
    api = _client(A["admin"])
    h = {"HTTP_X_ORG_ID": str(A["org"].id)}

    def check(ep, a_ids, b_ids):
        r = api.get(ep, **h)
        assert r.status_code == 200, (ep, r.status_code)
        got = {row["id"] for row in r.data}
        assert not (got & b_ids), f"{ep} LEAKED org B rows: {got & b_ids}"
        assert got & a_ids, f"{ep} returned none of A's own rows (vacuous test): {got}"

    check("/api/projects", A["project_ids"], B["project_ids"])
    check("/api/subprojects", A["subproject_ids"], B["subproject_ids"])
    check("/api/tasks", {A["approved_task"]}, B["task_ids"])         # list = approved only
    check("/api/users", A["user_ids"], B["user_ids"])
    check("/api/groups", A["group_ids"], B["group_ids"])
    check("/api/tiers", A["tier_ids"], B["tier_ids"])
    check("/api/grants", {A["grant_id"]}, {B["grant_id"]})
    check("/api/exclusions", {A["exclusion_id"]}, {B["exclusion_id"]})
    check("/api/subtasks", {A["subtask_id"]}, {B["subtask_id"]})
    check("/api/events", {A["event_id"]}, {B["event_id"]})

    # /api/events/range → only A's event spans
    frm0, to0 = date.today().isoformat(), (date.today() + timedelta(days=10)).isoformat()
    spans = {s["id"] for s in api.get(f"/api/events/range?from={frm0}&to={to0}", **h).data}
    assert A["event_id"] in spans and B["event_id"] not in spans

    # /api/history → only A's snapshot rows
    day = A["snap_day"]
    hist = api.get(f"/api/history?from={day}&to={day}", **h)
    titles = {row["title"] for row in hist.data}
    assert any(t.startswith("AAA") for t in titles) and not any(t.startswith("BBB") for t in titles)

    # /api/me tree → only A's sub-projects
    me = api.get("/api/me", **h).data
    tree_subs = {s["id"] for p in me["tree"]["projects"] for s in p["subprojects"]}
    assert tree_subs and tree_subs.issubset(A["subproject_ids"])
    assert not (tree_subs & B["subproject_ids"])

    # /api/approvals → only A's pending task
    appr = {t["id"] for t in api.get("/api/approvals", **h).data}
    assert A["pending_task"] in appr and B["pending_task"] not in appr

    # /api/calendar → only A's dated task
    frm, to = date.today().isoformat(), (date.today() + timedelta(days=10)).isoformat()
    cal = {i["task_id"] for i in api.get(f"/api/calendar?from={frm}&to={to}", **h).data}
    assert A["approved_task"] in cal and B["approved_task"] not in cal

    # /api/export (text) → A's titles only
    text = api.get("/api/export", **h).content.decode("utf-8", "replace")
    assert "AAA-task" in text and "BBB-task" not in text


def test_org_admin_cannot_open_other_orgs_task_or_comments(worlds):
    A, B = worlds
    api = _client(A["admin"])
    h = {"HTTP_X_ORG_ID": str(A["org"].id)}
    # IDOR: B's task detail + its comments thread are 404 for A's admin.
    assert api.get(f"/api/tasks/{B['approved_task']}", **h).status_code == 404
    assert api.get(f"/api/tasks/{B['approved_task']}/comments", **h).status_code == 404
    # A's own comments thread works and shows A's comment.
    own = api.get(f"/api/tasks/{A['approved_task']}/comments", **h)
    assert own.status_code == 200 and any(c["id"] == A["comment_id"] for c in own.data)


def test_org_member_task_list_is_scoped(worlds):
    A, B = worlds
    api = _client(A["member"])
    tasks = {t["id"] for t in api.get("/api/tasks", HTTP_X_ORG_ID=str(A["org"].id)).data}
    assert A["approved_task"] in tasks
    assert not (tasks & B["task_ids"])


def test_member_cannot_read_foreign_org_users(worlds):
    """IDOR regression: UsersView.get resolved `request.org` straight off the
    client-supplied X-Org-Id header (OrgContextMiddleware does NOT verify
    membership) and queried that org's Memberships with no _in_org check — so
    any authenticated user could spoof a foreign org's id and read its full
    roster (name/email/role/tier). Both an ordinary member and an admin of org A
    must get nothing back when they point the header at org B."""
    A, B = worlds
    spoofed = {"HTTP_X_ORG_ID": str(B["org"].id)}

    r = _client(A["member"]).get("/api/users", **spoofed)
    assert r.status_code == 200
    assert r.data == [], f"member of org A read org B's users via spoofed X-Org-Id: {r.data}"

    r = _client(A["admin"]).get("/api/users", **spoofed)
    assert r.status_code == 200
    got = {row["id"] for row in r.data}
    assert not (got & B["user_ids"]), f"admin of org A LEAKED org B's users: {got & B['user_ids']}"
