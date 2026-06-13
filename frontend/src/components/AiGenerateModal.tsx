// AI task generation modal: prompt + files → Claude proposes tasks → review
// (each row uses the SAME field components/order as the rest of the app:
// Priority · Task Name · Project · Sub-Project · Assignee · Status) → save creates
// real tasks via the normal /api/tasks path and attaches the AI-suggested source
// file to each. Post-save the created tasks stay listed, each opening TaskModal.

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Download, X, Trash2, FileText, Repeat } from "lucide-react";
import { api, ApiError } from "../api/client";
import { uploadAttachment, fmtSize } from "../attachments";
import { writableProjects } from "../lookup";
import { useUsers } from "../users";
import { useAdminGroups } from "../groups";
import { useStatuses } from "../statuses";
import { generateTasks, type ProposedTask } from "../ai";
import { PRIORITY_META, type Me, type Task, type Recurrence } from "../types";
import { Modal, SingleSelect, StatusPillSelect, PriorityIcon, Spinner } from "./common";
import { AssigneePicker } from "./AssigneePicker";
import { useConfirm } from "./confirm";

type Step = "input" | "review" | "saving" | "done";

interface Row {
  key: number;
  title: string;
  priority: number;
  projectId: number;     // 0 = none chosen
  subprojectId: number;  // 0 = none chosen
  assignees: number[];
  assigneeGroups: number[];
  status: string;
  sourceFileIndex: number | null;
  attach: boolean;
  newProject: string | null;
  subtasks: string[];
  recurrence: Recurrence | null;
  startDate: string | null;
  deadline: string | null;
}

const WD_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function recurLabel(r: Recurrence): string {
  const parts: string[] = [r.freq];
  if (r.freq === "weekly" && r.weekdays?.length) parts.push(r.weekdays.map((d) => WD_SHORT[d] ?? d).join(", "));
  if (r.count) parts.push(`×${r.count}`);
  else if (r.end_date) parts.push(`until ${r.end_date}`);
  return parts.join(" · ");
}

const ACCEPT = ".pdf,.txt,.md,.docx,image/png,image/jpeg,image/webp,image/gif";

