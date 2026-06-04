import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useStatuses } from "../statuses";
import { useUsers } from "../users";
import { Modal } from "./common";
import { PRIORITY_META, type Me } from "../types";

// keys MUST match the backend COLUMNS registry in exporting/export.py
const COLUMNS: { key: string; label: string }[] = [
  { key: "id", label: "ID" },  // include for round-trip: re-import matches on it
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

interface GroupLite { id: number; name: string }

type Fmt = "csv" | "xlsx" | "json";

export function ExportDialog({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  const [fmt, setFmt] = useState<Fmt>("xlsx");
  const [selProjects, setSelProjects] = useState<Set<number>>(new Set());
  const [selSubs, setSelSubs] = useState<Set<number>>(new Set());
  const [selGroups, setSelGroups] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState("");
  const [archived, setArchived] = useState(false);
  const [groups, setGroups] = useState<GroupLite[]>([]);
  const [cols, setCols] = useState<Record<string, boolean>>(
    Object.fromEntries(COLUMNS.map((c) => [c.key, true])),
  );
  const statuses = useStatuses();
  const users = useUsers();

  useEffect(() => {
    if (open && me.is_admin) api.get("/api/groups").then(setGroups).catch(() => setGroups([]));
  }, [open, me.is_admin]);

  const projects = me.tree.projects;
  const allCols = COLUMNS.map((c) => c.key);
  const selected = allCols.filter((k) => cols[k]);

  function toggle(set: Set<number>, id: number, setter: (s: Set<number>) => void) {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setter(next);
  }

  const [copied, setCopied] = useState(false);

  function buildParams(overrideFmt?: string) {
    const p = new URLSearchParams({ fmt: overrideFmt ?? fmt });
    if (selProjects.size) p.set("projects", [...selProjects].join(","));
    // only send sub-projects not already covered by a whole-project selection
    const subs = [...selSubs].filter((sid) =>
      !projects.some((pr) => selProjects.has(pr.id) && pr.subprojects.some((s) => s.id === sid)));
    if (subs.length) p.set("subprojects", subs.join(","));
    if (selGroups.size) p.set("groups", [...selGroups].join(","));
    if (status) p.set("status", status);
    if (assignee) p.set("assignee", assignee);
    if (priority) p.set("priority", priority);
    if (archived) p.set("archived", "1");
    if (selected.length && selected.length !== allCols.length) p.set("columns", selected.join(","));
    return p;
  }

  function run() {
    api.download(`/api/export?${buildParams()}`, `tasks.${fmt}`);
    setOpen(false);
  }

  // Fetch a TSV export and copy it to the clipboard, ready to paste into a Google Sheet.
  async function copyForSheets() {
    const tsv = await api.text(`/api/export?${buildParams("tsv")}`);
    await navigator.clipboard.writeText(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <button className="btn-secondary" data-testid="export-button" onClick={() => setOpen(true)}>Export ▾</button>
      {open && (
        <Modal title="Export tasks" onClose={() => setOpen(false)} wide>
          <div className="row2">
            <div className="field">
              <label>Format</label>
              <select data-testid="export-format" value={fmt} onChange={(e) => setFmt(e.target.value as Fmt)}>
                <option value="xlsx">Excel (.xlsx)</option>
                <option value="csv">CSV (.csv)</option>
                <option value="json">JSON (.json)</option>
              </select>
            </div>
            <div className="field">
              <label>Include</label>
              <label className="muted" style={{ display: "flex", gap: 8, alignItems: "center", margin: "7px 0 0" }}>
                <input type="checkbox" style={{ width: "auto" }} checked={archived} onChange={(e) => setArchived(e.target.checked)} />
                Archived tasks
              </label>
            </div>
          </div>

          <div className="field">
            <label>What to export <span className="muted" style={{ fontWeight: 400 }}>(leave all unchecked = everything you can see)</span></label>
            <div className="export-scope" data-testid="export-scope">
              {projects.map((pr) => {
                const projChecked = selProjects.has(pr.id);
                return (
                  <div key={pr.id} style={{ marginBottom: 6 }}>
                    <label style={{ display: "flex", gap: 7, alignItems: "center", fontWeight: 600, margin: 0 }}>
                      <input type="checkbox" style={{ width: "auto" }} checked={projChecked}
                        onChange={() => toggle(selProjects, pr.id, setSelProjects)} />
                      {pr.name}
                    </label>
                    <div style={{ paddingLeft: 22, display: "flex", flexWrap: "wrap", gap: "2px 14px" }}>
                      {pr.subprojects.map((s) => (
                        <label key={s.id} className="muted" style={{ display: "flex", gap: 6, alignItems: "center", margin: 0, fontSize: 13 }}>
                          <input type="checkbox" style={{ width: "auto" }}
                            checked={projChecked || selSubs.has(s.id)} disabled={projChecked}
                            onChange={() => toggle(selSubs, s.id, setSelSubs)} />
                          {s.name}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {me.is_admin && groups.length > 0 && (
            <div className="field">
              <label>Group(s) <span className="muted" style={{ fontWeight: 400 }}>(only tasks assigned to these groups)</span></label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px" }} data-testid="export-groups">
                {groups.map((g) => (
                  <label key={g.id} className="muted" style={{ display: "flex", gap: 6, alignItems: "center", margin: 0, fontSize: 13 }}>
                    <input type="checkbox" style={{ width: "auto" }} checked={selGroups.has(g.id)}
                      onChange={() => toggle(selGroups, g.id, setSelGroups)} />
                    {g.name}
                  </label>
                ))}
              </div>
            </div>
          )}

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

          <div className="field">
            <label>Assignee</label>
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} style={{ maxWidth: 260 }}>
              <option value="">Any assignee</option>
              <option value="unassigned">Unassigned</option>
              {users.map((u) => <option key={u.id} value={String(u.id)}>{u.name || u.email}</option>)}
            </select>
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
            <button className="btn-secondary" style={{ marginRight: "auto" }} disabled={selected.length === 0}
              onClick={copyForSheets} data-testid="export-copy-sheets" title="Copy as TSV — paste straight into a Google Sheet">
              {copied ? "Copied!" : "📋 Copy for Google Sheets"}
            </button>
            <button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" data-testid="export-download" disabled={selected.length === 0} onClick={run}>Download</button>
          </div>
        </Modal>
      )}
    </>
  );
}
