import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";

export type ArrivalCardBrowserProvider = "local" | "remote-browser-api";

export interface ArrivalCardBrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  provider: ArrivalCardBrowserProvider;
  nativeCloudflareUnblock: boolean;
  diagnostics: string[];
  close: () => Promise<void>;
}

export class ArrivalCardBrowserError extends Error {
  readonly code = "arrival_card_remote_browser_connect_failed";

  constructor(message: string) {
    super(message);
    this.name = "ArrivalCardBrowserError";
  }
}

function firstConfiguredEndpoint(envNames: string[]): string | null {
  for (const name of envNames) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return null;
}

export function resolveArrivalCardBrowserEndpoint(prefix: "MDAC" | "TDAC"): string | null {
  return firstConfiguredEndpoint([
    `${prefix}_BROWSER_API_ENDPOINT`,
    `${prefix}_BRIGHTDATA_BROWSER_API_ENDPOINT`,
    "BRIGHTDATA_BROWSER_WS",
    "BRIGHTDATA_BROWSER_API_ENDPOINT",
    "SBR_WS_ENDPOINT",
  ]);
}

function isBrightDataBrowserEndpoint(endpoint: string | null): boolean {
  return /brd\.superproxy\.io/i.test(endpoint ?? "");
}

export async function createArrivalCardBrowserSession(options: {
  prefix: "MDAC" | "TDAC";
  headless?: boolean;
}): Promise<ArrivalCardBrowserSession> {
  const diagnostics: string[] = [];
  const endpoint = resolveArrivalCardBrowserEndpoint(options.prefix);
  if (endpoint) {
    let browser: Browser | null = null;
    try {
      browser = await chromium.connectOverCDP(endpoint);
    } catch (error) {
      const cause = error instanceof Error ? error.message.split("\n")[0] : String(error);
      diagnostics.push(`${options.prefix.toLowerCase()}_remote_browser_api_failed ${cause}`);
    }
    if (browser) {
      const context = browser.contexts()[0] ?? await browser.newContext({ acceptDownloads: true });
      const page = await context.newPage();
      return {
        browser,
        context,
        page,
        provider: "remote-browser-api",
        nativeCloudflareUnblock: isBrightDataBrowserEndpoint(endpoint),
        diagnostics,
        close: () => browser.close(),
      };
    }
  }

  const channel = process.env[`${options.prefix}_PLAYWRIGHT_CHANNEL`]?.trim()
    || (["MDAC", "TDAC"].includes(options.prefix) ? "chrome" : undefined);
  const explicitHeadless = process.env[`${options.prefix}_PLAYWRIGHT_HEADLESS`]?.trim();
  const headless = explicitHeadless
    ? explicitHeadless !== "false"
    : ["MDAC", "TDAC"].includes(options.prefix)
      ? false
      : options.headless ?? true;
  const browser = await chromium.launch({ channel, headless });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  return {
    browser,
    context,
    page,
    provider: "local",
    nativeCloudflareUnblock: false,
    diagnostics: [
      ...diagnostics,
      `${options.prefix.toLowerCase()}_local_browser channel=${channel ?? "chromium"} headless=${headless}`,
    ],
    close: () => browser.close(),
  };
}
