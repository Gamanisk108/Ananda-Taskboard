import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { api } from "../api/client";
import { useStatuses } from "../statuses";
import { avatarColor, userInitials, useUsers } from "../users";
import type { Subtask } from "../types";

/** Compact list of a task's subtasks. Each row shows title · quick status · who's
 *  assigned, and opens the full subtask editor (SubtaskDetail) on click. Quick-add
 *  by title stays inline for fast capture. Calls onChanged so the parent's status
 *  dots refresh. */
export function SubtaskEditor({
  taskId, onOpen, onChanged,
}: { taskId: number; onOpen: (s: Subtask) => void; onChanged?: () => void }) {
  const { t } = useTranslation();
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

  async function remove(id: number) {
    await api.del(`/api/subtasks/${id}`);
    load();
    onChanged?.();
  }

  return (
    <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 14 }}>
      <h3 className="section-title">{t("task.subtasks")} ({subs.length})</h3>
      {subs.map((s) => (
        <div key={s.id} data-testid="subtask-row" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
          <button type="button" data-testid="subtask-open" className="btn-ghost subtask-open"
            onClick={() => onOpen(s)} title={t("subtask.editDetails")}
            style={{ flex: 1, textAlign: "left", padding: "4px 6px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ flex: 1 }}>{s.title}</span>
            <span style={{ display: "flex", gap: 2 }}>
              {(s.assignees ?? []).slice(0, 3).map((id) => (
                <span key={id} className="av" style={{ background: avatarColor(id) }} title={userInitials(users, id)}>
                  {userInitials(users, id)}
                </span>
              ))}
              {(s.assignee_groups ?? []).length > 0 && (
                <span className="av" style={{ background: "var(--primary-weak)", color: "var(--dome)" }} title={t("ap.assignGroup")}>◇</span>
              )}
            </span>
          </button>
          <select data-testid="subtask-status" value={s.status} onChange={(e) => setStatus(s.id, e.target.value)} style={{ width: "auto" }}>
            {statuses.map((st) => <option key={st.key} value={st.key}>{st.label}</option>)}
          </select>
          <button type="button" className="btn-ghost icon-only" style={{ color: "var(--danger)" }} title={t("common.delete", "Delete")} onClick={() => remove(s.id)}><X size={16} /></button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input data-testid="subtask-add-input" placeholder={t("task.addSubtask")} value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" className="btn-secondary" data-testid="subtask-add-button" disabled={busy} onClick={add}>{t("common.add")}</button>
      </div>
    </div>
  );
}
