import { useEffect, useState } from "react";
import { api } from "./api/client";
import type { CalendarInstance, EventSpan, Holiday, Me, Task } from "./types";

// Props shared by the week and month calendar views.
export interface CalendarViewProps {
  projectId?: number;
  subprojectId?: number;
  onEdit: (t: Task) => void;
  me: Me;
}

// Greedy lane-packing: each span takes the first lane whose previous bar ends
// before it starts, otherwise a new lane opens. Shared by the week grid's task
// row and event row, which pack with the identical algorithm.
export function packLanes<T extends { startCol: number; endCol: number }>(
  raw: T[],
): { packed: (T & { lane: number })[]; laneCount: number } {
  raw.sort((a, b) => a.startCol - b.startCol || a.endCol - b.endCol);
  const laneEnds: number[] = [];
  const packed = raw.map((b) => {
    let lane = laneEnds.findIndex((end) => end < b.startCol);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(b.endCol); }
    else laneEnds[lane] = b.endCol;
    return { ...b, lane };
  });
  return { packed, laneCount: laneEnds.length };
}

// Load calendar task-instances and event-spans for a date range. Both views
// share this exact fetch/refresh cycle; only the [from, to] range differs.
export function useCalendarRange(
  from: string,
  to: string,
  projectId: number | undefined,
  subprojectId: number | undefined,
  refreshKey?: number,
) {
  const [items, setItems] = useState<CalendarInstance[] | null>(null);
  const [events, setEvents] = useState<EventSpan[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  useEffect(() => {
    const p = new URLSearchParams({ from, to });
    if (subprojectId) p.set("subproject", String(subprojectId));
    else if (projectId) p.set("project", String(projectId));
    setItems(null);
    api.get(`/api/calendar?${p}`).then(setItems).catch(() => setItems([]));
    api.get(`/api/events/range?from=${from}&to=${to}`).then(setEvents).catch(() => setEvents([]));
    api.get(`/api/holidays/range?from=${from}&to=${to}`).then(setHolidays).catch(() => setHolidays([]));
  }, [from, to, projectId, subprojectId, refreshKey]);
  return { items, events, holidays };
}
