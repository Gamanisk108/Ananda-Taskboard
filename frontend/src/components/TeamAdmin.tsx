import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { invalidateUsers } from "../users";
import { Modal, Spinner } from "./common";
import { SEES_LABEL, type Sees } from "../types";

type Tab = "members" | "groups" | "access" | "activity";

interface UserRow { id: number; name: string; email: string; role: string; is_active: boolean; is_admin: boolean; tier: number | null; }
interface GroupRow { id: number; name: string; member_ids: number[]; }
interface TierRow { id: number; name: string; default_sees: Sees; member_count: number; }
interface Sub { id: number; name: string; }
interface Proj { id: number; name: string; subprojects: Sub[]; }
interface Grant { id: number; user: number | null; group: number | null; tier: number | null; subproject: number | null; project: number | null; level: string; sees: Sees; }
interface Exclusion {
  id: number; user: number | null; group: number | null; tier: number | null;
  excluded_user: number | null; excluded_group: number | null; excluded_project: number | null;
  excluded_subproject: number | null; excluded_task: number | null;
}
interface AuditRow { id: number; actor: string; action: string; summary: string; created_at: string; }

const TIER_DESC: Record<Sees, string> = {
  own: "View assigned tasks only",
  subproject: "View all tasks in assigned Sub-Project",
  project: "View all tasks in assigned Project",
};

export function TeamAdmin({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const { t: tr } = useTranslation();  // `t` is used below as the tab loop var
  const [tab, setTab] = useState<Tab>("members");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [projects, setProjects] = useState<Proj[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [exclusions, setExclusions] = useState<Exclusion[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAll(signal = false) {
    const [u, g, t, p, gr, ex, au] = await Promise.all([
      api.get("/api/users"), api.get("/api/groups"), api.get("/api/tiers"),
      api.get("/api/projects"), api.get("/api/grants"), api.get("/api/exclusions"),
      api.get("/api/audit"),
    ]);
    setUsers(u as UserRow[]); setGroups(g as GroupRow[]); setTiers(t as TierRow[]);
    setProjects(p as Proj[]); setGrants(gr as Grant[]); setExclusions(ex as Exclusion[]);
    setAudit(au as AuditRow[]);
    setLoading(false);
    invalidateUsers();
    if (signal) onChanged();
  }
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);

  const labels: Record<Tab, string> = {
    members: tr("tabs.members"), groups: tr("tabs.groups"), access: tr("tabs.access"),
    activity: tr("tabs.activity"),
  };

  return (
    <Modal title={tr("modals.team")} onClose={onClose} wide>
      <div className="seg" style={{ marginBottom: 14 }}>
        {(["members", "groups", "access", "activity"] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? "seg-on" : "seg-off"} onClick={() => setTab(t)}>{labels[t]}</button>
        ))}
      </div>
      {loading ? <Spinner /> : (
        <>
          {tab === "members" && <Members users={users} tiers={tiers} reload={() => loadAll(true)} />}
          {tab === "groups" && <Groups groups={groups} users={users} reload={() => loadAll(true)} />}
          {tab === "access" && (
            <Access grants={grants} exclusions={exclusions} users={users} groups={groups}
              tiers={tiers} projects={projects} reload={() => loadAll(true)} />
          )}
          {tab === "activity" && <Activity rows={audit} />}
        </>
      )}
    </Modal>
  );
}

