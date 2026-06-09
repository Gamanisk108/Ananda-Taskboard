import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { Modal, Spinner, SingleSelect } from "./common";
import type { Task } from "../types";

interface ProjLite { id: number; name: string; subprojects: { id: number; name: string; is_default?: boolean }[]; }

interface Props {
  kind: "project" | "subproject";
  id: number;
  name: string;
  projects: ProjLite[]; // for choosing a move target
  onClose: () => void;
  onDone: () => void; // after delete completes
}

export function DeleteWithMove({ kind, id, name, projects, onClose, onDone }: Props) {
  const { t } = useTranslation();
  const kindWord = kind === "project" ? t("del.kindProject") : t("del.kindSub");
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [keep, setKeep] = useState<Set<number>>(new Set()); // task ids to move (keep)
  const [target, setTarget] = useState<number>(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams();
    p.set(kind, String(id));
    p.set("approval", "approved");
    // fetch across all approval states by hitting both? keep simple: list endpoint shows approved.
    api.get(`/api/tasks?${kind}=${id}`).then((d) => {
      setTasks(d as Task[]);
      setKeep(new Set((d as Task[]).map((t) => t.id))); // default: move all
    }).catch(() => setTasks([]));
  }, [kind, id]);

  // target sub-project options: everything except the item being deleted
  const targets = useMemo(() => {
    const out: { id: number; label: string }[] = [];
    for (const p of projects) {
      if (kind === "project" && p.id === id) continue; // skip the project being deleted
      for (const s of p.subprojects) {
        if (kind === "subproject" && s.id === id) continue; // skip the sub being deleted
        out.push({ id: s.id, label: `${p.name} / ${s.name}` });
      }
    }
    return out;
  }, [projects, kind, id]);

  function toggle(tid: number) {
    const n = new Set(keep);
    n.has(tid) ? n.delete(tid) : n.add(tid);
    setKeep(n);
  }

  async function run(moveFirst: boolean) {
    setBusy(true);
    try {
      if (moveFirst && target) {
        const toMove = (tasks ?? []).filter((t) => keep.has(t.id));
        for (const t of toMove) await api.patch(`/api/tasks/${t.id}`, { subproject: target });
      }
      await api.del(`/api/${kind === "project" ? "projects" : "subprojects"}/${id}`);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  const moveCount = keep.size;

  return (
    <Modal title={t("del.title", { kind: kindWord, name })} onClose={onClose} wide>
      {!tasks ? <Spinner /> : (
        <>
          {tasks.length === 0 ? (
            <p>{t("del.noTasks", { kind: kindWord })}</p>
          ) : (
            <>
              <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
                {t("del.hasTasks", { kind: kindWord, count: tasks.length })}
              </p>
              <div className="field">
                <label>{t("del.moveLabel")}</label>
                <SingleSelect width="100%" value={target ? String(target) : ""} placeholder={t("del.selectSub")}
                  onChange={(v) => setTarget(Number(v) || 0)}
                  options={targets.map((tg) => ({ value: String(tg.id), label: tg.label }))} />
              </div>
              <div className="assignee-list" style={{ maxHeight: 220 }}>
                {tasks.map((t) => (
                  <label key={t.id} className="assignee-row">
                    <input type="checkbox" style={{ width: "auto" }} checked={keep.has(t.id)} onChange={() => toggle(t.id)} />
                    <span>{t.title}</span>
                  </label>
                ))}
              </div>
            </>
          )}
          <div className="modal-foot" style={{ marginTop: 14 }}>
            <button type="button" className="btn-secondary" onClick={onClose}>{t("common.cancel")}</button>
            {tasks.length > 0 && (
              <button type="button" className="btn-primary" disabled={busy || !target || moveCount === 0}
                onClick={() => run(true)}>
                {busy ? t("del.working") : t("del.moveDelete", { count: moveCount })}
              </button>
            )}
            <button type="button" className="btn-danger" disabled={busy} onClick={() => run(false)}>
              {tasks.length > 0 ? t("del.deleteAll") : t("common.delete")}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
