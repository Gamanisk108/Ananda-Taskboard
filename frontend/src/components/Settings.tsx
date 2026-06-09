// Settings — left section-nav shell (design D36): Account · Notifications ·
// Task statuses · Calendar & holidays · Help Us. Open to EVERY member (audit
// ruling §2); the admin-only panes are role-filtered. The Account/Notifications
// panes absorb the account-menu language picker + push controls. Theme stays
// logo-side only (D25). The Help Us pane is the hub of community ask-cards;
// its flows replace this dialog rather than stack on it.

import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  X, Calendar, Cake, CalendarRange, Repeat, Settings as SettingsIcon,
  UserRound, Bell, ListChecks, Heart, Mail,
} from "lucide-react";
import { api } from "../api/client";
import { LANGUAGES } from "../i18n";
import { Modal, Spinner, SingleSelect, ColorPicker } from "./common";
import { useConfirm } from "./confirm";
import { HelpUsPane, ReportProblemDialog, SuggestFeatureDialog, SpreadWordDialog, type HelpUsFlow } from "./HelpUs";
import { ImproveTranslations } from "./ImproveTranslations";
import { helpUsUnseen, markHelpUsSeen } from "../helpUsSeen";
import type { Me } from "../types";

type SectionKey = "account" | "notifications" | "statuses" | "calendar" | "helpus";

export function Settings({ me, language, onLanguage, dailyPushEnabled, onToggleDailyPush, onClose }: {
  me: Me;
  language: string;
  onLanguage: (lang: string) => void;
  dailyPushEnabled: boolean;
  onToggleDailyPush: (enabled: boolean) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [active, setActive] = useState<SectionKey>("account");
  const [flow, setFlow] = useState<HelpUsFlow | null>(null);
  const [helpDot, setHelpDot] = useState(helpUsUnseen);

  function openSection(key: SectionKey) {
    setActive(key);
    if (key === "helpus") {
      markHelpUsSeen();
      setHelpDot(false);
    }
  }

  // The Help Us flows open as their own dialog in place of Settings (the design
  // shows them as standalone Settings-style dialogs — never stacked modals).
  if (flow === "translate") return <ImproveTranslations me={me} onClose={() => setFlow(null)} />;
  if (flow === "report") return <ReportProblemDialog onClose={() => setFlow(null)} />;
  if (flow === "suggest") return <SuggestFeatureDialog onClose={() => setFlow(null)} />;
  if (flow === "spread") return <SpreadWordDialog onClose={() => setFlow(null)} />;

  const sections: { key: SectionKey; icon: ReactNode; label: string; adminOnly?: boolean; dot?: boolean }[] = [
    { key: "account", icon: <UserRound size={16} />, label: t("settings.navAccount") },
    { key: "notifications", icon: <Bell size={16} />, label: t("settings.navNotifications") },
    { key: "statuses", icon: <ListChecks size={16} />, label: t("settings.navStatuses"), adminOnly: true },
    { key: "calendar", icon: <Calendar size={16} />, label: t("settings.navCalendar"), adminOnly: true },
    { key: "helpus", icon: <Heart size={16} />, label: t("settings.navHelpUs"), dot: helpDot },
  ];
  const visible = sections.filter((s) => !s.adminOnly || me.is_admin);

  return (
    <Modal icon={<SettingsIcon />} title={t("modals.settings")} onClose={onClose} wide>
      <div className="set-shell">
        <nav className="set-nav">
          {visible.map((s) => (
            <button key={s.key} type="button" className={`sn${active === s.key ? " on" : ""}`}
              data-testid={`settings-nav-${s.key}`} onClick={() => openSection(s.key)}>
              {s.icon}<span>{s.label}</span>
              {s.dot && <span className="nd" aria-hidden />}
            </button>
          ))}
        </nav>
        <div className="set-pane">
          {active === "account" && <AccountPane me={me} language={language} onLanguage={onLanguage} />}
          {active === "notifications" && (
            <NotificationsPane isAdmin={me.is_admin} dailyPushEnabled={dailyPushEnabled} onToggleDailyPush={onToggleDailyPush} />
          )}
          {active === "statuses" && me.is_admin && <StatusManager />}
          {active === "calendar" && me.is_admin && <EventsManager />}
          {active === "helpus" && <HelpUsPane onOpen={setFlow} />}
        </div>
      </div>
    </Modal>
  );
}

/* =====================================================================
   Account — identity (read-only) + UI language (absorbed from the menu)
   ===================================================================== */
function AccountPane({ me, language, onLanguage }: { me: Me; language: string; onLanguage: (lang: string) => void }) {
  const { t } = useTranslation();
  return (
    <>
      <h3 className="section-title" style={{ marginTop: 0 }}>{t("settings.navAccount")}</h3>
      <div className="field">
        <label>{t("settings.accountName")}</label>
        <input value={me.name} readOnly disabled />
      </div>
      <div className="field">
        <label>{t("settings.accountEmail")}</label>
        <input value={me.email} readOnly disabled />
      </div>
      <div className="field">
        <label>{t("menu.language")}</label>
        <SingleSelect width="100%" testId="language-select" value={language} onChange={onLanguage}
          options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))} />
      </div>
      <div className="muted" style={{ fontSize: 12 }}>{t("settings.accountHint")}</div>
    </>
  );
}

