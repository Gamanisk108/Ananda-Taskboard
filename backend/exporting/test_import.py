"""Task import: parsing (csv/tsv/json/xlsx), preview (dry-run), commit
(create / update-by-id / auto-create structure / assignee match / decisions),
round-trip with export, and admin-only API."""

import io
import json

import pytest
from rest_framework.test import APIClient

from accounts.models import User
from exporting import import_data
from projects.models import Project, SubProject
from tasks.models import Status, Task


@pytest.fixture
def admin(db):
    return User.objects.create_superuser(email="a@example.com", name="Ada", password="pw-strong-123")


@pytest.fixture
def member(db):
    return User.objects.create_user(email="m@example.com", name="Mara", password="pw-strong-123")


@pytest.fixture
def karuna(db):
    p = Project.objects.create(name="Karuna Devi")
    mk = SubProject.objects.create(project=p, name="Marketing")
    return {"project": p, "marketing": mk, "general": p.subprojects.get(is_default=True)}


def login(user):
    api = APIClient()
    res = api.post("/api/auth/login", {"email": user.email, "password": "pw-strong-123"}, format="json")
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    return api


# ── parsing ─────────────────────────────────────────────────────────────────

def test_parse_csv_maps_headers_by_label_and_key(db):
    rows = import_data.parse("csv", "ID,Project,Sub-project,Title\n,Karuna Devi,Marketing,Flyer\n")
    assert rows == [{"id": "", "project": "Karuna Devi", "subproject": "Marketing", "title": "Flyer"}]


def test_parse_tsv_and_blank_lines(db):
    rows = import_data.parse("tsv", "Title\tProject\nFlyer\tKaruna\n\n")
    assert len(rows) == 1 and rows[0]["title"] == "Flyer"


def test_parse_json_accepts_keys(db):
    rows = import_data.parse("json", json.dumps([{"title": "Flyer", "project": "Karuna", "priority": "High"}]))
    assert rows[0]["title"] == "Flyer" and rows[0]["priority"] == "High"


def test_parse_xlsx(db):
    from openpyxl import Workbook
    wb = Workbook(); ws = wb.active
    ws.append(["Title", "Project", "Sub-project"])
    ws.append(["Flyer", "Karuna", "Marketing"])
    buf = io.BytesIO(); wb.save(buf)
    rows = import_data.parse("xlsx", buf.getvalue())
    assert rows[0]["title"] == "Flyer" and rows[0]["project"] == "Karuna"


# ── preview (dry-run, no writes) ─────────────────────────────────────────────

def test_preview_create_update_and_new_structure(admin, karuna):
    existing = Task.objects.create(subproject=karuna["marketing"], title="Old")
    rows = import_data.parse("csv",
        "ID,Project,Sub-project,Title\n"
        f"{existing.id},Karuna Devi,Marketing,Renamed\n"      # update
        ",Karuna Devi,Marketing,Brand new\n"                   # create (existing structure)
        ",New Project,New Sub,Another\n")                      # create + new structure
    pv = import_data.preview(rows)
    assert pv["summary"]["update"] == 1 and pv["summary"]["create"] == 2
    assert pv["new_projects"] == ["New Project"]
    assert "New Project / New Sub" in pv["new_subprojects"]
    # dry-run wrote nothing
    assert Task.objects.count() == 1 and not Project.objects.filter(name="New Project").exists()


def test_preview_flags_errors(admin, karuna):
    rows = import_data.parse("csv", "Project,Sub-project,Title\nKaruna Devi,Marketing,\n")  # no title
    pv = import_data.preview(rows)
    assert pv["summary"]["error"] == 1 and "Title is required" in pv["rows"][0]["errors"]


def test_preview_unknown_id_warns_and_becomes_create(admin, karuna):
    rows = import_data.parse("csv", "ID,Project,Sub-project,Title\n99999,Karuna Devi,Marketing,X\n")
    pv = import_data.preview(rows)
    assert pv["rows"][0]["action"] == "create"
    assert any("not found" in w for w in pv["rows"][0]["warnings"])


# ── commit ──────────────────────────────────────────────────────────────────

def test_commit_creates_and_autocreates_structure(admin, karuna):
    rows = import_data.parse("csv",
        "Project,Sub-project,Title,Priority,Deadline\n"
        "Karuna Devi,Marketing,Spring flyer,High,2026-07-01\n"
        "Sangha,Outreach,Newsletter,,\n")
    res = import_data.commit(admin, rows, {})
    assert res["created"] == 2
    assert Project.objects.filter(name="Sangha").exists()
    assert SubProject.objects.filter(project__name="Sangha", name="Outreach").exists()
    t = Task.objects.get(title="Spring flyer")
    assert t.priority == 4 and t.deadline.isoformat() == "2026-07-01"
    assert t.approval_state == Task.Approval.APPROVED


