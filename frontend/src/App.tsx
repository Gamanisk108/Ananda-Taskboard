import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CircleCheck, Users as UsersIcon, Trash2, LayoutGrid, Plus, Sun, Moon, Share2, Copy, BookOpen, ChevronDown, CircleHelp,
  Settings as SettingsIcon, History as HistoryIcon, RotateCcw, ArrowLeftRight, Globe, LogOut, Languages, MoreHorizontal, Menu } from "lucide-react";
import "./App.css";
import i18n, { resolveLanguage } from "./i18n";
import { applyOverrides } from "./trOverrides";
import { api } from "./api/client";
import { useAuth } from "./state/auth";
import { Login } from "./components/Login";
import { ResetPassword } from "./components/ResetPassword";
import { VerifyEmail } from "./components/VerifyEmail";
import { AcceptInvite } from "./components/AcceptInvite";
import { PlatformStats } from "./components/PlatformStats";
import { Spinner, ColorDot, SingleSelect, Drawer, useIsNarrow } from "./components/common";
import { ListView } from "./components/ListView";
import { WeeklyView } from "./components/WeeklyView";
import { MonthlyView } from "./components/MonthlyView";
import { KanbanView } from "./components/KanbanView";
import { TaskModal } from "./components/TaskModal";
import { Approvals } from "./components/Approvals";
import { ManageProjects } from "./components/ManageProjects";
import { TeamAdmin } from "./components/TeamAdmin";
import { Settings } from "./components/Settings";
import { helpUsUnseen } from "./helpUsSeen";
import { TranslationReview } from "./components/TranslationReview";
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

  // Community-translation live overrides (D38): fetched at boot + on window
  // focus and merged over the bundled catalog — an approval goes live with no
  // redeploy. Resolution: override → bundled → English.
  const uiLang = resolveLanguage(me?.language);
  const { data: liveOverrides } = useQuery({
    queryKey: ["tr-overrides", uiLang],
    queryFn: () => api.get(`/api/translations/overrides?locale=${uiLang}`) as Promise<Record<string, string>>,
    enabled: !!me && uiLang !== "en",
    staleTime: 60_000,
  });
  useEffect(() => {
    if (liveOverrides) applyOverrides(uiLang, liveOverrides);
  }, [liveOverrides, uiLang]);

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
  const [showPlatform, setShowPlatform] = useState(false);
  const [showTrReview, setShowTrReview] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const narrow = useIsNarrow();
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

  // Pending-approvals badge for the admin nav button. Keyed under the ["tasks"]
  // prefix so bump() refreshes it after any task change (incl. approve/reject).
  const { data: pendingApprovals = [] } = useQuery({
    queryKey: ["tasks", "approvals-badge", me?.active_org ?? null],
    queryFn: () => api.get("/api/approvals") as Promise<unknown[]>,
    enabled: !!me?.is_admin,
  });
  const approvalsCount = pendingApprovals.length;

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
    if (v === "list" || v === "board" || v === "weekly" || v === "monthly") setView(v);
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

  // showArchived must ride along or the Archive toggle silently no-ops (the
  // pre-2026-06-10 viewbar button had this bug: it restyled but never filtered).
  const viewProps = { projectId, subprojectId, onEdit: (t: Task) => setEditing(t), me, showArchived };
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
            <SingleSelect value={me.active_org != null ? String(me.active_org) : ""}
              onChange={(v) => switchOrg(Number(v))}
              options={me.memberships.map((o) => ({ value: String(o.org_id), label: o.name }))} />
          )}
          {(() => {
            // Admin/superuser nav, shared by the desktop inline buttons and the
            // mobile nav drawer. (D15: Trash + Help live in the account menu.)
            const navItems = [
              me.is_superuser && { icon: <Globe />, label: t("platform.nav"), onClick: () => setShowPlatform(true), testId: undefined as string | undefined },
              // D38: Translation review lives beside Platform overview (superadmin-only).
              me.is_superuser && { icon: <Languages />, label: t("trv.nav"), onClick: () => setShowTrReview(true), testId: "open-tr-review" },
              me.is_admin && { icon: <CircleCheck />, label: t("nav.approvals"), onClick: () => setShowApprovals(true), testId: undefined, badge: approvalsCount || undefined },
              me.is_admin && { icon: <UsersIcon />, label: t("nav.team"), onClick: () => setShowTeam(true), testId: "open-team" },
              me.is_admin && { icon: <LayoutGrid />, label: t("nav.projects"), onClick: () => setShowManage(true), testId: undefined },
            ].filter(Boolean) as { icon: React.ReactNode; label: string; onClick: () => void; testId?: string; badge?: number }[];
            if (navItems.length === 0) return null;
            // Phones: one hamburger → nav drawer; desktop: inline ghost buttons.
            return narrow ? (
              <>
                <button className="btn-ghost btn-hamburger" data-testid="nav-drawer-btn" aria-label={t("nav.menu", "Menu")}
                  aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}><Menu /></button>
                {drawerOpen && (
                  <Drawer onClose={() => setDrawerOpen(false)}>
                    <div className="dhead"><img src="/logo.png" alt="" /><span className="nm">Ananda <b>Taskboard</b></span></div>
                    <nav className="dnav">
                      {navItems.map((it, i) => (
                        <button key={i} data-testid={it.testId} onClick={() => { setDrawerOpen(false); it.onClick(); }}>
                          {it.icon}<span>{it.label}</span>
                          {it.badge != null && <span className="nav-badge">{it.badge}</span>}
                        </button>
                      ))}
                    </nav>
                  </Drawer>
                )}
              </>
            ) : (
              navItems.map((it, i) => (
                <button key={i} className="btn-ghost" data-testid={it.testId} onClick={it.onClick} title={it.label}>
                  {it.icon}<span className="lbl">{it.label}</span>
                  {it.badge != null && <span className="nav-badge">{it.badge}</span>}
                </button>
              ))
            );
          })()}
          <span className="sep" />
          {canCreate && (
            <button className="btn-primary" data-testid="new-task" onClick={() => setEditing("new")} title={t("nav.newTask")}><Plus /><span className="lbl">{t("nav.newTask")}</span></button>
          )}
          <UserMenu
            name={me.name || me.email}
            isAdmin={me.is_admin}
            onSettings={() => setShowSettings(true)}
            onRestore={() => setShowRestore(true)}
            onHistory={() => setShowHistory(true)}
            onBulk={() => setShowBulk(true)}
            onHelp={() => setShowHelp(true)}
            onTrash={() => setShowTrash(true)}
            archived={showArchived}
            onToggleArchive={() => { setView("list"); setShowArchived((a) => !a); }}
            hasNewHelp={hasNewHelp}
            onLogout={logout}
          />
        </div>
      </header>

      <div className="tabrail">
        <nav className="tabs">
          {tree?.show_global_overview && (
            <button className={`ptab ${isGlobal ? "on" : ""}`} style={{ "--pc": "var(--muted)" } as React.CSSProperties}
              onClick={() => { setTopTab("global"); setSubTab(null); }}>
              <span className="pemoji" aria-hidden><Globe size={15} /></span>{t("nav.globalOverview")} <span className="count">{counts.total}</span>
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
        {(() => {
          const actions = (
            <>
              <ShareViewButton />
              <button className="btn-secondary" onClick={() => setShowSummary(true)}><Copy /><span className="lbl">{t("view.copySummary")}</span></button>
              <ExportDialog me={me} />
              {me.is_admin && <ImportDialog onImported={() => { refreshMe(); bump(); }} />}
            </>
          );
          // On phones the action buttons overflow the one-line viewbar → collapse
          // them into a ⋯ overflow menu (the buttons stack vertically inside).
          return narrow ? (
            <div className="right view-overflow">
              <button type="button" className="btn-secondary icon-only" data-testid="view-overflow"
                aria-label={t("common.more", "More")} aria-expanded={actionsOpen}
                onClick={() => setActionsOpen((o) => !o)}><MoreHorizontal /></button>
              {actionsOpen && (
                <>
                  <div className="vo-scrim" onClick={() => setActionsOpen(false)} />
                  {/* Don't close (unmount) the menu on an item click: ExportDialog /
                      ImportDialog keep their modal in their OWN state, so unmounting
                      them here would destroy the modal before it shows. The scrim
                      dismisses the menu; their modals open over it. */}
                  <div className="vo-pop">{actions}</div>
                </>
              )}
            </div>
          ) : (
            <div className="right">{actions}</div>
          );
        })()}
      </div>

      <main className="content">
        {me.tree.projects.length === 0 && !me.is_admin ? (
          <div className="empty" style={{ maxWidth: 460, margin: "40px auto", lineHeight: 1.5 }}>
            <img src="/ananda-empty.svg" alt="" width={140} height={136} style={{ display: "block", margin: "0 auto 10px" }} />
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
      {showSettings && (
        <Settings
          me={me}
          language={resolveLanguage(me.language)}
          onLanguage={changeLanguage}
          theme={theme}
          onTheme={changeTheme}
          dailyPushEnabled={me.daily_push_enabled}
          onToggleDailyPush={toggleDailyPush}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showTrash && <Trash onClose={() => setShowTrash(false)} onChanged={() => { refreshMe(); bump(); }} />}
      {showSummary && <CopySummary me={me} onClose={() => setShowSummary(false)} />}
      {showRestore && <RestorePoints onClose={() => setShowRestore(false)} onChanged={() => { refreshMe(); bump(); }} />}
      {showHistory && <History onClose={() => setShowHistory(false)} />}
      {showBulk && <BulkMigrate me={me} onClose={() => setShowBulk(false)} onChanged={() => { refreshMe(); bump(); }} />}
      {showPlatform && <PlatformStats onClose={() => setShowPlatform(false)} />}
      {showTrReview && <TranslationReview onClose={() => setShowTrReview(false)} />}
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

function UserMenu({ name, isAdmin, onSettings, onRestore, onHistory, onBulk, onHelp, onTrash, archived, onToggleArchive, hasNewHelp, onLogout }: {
  name: string; isAdmin: boolean;
  onSettings: () => void; onRestore: () => void; onHistory: () => void; onBulk: () => void;
  onHelp: () => void; onTrash: () => void; archived: boolean; onToggleArchive: () => void;
  hasNewHelp?: boolean; onLogout: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // D36: the purple dot rides the Settings row while Help Us is unseen.
  const helpUsDot = helpUsUnseen();
  const anyDot = hasNewHelp || helpUsDot;

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  return (
    <div className="usermenu" onClick={(e) => e.stopPropagation()}>
      <div className="user usermenu-btn" role="button" tabIndex={0} onClick={() => setOpen((o) => !o)} title={t("menu.account")} style={{ position: "relative" }}>
        <span className="avatar">{initials(name)}</span>
        <span className="lbl">{name}</span>
        <ChevronDown size={14} className="muted" />
        {/* D15/D36: purple What's-New dot rides the user pill when unseen features exist. */}
        {anyDot && <span aria-hidden style={{ position: "absolute", top: 2, left: 18, width: 8, height: 8, borderRadius: "50%", background: "var(--new, #6d4aff)", border: "1.5px solid var(--surface)" }} />}
      </div>
      {open && (
        <div className="usermenu-pop">
          {/* D15: Help & FAQ at the top of the account menu, available to everyone. */}
          <button className="usermenu-item" data-testid="open-help" onClick={() => { setOpen(false); onHelp(); }}>
            <CircleHelp size={15} /> {t("help.open")}
            {hasNewHelp && <span aria-hidden style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: "50%", background: "var(--new, #6d4aff)" }} />}
          </button>
          <div className="usermenu-sep" />
          {/* D36: Settings is member-visible (sections are role-filtered inside).
              Language, notifications, and the daily push now live in its panes. */}
          <button className="usermenu-item" data-testid="open-settings" onClick={() => { setOpen(false); onSettings(); }}>
            <SettingsIcon size={15} /> {t("menu.settings")}
            {helpUsDot && <span aria-hidden style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: "50%", background: "var(--new, #6d4aff)" }} />}
          </button>
          {isAdmin && (
            <button className="usermenu-item" onClick={() => { setOpen(false); onHistory(); }}>
              <HistoryIcon size={15} /> {t("menu.history")}
            </button>
          )}
          {isAdmin && (
            <button className="usermenu-item" onClick={() => { setOpen(false); onRestore(); }}>
              <RotateCcw size={15} /> {t("menu.restorePoints")}
            </button>
          )}
          {/* Bulk actions are open to everyone; members are limited to status/
              deadline on tasks they can edit (enforced server-side). */}
          <button className="usermenu-item" onClick={() => { setOpen(false); onBulk(); }}>
            <ArrowLeftRight size={15} /> {t("menu.bulkMigrate")}
          </button>
          {/* DN5: Archive toggle lives here (lean top bar), next to Trash. */}
          <button className="usermenu-item" data-testid="toggle-archive" title={t("view.archiveHint")}
            onClick={() => { setOpen(false); onToggleArchive(); }}>
            <BookOpen size={15} /> {archived ? t("view.hideArchive") : t("view.archive")}
          </button>
          {/* D15: Trash lives in the account menu (everyone; non-admins see only
              their own deleted items, server-enforced). */}
          <button className="usermenu-item" onClick={() => { setOpen(false); onTrash(); }}>
            <Trash2 size={15} /> {t("nav.trash")}
          </button>
          <div className="usermenu-sep" />
          <button className="usermenu-item" onClick={() => { setOpen(false); onLogout(); }}>
            <LogOut size={15} /> {t("menu.logout")}
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

