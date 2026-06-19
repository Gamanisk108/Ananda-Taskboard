// Centralized task mutations (TanStack Query v5). Every write to a task goes
// through one of these hooks so the optimistic update + rollback live in ONE
// place instead of being hand-rolled at each call site (TaskModal, ListView,
// BulkMigrate). The pattern, per onMutate/onError/onSettled:
//   onMutate  → cancel in-flight refetches (so an invalidate can't clobber us),
//               snapshot every ["tasks"] list, then apply the optimistic patch.
//   onError   → restore the snapshot (a true revert, not a best-effort re-patch).
//   onSuccess → merge the server's authoritative row back in.
//   onSettled → invalidate ["tasks"] to reconcile filter membership / counts.
// cancelQueries is the key upgrade over a manual setQueriesData: it closes the
// race where a background refetch lands mid-mutation and overwrites the optimism.

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { patchTaskInCaches, patchTasksInCaches, removeTasksFromCaches } from "../cache";
import type { Task } from "../types";

const TASKS = { queryKey: ["tasks"] as const };

type Snapshot = [readonly unknown[], Task[] | undefined][];

/** Cancel refetches, snapshot all task lists, then run the optimistic patch. */
async function beginOptimistic(qc: QueryClient, apply: () => void): Promise<{ snap: Snapshot }> {
  await qc.cancelQueries(TASKS);
  const snap = qc.getQueriesData<Task[] | undefined>(TASKS);
  apply();
  return { snap };
}
function restore(qc: QueryClient, ctx: { snap: Snapshot } | undefined) {
  ctx?.snap.forEach(([key, data]) => qc.setQueryData(key, data));
}

export interface TaskFieldPatch {
  id: number;
  // A write payload — arbitrary JSON the server validates (buildPayload's shape is
  // looser than a read Task: priority is a plain number, status is create-only, …).
  patch: Record<string, unknown>;
}

/** PATCH a task's fields (title, assignees, dates, …) — optimistic, with rollback. */
export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: TaskFieldPatch) => api.patch(`/api/tasks/${id}`, patch) as Promise<Task>,
    onMutate: ({ id, patch }) => beginOptimistic(qc, () => patchTaskInCaches(qc, id, patch as Partial<Task>)),
    onError: (_e, _v, ctx) => restore(qc, ctx),
    onSuccess: (updated) => patchTaskInCaches(qc, updated.id, updated),
    onSettled: () => qc.invalidateQueries(TASKS),
  });
}

/** Change a task's status (its own endpoint) — optimistic, with rollback. */
export function useTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.post(`/api/tasks/${id}/status`, { status }),
    onMutate: ({ id, status }) => beginOptimistic(qc, () => patchTaskInCaches(qc, id, { status })),
    onError: (_e, _v, ctx) => restore(qc, ctx),
    onSettled: () => qc.invalidateQueries(TASKS),
  });
}

export interface BulkAction {
  ids: number[];
  action: string;
  value: unknown;
}

/** Bulk action over many tasks. The /bulk route returns only counts, so the
 *  optimistic patch is DERIVED from the action; failures roll back the snapshot. */
export function useBulkTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, action, value }: BulkAction) =>
      api.post("/api/tasks/bulk", { ids, action, value }) as Promise<{ updated: number; skipped?: number }>,
    onMutate: ({ ids, action, value }) => beginOptimistic(qc, () => {
      if (action === "assign") patchTasksInCaches(qc, ids, { assignees: (value as number[]) ?? [] });
      else if (action === "status") patchTasksInCaches(qc, ids, { status: value as string });
      else if (action === "deadline") patchTasksInCaches(qc, ids, { deadline: (value as string) || null });
      else if (action === "move") patchTasksInCaches(qc, ids, { subproject: value as number });
      else if (action === "archive") removeTasksFromCaches(qc, ids);
    }),
    onError: (_e, _v, ctx) => restore(qc, ctx),
    onSettled: () => qc.invalidateQueries(TASKS),
  });
}
