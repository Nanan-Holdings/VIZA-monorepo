import type { ReactNode } from "react";
import Link from "next/link";

/* The building blocks of the marketing portal, ported from the Volumet
   internal portal at /internal/blog. Everything is a plain server component:
   the shell is CSS (marketing-portal.css), not a component tree, so a new
   screen is a page file and nothing else. */

export function PortalPage({ children }: { children: ReactNode }) {
  return <div className="mkt-page">{children}</div>;
}

export function PortalBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mkt-back">
      <span className="mkt-back-glyph">←</span>
      {label}
    </Link>
  );
}

/* Every screen opens with one of these: title, one-line description, and a
   right-aligned actions slot, closed by a hairline. */
export function PortalHeader({
  title,
  desc,
  actions,
}: {
  title: ReactNode;
  desc?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mkt-page-header">
      <div style={{ minWidth: 0 }}>
        <h1 className="mkt-page-title">{title}</h1>
        {desc ? <p className="mkt-page-desc">{desc}</p> : null}
      </div>
      {actions ? <div className="mkt-page-actions">{actions}</div> : null}
    </div>
  );
}

export function PortalStack({ children }: { children: ReactNode }) {
  return <div className="mkt-stack">{children}</div>;
}

/* A secondary block: small uppercase caption, then whatever it introduces —
   usually another table panel. */
export function PortalSection({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mkt-section">
      <div className="mkt-section-head">
        <span className="mkt-caption">{title}</span>
        {aside ? <span className="mkt-note">{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}

export function TablePanel({ minWidth, children }: { minWidth?: number; children: ReactNode }) {
  return (
    <div className="mkt-table-panel">
      <div className="mkt-table-scroll">
        <table className="mkt-table" style={minWidth ? { minWidth } : undefined}>
          {children}
        </table>
      </div>
    </div>
  );
}

export type StatusTone = "neutral" | "up" | "down" | "warn" | "live" | "off";

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "",
  up: " is-up",
  down: " is-down",
  warn: " is-warn",
  live: " is-live",
  off: " is-off",
};

/* Status is text colour only: the plate stays neutral whatever the state.
   Coloured plates turn a dense table into a bag of sweets. */
export function StatusBadge({
  label,
  tone = "neutral",
  dot = false,
}: {
  label: string;
  tone?: StatusTone;
  dot?: boolean;
}) {
  return (
    <span className={`mkt-badge${TONE_CLASS[tone]}`}>
      {dot ? <span className="mkt-dot" /> : null}
      {label}
    </span>
  );
}

export function EmptyState({
  glyph = "◷",
  title,
  desc,
}: {
  glyph?: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="mkt-empty">
      <span className="mkt-empty-glyph">{glyph}</span>
      <span className="mkt-empty-title">{title}</span>
      <p className="mkt-empty-desc">{desc}</p>
    </div>
  );
}

export function Counters({ children }: { children: ReactNode }) {
  return <div className="mkt-counters">{children}</div>;
}

export function Counter({
  label,
  value,
  helper,
  stale = false,
}: {
  label: string;
  value: string;
  helper?: string;
  stale?: boolean;
}) {
  return (
    <div>
      <div className={`mkt-counter-value${stale ? " is-stale" : ""}`}>{value}</div>
      <div className="mkt-counter-label">{label}</div>
      {helper ? <div className="mkt-counter-helper">{helper}</div> : null}
    </div>
  );
}

/* A horizontal bar per row, for the two analytics breakdowns. Same plate as
   every other panel so the dashboard stays one surface. */
export function BarRows({
  rows,
  empty,
  format,
}: {
  rows: Array<{ label: string; value: number }>;
  empty: string;
  format: (value: number) => string;
}) {
  if (!rows.length) return <div className="mkt-bars"><p className="mkt-note">{empty}</p></div>;
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div className="mkt-bars">
      {rows.map((row) => (
        <div key={row.label} className="mkt-bar-row">
          <span className="mkt-bar-label">{row.label}</span>
          <div className="mkt-bar-track">
            <div className="mkt-bar-fill" style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }} />
          </div>
          <span className="mkt-bar-value">{format(row.value)}</span>
        </div>
      ))}
    </div>
  );
}
