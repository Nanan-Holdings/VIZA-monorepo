/**
 * CEAC DS-160 session bootstrap.
 *
 * Launches a Chromium context, opens the CEAC start page, verifies the page
 * identity, and returns a `CeacSession` handle the rest of the worker can
 * use. Failures surface as structured `SessionBootstrapError` instances.
 */

import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { CEAC_GATE_MARKERS, CEAC_URLS } from "./selectors";
import { assertPage, detectPage } from "./pages";
import { ManualActionRequiredError, SessionBootstrapError } from "./errors";
import { assertNoGate } from "./gates";

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
  // Mutable: after a mid-orchestration SessionTimedOut we close and
  // rebuild the browser context, then swap these refs in place so that
  // the orchestrator's captured `session.page` keeps working.
  browser: Browser;
  context: BrowserContext;
  page: Page;
  readonly runId?: string;
  /**
   * Deprecated compatibility field. Live assisted CEAC must not use CAPTCHA
   * solving APIs; manual checkpoints replace automated telemetry.
   */
  captchaSolve?: { telemetry: Array<Record<string, unknown>> };
  /** Close the browser and release resources. Safe to call multiple times. */
  close(): Promise<void>;
}

/**
 * Launch a browser and navigate to the CEAC DS-160 start page.
 *
 * Compliant live assisted mode must not solve CAPTCHA or hide automation
 * signals. The CEAC start page normally requires a location selection and
 * CAPTCHA, so this helper surfaces that as ManualActionRequiredError instead
 * of trying to force through.
 *
 * Does **not** select embassies or begin a new application — those steps
 * belong to downstream helpers that build on this bootstrap.
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
    browser = await chromium.launch({
      headless,
    });
    context = await browser.newContext({
      acceptDownloads,
      ...(options.userAgent ? { userAgent: options.userAgent } : {}),
    });
    const page = await context.newPage();

    try {
      await page.goto(CEAC_URLS.START, {
        waitUntil: "domcontentloaded",
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

    // Check for anti-bot / captcha / manual-intervention gates BEFORE page
    // identity assertion. A gated page should surface as a structured gate
    // error, not as an "unexpected page" or "unknown page" failure.
    await assertNoGate(page);

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

    const captchaSelector = CEAC_GATE_MARKERS.solvableCaptchaSelectors.join(", ");
    const captchaPresent = captchaSelector
      ? (await page.locator(captchaSelector).count().catch(() => 0)) > 0
      : false;
    if (captchaPresent || /\/GenNIV\/Default\.aspx/i.test(page.url())) {
      throw new ManualActionRequiredError(
        captchaPresent ? "captcha" : "start_application",
        captchaPresent
          ? "CEAC requires a human to select the location and complete the start-page CAPTCHA. VIZA will not use CAPTCHA-solving APIs."
          : "CEAC start page requires a human checkpoint before starting a live DS-160 application.",
        {
          detected: "start",
          url: page.url(),
          details: {
            runId: options.runId,
            captchaPresent,
            checkpoint: "ceac_start",
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

/**
 * Rebuild a session's browser context in-place for mid-orchestration
 * recovery after CEAC invalidates the server-side session.
 *
 * Closes the current browser + context, launches a fresh stealth
 * browser, runs the normal start-page CAPTCHA bootstrap, then mutates
 * the passed session's refs so downstream code that already holds
 * `session.page` keeps working with the new browser state.
 *
 * Does NOT run the ConfirmApplicationID flow or the retrieve form —
 * that is the caller's responsibility (via `resume-application.ts`)
 * because the retrieve credentials live in the orchestrator, not here.
 */
export async function rebuildSessionForResume(
  session: CeacSession,
  options: CeacSessionOptions = {},
): Promise<void> {
  try { await session.close(); } catch { /* best-effort */ }
  const fresh = await startCeacSession({ ...options, runId: session.runId });
  // Swap in the new refs. Close function closes the NEW browser.
  session.browser = fresh.browser;
  session.context = fresh.context;
  session.page = fresh.page;
  session.captchaSolve = fresh.captchaSolve;
  (session as { close: () => Promise<void> }).close = fresh.close;
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
