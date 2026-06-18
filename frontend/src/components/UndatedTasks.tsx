import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarOff } from "lucide-react";
import { Modal, AvatarStack, StatusPill, PriorityIcon, ProjPill, MultiSelect, DueFlag, SearchInput, type MultiSelectOption } from "./common";
import { useStatuses } from "../statuses";
import { useUsers, userName } from "../users";
import type { CalendarInstance } from "../types";

type SortKey = "title" | "project" | "subproject" | "status";

/** The Unscheduled-tasks modal body, rendered as the standard List table (design
 *  D7/D13): Task · Project · Sub-project · Assignees · Status, with a search +
 *  Assignee / Project / Status filter bar. No deadline/recurrence columns, no
 *  "All day", no time sort — unscheduled tasks have no dates at all. */
function UnscheduledTable({ items, onOpen }: { items: CalendarInstance[]; onOpen: (taskId: number) => void }) {
  const { t } = useTranslation();
  const users = useUsers();
  const statuses = useStatuses();
  const [q, setQ] = useState("");
  const [fProjects, setFProjects] = useState<string[]>([]);
  const [fAssignees, setFAssignees] = useState<string[]>([]);
  const [fStatuses, setFStatuses] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const statusOrder = useMemo(() => Object.fromEntries(statuses.map((s, i) => [s.key, i])), [statuses]);

  // Filter options are derived from the tasks actually in the list.
  const projectOptions = useMemo<MultiSelectOption[]>(() => {
    const m = new Map<number, MultiSelectOption>();
    for (const i of items) if (!m.has(i.project_id)) m.set(i.project_id, { value: String(i.project_id), label: i.project_name, color: i.project_color });
    return [...m.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [items]);
  const assigneeOptions = useMemo<MultiSelectOption[]>(() => {
    const ids = new Set<number>();
    for (const i of items) for (const id of i.assignee_ids) ids.add(id);
    return [...ids].map((id) => ({ value: String(id), label: userName(users, id) })).sort((a, b) => a.label.localeCompare(b.label));
  }, [items, users]);
  const statusOptions = useMemo<MultiSelectOption[]>(
    () => statuses.map((s) => ({ value: s.key, label: s.label, color: s.color })), [statuses]);

  function clickSort(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(k); setSortDir(1); }
  }
  function clearFilters() { setQ(""); setFProjects([]); setFAssignees([]); setFStatuses([]); }
  const activeFilters = (q ? 1 : 0) + fProjects.length + fAssignees.length + fStatuses.length;

  const sortVal = (i: CalendarInstance) =>
    sortKey === "title" ? i.title.toLowerCase()
    : sortKey === "project" ? i.project_name.toLowerCase()
    : sortKey === "subproject" ? i.subproject_name.toLowerCase()
    : (statusOrder[i.status] ?? 99);

  const filtered = items
    .filter((i) => {
      if (q && !i.title.toLowerCase().includes(q.toLowerCase())) return false;
      if (fProjects.length && !fProjects.includes(String(i.project_id))) return false;
      if (fStatuses.length && !fStatuses.includes(i.status)) return false;
      if (fAssignees.length && !i.assignee_ids.some((id) => fAssignees.includes(String(id)))) return false;
      return true;
    })
    .sort((a, b) => {
      const va = sortVal(a), vb = sortVal(b);
      if (va < vb) return -1 * sortDir;
      if (va > vb) return 1 * sortDir;
      return 0;
    });

  const arrow = (k: SortKey) => (sortKey === k ? <span className="sort-arrow">{sortDir === 1 ? "▲" : "▼"}</span> : null);
  // Render helper (not a component) so sort headers don't remount each render.
  const th = (k: SortKey, label: string) => (
    <th key={k} className="sortable" onClick={() => clickSort(k)}>{label}{arrow(k)}</th>
  );

  return (
    <div>
      <div className="filters">
        <SearchInput value={q} onChange={setQ} />
        <MultiSelect placeholder={t("list.anyAssignee")} options={assigneeOptions} selected={fAssignees} onChange={setFAssignees} />
        <MultiSelect placeholder={t("list.allProjects")} options={projectOptions} selected={fProjects} onChange={setFProjects} />
        <MultiSelect placeholder={t("list.anyStatus")} options={statusOptions} selected={fStatuses} onChange={setFStatuses} />
        {activeFilters > 0 && <button className="btn-ghost" onClick={clearFilters}>{t("list.clear", "Clear")} ({activeFilters})</button>}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">{t("day.noTasks")}</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              {th("title", t("list.colTask"))}
              {th("project", t("list.colProject"))}
              {th("subproject", t("list.colSubproject"))}
              <th>{t("list.colAssignees")}</th>
              {th("status", t("list.colStatus"))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => (
              <tr key={i.task_id} data-testid="undated-row" className={i.overdue ? "overdue" : ""} onClick={() => onOpen(i.task_id)}>
                <td className="c-task">
                  <div className="task-cell">
                    <span title={t("task.priority")}><PriorityIcon level={i.priority} /></span>
                    <span className="task-name">{i.title}</span>
                    {i.overdue && <DueFlag kind="overdue" title={t("list.missedDeadline")} />}
                  </div>
                </td>
                <td><ProjPill name={i.project_name} color={i.project_color} /></td>
                <td><ProjPill name={i.subproject_name} color={i.subproject_color} /></td>
                <td><div className="who"><AvatarStack ids={i.assignee_ids} users={users} /></div></td>
                <td><StatusPill status={i.status} editable /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** An "Unscheduled Tasks (N)" button for the month/week views that opens a modal
 *  listing tasks with no start date and no deadline (they never land on a
 *  calendar day). Hidden entirely when there are none. */
export function UndatedTasks({
  undated, onOpen,
}: {
  undated: CalendarInstance[];
  colorByProject?: boolean;
  onOpen: (taskId: number) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (!undated.length) return null;

  return (
    <>
      {/* D6: emphasized "Unscheduled Tasks (N)" button — blue outline + tinted
          fill + navy count pill; line-art CalendarOff; hidden at 0 (above). */}
      <button type="button" className="btn-unscheduled" style={{ marginLeft: "auto" }}
        data-testid="undated-button" onClick={() => setOpen(true)}>
        <CalendarOff size={14} /> {t("cal.noDate", "Unscheduled Tasks")}
        <span className="us-count">{undated.length}</span>
      </button>
      {open && (
        <Modal fullScreenOnNarrow wide icon={<CalendarOff />} title={t("cal.noDateTitle", "Unscheduled tasks ({{count}})", { count: undated.length })} onClose={() => setOpen(false)}>
          <UnscheduledTable items={undated} onOpen={(id) => { setOpen(false); onOpen(id); }} />
        </Modal>
      )}
    </>
  );
}
