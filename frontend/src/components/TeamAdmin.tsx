import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { invalidateUsers } from "../users";
import { Modal, Spinner } from "./common";
import { SEES_LABEL, type Sees } from "../types";

type Tab = "members" | "groups" | "access" | "tiers";

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

export function TeamAdmin({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [tab, setTab] = useState<Tab>("members");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [projects, setProjects] = useState<Proj[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [exclusions, setExclusions] = useState<Exclusion[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    const [u, g, t, p, gr, ex] = await Promise.all([
      api.get("/api/users"), api.get("/api/groups"), api.get("/api/tiers"),
      api.get("/api/projects"), api.get("/api/grants"), api.get("/api/exclusions"),
    ]);
    setUsers(u as UserRow[]); setGroups(g as GroupRow[]); setTiers(t as TierRow[]);
    setProjects(p as Proj[]); setGrants(gr as Grant[]); setExclusions(ex as Exclusion[]);
    setLoading(false);
    invalidateUsers();
    onChanged();
  }
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);

  const labels: Record<Tab, string> = { members: "Members", groups: "Groups", access: "Access", tiers: "Tiers" };

  return (
    <Modal title="Team & Permissions" onClose={onClose} wide>
      <div className="seg" style={{ marginBottom: 14 }}>
        {(["members", "groups", "access", "tiers"] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? "seg-on" : "seg-off"} onClick={() => setTab(t)}>{labels[t]}</button>
        ))}
      </div>
      {loading ? <Spinner /> : (
        <>
          {tab === "members" && <Members users={users} tiers={tiers} reload={loadAll} />}
          {tab === "groups" && <Groups groups={groups} users={users} reload={loadAll} />}
          {tab === "access" && (
            <Access grants={grants} exclusions={exclusions} users={users} groups={groups}
              tiers={tiers} projects={projects} reload={loadAll} />
          )}
          {tab === "tiers" && <Tiers tiers={tiers} reload={loadAll} onEditAccess={() => setTab("access")} />}
        </>
      )}
    </Modal>
  );
}

