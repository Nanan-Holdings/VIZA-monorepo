import { chromium, type Browser, type CDPSession, type Page } from "@playwright/test";
import {
  browserbaseEnabled,
  connectBrowserbaseCloudBrowser,
} from "../browserbase-session";

export type FranceTlsBrowserProvider = "browserbase" | "remote-browser-api" | "local-cdp" | "local";

export interface FranceTlsBrowserEndpoint {
  endpoint: string;
  provider: Exclude<FranceTlsBrowserProvider, "local">;
  source: string;
}

export interface FranceTlsBrowserSession {
  browser: Browser;
  page: Page;
  provider: FranceTlsBrowserProvider;
  source: string;
}

export type FranceTlsBrowserCheckpoint =
  | "captcha_grid"
  | "captcha_token"
  | "login"
  | "payment"
  | "ready"
  | "site_policy_review"
  | "waf";

export interface FranceTlsBrowserStateInput {
  url: string;
  title: string;
  bodyText: string;
  frameUrls: string[];
}

export interface FranceTlsBrowserState {
  checkpoint: FranceTlsBrowserCheckpoint;
  message: string;
  hasRecaptchaGrid: boolean;
  hasRecaptchaAnchor: boolean;
}

export interface FranceTlsProviderCaptchaSolveResult {
  attempted: boolean;
  detectedChallenge: boolean;
  status: string;
  tokenPresent: boolean;
}

const REMOTE_ENDPOINT_ENV_NAMES = [
  "FRANCE_TLS_BROWSER_API_ENDPOINT",
  "FRANCE_TLS_BRIGHTDATA_BROWSER_API_ENDPOINT",
  "BRIGHTDATA_BROWSER_WS",
  "BRIGHTDATA_BROWSER_API_ENDPOINT",
  "SBR_WS_ENDPOINT",
] as const;

const LOCAL_CDP_ENV_NAMES = [
  "FRANCE_TLS_CDP_ENDPOINT",
  "FRANCE_TLS_CHROME_CDP_ENDPOINT",
] as const;

function firstConfiguredEndpoint(names: readonly string[]): FranceTlsBrowserEndpoint | null {
  for (const source of names) {
    const endpoint = process.env[source]?.trim();
    if (!endpoint) continue;
    return {
      endpoint,
      provider: source.includes("CDP") || source.includes("CHROME") ? "local-cdp" : "remote-browser-api",
      source,
    };
  }
  return null;
}

export function resolveFranceTlsBrowserEndpoint(): FranceTlsBrowserEndpoint | null {
  return firstConfiguredEndpoint(REMOTE_ENDPOINT_ENV_NAMES) ?? firstConfiguredEndpoint(LOCAL_CDP_ENV_NAMES);
}

export async function createFranceTlsBrowserSession(): Promise<FranceTlsBrowserSession> {
  if (browserbaseEnabled("FRANCE_TLS")) {
    const cloud = await connectBrowserbaseCloudBrowser({ prefix: "FRANCE_TLS" });
    return {
      browser: cloud.browser,
      page: cloud.page,
      provider: "browserbase",
      source: "FRANCE_TLS_BROWSERBASE_ENABLED",
    };
  }
  const configured = resolveFranceTlsBrowserEndpoint();
  if (configured) {
    const browser = await chromium.connectOverCDP(configured.endpoint, { timeout: 45_000 });
    const context = browser.contexts()[0] ?? await browser.newContext({ acceptDownloads: true });
    return {
      browser,
      page: await context.newPage(),
      provider: configured.provider,
      source: configured.source,
    };
  }

  const headless = process.env.FRANCE_TLS_PLAYWRIGHT_HEADLESS?.trim() !== "false";
  const channel = process.env.FRANCE_TLS_PLAYWRIGHT_CHANNEL?.trim() || undefined;
  const browser = await chromium.launch({ channel, headless });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1365, height: 900 } });
  return { browser, page: await context.newPage(), provider: "local", source: "local" };
}

