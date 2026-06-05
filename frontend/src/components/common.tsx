import type { CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { isComplete, statusColor, statusLabel } from "../statuses";
import { avatarColor, userInitials, userName } from "../users";
import { PRIORITY_META, type UserLite } from "../types";

export function ColorDot({ color }: { color: string }) {
  return <span className="dot" style={{ background: color }} />;
}

/** Chevron-based priority badge (own SVG paths — not Jira's icons). Double
 *  chevron = extreme (Highest/Lowest), single = High/Low, equals = Medium. */
export function PriorityIcon({ level, size = 14, color }: { level: number; size?: number; color?: string }) {
  const m = PRIORITY_META[level] ?? PRIORITY_META[3];
  const stroke = color ?? m.color;
  const lines =
    m.dir === "up" ? (m.double ? ["2,11 7,6 12,11", "2,7 7,2 12,7"] : ["2,9 7,4 12,9"])
    : m.dir === "down" ? (m.double ? ["2,3 7,8 12,3", "2,7 7,12 12,7"] : ["2,5 7,10 12,5"])
    : ["3,5 11,5", "3,9 11,9"]; // medium = equals
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" role="img" aria-label={`Priority: ${m.label}`}
      style={{ flex: "none", display: "block" }}>
      <title>{`Priority: ${m.label}`}</title>
      {lines.map((points, i) => (
        <polyline key={i} points={points} stroke={stroke} strokeWidth={2} fill="none"
          strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

export function StatusPill({ status, editable }: { status: string; editable?: boolean }) {
  const c = statusColor(status);
  return (
    <span className={`pill status-pill${editable ? "" : " static"}`}
      style={{ "--sc": c } as CSSProperties}>
      <span className="dot" style={{ background: c }} />
      {statusLabel(status)}
      {editable && <span className="caret">▾</span>}
    </span>
  );
}

/** Overlapping colored circles of assignee initials (design avatar stack),
 *  each with a full-name tooltip. Shows up to `max`, then a +N chip. */
export function AvatarStack({ ids, users, max = 3 }: { ids: number[]; users: UserLite[]; max?: number }) {
  if (ids.length === 0) return <span className="muted">—</span>;
  const shown = ids.slice(0, max);
  const extra = ids.length - shown.length;
  return (
    <span className="avstack">
      {shown.map((id) => (
        <span key={id} className="av" title={userName(users, id)} style={{ background: avatarColor(id) }}>
          {userInitials(users, id)}
        </span>
      ))}
      {extra > 0 && <span className="av" title={ids.slice(max).map((id) => userName(users, id)).join(", ")} style={{ background: "var(--faint)" }}>+{extra}</span>}
    </span>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="card modal sheet rise"
        style={{ maxWidth: wide ? 760 : 520 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 style={{ fontSize: 18 }}>{title}</h2>
          <button className="btn-ghost" onClick={onClose} aria-label={t("common.close")}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/** Colored status dots with counts, summarizing a task's subtasks. */
export function SubtaskDots({ counts }: { counts: Record<string, number> }) {
  const { t } = useTranslation();
  const entries = Object.entries(counts).filter(([, n]) => n > 0);
  if (entries.length === 0) return null;
  return (
    <span style={{ display: "inline-flex", gap: 7, alignItems: "center" }} title={t("common.subtasksByStatus")}>
      {entries.map(([key, n]) => (
        <span key={key} title={`${statusLabel(key)}: ${n}`}
          style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--text-muted)" }}>
          <span className="dot" style={{ background: statusColor(key) }} />{n}
        </span>
      ))}
    </span>
  );
}

/** Proportional subtask-progress bar (design's segbar): one colored segment per
 *  status, sized by share, with an "done/total" tally. */
export function SubtaskBar({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).filter(([, n]) => n > 0);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  if (total === 0) return null;
  const done = entries.filter(([k]) => isComplete(k)).reduce((s, [, n]) => s + n, 0);
  return (
    <div className="segbar" title={`${done} / ${total}`}>
      <div className="segbar-track">
        {entries.map(([k, n]) => (
          <span key={k} style={{ width: `${(n / total) * 100}%`, background: statusColor(k) }} />
        ))}
      </div>
      <span className="segbar-n mono">{done}/{total}</span>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  const { t } = useTranslation();
  return <div className="muted" style={{ padding: 24 }}>{label ?? t("common.loading")}</div>;
}
