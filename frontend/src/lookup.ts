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

/** Sub-projects the user can create/edit tasks in (Member level or admin). */
export function writableSubprojects(me: Me) {
  const out: { id: number; label: string }[] = [];
  for (const p of me.tree.projects) {
    for (const s of p.subprojects) {
      if (me.is_admin || s.level === "member") {
        out.push({ id: s.id, label: p.show_project_overview || p.subprojects.length > 1 ? `${p.name} / ${s.name}` : p.name });
      }
    }
  }
  return out;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