export function classifyFranceTlsBrowserState(input: FranceTlsBrowserStateInput): FranceTlsBrowserState {
  const body = input.bodyText.replace(/\s+/g, " ").trim();
  const haystack = `${input.title} ${input.url} ${body}`.toLowerCase();
  const hasRecaptchaGrid = input.frameUrls.some((url) => /recaptcha\/api2\/bframe/i.test(url));
  const hasRecaptchaAnchor = input.frameUrls.some((url) => /recaptcha\/api2\/anchor/i.test(url));

  if (input.url.startsWith("chrome-error://") || /http error \d{3}|this page isn.t working/i.test(body)) {
    return {
      checkpoint: "site_policy_review",
      message: "TLScontact returned a browser/HTTP error for the requested official URL.",
      hasRecaptchaGrid,
      hasRecaptchaAnchor,
    };
  }
  if (/sorry\s+something went wrong|it looks like something went wrong/i.test(body)) {
    return {
      checkpoint: "site_policy_review",
      message: "TLScontact returned its official generic center error page without an actionable error code.",
      hasRecaptchaGrid,
      hasRecaptchaAnchor,
    };
  }
  if (hasRecaptchaGrid) {
    return {
      checkpoint: "captcha_grid",
      message: "TLScontact is showing a visible reCAPTCHA image-grid challenge.",
      hasRecaptchaGrid,
      hasRecaptchaAnchor,
    };
  }
  if (hasRecaptchaAnchor || /g-recaptcha-response|recaptcha/i.test(haystack)) {
    return {
      checkpoint: "captcha_token",
      message: "TLScontact is showing a reCAPTCHA token/checkbox challenge.",
      hasRecaptchaGrid,
      hasRecaptchaAnchor,
    };
  }
  if (/just a moment|cloudflare|security verification|verify you are not a bot|checking your browser|cf-chl|ray id|access denied|attention required/.test(haystack)) {
    return {
      checkpoint: "waf",
      message: "TLScontact is showing Cloudflare/WAF security verification.",
      hasRecaptchaGrid,
      hasRecaptchaAnchor,
    };
  }
  if (input.url.includes("tlscontact.com") && !input.title.trim() && !body) {
    return {
      checkpoint: "waf",
      message: "TLScontact returned a blank page after security verification; continue waiting or use a TLS-specific Browser API session.",
      hasRecaptchaGrid,
      hasRecaptchaAnchor,
    };
  }
  if (
    /\/workflow\/(?:order-summary|payment)\//i.test(input.url)
    || /card number|pay online|order summary|tlscontact fees:\s*\d|service fee payment/i.test(body)
  ) {
    return {
      checkpoint: "payment",
      message: "TLScontact payment/order page is visible.",
      hasRecaptchaGrid,
      hasRecaptchaAnchor,
    };
  }
  if (/i2-auth\.visas-fr\.tlscontact\.com|\/auth\/realms\//i.test(input.url) || /password.*email|email.*password|forgot password|sign in to tlscontact/i.test(body)) {
    return {
      checkpoint: "login",
      message: "TLScontact login page is visible.",
      hasRecaptchaGrid,
      hasRecaptchaAnchor,
    };
  }
  return {
    checkpoint: "ready",
    message: "TLScontact page content is visible.",
    hasRecaptchaGrid,
    hasRecaptchaAnchor,
  };
}

export function hasFranceTlsCloudflareChallenge(input: FranceTlsBrowserStateInput): boolean {
  const haystack = `${input.title} ${input.url} ${input.bodyText}`.toLowerCase();
  return (
    input.frameUrls.some((url) => /challenges\.cloudflare\.com|cf-chl|turnstile/i.test(url)) ||
    /cf-turnstile-response|请验证您是真人|verify you are human|security verification|checking your browser/i.test(haystack)
  );
}

