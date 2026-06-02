import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Modal, Spinner } from "./common";

interface Sub {
  id: number;
  project: number;
  name: string;
  color: string;
  members_post_without_approval: boolean;
  is_default: boolean;
}
interface Proj {
  id: number;
  name: string;
  color: string;
  subprojects: Sub[];
}

export function ManageProjects({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [projects, setProjects] = useState<Proj[] | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    api.get("/api/projects").then(setProjects).catch(() => setProjects([]));
  }
  useEffect(load, []);

  async function addProject() {
    if (!newProjectName.trim()) return;
    setBusy(true);
    try {
      await api.post("/api/projects", { name: newProjectName.trim() });
      setNewProjectName("");
      load();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function saveProject(p: Proj) {
    await api.patch(`/api/projects/${p.id}`, { name: p.name, color: p.color });
    load();
    onChanged();
  }

  async function addSub(projectId: number, name: string) {
    if (!name.trim()) return;
    await api.post("/api/subprojects", { project: projectId, name: name.trim() });
    load();
    onChanged();
  }

  async function saveSub(s: Sub) {
    await api.patch(`/api/subprojects/${s.id}`, {
      name: s.name, color: s.color, members_post_without_approval: s.members_post_without_approval,
    });
    load();
    onChanged();
  }

  if (!projects) return <Modal title="Manage projects" onClose={onClose}><Spinner /></Modal>;

  return (
    <Modal title="Manage projects" onClose={onClose} wide>
      <div className="field" style={{ display: "flex", gap: 8 }}>
        <input placeholder="New project name…" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} />
        <button className="btn-primary" onClick={addProject} disabled={busy}>Add project</button>
      </div>

      {projects.map((p) => (
        <ProjectEditor key={p.id} project={p} onSaveProject={saveProject} onAddSub={addSub} onSaveSub={saveSub} />
      ))}
      {projects.length === 0 && <div className="empty">No projects yet. Add one above.</div>}
    </Modal>
  );
}

function ProjectEditor({
  project, onSaveProject, onAddSub, onSaveSub,
}: {
  project: Proj;
  onSaveProject: (p: Proj) => void;
  onAddSub: (projectId: number, name: string) => void;
  onSaveSub: (s: Sub) => void;
}) {
  const [p, setP] = useState(project);
  const [newSub, setNewSub] = useState("");
  useEffect(() => setP(project), [project]);

  return (
    <div className="card" style={{ padding: 12, marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <input type="color" value={p.color} onChange={(e) => setP({ ...p, color: e.target.value })} style={{ width: 44, padding: 2 }} />
        <input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
        <button className="btn-secondary" onClick={() => onSaveProject(p)}>Save</button>
      </div>

      <div style={{ paddingLeft: 8 }}>
        {p.subprojects.map((s) => (
          <SubEditor key={s.id} sub={s} onSave={onSaveSub} />
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <input placeholder="New sub-project…" value={newSub} onChange={(e) => setNewSub(e.target.value)} />
          <button className="btn-ghost" onClick={() => { onAddSub(p.id, newSub); setNewSub(""); }}>+ Add sub-project</button>
        </div>
      </div>
    </div>
  );
}

function SubEditor({ sub, onSave }: { sub: Sub; onSave: (s: Sub) => void }) {
  const [s, setS] = useState(sub);
  useEffect(() => setS(sub), [sub]);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
      <input type="color" value={s.color} onChange={(e) => setS({ ...s, color: e.target.value })} style={{ width: 40, padding: 2 }} />
      <input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} disabled={s.is_default && s.name === "General"} />
      <label className="muted" style={{ display: "flex", gap: 5, alignItems: "center", whiteSpace: "nowrap", margin: 0 }}
        title="Members can post tasks here without admin approval">
        <input type="checkbox" style={{ width: "auto" }} checked={s.members_post_without_approval}
          onChange={(e) => setS({ ...s, members_post_without_approval: e.target.checked })} />
        trusted
      </label>
      <button className="btn-ghost" onClick={() => onSave(s)}>Save</button>
    </div>
  );
}
