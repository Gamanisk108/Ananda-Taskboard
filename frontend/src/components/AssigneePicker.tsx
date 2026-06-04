import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { UserLite } from "../types";

export interface GroupLite {
  id: number;
  name: string;
  member_ids?: number[];
}

interface Props {
  users: UserLite[];
  groups: GroupLite[]; // [] for non-admins (groups endpoint is admin-only)
  assignees: number[];
  setAssignees: (ids: number[]) => void;
  assigneeGroups: number[];
  setAssigneeGroups: (ids: number[]) => void;
  subproject: number;
  isAdmin: boolean;
}

export function AssigneePicker({
  users, groups, assignees, setAssignees, assigneeGroups, setAssigneeGroups, subproject, isAdmin,
}: Props) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<number>(0); // 0 = all people

  const name = (id: number) => {
    const u = users.find((x) => x.id === id);
    return u ? u.name || u.email : `#${id}`;
  };
  const hasAccess = (u: UserLite) => u.is_admin || u.subproject_ids.includes(subproject);
  const toggle = (id: number) =>
    setAssignees(assignees.includes(id) ? assignees.filter((x) => x !== id) : [...assignees, id]);
  const toggleGroup = (id: number) =>
    setAssigneeGroups(assigneeGroups.includes(id) ? assigneeGroups.filter((x) => x !== id) : [...assigneeGroups, id]);

  const filtered = useMemo(() => {
    let list = users;
    if (groupFilter) {
      const g = groups.find((x) => x.id === groupFilter);
      const ids = new Set(g?.member_ids ?? []);
      list = list.filter((u) => ids.has(u.id));
    }
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((u) => (u.name || u.email).toLowerCase().includes(q));
    return list;
  }, [users, groups, groupFilter, query]);

  // Collapsed summary
  if (!editing) {
    const groupNames = assigneeGroups.map((id) => groups.find((g) => g.id === id)?.name).filter(Boolean);
    const none = assignees.length === 0 && groupNames.length === 0;
    return (
      <div className="field">
        <label>{t("task.assignees")}</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {none ? (
            <span className="muted">None assigned</span>
          ) : (
            <span className="who">
              {assignees.map((id) => <span key={id} className="pill">{name(id)}</span>)}
              {groupNames.map((n) => <span key={n} className="pill" style={{ background: "var(--primary-weak)" }}>👥 {n}</span>)}
            </span>
          )}
          <button type="button" className="btn-ghost" onClick={() => setEditing(true)}>{t("common.edit")}</button>
        </div>
      </div>
    );
  }

  // Expanded editor
  return (
    <div className="field">
      <label>{t("task.assignees")}</label>
      <div className="card" style={{ padding: 10, background: "var(--surface-sunk)" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input placeholder="Search by name…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
          {isAdmin && groups.length > 0 && (
            <select value={groupFilter} onChange={(e) => setGroupFilter(Number(e.target.value))} style={{ maxWidth: 170 }}>
              <option value={0}>Filter: any group</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
        </div>

        {isAdmin && groups.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>Assign a WHOLE group:</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {groups.map((g) => (
                <button key={g.id} type="button"
                  className={assigneeGroups.includes(g.id) ? "btn-primary" : "btn-secondary"}
                  style={{ padding: "3px 9px", fontSize: 12 }}
                  onClick={() => toggleGroup(g.id)}>
                  👥 {g.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="assignee-list">
          {filtered.length === 0 && <span className="muted">No matches.</span>}
          {filtered.map((u) => {
            const access = hasAccess(u);
            return (
              <label key={u.id} className={`assignee-row ${access ? "" : "no-access"}`}
                title={access ? "" : "No access to the selected sub-project"}>
                <input type="checkbox" style={{ width: "auto" }} checked={assignees.includes(u.id)} onChange={() => toggle(u.id)} />
                <span>{u.name || u.email}</span>
                {!access && <span className="noaccess-tag">no access</span>}
              </label>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>Done</button>
        </div>
      </div>
    </div>
  );
}
