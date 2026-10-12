import Link from "next/link";
import { EmptyState, StatusBadge, TablePanel, type StatusTone } from "./portal-ui";
import type { MarketingBlogAdminRecord, MarketingSocialCompositionRecord } from "@/lib/marketing/contracts";
import { marketingDateLocale, marketingStatusLabel, type MarketingCopy } from "../copy";

/* Status carries tone, never a plate colour: one neutral pill, the word tinted.
   A table of twenty rows stays readable that way. */
const TONES: Record<string, StatusTone> = {
  draft: "neutral",
  published: "up",
  archived: "off",
  scheduled: "live",
  publishing: "live",
  partial: "warn",
  failed: "down",
  cancelled: "off",
  running: "live",
  succeeded: "up",
  skipped: "off",
  pending: "warn",
};

export function statusTone(status: string): StatusTone {
  return TONES[status] ?? "neutral";
}

export function MarketingStatusBadge({ status, copy }: { status: string; copy: MarketingCopy }) {
  return <StatusBadge label={marketingStatusLabel(copy, status)} tone={statusTone(status)} />;
}

export function ConnectionBadge({ connected, copy }: { connected: boolean; copy: MarketingCopy }) {
  return <StatusBadge dot label={connected ? copy.connected : copy.notConnected} tone={connected ? "up" : "warn"} />;
}

export function MarketingBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mkt-back">
      <span className="mkt-back-glyph">←</span>
      {label}
    </Link>
  );
}

function day(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/* The blog table. `compact` drops the columns the dashboard has no room for
   and keeps the same plate, so the two screens read as one system. */
export function BlogList({
  posts,
  copy,
  compact = false,
}: {
  posts: MarketingBlogAdminRecord[];
  copy: MarketingCopy;
  compact?: boolean;
}) {
  if (!posts.length) return <EmptyState glyph="✎" title={copy.noPosts} desc={copy.blogDescription} />;
  return (
    <TablePanel minWidth={compact ? 520 : 1060}>
      <thead>
        <tr>
          <th>{copy.colPost}</th>
          {compact ? null : <th style={{ width: 160 }}>{copy.colSource}</th>}
          {compact ? null : <th style={{ width: 175 }}>{copy.colKeyword}</th>}
          <th style={{ width: 110 }}>{copy.colUpdated}</th>
          <th style={{ width: 125 }}>{copy.colStatus}</th>
          {compact ? null : <th style={{ width: 72 }}>{copy.colScore}</th>}
        </tr>
      </thead>
      <tbody>
        {posts.map((post) => (
          <tr key={post.id}>
            <td>
              <Link href={`/admin/marketing/blog/${post.id}`} className="mkt-cell-title">
                {post.title}
              </Link>
              <div className="mkt-sub">
                /{post.locale}/{post.slug} · v{post.version}
              </div>
            </td>
            {compact ? null : (
              <td className="mkt-cell-tight">
                {post.editorial.sourceUrl ? (
                  <a href={post.editorial.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {host(post.editorial.sourceUrl)}
                  </a>
                ) : (
                  <span style={{ color: "var(--mkt-muted-soft)" }}>{copy.noSource}</span>
                )}
              </td>
            )}
            {compact ? null : (
              <td className="mkt-cell-tight">
                {post.editorial.seoKeyword ?? "—"}
                <div className="mkt-sub mkt-sub-mono">
                  {post.editorial.keywordMeasured && post.editorial.monthlySearches !== null
                    ? `${post.editorial.monthlySearches} /mo`
                    : copy.unmeasuredKeyword}
                </div>
              </td>
            )}
            <td className="mkt-mono">{day(post.updatedAt)}</td>
            <td>
              <MarketingStatusBadge status={post.status} copy={copy} />
              {post.publishedAt ? <div className="mkt-sub mkt-sub-mono">{day(post.publishedAt)}</div> : null}
            </td>
            {compact ? null : (
              <td className="mkt-mono" style={{ color: post.editorial.rankScore === null ? "var(--mkt-muted-soft)" : undefined }}>
                {post.editorial.rankScore ?? "—"}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </TablePanel>
  );
}

/* The dashboard's social table. One row per composition here; the social
   screen itself breaks each composition out into its platform deliveries. */
export function SocialList({
  rows,
  copy,
  compact = false,
}: {
  rows: MarketingSocialCompositionRecord[];
  copy: MarketingCopy;
  compact?: boolean;
}) {
  if (!rows.length) return <EmptyState glyph="◎" title={copy.noSocial} desc={copy.socialDescription} />;
  const dateLocale = marketingDateLocale(copy);
  return (
    <TablePanel minWidth={compact ? 520 : 860}>
      <thead>
        <tr>
          <th>{copy.colPost}</th>
          <th style={{ width: 210 }}>{copy.platforms}</th>
          <th style={{ width: 170 }}>{copy.scheduled}</th>
          <th style={{ width: 130 }}>{copy.colStatus}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>
              <Link href={`/admin/marketing/social/${row.id}`} className="mkt-cell-title">
                {row.title}
              </Link>
              {compact ? null : <div className="mkt-sub">{row.brief}</div>}
            </td>
            <td className="mkt-cell-tight">{row.platforms.join(", ") || "—"}</td>
            <td className="mkt-mono" style={{ color: row.scheduledFor ? undefined : "var(--mkt-muted-soft)" }}>
              {row.scheduledFor ? new Date(row.scheduledFor).toLocaleString(dateLocale) : copy.notScheduled}
            </td>
            <td>
              <MarketingStatusBadge status={row.status} copy={copy} />
              {!compact && row.lastSyncedAt ? (
                <div className="mkt-sub mkt-sub-mono">
                  {copy.synced} {day(row.lastSyncedAt)}
                </div>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </TablePanel>
  );
}
