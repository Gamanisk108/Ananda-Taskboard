"""Soft-delete / restore / purge (Trash) tests."""

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from projects.models import Project, SubProject
from tasks.models import Task
from trashbin import purge_expired, soft_delete_project, soft_delete_subproject


@pytest.fixture
def admin(db):
    return User.objects.create_superuser(email="a@example.com", name="Ada", password="pw-strong-123")


@pytest.fixture
def member(db):
    return User.objects.create_user(email="m@example.com", name="Mara", password="pw-strong-123")


def login(user):
    api = APIClient()
    res = api.post("/api/auth/login", {"email": user.email, "password": "pw-strong-123"}, format="json")
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    return api


# --- soft delete hides, all_objects keeps ----------------------------------

def test_soft_delete_task_hidden_from_default_manager(db):
    sp = SubProject.objects.create(project=Project.objects.create(name="P"), name="SP")
    t = Task.objects.create(subproject=sp, title="T")
    t.delete()
    assert not Task.objects.filter(pk=t.pk).exists()       # hidden
    assert Task.all_objects.filter(pk=t.pk).exists()       # still there
    assert Task.all_objects.get(pk=t.pk).deleted_at is not None


def test_delete_subproject_cascades_to_tasks(db):
    sp = SubProject.objects.create(project=Project.objects.create(name="P"), name="SP")
    t = Task.objects.create(subproject=sp, title="T")
    soft_delete_subproject(sp)
    assert not SubProject.objects.filter(pk=sp.pk).exists()
    assert not Task.objects.filter(pk=t.pk).exists()       # task trashed with it


def test_delete_project_cascades_and_restores_together(db):
    p = Project.objects.create(name="P")
    sp = p.subprojects.first()  # default 'General'
    extra = SubProject.objects.create(project=p, name="Extra")
    t = Task.objects.create(subproject=extra, title="T")
    soft_delete_project(p)
    assert Project.objects.count() == 0 and Task.objects.count() == 0
    # restore the project → children deleted in the same op come back
    from trashbin import restore_project
    restore_project(Project.all_objects.get(pk=p.pk))
    assert Project.objects.filter(pk=p.pk).exists()
    assert SubProject.objects.filter(pk=extra.pk).exists()
    assert Task.objects.filter(pk=t.pk).exists()


def test_restore_only_brings_back_same_delete_batch(db):
    p = Project.objects.create(name="P")
    sp = SubProject.objects.create(project=p, name="SP")
    t_old = Task.objects.create(subproject=sp, title="OldDeleted")
    t_old.delete()  # deleted earlier, separately
    t_new = Task.objects.create(subproject=sp, title="WithProject")
    soft_delete_project(p)
    from trashbin import restore_project
    restore_project(Project.all_objects.get(pk=p.pk))
    assert Task.objects.filter(pk=t_new.pk).exists()        # restored with project
    assert not Task.objects.filter(pk=t_old.pk).exists()    # stays trashed (different batch)


# --- purge ------------------------------------------------------------------

def test_purge_removes_only_expired(db):
    sp = SubProject.objects.create(project=Project.objects.create(name="P"), name="SP")
    recent = Task.objects.create(subproject=sp, title="recent"); recent.delete()
    old = Task.objects.create(subproject=sp, title="old")
    old.delete()
    Task.all_objects.filter(pk=old.pk).update(deleted_at=timezone.now() - timedelta(days=8))
    purge_expired()
    assert Task.all_objects.filter(pk=recent.pk).exists()   # within 7 days
    assert not Task.all_objects.filter(pk=old.pk).exists()  # purged


# --- API --------------------------------------------------------------------

def test_trash_api_lists_and_restores(admin, db):
    sp = SubProject.objects.create(project=Project.objects.create(name="P"), name="SP")
    t = Task.objects.create(subproject=sp, title="Gone")
    t.delete()
    api = login(admin)
    listing = api.get("/api/trash")
    assert any(x["label"] == "Gone" for x in listing.data["tasks"])
    assert listing.data["tasks"][0]["days_left"] == 7
    r = api.post("/api/trash/action", {"type": "task", "id": t.id}, format="json")
    assert r.status_code == 200
    assert Task.objects.filter(pk=t.pk).exists()  # restored


def test_trash_api_purge_one(admin, db):
    sp = SubProject.objects.create(project=Project.objects.create(name="P"), name="SP")
    t = Task.objects.create(subproject=sp, title="Gone"); t.delete()
    r = login(admin).delete("/api/trash/action", {"type": "task", "id": t.id}, format="json")
    assert r.status_code == 204
    assert not Task.all_objects.filter(pk=t.pk).exists()  # hard-deleted


def test_member_trash_is_scoped_not_blocked(member):
    # Members now have self-service Trash for their OWN deletions (full coverage in
    # test_reduced_access.py). Access is allowed, but the admin-only project/
    # sub-project scopes stay empty and they see only tasks they deleted.
    r = login(member).get("/api/trash")
    assert r.status_code == 200
    assert r.data["projects"] == [] and r.data["subprojects"] == []
    assert r.data["tasks"] == []  # this member deleted nothing


def test_delete_task_via_api_is_soft(admin, db):
    sp = SubProject.objects.create(project=Project.objects.create(name="P"), name="SP")
    t = Task.objects.create(subproject=sp, title="T")
    api = login(admin)
    assert api.delete(f"/api/tasks/{t.id}").status_code == 204
    assert Task.all_objects.get(pk=t.pk).deleted_at is not None  # soft, recoverable
