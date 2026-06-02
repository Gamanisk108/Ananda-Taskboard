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
          <div className="modal-foot">
            <button className="btn-secondary" onClick={onClose}>Close</button>
            <button className="btn-primary" onClick={save}>Save</button>
          </div>
        </>
      )}
    </Modal>
  );
}
