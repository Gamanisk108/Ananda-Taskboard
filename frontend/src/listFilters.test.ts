import { describe, expect, it } from "vitest";
import { matchesFilters, type TaskFilters } from "./listFilters";
import type { SubInfo } from "./lookup";
import type { Recurrence, Task } from "./types";

// A subproject lookup: sub 10 -> project 1, sub 20 -> project 2.
const sub = (projectId: number): SubInfo => ({
  name: "s", color: "#000", projectId, projectName: "p", projectColor: "#000", level: "member",
});
const subs = new Map<number, SubInfo>([[10, sub(1)], [20, sub(2)]]);

const NONE: TaskFilters = {
  q: "", fProjects: [], fSubs: [], fStatuses: [], fPriorities: [], fRecur: "", fDeadline: "",
};

function mkTask(over: Partial<Task> = {}): Task {
  return {
    id: 1, subproject: 10, project: 1, title: "Write report", details: "", requirements: "",
    assignees: [], assignee_groups: [], deadline: null, timeline_start: null, timeline_end: null,
    start_time: null, end_time: null, priority: 3, status: "todo", approval_state: "approved",
    recurrence: null, links: [], monitor: false, auto_complete: false, created_by: null,
    created_at: "2026-01-01", updated_at: "2026-01-01", archived_at: null, comment_count: 0,
    subtask_counts: {}, ...over,
  };
}

const RECUR = {} as Recurrence;

describe("matchesFilters", () => {
  it("passes a task when no filters are active", () => {
    expect(matchesFilters(mkTask(), NONE, subs)).toBe(true);
  });

  describe("text search (q)", () => {
    it("matches case-insensitively on the title", () => {
      expect(matchesFilters(mkTask({ title: "Write Report" }), { ...NONE, q: "report" }, subs)).toBe(true);
    });
    it("rejects a non-matching title", () => {
      expect(matchesFilters(mkTask({ title: "Write report" }), { ...NONE, q: "invoice" }, subs)).toBe(false);
    });
  });

  describe("project / subproject scope (multi-select)", () => {
    it("filters by the subprojects' parent projects", () => {
      expect(matchesFilters(mkTask({ subproject: 10 }), { ...NONE, fProjects: [1] }, subs)).toBe(true);
      expect(matchesFilters(mkTask({ subproject: 10 }), { ...NONE, fProjects: [2] }, subs)).toBe(false);
    });
    it("ORs multiple selected projects", () => {
      expect(matchesFilters(mkTask({ subproject: 20 }), { ...NONE, fProjects: [1, 2] }, subs)).toBe(true);
    });
    it("filters by exact subprojects", () => {
      expect(matchesFilters(mkTask({ subproject: 20 }), { ...NONE, fSubs: [20] }, subs)).toBe(true);
      expect(matchesFilters(mkTask({ subproject: 10 }), { ...NONE, fSubs: [20] }, subs)).toBe(false);
      expect(matchesFilters(mkTask({ subproject: 10 }), { ...NONE, fSubs: [10, 20] }, subs)).toBe(true);
    });
  });

  describe("status / priority (multi-select)", () => {
    it("ORs the selected status keys", () => {
      expect(matchesFilters(mkTask({ status: "done" }), { ...NONE, fStatuses: ["done"] }, subs)).toBe(true);
      expect(matchesFilters(mkTask({ status: "todo" }), { ...NONE, fStatuses: ["done"] }, subs)).toBe(false);
      expect(matchesFilters(mkTask({ status: "in_progress" }), { ...NONE, fStatuses: ["todo", "in_progress"] }, subs)).toBe(true);
    });
    it("ORs the selected priorities", () => {
      expect(matchesFilters(mkTask({ priority: 5 }), { ...NONE, fPriorities: [5] }, subs)).toBe(true);
      expect(matchesFilters(mkTask({ priority: 3 }), { ...NONE, fPriorities: [5] }, subs)).toBe(false);
      expect(matchesFilters(mkTask({ priority: 1 }), { ...NONE, fPriorities: [1, 5] }, subs)).toBe(true);
    });
  });

  describe("recurrence", () => {
    it("'yes' keeps only recurring tasks", () => {
      expect(matchesFilters(mkTask({ recurrence: RECUR }), { ...NONE, fRecur: "yes" }, subs)).toBe(true);
      expect(matchesFilters(mkTask({ recurrence: null }), { ...NONE, fRecur: "yes" }, subs)).toBe(false);
    });
    it("'no' keeps only one-off tasks", () => {
      expect(matchesFilters(mkTask({ recurrence: null }), { ...NONE, fRecur: "no" }, subs)).toBe(true);
      expect(matchesFilters(mkTask({ recurrence: RECUR }), { ...NONE, fRecur: "no" }, subs)).toBe(false);
    });
  });

  describe("deadline", () => {
    it("'overdue' keeps open tasks past their deadline", () => {
      expect(matchesFilters(mkTask({ deadline: "2000-01-01", status: "todo" }), { ...NONE, fDeadline: "overdue" }, subs)).toBe(true);
      expect(matchesFilters(mkTask({ deadline: "2999-12-31", status: "todo" }), { ...NONE, fDeadline: "overdue" }, subs)).toBe(false);
    });
    it("'overdue' excludes completed tasks (no longer overdue)", () => {
      expect(matchesFilters(mkTask({ deadline: "2000-01-01", status: "done" }), { ...NONE, fDeadline: "overdue" }, subs)).toBe(false);
    });
    it("'pending' keeps open tasks with a current/upcoming deadline", () => {
      expect(matchesFilters(mkTask({ deadline: "2999-12-31", status: "todo" }), { ...NONE, fDeadline: "pending" }, subs)).toBe(true);
    });
    it("'pending' excludes tasks with no deadline and overdue tasks", () => {
      expect(matchesFilters(mkTask({ deadline: null }), { ...NONE, fDeadline: "pending" }, subs)).toBe(false);
      expect(matchesFilters(mkTask({ deadline: "2000-01-01", status: "todo" }), { ...NONE, fDeadline: "pending" }, subs)).toBe(false);
    });
  });

  it("requires ALL active filter categories to pass (AND across, OR within)", () => {
    const t = mkTask({ title: "Write report", subproject: 10, priority: 5 });
    expect(matchesFilters(t, { ...NONE, q: "report", fProjects: [1], fPriorities: [5] }, subs)).toBe(true);
    // one mismatch (priority not in the selected set) fails the whole predicate
    expect(matchesFilters(t, { ...NONE, q: "report", fProjects: [1], fPriorities: [1] }, subs)).toBe(false);
  });
});
