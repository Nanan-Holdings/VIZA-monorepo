import type { NewsStory, ReadableNewsStory } from "./types";

const USER_AGENT = "VIZAEditorialBot/1.0 (+https://viza.it.com)";
const MIN_ARTICLE_CHARS = 800;

function safeExternalUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "0.0.0.0" || host === "[::1]") return null;
    if (/^(?:10|127|169\.254|192\.168)\./.test(host) || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host)) return null;
    return url;
  } catch {
    return null;
  }
}

async function fetchExternal(value: string): Promise<Response | null> {
  let url = safeExternalUrl(value);
  for (let hop = 0; hop < 4 && url; hop++) {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, redirect: "manual", signal: AbortSignal.timeout(12_000), cache: "no-store" });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    url = location ? safeExternalUrl(new URL(location, url).toString()) : null;
  }
  return null;
}

function decodeText(value: string): string {
  return value.replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

async function readArticle(value: string): Promise<ReadableNewsStory> {
  const empty = { url: value, text: "", coverImageUrl: null };
  if (!safeExternalUrl(value) || /news\.google\.com$/i.test(new URL(value).hostname)) return empty;
  try {
    const response = await fetchExternal(value);
    if (!response?.ok || !(response.headers.get("content-type") ?? "").toLowerCase().includes("text/html")) return empty;
    const html = (await response.text()).slice(0, 1_000_000);
    const image = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]*content=["']([^"']+)["']/i)?.[1]
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i)?.[1];
    const coverImageUrl = image ? safeExternalUrl(new URL(image.replace(/&amp;/g, "&"), response.url || value).toString())?.toString() ?? null : null;
    const text = decodeText(html
      .replace(/<(script|style|nav|footer|header|aside|form)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " "))
      .trim().slice(0, 7_000);
    return { url: response.url || value, text, coverImageUrl };
  } catch {
    return empty;
  }
}

function words(value: string): Set<string> {
  return new Set(value.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(" ").filter((word) => word.length > 2));
}

/** Google News RSS URLs are redirect shims. Bing News RSS can reveal publisher URLs. */
async function publisherUrls(title: string): Promise<string[]> {
  const headline = title.replace(/\s+-\s+[^-]+$/, "").trim();
  try {
    const response = await fetchExternal(`https://www.bing.com/news/search?q=${encodeURIComponent(headline)}&format=rss`);
    if (!response?.ok) return [];
    const xml = await response.text();
    const wanted = words(headline);
    const urls: string[] = [];
    for (const item of xml.match(/<item>[\s\S]*?<\/item>/g) ?? []) {
      const headlineFromFeed = decodeText(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
      const shared = [...wanted].filter((word) => words(headlineFromFeed).has(word)).length;
      if (!wanted.size || shared / wanted.size < 0.6) continue;
      const link = decodeText(item.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "");
      const target = safeExternalUrl(new URL(link).searchParams.get("url") ?? link);
      if (target && !/bing\.com$|news\.google\.com$/i.test(target.hostname)) urls.push(target.toString());
    }
    return urls.slice(0, 4);
  } catch {
    return [];
  }
}

/** Return readable publisher content or an empty text; callers must enforce a minimum. */
export async function readNewsStory(story: Pick<NewsStory, "url" | "title">): Promise<ReadableNewsStory> {
  const direct = await readArticle(story.url);
  if (direct.text.length >= MIN_ARTICLE_CHARS) return direct;
  if (safeExternalUrl(story.url)?.hostname === "news.google.com") {
    for (const url of await publisherUrls(story.title)) {
      const article = await readArticle(url);
      if (article.text.length >= MIN_ARTICLE_CHARS) return article;
    }
  }
  return direct;
}

export { MIN_ARTICLE_CHARS };
