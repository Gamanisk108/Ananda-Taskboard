import { useQuery } from "@tanstack/react-query";
import { api } from "./api/client";
import type { CalendarInstance, EventSpan, Me, Task } from "./types";

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
) {
  const p = new URLSearchParams({ from, to });
  if (subprojectId) p.set("subproject", String(subprojectId));
  else if (projectId) p.set("project", String(projectId));
  const qs = p.toString();
  // Both queries sit under the ["tasks"] prefix so bump()'s invalidateQueries
  // (fired after any task OR event change) refreshes the calendar just like the
  // list/board views — the prefix is a "board data" group, not a type claim.
  const { data: items = null } = useQuery({
    queryKey: ["tasks", "calendar", from, to, projectId ?? null, subprojectId ?? null],
    queryFn: () => api.get(`/api/calendar?${qs}`) as Promise<CalendarInstance[]>,
  });
  const { data: events = [] } = useQuery({
    queryKey: ["tasks", "events", from, to],
    queryFn: () => api.get(`/api/events/range?from=${from}&to=${to}`) as Promise<EventSpan[]>,
  });
  return { items, events };
}
