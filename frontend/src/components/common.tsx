import type { ReactNode } from "react";
import { statusColor, statusLabel } from "../statuses";

export function ColorDot({ color }: { color: string }) {
  return <span className="dot" style={{ background: color }} />;
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

export function Spinner({ label }: { label?: string }) {
  return <div className="muted" style={{ padding: 24 }}>{label ?? "Loading…"}</div>;
}
