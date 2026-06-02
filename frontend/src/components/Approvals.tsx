import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Modal, Spinner } from "./common";
import type { Task } from "../types";

export function Approvals({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [pending, setPending] = useState<Task[] | null>(null);
  const [sel, setSel] = useState<Set<number>>(new Set());

  function load() {
    setPending(null);
    api.get("/api/approvals").then(setPending).catch(() => setPending([]));
  }
  useEffect(load, []);

  function toggle(id: number) {
    const n = new Set(sel);
    n.has(id) ? n.delete(id) : n.add(id);
    setSel(n);
  }

  async function bulk(action: "approve" | "reject") {
    const ids = sel.size ? [...sel] : (pending ?? []).map((t) => t.id);
    if (!ids.length) return;
    await api.post("/api/approvals", { ids, action });
    setSel(new Set());
    onChanged();
    load();
  }

  return (
    <Modal title="Approvals" onClose={onClose} wide>
      {!pending ? (
        <Spinner />
      ) : pending.length === 0 ? (
        <div className="empty">Nothing waiting for approval. 🎉</div>
      ) : (
        <>
          <div className="bulkbar">
            <button className="btn-primary" onClick={() => bulk("approve")}>
              {sel.size ? `Approve ${sel.size}` : "Approve all"}
            </button>
            <button className="btn-danger" onClick={() => bulk("reject")}>
              {sel.size ? `Reject ${sel.size}` : "Reject all"}
            </button>
            <span className="muted">{pending.length} pending</span>
          </div>
          <table className="tbl">
            <thead>
              <tr><th></th><th>Task</th><th>Details</th></tr>
            </thead>
            <tbody>
              {pending.map((t) => (
                <tr key={t.id} onClick={() => toggle(t.id)}>
                  <td><input type="checkbox" style={{ width: "auto" }} checked={sel.has(t.id)} readOnly /></td>
                  <td><strong>{t.title}</strong></td>
                  <td className="muted">{t.details?.slice(0, 80) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Modal>
  );
}