export function AiGenerateModal({ me, onClose, onChanged, onOpenTask }: {
  me: Me;
  onClose: () => void;
  onChanged?: () => void;
  onOpenTask: (task: Task) => void;
}) {
  const { t } = useTranslation();
  const projects = useMemo(() => writableProjects(me), [me]);
  const users = useUsers();
  const groups = useAdminGroups(me);
  const statuses = useStatuses();

  const [step, setStep] = useState<Step>("input");
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [created, setCreated] = useState<Task[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const submitting = useRef(false);
  const confirm = useConfirm();

  // Drag-anywhere file intake + thumbnails for visual confirmation.
  const isImg = (f: File) => /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif)$/i.test(f.name);
  const addFiles = (list: FileList | File[] | null) => { if (list) setFiles((f) => [...f, ...Array.from(list)]); };
  const thumbs = useMemo(() => files.map((f) => (isImg(f) ? URL.createObjectURL(f) : null)), [files]);
  useEffect(() => () => thumbs.forEach((u) => u && URL.revokeObjectURL(u)), [thumbs]);

  // Guard against losing typed/uploaded work to a stray backdrop-click or Escape.
  const dirty = step !== "done" && (!!prompt.trim() || files.length > 0 || rows.length > 0);
  async function guardedClose() {
    if (submitting.current) return;   // never close mid-save
    if (dirty && !(await confirm({
      body: t("ai.confirmDiscard", "Discard this AI draft? Your prompt, files, and any unsaved tasks here will be lost."),
      danger: true, confirmLabel: t("ai.discard", "Discard"),
    }))) return;
    onClose();
  }

  const subsFor = (pid: number) => projects.find((p) => p.id === pid)?.subprojects ?? [];

  function toRow(tk: ProposedTask, i: number): Row {
    const pid = projects.some((p) => p.id === tk.project_id) ? tk.project_id! : 0;
    const subs = subsFor(pid);
    const sid = subs.some((s) => s.id === tk.subproject_id) ? tk.subproject_id! : (subs[0]?.id ?? 0);
    return {
      key: i, title: tk.title, priority: tk.priority || 3,
      projectId: pid, subprojectId: sid,
      assignees: tk.assignee_ids ?? [], assigneeGroups: [],
      status: "todo", sourceFileIndex: tk.source_file_index,
      attach: tk.source_file_index != null, newProject: tk.new_project,
      subtasks: tk.subtasks ?? [], recurrence: tk.recurrence ?? null,
      startDate: tk.start_date ?? null, deadline: tk.deadline ?? null,
    };
  }

  async function runGenerate() {
    if (submitting.current) return;
    if (!prompt.trim() && files.length === 0) { setErr(t("ai.needInput", "Add a prompt or a file.")); return; }
    submitting.current = true; setBusy(true); setErr("");
    try {
      const res = await generateTasks(prompt, files);
      setRemaining(res.remaining); setTruncated(res.truncated);
      setRows(res.tasks.map(toRow));
      if (res.tasks.length === 0) setErr(t("ai.noTasks", "No tasks came back — try a clearer prompt."));
      else setStep("review");
    } catch (e) {
      const detail = e instanceof ApiError ? (e.data as { detail?: string })?.detail : "";
      setErr(detail || t("ai.genError", "Couldn't generate tasks. Try again."));
    } finally { submitting.current = false; setBusy(false); }
  }

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  function pickProject(key: number, pid: number) {
    update(key, { projectId: pid, subprojectId: subsFor(pid)[0]?.id ?? 0 });
  }
  const dropRow = (key: number) => setRows((rs) => rs.filter((r) => r.key !== key));
  const setSub = (key: number, i: number, v: string) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, subtasks: r.subtasks.map((s, j) => (j === i ? v : s)) } : r)));
  const addSub = (key: number) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, subtasks: [...r.subtasks, ""] } : r)));
  const removeSub = (key: number, i: number) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, subtasks: r.subtasks.filter((_, j) => j !== i) } : r)));

  const canSave = rows.length > 0 && rows.every((r) => r.title.trim() && r.subprojectId);

  async function save() {
    if (submitting.current || !canSave) return;
    submitting.current = true; setStep("saving"); setErr("");
    // Save all rows in PARALLEL (was sequential → slow for many tasks). Each row's
    // own failure is isolated; succeeded rows are dropped so a retry can't duplicate.
    const settled = await Promise.all(rows.map(async (r) => {
      try {
        const task = await api.post("/api/tasks", {
          subproject: r.subprojectId, title: r.title.trim(), priority: r.priority,
          assignees: r.assignees, assignee_groups: r.assigneeGroups, status: r.status,
          recurrence: r.recurrence, timeline_start: r.startDate, deadline: r.deadline,
        }) as Task;
        await Promise.all(r.subtasks.map((st) =>
          st.trim() ? api.post("/api/subtasks", { task: task.id, title: st.trim() }).catch(() => {}) : null));
        if (r.attach && r.sourceFileIndex != null && files[r.sourceFileIndex]) {
          try { await uploadAttachment("task", task.id, files[r.sourceFileIndex]); } catch { /* keep the task even if its attachment fails */ }
        }
        return { ok: true as const, task, key: r.key };
      } catch {
        return { ok: false as const, key: r.key };
      }
    }));
    const out: Task[] = settled.filter((x) => x.ok).map((x) => (x as { task: Task }).task);
    const failed = new Set(settled.filter((x) => !x.ok).map((x) => x.key));
    submitting.current = false;
    if (out.length) { setCreated((c) => [...c, ...out]); onChanged?.(); }
    if (failed.size) {
      setRows((rs) => rs.filter((r) => failed.has(r.key)));   // keep only the failures
      setErr(t("ai.saveError", "Some tasks couldn't be saved — retry the ones still listed."));
      setStep("review");
    } else {
      setStep("done");
    }
  }

  const PRIO_OPTS = [5, 4, 3, 2, 1].map((p) => ({ value: String(p), label: PRIORITY_META[p].label, icon: <PriorityIcon level={p} size={16} /> }));

  // ── Footer per step ──────────────────────────────────────────────────────
  const footer =
    step === "input" ? (
      <div className="set-actions">
        <button type="button" className="btn-primary" disabled={busy} onClick={runGenerate}>
          <Sparkles size={15} /> {busy ? t("ai.generating", "Generating…") : t("ai.generate", "Generate tasks")}
        </button>
        <button type="button" className="btn-secondary" style={{ marginLeft: "auto" }} onClick={guardedClose}>{t("common.cancel")}</button>
      </div>
    ) : step === "review" ? (
      <div className="set-actions">
        <button type="button" className="btn-primary" disabled={!canSave} onClick={save}>{t("ai.save", "Save tasks")}</button>
        <button type="button" className="btn-ghost" onClick={() => setStep("input")}>{t("ai.back", "Back")}</button>
        <button type="button" className="btn-secondary" style={{ marginLeft: "auto" }} onClick={guardedClose}>{t("common.cancel")}</button>
      </div>
    ) : step === "done" ? (
      <div className="set-actions">
        <button type="button" className="btn-ghost" onClick={() => { setRows([]); setCreated([]); setPrompt(""); setFiles([]); setStep("input"); }}>{t("ai.generateMore", "Generate more")}</button>
        <button type="button" className="btn-primary" style={{ marginLeft: "auto" }} onClick={onClose}>{t("common.done", "Done")}</button>
      </div>
    ) : undefined;

  return (
    <Modal fullScreenOnNarrow wide icon={<Sparkles />} title={t("ai.title", "Generate tasks with AI")} onClose={guardedClose} footer={footer}>
      {step === "input" && busy && (
        <div style={{ padding: 28, textAlign: "center" }}>
          <Spinner />
          <div className="muted" style={{ marginTop: 10 }}>{t("ai.generatingBody", "Reading your input and drafting tasks…")}</div>
        </div>
      )}
      {step === "input" && !busy && (
        // Drop anywhere in the body: the whole input step is the drop target.
        <div
          className={`ai-input${dragOver ? " dragover" : ""}`}
          onDragOver={(e) => { e.preventDefault(); if (!dragOver) setDragOver(true); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
        >
          <div className="field">
            <label>{t("ai.promptLabel", "What needs doing?")}</label>
            <textarea rows={5} value={prompt} onChange={(e) => setPrompt(e.target.value)}
              placeholder={t("ai.promptPh", "Describe the work, or upload notes/documents to turn into tasks…")} />
          </div>

          <label className="ai-dropzone">
            <Download size={20} />
            <span className="ai-dz-text">
              {t("ai.dropPrompt", "Drag files anywhere here, or ")}<span className="ai-dz-browse">{t("ai.browse", "browse")}</span>
            </span>
            <span className="ai-dz-hint">{t("ai.dzHint", "PDF, Word, text, or images")}</span>
            <input type="file" multiple accept={ACCEPT} style={{ display: "none" }}
              onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }} />
          </label>

          {files.length > 0 && (
            <div className="ai-thumbs">
              {files.map((f, i) => (
                <div key={i} className="ai-thumb" title={f.name}>
                  {thumbs[i]
                    ? <img src={thumbs[i] as string} alt={f.name} />
                    : <span className="ai-thumb-icon"><FileText size={22} /></span>}
                  <div className="ai-thumb-meta">
                    <span className="ai-thumb-name">{f.name}</span>
                    <span className="ai-thumb-size">{fmtSize(f.size)}</span>
                  </div>
                  <button type="button" className="ai-thumb-x" aria-label={t("common.remove", "Remove")}
                    onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}><X size={13} /></button>
                </div>
              ))}
            </div>
          )}

          {dragOver && <div className="ai-drop-overlay"><Download size={22} /> {t("ai.dropNow", "Drop to add")}</div>}
          <div className="hint" style={{ fontSize: 12.5, marginTop: 12 }}>{t("ai.privacyNotice", "Your text and files are sent to our AI provider to generate tasks. Don't upload anything you wouldn't want processed externally.")}</div>
          {err && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{err}</div>}
        </div>
      )}

      {step === "saving" && <div style={{ padding: 24, textAlign: "center" }}><Spinner /><div className="muted" style={{ marginTop: 8 }}>{t("ai.saving", "Saving tasks…")}</div></div>}

      {step === "review" && (
        <>
          <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
            {t("ai.reviewHint", "Review and adjust, then save. Each becomes a real task.")}
            {remaining != null && ` · ${t("ai.remaining", "{{n}} AI generations left today", { n: remaining })}`}
          </div>
          {truncated && <div className="hint" style={{ fontSize: 12, marginBottom: 8 }}>{t("ai.truncated", "Only the first batch is shown.")}</div>}
          {rows.map((r) => (
            <div key={r.key} className="card" style={{ padding: 10, marginBottom: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Row 1: Task name (top-left) + Assignees (top-right) — matches the app. */}
              <div className="row2">
                <div className="field">
                  <label>{t("list.colTask", "Task")}</label>
                  <input value={r.title} onChange={(e) => update(r.key, { title: e.target.value })} />
                </div>
                <div className="field">
                  {/* AssigneePicker renders its own "Assignees" heading — no extra label. */}
                  <AssigneePicker users={users} groups={groups} subproject={r.subprojectId} isAdmin={me.is_admin}
                    assignees={r.assignees} setAssignees={(ids) => update(r.key, { assignees: ids })}
                    assigneeGroups={r.assigneeGroups} setAssigneeGroups={(ids) => update(r.key, { assigneeGroups: ids })} />
                </div>
              </div>
              <div className="row2">
                <div className="field">
                  <label>{t("task.project")}</label>
                  <SingleSelect width="100%" value={r.projectId ? String(r.projectId) : ""} placeholder={t("ta.select", "Select…")}
                    onChange={(v) => pickProject(r.key, Number(v))}
                    options={projects.map((p) => ({ value: String(p.id), label: p.name }))} />
                </div>
                <div className="field">
                  <label>{t("task.subproject")}</label>
                  <SingleSelect width="100%" value={r.subprojectId ? String(r.subprojectId) : ""} placeholder={t("ta.select", "Select…")}
                    onChange={(v) => update(r.key, { subprojectId: Number(v) })}
                    options={subsFor(r.projectId).map((s) => ({ value: String(s.id), label: s.name }))} />
                </div>
              </div>
              {r.newProject && !r.projectId && (
                <div className="hint" style={{ fontSize: 12 }}>{t("ai.newProjectHint", "AI suggested a new project “{{name}}” — pick an existing project/sub-project to file this under.", { name: r.newProject })}</div>
              )}
              {/* Row 3: Priority + Status */}
              <div className="row2">
                <div className="field">
                  <label>{t("task.priority")}</label>
                  <SingleSelect width="100%" value={String(r.priority)} onChange={(v) => update(r.key, { priority: Number(v) })} options={PRIO_OPTS} />
                </div>
                <div className="field">
                  <label>{t("task.status", "Status")}</label>
                  <StatusPillSelect value={r.status} statuses={statuses} onChange={(s) => update(r.key, { status: s })} />
                </div>
              </div>
              {/* Row 4: dates */}
              <div className="row2">
                <div className="field">
                  <label>{t("ai.startDate", "Start date")}</label>
                  <input type="date" value={r.startDate || ""} onChange={(e) => update(r.key, { startDate: e.target.value || null })} />
                </div>
                <div className="field">
                  <label>{t("task.deadline", "Due date")}</label>
                  <input type="date" value={r.deadline || ""} onChange={(e) => update(r.key, { deadline: e.target.value || null })} />
                </div>
              </div>
              {r.recurrence && (
                <div className="ai-recur" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--muted)" }}>
                  <Repeat size={14} />
                  <span>{t("ai.repeats", "Repeats")} {recurLabel(r.recurrence)}</span>
                  <button type="button" className="btn-ghost icon-only" aria-label={t("ai.clearRecur", "Make one-time")}
                    onClick={() => update(r.key, { recurrence: null })}><X size={13} /></button>
                </div>
              )}
              {/* Subtasks — small editable title list (one level, matches the app). */}
              <div className="ai-subtasks" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label className="muted" style={{ fontSize: 12 }}>{t("ai.subtasks", "Subtasks")}</label>
                {r.subtasks.map((st, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span aria-hidden style={{ color: "var(--muted)" }}>↳</span>
                    <input value={st} onChange={(e) => setSub(r.key, i, e.target.value)} aria-label={t("ai.subtaskN", "Subtask {{n}}", { n: i + 1 })} style={{ flex: 1, minWidth: 0 }} />
                    <button type="button" className="btn-ghost icon-only" aria-label={t("common.remove", "Remove")} onClick={() => removeSub(r.key, i)}><X size={14} /></button>
                  </div>
                ))}
                <button type="button" className="btn-ghost" style={{ width: "fit-content", fontSize: 13 }} onClick={() => addSub(r.key)}>+ {t("ai.addSubtask", "Add subtask")}</button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {r.sourceFileIndex != null && files[r.sourceFileIndex] && (
                  <label className="muted" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                    <input type="checkbox" style={{ width: "auto" }} checked={r.attach} onChange={(e) => update(r.key, { attach: e.target.checked })} />
                    {t("ai.attachFile", "Attach {{name}}", { name: files[r.sourceFileIndex].name })}
                  </label>
                )}
                <button type="button" className="btn-ghost" style={{ marginLeft: "auto", color: "var(--danger)" }} onClick={() => dropRow(r.key)}>
                  <Trash2 size={14} /> {t("ai.dropTask", "Remove")}
                </button>
              </div>
            </div>
          ))}
          {err && <div style={{ color: "var(--danger)", fontSize: 13 }}>{err}</div>}
        </>
      )}

      {step === "done" && (
        <>
          <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{t("ai.createdTitle", "Created {{n}} task(s). Click any to keep editing.", { n: created.length })}</div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {created.map((tk) => (
              <li key={tk.id}>
                <button type="button" className="btn-secondary" style={{ width: "100%", justifyContent: "flex-start" }} onClick={() => onOpenTask(tk)}>
                  <PriorityIcon level={tk.priority} size={14} /> {tk.title}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
