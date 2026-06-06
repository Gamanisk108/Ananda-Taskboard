import pytest
from rest_framework.test import APIClient

from accounts.models import User
from projects.models import Project, SubProject
from tasks.models import Subtask, Task


@pytest.fixture
def admin(db):
    return User.objects.create_superuser(email="a@example.com", name="Ada", password="pw-strong-123")


def login(user):
    api = APIClient()
    res = api.post("/api/auth/login", {"email": user.email, "password": "pw-strong-123"}, format="json")
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    return api


@pytest.fixture
def sp(db):
    return SubProject.objects.create(project=Project.objects.create(name="P"), name="SP")


@pytest.fixture
def task(sp):
    return Task.objects.create(subproject=sp, title="Parent")


def test_create_and_list_subtask(admin, task):
    api = login(admin)
    res = api.post("/api/subtasks", {"task": task.id, "title": "Step 1"}, format="json")
    assert res.status_code == 201 and res.data["status"] == "todo"
    lst = api.get(f"/api/subtasks?task={task.id}")
    assert [s["title"] for s in lst.data] == ["Step 1"]


def test_change_subtask_status(admin, task):
    api = login(admin)
    sid = api.post("/api/subtasks", {"task": task.id, "title": "S"}, format="json").data["id"]
    res = api.patch(f"/api/subtasks/{sid}", {"status": "in_progress"}, format="json")
    assert res.status_code == 200 and res.data["status"] == "in_progress"


def test_delete_subtask(admin, task):
    api = login(admin)
    sid = api.post("/api/subtasks", {"task": task.id, "title": "S"}, format="json").data["id"]
    assert api.delete(f"/api/subtasks/{sid}").status_code == 204
    assert not Subtask.objects.filter(id=sid).exists()


def test_task_serializer_reports_subtask_counts(admin, task):
    Subtask.objects.create(task=task, title="a", status="todo")
    Subtask.objects.create(task=task, title="b", status="todo")
    Subtask.objects.create(task=task, title="c", status="in_progress")
    res = login(admin).get(f"/api/tasks/{task.id}")
    assert res.data["subtask_counts"] == {"todo": 2, "in_progress": 1}


def test_assignee_viewer_can_edit_own_subtask(admin, sp, task):
    from permissions.models import AccessGrant
    viewer = User.objects.create_user(email="v@example.com", name="Vee", password="pw-strong-123")
    AccessGrant.objects.create(user=viewer, subproject=sp, level="viewer")  # visibility, not member
    sub = login(admin).post("/api/subtasks", {"task": task.id, "title": "S", "assignees": [viewer.id]}, format="json").data
    # the assignee (a viewer) may edit their own subtask
    res = login(viewer).patch(f"/api/subtasks/{sub['id']}", {"status": "done"}, format="json")
    assert res.status_code == 200 and res.data["status"] == "done"


def test_group_member_can_edit_own_subtask(admin, sp, task):
    from accounts.models import Group
    from permissions.models import AccessGrant
    viewer = User.objects.create_user(email="gm@example.com", name="Gee", password="pw-strong-123")
    AccessGrant.objects.create(user=viewer, subproject=sp, level="viewer")  # visibility, not member
    group = Group.objects.create(name="Volunteers")
    group.members.add(viewer)
    sub = login(admin).post(
        "/api/subtasks", {"task": task.id, "title": "S", "assignee_groups": [group.id]}, format="json"
    ).data
    # a member of an assigned group may edit the subtask, like a direct assignee
    res = login(viewer).patch(f"/api/subtasks/{sub['id']}", {"status": "done"}, format="json")
    assert res.status_code == 200 and res.data["status"] == "done"


def test_subtask_rich_fields_persist(admin, task):
    api = login(admin)
    payload = {
        "task": task.id, "title": "Rich", "priority": 4,
        "details": "do the thing", "requirements": "carefully",
        "timeline_start": "2026-06-10", "deadline": "2026-06-20",
        "start_time": "13:00", "end_time": "16:00",
    }
    res = api.post("/api/subtasks", payload, format="json")
    assert res.status_code == 201
    d = res.data
    assert d["priority"] == 4 and d["details"] == "do the thing"
    assert d["requirements"] == "carefully"
    assert d["timeline_start"] == "2026-06-10" and d["deadline"] == "2026-06-20"
    assert d["start_time"] == "13:00:00" and d["end_time"] == "16:00:00"


def test_subtask_time_must_be_both_or_neither(admin, task):
    api = login(admin)
    res = api.post("/api/subtasks", {"task": task.id, "title": "S", "start_time": "13:00"}, format="json")
    assert res.status_code == 400


def test_subtask_end_time_after_start(admin, task):
    api = login(admin)
    res = api.post(
        "/api/subtasks", {"task": task.id, "title": "S", "start_time": "16:00", "end_time": "13:00"}, format="json"
    )
    assert res.status_code == 400


def test_non_assignee_viewer_cannot_edit(admin, sp, task):
    from permissions.models import AccessGrant
    viewer = User.objects.create_user(email="v2@example.com", name="Vee2", password="pw-strong-123")
    AccessGrant.objects.create(user=viewer, subproject=sp, level="viewer")
    sub = login(admin).post("/api/subtasks", {"task": task.id, "title": "S"}, format="json").data
    res = login(viewer).patch(f"/api/subtasks/{sub['id']}", {"status": "done"}, format="json")
    assert res.status_code == 403


def test_cannot_move_subtask_to_another_task(admin, sp, task):
    other = Task.objects.create(subproject=sp, title="Other")
    api = login(admin)
    sid = api.post("/api/subtasks", {"task": task.id, "title": "S"}, format="json").data["id"]
    res = api.patch(f"/api/subtasks/{sid}", {"task": other.id}, format="json")
    assert res.status_code == 400
