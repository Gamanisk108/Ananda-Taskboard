import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CircleCheck, Users as UsersIcon, Trash2, LayoutGrid, Plus, Sun, Moon, Share2, Copy, BookOpen, ChevronDown } from "lucide-react";
import "./App.css";
import i18n, { LANGUAGES, resolveLanguage } from "./i18n";
import { api } from "./api/client";
import { useAuth } from "./state/auth";
import { Login } from "./components/Login";
import { ResetPassword } from "./components/ResetPassword";
import { Spinner, ColorDot } from "./components/common";
import { ListView } from "./components/ListView";
import { WeeklyView } from "./components/WeeklyView";
import { MonthlyView } from "./components/MonthlyView";
import { KanbanView } from "./components/KanbanView";
import { TaskModal } from "./components/TaskModal";
import { Approvals } from "./components/Approvals";
import { ManageProjects } from "./components/ManageProjects";
import { TeamAdmin } from "./components/TeamAdmin";
import { Settings } from "./components/Settings";
import { Trash } from "./components/Trash";
import { CopySummary } from "./components/CopySummary";
import { ExportDialog } from "./components/ExportDialog";
import { ImportDialog } from "./components/ImportDialog";
import { RestorePoints } from "./components/RestorePoints";
import { History } from "./components/History";
import { BulkMigrate } from "./components/BulkMigrate";
import type { ProjectNode, Task } from "./types";

type ViewMode = "list" | "board" | "weekly" | "monthly";

