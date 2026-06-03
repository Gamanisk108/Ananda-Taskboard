import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Modal, Spinner } from "./common";

interface S { daily_push_hour: number; daily_push_minute: number; timezone: string; }

const TZS = [
  "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York",
  "America/Anchorage", "Pacific/Honolulu", "Europe/London", "UTC",
];

export function Settings({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<S | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => { api.get("/api/settings").then(setS).catch(() => setS(null)); }, []);

  async function save() {
    if (!s) return;
    setMsg("");
    try { await api.patch("/api/settings", s); setMsg("Saved."); setTimeout(() => setMsg(""), 2000); }
    catch { setMsg("Could not save — check the values."); }
  }

  return (
    <Modal title="Settings" onClose={onClose}>
      {!s ? <Spinner /> : (
        <>
          <h3 className="section-title">Daily push notification time</h3>
          <div className="row2">
            <div className="field">
              <label>Hour (0–23)</label>
              <input type="number" min={0} max={23} value={s.daily_push_hour}
                onChange={(e) => setS({ ...s, daily_push_hour: Number(e.target.value) })} />
            </div>
            <div className="field">
              <label>Minute (0–59)</label>
              <input type="number" min={0} max={59} value={s.daily_push_minute}
                onChange={(e) => setS({ ...s, daily_push_minute: Number(e.target.value) })} />
            </div>
          </div>
          <div className="field">
            <label>Timezone</label>
            <select value={s.timezone} onChange={(e) => setS({ ...s, timezone: e.target.value })}>
              {TZS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
            Determines the "today" boundary for the morning push. Exact send time is set by the
            daily scheduler (see deploy runbook); set the scheduler to match this hour.
          </div>
          {msg && <div style={{ color: "var(--accent)", fontSize: 13, marginBottom: 10 }}>{msg}</div>}
          <div className="modal-foot" style={{ marginBottom: 8 }}>
            <button className="btn-primary" onClick={save}>Save time settings</button>
          </div>

          <StatusManager />

          <EventsManager />

          <div className="modal-foot">
            <button className="btn-secondary" onClick={onClose}>Close</button>
          </div>
        </>
      )}
    </Modal>
  );
}

interface St { id: number; key: string; label: string; color: string; order: number; is_complete: boolean; is_initial: boolean; }

function StatusManager() {
  const [list, setList] = useState<St[]>([]);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#6b7280");

  async function load() {
    const d = await api.get("/api/statuses");
    setList((d as St[]).sort((a, b) => a.order - b.order));
    const { invalidateStatuses } = await import("../statuses");
    invalidateStatuses();
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!label.trim()) return;
    await api.post("/api/statuses", { label: label.trim(), color, order: list.length });
    setLabel(""); setColor("#6b7280"); load();
  }
  async function patch(s: St, changes: Partial<St>) { await api.patch(`/api/statuses/${s.id}`, changes); load(); }
  async function remove(s: St) {
    if (list.length <= 1) { alert("Keep at least one status."); return; }
    if (!confirm(`Delete status "${s.label}"? Tasks in it will keep the value but show greyed.`)) return;
    await api.del(`/api/statuses/${s.id}`); load();
  }

  return (
    <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 14 }}>
      <h3 className="section-title">Task statuses (Kanban columns — apply to all projects)</h3>
      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
        Rename, recolor, reorder, or add columns. Tick "complete" for the Done state
        (drives auto-archiving + hiding from calendars).
      </div>
      {list.map((s, idx) => (
        <div key={s.id} className="assignee-row" style={{ gap: 8 }}>
          <input type="color" value={s.color || "#6b7280"} onChange={(e) => patch(s, { color: e.target.value })} style={{ width: 38, padding: 2 }} />
          <input defaultValue={s.label} onBlur={(e) => e.target.value !== s.label && patch(s, { label: e.target.value })} style={{ flex: 1 }} />
          <input type="number" value={s.order} onChange={(e) => patch(s, { order: Number(e.target.value) })} style={{ width: 56 }} title="order" />
          <label className="muted" style={{ display: "flex", gap: 4, alignItems: "center", margin: 0, whiteSpace: "nowrap" }}>
            <input type="checkbox" style={{ width: "auto" }} checked={s.is_complete} onChange={(e) => patch(s, { is_complete: e.target.checked })} /> complete
          </label>
          <button type="button" className="btn-ghost" style={{ color: "var(--danger)" }} onClick={() => remove(s)} disabled={idx === 0}>✕</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 38, padding: 2 }} />
        <input placeholder="New status name…" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button className="btn-secondary" type="button" onClick={add}>Add status</button>
      </div>
    </div>
  );
}

interface Ev { id: number; date: string; title: string; yearly: boolean; }

function EventsManager() {
  const [list, setList] = useState<Ev[]>([]);
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [yearly, setYearly] = useState(false);

  function load() { api.get("/api/events").then(setList).catch(() => setList([])); }
  useEffect(load, []);

  async function add() {
    if (!date || !title.trim()) return;
    await api.post("/api/events", { date, title: title.trim(), yearly });
    setDate(""); setTitle(""); setYearly(false); load();
  }
  async function remove(id: number) { await api.del(`/api/events/${id}`); load(); }

  return (
    <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 14 }}>
      <h3 className="section-title">Calendar events (birthdays, holidays, major dates)</h3>
      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
        These show as text on the Weekly &amp; Monthly calendars. Tick "yearly" for birthdays.
      </div>
      {list.map((e) => (
        <div key={e.id} className="assignee-row" style={{ justifyContent: "space-between" }}>
          <span><span className="mono">{e.date}</span> · {e.yearly ? "🎂" : "📌"} {e.title}{e.yearly && <span className="muted"> (yearly)</span>}</span>
          <button type="button" className="btn-ghost" style={{ color: "var(--danger)" }} onClick={() => remove(e.id)}>✕</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 160 }} />
        <input placeholder="Event title…" value={title} onChange={(e) => setTitle(e.target.value)} />
        <label className="muted" style={{ display: "flex", gap: 5, alignItems: "center", margin: 0, whiteSpace: "nowrap" }}>
          <input type="checkbox" style={{ width: "auto" }} checked={yearly} onChange={(e) => setYearly(e.target.checked)} /> yearly
        </label>
        <button className="btn-secondary" type="button" onClick={add}>Add</button>
      </div>
    </div>
  );
}
