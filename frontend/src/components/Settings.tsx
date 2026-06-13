// Settings — left section-nav shell (D36/D44): Account · Notifications ·
// Task statuses (admin) · Events & Holidays · Help Us. Member-visible; the
// admin-only panes are role-filtered. v2 (D44–D48): Account gets a theme
// segmented + change-password sub-view + read-only email as text (D45);
// Notifications gets the digest/deadline/assignment toggles; Events & Holidays
// is tabbed with personal-vs-team scope (D47). Flows replace this dialog.

import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  X, Calendar, Cake, CalendarRange, Repeat, Settings as SettingsIcon,
  UserRound, Bell, ListChecks, Heart, ArrowLeft, Lock, Check, GripVertical, Info, Trash2, LogOut,
} from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../state/auth";
import { LANGUAGES } from "../i18n";
import { Modal, SingleSelect, ColorPicker } from "./common";
import { useConfirm } from "./confirm";
import { HelpUsPane, ReportProblemDialog, SuggestFeatureDialog, SpreadWordDialog, type HelpUsFlow } from "./HelpUs";
import { ImproveTranslations } from "./ImproveTranslations";
import { helpUsUnseen, markHelpUsSeen } from "../helpUsSeen";
import type { Me } from "../types";

type SectionKey = "account" | "notifications" | "statuses" | "calendar" | "helpus";