def test_commit_updates_existing_by_id_overwrite(admin, karuna):
    t = Task.objects.create(subproject=karuna["marketing"], title="Before", details="old")
    rows = import_data.parse("csv",
        f"ID,Project,Sub-project,Title,Details\n{t.id},Karuna Devi,Marketing,After,new details\n")
    res = import_data.commit(admin, rows, {})
    assert res["updated"] == 1 and res["created"] == 0
    t.refresh_from_db()
    assert t.title == "After" and t.details == "new details"
    assert Task.objects.count() == 1  # updated in place, no duplicate


def test_commit_decision_create_instead_of_overwrite(admin, karuna):
    t = Task.objects.create(subproject=karuna["marketing"], title="Original")
    rows = import_data.parse("csv", f"ID,Project,Sub-project,Title\n{t.id},Karuna Devi,Marketing,Copy\n")
    res = import_data.commit(admin, rows, {"0": "create"})
    assert res["created"] == 1 and res["updated"] == 0
    t.refresh_from_db()
    assert t.title == "Original"  # left untouched
    assert Task.objects.filter(title="Copy").exists()


def test_commit_decision_skip(admin, karuna):
    rows = import_data.parse("csv", "Project,Sub-project,Title\nKaruna Devi,Marketing,Nope\n")
    res = import_data.commit(admin, rows, {"0": "skip"})
    assert res["skipped"] == 1 and res["created"] == 0
    assert not Task.objects.filter(title="Nope").exists()


def test_commit_assignee_match_by_email_and_unmatched(admin, member, karuna):
    rows = import_data.parse("csv",
        "Project,Sub-project,Title,Assignees\n"
        "Karuna Devi,Marketing,Team task,m@example.com; ghost@nowhere\n")
    res = import_data.commit(admin, rows, {})
    assert res["created"] == 1
    t = Task.objects.get(title="Team task")
    assert list(t.assignees.values_list("id", flat=True)) == [member.id]  # ghost ignored


def test_commit_error_rows_isolated(admin, karuna):
    rows = import_data.parse("csv",
        "Project,Sub-project,Title\n"
        "Karuna Devi,Marketing,Good\n"
        "Karuna Devi,Marketing,\n")  # missing title
    res = import_data.commit(admin, rows, {})
    assert res["created"] == 1 and res["errors"] == 1
    assert Task.objects.filter(title="Good").exists()


def test_status_matched_by_label(admin, karuna):
    # statuses are seeded by migration; match the "In Progress" label → its key
    st = Status.objects.get_or_create(key="in_progress", defaults={"label": "In Progress", "order": 1})[0]
    rows = import_data.parse("csv", "Project,Sub-project,Title,Status\nKaruna Devi,Marketing,X,In Progress\n")
    import_data.commit(admin, rows, {})
    assert Task.objects.get(title="X").status == st.key


# ── safe partial updates ─────────────────────────────────────────────────────

def test_update_blank_columns_leave_existing_untouched(admin, member, karuna):
    """The headline safety guarantee: a sparse update sheet never wipes fields."""
    import datetime
    t = Task.objects.create(subproject=karuna["marketing"], title="Keep", priority=5,
                            details="keep details", deadline=datetime.date(2026, 8, 1))
    t.assignees.add(member)
    # sheet carries only ID + a new Details; everything else blank
    rows = import_data.parse("csv", f"ID,Title,Details,Priority,Assignees,Deadline\n{t.id},,fresh,,,\n")
    res = import_data.commit(admin, rows, {})
    assert res["updated"] == 1
    t.refresh_from_db()
    assert t.details == "fresh"                       # provided → changed
    assert t.title == "Keep"                          # blank → unchanged
    assert t.priority == 5                            # blank → unchanged
    assert t.deadline == datetime.date(2026, 8, 1)    # blank → NOT cleared
    assert list(t.assignees.values_list("id", flat=True)) == [member.id]  # blank → NOT wiped


def test_update_by_name_when_no_id(admin, karuna):
    t = Task.objects.create(subproject=karuna["marketing"], title="By Name", priority=3)
    rows = import_data.parse("csv", "Title,Priority\nBy Name,High\n")
    res = import_data.commit(admin, rows, {})
    assert res["updated"] == 1 and res["created"] == 0
    t.refresh_from_db()
    assert t.priority == 4


