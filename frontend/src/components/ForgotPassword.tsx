import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { BackLabel } from "./common";

const linkBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  color: "var(--primary)",
  fontSize: 13,
  cursor: "pointer",
};

/** Step 1 of self-service reset: request a link. On submit we always show the
 *  same "check your email" confirmation — the backend never reveals whether the
 *  address maps to a real account. */
export function ForgotPassword({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.requestPasswordReset(email);
    } finally {
      setBusy(false);
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="login-wrap">
        <div className="card login-card rise">
          <div className="login-brand">
            <img src="/logo.png" alt="" style={{ width: 26, height: 26, objectFit: "contain" }} />
            <h1 style={{ fontSize: 22 }}>{t("reset.sentTitle")}</h1>
          </div>
          <p className="muted" style={{ marginTop: 0 }}>{t("reset.sentBody", { email })}</p>
          <p className="muted" style={{ fontSize: 13 }}>{t("login.forgotHelp")}</p>
          <button type="button" className="btn-secondary btn-full" onClick={onBack}>
            <BackLabel>{t("reset.backToSignIn")}</BackLabel>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <form className="card login-card rise" onSubmit={submit}>
        <div className="login-brand">
          <img src="/logo.png" alt="" style={{ width: 26, height: 26, objectFit: "contain" }} />
          <h1 style={{ fontSize: 22 }}>{t("reset.requestTitle")}</h1>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>{t("reset.requestSubtitle")}</p>
        <div style={{ marginBottom: 16 }}>
          <label>{t("login.email")}</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <button className="btn-primary btn-full" disabled={busy}>
          {busy ? t("reset.sending") : t("reset.send")}
        </button>
        <div style={{ marginTop: 14, textAlign: "center" }}>
          <button type="button" onClick={onBack} style={linkBtn}>
            <BackLabel>{t("reset.backToSignIn")}</BackLabel>
          </button>
        </div>
      </form>
    </div>
  );
}
