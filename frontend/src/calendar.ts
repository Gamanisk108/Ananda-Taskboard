import { useQuery } from "@tanstack/react-query";
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

// Load calendar task-instances, event-spans, and computed holidays for a date
// range. Both views share this exact fetch/refresh cycle; only the [from, to]
// range differs.
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
  // Holidays are org-config-driven and change rarely; the ["tasks"] prefix keeps
  // them refreshing alongside the rest of the board data.
  const { data: holidays = [] } = useQuery({
    queryKey: ["tasks", "holidays", from, to],
    queryFn: () => api.get(`/api/holidays/range?from=${from}&to=${to}`) as Promise<Holiday[]>,
  });
  // Tasks with no start date and no deadline never land on a calendar day; both
  // views surface them as a standalone "No date" list. Independent of [from, to],
  // so keyed only by scope (and under the same ["tasks"] prefix to refresh on writes).
  const scopeQs = subprojectId ? `?subproject=${subprojectId}` : projectId ? `?project=${projectId}` : "";
  const { data: undated = [] } = useQuery({
    queryKey: ["tasks", "undated", projectId ?? null, subprojectId ?? null],
    queryFn: () => api.get(`/api/calendar/undated${scopeQs}`) as Promise<CalendarInstance[]>,
  });
  return { items, events, holidays, undated };
}

// One renderable line in a day cell: a user event or a holiday. Events sort
// first (actionable); holidays last (context). `more` is how many were clipped.
export interface DayCell { label: string; holiday: boolean; set?: string }

export function dayCells(
  events: { title: string }[],
  holidays: { title: string; set: string }[],
  max: number,
): { visible: DayCell[]; more: number } {
  const all: DayCell[] = [
    ...events.map((e) => ({ label: e.title, holiday: false })),
    ...holidays.map((h) => ({ label: h.title, holiday: true, set: h.set })),
  ];
  return { visible: all.slice(0, max), more: Math.max(0, all.length - max) };
}
