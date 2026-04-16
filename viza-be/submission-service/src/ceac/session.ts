/**
 * CEAC DS-160 session bootstrap.
 *
 * Launches a Chromium context, opens the CEAC start page, verifies the page
 * identity, and returns a `CeacSession` handle the rest of the worker can
 * use. Failures surface as structured `SessionBootstrapError` instances.
 */

import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { CEAC_URLS } from "./selectors";
import { assertPage, detectPage } from "./pages";
import { SessionBootstrapError } from "./errors";

export interface CeacSessionOptions {
  /** Headless mode for the underlying Chromium instance. Default: true. */
  headless?: boolean;
  /** Navigation timeout for initial page load (ms). Default: 60_000. */
  navigationTimeoutMs?: number;
  /**
   * Accept downloads from the browser context — required later for the
   * `.dat` save-to-file flow. Default: true.
   */
  acceptDownloads?: boolean;
  /** User agent override. CEAC is picky; leave unset unless diagnosing. */
  userAgent?: string;
  /** Optional run identifier for structured logging. */
  runId?: string;
}

export interface CeacSession {
  readonly browser: Browser;
  readonly context: BrowserContext;
  readonly page: Page;
  readonly runId?: string;
  /** Close the browser and release resources. Safe to call multiple times. */
  close(): Promise<void>;
}

/**
 * Launch a browser, navigate to the CEAC DS-160 start page, and verify that
 * we actually landed there. Callers receive the underlying Playwright
 * objects plus a `close()` helper.
 *
 * This function is intentionally narrow: it does **not** select embassies,
 * solve CAPTCHAs, or begin a new application. Those steps belong to
 * downstream helpers (US-003+) that build on this bootstrap.
 */
export async function startCeacSession(
  options: CeacSessionOptions = {},
): Promise<CeacSession> {
  const headless = options.headless ?? true;
  const navigationTimeoutMs = options.navigationTimeoutMs ?? 60_000;
  const acceptDownloads = options.acceptDownloads ?? true;

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    browser = await chromium.launch({ headless });
    context = await browser.newContext({
      acceptDownloads,
      userAgent: options.userAgent,
    });
    const page = await context.newPage();

    try {
      await page.goto(CEAC_URLS.START, {
        waitUntil: "networkidle",
        timeout: navigationTimeoutMs,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new SessionBootstrapError(
        `Failed to load CEAC start page within ${navigationTimeoutMs}ms`,
        {
          url: CEAC_URLS.START,
          details: { cause: message, runId: options.runId },
        },
      );
    }

    // Verify we landed somewhere sensible. The start page heading matches
    // "Welcome" / "Start an Application"; if the heading is something else
    // (e.g. an outage page) we want a structured failure, not a silent
    // continuation into field-fill code.
    try {
      await assertPage(page, "start");
    } catch (err) {
      // Re-probe once so the error context includes what we actually saw.
      const probe = await detectPage(page);
      throw new SessionBootstrapError(
        `CEAC start page identity check failed (detected "${probe.id}")`,
        {
          expected: "start",
          detected: probe.id,
          url: probe.url,
          details: {
            heading: probe.heading,
            cause: err instanceof Error ? err.message : String(err),
            runId: options.runId,
          },
        },
      );
    }

    const session: CeacSession = {
      browser,
      context,
      page,
      runId: options.runId,
      close: makeCloser(browser, context),
    };

    return session;
  } catch (err) {
    // Make sure we do not leak a browser if bootstrap fails mid-way.
    try {
      if (context) await context.close();
    } catch {
      // best-effort cleanup
    }
    try {
      if (browser) await browser.close();
    } catch {
      // best-effort cleanup
    }
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
    try {
      await context.close();
    } catch {
      // best-effort cleanup
    }
    try {
      await browser.close();
    } catch {
      // best-effort cleanup
    }
  };
}