function Members({ users, tiers, reload }: { users: UserRow[]; tiers: TierRow[]; reload: () => void }) {
  const { t: tr } = useTranslation();
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); const [role, setRole] = useState("member");
  const [tier, setTier] = useState<string>("");
  const [err, setErr] = useState("");
  // optimistic local copy so role/tier/active changes show instantly (the full
  // reload runs in the background and re-syncs via the effect below).
  const [rows, setRows] = useState(users);
  useEffect(() => setRows(users), [users]);
  const patch = (id: number, p: Partial<UserRow>) => setRows((rs) => rs.map((u) => (u.id === id ? { ...u, ...p } : u)));

  async function add() {
    setErr("");
    try {
      await api.post("/api/users", { name, email, password, role, tier: tier ? Number(tier) : null });
      setName(""); setEmail(""); setPassword(""); setRole("member"); setTier("");
      reload();
    } catch { setErr(tr("ta.errAddMember")); }
  }
  async function setMemberRole(u: UserRow, r: string) { patch(u.id, { role: r, is_admin: r === "admin" }); try { await api.patch(`/api/users/${u.id}`, { role: r }); } catch { patch(u.id, { role: u.role }); } }
  async function setMemberTier(u: UserRow, t: string) { const tier = t ? Number(t) : null; patch(u.id, { tier }); try { await api.patch(`/api/users/${u.id}`, { tier }); } catch { patch(u.id, { tier: u.tier }); } }
  async function toggleActive(u: UserRow) { const next = !u.is_active; patch(u.id, { is_active: next }); try { await api.patch(`/api/users/${u.id}`, { is_active: next }); } catch { patch(u.id, { is_active: u.is_active }); } }
  async function resetPw(u: UserRow) {
    const pw = prompt(tr("ta.promptNewPw", { name: u.name || u.email }));
    if (pw) { await api.patch(`/api/users/${u.id}`, { password: pw }); alert(tr("ta.pwUpdated")); }
  }

  return (
    <>
      <div className="card" style={{ padding: 12, marginBottom: 14, background: "var(--surface-sunk)" }}>
        <h3 className="section-title">{tr("ta.addMemberTitle")}</h3>
        <div className="row2">
          <div className="field"><label>{tr("ta.name")}</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field"><label>{tr("login.email")}</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        </div>
        <div className="row2">
          <div className="field"><label>{tr("ta.startingPw")}</label><input value={password} onChange={(e) => setPassword(e.target.value)} placeholder={tr("ta.min8")} /></div>
          <div className="field"><label>{tr("ta.role")}</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="member">{tr("ta.roleMember")}</option><option value="admin">{tr("ta.roleAdmin")}</option>
            </select>
          </div>
        </div>
        <div className="field" style={{ maxWidth: "calc(50% - 6px)" }}>
          <label>{tr("ta.tier")} <span className="muted" style={{ fontWeight: 400 }}>{tr("ta.tierHint")}</span></label>
          <select value={tier} onChange={(e) => setTier(e.target.value)} disabled={role === "admin"}>
            <option value="">{tr("ta.noTierBlank")}</option>
            {tiers.map((t) => <option key={t.id} value={t.id}>{t.name} — {TIER_DESC[t.default_sees]}</option>)}
          </select>
        </div>
        {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8 }}>{err}</div>}
        <button className="btn-primary" onClick={add}>{tr("ta.addMember")}</button>
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{tr("ta.shareHint")}</div>
      </div>

      <table className="tbl">
        <thead><tr><th>{tr("ta.name")}</th><th>{tr("login.email")}</th><th>{tr("ta.role")}</th><th>{tr("ta.tier")}</th><th>{tr("ta.active")}</th><th></th></tr></thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td>{u.name || "—"}</td>
              <td className="muted">{u.email}</td>
              <td>
                <select value={u.role} onChange={(e) => setMemberRole(u, e.target.value)} style={{ width: "auto" }}>
                  <option value="member">{tr("ta.roleMember")}</option><option value="admin">{tr("ta.roleAdmin")}</option>
                </select>
              </td>
              <td>
                {u.is_admin ? <span className="muted" style={{ fontSize: 12 }}>{tr("ta.adminDash")}</span> : (
                  <select value={u.tier ?? ""} onChange={(e) => setMemberTier(u, e.target.value)} style={{ width: "auto", maxWidth: 210 }}>
                    <option value="">{tr("ta.noTier")}</option>
                    {tiers.map((t) => <option key={t.id} value={t.id}>{t.name} — {TIER_DESC[t.default_sees]}</option>)}
                  </select>
                )}
              </td>
              <td><button className="btn-ghost" onClick={() => toggleActive(u)}>{u.is_active ? tr("ta.active") : tr("ta.disabled")}</button></td>
              <td><button className="btn-ghost" onClick={() => resetPw(u)}>{tr("ta.resetPw")}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Groups({ groups, users, reload }: { groups: GroupRow[]; users: UserRow[]; reload: () => void }) {
  const { t: tr } = useTranslation();
  const [name, setName] = useState("");
  async function add() { if (name.trim()) { await api.post("/api/groups", { name: name.trim() }); setName(""); reload(); } }
  async function del(g: GroupRow) { if (confirm(tr("ta.confirmDeleteGroup", { name: g.name }))) { await api.del(`/api/groups/${g.id}`); reload(); } }
  async function toggleMember(g: GroupRow, uid: number) {
    const ids = g.member_ids.includes(uid) ? g.member_ids.filter((x) => x !== uid) : [...g.member_ids, uid];
    await api.patch(`/api/groups/${g.id}`, { member_ids: ids });
    reload();
  }
  return (
    <>
      <div className="field" style={{ display: "flex", gap: 8 }}>
        <input placeholder={tr("ta.newGroupPh")} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary" onClick={add}>{tr("ta.addGroup")}</button>
      </div>
      {groups.map((g) => (
        <div key={g.id} className="card" style={{ padding: 12, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <strong>{g.name}</strong>
            <button className="btn-danger" onClick={() => del(g)}>{tr("common.delete")}</button>
          </div>
          <div className="assignee-list">
            {users.map((u) => (
              <label key={u.id} className="assignee-row">
                <input type="checkbox" style={{ width: "auto" }} checked={g.member_ids.includes(u.id)} onChange={() => toggleMember(g, u.id)} />
                <span>{u.name || u.email}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
      {groups.length === 0 && <div className="empty">{tr("empty.noGroups")}</div>}
    </>
  );
}

function Activity({ rows }: { rows: AuditRow[] }) {
  const { t: tr } = useTranslation();
  return (
    <>
      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
        {tr("ta.activityHelp")}
      </div>
      {rows.length === 0 ? <div className="empty">{tr("empty.noActivity")}</div> : (
        <table className="tbl">
          <thead><tr><th>{tr("restore.colWhen")}</th><th>{tr("ta.who")}</th><th>{tr("ta.change")}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{r.created_at.slice(0, 16).replace("T", " ")}</td>
                <td style={{ fontSize: 13 }}>{r.actor}</td>
                <td style={{ fontSize: 13 }}>{r.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

type SubjectType = "user" | "group" | "tier";
type ExcType = "user" | "group" | "project" | "subproject" | "task";
const EXC_FIELD: Record<ExcType, keyof Exclusion> = {
  user: "excluded_user", group: "excluded_group", project: "excluded_project",
  subproject: "excluded_subproject", task: "excluded_task",
};

function Access({
  grants, exclusions, users, groups, tiers, projects, reload,
}: {
  grants: Grant[]; exclusions: Exclusion[]; users: UserRow[]; groups: GroupRow[];
  tiers: TierRow[]; projects: Proj[]; reload: () => void;
}) {
  const { t: tr } = useTranslation();
  const [subjectType, setSubjectType] = useState<SubjectType>("user");
  const [subjectId, setSubjectId] = useState<number>(0);

  // grant builder
  const [scopeType, setScopeType] = useState<"subproject" | "project">("subproject");
  const [scopeId, setScopeId] = useState<number>(0);
  const [level, setLevel] = useState("member");
  const [sees, setSees] = useState<Sees>("subproject");
  const [err, setErr] = useState("");

  // exclusion builder
  const [excType, setExcType] = useState<ExcType>("task");
  const [excId, setExcId] = useState<string>("");

  const subjects = subjectType === "user" ? users.map((u) => ({ id: u.id, label: u.name || u.email }))
    : subjectType === "group" ? groups.map((g) => ({ id: g.id, label: g.name }))
    : tiers.map((t) => ({ id: t.id, label: t.name }));

  const subOptions = useMemo(
    () => projects.flatMap((p) => p.subprojects.map((s) => ({ id: s.id, label: `${p.name} / ${s.name}` }))),
    [projects],
  );
  const subName = (id: number) => subOptions.find((s) => s.id === id)?.label ?? "sub-project";
  const projName = (id: number) => projects.find((p) => p.id === id)?.name ?? "project";
  const userName = (id: number) => { const u = users.find((x) => x.id === id); return u ? (u.name || u.email) : `#${id}`; };
  const groupName = (id: number) => groups.find((g) => g.id === id)?.name ?? `#${id}`;

  const myGrants = grants.filter((g) => g[subjectType] === subjectId);
  const myExclusions = exclusions.filter((e) => e[subjectType] === subjectId);

  async function addGrant() {
    setErr("");
    if (!subjectId || !scopeId) { setErr(tr("ta.errPickSubjectScope")); return; }
    const body: Record<string, unknown> = { level, sees };
    body[subjectType] = subjectId;
    body[scopeType] = scopeId;
    try { await api.post("/api/grants", body); setScopeId(0); reload(); }
    catch { setErr(tr("ta.errAddGrant")); }
  }
  async function revokeGrant(id: number) { await api.del(`/api/grants/${id}`); reload(); }
  async function changeSees(g: Grant, s: Sees) { await api.patch(`/api/grants/${g.id}`, { sees: s }); reload(); }

  async function addExclusion() {
    setErr("");
    if (!subjectId) { setErr(tr("ta.errPickSubject")); return; }
    const id = Number(excId);
    if (!id) { setErr(tr("ta.errPickExclude")); return; }
    const body: Record<string, unknown> = {};
    body[subjectType] = subjectId;
    body[EXC_FIELD[excType]] = id;
    try { await api.post("/api/exclusions", body); setExcId(""); reload(); }
    catch { setErr(tr("ta.errAddExclusion")); }
  }
  async function removeExclusion(id: number) { await api.del(`/api/exclusions/${id}`); reload(); }

  function excLabel(e: Exclusion): string {
    if (e.excluded_task) return tr("ta.excTask", { id: e.excluded_task });
    if (e.excluded_user) return tr("ta.excPerson", { name: userName(e.excluded_user) });
    if (e.excluded_group) return `👥 ${groupName(e.excluded_group)}`;
    if (e.excluded_project) return tr("ta.excProject", { name: projName(e.excluded_project) });
    if (e.excluded_subproject) return tr("ta.excSub", { name: subName(e.excluded_subproject) });
    return "?";
  }

  // options for the exclusion target selector (task uses a number input instead)
  const excOptions = excType === "user" ? users.map((u) => ({ id: u.id, label: u.name || u.email }))
    : excType === "group" ? groups.map((g) => ({ id: g.id, label: g.name }))
    : excType === "project" ? projects.map((p) => ({ id: p.id, label: p.name }))
    : excType === "subproject" ? subOptions : [];

  return (
    <>
      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
        {tr("ta.accessHelp")}
      </div>

      <div className="field" style={{ maxWidth: 360 }}>
        <label>{tr("ta.defineAccessFor")}</label>
        <div style={{ display: "flex", gap: 6 }}>
          <select data-testid="access-subject-type" value={subjectType} onChange={(e) => { setSubjectType(e.target.value as SubjectType); setSubjectId(0); }} style={{ width: 110 }}>
            <option value="user">{tr("ta.subjPerson")}</option><option value="group">{tr("ta.subjGroup")}</option><option value="tier">{tr("ta.tier")}</option>
          </select>
          <select data-testid="access-subject-id" value={subjectId} onChange={(e) => setSubjectId(Number(e.target.value))}>
            <option value={0}>{tr("ta.select")}</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {subjectId === 0 ? (
        <div className="empty">{tr("ta.selectSubjectEmpty")}</div>
      ) : (
        <>
          {/* ── Grants ─────────────────────────────────────────────── */}
          <div className="card" style={{ padding: 12, marginBottom: 14, background: "var(--surface-sunk)" }}>
            <h3 className="section-title">{tr("ta.grantAccess")}</h3>
            <div className="row2">
              <div className="field"><label>{tr("ta.to")}</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <select data-testid="grant-scope-type" value={scopeType} onChange={(e) => { setScopeType(e.target.value as "subproject" | "project"); setScopeId(0); }} style={{ width: 140 }}>
                    <option value="subproject">{tr("task.subproject")}</option><option value="project">{tr("ta.scopeWholeProject")}</option>
                  </select>
                  <select data-testid="grant-scope-id" value={scopeId} onChange={(e) => setScopeId(Number(e.target.value))}>
                    <option value={0}>{tr("ta.select")}</option>
                    {(scopeType === "subproject" ? subOptions : projects.map((p) => ({ id: p.id, label: p.name }))).map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field"><label>{tr("ta.level")}</label>
                <select data-testid="grant-level" value={level} onChange={(e) => setLevel(e.target.value)}>
                  <option value="member">{tr("ta.levelMember")}</option><option value="viewer">{tr("ta.levelViewer")}</option>
                </select>
              </div>
            </div>
            <div className="field" style={{ maxWidth: 280, marginBottom: 0 }}>
              <label>{tr("ta.sees")} <span className="muted" style={{ fontWeight: 400 }}>{tr("ta.seesHint")}</span></label>
              <select data-testid="grant-sees" value={sees} onChange={(e) => setSees(e.target.value as Sees)}>
                {(Object.keys(SEES_LABEL) as Sees[]).map((s) => <option key={s} value={s}>{SEES_LABEL[s]}</option>)}
              </select>
            </div>
            <div className="muted" style={{ fontSize: 12, margin: "6px 0 10px" }}>{tr("ta.ownHint")}</div>
            <button className="btn-primary" data-testid="grant-add" onClick={addGrant}>{tr("ta.grantAccess")}</button>
          </div>

          <table className="tbl">
            <thead><tr><th>{tr("ta.colGrantTo")}</th><th>{tr("ta.level")}</th><th>{tr("ta.sees")}</th><th></th></tr></thead>
            <tbody>
              {myGrants.map((g) => (
                <tr key={g.id}>
                  <td>{g.subproject ? subName(g.subproject) : tr("ta.wholeProject", { name: projName(g.project!) })}</td>
                  <td><span className="pill" style={{ background: "var(--surface-sunk)" }}>{g.level}</span></td>
                  <td>
                    <select value={g.sees} onChange={(e) => changeSees(g, e.target.value as Sees)} style={{ width: "auto", fontSize: 12 }}>
                      {(Object.keys(SEES_LABEL) as Sees[]).map((s) => <option key={s} value={s}>{SEES_LABEL[s]}</option>)}
                    </select>
                  </td>
                  <td><button className="btn-ghost" onClick={() => revokeGrant(g.id)}>{tr("ta.revoke")}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {myGrants.length === 0 && <div className="empty">{tr("ta.noGrants")}</div>}

          {/* ── Exclusions ─────────────────────────────────────────── */}
          <div style={{ borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 14 }}>
            <h3 className="section-title">{tr("ta.exclusionsTitle")}</h3>
            <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
              {tr("ta.exclusionsHelp")}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {myExclusions.map((e) => (
                <span key={e.id} className="pill" style={{ background: "#b4452f12", color: "var(--danger)", border: "1px solid #b4452f55" }}>
                  {excLabel(e)}
                  <button className="btn-ghost" style={{ padding: "0 4px", color: "var(--danger)" }} onClick={() => removeExclusion(e.id)}>✕</button>
                </span>
              ))}
              {myExclusions.length === 0 && <span className="muted" style={{ fontSize: 12 }}>{tr("ta.noExclusions")}</span>}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <select data-testid="exc-type" value={excType} onChange={(e) => { setExcType(e.target.value as ExcType); setExcId(""); }} style={{ width: 140 }}>
                <option value="task">{tr("list.colTask")}</option><option value="user">{tr("ta.subjPerson")}</option><option value="group">{tr("ta.subjGroup")}</option>
                <option value="project">{tr("task.project")}</option><option value="subproject">{tr("task.subproject")}</option>
              </select>
              {excType === "task" ? (
                <input data-testid="exc-task-id" type="number" min={1} placeholder={tr("ta.taskIdPh")} value={excId} onChange={(e) => setExcId(e.target.value)} style={{ maxWidth: 200 }} />
              ) : (
                <select data-testid="exc-target" value={excId} onChange={(e) => setExcId(e.target.value)}>
                  <option value="">{tr("ta.selectHide")}</option>
                  {excOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              )}
              <button className="btn-secondary" data-testid="exc-add" onClick={addExclusion}>+ Add exclusion</button>
            </div>
          </div>
        </>
      )}
      {err && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{err}</div>}
    </>
  );
}
