import { useEffect, useState } from "react";
import { api } from "../api/client";
import { invalidateUsers } from "../users";
import { Modal, Spinner } from "./common";

type Tab = "members" | "groups" | "access";

interface UserRow { id: number; name: string; email: string; role: string; is_active: boolean; is_admin: boolean; }
interface GroupRow { id: number; name: string; member_ids: number[]; }
interface Sub { id: number; name: string; }
interface Proj { id: number; name: string; subprojects: Sub[]; }
interface Grant { id: number; user: number | null; group: number | null; subproject: number | null; project: number | null; level: string; }

export function TeamAdmin({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [tab, setTab] = useState<Tab>("members");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [projects, setProjects] = useState<Proj[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    const [u, g, p, gr] = await Promise.all([
      api.get("/api/users"), api.get("/api/groups"), api.get("/api/projects"), api.get("/api/grants"),
    ]);
    setUsers(u as UserRow[]); setGroups(g as GroupRow[]); setProjects(p as Proj[]); setGrants(gr as Grant[]);
    setLoading(false);
    invalidateUsers();
    onChanged();
  }
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);

  return (
    <Modal title="Team & Permissions" onClose={onClose} wide>
      <div className="seg" style={{ marginBottom: 14 }}>
        {(["members", "groups", "access"] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? "seg-on" : "seg-off"} onClick={() => setTab(t)}>
            {t === "access" ? "Access" : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {loading ? <Spinner /> : (
        <>
          {tab === "members" && <Members users={users} reload={loadAll} />}
          {tab === "groups" && <Groups groups={groups} users={users} reload={loadAll} />}
          {tab === "access" && <Access grants={grants} users={users} groups={groups} projects={projects} reload={loadAll} />}
        </>
      )}
    </Modal>
  );
}

function Members({ users, reload }: { users: UserRow[]; reload: () => void }) {
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); const [role, setRole] = useState("member");
  const [err, setErr] = useState("");

  async function add() {
    setErr("");
    try {
      await api.post("/api/users", { name, email, password, role });
      setName(""); setEmail(""); setPassword(""); setRole("member");
      reload();
    } catch { setErr("Could not add — check email is unique and password ≥ 8 chars."); }
  }
  async function setMemberRole(u: UserRow, r: string) { await api.patch(`/api/users/${u.id}`, { role: r }); reload(); }
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
        {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8 }}>{err}</div>}
        <button className="btn-primary" onClick={add}>Add member</button>
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Share the email + password with them directly.</div>
      </div>

      <table className="tbl">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th></th></tr></thead>
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

function Access({ grants, users, groups, projects, reload }: {
  grants: Grant[]; users: UserRow[]; groups: GroupRow[]; projects: Proj[]; reload: () => void;
}) {
  const [targetType, setTargetType] = useState<"user" | "group">("user");
  const [targetId, setTargetId] = useState<number>(0);
  const [scopeType, setScopeType] = useState<"subproject" | "project">("subproject");
  const [scopeId, setScopeId] = useState<number>(0);
  const [level, setLevel] = useState("member");
  const [err, setErr] = useState("");

  const subOptions = projects.flatMap((p) => p.subprojects.map((s) => ({ id: s.id, label: `${p.name} / ${s.name}` })));

  function nameFor(g: Grant) {
    const who = g.user ? (users.find((u) => u.id === g.user)?.name ?? "user") : (groups.find((x) => x.id === g.group)?.name ?? "group");
    const what = g.subproject
      ? subOptions.find((s) => s.id === g.subproject)?.label ?? "sub-project"
      : (projects.find((p) => p.id === g.project)?.name ?? "project") + " (whole)";
    return `${who} → ${what}`;
  }

  async function add() {
    setErr("");
    const body: Record<string, unknown> = { level };
    body[targetType] = targetId || null;
    body[scopeType] = scopeId || null;
    if (!targetId || !scopeId) { setErr("Pick a person/group and a project/sub-project."); return; }
    try { await api.post("/api/grants", body); reload(); }
    catch { setErr("Could not add grant (maybe it already exists)."); }
  }
  async function revoke(id: number) { await api.del(`/api/grants/${id}`); reload(); }

  return (
    <>
      <div className="card" style={{ padding: 12, marginBottom: 14, background: "var(--surface-sunk)" }}>
        <h3 className="section-title">Grant access</h3>
        <div className="row2">
          <div className="field">
            <label>Give access to</label>
            <div style={{ display: "flex", gap: 6 }}>
              <select value={targetType} onChange={(e) => { setTargetType(e.target.value as "user" | "group"); setTargetId(0); }} style={{ width: 110 }}>
                <option value="user">Person</option><option value="group">Group</option>
              </select>
              <select value={targetId} onChange={(e) => setTargetId(Number(e.target.value))}>
                <option value={0}>Select…</option>
                {(targetType === "user" ? users.map((u) => ({ id: u.id, label: u.name || u.email })) : groups.map((g) => ({ id: g.id, label: g.name }))).map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>To</label>
            <div style={{ display: "flex", gap: 6 }}>
              <select value={scopeType} onChange={(e) => { setScopeType(e.target.value as "subproject" | "project"); setScopeId(0); }} style={{ width: 140 }}>
                <option value="subproject">Sub-project</option><option value="project">Whole project</option>
              </select>
              <select value={scopeId} onChange={(e) => setScopeId(Number(e.target.value))}>
                <option value={0}>Select…</option>
                {(scopeType === "subproject" ? subOptions : projects.map((p) => ({ id: p.id, label: p.name }))).map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="field" style={{ maxWidth: 200 }}>
          <label>Level</label>
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="member">Member (can edit)</option><option value="viewer">Viewer (read + comment)</option>
          </select>
        </div>
        {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8 }}>{err}</div>}
        <button className="btn-primary" onClick={add}>Grant access</button>
      </div>

      <table className="tbl">
        <thead><tr><th>Grant</th><th>Level</th><th></th></tr></thead>
        <tbody>
          {grants.map((g) => (
            <tr key={g.id}>
              <td>{nameFor(g)}</td>
              <td><span className="pill" style={{ background: "var(--surface-sunk)" }}>{g.level}</span></td>
              <td><button className="btn-ghost" onClick={() => revoke(g.id)}>Revoke</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {grants.length === 0 && <div className="empty">No access grants yet.</div>}
    </>
  );
}
