import type { MarketingSocialPlatform } from "./contracts";

/* The caption model is told to write `{url}` where the link goes, and nothing
   used to fill it in: on 25 Sep 2026 every VIZA channel went out reading
   "Details: {url}". The placeholder is resolved here, once, before any
   provider sees the text.

   Feed networks get the real address. Instagram does not make caption links
   clickable, so the phrase around the placeholder becomes "Link in bio."
   Pinterest carries the link on the pin itself, so the phrase is dropped. */

export const LINK_PLACEHOLDER = "{url}";

// "Details: {url}", "Read more: {url}", or the bare placeholder.
const PHRASE = /(?:[A-Za-z]+(?: [A-Za-z]+){0,2}:\s*)?\{url\}/g;

function tidy(text: string): string {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function fillLinkPlaceholder(platform: MarketingSocialPlatform, caption: string, destinationUrl?: string): string {
  if (!caption.includes(LINK_PLACEHOLDER)) return caption;
  if (platform === "instagram") return tidy(caption.replace(PHRASE, "Link in bio."));
  if (platform === "pinterest" || !destinationUrl) return tidy(caption.replace(PHRASE, ""));
  return tidy(caption.replaceAll(LINK_PLACEHOLDER, destinationUrl));
}

export function fillLinkPlaceholders(
  content: Partial<Record<MarketingSocialPlatform, string>>,
  destinationUrl?: string,
): Partial<Record<MarketingSocialPlatform, string>> {
  return Object.fromEntries(
    Object.entries(content).map(([platform, caption]) => [
      platform,
      fillLinkPlaceholder(platform as MarketingSocialPlatform, caption ?? "", destinationUrl),
    ]),
  ) as Partial<Record<MarketingSocialPlatform, string>>;
}
