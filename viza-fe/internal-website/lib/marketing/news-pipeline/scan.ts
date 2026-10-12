import type { NewsScanConfig, NewsScanResult, NewsStory } from "./types";

type Feed = { kind: "search" | "trade" | "reddit"; name: string; url: string };
const USER_AGENT = "VIZAEditorialBot/1.0 (+https://viza.it.com)";

function decode(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&amp;/g, "&");
}

function plainText(value: string): string {
  return decode(decode(value).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function tag(block: string, name: string): string {
  return block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"))?.[1] ?? "";
}

/** Parse RSS items and Atom entries (including Reddit's Atom feed). */
export function parseNewsFeed(xml: string, feedName: string): NewsStory[] {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];
  const items: NewsStory[] = [];
  for (const block of blocks) {
    const title = plainText(tag(block, "title"));
    const rawLink = tag(block, "link") || block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] || "";
    const url = decode(rawLink).trim();
    if (!title || !/^https?:\/\//i.test(url)) continue;
    const dateRaw = plainText(tag(block, "pubDate") || tag(block, "published") || tag(block, "updated"));
    const timestamp = dateRaw ? Date.parse(dateRaw) : NaN;
    items.push({
      url,
      title: title.slice(0, 300),
      source: plainText(tag(block, "source")) || feedName,
      feed: feedName,
      summary: plainText(tag(block, "description") || tag(block, "summary") || tag(block, "content")).slice(0, 600),
      publishedAt: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null,
    });
  }
  return items;
}

function feeds(config: NewsScanConfig): Feed[] {
  const [region = "SG", language = "en"] = config.googleNewsEdition.split(":");
  return [
    ...config.searchQueries.map((query): Feed => ({
      kind: "search",
      name: `Google News: ${query}`,
      url: `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:${config.maxAgeDays}d`)}&hl=${encodeURIComponent(language)}&gl=${encodeURIComponent(region)}&ceid=${encodeURIComponent(config.googleNewsEdition)}`,
    })),
    ...config.tradeFeeds.map((feed): Feed => ({ kind: "trade", ...feed })),
    ...config.subreddits.map((subreddit): Feed => ({
      kind: "reddit", name: `r/${subreddit}`,
      url: `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/top/.rss?t=week`,
    })),
  ];
}

async function fetchFeed(feed: Feed): Promise<NewsStory[]> {
  const response = await fetch(feed.url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/atom+xml, text/xml, */*" },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`${response.status} from ${feed.name}`);
  return parseNewsFeed(await response.text(), feed.name);
}

function titleKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 100);
}

export async function scanNews(config: NewsScanConfig): Promise<NewsScanResult> {
  if (!Number.isInteger(config.maxAgeDays) || config.maxAgeDays < 1 || !Number.isInteger(config.maxPerFeed) || config.maxPerFeed < 1) {
    throw new Error("News scan age and per-feed limits must be positive integers");
  }
  const all = feeds(config);
  const standard = all.filter((feed) => feed.kind !== "reddit");
  const reddit = all.filter((feed) => feed.kind === "reddit");
  const standardPromise = Promise.allSettled(standard.map(fetchFeed));
  const redditPromise = (async (): Promise<PromiseSettledResult<NewsStory[]>[]> => {
    const results: PromiseSettledResult<NewsStory[]>[] = [];
    for (const feed of reddit) {
      results.push(await fetchFeed(feed).then(
        (value): PromiseFulfilledResult<NewsStory[]> => ({ status: "fulfilled", value }),
        (reason: unknown): PromiseRejectedResult => ({ status: "rejected", reason }),
      ));
      if (results.length < reddit.length) await new Promise((resolve) => setTimeout(resolve, 1_500));
    }
    return results;
  })();
  const [standardResults, redditResults] = await Promise.all([standardPromise, redditPromise]);
  const results = [...standardResults, ...redditResults];
  const cutoff = Date.now() - config.maxAgeDays * 86_400_000;
  const seen = new Set<string>();
  const items: NewsStory[] = [];
  const feedErrors: string[] = [];
  [...standard, ...reddit].forEach((feed, index) => {
    const result = results[index];
    if (result.status === "rejected") {
      feedErrors.push(`${feed.name}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
      return;
    }
    let kept = 0;
    for (const item of result.value) {
      if (kept >= config.maxPerFeed) break;
      if (item.publishedAt && Date.parse(item.publishedAt) < cutoff) continue;
      const key = titleKey(item.title);
      if (!key || seen.has(key) || seen.has(item.url)) continue;
      seen.add(key);
      seen.add(item.url);
      items.push(item);
      kept++;
    }
  });
  return { items, feedErrors };
}
