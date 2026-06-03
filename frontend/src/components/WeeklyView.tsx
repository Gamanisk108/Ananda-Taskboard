import { useEffect, useMemo, useState } from "react";
import { addDays, addWeeks, format, startOfWeek } from "date-fns";
import { api } from "../api/client";
import { useUsers, userInitials, userName } from "../users";
import { Spinner } from "./common";
import type { CalendarInstance, Me, Task } from "../types";

interface Props {
  projectId?: number;
  subprojectId?: number;
  refreshKey: number;
  onEdit: (t: Task) => void;
  me: Me;
}

interface Bar {
  task_id: number;
  title: string;
  color: string;
  startCol: number; // 1..7
  endCol: number;   // 1..7
  endsThisWeek: boolean; // deadline within the week → show ⏰
  overdue: boolean;
  assignee_ids: number[];
  lane: number;
}

export function WeeklyView({ projectId, subprojectId, refreshKey, onEdit }: Props) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [items, setItems] = useState<CalendarInstance[] | null>(null);
  const [events, setEvents] = useState<{ date: string; title: string; yearly: boolean }[]>([]);
  const users = useUsers();
  const colorByProject = !projectId;

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const dayIso = useMemo(() => days.map((d) => format(d, "yyyy-MM-dd")), [days]);

  useEffect(() => {
    const from = dayIso[0];
    const to = dayIso[6];
    const p = new URLSearchParams({ from, to });
    if (subprojectId) p.set("subproject", String(subprojectId));
    else if (projectId) p.set("project", String(projectId));
    setItems(null);
    api.get(`/api/calendar?${p}`).then(setItems).catch(() => setItems([]));
    api.get(`/api/events/range?from=${from}&to=${to}`).then(setEvents).catch(() => setEvents([]));
  }, [weekStart, projectId, subprojectId, refreshKey]);

  async function open(id: number) {
    const t = (await api.get(`/api/tasks/${id}`)) as Task;
    onEdit(t);
  }

  // Lane-packed spanning bars from per-day instances grouped by task.
  const { bars, laneCount } = useMemo(() => {
    const map = new Map<number, CalendarInstance[]>();
    for (const i of items ?? []) {
      if (!map.has(i.task_id)) map.set(i.task_id, []);
      map.get(i.task_id)!.push(i);
    }
    const raw: Omit<Bar, "lane">[] = [];
    for (const [task_id, insts] of map) {
      const cols = insts.map((i) => dayIso.indexOf(i.date) + 1).filter((c) => c >= 1);
      if (!cols.length) continue;
      const first = insts[0];
      raw.push({
        task_id,
        title: first.title,
        color: colorByProject ? first.project_color : first.subproject_color,
        startCol: Math.min(...cols),
        endCol: Math.max(...cols),
        endsThisWeek: insts.some((i) => i.is_deadline),
        overdue: insts.some((i) => i.overdue),
        assignee_ids: first.assignee_ids,
      });
    }
    raw.sort((a, b) => a.startCol - b.startCol || a.endCol - b.endCol);
    const laneEnds: number[] = [];
    const packed: Bar[] = raw.map((b) => {
      let lane = laneEnds.findIndex((end) => end < b.startCol);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(b.endCol); }
      else laneEnds[lane] = b.endCol;
      return { ...b, lane };
    });
    return { bars: packed, laneCount: Math.max(1, laneEnds.length) };
  }, [items, dayIso, colorByProject]);

  return (
    <div className="rise">
      <div className="bulkbar">
        <button className="btn-secondary" onClick={() => setWeekStart(addWeeks(weekStart, -1))}>← Prev</button>
        <button className="btn-secondary" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>This week</button>
        <button className="btn-secondary" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>Next →</button>
        <span className="muted mono">{format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}</span>
      </div>
      {!items ? (
        <Spinner />
      ) : (
        <div className="wk">
          <div className="wk-head">
            {days.map((d, idx) => (
              <div className="wk-hcell" key={idx}>
                <div>{format(d, "EEE")} <span className="day-num">{format(d, "MMM d")}</span></div>
                {events.filter((e) => e.date === dayIso[idx]).map((e, k) => (
                  <div key={k} className="cal-event" title={e.title}>{e.yearly ? "🎂" : "📌"} {e.title}</div>
                ))}
              </div>
            ))}
          </div>
          <div className="wk-body" style={{ gridTemplateRows: `repeat(${laneCount}, 30px)` }}>
            {bars.length === 0 && <div className="wk-empty muted">No tasks this week.</div>}
            {bars.map((b) => (
              <button
                key={b.task_id}
                className={`wk-bar ${b.overdue ? "overdue" : ""}`}
                style={{ gridColumn: `${b.startCol} / ${b.endCol + 1}`, gridRow: b.lane + 1, background: b.color }}
                onClick={() => open(b.task_id)}
                title={b.title}
              >
                <span className="wk-bar-title">{b.endsThisWeek ? "⏰ " : ""}{b.title}</span>
                {b.assignee_ids.length > 0 && (
                  <span className="chip-initials" title={b.assignee_ids.map((id) => userName(users, id)).join(", ")}>
                    {b.assignee_ids.map((id) => userInitials(users, id)).join(" ")}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
