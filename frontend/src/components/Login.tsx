import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../state/auth";

export function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await login(email, password);
    } catch {
      setErr(t("login.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card rise" onSubmit={submit}>
        <div className="login-brand">
          <span className="dot" style={{ background: "var(--primary)", width: 12, height: 12 }} />
          <h1 style={{ fontSize: 22 }}>Ananda Taskboard</h1>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>{t("login.subtitle")}</p>
        <div style={{ marginBottom: 12 }}>
          <label>{t("login.email")}</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label>{t("login.password")}</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{err}</div>}
        <button className="btn-primary" style={{ width: "100%" }} disabled={busy}>
          {busy ? t("login.signingIn") : t("login.signIn")}
        </button>
      </form>
    </div>
  );
}
