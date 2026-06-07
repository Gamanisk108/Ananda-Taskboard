import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { api } from "../api/client";
import { Modal, Spinner } from "./common";

interface Row { id: number; label: string; days_left: number; }
interface TrashData { projects: Row[]; subprojects: Row[]; tasks: Row[]; }

export function Trash({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation();
  const [data, setData] = useState<TrashData | null>(null);

  function load() { api.get("/api/trash").then(setData).catch(() => setData(null)); }
  useEffect(load, []);

  async function restore(type: string, id: number) {
    await api.post("/api/trash/action", { type, id });
    onChanged(); load();
  }
  async function purge(type: string, id: number) {
    if (!confirm(t("trash.confirmPurge"))) return;
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
            <span>{r.label} <span className="muted" style={{ fontSize: 12 }}>· {t("trash.daysLeft", { n: r.days_left })}</span></span>
            <span style={{ display: "flex", gap: 6 }}>
              <button type="button" className="btn-secondary" onClick={() => restore(type, r.id)}>{t("trash.restore")}</button>
              <button type="button" className="btn-ghost" style={{ color: "var(--danger)" }} onClick={() => purge(type, r.id)}>{t("trash.deleteForever")}</button>
            </span>
          </div>
        ))}
      </div>
    );
  }

  const empty = data && !data.projects.length && !data.subprojects.length && !data.tasks.length;

  return (
    <Modal icon={<Trash2 />} title={t("modals.trash")} onClose={onClose} wide>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>{t("trash.intro")}</p>
      {!data ? <Spinner /> : empty ? (
        <div className="empty"><Trash2 size={16} aria-hidden style={{ verticalAlign: "-3px", marginRight: 6, opacity: 0.6 }} />{t("empty.trash")}</div>
      ) : (
        <>
          {section(t("trash.projects"), "project", data.projects)}
          {section(t("trash.subprojects"), "subproject", data.subprojects)}
          {section(t("trash.tasks"), "task", data.tasks)}
        </>
      )}
    </Modal>
  );
}
