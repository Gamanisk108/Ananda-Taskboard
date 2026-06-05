import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { buildSubLookup, deadlineState, timeRange } from "../lookup";
import { useUsers, userName } from "../users";
import { useStatuses, isComplete } from "../statuses";
import { ColorDot, StatusPill, Spinner, PriorityIcon, SubtaskDots } from "./common";
import { PRIORITY_META, type Me, type Task } from "../types";

interface Props {
  projectId?: number;
  subprojectId?: number;
  refreshKey: number;
  onEdit: (t: Task) => void;
  me: Me;
  showArchived?: boolean;
}

type SortKey = "title" | "project" | "subproject" | "status" | "deadline" | "time" | "priority" | "assignee" | "created";

// The combinable client-side filters. Tab scope (project/subproject) and the
// group filter are applied server-side; everything here narrows the result.
interface TaskFilters {
  q: string;
  fProject: number;
  fSub: number;
  fAssignee: number; // person id; -1 = unassigned; 0 = any
  fStatus: string;
  fPriority: number;
  fRecur: "" | "yes" | "no";
  fDeadline: "" | "pending" | "overdue";
}

type SubInfo = ReturnType<typeof buildSubLookup>;

// Text/project/subproject scope.
function matchesScope(t: Task, f: TaskFilters, info: ReturnType<SubInfo["get"]>): boolean {
  if (f.q && !t.title.toLowerCase().includes(f.q.toLowerCase())) return false;
  if (f.fProject && info?.projectId !== f.fProject) return false;
  if (f.fSub && t.subproject !== f.fSub) return false;
  return true;
}

// Assignee / status / priority / recurrence attributes.
function matchesAttributes(t: Task, f: TaskFilters): boolean {
  if (f.fAssignee === -1 ? t.assignees.length !== 0 : f.fAssignee && !t.assignees.includes(f.fAssignee)) return false;
  if (f.fStatus && t.status !== f.fStatus) return false;
  if (f.fPriority && t.priority !== f.fPriority) return false;
  if (f.fRecur === "yes" && !t.recurrence) return false;
  if (f.fRecur === "no" && t.recurrence) return false;
  return true;
}

// Deadline state: overdue, or 'pending' = open with a current/upcoming deadline.
function matchesDeadline(t: Task, fDeadline: TaskFilters["fDeadline"]): boolean {
  if (!fDeadline) return true;
  const ds = deadlineState(t.deadline, isComplete(t.status));
  if (fDeadline === "overdue") return ds === "overdue";
  return !!(t.deadline && !isComplete(t.status) && ds !== "overdue");
}

// Pure predicate: does a task pass every active filter? Composed from the
// themed predicates above so each stays small and unit-testable.
function matchesFilters(t: Task, f: TaskFilters, subs: SubInfo): boolean {
  const info = subs.get(t.subproject);
  return matchesScope(t, f, info) && matchesAttributes(t, f) && matchesDeadline(t, f.fDeadline);
}

