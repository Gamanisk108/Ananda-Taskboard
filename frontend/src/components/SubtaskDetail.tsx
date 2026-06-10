import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Clock } from "lucide-react";
import { api, ApiError } from "../api/client";
import { AssigneePicker, type GroupLite } from "./AssigneePicker";
import { PriorityIcon, StatusPill, SingleSelect, LinksEditor } from "./common";
import { Attachments } from "./Attachments";
import { useConfirm } from "./confirm";
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

/** The simplified Task Popup for one subtask (design D12): fields mirror the
 *  parent — Sub-task name · Status (pill + "Change to…") | Priority · Assignees ·
 *  Details | Requirements · dates · times (both-or-neither) · Links. The
 *  breadcrumb header (#parent.index) + Share live in the modal head (TaskModal);
 *  the footer is Delete-left + Save (the breadcrumb Back replaces a Back button). */
export function SubtaskDetail({ subtask, users, groups, statuses, subproject, isAdmin, onBack, onChanged }: Props) {
  const { t } = useTranslation();
  const confirm = useConfirm();
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
  const [links, setLinks] = useState((subtask.links ?? []).join("\n"));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  // D13: time-of-day is both-or-neither; flag the time fields when only one is set.
  const timeErr = !!startTime !== !!endTime;

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
        links: links.split("\n").map((s) => s.trim()).filter(Boolean),
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
    if (!(await confirm({ body: t("subtask.confirmDelete"), danger: true, confirmLabel: t("common.delete") }))) return;
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
      <div className="field">
        <label>{t("subtask.name", "Sub-task name")}</label>
        <input data-testid="subtask-detail-title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
      </div>

      <div className="row2">
        <div className="field">
          <label>{t("task.status")}</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <StatusPill status={status} />
            <SingleSelect testId="subtask-detail-status" value="" placeholder={t("task.changeTo")}
              onChange={(v) => v && setStatus(v)}
              options={statuses.map((s) => ({ value: s.key, label: s.label, color: s.color }))} />
          </div>
        </div>
        <div className="field">
          <label>{t("task.priority")}</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <PriorityIcon level={priority} size={16} />
            <SingleSelect width="100%" value={String(priority)} onChange={(v) => setPriority(Number(v))}
              options={[5, 4, 3, 2, 1].map((p) => ({ value: String(p), label: PRIORITY_META[p].label }))} />
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
        <div className={`field${timeErr ? " in-error" : ""}`} style={{ marginBottom: 6 }}>
          <label>{t("task.startTime")}</label>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div className={`field${timeErr ? " in-error" : ""}`} style={{ marginBottom: 6 }}>
          <label>{t("task.endTime")}</label>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>
      {timeErr && <div className="time-error"><Clock size={15} /> {t("tm.errTimes")}</div>}

      <div className="field">
        <label>{t("task.links")}</label>
        <LinksEditor value={links} onChange={setLinks} />
      </div>

      <div className="field">
        <Attachments target="subtask" targetId={subtask.id} canEdit label={t("attach.label")} />
      </div>

      {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10 }}>{err}</div>}

      <div className="modal-foot">
        <button type="button" className="btn-danger" style={{ marginRight: "auto" }} onClick={del}>{t("common.delete")}</button>
        <button className="btn-primary" data-testid="subtask-detail-save" disabled={busy}>{busy ? t("task.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}
