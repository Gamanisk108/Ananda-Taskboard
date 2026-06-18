// AI task generation modal: prompt + files → Claude proposes tasks → review
// (each row uses the SAME field components/order as the rest of the app:
// Priority · Task Name · Project · Sub-Project · Assignee · Status) → save creates
// real tasks via the normal /api/tasks path and attaches the AI-suggested source
// file to each. Post-save the created tasks stay listed, each opening TaskModal.

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Download, X, Trash2, FileText, Repeat, CheckCircle2 } from "lucide-react";
import { api, ApiError } from "../api/client";
import { uploadAttachment, fmtSize } from "../attachments";
import { writableProjects } from "../lookup";
import { useUsers } from "../users";
import { useAdminGroups } from "../groups";
import { useStatuses } from "../statuses";
import { generateTasks, type ProposedTask, type ExistingTaskOption } from "../ai";
import { PRIORITY_META, type Me, type Task, type Recurrence } from "../types";
import { Modal, SingleSelect, StatusPillSelect, PriorityIcon, Spinner } from "./common";
import { AssigneePicker } from "./AssigneePicker";
import { InlineCreate, NEW_OPT } from "./InlineCreate";
import { useConfirm } from "./confirm";
import { useAuth } from "../state/auth";

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
  /** When set, this row ADDS its subtasks to that existing task — no new task. */
  existingTaskId: number | null;
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
  const baseProjects = useMemo(() => writableProjects(me), [me]);
  // Inline-created projects/subs kept locally so the picker updates INSTANTLY (no
  // await on a network refresh). Merged + deduped over the prop list; a background
  // refreshMe later folds them into me.tree for the board.
  const [extraProjects, setExtraProjects] = useState<ReturnType<typeof writableProjects>>([]);
  const [extraSubs, setExtraSubs] = useState<Record<number, { id: number; name: string }[]>>({});
  const projects = useMemo(() => {
    const seenP = new Set<number>();
    return [...baseProjects, ...extraProjects].filter((p) => !seenP.has(p.id) && seenP.add(p.id)).map((p) => {
      const seenS = new Set<number>();
      return { ...p, subprojects: [...(p.subprojects ?? []), ...(extraSubs[p.id] ?? [])].filter((s) => !seenS.has(s.id) && seenS.add(s.id)) };
    });
  }, [baseProjects, extraProjects, extraSubs]);
  const users = useUsers();
  const groups = useAdminGroups(me);
  const statuses = useStatuses();

  const [step, setStep] = useState<Step>("input");
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [existingTasks, setExistingTasks] = useState<ExistingTaskOption[]>([]);
  const [created, setCreated] = useState<Task[]>([]);
  const [attached, setAttached] = useState<{ taskId: number; title: string; count: number }[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [creatingFor, setCreatingFor] = useState<{ key: number; kind: "project" | "subproject" } | null>(null);
  const submitting = useRef(false);
  const confirm = useConfirm();
  const { refreshMe } = useAuth();

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
      existingTaskId: tk.existing_task_id ?? null,
    };
  }

  async function runGenerate() {
    if (submitting.current) return;
    if (!prompt.trim() && files.length === 0) { setErr(t("ai.needInput", "Add a prompt or a file.")); return; }
    submitting.current = true; setBusy(true); setErr("");
    try {
      const res = await generateTasks(prompt, files);
      setRemaining(res.remaining); setTruncated(res.truncated);
      setExistingTasks(res.existing_tasks ?? []);
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

  // A row is saveable as a NEW task (needs title + sub-project) or as an ATTACH
  // row (needs a destination + at least one non-empty subtask).
  const rowReady = (r: Row) =>
    r.existingTaskId != null ? r.subtasks.some((s) => s.trim()) : !!(r.title.trim() && r.subprojectId);
  const canSave = rows.length > 0 && rows.every(rowReady);

  async function save() {
    if (submitting.current || !canSave) return;
    submitting.current = true; setStep("saving"); setErr("");
    // Save all rows in PARALLEL (was sequential → slow for many tasks). Each row's
    // own failure is isolated; succeeded rows are dropped so a retry can't duplicate.
    const settled = await Promise.all(rows.map(async (r) => {
      try {
        // Attach row: add the subtasks to the chosen existing task — no new task.
        if (r.existingTaskId != null) {
          const subs = r.subtasks.map((s) => s.trim()).filter(Boolean);
          let n = 0, lastErr: unknown = null;
          for (const st of subs) {
            try { await api.post("/api/subtasks", { task: r.existingTaskId, title: st }); n++; }
            catch (e) { lastErr = e; }
          }
          if (subs.length && n === 0) throw lastErr ?? new Error("attach failed");
          const et = existingTasks.find((e) => e.id === r.existingTaskId);
          return { ok: true as const, key: r.key, attach: { taskId: r.existingTaskId, title: et?.title ?? r.title, count: n } };
        }
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
    const out: Task[] = settled.filter((x) => x.ok && "task" in x).map((x) => (x as { task: Task }).task);
    const att = settled.filter((x) => x.ok && "attach" in x).map((x) => (x as { attach: { taskId: number; title: string; count: number } }).attach);
    const failed = new Set(settled.filter((x) => !x.ok).map((x) => x.key));
    submitting.current = false;
    if (out.length) setCreated((c) => [...c, ...out]);
    if (att.length) setAttached((a) => [...a, ...att]);
    if (out.length || att.length) onChanged?.();
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
        <button type="button" className="btn-ghost" onClick={() => { setRows([]); setCreated([]); setAttached([]); setExistingTasks([]); setPrompt(""); setFiles([]); setStep("input"); }}>{t("ai.generateMore", "Generate more")}</button>
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
          {rows.map((r) => {
            const attach = r.existingTaskId != null;
            const destTask = attach ? existingTasks.find((e) => e.id === r.existingTaskId) : null;
            return (
            <div key={r.key} className="card" style={{ padding: 10, marginBottom: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Destination: a brand-new task, or add these subtasks to an existing one. */}
              {existingTasks.length > 0 && (
                <div className="field">
                  <label>{t("ai.fileUnder", "File under")}</label>
                  <SingleSelect width="100%" value={attach ? String(r.existingTaskId) : "new"}
                    onChange={(v) => update(r.key, { existingTaskId: v === "new" ? null : Number(v) })}
                    options={[
                      { value: "new", label: t("ai.destNew", "Create new task") },
                      ...existingTasks.map((e) => ({ value: String(e.id), label: `${e.title} — ${e.project} / ${e.subproject}` })),
                    ]} />
                </div>
              )}
              {attach ? (
                <div className="hint" style={{ fontSize: 12 }}>
                  {t("ai.attachNote", "These subtasks will be added to “{{name}}”. No new task is created.", { name: destTask?.title ?? r.title })}
                </div>
              ) : (
              <>
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
                    onChange={(v) => (v === NEW_OPT ? setCreatingFor({ key: r.key, kind: "project" }) : pickProject(r.key, Number(v)))}
                    options={[
                      ...projects.map((p) => ({ value: String(p.id), label: p.name })),
                      ...(me.is_admin ? [{ value: NEW_OPT, label: t("tm.newProject", "+ New project…") }] : []),
                    ]} />
                </div>
                <div className="field">
                  <label>{t("task.subproject")}</label>
                  <SingleSelect width="100%" value={r.subprojectId ? String(r.subprojectId) : ""} placeholder={t("ta.select", "Select…")}
                    onChange={(v) => (v === NEW_OPT ? setCreatingFor({ key: r.key, kind: "subproject" }) : update(r.key, { subprojectId: Number(v) }))}
                    options={[
                      ...subsFor(r.projectId).map((s) => ({ value: String(s.id), label: s.name })),
                      ...(me.is_admin && r.projectId ? [{ value: NEW_OPT, label: t("tm.newSubproject", "+ New sub-project…") }] : []),
                    ]} />
                </div>
              </div>
              {creatingFor?.key === r.key && (
                <InlineCreate
                  kind={creatingFor.kind}
                  projectId={r.projectId}
                  onCancel={() => setCreatingFor(null)}
                  onCreated={(entity) => {
                    const kind = creatingFor.kind;
                    setCreatingFor(null);
                    if (kind === "project") {
                      const p = entity as { id: number; name: string; subprojects?: { id: number; name: string }[] };
                      setExtraProjects((a) => [...a, { id: p.id, name: p.name, subprojects: p.subprojects ?? [] }]);
                      update(r.key, { projectId: p.id, subprojectId: p.subprojects?.[0]?.id ?? 0 });
                    } else {
                      const s = entity as { id: number; name: string };
                      setExtraSubs((m) => ({ ...m, [r.projectId]: [...(m[r.projectId] ?? []), { id: s.id, name: s.name }] }));
                      update(r.key, { subprojectId: s.id });
                    }
                    // Background-refresh me.tree so the board knows the new entity too
                    // (no await → the picker switches instantly; board catches up).
                    refreshMe().catch(() => {});
                  }}
                />
              )}
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
              </>
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
                {!attach && r.sourceFileIndex != null && files[r.sourceFileIndex] && (
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
            );
          })}
          {err && <div style={{ color: "var(--danger)", fontSize: 13 }}>{err}</div>}
        </>
      )}

      {step === "done" && (
        <>
          {created.length > 0 && (
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
          {attached.length > 0 && (
            <div style={{ marginTop: created.length ? 14 : 0 }}>
              <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{t("ai.attachedTitle", "Added subtasks to existing tasks:")}</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {attached.map((a, i) => (
                  <li key={i} className="card" style={{ padding: "8px 10px", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                    <CheckCircle2 size={15} aria-hidden style={{ color: "var(--success)", flex: "none" }} />
                    <span>{t("ai.attachedRow", "{{count}} subtask(s) → “{{name}}”", { count: a.count, name: a.title })}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
