import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { dfLocale } from "../dateLocale";
import { api } from "../api/client";
import { useStatuses, isComplete } from "../statuses";
import { buildSubLookup, deadlineState } from "../lookup";
import { useUsers } from "../users";
import { AvatarStack, PriorityIcon, Spinner, SubtaskBar } from "./common";
import type { Me, Task } from "../types";

interface Props {
  projectId?: number;
  subprojectId?: number;
  refreshKey: number;
  onEdit: (t: Task) => void;
  me: Me;
}

function fmtShort(d: string): string {
  const dt = new Date(`${d}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? d : format(dt, "MMM d", { locale: dfLocale() });
}

export function KanbanView({ projectId, subprojectId, refreshKey, onEdit, me }: Props) {
  const { t: tr } = useTranslation();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dropCol, setDropCol] = useState<string | null>(null);
  const statuses = useStatuses();
  const subs = buildSubLookup(me.tree);
  const users = useUsers();

  function load() {
    const p = new URLSearchParams();
    if (subprojectId) p.set("subproject", String(subprojectId));
    else if (projectId) p.set("project", String(projectId));
    setTasks(null);
    api.get(`/api/tasks?${p}`).then(setTasks).catch(() => setTasks([]));
  }
  useEffect(load, [projectId, subprojectId, refreshKey]);

  async function move(taskId: number, statusKey: string) {
    const prev = tasks;
    setTasks((ts) => (ts ?? []).map((t) => (t.id === taskId ? { ...t, status: statusKey } : t)));
    try {
      await api.post(`/api/tasks/${taskId}/status`, { status: statusKey });
    } catch {
      setTasks(prev ?? []); // revert (e.g. not your task → 403)
      alert(tr("kanban.moveErr"));
    }
  }

  if (!tasks) return <Spinner />;

  return (
    <div className="rise kanban">
      {statuses.map((st) => {
        const col = tasks.filter((t) => t.status === st.key);
        return (
          <div
            key={st.key}
            className="kan-col"
            onDragOver={(e) => { e.preventDefault(); setDropCol(st.key); }}
            onDragLeave={() => setDropCol((c) => (c === st.key ? null : c))}
            onDrop={() => { if (dragId != null) move(dragId, st.key); setDragId(null); setDropCol(null); }}
          >
            <div className="kan-head" style={{ "--kc": st.color } as React.CSSProperties}>
              <span className="lab"><span className="dot" style={{ background: st.color }} /> {st.label}</span>
              <span className="n mono">{col.length}</span>
            </div>
            <div className={`kan-body${dropCol === st.key ? " drop" : ""}`} data-status={st.key}>
              {col.length === 0 && <div className="kan-empty">—</div>}
              {col.map((t) => {
                const info = subs.get(t.subproject);
                const ds = deadlineState(t.deadline, isComplete(t.status));
                const cardCls = ds === "overdue" ? "overdue" : ds === "soon" ? "soon" : "";
                return (
                  <div
                    key={t.id}
                    className={`kan-card ${cardCls}${dragId === t.id ? " dragging" : ""}`}
                    draggable
                    onDragStart={() => setDragId(t.id)}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => onEdit(t)}
                  >
                    <div className="kt">
                      <PriorityIcon level={t.priority} />
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</span>
                      {ds === "overdue" && <span className="flag od" title={tr("list.missedDeadline")}>❗</span>}
                      {ds === "soon" && <span className="flag soon" title={tr("list.dueSoon")}>❗</span>}
                    </div>
                    <div className="meta">
                      <span className="left">
                        {info && <><span className="dot" style={{ background: info.color }} /><span className="nm">{info.name}</span></>}
                        {t.deadline && <span className={`cell-date ${ds === "overdue" ? "od" : ds === "soon" ? "soon" : ""}`} style={{ fontSize: 11 }}>{fmtShort(t.deadline)}</span>}
                      </span>
                      {t.assignees.length > 0 && <AvatarStack ids={t.assignees} users={users} />}
                    </div>
                    {Object.keys(t.subtask_counts ?? {}).length > 0 && <SubtaskBar counts={t.subtask_counts} />}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
