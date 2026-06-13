import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Eye, Archive, Share2, Pencil, ArrowLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { dfLocale } from "../dateLocale";
import { api, ApiError } from "../api/client";
import { buildSubLookup, writableProjects, todayISO } from "../lookup";
import { useUsers } from "../users";
import { useAdminGroups } from "../groups";
import { useStatuses, type TaskStatus } from "../statuses";
import { Modal, StatusPill, StatusPillSelect, PriorityIcon, LinksEditor, SingleSelect, useIsNarrow } from "./common";
import { useConfirm } from "./confirm";
import { useAuth } from "../state/auth";
import { CommentSection } from "./CommentSection";
import { SubtaskEditor } from "./SubtaskEditor";
import { SubtaskDetail } from "./SubtaskDetail";
import { Attachments } from "./Attachments";
import { AssigneePicker } from "./AssigneePicker";
import { PRIORITY_META, type Me, type Recurrence, type Subtask, type Task } from "../types";
import { InlineCreate, NEW_OPT } from "./InlineCreate";

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
          <span className="pill" style={{ background: "var(--surface-sunk)", display: "inline-flex", alignItems: "center", gap: 5 }}><Archive size={13} /> {t("task.archived")}</span>
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
function StatusField({ canChangeStatus, editing, curStatus, statuses, changeStatus, setStatus }: {
  canChangeStatus: boolean;
  editing: boolean;
  curStatus: string;
  statuses: TaskStatus[];
  changeStatus: (s: string) => void;
  setStatus: (s: string) => void;
}) {
  const { t } = useTranslation();
  // The status pill IS the dropdown (no separate pill + select). Read-only pill
  // only when editing an existing task without permission to change it.
  const opts = statuses.map((s) => ({ key: s.key, label: s.label, color: s.color }));
  return (
    <div className="field">
      <label>{canChangeStatus ? t("task.statusApplied") : t("task.status")}</label>
      {canChangeStatus ? (
        <StatusPillSelect value={curStatus} statuses={opts} onChange={changeStatus} />
      ) : editing ? (
        <StatusPill status={curStatus} />
      ) : (
        // DN9: new task gets a status picker (defaults to To Do) instead of a hint.
        <StatusPillSelect value={curStatus} statuses={opts} onChange={setStatus} />
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
          <SingleSelect width="100%" value={p.freq} onChange={(v) => p.setFreq(v as Recurrence["freq"])}
            options={(["daily", "weekly", "monthly", "yearly"] as const).map((f) => ({ value: f, label: t(`tm.freq${f.charAt(0).toUpperCase()}${f.slice(1)}`) }))} />
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
          <SingleSelect width="100%" value={p.endMode} onChange={(v) => p.setEndMode(v as EndMode)}
            options={[{ value: "none", label: t("settings.endsNever") }, { value: "date", label: t("tm.endOnDate") }, { value: "count", label: t("tm.endAfterN") }]} />
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

// Cancel / Delete / Save row, plus the share-link button when editing. For a
// read-only (view-only) task it collapses to a single Close button — no Save/Delete.
function ModalFooter({ editing, task, busy, readOnly, shareLabel, setShareLabel, onClose, del, hideShare }: {
  editing: boolean;
  task: Task | null;
  busy: boolean;
  readOnly: boolean;
  shareLabel: string;
  setShareLabel: Dispatch<SetStateAction<string>>;
  onClose: () => void;
  del: () => void;
  /** D49 (phones): Share lives in the fs-head icon — keep it out of the footer. */
  hideShare?: boolean;
}) {
  const { t } = useTranslation();
  if (readOnly) {
    return <button type="button" className="btn-secondary" onClick={onClose}>{t("common.close")}</button>;
  }
  return (
    <>
      {/* D5: destructive Delete sits far-LEFT in red; Share beside it; Cancel/Save right. */}
      <div style={{ display: "flex", gap: 8, marginRight: "auto" }}>
        {editing && <button type="button" className="btn-danger" onClick={del}>{t("common.delete")}</button>}
        {editing && !hideShare && (
          <button type="button" className="btn-secondary"
            onClick={async () => { const { shareUrl } = await import("../share"); setShareLabel(await shareUrl(`/?task=${task!.id}`)); setTimeout(() => setShareLabel(""), 2500); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Share2 size={14} /> {shareLabel || t("task.share")}
          </button>
        )}
      </div>
      <button type="button" className="btn-secondary" onClick={onClose}>{t("common.cancel")}</button>
      {/* submits the modal body's <form id="task-form"> even though the footer is rendered
          outside it (sticky footer, DN11). DN8: new task says "Create task". */}
      <button type="submit" form="task-form" className="btn-primary" data-testid="task-save" disabled={busy}>
        {busy ? t("task.saving") : editing ? t("common.save") : t("task.create", "Create task")}
      </button>
    </>
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

  // Projects/sub-projects created inline from the picker (admin "+ New…"). Kept
  // in local extras and merged over the prop list so the new entity is selectable
  // immediately, without a mid-edit refresh that would reset the form. The real
  // refresh happens via onChanged when the modal closes.
  const [extraProjects, setExtraProjects] = useState<typeof projects>([]);
  const [extraSubs, setExtraSubs] = useState<Record<number, { id: number; name: string }[]>>({});
  // Merge prop projects + local extras, DEDUPED by id — once a background refreshMe
  // pulls the new project into `projects`, the extras copy must not double it.
  const allProjects = useMemo(
    () => {
      const seenP = new Set<number>();
      return [...projects, ...extraProjects].filter((p) => !seenP.has(p.id) && seenP.add(p.id)).map((p) => {
        const seenS = new Set<number>();
        return {
          ...p,
          subprojects: [...(p.subprojects ?? []), ...(extraSubs[p.id] ?? [])]
            .filter((s) => !seenS.has(s.id) && seenS.add(s.id)),
        };
      });
    },
    [projects, extraProjects, extraSubs],
  );

  // Project + Sub-project (cascading). When editing, fixed to the task's own.
  const initialProject = task?.project ?? defaultProject ?? projects[0]?.id ?? 0;
  const [projectId, setProjectId] = useState<number>(initialProject);
  const subOptions = allProjects.find((p) => p.id === projectId)?.subprojects ?? [];
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
    const subs = allProjects.find((p) => p.id === id)?.subprojects ?? [];
    setSubproject(subs[0]?.id ?? 0);
  }

  // Inline-created project: stash it, select it + its default "General" sub.
  function addCreatedProject(p: (typeof projects)[number]) {
    setExtraProjects((a) => [...a, p]);
    setProjectId(p.id);
    setSubproject(p.subprojects?.[0]?.id ?? 0);
  }
  // Inline-created sub-project under the current project: stash + select it.
  function addCreatedSub(projId: number, s: { id: number; name: string }) {
    setExtraSubs((m) => ({ ...m, [projId]: [...(m[projId] ?? []), s] }));
    setSubproject(s.id);
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
      // DN9: send the chosen status only when creating (edits apply status
      // immediately via the dedicated status endpoint).
      ...(editing ? {} : { status: curStatus }),
    };
  }

  return {
    projectId, pickProject, subproject, setSubproject, subOptions,
    allProjects, addCreatedProject, addCreatedSub,
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
  const { refreshMe } = useAuth();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const editing = !!task;
  const projects = useMemo(() => writableProjects(me), [me]);
  const users = useUsers();
  const statuses = useStatuses();
  const groups = useAdminGroups(me);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [shareLabel, setShareLabel] = useState("");
  // When set, the modal body slides to this subtask's editor in place of the task
  // form (one window, breadcrumb back — never a stacked modal). Capped at one level:
  // subtasks have no subtasks, so the breadcrumb is only ever two deep.
  const [openSub, setOpenSub] = useState<Subtask | null>(null);
  // Inline create-on-the-fly from the project/sub-project pickers (admin only).
  const [creating, setCreating] = useState<null | "project" | "subproject">(null);
  // 1-based position of the open subtask among its siblings → the `#parent.index`
  // breadcrumb id (design D12). Supplied by SubtaskEditor when a row is opened.
  const [openSubIndex, setOpenSubIndex] = useState(0);
  // Synchronous in-flight guard: `busy` (state) updates a tick late, so 2–3 fast
  // clicks could all fire before the button re-renders disabled, creating duplicate
  // tasks (QA 2026-06-05). The ref blocks re-entry immediately.
  const submitting = useRef(false);

  // View-only when editing a task the user can't edit: a viewer-level sub-project, or
  // one not in their tree at all (e.g. visible only via direct assignment). Admins and
  // member-level holders edit normally. Drives the read-only form + real-scope display.
  const subLookup = useMemo(() => buildSubLookup(me.tree), [me]);
  const taskSub = task ? subLookup.get(task.subproject) : undefined;
  // D50: a pending submission is read-only for its member until approved
  // (admins edit via the approvals flow as before).
  const narrow = useIsNarrow();
  const pendingLock = !!task && task.approval_state === "pending" && !me.is_admin;
  const readOnly = pendingLock || (!!task && !me.is_admin && taskSub?.level !== "member");

  const fields = useTaskFields(task, me, projects, defaultProject, defaultSubproject);
  const rec = useRecurrenceState(task);
  const {
    projectId, pickProject, subproject, setSubproject, subOptions,
    allProjects, addCreatedProject, addCreatedSub,
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
    if (submitting.current) return;        // block double/triple-click duplicates
    setErr("");
    if (!title.trim()) { setErr(t("tm.errTitle", "Please enter a task name.")); return; }
    if (!subproject) { setErr(t("tm.errPickProject")); return; }
    if (!!startTime !== !!endTime) { setErr(t("tm.errTimes")); return; }
    if (startTime && endTime && endTime <= startTime) { setErr(t("tm.errEndTime")); return; }
    const payload = buildPayload(rec.build());
    submitting.current = true;
    setBusy(true);
    try {
      if (editing) await api.patch(`/api/tasks/${task!.id}`, payload);
      else await api.post("/api/tasks", payload);
      onSaved();
    } catch (e) {
      const ae = e as ApiError;
      setErr(ae.status === 403 ? t("tm.errPerm") : t("settings.errSave"));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  async function del() {
    if (!(await confirm({ body: t("tm.confirmDelete"), danger: true, confirmLabel: t("common.delete") }))) return;
    const id = task!.id;
    // Optimistic: drop the task from every cached list NOW + close the modal, so it
    // vanishes instantly (no wait on the DELETE round-trip). Delete in the
    // background; reconcile (and restore on failure) via invalidate.
    queryClient.setQueriesData({ queryKey: ["tasks"] }, (old) =>
      Array.isArray(old) ? (old as Task[]).filter((t) => t.id !== id) : old);
    onClose();
    try {
      await api.del(`/api/tasks/${id}`);
    } finally {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    }
  }

  if (editing && openSub) {
    // The breadcrumb REPLACES the modal title (design D12): ← Back · {Parent}
    // #142 › {Sub-task} #142.index, with Share to its right (✕ is the Modal's).
    const crumb = (
      <>
        <span className="sd-crumb">
          <button type="button" className="sd-back" onClick={() => setOpenSub(null)}>
            <ArrowLeft size={15} /> {t("subtask.backShort", "Back")}
          </button>
          <span className="cr">{task!.title} <span className="id-pill">#{task!.id}</span></span>
          <span className="sep"><ChevronRight size={14} /></span>
          <span className="cur" title={openSub.title}>{openSub.title} <span className="id-pill">#{task!.id}.{openSubIndex}</span></span>
        </span>
        <button type="button" className="btn-secondary head-share" style={{ flex: "none" }}
          onClick={async () => { const { shareUrl } = await import("../share"); setShareLabel(await shareUrl(`/?task=${task!.id}&subtask=${openSub.id}`)); setTimeout(() => setShareLabel(""), 2500); }}>
          <Share2 size={14} /> {shareLabel || t("task.share")}
        </button>
      </>
    );
    return (
      <Modal fullScreenOnNarrow title={crumb} onClose={onClose} wide>
        <SubtaskDetail
          subtask={openSub}
          users={users}
          groups={groups}
          statuses={statuses}
          subproject={task!.subproject}
          isAdmin={me.is_admin}
          onBack={() => setOpenSub(null)}
          onChanged={onChanged}
        />
      </Modal>
    );
  }

  return (
    <Modal fullScreenOnNarrow onClose={onClose} wide
      /* D49: on phones Share is a ghost icon at the right end of the fs-head
         (echoes D12's subtask-breadcrumb Share); the footer drops it. */
      headerAction={editing && !readOnly ? (
        <button type="button" className="ic fs-share" aria-label={shareLabel || t("task.share")}
          title={shareLabel || t("task.share")}
          onClick={async () => { const { shareUrl } = await import("../share"); setShareLabel(await shareUrl(`/?task=${task!.id}`)); setTimeout(() => setShareLabel(""), 2500); }}>
          <Share2 />
        </button>
      ) : undefined}
      title={/* DN10: the header IS the inline-editable task title + pen + #id chip. */
        <span className="task-title-head">
          {/* Only autofocus when CREATING (so a long existing title stays blurred
              and shows its ellipsis instead of the cursor-pinned clipped start);
              title attr surfaces the full name on hover. Never hard-clips. */}
          <input className="task-title-input" data-testid="task-title" value={title}
            onChange={(e) => setTitle(e.target.value)} disabled={readOnly} autoFocus={!editing}
            title={title} placeholder={t("task.namePlaceholder")} aria-label={t("task.name")} />
          {!readOnly && <Pencil size={14} className="task-title-pen" aria-hidden />}
          {editing && <span className="task-id-chip">#{task!.id}</span>}
        </span>}
      footer={<ModalFooter editing={editing} task={task} busy={busy} readOnly={readOnly} shareLabel={shareLabel} setShareLabel={setShareLabel} onClose={onClose} del={del} hideShare={narrow} />}>
      <form id="task-form" onSubmit={save}>
        {editing && task!.created_at && (
          <div style={{ textAlign: "right", fontSize: 12, color: "var(--muted)", margin: "-6px 0 8px" }}>
            {t("task.createdOn", "Created {{date}}", {
              date: format(new Date(task!.created_at), "MMM d, yyyy", { locale: dfLocale() }),
            })}
          </div>
        )}
        {editing && <ApprovalBanners task={task!} onSaved={onSaved} />}
        {readOnly && (
          <div className="field">
            <span className="pill" style={{ background: "var(--surface-sunk)", display: "inline-flex", alignItems: "center", gap: 5 }} title={t("task.viewOnlyHint")}><Eye size={14} strokeWidth={1.7} /> {t("task.viewOnly")}</span>
          </div>
        )}

        {/* A disabled fieldset makes every control inside read-only in one stroke — so
            a viewer is never shown an editable form that only 403s on Save. */}
        <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minInlineSize: 0 }}>
        {/* DN10: task name is edited in the modal header (above), not a body field. */}

        {readOnly ? (
          // Show the task's REAL project/sub-project. The editable picker is filtered to
          // postable projects, which would mis-display (or mis-relocate) a view-only task.
          <div className="row2">
            <div className="field">
              <label>{t("task.project")}</label>
              <div className="muted" style={{ padding: "8px 0" }}>{taskSub?.projectName ?? "—"}</div>
            </div>
            <div className="field">
              <label>{t("task.subproject")}</label>
              <div className="muted" style={{ padding: "8px 0" }}>{taskSub?.name ?? "—"}</div>
            </div>
          </div>
        ) : (
          <>
          <div className="row2">
            <div className="field">
              <label>{t("task.project")}</label>
              <SingleSelect width="100%" value={String(projectId)}
                onChange={(v) => (v === NEW_OPT ? setCreating("project") : pickProject(Number(v)))}
                options={[
                  ...allProjects.map((p) => ({ value: String(p.id), label: p.name })),
                  ...(me.is_admin ? [{ value: NEW_OPT, label: t("tm.newProject", "+ New project…") }] : []),
                ]} />
            </div>
            <div className="field">
              <label>{t("task.subproject")}</label>
              <SingleSelect width="100%" value={String(subproject)}
                onChange={(v) => (v === NEW_OPT ? setCreating("subproject") : setSubproject(Number(v)))}
                options={[
                  ...subOptions.map((s) => ({ value: String(s.id), label: s.name })),
                  ...(me.is_admin && projectId ? [{ value: NEW_OPT, label: t("tm.newSubproject", "+ New sub-project…") }] : []),
                ]} />
            </div>
          </div>
          {creating && (
            <InlineCreate
              kind={creating}
              projectId={projectId}
              onCancel={() => setCreating(null)}
              onCreated={(entity) => {
                if (creating === "project") addCreatedProject(entity as (typeof allProjects)[number]);
                else addCreatedSub(projectId, entity as { id: number; name: string });
                setCreating(null);
                onChanged?.();
                // Refresh me.tree so the new project/sub is known app-wide — else the
                // saved task renders blank in the board and is missing from pickers
                // until the next full reload (Gordon 2026-06-13).
                refreshMe().catch(() => {});
              }}
            />
          )}
          </>
        )}

        <div className="row2">
          <StatusField canChangeStatus={canChangeStatus} editing={editing} curStatus={curStatus} statuses={statuses} changeStatus={changeStatus} setStatus={setCurStatus} />
          <div className="field">
            <label>{t("task.priority")}</label>
            {/* Auto-width (not 100%): the trigger hugs the label + icon (Gordon)
                instead of stretching across the half-row column. */}
            <SingleSelect testId="task-priority-select" value={String(priority)} onChange={(v) => setPriority(Number(v))}
              options={[5, 4, 3, 2, 1].map((p) => ({ value: String(p), label: PRIORITY_META[p].label, icon: <PriorityIcon level={p} size={16} /> }))} />
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
          <LinksEditor value={links} onChange={setLinks} disabled={readOnly} />
        </div>

        {editing && (
          <div className="field">
            <Attachments target="task" targetId={task!.id} canEdit={!readOnly} label={t("attach.label")} />
          </div>
        )}

        <div className="field" style={{ marginBottom: 10 }}>
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
          {/* Even 10px rhythm across the three toggles (design): Repeats→Monitor and
              Monitor→Auto-complete are the same gap. */}
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
            <input type="checkbox" style={{ width: "auto" }} checked={autoComplete} onChange={(e) => setAutoComplete(e.target.checked)} />
            {t("task.autoComplete")}
          </label>
        </div>
        </fieldset>

        {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10 }}>{err}</div>}
      </form>
      {editing && <SubtaskEditor taskId={task!.id} onOpen={(s, i) => { setOpenSub(s); setOpenSubIndex(i); }} onChanged={onChanged} />}
      {editing && <CommentSection taskId={task!.id} meId={me.id} meIsAdmin={me.is_admin} />}
    </Modal>
  );
}
