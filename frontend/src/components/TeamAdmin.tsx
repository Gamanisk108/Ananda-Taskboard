import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Users } from "lucide-react";
import { api } from "../api/client";
import { useQueryClient } from "@tanstack/react-query";
import { Modal, Spinner, MultiSelect, SingleSelect, type MultiSelectOption } from "./common";
import { useConfirm } from "./confirm";
import { useSubmitGuard } from "../useSubmitGuard";
import { useAuth } from "../state/auth";
import { SEES_ORDER, SEES_LABEL, type Sees } from "../types";

// DN3: Holidays moved to Settings → Events & Holidays (no Team tab).
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

// Access dropdown order: narrowest → widest (Assigned Tasks … Organization).
function byViewAccess(a: TierRow, b: TierRow) { return SEES_ORDER[a.default_sees] - SEES_ORDER[b.default_sees]; }
function sortedTiers(tiers: TierRow[]) { return [...tiers].sort(byViewAccess); }

export function TeamAdmin({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const { t: tr } = useTranslation();  // `t` is used below as the tab loop var
  const queryClient = useQueryClient();
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
    // refresh the shared TanStack caches the roster/groups feed elsewhere (pickers)
    queryClient.invalidateQueries({ queryKey: ["users"] });
    queryClient.invalidateQueries({ queryKey: ["groups"] });
    if (signal) onChanged();
  }
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);

  const labels: Record<Tab, string> = {
    members: tr("tabs.members"), groups: tr("tabs.groups"), access: tr("tabs.access"),
    activity: tr("tabs.activity"),
  };

  return (
    <Modal fullScreenOnNarrow icon={<Users />} title={tr("modals.team")} onClose={onClose} wide>
      <div className="seg" style={{ marginBottom: 14 }}>
        {(["members", "groups", "access", "activity"] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? "seg-on" : "seg-off"} onClick={() => setTab(t)}>{labels[t]}</button>
        ))}
      </div>
      {loading ? <Spinner /> : (
        <>
          {tab === "members" && <Members users={users} tiers={tiers} projects={projects} reload={() => loadAll(true)} />}
          {tab === "groups" && <Groups groups={groups} users={users} reload={() => loadAll(true)} />}
          {tab === "access" && (
            <Access grants={grants} exclusions={exclusions} users={users} groups={groups}
              projects={projects} reload={() => loadAll(true)} />
          )}
          {tab === "activity" && <Activity rows={audit} />}
        </>
      )}
    </Modal>
  );
}

interface InviteRow {
  id: number; email: string; role: string; tier: number | null; tier_name: string | null;
  invited_by_name: string | null; created_at: string;
}

function defaultMemberTier(tiers: TierRow[]): TierRow | undefined {
  // New members default to "Sub-Project Only" (see the sub-projects they're added
  // to); falls back to the narrowest if that level was renamed away.
  return tiers.find((t) => t.default_sees === "subproject") ?? sortedTiers(tiers)[0];
}

