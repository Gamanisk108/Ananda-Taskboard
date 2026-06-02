import { useMemo, useState } from "react";
import "./App.css";
import { useAuth } from "./state/auth";
import { Login } from "./components/Login";
import { Spinner, ColorDot } from "./components/common";
import { ListView } from "./components/ListView";
import { WeeklyView } from "./components/WeeklyView";
import { MonthlyView } from "./components/MonthlyView";
import { TaskModal } from "./components/TaskModal";
import { Approvals } from "./components/Approvals";
import type { ProjectNode, Task } from "./types";

type ViewMode = "list" | "weekly" | "monthly";

export default function App() {
  const { me, loading, logout } = useAuth();
  const [topTab, setTopTab] = useState<"global" | number | null>(null);
  const [subTab, setSubTab] = useState<"overview" | number | null>(null);
  const [view, setView] = useState<ViewMode>("list");
  const [editing, setEditing] = useState<Task | "new" | null>(null);
  const [showApprovals, setShowApprovals] = useState(false);
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
            <button className="btn-secondary" onClick={() => setShowApprovals(true)}>Approvals</button>
          )}
          {canCreate && (
            <button className="btn-primary" onClick={() => setEditing("new")}>+ New task</button>
          )}
          <NotifyButton />
          <span className="muted" style={{ fontSize: 13 }}>{me.name || me.email}</span>
          <button className="btn-ghost" onClick={logout}>Sign out</button>
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
          {(["list", "weekly", "monthly"] as ViewMode[]).map((v) => (
            <button key={v} className={view === v ? "seg-on" : "seg-off"} onClick={() => setView(v)}>
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <CopySummaryButton />
          <ExportButtons projectId={projectId} subprojectId={subprojectId} />
        </div>
      </div>

      <main className="content">
        {view === "list" && <ListView {...viewProps} />}
        {view === "weekly" && <WeeklyView {...viewProps} />}
        {view === "monthly" && <MonthlyView {...viewProps} />}
      </main>

      {editing && (
        <TaskModal
          task={editing === "new" ? null : editing}
          me={me}
          defaultSubproject={subprojectId}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); bump(); }}
        />
      )}
      {showApprovals && <Approvals onClose={() => setShowApprovals(false)} onChanged={bump} />}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button className={`tab ${active ? "tab-on" : ""}`} onClick={onClick}>{children}</button>;
}

function NotifyButton() {
  const [msg, setMsg] = useState("");
  async function enable() {
    const { enablePush } = await import("./push");
    setMsg(await enablePush());
    setTimeout(() => setMsg(""), 3000);
  }
  return (
    <button className="btn-ghost" onClick={enable} title={msg || "Enable daily push notifications"}>
      {msg ? msg : "🔔"}
    </button>
  );
}

function CopySummaryButton() {
  const [label, setLabel] = useState("Copy summary");
  async function copy() {
    const { api } = await import("./api/client");
    const { text } = (await api.get("/api/summary/groupchat")) as { text: string };
    await navigator.clipboard.writeText(text);
    setLabel("Copied!");
    setTimeout(() => setLabel("Copy summary"), 2000);
  }
  return <button className="btn-secondary" onClick={copy}>{label}</button>;
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
