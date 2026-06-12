import { useState } from "react";
import { useTranslation } from "react-i18next";

/** Line-art eye / eye-off icon (24×24, stroke = currentColor) matching the app's
 *  icon system (never emoji). `off` shows the struck-through "hidden" variant. */
function EyeIcon({ off }: { off?: boolean }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {off ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
          <path d="M9.4 5.2A9.6 9.6 0 0 1 12 5c4.6 0 8.4 3.1 9.5 7a11.3 11.3 0 0 1-2.16 3.55" />
          <path d="M6.1 6.12A11.3 11.3 0 0 0 2.5 12c1.1 3.9 4.9 7 9.5 7a9.7 9.7 0 0 0 3.7-.72" />
        </>
      ) : (
        <>
          <path d="M2.5 12C3.7 8.1 7.4 5 12 5s8.3 3.1 9.5 7c-1.2 3.9-4.9 7-9.5 7s-8.3-3.1-9.5-7Z" />
          <circle cx={12} cy={12} r={3} />
        </>
      )}
    </svg>
  );
}

/** A password field with a show/hide eye toggle. Drop-in for the auth forms —
 *  forwards every native input prop; the visibility toggle is local UI state and
 *  the field re-hides on each mount (never persisted). */
export function PasswordInput({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  return (
    <div className="pw-field">
      <input {...props} type={show ? "text" : "password"} />
      <button
        type="button"
        className="pw-toggle"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? t("login.hidePassword") : t("login.showPassword")}
        aria-pressed={show}
        title={show ? t("login.hidePassword") : t("login.showPassword")}
      >
        <EyeIcon off={show} />
      </button>
    </div>
  );
}
