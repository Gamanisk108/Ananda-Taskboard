import { useEffect, useState } from "react";
import { addDays, addWeeks, format, startOfWeek } from "date-fns";
import { api } from "../api/client";
import { useUsers, userInitials } from "../users";
import { Spinner } from "./common";
import type { CalendarInstance, Me, Task } from "../types";

interface Props {
  projectId?: number;
  subprojectId?: number;
  refreshKey: number;
  onEdit: (t: Task) => void;
  me: Me;
}

export function WeeklyView({ projectId, subprojectId, refreshKey, onEdit }: Props) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [items, setItems] = useState<CalendarInstance[] | null>(null);
  const [events, setEvents] = useState<{ date: string; title: string; yearly: boolean }[]>([]);
  const users = useUsers();
  const colorByProject = !projectId; // global → by project; inside a project → by sub-project

  useEffect(() => {
    const from = format(weekStart, "yyyy-MM-dd");
    const to = format(addDays(weekStart, 6), "yyyy-MM-dd");
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

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

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
        <div className="week">
          {days.map((d) => {
            const iso = format(d, "yyyy-MM-dd");
            const dayItems = items.filter((i) => i.date === iso);
            return (
              <div className="week-col" key={iso}>
                <h4>{format(d, "EEE")} <span className="day-num">{format(d, "d")}</span></h4>
                {events.filter((e) => e.date === iso).map((e, k) => (
                  <div key={`ev-${k}`} className="cal-event" title={e.title}>{e.yearly ? "🎂" : "📌"} {e.title}</div>
                ))}
                {dayItems.map((i, idx) => (
                  <button
                    key={`${i.task_id}-${idx}`}
                    className={`chip ${i.overdue ? "overdue" : ""}`}
                    style={{ background: colorByProject ? i.project_color : i.subproject_color }}
                    onClick={() => open(i.task_id)}
                    title={`${i.title}${i.is_deadline ? " (due)" : ""}`}
                  >
                    <span style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {i.is_deadline ? "⏰ " : ""}{i.title}
                      </span>
                      {i.assignee_ids.length > 0 && (
                        <span className="chip-initials">{i.assignee_ids.map((id) => userInitials(users, id)).join(" ")}</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
