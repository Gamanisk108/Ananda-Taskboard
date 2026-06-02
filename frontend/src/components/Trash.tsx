import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Modal, Spinner } from "./common";

interface Row { id: number; label: string; days_left: number; }
interface TrashData { projects: Row[]; subprojects: Row[]; tasks: Row[]; }

export function Trash({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<TrashData | null>(null);

  function load() { api.get("/api/trash").then(setData).catch(() => setData(null)); }
  useEffect(load, []);

  async function restore(type: string, id: number) {
    await api.post("/api/trash/action", { type, id });
    onChanged(); load();
  }
  async function purge(type: string, id: number) {
    if (!confirm("Delete forever? This cannot be undone.")) return;
    await api.del("/api/trash/action", { type, id });
    load();
  }

  function section(title: string, type: string, rows: Row[]) {
    if (rows.length === 0) return null;
    return (
      <div style={{ marginBottom: 14 }}>
        <h3 className="section-title">{title}</h3>
        {rows.map((r) => (
          <div key={`${type}-${r.id}`} className="assignee-row" style={{ justifyContent: "space-between" }}>
            <span>{r.label} <span className="muted" style={{ fontSize: 12 }}>· {r.days_left}d left</span></span>
            <span style={{ display: "flex", gap: 6 }}>
              <button type="button" className="btn-secondary" onClick={() => restore(type, r.id)}>Restore</button>
              <button type="button" className="btn-ghost" style={{ color: "var(--danger)" }} onClick={() => purge(type, r.id)}>Delete forever</button>
            </span>
          </div>
        ))}
      </div>
    );
  }

  const empty = data && !data.projects.length && !data.subprojects.length && !data.tasks.length;

  return (
    <Modal title="Trash" onClose={onClose} wide>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        Deleted items are kept for 7 days, then removed automatically. Restore brings an item
        (and anything deleted with it) back.
      </p>
      {!data ? <Spinner /> : empty ? (
        <div className="empty">Trash is empty. 🧹</div>
      ) : (
        <>
          {section("Projects", "project", data.projects)}
          {section("Sub-projects", "subproject", data.subprojects)}
          {section("Tasks", "task", data.tasks)}
        </>
      )}
    </Modal>
  );
}
