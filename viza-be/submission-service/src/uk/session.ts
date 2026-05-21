/**
 * UK Standard Visitor visa session bootstrap.
 *
 * Reuses the CEAC stealth browser (same anti-bot patches apply to UKVI).
 * Navigates to the language selection page and verifies we landed on the
 * real first step of the visa flow rather than a redirect/outage page.
 */

import type { Browser, BrowserContext, Page } from "@playwright/test";
import { launchStealthBrowser } from "../ceac/stealth-browser";
import { UK_URLS } from "./selectors";
import { assertPage } from "./pages";
import { assertNoGate } from "./gates";
import { UkSessionBootstrapError } from "./errors";

export interface UkSessionOptions {
  headless?: boolean;
  navigationTimeoutMs?: number;
  userAgent?: string;
  runId?: string;
}

export interface UkSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  readonly runId?: string;
  close(): Promise<void>;
}

export async function startUkSession(
  options: UkSessionOptions = {},
): Promise<UkSession> {
  const headless = options.headless ?? true;
  const navigationTimeoutMs = options.navigationTimeoutMs ?? 60_000;

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    const handles = await launchStealthBrowser({
      headless,
      acceptDownloads: true,
      userAgent: options.userAgent,
    });
    browser = handles.browser;
    context = handles.context;
    const page = handles.page;

    try {
      await page.goto(UK_URLS.LANGUAGE_SELECTION, {
        waitUntil: "domcontentloaded",
        timeout: navigationTimeoutMs,
      });
    } catch (err) {
      throw new UkSessionBootstrapError(
        `Failed to load UKVI language page within ${navigationTimeoutMs}ms`,
        {
          url: UK_URLS.LANGUAGE_SELECTION,
          details: { cause: err instanceof Error ? err.message : String(err), runId: options.runId },
        },
      );
    }

    // Surface maintenance / 5xx / rate-limit gates BEFORE the page-identity
    // check — gated pages would otherwise fail as "unknown identity".
    await assertNoGate(page);
    await assertPage(page, "language_selection");

    return {
      browser,
      context,
      page,
      runId: options.runId,
      close: makeCloser(browser, context),
    };
  } catch (err) {
    try { if (context) await context.close(); } catch { /* best-effort */ }
    try { if (browser) await browser.close(); } catch { /* best-effort */ }
    throw err;
  }
}

function makeCloser(
  browser: Browser,
  context: BrowserContext,
): () => Promise<void> {
  let closed = false;
  return async () => {
    if (closed) return;
    closed = true;
    try { await context.close(); } catch { /* best-effort */ }
    try { await browser.close(); } catch { /* best-effort */ }
  };
}
