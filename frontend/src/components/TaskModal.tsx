import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../api/client";
import { writableProjects, todayISO } from "../lookup";
import { useUsers } from "../users";
import { useAdminGroups } from "../groups";
import { useStatuses, type TaskStatus } from "../statuses";
import { Modal, StatusPill, PriorityIcon } from "./common";
import { CommentSection } from "./CommentSection";
import { SubtaskEditor } from "./SubtaskEditor";
import { AssigneePicker } from "./AssigneePicker";
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

// The pending/rejected and archived banners shown at the top when editing.
function ApprovalBanners({ task, onSaved }: { task: Task; onSaved: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      {task.approval_state !== "approved" && (
        <div className="field">
          <span className="pill" style={{ background: "#b7791f1a", color: "var(--warn)" }}>
            {task.approval_state === "pending" ? t("task.pendingApproval") : t("task.rejected")}
          </span>
        </div>
      )}
      {task.archived_at && (
        <div className="field" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className="pill" style={{ background: "var(--surface-sunk)" }}>🗄 {t("task.archived")}</span>
          <button type="button" className="btn-secondary"
            onClick={async () => { await api.post(`/api/tasks/${task.id}/unarchive`, {}); onSaved(); }}>
            {t("task.unarchive")}
          </button>
        </div>
      )}
    </>
  );
}

// Status field: an inline status picker for those who may change it, a read-only
// pill when editing without permission, or a hint before the task exists.
function StatusField({ canChangeStatus, editing, curStatus, statuses, changeStatus }: {
  canChangeStatus: boolean;
  editing: boolean;
  curStatus: string;
  statuses: TaskStatus[];
  changeStatus: (s: string) => void;
}) {
  const { t } = useTranslation();
  return (
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
  );
}

interface RecurrenceFieldsProps {
  freq: Recurrence["freq"];
  setFreq: Dispatch<SetStateAction<Recurrence["freq"]>>;
  interval: number;
  setInterval: Dispatch<SetStateAction<number>>;
  weekdays: number[];
  setWeekdays: Dispatch<SetStateAction<number[]>>;
  anchor: string;
  setAnchor: Dispatch<SetStateAction<string>>;
  endMode: EndMode;
  setEndMode: Dispatch<SetStateAction<EndMode>>;
  endDate: string;
  setEndDate: Dispatch<SetStateAction<string>>;
  count: number;
  setCount: Dispatch<SetStateAction<number>>;
}

