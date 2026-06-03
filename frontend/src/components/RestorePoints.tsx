import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Modal, Spinner } from "./common";

interface Stats { projects?: number; subprojects?: number; tasks?: number; events?: number; groups?: number; grants?: number; }
interface Point { id: number; label: string; auto: boolean; stats: Stats; created_at: string; }

export function RestorePoints({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [points, setPoints] = useState<Point[] | null>(null);
  const [busy, setBusy] = useState(false);

  function load() { api.get("/api/restore-points").then(setPoints).catch(() => setPoints([])); }
  useEffect(load, []);

  async function save() {
    const label = prompt("Name this restore point:", `Manual save — ${new Date().toLocaleString()}`);
    if (label === null) return;
    setBusy(true);
    try { await api.post("/api/restore-points", { label: label || "Manual save" }); load(); }
    finally { setBusy(false); }
  }
  async function restore(p: Point) {
    if (!confirm(`Restore to "${p.label}"?\n\nThis first auto-saves the current board, then replaces ALL data with this snapshot.`)) return;
    setBusy(true);
    try { await api.post(`/api/restore-points/${p.id}/restore`, {}); onChanged(); load(); alert("Restored."); }
    finally { setBusy(false); }
  }
  async function remove(p: Point) {
    if (!confirm(`Delete restore point "${p.label}"? (The board itself is unaffected.)`)) return;
    await api.del(`/api/restore-points/${p.id}`); load();
  }

  function summary(s: Stats) {
    return `${s.projects ?? 0} projects · ${s.subprojects ?? 0} sub-projects · ${s.tasks ?? 0} tasks · ${s.events ?? 0} events · ${s.groups ?? 0} groups`;
  }

  return (
    <Modal title="Restore points" onClose={onClose} wide>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        Full snapshots of the whole board. Restoring auto-saves the current state first (so it's
        undoable). Auto-saves happen daily (last 10 kept); manual saves stay forever.
      </p>
      <div className="bulkbar">
        <button className="btn-primary" onClick={save} disabled={busy}>＋ Save restore point now</button>
      </div>
      {!points ? <Spinner /> : points.length === 0 ? (
        <div className="empty">No restore points yet.</div>
      ) : (
        <table className="tbl">
          <thead><tr><th>When</th><th>Name</th><th>Contents</th><th></th></tr></thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.id}>
                <td className="mono" style={{ fontSize: 12 }}>{p.created_at.slice(0, 16).replace("T", " ")}</td>
                <td>
                  <strong>{p.label}</strong>
                  {" "}<span className="pill" style={{ background: p.auto ? "var(--surface-sunk)" : "var(--primary-weak)", fontSize: 11 }}>{p.auto ? "auto" : "manual"}</span>
                </td>
                <td className="muted" style={{ fontSize: 12 }}>{summary(p.stats)}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn-secondary" onClick={() => restore(p)} disabled={busy}>Restore</button>
                  <button className="btn-ghost" style={{ color: "var(--danger)" }} onClick={() => remove(p)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
