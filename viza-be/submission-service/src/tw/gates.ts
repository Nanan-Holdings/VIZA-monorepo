/**
 * coa.immigration.gov.tw gate detection — maintenance pages, 5xx error
 * interstitials, rate limiting. Mirrors src/uk/gates.ts, but the portal is
 * Chinese-language (National Immigration Agency), so patterns are bilingual
 * (Traditional Chinese first, English fallback for generic infra error
 * pages e.g. nginx/502 templates some gov sites front with).
 *
 * TODO(verify against live site): these phrases have not been observed on
 * an actual coa.immigration.gov.tw outage — they're a best-effort set based
 * on common Taiwanese government-portal maintenance copy. Tighten/replace
 * once a real gate page is captured.
 */

import type { Page } from "@playwright/test";
import { TwGateDetectedError } from "./errors";

export type TwGateKind = "service_unavailable" | "internal_error" | "rate_limited" | "session_expired";

export interface TwGateResult {
  gated: boolean;
  kind: TwGateKind | null;
  matchedPattern: string | null;
  visibleTextSnippet: string;
  url: string;
}

interface GatePattern {
  kind: TwGateKind;
  pattern: RegExp;
}

const GATE_PATTERNS: ReadonlyArray<GatePattern> = [
  { kind: "service_unavailable", pattern: /系統(?:維護|升級)中|網站(?:維護|升級)|服務暫停|暫停服務/i },
  { kind: "service_unavailable", pattern: /sorry,?\s*the service is (currently )?unavailable/i },
  { kind: "internal_error", pattern: /系統(?:發生)?錯誤|發生錯誤，請稍後再試|500\s*internal server error/i },
  { kind: "internal_error", pattern: /something went wrong|internal server error/i },
  { kind: "rate_limited", pattern: /請稍後(?:再試|再嘗試)|操作(?:過於)?頻繁|too many requests/i },
  { kind: "session_expired", pattern: /(?:連線|工作階段|session)(?:已)?逾時|請重新登入|your session has (?:timed out|expired)/i },
];

/** Probe the current page for known coa.immigration.gov.tw gate states.
 *  Never throws — caller decides whether to escalate. */
export async function detectGate(page: Page): Promise<TwGateResult> {
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

/** Throw a structured error if a gate is present. */
export async function assertNoGate(page: Page): Promise<void> {
  const r = await detectGate(page);
  if (!r.gated) return;
  throw new TwGateDetectedError(`coa.immigration.gov.tw gate detected (${r.kind})`, {
    url: r.url,
    details: { matchedPattern: r.matchedPattern, snippet: r.visibleTextSnippet, gateKind: r.kind },
  });
}
