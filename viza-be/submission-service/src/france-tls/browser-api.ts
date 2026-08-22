import { type Browser, type CDPSession, type Page } from "@playwright/test";
import {
  browserbaseEnabled,
  connectBrowserbaseCloudBrowser,
} from "../browserbase-session";

export type FranceTlsBrowserProvider = "browserbase";

export interface FranceTlsBrowserSession {
  browser: Browser;
  page: Page;
  provider: FranceTlsBrowserProvider;
  source: string;
}

/**
 * Close the Browserbase TLS session within a bounded local wait. Browserbase
 * also enforces the country-scoped session timeout if the CDP close handshake
 * is interrupted.
 */
export async function closeFranceTlsBrowserSession(
  session: FranceTlsBrowserSession,
  timeoutMs = 10_000,
): Promise<void> {
  // Browser.close owns context teardown. Closing contexts one-by-one can hang
  // indefinitely on a WAF page before the browser connection is released.
  const closePromise = session.browser.close().catch(() => undefined);

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  await Promise.race([
    closePromise.then(() => false),
    new Promise<true>((resolve) => {
      timeoutHandle = setTimeout(() => resolve(true), Math.max(1, timeoutMs));
    }),
  ]);
  if (timeoutHandle) clearTimeout(timeoutHandle);
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

export interface FranceTlsBrowserSelection {
  kind: "browserbase";
  source: "FRANCE_TLS_BROWSERBASE_ENABLED";
}

/**
 * Mainland-China France TLScontact is Browserbase-only. Explicitly disabling
 * Browserbase fails closed; country/global CDP and local Chromium are ignored.
 */
export function resolveFranceTlsBrowserSelection(): FranceTlsBrowserSelection {
  if (!browserbaseEnabled("FRANCE_TLS", true)) {
    throw new Error(
      "France TLScontact requires Browserbase; FRANCE_TLS_BROWSERBASE_ENABLED cannot be false.",
    );
  }
  return { kind: "browserbase", source: "FRANCE_TLS_BROWSERBASE_ENABLED" };
}

export async function createFranceTlsBrowserSession(): Promise<FranceTlsBrowserSession> {
  const selection = resolveFranceTlsBrowserSelection();
  const cloud = await connectBrowserbaseCloudBrowser({ prefix: "FRANCE_TLS" });
  return {
    browser: cloud.browser,
    page: cloud.page,
    provider: "browserbase",
    source: selection.source,
  };
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
  if (/just a moment|un\s+instant|cloudflare|security verification|verification de securite|vérification de sécurité|verify you are not a bot|verify you are human|checking your browser|cf-chl|ray\s*id|access denied|attention required/i.test(haystack)) {
    return {
      checkpoint: "waf",
      message: "TLScontact is showing Cloudflare/WAF security verification.",
      hasRecaptchaGrid,
      hasRecaptchaAnchor,
    };
  }
  if (/^https?:\/\//i.test(input.url) && !input.title.trim() && !body) {
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
  const realPageUrl = /(?:tlscontact\.com|i2-auth\.visas-fr\.tlscontact\.com)/i.test(input.url)
    && /\/(?:en-[a-z]{2}|fr-[a-z]{2})\/(?:login|registration|register|country|workflow|travel-groups|appointment|calendar|account|dashboard)/i.test(input.url);
  const realPageText = /tlscontact|visa application|application process|book an appointment|rendez-vous|sign in|log in|register|registration|travel group|applicant|calendar|appointment|cr[ée]neau|visa application centre|select your visa application centre/i.test(`${input.title} ${body}`);
  if (!realPageUrl && !realPageText) {
    return {
      checkpoint: "site_policy_review",
      message: "TLScontact returned a non-empty page that is not a recognized login, account, center, or appointment page.",
      hasRecaptchaGrid,
      hasRecaptchaAnchor,
    };
  }
  return {
    checkpoint: "ready",
    message: "TLScontact recognized official page content is visible.",
    hasRecaptchaGrid,
    hasRecaptchaAnchor,
  };
}

export function hasFranceTlsCloudflareChallenge(input: FranceTlsBrowserStateInput): boolean {
  const haystack = `${input.title} ${input.url} ${input.bodyText}`.toLowerCase();
  return (
    input.frameUrls.some((url) => /challenges\.cloudflare\.com|cf-chl|turnstile/i.test(url)) ||
    /cf-turnstile-response|请验证您是真人|verify you are human|security verification|verification de securite|vérification de sécurité|checking your browser|un\s+instant|ray\s*id/i.test(haystack)
  );
}

export function isFranceTlsCaptchaBlocking(
  input: FranceTlsBrowserStateInput,
  state = classifyFranceTlsBrowserState(input),
): boolean {
  if (state.checkpoint === "captcha_grid") return true;
  if (state.checkpoint !== "captcha_token") return false;
  if (hasFranceTlsCloudflareChallenge(input)) return true;
  return /complete\s+(?:the\s+)?recaptcha|need to complete recaptcha|recaptcha\s+(?:is\s+)?(?:required|failed)|please.{0,40}recaptcha/i
    .test(input.bodyText.replace(/\s+/g, " "));
}

export function shouldWaitForFranceTlsCloudflareClearance(
  input: FranceTlsBrowserStateInput,
  state = classifyFranceTlsBrowserState(input),
): boolean {
  if (state.checkpoint === "waf") return true;
  return state.checkpoint === "captcha_token" && hasFranceTlsCloudflareChallenge(input);
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
    const input = await readFranceTlsBrowserState(page);
    const state = classifyFranceTlsBrowserState(input);
    if (!shouldWaitForFranceTlsCloudflareClearance(input, state)) {
      return state;
    }
    if (!providerSolveAttempted && options.solveProviderCaptcha) {
      if (hasFranceTlsCloudflareChallenge(input)) {
        providerSolveAttempted = true;
        await solveFranceTlsProviderCaptcha(page);
      }
    }
    await page.waitForTimeout(3_000);
  }

  return classifyFranceTlsBrowserState(await readFranceTlsBrowserState(page));
}
