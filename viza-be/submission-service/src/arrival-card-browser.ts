import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import {
  browserbaseEnabled,
  BrowserbaseSessionError,
  createBrowserbaseCloudSession,
} from "./browserbase-session";

export type ArrivalCardBrowserProvider = "local" | "local-cdp" | "remote-browser-api" | "browserbase";

export interface ArrivalCardBrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  provider: ArrivalCardBrowserProvider;
  nativeCloudflareUnblock: boolean;
  replayUrl?: string;
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

export type ArrivalCardBrowserPrefix = "MDAC" | "TDAC" | "PH_ETRAVEL" | "VN_PREARRIVAL" | "TW_ENTRY_PERMIT";

export function resolveArrivalCardBrowserEndpoint(prefix: ArrivalCardBrowserPrefix): string | null {
  const envNames = [
    `${prefix}_BROWSER_API_ENDPOINT`,
    `${prefix}_BRIGHTDATA_BROWSER_API_ENDPOINT`,
  ];
  if (
    prefix === "TDAC" ||
    prefix === "PH_ETRAVEL" ||
    process.env[`${prefix}_USE_GLOBAL_BROWSER_API`]?.trim() === "true"
  ) {
    envNames.push(
      "BRIGHTDATA_BROWSER_WS",
      "BRIGHTDATA_BROWSER_API_ENDPOINT",
      "SBR_WS_ENDPOINT",
    );
  }
  return firstConfiguredEndpoint(envNames);
}

export function resolveArrivalCardLocalCdpEndpoint(prefix: ArrivalCardBrowserPrefix): string | null {
  return firstConfiguredEndpoint([
    `${prefix}_CDP_ENDPOINT`,
    `${prefix}_CHROME_CDP_ENDPOINT`,
  ]);
}

function isBrightDataBrowserEndpoint(endpoint: string | null): boolean {
  return /brd\.superproxy\.io/i.test(endpoint ?? "");
}

function requiresRemoteBrowserApi(prefix: ArrivalCardBrowserPrefix, endpoint: string | null): boolean {
  const explicit = process.env[`${prefix}_REQUIRE_BROWSER_API`]?.trim();
  if (explicit) return explicit !== "false";
  return (prefix === "PH_ETRAVEL" || prefix === "TDAC") && Boolean(endpoint);
}

export async function createArrivalCardBrowserSession(options: {
  prefix: ArrivalCardBrowserPrefix;
  headless?: boolean;
  forceLocal?: boolean;
}): Promise<ArrivalCardBrowserSession> {
  const diagnostics: string[] = [];
  const endpoint = options.forceLocal ? null : resolveArrivalCardBrowserEndpoint(options.prefix);
  const requireRemoteBrowserApi = !options.forceLocal && requiresRemoteBrowserApi(options.prefix, endpoint);
  if (endpoint) {
    let browser: Browser | null = null;
    const maxAttempts = Number(process.env[`${options.prefix}_BROWSER_API_CONNECT_ATTEMPTS`] ?? "3");
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        browser = await chromium.connectOverCDP(endpoint, { timeout: 45_000 });
        diagnostics.push(`${options.prefix.toLowerCase()}_remote_browser_api_connected attempt=${attempt}`);
        break;
      } catch (error) {
        const cause = error instanceof Error ? error.message.split("\n")[0] : String(error);
        diagnostics.push(`${options.prefix.toLowerCase()}_remote_browser_api_failed attempt=${attempt} ${cause}`);
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 2_000 * attempt));
        }
      }
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
    if (requireRemoteBrowserApi) {
      throw new ArrivalCardBrowserError(
        `${options.prefix} Browser API endpoint was configured but could not be reached; refusing to fall back to local browser for a Cloudflare-protected portal.`,
      );
    }
  }

  if (!options.forceLocal && browserbaseEnabled(options.prefix)) {
    try {
      const cloudSession = await createBrowserbaseCloudSession({ prefix: options.prefix });
      const browser = await chromium.connectOverCDP(cloudSession.connectUrl, { timeout: 45_000 });
      const context = browser.contexts()[0] ?? await browser.newContext({ acceptDownloads: true });
      const page = context.pages()[0] ?? await context.newPage();
      diagnostics.push(
        `${options.prefix.toLowerCase()}_browserbase_connected proxies=${cloudSession.proxiesEnabled}`,
      );
      return {
        browser,
        context,
        page,
        provider: "browserbase",
        nativeCloudflareUnblock: false,
        replayUrl: cloudSession.replayUrl,
        diagnostics,
        close: () => browser.close(),
      };
    } catch (error) {
      const message = error instanceof BrowserbaseSessionError
        ? error.message
        : "Browserbase session could not be connected.";
      throw new ArrivalCardBrowserError(message);
    }
  }

  const cdpEndpoint = resolveArrivalCardLocalCdpEndpoint(options.prefix);
  if (cdpEndpoint) {
    const browser = await chromium.connectOverCDP(cdpEndpoint, { timeout: 45_000 });
    const context = browser.contexts()[0] ?? await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    return {
      browser,
      context,
      page,
      provider: "local-cdp",
      nativeCloudflareUnblock: false,
      diagnostics: [
        ...diagnostics,
        `${options.prefix.toLowerCase()}_local_cdp_connected`,
      ],
      close: () => browser.close(),
    };
  }

  const configuredChannel = process.env[`${options.prefix}_PLAYWRIGHT_CHANNEL`]?.trim();
  const channel = configuredChannel === "bundled"
    ? undefined
    : configuredChannel
      || (["MDAC", "TDAC", "PH_ETRAVEL", "VN_PREARRIVAL", "TW_ENTRY_PERMIT"].includes(options.prefix) ? "chrome" : undefined);
  const explicitHeadless = process.env[`${options.prefix}_PLAYWRIGHT_HEADLESS`]?.trim();
  const headless = options.headless ?? (explicitHeadless ? explicitHeadless !== "false" : true);
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
