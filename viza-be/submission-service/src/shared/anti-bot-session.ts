/**
 * Browser session for commercial anti-bot portals (VFS Global / Akamai).
 *
 * These portals defeat the residential proxy (the Angular SPA never hydrates).
 * When a Bright Data Scraping Browser endpoint is configured
 * (`BRIGHTDATA_BROWSER_WS`) this connects to it over CDP — it solves the
 * Akamai fingerprint/CAPTCHA server-side. Otherwise it falls back to a normal
 * launch through the residential proxy (works for local/dev and non-Akamai
 * targets). Unlike `.gov` portals, VFS is a commercial domain Bright Data
 * permits, so these runners should ALWAYS prefer the Scraping Browser.
 *
 * Verified: VFS Italy + South Africa render through the Scraping Browser
 * (bodyLen ~1500) where the residential proxy returned an empty body.
 */
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { brightDataProxy } from "./proxy-launch.js";

export interface AntiBotSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  viaScrapingBrowser: boolean;
}

export async function startAntiBotSession(opts: {
  /** Residential egress country + label for the fallback proxy. */
  country: string;
  headless?: boolean;
  /** Applied only on the local/residential path (the remote Scraping Browser
   *  owns its context, so recordHar/locale can't be set on it). */
  contextOptions?: Parameters<Browser["newContext"]>[0];
}): Promise<AntiBotSession> {
  const ws = process.env.BRIGHTDATA_BROWSER_WS;
  if (ws) {
    const browser = await chromium.connectOverCDP(ws);
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = context.pages()[0] ?? (await context.newPage());
    return { browser, context, page, viaScrapingBrowser: true };
  }
  const proxy = brightDataProxy(opts.country);
  const browser = await chromium.launch({ headless: opts.headless ?? true, proxy });
  const context = await browser.newContext({
    ...opts.contextOptions,
    ignoreHTTPSErrors: Boolean(proxy),
  });
  const page = await context.newPage();
  return { browser, context, page, viaScrapingBrowser: false };
}
