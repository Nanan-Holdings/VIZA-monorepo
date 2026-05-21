/**
 * France-Visas session handle.
 *
 * Thin aggregate that carries everything downstream modules (navigator,
 * orchestrator, checkpoints) need to operate a page: the Playwright
 * browser/context/page plus lifecycle helpers.
 *
 * Construction is handled by sign-in.ts (`restoreFvSession`,
 * `signInWithPassword`) and registration.ts (`registerFvAccount`); this
 * file only defines the shape so imports stay narrow.
 */

import type { Browser, BrowserContext, Page } from "@playwright/test";
import type { FvCaptchaSolveWithTelemetry } from "./registration-captcha";

export interface FvSession {
  readonly browser: Browser;
  readonly context: BrowserContext;
  readonly page: Page;
  readonly runId?: string;
  /** CAPTCHA telemetry captured during session bootstrap, if any. */
  readonly captchaSolve?: FvCaptchaSolveWithTelemetry;
  /** Close browser and release resources. Safe to call multiple times. */
  close(): Promise<void>;
}

/**
 * Build the `close` callback once per session. CEAC uses the same pattern
 * in session.ts — extracted here so registration / sign-in can share it.
 */
export function makeSessionCloser(
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
      // best-effort
    }
    try {
      await browser.close();
    } catch {
      // best-effort
    }
  };
}
