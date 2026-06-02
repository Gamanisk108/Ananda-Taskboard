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

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
