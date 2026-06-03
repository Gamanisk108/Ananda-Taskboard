import { useEffect, useMemo, useState } from "react";
import { addDays, addWeeks, format, startOfWeek } from "date-fns";
import { api } from "../api/client";
import { useUsers, userInitials, userName } from "../users";
import { Spinner } from "./common";
import { EVENT_ICON, type CalendarInstance, type EventSpan, type Me, type Task } from "../types";

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
  overdue: boolean;
  dueSoon: boolean;
  assignee_ids: number[];
  lane: number;
}

interface EventBar { id: number; title: string; icon: string; startCol: number; endCol: number; lane: number; }

export function WeeklyView({ projectId, subprojectId, refreshKey, onEdit }: Props) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [items, setItems] = useState<CalendarInstance[] | null>(null);
  const [events, setEvents] = useState<EventSpan[]>([]);
  const users = useUsers();
  const colorByProject = !projectId;

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const dayIso = useMemo(() => days.map((d) => format(d, "yyyy-MM-dd")), [days]);
  const today = format(new Date(), "yyyy-MM-dd");
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

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
      const deadlineInst = insts.find((i) => i.is_deadline);
      raw.push({
        task_id,
        title: first.title,
        color: colorByProject ? first.project_color : first.subproject_color,
        startCol: Math.min(...cols),
        endCol: Math.max(...cols),
        overdue: insts.some((i) => i.overdue),
        dueSoon: !!deadlineInst && (deadlineInst.date === today || deadlineInst.date === tomorrow) && !insts.some((i) => i.overdue),
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
  }, [items, dayIso, colorByProject, today, tomorrow]);

  // Event spans clipped to this week, then lane-packed (same algorithm as tasks).
  const { eventBars, eventLaneCount } = useMemo(() => {
    const first = dayIso[0], last = dayIso[6];
    const raw: Omit<EventBar, "lane">[] = [];
    for (const e of events) {
      if (e.start > last || e.end < first) continue; // outside this week
      const startCol = Math.max(0, dayIso.findIndex((d) => d >= e.start)) + 1;
      let endIdx = dayIso.length - 1;
      while (endIdx > 0 && dayIso[endIdx] > e.end) endIdx--;
      const endCol = endIdx + 1;
      if (startCol > endCol) continue;
      raw.push({ id: e.id, title: e.title, icon: EVENT_ICON[e.kind], startCol, endCol });
    }
    raw.sort((a, b) => a.startCol - b.startCol || a.endCol - b.endCol);
    const laneEnds: number[] = [];
    const packed: EventBar[] = raw.map((b) => {
      let lane = laneEnds.findIndex((end) => end < b.startCol);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(b.endCol); }
      else laneEnds[lane] = b.endCol;
      return { ...b, lane };
    });
    return { eventBars: packed, eventLaneCount: Math.max(0, laneEnds.length) };
  }, [events, dayIso]);

  return (
    <div className="rise">
      <div className="bulkbar">
        <button className="btn-secondary" onClick={() => setWeekStart(addWeeks(weekStart, -1))}>← Prev</button>
        <button className="btn-secondary" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}>This week</button>
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
              </div>
            ))}
          </div>
          {eventLaneCount > 0 && (
            <div className="wk-body wk-events" style={{ gridTemplateRows: `repeat(${eventLaneCount}, 26px)` }}>
              {eventBars.map((b) => (
                <div
                  key={b.id}
                  className="wk-bar ev"
                  style={{ gridColumn: `${b.startCol} / ${b.endCol + 1}`, gridRow: b.lane + 1 }}
                  title={b.title}
                >
                  <span className="wk-bar-title">{b.icon} {b.title}</span>
                </div>
              ))}
            </div>
          )}
          <div className="wk-body" style={{ gridTemplateRows: `repeat(${laneCount}, 30px)` }}>
            {bars.length === 0 && <div className="wk-empty muted">No tasks this week.</div>}
            {bars.map((b) => (
              <button
                key={b.task_id}
                className="wk-bar"
                style={{ gridColumn: `${b.startCol} / ${b.endCol + 1}`, gridRow: b.lane + 1,
                  background: b.overdue ? "var(--danger)" : b.dueSoon ? "var(--gold)" : b.color }}
                onClick={() => open(b.task_id)}
                title={b.title}
              >
                <span className="wk-bar-title">
                  {b.title}
                  {b.overdue && <span title="Missed Deadline"> ❗</span>}
                  {b.dueSoon && <span title="Due today or tomorrow"> ❗</span>}
                </span>
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
