import { useEffect, useState, type FC, type SVGProps } from "react";

import "./LightOfMasters.css";

// SVG → React component (vite-plugin-svgr `?react`). The assets are pre-set to
// `currentColor`, so the figure inherits the themed `color` (navy on the ivory
// light shell, cream on the deep-blue dark shell) — no <img> (can't theme) and
// no runtime string-replace. svgo is OFF in vite.config so per-figure
// stroke-widths + transparent bg are byte-preserved (handoff: never normalize).
import Babaji from "../assets/masters/Babaji_LineArt_2x.svg?react";
import Jesus from "../assets/masters/Jesus_LineArt_2x.svg?react";
import Lahiri from "../assets/masters/Lahiri_LineArt_2x.svg?react";
import SriYukteswar from "../assets/masters/Sri_Yukteswar_LineArt_2x.svg?react";
import Yogananda from "../assets/masters/Yogananda_LineArt_2x.svg?react";

/** The five _2x figures, in lineage order (Gordon 2026-06-19): Lahiri · Babaji ·
 *  Jesus · Sri Yukteswar · Yogananda. Names are decorative only. */
const FIGURES: { name: string; Svg: FC<SVGProps<SVGSVGElement>> }[] = [
  { name: "Lahiri Mahasaya", Svg: Lahiri },
  { name: "Babaji", Svg: Babaji },
  { name: "Jesus", Svg: Jesus },
  { name: "Sri Yukteswar", Svg: SriYukteswar },
  { name: "Yogananda", Svg: Yogananda },
];

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
  // Start on a RANDOM master, not always the leftmost — so the light doesn't appear
  // to begin at figure 0 every load (Gordon 2026-06-19, universal across our apps).
  const [active, setActive] = useState(() => Math.floor(Math.random() * FIGURES.length));

  // The light wanders at random — pick a *different* master each beat so it
  // visibly hops rather than ever sitting twice. Held still under reduced-motion.
  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => {
      setActive((cur) => {
        let next = cur;
        while (next === cur) next = Math.floor(Math.random() * FIGURES.length);
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
        {FIGURES.map((f, i) => (
          <div
            key={f.name}
            className={
              "tb-masters__figure" + (!reduced && i === active ? " tb-masters__figure--active" : "")
            }
            aria-hidden="true"
          >
            <f.Svg />
          </div>
        ))}
      </div>
    </div>
  );
}