function InvitesSection({ tiers, projects }: { tiers: TierRow[]; projects: Proj[] }) {
  const { t: tr } = useTranslation();
  const confirm = useConfirm();
  const [email, setEmail] = useState(""); const [role, setRole] = useState("member");
  const [tier, setTier] = useState(""); const [err, setErr] = useState(""); const [sent, setSent] = useState("");
  const [accessSel, setAccessSel] = useState<string[]>([]);  // sub-project ids to grant on accept
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [busy, guard] = useSubmitGuard();

  const tierList = useMemo(() => sortedTiers(tiers), [tiers]);
  const subOptions: MultiSelectOption[] = useMemo(
    () => projects.flatMap((p) => p.subprojects.map((s) => ({ value: String(s.id), label: `${p.name} / ${s.name}` }))),
    [projects],
  );
  // Default the Access once tiers load (no blank option — every member has one).
  useEffect(() => { if (!tier) { const d = defaultMemberTier(tiers); if (d) setTier(String(d.id)); } }, [tiers]);

  async function load() { try { setInvites(await api.get("/api/invitations") as InviteRow[]); } catch { /* ignore */ } }
  useEffect(() => { load(); }, []);

  function send() {
    return guard(async () => {
      setErr(""); setSent("");
      try {
        const access = role === "admin" ? [] : accessSel.map((id) => ({ scope: "subproject", id: Number(id), level: "member" }));
        await api.post("/api/invitations", { email, role, tier: role === "admin" || !tier ? null : Number(tier), access });
        setSent(tr("invite.sent", { email })); setEmail(""); setRole("member"); setAccessSel([]); load();
      } catch (e) {
        const d = (e as { data?: { email?: string[] | string } })?.data;
        const m = Array.isArray(d?.email) ? d!.email[0] : (typeof d?.email === "string" ? d.email : tr("invite.error"));
        setErr(m);
      }
    });
  }
  async function revoke(id: number) { if (await confirm({ body: tr("invite.confirmRevoke"), danger: true })) { await api.del(`/api/invitations/${id}`); load(); } }

  return (
    <div className="card" style={{ padding: 12, marginBottom: 14, background: "var(--surface-sunk)" }}>
      <h3 className="section-title">{tr("invite.title")}</h3>
      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{tr("invite.hint")}</div>
      <div className="row2">
        <div className="field"><label>{tr("login.email")}</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label>{tr("ta.role")}</label>
          <SingleSelect width="100%" value={role} onChange={setRole}
            options={[
              { value: "member", label: tr("ta.roleMember") },
              { value: "admin", label: tr("ta.roleAdmin") },
            ]} />
        </div>
      </div>
      <div className="row2">
        <div className="field">
          <label>{tr("ta.viewAccess", "Access")}</label>
          <SingleSelect width="100%" value={tier} disabled={role === "admin"} onChange={setTier}
            options={tierList.map((t) => ({ value: String(t.id), label: SEES_LABEL[t.default_sees] }))} />
        </div>
        <div className="field">
          <label>{tr("ta.startingAccess", "Add to projects (optional)")}</label>
          {role === "admin"
            ? <div className="muted" style={{ fontSize: 12 }}>{tr("ta.adminSeesAll", "Admins see everything")}</div>
            : <MultiSelect placeholder={tr("ta.pickSubprojects", "Pick sub-projects")} options={subOptions} selected={accessSel} onChange={setAccessSel} />}
        </div>
      </div>
      {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8 }}>{err}</div>}
      {sent && <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{sent}</div>}
      <button className="btn-primary" onClick={send} disabled={busy}>{tr("invite.send")}</button>

      {invites.length > 0 && (
        <>
          <h4 style={{ margin: "14px 0 6px" }}>{tr("invite.pending")}</h4>
          <table className="tbl">
            <thead><tr><th>{tr("login.email")}</th><th>{tr("ta.role")}</th><th>{tr("ta.viewAccess", "Access")}</th><th></th></tr></thead>
            <tbody>
              {invites.map((i) => (
                <tr key={i.id}>
                  <td className="muted">{i.email}</td>
                  <td>{tr(i.role === "admin" ? "ta.roleAdmin" : "ta.roleMember")}</td>
                  <td className="muted">{i.tier_name || "—"}</td>
                  <td><button className="btn-ghost" onClick={() => revoke(i.id)}>{tr("invite.revoke")}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function Members({ users, tiers, projects, reload }: { users: UserRow[]; tiers: TierRow[]; projects: Proj[]; reload: () => void }) {
  const { t: tr } = useTranslation();
  const { me } = useAuth();
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); const [role, setRole] = useState("member");
  const [tier, setTier] = useState<string>("");
  const [err, setErr] = useState("");
  const tierList = useMemo(() => sortedTiers(tiers), [tiers]);
  // No blank option — default new members to "Sub-Project Only".
  useEffect(() => { if (!tier) { const d = defaultMemberTier(tiers); if (d) setTier(String(d.id)); } }, [tiers]);
  const [busy, guard] = useSubmitGuard();
  // optimistic local copy so role/tier/active changes show instantly (the full
  // reload runs in the background and re-syncs via the effect below).
  const [rows, setRows] = useState(users);
  useEffect(() => setRows(users), [users]);
  const patch = (id: number, p: Partial<UserRow>) => setRows((rs) => rs.map((u) => (u.id === id ? { ...u, ...p } : u)));

  function add() {
    return guard(async () => {
      setErr("");
      try {
        await api.post("/api/users", { name, email, password, role, tier: role === "admin" || !tier ? null : Number(tier) });
        setName(""); setEmail(""); setPassword(""); setRole("member"); setTier("");
        reload();
      } catch { setErr(tr("ta.errAddMember")); }
    });
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
      <InvitesSection tiers={tiers} projects={projects} />
      <div className="card" style={{ padding: 12, marginBottom: 14, background: "var(--surface-sunk)" }}>
        <h3 className="section-title">{tr("ta.addMemberTitle")}</h3>
        <div className="row2">
          <div className="field"><label>{tr("ta.name")}</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field"><label>{tr("login.email")}</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        </div>
        <div className="row2">
          <div className="field"><label>{tr("ta.startingPw")}</label><input value={password} onChange={(e) => setPassword(e.target.value)} placeholder={tr("ta.min8")} /></div>
          <div className="field"><label>{tr("ta.role")}</label>
            <SingleSelect width="100%" value={role} onChange={setRole}
              options={[
                { value: "member", label: tr("ta.roleMember") },
                { value: "admin", label: tr("ta.roleAdmin") },
              ]} />
          </div>
        </div>
        <div className="field" style={{ maxWidth: "calc(50% - 6px)" }}>
          <label>{tr("ta.viewAccess", "Access")} <span className="muted" style={{ fontWeight: 400 }}>{tr("ta.viewAccessHint", "(what can they see?)")}</span></label>
          <SingleSelect width="100%" value={tier} disabled={role === "admin"} onChange={setTier}
            options={tierList.map((t) => ({ value: String(t.id), label: SEES_LABEL[t.default_sees] }))} />
        </div>
        {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8 }}>{err}</div>}
        <button className="btn-primary" onClick={add} disabled={busy}>{tr("ta.addMember")}</button>
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{tr("ta.shareHint")}</div>
      </div>

      <table className="tbl">
        <thead><tr><th>{tr("ta.name")}</th><th>{tr("login.email")}</th><th>{tr("ta.role")}</th><th>{tr("ta.viewAccess", "Access")}</th><th>{tr("ta.active")}</th><th></th></tr></thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td>{u.name || "—"}</td>
              <td className="muted">{u.email}</td>
              <td>
                {/* You can't demote your own admin account (backend blocks it) — disable
                    the select rather than let it fail-on-use (QA 2026-06-05). */}
                <SingleSelect value={u.role} disabled={u.id === me?.id} onChange={(v) => setMemberRole(u, v)}
                  options={[
                    { value: "member", label: tr("ta.roleMember") },
                    { value: "admin", label: tr("ta.roleAdmin") },
                  ]} />
              </td>
              <td>
                {u.is_admin ? <span className="muted" style={{ fontSize: 12 }}>{tr("ta.adminDash")}</span> : (
                  <SingleSelect width={210} value={u.tier != null ? String(u.tier) : ""} placeholder={tr("ta.pickViewAccess", "Pick…")}
                    onChange={(v) => setMemberTier(u, v)}
                    options={tierList.map((t) => ({ value: String(t.id), label: SEES_LABEL[t.default_sees] }))} />
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
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const [busy, guard] = useSubmitGuard();
  function add() { return guard(async () => { if (name.trim()) { await api.post("/api/groups", { name: name.trim() }); setName(""); reload(); } }); }
  async function del(g: GroupRow) { if (await confirm({ body: tr("ta.confirmDeleteGroup", { name: g.name }), danger: true, confirmLabel: tr("common.delete") })) { await api.del(`/api/groups/${g.id}`); reload(); } }
  async function toggleMember(g: GroupRow, uid: number) {
    const ids = g.member_ids.includes(uid) ? g.member_ids.filter((x) => x !== uid) : [...g.member_ids, uid];
    await api.patch(`/api/groups/${g.id}`, { member_ids: ids });
    reload();
  }
  return (
    <>
      <div className="field" style={{ display: "flex", gap: 8 }}>
        <input placeholder={tr("ta.newGroupPh")} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary" onClick={add} disabled={busy}>{tr("ta.addGroup")}</button>
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

type SubjectType = "user" | "group";
type ExcType = "user" | "group" | "project" | "subproject" | "task";
const EXC_FIELD: Record<ExcType, keyof Exclusion> = {
  user: "excluded_user", group: "excluded_group", project: "excluded_project",
  subproject: "excluded_subproject", task: "excluded_task",
};

function Access({
  grants, exclusions, users, groups, projects, reload,
}: {
  grants: Grant[]; exclusions: Exclusion[]; users: UserRow[]; groups: GroupRow[];
  projects: Proj[]; reload: () => void;
}) {
  const { t: tr } = useTranslation();
  const [subjectType, setSubjectType] = useState<SubjectType>("user");
  const [subjectId, setSubjectId] = useState<number>(0);

  // grant builder (WHERE + edit level; how-much is each member's Access)
  const [scopeType, setScopeType] = useState<"subproject" | "project">("subproject");
  const [scopeId, setScopeId] = useState<number>(0);
  const [level, setLevel] = useState("member");
  const [err, setErr] = useState("");

  // exclusion builder
  const [excType, setExcType] = useState<ExcType>("task");
  const [excId, setExcId] = useState<string>("");

  const subjects = subjectType === "user" ? users.map((u) => ({ id: u.id, label: u.name || u.email }))
    : groups.map((g) => ({ id: g.id, label: g.name }));

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
    const body: Record<string, unknown> = { level };
    body[subjectType] = subjectId;
    body[scopeType] = scopeId;
    try { await api.post("/api/grants", body); setScopeId(0); reload(); }
    catch { setErr(tr("ta.errAddGrant")); }
  }
  async function revokeGrant(id: number) { await api.del(`/api/grants/${id}`); reload(); }

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
          <SingleSelect testId="access-subject-type" width={110} value={subjectType}
            onChange={(v) => { setSubjectType(v as SubjectType); setSubjectId(0); }}
            options={[
              { value: "user", label: tr("ta.subjPerson") },
              { value: "group", label: tr("ta.subjGroup") },
            ]} />
          <SingleSelect testId="access-subject-id" value={subjectId ? String(subjectId) : ""} placeholder={tr("ta.select")}
            onChange={(v) => setSubjectId(Number(v) || 0)}
            options={subjects.map((s) => ({ value: String(s.id), label: s.label }))} />
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
                  <SingleSelect testId="grant-scope-type" width={140} value={scopeType}
                    onChange={(v) => { setScopeType(v as "subproject" | "project"); setScopeId(0); }}
                    options={[
                      { value: "subproject", label: tr("task.subproject") },
                      { value: "project", label: tr("ta.scopeWholeProject") },
                    ]} />
                  <SingleSelect testId="grant-scope-id" value={scopeId ? String(scopeId) : ""} placeholder={tr("ta.select")}
                    onChange={(v) => setScopeId(Number(v) || 0)}
                    options={(scopeType === "subproject" ? subOptions : projects.map((p) => ({ id: p.id, label: p.name })))
                      .map((o) => ({ value: String(o.id), label: o.label }))} />
                </div>
              </div>
              <div className="field"><label>{tr("ta.level")}</label>
                <SingleSelect testId="grant-level" width="100%" value={level} onChange={setLevel}
                  options={[
                    { value: "member", label: tr("ta.levelMember") },
                    { value: "viewer", label: tr("ta.levelViewer") },
                  ]} />
              </div>
            </div>
            <div className="muted" style={{ fontSize: 12, margin: "6px 0 10px" }}>
              {tr("ta.viewAccessNote", "How many tasks they see is set by each member's Access (on the Members tab).")}
            </div>
            <button className="btn-primary" data-testid="grant-add" onClick={addGrant}>{tr("ta.grantAccess")}</button>
          </div>

          <table className="tbl">
            <thead><tr><th>{tr("ta.colGrantTo")}</th><th>{tr("ta.level")}</th><th></th></tr></thead>
            <tbody>
              {myGrants.map((g) => (
                <tr key={g.id}>
                  <td>{g.subproject ? subName(g.subproject) : tr("ta.wholeProject", { name: projName(g.project!) })}</td>
                  <td><span className="pill" style={{ background: "var(--surface-sunk)" }}>{g.level}</span></td>
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
                  <button className="btn-ghost icon-only" style={{ padding: "0 4px", color: "var(--danger)" }} title={tr("common.remove", "Remove")} onClick={() => removeExclusion(e.id)}><X size={12} /></button>
                </span>
              ))}
              {myExclusions.length === 0 && <span className="muted" style={{ fontSize: 12 }}>{tr("ta.noExclusions")}</span>}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <SingleSelect testId="exc-type" width={140} value={excType}
                onChange={(v) => { setExcType(v as ExcType); setExcId(""); }}
                options={[
                  { value: "task", label: tr("list.colTask") },
                  { value: "user", label: tr("ta.subjPerson") },
                  { value: "group", label: tr("ta.subjGroup") },
                  { value: "project", label: tr("task.project") },
                  { value: "subproject", label: tr("task.subproject") },
                ]} />
              {excType === "task" ? (
                <input data-testid="exc-task-id" type="number" min={1} placeholder={tr("ta.taskIdPh")} value={excId} onChange={(e) => setExcId(e.target.value)} style={{ maxWidth: 200 }} />
              ) : (
                <SingleSelect testId="exc-target" value={excId} placeholder={tr("ta.selectHide")} onChange={setExcId}
                  options={excOptions.map((o) => ({ value: String(o.id), label: o.label }))} />
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

