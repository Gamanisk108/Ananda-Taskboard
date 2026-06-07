import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, ClipboardList } from "lucide-react";
import { api } from "../api/client";
import { useStatuses } from "../statuses";
import { peopleInMyScope, useUsers } from "../users";
import { useAdminGroups } from "../groups";
import { Modal } from "./common";
import { PRIORITY_META, type Me } from "../types";

// `key` MUST match the backend COLUMNS registry in exporting/export.py.
// `i18nKey` is display-only (the checkbox label); not sent to the server.
const COLUMNS: { key: string; i18nKey: string }[] = [
  { key: "id", i18nKey: "expcol.id" },  // include for round-trip: re-import matches on it
  { key: "project", i18nKey: "task.project" },
  { key: "subproject", i18nKey: "task.subproject" },
  { key: "title", i18nKey: "expcol.title" },
  { key: "status", i18nKey: "task.status" },
  { key: "priority", i18nKey: "task.priority" },
  { key: "approval", i18nKey: "expcol.approval" },
  { key: "deadline", i18nKey: "task.deadline" },
  { key: "start_time", i18nKey: "task.startTime" },
  { key: "end_time", i18nKey: "task.endTime" },
  { key: "recurrence", i18nKey: "expcol.recurrence" },
  { key: "assignees", i18nKey: "task.assignees" },
  { key: "details", i18nKey: "task.details" },
  { key: "requirements", i18nKey: "task.requirements" },
  { key: "links", i18nKey: "expcol.links" },
];

type Fmt = "csv" | "xlsx" | "json";

