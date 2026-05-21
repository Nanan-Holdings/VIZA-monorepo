/**
 * UKVI portal gate detection — maintenance pages, session timeouts,
 * unexpected error interstitials. Mirrors the CEAC gates pattern but
 * tuned to govuk-frontend's standard error pages.
 *
 * Detection is text-pattern based: govuk-frontend renders
 * server-side-rendered error pages with stable English copy. The
 * patterns here cover the "service unavailable" maintenance screen,
 * 5xx error pages, and the "session expired / sign in again" prompt.
 */

import type { Page } from "@playwright/test";
import { UkGateDetectedError, UkSessionExpiredError } from "./errors";

export type UkGateKind =
  | "service_unavailable"
  | "internal_error"
  | "rate_limited"
  | "session_expired";

export interface UkGateResult {
  gated: boolean;
  kind: UkGateKind | null;
  matchedPattern: string | null;
  visibleTextSnippet: string;
  url: string;
}

interface GatePattern {
  kind: UkGateKind;
  pattern: RegExp;
}

const GATE_PATTERNS: ReadonlyArray<GatePattern> = [
  { kind: "service_unavailable", pattern: /sorry,?\s*the service is unavailable/i },
  { kind: "service_unavailable", pattern: /this service is undergoing (planned )?maintenance/i },
  { kind: "internal_error",      pattern: /sorry,?\s*there is a problem with (the )?service/i },
  { kind: "internal_error",      pattern: /something went wrong/i },
  { kind: "rate_limited",        pattern: /too many requests|please try again later/i },
  { kind: "session_expired",     pattern: /your session has timed out|sign in again/i },
];

/** Probe the current page for known UKVI gate states. Never throws —
 *  caller decides whether to escalate. */
export async function detectGate(page: Page): Promise<UkGateResult> {
  const url = page.url();
  let visibleText = "";
  try {
    visibleText = await page.locator("body").innerText({ timeout: 5_000 });
  } catch {
    // best-effort
  }
  const visibleTextSnippet = visibleText.slice(0, 500);

  for (const { kind, pattern } of GATE_PATTERNS) {
    const m = visibleText.match(pattern);
    if (m) {
      return { gated: true, kind, matchedPattern: m[0], visibleTextSnippet, url };
    }
  }
  return { gated: false, kind: null, matchedPattern: null, visibleTextSnippet, url };
}

/** Throw the appropriate structured error if a gate is present.
 *  Session expired and other gates are distinct error types so retry
 *  logic can react differently. */
export async function assertNoGate(page: Page): Promise<void> {
  const r = await detectGate(page);
  if (!r.gated) return;

  const baseContext = {
    url: r.url,
    details: { matchedPattern: r.matchedPattern, snippet: r.visibleTextSnippet },
  };

  if (r.kind === "session_expired") {
    throw new UkSessionExpiredError("UKVI session expired", baseContext);
  }
  throw new UkGateDetectedError(`UKVI gate detected (${r.kind})`, {
    ...baseContext,
    details: { ...baseContext.details, gateKind: r.kind },
  });
}
