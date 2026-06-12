import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../api/client";
import { PasswordInput } from "./PasswordInput";
import { BackLabel } from "./common";

const linkBtn: React.CSSProperties = {
  background: "none", border: "none", padding: 0,
  color: "var(--primary)", fontSize: 13, cursor: "pointer",
};

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div style={{ marginBottom: 12, flex: 1 }}>
      <label>{label}</label>
      <input {...props} />
    </div>
  );
}

/** Pull the first human-readable field error out of a failed signup response. */
function firstFieldError(e: unknown, fallback: string): string {
  const data = e instanceof ApiError ? (e.data as Record<string, string[] | string> | null) : null;
  const v = data && (data.email ?? data.password ?? data.organization);
  if (Array.isArray(v)) return v[0];
  if (typeof v === "string") return v;
  return fallback;
}

/** Self-serve signup: create your own account + organization. Both stay inactive
 *  until the emailed verification link is clicked. */
export function Signup({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const [f, setF] = useState({ organization: "", name: "", email: "", password: "", city: "", state: "", country: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  function set(k: keyof typeof f) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api.signup(f);
      setDone(true);
    } catch (e) {
      setErr(firstFieldError(e, t("signup.error")));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="login-wrap">
        <div className="card login-card rise">
          <div className="login-brand">
            <img src="/logo.png" alt="" style={{ width: 26, height: 26, objectFit: "contain" }} />
            <h1 style={{ fontSize: 22 }}>{t("signup.checkTitle")}</h1>
          </div>
          <p className="muted" style={{ marginTop: 0 }}>{t("signup.checkBody", { email: f.email })}</p>
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
          <h1 style={{ fontSize: 22 }}>{t("signup.title")}</h1>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>{t("signup.subtitle")}</p>
        <Field label={t("signup.organization")} value={f.organization} onChange={set("organization")} autoFocus required />
        <div style={{ display: "flex", gap: 8 }}>
          <Field label={t("signup.city")} value={f.city} onChange={set("city")} />
          <Field label={t("signup.state")} value={f.state} onChange={set("state")} />
        </div>
        <Field label={t("signup.country")} value={f.country} onChange={set("country")} />
        <Field label={t("signup.name")} value={f.name} onChange={set("name")} required />
        <Field label={t("login.email")} type="email" value={f.email} onChange={set("email")} required
               autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        <div style={{ marginBottom: 12 }}>
          <label>{t("login.password")}</label>
          <PasswordInput value={f.password} onChange={set("password")} required />
        </div>
        {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{err}</div>}
        <button className="btn-primary btn-full" disabled={busy}>
          {busy ? t("signup.creating") : t("signup.create")}
        </button>
        <div style={{ marginTop: 14, textAlign: "center" }}>
          <button type="button" onClick={onBack} style={linkBtn}><BackLabel>{t("reset.backToSignIn")}</BackLabel></button>
        </div>
      </form>
    </div>
  );
}