export default function App() {
  const { me, loading, logout, refreshMe } = useAuth();
  const { t } = useTranslation();

  // Apply the user's preferred UI language (falls back to browser locale → English).
  useEffect(() => {
    i18n.changeLanguage(resolveLanguage(me?.language));
  }, [me?.language]);

  async function changeLanguage(lang: string) {
    await i18n.changeLanguage(lang);
    try { await api.patch("/api/me", { language: lang }); refreshMe(); } catch { /* keep local change */ }
  }

  // Theme (light/dark/system). Cached in localStorage "at-theme" for instant paint;
  // also persisted per-user server-side so it follows the user across devices.
  const [theme, setTheme] = useState<string>(() => localStorage.getItem("at-theme") || "system");
  useEffect(() => {
    // Adopt the server-stored personal theme once the user loads (syncing state
    // from an external system — the authenticated profile).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (me?.theme) { setTheme(me.theme); localStorage.setItem("at-theme", me.theme); }
  }, [me?.theme]);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mql.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    if (theme === "system") { mql.addEventListener("change", apply); return () => mql.removeEventListener("change", apply); }
  }, [theme]);
  function changeTheme(v: string) {
    setTheme(v);
    localStorage.setItem("at-theme", v);
    api.patch("/api/me", { theme: v }).catch(() => { /* keep local change */ });
  }

  // Personal opt-in/out of the daily push (the app-wide schedule stays admin-set).
  async function toggleDailyPush(enabled: boolean) {
    try { await api.patch("/api/me", { daily_push_enabled: enabled }); refreshMe(); } catch { /* ignore */ }
  }

  const [topTab, setTopTab] = useState<"global" | number | null>(null);
  const [subTab, setSubTab] = useState<"overview" | number | null>(null);
  const [view, setView] = useState<ViewMode>("list");
  const [editing, setEditing] = useState<Task | "new" | null>(null);
  const [showApprovals, setShowApprovals] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  const tree = me?.tree;
  const projects = tree?.projects ?? [];

  const effectiveTop: "global" | number | null = useMemo(() => {
    if (topTab !== null) return topTab;
    if (tree?.show_global_overview) return "global";
    return projects[0]?.id ?? null;
  }, [topTab, tree, projects]);

  const currentProject: ProjectNode | undefined =
    typeof effectiveTop === "number" ? projects.find((p) => p.id === effectiveTop) : undefined;

  const effectiveSub: "overview" | number | null = useMemo(() => {
    if (!currentProject) return null;
    if (subTab !== null) return subTab;
    if (currentProject.show_project_overview) return "overview";
    return currentProject.subprojects[0]?.id ?? null;
  }, [subTab, currentProject]);

  // Load the universal statuses once logged in (used by pills, filters, Kanban).
  useEffect(() => {
    if (me) import("./statuses").then((m) => m.fetchStatuses(true));
  }, [me?.id]);

  // Deep-link IN: on first login, honor ?project / ?sub / ?view / ?task in the URL.
  useEffect(() => {
    if (!me) return;
    const q = new URLSearchParams(window.location.search);
    const proj = q.get("project"), sub = q.get("sub"), v = q.get("view"), task = q.get("task");
    if (proj === "global") setTopTab("global");
    else if (proj) setTopTab(Number(proj));
    if (sub) setSubTab(Number(sub));
    if (v === "list" || v === "weekly" || v === "monthly") setView(v);
    if (task) {
      import("./api/client").then(({ api }) =>
        api.get(`/api/tasks/${task}`).then((t) => setEditing(t as Task)).catch(() => {})
      );
    }
  }, [me?.id]); // once per login

  // Deep-link OUT: keep the URL in sync with the current view so it's shareable.
  useEffect(() => {
    if (!me) return;
    const q = new URLSearchParams();
    if (typeof effectiveTop === "number") q.set("project", String(effectiveTop));
    else if (effectiveTop === "global") q.set("project", "global");
    if (typeof effectiveSub === "number") q.set("sub", String(effectiveSub));
    q.set("view", view);
    window.history.replaceState(null, "", `?${q.toString()}`);
  }, [effectiveTop, effectiveSub, view, me?.id]);

  // Password-reset deep-link from the email (?reset&uid=…&token=…) — shown
  // standalone, before the auth gate, since the user is logged out here.
  if (new URLSearchParams(window.location.search).has("reset")) return <ResetPassword />;
  if (loading) return <Spinner />;
  if (!me) return <Login />;

  const isGlobal = effectiveTop === "global";
  const projectId = !isGlobal && currentProject ? currentProject.id : undefined;
  const subprojectId = !isGlobal && typeof effectiveSub === "number" ? effectiveSub : undefined;

  const canCreate =
    me.is_admin || projects.some((p) => p.subprojects.some((s) => s.level === "member"));

  const viewProps = { projectId, subprojectId, refreshKey, onEdit: (t: Task) => setEditing(t), me };
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/logo.png" alt="Ananda" />
          <div className="brand-txt">
            <div className="name">Ananda <b>Taskboard</b></div>
            <div className="tagline">Love &amp; Blessings from Ananda Los Angeles</div>
          </div>
          <button className="icon-btn btn-secondary" style={{ marginLeft: 4 }} title={t("menu.theme")}
            onClick={() => changeTheme(isDark ? "light" : "dark")}>
            {isDark ? <Sun /> : <Moon />}
          </button>
        </div>
        <div className="topbar-actions">
          {me.is_admin && (
            <button className="btn-ghost" onClick={() => setShowApprovals(true)} title={t("nav.approvals")}><CircleCheck /><span className="lbl">{t("nav.approvals")}</span></button>
          )}
          {me.is_admin && (
            <button className="btn-ghost" data-testid="open-team" onClick={() => setShowTeam(true)} title={t("nav.team")}><UsersIcon /><span className="lbl">{t("nav.team")}</span></button>
          )}
          {/* Trash is open to everyone — non-admins see only the tasks they
              themselves deleted (server-enforced); admins see all trash. */}
          <button className="btn-ghost" onClick={() => setShowTrash(true)} title={t("nav.trash")}><Trash2 /><span className="lbl">{t("nav.trash")}</span></button>
          {me.is_admin && (
            <button className="btn-ghost" onClick={() => setShowManage(true)} title={t("nav.projects")}><LayoutGrid /><span className="lbl">{t("nav.projects")}</span></button>
          )}
          <span className="sep" />
          {canCreate && (
            <button className="btn-primary" data-testid="new-task" onClick={() => setEditing("new")} title={t("nav.newTask")}><Plus /><span className="lbl">{t("nav.newTask")}</span></button>
          )}
          <UserMenu
            name={me.name || me.email}
            isAdmin={me.is_admin}
            language={resolveLanguage(me.language)}
            onLanguage={changeLanguage}
            theme={theme}
            onTheme={changeTheme}
            dailyPushEnabled={me.daily_push_enabled}
            onToggleDailyPush={toggleDailyPush}
            onSettings={() => setShowSettings(true)}
            onRestore={() => setShowRestore(true)}
            onHistory={() => setShowHistory(true)}
            onBulk={() => setShowBulk(true)}
            onLogout={logout}
          />
        </div>
      </header>

      <div className="tabrail">
        <nav className="tabs">
          {tree?.show_global_overview && (
            <button className={`ptab ${isGlobal ? "on" : ""}`} style={{ "--pc": "var(--muted)" } as React.CSSProperties}
              onClick={() => { setTopTab("global"); setSubTab(null); }}>
              <span className="pemoji">🌐</span>{t("nav.globalOverview")}
            </button>
          )}
          {projects.map((p) => (
            <button key={p.id} className={`ptab ${effectiveTop === p.id ? "on" : ""}`} style={{ "--pc": p.color } as React.CSSProperties}
              onClick={() => { setTopTab(p.id); setSubTab(null); }}>
              <span className="pemoji"><ColorDot color={p.color} /></span>{p.name}
            </button>
          ))}
          {projects.length === 0 && <span className="muted" style={{ padding: 10 }}>{t("nav.noProjects")}</span>}
        </nav>
      </div>

      {currentProject && currentProject.show_project_overview && (
        <nav className="subtabs">
          <button className={`subtab ${effectiveSub === "overview" ? "on" : ""}`} onClick={() => setSubTab("overview")}>
            {t("nav.projectOverview")}
          </button>
          {currentProject.subprojects.map((s) => (
            <button key={s.id} className={`subtab ${effectiveSub === s.id ? "on" : ""}`} onClick={() => setSubTab(s.id)}>
              <ColorDot color={s.color} /> {s.name}
            </button>
          ))}
        </nav>
      )}

      <div className="viewbar">
        <div className="seg">
          {(["list", "board", "weekly", "monthly"] as ViewMode[]).map((v) => (
            <button key={v} className={view === v ? "seg-on" : "seg-off"} onClick={() => setView(v)}>
              {t(`view.${v}`)}
            </button>
          ))}
        </div>
        <div className="right">
          <ShareViewButton />
          <button className="btn-secondary" onClick={() => setShowSummary(true)}><Copy /><span className="lbl">{t("view.copySummary")}</span></button>
          <ExportDialog me={me} />
          {me.is_admin && <ImportDialog onImported={() => { refreshMe(); bump(); }} />}
          <button
            className={showArchived && view === "list" ? "btn-primary" : "btn-secondary"}
            onClick={() => { setView("list"); setShowArchived((a) => !a); }}
            title={t("view.archiveHint")}
          >
            <BookOpen /><span className="lbl">{showArchived ? t("view.hideArchive") : t("view.archive")}</span>
          </button>
        </div>
      </div>

      <main className="content">
        {view === "list" && <ListView {...viewProps} />}
        {view === "board" && <KanbanView {...viewProps} />}
        {view === "weekly" && <WeeklyView {...viewProps} />}
        {view === "monthly" && <MonthlyView {...viewProps} />}
      </main>

      {editing && (
        <TaskModal
          task={editing === "new" ? null : editing}
          me={me}
          defaultProject={projectId}
          defaultSubproject={subprojectId}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); bump(); }}
          onChanged={bump}
        />
      )}
      {showApprovals && (
        <Approvals
          onClose={() => setShowApprovals(false)}
          onChanged={bump}
          onOpen={(t) => { setShowApprovals(false); setEditing(t); }}
        />
      )}
      {showManage && (
        <ManageProjects
          onClose={() => setShowManage(false)}
          onChanged={() => { refreshMe(); bump(); }}
        />
      )}
      {showTeam && (
        <TeamAdmin
          onClose={() => setShowTeam(false)}
          onChanged={() => { refreshMe(); bump(); }}
        />
      )}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      {showTrash && <Trash onClose={() => setShowTrash(false)} onChanged={() => { refreshMe(); bump(); }} />}
      {showSummary && <CopySummary me={me} onClose={() => setShowSummary(false)} />}
      {showRestore && <RestorePoints onClose={() => setShowRestore(false)} onChanged={() => { refreshMe(); bump(); }} />}
      {showHistory && <History onClose={() => setShowHistory(false)} />}
      {showBulk && <BulkMigrate me={me} onClose={() => setShowBulk(false)} onChanged={() => { refreshMe(); bump(); }} />}
    </div>
  );
}

