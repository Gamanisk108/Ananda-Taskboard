// Media attachments — a FILE LIST (name + size + delete) plus an "Add media"
// button that opens a drag-or-click upload popup. Used live on tasks/subtasks
// (uploads immediately) and in deferred mode on the bug report (holds files,
// parent uploads after the report is created). Up to ATTACH_MAX per item.
import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Paperclip, FileText, Film, Image as ImageIcon, Trash2, UploadCloud, Loader2 } from "lucide-react";
import { api } from "../api/client";
import { Modal } from "./common";
import {
  ATTACH_ACCEPT, ATTACH_MAX, fmtSize, precheck, type AttachTarget, type Attachment, uploadAttachment,
} from "../attachments";

function KindIcon({ kind }: { kind: "image" | "doc" | "video" }) {
  if (kind === "image") return <ImageIcon size={16} />;
  if (kind === "video") return <Film size={16} />;
  return <FileText size={16} />;
}

/** One presentational file row: icon · name (optional link) · size · delete. */
function FileRow({ kind, name, size, href, onDelete }: {
  kind: "image" | "doc" | "video"; name: string; size: number; href?: string; onDelete?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="att-row">
      <span className="att-ic"><KindIcon kind={kind} /></span>
      {href
        ? <a className="att-name" href={href} target="_blank" rel="noreferrer" title={name}>{name}</a>
        : <span className="att-name" title={name}>{name}</span>}
      <span className="att-size mono">{fmtSize(size)}</span>
      {onDelete && (
        <button type="button" className="att-del" title={t("common.remove", "Remove")} onClick={onDelete}>
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

/** The drag-or-click upload popup. `onFiles` does the actual work (live upload
 *  or hold); it may throw (message shown). Stays open so you can batch. */
function UploadDialog({ remaining, onFiles, onClose }: {
  remaining: number; onFiles: (files: File[]) => Promise<void>; onClose: () => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function take(files: FileList | null) {
    if (!files?.length) return;
    setErr("");
    setBusy(true);
    try {
      await onFiles([...files].slice(0, Math.max(0, remaining)));
    } catch (e) {
      setErr((e as Error).message || t("attach.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal icon={<Paperclip />} title={t("attach.add")} onClose={onClose}
      footer={<button type="button" className="btn-primary" onClick={onClose}>{t("common.done", "Done")}</button>}>
      <div
        className={`att-drop${drag ? " drag" : ""}${busy ? " busy" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files); }}
        onClick={() => !busy && inputRef.current?.click()}
        role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") inputRef.current?.click(); }}
      >
        {busy ? <Loader2 size={26} className="att-spin" /> : <UploadCloud size={26} />}
        <div className="att-drop-t">{busy ? t("attach.uploading") : t("attach.drop")}</div>
        <div className="att-drop-h">{t("attach.hint")}</div>
        <input ref={inputRef} type="file" accept={ATTACH_ACCEPT} multiple style={{ display: "none" }}
          onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
      </div>
      {remaining <= 0 && <div className="att-err">{t("attach.full", { n: ATTACH_MAX })}</div>}
      {err && <div className="att-err">{err}</div>}
    </Modal>
  );
}

/** Shared shell: a file list + an "Add media" button that opens the popup. */
function AttachBlock({ rows, remaining, canEdit, onFiles, label }: {
  rows: ReactNode; remaining: number; canEdit: boolean;
  onFiles: (files: File[]) => Promise<void>; label?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div className="att-wrap">
      {label && <label className="att-label">{label}</label>}
      <div className="att-list">{rows}</div>
      {canEdit && remaining > 0 && (
        <button type="button" className="btn-secondary att-addbtn" onClick={() => setOpen(true)}>
          <Paperclip size={15} /> {t("attach.add")}
        </button>
      )}
      {open && <UploadDialog remaining={remaining} onFiles={onFiles} onClose={() => setOpen(false)} />}
    </div>
  );
}

/* ---- Live: tasks & subtasks (uploads immediately) ---- */
export function Attachments({ target, targetId, canEdit, label }: {
  target: AttachTarget; targetId: number; canEdit: boolean; label?: string;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const qkey = ["attachments", target, targetId];
  const q = useQuery({
    queryKey: qkey,
    queryFn: () => api.get(`/api/attachments?${target}=${targetId}`) as Promise<Attachment[]>,
  });
  const list = q.data ?? [];
  const del = useMutation({
    mutationFn: (id: number) => api.del(`/api/attachments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qkey }),
  });
  async function onFiles(files: File[]) {
    for (const f of files) await uploadAttachment(target, targetId, f);
    qc.invalidateQueries({ queryKey: qkey });
  }
  const rows = list.length === 0
    ? <div className="att-empty">{t("attach.none")}</div>
    : list.map((a) => (
        <FileRow key={a.id} kind={a.kind} name={a.filename} size={a.size} href={a.url}
          onDelete={canEdit ? () => del.mutate(a.id) : undefined} />
      ));
  return <AttachBlock rows={rows} remaining={ATTACH_MAX - list.length} canEdit={canEdit} onFiles={onFiles} label={label} />;
}

/* ---- Deferred: bug report (no id yet — hold files, parent uploads on send) ---- */
export function PendingAttachments({ files, onChange, label }: {
  files: File[]; onChange: (f: File[]) => void; label?: string;
}) {
  const { t } = useTranslation();
  async function onFiles(picked: File[]) {
    for (const f of picked) precheck(f); // type/size gate up front
    onChange([...files, ...picked].slice(0, ATTACH_MAX));
  }
  const rows = files.length === 0
    ? <div className="att-empty">{t("attach.none")}</div>
    : files.map((f, i) => {
        const kind = f.type.startsWith("image/") ? "image" : f.type.startsWith("video/") ? "video" : "doc";
        return <FileRow key={i} kind={kind} name={f.name} size={f.size}
          onDelete={() => onChange(files.filter((_, j) => j !== i))} />;
      });
  return <AttachBlock rows={rows} remaining={ATTACH_MAX - files.length} canEdit onFiles={onFiles} label={label} />;
}
