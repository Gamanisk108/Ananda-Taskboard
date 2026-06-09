import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { addDays, addMonths, format, getDay, getDaysInMonth, startOfMonth, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { dfLocale } from "../dateLocale";
import { api } from "../api/client";
import { dayCells, useCalendarRange, type CalendarViewProps } from "../calendar";
import { Modal, BottomSheet, Spinner, DueFlag, CalAnnounceIcon, CalHolidayIcon, useIsNarrow } from "./common";
import { DayCellLines } from "./DayCellLines";
import { DayTaskList } from "./DayTaskList";
import { UndatedTasks } from "./UndatedTasks";
import { type CalendarInstance, type EventSpan, type Holiday, type Task } from "../types";

export function MonthlyView({ projectId, subprojectId, onEdit }: CalendarViewProps) {
  const { t } = useTranslation();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const narrow = useIsNarrow();
  const today = format(new Date(), "yyyy-MM-dd");
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const colorByProject = !projectId;

  // Fetch the whole visible block (6 weeks from the Sunday on/before the 1st).
  const gridStart = startOfWeek(month, { weekStartsOn: 0 });
  const from = format(gridStart, "yyyy-MM-dd");
  const to = format(addDays(gridStart, 41), "yyyy-MM-dd");
  const { items, events, holidays, undated } = useCalendarRange(from, to, projectId, subprojectId);

  const eventsByDate = useMemo(() => {
    const m = new Map<string, EventSpan[]>();
    for (const e of events) {
      let cur = e.start < from ? from : e.start;
      const last = e.end > to ? to : e.end;
      while (cur <= last) {
        if (!m.has(cur)) m.set(cur, []);
        m.get(cur)!.push(e);
        cur = format(addDays(new Date(`${cur}T00:00:00`), 1), "yyyy-MM-dd");
      }
    }
    return m;
  }, [events, from, to]);

  const holidaysByDate = useMemo(() => {
    const m = new Map<string, Holiday[]>();
    for (const h of holidays) {
      if (!m.has(h.start)) m.set(h.start, []);
      m.get(h.start)!.push(h);
    }
    return m;
  }, [holidays]);

  const byDate = useMemo(() => {
    const m = new Map<string, CalendarInstance[]>();
    for (const i of items ?? []) {
      if (!m.has(i.date)) m.set(i.date, []);
      m.get(i.date)!.push(i);
    }
    return m;
  }, [items]);

  // Month-anchored grid (design): blank cells pad the start/end of the month.
  const startDay = getDay(month);            // 0 = Sun
  const dim = getDaysInMonth(month);
  const total = Math.ceil((startDay + dim) / 7) * 7;

  function countsByColor(dayItems: CalendarInstance[]) {
    const m = new Map<string, number>();
    for (const i of dayItems) {
      const c = colorByProject ? i.project_color : i.subproject_color;
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return [...m.entries()];
  }

  async function open(id: number) {
    const task = (await api.get(`/api/tasks/${id}`)) as Task;
    setDayOpen(null);
    onEdit(task);
  }

  const y = month.getFullYear(), m = month.getMonth();

  return (
    <div className="rise">
      <div className="cal-head">
        <div className="nav">
          <button className="btn-secondary icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label={t("cal.prev")}><ChevronLeft /></button>
          <button className="btn-secondary" onClick={() => setMonth(startOfMonth(new Date()))}>{t("cal.thisMonth")}</button>
          <button className="btn-secondary icon-btn" onClick={() => setMonth(addMonths(month, 1))} aria-label={t("cal.next")}><ChevronRight /></button>
        </div>
        <h2>{format(month, "MMMM yyyy", { locale: dfLocale() })}</h2>
        <UndatedTasks undated={undated} colorByProject={colorByProject} onOpen={open} />
      </div>
      {!items ? (
        <Spinner />
      ) : (
        <>
          <div className="month">
            {(["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const).map((d) => (
              <div className="dow" key={d}>{t(`cal.dow.${d}`)}</div>
            ))}
            {Array.from({ length: total }, (_, i) => {
              const dayNum = i - startDay + 1;
              if (dayNum < 1 || dayNum > dim) return <div key={`b${i}`} className="mcell dim" />;
              const date = new Date(y, m, dayNum);
              const iso = format(date, "yyyy-MM-dd");
              const dayItems = byDate.get(iso) ?? [];
              const dayEvents = eventsByDate.get(iso) ?? [];
              const hasOverdue = dayItems.some((it) => it.overdue);
              const hasSoon = !hasOverdue && dayItems.some((it) => it.is_deadline && (it.date === today || it.date === tomorrow) && !it.overdue);
              const isToday = iso === today;
              // single class, today-first (matches the design's priority order)
              const cls = isToday ? "today" : hasOverdue ? "has-overdue" : hasSoon ? "has-soon" : iso < today ? "past" : "future";
              return (
                <button key={iso} className={`mcell ${cls}`} data-date={iso}
                  onClick={() => (dayItems.length || dayEvents.length || (holidaysByDate.get(iso)?.length)) && setDayOpen(iso)}>
                  <div className="dh">
                    <span className="day-num">{dayNum}</span>
                    {isToday && <span className="today-tag">{t("cal.today", "Today")}</span>}
                    {hasOverdue && <DueFlag kind="overdue" size={13} title={t("list.missedDeadline")} />}
                    {!hasOverdue && hasSoon && <DueFlag kind="soon" size={13} title={t("list.dueSoon")} />}
                  </div>
                  <DayCellLines
                    {...dayCells(
                      dayEvents.map((e) => ({ title: e.title })),
                      holidaysByDate.get(iso) ?? [],
                      3,
                    )}
                    cls="mev"
                    moreLabel={t("cal.more", "more")}
                  />
                  {dayItems.length > 0 && (
                    <div className="badges">
                      {countsByColor(dayItems).map(([c, n]) => (
                        <span key={c} className="badge" style={{ background: c }}>{n}</span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {dayOpen && (() => {
            const dayTitle = format(new Date(`${dayOpen}T00:00:00`), "EEEE, MMM d, yyyy", { locale: dfLocale() });
            const dayContent = (
              <>
                {(eventsByDate.get(dayOpen) ?? []).map((e, k) => (
                  <div key={`ev-${k}`} className="cal-event" style={{ margin: "0 0 8px" }}>
                    <CalAnnounceIcon size={14} /><span className="cal-line-txt">{e.title}</span>
                  </div>
                ))}
                {(holidaysByDate.get(dayOpen) ?? []).map((h, k) => (
                  <div key={`h${k}`} className="cal-event holiday" style={{ margin: "0 0 8px" }}>
                    <CalHolidayIcon size={14} /><span className="cal-line-txt">{h.title}</span>
                  </div>
                ))}
                <DayTaskList items={byDate.get(dayOpen) ?? []} colorByProject={colorByProject} onOpen={open} />
              </>
            );
            // On phones the day detail is a bottom sheet (design); desktop = modal.
            return narrow
              ? <BottomSheet title={dayTitle} onClose={() => setDayOpen(null)}>{dayContent}</BottomSheet>
              : <Modal title={dayTitle} onClose={() => setDayOpen(null)}>{dayContent}</Modal>;
          })()}
        </>
      )}
    </div>
  );
}