function UserMenu({ name, isAdmin, language, onLanguage, theme, onTheme, dailyPushEnabled, onToggleDailyPush, onSettings, onRestore, onHistory, onBulk, onLogout }: {
  name: string; isAdmin: boolean; language: string; onLanguage: (lang: string) => void;
  theme: string; onTheme: (v: string) => void;
  dailyPushEnabled: boolean; onToggleDailyPush: (enabled: boolean) => void;
  onSettings: () => void; onRestore: () => void; onHistory: () => void; onBulk: () => void; onLogout: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  async function enableNotifications() {
    const { enablePush } = await import("./push");
    setMsg(await enablePush());
    setTimeout(() => setMsg(""), 3500);
  }

  return (
    <div className="usermenu" onClick={(e) => e.stopPropagation()}>
      <div className="user usermenu-btn" role="button" tabIndex={0} onClick={() => setOpen((o) => !o)} title={t("menu.account")}>
        <span className="avatar">{initials(name)}</span>
        <span className="lbl">{name}</span>
        <ChevronDown size={14} className="muted" />
      </div>
      {open && (
        <div className="usermenu-pop">
          {isAdmin && (
            <button className="usermenu-item" onClick={() => { setOpen(false); onSettings(); }}>
              <span>⚙️</span> {t("menu.settings")}
            </button>
          )}
          {isAdmin && (
            <button className="usermenu-item" onClick={() => { setOpen(false); onHistory(); }}>
              <span>🕰️</span> {t("menu.history")}
            </button>
          )}
          {isAdmin && (
            <button className="usermenu-item" onClick={() => { setOpen(false); onRestore(); }}>
              <span>↻</span> {t("menu.restorePoints")}
            </button>
          )}
          {/* Bulk actions are open to everyone; members are limited to status/
              deadline on tasks they can edit (enforced server-side). */}
          <button className="usermenu-item" onClick={() => { setOpen(false); onBulk(); }}>
            <span>↔</span> {t("menu.bulkMigrate")}
          </button>
          <button className="usermenu-item" onClick={enableNotifications}>
            <span>🔔</span> {msg || t("menu.notificationsOn")}
          </button>
          <label className="usermenu-item" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "default" }}>
            <span>📨</span> {t("menu.dailyPush")}
            <input type="checkbox" style={{ width: "auto", marginLeft: "auto" }}
              checked={dailyPushEnabled}
              onChange={(e) => onToggleDailyPush(e.target.checked)}
              onClick={(e) => e.stopPropagation()} />
          </label>
          <div className="usermenu-sep" />
          <label className="usermenu-item" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "default" }}>
            <span>🌐</span> {t("menu.language")}
            <select data-testid="language-select" value={language}
              onChange={(e) => onLanguage(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{ width: "auto", marginLeft: "auto" }}>
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </label>
          <label className="usermenu-item" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "default" }}>
            <span>🌗</span> {t("menu.theme")}
            <select data-testid="theme-select" value={theme}
              onChange={(e) => onTheme(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{ width: "auto", marginLeft: "auto" }}>
              <option value="system">{t("theme.system")}</option>
              <option value="light">{t("theme.light")}</option>
              <option value="dark">{t("theme.dark")}</option>
            </select>
          </label>
          <div className="usermenu-sep" />
          <button className="usermenu-item" onClick={() => { setOpen(false); onLogout(); }}>
            <span>🚪</span> {t("menu.logout")}
          </button>
        </div>
      )}
    </div>
  );
}

function ShareViewButton() {
  const { t } = useTranslation();
  const [label, setLabel] = useState("");
  async function share() {
    const { shareUrl } = await import("./share");
    setLabel(await shareUrl(window.location.href));
    setTimeout(() => setLabel(""), 2500);
  }
  return <button className="btn-secondary" onClick={share} title={t("view.shareHint")}><Share2 /><span className="lbl">{label || t("view.shareView")}</span></button>;
}

/** 1–2 char initials from a display name or email, for the user-pill avatar. */
function initials(name: string): string {
  const n = (name || "").trim();
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

