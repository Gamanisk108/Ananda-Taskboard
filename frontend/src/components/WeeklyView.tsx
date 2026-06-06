import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { addDays, addWeeks, format, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { dfLocale } from "../dateLocale";
import { api } from "../api/client";
import { dayCells, packLanes, useCalendarRange, type CalendarViewProps } from "../calendar";
import { isComplete } from "../statuses";
import { useUsers, userInitials, userName, avatarColor } from "../users";
import { Modal, Spinner, DueFlag } from "./common";
import { DayCellLines } from "./DayCellLines";
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
  done: boolean;
  assignee_ids: number[];
  lane: number;
}

export function WeeklyView({ projectId, subprojectId, onEdit }: CalendarViewProps) {
  const { t } = useTranslation();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const users = useUsers();
  const colorByProject = !projectId;

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const dayIso = useMemo(() => days.map((d) => format(d, "yyyy-MM-dd")), [days]);
  const today = format(new Date(), "yyyy-MM-dd");
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const todayIdx = dayIso.indexOf(today);
  const [dayOpen, setDayOpen] = useState<string | null>(null);

  const { items, events, holidays } = useCalendarRange(dayIso[0], dayIso[6], projectId, subprojectId);

  async function open(id: number) {
    const task = (await api.get(`/api/tasks/${id}`)) as Task;
    setDayOpen(null);
    onEdit(task);
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
        done: isComplete(first.status),
        assignee_ids: first.assignee_ids,
      });
    }
    const { packed, laneCount } = packLanes(raw);
    return { bars: packed, laneCount: Math.max(2, laneCount) };
  }, [items, dayIso, colorByProject, today, tomorrow]);

  // Per-day merged cells: user events first, holidays after, capped with "+N".
  const cellsByDay = useMemo(() => {
    return dayIso.map((iso) => {
      const dayEvents = events.filter((e) => e.start <= iso && e.end >= iso);
      const dayHols = holidays.filter((h) => h.start === iso);
      const withIcons = dayEvents.map((e) => ({ title: `${EVENT_ICON[e.kind]} ${e.title}` }));
      return dayCells(withIcons, dayHols, 2);
    });
  }, [events, holidays, dayIso]);

  function warnIcon(b: Bar) {
    if (b.overdue) return <DueFlag kind="overdue" size={13} />;
    if (b.dueSoon) return <DueFlag kind="soon" size={13} />;
    return null;
  }
  function miniFor(b: Bar) {
    const id = b.assignee_ids[0];
    if (id == null) return null;
    return { id, label: userInitials(users, id), name: userName(users, id) };
  }

  return (
    <div className="rise">
      <div className="cal-head">
        <div className="nav">
          <button className="btn-secondary icon-btn" onClick={() => setWeekStart(addWeeks(weekStart, -1))} aria-label={t("cal.prev")}><ChevronLeft /></button>
          <button className="btn-secondary" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}>{t("cal.thisWeek")}</button>
          <button className="btn-secondary icon-btn" onClick={() => setWeekStart(addWeeks(weekStart, 1))} aria-label={t("cal.next")}><ChevronRight /></button>
        </div>
        <h2>{format(weekStart, "MMM d", { locale: dfLocale() })} – {format(addDays(weekStart, 6), "MMM d, yyyy", { locale: dfLocale() })}</h2>
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
                  <div className="hrow">
                    <span className="dow">{format(d, "EEE", { locale: dfLocale() })}</span>
                    {iso === today && <span className="today-tag">{t("cal.today", "Today")}</span>}
                    <span className="dnum">{format(d, "MMM d", { locale: dfLocale() })}</span>
                  </div>
                  <DayCellLines {...cellsByDay[idx]} cls="ev" moreLabel={t("cal.more", "more")} />
                </div>
              );
            })}
          </div>
          <div className="wk-body" style={{ gridAutoRows: "32px", gridTemplateRows: `repeat(${laneCount}, 32px)` }}>
            {days.map((_, i) => {
              const iso = dayIso[i];
              const cls = iso === today ? "today" : iso < today ? "past" : "future";
              return <div key={`col${i}`} className={`wk-col ${cls}`} style={{ gridColumn: i + 1, gridRow: "1 / -1" }} />;
            })}
            {bars.length === 0 && <div className="kan-empty" style={{ gridColumn: "1 / 8" }}>{t("cal.noTasksWeek")}</div>}
            {bars.map((b) => {
              const cs = b.startCol - 1, ce = b.endCol - 1;
              const ring = b.overdue ? "od" : b.dueSoon ? "soon" : "";
              const mini = miniFor(b);
              const spansToday = todayIdx >= 0 && cs < todayIdx && todayIdx <= ce;
              return (
                <button
                  key={b.task_id}
                  className={`wk-bar ${ring} ${b.done ? "donebar" : ""}`}
                  style={{ gridColumn: `${b.startCol} / ${b.endCol + 1}`, gridRow: b.lane + 1, background: b.done ? "var(--todo)" : b.color, position: "relative" }}
                  onClick={() => open(b.task_id)}
                  title={b.title}
                >
                  <span className="tt">{warnIcon(b)}<span className="tn">{b.title}</span></span>
                  {mini && <span className="mini" title={mini.name}>{mini.label}</span>}
                  {spansToday && (
                    <span className="tn-today" style={{
                      position: "absolute", top: 0, bottom: 0,
                      left: `${((todayIdx - cs) / (ce - cs + 1)) * 100}%`,
                      width: `${100 / (ce - cs + 1)}%`,
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
                      padding: "0 9px", whiteSpace: "nowrap", fontWeight: 600, pointerEvents: "none",
                    }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 5, pointerEvents: "auto" }}>
                        {warnIcon(b)}{b.title}
                      </span>
                      {mini && <span className="mini" title={mini.name} style={{ flex: "none", background: avatarColor(mini.id), pointerEvents: "auto" }}>{mini.label}</span>}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {todayIdx >= 0 && (
            <div className="wk-today-hl" aria-hidden
              style={{ left: `calc(100% / 7 * ${todayIdx})`, width: "calc(100% / 7)" }} />
          )}
        </div>
      )}
      {dayOpen && (
        <Modal title={format(new Date(`${dayOpen}T00:00:00`), "EEEE, MMM d, yyyy", { locale: dfLocale() })} onClose={() => setDayOpen(null)}>
          {holidays.filter((h) => h.start === dayOpen).map((h, k) => (
            <div key={`h${k}`} className="cal-event holiday" style={{ margin: "0 0 8px" }}>{h.title}</div>
          ))}
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