export function ListView({ projectId, subprojectId, refreshKey, onEdit, me, showArchived = false }: Props) {
  const { t: tr } = useTranslation();  // aliased: `t` is used below for the task row
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [q, setQ] = useState("");
  // combinable filters
  const [fProject, setFProject] = useState(0);
  const [fSub, setFSub] = useState(0);
  const [fAssignee, setFAssignee] = useState(0);     // person id; -1 = unassigned; 0 = any
  const [fAssigneeGroup, setFAssigneeGroup] = useState(0); // group id; 0 = none (server-side filter)
  const [fStatus, setFStatus] = useState<string>("");
  const [fRecur, setFRecur] = useState<"" | "yes" | "no">("");
  const [fDeadline, setFDeadline] = useState<"" | "pending" | "overdue">("");
  const [fPriority, setFPriority] = useState(0); // 0 = any, 1..5
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const subs = useMemo(() => buildSubLookup(me.tree), [me.tree]);
  const users = useUsers();
  const statuses = useStatuses();
  const statusOrder = useMemo(() => Object.fromEntries(statuses.map((s, i) => [s.key, i])), [statuses]);

  // Tab scope (project/subproject) is applied server-side; everything else is client-side.
  useEffect(() => {
    const params = new URLSearchParams();
    if (subprojectId) params.set("subproject", String(subprojectId));
    else if (projectId) params.set("project", String(projectId));
    if (showArchived) params.set("archived", "1");
    // Group filter is server-side (needs membership expansion the client can't see).
    if (fAssigneeGroup) params.set("assignee_group", String(fAssigneeGroup));
    setTasks(null);
    api.get(`/api/tasks?${params}`).then(setTasks).catch(() => setTasks([]));
  }, [projectId, subprojectId, refreshKey, showArchived, fAssigneeGroup]);

  const assigneeNames = (t: Task) => t.assignees.map((id) => userName(users, id));

  // filter option lists
  const projectOpts = me.tree.projects;
  const subOpts = fProject
    ? (projectOpts.find((p) => p.id === fProject)?.subprojects ?? [])
    : projectOpts.flatMap((p) => p.subprojects);

  function sortVal(t: Task): string | number {
    const info = subs.get(t.subproject);
    switch (sortKey) {
      case "title": return t.title.toLowerCase();
      case "project": return (info?.projectName ?? "").toLowerCase();
      case "subproject": return (info?.name ?? "").toLowerCase();
      case "status": return statusOrder[t.status] ?? 99;
      case "deadline": return t.deadline ?? "9999-99-99";
      case "time": return t.start_time ?? "99:99"; // untimed sort last
      case "priority": return t.priority;
      case "assignee": return (assigneeNames(t)[0] ?? "~").toLowerCase();
      case "created": return t.created_at;
    }
  }
  function clickSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(key); setSortDir(1); }
  }
  function clearFilters() {
    setQ(""); setFProject(0); setFSub(0); setFAssignee(0); setFAssigneeGroup(0); setFStatus(""); setFRecur(""); setFDeadline(""); setFPriority(0);
  }
  const activeFilters = [q, fProject, fSub, fAssignee, fAssigneeGroup, fStatus, fRecur, fDeadline, fPriority].filter(Boolean).length;

  if (!tasks) return <Spinner />;

  const filters: TaskFilters = { q, fProject, fSub, fAssignee, fStatus, fPriority, fRecur, fDeadline };
  const filtered = tasks
    .filter((t) => matchesFilters(t, filters, subs))
    .sort((a, b) => {
      const va = sortVal(a), vb = sortVal(b);
      if (va < vb) return -1 * sortDir;
      if (va > vb) return 1 * sortDir;
      return 0;
    });

  const arrow = (key: SortKey) => (sortKey === key ? <span className="sort-arrow">{sortDir === 1 ? "▲" : "▼"}</span> : null);
  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th className="sortable" onClick={() => clickSort(k)}>{children}{arrow(k)}</th>
  );

  return (
    <div className="rise">
      <div className="filters">
        <input placeholder={tr("common.search")} value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={fProject} onChange={(e) => { setFProject(Number(e.target.value)); setFSub(0); }}>
          <option value={0}>{tr("list.allProjects")}</option>
          {projectOpts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={fSub} onChange={(e) => setFSub(Number(e.target.value))}>
          <option value={0}>{tr("list.allSubprojects")}</option>
          {subOpts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select data-testid="filter-assignee"
          value={fAssigneeGroup ? `g:${fAssigneeGroup}` : fAssignee === -1 ? "unassigned" : fAssignee ? `u:${fAssignee}` : ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v.startsWith("g:")) { setFAssigneeGroup(Number(v.slice(2))); setFAssignee(0); }
            else { setFAssigneeGroup(0); setFAssignee(v === "unassigned" ? -1 : v.startsWith("u:") ? Number(v.slice(2)) : 0); }
          }}>
          <option value="">{tr("list.anyAssignee")}</option>
          <option value="unassigned">{tr("list.unassigned")}</option>
          <optgroup label={tr("list.people")}>
            {users.map((u) => <option key={u.id} value={`u:${u.id}`}>{u.name || u.email}</option>)}
          </optgroup>
          {me.groups.length > 0 && (
            <optgroup label={tr("list.groups")}>
              {me.groups.map((g) => <option key={g.id} value={`g:${g.id}`}>👥 {g.name}</option>)}
            </optgroup>
          )}
        </select>
        <select data-testid="filter-priority" value={fPriority} onChange={(e) => setFPriority(Number(e.target.value))}>
          <option value={0}>{tr("list.anyPriority")}</option>
          {[5, 4, 3, 2, 1].map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">{tr("list.anyStatus")}</option>
          {statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select value={fDeadline} onChange={(e) => setFDeadline(e.target.value as "" | "pending" | "overdue")}>
          <option value="">{tr("list.deadlineAny")}</option>
          <option value="pending">{tr("list.pendingUpcoming")}</option>
          <option value="overdue">{tr("list.overdue")}</option>
        </select>
        <select value={fRecur} onChange={(e) => setFRecur(e.target.value as "" | "yes" | "no")}>
          <option value="">{tr("list.recurringAny")}</option>
          <option value="yes">{tr("list.recurringOnly")}</option>
          <option value="no">{tr("list.oneOffOnly")}</option>
        </select>
        {activeFilters > 0 && <button className="btn-ghost" onClick={clearFilters}>Clear ({activeFilters})</button>}
        {showArchived && <span className="pill" style={{ background: "var(--surface-sunk)" }}>📖 Showing archive</span>}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">{activeFilters ? "No tasks match these filters." : "No tasks here yet."}</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <Th k="priority">{tr("list.colPriority")}</Th>
              <Th k="title">{tr("list.colTask")}</Th>
              <Th k="project">{tr("list.colProject")}</Th>
              <Th k="subproject">{tr("list.colSubproject")}</Th>
              <Th k="assignee">{tr("list.colAssignees")}</Th>
              <Th k="status">{tr("list.colStatus")}</Th>
              <Th k="deadline">{tr("list.colDeadline")}</Th>
              <Th k="time">{tr("list.colTime")}</Th>
              <th>{tr("list.colRecurs")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const info = subs.get(t.subproject);
              const ds = deadlineState(t.deadline, isComplete(t.status));
              const names = assigneeNames(t);
              return (
                <tr key={t.id} data-testid="task-row" className={ds === "overdue" ? "overdue" : ds === "soon" ? "due-soon" : ""} onClick={() => onEdit(t)}>
                  <td title={PRIORITY_META[t.priority].label} data-testid="task-priority"><PriorityIcon level={t.priority} /></td>
                  <td>
                    <strong>{t.title}</strong>
                    {ds === "overdue" && <span className="od" title={tr("list.missedDeadline")}> ❗</span>}
                    {ds === "soon" && <span className="od-soon" title={tr("list.dueSoon")}> ❗</span>}
                    {Object.keys(t.subtask_counts ?? {}).length > 0 && (
                      <div style={{ marginTop: 3 }} data-testid="subtask-dots"><SubtaskDots counts={t.subtask_counts} /></div>
                    )}
                  </td>
                  <td>{info && <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><ColorDot color={info.projectColor} /> {info.projectName}</span>}</td>
                  <td>{info && <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><ColorDot color={info.color} /> {info.name}</span>}</td>
                  <td>
                    {names.length === 0 ? <span className="muted">—</span> : (
                      <span className="who">{names.map((n, i) => <span key={i} className="pill">{n}</span>)}</span>
                    )}
                  </td>
                  <td><StatusPill status={t.status} /></td>
                  <td className="deadline mono">{t.deadline ?? "—"}</td>
                  <td className="mono" style={{ whiteSpace: "nowrap" }}>{timeRange(t.start_time, t.end_time) || <span className="muted">—</span>}</td>
                  <td className="muted">{t.recurrence ? t.recurrence.freq : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
