import { useMemo, useState } from "react";
import { api, ApiError } from "../api/client";
import { writableProjects, todayISO } from "../lookup";
import { useUsers } from "../users";
import { Modal, StatusPill } from "./common";
import { CommentSection } from "./CommentSection";
import { STATUS_LABEL, type Me, type Recurrence, type Status, type Task } from "../types";

interface Props {
  task: Task | null;
  me: Me;
  defaultSubproject?: number;
  defaultProject?: number;
  onClose: () => void;
  onSaved: () => void;
}

type EndMode = "none" | "date" | "count";

export function TaskModal({ task, me, defaultSubproject, defaultProject, onClose, onSaved }: Props) {
  const editing = !!task;
  const projects = useMemo(() => writableProjects(me), [me]);
  const users = useUsers();

  // Project + Sub-project (cascading). When editing, fixed to the task's own.
  const initialProject = task?.project ?? defaultProject ?? projects[0]?.id ?? 0;
  const [projectId, setProjectId] = useState<number>(initialProject);
  const subOptions = projects.find((p) => p.id === projectId)?.subprojects ?? [];
  const [subproject, setSubproject] = useState<number>(
    task?.subproject ?? defaultSubproject ?? subOptions[0]?.id ?? 0
  );

  const [title, setTitle] = useState(task?.title ?? "");
  const [details, setDetails] = useState(task?.details ?? "");
  const [requirements, setRequirements] = useState(task?.requirements ?? "");
  const [deadline, setDeadline] = useState(task?.deadline ?? "");
  const [links, setLinks] = useState((task?.links ?? []).join("\n"));
  const [assignees, setAssignees] = useState<number[]>(task?.assignees ?? []);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [repeats, setRepeats] = useState(!!task?.recurrence);
  const [freq, setFreq] = useState<Recurrence["freq"]>(task?.recurrence?.freq ?? "weekly");
  const [interval, setInterval] = useState(task?.recurrence?.interval ?? 1);
  const [anchor, setAnchor] = useState(task?.recurrence?.anchor ?? (deadline || todayISO()));
  const [endMode, setEndMode] = useState<EndMode>(
    task?.recurrence?.end_date ? "date" : task?.recurrence?.count ? "count" : "none"
  );
  const [endDate, setEndDate] = useState(task?.recurrence?.end_date ?? "");
  const [count, setCount] = useState(task?.recurrence?.count ?? 10);

  const canChangeStatus = editing && (me.is_admin || (task!.assignees ?? []).includes(me.id));

  function pickProject(id: number) {
    setProjectId(id);
    const subs = projects.find((p) => p.id === id)?.subprojects ?? [];
    setSubproject(subs[0]?.id ?? 0);
  }
  function toggleAssignee(id: number) {
    setAssignees((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  }
  function hasAccess(u: { is_admin: boolean; subproject_ids: number[] }) {
    return u.is_admin || u.subproject_ids.includes(subproject);
  }

  async function changeStatus(s: Status) {
    try {
      await api.post(`/api/tasks/${task!.id}/status`, { status: s });
      onSaved();
    } catch {
      setErr("You can't change this task's status.");
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!subproject) { setErr("Pick a project and sub-project."); return; }
    const recurrence: Recurrence | null = repeats
      ? { freq, interval, anchor, end_date: endMode === "date" ? endDate : null, count: endMode === "count" ? count : null }
      : null;
    const payload = {
      subproject, title, details, requirements,
      deadline: deadline || null,
      assignees,
      links: links.split("\n").map((l) => l.trim()).filter(Boolean),
      recurrence,
    };
    setBusy(true);
    try {
      if (editing) await api.patch(`/api/tasks/${task!.id}`, payload);
      else await api.post("/api/tasks", payload);
      onSaved();
    } catch (e) {
      const ae = e as ApiError;
      setErr(ae.status === 403 ? "You don't have permission to do that." : "Could not save — check the fields.");
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!confirm("Delete this task?")) return;
    try {
      await api.del(`/api/tasks/${task!.id}`);
      onSaved();
    } catch {
      setErr("Could not delete.");
    }
  }

  return (
    <Modal title={editing ? "Edit task" : "New task"} onClose={onClose} wide>
      <form onSubmit={save}>
        {editing && task!.approval_state !== "approved" && (
          <div className="field">
            <span className="pill" style={{ background: "#b7791f1a", color: "var(--warn)" }}>
              {task!.approval_state === "pending" ? "Pending approval" : "Rejected"}
            </span>
          </div>
        )}

        <div className="field">
          <label>Task name</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus placeholder="e.g. Design spring flyer" />
        </div>

        <div className="row2">
          <div className="field">
            <label>Project</label>
            <select value={projectId} onChange={(e) => pickProject(Number(e.target.value))} disabled={editing}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Sub-project</label>
            <select value={subproject} onChange={(e) => setSubproject(Number(e.target.value))} disabled={editing}>
              {subOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Assignees</label>
          <div className="assignee-list">
            {users.length === 0 && <span className="muted">No users.</span>}
            {users.map((u) => {
              const access = hasAccess(u);
              return (
                <label
                  key={u.id}
                  className={`assignee-row ${access ? "" : "no-access"}`}
                  title={access ? "" : "This person has no access to the selected sub-project"}
                >
                  <input type="checkbox" style={{ width: "auto" }} checked={assignees.includes(u.id)} onChange={() => toggleAssignee(u.id)} />
                  <span>{u.name || u.email}</span>
                  {!access && <span className="noaccess-tag">no access</span>}
                </label>
              );
            })}
          </div>
        </div>

        <div className="row2">
          <div className="field">
            <label>Details</label>
            <textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} />
          </div>
          <div className="field">
            <label>Requirements</label>
            <textarea rows={3} value={requirements} onChange={(e) => setRequirements(e.target.value)} />
          </div>
        </div>

        <div className="row2">
          <div className="field">
            <label>Deadline</label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          <div className="field">
            <label>Links (one URL per line)</label>
            <textarea rows={2} value={links} onChange={(e) => setLinks(e.target.value)} placeholder="https://drive.google.com/…" />
          </div>
        </div>

        <div className="field">
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" style={{ width: "auto" }} checked={repeats} onChange={(e) => setRepeats(e.target.checked)} />
            Repeats
          </label>
        </div>
        {repeats && (
          <div className="card" style={{ padding: 12, marginBottom: 14, background: "var(--surface-sunk)" }}>
            <div className="row2">
              <div className="field">
                <label>Frequency</label>
                <select value={freq} onChange={(e) => setFreq(e.target.value as Recurrence["freq"])}>
                  {["daily", "weekly", "monthly", "yearly"].map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Every (interval)</label>
                <input type="number" min={1} value={interval} onChange={(e) => setInterval(Number(e.target.value))} />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Starts (anchor)</label>
                <input type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} />
              </div>
              <div className="field">
                <label>Ends</label>
                <select value={endMode} onChange={(e) => setEndMode(e.target.value as EndMode)}>
                  <option value="none">Never</option>
                  <option value="date">On date</option>
                  <option value="count">After N times</option>
                </select>
              </div>
            </div>
            {endMode === "date" && (
              <div className="field"><label>End date</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
            )}
            {endMode === "count" && (
              <div className="field"><label>Occurrences</label>
                <input type="number" min={1} value={count} onChange={(e) => setCount(Number(e.target.value))} /></div>
            )}
          </div>
        )}

        {canChangeStatus && (
          <div className="field">
            <label>Status (applied immediately)</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <StatusPill status={task!.status} />
              <select defaultValue="" onChange={(e) => e.target.value && changeStatus(e.target.value as Status)} style={{ width: "auto" }}>
                <option value="">Change to…</option>
                {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>
          </div>
        )}

        {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10 }}>{err}</div>}

        <div className="modal-foot">
          {editing && <button type="button" className="btn-danger" onClick={del} style={{ marginRight: "auto" }}>Delete</button>}
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </form>
      {editing && <CommentSection taskId={task!.id} meId={me.id} />}
    </Modal>
  );
}