export function Settings({ me, language, onLanguage, theme, onTheme, dailyPushEnabled, onToggleDailyPush, onClose }: {
  me: Me;
  language: string;
  onLanguage: (lang: string) => void;
  theme: string;
  onTheme: (v: string) => void;
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

  // Events & Holidays + Notifications are member-visible (D47/§2); only Task
  // statuses stays admin-only.
  const sections: { key: SectionKey; icon: ReactNode; label: string; adminOnly?: boolean; dot?: boolean }[] = [
    { key: "account", icon: <UserRound size={16} />, label: t("settings.navAccount") },
    { key: "notifications", icon: <Bell size={16} />, label: t("settings.navNotifications") },
    { key: "statuses", icon: <ListChecks size={16} />, label: t("settings.navStatuses"), adminOnly: true },
    { key: "calendar", icon: <Calendar size={16} />, label: t("settings.navEvents") },
    { key: "helpus", icon: <Heart size={16} />, label: t("settings.navHelpUs"), dot: helpDot },
  ];
  const visible = sections.filter((s) => !s.adminOnly || me.is_admin);

  return (
    <Modal fullScreenOnNarrow icon={<SettingsIcon />} title={t("modals.settings")} onClose={onClose} wide>
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
          {active === "account" && (
            <AccountPane me={me} language={language} onLanguage={onLanguage} theme={theme} onTheme={onTheme} />
          )}
          {active === "notifications" && (
            <NotificationsPane me={me} isAdmin={me.is_admin} dailyPushEnabled={dailyPushEnabled} onToggleDailyPush={onToggleDailyPush} />
          )}
          {active === "statuses" && me.is_admin && <StatusManager />}
          {active === "calendar" && <EventsHolidaysPane isAdmin={me.is_admin} />}
          {active === "helpus" && <HelpUsPane onOpen={setFlow} />}
        </div>
      </div>
    </Modal>
  );
}

/* =====================================================================
   Account — name · read-only email (D45 static text) · language · theme
   segmented (D48 Light/Dark) · change-password sub-view (D48)
   ===================================================================== */
function AccountPane({ me, language, onLanguage, theme, onTheme }: {
  me: Me; language: string; onLanguage: (lang: string) => void; theme: string; onTheme: (v: string) => void;
}) {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const confirm = useConfirm();
  const [pwView, setPwView] = useState(false);
  const [delView, setDelView] = useState(false);
  const [name, setName] = useState(me.name);
  const orgName = me.memberships.find((x) => x.org_id === me.active_org)?.name ?? "";

  function saveName() {
    const v = name.trim();
    if (!v || v === me.name) return;
    api.patch("/api/me", { name: v }).catch(() => { /* keep local */ });
  }

  // Leave just this org (keep the account + any other orgs). Reversible by
  // re-invite, so a single confirm — no password re-auth (unlike Delete account).
  async function leaveOrg() {
    if (!(await confirm({
      body: t("settings.confirmLeaveOrg", { org: orgName }),
      danger: true, confirmLabel: t("settings.leaveOrg", "Leave organization"),
    }))) return;
    try { await api.post("/api/me/leave", {}); logout(); }
    catch (e) {
      const detail = (e as { data?: { detail?: string } })?.data;
      alert(detail?.detail || t("settings.leaveError", "Couldn't leave the organization."));
    }
  }

  if (pwView) return <ChangePassword onBack={() => setPwView(false)} />;
  if (delView) return <DeleteAccount onBack={() => setDelView(false)} />;

  const themeActive = theme === "dark" ? "dark" : "light";
  return (
    <>
      <h3 className="section-title" style={{ marginTop: 0 }}>{t("settings.navAccount")}</h3>
      <div className="field">
        <label>{t("settings.accountName")}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} />
      </div>
      {/* D45: read-only email renders as plain text, never a disabled input. */}
      <div className="field">
        <label>{t("settings.accountEmail")}</label>
        <div className="static-val">{me.email}</div>
        <div className="hint">{t("settings.emailHint")}</div>
      </div>
      <div className="field">
        <label>{t("menu.language")}</label>
        <SingleSelect width="100%" testId="language-select" value={language} onChange={onLanguage}
          options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))} />
      </div>
      <div className="field">
        <label>{t("settings.theme")}</label>
        <div className="an-seg" style={{ maxWidth: 220 }} role="group" aria-label={t("settings.theme")}>
          <button type="button" className={`an-seg-opt${themeActive === "light" ? " on" : ""}`}
            onClick={() => onTheme("light")}>{t("settings.themeLight")}</button>
          <button type="button" className={`an-seg-opt${themeActive === "dark" ? " on" : ""}`}
            onClick={() => onTheme("dark")}>{t("settings.themeDark")}</button>
        </div>
      </div>
      <div className="set-divider" />
      <button type="button" className="btn-secondary" onClick={() => setPwView(true)}>
        <Lock size={15} /> {t("settings.changePassword")}
      </button>
      {/* Danger zone (store-readiness): Leave organization (this team only) then
          Delete account (the whole account). Each on its own row, LEFT-most (D5). */}
      <div className="set-divider" />
      {orgName && (
        <button type="button" className="btn-secondary" data-testid="leave-org"
          style={{ marginBottom: 10 }} onClick={leaveOrg}>
          <LogOut size={15} /> {t("settings.leaveOrg", "Leave organization")}
        </button>
      )}
      <button type="button" className="btn-danger" data-testid="open-delete-account" onClick={() => setDelView(true)}>
        <Trash2 size={15} /> {t("settings.deleteAccount", "Delete account")}
      </button>
      <div className="legal-links" style={{ justifyContent: "flex-start", marginTop: 12 }}>
        <a href="/privacy" target="_blank" rel="noreferrer">{t("legal.privacy", "Privacy Policy")}</a>
        <span aria-hidden>·</span>
        <a href="/terms" target="_blank" rel="noreferrer">{t("legal.terms", "Terms of Service")}</a>
      </div>
    </>
  );
}

