import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useStatuses } from "../statuses";
import { useUsers } from "../users";
import type { Subtask } from "../types";

/** Subtasks of a task: a simple list, each with a changeable status dropdown,
 *  plus add / delete. Calls onChanged so the List card's status dots refresh. */
export function SubtaskEditor({ taskId, onChanged }: { taskId: number; onChanged?: () => void }) {
  const [subs, setSubs] = useState<Subtask[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const statuses = useStatuses();
  const users = useUsers();

  function load() {
    api.get(`/api/subtasks?task=${taskId}`).then(setSubs).catch(() => setSubs([]));
  }
  useEffect(load, [taskId]);

  async function add() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await api.post("/api/subtasks", { task: taskId, title: title.trim() });
      setTitle("");
      load();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: number, status: string) {
    setSubs((cur) => cur.map((s) => (s.id === id ? { ...s, status } : s)));
    await api.patch(`/api/subtasks/${id}`, { status });
    onChanged?.();
  }

  async function setAssignee(id: number, assignee: number | null) {
    setSubs((cur) => cur.map((s) => (s.id === id ? { ...s, assignee } : s)));
    await api.patch(`/api/subtasks/${id}`, { assignee });
  }

  async function remove(id: number) {
    await api.del(`/api/subtasks/${id}`);
    load();
    onChanged?.();
  }

  return (
    <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 14 }}>
      <h3 className="section-title">Subtasks ({subs.length})</h3>
      {subs.map((s) => (
        <div key={s.id} data-testid="subtask-row" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
          <span style={{ flex: 1 }}>{s.title}</span>
          <select data-testid="subtask-assignee" value={s.assignee ?? ""} onChange={(e) => setAssignee(s.id, e.target.value ? Number(e.target.value) : null)}
            style={{ width: "auto", maxWidth: 130 }} title="Assignee">
            <option value="">Unassigned</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
          </select>
          <select data-testid="subtask-status" value={s.status} onChange={(e) => setStatus(s.id, e.target.value)} style={{ width: "auto" }}>
            {statuses.map((st) => <option key={st.key} value={st.key}>{st.label}</option>)}
          </select>
          <button type="button" className="btn-ghost" style={{ color: "var(--danger)" }} onClick={() => remove(s.id)}>✕</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input data-testid="subtask-add-input" placeholder="Add a subtask…" value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" className="btn-secondary" data-testid="subtask-add-button" disabled={busy} onClick={add}>Add</button>
      </div>
    </div>
  );
}
