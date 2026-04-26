/**
 * Vietnam e-Visa autofill runner.
 *
 * Drives the evisa.gov.vn application form from the landing page through to
 * the pre-payment review screen, then HALTS — per the user's stop-at-pay
 * constraint, the runner never clicks the final pay button. The user
 * completes payment manually on evisa.gov.vn using the captured
 * `registrationCode`. The actual e-visa PDF arrives via email ~3 working
 * days after payment is approved.
 *
 * Status of the implementation:
 *   - The recon scripts (form-recon.ts, form-recon-v3.ts) capture portal
 *     surface structure into vn-recon-out-v3/.
 *   - Field-level fillers + per-step navigation are PENDING the runner walk
 *     mirroring the france-visas/fill-steps.ts pattern.
 *   - Until that walk lands, this runner returns
 *     `{ status: "scaffold_pending" }` so the queue/result-writer plumbing
 *     stays consistent with the other countries.
 */

import type { Page } from "@playwright/test";
import { launchStealthBrowser } from "../ceac/stealth-browser";

export interface FillVietnamInput {
  /** Flat answers keyed by VN_E_VISA seed field_name. */
  answers: Record<string, string>;
}

export interface FillVietnamOptions {
  headless?: boolean;
  runId?: string;
  /** Per-step advance timeout (ms). Default 60s. */
  stepTimeoutMs?: number;
}

export type FillVietnamResult =
  | {
      status: "scaffolded_pending_walk";
      runId?: string;
      reason: string;
    }
  | {
      status: "submitted_pending_pay";
      runId?: string;
      registrationCode: string;
      submittedAtIso: string;
    }
  | {
      status: "failed";
      runId?: string;
      failedStep: string;
      error: Record<string, unknown> | null;
      url: string;
    };

const VN_LANDING_URL = "https://evisa.gov.vn/";

/**
 * Run one end-to-end Vietnam e-Visa autofill. The full per-step fill
 * implementation depends on the recon walk — this function currently
 * navigates to the form and returns `scaffolded_pending_walk` so the
 * processVnItem dispatch path can be exercised end-to-end.
 */
export async function fillVietnamApplication(
  _input: FillVietnamInput,
  options: FillVietnamOptions = {},
): Promise<FillVietnamResult> {
  const runId = options.runId;
  const headless = options.headless ?? true;
  let page: Page | null = null;
  let browser: Awaited<ReturnType<typeof launchStealthBrowser>>["browser"] | null = null;
  let context: Awaited<ReturnType<typeof launchStealthBrowser>>["context"] | null = null;

  try {
    const handles = await launchStealthBrowser({ headless, acceptDownloads: false });
    browser = handles.browser;
    context = handles.context;
    page = handles.page;

    await page.goto(VN_LANDING_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    // Wait for SPA hydration — evisa.gov.vn ships everything client-side.
    await page
      .waitForFunction(
        () => {
          const app = document.getElementById("app");
          return !!app && app.innerHTML.length > 40_000;
        },
        null,
        { timeout: 45_000 },
      )
      .catch(() => undefined);

    return {
      status: "scaffolded_pending_walk",
      runId,
      reason:
        "Vietnam e-Visa runner reached the landing page successfully. Per-step fill " +
        "implementation pending the walk recon — see vietnam/form-recon-v3.ts output " +
        "and follow the france-visas/fill-steps.ts pattern.",
    };
  } catch (err) {
    return {
      status: "failed",
      runId,
      failedStep: "landing",
      error: serializeError(err),
      url: page?.url() ?? VN_LANDING_URL,
    };
  } finally {
    try {
      if (context) await context.close();
    } catch {
      /* best-effort */
    }
    try {
      if (browser) await browser.close();
    } catch {
      /* best-effort */
    }
  }
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { value: String(err) };
}
