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

          <EventsManager />

          <div className="modal-foot">
            <button className="btn-secondary" onClick={onClose}>Close</button>
          </div>
        </>
      )}
    </Modal>
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
