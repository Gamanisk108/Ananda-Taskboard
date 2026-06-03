import { useState } from "react";
import { api } from "../api/client";
import { useStatuses } from "../statuses";
import { useUsers } from "../users";
import { Modal } from "./common";
import { PRIORITY_META } from "../types";

// keys MUST match the backend COLUMNS registry in exporting/export.py
const COLUMNS: { key: string; label: string }[] = [
  { key: "project", label: "Project" },
  { key: "subproject", label: "Sub-project" },
  { key: "title", label: "Title" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "approval", label: "Approval" },
  { key: "deadline", label: "Deadline" },
  { key: "start_time", label: "Start time" },
  { key: "end_time", label: "End time" },
  { key: "recurrence", label: "Recurrence" },
  { key: "assignees", label: "Assignees" },
  { key: "details", label: "Details" },
  { key: "requirements", label: "Requirements" },
  { key: "links", label: "Links" },
];

export function ExportDialog({ projectId, subprojectId }: { projectId?: number; subprojectId?: number }) {
  const [open, setOpen] = useState(false);
  const [fmt, setFmt] = useState<"csv" | "xlsx">("xlsx");
  const [scope, setScope] = useState<"view" | "all">("view");
  const [status, setStatus] = useState("");
  const [assignee, setAssignee] = useState("");      // "" | "unassigned" | "<id>"
  const [priority, setPriority] = useState("");       // "" | "1".."5"
  const [archived, setArchived] = useState(false);
  const [cols, setCols] = useState<Record<string, boolean>>(
    Object.fromEntries(COLUMNS.map((c) => [c.key, true])),
  );
  const statuses = useStatuses();
  const users = useUsers();

  const scoped = scope === "view" && (subprojectId || projectId);
  const allCols = COLUMNS.map((c) => c.key);
  const selected = allCols.filter((k) => cols[k]);

  function run() {
    const p = new URLSearchParams({ fmt });
    if (scope === "view") {
      if (subprojectId) p.set("subproject", String(subprojectId));
      else if (projectId) p.set("project", String(projectId));
    }
    if (status) p.set("status", status);
    if (assignee) p.set("assignee", assignee);
    if (priority) p.set("priority", priority);
    if (archived) p.set("archived", "1");
    if (selected.length && selected.length !== allCols.length) p.set("columns", selected.join(","));
    api.download(`/api/export?${p}`, `tasks.${fmt}`);
    setOpen(false);
  }

  return (
    <>
      <button className="btn-secondary" data-testid="export-button" onClick={() => setOpen(true)}>Export ▾</button>
      {open && (
        <Modal title="Export tasks" onClose={() => setOpen(false)}>
          <div className="row2" data-testid="export-dialog">
            <div className="field">
              <label>Format</label>
              <select data-testid="export-format" value={fmt} onChange={(e) => setFmt(e.target.value as "csv" | "xlsx")}>
                <option value="xlsx">Excel (.xlsx)</option>
                <option value="csv">CSV (.csv)</option>
              </select>
            </div>
            <div className="field">
              <label>Scope</label>
              <select value={scope} onChange={(e) => setScope(e.target.value as "view" | "all")}>
                <option value="view">{scoped ? "Current project / view" : "Everything visible"}</option>
                <option value="all">Entire board (all visible)</option>
              </select>
            </div>
          </div>

          <div className="row2">
            <div className="field">
              <label>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Any status</option>
                {statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="">Any priority</option>
                {[5, 4, 3, 2, 1].map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
              </select>
            </div>
          </div>

          <div className="row2">
            <div className="field">
              <label>Assignee</label>
              <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">Any assignee</option>
                <option value="unassigned">Unassigned</option>
                {users.map((u) => <option key={u.id} value={String(u.id)}>{u.name || u.email}</option>)}
              </select>
            </div>
            <div className="field" style={{ display: "flex", alignItems: "flex-end" }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <input type="checkbox" style={{ width: "auto" }} checked={archived} onChange={(e) => setArchived(e.target.checked)} />
                Include archived tasks
              </label>
            </div>
          </div>

          <div className="field">
            <label>Columns</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
              {COLUMNS.map((c) => (
                <label key={c.key} className="muted" style={{ display: "flex", gap: 5, alignItems: "center", margin: 0, fontSize: 13 }}>
                  <input type="checkbox" style={{ width: "auto" }} checked={cols[c.key]}
                    onChange={(e) => setCols((s) => ({ ...s, [c.key]: e.target.checked }))} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          <div className="modal-foot">
            <button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" data-testid="export-download" disabled={selected.length === 0} onClick={run}>Download</button>
          </div>
        </Modal>
      )}
    </>
  );
}
