import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { buildSubLookup, todayISO } from "../lookup";
import { ColorDot, StatusPill, Spinner } from "./common";
import { STATUS_LABEL, type Me, type Status, type Task } from "../types";

interface Props {
  projectId?: number;
  subprojectId?: number;
  refreshKey: number;
  onEdit: (t: Task) => void;
  me: Me;
}

export function ListView({ projectId, subprojectId, refreshKey, onEdit, me }: Props) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [q, setQ] = useState("");
  const subs = useMemo(() => buildSubLookup(me.tree), [me.tree]);
  const today = todayISO();

  useEffect(() => {
    const params = new URLSearchParams();
    if (subprojectId) params.set("subproject", String(subprojectId));
    else if (projectId) params.set("project", String(projectId));
    if (statusFilter) params.set("status", statusFilter);
    setTasks(null);
    api.get(`/api/tasks?${params}`).then(setTasks).catch(() => setTasks([]));
  }, [projectId, subprojectId, statusFilter, refreshKey]);

  if (!tasks) return <Spinner />;
  const filtered = tasks.filter((t) => t.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="rise">
      <div className="filters">
        <input placeholder="Search title…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">No tasks here yet.</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>Task</th><th>Project / Sub-project</th><th>Status</th>
              <th>Deadline</th><th>Recurs</th><th>Comments</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const info = subs.get(t.subproject);
              const overdue = !!t.deadline && t.deadline < today && t.status !== "done";
              return (
                <tr key={t.id} className={overdue ? "overdue" : ""} onClick={() => onEdit(t)}>
                  <td><strong>{t.title}</strong></td>
                  <td>
                    {info && (
                      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                        <ColorDot color={info.projectColor} /> {info.projectName}
                        <span className="muted">/</span>
                        <ColorDot color={info.color} /> {info.name}
                      </span>
                    )}
                  </td>
                  <td><StatusPill status={t.status} /></td>
                  <td className="deadline mono">{t.deadline ?? "—"}</td>
                  <td className="muted">{t.recurrence ? t.recurrence.freq : "—"}</td>
                  <td className="mono muted">{t.comment_count || 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
