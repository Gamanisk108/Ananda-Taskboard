import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Upload, CircleCheck } from "lucide-react";
import { api, ApiError } from "../api/client";
import { Modal, SingleSelect } from "./common";

type Fmt = "csv" | "tsv" | "json" | "xlsx";
type Decision = "overwrite" | "create" | "skip";

interface PreviewRow {
  row: number;
  action: "create" | "update" | "error";
  match_id: number | null;
  title: string;
  project: string;
  subproject: string;
  will_create_project: boolean;
  will_create_subproject: boolean;
  errors: string[];
  warnings: string[];
}
interface Preview {
  rows: PreviewRow[];
  new_projects: string[];
  new_subprojects: string[];
  summary: { create?: number; update?: number; error?: number };
  total: number;
}

const EXT_FMT: Record<string, Fmt> = { csv: "csv", tsv: "tsv", txt: "tsv", json: "json", xlsx: "xlsx" };

async function fileToContent(file: File): Promise<{ fmt: Fmt; content: string }> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "csv";
  const fmt = EXT_FMT[ext] ?? "csv";
  if (fmt === "xlsx") {
    const buf = await file.arrayBuffer();
    let bin = "";
    new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
    return { fmt, content: btoa(bin) }; // base64 for the JSON body
  }
  return { fmt, content: await file.text() };
}

