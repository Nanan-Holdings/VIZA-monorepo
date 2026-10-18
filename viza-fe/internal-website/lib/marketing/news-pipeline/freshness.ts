/* Stale-story guard.

   A feed date only says when an item entered the feed. Google News re-dates
   republished and updated pages, Reddit dates the thread rather than the story
   it links, and some publishers bump `updated` on old explainers. That is how a
   January 2025 New Zealand announcement and an October 2025 UK white paper went
   out as fresh VIZA news in 2026. So a story has to look current three ways:
   the feed date, the publisher's own article date, and the years its headline
   names. */

const DAY_MS = 86_400_000;

export interface FreshnessWindow {
  now: Date;
  maxAgeDays: number;
}

/** Cutoff instant for a window: anything published before it is stale. */
export function freshnessCutoff({ now, maxAgeDays }: FreshnessWindow): Date {
  return new Date(now.getTime() - maxAgeDays * DAY_MS);
}

/** A reason when the date is missing, unparseable or older than the window. */
export function staleDateReason(publishedAt: string | null | undefined, window: FreshnessWindow, label: string): string | null {
  if (!publishedAt) return `${label} has no date`;
  const time = Date.parse(publishedAt);
  if (!Number.isFinite(time)) return `${label} date is unreadable`;
  if (time < freshnessCutoff(window).getTime()) return `${label} is dated ${publishedAt.slice(0, 10)}, older than ${window.maxAgeDays} days`;
  return null;
}

/** A reason when a headline names only past years ("UK immigration white paper 2025"). */
export function staleHeadlineReason(title: string, now: Date): string | null {
  const years = [...title.matchAll(/\b(19|20)\d{2}\b/g)].map((match) => Number(match[0]));
  if (!years.length) return null;
  const current = now.getUTCFullYear();
  if (years.some((year) => year >= current)) return null;
  return `Headline names only past years (${[...new Set(years)].join(", ")})`;
}

/* Publisher article dates, most to least specific. JSON-LD and the Open Graph
   article tags are what news CMSs emit; <time datetime> is the fallback for
   plain blogs. `dateModified` and `article:modified_time` are deliberately
   ignored: an old story that was edited last week is still an old story. */
const DATE_PATTERNS: RegExp[] = [
  /"datePublished"\s*:\s*"([^"]+)"/i,
  /<meta[^>]+(?:property|name|itemprop)=["'](?:article:published_time|og:published_time|datePublished|pubdate|publishdate|date|dc\.date|dcterms\.created|parsely-pub-date|sailthru\.date)["'][^>]*content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name|itemprop)=["'](?:article:published_time|og:published_time|datePublished|pubdate|publishdate)["']/i,
  /<time[^>]+datetime=["']([^"']+)["']/i,
];

/** The article's own publication date as an ISO string, or null when the page does not say. */
export function articlePublishedAt(html: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    const value = html.match(pattern)?.[1]?.trim();
    if (!value) continue;
    const time = Date.parse(value);
    if (Number.isFinite(time)) return new Date(time).toISOString();
  }
  return null;
}
