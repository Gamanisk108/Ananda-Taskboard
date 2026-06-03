import type { Me, Tree } from "./types";

export interface SubInfo {
  name: string;
  color: string;
  projectId: number;
  projectName: string;
  projectColor: string;
  level: "member" | "viewer";
}

export function buildSubLookup(tree: Tree): Map<number, SubInfo> {
  const m = new Map<number, SubInfo>();
  for (const p of tree.projects) {
    for (const s of p.subprojects) {
      m.set(s.id, {
        name: s.name,
        color: s.color,
        projectId: p.id,
        projectName: p.name,
        projectColor: p.color,
        level: s.level,
      });
    }
  }
  return m;
}

/** Projects (grouped) the user can create/edit tasks in, each with its writable
 *  sub-projects. Powers the cascading Project → Sub-project pickers. */
export interface WritableProject {
  id: number;
  name: string;
  subprojects: { id: number; name: string }[];
}
export function writableProjects(me: Me): WritableProject[] {
  const out: WritableProject[] = [];
  for (const p of me.tree.projects) {
    const subs = p.subprojects
      .filter((s) => me.is_admin || s.level === "member")
      .map((s) => ({ id: s.id, name: s.name }));
    if (subs.length) out.push({ id: p.id, name: p.name, subprojects: subs });
  }
  return out;
}

/** Local calendar date as YYYY-MM-DD (NOT UTC — toISOString would shift the day). */
function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayISO(): string {
  return localISO(new Date());
}

export function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return localISO(d);
}

/** Deadline urgency for an open task: 'overdue' (past), 'soon' (due today or tomorrow), or null. */
export function deadlineState(deadline: string | null, complete: boolean): "overdue" | "soon" | null {
  if (!deadline || complete) return null;
  if (deadline < todayISO()) return "overdue";
  if (deadline === todayISO() || deadline === tomorrowISO()) return "soon";
  return null;
}
