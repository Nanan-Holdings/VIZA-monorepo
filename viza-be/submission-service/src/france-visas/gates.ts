/**
 * France-Visas anti-bot / blocking-gate detection.
 *
 * The Keycloak registration CAPTCHA is SOLVABLE and handled by
 * registration-captcha.ts. This module detects only unsolvable gates —
 * rate limits, WAF challenges, Cloudflare interstitials — so the worker
 * fails fast with a structured error instead of retrying blindly.
 */

import type { Page } from "@playwright/test";
import { FV_GATE_MARKERS } from "./selectors";
import { GateDetectedError, type FvErrorContext } from "./errors";

export type FvGateKind = "captcha" | "anti_bot_text" | "captcha_and_text";

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
  for (const selector of FV_GATE_MARKERS.blockingCaptchaSelectors) {
    try {
      const count = await page.locator(selector).count();
      if (count > 0) matchedCaptchaSelectors.push(selector);
    } catch {
      // Invalid selector for the current DOM — ignore.
    }
  }

  const hasCaptcha = matchedCaptchaSelectors.length > 0;
  const hasText = matchedTextPatterns.length > 0;
  const gated = hasCaptcha || hasText;

  let gateKind: FvGateKind | null = null;
  if (hasCaptcha && hasText) gateKind = "captcha_and_text";
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

export async function assertNoGate(page: Page): Promise<void> {
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