// The recurrence editor card, shown when "repeats" is on.
function RecurrenceFields(p: RecurrenceFieldsProps) {
  const { t } = useTranslation();
  return (
    <div className="card" style={{ padding: 12, marginBottom: 14, background: "var(--surface-sunk)" }}>
      <div className="row2">
        <div className="field">
          <label>{t("tm.frequency")}</label>
          <select value={p.freq} onChange={(e) => p.setFreq(e.target.value as Recurrence["freq"])}>
            {(["daily", "weekly", "monthly", "yearly"] as const).map((f) => (
              <option key={f} value={f}>{t(`tm.freq${f.charAt(0).toUpperCase()}${f.slice(1)}`)}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{t("tm.everyInterval")}</label>
          <input type="number" min={1} value={p.interval} onChange={(e) => p.setInterval(Number(e.target.value))} />
        </div>
      </div>
      {p.freq === "weekly" && (
        <div className="field">
          <label>{t("tm.onDays")} <span className="muted" style={{ fontWeight: 400 }}>{t("tm.onDaysHint")}</span></label>
          <div style={{ display: "flex", gap: 4 }}>
            {WD_TOGGLES.map((w, i) => (
              <button key={i} type="button"
                className={p.weekdays.includes(w.n) ? "btn-primary" : "btn-secondary"}
                style={{ width: 34, padding: "6px 0" }}
                onClick={() => p.setWeekdays((d) => d.includes(w.n) ? d.filter((x) => x !== w.n) : [...d, w.n])}>
                {w.label}</button>
            ))}
          </div>
        </div>
      )}
      <div className="row2">
        <div className="field">
          <label>{t("tm.startsAnchor")}</label>
          <input type="date" value={p.anchor} onChange={(e) => p.setAnchor(e.target.value)} />
        </div>
        <div className="field">
          <label>{t("settings.ends")}</label>
          <select value={p.endMode} onChange={(e) => p.setEndMode(e.target.value as EndMode)}>
            <option value="none">{t("settings.endsNever")}</option>
            <option value="date">{t("tm.endOnDate")}</option>
            <option value="count">{t("tm.endAfterN")}</option>
          </select>
        </div>
      </div>
      {p.endMode === "date" && (
        <div className="field"><label>{t("settings.endDate")}</label>
          <input type="date" value={p.endDate} onChange={(e) => p.setEndDate(e.target.value)} /></div>
      )}
      {p.endMode === "count" && (
        <div className="field"><label>{t("tm.occurrences")}</label>
          <input type="number" min={1} value={p.count} onChange={(e) => p.setCount(Number(e.target.value))} /></div>
      )}
    </div>
  );
}

// Cancel / Delete / Save row, plus the share-link button when editing.
function ModalFooter({ editing, task, busy, shareLabel, setShareLabel, onClose, del }: {
  editing: boolean;
  task: Task | null;
  busy: boolean;
  shareLabel: string;
  setShareLabel: Dispatch<SetStateAction<string>>;
  onClose: () => void;
  del: () => void;
}) {
  const { t } = useTranslation();
  return (
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
  );
}

// All core field state plus the cascading project picker and the save payload
// builder, kept in a hook so the modal body stays focused on layout.
function useTaskFields(
  task: Task | null,
  me: Me,
  projects: ReturnType<typeof writableProjects>,
  defaultProject?: number,
  defaultSubproject?: number,
) {
  const editing = !!task;

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
  const [curStatus, setCurStatus] = useState<string>(task?.status ?? "todo");
  const canChangeStatus = editing && (me.is_admin || (task!.assignees ?? []).includes(me.id));

  function pickProject(id: number) {
    setProjectId(id);
    const subs = projects.find((p) => p.id === id)?.subprojects ?? [];
    setSubproject(subs[0]?.id ?? 0);
  }

  function buildPayload(recurrence: Recurrence | null) {
    return {
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
  }

  return {
    projectId, pickProject, subproject, setSubproject, subOptions,
    title, setTitle, details, setDetails, requirements, setRequirements,
    startDate, setStartDate, deadline, setDeadline, startTime, setStartTime,
    endTime, setEndTime, priority, setPriority, links, setLinks,
    assignees, setAssignees, assigneeGroups, setAssigneeGroups,
    monitor, setMonitor, autoComplete, setAutoComplete,
    curStatus, setCurStatus, canChangeStatus, buildPayload,
  };
}

// All recurrence-editor state, the props bundle for <RecurrenceFields>, and the
// recurrence payload builder.
function useRecurrenceState(task: Task | null) {
  const [repeats, setRepeats] = useState(!!task?.recurrence);
  const [freq, setFreq] = useState<Recurrence["freq"]>(task?.recurrence?.freq ?? "weekly");
  const [weekdays, setWeekdays] = useState<number[]>(task?.recurrence?.weekdays ?? []);
  const [interval, setInterval] = useState(task?.recurrence?.interval ?? 1);
  const [anchor, setAnchor] = useState(task?.recurrence?.anchor ?? (task?.deadline || todayISO()));
  const [endMode, setEndMode] = useState<EndMode>(
    task?.recurrence?.end_date ? "date" : task?.recurrence?.count ? "count" : "none"
  );
  const [endDate, setEndDate] = useState(task?.recurrence?.end_date ?? "");
  const [count, setCount] = useState(task?.recurrence?.count ?? 10);

  const fields: RecurrenceFieldsProps = {
    freq, setFreq, interval, setInterval, weekdays, setWeekdays,
    anchor, setAnchor, endMode, setEndMode, endDate, setEndDate, count, setCount,
  };
  const build = (): Recurrence | null =>
    repeats
      ? { freq, interval, anchor, end_date: endMode === "date" ? endDate : null,
          count: endMode === "count" ? count : null, weekdays: freq === "weekly" ? weekdays : [] }
      : null;

  return { repeats, setRepeats, fields, build };
}

export function TaskModal({ task, me, defaultSubproject, defaultProject, onClose, onSaved, onChanged }: Props) {
  const { t } = useTranslation();
  const editing = !!task;
  const projects = useMemo(() => writableProjects(me), [me]);
  const users = useUsers();
  const statuses = useStatuses();
  const groups = useAdminGroups(me);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [shareLabel, setShareLabel] = useState("");

  const fields = useTaskFields(task, me, projects, defaultProject, defaultSubproject);
  const rec = useRecurrenceState(task);
  const {
    projectId, pickProject, subproject, setSubproject, subOptions,
    title, setTitle, details, setDetails, requirements, setRequirements,
    startDate, setStartDate, deadline, setDeadline, startTime, setStartTime,
    endTime, setEndTime, priority, setPriority, links, setLinks,
    assignees, setAssignees, assigneeGroups, setAssigneeGroups,
    monitor, setMonitor, autoComplete, setAutoComplete,
    curStatus, setCurStatus, canChangeStatus, buildPayload,
  } = fields;

  async function changeStatus(s: string) {
    try {
      await api.post(`/api/tasks/${task!.id}/status`, { status: s });
      setCurStatus(s);          // update in place — do NOT close the modal
      onChanged?.();            // refresh the list behind the modal
    } catch {
      setErr(t("tm.errStatus"));
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!subproject) { setErr(t("tm.errPickProject")); return; }
    if (!!startTime !== !!endTime) { setErr(t("tm.errTimes")); return; }
    if (startTime && endTime && endTime <= startTime) { setErr(t("tm.errEndTime")); return; }
    const payload = buildPayload(rec.build());
    setBusy(true);
    try {
      if (editing) await api.patch(`/api/tasks/${task!.id}`, payload);
      else await api.post("/api/tasks", payload);
      onSaved();
    } catch (e) {
      const ae = e as ApiError;
      setErr(ae.status === 403 ? t("tm.errPerm") : t("settings.errSave"));
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!confirm(t("tm.confirmDelete"))) return;
    try {
      await api.del(`/api/tasks/${task!.id}`);
      onSaved();
    } catch {
      setErr(t("tm.errDelete"));
    }
  }

  return (
    <Modal title={editing ? `${t("task.edit")} · #${task!.id}` : t("task.new")} onClose={onClose} wide>
      <form onSubmit={save}>
        {editing && <ApprovalBanners task={task!} onSaved={onSaved} />}

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
          <StatusField canChangeStatus={canChangeStatus} editing={editing} curStatus={curStatus} statuses={statuses} changeStatus={changeStatus} />
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
              <span className="info" title={t("tm.startDateInfo")}>ⓘ</span>
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
              <span className="info" title={t("tm.startTimeInfo")}>ⓘ</span>
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
            <input type="checkbox" style={{ width: "auto" }} checked={rec.repeats} onChange={(e) => rec.setRepeats(e.target.checked)} />
            {t("task.repeats")}
          </label>
        </div>
        {rec.repeats && <RecurrenceFields {...rec.fields} />}

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

        <ModalFooter editing={editing} task={task} busy={busy} shareLabel={shareLabel} setShareLabel={setShareLabel} onClose={onClose} del={del} />
      </form>
      {editing && <SubtaskEditor taskId={task!.id} onChanged={onChanged} />}
      {editing && <CommentSection taskId={task!.id} meId={me.id} meIsAdmin={me.is_admin} />}
    </Modal>
  );
}
