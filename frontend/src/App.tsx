import { useEffect, useMemo, useState } from "react";
import "./App.css";
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
import { RestorePoints } from "./components/RestorePoints";
import type { ProjectNode, Task } from "./types";

type ViewMode = "list" | "board" | "weekly" | "monthly";

export default function App() {
  const { me, loading, logout, refreshMe } = useAuth();
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
            <button className="btn-secondary" onClick={() => setShowApprovals(true)} title="Approvals">✅ Approvals</button>
          )}
          {me.is_admin && (
            <button className="btn-secondary" onClick={() => setShowTeam(true)} title="Team & permissions">👥 Team</button>
          )}
          {me.is_admin && (
            <button className="btn-secondary" onClick={() => setShowTrash(true)} title="Restore deleted items">♻️ Trash</button>
          )}
          {me.is_admin && (
            <button className="btn-secondary" onClick={() => setShowManage(true)} title="Manage projects">🗂️ Projects</button>
          )}
          {canCreate && (
            <button className="btn-primary" onClick={() => setEditing("new")} title="Create a task">＋ New task</button>
          )}
          <UserMenu
            name={me.name || me.email}
            isAdmin={me.is_admin}
            onSettings={() => setShowSettings(true)}
            onRestore={() => setShowRestore(true)}
            onLogout={logout}
          />
        </div>
      </header>

      <nav className="tabs">
        {tree?.show_global_overview && (
          <TabBtn active={isGlobal} onClick={() => { setTopTab("global"); setSubTab(null); }}>
            Global Overview
          </TabBtn>
        )}
        {projects.map((p) => (
          <TabBtn key={p.id} active={effectiveTop === p.id} onClick={() => { setTopTab(p.id); setSubTab(null); }}>
            <ColorDot color={p.color} /> {p.name}
          </TabBtn>
        ))}
        {projects.length === 0 && <span className="muted" style={{ padding: 10 }}>No projects yet.</span>}
      </nav>

      {currentProject && currentProject.show_project_overview && (
        <nav className="tabs subtabs">
          <TabBtn active={effectiveSub === "overview"} onClick={() => setSubTab("overview")}>
            Project Overview
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
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <ShareViewButton />
          <button className="btn-secondary" onClick={() => setShowSummary(true)}>Copy summary</button>
          <ExportButtons projectId={projectId} subprojectId={subprojectId} />
          <button
            className={showArchived && view === "list" ? "btn-primary" : "btn-secondary"}
            onClick={() => { setView("list"); setShowArchived((a) => !a); }}
            title="Completed tasks auto-archive after 7 days"
          >
            📖 {showArchived ? "Hide archive" : "Archive"}
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
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button className={`tab ${active ? "tab-on" : ""}`} onClick={onClick}>{children}</button>;
}

function UserMenu({ name, isAdmin, onSettings, onRestore, onLogout }: {
  name: string; isAdmin: boolean; onSettings: () => void; onRestore: () => void; onLogout: () => void;
}) {
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
      <button className="btn-secondary usermenu-btn" onClick={() => setOpen((o) => !o)} title="Account menu">
        {name} <span style={{ fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div className="usermenu-pop">
          {isAdmin && (
            <button className="usermenu-item" onClick={() => { setOpen(false); onSettings(); }}>
              <span>⚙️</span> Settings
            </button>
          )}
          {isAdmin && (
            <button className="usermenu-item" onClick={() => { setOpen(false); onRestore(); }}>
              <span>↻</span> Restore points
            </button>
          )}
          <button className="usermenu-item" onClick={enableNotifications}>
            <span>🔔</span> {msg || "Turn on notifications"}
          </button>
          <div className="usermenu-sep" />
          <button className="usermenu-item" onClick={() => { setOpen(false); onLogout(); }}>
            <span>🚪</span> Log out
          </button>
        </div>
      )}
    </div>
  );
}

function ShareViewButton() {
  const [label, setLabel] = useState("Share view");
  async function share() {
    const { shareUrl } = await import("./share");
    setLabel(await shareUrl(window.location.href));
    setTimeout(() => setLabel("Share view"), 2500);
  }
  return <button className="btn-secondary" onClick={share} title="Copy a link to this exact view">🔗 {label}</button>;
}

function ExportButtons({ projectId, subprojectId }: { projectId?: number; subprojectId?: number }) {
  function qs(fmt: string) {
    const p = new URLSearchParams({ fmt });
    if (subprojectId) p.set("subproject", String(subprojectId));
    else if (projectId) p.set("project", String(projectId));
    return p.toString();
  }
  const dl = (fmt: string, ext: string) =>
    import("./api/client").then(({ api }) => api.download(`/api/export?${qs(fmt)}`, `tasks.${ext}`));
  return (
    <>
      <button className="btn-secondary" onClick={() => dl("csv", "csv")}>Export CSV</button>
      <button className="btn-secondary" onClick={() => dl("xlsx", "xlsx")}>Export XLSX</button>
    </>
  );
}
