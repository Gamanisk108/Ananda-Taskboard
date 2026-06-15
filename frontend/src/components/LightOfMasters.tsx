import { useEffect, useState } from "react";

import "./LightOfMasters.css";

// Raw SVG markup (Vite `?raw`) so we can recolor the figures — the source art
// hardcodes fill/stroke #1E3561 (Connect's navy), and an <img> can't be themed.
// We swap that navy for `currentColor` and drive `color` from a Taskboard theme
// variable (navy ink on the warm-ivory shell, cream on the deep-blue dark shell).
// The per-figure stroke-widths and the transparent background are left untouched
// (masters handoff: never normalize stroke weights).
import babaji from "../assets/masters/Babaji_LineArt_2x.svg?raw";
import jesus from "../assets/masters/Jesus_LineArt_2x.svg?raw";
import lahiri from "../assets/masters/Lahiri_LineArt_2x.svg?raw";
import sriYukteswar from "../assets/masters/Sri_Yukteswar_LineArt_2x.svg?raw";
import yogananda from "../assets/masters/Yogananda_LineArt_2x.svg?raw";

/** The five _2x figures, in canonical lineage order. Names are decorative only. */
const FIGURES: { name: string; raw: string }[] = [
  { name: "Babaji", raw: babaji },
  { name: "Lahiri Mahasaya", raw: lahiri },
  { name: "Sri Yukteswar", raw: sriYukteswar },
  { name: "Yogananda", raw: yogananda },
  { name: "Jesus", raw: jesus },
];

/**
 * Replace the hardcoded navy (#1E3561, any case) with `currentColor` so the
 * figure inherits the themed `color`. We also strip the fixed width/height so the
 * SVG scales to its flex cell via the viewBox; transparent bg is already baked in.
 */
function themable(raw: string): string {
  return raw.replace(/#1E3561/gi, "currentColor").replace(/\s(width|height)="[^"]*"/gi, "");
}

const PREPARED = FIGURES.map((f) => ({ ...f, html: themable(f.raw) }));

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export interface LightOfMastersProps {
  /** Height of each figure in px (the row sizes from this). Default 96. */
  size?: number;
  /** Optional extra class on the wrapper. */
  className?: string;
}

/**
 * "Light of the Masters" loader. The five line-art masters stand in a row; a soft
 * light passes from one to another at random — lifting the touched master into
 * presence (full opacity + warm gold glow) while the rest rest faded. Ported from
 * the proven Ananda Connect reference and recolored to Taskboard's Temple-of-Light
 * palette.
 *
 * Light/dark: the figures render in `currentColor`, which a theme-flipping CSS
 * variable sets to nayaswami navy (--primary) on the ivory light shell and cream
 * (--primary-ink) on the deep-blue dark shell. `prefers-reduced-motion` shows the
 * row static (all figures evenly present), with no traveling light.
 */
export function LightOfMasters({ size = 96, className }: LightOfMastersProps) {
  // Evaluated once at mount; the loader is short-lived so we don't subscribe to
  // live media-query changes.
  const [reduced] = useState(prefersReducedMotion);
  const [active, setActive] = useState(0);

  // The light wanders at random — pick a *different* master each beat so it
  // visibly hops rather than ever sitting twice. Held still under reduced-motion.
  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => {
      setActive((cur) => {
        let next = cur;
        while (next === cur) next = Math.floor(Math.random() * PREPARED.length);
        return next;
      });
    }, 1700);
    return () => window.clearInterval(id);
  }, [reduced]);

  return (
    <div
      className={["tb-masters", reduced ? "tb-masters--static" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="tb-masters__row" style={{ ["--tb-master-h" as string]: `${size}px` }}>
        {PREPARED.map((f, i) => (
          <div
            key={f.name}
            className={
              "tb-masters__figure" + (!reduced && i === active ? " tb-masters__figure--active" : "")
            }
            aria-hidden="true"
            // Markup is our own checked-in, color-normalized asset (no user input).
            dangerouslySetInnerHTML={{ __html: f.html }}
          />
        ))}
      </div>
    </div>
  );
}
