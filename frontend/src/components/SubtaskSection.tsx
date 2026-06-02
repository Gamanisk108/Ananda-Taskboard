import { useEffect, useState } from "react";
import { api } from "../api/client";

interface Subtask { id: number; title: string; is_done: boolean; position: number; }

export function SubtaskSection({ taskId }: { taskId: number }) {
  const [items, setItems] = useState<Subtask[]>([]);
  const [title, setTitle] = useState("");

  function load() {
    api.get(`/api/tasks/${taskId}/subtasks`).then(setItems).catch(() => setItems([]));
  }
  useEffect(load, [taskId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await api.post(`/api/tasks/${taskId}/subtasks`, { title });
    setTitle("");
    load();
  }
  async function toggle(s: Subtask) {
    await api.patch(`/api/subtasks/${s.id}`, { is_done: !s.is_done });
    load();
  }
  async function remove(s: Subtask) {
    await api.del(`/api/subtasks/${s.id}`);
    load();
  }

  const done = items.filter((i) => i.is_done).length;

  return (
    <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 14 }}>
      <h3 className="section-title">
        Checklist {items.length > 0 && <span className="mono">({done}/{items.length})</span>}
      </h3>
      {items.map((s) => (
        <div key={s.id} className="assignee-row" style={{ justifyContent: "space-between" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", margin: 0, flex: 1, cursor: "pointer" }}>
            <input type="checkbox" style={{ width: "auto" }} checked={s.is_done} onChange={() => toggle(s)} />
            <span style={{ textDecoration: s.is_done ? "line-through" : "none", color: s.is_done ? "var(--text-muted)" : "var(--text)" }}>
              {s.title}
            </span>
          </label>
          <button type="button" className="btn-ghost" style={{ color: "var(--danger)" }} onClick={() => remove(s)}>✕</button>
        </div>
      ))}
      <form onSubmit={add} style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input placeholder="Add a checklist item…" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="btn-secondary" type="submit">Add</button>
      </form>
    </div>
  );
}
