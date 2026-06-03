export type Level = "member" | "viewer";
export type Status = "todo" | "in_progress" | "done" | "delayed";
export type Approval = "pending" | "approved" | "rejected";

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
  tree: Tree;
}

export interface Recurrence {
  id?: number;
  freq: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  anchor: string;
  end_date?: string | null;
  count?: number | null;
}

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
  status: string;            // dynamic status key (see /api/statuses)
  approval_state: Approval;
  recurrence: Recurrence | null;
  links: string[];
  monitor: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  comment_count: number;
}

export interface UserLite {
  id: number;
  name: string;
  email: string;
  is_admin: boolean;
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
}

export const STATUS_LABEL: Record<Status, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
  delayed: "Delayed",
};
export const STATUS_COLOR: Record<Status, string> = {
  todo: "#6b7280",
  in_progress: "#2f7d74",
  done: "#4f7a3c",
  delayed: "#b7791f",
};
