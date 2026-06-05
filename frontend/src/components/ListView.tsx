import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Search, RefreshCw } from "lucide-react";
import { dfLocale } from "../dateLocale";
import { api } from "../api/client";
import { buildSubLookup, deadlineState, timeRange } from "../lookup";
import { peopleInMyScope, useUsers, userName } from "../users";
import { useStatuses, isComplete } from "../statuses";
import { AvatarStack, StatusPill, Spinner, PriorityIcon, SubtaskDots, DueFlag } from "./common";
import { matchesFilters, type TaskFilters } from "../listFilters";
import { PRIORITY_META, type Me, type Task } from "../types";

function fmtDeadline(d: string): string {
  const dt = new Date(`${d}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? d : format(dt, "MMM d", { locale: dfLocale() });
}

interface Props {
  projectId?: number;
  subprojectId?: number;
  refreshKey: number;
  onEdit: (t: Task) => void;
  me: Me;
  showArchived?: boolean;
}

type SortKey = "title" | "project" | "subproject" | "status" | "deadline" | "time" | "priority" | "assignee" | "created";

export function ListView({ projectId, subprojectId, refreshKey, onEdit, me, showArchived = false }: Props) {
  const { t: tr } = useTranslation();  // aliased: `t` is used below for the task row
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [q, setQ] = useState("");
  // combinable filters
  const [fProject, setFProject] = useState(0);
  const [fSub, setFSub] = useState(0);
  const [fAssignee, setFAssignee] = useState(0);     // person id; -1 = unassigned; 0 = any
  const [fAssigneeGroup, setFAssigneeGroup] = useState(0); // group id; 0 = none (server-side filter)
  const [fStatus, setFStatus] = useState<string>("");
  const [fRecur, setFRecur] = useState<"" | "yes" | "no">("");
  const [fDeadline, setFDeadline] = useState<"" | "pending" | "overdue">("");
  const [fPriority, setFPriority] = useState(0); // 0 = any, 1..5
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const subs = useMemo(() => buildSubLookup(me.tree), [me.tree]);
  const users = useUsers();
  // Display uses the full list (a visible task may be assigned to someone outside
  // my scope); the assignee *filter* only offers people I share a sub-project with.
  const filterPeople = useMemo(() => peopleInMyScope(me, users), [me, users]);
  const statuses = useStatuses();
  const statusOrder = useMemo(() => Object.fromEntries(statuses.map((s, i) => [s.key, i])), [statuses]);

  // Tab scope (project/subproject) is applied server-side; everything else is client-side.
  useEffect(() => {
    const params = new URLSearchParams();
    if (subprojectId) params.set("subproject", String(subprojectId));
    else if (projectId) params.set("project", String(projectId));
    if (showArchived) params.set("archived", "1");
    // Group filter is server-side (needs membership expansion the client can't see).
    if (fAssigneeGroup) params.set("assignee_group", String(fAssigneeGroup));
    setTasks(null);
    api.get(`/api/tasks?${params}`).then(setTasks).catch(() => setTasks([]));
  }, [projectId, subprojectId, refreshKey, showArchived, fAssigneeGroup]);

  const assigneeNames = (t: Task) => t.assignees.map((id) => userName(users, id));

  // filter option lists
  const projectOpts = me.tree.projects;
  const subOpts = fProject
    ? (projectOpts.find((p) => p.id === fProject)?.subprojects ?? [])
    : projectOpts.flatMap((p) => p.subprojects);

  function sortVal(t: Task): string | number {
    const info = subs.get(t.subproject);
    switch (sortKey) {
      case "title": return t.title.toLowerCase();
      case "project": return (info?.projectName ?? "").toLowerCase();
      case "subproject": return (info?.name ?? "").toLowerCase();
      case "status": return statusOrder[t.status] ?? 99;
      case "deadline": return t.deadline ?? "9999-99-99";
      case "time": return t.start_time ?? "99:99"; // untimed sort last
      case "priority": return t.priority;
      case "assignee": return (assigneeNames(t)[0] ?? "~").toLowerCase();
      case "created": return t.created_at;
    }
  }
  function clickSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(key); setSortDir(1); }
  }
  function clearFilters() {
    setQ(""); setFProject(0); setFSub(0); setFAssignee(0); setFAssigneeGroup(0); setFStatus(""); setFRecur(""); setFDeadline(""); setFPriority(0);
  }
  const activeFilters = [q, fProject, fSub, fAssignee, fAssigneeGroup, fStatus, fRecur, fDeadline, fPriority].filter(Boolean).length;

  if (!tasks) return <Spinner />;

  const filters: TaskFilters = { q, fProject, fSub, fAssignee, fStatus, fPriority, fRecur, fDeadline };
  const filtered = tasks
    .filter((t) => matchesFilters(t, filters, subs))
    .sort((a, b) => {
      const va = sortVal(a), vb = sortVal(b);
      if (va < vb) return -1 * sortDir;
      if (va > vb) return 1 * sortDir;
      return 0;
    });

  // Summary-strip tallies, computed off the filtered set (matches the design).
  let overdueCount = 0, soonCount = 0;
  const byStatus: Record<string, number> = {};
  for (const t of filtered) {
    const ds = deadlineState(t.deadline, isComplete(t.status));
    if (ds === "overdue") overdueCount++;
    else if (ds === "soon") soonCount++;
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
  }

  const arrow = (key: SortKey) => (sortKey === key ? <span className="sort-arrow">{sortDir === 1 ? "▲" : "▼"}</span> : null);
  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th className="sortable" onClick={() => clickSort(k)}>{children}{arrow(k)}</th>
  );

  return (
    <div className="rise">
      <div className="filters">
        <label className={`search${q ? " has-text" : ""}`}>
          <Search />
          <input placeholder={tr("common.search")} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select value={fProject} onChange={(e) => { setFProject(Number(e.target.value)); setFSub(0); }}>
          <option value={0}>{tr("list.allProjects")}</option>
          {projectOpts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={fSub} onChange={(e) => setFSub(Number(e.target.value))}>
          <option value={0}>{tr("list.allSubprojects")}</option>
          {subOpts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select data-testid="filter-assignee"
          value={fAssigneeGroup ? `g:${fAssigneeGroup}` : fAssignee === -1 ? "unassigned" : fAssignee ? `u:${fAssignee}` : ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v.startsWith("g:")) { setFAssigneeGroup(Number(v.slice(2))); setFAssignee(0); }
            else { setFAssigneeGroup(0); setFAssignee(v === "unassigned" ? -1 : v.startsWith("u:") ? Number(v.slice(2)) : 0); }
          }}>
          <option value="">{tr("list.anyAssignee")}</option>
          <option value="unassigned">{tr("list.unassigned")}</option>
          <optgroup label={tr("list.people")}>
            {filterPeople.map((u) => <option key={u.id} value={`u:${u.id}`}>{u.name || u.email}</option>)}
          </optgroup>
          {me.groups.length > 0 && (
            <optgroup label={tr("list.groups")}>
              {me.groups.map((g) => <option key={g.id} value={`g:${g.id}`}>👥 {g.name}</option>)}
            </optgroup>
          )}
        </select>
        <select data-testid="filter-priority" value={fPriority} onChange={(e) => setFPriority(Number(e.target.value))}>
          <option value={0}>{tr("list.anyPriority")}</option>
          {[5, 4, 3, 2, 1].map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">{tr("list.anyStatus")}</option>
          {statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select value={fDeadline} onChange={(e) => setFDeadline(e.target.value as "" | "pending" | "overdue")}>
          <option value="">{tr("list.deadlineAny")}</option>
          <option value="pending">{tr("list.pendingUpcoming")}</option>
          <option value="overdue">{tr("list.overdue")}</option>
        </select>
        <select value={fRecur} onChange={(e) => setFRecur(e.target.value as "" | "yes" | "no")}>
          <option value="">{tr("list.recurringAny")}</option>
          <option value="yes">{tr("list.recurringOnly")}</option>
          <option value="no">{tr("list.oneOffOnly")}</option>
        </select>
        {activeFilters > 0 && <button className="btn-ghost" onClick={clearFilters}>Clear ({activeFilters})</button>}
        {showArchived && <span className="pill" style={{ background: "var(--surface-sunk)" }}>📖 Showing archive</span>}
      </div>

      <div className="summary" style={{ margin: "0 -18px 14px" }}>
        <div className="sm-item"><span className="sm-num">{filtered.length}</span><span className="sm-lab">{tr("summary.tasks", "Tasks")}</span></div>
        <div className="sm-item alert"><span className="sm-num">{overdueCount}</span><span className="sm-lab">{tr("summary.overdue", "Overdue")}</span></div>
        <div className="sm-item soon"><span className="sm-num">{soonCount}</span><span className="sm-lab">{tr("summary.dueSoon", "Due soon")}</span></div>
        <div className="sm-item" style={{ gap: 14 }}>
          {statuses.map((s) => (
            <span key={s.key} className="sm-stat" title={s.label}>
              <span className="dot" style={{ background: s.color }} />
              <span className="sm-num">{byStatus[s.key] ?? 0}</span>
              <span className="sm-lab">{s.label}</span>
            </span>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">{activeFilters ? tr("list.noMatch", "No tasks match these filters.") : tr("list.noneYet", "No tasks here yet.")}</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <Th k="title">{tr("list.colTask")}</Th>
              <Th k="project">{tr("list.colProject")}</Th>
              <Th k="subproject">{tr("list.colSubproject")}</Th>
              <th>{tr("list.colAssignees")}</th>
              <Th k="status">{tr("list.colStatus")}</Th>
              <Th k="deadline">{tr("list.colDeadline")}</Th>
              <th>{tr("list.colRecurs")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const info = subs.get(t.subproject);
              const ds = deadlineState(t.deadline, isComplete(t.status));
              const dcls = ds === "overdue" ? "od" : ds === "soon" ? "soon" : t.deadline ? "" : "none";
              const tm = timeRange(t.start_time, t.end_time);
              const rowCls = [ds === "overdue" ? "overdue" : ds === "soon" ? "due-soon" : "", isComplete(t.status) ? "done" : ""].filter(Boolean).join(" ");
              return (
                <tr key={t.id} data-testid="task-row" className={rowCls} onClick={() => onEdit(t)}>
                  <td className="c-task">
                    <div className="task-cell">
                      <span title={PRIORITY_META[t.priority].label} data-testid="task-priority"><PriorityIcon level={t.priority} /></span>
                      <span className="task-name">{t.title}</span>
                      {ds === "overdue" && <DueFlag kind="overdue" title={tr("list.missedDeadline")} />}
                      {ds === "soon" && <DueFlag kind="soon" title={tr("list.dueSoon")} />}
                      {Object.keys(t.subtask_counts ?? {}).length > 0 && (
                        <span data-testid="subtask-dots" style={{ marginLeft: 2 }}><SubtaskDots counts={t.subtask_counts} /></span>
                      )}
                    </div>
                  </td>
                  <td>{info && <span className="cell-proj"><span className="dot" style={{ background: info.projectColor }} /><span className="nm">{info.projectName}</span></span>}</td>
                  <td>{info && <span className="cell-proj"><span className="dot" style={{ background: info.color }} /><span className="nm">{info.name}</span></span>}</td>
                  <td><div className="who"><AvatarStack ids={t.assignees} users={users} /></div></td>
                  <td><StatusPill status={t.status} editable /></td>
                  <td>
                    {t.deadline ? (
                      <span className={`cell-date ${dcls}`}>{fmtDeadline(t.deadline)}{tm && <span className="tm">{tm}</span>}</span>
                    ) : <span className="cell-date none">—</span>}
                  </td>
                  <td>
                    {t.recurrence
                      ? <span className="recurs"><RefreshCw />{t.recurrence.freq}</span>
                      : <span className="recurs none">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
