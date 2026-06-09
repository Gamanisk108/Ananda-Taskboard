import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../api/client";

interface Preview {
  organization: string;
  email: string;
  role: "admin" | "member";
  account_exists: boolean;
}

/** First human-readable field error from a failed accept, else the fallback. */
function firstError(e: unknown, fallback: string): string {
  const d = e instanceof ApiError ? (e.data as Record<string, string[] | string> | null) : null;
  const v = d && (d.password ?? d.name);
  if (Array.isArray(v)) return v[0];
  if (typeof v === "string") return v;
  return fallback;
}

/** Invitation accept screen (?invite=<id>&token=…). For an existing account it
 *  joins the org then sends them to sign in; for a new email it collects a name +
 *  password, creates the account, and logs straight into the joined org. */
export function AcceptInvite() {
  const { t } = useTranslation();
  const params = new URLSearchParams(window.location.search);
  const id = params.get("invite") || "";
  const token = params.get("token") || "";

  const [preview, setPreview] = useState<Preview | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    api.previewInvite(id, token).then(setPreview).catch(() => setInvalid(true));
  }, [id, token]);

  function goLogin() {
    window.history.replaceState(null, "", window.location.pathname);
    window.location.reload();
  }

  async function accept() {
    setErr("");
    setBusy(true);
    try {
      const body = preview?.account_exists ? { token } : { token, name, password };
      const data = await api.acceptInvite(id, body);
      if (data.access) goLogin();          // new account → tokens set → reload into the app
      else setJoined(true);                // existing account → sign in normally
    } catch (e) {
      setErr(firstError(e, t("accept.error")));
    } finally {
      setBusy(false);
    }
  }

  function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div className="login-wrap">
        <div className="card login-card rise">
          <div className="login-brand">
            <span className="dot" style={{ background: "var(--primary)", width: 12, height: 12 }} />
            <h1 style={{ fontSize: 22 }}>{title}</h1>
          </div>
          {children}
        </div>
      </div>
    );
  }

  if (invalid) {
    return (
      <Card title={t("accept.invalidTitle")}>
        <p className="muted" style={{ marginTop: 0 }}>{t("accept.invalidBody")}</p>
        <button type="button" className="btn-secondary" style={{ width: "100%" }} onClick={goLogin}>
          {t("reset.backToSignIn")}
        </button>
      </Card>
    );
  }
  if (!preview) return <Card title={t("accept.loading")}>{null}</Card>;
  if (joined) {
    return (
      <Card title={t("accept.joinedTitle", { org: preview.organization })}>
        <p className="muted" style={{ marginTop: 0 }}>{t("accept.joinedBody")}</p>
        <button type="button" className="btn-primary btn-full" onClick={goLogin}>
          {t("login.signIn")}
        </button>
      </Card>
    );
  }

  return (
    <Card title={t("accept.title", { org: preview.organization })}>
      <p className="muted" style={{ marginTop: 0 }}>
        {t("accept.subtitle", { email: preview.email, role: t(`platform.role_${preview.role}`) })}
      </p>
      {!preview.account_exists && (
        <>
          <div style={{ marginBottom: 12 }}>
            <label>{t("signup.name")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label>{t("login.password")}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
        </>
      )}
      {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{err}</div>}
      <button type="button" className="btn-primary btn-full" disabled={busy} onClick={accept}>
        {busy ? t("accept.joining") : t("accept.join", { org: preview.organization })}
      </button>
      <div style={{ marginTop: 14, textAlign: "center" }}>
        <button type="button" onClick={goLogin}
          style={{ background: "none", border: "none", padding: 0, color: "var(--primary)", fontSize: 13, cursor: "pointer" }}>
          {t("reset.backToSignIn")}
        </button>
      </div>
    </Card>
  );
}