export function ImportDialog({ onImported }: { onImported: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [fmt, setFmt] = useState<Fmt>("csv");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; errors: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setContent(""); setFileName(""); setPreview(null); setDecisions({}); setResult(null); setErr(""); setFmt("csv");
  }
  function close() { setOpen(false); reset(); }

  async function onFile(file: File | undefined) {
    if (!file) return;
    const { fmt: f, content: c } = await fileToContent(file);
    setFmt(f); setContent(c); setFileName(file.name); setPreview(null); setResult(null);
  }

  async function runPreview() {
    setErr(""); setBusy(true); setResult(null);
    try {
      const pv = (await api.post("/api/import", { action: "preview", fmt, content })) as Preview;
      setPreview(pv);
      setDecisions({});
    } catch (e) {
      setErr((e as ApiError)?.data && typeof (e as ApiError).data === "object"
        ? ((e as ApiError).data as { detail?: string }).detail ?? t("import.errRead")
        : t("import.errRead"));
    } finally { setBusy(false); }
  }

  async function runCommit() {
    setErr(""); setBusy(true);
    try {
      const res = (await api.post("/api/import", { action: "commit", fmt, content, decisions })) as typeof result;
      setResult(res);
      onImported();
    } catch (e) {
      setErr(((e as ApiError)?.data as { detail?: string })?.detail ?? t("import.errFailed"));
    } finally { setBusy(false); }
  }

  function setDecision(row: PreviewRow, d: Decision | "") {
    setDecisions((cur) => {
      const next = { ...cur };
      // default action needs no entry; only store explicit overrides
      const isDefault = (row.action === "update" && d === "overwrite") || (row.action === "create" && d === "create") || d === "";
      if (isDefault) delete next[String(row.row)];
      else next[String(row.row)] = d as Decision;
      return next;
    });
  }

  const counts = preview?.summary ?? {};
  const committable = (counts.create ?? 0) + (counts.update ?? 0) > 0;

  const badge = (a: string) =>
    a === "update" ? { bg: "var(--primary-weak)", c: "var(--accent)", t: t("import.badgeUpdate") }
    : a === "error" ? { bg: "#b4452f1a", c: "var(--danger)", t: t("import.badgeError") }
    : { bg: "#3f7d541a", c: "var(--success)", t: t("import.optCreate") };

  return (
    <>
      <button className="btn-secondary" data-testid="import-button" onClick={() => setOpen(true)}>{t("import.button")}</button>
      {open && (
        <Modal fullScreenOnNarrow icon={<Upload />} title={t("modals.importTasks")} onClose={close} wide>
          {!result && (
            <>
              <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
                {t("import.intro")}
              </p>

              <div className="row2">
                <div className="field">
                  <label>{t("import.pasteLabel")}</label>
                  <textarea data-testid="import-paste" rows={6} value={fmt === "xlsx" ? "" : content}
                    placeholder={"ID\tProject\tSub-project\tTitle\n\tKaruna Devi\tMarketing\tNew task"}
                    disabled={fmt === "xlsx"}
                    onChange={(e) => { setContent(e.target.value); setFileName(""); setPreview(null); setResult(null); if (fmt === "xlsx") setFmt("tsv"); }}
                    style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} />
                </div>
                <div className="field">
                  <label>{t("import.uploadLabel")}</label>
                  <input ref={fileInputRef} data-testid="import-file" type="file" accept=".csv,.tsv,.txt,.json,.xlsx"
                    style={{ display: "none" }}
                    onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
                  <div
                    data-testid="import-dropzone"
                    role="button"
                    tabIndex={0}
                    aria-label={t("import.dropHint")}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click(); } }}
                    onDragOver={(e) => { e.preventDefault(); if (!dragOver) setDragOver(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); onFile(e.dataTransfer.files?.[0]); }}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      gap: 6, padding: "22px 16px", textAlign: "center", cursor: "pointer",
                      border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
                      borderRadius: "var(--r-ctl)",
                      background: dragOver ? "var(--primary-weak)" : "transparent",
                      transition: "border-color .15s, background .15s",
                    }}>
                    <Upload size={20} aria-hidden style={{ color: dragOver ? "var(--accent)" : "var(--muted)" }} />
                    <span className="muted" style={{ fontSize: 13 }}>{dragOver ? t("import.dropActive") : t("import.dropHint")}</span>
                  </div>
                  {fileName && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{fileName} ({fmt})</div>}
                  <label style={{ marginTop: 10 }}>{t("import.formatLabel")}</label>
                  <SingleSelect testId="import-format" width="100%" value={fmt} disabled={!!fileName} onChange={(v) => setFmt(v as Fmt)}
                    options={[
                      { value: "csv", label: t("import.fmtCsv") },
                      { value: "tsv", label: t("import.fmtTsv") },
                      { value: "json", label: t("import.fmtJson") },
                      { value: "xlsx", label: t("import.fmtXlsx") },
                    ]} />
                </div>
              </div>

              {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10 }}>{err}</div>}

              {preview && (
                <div style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 12 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                    <strong>{t("import.rows", { n: preview.total })}</strong>
                    <span className="pill" style={{ background: "#3f7d541a", color: "var(--success)" }}>{t("import.nCreate", { n: counts.create ?? 0 })}</span>
                    <span className="pill" style={{ background: "var(--primary-weak)", color: "var(--accent)" }}>{t("import.nUpdate", { n: counts.update ?? 0 })}</span>
                    {(counts.error ?? 0) > 0 && <span className="pill" style={{ background: "#b4452f1a", color: "var(--danger)" }}>{t("import.nError", { n: counts.error })}</span>}
                  </div>
                  {(preview.new_projects.length > 0 || preview.new_subprojects.length > 0) && (
                    <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                      {t("import.willCreate", { list: [...preview.new_projects.map((p) => `${p}`), ...preview.new_subprojects.map((s) => `↳ ${s}`)].join(" · ") })}
                    </div>
                  )}
                  {(counts.update ?? 0) > 0 && (
                    <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                      {t("import.overwriteWarn")}
                    </div>
                  )}
                  <div style={{ maxHeight: 260, overflow: "auto", border: "1px solid var(--border)", borderRadius: "var(--r-ctl)" }}>
                    <table className="tbl" style={{ border: "none" }} data-testid="import-preview">
                      <thead><tr><th>#</th><th>{t("import.colAction")}</th><th>{t("list.colTask")}</th><th>{t("approvals.where")}</th><th>{t("import.colDecision")}</th></tr></thead>
                      <tbody>
                        {preview.rows.map((r) => {
                          const b = badge(r.action);
                          return (
                            <tr key={r.row}>
                              <td className="mono" style={{ fontSize: 12 }}>{r.match_id ? `#${r.match_id}` : r.row + 1}</td>
                              <td><span className="pill" style={{ background: b.bg, color: b.c }}>{b.t}</span></td>
                              <td>
                                {r.title || <span className="muted">—</span>}
                                {r.errors.map((x, i) => <div key={i} style={{ color: "var(--danger)", fontSize: 11 }}>{x}</div>)}
                                {r.warnings.map((x, i) => <div key={i} className="muted" style={{ fontSize: 11 }}>{x}</div>)}
                              </td>
                              <td style={{ fontSize: 12 }} className="muted">{r.project} / {r.subproject}</td>
                              <td>
                                {r.action === "error" ? <span className="muted" style={{ fontSize: 12 }}>{t("import.skipped")}</span>
                                  : r.action === "update" ? (
                                    <SingleSelect width={150} value={decisions[String(r.row)] ?? "overwrite"}
                                      onChange={(v) => setDecision(r, v as Decision)}
                                      options={[
                                        { value: "overwrite", label: t("import.optOverwrite") },
                                        { value: "create", label: t("import.optCreateNew") },
                                        { value: "skip", label: t("import.optSkip") },
                                      ]} />
                                  ) : (
                                    <SingleSelect width={150} value={decisions[String(r.row)] ?? "create"}
                                      onChange={(v) => setDecision(r, v as Decision)}
                                      options={[
                                        { value: "create", label: t("import.optCreate") },
                                        { value: "skip", label: t("import.optSkip") },
                                      ]} />
                                  )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="modal-foot">
                <button className="btn-secondary" onClick={close}>{t("common.cancel")}</button>
                {!preview ? (
                  <button className="btn-primary" data-testid="import-preview-btn" disabled={busy || !content.trim()} onClick={runPreview}>
                    {busy ? t("import.reading") : t("import.preview")}
                  </button>
                ) : (
                  <button className="btn-primary" data-testid="import-commit-btn" disabled={busy || !committable} onClick={runCommit}>
                    {busy ? t("import.importing") : t("import.confirm")}
                  </button>
                )}
              </div>
            </>
          )}

          {result && (
            <div data-testid="import-result">
              <div className="empty" style={{ background: "#3f7d541a", color: "var(--text)" }}>
                <CircleCheck size={16} aria-hidden style={{ verticalAlign: "-3px", marginRight: 6 }} />{t("import.imported", {
                  created: result.created, updated: result.updated,
                  skipped: result.skipped ? t("import.resSkipped", { n: result.skipped }) : "",
                  errored: result.errors ? t("import.resErrored", { n: result.errors }) : "",
                })}
              </div>
              <div className="modal-foot">
                <button className="btn-secondary" onClick={() => { reset(); }}>{t("import.importMore")}</button>
                <button className="btn-primary" onClick={close}>{t("common.done")}</button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
