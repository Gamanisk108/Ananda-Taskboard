import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CircleCheck, Users as UsersIcon, Trash2, LayoutGrid, Plus, Sun, Moon, Share2, Copy, BookOpen, ChevronDown, CircleHelp,
  Settings as SettingsIcon, History as HistoryIcon, RotateCcw, ArrowLeftRight, Globe, LogOut, Languages, MoreHorizontal, Menu,
  List as ListIcon, Columns3, CalendarRange, CalendarDays, Hourglass, Sparkles } from "lucide-react";
import "./App.css";
import i18n, { resolveLanguage } from "./i18n";
import { applyOverrides } from "./trOverrides";
import { api } from "./api/client";
import { useAuth } from "./state/auth";
import { Login } from "./components/Login";
import { ResetPassword } from "./components/ResetPassword";
import { Privacy, Terms } from "./components/Legal";
import { VerifyEmail } from "./components/VerifyEmail";
import { AcceptInvite } from "./components/AcceptInvite";
import { CreateOrganization } from "./components/CreateOrganization";
import { AiGenerateModal } from "./components/AiGenerateModal";
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
import { WaitingForApproval } from "./components/WaitingForApproval";
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
  const [aiOpen, setAiOpen] = useState(false);
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
  const [showMyPending, setShowMyPending] = useState(false);
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

  // D50: the member's own pending submissions — badge on the account menu /
  // drawer entry (hidden at 0), opens the "Waiting for approval" list.
  const { data: myPending = [] } = useQuery({
    queryKey: ["tasks", "approvals-mine", me?.active_org ?? null],
    queryFn: () => api.get("/api/approvals/mine") as Promise<unknown[]>,
    enabled: !!me,
  });
  const myPendingCount = myPending.length;

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

  // Hosted legal pages (/privacy, /terms) — pre-auth; the backend SPA fallback
  // serves index.html for any path, so these are real linkable URLs.
  if (window.location.pathname === "/privacy") return <Privacy />;
  if (window.location.pathname === "/terms") return <Terms />;
  // Password-reset deep-link from the email (?reset&uid=…&token=…) — shown
  // standalone, before the auth gate, since the user is logged out here.
  if (new URLSearchParams(window.location.search).has("reset")) return <ResetPassword />;
  // Signup verification deep-link (?verify&uid=…&token=…) — also pre-auth.
  if (new URLSearchParams(window.location.search).has("verify")) return <VerifyEmail />;
  // Invitation accept deep-link (?invite=<id>&token=…) — also pre-auth.
  if (new URLSearchParams(window.location.search).has("invite")) return <AcceptInvite />;
  if (loading) return <Spinner />;
  if (!me) return <Login />;
  // Authenticated but in no org (social signup, or left their only team) → onboard.
  if (!me.memberships || me.memberships.length === 0) return <CreateOrganization />;

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

  // Admin/superuser nav, shared by the desktop inline buttons and the mobile
  // nav drawer. (D15: Trash + Help live in the account menu / drawer.)
  const navItems = [
    me.is_superuser && { icon: <Globe />, label: t("platform.nav"), onClick: () => setShowPlatform(true), testId: undefined as string | undefined },
    // D38: Translation review lives beside Platform overview (superadmin-only).
    me.is_superuser && { icon: <Languages />, label: t("trv.nav"), onClick: () => setShowTrReview(true), testId: "open-tr-review" },
    me.is_admin && { icon: <CircleCheck />, label: t("nav.approvals"), onClick: () => setShowApprovals(true), testId: undefined, badge: approvalsCount || undefined },
    me.is_admin && { icon: <UsersIcon />, label: t("nav.team"), onClick: () => setShowTeam(true), testId: "open-team" },
    me.is_admin && { icon: <LayoutGrid />, label: t("nav.projects"), onClick: () => setShowManage(true), testId: undefined },
  ].filter(Boolean) as { icon: React.ReactNode; label: string; onClick: () => void; testId?: string; badge?: number }[];
  // Account actions, shared by the desktop UserMenu and the mobile drawer.
  const accountItems = [
    // D50: "Pending approval" + count — first item, hidden at 0 (D6 rule).
    ...(myPendingCount > 0 ? [{ icon: <Hourglass size={15} />, label: t("menu.pendingApproval", "Pending approval"), onClick: () => setShowMyPending(true), testId: "open-my-pending", badge: myPendingCount }] : []),
    { icon: <CircleHelp size={15} />, label: t("help.open"), onClick: () => setShowHelp(true), testId: "open-help", dot: hasNewHelp },
    { icon: <SettingsIcon size={15} />, label: t("menu.settings"), onClick: () => setShowSettings(true), testId: "open-settings", dot: helpUsUnseen() },
    ...(me.is_admin ? [
      { icon: <HistoryIcon size={15} />, label: t("menu.history"), onClick: () => setShowHistory(true) },
      { icon: <RotateCcw size={15} />, label: t("menu.restorePoints"), onClick: () => setShowRestore(true) },
    ] : []),
    { icon: <ArrowLeftRight size={15} />, label: t("menu.bulkMigrate"), onClick: () => setShowBulk(true) },
    { icon: <BookOpen size={15} />, label: showArchived ? t("view.hideArchive") : t("view.archive"), onClick: () => { setView("list"); setShowArchived((a) => !a); }, testId: "toggle-archive" },
    { icon: <Trash2 size={15} />, label: t("nav.trash"), onClick: () => setShowTrash(true) },
  ] as { icon: React.ReactNode; label: string; onClick: () => void; testId?: string; dot?: boolean; badge?: number }[];

  // View-scoped actions (Share/Copy/Export/Import) — inline on desktop, behind
  // the appbar kebab on phones.
  const viewActions = (
    <>
      <ShareViewButton />
      <button className="btn-secondary" onClick={() => setShowSummary(true)}><Copy /><span className="lbl">{t("view.copySummary")}</span></button>
      <ExportDialog me={me} />
      {me.is_admin && <ImportDialog onImported={() => { refreshMe(); bump(); }} />}
    </>
  );

  return (
    <div className="app">
      {narrow ? (
        /* Mobile shell (design .appbar): one 54px bar — hamburger · brand · + · avatar.
           The drawer carries admin nav + account actions + the .duser footer. */
        <header className="appbar">
          <button className="ic" data-testid="nav-drawer-btn" aria-label={t("nav.menu", "Menu")}
            aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}><Menu /></button>
          <div className="title">
            <img className="mark" src="/logo.png" alt="" />
            <span className="brandcol">
              <span className="nm">Ananda <b>Taskboard</b></span>
              <span className="tagline">Love &amp; Blessings from Ananda Los Angeles</span>
            </span>
          </div>
          {canCreate && (
            <button className="ic primary" data-testid="new-task" aria-label={t("nav.newTask")}
              onClick={() => setEditing("new")}><Plus /></button>
          )}
          {/* Kebab = the view actions (Share/Copy/Export/Import), design .ic.kebab. */}
          <div className="view-overflow">
            <button type="button" className="ic" data-testid="view-overflow"
              aria-label={t("common.more", "More")} aria-expanded={actionsOpen}
              onClick={() => setActionsOpen((o) => !o)}><MoreHorizontal /></button>
            {actionsOpen && (
              <>
                <div className="vo-scrim" onClick={() => setActionsOpen(false)} />
                {/* Don't unmount on item click — ExportDialog/ImportDialog hold
                    their modal in their own state. The scrim dismisses. */}
                <div className="vo-pop">{viewActions}</div>
              </>
            )}
          </div>
          {drawerOpen && (
            <Drawer onClose={() => setDrawerOpen(false)}>
              <div className="dhead"><img src="/logo.png" alt="" /><span className="nm">Ananda <b>Taskboard</b></span></div>
              {me.memberships && me.memberships.length > 1 && (
                <div style={{ padding: "10px 14px 2px" }}>
                  <SingleSelect width="100%" value={me.active_org != null ? String(me.active_org) : ""}
                    onChange={(v) => { setDrawerOpen(false); switchOrg(Number(v)); }}
                    options={me.memberships.map((o) => ({ value: String(o.org_id), label: o.name }))} />
                </div>
              )}
              <nav className="dnav">
                {navItems.map((it, i) => (
                  <button key={i} data-testid={it.testId} onClick={() => { setDrawerOpen(false); it.onClick(); }}>
                    {it.icon}<span>{it.label}</span>
                    {it.badge != null && <span className="nav-badge">{it.badge}</span>}
                  </button>
                ))}
                {navItems.length > 0 && <div className="dsep" />}
                {accountItems.map((it, i) => (
                  <button key={`a${i}`} data-testid={it.testId} onClick={() => { setDrawerOpen(false); it.onClick(); }}>
                    {it.icon}<span>{it.label}</span>
                    {it.dot && <span className="dnav-dot" aria-hidden />}
                    {it.badge != null && <span className="nav-badge">{it.badge}</span>}
                  </button>
                ))}
                <div className="dsep" />
                <button onClick={() => { setDrawerOpen(false); logout(); }}>
                  <LogOut size={15} /><span>{t("menu.logout")}</span>
                </button>
              </nav>
              {/* .duser footer (design): avatar · name/email · theme toggle */}
              <div className="duser">
                <span className="av">{initials(me.name || me.email)}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="nm">{me.name || me.email}</div>
                  <div className="em">{me.email}</div>
                </div>
                <button className="theme" title={t("menu.theme")} onClick={() => changeTheme(isDark ? "light" : "dark")}>
                  {isDark ? <Sun /> : <Moon />}
                </button>
              </div>
            </Drawer>
          )}
        </header>
      ) : (
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
          {navItems.map((it, i) => (
            <button key={i} className="btn-ghost" data-testid={it.testId} onClick={it.onClick} title={it.label}>
              {it.icon}<span className="lbl">{it.label}</span>
              {it.badge != null && <span className="nav-badge">{it.badge}</span>}
            </button>
          ))}
          <span className="sep" />
          {canCreate && (
            <button className="btn-primary" data-testid="new-task" onClick={() => setEditing("new")} title={t("nav.newTask")}><Plus /><span className="lbl">{t("nav.newTask")}</span></button>
          )}
          {canCreate && (
            <button className="btn-secondary" data-testid="ai-generate" onClick={() => setAiOpen(true)} title={t("ai.title", "Generate tasks with AI")}><Sparkles /><span className="lbl">{t("ai.button", "AI")}</span></button>
          )}
          <UserMenu name={me.name || me.email} items={accountItems}
            anyDot={accountItems.some((it) => it.dot)} onLogout={logout} />
        </div>
      </header>
      )}

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
        {/* Desktop: inline action buttons. On phones they live behind the
            appbar kebab, and the whole viewbar row is hidden (CSS). */}
        {!narrow && <div className="right">{viewActions}</div>}
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

      {/* Mobile bottom tab bar (design .tabbar): the four views, line-art icons.
          Replaces the .seg switcher on phones (hidden via CSS). */}
      {narrow && (
        <nav className="tabbar" aria-label={t("nav.views", "Views")}>
          {([["list", <ListIcon key="i" />], ["board", <Columns3 key="i" />], ["weekly", <CalendarRange key="i" />], ["monthly", <CalendarDays key="i" />]] as [ViewMode, React.ReactNode][]).map(([v, icon]) => (
            <button key={v} type="button" className={`tb${view === v ? " on" : ""}`}
              aria-current={view === v ? "page" : undefined} onClick={() => setView(v)}>
              {icon}<span className="lab">{t(`view.${v}`)}</span>
            </button>
          ))}
        </nav>
      )}

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
      {aiOpen && (
        <AiGenerateModal
          me={me}
          onClose={() => setAiOpen(false)}
          onChanged={bump}
          onOpenTask={(task) => { setAiOpen(false); setEditing(task); }}
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
      {showMyPending && (
        <WaitingForApproval onClose={() => setShowMyPending(false)}
          onOpen={(t) => { setShowMyPending(false); setEditing(t); }} />
      )}
      {showWelcome && <WelcomeCard onClose={dismissWelcome} />}
    </div>
  );
}

/** Desktop account menu. Renders the SAME `accountItems` list the mobile
 *  drawer uses (one source of truth — the lists drifted before), plus the
 *  D15 separator after Help and the Logout row. */
function UserMenu({ name, items, anyDot, onLogout }: {
  name: string;
  items: { icon: React.ReactNode; label: string; onClick: () => void; testId?: string; dot?: boolean; badge?: number }[];
  anyDot: boolean;
  onLogout: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

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
        {anyDot && <span className="usermenu-pill-dot" aria-hidden />}
      </div>
      {open && (
        <div className="usermenu-pop">
          {items.map((it, i) => (
            <Fragment key={i}>
              <button className="usermenu-item" data-testid={it.testId} onClick={() => { setOpen(false); it.onClick(); }}>
                {it.icon} {it.label}
                {it.dot && <span className="dnav-dot" aria-hidden />}
                {it.badge != null && <span className="nav-badge">{it.badge}</span>}
              </button>
              {/* D15: Help (always first) sits above a separator. */}
              {i === 0 && <div className="usermenu-sep" />}
            </Fragment>
          ))}
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

