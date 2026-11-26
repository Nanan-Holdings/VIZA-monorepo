/**
 * Who may crawl viza.it.com. One list feeds robots.txt and the request guard in proxy.ts.
 *
 * Search engines, link previews (WhatsApp, Meta, LinkedIn, Telegram) and AI answer engines are welcome:
 * they bring visitors and cite the site. Everything else is asked to stay out in robots.txt, and the
 * agents below are refused outright, because they exist to copy sites in bulk (scraping libraries,
 * site downloaders, Common Crawl, SEO tools competitors use to lift content).
 *
 * A user agent string can be faked, so this stops lazy scrapers only. Rate limits and verified-bot
 * checks live in the Vercel Firewall for the viza-marketing project.
 */

/** Crawlers allowed everywhere public (robots.txt groups, matched by product token). */
export const ALLOWED_CRAWLERS = [
  // Search engines
  "Googlebot", "Googlebot-Image", "Googlebot-News", "Googlebot-Video", "Google-InspectionTool", "GoogleOther",
  "AdsBot-Google", "Mediapartners-Google", "Storebot-Google",
  "Bingbot", "BingPreview", "MSNBot", "AdIdxBot",
  "Applebot", "DuckDuckBot", "YandexBot", "YandexImages", "Baiduspider", "Yeti", "SeznamBot", "PetalBot",
  "MojeekBot", "Sogou web spider", "360Spider",
  "Amazonbot",
  // Link previews and social
  "facebookexternalhit", "facebookcatalog", "meta-externalagent", "meta-externalfetcher",
  "WhatsApp", "LinkedInBot", "Twitterbot", "TelegramBot", "Slackbot", "Slackbot-LinkExpanding", "Discordbot",
  "Pinterestbot", "redditbot", "SkypeUriPreview",
  // AI answer engines and assistants fetching for a person
  "OAI-SearchBot", "ChatGPT-User", "GPTBot", "Claude-SearchBot", "Claude-User", "ClaudeBot",
  "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "DuckAssistBot", "MistralAI-User",
] as const;

/**
 * Refused with 403 on pages and APIs. Matched case-insensitively anywhere in the User-Agent.
 * Includes the generic HTTP libraries scrapers default to.
 */
export const BLOCKED_AGENTS = [
  // Bulk copies and datasets
  "CCBot", "Bytespider", "Diffbot", "Omgili", "omgilibot", "ImagesiftBot", "Timpibot", "img2dataset", "Scrapy",
  // SEO and competitive intelligence crawlers
  "AhrefsBot", "AhrefsSiteAudit", "SemrushBot", "SiteAuditBot", "MJ12bot", "DotBot", "DataForSeoBot", "BLEXBot",
  "serpstatbot", "Barkrowler", "SeekportBot", "ZoominfoBot", "magpie-crawler", "Screaming Frog", "Sitebulb",
  // Site downloaders
  "HTTrack", "SiteSucker", "WebCopier", "Offline Explorer", "Teleport", "WebZIP", "Wget",
  // Scripting libraries and headless browsers
  "python-requests", "python-urllib", "python-httpx", "aiohttp", "httpx", "Go-http-client", "Java/", "okhttp",
  "libwww-perl", "curl/", "node-fetch", "axios/", "undici", "colly", "HeadlessChrome", "PhantomJS",
] as const;

const blocked = new RegExp(BLOCKED_AGENTS.map((a) => a.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("|"), "i");

/** True for a request whose User-Agent names a blocked agent, or that sends none at all. */
export function isBlockedAgent(userAgent: string | null): boolean {
  if (!userAgent || !userAgent.trim()) return true;
  return blocked.test(userAgent);
}
