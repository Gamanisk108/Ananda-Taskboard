// "Waiting for approval" (D50-C, ruled 2026-06-11): the member's own pending
// submissions. Approvals-list methodology minus admin actions — a sort select
// (no full filter bar at personal volume), NEW chip per the amended spec, rows
// open the read-only task popup (which carries the pending pill).
// NOTE: edit-approvals don't exist in this backend yet, so the spec's
// "EDIT · n changes" chips/diffs are N/A until that feature lands.

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Hourglass } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../state/auth";
import { buildSubLookup } from "../lookup";
import { useUsers } from "../users";
import { Modal, Spinner, ProjPill, SingleSelect, AvatarStack, PriorityIcon, useIsNarrow } from "./common";
import { PRIORITY_META, type Task } from "../types";

export function WaitingForApproval({ onClose, onOpen }: {
  onClose: () => void;
  onOpen: (t: Task) => void;
}) {
  const { t: tr } = useTranslation();
  const { me } = useAuth();
  const narrow = useIsNarrow();
  const users = useUsers();
  const subs = useMemo(() => (me ? buildSubLookup(me.tree) : new Map()), [me]);
  const [sort, setSort] = useState<"new" | "old">("new");

  const { data: rows = null } = useQuery({
    queryKey: ["tasks", "approvals-mine", me?.active_org ?? null],
    queryFn: () => api.get("/api/approvals/mine") as Promise<Task[]>,
  });

  const sorted = useMemo(() => {
    if (!rows) return null;
    const s = [...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return sort === "new" ? s : s.reverse();
  }, [rows, sort]);

  const sentOn = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—");
  const newChip = <span className="chip-request new">{tr("wfa.newChip", "NEW task")}</span>;

  return (
    <Modal fullScreenOnNarrow icon={<Hourglass />} title={tr("wfa.title", "Waiting for approval")} onClose={onClose} wide>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>{tr("wfa.sub", "Your submissions an admin hasn't reviewed yet. They stay on your board with a gold “Pending approval” pill until then.")}</p>
      <div className="filters" style={{ marginBottom: 10 }}>
        <SingleSelect value={sort} onChange={(v) => setSort(v as "new" | "old")}
          options={[{ value: "new", label: tr("wfa.sortNew", "Newest first") }, { value: "old", label: tr("wfa.sortOld", "Oldest first") }]} />
      </div>
      {!sorted ? <Spinner /> : sorted.length === 0 ? (
        <div className="empty"><Hourglass size={15} aria-hidden style={{ verticalAlign: "-2px", marginRight: 6, opacity: 0.6 }} />{tr("wfa.empty", "Nothing waiting — everything you've sent has been reviewed.")}</div>
      ) : narrow ? (
        /* Phones (amended D50): the List compact row verbatim — gold band,
           priority + name, proj + sub pills + sent-date, right col = chip + avatars. */
        <div>
          {sorted.map((t) => {
            const info = subs.get(t.subproject);
            return (
              <div key={t.id} className="crow pending-row" role="button" tabIndex={0} onClick={() => onOpen(t)}>
                <div className="crow-mid">
                  <span className="crow-nm">
                    <span title={PRIORITY_META[t.priority].label} style={{ marginRight: 5 }}><PriorityIcon level={t.priority} /></span>
                    {t.title}
                  </span>
                  <span className="crow-sub">
                    {info && <ProjPill name={info.projectName} color={info.projectColor} />}
                    {info && <ProjPill name={info.name} color={info.color} />}
                    <span className="muted" style={{ fontSize: 12 }}>{tr("wfa.sent", "sent {{date}}", { date: sentOn(t.created_at) })}</span>
                  </span>
                </div>
                <span className="rcol">
                  {newChip}
                  {t.assignees.length > 0 && <AvatarStack ids={t.assignees} users={users} />}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <table className="tbl">
          <thead>
            <tr><th>{tr("list.colTask")}</th><th>{tr("list.colProject")}</th><th>{tr("list.colSubproject")}</th><th>{tr("list.colAssignees")}</th><th>{tr("wfa.requested", "Requested")}</th><th>{tr("wfa.submitted", "Submitted")}</th></tr>
          </thead>
          <tbody>
            {sorted.map((t) => {
              const info = subs.get(t.subproject);
              return (
                <tr key={t.id} className="pending" onClick={() => onOpen(t)}>
                  <td className="c-task"><div className="task-cell">
                    <span title={PRIORITY_META[t.priority].label}><PriorityIcon level={t.priority} /></span>
                    <span className="task-name">{t.title}</span>
                  </div></td>
                  <td>{info && <ProjPill name={info.projectName} color={info.projectColor} />}</td>
                  <td>{info && <ProjPill name={info.name} color={info.color} />}</td>
                  <td><div className="who"><AvatarStack ids={t.assignees} users={users} /></div></td>
                  <td>{newChip}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{sentOn(t.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
