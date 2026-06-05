import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { addDays, addWeeks, format, startOfWeek } from "date-fns";
import { dfLocale } from "../dateLocale";
import { api } from "../api/client";
import { packLanes, useCalendarRange, type CalendarViewProps } from "../calendar";
import { useUsers, userInitials, userName } from "../users";
import { Modal, Spinner, PriorityIcon } from "./common";
import { DayTaskList } from "./DayTaskList";
import { EVENT_ICON, type CalendarInstance, type Task } from "../types";

interface Bar {
  task_id: number;
  title: string;
  color: string;
  startCol: number; // 1..7
  endCol: number;   // 1..7
  overdue: boolean;
  dueSoon: boolean;
  priority: number;
  assignee_ids: number[];
  lane: number;
}

interface EventBar { id: number; title: string; icon: string; startCol: number; endCol: number; lane: number; }

export function WeeklyView({ projectId, subprojectId, refreshKey, onEdit }: CalendarViewProps) {
  const { t } = useTranslation();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const users = useUsers();
  const colorByProject = !projectId;

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const dayIso = useMemo(() => days.map((d) => format(d, "yyyy-MM-dd")), [days]);
  const today = format(new Date(), "yyyy-MM-dd");
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const [dayOpen, setDayOpen] = useState<string | null>(null);

  const { items, events } = useCalendarRange(dayIso[0], dayIso[6], projectId, subprojectId, refreshKey);

  async function open(id: number) {
    const t = (await api.get(`/api/tasks/${id}`)) as Task;
    setDayOpen(null);
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
        priority: first.priority,
        assignee_ids: first.assignee_ids,
      });
    }
    const { packed, laneCount } = packLanes(raw);
    return { bars: packed, laneCount: Math.max(1, laneCount) };
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
    const { packed, laneCount } = packLanes(raw);
    return { eventBars: packed, eventLaneCount: laneCount };
  }, [events, dayIso]);

  return (
    <div className="rise">
      <div className="bulkbar">
        <button className="btn-secondary" onClick={() => setWeekStart(addWeeks(weekStart, -1))}>{t("cal.prev")}</button>
        <button className="btn-secondary" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}>{t("cal.thisWeek")}</button>
        <button className="btn-secondary" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>{t("cal.next")}</button>
        <span className="muted mono">{format(weekStart, "MMM d", { locale: dfLocale() })} – {format(addDays(weekStart, 6), "MMM d, yyyy", { locale: dfLocale() })}</span>
      </div>
      {!items ? (
        <Spinner />
      ) : (
        <div className="wk">
          <div className="wk-head">
            {days.map((d, idx) => {
              const iso = dayIso[idx];
              const when = iso === today ? "today" : iso < today ? "past" : "future";
              return (
                <div className={`wk-hcell wk-hcell-click ${when}`} key={idx}
                  title={t("cal.openDay")} onClick={() => setDayOpen(iso)}>
                  <div>{format(d, "EEE", { locale: dfLocale() })} <span className="day-num">{format(d, "MMM d", { locale: dfLocale() })}</span></div>
                </div>
              );
            })}
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
            {bars.length === 0 && <div className="wk-empty muted">{t("cal.noTasksWeek")}</div>}
            {bars.map((b) => (
              <button
                key={b.task_id}
                className="wk-bar"
                style={{ gridColumn: `${b.startCol} / ${b.endCol + 1}`, gridRow: b.lane + 1,
                  background: b.overdue ? "var(--danger)" : b.dueSoon ? "var(--gold)" : b.color }}
                onClick={() => open(b.task_id)}
                title={b.title}
              >
                <span className="wk-bar-title" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <PriorityIcon level={b.priority} size={12} color="rgba(255,255,255,.92)" />
                  {b.title}
                  {b.overdue && <span title={t("list.missedDeadline")}> ❗</span>}
                  {b.dueSoon && <span title={t("list.dueSoon")}> ❗</span>}
                </span>
                {b.assignee_ids.length > 0 && (
                  <span className="chip-initials" title={b.assignee_ids.map((id) => userName(users, id)).join(", ")}>
                    {b.assignee_ids.map((id) => userInitials(users, id)).join(" ")}
                  </span>
                )}
              </button>
            ))}
          </div>
          {dayIso.indexOf(today) >= 0 && (
            <div className="wk-today-hl" aria-hidden
              style={{ left: `calc(100% / 7 * ${dayIso.indexOf(today)})`, width: "calc(100% / 7)" }} />
          )}
        </div>
      )}
      {dayOpen && (
        <Modal title={format(new Date(`${dayOpen}T00:00:00`), "EEEE, MMM d, yyyy", { locale: dfLocale() })} onClose={() => setDayOpen(null)}>
          <DayTaskList
            items={(items ?? []).filter((i) => i.date === dayOpen)}
            colorByProject={colorByProject}
            onOpen={open}
          />
        </Modal>
      )}
    </div>
  );
}
