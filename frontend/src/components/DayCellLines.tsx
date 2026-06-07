import type { DayCell } from "../calendar";
import { CalAnnounceIcon, CalHolidayIcon } from "./common";

// Renders the merged event+holiday lines for one calendar day cell, plus a
// "+N more" overflow label. Shared by the Monthly and Weekly views so both
// stack items and overflow identically. `cls` is the per-line chip class
// ("mev" in month, "ev" in week); holiday lines also get the muted "holiday"
// modifier. Each line leads with a line-art marker — a megaphone for
// announcements (user events), a star for holidays (design spec, no emoji).
export function DayCellLines({ visible, more, cls, moreLabel }: {
  visible: DayCell[];
  more: number;
  cls: string;
  moreLabel: string;
}) {
  return (
    <>
      {visible.map((c, k) => (
        <div key={`c${k}`} className={`${cls}${c.holiday ? " holiday" : ""}`} title={c.label}>
          {c.holiday ? <CalHolidayIcon /> : <CalAnnounceIcon />}
          <span className="cal-line-txt">{c.label}</span>
        </div>
      ))}
      {more > 0 && <div className="more">+{more} {moreLabel}</div>}
    </>
  );
}