export async function readFranceTlsBrowserState(page: Page): Promise<FranceTlsBrowserStateInput> {
  return {
    url: page.url(),
    title: await page.title().catch(() => ""),
    bodyText: await page.locator("body").innerText({ timeout: 5_000 }).catch(() => ""),
    frameUrls: page.frames().map((frame) => frame.url()),
  };
}

export async function solveFranceTlsProviderCaptcha(page: Page): Promise<FranceTlsProviderCaptchaSolveResult> {
  const beforeState = await readFranceTlsBrowserState(page).catch(() => ({
    url: page.url(),
    title: "",
    bodyText: "",
    frameUrls: page.frames().map((frame) => frame.url()),
  }));
  const detectedChallenge = hasFranceTlsCloudflareChallenge(beforeState);
  if (!detectedChallenge) {
    return { attempted: false, detectedChallenge: false, status: "no_challenge", tokenPresent: false };
  }

  let session: CDPSession | null = null;
  try {
    session = await page.context().newCDPSession(page);
    const send = session.send.bind(session) as unknown as (method: string, params?: Record<string, unknown>) => Promise<unknown>;
    await send("Captcha.setAutoSolve", { autoSolve: true }).catch(() => undefined);

    const trySolve = async (params: Record<string, unknown>): Promise<unknown | null> =>
      send("Captcha.solve", params).catch(() => null);

    const solveParams: Array<Record<string, unknown>> = [
      { detectTimeout: 90_000, options: [{ type: "cf_turnstile" }, { type: "turnstile" }] },
      { detectTimeout: 90_000 },
    ];

    let result: unknown | null = null;
    for (const params of solveParams) {
      result = await trySolve(params);
      if (result) break;
      await page.waitForTimeout(1_000);
    }
    if (!result) {
      result = await send("Captcha.waitForSolve", { detectTimeout: 90_000 }).catch(() => null);
    }

    const status = typeof result === "object" && result && "status" in result
      ? String((result as { status?: unknown }).status ?? "unknown")
      : result
        ? "unknown"
        : "unavailable";

    const tokenPresent = await page
      .locator("input[name='cf-turnstile-response'], textarea[name='cf-turnstile-response']")
      .first()
      .inputValue()
      .catch(() => "")
      .then((value) => Boolean(value.trim()))
      .catch(() => false);

    if (!tokenPresent && /solve_finished|finished|success|solved/i.test(status) && !/failed|invalid/i.test(status)) {
      await page.waitForTimeout(2_000);
    }

    const tokenAfterWait = tokenPresent || await page
      .locator("input[name='cf-turnstile-response'], textarea[name='cf-turnstile-response']")
      .first()
      .inputValue()
      .catch(() => "")
      .then((value) => Boolean(value.trim()))
      .catch(() => false);

    return { attempted: true, detectedChallenge: true, status, tokenPresent: tokenAfterWait };
  } catch (error) {
    return {
      attempted: true,
      detectedChallenge: true,
      status: error instanceof Error ? error.message.split("\n")[0] : String(error),
      tokenPresent: false,
    };
  } finally {
    await session?.detach().catch(() => undefined);
  }
}

export async function waitForFranceTlsCloudflareClearance(
  page: Page,
  options: { timeoutMs?: number; solveProviderCaptcha?: boolean } = {},
): Promise<FranceTlsBrowserState> {
  const deadline = Date.now() + (options.timeoutMs ?? 90_000);
  let providerSolveAttempted = false;

  while (Date.now() < deadline) {
    const state = classifyFranceTlsBrowserState(await readFranceTlsBrowserState(page));
    if (state.checkpoint !== "waf" && state.checkpoint !== "captcha_token") {
      return state;
    }
    if (!providerSolveAttempted && options.solveProviderCaptcha) {
      const input = await readFranceTlsBrowserState(page);
      if (hasFranceTlsCloudflareChallenge(input)) {
        providerSolveAttempted = true;
        await solveFranceTlsProviderCaptcha(page);
      }
    }
    await page.waitForTimeout(3_000);
  }

  return classifyFranceTlsBrowserState(await readFranceTlsBrowserState(page));
}
