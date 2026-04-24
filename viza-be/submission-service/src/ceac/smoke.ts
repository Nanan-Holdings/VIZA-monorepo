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

import "dotenv/config";
import type { Browser } from "@playwright/test";
import { CEAC_URLS } from "./selectors";
import { detectPage } from "./pages";
import { detectGate, type GateDetectionResult } from "./gates";
import { solveStartPageCaptcha, type StartPageCaptchaOutcome } from "./start-page-captcha";
import { launchStealthBrowser } from "./stealth-browser";

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
    const handles = await launchStealthBrowser({ headless });
    browser = handles.browser;
    const page = handles.page;

    try {
      await page.goto(CEAC_URLS.START, {
        waitUntil: "domcontentloaded",
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

// ---------------------------------------------------------------------------
// CAPTCHA solve smoke test (--solve-captcha)
// ---------------------------------------------------------------------------

export interface CaptchaSmokeResult {
  /** Whether the solver reached a post-CAPTCHA surface. */
  reachedPostCaptcha: boolean;
  /** CAPTCHA solve outcome from solveStartPageCaptcha(). */
  captchaOutcome: StartPageCaptchaOutcome;
  /** Page identity after the solve attempt. */
  postSolvePageId: string;
  /** URL the browser landed on after the solve attempt. */
  postSolveUrl: string;
  /** Page heading text after the solve attempt (makes the reached surface explicit). */
  postSolveHeading: string | null;
  /** ISO-8601 timestamp. */
  probedAt: string;
  /** Human-readable summary. */
  summary: string;
  /** Error message if the probe failed with an exception. */
  error: string | null;
}

/**
 * Exercise the CAPTCHA solver against the live CEAC start page.
 * Reports whether it reached a post-CAPTCHA surface.
 */
export async function probeCaptchaSolve(options: {
  headless?: boolean;
  timeoutMs?: number;
} = {}): Promise<CaptchaSmokeResult> {
  const headless = options.headless ?? true;
  const timeoutMs = options.timeoutMs ?? 60_000;

  let browser: Browser | null = null;

  try {
    // Match the stealth config used in production session bootstrap so the
    // smoke test exercises the same fingerprint CEAC will see at runtime.
    const handles = await launchStealthBrowser({ headless });
    browser = handles.browser;
    const page = handles.page;

    await page.goto(CEAC_URLS.START, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

    const outcome = await solveStartPageCaptcha(page);
    const postProbe = await detectPage(page);

    const reachedPostCaptcha =
      outcome.status === "solved" ||
      outcome.status === "no_captcha" ||
      (postProbe.id !== "start" && postProbe.id !== "unknown");

    return {
      reachedPostCaptcha,
      captchaOutcome: outcome,
      postSolvePageId: postProbe.id,
      postSolveUrl: postProbe.url,
      postSolveHeading: postProbe.heading,
      probedAt: new Date().toISOString(),
      summary: reachedPostCaptcha
        ? `CAPTCHA solved. Post-solve page: ${postProbe.id}. Heading: ${JSON.stringify(postProbe.heading)}. URL: ${postProbe.url}`
        : `CAPTCHA NOT solved. Status: ${outcome.status}. Still on: ${postProbe.id}. Heading: ${JSON.stringify(postProbe.heading)}. URL: ${postProbe.url}`,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      reachedPostCaptcha: false,
      captchaOutcome: { status: "failed", reason: message },
      postSolvePageId: "error",
      postSolveUrl: CEAC_URLS.START,
      postSolveHeading: null,
      probedAt: new Date().toISOString(),
      summary: `CAPTCHA smoke failed: ${message}`,
      error: message,
    };
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* best-effort */ }
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
  const solveCaptcha = process.argv.includes("--solve-captcha");

  if (solveCaptcha) {
    console.log("[smoke] CAPTCHA solve mode — exercising 2captcha solver against live start page...");
    console.log(`[smoke] Mode: ${headless ? "headless" : "headed"}`);
    console.log();

    probeCaptchaSolve({ headless }).then((result) => {
      console.log(JSON.stringify(result, null, 2));
      console.log();
      console.log(`[smoke] Reached post-CAPTCHA: ${result.reachedPostCaptcha}`);
      console.log(`[smoke] Summary: ${result.summary}`);
      process.exit(result.reachedPostCaptcha ? 0 : 1);
    });
  } else {
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
}
