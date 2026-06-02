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
  const [statusFilter, setStatusFilter] = useState("");
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<1 | -1>(-1); // most recent first by default
  const subs = useMemo(() => buildSubLookup(me.tree), [me.tree]);
  const users = useUsers();
  const today = todayISO();

  useEffect(() => {
    const params = new URLSearchParams();
    if (subprojectId) params.set("subproject", String(subprojectId));
    else if (projectId) params.set("project", String(projectId));
    if (statusFilter) params.set("status", statusFilter);
    setTasks(null);
    api.get(`/api/tasks?${params}`).then(setTasks).catch(() => setTasks([]));
  }, [projectId, subprojectId, statusFilter, refreshKey]);

  function assigneeNames(t: Task) {
    return t.assignees.map((id) => userName(users, id));
  }

  function sortVal(t: Task): string | number {
    const info = subs.get(t.subproject);
    switch (sortKey) {
      case "title": return t.title.toLowerCase();
      case "project": return (info?.projectName ?? "").toLowerCase();
      case "subproject": return (info?.name ?? "").toLowerCase();
      case "status": return STATUS_ORDER[t.status];
      case "deadline": return t.deadline ?? "9999-99-99"; // nulls last
      case "assignee": return (assigneeNames(t)[0] ?? "~").toLowerCase();
      case "created": return t.created_at;
    }
  }

  function clickSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(key); setSortDir(1); }
  }

  if (!tasks) return <Spinner />;

  const filtered = tasks
    .filter((t) => t.title.toLowerCase().includes(q.toLowerCase()))
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
        <input placeholder="Search title…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <button
          className={sortKey === "created" ? "btn-primary" : "btn-secondary"}
          onClick={() => clickSort("created")}
        >
          Most recent {sortKey === "created" ? (sortDir === -1 ? "▼" : "▲") : ""}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">No tasks here yet.</div>
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
                  <td><strong>{t.title}</strong></td>
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