function Members({ users, tiers, reload }: { users: UserRow[]; tiers: TierRow[]; reload: () => void }) {
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); const [role, setRole] = useState("member");
  const [tier, setTier] = useState<string>("");
  const [err, setErr] = useState("");

  async function add() {
    setErr("");
    try {
      await api.post("/api/users", { name, email, password, role, tier: tier ? Number(tier) : null });
      setName(""); setEmail(""); setPassword(""); setRole("member"); setTier("");
      reload();
    } catch { setErr("Could not add — check email is unique and password ≥ 8 chars."); }
  }
  async function setMemberRole(u: UserRow, r: string) { await api.patch(`/api/users/${u.id}`, { role: r }); reload(); }
  async function setMemberTier(u: UserRow, t: string) { await api.patch(`/api/users/${u.id}`, { tier: t ? Number(t) : null }); reload(); }
  async function toggleActive(u: UserRow) { await api.patch(`/api/users/${u.id}`, { is_active: !u.is_active }); reload(); }
  async function resetPw(u: UserRow) {
    const pw = prompt(`New password for ${u.name || u.email} (≥ 8 chars):`);
    if (pw) { await api.patch(`/api/users/${u.id}`, { password: pw }); alert("Password updated."); }
  }

  return (
    <>
      <div className="card" style={{ padding: 12, marginBottom: 14, background: "var(--surface-sunk)" }}>
        <h3 className="section-title">Add team member</h3>
        <div className="row2">
          <div className="field"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        </div>
        <div className="row2">
          <div className="field"><label>Starting password</label><input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="≥ 8 characters" /></div>
          <div className="field"><label>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="member">Member</option><option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div className="field" style={{ maxWidth: "calc(50% - 6px)" }}>
          <label>Tier <span className="muted" style={{ fontWeight: 400 }}>(new member inherits its access)</span></label>
          <select value={tier} onChange={(e) => setTier(e.target.value)} disabled={role === "admin"}>
            <option value="">No tier (blank slate)</option>
            {tiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8 }}>{err}</div>}
        <button className="btn-primary" onClick={add}>Add member</button>
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Share the email + password with them directly. Admins ignore tiers — they see everything.</div>
      </div>

      <table className="tbl">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Tier</th><th>Active</th><th></th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name || "—"}</td>
              <td className="muted">{u.email}</td>
              <td>
                <select value={u.role} onChange={(e) => setMemberRole(u, e.target.value)} style={{ width: "auto" }}>
                  <option value="member">Member</option><option value="admin">Admin</option>
                </select>
              </td>
              <td>
                {u.is_admin ? <span className="muted" style={{ fontSize: 12 }}>— (admin)</span> : (
                  <select value={u.tier ?? ""} onChange={(e) => setMemberTier(u, e.target.value)} style={{ width: "auto" }}>
                    <option value="">No tier</option>
                    {tiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}
              </td>
              <td><button className="btn-ghost" onClick={() => toggleActive(u)}>{u.is_active ? "Active" : "Disabled"}</button></td>
              <td><button className="btn-ghost" onClick={() => resetPw(u)}>Reset pw</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Groups({ groups, users, reload }: { groups: GroupRow[]; users: UserRow[]; reload: () => void }) {
  const [name, setName] = useState("");
  async function add() { if (name.trim()) { await api.post("/api/groups", { name: name.trim() }); setName(""); reload(); } }
  async function del(g: GroupRow) { if (confirm(`Delete group "${g.name}"?`)) { await api.del(`/api/groups/${g.id}`); reload(); } }
  async function toggleMember(g: GroupRow, uid: number) {
    const ids = g.member_ids.includes(uid) ? g.member_ids.filter((x) => x !== uid) : [...g.member_ids, uid];
    await api.patch(`/api/groups/${g.id}`, { member_ids: ids });
    reload();
  }
  return (
    <>
      <div className="field" style={{ display: "flex", gap: 8 }}>
        <input placeholder="New group name…" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary" onClick={add}>Add group</button>
      </div>
      {groups.map((g) => (
        <div key={g.id} className="card" style={{ padding: 12, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <strong>{g.name}</strong>
            <button className="btn-danger" onClick={() => del(g)}>Delete</button>
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
      {groups.length === 0 && <div className="empty">No groups yet.</div>}
    </>
  );
}

function Tiers({ tiers, reload, onEditAccess }: { tiers: TierRow[]; reload: () => void; onEditAccess: () => void }) {
  const [name, setName] = useState("");
  const [sees, setSees] = useState<Sees>("subproject");

  async function add() {
    if (!name.trim()) return;
    await api.post("/api/tiers", { name: name.trim(), default_sees: sees });
    setName(""); setSees("subproject"); reload();
  }
  async function patch(t: TierRow, changes: Partial<TierRow>) { await api.patch(`/api/tiers/${t.id}`, changes); reload(); }
  async function del(t: TierRow) {
    if (!confirm(`Delete tier "${t.name}"? Members on it keep their own grants but lose the tier's.`)) return;
    await api.del(`/api/tiers/${t.id}`); reload();
  }

  return (
    <>
      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
        Reusable permission templates. A member assigned to a tier inherits its grants + exclusions
        live. Set a tier's grants and exclusions in the <strong>Access</strong> tab (subject = Tier).
      </div>
      <div className="card" style={{ padding: 12, marginBottom: 14, background: "var(--surface-sunk)", display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="field" style={{ marginBottom: 0, flex: 1 }}><label>New tier name</label>
          <input data-testid="tier-name" placeholder="e.g. Volunteer" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field" style={{ marginBottom: 0 }}><label>Default visibility</label>
          <select data-testid="tier-sees" value={sees} onChange={(e) => setSees(e.target.value as Sees)}>
            {(Object.keys(SEES_LABEL) as Sees[]).map((s) => <option key={s} value={s}>{SEES_LABEL[s]}</option>)}
          </select>
        </div>
        <button className="btn-primary" data-testid="tier-add" onClick={add}>Add tier</button>
      </div>

      {tiers.map((t) => (
        <div key={t.id} className="card" style={{ padding: 12, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <input defaultValue={t.name} onBlur={(e) => e.target.value.trim() && e.target.value !== t.name && patch(t, { name: e.target.value.trim() })} style={{ maxWidth: 220, fontWeight: 600 }} />
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span className="pill" style={{ background: "var(--surface-sunk)" }}>{t.member_count} member{t.member_count === 1 ? "" : "s"}</span>
              <button className="btn-secondary" onClick={onEditAccess}>Edit access →</button>
              <button className="btn-danger" onClick={() => del(t)}>Delete</button>
            </span>
          </div>
          <div className="field" style={{ marginTop: 8, marginBottom: 0, maxWidth: 280 }}>
            <label>Default visibility</label>
            <select value={t.default_sees} onChange={(e) => patch(t, { default_sees: e.target.value as Sees })}>
              {(Object.keys(SEES_LABEL) as Sees[]).map((s) => <option key={s} value={s}>{SEES_LABEL[s]}</option>)}
            </select>
          </div>
        </div>
      ))}
      {tiers.length === 0 && <div className="empty">No tiers yet. Add one above.</div>}
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
    if (!subjectId || !scopeId) { setErr("Pick a subject and a scope."); return; }
    const body: Record<string, unknown> = { level, sees };
    body[subjectType] = subjectId;
    body[scopeType] = scopeId;
    try { await api.post("/api/grants", body); setScopeId(0); reload(); }
    catch { setErr("Could not add grant (maybe it already exists)."); }
  }
  async function revokeGrant(id: number) { await api.del(`/api/grants/${id}`); reload(); }
  async function changeSees(g: Grant, s: Sees) { await api.patch(`/api/grants/${g.id}`, { sees: s }); reload(); }

  async function addExclusion() {
    setErr("");
    if (!subjectId) { setErr("Pick a subject first."); return; }
    const id = Number(excId);
    if (!id) { setErr("Pick or enter what to exclude."); return; }
    const body: Record<string, unknown> = {};
    body[subjectType] = subjectId;
    body[EXC_FIELD[excType]] = id;
    try { await api.post("/api/exclusions", body); setExcId(""); reload(); }
    catch { setErr("Could not add exclusion (maybe it already exists)."); }
  }
  async function removeExclusion(id: number) { await api.del(`/api/exclusions/${id}`); reload(); }

  function excLabel(e: Exclusion): string {
    if (e.excluded_task) return `Task · #${e.excluded_task}`;
    if (e.excluded_user) return `Person · ${userName(e.excluded_user)}`;
    if (e.excluded_group) return `👥 ${groupName(e.excluded_group)}`;
    if (e.excluded_project) return `Project · ${projName(e.excluded_project)}`;
    if (e.excluded_subproject) return `Sub-project · ${subName(e.excluded_subproject)}`;
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
        Pick a subject; grants + exclusions work the same for a Person, Group, or Tier. Effective
        access stacks <strong>tier → group → individual</strong>, then exclusions remove.{" "}
        <strong>Deny &gt; assignment &gt; allow.</strong>
      </div>

      <div className="field" style={{ maxWidth: 360 }}>
        <label>Define access for</label>
        <div style={{ display: "flex", gap: 6 }}>
          <select data-testid="access-subject-type" value={subjectType} onChange={(e) => { setSubjectType(e.target.value as SubjectType); setSubjectId(0); }} style={{ width: 110 }}>
            <option value="user">Person</option><option value="group">Group</option><option value="tier">Tier</option>
          </select>
          <select data-testid="access-subject-id" value={subjectId} onChange={(e) => setSubjectId(Number(e.target.value))}>
            <option value={0}>Select…</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {subjectId === 0 ? (
        <div className="empty">Select a person, group, or tier to manage their access.</div>
      ) : (
        <>
          {/* ── Grants ─────────────────────────────────────────────── */}
          <div className="card" style={{ padding: 12, marginBottom: 14, background: "var(--surface-sunk)" }}>
            <h3 className="section-title">Grant access</h3>
            <div className="row2">
              <div className="field"><label>To</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <select data-testid="grant-scope-type" value={scopeType} onChange={(e) => { setScopeType(e.target.value as "subproject" | "project"); setScopeId(0); }} style={{ width: 140 }}>
                    <option value="subproject">Sub-project</option><option value="project">Whole project</option>
                  </select>
                  <select data-testid="grant-scope-id" value={scopeId} onChange={(e) => setScopeId(Number(e.target.value))}>
                    <option value={0}>Select…</option>
                    {(scopeType === "subproject" ? subOptions : projects.map((p) => ({ id: p.id, label: p.name }))).map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field"><label>Level</label>
                <select data-testid="grant-level" value={level} onChange={(e) => setLevel(e.target.value)}>
                  <option value="member">Member (can edit)</option><option value="viewer">Viewer (read + comment)</option>
                </select>
              </div>
            </div>
            <div className="field" style={{ maxWidth: 280, marginBottom: 0 }}>
              <label>Sees <span className="muted" style={{ fontWeight: 400 }}>(which tasks in scope)</span></label>
              <select data-testid="grant-sees" value={sees} onChange={(e) => setSees(e.target.value as Sees)}>
                {(Object.keys(SEES_LABEL) as Sees[]).map((s) => <option key={s} value={s}>{SEES_LABEL[s]}</option>)}
              </select>
            </div>
            <div className="muted" style={{ fontSize: 12, margin: "6px 0 10px" }}>"Own" = the member is an assignee, or one of their groups is.</div>
            <button className="btn-primary" data-testid="grant-add" onClick={addGrant}>Grant access</button>
          </div>

          <table className="tbl">
            <thead><tr><th>Grant (to)</th><th>Level</th><th>Sees</th><th></th></tr></thead>
            <tbody>
              {myGrants.map((g) => (
                <tr key={g.id}>
                  <td>{g.subproject ? subName(g.subproject) : `${projName(g.project!)} (whole)`}</td>
                  <td><span className="pill" style={{ background: "var(--surface-sunk)" }}>{g.level}</span></td>
                  <td>
                    <select value={g.sees} onChange={(e) => changeSees(g, e.target.value as Sees)} style={{ width: "auto", fontSize: 12 }}>
                      {(Object.keys(SEES_LABEL) as Sees[]).map((s) => <option key={s} value={s}>{SEES_LABEL[s]}</option>)}
                    </select>
                  </td>
                  <td><button className="btn-ghost" onClick={() => revokeGrant(g.id)}>Revoke</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {myGrants.length === 0 && <div className="empty">No grants yet for this subject.</div>}

          {/* ── Exclusions ─────────────────────────────────────────── */}
          <div style={{ borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 14 }}>
            <h3 className="section-title">Exclusions — hide specific things from this subject</h3>
            <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
              A deny always wins, even over a task the member is assigned to (deny &gt; assignment &gt; allow).
              Use sparingly.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {myExclusions.map((e) => (
                <span key={e.id} className="pill" style={{ background: "#b4452f12", color: "var(--danger)", border: "1px solid #b4452f55" }}>
                  {excLabel(e)}
                  <button className="btn-ghost" style={{ padding: "0 4px", color: "var(--danger)" }} onClick={() => removeExclusion(e.id)}>✕</button>
                </span>
              ))}
              {myExclusions.length === 0 && <span className="muted" style={{ fontSize: 12 }}>No exclusions.</span>}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <select data-testid="exc-type" value={excType} onChange={(e) => { setExcType(e.target.value as ExcType); setExcId(""); }} style={{ width: 140 }}>
                <option value="task">Task</option><option value="user">Person</option><option value="group">Group</option>
                <option value="project">Project</option><option value="subproject">Sub-project</option>
              </select>
              {excType === "task" ? (
                <input data-testid="exc-task-id" type="number" min={1} placeholder="Task ID (e.g. 318)" value={excId} onChange={(e) => setExcId(e.target.value)} style={{ maxWidth: 200 }} />
              ) : (
                <select data-testid="exc-target" value={excId} onChange={(e) => setExcId(e.target.value)}>
                  <option value="">Select what to hide…</option>
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
