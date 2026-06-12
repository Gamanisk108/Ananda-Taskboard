import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useFloating, autoUpdate, offset, flip, shift,
  useClick, useDismiss, useRole, useInteractions, FloatingPortal,
} from "@floating-ui/react";

/** Emoji button + popover backed by emoji-mart in NATIVE mode (the picked value
 *  is a real Unicode character, so it pastes cleanly into WhatsApp/Slack/email).
 *  emoji-mart + its data are dynamically imported only when first opened, so they
 *  stay out of the initial bundle. Theme follows the app's light/dark mode.
 *  The popover is portaled to <body> via Floating UI (with flip/shift) so it is
 *  never clipped by a scrolling modal and opens upward when there's no room below. */
export function EmojiPicker({ value, onPick, title }: { value: string; onPick: (emoji: string) => void; title?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [mod, setMod] = useState<{ Picker: any; data: any } | null>(null);

  const { refs, floatingStyles, context } = useFloating({
    open, onOpenChange: setOpen, placement: "bottom-start",
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context), useDismiss(context), useRole(context, { role: "dialog" }),
  ]);

  async function toggle() {
    if (!mod) {
      const [p, d] = await Promise.all([import("@emoji-mart/react"), import("@emoji-mart/data")]);
      setMod({ Picker: p.default, data: d.default });
    }
  }

  const dark = (document.documentElement.dataset.theme === "dark");
  const Picker = mod?.Picker;

  return (
    <>
      <button type="button" ref={refs.setReference} {...getReferenceProps({ onClick: toggle })}
        className="emoji-trigger" title={title ?? t("emoji.pick")} aria-label={title ?? t("emoji.pick")}>
        {value || "🙂"}
      </button>
      {open && Picker && (
        <FloatingPortal>
          {/* eslint-disable-next-line react-hooks/refs -- Floating UI callback-ref setter, not a React .current ref */}
          <div ref={refs.setFloating} {...getFloatingProps()} style={{ ...floatingStyles, zIndex: 200 }}>
            <Picker
              data={mod!.data}
              theme={dark ? "dark" : "light"}
              set="native"
              previewPosition="none"
              skinTonePosition="search"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onEmojiSelect={(e: any) => { onPick(e.native); setOpen(false); }}
            />
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
