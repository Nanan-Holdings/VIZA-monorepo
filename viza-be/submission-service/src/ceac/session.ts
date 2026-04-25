/**
 * CEAC DS-160 session bootstrap.
 *
 * Launches a Chromium context, opens the CEAC start page, verifies the page
 * identity, and returns a `CeacSession` handle the rest of the worker can
 * use. Failures surface as structured `SessionBootstrapError` instances.
 */

import type { Browser, BrowserContext, Page } from "@playwright/test";
import { CEAC_URLS } from "./selectors";
import { assertPage, detectPage } from "./pages";
import { SessionBootstrapError } from "./errors";
import { assertNoGate } from "./gates";
import { solveStartPageCaptchaWithRetry, type CaptchaSolveWithTelemetry } from "./start-page-captcha";
import { launchStealthBrowser } from "./stealth-browser";

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
  /** CAPTCHA solve result and telemetry from session bootstrap, if a CAPTCHA was present. */
  captchaSolve?: CaptchaSolveWithTelemetry;
  /** Close the browser and release resources. Safe to call multiple times. */
  close(): Promise<void>;
}

/**
 * Launch a browser, navigate to the CEAC DS-160 start page, solve the
 * start-page image CAPTCHA (if present), and return a session handle.
 *
 * After this function returns, the page has advanced past the start/CAPTCHA
 * surface. The CAPTCHA solve result (if any) is available on `session.captchaSolve`.
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
    // Launch with puppeteer-extra-plugin-stealth applied. CEAC fingerprints
    // automation via UA, client hints, `navigator.webdriver`, and numerous
    // JS-surface tells (plugins/chrome-runtime/WebGL/permissions). The
    // stealth bundle patches those at once; see `stealth-browser.ts`.
    const handles = await launchStealthBrowser({
      headless,
      acceptDownloads,
      userAgent: options.userAgent,
    });
    browser = handles.browser;
    context = handles.context;
    const page = handles.page;

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

    // ── CAPTCHA solve (US-023) ──────────────────────────────────────────
    // The CEAC start page contains a solvable image CAPTCHA that must be
    // completed before the worker can click "Start an Application" and
    // advance to the DS-160 form pages. Solve it here so downstream code
    // receives a session that is already past the start/CAPTCHA surface.
    //
    // Seam: AFTER assertPage("start") confirms page identity, BEFORE the
    // session is returned to callers. The solver clicks the continue/start
    // button as part of submission, advancing the page on success.
    //
    // If no CAPTCHA is present (e.g. resumed session), this is a no-op.
    // On failure after retries, throws SessionBootstrapError.
    let captchaSolve: CaptchaSolveWithTelemetry | undefined;
    try {
      // 10 attempts per session: 2captcha's BotDetect accuracy on the
      // CEAC CAPTCHA is roughly 20–40% per solve and varies by image.
      // 10 tries yields ≥90% session-level success; bad solves are
      // reported for refund so the marginal cost of extra attempts is
      // effectively zero.
      const result = await solveStartPageCaptchaWithRetry(page, 10);
      // A non-empty solveId means a real CAPTCHA was solved
      if (result.solve.solveId) {
        captchaSolve = result;
      }
    } catch (err) {
      // solveStartPageCaptchaWithRetry already throws SessionBootstrapError
      // on exhausted retries or hard failures — re-throw as-is.
      throw err;
    }

    const session: CeacSession = {
      browser,
      context,
      page,
      runId: options.runId,
      captchaSolve,
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
