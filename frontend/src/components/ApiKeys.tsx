// API Keys — admin-only Settings pane (org-scoped personal access tokens for AI
// assistants / scripts). Backend: GET/POST /api/apikeys, DELETE /api/apikeys/<id>
// (soft-revoke). The full secret is returned ONLY on create — this pane shows it
// once in a highlighted "reveal" box, then it's gone from state forever (D-style
// reveal-once pattern, mirrored from the Share-link copy control in ShareButton.tsx).
//
// Mirrors StatusManager/TeamAdmin's data-fetch shape but via TanStack Query (the
// app's standard for anything mutated — see ShareButton.tsx's SharePanel), since
// this pane has real create/revoke mutations rather than StatusManager's plain
// load()-after-every-write style.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { KeyRound, Plus, Copy, Check, Trash2 } from "lucide-react";
import { api } from "../api/client";
import { copyText } from "../share";
import { useConfirm } from "./confirm";
import { SingleSelect, Spinner } from "./common";
import i18n from "../i18n";

type Scope = "read" | "read_write";
type Status = "active" | "revoked" | "expired";

interface ApiKey {
  id: number;
  name: string;
  scope: Scope;
  prefix: string;
  masked_key: string;
  created_by_name: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  status: Status;
}

/** POST /api/apikeys response — same fields as ApiKey plus the one-time secret. */
interface CreatedApiKey extends ApiKey {
  key: string;
}

const QK = ["apikeys"] as const;

/** Locale-aware "3 days ago" / "in 2 hours" via Intl (no per-string translation
 *  keys needed for every possible time bucket — Intl.RelativeTimeFormat already
 *  localizes correctly off the active UI language). */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = then - Date.now();
  const abs = Math.abs(diffMs);
  const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR, MONTH = 30 * DAY, YEAR = 365 * DAY;
  const rtf = new Intl.RelativeTimeFormat(i18n.language || "en", { numeric: "auto" });
  if (abs < MIN) return rtf.format(0, "second");
  if (abs < HOUR) return rtf.format(Math.round(diffMs / MIN), "minute");
  if (abs < DAY) return rtf.format(Math.round(diffMs / HOUR), "hour");
  if (abs < MONTH) return rtf.format(Math.round(diffMs / DAY), "day");
  if (abs < YEAR) return rtf.format(Math.round(diffMs / MONTH), "month");
  return rtf.format(Math.round(diffMs / YEAR), "year");
}

