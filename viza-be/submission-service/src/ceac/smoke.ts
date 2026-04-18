/**
 * CEAC smoke diagnostic entry point (US-014).
 *
 * Probes the CEAC DS-160 start page to determine runtime readiness. Reports
 * one of three machine-readable outcomes:
 *
 *   - `start_page` — CEAC start page loaded successfully; runtime is ready.
 *   - `anti_bot_gate` — an anti-bot / captcha / manual-intervention gate was
 *     detected; the worker cannot proceed without human intervention.
 *   - `blocked` — the page failed to load or did not match the expected start
 *     page identity; CEAC may be down or routing to an outage page.
 *
 * Usage (from repo root):
 *
 *   npx tsx viza-be/submission-service/src/ceac/smoke.ts
 *
 * The script exits with code 0 on `start_page`, 1 on `anti_bot_gate`, and
 * 2 on `blocked`. This makes it suitable for cron-based monitoring or CI
 * gate checks.
 */

import { chromium, type Browser, type Page } from "@playwright/test";
import { CEAC_URLS } from "./selectors";
import { detectPage } from "./pages";
import { detectGate, type GateDetectionResult } from "./gates";

export type SmokeOutcome = "start_page" | "anti_bot_gate" | "blocked";

export interface SmokeResult {
  /** Machine-readable outcome. */
  outcome: SmokeOutcome;
  /** ISO-8601 timestamp when the probe completed. */
  probedAt: string;
  /** URL the browser landed on. */
  url: string;
  /** Detected page identity (from page heading matching). */
  detectedPageId: string;
  /** Page heading text, if any. */
  heading: string | null;
  /** Gate detection details (only populated when a gate is detected). */
  gate: GateDetectionResult | null;
  /** Human-readable summary for operator logs. */
  summary: string;
  /** Error message if the probe failed with an exception. */
  error: string | null;
}

/**
 * Probe the CEAC DS-160 start page and return a structured diagnostic result.
 *
 * This function launches a fresh browser, navigates to the CEAC start page,
 * checks for anti-bot gates, and verifies page identity. It always cleans up
 * the browser before returning, even on failure.
 */
export async function probeCeacStartPage(options: {
  headless?: boolean;
  timeoutMs?: number;
} = {}): Promise<SmokeResult> {
  const headless = options.headless ?? true;
  const timeoutMs = options.timeoutMs ?? 60_000;

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto(CEAC_URLS.START, {
        waitUntil: "networkidle",
        timeout: timeoutMs,
      });
    } catch (err) {
      return {
        outcome: "blocked",
        probedAt: new Date().toISOString(),
        url: CEAC_URLS.START,
        detectedPageId: "unreachable",
        heading: null,
        gate: null,
        summary: `CEAC start page failed to load within ${timeoutMs}ms: ${err instanceof Error ? err.message : String(err)}`,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    // Check for anti-bot / captcha gates
    const gateResult = await detectGate(page);

    if (gateResult.gated) {
      return {
        outcome: "anti_bot_gate",
        probedAt: new Date().toISOString(),
        url: page.url(),
        detectedPageId: "gated",
        heading: null,
        gate: gateResult,
        summary: `Anti-bot gate detected (${gateResult.gateKind}). Matched patterns: [${gateResult.matchedTextPatterns.join(", ")}]. Matched selectors: [${gateResult.matchedCaptchaSelectors.join(", ")}].`,
        error: null,
      };
    }

    // Verify page identity
    const probe = await detectPage(page);

    if (probe.id === "start") {
      return {
        outcome: "start_page",
        probedAt: new Date().toISOString(),
        url: probe.url,
        detectedPageId: probe.id,
        heading: probe.heading,
        gate: null,
        summary: "CEAC start page loaded successfully. Runtime is ready.",
        error: null,
      };
    }

    // Page loaded but identity doesn't match expected start page
    return {
      outcome: "blocked",
      probedAt: new Date().toISOString(),
      url: probe.url,
      detectedPageId: probe.id,
      heading: probe.heading,
      gate: null,
      summary: `CEAC loaded but detected page "${probe.id}" instead of "start". Heading: "${probe.heading ?? "(none)"}". CEAC may be showing an outage or redirect page.`,
      error: null,
    };
  } catch (err) {
    return {
      outcome: "blocked",
      probedAt: new Date().toISOString(),
      url: CEAC_URLS.START,
      detectedPageId: "error",
      heading: null,
      gate: null,
      summary: `Smoke probe failed with error: ${err instanceof Error ? err.message : String(err)}`,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* best-effort cleanup */ }
    }
  }
}

// ─── CLI entry point ────────────────────────────────────────────────────────

const isMainModule =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("smoke.ts") || process.argv[1].endsWith("smoke.js"));

if (isMainModule) {
  const headless = !process.argv.includes("--headed");

  console.log("[smoke] Probing CEAC DS-160 start page...");
  console.log(`[smoke] Mode: ${headless ? "headless" : "headed"}`);
  console.log();

  probeCeacStartPage({ headless }).then((result) => {
    console.log(JSON.stringify(result, null, 2));
    console.log();
    console.log(`[smoke] Outcome: ${result.outcome}`);
    console.log(`[smoke] Summary: ${result.summary}`);

    const exitCode = result.outcome === "start_page" ? 0
      : result.outcome === "anti_bot_gate" ? 1
      : 2;
    process.exit(exitCode);
  });
}
