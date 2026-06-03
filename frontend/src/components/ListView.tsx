import { useEffect, useMemo, useState } from "react";
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

export function ListView({ projectId, subprojectId, refreshKey, onEdit, me, showArchived = false }: Props) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [q, setQ] = useState("");
  // combinable filters
  const [fProject, setFProject] = useState(0);
  const [fSub, setFSub] = useState(0);
  const [fAssignee, setFAssignee] = useState(0);
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
    setTasks(null);
    api.get(`/api/tasks?${params}`).then(setTasks).catch(() => setTasks([]));
  }, [projectId, subprojectId, refreshKey, showArchived]);

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
    setQ(""); setFProject(0); setFSub(0); setFAssignee(0); setFStatus(""); setFRecur(""); setFDeadline(""); setFPriority(0);
  }
  const activeFilters = [q, fProject, fSub, fAssignee, fStatus, fRecur, fDeadline, fPriority].filter(Boolean).length;

  if (!tasks) return <Spinner />;

  const filtered = tasks
    .filter((t) => {
      const info = subs.get(t.subproject);
      if (q && !t.title.toLowerCase().includes(q.toLowerCase())) return false;
      if (fProject && info?.projectId !== fProject) return false;
      if (fSub && t.subproject !== fSub) return false;
      if (fAssignee === -1 ? t.assignees.length !== 0 : fAssignee && !t.assignees.includes(fAssignee)) return false;
      if (fStatus && t.status !== fStatus) return false;
      if (fPriority && t.priority !== fPriority) return false;
      if (fRecur === "yes" && !t.recurrence) return false;
      if (fRecur === "no" && t.recurrence) return false;
      if (fDeadline) {
        const ds = deadlineState(t.deadline, isComplete(t.status));
        if (fDeadline === "overdue" && ds !== "overdue") return false;
        // 'pending' = an open task with a current/upcoming deadline (not overdue)
        if (fDeadline === "pending" && !(t.deadline && !isComplete(t.status) && ds !== "overdue")) return false;
      }
      return true;
    })
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
        <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={fProject} onChange={(e) => { setFProject(Number(e.target.value)); setFSub(0); }}>
          <option value={0}>All projects</option>
          {projectOpts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={fSub} onChange={(e) => setFSub(Number(e.target.value))}>
          <option value={0}>All sub-projects</option>
          {subOpts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select data-testid="filter-assignee" value={fAssignee} onChange={(e) => setFAssignee(Number(e.target.value))}>
          <option value={0}>Any assignee</option>
          <option value={-1}>Unassigned</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
        </select>
        <select data-testid="filter-priority" value={fPriority} onChange={(e) => setFPriority(Number(e.target.value))}>
          <option value={0}>Any priority</option>
          {[5, 4, 3, 2, 1].map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">Any status</option>
          {statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select value={fDeadline} onChange={(e) => setFDeadline(e.target.value as "" | "pending" | "overdue")}>
          <option value="">Deadline: any</option>
          <option value="pending">Pending (upcoming)</option>
          <option value="overdue">Overdue</option>
        </select>
        <select value={fRecur} onChange={(e) => setFRecur(e.target.value as "" | "yes" | "no")}>
          <option value="">Recurring? any</option>
          <option value="yes">Recurring only</option>
          <option value="no">One-off only</option>
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
              <Th k="priority">Priority</Th>
              <Th k="title">Task</Th>
              <Th k="project">Project</Th>
              <Th k="subproject">Sub-project</Th>
              <Th k="assignee">Assignees</Th>
              <Th k="status">Status</Th>
              <Th k="deadline">Deadline</Th>
              <Th k="time">Time</Th>
              <th>Recurs</th>
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
                    {ds === "overdue" && <span className="od" title="Missed Deadline"> ❗</span>}
                    {ds === "soon" && <span className="od-soon" title="Due today or tomorrow"> ❗</span>}
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
