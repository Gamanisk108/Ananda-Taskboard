import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Search, RefreshCw, Archive, SlidersHorizontal } from "lucide-react";
import { dfLocale } from "../dateLocale";
import { api } from "../api/client";
import { buildSubLookup, deadlineState, timeRange } from "../lookup";
import { peopleInMyScope, useUsers, userName } from "../users";
import { useStatuses, isComplete } from "../statuses";
import { AvatarStack, StatusPill, Spinner, PriorityIcon, SubtaskDots, DueFlag, MultiSelect, SingleSelect, BottomSheet, ProjPill, useIsNarrow, type MultiSelectOption } from "./common";
import { matchesFilters, type TaskFilters } from "../listFilters";
import { PRIORITY_META, type Me, type Task } from "../types";

function fmtDeadline(d: string): string {
  const dt = new Date(`${d}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? d : format(dt, "MMM d", { locale: dfLocale() });
}

interface Props {
  projectId?: number;
  subprojectId?: number;
  onEdit: (t: Task) => void;
  me: Me;
  showArchived?: boolean;
}

type SortKey = "title" | "project" | "subproject" | "status" | "deadline" | "time" | "priority" | "assignee" | "created";

export function ListView({ projectId, subprojectId, onEdit, me, showArchived = false }: Props) {
  const { t: tr } = useTranslation();  // aliased: `t` is used below for the task row
  const [q, setQ] = useState("");
  // Combinable multi-select filters (empty array = no filter; OR within a list).
  const [fProjects, setFProjects] = useState<number[]>([]);
  const [fSubs, setFSubs] = useState<number[]>([]);
  // Assignee filter — server-side (needs group-membership expansion the client can't
  // see). Encoded values: "unassigned" | "u:<personId>" | "g:<groupId>".
  const [assigneeSel, setAssigneeSel] = useState<string[]>([]);
  const [fStatuses, setFStatuses] = useState<string[]>([]);
  const [fRecur, setFRecur] = useState<"" | "yes" | "no">("");
  const [fDeadline, setFDeadline] = useState<"" | "pending" | "overdue">("");
  const [fPriorities, setFPriorities] = useState<number[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const subs = useMemo(() => buildSubLookup(me.tree), [me.tree]);
  const users = useUsers();
  // Display uses the full list (a visible task may be assigned to someone outside
  // my scope); the assignee *filter* only offers people I share a sub-project with.
  const filterPeople = useMemo(() => peopleInMyScope(me, users), [me, users]);
  const statuses = useStatuses();
  const statusOrder = useMemo(() => Object.fromEntries(statuses.map((s, i) => [s.key, i])), [statuses]);

  // Tab scope + the assignee/group filter are applied server-side (group needs
  // membership expansion the client can't see); the rest is filtered client-side.
  const people = assigneeSel.filter((v) => v.startsWith("u:")).map((v) => v.slice(2));
  const groups = assigneeSel.filter((v) => v.startsWith("g:")).map((v) => v.slice(2));
  const unassigned = assigneeSel.includes("unassigned");
  const params = new URLSearchParams();
  if (subprojectId) params.set("subproject", String(subprojectId));
  else if (projectId) params.set("project", String(projectId));
  if (showArchived) params.set("archived", "1");
  if (people.length) params.set("member", people.join(","));         // OR across people
  if (groups.length) params.set("assignee_group", groups.join(","));  // OR across groups
  if (unassigned) params.set("unassigned", "1");
  const qs = params.toString();
  // bump()'s invalidate (key prefix ["tasks"]) refreshes this after any CRUD; the
  // query key also re-fetches when the tab scope / archive / assignee filter changes.
  const { data: tasks = null } = useQuery({
    queryKey: ["tasks", "list", me.active_org ?? null, projectId ?? null, subprojectId ?? null, showArchived, qs],
    queryFn: () => api.get(`/api/tasks?${qs}`) as Promise<Task[]>,
  });

  const assigneeNames = (t: Task) => t.assignees.map((id) => userName(users, id));

  // filter option lists (MultiSelect uses string values)
  const narrow = useIsNarrow();
  const [filtersOpen, setFiltersOpen] = useState(false);
  // DN4: Project/Sub-project filters are scope-dependent — Global Overview gets
  // both; a project tab gets only Sub-project (scoped to that project); a
  // sub-project tab gets neither. The component instance persists across tab
  // switches, so stale scope filters are cleared when the scope changes.
  const isGlobal = !projectId && !subprojectId;
  // Reset-on-scope-change via the React "adjust state during render" pattern
  // (not an effect): the instance persists across tab switches, so a stale
  // Global-Overview project filter would silently filter a project tab.
  const scope = `${projectId ?? ""}|${subprojectId ?? ""}`;
  const [prevScope, setPrevScope] = useState(scope);
  if (scope !== prevScope) {
    setPrevScope(scope);
    setFProjects([]);
    setFSubs([]);
  }
  const projectOpts = useMemo(
    () => (projectId ? me.tree.projects.filter((p) => p.id === projectId) : me.tree.projects),
    [me.tree.projects, projectId],
  );
  const subSource = fProjects.length
    ? projectOpts.filter((p) => fProjects.includes(p.id)).flatMap((p) => p.subprojects)
    : projectOpts.flatMap((p) => p.subprojects);
  const projectOptions: MultiSelectOption[] = projectOpts.map((p) => ({ value: String(p.id), label: p.name, color: p.color }));
  const subOptions: MultiSelectOption[] = subSource.map((s) => ({ value: String(s.id), label: s.name, color: s.color }));
  const statusOptions: MultiSelectOption[] = statuses.map((s) => ({ value: s.key, label: s.label, color: s.color }));
  const priorityOptions: MultiSelectOption[] = [5, 4, 3, 2, 1].map((p) => ({ value: String(p), label: PRIORITY_META[p].label }));
  const assigneeOptions: MultiSelectOption[] = [
    { value: "unassigned", label: tr("list.unassigned") },
    ...filterPeople.map((u) => ({ value: `u:${u.id}`, label: u.name || u.email, section: tr("list.people") })),
    ...me.groups.map((g) => ({ value: `g:${g.id}`, label: `👥 ${g.name}`, section: tr("list.groups") })),
  ];

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
    setQ(""); setFProjects([]); setFSubs([]); setAssigneeSel([]); setFStatuses([]); setFRecur(""); setFDeadline(""); setFPriorities([]);
  }
  const activeFilters = (q ? 1 : 0) + fProjects.length + fSubs.length + assigneeSel.length
    + fStatuses.length + fPriorities.length + (fRecur ? 1 : 0) + (fDeadline ? 1 : 0);

  if (!tasks) return <Spinner />;

  const filters: TaskFilters = { q, fProjects, fSubs, fStatuses, fPriorities, fRecur, fDeadline };
  const filtered = tasks
    .filter((t) => matchesFilters(t, filters, subs))
    .sort((a, b) => {
      const va = sortVal(a), vb = sortVal(b);
      if (va < vb) return -1 * sortDir;
      if (va > vb) return 1 * sortDir;
      return 0;
    });

  // D50: the member's own pending submissions render in place (gold, read-only)
  // but are NOT counted into the regular totals — they get their own gold chip.
  const pendingCount = filtered.filter((t) => t.approval_state === "pending").length;
  const live = filtered.filter((t) => t.approval_state !== "pending");

  // Summary-strip tallies, computed off the filtered set (matches the design).
  let overdueCount = 0, soonCount = 0;
  const byStatus: Record<string, number> = {};
  for (const t of live) {
    const ds = deadlineState(t.deadline, isComplete(t.status));
    if (ds === "overdue") overdueCount++;
    else if (ds === "soon") soonCount++;
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
  }

  const arrow = (key: SortKey) => (sortKey === key ? <span className="sort-arrow">{sortDir === 1 ? "▲" : "▼"}</span> : null);
  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th className="sortable" onClick={() => clickSort(k)}>{children}{arrow(k)}</th>
  );

  // The seven filter controls, shared by the desktop bar and the mobile sheet
  // (rendered bare inline on desktop, label-stacked inside the sheet on phones).
  const filterControls: { label: string; node: React.ReactNode }[] = [
    // DN4: Project filter only on Global Overview; Sub-project also on project tabs.
    ...(isGlobal ? [{ label: tr("list.colProject"), node: <MultiSelect placeholder={tr("list.allProjects")} options={projectOptions} selected={fProjects.map(String)} onChange={(v: string[]) => { setFProjects(v.map(Number)); setFSubs([]); }} /> }] : []),
    ...(!subprojectId ? [{ label: tr("list.colSubproject"), node: <MultiSelect placeholder={tr("list.allSubprojects")} options={subOptions} selected={fSubs.map(String)} onChange={(v: string[]) => setFSubs(v.map(Number))} /> }] : []),
    { label: tr("list.colAssignees"), node: <MultiSelect testId="filter-assignee" placeholder={tr("list.anyAssignee")} options={assigneeOptions} selected={assigneeSel} onChange={setAssigneeSel} /> },
    { label: tr("task.priority"), node: <MultiSelect testId="filter-priority" placeholder={tr("list.anyPriority")} options={priorityOptions} selected={fPriorities.map(String)} onChange={(v) => setFPriorities(v.map(Number))} /> },
    { label: tr("task.status"), node: <MultiSelect placeholder={tr("list.anyStatus")} options={statusOptions} selected={fStatuses} onChange={setFStatuses} /> },
    { label: tr("list.colDeadline"), node: <SingleSelect value={fDeadline} onChange={(v) => setFDeadline(v as "" | "pending" | "overdue")} options={[{ value: "", label: tr("list.deadlineAny") }, { value: "pending", label: tr("list.pendingUpcoming") }, { value: "overdue", label: tr("list.overdue") }]} /> },
    { label: tr("list.fRecurrence", "Recurrence"), node: <SingleSelect value={fRecur} onChange={(v) => setFRecur(v as "" | "yes" | "no")} options={[{ value: "", label: tr("list.recurringAny") }, { value: "yes", label: tr("list.recurringOnly") }, { value: "no", label: tr("list.oneOffOnly") }]} /> },
  ];
  // On phones the search box stays inline; everything else moves into the sheet,
  // so the trigger count excludes the search term.
  const sheetFilterCount = activeFilters - (q ? 1 : 0);

  return (
    <div className="rise">
      {narrow ? (
        <>
          <div className="filters-mobile">
            <label className={`search${q ? " has-text" : ""}`}>
              <Search />
              <input placeholder={tr("common.search")} value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <button type="button" className={`btn-filters${sheetFilterCount > 0 ? " on" : ""}`} data-testid="filters-button" onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal size={15} /> {tr("list.filters", "Filters")}
              {sheetFilterCount > 0 && <span className="fcount">{sheetFilterCount}</span>}
            </button>
          </div>
          {showArchived && <div style={{ marginBottom: 10 }}><span className="pill" style={{ background: "var(--surface-sunk)", display: "inline-flex", alignItems: "center", gap: 5 }}><Archive size={13} /> {tr("list.showingArchive", "Showing archive")}</span></div>}
          {filtersOpen && (
            <BottomSheet title={tr("list.filters", "Filters")} onClose={() => setFiltersOpen(false)}
              onReset={sheetFilterCount > 0 ? clearFilters : undefined}
              footer={<>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={clearFilters}>{tr("list.clear", "Clear")}</button>
                <button type="button" className="btn-primary" style={{ flex: 2 }} onClick={() => setFiltersOpen(false)}>{tr("list.showN", "Show {{n}} tasks", { n: filtered.length })}</button>
              </>}>
              {filterControls.map((c, i) => (
                <div className="sheet-field" key={i}>
                  <label>{c.label}</label>
                  {c.node}
                </div>
              ))}
            </BottomSheet>
          )}
        </>
      ) : (
        <div className="filters">
          <label className={`search${q ? " has-text" : ""}`}>
            <Search />
            <input placeholder={tr("common.search")} value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          {filterControls.map((c, i) => <Fragment key={i}>{c.node}</Fragment>)}
          {activeFilters > 0 && <button className="btn-ghost" onClick={clearFilters}>{tr("list.clear", "Clear")} ({activeFilters})</button>}
          {showArchived && <span className="pill" style={{ background: "var(--surface-sunk)", display: "inline-flex", alignItems: "center", gap: 5 }}><Archive size={13} /> {tr("list.showingArchive", "Showing archive")}</span>}
        </div>
      )}

      <div className="summary" style={{ margin: "0 -18px 14px" }}>
        <div className="sm-item"><span className="sm-num">{live.length}</span><span className="sm-lab">{tr("summary.tasks", "Tasks")}</span></div>
        <div className="sm-item alert"><span className="sm-num">{overdueCount}</span><span className="sm-lab">{tr("summary.overdue", "Overdue")}</span></div>
        <div className="sm-item soon"><span className="sm-num">{soonCount}</span><span className="sm-lab">{tr("summary.dueSoon", "Due soon")}</span></div>
        {/* D50: gold pending chip — hidden at 0; pending is NOT in the totals. */}
        {pendingCount > 0 && (
          <div className="sm-item pending"><span className="sm-num">{pendingCount}</span><span className="sm-lab">{tr("summary.pending", "Pending approval")}</span></div>
        )}
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
      ) : narrow ? (
        /* Mobile: task cards (.tcard) instead of the dense side-scrolling table. */
        <div className="tcards">
          {filtered.map((t) => {
            const info = subs.get(t.subproject);
            const ds = deadlineState(t.deadline, isComplete(t.status));
            const dcls = ds === "overdue" ? "od" : ds === "soon" ? "soon" : "";
            const pending = t.approval_state === "pending";
            const cardCls = [pending ? "pending" : ds === "overdue" ? "overdue" : ds === "soon" ? "due-soon" : "", isComplete(t.status) ? "done" : ""].filter(Boolean).join(" ");
            return (
              <button key={t.id} data-testid="task-row" className={`tcard ${cardCls}`} onClick={() => onEdit(t)}>
                <div className="tcard-top">
                  <span title={PRIORITY_META[t.priority].label}><PriorityIcon level={t.priority} /></span>
                  <span className="tcard-title">{t.title}</span>
                  {ds === "overdue" && <DueFlag kind="overdue" title={tr("list.missedDeadline")} />}
                  {ds === "soon" && <DueFlag kind="soon" title={tr("list.dueSoon")} />}
                  {Object.keys(t.subtask_counts ?? {}).length > 0 && <SubtaskDots counts={t.subtask_counts} />}
                </div>
                <div className="tcard-meta">
                  {info && <ProjPill name={info.projectName} color={info.projectColor} />}
                  {info && <ProjPill name={info.name} color={info.color} />}
                  {/* D50: a pending submission shows the gold pill in the status slot — not a status, not interactive. */}
                  {pending ? <span className="pill pill-pending">{tr("task.pendingApproval")}</span> : <StatusPill status={t.status} editable />}
                  {t.deadline && <span className={`cell-date ${dcls}`}>{fmtDeadline(t.deadline)}</span>}
                  {t.assignees.length > 0 && <AvatarStack ids={t.assignees} users={users} />}
                </div>
              </button>
            );
          })}
        </div>
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
              const pending = t.approval_state === "pending";
              const rowCls = [pending ? "pending" : ds === "overdue" ? "overdue" : ds === "soon" ? "due-soon" : "", isComplete(t.status) ? "done" : ""].filter(Boolean).join(" ");
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
                  <td>{info && <ProjPill name={info.projectName} color={info.projectColor} />}</td>
                  <td>{info && <ProjPill name={info.name} color={info.color} />}</td>
                  <td><div className="who"><AvatarStack ids={t.assignees} users={users} /></div></td>
                  <td>{pending ? <span className="pill pill-pending">{tr("task.pendingApproval")}</span> : <StatusPill status={t.status} editable />}</td>
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
