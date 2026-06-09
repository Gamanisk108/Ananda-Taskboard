import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";

/** Handles the signup verification deep-link (?verify&uid=…&token=…): confirms
 *  the account/org, then sends the user to sign in. */
export function VerifyEmail() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<"working" | "ok" | "bad">("working");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    api
      .verifyEmail(p.get("uid") || "", p.get("token") || "")
      .then(() => setStatus("ok"))
      .catch(() => setStatus("bad"));
  }, []);

  function goLogin() {
    window.history.replaceState(null, "", window.location.pathname);
    window.location.reload();
  }

  const title =
    status === "working" ? t("verify.working") : status === "ok" ? t("verify.okTitle") : t("verify.badTitle");

  return (
    <div className="login-wrap">
      <div className="card login-card rise">
        <div className="login-brand">
          <img src="/logo.png" alt="" style={{ width: 26, height: 26, objectFit: "contain" }} />
          <h1 style={{ fontSize: 22 }}>{title}</h1>
        </div>
        {status === "ok" && (
          <>
            <p className="muted" style={{ marginTop: 0 }}>{t("verify.okBody")}</p>
            <button type="button" className="btn-primary btn-full" onClick={goLogin}>
              {t("login.signIn")}
            </button>
          </>
        )}
        {status === "bad" && (
          <>
            <p className="muted" style={{ marginTop: 0 }}>{t("verify.badBody")}</p>
            <button type="button" className="btn-secondary" style={{ width: "100%" }} onClick={goLogin}>
              {t("reset.backToSignIn")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
