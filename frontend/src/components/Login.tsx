import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../state/auth";
import { ForgotPassword } from "./ForgotPassword";
import { Signup } from "./Signup";
import { PasswordInput } from "./PasswordInput";

export function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  // ?signup deep link: the Spread-the-word referral lands straight on the
  // create-account form instead of the sign-in screen.
  const [signup, setSignup] = useState(() => new URLSearchParams(window.location.search).has("signup"));

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

  if (forgot) return <ForgotPassword onBack={() => setForgot(false)} />;
  if (signup) return <Signup onBack={() => setSignup(false)} />;

  return (
    <div className="login-wrap">
      <form className="card login-card rise" onSubmit={submit}>
        {/* Brand wordmark = Fraunces + italic gold tagline (same as the app top
            bar; Fraunces is reserved for exactly this wordmark + tagline). */}
        <div className="login-brand brand">
          <img src="/logo.png" alt="" style={{ width: 34, height: 34, objectFit: "contain" }} />
          <div className="brand-txt">
            <h1 className="name" style={{ fontSize: 22, margin: 0 }}>Ananda <b>Taskboard</b></h1>
            <div className="tagline">Love &amp; Blessings from Ananda Los Angeles</div>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>{t("login.subtitle")}</p>
        <div style={{ marginBottom: 12 }}>
          <label>{t("login.email")}</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label>{t("login.password")}</label>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{err}</div>}
        <button className="btn-primary btn-full" disabled={busy}>
          {busy ? t("login.signingIn") : t("login.signIn")}
        </button>
        <div style={{ marginTop: 14, textAlign: "center" }}>
          <button
            type="button"
            onClick={() => setForgot(true)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              color: "var(--primary)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {t("login.forgot")}
          </button>
        </div>
        <div style={{ marginTop: 8, textAlign: "center", fontSize: 13 }}>
          <span className="muted">{t("signup.prompt")} </span>
          <button
            type="button"
            onClick={() => setSignup(true)}
            style={{ background: "none", border: "none", padding: 0, color: "var(--primary)", fontSize: 13, cursor: "pointer" }}
          >
            {t("signup.cta")}
          </button>
        </div>
        {/* Hosted legal pages (also linked from store listings). */}
        <div className="legal-links">
          <a href="/privacy">{t("legal.privacy", "Privacy Policy")}</a>
          <span aria-hidden>·</span>
          <a href="/terms">{t("legal.terms", "Terms of Service")}</a>
        </div>
      </form>
    </div>
  );
}
