import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useStatuses } from "../statuses";
import { buildSubLookup } from "../lookup";
import { useUsers, userInitials } from "../users";
import { ColorDot, PriorityIcon, Spinner } from "./common";
import type { Me, Task } from "../types";

interface Props {
  projectId?: number;
  subprojectId?: number;
  refreshKey: number;
  onEdit: (t: Task) => void;
  me: Me;
}

export function KanbanView({ projectId, subprojectId, refreshKey, onEdit, me }: Props) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const statuses = useStatuses();
  const subs = buildSubLookup(me.tree);
  const users = useUsers();

  function load() {
    const p = new URLSearchParams();
    if (subprojectId) p.set("subproject", String(subprojectId));
    else if (projectId) p.set("project", String(projectId));
    setTasks(null);
    api.get(`/api/tasks?${p}`).then(setTasks).catch(() => setTasks([]));
  }
  useEffect(load, [projectId, subprojectId, refreshKey]);

  async function move(taskId: number, statusKey: string) {
    const prev = tasks;
    setTasks((ts) => (ts ?? []).map((t) => (t.id === taskId ? { ...t, status: statusKey } : t)));
    try {
      await api.post(`/api/tasks/${taskId}/status`, { status: statusKey });
    } catch {
      setTasks(prev ?? []); // revert (e.g. not your task → 403)
      alert("You can only move tasks assigned to you (or be an admin).");
    }
  }

  if (!tasks) return <Spinner />;

  return (
    <div className="rise kanban">
      {statuses.map((st) => {
        const col = tasks.filter((t) => t.status === st.key);
        return (
          <div
            key={st.key}
            className="kan-col"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragId != null) move(dragId, st.key); setDragId(null); }}
          >
            <div className="kan-head" style={{ borderTopColor: st.color }}>
              <span><span className="dot" style={{ background: st.color }} /> {st.label}</span>
              <span className="mono muted">{col.length}</span>
            </div>
            <div className="kan-body">
              {col.map((t) => {
                const info = subs.get(t.subproject);
                return (
                  <div
                    key={t.id}
                    className="kan-card"
                    style={{ position: "relative" }}
                    draggable
                    onDragStart={() => setDragId(t.id)}
                    onClick={() => onEdit(t)}
                  >
                    <span style={{ position: "absolute", top: 8, right: 8 }}><PriorityIcon level={t.priority} /></span>
                    <div style={{ fontWeight: 600, marginBottom: 4, paddingRight: 18 }}>{t.title}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                      <span style={{ display: "inline-flex", gap: 5, alignItems: "center", fontSize: 11 }} className="muted">
                        {info && <><ColorDot color={info.color} /> {info.name}</>}
                      </span>
                      {t.assignees.length > 0 && (
                        <span className="chip-initials" style={{ background: "var(--surface-sunk)", color: "var(--text-muted)" }}
                          title={t.assignees.map((id) => users.find((u) => u.id === id)?.name).filter(Boolean).join(", ")}>
                          {t.assignees.map((id) => userInitials(users, id)).join(" ")}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {col.length === 0 && <div className="muted" style={{ fontSize: 12, padding: 8 }}>—</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
