/**
 * Taiwan Online Entry Permit session bootstrap.
 *
 * Reuses the shared stealth browser (same one src/uk uses) and navigates to
 * the real official entry point:
 * https://coa.immigration.gov.tw/coa-frontend/overseas-foreign-china
 *
 * Unlike UK/France/Australia there is no persistent portal account and no
 * multi-day resume — every run starts a fresh browser session at this URL,
 * clicks through "我要申請" + the terms modal, and walks the single
 * continuous "遞送地點" → "申請表" flow (see src/tw/apply.ts).
 *
 * TODO(proxy egress — unconfirmed, low priority per the design doc):
 * whether coa.immigration.gov.tw geo-restricts non-Taiwan egress IPs has not
 * been tested. This intentionally does NOT wire up UK-style residential
 * proxy egress (src/uk/proxy-egress.ts) — default is a plain local-IP
 * launch. If live runs get blocked/redirected, revisit and add a Taiwan-
 * specific egress module then, rather than guessing a policy now.
 */

import type { Browser, BrowserContext, Page } from "@playwright/test";
import { launchStealthBrowser } from "../ceac/stealth-browser";
import {
  connectBrowserbaseCloudBrowser,
  browserbaseEnabled,
  getBrowserbaseLiveViewUrl,
} from "../browserbase-session";
import { assertNoGate } from "./gates";
import { TwSessionBootstrapError } from "./errors";

export const TW_URLS = {
  /** Real official entry point (境外人士線上申辦系統). */
  START: "https://coa.immigration.gov.tw/coa-frontend/overseas-foreign-china",
  /** CAPTCHA image endpoint — informational only, used by fillers.ts to
   *  detect the halt boundary, never fetched/solved here. */
  CAPTCHA_IMAGE_PATH: "/coa-frontend/captcha",
} as const;

export interface TwSessionOptions {
  headless?: boolean;
  navigationTimeoutMs?: number;
  userAgent?: string;
  runId?: string;
  applicantHandoff?: boolean;
  handoffTimeoutSeconds?: number;
}

export interface TwSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  readonly runId?: string;
  readonly handoff?: {
    provider: "browserbase";
    sessionId: string;
    liveViewUrl: string;
    expiresAt: string;
  };
  close(): Promise<void>;
}

export async function startTwSession(options: TwSessionOptions = {}): Promise<TwSession> {
  const headless = options.headless ?? true;
  const navigationTimeoutMs = options.navigationTimeoutMs ?? 60_000;

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    const timeoutSeconds = options.handoffTimeoutSeconds ?? 1_800;
    if (options.applicantHandoff && !browserbaseEnabled("TW_ENTRY_PERMIT")) {
      throw new TwSessionBootstrapError(
        "TW_ENTRY_PERMIT_BROWSERBASE_ENABLED must be true for applicant live handoff",
        { url: TW_URLS.START, details: { runId: options.runId } },
      );
    }
    const cloud = options.applicantHandoff
      ? await connectBrowserbaseCloudBrowser({
          prefix: "TW_ENTRY_PERMIT",
          keepAlive: true,
          timeoutSeconds,
        })
      : null;
    const handles = cloud ?? await launchStealthBrowser({
      headless,
      acceptDownloads: false,
      userAgent: options.userAgent,
      residentialProxy: false,
    });
    browser = handles.browser;
    context = handles.context;
    const page = handles.page;

    try {
      await page.goto(TW_URLS.START, { waitUntil: "domcontentloaded", timeout: navigationTimeoutMs });
    } catch (err) {
      throw new TwSessionBootstrapError(
        `Failed to load coa.immigration.gov.tw start page within ${navigationTimeoutMs}ms`,
        {
          url: TW_URLS.START,
          details: { cause: err instanceof Error ? err.message : String(err), runId: options.runId },
        },
      );
    }

    await assertNoGate(page);

    const handoff = cloud ? {
      provider: "browserbase" as const,
      sessionId: cloud.sessionId,
      liveViewUrl: await getBrowserbaseLiveViewUrl(cloud.sessionId),
      expiresAt: new Date(Date.now() + timeoutSeconds * 1_000).toISOString(),
    } : undefined;

    return {
      browser,
      context,
      page,
      runId: options.runId,
      ...(handoff ? { handoff } : {}),
      close: makeCloser(browser, context),
    };
  } catch (err) {
    try {
      if (context) await context.close();
    } catch {
      /* best-effort */
    }
    try {
      if (browser) await browser.close();
    } catch {
      /* best-effort */
    }
    throw err;
  }
}

function makeCloser(browser: Browser, context: BrowserContext): () => Promise<void> {
  let closed = false;
  return async () => {
    if (closed) return;
    closed = true;
    try {
      await context.close();
    } catch {
      /* best-effort */
    }
    try {
      await browser.close();
    } catch {
      /* best-effort */
    }
  };
}
