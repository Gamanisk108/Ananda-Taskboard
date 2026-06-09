import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { api } from "../api/client";
import { useStatuses } from "../statuses";
import { avatarColor, userInitials, useUsers } from "../users";
import { PriorityIcon, StatusPillSelect, SubtaskDots, SubtaskBar } from "./common";
import { PRIORITY_META, type Subtask } from "../types";

/** A task's subtasks rendered as mini-tasks (design D11): the header carries
 *  status-count dots + a done/total progress bar; each row shows priority ·
 *  title · an aligned avatar column · a status pill+popover · delete, and opens
 *  the full subtask detail (SubtaskDetail) on click. Quick-add stays inline.
 *  Calls onChanged so the parent's status dots refresh. */
export function SubtaskEditor({
  taskId, onOpen, onChanged,
}: { taskId: number; onOpen: (s: Subtask, index: number) => void; onChanged?: () => void }) {
  const { t } = useTranslation();
  const [subs, setSubs] = useState<Subtask[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const statuses = useStatuses();
  const users = useUsers();

  function load() {
    api.get(`/api/subtasks?task=${taskId}`).then(setSubs).catch(() => setSubs([]));
  }
  useEffect(load, [taskId]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of subs) c[s.status] = (c[s.status] ?? 0) + 1;
    return c;
  }, [subs]);

  async function add() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await api.post("/api/subtasks", { task: taskId, title: title.trim() });
      setTitle("");
      load();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: number, status: string) {
    setSubs((cur) => cur.map((s) => (s.id === id ? { ...s, status } : s)));
    await api.patch(`/api/subtasks/${id}`, { status });
    onChanged?.();
  }

  async function remove(id: number) {
    await api.del(`/api/subtasks/${id}`);
    load();
    onChanged?.();
  }

  return (
    <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 14 }}>
      <div className="sub-head">
        <h3 className="section-title" style={{ margin: 0 }}>{t("task.subtasks")} ({subs.length})</h3>
        {subs.length > 0 && <span className="sub-counts"><SubtaskDots counts={counts} /></span>}
        {subs.length > 0 && <span className="sub-prog"><SubtaskBar counts={counts} /></span>}
      </div>

      <div className="st-rows">
        {subs.map((s, i) => {
          const avs = (s.assignees ?? []).slice(0, 3);
          const extra = (s.assignees ?? []).length - avs.length;
          return (
            <div key={s.id} data-testid="subtask-row" className="st-row" role="button" tabIndex={0}
              onClick={() => onOpen(s, i + 1)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(s, i + 1); } }}
              title={t("subtask.editDetails")}>
              <span className="st-prio" title={PRIORITY_META[s.priority].label}><PriorityIcon level={s.priority} /></span>
              <span className="st-open"><span className="st-title">{s.title}</span></span>
              <span className="st-avs">
                {avs.map((id) => (
                  <span key={id} className="av" style={{ background: avatarColor(id) }} title={userInitials(users, id)}>
                    {userInitials(users, id)}
                  </span>
                ))}
                {extra > 0 && <span className="more">+{extra}</span>}
                {(s.assignee_groups ?? []).length > 0 && <span className="grp" title={t("ap.assignGroup")}>◇</span>}
              </span>
              <span className="st-stat">
                <StatusPillSelect testId="subtask-status" value={s.status} statuses={statuses} onChange={(k) => setStatus(s.id, k)} />
              </span>
              <button type="button" className="st-del" title={t("common.delete", "Delete")}
                onClick={(e) => { e.stopPropagation(); remove(s.id); }}><Trash2 size={15} /></button>
            </div>
          );
        })}
      </div>

      <div className="st-add">
        <input data-testid="subtask-add-input" placeholder={t("task.addSubtask")} value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" className="btn-secondary" data-testid="subtask-add-button" disabled={busy} onClick={add}>{t("common.add")}</button>
      </div>
    </div>
  );
}
