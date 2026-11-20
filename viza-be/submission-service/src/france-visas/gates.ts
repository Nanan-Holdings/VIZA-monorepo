/**
 * France-Visas anti-bot / blocking-gate detection.
 *
 * France live-assisted mode does not solve CAPTCHA. This module detects
 * CAPTCHA/manual gates plus anti-bot interstitials so the worker can stop
 * with a structured manual checkpoint instead of retrying blindly.
 */

import type { Page } from "@playwright/test";
import { FV_GATE_MARKERS } from "./selectors";
import { GateDetectedError, type FvErrorContext } from "./errors";
import { classifyFranceVisasBrowserState } from "./browser";

export type FvGateKind = "captcha" | "anti_bot_text" | "captcha_and_text" | "waf" | "blank_page" | "unknown_page";

export interface GateDetectionResult {
  gated: boolean;
  gateKind: FvGateKind | null;
  matchedTextPatterns: string[];
  matchedCaptchaSelectors: string[];
  visibleTextSnippet: string;
  url: string;
}

export async function detectGate(page: Page): Promise<GateDetectionResult> {
  const url = page.url();

  let title = "";
  try {
    title = await page.title();
  } catch {
    // Navigation may still be settling; body/URL markers remain useful.
  }

  let visibleText = "";
  try {
    visibleText = await page.locator("body").innerText({ timeout: 5_000 });
  } catch {
    // Page not yet interactable
  }

  const visibleTextSnippet = visibleText.slice(0, 500);

  const matchedTextPatterns: string[] = [];
  for (const pattern of FV_GATE_MARKERS.textPatterns) {
    const match = visibleText.match(pattern);
    if (match) matchedTextPatterns.push(match[0]);
  }

  const matchedCaptchaSelectors: string[] = [];
  for (const selector of [
    ...FV_GATE_MARKERS.manualCaptchaSelectors,
    ...FV_GATE_MARKERS.blockingCaptchaSelectors,
  ]) {
    try {
      const count = await page.locator(selector).count();
      if (count > 0) matchedCaptchaSelectors.push(selector);
    } catch {
      // Invalid selector for the current DOM — ignore.
    }
  }

  const hasCaptcha = matchedCaptchaSelectors.length > 0;
  const hasText = matchedTextPatterns.length > 0;
  const security = classifyFranceVisasBrowserState({
    url,
    title,
    bodyText: visibleText,
  });
  if (security.checkpoint === "waf") matchedTextPatterns.push("Cloudflare/WAF security checkpoint");
  if (security.checkpoint === "blank") matchedTextPatterns.push("blank official page");
  if (security.checkpoint === "unknown") matchedTextPatterns.push("unrecognized official page");
  const hasSecurityCheckpoint = security.checkpoint !== "ready";
  const gated = hasCaptcha || hasText || hasSecurityCheckpoint;

  let gateKind: FvGateKind | null = null;
  if (security.checkpoint === "blank") gateKind = "blank_page";
  else if (security.checkpoint === "waf") gateKind = "waf";
  else if (security.checkpoint === "unknown") gateKind = "unknown_page";
  else if (hasCaptcha && hasText) gateKind = "captcha_and_text";
  else if (hasCaptcha) gateKind = "captcha";
  else if (hasText) gateKind = "anti_bot_text";

  return {
    gated,
    gateKind,
    matchedTextPatterns,
    matchedCaptchaSelectors,
    visibleTextSnippet,
    url,
  };
}

/** How long a France-Visas page may take to render before it is judged. */
export const ENTRY_RENDER_TIMEOUT_MS = 30_000;

/** Resolve once the page has a title or visible text, or after `timeoutMs`. */
export async function waitForRenderedPage(page: Page, timeoutMs: number): Promise<void> {
  await page
    .waitForFunction(
      `(() => Boolean(document.title.trim()) || Boolean(document.body && document.body.innerText.trim()))()`,
      undefined,
      { timeout: timeoutMs, polling: 250 },
    )
    .catch(() => undefined);
}

export async function assertNoGate(page: Page): Promise<void> {
  // Through the remote browser France-Visas pages (login, registration) stay
  // empty for several seconds after their HTML arrives. Judge a page only
  // once it has rendered; one still blank after this is a real gate.
  await waitForRenderedPage(page, ENTRY_RENDER_TIMEOUT_MS);
  const result = await detectGate(page);
  if (!result.gated) return;

  const context: FvErrorContext = {
    url: result.url,
    details: {
      gateKind: result.gateKind,
      matchedTextPatterns: result.matchedTextPatterns,
      matchedCaptchaSelectors: result.matchedCaptchaSelectors,
      visibleTextSnippet: result.visibleTextSnippet,
    },
  };

  throw new GateDetectedError(
    `France-Visas gate detected (${result.gateKind}): worker cannot proceed`,
    context,
  );
}

export function isGateError(err: unknown): err is GateDetectedError {
  return err instanceof GateDetectedError;
}
