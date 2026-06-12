export type Level = "member" | "viewer";
export type Approval = "pending" | "approved" | "rejected";

/** A member's "Access" — how many tasks they can SEE. */
export type Sees = "own" | "subproject" | "project" | "org";
export const SEES_LABEL: Record<Sees, string> = {
  own: "Assigned Tasks",
  subproject: "Sub-Project",
  project: "Project",
  org: "Organization",
};
/** Dropdown / ranking order: narrowest → widest. */
export const SEES_ORDER: Record<Sees, number> = { own: 1, subproject: 2, project: 3, org: 4 };

export interface SubProjectNode {
  id: number;
  name: string;
  color: string;
  is_default: boolean;
  level: Level;
  created_at?: string;
}
export interface ProjectNode {
  id: number;
  name: string;
  color: string;
  show_project_overview: boolean;
  subprojects: SubProjectNode[];
  created_at?: string;
}
export interface Tree {
  projects: ProjectNode[];
  show_global_overview: boolean;
}
/** One organization the signed-in user can act in (their tenant + role there). */
export interface OrgMembership {
  org_id: number;
  name: string;
  city: string;
  country: string;
  role: "admin" | "member";
  tier: number | null;
}
export interface Me {
  id: number;
  email: string;
  name: string;
  role: "admin" | "member";
  is_admin: boolean;          // admin OF THE ACTIVE ORG (per-org)
  tier: number | null;
  language: string;
  theme: string;                 // personal UI theme ("" = follow app default)
  daily_push_enabled: boolean;   // personal opt-in to the daily push
  deadline_reminders?: boolean;  // "due tomorrow" heads-up in the digest
  assignment_changes?: boolean;  // real-time ping when newly assigned
  groups: { id: number; name: string }[];
  tree: Tree;
  memberships: OrgMembership[];
  active_org: number | null;
  is_superuser: boolean;       // platform owner → metadata-only stats view
}

/** Platform-owner directory entry: metadata only, never an org's task content. */
export interface PlatformOrg {
  id: number;
  name: string;
  city: string;
  country: string;
  is_active: boolean;
  created_at: string;
  admins: { name: string; email: string }[];
  counts: { projects: number; subprojects: number; tasks: number; members: number };
  members: { name: string; email: string; role: "admin" | "member"; tier: string | null; active: boolean }[];
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
  priority: number;
  details: string;
  requirements: string;
  timeline_start: string | null;
  deadline: string | null;
  start_time: string | null;
  end_time: string | null;
  assignees: number[];
  assignee_groups: number[];
  links: string[];
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

export interface Holiday {
  title: string;
  set: string;
  holiday: true;
  start: string; // YYYY-MM-DD
  end: string;   // == start (holidays are single-day)
}
