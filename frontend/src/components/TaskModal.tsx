import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../api/client";
import { writableProjects, todayISO } from "../lookup";
import { useUsers } from "../users";
import { useStatuses } from "../statuses";
import { Modal, StatusPill, PriorityIcon } from "./common";
import { CommentSection } from "./CommentSection";
import { SubtaskEditor } from "./SubtaskEditor";
import { AssigneePicker, type GroupLite } from "./AssigneePicker";
import { PRIORITY_META, type Me, type Recurrence, type Task } from "../types";

interface Props {
  task: Task | null;
  me: Me;
  defaultSubproject?: number;
  defaultProject?: number;
  onClose: () => void;
  onSaved: () => void;
  onChanged?: () => void; // refresh the list WITHOUT closing the modal (e.g. status change)
}

type EndMode = "none" | "date" | "count";

// Weekday toggles shown Sunday-first; stored Mon=0..Sun=6 (matches the backend).
const WD_TOGGLES = [
  { n: 6, label: "S" }, { n: 0, label: "M" }, { n: 1, label: "T" }, { n: 2, label: "W" },
  { n: 3, label: "T" }, { n: 4, label: "F" }, { n: 5, label: "S" },
];

export function TaskModal({ task, me, defaultSubproject, defaultProject, onClose, onSaved, onChanged }: Props) {
  const { t } = useTranslation();
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
  const [startDate, setStartDate] = useState(task?.timeline_start ?? "");
  const [deadline, setDeadline] = useState(task?.deadline ?? "");
  const [startTime, setStartTime] = useState(task?.start_time ?? "");
  const [endTime, setEndTime] = useState(task?.end_time ?? "");
  const [priority, setPriority] = useState<number>(task?.priority ?? 3);
  const [links, setLinks] = useState((task?.links ?? []).join("\n"));
  const [assignees, setAssignees] = useState<number[]>(task?.assignees ?? []);
  const [assigneeGroups, setAssigneeGroups] = useState<number[]>(task?.assignee_groups ?? []);
  const [monitor, setMonitor] = useState<boolean>(task?.monitor ?? false);
  const [autoComplete, setAutoComplete] = useState<boolean>(task?.auto_complete ?? false);
  const [groups, setGroups] = useState<GroupLite[]>([]);
  const statuses = useStatuses();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [shareLabel, setShareLabel] = useState("");

  useEffect(() => {
    if (me.is_admin) api.get("/api/groups").then(setGroups).catch(() => setGroups([]));
  }, [me.is_admin]);

  const [repeats, setRepeats] = useState(!!task?.recurrence);
  const [freq, setFreq] = useState<Recurrence["freq"]>(task?.recurrence?.freq ?? "weekly");
  const [weekdays, setWeekdays] = useState<number[]>(task?.recurrence?.weekdays ?? []);
  const [interval, setInterval] = useState(task?.recurrence?.interval ?? 1);
  const [anchor, setAnchor] = useState(task?.recurrence?.anchor ?? (deadline || todayISO()));
  const [endMode, setEndMode] = useState<EndMode>(
    task?.recurrence?.end_date ? "date" : task?.recurrence?.count ? "count" : "none"
  );
  const [endDate, setEndDate] = useState(task?.recurrence?.end_date ?? "");
  const [count, setCount] = useState(task?.recurrence?.count ?? 10);

  const [curStatus, setCurStatus] = useState<string>(task?.status ?? "todo");
  const canChangeStatus = editing && (me.is_admin || (task!.assignees ?? []).includes(me.id));

  function pickProject(id: number) {
    setProjectId(id);
    const subs = projects.find((p) => p.id === id)?.subprojects ?? [];
    setSubproject(subs[0]?.id ?? 0);
  }
  async function changeStatus(s: string) {
    try {
      await api.post(`/api/tasks/${task!.id}/status`, { status: s });
      setCurStatus(s);          // update in place — do NOT close the modal
      onChanged?.();            // refresh the list behind the modal
    } catch {
      setErr("You can't change this task's status.");
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!subproject) { setErr("Pick a project and sub-project."); return; }
    if (!!startTime !== !!endTime) { setErr("Set both a start and end time, or neither."); return; }
    if (startTime && endTime && endTime <= startTime) { setErr("End time must be after the start time."); return; }
    const recurrence: Recurrence | null = repeats
      ? { freq, interval, anchor, end_date: endMode === "date" ? endDate : null, count: endMode === "count" ? count : null,
          weekdays: freq === "weekly" ? weekdays : [] }
      : null;
    const payload = {
      subproject, title, details, requirements,
      timeline_start: startDate || null,
      deadline: deadline || null,
      start_time: startTime || null,
      end_time: endTime || null,
      priority,
      assignees,
      assignee_groups: assigneeGroups,
      monitor,
      auto_complete: autoComplete,
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
    <Modal title={editing ? `${t("task.edit")} · #${task!.id}` : t("task.new")} onClose={onClose} wide>
      <form onSubmit={save}>
        {editing && task!.approval_state !== "approved" && (
          <div className="field">
            <span className="pill" style={{ background: "#b7791f1a", color: "var(--warn)" }}>
              {task!.approval_state === "pending" ? t("task.pendingApproval") : t("task.rejected")}
            </span>
          </div>
        )}
        {editing && task!.archived_at && (
          <div className="field" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className="pill" style={{ background: "var(--surface-sunk)" }}>🗄 {t("task.archived")}</span>
            <button type="button" className="btn-secondary"
              onClick={async () => { await api.post(`/api/tasks/${task!.id}/unarchive`, {}); onSaved(); }}>
              {t("task.unarchive")}
            </button>
          </div>
        )}

        <div className="field">
          <label>{t("task.name")}</label>
          <input data-testid="task-title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus placeholder={t("task.namePlaceholder")} />
        </div>

        <div className="row2">
          <div className="field">
            <label>{t("task.project")}</label>
            <select value={projectId} onChange={(e) => pickProject(Number(e.target.value))}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t("task.subproject")}</label>
            <select value={subproject} onChange={(e) => setSubproject(Number(e.target.value))}>
              {subOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div className="row2">
          <div className="field">
            <label>{canChangeStatus ? t("task.statusApplied") : t("task.status")}</label>
            {canChangeStatus ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <StatusPill status={curStatus} />
                <select defaultValue="" onChange={(e) => e.target.value && changeStatus(e.target.value)} style={{ width: "auto" }}>
                  <option value="">{t("task.changeTo")}</option>
                  {statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
            ) : editing ? (
              <StatusPill status={curStatus} />
            ) : (
              <span className="muted" style={{ fontSize: 13 }}>{t("task.setAfterCreating")}</span>
            )}
          </div>
          <div className="field">
            <label>{t("task.priority")}</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <PriorityIcon level={priority} size={16} />
              <select data-testid="task-priority-select" value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
                {[5, 4, 3, 2, 1].map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
              </select>
            </div>
          </div>
        </div>

        <AssigneePicker
          users={users}
          groups={groups}
          assignees={assignees}
          setAssignees={setAssignees}
          assigneeGroups={assigneeGroups}
          setAssigneeGroups={setAssigneeGroups}
          subproject={subproject}
          isAdmin={me.is_admin}
        />

        <div className="row2">
          <div className="field">
            <label>{t("task.details")}</label>
            <textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} />
          </div>
          <div className="field">
            <label>{t("task.requirements")}</label>
            <textarea rows={3} value={requirements} onChange={(e) => setRequirements(e.target.value)} />
          </div>
        </div>

        <div className="row2">
          <div className="field">
            <label>
              {t("task.startDate")}{" "}
              <span className="info" title="If left blank and a deadline is set, the task shows on the calendar from its creation date up to the deadline.">ⓘ</span>
            </label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="field">
            <label>{t("task.deadline")}</label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
        </div>

        <div className="row2">
          <div className="field">
            <label>
              {t("task.startTime")}{" "}
              <span className="info" title="Optional. Set both times for a timed task (e.g. a class 1pm–4pm). Timed tasks sort to the top of a day's list.">ⓘ</span>
            </label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div className="field">
            <label>{t("task.endTime")}</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>{t("task.links")}</label>
          <textarea rows={2} value={links} onChange={(e) => setLinks(e.target.value)} placeholder="https://drive.google.com/…" />
        </div>

        <div className="field">
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" style={{ width: "auto" }} checked={repeats} onChange={(e) => setRepeats(e.target.checked)} />
            {t("task.repeats")}
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
            {freq === "weekly" && (
              <div className="field">
                <label>On days <span className="muted" style={{ fontWeight: 400 }}>(none = same weekday as start)</span></label>
                <div style={{ display: "flex", gap: 4 }}>
                  {WD_TOGGLES.map((w, i) => (
                    <button key={i} type="button"
                      className={weekdays.includes(w.n) ? "btn-primary" : "btn-secondary"}
                      style={{ width: 34, padding: "6px 0" }}
                      onClick={() => setWeekdays((d) => d.includes(w.n) ? d.filter((x) => x !== w.n) : [...d, w.n])}>
                      {w.label}</button>
                  ))}
                </div>
              </div>
            )}
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

        <div className="field">
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" style={{ width: "auto" }} checked={monitor} onChange={(e) => setMonitor(e.target.checked)} />
            {t("task.monitor")}
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
            <input type="checkbox" style={{ width: "auto" }} checked={autoComplete} onChange={(e) => setAutoComplete(e.target.checked)} />
            {t("task.autoComplete")}
          </label>
        </div>

        {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10 }}>{err}</div>}

        <div className="modal-foot">
          {editing && (
            <button type="button" className="btn-secondary" style={{ marginRight: "auto" }}
              onClick={async () => { const { shareUrl } = await import("../share"); setShareLabel(await shareUrl(`/?task=${task!.id}`)); setTimeout(() => setShareLabel(""), 2500); }}>
              🔗 {shareLabel || t("task.share")}
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onClose}>{t("common.cancel")}</button>
          {editing && <button type="button" className="btn-danger" onClick={del}>{t("common.delete")}</button>}
          <button className="btn-primary" data-testid="task-save" disabled={busy}>{busy ? t("task.saving") : t("common.save")}</button>
        </div>
      </form>
      {editing && <SubtaskEditor taskId={task!.id} onChanged={onChanged} />}
      {editing && <CommentSection taskId={task!.id} meId={me.id} meIsAdmin={me.is_admin} />}
    </Modal>
  );
}
