import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, X, LayoutGrid } from "lucide-react";
import { format } from "date-fns";
import { dfLocale } from "../dateLocale";
import { api } from "../api/client";
import { Modal, Spinner } from "./common";
import { useConfirm } from "./confirm";
import { DeleteWithMove } from "./DeleteWithMove";
import { EmojiPicker } from "./EmojiPicker";

/** "Jun 5, 2026" from an ISO timestamp, or null when missing/unparseable. */
function fmtCreated(d?: string): string | null {
  if (!d) return null;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : format(dt, "MMM d, yyyy", { locale: dfLocale() });
}

interface Sub {
  id: number;
  project: number;
  name: string;
  color: string;
  members_post_without_approval: boolean;
  is_default: boolean;
  created_at?: string;
}
interface Proj {
  id: number;
  name: string;
  color: string;
  emoji: string;
  subprojects: Sub[];
  created_at?: string;
}

export function ManageProjects({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [projects, setProjects] = useState<Proj[] | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<{ kind: "project" | "subproject"; id: number; name: string } | null>(null);

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
    await api.patch(`/api/projects/${p.id}`, { name: p.name, color: p.color, emoji: p.emoji });
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

  function deleteProject(p: Proj) {
    setDeleting({ kind: "project", id: p.id, name: p.name });
  }

  function deleteSub(s: Sub) {
    if (s.is_default) { alert(t("mp.cantDeleteDefault")); return; }
    setDeleting({ kind: "subproject", id: s.id, name: s.name });
  }

  async function markDone(kind: "project" | "subproject", id: number, name: string) {
    if (!(await confirm({ body: t("mp.markDoneConfirm", { name }), danger: false, confirmLabel: t("common.confirm", "Confirm") }))) return;
    const r = await api.post(`/api/${kind}/${id}/mark-done`, {}) as { updated: number };
    alert(t("mp.markDoneResult", { count: r.updated }));
    load(); onChanged();
  }

  if (!projects) return <Modal title={t("modals.projects")} onClose={onClose}><Spinner /></Modal>;

  if (deleting) {
    return (
      <DeleteWithMove
        kind={deleting.kind}
        id={deleting.id}
        name={deleting.name}
        projects={projects}
        onClose={() => setDeleting(null)}
        onDone={() => { setDeleting(null); load(); onChanged(); }}
      />
    );
  }

  return (
    <Modal icon={<LayoutGrid />} title={t("modals.projects")} onClose={onClose} wide>
      <div className="field" style={{ display: "flex", gap: 8 }}>
        <input placeholder={t("mp.newProjectPh")} value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} />
        <button className="btn-primary" onClick={addProject} disabled={busy}>{t("mp.addProject")}</button>
      </div>

      {projects.map((p) => (
        <ProjectEditor key={p.id} project={p} onSaveProject={saveProject} onAddSub={addSub}
          onSaveSub={saveSub} onDeleteProject={deleteProject} onDeleteSub={deleteSub} onMarkDone={markDone} />
      ))}
      {projects.length === 0 && <div className="empty">{t("empty.noProjects")}</div>}
    </Modal>
  );
}

function ProjectEditor({
  project, onSaveProject, onAddSub, onSaveSub, onDeleteProject, onDeleteSub, onMarkDone,
}: {
  project: Proj;
  onSaveProject: (p: Proj) => void;
  onAddSub: (projectId: number, name: string) => void;
  onSaveSub: (s: Sub) => void;
  onDeleteProject: (p: Proj) => void;
  onDeleteSub: (s: Sub) => void;
  onMarkDone: (kind: "project" | "subproject", id: number, name: string) => void;
}) {
  const { t } = useTranslation();
  const [p, setP] = useState(project);
  const [newSub, setNewSub] = useState("");
  useEffect(() => setP(project), [project]);

  return (
    <div className="card" style={{ padding: 12, marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <input type="color" value={p.color} onChange={(e) => setP({ ...p, color: e.target.value })} style={{ width: 44, padding: 2 }} />
        <EmojiPicker value={p.emoji} onPick={(em) => setP({ ...p, emoji: em })} title={t("mp.emojiTitle")} />
        <input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
        <button className="btn-secondary" onClick={() => onSaveProject(p)}>{t("common.save")}</button>
        <button className="btn-ghost" title={t("mp.doneTitle")} onClick={() => onMarkDone("project", project.id, p.name)}>{t("mp.doneAll")}</button>
        <button className="btn-danger" onClick={() => onDeleteProject(project)}>{t("common.delete")}</button>
        {fmtCreated(project.created_at) && (
          <span className="muted" style={{ marginLeft: "auto", fontSize: 12, whiteSpace: "nowrap" }}>
            {t("mp.created", "Created {{date}}", { date: fmtCreated(project.created_at) })}
          </span>
        )}
      </div>

      <div style={{ paddingLeft: 8 }}>
        {p.subprojects.map((s) => (
          <SubEditor key={s.id} sub={s} onSave={onSaveSub} onDelete={onDeleteSub} onMarkDone={onMarkDone} />
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <input placeholder={t("mp.newSubPh")} value={newSub} onChange={(e) => setNewSub(e.target.value)} />
          <button className="btn-ghost" onClick={() => { onAddSub(p.id, newSub); setNewSub(""); }}>{t("mp.addSub")}</button>
        </div>
      </div>
    </div>
  );
}

function SubEditor({ sub, onSave, onDelete, onMarkDone }: { sub: Sub; onSave: (s: Sub) => void; onDelete: (s: Sub) => void; onMarkDone: (kind: "project" | "subproject", id: number, name: string) => void }) {
  const { t } = useTranslation();
  const [s, setS] = useState(sub);
  useEffect(() => setS(sub), [sub]);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
      <input type="color" value={s.color} onChange={(e) => setS({ ...s, color: e.target.value })} style={{ width: 40, padding: 2 }} />
      <input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} disabled={s.is_default && s.name === "General"} />
      <label className="muted" style={{ display: "flex", gap: 5, alignItems: "center", whiteSpace: "nowrap", margin: 0 }}
        title={t("mp.trustedTitle")}>
        <input type="checkbox" style={{ width: "auto" }} checked={s.members_post_without_approval}
          onChange={(e) => setS({ ...s, members_post_without_approval: e.target.checked })} />
        {t("mp.trusted")}
      </label>
      <button className="btn-ghost" onClick={() => onSave(s)}>{t("common.save")}</button>
      <button className="btn-ghost icon-only" title={t("mp.doneTitle")} onClick={() => onMarkDone("subproject", sub.id, sub.name)}><Check size={16} /></button>
      {!s.is_default && <button className="btn-ghost icon-only" style={{ color: "var(--danger)" }} title={t("common.delete", "Delete")} onClick={() => onDelete(sub)}><X size={16} /></button>}
      {fmtCreated(sub.created_at) && (
        <span className="muted" style={{ marginLeft: "auto", fontSize: 11, whiteSpace: "nowrap" }}>
          {t("mp.created", "Created {{date}}", { date: fmtCreated(sub.created_at) })}
        </span>
      )}
    </div>
  );
}
