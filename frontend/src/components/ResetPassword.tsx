import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../api/client";
import { ForgotPassword } from "./ForgotPassword";
import { PasswordInput } from "./PasswordInput";

/** A centered card matching the login aesthetic, used for every reset state. */
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="login-wrap">
      <div className="card login-card rise">
        <div className="login-brand">
          <img src="/logo.png" alt="" style={{ width: 26, height: 26, objectFit: "contain" }} />
          <h1 style={{ fontSize: 22 }}>{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Translate a failed confirm into either the "expired link" state or an inline
 *  message, keeping the submit handler free of branching. */
function confirmError(e: unknown): { expired: boolean; message?: string } {
  const data = e instanceof ApiError ? (e.data as { password?: string[]; detail?: string } | null) : null;
  if (data?.detail === "invalid") return { expired: true };
  if (data?.password?.length) return { expired: false, message: data.password[0] };
  return { expired: false, message: "reset.genericError" };
}

/** Step 2 of self-service reset: set a new password. Reached via the email link
 *  (?reset&uid=…&token=…) while logged out. */
export function ResetPassword() {
  const { t } = useTranslation();
  const params = new URLSearchParams(window.location.search);
  const uid = params.get("uid") || "";
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [expired, setExpired] = useState(false);
  const [requestAgain, setRequestAgain] = useState(false);

  /** Drop the ?reset params and return to a clean login screen. */
  function goLogin() {
    window.history.replaceState(null, "", window.location.pathname);
    window.location.reload();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (password.length < 8) return setErr(t("reset.tooShort"));
    if (password !== confirm) return setErr(t("reset.mismatch"));
    setBusy(true);
    try {
      await api.confirmPasswordReset(uid, token, password);
      setDone(true);
    } catch (e) {
      const { expired, message } = confirmError(e);
      if (expired) setExpired(true);
      // A bare message is a server validation string; a "reset.*" key is translated.
      else setErr(message?.startsWith("reset.") ? t(message) : message || t("reset.genericError"));
    } finally {
      setBusy(false);
    }
  }

  if (requestAgain) return <ForgotPassword onBack={goLogin} />;

  if (done) {
    return (
      <Card title={t("reset.successTitle")}>
        <p className="muted" style={{ marginTop: 0 }}>{t("reset.successBody")}</p>
        <button type="button" className="btn-primary btn-full" onClick={goLogin}>
          {t("login.signIn")}
        </button>
      </Card>
    );
  }

  if (expired) {
    return (
      <Card title={t("reset.expiredTitle")}>
        <p className="muted" style={{ marginTop: 0 }}>{t("reset.expiredBody")}</p>
        <button type="button" className="btn-primary btn-full" onClick={() => setRequestAgain(true)}>
          {t("reset.requestNew")}
        </button>
      </Card>
    );
  }

  return (
    <Card title={t("reset.newTitle")}>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 12 }}>
          <label>{t("reset.newPassword")}</label>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>{t("reset.confirmPassword")}</label>
          <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 0, marginBottom: 14 }}>{t("reset.tooShort")}</p>
        {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{err}</div>}
        <button className="btn-primary btn-full" disabled={busy}>
          {busy ? t("reset.updating") : t("reset.update")}
        </button>
      </form>
    </Card>
  );
}
