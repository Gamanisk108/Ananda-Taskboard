import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../api/client";
import { AssigneePicker, type GroupLite } from "./AssigneePicker";
import { PriorityIcon } from "./common";
import type { TaskStatus } from "../statuses";
import { PRIORITY_META, type Subtask, type UserLite } from "../types";

interface Props {
  subtask: Subtask;
  users: UserLite[];
  groups: GroupLite[];
  statuses: TaskStatus[];
  subproject: number; // parent task's sub-project — scopes the assignee picker
  isAdmin: boolean;
  onBack: () => void;
  onChanged?: () => void; // refresh the parent list + status counts
}

/** The simplified Task Popup for one subtask: status, priority, assignees/groups,
 *  notes and optional dates/times. No repeating, no auto-complete, no nesting —
 *  shown in place of the task form (breadcrumb back), so editors never stack. */
export function SubtaskDetail({ subtask, users, groups, statuses, subproject, isAdmin, onBack, onChanged }: Props) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(subtask.title);
  const [status, setStatus] = useState(subtask.status);
  const [priority, setPriority] = useState<number>(subtask.priority ?? 3);
  const [assignees, setAssignees] = useState<number[]>(subtask.assignees ?? []);
  const [assigneeGroups, setAssigneeGroups] = useState<number[]>(subtask.assignee_groups ?? []);
  const [details, setDetails] = useState(subtask.details ?? "");
  const [requirements, setRequirements] = useState(subtask.requirements ?? "");
  const [startDate, setStartDate] = useState(subtask.timeline_start ?? "");
  const [deadline, setDeadline] = useState(subtask.deadline ?? "");
  const [startTime, setStartTime] = useState(subtask.start_time ?? "");
  const [endTime, setEndTime] = useState(subtask.end_time ?? "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    setErr("");
    if (!title.trim()) { setErr(t("task.name")); return; }
    if (!!startTime !== !!endTime) { setErr(t("tm.errTimes")); return; }
    if (startTime && endTime && endTime <= startTime) { setErr(t("tm.errEndTime")); return; }
    submitting.current = true;
    setBusy(true);
    try {
      await api.patch(`/api/subtasks/${subtask.id}`, {
        title: title.trim(), status, priority,
        assignees, assignee_groups: assigneeGroups,
        details, requirements,
        timeline_start: startDate || null,
        deadline: deadline || null,
        start_time: startTime || null,
        end_time: endTime || null,
      });
      onChanged?.();
      onBack();
    } catch (e) {
      const ae = e as ApiError;
      setErr(ae.status === 403 ? t("tm.errPerm") : t("settings.errSave"));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  async function del() {
    if (!confirm(t("subtask.confirmDelete"))) return;
    try {
      await api.del(`/api/subtasks/${subtask.id}`);
      onChanged?.();
      onBack();
    } catch {
      setErr(t("tm.errDelete"));
    }
  }

  return (
    <form onSubmit={save}>
      <div className="subtask-crumb" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, fontSize: 14 }}>
        <button type="button" className="btn-ghost" onClick={onBack} style={{ padding: "2px 6px" }}>← {t("task.subtasks")}</button>
        <span className="muted">›</span>
        <span style={{ fontWeight: 600 }}>{title || subtask.title}</span>
      </div>

      <div className="field">
        <label>{t("task.name")}</label>
        <input data-testid="subtask-detail-title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
      </div>

      <div className="row2">
        <div className="field">
          <label>{t("task.status")}</label>
          <select data-testid="subtask-detail-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>{t("task.priority")}</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <PriorityIcon level={priority} size={16} />
            <select value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
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
        isAdmin={isAdmin}
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
          <label>{t("task.startDate")}</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="field">
          <label>{t("task.deadline")}</label>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
      </div>

      <div className="row2">
        <div className="field">
          <label>{t("task.startTime")}</label>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div className="field">
          <label>{t("task.endTime")}</label>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>

      {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10 }}>{err}</div>}

      <div className="modal-foot">
        <button type="button" className="btn-secondary" style={{ marginRight: "auto" }} onClick={onBack}>← {t("subtask.back")}</button>
        <button type="button" className="btn-danger" onClick={del}>{t("common.delete")}</button>
        <button className="btn-primary" data-testid="subtask-detail-save" disabled={busy}>{busy ? t("task.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}
