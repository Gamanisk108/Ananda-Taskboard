// AI task generation modal: prompt + files → Claude proposes tasks → review
// (each row uses the SAME field components/order as the rest of the app:
// Priority · Task Name · Project · Sub-Project · Assignee · Status) → save creates
// real tasks via the normal /api/tasks path and attaches the AI-suggested source
// file to each. Post-save the created tasks stay listed, each opening TaskModal.

import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Upload, X, Trash2, FileText } from "lucide-react";
import { api, ApiError } from "../api/client";
import { uploadAttachment } from "../attachments";
import { writableProjects } from "../lookup";
import { useUsers } from "../users";
import { useAdminGroups } from "../groups";
import { useStatuses } from "../statuses";
import { generateTasks, type ProposedTask } from "../ai";
import { PRIORITY_META, type Me, type Task } from "../types";
import { Modal, SingleSelect, StatusPillSelect, PriorityIcon, Spinner } from "./common";
import { AssigneePicker } from "./AssigneePicker";

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
  const submitting = useRef(false);

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

  const canSave = rows.length > 0 && rows.every((r) => r.title.trim() && r.subprojectId);

  async function save() {
    if (submitting.current || !canSave) return;
    submitting.current = true; setStep("saving"); setErr("");
    const out: Task[] = [];
    const failed = new Set<number>();
    // Per-row: a failure must NOT abort the rest, and successfully-created rows are
    // dropped so a retry can't duplicate them (only failed rows remain in review).
    for (const r of rows) {
      try {
        const task = await api.post("/api/tasks", {
          subproject: r.subprojectId, title: r.title.trim(), priority: r.priority,
          assignees: r.assignees, assignee_groups: r.assigneeGroups, status: r.status,
        }) as Task;
        if (r.attach && r.sourceFileIndex != null && files[r.sourceFileIndex]) {
          try { await uploadAttachment("task", task.id, files[r.sourceFileIndex]); } catch { /* keep the task even if its attachment fails */ }
        }
        out.push(task);
      } catch {
        failed.add(r.key);
      }
    }
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
        <button type="button" className="btn-secondary" style={{ marginLeft: "auto" }} onClick={onClose}>{t("common.cancel")}</button>
      </div>
    ) : step === "review" ? (
      <div className="set-actions">
        <button type="button" className="btn-primary" disabled={!canSave} onClick={save}>{t("ai.save", "Save tasks")}</button>
        <button type="button" className="btn-ghost" onClick={() => setStep("input")}>{t("ai.back", "Back")}</button>
        <button type="button" className="btn-secondary" style={{ marginLeft: "auto" }} onClick={onClose}>{t("common.cancel")}</button>
      </div>
    ) : step === "done" ? (
      <div className="set-actions">
        <button type="button" className="btn-ghost" onClick={() => { setRows([]); setCreated([]); setPrompt(""); setFiles([]); setStep("input"); }}>{t("ai.generateMore", "Generate more")}</button>
        <button type="button" className="btn-primary" style={{ marginLeft: "auto" }} onClick={onClose}>{t("common.done", "Done")}</button>
      </div>
    ) : undefined;

  return (
    <Modal fullScreenOnNarrow wide icon={<Sparkles />} title={t("ai.title", "Generate tasks with AI")} onClose={onClose} footer={footer}>
      {step === "input" && (
        <>
          <div className="field">
            <label>{t("ai.promptLabel", "What needs doing?")}</label>
            <textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)}
              placeholder={t("ai.promptPh", "Describe the work, or upload notes/documents to turn into tasks…")} />
          </div>
          <div className="field">
            <label>{t("ai.filesLabel", "Documents & images (optional)")}</label>
            <label className="btn-secondary" style={{ display: "inline-flex", cursor: "pointer", width: "fit-content" }}>
              <Upload size={15} /> {t("ai.addFiles", "Add files")}
              <input type="file" multiple accept={ACCEPT} style={{ display: "none" }}
                onChange={(e) => { setFiles((f) => [...f, ...Array.from(e.target.files ?? [])]); e.currentTarget.value = ""; }} />
            </label>
            {files.length > 0 && (
              <ul className="ai-filelist" style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 4 }}>
                {files.map((f, i) => (
                  <li key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                    <FileText size={14} /> <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    <button type="button" className="btn-ghost icon-only" aria-label={t("common.remove", "Remove")}
                      onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}><X size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="hint" style={{ fontSize: 12 }}>{t("ai.privacyNotice", "Your text and files are sent to our AI provider to generate tasks. Don't upload anything you wouldn't want processed externally.")}</div>
          {err && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{err}</div>}
        </>
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
              <div className="row2">
                <div className="field" style={{ maxWidth: 160 }}>
                  <label>{t("task.priority")}</label>
                  <SingleSelect value={String(r.priority)} onChange={(v) => update(r.key, { priority: Number(v) })} options={PRIO_OPTS} />
                </div>
                <div className="field">
                  <label>{t("list.colTask", "Task")}</label>
                  <input value={r.title} onChange={(e) => update(r.key, { title: e.target.value })} />
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
              <div className="row2">
                <div className="field">
                  <label>{t("task.assignees", "Assignee")}</label>
                  <AssigneePicker users={users} groups={groups} subproject={r.subprojectId} isAdmin={me.is_admin}
                    assignees={r.assignees} setAssignees={(ids) => update(r.key, { assignees: ids })}
                    assigneeGroups={r.assigneeGroups} setAssigneeGroups={(ids) => update(r.key, { assigneeGroups: ids })} />
                </div>
                <div className="field">
                  <label>{t("task.status", "Status")}</label>
                  <StatusPillSelect value={r.status} statuses={statuses} onChange={(s) => update(r.key, { status: s })} />
                </div>
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
