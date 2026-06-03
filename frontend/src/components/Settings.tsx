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

type EvKind = "single" | "yearly" | "range" | "repeating";
interface Ev {
  id: number;
  kind: EvKind;
  date: string;
  end_date: string | null;
  weekdays: number[];
  interval: number;
  count: number | null;
  title: string;
}

// Weekday toggles shown Sunday-first, but stored Mon=0..Sun=6 (Python weekday()).
const WD_TOGGLES = [
  { n: 6, label: "S" }, { n: 0, label: "M" }, { n: 1, label: "T" }, { n: 2, label: "W" },
  { n: 3, label: "T" }, { n: 4, label: "F" }, { n: 5, label: "S" },
];
const WD_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const KIND_ICON: Record<EvKind, string> = { single: "📍", yearly: "🎂", range: "📌", repeating: "🔁" };

type EndMode = "never" | "weeks" | "until";

interface Draft {
  id: number | null;
  kind: EvKind;
  date: string;
  end_date: string;
  weekdays: number[];
  interval: number;
  endMode: EndMode;
  count: number;
  title: string;
}

const EMPTY_DRAFT: Draft = {
  id: null, kind: "single", date: "", end_date: "", weekdays: [], interval: 1,
  endMode: "weeks", count: 4, title: "",
};

function summarize(e: Ev): string {
  if (e.kind === "yearly") return `Every year on ${e.date.slice(5)}`;
  if (e.kind === "range") return `${e.date} → ${e.end_date ?? "?"}`;
  if (e.kind === "repeating") {
    const days = [...e.weekdays].sort((a, b) => a - b).map((d) => WD_NAMES[d]).join(" & ") || "—";
    const every = e.interval > 1 ? `every ${e.interval} wks` : "weekly";
    const end = e.count ? `, ${e.count} wks` : e.end_date ? `, until ${e.end_date}` : "";
    return `${days} (${every}) from ${e.date}${end}`;
  }
  return e.date;
}

