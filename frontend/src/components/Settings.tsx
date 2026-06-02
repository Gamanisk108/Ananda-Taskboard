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

          <Webhooks />

          <div className="modal-foot">
            <button className="btn-secondary" onClick={onClose}>Close</button>
          </div>
        </>
      )}
    </Modal>
  );
}

interface Hook { id: number; url: string; events: string; active: boolean; }

function Webhooks() {
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState("");

  function load() { api.get("/api/webhooks").then(setHooks).catch(() => setHooks([])); }
  useEffect(load, []);

  async function add() {
    if (!url.trim()) return;
    await api.post("/api/webhooks", { url: url.trim(), events: events.trim() });
    setUrl(""); setEvents(""); load();
  }
  async function toggle(h: Hook) { await api.patch(`/api/webhooks/${h.id}`, { active: !h.active }); load(); }
  async function remove(h: Hook) { await api.del(`/api/webhooks/${h.id}`); load(); }

  return (
    <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 14 }}>
      <h3 className="section-title">Integrations — outbound webhooks (Zapier, etc.)</h3>
      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
        Paste a Zapier "Catch Hook" URL to get task events (created / approved / status changed…).
        Leave "events" blank for all.
      </div>
      {hooks.map((h) => (
        <div key={h.id} className="assignee-row" style={{ justifyContent: "space-between" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
            <span className="mono" style={{ fontSize: 12 }}>{h.url}</span>
            <span className="muted"> · {h.events || "all events"}</span>
          </span>
          <span style={{ display: "flex", gap: 6 }}>
            <button type="button" className="btn-ghost" onClick={() => toggle(h)}>{h.active ? "On" : "Off"}</button>
            <button type="button" className="btn-ghost" style={{ color: "var(--danger)" }} onClick={() => remove(h)}>✕</button>
          </span>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input placeholder="https://hooks.zapier.com/…" value={url} onChange={(e) => setUrl(e.target.value)} />
        <input placeholder="events (optional)" value={events} onChange={(e) => setEvents(e.target.value)} style={{ maxWidth: 160 }} />
        <button className="btn-secondary" type="button" onClick={add}>Add</button>
      </div>
    </div>
  );
}
