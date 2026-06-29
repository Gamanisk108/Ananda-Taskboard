// Share button + popover. Mints a tokenized /s/<token> link that unfurls into a
// rich preview card on Slack / WhatsApp / iMessage / etc. (a raw in-app URL is
// behind auth, so it would unfurl to nothing). Copy, native share sheet, a
// description on/off toggle, and revoke — all on the existing floating-ui +
// brand-token patterns. Light + dark inherit from index.css.

import { useRef, useState } from "react";
import {
  useFloating, autoUpdate, offset, flip, shift,
  useClick, useDismiss, useRole, useInteractions, FloatingPortal, FloatingFocusManager,
} from "@floating-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Share2, Copy, Check, Trash2, RefreshCw } from "lucide-react";
import {
  createShareLink, setShareDescription, revokeShareLink, copyText, shareUrl,
  type ShareLink, type ShareType,
} from "../share";

const KIND_KEY: Record<ShareType, string> = {
  project: "share.kind.project",
  subproject: "share.kind.subproject",
  task: "share.kind.task",
  subtask: "share.kind.subtask",
};

export function ShareButton({
  type, id, variant = "secondary", className = "",
}: {
  type: ShareType;
  id: number;
  variant?: "secondary" | "icon";
  className?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open, onOpenChange: setOpen, placement: "bottom-end",
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context), useDismiss(context), useRole(context, { role: "dialog" }),
  ]);

  const trigger =
    variant === "icon"
      ? { cls: className || "btn-ghost icon-only", size: 16, label: false }
      : { cls: `btn-secondary ${className}`.trim(), size: 14, label: true };

  return (
    <>
      <button
        type="button" ref={refs.setReference}
        {...getReferenceProps({ onClick: (e) => e.stopPropagation() })}
        aria-expanded={open} className={trigger.cls} title={t("task.share", "Share")}
        style={variant === "secondary" ? { flex: "none" } : undefined}
      >
        <Share2 size={trigger.size} />
        {trigger.label && <span className="lbl">{t("task.share", "Share")}</span>}
      </button>
      {open && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false}>
            {/* eslint-disable-next-line react-hooks/refs -- Floating UI callback-ref setter, not a React .current ref */}
            <div ref={refs.setFloating} {...getFloatingProps()} className="sharepop"
              style={{ ...floatingStyles, zIndex: 300 }} onClick={(e) => e.stopPropagation()}>
              <SharePanel type={type} id={id} onClose={() => setOpen(false)} />
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}

function SharePanel({ type, id, onClose }: { type: ShareType; id: number; onClose: () => void }) {
  const { t } = useTranslation();
  const kind = t(KIND_KEY[type]);
  const qc = useQueryClient();
  const key = ["share", type, id] as const;
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Minting is idempotent (get-or-create on the server), so it's modelled as a
  // read: one durable link per item, cached under ["share", type, id].
  const { data: link, isError, isFetching, refetch } = useQuery<ShareLink>({
    queryKey: key, queryFn: () => createShareLink(type, id), staleTime: Infinity, retry: false,
  });

  const descMut = useMutation({
    mutationFn: (include: boolean) => setShareDescription(link!.token, include),
    onSuccess: (updated) => qc.setQueryData(key, updated),
  });
  const revokeMut = useMutation({
    mutationFn: () => revokeShareLink(link!.token),
    onSuccess: () => { qc.removeQueries({ queryKey: key }); onClose(); },
  });
  const busy = descMut.isPending || revokeMut.isPending;

  async function copy() {
    if (!link) return;
    const ok = await copyText(link.url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } else {
      inputRef.current?.select();
    }
  }

  return (
    <div role="document" aria-label={t("share.title", "Share {{kind}}", { kind })}>
      <div className="sharepop-head">
        <strong>{t("share.title", "Share {{kind}}", { kind })}</strong>
      </div>

      {isError ? (
        <div className="sharepop-state">
          <p className="sharepop-err">{t("share.error", "Couldn't create a share link.")}</p>
          <button type="button" className="btn-secondary" onClick={() => refetch()}>
            <RefreshCw size={14} /> <span className="lbl">{t("share.retry", "Try again")}</span>
          </button>
        </div>
      ) : !link || isFetching ? (
        <div className="sharepop-state">
          <span className="sharepop-spin" aria-hidden />
          <span>{t("share.loading", "Creating link…")}</span>
        </div>
      ) : (
        <>
          <div className="sharepop-linkrow">
            <input
              ref={inputRef} className="sharepop-link mono" readOnly value={link.url}
              aria-label={t("share.linkLabel", "Share link")}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button" className="btn-primary sharepop-copy" onClick={copy}
              aria-label={copied ? t("share.copied", "Copied") : t("share.copy", "Copy link")}
              title={copied ? t("share.copied", "Copied") : t("share.copy", "Copy link")}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>

          <button
            type="button" className="btn-secondary sharepop-native"
            onClick={() => shareUrl(link.url, kind)}
          >
            <Share2 size={14} /> <span className="lbl">{t("share.shareVia", "Share via…")}</span>
          </button>

          <label className="sharepop-switch">
            <input
              type="checkbox" role="switch" checked={link.include_description} disabled={busy}
              onChange={(e) => descMut.mutate(e.target.checked)}
            />
            <span>{t("share.includeDescription", "Include description")}</span>
          </label>

          <p className="sharepop-hint">
            {t(
              "share.hint",
              "Anyone with the link sees a preview card. They'll need to sign in to open the full {{kind}}.",
              { kind },
            )}
          </p>

          <div className="sharepop-foot">
            {confirmRevoke ? (
              <>
                <button type="button" className="btn-danger" disabled={busy} onClick={() => revokeMut.mutate()}>
                  <Trash2 size={14} /> <span className="lbl">{t("share.revokeConfirm", "Revoke link")}</span>
                </button>
                <button type="button" className="btn-ghost" onClick={() => setConfirmRevoke(false)}>
                  {t("common.cancel", "Cancel")}
                </button>
              </>
            ) : (
              <button
                type="button" className="btn-ghost sharepop-revoke" onClick={() => setConfirmRevoke(true)}
              >
                <Trash2 size={14} /> <span className="lbl">{t("share.revoke", "Revoke")}</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
