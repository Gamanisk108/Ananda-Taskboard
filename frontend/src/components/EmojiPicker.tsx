import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

/** Emoji button + popover backed by emoji-mart in NATIVE mode (the picked value
 *  is a real Unicode character, so it pastes cleanly into WhatsApp/Slack/email).
 *  emoji-mart + its data are dynamically imported only when first opened, so they
 *  stay out of the initial bundle. Theme follows the app's light/dark mode. */
export function EmojiPicker({ value, onPick, title }: { value: string; onPick: (emoji: string) => void; title?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [mod, setMod] = useState<{ Picker: any; data: any } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  async function toggle() {
    if (!mod) {
      const [p, d] = await Promise.all([import("@emoji-mart/react"), import("@emoji-mart/data")]);
      setMod({ Picker: p.default, data: d.default });
    }
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
  }, [open]);

  const dark = (document.documentElement.dataset.theme === "dark");
  const Picker = mod?.Picker;

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-block" }}>
      <button type="button" className="emoji-trigger" onClick={toggle} title={title ?? t("emoji.pick")}
        aria-label={title ?? t("emoji.pick")}>
        {value || "🙂"}
      </button>
      {open && Picker && (
        <div style={{ position: "absolute", zIndex: 60, top: "calc(100% + 6px)", left: 0 }}>
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
      )}
    </div>
  );
}
