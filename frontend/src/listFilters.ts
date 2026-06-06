import { buildSubLookup, deadlineState } from "./lookup";
import { isComplete } from "./statuses";
import type { Task } from "./types";

// The combinable client-side filters. Tab scope and the assignee/group filter are
// applied server-side; everything here narrows the result. Multi-select filters
// are arrays: empty = no filter, otherwise OR within the list (AND across lists).
export interface TaskFilters {
  q: string;
  fProjects: number[];
  fSubs: number[];
  fStatuses: string[];
  fPriorities: number[];
  fRecur: "" | "yes" | "no";
  fDeadline: "" | "pending" | "overdue";
}

type SubInfo = ReturnType<typeof buildSubLookup>;

// Text/project/subproject scope.
function matchesScope(t: Task, f: TaskFilters, info: ReturnType<SubInfo["get"]>): boolean {
  if (f.q && !t.title.toLowerCase().includes(f.q.toLowerCase())) return false;
  if (f.fProjects.length && (info?.projectId == null || !f.fProjects.includes(info.projectId))) return false;
  if (f.fSubs.length && !f.fSubs.includes(t.subproject)) return false;
  return true;
}

// Status / priority / recurrence attributes.
function matchesAttributes(t: Task, f: TaskFilters): boolean {
  if (f.fStatuses.length && !f.fStatuses.includes(t.status)) return false;
  if (f.fPriorities.length && !f.fPriorities.includes(t.priority)) return false;
  if (f.fRecur === "yes" && !t.recurrence) return false;
  if (f.fRecur === "no" && t.recurrence) return false;
  return true;
}

// Deadline state: overdue, or 'pending' = open with a current/upcoming deadline.
function matchesDeadline(t: Task, fDeadline: TaskFilters["fDeadline"]): boolean {
  if (!fDeadline) return true;
  const ds = deadlineState(t.deadline, isComplete(t.status));
  if (fDeadline === "overdue") return ds === "overdue";
  return !!(t.deadline && !isComplete(t.status) && ds !== "overdue");
}

// Pure predicate: does a task pass every active filter? Composed from the
// themed predicates above so each stays small and unit-testable.
export function matchesFilters(t: Task, f: TaskFilters, subs: SubInfo): boolean {
  const info = subs.get(t.subproject);
  return matchesScope(t, f, info) && matchesAttributes(t, f) && matchesDeadline(t, f.fDeadline);
}