function EventsManager() {
  const [list, setList] = useState<Ev[]>([]);
  const [d, setD] = useState<Draft>(EMPTY_DRAFT);
  const [err, setErr] = useState("");

  function load() { api.get("/api/events").then(setList).catch(() => setList([])); }
  useEffect(load, []);

  function reset() { setD(EMPTY_DRAFT); setErr(""); }

  function startEdit(e: Ev) {
    setErr("");
    setD({
      id: e.id, kind: e.kind, date: e.date, end_date: e.end_date ?? "",
      weekdays: e.weekdays, interval: e.interval || 1,
      endMode: e.count ? "weeks" : e.end_date ? "until" : "never",
      count: e.count ?? 4, title: e.title,
    });
  }

  function toggleDay(n: number) {
    setD((s) => ({ ...s, weekdays: s.weekdays.includes(n) ? s.weekdays.filter((x) => x !== n) : [...s.weekdays, n] }));
  }

  async function save() {
    setErr("");
    if (!d.date || !d.title.trim()) { setErr("A date and a title are required."); return; }
    const payload: Record<string, unknown> = {
      kind: d.kind, date: d.date, title: d.title.trim(),
      end_date: null, weekdays: [], interval: 1, count: null,
    };
    if (d.kind === "range") {
      if (!d.end_date) { setErr("Pick an end date for the range."); return; }
      payload.end_date = d.end_date;
    } else if (d.kind === "repeating") {
      if (d.weekdays.length === 0) { setErr("Pick at least one weekday."); return; }
      payload.weekdays = d.weekdays;
      payload.interval = d.interval;
      if (d.endMode === "weeks") payload.count = d.count;
      else if (d.endMode === "until") {
        if (!d.end_date) { setErr("Pick an until-date, or choose a different end option."); return; }
        payload.end_date = d.end_date;
      }
    }
    try {
      if (d.id) await api.patch(`/api/events/${d.id}`, payload);
      else await api.post("/api/events", payload);
      reset(); load();
    } catch { setErr("Could not save — check the fields."); }
  }

  async function remove(id: number) { await api.del(`/api/events/${id}`); load(); }

  const repeating = d.kind === "repeating";
  const ranged = d.kind === "range";

  return (
    <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 14 }}>
      <h3 className="section-title">Calendar events (birthdays, retreats, class series)</h3>
      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
        Shown as bars on the Weekly &amp; Monthly calendars. Use a date range for a multi-day
        event, or Repeating for a weekly series (e.g. every Sat &amp; Sun for 4 weeks).
      </div>

      {list.map((e) => (
        <div key={e.id} className="assignee-row" style={{ justifyContent: "space-between" }}>
          <span>{KIND_ICON[e.kind]} <strong>{e.title}</strong> · <span className="muted">{summarize(e)}</span></span>
          <span style={{ display: "flex", gap: 4 }}>
            <button type="button" className="btn-ghost" onClick={() => startEdit(e)}>Edit</button>
            <button type="button" className="btn-ghost" style={{ color: "var(--danger)" }} onClick={() => remove(e.id)}>✕</button>
          </span>
        </div>
      ))}

      <div className="card" style={{ padding: 12, marginTop: 10, background: "var(--surface-sunk)" }}>
        <div className="row2">
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Type</label>
            <select value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value as EvKind })}>
              <option value="single">Single date</option>
              <option value="yearly">Yearly (birthday)</option>
              <option value="range">Date range</option>
              <option value="repeating">Repeating (weekly)</option>
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Title</label>
            <input placeholder="Event title…" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
          </div>
        </div>

        <div className="row2" style={{ marginTop: 10 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>{ranged || repeating ? "Start date" : "Date"}</label>
            <input type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
          </div>
          {ranged && (
            <div className="field" style={{ marginBottom: 0 }}>
              <label>End date</label>
              <input type="date" value={d.end_date} onChange={(e) => setD({ ...d, end_date: e.target.value })} />
            </div>
          )}
        </div>

        {repeating && (
          <>
            <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
              <label>Repeat on</label>
              <div style={{ display: "flex", gap: 4 }}>
                {WD_TOGGLES.map((w, i) => (
                  <button key={i} type="button"
                    className={d.weekdays.includes(w.n) ? "btn-primary" : "btn-secondary"}
                    style={{ width: 34, padding: "6px 0" }}
                    onClick={() => toggleDay(w.n)}>{w.label}</button>
                ))}
              </div>
            </div>
            <div className="row2" style={{ marginTop: 10 }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Every (weeks)</label>
                <input type="number" min={1} value={d.interval}
                  onChange={(e) => setD({ ...d, interval: Number(e.target.value) })} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Ends</label>
                <select value={d.endMode} onChange={(e) => setD({ ...d, endMode: e.target.value as EndMode })}>
                  <option value="weeks">After N weeks</option>
                  <option value="until">Until date</option>
                  <option value="never">Never</option>
                </select>
              </div>
            </div>
            {d.endMode === "weeks" && (
              <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
                <label>Number of weeks</label>
                <input type="number" min={1} value={d.count}
                  onChange={(e) => setD({ ...d, count: Number(e.target.value) })} />
              </div>
            )}
            {d.endMode === "until" && (
              <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
                <label>Until date</label>
                <input type="date" value={d.end_date} onChange={(e) => setD({ ...d, end_date: e.target.value })} />
              </div>
            )}
          </>
        )}

        {err && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{err}</div>}
        <div className="modal-foot" style={{ marginTop: 12 }}>
          {d.id && <button type="button" className="btn-secondary" style={{ marginRight: "auto" }} onClick={reset}>Cancel edit</button>}
          <button className="btn-primary" type="button" onClick={save}>{d.id ? "Save changes" : "Add event"}</button>
        </div>
      </div>
    </div>
  );
}
