import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import {
  actionForIndonesiaPortalState,
  classifyIndonesiaPortalSnapshot,
  type IndonesiaPortalStateId,
} from "./portal-state";

export interface IndonesiaPortalProbeInput {
  portalUrl: string;
  provider: "indonesia_c1_live" | "indonesia_b1_evoa_live";
  headless?: boolean;
  timeoutMs?: number;
}

export interface IndonesiaPortalProbeResult {
  state: IndonesiaPortalStateId;
  actionType: string;
  instruction: string;
  implementationStatus: "partial" | "blocked";
  url: string;
  title: string | null;
  browserProvider: "local" | "local-cdp" | "remote-browser-api";
  diagnostics: string[];
}

function firstConfiguredEndpoint(envNames: string[]): string | null {
  for (const name of envNames) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return null;
}

function endpointEnvNames(provider: IndonesiaPortalProbeInput["provider"]): string[] {
  const prefix = provider === "indonesia_b1_evoa_live" ? "ID_B1_EVOA" : "ID_C1";
  const envNames = [
    `${prefix}_BROWSER_API_ENDPOINT`,
    `${prefix}_BRIGHTDATA_BROWSER_API_ENDPOINT`,
    "INDONESIA_BROWSER_API_ENDPOINT",
    "INDONESIA_BRIGHTDATA_BROWSER_API_ENDPOINT",
  ];
  if (process.env.INDONESIA_USE_GLOBAL_BROWSER_API?.trim() === "true") {
    envNames.push(
      "BRIGHTDATA_BROWSER_WS",
      "BRIGHTDATA_BROWSER_API_ENDPOINT",
      "SBR_WS_ENDPOINT",
    );
  }
  return envNames;
}

async function createIndonesiaProbeSession(input: IndonesiaPortalProbeInput): Promise<{
  browser: Browser;
  context: BrowserContext;
  page: Page;
  provider: "local" | "local-cdp" | "remote-browser-api";
  diagnostics: string[];
}> {
  const diagnostics: string[] = [];
  const endpoint = firstConfiguredEndpoint(endpointEnvNames(input.provider));
  if (endpoint) {
    const browser = await chromium.connectOverCDP(endpoint, { timeout: 45_000 });
    const context = browser.contexts()[0] ?? await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    diagnostics.push("indonesia_remote_browser_api_connected");
    return { browser, context, page, provider: "remote-browser-api", diagnostics };
  }

  const cdpEndpoint = firstConfiguredEndpoint([
    input.provider === "indonesia_b1_evoa_live" ? "ID_B1_EVOA_CDP_ENDPOINT" : "ID_C1_CDP_ENDPOINT",
    "INDONESIA_CDP_ENDPOINT",
    "INDONESIA_CHROME_CDP_ENDPOINT",
  ]);
  if (cdpEndpoint) {
    const browser = await chromium.connectOverCDP(cdpEndpoint, { timeout: 45_000 });
    const context = browser.contexts()[0] ?? await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    diagnostics.push("indonesia_local_cdp_connected");
    return { browser, context, page, provider: "local-cdp", diagnostics };
  }

  const channel = process.env.INDONESIA_PLAYWRIGHT_CHANNEL?.trim() || undefined;
  const browser = await chromium.launch({ channel, headless: input.headless ?? true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  diagnostics.push(`indonesia_local_browser channel=${channel ?? "chromium"} headless=${input.headless ?? true}`);
  return { browser, context, page, provider: "local", diagnostics };
}

export async function probeIndonesiaPortal(
  input: IndonesiaPortalProbeInput,
): Promise<IndonesiaPortalProbeResult> {
  const session = await createIndonesiaProbeSession(input);
  try {
    const page = session.page;
    await page.goto(input.portalUrl, {
      waitUntil: "domcontentloaded",
      timeout: input.timeoutMs ?? 60_000,
    });
    await page.waitForTimeout(1500);
    let title = await page.title().catch(() => null);
    let text = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
    let url = page.url();
    let state = classifyIndonesiaPortalSnapshot({ url, title, text });
    if (state === "landing_visible") {
      const applyControl = page
        .getByRole("link", { name: /^apply$/i })
        .or(page.getByRole("button", { name: /^apply$/i }))
        .first();
      if (await applyControl.isVisible({ timeout: 3000 }).catch(() => false)) {
        await applyControl.click({ timeout: 10_000 });
        await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
        await page.waitForTimeout(1500);
        title = await page.title().catch(() => null);
        text = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
        url = page.url();
        state = classifyIndonesiaPortalSnapshot({ url, title, text });
      }
    }
    const action = actionForIndonesiaPortalState(state);
    return {
      state,
      actionType: action.actionType,
      instruction: action.instruction,
      implementationStatus: action.implementationStatus,
      url,
      title,
      browserProvider: session.provider,
      diagnostics: session.diagnostics,
    };
  } finally {
    await session.browser.close().catch(() => undefined);
  }
}
