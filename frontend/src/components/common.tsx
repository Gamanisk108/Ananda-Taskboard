import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { X, Link2, Plus, Check } from "lucide-react";
import { isComplete, statusColor, statusLabel } from "../statuses";
import { avatarColor, userInitials, userName } from "../users";
import { PRIORITY_META, type UserLite } from "../types";

export function ColorDot({ color }: { color: string }) {
  return <span className="dot" style={{ background: color }} />;
}

export interface MultiSelectOption {
  value: string;        // stable key (e.g. a stringified id or status key)
  label: string;
  color?: string;       // optional leading dot
  section?: string;     // optional group header (e.g. "People" / "Groups")
}

/** A checkbox-dropdown filter. Closed button shows the first pick + "+N"; the open
 *  popover is a checkbox list (optionally grouped by `section`). Multi-select with
 *  OR semantics is up to the caller. Closes on outside-click / Escape. */
export function MultiSelect({
  options, selected, onChange, placeholder, testId, width,
}: {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  testId?: string;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const selectedSet = new Set(selected);
  const chosen = options.filter((o) => selectedSet.has(o.value));
  const label = chosen.length === 0 ? placeholder
    : chosen.length === 1 ? chosen[0].label
    : `${chosen[0].label} +${chosen.length - 1}`;

  function toggle(v: string) {
    onChange(selectedSet.has(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  }

  // Preserve option order while inserting a header whenever the section changes.
  let lastSection: string | undefined;

  return (
    <div className={`ms${chosen.length ? " on" : ""}`} ref={ref} data-testid={testId} style={width ? { width } : undefined}>
      <button type="button" className="ms-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} title={label}>
        <span className="ms-label">{label}</span>
        <span className="ms-caret" aria-hidden>▾</span>
      </button>
      {open && (
        <div className="ms-pop" role="listbox">
          {options.length === 0 && <div className="ms-empty">—</div>}
          {options.map((o) => {
            const header = o.section && o.section !== lastSection ? o.section : null;
            lastSection = o.section;
            return (
              <div key={o.value}>
                {header && <div className="ms-section">{header}</div>}
                <label className="ms-opt">
                  <input type="checkbox" checked={selectedSet.has(o.value)} onChange={() => toggle(o.value)} />
                  {o.color && <span className="dot" style={{ background: o.color }} />}
                  <span className="ms-opt-label">{o.label}</span>
                </label>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export interface SingleSelectOption { value: string; label: string; color?: string; section?: string }

/** Custom single-select dropdown: a bordered trigger + popover with a check on
 *  the selected option (design D2 — no native <select>). Mirrors MultiSelect's
 *  look/behaviour (click-outside, Escape) and reuses its `.ms*` CSS. */
export function SingleSelect({
  options, value, onChange, placeholder, testId, width, disabled,
}: {
  options: SingleSelectOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  testId?: string;
  width?: number | string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const chosen = options.find((o) => o.value === value);
  let lastSection: string | undefined;
  // A falsy value (e.g. a filter's "Any" default) still shows its label but is
  // not styled active — mirrors MultiSelect's unfiltered look in the filter bar.
  return (
    <div className={`ms ss${chosen && value ? " on" : ""}${width === "100%" ? " ss-block" : ""}`} ref={ref} data-testid={testId}
      style={typeof width === "number" ? { width } : undefined}>
      <button type="button" className="ms-btn" disabled={disabled} onClick={() => setOpen((o) => !o)} aria-expanded={open} title={chosen?.label ?? placeholder}
        style={typeof width === "number" ? { width: "100%", minWidth: 0, maxWidth: "none" } : undefined}>
        {chosen?.color && <span className="dot" style={{ background: chosen.color }} />}
        <span className="ms-label">{chosen ? chosen.label : (placeholder ?? "—")}</span>
        <span className="ms-caret" aria-hidden>▾</span>
      </button>
      {open && (
        <div className="ms-pop" role="listbox">
          {options.length === 0 && <div className="ms-empty">—</div>}
          {options.map((o) => {
            const header = o.section && o.section !== lastSection ? o.section : null;
            lastSection = o.section;
            return (
              <div key={o.value}>
                {header && <div className="ms-section">{header}</div>}
                <button type="button" className="ms-opt ss-opt" role="option" aria-selected={o.value === value}
                  onClick={() => { onChange(o.value); setOpen(false); }}>
                  {o.color && <span className="dot" style={{ background: o.color }} />}
                  <span className="ms-opt-label">{o.label}</span>
                  {o.value === value && <Check size={14} style={{ marginLeft: "auto", flex: "none" }} />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
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

/** Deadline flag badge, identical on every page (design WARN_W / CLK_W):
 *  overdue = red circle + white exclamation; soon = yellow circle + clock. */
export function DueFlag({ kind, size = 14, title }: { kind: "overdue" | "soon"; size?: number; title?: string }) {
  const style: CSSProperties = { flex: "none", filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,.4))", verticalAlign: "-2px", cursor: title ? "help" : undefined };
  if (kind === "overdue") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={style} role="img" aria-label={title}>
        {title && <title>{title}</title>}
        <circle cx="12" cy="12" r="10" fill="var(--flag-od)" />
        <path d="M12 6.3v7.3" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="12" cy="17.7" r="1.5" fill="#fff" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} role="img" aria-label={title}>
      {title && <title>{title}</title>}
      <circle cx="12" cy="12" r="10" fill="var(--bar-soon)" />
      <circle cx="12" cy="12.3" r="5.1" fill="none" stroke="#3a2a00" strokeWidth="1.7" />
      <path d="M12 9.4v3l1.9 1.2" fill="none" stroke="#3a2a00" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Calendar announcement (user event) marker — line-art megaphone (design spec).
 *  Holidays use CalHolidayIcon. Both inherit `currentColor` so the parent
 *  .mev / .ev color rule tints them. */
export function CalAnnounceIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
      style={{ flex: "none" }} aria-hidden="true">
      <path d="M3 11v2a2 2 0 0 0 2 2h2l8 5V4L7 9H5a2 2 0 0 0-2 2z" />
      <path d="M16.8 8.6a4 4 0 0 1 0 6.8" />
    </svg>
  );
}

/** Calendar holiday marker — line-art star (design spec). */
export function CalHolidayIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
      style={{ flex: "none" }} aria-hidden="true">
      <path d="M12 3 14.6 8.6 20.7 9.4 16.2 13.6 17.4 19.7 12 16.7 6.6 19.7 7.8 13.6 3.3 9.4 9.4 8.6 Z" />
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

/** A status pill that IS a dropdown: the colored pill is the trigger and opens a
 *  popover of the five statuses (check on the current one) for inline change —
 *  used in subtask rows (design D11). Stops click propagation so the row's own
 *  click (open detail) doesn't also fire. */
export function StatusPillSelect({
  value, statuses, onChange, testId,
}: {
  value: string;
  statuses: { key: string; label: string; color: string }[];
  onChange: (key: string) => void;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const c = statusColor(value);
  return (
    <span className="ms ss" ref={ref} data-testid={testId} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="pill status-pill" style={{ "--sc": c } as CSSProperties}
        aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="dot" style={{ background: c }} />
        {statusLabel(value)}
        <span className="caret">▾</span>
      </button>
      {open && (
        <div className="ms-pop" role="listbox">
          {statuses.map((s) => (
            <button key={s.key} type="button" className="ms-opt ss-opt" role="option" aria-selected={s.key === value}
              onClick={() => { onChange(s.key); setOpen(false); }}>
              <span className="dot" style={{ background: s.color }} />
              <span className="ms-opt-label">{s.label}</span>
              {s.key === value && <Check size={14} style={{ marginLeft: "auto", flex: "none" }} />}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

/** True when the viewport is at/below `max` px (phone). Drives the responsive
 *  card layouts that replace dense desktop tables on mobile. */
export function useIsNarrow(max = 700) {
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia(`(max-width: ${max}px)`).matches);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${max}px)`);
    const on = () => setNarrow(mql.matches);
    on();
    mql.addEventListener("change", on);
    return () => mql.removeEventListener("change", on);
  }, [max]);
  return narrow;
}

/** A project / sub-project rendered as a proj-pill, tinted by its color (--pc).
 *  Design rule: projects & sub-projects are proj-pills everywhere, never bare
 *  dot+text. */
export function ProjPill({ name, color }: { name: string; color: string }) {
  return (
    <span className="pill proj-pill" style={{ "--pc": color } as CSSProperties} title={name}>
      <span className="nm">{name}</span>
    </span>
  );
}

/** Links as a structured list of removable rows + "Add link" (design D4), not a
 *  textarea. Serializes to/from a newline-joined string so callers keep their
 *  existing `links` state + payload (`links.split("\n")`). */
export function LinksEditor({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  const list = value.length ? value.split("\n") : [];
  const commit = (next: string[]) => onChange(next.join("\n"));
  return (
    <div className="links-editor">
      {list.map((u, i) => (
        <div className="link-row" key={i}>
          <Link2 size={14} className="link-ic" aria-hidden />
          <input className="link-input" value={u} placeholder="https://…" disabled={disabled}
            onChange={(e) => commit(list.map((v, j) => (j === i ? e.target.value : v)))} />
          {!disabled && (
            <button type="button" className="btn-ghost icon-only" aria-label={t("common.remove", "Remove")}
              onClick={() => commit(list.filter((_, j) => j !== i))}><X size={14} /></button>
          )}
        </div>
      ))}
      {!disabled && (
        <button type="button" className="btn-ghost add-link" onClick={() => commit([...list, ""])}>
          <Plus size={14} /> {t("task.addLink", "Add link")}
        </button>
      )}
    </div>
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
  icon,
  footer,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  /** Optional line-art section-header icon shown before the title (design rule #6). */
  icon?: ReactNode;
  /** Optional action bar pinned to the modal bottom (sticky; never scrolls out).
   *  When provided, only `children` scroll. Reuse for any long modal. */
  footer?: ReactNode;
}) {
  const { t } = useTranslation();
  // Escape closes the modal (app-wide expectation). Backdrop click closes too
  // (onClick below); the inner card stops propagation so clicks inside don't.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="card modal sheet rise"
        style={{ maxWidth: wide ? 760 : 520 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-head">
          <h2 style={{ fontSize: 18 }}>
            {icon && <span className="sh-icn">{icon}</span>}
            {title}
          </h2>
          <button className="btn-ghost icon-btn" onClick={onClose} aria-label={t("common.close")}><X size={14} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot modal-foot-sticky">{footer}</div>}
      </div>
    </div>
  );
}

/** Overlay a11y, shared by BottomSheet + Drawer: lock background scroll, move
 *  focus into the panel and trap Tab there, Escape to close, and restore focus to
 *  the opener on unmount. Returns the ref to attach to the focusable panel. */
function useOverlayDismiss(onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "Tab" && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (f.length === 0) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [onClose]);
  return panelRef;
}

/** A bottom sheet (mobile design): a scrim + a panel that rises from the bottom
 *  with a grab handle, a head (title · optional Reset · ✕) and a scrollable body,
 *  plus an optional sticky footer. Closes on scrim-click / Escape. Reused for the
 *  mobile filter / picker / day-detail sheets. */
export function BottomSheet({
  title, onClose, children, footer, onReset, resetLabel,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  onReset?: () => void;
  resetLabel?: string;
}) {
  const { t } = useTranslation();
  const panelRef = useOverlayDismiss(onClose);
  // Portal to <body> so a transformed ancestor (e.g. an entrance-animated view)
  // can't trap our position:fixed scrim/panel.
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet-panel" ref={panelRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sheet-grab"><i /></div>
        <div className="sheet-head">
          <h2>{title}</h2>
          {onReset && <button type="button" className="sheet-reset" onClick={onReset}>{resetLabel ?? t("common.reset", "Reset")}</button>}
          <button type="button" className="sheet-x" onClick={onClose} aria-label={t("common.close")}><X size={16} /></button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** A left nav drawer (mobile design): scrim + a full-height panel sliding in from
 *  the left. Same a11y as BottomSheet. Caller supplies the panel contents
 *  (`.dhead` / `.dnav` / `.duser`). Closes on scrim-click / Escape. */
export function Drawer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const panelRef = useOverlayDismiss(onClose);
  return createPortal(
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel" ref={panelRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>,
    document.body,
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
        {/* To-Do is the empty track remainder (design D11) — no segment drawn. */}
        {entries.filter(([k]) => k !== "todo").map(([k, n]) => (
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
