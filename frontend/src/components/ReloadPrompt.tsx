import { useRegisterSW } from "virtual:pwa-register/react";
import { useTranslation } from "react-i18next";
import { RefreshCw, X } from "lucide-react";

/** A small toast shown when a newer build has been deployed (the PWA service worker
 *  has a version waiting). The user reloads on their own terms — no stale bundle
 *  lingering, and no surprise reload that could drop unsaved work. With
 *  registerType:'prompt' the new worker waits until updateServiceWorker(true). */
export function ReloadPrompt() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;
  return (
    <div className="pwa-toast" role="status" data-testid="pwa-reload">
      <RefreshCw size={15} aria-hidden style={{ flex: "none", color: "var(--accent)" }} />
      <span className="pwa-toast-msg">{t("pwa.newVersion", "A new version is available.")}</span>
      <button type="button" className="btn-primary" onClick={() => updateServiceWorker(true)}>
        {t("pwa.reload", "Reload")}
      </button>
      <button type="button" className="btn-ghost icon-only" aria-label={t("common.dismiss", "Dismiss")}
        onClick={() => setNeedRefresh(false)}>
        <X size={15} />
      </button>
    </div>
  );
}
