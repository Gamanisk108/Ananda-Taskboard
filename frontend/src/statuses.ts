import { useEffect, useState } from "react";
import { api } from "./api/client";

export interface TaskStatus {
  id: number;
  key: string;
  label: string;
  color: string;
  order: number;
  is_complete: boolean;
  is_initial: boolean;
}

// Fallback used before the API responds (real values come from /api/statuses).
const DEFAULTS: TaskStatus[] = [
  { id: -1, key: "todo", label: "To Do", color: "#6b7280", order: 0, is_complete: false, is_initial: true },
  { id: -2, key: "in_progress", label: "In Progress", color: "#2f7d74", order: 1, is_complete: false, is_initial: false },
  { id: -3, key: "delayed", label: "Delayed", color: "#b7791f", order: 2, is_complete: false, is_initial: false },
  { id: -5, key: "review", label: "Review", color: "#7A5AA6", order: 3, is_complete: false, is_initial: false },
  { id: -4, key: "done", label: "Done", color: "#4f7a3c", order: 4, is_complete: true, is_initial: false },
];

let cache: TaskStatus[] = DEFAULTS;
let inflight: Promise<TaskStatus[]> | null = null;
const subscribers = new Set<(s: TaskStatus[]) => void>();

export function fetchStatuses(force = false): Promise<TaskStatus[]> {
  if (!force && cache !== DEFAULTS) return Promise.resolve(cache);
  if (!inflight) {
    inflight = api.get("/api/statuses")
      .then((d) => {
        const list = (d as TaskStatus[]).sort((a, b) => a.order - b.order);
        cache = list.length ? list : DEFAULTS;
        inflight = null;
        subscribers.forEach((fn) => fn(cache));
        return cache;
      })
      .catch(() => { inflight = null; return cache; });
  }
  return inflight;
}

export function invalidateStatuses() {
  cache = DEFAULTS;
  fetchStatuses(true);
}

function statusByKey(key: string): TaskStatus | undefined {
  return cache.find((s) => s.key === key);
}
export function statusLabel(key: string): string {
  return statusByKey(key)?.label ?? key;
}
export function statusColor(key: string): string {
  return statusByKey(key)?.color || "#6b7280";
}
export function isComplete(key: string): boolean {
  return statusByKey(key)?.is_complete ?? key === "done";
}

export function useStatuses(): TaskStatus[] {
  const [list, setList] = useState<TaskStatus[]>(cache);
  useEffect(() => {
    subscribers.add(setList);
    fetchStatuses().then(setList);
    return () => { subscribers.delete(setList); };
  }, []);
  return list;
}
