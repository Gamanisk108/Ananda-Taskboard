import type { ReactNode } from "react";
import { statusColor, statusLabel } from "../statuses";
import { PRIORITY_META } from "../types";

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

export function StatusPill({ status }: { status: string }) {
  const c = statusColor(status);
  return (
    <span className="pill" style={{ background: `${c}1a`, color: c }}>
      <span className="dot" style={{ background: c }} />
      {statusLabel(status)}
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
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="card modal rise"
        style={{ maxWidth: wide ? 720 : 520 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 style={{ fontSize: 18 }}>{title}</h2>
          <button className="btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/** Colored status dots with counts, summarizing a task's subtasks. */
export function SubtaskDots({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).filter(([, n]) => n > 0);
  if (entries.length === 0) return null;
  return (
    <span style={{ display: "inline-flex", gap: 7, alignItems: "center" }} title="Subtasks by status">
      {entries.map(([key, n]) => (
        <span key={key} title={`${statusLabel(key)}: ${n}`}
          style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--text-muted)" }}>
          <span className="dot" style={{ background: statusColor(key) }} />{n}
        </span>
      ))}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return <div className="muted" style={{ padding: 24 }}>{label ?? "Loading…"}</div>;
}
