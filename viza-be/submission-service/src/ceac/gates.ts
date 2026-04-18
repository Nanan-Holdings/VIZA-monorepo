/**
 * CEAC anti-bot and manual-intervention gate detection (US-011).
 *
 * When CEAC detects automated traffic it may present a challenge page,
 * captcha interstitial, Cloudflare/WAF block, or other manual-intervention
 * gate before the DS-160 start page loads. This module detects those gates
 * explicitly so the worker reports "blocked" or "manual_required" instead of
 * retrying blindly or misclassifying the state as a generic unknown-page
 * failure.
 *
 * Detection is read-only — no attempt is made to solve captchas or bypass
 * gates. The goal is truthful detection and clean escalation to ops.
 */

import type { Page } from "@playwright/test";
import { CEAC_GATE_MARKERS } from "./selectors";
import { GateDetectedError, type CeacErrorContext } from "./errors";

/**
 * The type of gate detected on the page. Used to distinguish external CEAC
 * gating from genuine worker/runtime failure in retry and alert logic.
 */
export type CeacGateKind =
  | "captcha"
  | "anti_bot_text"
  | "captcha_and_text";

/**
 * Structured result from gate detection. Carries enough operator context
 * for diagnostics without requiring a screenshot.
 */
export interface GateDetectionResult {
  /** Whether a gate was detected. */
  gated: boolean;
  /** Classification of the gate, if detected. */
  gateKind: CeacGateKind | null;
  /** Visible page text snippets that matched anti-bot patterns. */
  matchedTextPatterns: string[];
  /** DOM selectors that matched captcha/challenge widgets. */
  matchedCaptchaSelectors: string[];
  /** First ~500 chars of visible page text for operator context. */
  visibleTextSnippet: string;
  /** Current page URL at detection time. */
  url: string;
}

/**
 * Probe the current page for anti-bot / captcha / manual-intervention gates.
 *
 * Detection uses two strategies:
 *   1. **Text matching** — scan visible page text (`innerText`) against
 *      `CEAC_GATE_MARKERS.textPatterns`.
 *   2. **Selector matching** — check DOM for captcha/challenge widget
 *      selectors from `CEAC_GATE_MARKERS.captchaSelectors`.
 *
 * Returns a structured result; never throws. Callers decide whether a
 * detected gate is an error or just informational.
 */
export async function detectGate(page: Page): Promise<GateDetectionResult> {
  const url = page.url();

  // Extract visible body text (innerText excludes hidden elements)
  let visibleText = "";
  try {
    visibleText = await page.locator("body").innerText({ timeout: 5_000 });
  } catch {
    // Page may not have a body yet or may be in a broken state
  }

  const visibleTextSnippet = visibleText.slice(0, 500);

  // Strategy 1: text pattern matching
  const matchedTextPatterns: string[] = [];
  for (const pattern of CEAC_GATE_MARKERS.textPatterns) {
    const match = visibleText.match(pattern);
    if (match) {
      matchedTextPatterns.push(match[0]);
    }
  }

  // Strategy 2: captcha/challenge selector matching
  const matchedCaptchaSelectors: string[] = [];
  for (const selector of CEAC_GATE_MARKERS.captchaSelectors) {
    try {
      const count = await page.locator(selector).count();
      if (count > 0) {
        matchedCaptchaSelectors.push(selector);
      }
    } catch {
      // Selector may be invalid for the current page state
    }
  }

  const hasCaptcha = matchedCaptchaSelectors.length > 0;
  const hasText = matchedTextPatterns.length > 0;
  const gated = hasCaptcha || hasText;

  let gateKind: CeacGateKind | null = null;
  if (hasCaptcha && hasText) {
    gateKind = "captcha_and_text";
  } else if (hasCaptcha) {
    gateKind = "captcha";
  } else if (hasText) {
    gateKind = "anti_bot_text";
  }

  return {
    gated,
    gateKind,
    matchedTextPatterns,
    matchedCaptchaSelectors,
    visibleTextSnippet,
    url,
  };
}

/**
 * Assert that the page is NOT gated. If a gate is detected, throws a
 * `GateDetectedError` with full diagnostic context so the worker can
 * surface the block to ops without retrying.
 *
 * Call this after navigation and before page-identity assertions in the
 * bootstrap flow — a gated page should never reach the "unknown page"
 * error path.
 */
export async function assertNoGate(page: Page): Promise<void> {
  const result = await detectGate(page);
  if (!result.gated) return;

  const context: CeacErrorContext = {
    url: result.url,
    details: {
      gateKind: result.gateKind,
      matchedTextPatterns: result.matchedTextPatterns,
      matchedCaptchaSelectors: result.matchedCaptchaSelectors,
      visibleTextSnippet: result.visibleTextSnippet,
    },
  };

  throw new GateDetectedError(
    `CEAC gate detected (${result.gateKind}): worker cannot proceed without manual intervention`,
    context,
  );
}

/**
 * Type guard: is this error a gate-detection error? Useful for retry policy
 * to distinguish external CEAC gating (should not retry) from transient
 * worker failures (may retry).
 */
export function isGateError(err: unknown): err is GateDetectedError {
  return err instanceof GateDetectedError;
}
