import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  addDays, addMonths, format, isSameMonth, startOfMonth, startOfWeek,
} from "date-fns";
import { api } from "../api/client";
import { Modal, Spinner } from "./common";
import { DayTaskList } from "./DayTaskList";
import { EVENT_ICON, type CalendarInstance, type EventSpan, type Me, type Task } from "../types";

interface Props {
  projectId?: number;
  subprojectId?: number;
  refreshKey: number;
  onEdit: (t: Task) => void;
  me: Me;
}

export function MonthlyView({ projectId, subprojectId, refreshKey, onEdit }: Props) {
  const { t } = useTranslation();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [items, setItems] = useState<CalendarInstance[] | null>(null);
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const [events, setEvents] = useState<EventSpan[]>([]);
  const today = format(new Date(), "yyyy-MM-dd");
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const colorByProject = !projectId;

  useEffect(() => {
    const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const from = format(gridStart, "yyyy-MM-dd");
    const to = format(addDays(gridStart, 41), "yyyy-MM-dd");
    const p = new URLSearchParams({ from, to });
    if (subprojectId) p.set("subproject", String(subprojectId));
    else if (projectId) p.set("project", String(projectId));
    setItems(null);
    api.get(`/api/calendar?${p}`).then(setItems).catch(() => setItems([]));
    api.get(`/api/events/range?from=${from}&to=${to}`).then(setEvents).catch(() => setEvents([]));
  }, [month, projectId, subprojectId, refreshKey]);

  // Expand each span into the days it covers within the visible grid, so a
  // multi-day range shows a bar on each of its days and a series on each date.
  const eventsByDate = useMemo(() => {
    const grid0 = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const lo = format(grid0, "yyyy-MM-dd");
    const hi = format(addDays(grid0, 41), "yyyy-MM-dd");
    const m = new Map<string, EventSpan[]>();
    for (const e of events) {
      let cur = e.start < lo ? lo : e.start;
      const last = e.end > hi ? hi : e.end;
      while (cur <= last) {
        if (!m.has(cur)) m.set(cur, []);
        m.get(cur)!.push(e);
        cur = format(addDays(new Date(`${cur}T00:00:00`), 1), "yyyy-MM-dd");
      }
    }
    return m;
  }, [events, month]);

  const byDate = useMemo(() => {
    const m = new Map<string, CalendarInstance[]>();
    for (const i of items ?? []) {
      if (!m.has(i.date)) m.set(i.date, []);
      m.get(i.date)!.push(i);
    }
    return m;
  }, [items]);

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  // 6 weeks max, but drop any whole week with no day in the current month
  const allCells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const cells = Array.from({ length: 6 }, (_, w) => allCells.slice(w * 7, w * 7 + 7))
    .filter((week) => week.some((d) => isSameMonth(d, month)))
    .flat();

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
        <button className="btn-secondary" onClick={() => setMonth(addMonths(month, -1))}>{t("cal.prev")}</button>
        <button className="btn-secondary" onClick={() => setMonth(startOfMonth(new Date()))}>{t("cal.thisMonth")}</button>
        <button className="btn-secondary" onClick={() => setMonth(addMonths(month, 1))}>{t("cal.next")}</button>
        <span className="muted mono">{format(month, "MMMM yyyy")}</span>
      </div>
      {!items ? (
        <Spinner />
      ) : (
        <>
          <div className="month">
            {(["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const).map((d) => (
              <div className="dow" key={d}>{t(`cal.dow.${d}`)}</div>
            ))}
            {cells.map((d) => {
              const iso = format(d, "yyyy-MM-dd");
              const dayItems = byDate.get(iso) ?? [];
              const dayEvents = eventsByDate.get(iso) ?? [];
              const inMonth = isSameMonth(d, month);
              const hasOverdue = dayItems.some((i) => i.overdue);
              const hasSoon = !hasOverdue && dayItems.some((i) => i.is_deadline && (i.date === today || i.date === tomorrow) && !i.overdue);
              return (
                <button
                  key={iso}
                  className={`mcell ${inMonth ? "" : "dim"} ${hasOverdue ? "has-overdue" : hasSoon ? "has-soon" : ""}`}
                  onClick={() => (dayItems.length || dayEvents.length) && setDayOpen(iso)}
                >
                  <span className="day-num">{format(d, "MMM d")}
                    {hasOverdue && <span className="od" title={t("list.missedDeadline")}> ❗</span>}
                    {hasSoon && <span className="od-soon" title={t("list.dueSoon")}> ❗</span>}
                  </span>
                  {dayEvents.map((e, k) => (
                    <div key={`ev-${k}`} className="ev-bar" title={e.title}>{EVENT_ICON[e.kind]} {e.title}</div>
                  ))}
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
              {(eventsByDate.get(dayOpen) ?? []).map((e, k) => (
                <div key={`ev-${k}`} className="cal-event" style={{ margin: "0 0 8px" }}>{EVENT_ICON[e.kind]} {e.title}</div>
              ))}
              <DayTaskList items={byDate.get(dayOpen) ?? []} colorByProject={colorByProject} onOpen={open} />
            </Modal>
          )}
        </>
      )}
    </div>
  );
}
