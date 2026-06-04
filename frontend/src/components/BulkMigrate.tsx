import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useUsers, userName } from "../users";
import { useStatuses } from "../statuses";
import { buildSubLookup } from "../lookup";
import { Modal, Spinner, StatusPill, PriorityIcon } from "./common";
import { PRIORITY_META, type Me, type Task } from "../types";

/** Admin bulk-migration tool: a filterable/sortable checklist of tasks; bulk-set
 *  their sub-project, assignees, status, or deadline in one go. */
export function BulkMigrate({ me, onClose, onChanged }: { me: Me; onClose: () => void; onChanged: () => void }) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [q, setQ] = useState("");
  const [fProject, setFProject] = useState(0);
  const [fStatus, setFStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const users = useUsers();
  const statuses = useStatuses();
  const subs = useMemo(() => buildSubLookup(me.tree), [me.tree]);
  const subOptions = useMemo(
    () => me.tree.projects.flatMap((p) => p.subprojects.map((s) => ({ id: s.id, label: `${p.name} / ${s.name}` }))),
    [me.tree],
  );

  function load() {
    setSel(new Set());
    api.get("/api/tasks").then(setTasks).catch(() => setTasks([]));
  }
  useEffect(load, []);

  const filtered = (tasks ?? []).filter((t) => {
    const info = subs.get(t.subproject);
    if (q && !t.title.toLowerCase().includes(q.toLowerCase())) return false;
    if (fProject && info?.projectId !== fProject) return false;
    if (fStatus && t.status !== fStatus) return false;
    return true;
  });

  function toggle(id: number) {
    const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); setSel(n);
  }
  const allShown = filtered.length > 0 && filtered.every((t) => sel.has(t.id));
  function toggleAll() {
    setSel(allShown ? new Set() : new Set(filtered.map((t) => t.id)));
  }

  async function applyBulk(action: string, value: unknown, label: string) {
    if (sel.size === 0) return;
    setBusy(true); setMsg("");
    try {
      const r = await api.post("/api/tasks/bulk", { ids: [...sel], action, value }) as { updated: number };
      setMsg(`${label}: ${r.updated} task(s) updated.`);
      onChanged(); load();
    } catch { setMsg("Could not apply — check the value."); }
    finally { setBusy(false); }
  }

  // bulk-control inputs
  const [moveTo, setMoveTo] = useState(0);
  const [setTo, setSetTo] = useState("");
  const [due, setDue] = useState("");
  const [assignee, setAssignee] = useState(0);

  return (
    <Modal title="Bulk migrate tasks" onClose={onClose} wide>
      <div className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        Filter, tick the tasks to change, then apply one transition at a time. Admin-only; changes are immediate.
      </div>

      <div className="filters" style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0" }}>
        <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 200 }} />
        <select value={fProject} onChange={(e) => setFProject(Number(e.target.value))} style={{ width: "auto" }}>
          <option value={0}>All projects</option>
          {me.tree.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={{ width: "auto" }}>
          <option value="">Any status</option>
          {statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <span className="muted" style={{ alignSelf: "center", fontSize: 12 }}>{sel.size} selected · {filtered.length} shown</span>
      </div>

      {/* bulk action bar */}
      <div className="card" style={{ padding: 10, marginBottom: 12, background: "var(--surface-sunk)", display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end", opacity: sel.size ? 1 : 0.55 }}>
        <div className="field" style={{ margin: 0 }}><label>Move to</label>
          <div style={{ display: "flex", gap: 6 }}>
            <select value={moveTo} onChange={(e) => setMoveTo(Number(e.target.value))} style={{ width: "auto" }}>
              <option value={0}>Sub-project…</option>{subOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <button className="btn-secondary" disabled={busy || !sel.size || !moveTo} onClick={() => applyBulk("move", moveTo, "Moved")}>Apply</button>
          </div>
        </div>
        <div className="field" style={{ margin: 0 }}><label>Set status</label>
          <div style={{ display: "flex", gap: 6 }}>
            <select value={setTo} onChange={(e) => setSetTo(e.target.value)} style={{ width: "auto" }}>
              <option value="">Status…</option>{statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <button className="btn-secondary" disabled={busy || !sel.size || !setTo} onClick={() => applyBulk("status", setTo, "Status set")}>Apply</button>
          </div>
        </div>
        <div className="field" style={{ margin: 0 }}><label>Set deadline</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} style={{ width: "auto" }} />
            <button className="btn-secondary" disabled={busy || !sel.size} onClick={() => applyBulk("deadline", due, "Deadline set")}>Apply</button>
          </div>
        </div>
        <div className="field" style={{ margin: 0 }}><label>Reassign to</label>
          <div style={{ display: "flex", gap: 6 }}>
            <select value={assignee} onChange={(e) => setAssignee(Number(e.target.value))} style={{ width: "auto", maxWidth: 150 }}>
              <option value={0}>Person…</option><option value={-1}>Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
            </select>
            <button className="btn-secondary" disabled={busy || !sel.size || !assignee}
              onClick={() => applyBulk("assign", assignee === -1 ? [] : [assignee], "Reassigned")}>Apply</button>
          </div>
        </div>
        <button className="btn-danger" disabled={busy || !sel.size} style={{ marginLeft: "auto" }}
          onClick={() => { if (confirm(`Archive ${sel.size} task(s)?`)) applyBulk("archive", null, "Archived"); }}>Archive selected</button>
      </div>

      {msg && <div style={{ color: "var(--accent)", fontSize: 13, marginBottom: 8 }}>{msg}</div>}

      {!tasks ? <Spinner /> : filtered.length === 0 ? <div className="empty">No tasks match.</div> : (
        <div style={{ maxHeight: 380, overflow: "auto", border: "1px solid var(--border)", borderRadius: "var(--r-ctl)" }}>
          <table className="tbl" style={{ border: "none" }}>
            <thead><tr>
              <th style={{ width: 28 }}><input type="checkbox" style={{ width: "auto" }} checked={allShown} onChange={toggleAll} /></th>
              <th></th><th>Task</th><th>Project / sub-project</th><th>Assignees</th><th>Status</th><th>Deadline</th>
            </tr></thead>
            <tbody>
              {filtered.map((t) => {
                const info = subs.get(t.subproject);
                return (
                  <tr key={t.id} onClick={() => toggle(t.id)} style={{ cursor: "pointer", background: sel.has(t.id) ? "var(--primary-weak)" : undefined }}>
                    <td><input type="checkbox" style={{ width: "auto" }} checked={sel.has(t.id)} readOnly /></td>
                    <td title={PRIORITY_META[t.priority].label}><PriorityIcon level={t.priority} /></td>
                    <td>{t.title}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{info ? `${info.projectName} / ${info.name}` : "—"}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{t.assignees.map((id) => userName(users, id)).join(", ") || "—"}</td>
                    <td><StatusPill status={t.status} /></td>
                    <td className="mono" style={{ fontSize: 12 }}>{t.deadline ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
