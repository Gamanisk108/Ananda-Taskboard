export type Level = "member" | "viewer";
export type Status = "todo" | "in_progress" | "done" | "delayed";
export type Approval = "pending" | "approved" | "rejected";

/** How many tasks in an accessible scope a grant lets the holder SEE. */
export type Sees = "own" | "subproject" | "project";
export const SEES_LABEL: Record<Sees, string> = {
  own: "Own tasks only",
  subproject: "All tasks in the sub-project",
  project: "All tasks in the project",
};

export interface Tier {
  id: number;
  name: string;
  default_sees: Sees;
  member_count?: number;
}

/** An access grant targets exactly one of user/group/tier, scoped to a
 *  subproject XOR project, at a level + sees breadth. */
export interface Grant {
  id: number;
  user: number | null;
  group: number | null;
  tier: number | null;
  subproject: number | null;
  project: number | null;
  level: Level;
  sees: Sees;
}

/** A deny rule: one subject (user/group/tier) ⊘ one excluded target. */
export interface Exclusion {
  id: number;
  user: number | null;
  group: number | null;
  tier: number | null;
  excluded_user: number | null;
  excluded_group: number | null;
  excluded_project: number | null;
  excluded_subproject: number | null;
  excluded_task: number | null;
}

export interface SubProjectNode {
  id: number;
  name: string;
  color: string;
  is_default: boolean;
  level: Level;
}
export interface ProjectNode {
  id: number;
  name: string;
  color: string;
  show_project_overview: boolean;
  subprojects: SubProjectNode[];
}
export interface Tree {
  projects: ProjectNode[];
  show_global_overview: boolean;
}
export interface Me {
  id: number;
  email: string;
  name: string;
  role: "admin" | "member";
  is_admin: boolean;
  tier: number | null;
  language: string;
  groups: { id: number; name: string }[];
  tree: Tree;
}

export interface Recurrence {
  id?: number;
  freq: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  anchor: string;
  end_date?: string | null;
  count?: number | null;
  weekdays?: number[]; // weekly only: Mon=0..Sun=6; [] = anchor's weekday
}

export type Priority = 1 | 2 | 3 | 4 | 5;

/** label, color, and chevron shape for each priority level. */
export const PRIORITY_META: Record<number, { label: string; color: string; dir: "up" | "down" | "mid"; double: boolean }> = {
  5: { label: "Highest", color: "#b4452f", dir: "up", double: true },
  4: { label: "High", color: "#c2762a", dir: "up", double: false },
  3: { label: "Medium", color: "#b7791f", dir: "mid", double: false },
  2: { label: "Low", color: "#3b82a8", dir: "down", double: false },
  1: { label: "Lowest", color: "#64748b", dir: "down", double: true },
};

export interface Task {
  id: number;
  subproject: number;
  project: number;
  title: string;
  details: string;
  requirements: string;
  assignees: number[];
  assignee_groups: number[];
  deadline: string | null;
  timeline_start: string | null;
  timeline_end: string | null;
  start_time: string | null; // "HH:MM" when timed
  end_time: string | null;
  priority: Priority;
  status: string;            // dynamic status key (see /api/statuses)
  approval_state: Approval;
  recurrence: Recurrence | null;
  links: string[];
  monitor: boolean;
  auto_complete: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  comment_count: number;
  subtask_counts: Record<string, number>; // status key -> count
}

export interface Subtask {
  id: number;
  task: number;
  title: string;
  status: string;
  order: number;
  assignee: number | null;
}

export interface UserLite {
  id: number;
  name: string;
  email: string;
  is_admin: boolean;
  tier?: number | null;
  subproject_ids: number[];
}

export interface CalendarInstance {
  task_id: number;
  title: string;
  date: string;
  status: string;
  is_recurring: boolean;
  is_deadline: boolean;
  subproject_id: number;
  subproject_name: string;
  subproject_color: string;
  project_id: number;
  project_name: string;
  project_color: string;
  overdue: boolean;
  assignee_ids: number[];
  start_time: string | null; // "HH:MM" when timed
  end_time: string | null;
  priority: Priority;
}

export type EventKind = "single" | "yearly" | "range" | "repeating";

/** One occurrence-span from /api/events/range. start/end are true (unclipped). */
export interface EventSpan {
  id: number;
  title: string;
  kind: EventKind;
  yearly: boolean;
  start: string; // YYYY-MM-DD
  end: string;
}

export const EVENT_ICON: Record<EventKind, string> = {
  single: "📍", yearly: "🎂", range: "📌", repeating: "🔁",
};

export const STATUS_LABEL: Record<Status, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
  delayed: "Delayed",
};
export const STATUS_COLOR: Record<Status, string> = {
  todo: "#6b7280",
  in_progress: "#2c64a8",  // Claude Design azure (was teal)
  done: "#3f7d54",
  delayed: "#bb3b28",      // terracotta (was gold)
};
