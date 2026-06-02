import { useEffect, useMemo, useState } from "react";
import {
  addDays, addMonths, format, isSameMonth, startOfMonth, startOfWeek,
} from "date-fns";
import { api } from "../api/client";
import { Modal, Spinner, StatusPill } from "./common";
import type { CalendarInstance, Me, Task } from "../types";

interface Props {
  projectId?: number;
  subprojectId?: number;
  refreshKey: number;
  onEdit: (t: Task) => void;
  me: Me;
}

export function MonthlyView({ projectId, subprojectId, refreshKey, onEdit }: Props) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [items, setItems] = useState<CalendarInstance[] | null>(null);
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const colorByProject = !projectId;

  useEffect(() => {
    const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const from = format(gridStart, "yyyy-MM-dd");
    const to = format(addDays(gridStart, 41), "yyyy-MM-dd");
    const p = new URLSearchParams({ from, to });
    if (subprojectId) p.set("subproject", String(subprojectId));
    else if (projectId) p.set("project", String(projectId));
    setItems(null);
    api.get(`/api/calendar?${p}`).then(setItems).catch(() => setItems([]));
  }, [month, projectId, subprojectId, refreshKey]);

  const byDate = useMemo(() => {
    const m = new Map<string, CalendarInstance[]>();
    for (const i of items ?? []) {
      if (!m.has(i.date)) m.set(i.date, []);
      m.get(i.date)!.push(i);
    }
    return m;
  }, [items]);

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  function countsByColor(dayItems: CalendarInstance[]) {
    const m = new Map<string, number>();
    for (const i of dayItems) {
      const c = colorByProject ? i.project_color : i.subproject_color;
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return [...m.entries()];
  }

  async function open(id: number) {
    const t = (await api.get(`/api/tasks/${id}`)) as Task;
    setDayOpen(null);
    onEdit(t);
  }

  return (
    <div className="rise">
      <div className="bulkbar">
        <button className="btn-secondary" onClick={() => setMonth(addMonths(month, -1))}>← Prev</button>
        <button className="btn-secondary" onClick={() => setMonth(startOfMonth(new Date()))}>This month</button>
        <button className="btn-secondary" onClick={() => setMonth(addMonths(month, 1))}>Next →</button>
        <span className="muted mono">{format(month, "MMMM yyyy")}</span>
      </div>
      {!items ? (
        <Spinner />
      ) : (
        <>
          <div className="month">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div className="dow" key={d}>{d}</div>
            ))}
            {cells.map((d) => {
              const iso = format(d, "yyyy-MM-dd");
              const dayItems = byDate.get(iso) ?? [];
              const inMonth = isSameMonth(d, month);
              return (
                <button
                  key={iso}
                  className={`mcell ${inMonth ? "" : "dim"}`}
                  onClick={() => dayItems.length && setDayOpen(iso)}
                >
                  <span className="day-num">{format(d, "d")}</span>
                  <div className="badges">
                    {countsByColor(dayItems).map(([c, n]) => (
                      <span key={c} className="badge" style={{ background: c }}>{n}</span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {dayOpen && (
            <Modal title={format(new Date(dayOpen), "EEEE, MMM d, yyyy")} onClose={() => setDayOpen(null)}>
              {(byDate.get(dayOpen) ?? []).map((i, idx) => (
                <div
                  key={`${i.task_id}-${idx}`}
                  className="card"
                  style={{ padding: 10, marginBottom: 8, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  onClick={() => open(i.task_id)}
                >
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className="dot" style={{ background: colorByProject ? i.project_color : i.subproject_color }} />
                    {i.title}
                    {i.overdue && <span className="pill" style={{ background: "#b4452f1a", color: "var(--danger)" }}>Overdue</span>}
                  </span>
                  <StatusPill status={i.status} />
                </div>
              ))}
            </Modal>
          )}
        </>
      )}
    </div>
  );
}