/* =====================================================================
   Notifications — personal browser-push + daily-push opt-out; the app-wide
   push TIME stays an admin control (moved here from the old top section).
   ===================================================================== */
interface S { daily_push_hour: number; daily_push_minute: number; timezone: string }

const TZS = [
  "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York",
  "America/Anchorage", "Pacific/Honolulu", "Europe/London", "UTC",
];

function NotificationsPane({ isAdmin, dailyPushEnabled, onToggleDailyPush }: {
  isAdmin: boolean; dailyPushEnabled: boolean; onToggleDailyPush: (enabled: boolean) => void;
}) {
  const { t } = useTranslation();
  const [msg, setMsg] = useState("");

  async function enableNotifications() {
    const { enablePush } = await import("../push");
    setMsg(await enablePush());
    setTimeout(() => setMsg(""), 3500);
  }

  return (
    <>
      <h3 className="section-title" style={{ marginTop: 0 }}>{t("settings.navNotifications")}</h3>
      <div className="field">
        <button type="button" className="btn-secondary" onClick={enableNotifications}>
          <Bell size={15} /> {msg || t("menu.notificationsOn")}
        </button>
      </div>
      <label className="field" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--text)", fontWeight: 500 }}>
        <Mail size={15} style={{ flex: "none", color: "var(--muted)" }} /> {t("menu.dailyPush")}
        <input type="checkbox" style={{ width: "auto", marginLeft: "auto" }}
          checked={dailyPushEnabled} onChange={(e) => onToggleDailyPush(e.target.checked)} />
      </label>
      {isAdmin && <PushTimeForm />}
    </>
  );
}

function PushTimeForm() {
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

  if (!s) return <Spinner />;
  return (
    <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 14 }}>
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
        <SingleSelect width="100%" value={s.timezone} onChange={(v) => setS({ ...s, timezone: v })}
          options={TZS.map((tz) => ({ value: tz, label: tz }))} />
      </div>
      <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
        {t("settings.pushTimeHelp")}
      </div>
      {msg && <div style={{ color: "var(--accent)", fontSize: 13, marginBottom: 10 }}>{msg}</div>}
      <div className="modal-foot" style={{ marginBottom: 8 }}>
        <button className="btn-primary" onClick={save}>{t("settings.saveTime")}</button>
      </div>
    </div>
  );
}

/* =====================================================================
   Task statuses (admin) — unchanged manager, now its own pane
   ===================================================================== */
interface St { id: number; key: string; label: string; color: string; order: number; is_complete: boolean; is_initial: boolean }

function StatusManager() {
  const { t } = useTranslation();
  const confirm = useConfirm();
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
    if (!(await confirm({ body: t("settings.confirmDeleteStatus", { name: s.label }), danger: true, confirmLabel: t("common.delete") }))) return;
    await api.del(`/api/statuses/${s.id}`); load();
  }

  return (
    <div>
      <h3 className="section-title" style={{ marginTop: 0 }}>{t("settings.statusesTitle")}</h3>
      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
        {t("settings.statusesHelp")}
      </div>
      {list.map((s, idx) => (
        <div key={s.id} className="assignee-row" style={{ gap: 8 }}>
          <ColorPicker value={s.color || "#6b7280"} onChange={(v) => patch(s, { color: v })} title={t("settings.statusColor", "Status color")} />
          <input defaultValue={s.label} onBlur={(e) => e.target.value !== s.label && patch(s, { label: e.target.value })} style={{ flex: 1 }} />
          <input type="number" value={s.order} onChange={(e) => patch(s, { order: Number(e.target.value) })} style={{ width: 56 }} title={t("settings.orderTitle")} />
          <label className="muted" style={{ display: "flex", gap: 4, alignItems: "center", margin: 0, whiteSpace: "nowrap" }}>
            <input type="checkbox" style={{ width: "auto" }} checked={s.is_complete} onChange={(e) => patch(s, { is_complete: e.target.checked })} /> {t("settings.complete")}
          </label>
          <button type="button" className="btn-ghost icon-only" style={{ color: "var(--danger)" }} title={t("common.delete", "Delete")} onClick={() => remove(s)} disabled={idx === 0}><X size={16} /></button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <ColorPicker value={color} onChange={setColor} title={t("settings.statusColor", "Status color")} />
        <input placeholder={t("settings.newStatus")} value={label} onChange={(e) => setLabel(e.target.value)} />
        <button className="btn-secondary" type="button" onClick={add}>{t("settings.addStatus")}</button>
      </div>
    </div>
  );
}

/* =====================================================================
   Calendar & holidays (admin) — the events manager pane
   ===================================================================== */
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
    <div>
      <h3 className="section-title" style={{ marginTop: 0 }}>{t("settings.eventsTitle")}</h3>
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
            <SingleSelect width="100%" value={d.kind} onChange={(v) => setD({ ...d, kind: v as EvKind })}
              options={[
                { value: "single", label: t("settings.evSingle") },
                { value: "yearly", label: t("settings.evYearly") },
                { value: "range", label: t("settings.evRange") },
                { value: "repeating", label: t("settings.evRepeating") },
              ]} />
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
                <SingleSelect width="100%" value={d.endMode} onChange={(v) => setD({ ...d, endMode: v as EndMode })}
                  options={[
                    { value: "weeks", label: t("settings.endsWeeks") },
                    { value: "until", label: t("settings.endsUntil") },
                    { value: "never", label: t("settings.endsNever") },
                  ]} />
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
