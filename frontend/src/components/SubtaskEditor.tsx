import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, Sparkles, X } from "lucide-react";
import { api, ApiError } from "../api/client";
import { useStatuses } from "../statuses";
import { avatarColor, userInitials, useUsers } from "../users";
import { PriorityIcon, StatusPillSelect, SubtaskDots, SubtaskBar } from "./common";
import { PRIORITY_META, type Subtask } from "../types";
import { generateTasks } from "../ai";

/** A task's subtasks rendered as mini-tasks (design D11): the header carries
 *  status-count dots + a done/total progress bar; each row shows priority ·
 *  title · an aligned avatar column · a status pill+popover · delete, and opens
 *  the full subtask detail (SubtaskDetail) on click. Quick-add stays inline.
 *  An "AI" panel turns a pasted breakdown into subtasks for THIS task.
 *  Calls onChanged so the parent's status dots refresh. */
export function SubtaskEditor({
  taskId, taskTitle, onOpen, onChanged,
}: { taskId: number; taskTitle?: string; onOpen: (s: Subtask, index: number) => void; onChanged?: () => void }) {
  const { t } = useTranslation();
  const [subs, setSubs] = useState<Subtask[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const statuses = useStatuses();
  const users = useUsers();

  // ── AI subtasks panel ──────────────────────────────────────────────────────
  // Paste a breakdown (or describe the work) → Claude proposes subtask titles for
  // THIS task → review the checklist → add the ticked ones. No new task is created.
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState("");
  const [aiRemaining, setAiRemaining] = useState<number | null>(null);
  const [proposed, setProposed] = useState<{ title: string; checked: boolean }[] | null>(null);

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

  async function aiGenerate() {
    if (aiBusy) return;
    setAiBusy(true); setAiErr(""); setProposed(null);
    try {
      const res = await generateTasks(aiPrompt, [], taskId);
      setAiRemaining(res.remaining);
      // Focused breakdown → the server attaches everything to this task; collect
      // every proposed subtask (plus any titled-but-stepless row as a single step).
      const steps: string[] = [];
      for (const tk of res.tasks) {
        if (tk.subtasks?.length) steps.push(...tk.subtasks);
        else if (tk.title?.trim()) steps.push(tk.title.trim());
      }
      const seen = new Set<string>();
      const unique = steps.filter((s) => s.trim() && !seen.has(s) && seen.add(s));
      if (unique.length === 0) { setAiErr(t("ai.noSteps", "No subtasks came back — try describing the steps.")); return; }
      setProposed(unique.map((s) => ({ title: s, checked: true })));
    } catch (e) {
      const detail = e instanceof ApiError ? (e.data as { detail?: string })?.detail : "";
      setAiErr(detail || t("ai.genError", "Couldn't generate subtasks. Try again."));
    } finally {
      setAiBusy(false);
    }
  }

  async function addProposed() {
    if (!proposed) return;
    const picks = proposed.filter((p) => p.checked && p.title.trim());
    if (picks.length === 0) return;
    setAiBusy(true);
    try {
      for (const p of picks) {
        await api.post("/api/subtasks", { task: taskId, title: p.title.trim() }).catch(() => {});
      }
      load();
      onChanged?.();
      closeAi();
    } finally {
      setAiBusy(false);
    }
  }

  function closeAi() {
    setAiOpen(false); setAiPrompt(""); setProposed(null); setAiErr("");
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
        {!aiOpen && (
          <button type="button" className="btn-ghost" data-testid="subtask-ai-button"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            onClick={() => setAiOpen(true)} title={t("ai.subtasksWithAi", "Suggest subtasks with AI")}>
            <Sparkles size={15} /> {t("ai.button", "AI")}
          </button>
        )}
      </div>

      {aiOpen && (
        <div className="card" data-testid="subtask-ai-panel" style={{ padding: 10, marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={15} aria-hidden />
            <strong style={{ fontSize: 13 }}>
              {taskTitle
                ? t("ai.subtasksForNamed", "Suggest subtasks for “{{name}}”", { name: taskTitle })
                : t("ai.subtasksWithAi", "Suggest subtasks with AI")}
            </strong>
            <button type="button" className="btn-ghost icon-only" style={{ marginLeft: "auto" }}
              aria-label={t("common.close", "Close")} onClick={closeAi}><X size={15} /></button>
          </div>

          {!proposed && (
            <>
              <textarea rows={4} value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} disabled={aiBusy}
                placeholder={t("ai.subtasksPh", "Paste a breakdown, or describe the steps to complete this task…")}
                style={{ fontSize: 13 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button type="button" className="btn-primary" disabled={aiBusy || !aiPrompt.trim()} onClick={aiGenerate}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Sparkles size={14} />
                  {aiBusy ? t("ai.generating", "Generating…") : t("ai.generate", "Generate")}
                </button>
                <span className="hint" style={{ fontSize: 11.5 }}>{t("ai.subtasksPrivacy", "Your text is sent to our AI provider.")}</span>
              </div>
            </>
          )}

          {proposed && (
            <>
              <div className="muted" style={{ fontSize: 12 }}>{t("ai.subtasksReview", "Tick the ones to add, edit any wording, then add them.")}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {proposed.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="checkbox" style={{ width: "auto" }} checked={p.checked}
                      onChange={(e) => setProposed((cur) => cur!.map((x, j) => (j === i ? { ...x, checked: e.target.checked } : x)))} />
                    <input value={p.title} aria-label={t("ai.subtaskN", "Subtask {{n}}", { n: i + 1 })}
                      onChange={(e) => setProposed((cur) => cur!.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                      style={{ flex: 1, minWidth: 0, fontSize: 13 }} />
                    <button type="button" className="btn-ghost icon-only" aria-label={t("common.remove", "Remove")}
                      onClick={() => setProposed((cur) => cur!.filter((_, j) => j !== i))}><X size={14} /></button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button type="button" className="btn-primary" disabled={aiBusy || !proposed.some((p) => p.checked && p.title.trim())} onClick={addProposed}>
                  {t("ai.addSubtasksN", "Add {{n}} subtask(s)", { n: proposed.filter((p) => p.checked && p.title.trim()).length })}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setProposed(null)}>{t("ai.back", "Back")}</button>
                {aiRemaining != null && <span className="hint" style={{ fontSize: 11.5, marginLeft: "auto" }}>{t("ai.remaining", "{{n}} AI generations left today", { n: aiRemaining })}</span>}
              </div>
            </>
          )}

          {aiErr && <div style={{ color: "var(--danger)", fontSize: 12.5 }}>{aiErr}</div>}
        </div>
      )}
    </div>
  );
}
