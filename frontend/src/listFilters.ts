import { buildSubLookup, deadlineState } from "./lookup";
import { isComplete } from "./statuses";
import type { Task } from "./types";

// The combinable client-side filters. Tab scope (project/subproject) and the
// group filter are applied server-side; everything here narrows the result.
export interface TaskFilters {
  q: string;
  fProject: number;
  fSub: number;
  fAssignee: number; // person id; -1 = unassigned; 0 = any
  fStatus: string;
  fPriority: number;
  fRecur: "" | "yes" | "no";
  fDeadline: "" | "pending" | "overdue";
}

type SubInfo = ReturnType<typeof buildSubLookup>;

// Text/project/subproject scope.
function matchesScope(t: Task, f: TaskFilters, info: ReturnType<SubInfo["get"]>): boolean {
  if (f.q && !t.title.toLowerCase().includes(f.q.toLowerCase())) return false;
  if (f.fProject && info?.projectId !== f.fProject) return false;
  if (f.fSub && t.subproject !== f.fSub) return false;
  return true;
}

// Assignee / status / priority / recurrence attributes.
function matchesAttributes(t: Task, f: TaskFilters): boolean {
  if (f.fAssignee === -1 ? t.assignees.length !== 0 : f.fAssignee && !t.assignees.includes(f.fAssignee)) return false;
  if (f.fStatus && t.status !== f.fStatus) return false;
  if (f.fPriority && t.priority !== f.fPriority) return false;
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
