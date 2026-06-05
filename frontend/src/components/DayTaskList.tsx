import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStatuses } from "../statuses";
import { useUsers, userName } from "../users";
import { timeRange } from "../lookup";
import { StatusPill, PriorityIcon } from "./common";
import type { CalendarInstance } from "../types";

type DaySort = "time" | "title" | "status";

/** A single day's tasks. Default ("time") sort puts timed tasks first, earliest
 *  first, then a separator, then untimed. Any other sort flattens the list. */
export function DayTaskList({
  items,
  colorByProject,
  onOpen,
}: {
  items: CalendarInstance[];
  colorByProject: boolean;
  onOpen: (taskId: number) => void;
}) {
  const { t } = useTranslation();
  const [sort, setSort] = useState<DaySort>("time");
  const users = useUsers();
  const statuses = useStatuses();
  const statusOrder = useMemo(
    () => Object.fromEntries(statuses.map((s, i) => [s.key, i])),
    [statuses],
  );

  const byTitle = (a: CalendarInstance, b: CalendarInstance) =>
    a.title.toLowerCase().localeCompare(b.title.toLowerCase());

  const row = (i: CalendarInstance, idx: number) => {
    const tr = timeRange(i.start_time, i.end_time);
    return (
      <div
        key={`${i.task_id}-${idx}`}
        className="card"
        style={{ padding: "8px 10px", marginBottom: 6, cursor: "pointer", display: "flex",
          justifyContent: "space-between", alignItems: "center",
          background: i.overdue ? "#b4452f12" : undefined }}
        onClick={() => onOpen(i.task_id)}
      >
        <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <PriorityIcon level={i.priority} />
          <span className="dot" style={{ background: colorByProject ? i.project_color : i.subproject_color }} />
          {tr ? <span className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>{tr}</span>
              : <span className="muted" style={{ fontSize: 12 }}>{t("day.allDay")}</span>}
          {i.title}
          {i.overdue && <span className="od" title={t("list.missedDeadline")}>❗</span>}
          {i.assignee_ids.length > 0 && (
            <span className="muted" style={{ fontSize: 12 }}>
              · {i.assignee_ids.map((id) => userName(users, id)).join(", ")}
            </span>
          )}
        </span>
        <StatusPill status={i.status} />
      </div>
    );
  };

  let body;
  if (sort === "time") {
    const timed = items.filter((i) => i.start_time)
      .sort((a, b) => (a.start_time! < b.start_time! ? -1 : a.start_time! > b.start_time! ? 1 : byTitle(a, b)));
    const untimed = items.filter((i) => !i.start_time).sort(byTitle);
    body = (
      <>
        {timed.map(row)}
        {timed.length > 0 && untimed.length > 0 && (
          <div className="day-divider"><span>{t("day.untimed")}</span></div>
        )}
        {untimed.map(row)}
      </>
    );
  } else {
    const flat = [...items].sort(
      sort === "title"
        ? byTitle
        : (a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99) || byTitle(a, b),
    );
    body = <>{flat.map(row)}</>;
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <label className="muted" style={{ margin: 0, fontSize: 12 }}>{t("day.sort")}</label>
        <select value={sort} onChange={(e) => setSort(e.target.value as DaySort)} style={{ width: "auto" }}>
          <option value="time">{t("day.sortTime")}</option>
          <option value="title">{t("day.sortAZ")}</option>
          <option value="status">{t("task.status")}</option>
        </select>
      </div>
      {items.length === 0 ? <div className="muted" style={{ fontSize: 13 }}>{t("day.noTasks")}</div> : body}
    </div>
  );
}
