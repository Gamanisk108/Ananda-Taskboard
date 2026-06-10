import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { api } from "../api/client";
import { Modal, Spinner, ProjPill } from "./common";
import { useConfirm } from "./confirm";

interface PillInfo { name: string; color: string; }
interface Row { id: number; label: string; days_left: number; project?: PillInfo; subproject?: PillInfo; }
interface TrashData { projects: Row[]; subprojects: Row[]; tasks: Row[]; }

export function Trash({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [data, setData] = useState<TrashData | null>(null);

  function load() { api.get("/api/trash").then(setData).catch(() => setData(null)); }
  useEffect(load, []);

  async function restore(type: string, id: number) {
    await api.post("/api/trash/action", { type, id });
    onChanged(); load();
  }
  async function purge(type: string, id: number) {
    if (!(await confirm({ body: t("trash.confirmPurge"), danger: true, confirmLabel: t("trash.deleteForever", "Delete forever") }))) return;
    await api.del("/api/trash/action", { type, id });
    load();
  }

  function section(title: string, type: string, rows: Row[]) {
    if (rows.length === 0) return null;
    return (
      <div style={{ marginBottom: 14 }}>
        <h3 className="section-title">{title}</h3>
        {rows.map((r) => (
          <div key={`${type}-${r.id}`} className="assignee-row" style={{ justifyContent: "space-between", gap: 8 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, flexWrap: "wrap" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
              {r.project && <ProjPill name={r.project.name} color={r.project.color} />}
              {r.subproject && <ProjPill name={r.subproject.name} color={r.subproject.color} />}
              <span className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>· {t("trash.daysLeft", { n: r.days_left })}</span>
            </span>
            <span style={{ display: "flex", gap: 6, flex: "none" }}>
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
    <Modal fullScreenOnNarrow icon={<Trash2 />} title={t("modals.trash")} onClose={onClose} wide>
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
