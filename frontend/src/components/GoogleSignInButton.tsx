// "Continue with Google" — renders Google Identity Services when a public
// VITE_GOOGLE_CLIENT_ID is baked in, else nothing. On credential: exchange for our
// JWTs. A brand-new account with no org runs an inline "name your organization"
// step (signup). In an invite context, the parent supplies `onAuthed` to join the
// invited org instead.

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../api/client";
import { useAuth } from "../state/auth";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
let gisPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("GIS failed to load"));
    document.head.appendChild(s);
  });
  return gisPromise;
}

export function GoogleSignInButton({ onAuthed }: {
  /** Override the default post-auth behavior (e.g. accept an invite). Receives the
   *  google response; should finish the flow (refreshMe / accept). */
  onAuthed?: (data: { needs_org: boolean; created: boolean }) => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const { refreshMe } = useAuth();
  const holder = useRef<HTMLDivElement>(null);
  const [needsOrg, setNeedsOrg] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onCredential(resp: { credential: string }) {
    setErr("");
    try {
      const data = await api.googleLogin(resp.credential);
      if (onAuthed) { await onAuthed(data); return; }
      if (data.needs_org) setNeedsOrg(true);
      else await refreshMe();
    } catch (e) {
      const detail = e instanceof ApiError ? (e.data as { detail?: string })?.detail : "";
      setErr(detail || t("google.error", "Google sign-in failed. Please try again."));
    }
  }

  async function createOrg() {
    if (!orgName.trim() || busy) return;
    setBusy(true); setErr("");
    try {
      await api.createOrg({ organization: orgName.trim() });
      await refreshMe();
    } catch {
      setErr(t("google.orgError", "Couldn't create your organization."));
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;
    loadGis().then(() => {
      if (cancelled || !holder.current || !window.google) return;
      window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: onCredential });
      window.google.accounts.id.renderButton(holder.current, {
        theme: "outline", size: "large", text: "continue_with", width: 280,
      });
    }).catch(() => setErr(t("google.loadError", "Couldn't load Google sign-in.")));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!CLIENT_ID) return null;

  if (needsOrg) {
    return (
      <div className="field" style={{ marginTop: 12 }}>
        <label>{t("google.nameOrg", "Name your organization")}</label>
        <input value={orgName} autoFocus onChange={(e) => setOrgName(e.target.value)}
          placeholder={t("google.orgPh", "e.g. Ananda Portland")}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createOrg(); } }} />
        <button type="button" className="btn-primary btn-full" style={{ marginTop: 8 }} disabled={!orgName.trim() || busy} onClick={createOrg}>
          {busy ? t("common.saving", "Saving…") : t("google.createOrg", "Create organization")}
        </button>
        {err && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 6 }}>{err}</div>}
      </div>
    );
  }

  return (
    <div className="google-signin" style={{ marginTop: 14 }}>
      <div className="or-divider"><span>{t("google.or", "or")}</span></div>
      <div ref={holder} style={{ display: "flex", justifyContent: "center", marginTop: 12 }} />
      {err && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 8, textAlign: "center" }}>{err}</div>}
    </div>
  );
}
