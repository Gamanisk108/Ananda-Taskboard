import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../state/auth";
import { buildSubLookup } from "../lookup";
import { useUsers, userName } from "../users";
import { Modal, Spinner, ColorDot } from "./common";
import type { Task } from "../types";

export function Approvals({
  onClose, onChanged, onOpen,
}: {
  onClose: () => void;
  onChanged: () => void;
  onOpen: (t: Task) => void;
}) {
  const { me } = useAuth();
  const [pending, setPending] = useState<Task[] | null>(null);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const subs = useMemo(() => (me ? buildSubLookup(me.tree) : new Map()), [me]);
  const users = useUsers();

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

  async function act(id: number, action: "approve" | "reject") {
    await api.post(`/api/tasks/${id}/${action}`, {});
    onChanged();
    load();
  }

  return (
    <Modal title="Approvals" onClose={onClose} wide>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        Tasks members created that need your OK before they appear on the board. Tick rows to
        bulk-approve, click <strong>Open</strong> to see full details, or approve/reject each.
      </p>
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
              <tr><th></th><th>Task</th><th>Where</th><th>Created by</th><th>Deadline</th><th></th></tr>
            </thead>
            <tbody>
              {pending.map((t) => {
                const info = subs.get(t.subproject);
                return (
                  <tr key={t.id}>
                    <td onClick={() => toggle(t.id)}>
                      <input type="checkbox" style={{ width: "auto" }} checked={sel.has(t.id)} readOnly />
                    </td>
                    <td>
                      <strong>{t.title}</strong>
                      {t.details && <div className="muted" style={{ fontSize: 12 }}>{t.details.slice(0, 90)}</div>}
                    </td>
                    <td>
                      {info && <span style={{ display: "inline-flex", gap: 5, alignItems: "center", fontSize: 12 }}>
                        <ColorDot color={info.color} /> {info.projectName} / {info.name}
                      </span>}
                    </td>
                    <td className="muted" style={{ fontSize: 12 }}>{t.created_by ? userName(users, t.created_by) : "—"}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{t.deadline ?? "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="btn-ghost" onClick={() => onOpen(t)}>Open</button>
                      <button className="btn-ghost" style={{ color: "var(--success)" }} onClick={() => act(t.id, "approve")}>✓</button>
                      <button className="btn-ghost" style={{ color: "var(--danger)" }} onClick={() => act(t.id, "reject")}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </Modal>
  );
}
