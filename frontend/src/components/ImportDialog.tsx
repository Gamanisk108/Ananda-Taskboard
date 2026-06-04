import { useState } from "react";
import { api, ApiError } from "../api/client";
import { Modal } from "./common";

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
  const [open, setOpen] = useState(false);
  const [fmt, setFmt] = useState<Fmt>("csv");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; errors: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

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
        ? ((e as ApiError).data as { detail?: string }).detail ?? "Could not read that input."
        : "Could not read that input.");
    } finally { setBusy(false); }
  }

  async function runCommit() {
    setErr(""); setBusy(true);
    try {
      const res = (await api.post("/api/import", { action: "commit", fmt, content, decisions })) as typeof result;
      setResult(res);
      onImported();
    } catch (e) {
      setErr(((e as ApiError)?.data as { detail?: string })?.detail ?? "Import failed.");
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
    a === "update" ? { bg: "var(--primary-weak)", c: "var(--accent)", t: "Update" }
    : a === "error" ? { bg: "#b4452f1a", c: "var(--danger)", t: "Error" }
    : { bg: "#3f7d541a", c: "var(--success)", t: "Create" };

  return (
    <>
      <button className="btn-secondary" data-testid="import-button" onClick={() => setOpen(true)}>Import ▾</button>
      {open && (
        <Modal title="Import tasks" onClose={close} wide>
          {!result && (
            <>
              <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
                Paste rows copied from a spreadsheet (including the header row), or upload a
                CSV / TSV / JSON / Excel file. Rows are matched to existing tasks by the
                <strong> ID</strong> column; rows without a known ID create new tasks. Missing
                projects/sub-projects are created automatically.
              </p>

              <div className="row2">
                <div className="field">
                  <label>Paste from a spreadsheet</label>
                  <textarea data-testid="import-paste" rows={6} value={fmt === "xlsx" ? "" : content}
                    placeholder={"ID\tProject\tSub-project\tTitle\n\tKaruna Devi\tMarketing\tNew task"}
                    disabled={fmt === "xlsx"}
                    onChange={(e) => { setContent(e.target.value); setFileName(""); setPreview(null); setResult(null); if (fmt === "xlsx") setFmt("tsv"); }}
                    style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} />
                </div>
                <div className="field">
                  <label>…or upload a file</label>
                  <input data-testid="import-file" type="file" accept=".csv,.tsv,.txt,.json,.xlsx"
                    onChange={(e) => onFile(e.target.files?.[0])} />
                  {fileName && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{fileName} ({fmt})</div>}
                  <label style={{ marginTop: 10 }}>Format</label>
                  <select data-testid="import-format" value={fmt} onChange={(e) => setFmt(e.target.value as Fmt)} disabled={!!fileName}>
                    <option value="csv">CSV (comma)</option>
                    <option value="tsv">TSV / Google Sheets paste (tab)</option>
                    <option value="json">JSON</option>
                    <option value="xlsx">Excel (.xlsx) — upload only</option>
                  </select>
                </div>
              </div>

              {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10 }}>{err}</div>}

              {preview && (
                <div style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 12 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                    <strong>{preview.total} rows</strong>
                    <span className="pill" style={{ background: "#3f7d541a", color: "var(--success)" }}>{counts.create ?? 0} create</span>
                    <span className="pill" style={{ background: "var(--primary-weak)", color: "var(--accent)" }}>{counts.update ?? 0} update</span>
                    {(counts.error ?? 0) > 0 && <span className="pill" style={{ background: "#b4452f1a", color: "var(--danger)" }}>{counts.error} error</span>}
                  </div>
                  {(preview.new_projects.length > 0 || preview.new_subprojects.length > 0) && (
                    <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                      Will create: {[...preview.new_projects.map((p) => `📁 ${p}`), ...preview.new_subprojects.map((s) => `↳ ${s}`)].join(" · ")}
                    </div>
                  )}
                  {(counts.update ?? 0) > 0 && (
                    <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                      ⚠ Rows with a matching ID will <strong>overwrite</strong> the existing task. Switch any to “Create new” or “Skip” below.
                    </div>
                  )}
                  <div style={{ maxHeight: 260, overflow: "auto", border: "1px solid var(--border)", borderRadius: "var(--r-ctl)" }}>
                    <table className="tbl" style={{ border: "none" }} data-testid="import-preview">
                      <thead><tr><th>#</th><th>Action</th><th>Task</th><th>Where</th><th>Decision</th></tr></thead>
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
                                {r.action === "error" ? <span className="muted" style={{ fontSize: 12 }}>skipped</span>
                                  : r.action === "update" ? (
                                    <select style={{ width: "auto", fontSize: 12 }}
                                      value={decisions[String(r.row)] ?? "overwrite"}
                                      onChange={(e) => setDecision(r, e.target.value as Decision)}>
                                      <option value="overwrite">Overwrite</option>
                                      <option value="create">Create new</option>
                                      <option value="skip">Skip</option>
                                    </select>
                                  ) : (
                                    <select style={{ width: "auto", fontSize: 12 }}
                                      value={decisions[String(r.row)] ?? "create"}
                                      onChange={(e) => setDecision(r, e.target.value as Decision)}>
                                      <option value="create">Create</option>
                                      <option value="skip">Skip</option>
                                    </select>
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
                <button className="btn-secondary" onClick={close}>Cancel</button>
                {!preview ? (
                  <button className="btn-primary" data-testid="import-preview-btn" disabled={busy || !content.trim()} onClick={runPreview}>
                    {busy ? "Reading…" : "Preview import"}
                  </button>
                ) : (
                  <button className="btn-primary" data-testid="import-commit-btn" disabled={busy || !committable} onClick={runCommit}>
                    {busy ? "Importing…" : "Confirm import"}
                  </button>
                )}
              </div>
            </>
          )}

          {result && (
            <div data-testid="import-result">
              <div className="empty" style={{ background: "#3f7d541a", color: "var(--text)" }}>
                ✅ Imported — <strong>{result.created}</strong> created, <strong>{result.updated}</strong> updated
                {result.skipped ? `, ${result.skipped} skipped` : ""}{result.errors ? `, ${result.errors} errored` : ""}.
              </div>
              <div className="modal-foot">
                <button className="btn-secondary" onClick={() => { reset(); }}>Import more</button>
                <button className="btn-primary" onClick={close}>Done</button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
