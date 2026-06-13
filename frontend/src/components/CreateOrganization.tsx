// Shown when a user is authenticated but belongs to NO organization — e.g. after
// signing up with Google, or after leaving their only team. A clean standalone
// onboarding card (NOT crammed into the login form): name a team → create + own it.

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../state/auth";

export function CreateOrganization() {
  const { t } = useTranslation();
  const { me, refreshMe, logout } = useAuth();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true); setErr("");
    try {
      await api.createOrg({ organization: name.trim() });
      await refreshMe();   // now has a membership → App renders the board
    } catch {
      setErr(t("org.createError", "Couldn't create your organization. Please try again."));
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="card login-card rise">
        <div className="login-brand">
          <span className="dot" style={{ background: "var(--primary)", width: 12, height: 12 }} />
          <h1 style={{ fontSize: 22 }}>{t("org.welcomeTitle", "Set up your team")}</h1>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          {t("org.welcomeBody", "Welcome{{name}}! Create your organization to get started — you'll be its owner and can invite others.",
            { name: me?.name ? `, ${me.name}` : "" })}
        </p>
        <div className="field">
          <label>{t("org.nameLabel", "Organization name")}</label>
          <input value={name} autoFocus onChange={(e) => setName(e.target.value)}
            placeholder={t("org.namePh", "e.g. Ananda Portland")}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); create(); } }} />
        </div>
        {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10 }}>{err}</div>}
        <button type="button" className="btn-primary btn-full" disabled={!name.trim() || busy} onClick={create}>
          {busy ? t("org.creating", "Creating…") : t("org.create", "Create organization")}
        </button>
        <div style={{ marginTop: 14, textAlign: "center" }}>
          <button type="button" onClick={logout}
            style={{ background: "none", border: "none", padding: 0, color: "var(--primary)", fontSize: 13, cursor: "pointer" }}>
            {t("org.signOut", "Sign out")}
          </button>
        </div>
      </div>
    </div>
  );
}
