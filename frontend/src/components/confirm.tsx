import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { TriangleAlert } from "lucide-react";
import { Modal } from "./common";

/**
 * App-wide styled confirmation dialog (replaces native window.confirm).
 *
 * Hard UI rule: destructive actions get a styled confirm popup that explains
 * what will happen — never a browser confirm(). Usage:
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ body: t("trash.confirmPurge"), danger: true }))) return;
 *
 * Uses t(key, fallback) for its own labels so it adds NO new locale keys
 * (preserving the 13-locale i18n parity test). `body` is already-translated text.
 */
export interface ConfirmOptions {
  body: ReactNode;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <Modal
          title={opts.title ?? t("confirm.title", "Please confirm")}
          icon={<TriangleAlert />}
          onClose={() => settle(false)}
        >
          <div style={{ lineHeight: 1.5 }}>
            <p style={{ marginTop: 0 }}>{opts.body}</p>
            <div className="modal-foot" style={{ marginTop: 16 }}>
              <button type="button" className="btn-secondary" onClick={() => settle(false)}>
                {opts.cancelLabel ?? t("common.cancel")}
              </button>
              <button
                type="button"
                className={opts.danger === false ? "btn-primary" : "btn-danger"}
                data-testid="confirm-ok"
                autoFocus
                onClick={() => settle(true)}
              >
                {opts.confirmLabel ?? t("common.confirm", "Confirm")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with ConfirmProvider (shares ConfirmContext); splitting is a pure-organization change out of scope here, no runtime effect.
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>");
  return ctx;
}