export function ApiKeysPane() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [showCreate, setShowCreate] = useState(false);
  const [reveal, setReveal] = useState<CreatedApiKey | null>(null);
  const [flash, setFlash] = useState(""); // transient inline message (no toast system in this app)

  const { data: keys, isLoading, isError } = useQuery({
    queryKey: QK,
    queryFn: () => api.get("/api/apikeys") as Promise<ApiKey[]>,
  });

  const createMut = useMutation({
    mutationFn: (body: { name: string; scope: Scope }) => api.post("/api/apikeys", body) as Promise<CreatedApiKey>,
    onSuccess: (created) => { setReveal(created); setShowCreate(false); },
    onSettled: () => qc.invalidateQueries({ queryKey: QK }),
  });
  const revokeMut = useMutation({
    mutationFn: (id: number) => api.del(`/api/apikeys/${id}`),
    onSettled: () => qc.invalidateQueries({ queryKey: QK }),
  });

  async function revoke(k: ApiKey) {
    if (!(await confirm({
      body: t("apiKeys.revokeConfirmBody", { name: k.name }),
      danger: true, confirmLabel: t("apiKeys.revokeConfirm"),
    }))) return;
    try { await revokeMut.mutateAsync(k.id); }
    catch { setFlash(t("apiKeys.revokeError")); setTimeout(() => setFlash(""), 3000); }
  }

  const list = keys ?? [];

  return (
    <div>
      <div className="ak-head">
        <div>
          <h3 className="section-title" style={{ marginTop: 0 }}>{t("apiKeys.title")}</h3>
          <div className="ak-sub">{t("apiKeys.subtitle")}</div>
        </div>
        {!reveal && (
          <button type="button" className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={15} /> {t("apiKeys.newKey")}
          </button>
        )}
      </div>

      {reveal && <RevealBox created={reveal} onDone={() => setReveal(null)} />}

      {showCreate && !reveal && (
        <CreateForm
          busy={createMut.isPending}
          error={createMut.isError ? t("apiKeys.createError") : ""}
          onCancel={() => setShowCreate(false)}
          onSubmit={(body) => createMut.mutate(body)}
        />
      )}

      {flash && <div style={{ color: "var(--danger)", fontSize: 13, margin: "8px 0" }}>{flash}</div>}

      {isLoading ? <Spinner /> : isError ? (
        <div style={{ color: "var(--danger)", fontSize: 13, padding: "12px 0" }}>{t("apiKeys.loadError")}</div>
      ) : list.length === 0 && !showCreate && !reveal ? (
        <div className="empty">
          <KeyRound size={20} aria-hidden style={{ opacity: 0.6, display: "block", margin: "0 auto 8px" }} />
          <div>{t("apiKeys.emptyTitle")}</div>
          <div style={{ fontSize: 12.5, marginTop: 4 }}>{t("apiKeys.emptyBody")}</div>
        </div>
      ) : list.length > 0 && (
        <table className="tbl ak-tbl">
          <thead>
            <tr>
              <th>{t("apiKeys.colName")}</th>
              <th>{t("apiKeys.colScope")}</th>
              <th>{t("apiKeys.colKey")}</th>
              <th>{t("apiKeys.colCreatedBy")}</th>
              <th>{t("apiKeys.colLastUsed")}</th>
              <th>{t("apiKeys.colStatus")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((k) => (
              <tr key={k.id} className={k.status !== "active" ? "ak-row-muted" : undefined}>
                <td>{k.name}</td>
                <td>{t(k.scope === "read" ? "apiKeys.scopeRead" : "apiKeys.scopeReadWrite")}</td>
                <td className="mono">{k.masked_key}</td>
                <td className="muted">{k.created_by_name}</td>
                <td className="muted">{k.last_used_at ? timeAgo(k.last_used_at) : t("apiKeys.never")}</td>
                <td><StatusBadge status={k.status} /></td>
                <td>
                  {k.status === "active" ? (
                    <button type="button" className="btn-ghost" style={{ color: "var(--danger)" }}
                      disabled={revokeMut.isPending} onClick={() => revoke(k)}>
                      <Trash2 size={14} /> {t("apiKeys.revoke")}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {list.length > 0 && !showCreate && !reveal && <UsageHint />}
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const { t } = useTranslation();
  const cls = status === "active" ? "ak-badge-active" : status === "expired" ? "ak-badge-expired" : "ak-badge-revoked";
  const label = status === "active" ? t("apiKeys.statusActive") : status === "expired" ? t("apiKeys.statusExpired") : t("apiKeys.statusRevoked");
  return <span className={`pill ${cls}`}>{label}</span>;
}

function CreateForm({ busy, error, onCancel, onSubmit }: {
  busy: boolean; error: string; onCancel: () => void; onSubmit: (body: { name: string; scope: Scope }) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [scope, setScope] = useState<Scope>("read"); // least-privilege default (Gordon, 2026-07-05)

  function submit() {
    const v = name.trim();
    if (!v) return;
    // v1: no expiry field in the UI (backend supports `expires_at`, deferred —
    // keeps the create form to the two fields the spec calls for).
    onSubmit({ name: v, scope });
  }

  return (
    <div className="card ak-create" style={{ padding: 12, marginBottom: 14, background: "var(--surface-sunk)" }}>
      <div className="field">
        <label>{t("apiKeys.nameLabel")}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("apiKeys.namePlaceholder")} autoFocus />
      </div>
      <div className="field">
        <label>{t("apiKeys.scopeLabel")}</label>
        <SingleSelect width="100%" value={scope} onChange={(v) => setScope(v as Scope)}
          options={[
            { value: "read", label: t("apiKeys.scopeRead") },
            { value: "read_write", label: t("apiKeys.scopeReadWrite") },
          ]} />
      </div>
      {error && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8 }}>{error}</div>}
      <div className="set-actions" style={{ maxWidth: "none" }}>
        <button type="button" className="btn-secondary" style={{ marginRight: "auto" }} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="button" className="btn-primary" disabled={!name.trim() || busy} onClick={submit}>
          {busy ? t("common.saving") : t("apiKeys.create")}
        </button>
      </div>
    </div>
  );
}

function RevealBox({ created, onDone }: { created: CreatedApiKey; onDone: () => void }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (await copyText(created.key)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <div className="ak-reveal">
      <div className="ak-reveal-t">{t("apiKeys.revealTitle")}</div>
      <div className="ak-reveal-row">
        <input className="mono ak-reveal-input" readOnly value={created.key}
          aria-label={t("apiKeys.revealTitle")} onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className="btn-primary" onClick={copy}
          aria-label={copied ? t("apiKeys.copied") : t("apiKeys.copy")} title={copied ? t("apiKeys.copied") : t("apiKeys.copy")}>
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>
      <div className="ak-reveal-warn">{t("apiKeys.revealWarning")}</div>
      <UsageHint apiKey={created.key} />
      <div className="set-actions" style={{ maxWidth: "none" }}>
        <button type="button" className="btn-primary" style={{ marginLeft: "auto" }} onClick={onDone}>{t("apiKeys.doneReveal")}</button>
      </div>
    </div>
  );
}

/** Minimal copy-able curl snippet. Uses the just-created key when shown inside
 *  the reveal box, else a placeholder for the general "how to use it" hint. */
function UsageHint({ apiKey }: { apiKey?: string }) {
  const { t } = useTranslation();
  const sample = apiKey ?? "atb_your_key_here";
  const snippet = `curl https://ananda-taskboard.onrender.com/api/tasks \\\n  -H "Authorization: Bearer ${sample}"`;
  return (
    <div className="ak-usage">
      <div className="ak-usage-t">{t("apiKeys.usageHint")}</div>
      <pre className="mono ak-usage-pre">{snippet}</pre>
    </div>
  );
}
