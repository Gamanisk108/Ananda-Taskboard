import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { buildSubLookup, todayISO } from "../lookup";
import { useUsers, userName } from "../users";
import { ColorDot, StatusPill, Spinner } from "./common";
import { STATUS_LABEL, type Me, type Status, type Task } from "../types";

interface Props {
  projectId?: number;
  subprojectId?: number;
  refreshKey: number;
  onEdit: (t: Task) => void;
  me: Me;
}

type SortKey = "title" | "project" | "subproject" | "status" | "deadline" | "assignee" | "created";
const STATUS_ORDER: Record<Status, number> = { todo: 0, in_progress: 1, delayed: 2, done: 3 };

export function ListView({ projectId, subprojectId, refreshKey, onEdit, me }: Props) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [q, setQ] = useState("");
  // combinable filters
  const [fProject, setFProject] = useState(0);
  const [fSub, setFSub] = useState(0);
  const [fAssignee, setFAssignee] = useState(0);
  const [fStatus, setFStatus] = useState<"" | Status>("");
  const [fRecur, setFRecur] = useState<"" | "yes" | "no">("");
  const [showArchived, setShowArchived] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const subs = useMemo(() => buildSubLookup(me.tree), [me.tree]);
  const users = useUsers();
  const today = todayISO();

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
      case "status": return STATUS_ORDER[t.status];
      case "deadline": return t.deadline ?? "9999-99-99";
      case "assignee": return (assigneeNames(t)[0] ?? "~").toLowerCase();
      case "created": return t.created_at;
    }
  }
  function clickSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(key); setSortDir(1); }
  }
  function clearFilters() {
    setQ(""); setFProject(0); setFSub(0); setFAssignee(0); setFStatus(""); setFRecur("");
  }
  const activeFilters = [q, fProject, fSub, fAssignee, fStatus, fRecur].filter(Boolean).length;

  if (!tasks) return <Spinner />;

  const filtered = tasks
    .filter((t) => {
      const info = subs.get(t.subproject);
      if (q && !t.title.toLowerCase().includes(q.toLowerCase())) return false;
      if (fProject && info?.projectId !== fProject) return false;
      if (fSub && t.subproject !== fSub) return false;
      if (fAssignee && !t.assignees.includes(fAssignee)) return false;
      if (fStatus && t.status !== fStatus) return false;
      if (fRecur === "yes" && !t.recurrence) return false;
      if (fRecur === "no" && t.recurrence) return false;
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
        <select value={fAssignee} onChange={(e) => setFAssignee(Number(e.target.value))}>
          <option value={0}>Any assignee</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value as "" | Status)}>
          <option value="">Any status</option>
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select value={fRecur} onChange={(e) => setFRecur(e.target.value as "" | "yes" | "no")}>
          <option value="">Recurring? any</option>
          <option value="yes">Recurring only</option>
          <option value="no">One-off only</option>
        </select>
        {activeFilters > 0 && <button className="btn-ghost" onClick={clearFilters}>Clear ({activeFilters})</button>}
        <button className={showArchived ? "btn-primary" : "btn-ghost"} onClick={() => setShowArchived((a) => !a)}
          title="Completed tasks auto-archive after 7 days">
          {showArchived ? "← Back to board" : "🗄 Archive"}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">{activeFilters ? "No tasks match these filters." : "No tasks here yet."}</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <Th k="title">Task</Th>
              <Th k="project">Project</Th>
              <Th k="subproject">Sub-project</Th>
              <Th k="assignee">Assignees</Th>
              <Th k="status">Status</Th>
              <Th k="deadline">Deadline</Th>
              <th>Recurs</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const info = subs.get(t.subproject);
              const overdue = !!t.deadline && t.deadline < today && t.status !== "done";
              const names = assigneeNames(t);
              return (
                <tr key={t.id} className={overdue ? "overdue" : ""} onClick={() => onEdit(t)}>
                  <td><strong>{overdue && <span className="od" title="Overdue">❗</span>}{t.title}</strong></td>
                  <td>{info && <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><ColorDot color={info.projectColor} /> {info.projectName}</span>}</td>
                  <td>{info && <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><ColorDot color={info.color} /> {info.name}</span>}</td>
                  <td>
                    {names.length === 0 ? <span className="muted">—</span> : (
                      <span className="who">{names.map((n, i) => <span key={i} className="pill">{n}</span>)}</span>
                    )}
                  </td>
                  <td><StatusPill status={t.status} /></td>
                  <td className="deadline mono">{t.deadline ?? "—"}</td>
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