def test_name_ambiguous_preview_then_pick(admin, karuna):
    a = Task.objects.create(subproject=karuna["marketing"], title="Dup")
    b = Task.objects.create(subproject=karuna["general"], title="Dup")
    rows = import_data.parse("csv", "Title,Priority\nDup,High\n")
    pv = import_data.preview(rows)
    assert pv["rows"][0]["action"] == "ambiguous"
    assert {c["id"] for c in pv["rows"][0]["candidates"]} == {a.id, b.id}
    # no decision → nothing touched
    assert import_data.commit(admin, rows, {})["skipped"] == 1
    # pick both → both updated
    res = import_data.commit(admin, rows, {"0": {"ids": [a.id, b.id]}})
    assert res["updated"] == 2
    a.refresh_from_db(); b.refresh_from_db()
    assert a.priority == 4 and b.priority == 4


# ── subtask rows ─────────────────────────────────────────────────────────────

def test_subtask_row_adds_with_assignee_and_dedups(admin, member, karuna):
    t = Task.objects.create(subproject=karuna["marketing"], title="Parent")
    rows = import_data.parse("csv",
        "Title,Subtask,Assignees\nParent,Step one,m@example.com\nParent,Step one,\n")  # 2nd = dup
    res = import_data.commit(admin, rows, {})
    assert res["subtasks"] == 1 and res["updated"] == 0 and res["created"] == 0
    st = t.subtasks.get()
    assert st.title == "Step one"
    assert list(st.assignees.values_list("id", flat=True)) == [member.id]


def test_subtask_attaches_to_new_task_created_above(admin, karuna):
    rows = import_data.parse("csv",
        "Project,Sub-project,Title,Subtask\n"
        "Karuna Devi,Marketing,Brand New,\n"        # task row (creates it)
        "Karuna Devi,,Brand New,First step\n")       # subtask row (attaches to it)
    res = import_data.commit(admin, rows, {})
    assert res["created"] == 1 and res["subtasks"] == 1
    assert Task.objects.get(title="Brand New").subtasks.get().title == "First step"


def test_subtask_without_parent_is_error(admin, karuna):
    rows = import_data.parse("csv", "Title,Subtask\nGhost Task,Some step\n")
    pv = import_data.preview(rows)
    assert pv["rows"][0]["action"] == "error"
    assert any("no task" in e for e in pv["rows"][0]["errors"])


# ── pre-import checkpoint ────────────────────────────────────────────────────

def test_commit_saves_restore_point(admin, karuna):
    from tasks.models import RestorePoint
    before = RestorePoint.objects.count()
    body = {"fmt": "csv", "content": "Project,Sub-project,Title\nKaruna Devi,Marketing,Z\n", "action": "commit"}
    res = login(admin).post("/api/import", body, format="json")
    assert res.status_code == 200
    assert RestorePoint.objects.filter(label__startswith="Before import").exists()
    assert RestorePoint.objects.count() == before + 1


# ── export round-trip + API ──────────────────────────────────────────────────

def test_export_includes_id_and_json_format(admin, karuna):
    Task.objects.create(subproject=karuna["marketing"], title="Flyer")
    api = login(admin)
    res = api.get("/api/export?fmt=json")
    assert res.status_code == 200
    data = json.loads(res.content)
    assert data and "id" in data[0] and data[0]["title"] == "Flyer"


def test_roundtrip_export_then_import_updates_same_tasks(admin, karuna):
    Task.objects.create(subproject=karuna["marketing"], title="One")
    Task.objects.create(subproject=karuna["marketing"], title="Two")
    api = login(admin)
    exported = json.loads(api.get("/api/export?fmt=json").content)
    before = Task.objects.count()
    res = import_data.commit(admin, import_data.parse("json", json.dumps(exported)), {})
    assert res["updated"] == before and res["created"] == 0  # matched by id, no dupes
    assert Task.objects.count() == before


def test_import_api_admin_only(member, admin, karuna):
    body = {"fmt": "csv", "content": "Project,Sub-project,Title\nKaruna Devi,Marketing,Z\n"}
    assert login(member).post("/api/import", body, format="json").status_code in (401, 403)
    pv = login(admin).post("/api/import", {**body, "action": "preview"}, format="json")
    assert pv.status_code == 200 and pv.data["summary"]["create"] == 1
    commit = login(admin).post("/api/import", {**body, "action": "commit"}, format="json")
    assert commit.status_code == 200 and commit.data["created"] == 1
    assert Task.objects.filter(title="Z").exists()