export function ExportDialog({ me }: { me: Me }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [fmt, setFmt] = useState<Fmt>("xlsx");
  const [selProjects, setSelProjects] = useState<Set<number>>(new Set());
  const [selSubs, setSelSubs] = useState<Set<number>>(new Set());
  const [selGroups, setSelGroups] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState("");
  const [archived, setArchived] = useState(false);
  const [cols, setCols] = useState<Record<string, boolean>>(
    Object.fromEntries(COLUMNS.map((c) => [c.key, true])),
  );
  const statuses = useStatuses();
  const allUsers = useUsers();
  // Reduced-access users only see people who share a sub-project they can reach
  // in the assignee filter — never the whole roster. Admins see everyone.
  const users = useMemo(() => peopleInMyScope(me, allUsers), [me, allUsers]);
  const groups = useAdminGroups(me, open);

  const projects = me.tree.projects;
  const allCols = COLUMNS.map((c) => c.key);
  const selected = allCols.filter((k) => cols[k]);

  function toggle(set: Set<number>, id: number, setter: (s: Set<number>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  }

  const [copied, setCopied] = useState(false);

  function buildParams(overrideFmt?: string) {
    const p = new URLSearchParams({ fmt: overrideFmt ?? fmt });
    if (selProjects.size) p.set("projects", [...selProjects].join(","));
    // only send sub-projects not already covered by a whole-project selection
    const subs = [...selSubs].filter((sid) =>
      !projects.some((pr) => selProjects.has(pr.id) && pr.subprojects.some((s) => s.id === sid)));
    if (subs.length) p.set("subprojects", subs.join(","));
    if (selGroups.size) p.set("groups", [...selGroups].join(","));
    if (status) p.set("status", status);
    if (assignee) p.set("assignee", assignee);
    if (priority) p.set("priority", priority);
    if (archived) p.set("archived", "1");
    if (selected.length && selected.length !== allCols.length) p.set("columns", selected.join(","));
    return p;
  }

  function run() {
    api.download(`/api/export?${buildParams()}`, `tasks.${fmt}`);
    setOpen(false);
  }

  // Fetch a TSV export and copy it to the clipboard, ready to paste into a Google Sheet.
  async function copyForSheets() {
    const tsv = await api.text(`/api/export?${buildParams("tsv")}`);
    await navigator.clipboard.writeText(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <button className="btn-secondary" data-testid="export-button" onClick={() => setOpen(true)}>{t("export.button")}</button>
      {open && (
        <Modal icon={<Download />} title={t("modals.exportTasks")} onClose={() => setOpen(false)} wide>
          <div className="row2">
            <div className="field">
              <label>{t("import.formatLabel")}</label>
              <select data-testid="export-format" value={fmt} onChange={(e) => setFmt(e.target.value as Fmt)}>
                <option value="xlsx">{t("export.fmtXlsx")}</option>
                <option value="csv">{t("export.fmtCsv")}</option>
                <option value="json">{t("export.fmtJson")}</option>
              </select>
            </div>
            <div className="field">
              <label>{t("export.include")}</label>
              <label className="muted" style={{ display: "flex", gap: 8, alignItems: "center", margin: "7px 0 0" }}>
                <input type="checkbox" style={{ width: "auto" }} checked={archived} onChange={(e) => setArchived(e.target.checked)} />
                {t("export.archivedTasks")}
              </label>
            </div>
          </div>

          <div className="field">
            <label>{t("export.whatToExport")} <span className="muted" style={{ fontWeight: 400 }}>{t("export.whatToExportHint")}</span></label>
            <div className="export-scope" data-testid="export-scope">
              {projects.map((pr) => {
                const projChecked = selProjects.has(pr.id);
                return (
                  <div key={pr.id} style={{ marginBottom: 6 }}>
                    <label style={{ display: "flex", gap: 7, alignItems: "center", fontWeight: 600, margin: 0 }}>
                      <input type="checkbox" style={{ width: "auto" }} checked={projChecked}
                        onChange={() => toggle(selProjects, pr.id, setSelProjects)} />
                      {pr.name}
                    </label>
                    <div style={{ paddingLeft: 22, display: "flex", flexWrap: "wrap", gap: "2px 14px" }}>
                      {pr.subprojects.map((s) => (
                        <label key={s.id} className="muted" style={{ display: "flex", gap: 6, alignItems: "center", margin: 0, fontSize: 13 }}>
                          <input type="checkbox" style={{ width: "auto" }}
                            checked={projChecked || selSubs.has(s.id)} disabled={projChecked}
                            onChange={() => toggle(selSubs, s.id, setSelSubs)} />
                          {s.name}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {me.is_admin && groups.length > 0 && (
            <div className="field">
              <label>{t("export.groups")} <span className="muted" style={{ fontWeight: 400 }}>{t("export.groupsHint")}</span></label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px" }} data-testid="export-groups">
                {groups.map((g) => (
                  <label key={g.id} className="muted" style={{ display: "flex", gap: 6, alignItems: "center", margin: 0, fontSize: 13 }}>
                    <input type="checkbox" style={{ width: "auto" }} checked={selGroups.has(g.id)}
                      onChange={() => toggle(selGroups, g.id, setSelGroups)} />
                    {g.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="row2">
            <div className="field">
              <label>{t("task.status")}</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">{t("list.anyStatus")}</option>
                {statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>{t("task.priority")}</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="">{t("list.anyPriority")}</option>
                {[5, 4, 3, 2, 1].map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
              </select>
            </div>
          </div>

          <div className="field">
            <label>{t("subtask.assignee")}</label>
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} style={{ maxWidth: 260 }}>
              <option value="">{t("list.anyAssignee")}</option>
              <option value="unassigned">{t("list.unassigned")}</option>
              {users.map((u) => <option key={u.id} value={String(u.id)}>{u.name || u.email}</option>)}
            </select>
          </div>

          <div className="field">
            <label>{t("export.columns")}</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
              {COLUMNS.map((c) => (
                <label key={c.key} className="muted" style={{ display: "flex", gap: 5, alignItems: "center", margin: 0, fontSize: 13 }}>
                  <input type="checkbox" style={{ width: "auto" }} checked={cols[c.key]}
                    onChange={(e) => setCols((s) => ({ ...s, [c.key]: e.target.checked }))} />
                  {t(c.i18nKey)}
                </label>
              ))}
            </div>
          </div>

          <div className="modal-foot">
            <button className="btn-secondary" style={{ marginRight: "auto" }} disabled={selected.length === 0}
              onClick={copyForSheets} data-testid="export-copy-sheets" title={t("export.copyTitle")}>
              <ClipboardList size={15} aria-hidden style={{ verticalAlign: "-3px", marginRight: 6 }} />{copied ? t("copy.copied") : t("export.copySheets")}
            </button>
            <button className="btn-secondary" onClick={() => setOpen(false)}>{t("common.cancel")}</button>
            <button className="btn-primary" data-testid="export-download" disabled={selected.length === 0} onClick={run}>{t("export.download")}</button>
          </div>
        </Modal>
      )}
    </>
  );
}
