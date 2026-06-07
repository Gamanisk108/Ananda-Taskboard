import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Clock } from "lucide-react";
import { api } from "../api/client";
import { todayISO } from "../lookup";
import { ColorDot, StatusPill, Spinner } from "./common";
import { Modal } from "./common";

interface Inst {
  title: string;
  status: string;
  project_name: string;
  project_color: string;
  subproject_name: string;
  subproject_color: string;
  assignees: string[];
  groups: string[];
  deadline: string | null;
  is_recurring: boolean;
  date: string;
}

function shiftDay(iso: string, delta: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function History({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [day, setDay] = useState(todayISO());
  const [rows, setRows] = useState<Inst[] | null>(null);

  useEffect(() => {
    setRows(null);
    api.get(`/api/history?from=${day}&to=${day}`).then(setRows).catch(() => setRows([]));
  }, [day]);

  // group by project → subproject
  const grouped = useMemo(() => {
    const m = new Map<string, { color: string; subs: Map<string, { color: string; items: Inst[] }> }>();
    for (const r of rows ?? []) {
      const p = m.get(r.project_name) ?? { color: r.project_color, subs: new Map() };
      const s = p.subs.get(r.subproject_name) ?? { color: r.subproject_color, items: [] };
      s.items.push(r);
      p.subs.set(r.subproject_name, s);
      m.set(r.project_name, p);
    }
    return m;
  }, [rows]);

  return (
    <Modal icon={<Clock />} title={t("modals.history")} onClose={onClose} wide>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>{t("history.intro")}</p>
      <div className="bulkbar">
        <button className="btn-secondary" onClick={() => setDay((d) => shiftDay(d, -1))}>{t("history.prevDay")}</button>
        <input type="date" value={day} max={todayISO()} onChange={(e) => setDay(e.target.value)} style={{ width: "auto" }} />
        <button className="btn-secondary" onClick={() => setDay((d) => shiftDay(d, 1))} disabled={day >= todayISO()}>{t("history.nextDay")}</button>
        <button className="btn-ghost" onClick={() => setDay(todayISO())}>{t("history.today")}</button>
      </div>

      {!rows ? <Spinner /> : rows.length === 0 ? (
        <div className="empty">{t("history.none", { day })}</div>
      ) : (
        [...grouped.entries()].sort().map(([proj, p]) => (
          <div key={proj} style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 15, display: "flex", gap: 7, alignItems: "center" }}><ColorDot color={p.color} /> {proj}</h3>
            {[...p.subs.entries()].sort().map(([sub, s]) => (
              <div key={sub} style={{ margin: "6px 0 0 6px" }}>
                <div className="muted" style={{ fontSize: 12, margin: "4px 0" }}><ColorDot color={s.color} /> {sub}</div>
                {s.items.map((i, k) => (
                  <div key={k} className="card" style={{ padding: "7px 10px", marginBottom: 6, display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span>
                      {i.title}
                      {(i.assignees.length > 0 || i.groups.length > 0) && (
                        <span className="muted" style={{ fontSize: 12 }}> · {[...i.assignees, ...i.groups.map((g) => `👥 ${g}`)].join(", ") || t("history.unassigned")}</span>
                      )}
                      {i.assignees.length === 0 && i.groups.length === 0 && <span className="muted" style={{ fontSize: 12 }}> · {t("history.unassigned")}</span>}
                    </span>
                    <StatusPill status={i.status} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))
      )}
    </Modal>
  );
}
