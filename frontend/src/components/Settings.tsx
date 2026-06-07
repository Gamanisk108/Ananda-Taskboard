import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Calendar, Cake, CalendarRange, Repeat, Settings as SettingsIcon } from "lucide-react";
import { api } from "../api/client";
import { Modal, Spinner } from "./common";

interface S { daily_push_hour: number; daily_push_minute: number; timezone: string; }

const TZS = [
  "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York",
  "America/Anchorage", "Pacific/Honolulu", "Europe/London", "UTC",
];

export function Settings({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [s, setS] = useState<S | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => { api.get("/api/settings").then(setS).catch(() => setS(null)); }, []);

  async function save() {
    if (!s) return;
    setMsg("");
    try { await api.patch("/api/settings", s); setMsg(t("settings.saved")); setTimeout(() => setMsg(""), 2000); }
    catch { setMsg(t("settings.saveErr")); }
  }

  return (
    <Modal icon={<SettingsIcon />} title={t("modals.settings")} onClose={onClose}>
      {!s ? <Spinner /> : (
        <>
          <h3 className="section-title">{t("settings.pushTime")}</h3>
          <div className="row2">
            <div className="field">
              <label>{t("settings.hour")}</label>
              <input type="number" min={0} max={23} value={s.daily_push_hour}
                onChange={(e) => setS({ ...s, daily_push_hour: Number(e.target.value) })} />
            </div>
            <div className="field">
              <label>{t("settings.minute")}</label>
              <input type="number" min={0} max={59} value={s.daily_push_minute}
                onChange={(e) => setS({ ...s, daily_push_minute: Number(e.target.value) })} />
            </div>
          </div>
          <div className="field">
            <label>{t("settings.timezone")}</label>
            <select value={s.timezone} onChange={(e) => setS({ ...s, timezone: e.target.value })}>
              {TZS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
            {t("settings.pushTimeHelp")}
          </div>
          {msg && <div style={{ color: "var(--accent)", fontSize: 13, marginBottom: 10 }}>{msg}</div>}
          <div className="modal-foot" style={{ marginBottom: 8 }}>
            <button className="btn-primary" onClick={save}>{t("settings.saveTime")}</button>
          </div>

          <StatusManager />

          <EventsManager />

          <div className="modal-foot">
            <button className="btn-secondary" onClick={onClose}>{t("settings.close")}</button>
          </div>
        </>
      )}
    </Modal>
  );
}

interface St { id: number; key: string; label: string; color: string; order: number; is_complete: boolean; is_initial: boolean; }

function StatusManager() {
  const { t } = useTranslation();
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
    if (list.length <= 1) { alert(t("settings.keepOneStatus")); return; }
    if (!confirm(t("settings.confirmDeleteStatus", { name: s.label }))) return;
    await api.del(`/api/statuses/${s.id}`); load();
  }

  return (
    <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 14 }}>
      <h3 className="section-title">{t("settings.statusesTitle")}</h3>
      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
        {t("settings.statusesHelp")}
      </div>
      {list.map((s, idx) => (
        <div key={s.id} className="assignee-row" style={{ gap: 8 }}>
          <input type="color" value={s.color || "#6b7280"} onChange={(e) => patch(s, { color: e.target.value })} style={{ width: 38, padding: 2 }} />
          <input defaultValue={s.label} onBlur={(e) => e.target.value !== s.label && patch(s, { label: e.target.value })} style={{ flex: 1 }} />
          <input type="number" value={s.order} onChange={(e) => patch(s, { order: Number(e.target.value) })} style={{ width: 56 }} title={t("settings.orderTitle")} />
          <label className="muted" style={{ display: "flex", gap: 4, alignItems: "center", margin: 0, whiteSpace: "nowrap" }}>
            <input type="checkbox" style={{ width: "auto" }} checked={s.is_complete} onChange={(e) => patch(s, { is_complete: e.target.checked })} /> {t("settings.complete")}
          </label>
          <button type="button" className="btn-ghost icon-only" style={{ color: "var(--danger)" }} title={t("common.delete", "Delete")} onClick={() => remove(s)} disabled={idx === 0}><X size={16} /></button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 38, padding: 2 }} />
        <input placeholder={t("settings.newStatus")} value={label} onChange={(e) => setLabel(e.target.value)} />
        <button className="btn-secondary" type="button" onClick={add}>{t("settings.addStatus")}</button>
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
// date-fns weekday() order Mon=0..Sun=6 → catalog day-of-week keys.
const WD_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
// Line-art marker per event kind (design rule #5 — no emoji icons).
function KindIcon({ kind }: { kind: EvKind }) {
  const Icon = kind === "yearly" ? Cake : kind === "range" ? CalendarRange : kind === "repeating" ? Repeat : Calendar;
  return <Icon size={14} style={{ verticalAlign: "-2px", color: "var(--muted)" }} />;
}

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

function EventsManager() {
  const { t } = useTranslation();

  function summarize(e: Ev): string {
    if (e.kind === "yearly") return t("settings.evSumYearly", { date: e.date.slice(5) });
    if (e.kind === "range") return t("settings.evSumRange", { start: e.date, end: e.end_date ?? "?" });
    if (e.kind === "repeating") {
      const days = [...e.weekdays].sort((a, b) => a - b).map((d) => t(`cal.dow.${WD_KEYS[d]}`)).join(" & ") || "—";
      const every = e.interval > 1 ? t("settings.evEveryN", { n: e.interval }) : t("settings.evEveryWeekly");
      const end = e.count ? t("settings.evEndWeeks", { n: e.count })
        : e.end_date ? t("settings.evEndUntil", { date: e.end_date }) : "";
      return t("settings.evSumRepeating", { days, every, date: e.date, end });
    }
    return e.date;
  }

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
    if (!d.date || !d.title.trim()) { setErr(t("settings.errDateTitle")); return; }
    const payload: Record<string, unknown> = {
      kind: d.kind, date: d.date, title: d.title.trim(),
      end_date: null, weekdays: [], interval: 1, count: null,
    };
    if (d.kind === "range") {
      if (!d.end_date) { setErr(t("settings.errEndDate")); return; }
      payload.end_date = d.end_date;
    } else if (d.kind === "repeating") {
      if (d.weekdays.length === 0) { setErr(t("settings.errWeekday")); return; }
      payload.weekdays = d.weekdays;
      payload.interval = d.interval;
      if (d.endMode === "weeks") payload.count = d.count;
      else if (d.endMode === "until") {
        if (!d.end_date) { setErr(t("settings.errUntil")); return; }
        payload.end_date = d.end_date;
      }
    }
    try {
      if (d.id) await api.patch(`/api/events/${d.id}`, payload);
      else await api.post("/api/events", payload);
      reset(); load();
    } catch { setErr(t("settings.errSave")); }
  }

  async function remove(id: number) { await api.del(`/api/events/${id}`); load(); }

  const repeating = d.kind === "repeating";
  const ranged = d.kind === "range";

  return (
    <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 14 }}>
      <h3 className="section-title">{t("settings.eventsTitle")}</h3>
      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
        {t("settings.eventsHelp")}
      </div>

      {list.map((e) => (
        <div key={e.id} className="assignee-row" style={{ justifyContent: "space-between" }}>
          <span><KindIcon kind={e.kind} /> <strong>{e.title}</strong> · <span className="muted">{summarize(e)}</span></span>
          <span style={{ display: "flex", gap: 4 }}>
            <button type="button" className="btn-ghost" onClick={() => startEdit(e)}>{t("common.edit")}</button>
            <button type="button" className="btn-ghost icon-only" style={{ color: "var(--danger)" }} title={t("common.delete", "Delete")} onClick={() => remove(e.id)}><X size={16} /></button>
          </span>
        </div>
      ))}

      <div className="card" style={{ padding: 12, marginTop: 10, background: "var(--surface-sunk)" }}>
        <div className="row2">
          <div className="field" style={{ marginBottom: 0 }}>
            <label>{t("settings.evType")}</label>
            <select value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value as EvKind })}>
              <option value="single">{t("settings.evSingle")}</option>
              <option value="yearly">{t("settings.evYearly")}</option>
              <option value="range">{t("settings.evRange")}</option>
              <option value="repeating">{t("settings.evRepeating")}</option>
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>{t("settings.evTitle")}</label>
            <input placeholder={t("settings.evTitlePh")} value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
          </div>
        </div>

        <div className="row2" style={{ marginTop: 10 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>{ranged || repeating ? t("settings.startDate") : t("settings.date")}</label>
            <input type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
          </div>
          {ranged && (
            <div className="field" style={{ marginBottom: 0 }}>
              <label>{t("settings.endDate")}</label>
              <input type="date" value={d.end_date} onChange={(e) => setD({ ...d, end_date: e.target.value })} />
            </div>
          )}
        </div>

        {repeating && (
          <>
            <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
              <label>{t("settings.repeatOn")}</label>
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
                <label>{t("settings.everyWeeks")}</label>
                <input type="number" min={1} value={d.interval}
                  onChange={(e) => setD({ ...d, interval: Number(e.target.value) })} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>{t("settings.ends")}</label>
                <select value={d.endMode} onChange={(e) => setD({ ...d, endMode: e.target.value as EndMode })}>
                  <option value="weeks">{t("settings.endsWeeks")}</option>
                  <option value="until">{t("settings.endsUntil")}</option>
                  <option value="never">{t("settings.endsNever")}</option>
                </select>
              </div>
            </div>
            {d.endMode === "weeks" && (
              <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
                <label>{t("settings.numWeeks")}</label>
                <input type="number" min={1} value={d.count}
                  onChange={(e) => setD({ ...d, count: Number(e.target.value) })} />
              </div>
            )}
            {d.endMode === "until" && (
              <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
                <label>{t("settings.untilDate")}</label>
                <input type="date" value={d.end_date} onChange={(e) => setD({ ...d, end_date: e.target.value })} />
              </div>
            )}
          </>
        )}

        {err && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{err}</div>}
        <div className="modal-foot" style={{ marginTop: 12 }}>
          {d.id && <button type="button" className="btn-secondary" style={{ marginRight: "auto" }} onClick={reset}>{t("settings.cancelEdit")}</button>}
          <button className="btn-primary" type="button" onClick={save}>{d.id ? t("settings.saveChanges") : t("settings.addEvent")}</button>
        </div>
      </div>
    </div>
  );
}
