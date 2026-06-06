import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CircleCheck, Users as UsersIcon, Trash2, LayoutGrid, Plus, Sun, Moon, Share2, Copy, BookOpen, ChevronDown, CircleHelp } from "lucide-react";
import "./App.css";
import i18n, { LANGUAGES, resolveLanguage } from "./i18n";
import { api } from "./api/client";
import { useAuth } from "./state/auth";
import { Login } from "./components/Login";
import { ResetPassword } from "./components/ResetPassword";
import { VerifyEmail } from "./components/VerifyEmail";
import { AcceptInvite } from "./components/AcceptInvite";
import { PlatformStats } from "./components/PlatformStats";
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
import { HelpCenter } from "./components/HelpCenter";
import { WelcomeCard } from "./components/WelcomeCard";
import { whatsNew, latestVersion } from "./help/registry";
import type { ProjectNode, Task } from "./types";

type ViewMode = "list" | "board" | "weekly" | "monthly";

export default function App() {
  const { me, loading, logout, refreshMe, switchOrg } = useAuth();
  const { t } = useTranslation();

  // Apply the user's preferred UI language (falls back to browser locale → English).
  useEffect(() => {
    i18n.changeLanguage(resolveLanguage(me?.language));
  }, [me?.language]);

  // Keep <html lang> in sync with the active language (a11y/spellcheck/SEO). Driven
  // by i18next's own event so it updates regardless of what triggered the switch.
  useEffect(() => {
    const sync = (lng: string) => { document.documentElement.lang = lng; };
    sync(i18n.language);
    i18n.on("languageChanged", sync);
    return () => { i18n.off("languageChanged", sync); };
  }, []);

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
  const [showBulk, setShowBulk] = useState(false);
  const [showPlatform, setShowPlatform] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  // First-login welcome shows once ever (localStorage "at-onboarded"); "Show welcome
  // again" in Help re-arms it. What's-New dot compares the latest help version against
  // the last version the user opened Help at ("at-help-seen").
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem("at-onboarded"));
  // A first-ever browser starts "caught up": What's New then only surfaces features
  // added AFTER this first load (not every existing feature). Initializing to the
  // latest version also avoids a dot-flash before the persist effect below runs.
  const [helpSeen, setHelpSeen] = useState<string | null>(
    () => localStorage.getItem("at-help-seen") ?? latestVersion(),
  );
  useEffect(() => {
    if (localStorage.getItem("at-help-seen") == null) localStorage.setItem("at-help-seen", latestVersion());
  }, []);
  function dismissWelcome() { localStorage.setItem("at-onboarded", "1"); setShowWelcome(false); }
  function replayWelcome() { localStorage.removeItem("at-onboarded"); setShowHelp(false); setShowWelcome(true); }
  const queryClient = useQueryClient();
  // All task views (List/Board/Weekly/Monthly) + the tab counts now read through
  // TanStack Query under the ["tasks"] key prefix, so one invalidate refreshes them
  // all after any create/edit/delete/status/move/event change.
  const bump = () => queryClient.invalidateQueries({ queryKey: ["tasks"] });

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

  // Per-project task counts for the tab badges (design shows a count per tab). The
  // unfiltered task list is fetched via TanStack Query (key prefix ["tasks"], so
  // bump()'s invalidate refreshes it); counts are derived from the cached data.
  const { data: allTasks } = useQuery({
    queryKey: ["tasks", "all", me?.active_org ?? null],
    queryFn: () => api.get("/api/tasks") as Promise<Task[]>,
    enabled: !!me,
  });
  const counts = useMemo(() => {
    const ts = allTasks ?? [];
    const sub2proj = new Map<number, number>();
    for (const p of projects) for (const s of p.subprojects) sub2proj.set(s.id, p.id);
    const byProject: Record<number, number> = {};
    for (const tk of ts) {
      const pid = sub2proj.get(tk.subproject);
      if (pid != null) byProject[pid] = (byProject[pid] ?? 0) + 1;
    }
    return { total: ts.length, byProject };
  }, [allTasks, projects]);

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
  // Signup verification deep-link (?verify&uid=…&token=…) — also pre-auth.
  if (new URLSearchParams(window.location.search).has("verify")) return <VerifyEmail />;
  // Invitation accept deep-link (?invite=<id>&token=…) — also pre-auth.
  if (new URLSearchParams(window.location.search).has("invite")) return <AcceptInvite />;
  if (loading) return <Spinner />;
  if (!me) return <Login />;

  const isGlobal = effectiveTop === "global";
  const projectId = !isGlobal && currentProject ? currentProject.id : undefined;
  const subprojectId = !isGlobal && typeof effectiveSub === "number" ? effectiveSub : undefined;

  const canCreate =
    me.is_admin || projects.some((p) => p.subprojects.some((s) => s.level === "member"));

  const viewProps = { projectId, subprojectId, onEdit: (t: Task) => setEditing(t), me };
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const hasNewHelp = whatsNew(helpSeen, me.is_admin).length > 0;

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
          {me.memberships && me.memberships.length > 1 && (
            <select
              className="btn-secondary"
              value={me.active_org ?? ""}
              onChange={(e) => switchOrg(Number(e.target.value))}
              title={t("org.switch")}
              style={{ width: "auto" }}
            >
              {me.memberships.map((o) => (
                <option key={o.org_id} value={o.org_id}>{o.name}</option>
              ))}
            </select>
          )}
          {me.is_superuser && (
            <button className="btn-ghost" onClick={() => setShowPlatform(true)} title={t("platform.nav")}>🌐<span className="lbl">{t("platform.nav")}</span></button>
          )}
          {me.is_admin && (
            <button className="btn-ghost" onClick={() => setShowApprovals(true)} title={t("nav.approvals")}><CircleCheck /><span className="lbl">{t("nav.approvals")}</span></button>
          )}
          {me.is_admin && (
            <button className="btn-ghost" data-testid="open-team" onClick={() => setShowTeam(true)} title={t("nav.team")}><UsersIcon /><span className="lbl">{t("nav.team")}</span></button>
          )}
          {me.is_admin && (
            <button className="btn-ghost" onClick={() => setShowTrash(true)} title={t("nav.trash")}><Trash2 /><span className="lbl">{t("nav.trash")}</span></button>
          )}
          {me.is_admin && (
            <button className="btn-ghost" onClick={() => setShowManage(true)} title={t("nav.projects")}><LayoutGrid /><span className="lbl">{t("nav.projects")}</span></button>
          )}
          <button className="btn-ghost" data-testid="open-help" onClick={() => setShowHelp(true)} title={t("help.open")}
            style={{ position: "relative" }}>
            <CircleHelp /><span className="lbl">{t("help.open")}</span>
            {hasNewHelp && (
              <span aria-hidden style={{ position: "absolute", top: 4, right: 4, width: 8, height: 8, borderRadius: "50%", background: "var(--accent, #6d4aff)" }} />
            )}
          </button>
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
              <span className="pemoji">🌐</span>{t("nav.globalOverview")} <span className="count">{counts.total}</span>
            </button>
          )}
          {projects.map((p) => (
            <button key={p.id} className={`ptab ${effectiveTop === p.id ? "on" : ""}`} style={{ "--pc": p.color } as React.CSSProperties}
              onClick={() => { setTopTab(p.id); setSubTab(null); }}>
              <span className="pemoji"><ColorDot color={p.color} /></span>{p.name} <span className="count">{counts.byProject[p.id] ?? 0}</span>
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
        {me.tree.projects.length === 0 && !me.is_admin ? (
          <div className="empty" style={{ maxWidth: 460, margin: "40px auto", lineHeight: 1.5 }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>🌱</div>
            <h3 style={{ margin: "0 0 6px", color: "var(--text)" }}>{t("onboarding.welcomeTitle", "You're all set up!")}</h3>
            <p style={{ margin: 0 }}>{t("onboarding.welcomeBody", "An admin hasn't added you to any projects yet. As soon as they add you — or assign you a task — your work will appear right here.")}</p>
          </div>
        ) : (
          <>
            {view === "list" && <ListView {...viewProps} />}
            {view === "board" && <KanbanView {...viewProps} />}
            {view === "weekly" && <WeeklyView {...viewProps} />}
            {view === "monthly" && <MonthlyView {...viewProps} />}
          </>
        )}
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
      {showPlatform && <PlatformStats onClose={() => setShowPlatform(false)} />}
      {showHelp && (
        <HelpCenter
          onClose={() => setShowHelp(false)}
          isAdmin={me.is_admin}
          lang={resolveLanguage(me.language)}
          lastSeen={helpSeen}
          onSeen={() => setHelpSeen(latestVersion())}
          onReplayWelcome={replayWelcome}
        />
      )}
      {showWelcome && <WelcomeCard onClose={dismissWelcome} />}
    </div>
  );
}

function UserMenu({ name, isAdmin, language, onLanguage, theme, onTheme, onSettings, onRestore, onHistory, onBulk, onLogout }: {
  name: string; isAdmin: boolean; language: string; onLanguage: (lang: string) => void;
  theme: string; onTheme: (v: string) => void;
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
          {isAdmin && (
            <button className="usermenu-item" onClick={() => { setOpen(false); onBulk(); }}>
              <span>↔</span> {t("menu.bulkMigrate")}
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
  return <button className="btn-secondary" onClick={share} title={t("view.shareHint")}><Share2 /><span className="lbl">{label || t("view.shareView")}</span></button>;
}

/** 1–2 char initials from a display name or email, for the user-pill avatar. */
function initials(name: string): string {
  const n = (name || "").trim();
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

