import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy } from "lucide-react";
import { api } from "../api/client";
import { peopleInMyScope, useUsers } from "../users";
import { useAdminGroups } from "../groups";
import { Modal } from "./common";
import { todayISO } from "../lookup";
import type { Me } from "../types";

export function CopySummary({ me, onClose }: { me: Me; onClose: () => void }) {
  const { t } = useTranslation();
  const allUsers = useUsers();
  // Reduced-access users only filter by people who share a sub-project they can
  // reach — never the whole roster. Admins see everyone.
  const users = useMemo(() => peopleInMyScope(me, allUsers), [me, allUsers]);
  const groups = useAdminGroups(me);
  const [date, setDate] = useState(todayISO());
  const [projects, setProjects] = useState<number[]>([]);
  const [assignees, setAssignees] = useState<number[]>([]);
  const [groupIds, setGroupIds] = useState<number[]>([]);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  const projectOpts = me.tree.projects;

  const query = useMemo(() => {
    const p = new URLSearchParams({ date });
    if (projects.length) p.set("projects", projects.join(","));
    if (assignees.length) p.set("assignees", assignees.join(","));
    if (groupIds.length) p.set("groups", groupIds.join(","));
    return p.toString();
  }, [date, projects, assignees, groupIds]);

  useEffect(() => {
    api.get(`/api/summary/groupchat?${query}`).then((d) => setText((d as { text: string }).text)).catch(() => setText(""));
  }, [query]);

  function toggle(list: number[], set: (v: number[]) => void, id: number) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Modal icon={<Copy />} title={t("modals.copySummary")} onClose={onClose} wide>
      <div className="row2">
        <div className="field">
          <label>{t("copy.day")}</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label>{t("copy.filterProject")}</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {projectOpts.map((p) => (
            <button key={p.id} type="button"
              className={projects.includes(p.id) ? "btn-primary" : "btn-secondary"}
              style={{ padding: "3px 10px", fontSize: 12 }}
              onClick={() => toggle(projects, setProjects, p.id)}>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="row2">
        <div className="field">
          <label>{t("copy.filterPerson")}</label>
          <div className="assignee-list" style={{ maxHeight: 130 }}>
            {users.map((u) => (
              <label key={u.id} className="assignee-row">
                <input type="checkbox" style={{ width: "auto" }} checked={assignees.includes(u.id)} onChange={() => toggle(assignees, setAssignees, u.id)} />
                <span>{u.name || u.email}</span>
              </label>
            ))}
          </div>
        </div>
        {me.is_admin && groups.length > 0 && (
          <div className="field">
            <label>{t("copy.filterGroup")}</label>
            <div className="assignee-list" style={{ maxHeight: 130 }}>
              {groups.map((g) => (
                <label key={g.id} className="assignee-row">
                  <input type="checkbox" style={{ width: "auto" }} checked={groupIds.includes(g.id)} onChange={() => toggle(groupIds, setGroupIds, g.id)} />
                  <span>👥 {g.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="field">
        <label>{t("copy.preview")}</label>
        <textarea readOnly rows={12} value={text} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} />
      </div>

      <div className="modal-foot">
        <button className="btn-secondary" onClick={onClose}>{t("copy.close")}</button>
        <button className="btn-primary" onClick={copy}>{copied ? t("copy.copied") : t("copy.copy")}</button>
      </div>
    </Modal>
  );
}
