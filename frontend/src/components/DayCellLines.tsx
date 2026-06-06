import type { DayCell } from "../calendar";

// Renders the merged event+holiday lines for one calendar day cell, plus a
// "+N more" overflow label. Shared by the Monthly and Weekly views so both
// stack items and overflow identically. `cls` is the per-line chip class
// ("mev" in month, "ev" in week); holiday lines also get the muted "holiday"
// modifier. Labels arrive pre-formatted (event icons already applied).
export function DayCellLines({ visible, more, cls, moreLabel }: {
  visible: DayCell[];
  more: number;
  cls: string;
  moreLabel: string;
}) {
  return (
    <>
      {visible.map((c, k) => (
        <div key={`c${k}`} className={`${cls}${c.holiday ? " holiday" : ""}`} title={c.label}>{c.label}</div>
      ))}
      {more > 0 && <div className="more">+{more} {moreLabel}</div>}
    </>
  );
}
