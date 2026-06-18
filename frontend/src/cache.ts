// Optimistic TanStack-Query cache helpers. Every task list is cached under a
// key that starts with ["tasks"] (App's allTasks, ListView's filtered list,
// approvals, …). After a mutation we used to ONLY invalidate → every list waited
// on a network refetch before reflecting the change (the visible lag), and the
// stale window let a task reopened from a not-yet-refetched row save back old
// data (an assignee silently dropped). These helpers merge the change into the
// cache immediately, so the UI updates instantly and reopened rows are fresh; the
// background invalidate (bump) still runs to reconcile filter membership.

import type { QueryClient } from "@tanstack/react-query";
import type { Task } from "./types";

/** Merge a partial task (matched by id) into every cached ["tasks"] list. */
export function patchTaskInCaches(qc: QueryClient, id: number, patch: Partial<Task>) {
  qc.setQueriesData<Task[] | undefined>({ queryKey: ["tasks"] }, (old) =>
    Array.isArray(old) ? old.map((t) => (t.id === id ? { ...t, ...patch } : t)) : old);
}

/** Apply the same partial patch to many task ids at once (bulk actions). */
export function patchTasksInCaches(qc: QueryClient, ids: number[], patch: Partial<Task>) {
  const idSet = new Set(ids);
  qc.setQueriesData<Task[] | undefined>({ queryKey: ["tasks"] }, (old) =>
    Array.isArray(old) ? old.map((t) => (idSet.has(t.id) ? { ...t, ...patch } : t)) : old);
}

/** Replace the full task object (matched by id) in every cached ["tasks"] list. */
export function upsertTaskInCaches(qc: QueryClient, task: Task) {
  qc.setQueriesData<Task[] | undefined>({ queryKey: ["tasks"] }, (old) =>
    Array.isArray(old) ? old.map((t) => (t.id === task.id ? { ...t, ...task } : t)) : old);
}

/** Remove tasks (by id) from every cached ["tasks"] list (archive/delete). */
export function removeTasksFromCaches(qc: QueryClient, ids: number[]) {
  const idSet = new Set(ids);
  qc.setQueriesData<Task[] | undefined>({ queryKey: ["tasks"] }, (old) =>
    Array.isArray(old) ? old.filter((t) => !idSet.has(t.id)) : old);
}
