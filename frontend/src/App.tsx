import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import "./App.css";
import i18n, { LANGUAGES, resolveLanguage } from "./i18n";
import { api } from "./api/client";
import { useAuth } from "./state/auth";
import { Login } from "./components/Login";
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

  // Theme (light/dark/system). Persisted in localStorage "at-theme"; "system" follows OS.
  const [theme, setTheme] = useState<string>(() => localStorage.getItem("at-theme") || "system");
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mql.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    if (theme === "system") { mql.addEventListener("change", apply); return () => mql.removeEventListener("change", apply); }
  }, [theme]);
  function changeTheme(v: string) { setTheme(v); localStorage.setItem("at-theme", v); }

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

  if (loading) return <Spinner />;
  if (!me) return <Login />;

  const isGlobal = effectiveTop === "global";
  const projectId = !isGlobal && currentProject ? currentProject.id : undefined;
  const subprojectId = !isGlobal && typeof effectiveSub === "number" ? effectiveSub : undefined;

  const canCreate =
    me.is_admin || projects.some((p) => p.subprojects.some((s) => s.level === "member"));

  const viewProps = { projectId, subprojectId, refreshKey, onEdit: (t: Task) => setEditing(t), me };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="dot" style={{ background: "var(--primary)", width: 11, height: 11 }} />
          <strong>Ananda Taskboard</strong>
        </div>
        <div className="topbar-actions">
          {me.is_admin && (
            <button className="btn-secondary" onClick={() => setShowApprovals(true)} title={t("nav.approvals")}>✅ {t("nav.approvals")}</button>
          )}
          {me.is_admin && (
            <button className="btn-secondary" onClick={() => setShowTeam(true)} title={t("nav.team")}>👥 {t("nav.team")}</button>
          )}
          {me.is_admin && (
            <button className="btn-secondary" onClick={() => setShowTrash(true)} title={t("nav.trash")}>♻️ {t("nav.trash")}</button>
          )}
          {me.is_admin && (
            <button className="btn-secondary" onClick={() => setShowManage(true)} title={t("nav.projects")}>🗂️ {t("nav.projects")}</button>
          )}
          {canCreate && (
            <button className="btn-primary" data-testid="new-task" onClick={() => setEditing("new")} title={t("nav.newTask")}>＋ {t("nav.newTask")}</button>
          )}
          <UserMenu
            name={me.name || me.email}
            isAdmin={me.is_admin}
            language={resolveLanguage(me.language)}
            onLanguage={changeLanguage}
            theme={theme}
            onTheme={changeTheme}
            onSettings={() => setShowSettings(true)}
            onRestore={() => setShowRestore(true)}
            onHistory={() => setShowHistory(true)}
            onLogout={logout}
          />
        </div>
      </header>

      <nav className="tabs">
        {tree?.show_global_overview && (
          <TabBtn active={isGlobal} onClick={() => { setTopTab("global"); setSubTab(null); }}>
            {t("nav.globalOverview")}
          </TabBtn>
        )}
        {projects.map((p) => (
          <TabBtn key={p.id} active={effectiveTop === p.id} onClick={() => { setTopTab(p.id); setSubTab(null); }}>
            <ColorDot color={p.color} /> {p.name}
          </TabBtn>
        ))}
        {projects.length === 0 && <span className="muted" style={{ padding: 10 }}>{t("nav.noProjects")}</span>}
      </nav>

      {currentProject && currentProject.show_project_overview && (
        <nav className="tabs subtabs">
          <TabBtn active={effectiveSub === "overview"} onClick={() => setSubTab("overview")}>
            {t("nav.projectOverview")}
          </TabBtn>
          {currentProject.subprojects.map((s) => (
            <TabBtn key={s.id} active={effectiveSub === s.id} onClick={() => setSubTab(s.id)}>
              <ColorDot color={s.color} /> {s.name}
            </TabBtn>
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
        <div style={{ display: "flex", gap: 8 }}>
          <ShareViewButton />
          <button className="btn-secondary" onClick={() => setShowSummary(true)}>{t("view.copySummary")}</button>
          <ExportDialog me={me} />
          {me.is_admin && <ImportDialog onImported={() => { refreshMe(); bump(); }} />}
          <button
            className={showArchived && view === "list" ? "btn-primary" : "btn-secondary"}
            onClick={() => { setView("list"); setShowArchived((a) => !a); }}
            title="Completed tasks auto-archive after 7 days"
          >
            📖 {showArchived ? t("view.hideArchive") : t("view.archive")}
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
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button className={`tab ${active ? "tab-on" : ""}`} onClick={onClick}>{children}</button>;
}

function UserMenu({ name, isAdmin, language, onLanguage, theme, onTheme, onSettings, onRestore, onHistory, onLogout }: {
  name: string; isAdmin: boolean; language: string; onLanguage: (lang: string) => void;
  theme: string; onTheme: (v: string) => void;
  onSettings: () => void; onRestore: () => void; onHistory: () => void; onLogout: () => void;
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
      <button className="btn-secondary usermenu-btn" onClick={() => setOpen((o) => !o)} title={t("menu.account")}>
        {name} <span style={{ fontSize: 10 }}>▾</span>
      </button>
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
          <button className="usermenu-item" onClick={enableNotifications}>
            <span>🔔</span> {msg || t("menu.notificationsOn")}
          </button>
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
  return <button className="btn-secondary" onClick={share} title="Copy a link to this exact view">🔗 {label || t("view.shareView")}</button>;
}

