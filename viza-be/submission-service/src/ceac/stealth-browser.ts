/**
 * Stealth browser launcher for CEAC automation.
 *
 * CEAC fingerprints automation in several ways:
 *   - User-Agent and sec-ch-ua client hints carry `HeadlessChrome` when
 *     Chromium runs in headless mode. CEAC silently returns the start
 *     page (not an async postback or redirect) when it sees this, so
 *     correctly solved CAPTCHAs appear to fail.
 *   - `navigator.webdriver === true`, missing `window.chrome` object,
 *     empty plugins array, Permissions.query quirks, iframe.contentWindow
 *     nulls, and several other JS surface differences.
 *
 * This module wraps Playwright's chromium launcher with
 * `puppeteer-extra-plugin-stealth` (which patches the JS-surface leaks)
 * and applies a matching UA + client-hints override on the context.
 *
 * Use via `launchStealthBrowser()` — returns the same shape as a
 * Playwright `{ browser, context, page }` tuple plus a `close()` helper.
 */
import { chromium as playwrightChromium } from "@playwright/test";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import PlaywrightExtraDefault from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

// playwright-extra's default export is a launcher object. Its CommonJS/ESM
// interop leaves the typed shape fuzzy; narrow here to the surface we use.
const extra = (
  (PlaywrightExtraDefault as unknown as { default?: unknown }).default ??
  PlaywrightExtraDefault
) as {
  chromium: {
    use: (plugin: unknown) => void;
    launch: (opts: Parameters<typeof playwrightChromium.launch>[0]) => Promise<Browser>;
  };
};

// Register stealth once at module load — it patches every future launch.
extra.chromium.use(StealthPlugin());

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const DEFAULT_CLIENT_HINTS: Record<string, string> = {
  "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"',
};

export interface StealthBrowserOptions {
  headless?: boolean;
  acceptDownloads?: boolean;
  /** Override the UA. Default: macOS Chrome 131. */
  userAgent?: string;
}

export interface StealthBrowserHandles {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

/**
 * Launch a stealth-patched Chromium browser and return a fresh page.
 *
 * The stealth plugin hides `navigator.webdriver`, spoofs the chrome
 * runtime, patches plugins/languages/vendor, and covers roughly a dozen
 * other JS-surface leaks. Combined with a real-Chrome UA + matching
 * client hints, this makes CEAC treat us as a regular browser session.
 */
export async function launchStealthBrowser(
  options: StealthBrowserOptions = {},
): Promise<StealthBrowserHandles> {
  const browser = await extra.chromium.launch({
    headless: options.headless ?? true,
  });
  const context = await browser.newContext({
    acceptDownloads: options.acceptDownloads ?? true,
    userAgent: options.userAgent ?? DEFAULT_USER_AGENT,
    extraHTTPHeaders: DEFAULT_CLIENT_HINTS,
  });
  const page = await context.newPage();
  return { browser, context, page };
}
