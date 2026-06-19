import { LightOfMasters } from "./LightOfMasters";

/** A blocking progress overlay for long operations (import/export/etc.) so the work
 *  never feels frozen. Shows the Light-of-the-Masters loader, a label, and either a
 *  determinate bar with a count (pass done + total) or an indeterminate sweep. */
export function ProgressOverlay({
  done, total, label,
}: {
  done?: number | null;
  total?: number | null;
  label?: string;
}) {
  const determinate = total != null && total > 0 && done != null;
  const pct = determinate ? Math.min(100, Math.round((done! / total!) * 100)) : 0;
  return (
    <div className="progress-overlay" role="status" aria-live="polite" aria-busy="true" data-testid="progress-overlay">
      <div className="progress-overlay__panel">
        <LightOfMasters size={64} />
        {label && <div className="progress-overlay__label">{label}</div>}
        <div className={`progress-overlay__track${determinate ? "" : " progress-overlay__track--indet"}`}>
          <div className="progress-overlay__fill" style={determinate ? { width: `${pct}%` } : undefined} />
        </div>
        {determinate && <div className="progress-overlay__count">{done}/{total}</div>}
      </div>
    </div>
  );
}