function DeleteAccount({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr("");
    setBusy(true);
    try {
      await api.post("/api/me/delete", { password });
      logout();
    } catch (e) {
      const detail = (e as { data?: { password?: string; detail?: string } })?.data;
      setErr(detail?.password || detail?.detail || t("settings.deleteError", "Couldn't delete the account."));
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="set-back" onClick={onBack}>
        <ArrowLeft size={15} /> {t("settings.navAccount")}
      </button>
      <div className="hu-head">
        <h3>{t("settings.deleteAccount", "Delete account")}</h3>
        <div className="sub">{t("settings.deleteAccountSub", "This permanently removes your account, sign-in, and personal data. Tasks and comments your team still needs stay, without your name on them. This can't be undone.")}</div>
      </div>
      <div className="field">
        <label>{t("settings.deleteConfirmPw", "Enter your password to confirm")}</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </div>
      {err && <div style={{ color: "var(--danger)", fontSize: 13 }}>{err}</div>}
      <div className="set-actions">
        {/* Delete on the LEFT in red (D5). */}
        <button type="button" className="btn-danger" disabled={!password || busy} onClick={submit}>
          <Trash2 size={14} /> {t("settings.deleteAccountCta", "Delete my account")}
        </button>
        <button type="button" className="btn-secondary" style={{ marginLeft: "auto" }} onClick={onBack}>{t("common.cancel")}</button>
      </div>
    </>
  );
}

function ChangePassword({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr("");
    if (next.length < 8) { setErr(t("settings.pwTooShort")); return; }
    if (next !== confirm) { setErr(t("settings.pwMismatch")); return; }
    setBusy(true);
    try {
      await api.post("/api/auth/password/change", { current_password: cur, new_password: next });
      onBack();
    } catch (e) {
      const detail = (e as { data?: { current_password?: string; new_password?: string[] } })?.data;
      setErr(detail?.current_password || detail?.new_password?.[0] || t("settings.pwError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="set-back" onClick={onBack}>
        <ArrowLeft size={15} /> {t("settings.navAccount")}
      </button>
      <div className="hu-head">
        <h3>{t("settings.changePassword")}</h3>
        <div className="sub">{t("settings.changePasswordSub")}</div>
      </div>
      <div className="field">
        <label>{t("settings.currentPassword")}</label>
        <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
      </div>
      <div className="field">
        <label>{t("settings.newPassword")}</label>
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)}
          placeholder={t("settings.pwPlaceholder")} autoComplete="new-password" />
      </div>
      <div className="field">
        <label>{t("settings.confirmPassword")}</label>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
      </div>
      {err && <div style={{ color: "var(--danger)", fontSize: 13 }}>{err}</div>}
      <div className="set-actions">
        <button type="button" className="btn-secondary" onClick={onBack}>{t("common.cancel")}</button>
        <button type="button" className="btn-primary" disabled={!cur || !next || busy} onClick={submit}>
          <Check size={14} /> {t("settings.updatePassword")}
        </button>
      </div>
    </>
  );
}

/* =====================================================================
   Notifications — daily digest + deadline reminders + assignment pings
   (free PWA web push). Digest TIME stays admin-org-wide; members see a note.
   ===================================================================== */
interface S { daily_push_hour: number; daily_push_minute: number; timezone: string }

const TZS = [
  "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York",
  "America/Anchorage", "Pacific/Honolulu", "Europe/London", "UTC",
];

function Toggle({ label, hint, on, onChange, disabled }: {
  label: string; hint?: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <label className="an-toggle" style={disabled ? { opacity: 0.5, pointerEvents: "none" } : undefined}>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} style={{ display: "none" }} />
      <span className={`an-tg${on ? " on" : ""}`}><span className="an-tg-knob" /></span>
      <span className="an-tg-tx">
        <span className="an-tg-lbl">{label}</span>
        {hint && <span className="an-tg-hint">{hint}</span>}
      </span>
    </label>
  );
}

function NotificationsPane({ me, isAdmin, dailyPushEnabled, onToggleDailyPush }: {
  me: Me; isAdmin: boolean; dailyPushEnabled: boolean; onToggleDailyPush: (enabled: boolean) => void;
}) {
  const { t } = useTranslation();
  const [msg, setMsg] = useState("");
  const [deadline, setDeadline] = useState(me.deadline_reminders ?? true);
  const [assign, setAssign] = useState(me.assignment_changes ?? false);

  async function enableNotifications() {
    const { enablePush } = await import("../push");
    setMsg(await enablePush());
    setTimeout(() => setMsg(""), 3500);
  }
  function patchPref(key: string, value: boolean) {
    api.patch("/api/me", { [key]: value }).catch(() => { /* keep local */ });
  }

  return (
    <>
      <h3 className="section-title" style={{ marginTop: 0 }}>{t("settings.navNotifications")}</h3>
      <div className="field">
        <button type="button" className="btn-secondary" onClick={enableNotifications}>
          <Bell size={15} /> {msg || t("menu.notificationsOn")}
        </button>
      </div>
      <div className="set-toggles">
        <Toggle label={t("settings.dailyDigest")} hint={t("settings.dailyDigestHint")}
          on={dailyPushEnabled} onChange={onToggleDailyPush} />
        <DigestTime isAdmin={isAdmin} disabled={!dailyPushEnabled} />
        <Toggle label={t("settings.deadlineReminders")} hint={t("settings.deadlineRemindersHint")}
          on={deadline} onChange={(v) => { setDeadline(v); patchPref("deadline_reminders", v); }} />
        <Toggle label={t("settings.assignmentChanges")} hint={t("settings.assignmentChangesHint")}
          on={assign} onChange={(v) => { setAssign(v); patchPref("assignment_changes", v); }} />
      </div>
      <div className="set-divider" />
      <div className="note an-spread-note"><Info size={15} /> {t("settings.pushDeliveryNote")}</div>
    </>
  );
}

function fmtHour(h: number): string {
  const am = h < 12;
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${am ? "AM" : "PM"}`;
}

function DigestTime({ isAdmin, disabled }: { isAdmin: boolean; disabled: boolean }) {
  const { t } = useTranslation();
  const [s, setS] = useState<S | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => { if (isAdmin) api.get("/api/settings").then(setS).catch(() => setS(null)); }, [isAdmin]);

  // Members can't read the org schedule — show an honest static note instead.
  if (!isAdmin) {
    return (
      <div className={`field${disabled ? " disabled" : ""}`} style={{ marginLeft: 49 }}>
        <div className="hint">{t("settings.digestTimeMemberNote")}</div>
      </div>
    );
  }
  if (!s) return null;

  async function save(next: S) {
    setS(next);
    try { await api.patch("/api/settings", next); setMsg(t("settings.saved")); setTimeout(() => setMsg(""), 1500); }
    catch { setMsg(t("settings.saveErr")); }
  }

  return (
    <div className={`field${disabled ? " disabled" : ""}`} style={{ marginLeft: 49, maxWidth: 260 }}>
      <label>{t("settings.digestTime")}</label>
      <div className="row2">
        <SingleSelect width="100%" value={String(s.daily_push_hour)}
          onChange={(v) => save({ ...s, daily_push_hour: Number(v) })}
          options={Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: fmtHour(h) }))} />
        <SingleSelect width="100%" value={s.timezone} onChange={(v) => save({ ...s, timezone: v })}
          options={TZS.map((tz) => ({ value: tz, label: tz }))} />
      </div>
      {msg && <div className="hint" style={{ color: "var(--done)" }}>{msg}</div>}
    </div>
  );
}

/* =====================================================================
   Task statuses (admin) — canonical manager: drag-reorder · circle swatch ·
   editable name · "Task Complete" pill toggle · add-row (D44)
   ===================================================================== */
interface St { id: number; key: string; label: string; color: string; order: number; is_complete: boolean; is_initial: boolean }

function StatusManager() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [list, setList] = useState<St[]>([]);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#6b7280");
  const [dragId, setDragId] = useState<number | null>(null);

  async function load() {
    const d = await api.get("/api/statuses");
    setList((d as St[]).sort((a, b) => a.order - b.order));
    const { invalidateStatuses } = await import("../statuses");
    invalidateStatuses();
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
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

  async function reorder(targetId: number) {
    if (dragId === null || dragId === targetId) return;
    const from = list.findIndex((x) => x.id === dragId);
    const to = list.findIndex((x) => x.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setList(next);
    setDragId(null);
    // Persist the new order for every row whose index changed.
    await Promise.all(next.map((s, i) => (s.order !== i ? api.patch(`/api/statuses/${s.id}`, { order: i }) : null)).filter(Boolean));
    load();
  }

  return (
    <div>
      <h3 className="section-title" style={{ marginTop: 0 }}>{t("settings.statusesTitle")}</h3>
      <div className="st-hint">{t("settings.statusesHelp")}</div>
      <div className="st-list">
        {list.map((s, idx) => (
          <div key={s.id} className="sub-row" draggable onDragStart={() => setDragId(s.id)}
            onDragOver={(e) => e.preventDefault()} onDrop={() => reorder(s.id)}>
            <span className="drag-handle" title={t("settings.dragReorder")}><GripVertical size={15} /></span>
            <ColorPicker value={s.color || "#6b7280"} onChange={(v) => patch(s, { color: v })} title={t("settings.statusColor", "Status color")} />
            <input type="text" defaultValue={s.label} onBlur={(e) => e.target.value !== s.label && patch(s, { label: e.target.value })} />
            {s.is_complete ? (
              <button type="button" className="pill st-complete" onClick={() => patch(s, { is_complete: false })}
                title={t("settings.markIncomplete")}>{t("settings.taskComplete")}</button>
            ) : (
              <button type="button" className="btn-ghost" style={{ fontSize: 11.5, color: "var(--faint)" }}
                onClick={() => patch(s, { is_complete: true })}>{t("settings.markComplete")}</button>
            )}
            <button type="button" className="btn-ghost icon-only" style={{ color: "var(--danger)" }}
              title={t("common.delete", "Delete")} onClick={() => remove(s)} disabled={idx === 0}><X size={16} /></button>
          </div>
        ))}
      </div>
      <div className="sub-add">
        <ColorPicker value={color} onChange={setColor} title={t("settings.statusColor", "Status color")} />
        <input placeholder={t("settings.newStatus")} value={label} onChange={(e) => setLabel(e.target.value)} />
        <button className="btn-secondary" type="button" onClick={add}>{t("settings.addStatus")}</button>
      </div>
    </div>
  );
}

/* =====================================================================
   Events & Holidays (D47) — two tabs; personal-vs-team scope. Members add
   personal events/holidays (only on their own board); admins manage org-wide.
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
  owner: number | null;
}

const WD_TOGGLES = [
  { n: 6, label: "S" }, { n: 0, label: "M" }, { n: 1, label: "T" }, { n: 2, label: "W" },
  { n: 3, label: "T" }, { n: 4, label: "F" }, { n: 5, label: "S" },
];
const WD_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
function KindIcon({ kind }: { kind: EvKind }) {
  const Icon = kind === "yearly" ? Cake : kind === "range" ? CalendarRange : kind === "repeating" ? Repeat : Calendar;
  return <Icon size={14} style={{ verticalAlign: "-2px", color: "var(--muted)" }} />;
}

type EndMode = "never" | "weeks" | "until";
interface Draft {
  id: number | null; kind: EvKind; date: string; end_date: string; weekdays: number[];
  interval: number; endMode: EndMode; count: number; title: string; personal: boolean;
}
const EMPTY_DRAFT: Draft = {
  id: null, kind: "single", date: "", end_date: "", weekdays: [], interval: 1,
  endMode: "weeks", count: 4, title: "", personal: false,
};

function EventsHolidaysPane({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"events" | "holidays">("events");
  return (
    <div>
      <h3 className="section-title" style={{ marginTop: 0 }}>{t("settings.navEvents")}</h3>
      <div className="an-seg pane-tabs" role="tablist">
        <button type="button" role="tab" className={`an-seg-opt${tab === "events" ? " on" : ""}`}
          onClick={() => setTab("events")}>{t("settings.tabEvents")}</button>
        <button type="button" role="tab" className={`an-seg-opt${tab === "holidays" ? " on" : ""}`}
          onClick={() => setTab("holidays")}>{t("settings.tabHolidays")}</button>
      </div>
      {tab === "events" ? <EventsTab isAdmin={isAdmin} /> : <HolidaysTab isAdmin={isAdmin} />}
    </div>
  );
}

function EventsTab({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [list, setList] = useState<Ev[]>([]);
  const [d, setD] = useState<Draft>({ ...EMPTY_DRAFT, personal: !isAdmin });
  const [err, setErr] = useState("");

  function summarize(e: Ev): string {
    if (e.kind === "yearly") return t("settings.evSumYearly", { date: e.date.slice(5) });
    if (e.kind === "range") return t("settings.evSumRange", { start: e.date, end: e.end_date ?? "?" });
    if (e.kind === "repeating") {
      const days = [...e.weekdays].sort((a, b) => a - b).map((x) => t(`cal.dow.${WD_KEYS[x]}`)).join(" & ") || "—";
      const every = e.interval > 1 ? t("settings.evEveryN", { n: e.interval }) : t("settings.evEveryWeekly");
      const end = e.count ? t("settings.evEndWeeks", { n: e.count })
        : e.end_date ? t("settings.evEndUntil", { date: e.end_date }) : "";
      return t("settings.evSumRepeating", { days, every, date: e.date, end });
    }
    return e.date;
  }

  function load() { api.get("/api/events").then(setList).catch(() => setList([])); }
  useEffect(load, []);
  function reset() { setD({ ...EMPTY_DRAFT, personal: !isAdmin }); setErr(""); }

  function startEdit(e: Ev) {
    setErr("");
    setD({
      id: e.id, kind: e.kind, date: e.date, end_date: e.end_date ?? "",
      weekdays: e.weekdays, interval: e.interval || 1,
      endMode: e.count ? "weeks" : e.end_date ? "until" : "never",
      count: e.count ?? 4, title: e.title, personal: e.owner !== null,
    });
  }
  function toggleDay(n: number) {
    setD((s) => ({ ...s, weekdays: s.weekdays.includes(n) ? s.weekdays.filter((x) => x !== n) : [...s.weekdays, n] }));
  }

  async function save() {
    setErr("");
    if (!d.date || !d.title.trim()) { setErr(t("settings.errDateTitle")); return; }
    const payload: Record<string, unknown> = {
      kind: d.kind, date: d.date, title: d.title.trim(), personal: d.personal,
      end_date: null, weekdays: [], interval: 1, count: null,
    };
    if (d.kind === "range") {
      if (!d.end_date) { setErr(t("settings.errEndDate")); return; }
      payload.end_date = d.end_date;
    } else if (d.kind === "repeating") {
      if (d.weekdays.length === 0) { setErr(t("settings.errWeekday")); return; }
      payload.weekdays = d.weekdays; payload.interval = d.interval;
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

  async function remove(e: Ev) {
    if (!(await confirm({ body: t("settings.confirmDeleteEvent", { name: e.title }), danger: true, confirmLabel: t("common.delete") }))) return;
    await api.del(`/api/events/${e.id}`); load();
  }

  const mine = list.filter((e) => e.owner !== null);
  const team = list.filter((e) => e.owner === null);
  const repeating = d.kind === "repeating";
  const ranged = d.kind === "range";

  function Row({ e, locked }: { e: Ev; locked: boolean }) {
    return (
      <div className="listrow">
        <span><KindIcon kind={e.kind} /> <strong>{e.title}</strong> · <span className="mutedtx">{summarize(e)}</span></span>
        {locked ? (
          <span className="lr-lock" title={t("settings.adminLocked")}><Lock size={15} /></span>
        ) : (
          <span className="lr-acts">
            <button type="button" className="btn-ghost" onClick={() => startEdit(e)}>{t("common.edit")}</button>
            <button type="button" className="btn-ghost icon-only lr-x" title={t("common.delete", "Delete")} onClick={() => remove(e)}><X size={16} /></button>
          </span>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="ev-card">
        <div className="ec-t">
          {d.id ? t("settings.editEvent") : t("settings.addEvent")}
          {isAdmin && (
            <div className="an-seg" style={{ maxWidth: 240, marginTop: 8 }}>
              <button type="button" className={`an-seg-opt${!d.personal ? " on" : ""}`} onClick={() => setD({ ...d, personal: false })}>{t("settings.scopeTeam")}</button>
              <button type="button" className={`an-seg-opt${d.personal ? " on" : ""}`} onClick={() => setD({ ...d, personal: true })}>{t("settings.scopePersonal")}</button>
            </div>
          )}
        </div>
        <div className="row2">
          <div className="field">
            <label>{t("settings.evType")}</label>
            <SingleSelect width="100%" value={d.kind} onChange={(v) => setD({ ...d, kind: v as EvKind })}
              options={[
                { value: "single", label: t("settings.evSingle") },
                { value: "yearly", label: t("settings.evYearly") },
                { value: "range", label: t("settings.evRange") },
                { value: "repeating", label: t("settings.evRepeating") },
              ]} />
          </div>
          <div className="field">
            <label>{t("settings.evTitle")}</label>
            <input placeholder={t("settings.evTitlePh")} value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
          </div>
        </div>
        <div className="row2" style={{ marginTop: 10 }}>
          <div className="field">
            <label>{ranged || repeating ? t("settings.startDate") : t("settings.date")}</label>
            <input type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
          </div>
          {ranged && (
            <div className="field">
              <label>{t("settings.endDate")}</label>
              <input type="date" value={d.end_date} onChange={(e) => setD({ ...d, end_date: e.target.value })} />
            </div>
          )}
        </div>
        {repeating && (
          <>
            <div className="field" style={{ marginTop: 10 }}>
              <label>{t("settings.repeatOn")}</label>
              <div style={{ display: "flex", gap: 4 }}>
                {WD_TOGGLES.map((w, i) => (
                  <button key={i} type="button" className={d.weekdays.includes(w.n) ? "btn-primary" : "btn-secondary"}
                    style={{ width: 34, padding: "6px 0" }} onClick={() => toggleDay(w.n)}>{w.label}</button>
                ))}
              </div>
            </div>
            <div className="row2" style={{ marginTop: 10 }}>
              <div className="field">
                <label>{t("settings.everyWeeks")}</label>
                <input type="number" min={1} value={d.interval} onChange={(e) => setD({ ...d, interval: Number(e.target.value) })} />
              </div>
              <div className="field">
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
              <div className="field" style={{ marginTop: 10 }}>
                <label>{t("settings.numWeeks")}</label>
                <input type="number" min={1} value={d.count} onChange={(e) => setD({ ...d, count: Number(e.target.value) })} />
              </div>
            )}
            {d.endMode === "until" && (
              <div className="field" style={{ marginTop: 10 }}>
                <label>{t("settings.untilDate")}</label>
                <input type="date" value={d.end_date} onChange={(e) => setD({ ...d, end_date: e.target.value })} />
              </div>
            )}
          </>
        )}
        {err && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{err}</div>}
        <div className="set-actions" style={{ maxWidth: "none" }}>
          {d.id && <button type="button" className="btn-secondary" style={{ marginRight: "auto" }} onClick={reset}>{t("settings.cancelEdit")}</button>}
          <button className="btn-primary" type="button" onClick={save}>{d.id ? t("settings.saveChanges") : t("settings.addEvent")}</button>
        </div>
      </div>

      <div className="sec-label">{t("settings.yourEvents")} <span className="own-tag">{t("settings.onlyYourBoard")}</span></div>
      {mine.length === 0 ? <div className="mutedtx" style={{ fontSize: 12.5, padding: "2px 8px" }}>{t("settings.noPersonalEvents")}</div>
        : mine.map((e) => <Row key={e.id} e={e} locked={false} />)}

      <div className="sec-label">
        {t("settings.teamEvents")}
        {!isAdmin && <span className="lr-lock"><Lock size={13} /></span>}
      </div>
      {team.length === 0 ? <div className="mutedtx" style={{ fontSize: 12.5, padding: "2px 8px" }}>{t("settings.noTeamEvents")}</div>
        : team.map((e) => <Row key={e.id} e={e} locked={!isAdmin} />)}
    </>
  );
}

/* ---- Holidays tab: custom personal/team holidays + org-wide holiday sets ---- */
interface PHoliday { id: number; name: string; month: number; day: number; owner: number | null }
interface HolidaySettings { enabled: string[]; available: string[] }
const HOLIDAY_SET_KEYS = ["us_federal", "us_observances", "christian", "hindu_festivals", "italy", "ananda_lineage"];

function HolidaysTab({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [list, setList] = useState<PHoliday[]>([]);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [personal, setPersonal] = useState(!isAdmin);
  const [sets, setSets] = useState<HolidaySettings | null>(null);

  function load() {
    api.get("/api/holidays/personal").then(setList).catch(() => setList([]));
    api.get("/api/holidays/settings").then(setSets).catch(() => setSets(null));
  }
  useEffect(load, []);

  async function addHoliday() {
    if (!name.trim() || !date) return;
    const [, m, d] = date.split("-").map(Number);
    await api.post("/api/holidays/personal", { personal, name: name.trim(), month: m, day: d });
    setName(""); setDate(""); load();
  }
  async function removeHoliday(h: PHoliday) {
    if (!(await confirm({ body: t("settings.confirmDeleteHoliday", { name: h.name }), danger: true, confirmLabel: t("common.delete") }))) return;
    await api.del(`/api/holidays/personal/${h.id}`); load();
  }
  async function toggleSet(key: string, on: boolean) {
    if (!sets) return;
    const enabled = on ? [...sets.enabled, key] : sets.enabled.filter((k) => k !== key);
    setSets({ ...sets, enabled });
    await api.patch("/api/holidays/settings", { enabled }).catch(() => load());
  }

  const mine = list.filter((h) => h.owner !== null);
  const team = list.filter((h) => h.owner === null);
  const enabled = new Set(sets?.enabled ?? []);

  function HolRow({ h, locked }: { h: PHoliday; locked: boolean }) {
    return (
      <div className="listrow">
        <span><Cake size={14} style={{ verticalAlign: "-2px", color: "var(--muted)" }} /> <strong>{h.name}</strong> · <span className="mutedtx">{monthName(h.month)} {h.day}</span></span>
        {locked ? (
          <span className="lr-lock" title={t("settings.adminLocked")}><Lock size={15} /></span>
        ) : (
          <span className="lr-acts">
            <button type="button" className="btn-ghost icon-only lr-x" title={t("common.delete", "Delete")} onClick={() => removeHoliday(h)}><X size={16} /></button>
          </span>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="ev-card">
        <div className="ec-t">
          {isAdmin ? t("settings.addHoliday") : <>{t("settings.addPersonalHoliday")} <span className="mutedtx">· {t("settings.onlyYourBoard")}</span></>}
          {isAdmin && (
            <div className="an-seg" style={{ maxWidth: 260, marginTop: 8 }}>
              <button type="button" className={`an-seg-opt${!personal ? " on" : ""}`} onClick={() => setPersonal(false)}>{t("settings.scopeTeamHoliday")}</button>
              <button type="button" className={`an-seg-opt${personal ? " on" : ""}`} onClick={() => setPersonal(true)}>{t("settings.scopePersonalHoliday")}</button>
            </div>
          )}
        </div>
        <div className="hol-addrow">
          <input placeholder={t("settings.holidayNamePh")} value={name} onChange={(e) => setName(e.target.value)} />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button type="button" className="btn-secondary" onClick={addHoliday}>{t("common.add", "Add")}</button>
        </div>
      </div>

      <div className="sec-label">{t("settings.yourHolidays")} <span className="own-tag">{t("settings.onlyYourBoard")}</span></div>
      {mine.length === 0 ? <div className="mutedtx" style={{ fontSize: 12.5, padding: "2px 8px" }}>{t("settings.noPersonalHolidays")}</div>
        : mine.map((h) => <HolRow key={h.id} h={h} locked={false} />)}

      <div className="sec-label">
        {t("settings.teamHolidays")}
        {!isAdmin && <span className="lr-lock"><Lock size={13} /></span>}
      </div>
      {team.length === 0 ? <div className="mutedtx" style={{ fontSize: 12.5, padding: "2px 8px" }}>{t("settings.noTeamHolidays")}</div>
        : team.map((h) => <HolRow key={h.id} h={h} locked={!isAdmin} />)}

      <div className="sec-label">
        {t("settings.teamHolidaySets")}
        {!isAdmin && <span className="lr-lock"><Lock size={13} /></span>}
      </div>
      {sets && HOLIDAY_SET_KEYS.map((key) => {
        const on = enabled.has(key);
        if (isAdmin) {
          return (
            <label key={key} className="holiday-set">
              <input type="checkbox" checked={on} onChange={(e) => toggleSet(key, e.target.checked)} />
              <span>
                <span className="hs-t">{t(`settings.hset.${key}`)}</span>
                <span className="hs-d">{t(`settings.hsetDesc.${key}`)}</span>
              </span>
            </label>
          );
        }
        // D45: members see read-only static rows (checkmark for enabled), not disabled checkboxes.
        if (!on) return null;
        return (
          <div key={key} className="holiday-set static">
            <span className="hset-on"><Check size={15} /></span>
            <span>
              <span className="hs-t">{t(`settings.hset.${key}`)}</span>
              <span className="hs-d">{t(`settings.hsetDesc.${key}`)}</span>
            </span>
          </div>
        );
      })}
    </>
  );
}

function monthName(m: number): string {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1] ?? String(m);
}
