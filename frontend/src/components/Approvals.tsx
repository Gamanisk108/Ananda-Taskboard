import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, X, CircleCheck } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../state/auth";
import { buildSubLookup } from "../lookup";
import { useUsers, userName } from "../users";
import { Modal, Spinner, ProjPill } from "./common";
import { useConfirm } from "./confirm";
import type { Task } from "../types";

export function Approvals({
  onClose, onChanged, onOpen,
}: {
  onClose: () => void;
  onChanged: () => void;
  onOpen: (t: Task) => void;
}) {
  const { t: tr } = useTranslation();  // `t` is the task param in onOpen
  const { me } = useAuth();
  const confirm = useConfirm();
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
    // Rejecting discards a member's submission — destructive, so it confirms.
    if (action === "reject" && !(await confirm({ body: tr("approvals.confirmRejectN", "Reject {{n}} pending task(s)? The member's submission is discarded.", { n: ids.length }), danger: true, confirmLabel: tr("approvals.reject", "Reject") }))) return;
    await api.post("/api/approvals", { ids, action });
    setSel(new Set());
    onChanged();
    load();
  }

  async function act(id: number, action: "approve" | "reject") {
    if (action === "reject" && !(await confirm({ body: tr("approvals.confirmReject", "Reject this task? The member's submission is discarded."), danger: true, confirmLabel: tr("approvals.reject", "Reject") }))) return;
    await api.post(`/api/tasks/${id}/${action}`, {});
    onChanged();
    load();
  }

  return (
    <Modal icon={<CircleCheck />} title={tr("modals.approvals")} onClose={onClose} wide>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>{tr("approvals.intro")}</p>
      {!pending ? (
        <Spinner />
      ) : pending.length === 0 ? (
        <div className="empty"><CircleCheck size={16} aria-hidden style={{ verticalAlign: "-3px", marginRight: 6 }} />{tr("empty.approvals")}</div>
      ) : (
        <>
          <div className="bulkbar">
            <button className="btn-primary" onClick={() => bulk("approve")}>
              {sel.size ? tr("approvals.approveN", { n: sel.size }) : tr("approvals.approveAll")}
            </button>
            <button className="btn-danger" onClick={() => bulk("reject")}>
              {sel.size ? tr("approvals.rejectN", { n: sel.size }) : tr("approvals.rejectAll")}
            </button>
            <span className="muted">{tr("approvals.pending", { n: pending.length })}</span>
          </div>
          <table className="tbl">
            <thead>
              <tr><th></th><th>{tr("list.colTask")}</th><th>{tr("approvals.where")}</th><th>{tr("approvals.createdBy")}</th><th>{tr("list.colDeadline")}</th><th></th></tr>
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
                      {/* Proj-pill rule: projects/sub-projects render as pills, never dot+text. */}
                      {info && <span style={{ display: "inline-flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                        <ProjPill name={info.projectName} color={info.projectColor} />
                        <ProjPill name={info.name} color={info.color} />
                      </span>}
                    </td>
                    <td className="muted" style={{ fontSize: 12 }}>{t.created_by ? userName(users, t.created_by) : "—"}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{t.deadline ?? "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="btn-ghost" onClick={() => onOpen(t)}>{tr("approvals.open")}</button>
                      <button className="btn-ghost icon-only" style={{ color: "var(--success)" }} title={tr("approvals.approve", "Approve")} onClick={() => act(t.id, "approve")}><Check size={16} /></button>
                      <button className="btn-ghost icon-only" style={{ color: "var(--danger)" }} title={tr("approvals.reject", "Reject")} onClick={() => act(t.id, "reject")}><X size={16} /></button>
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
