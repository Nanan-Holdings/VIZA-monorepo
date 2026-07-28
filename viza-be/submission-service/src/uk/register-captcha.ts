/**
 * UK Standard Visitor "Register an email" CAPTCHA solver.
 *
 * Mirrors the France-Visas registration CAPTCHA flow (see
 * `france-visas/registration-captcha.ts`) but is deliberately best-effort:
 * gov.uk's save-and-return registration page does not always present an image
 * CAPTCHA, so `solveUkRegistrationCaptcha` returns `no_captcha` when none is
 * found and the caller submits normally. When a CAPTCHA IS present, we
 * screenshot the image, hand it to the shared 2captcha client, and type the
 * answer into the paired input — exactly like the France flow.
 */

import type { Page } from "@playwright/test";
import {
  solveImageCaptcha,
  reportBadCaptcha,
  type CaptchaSolveResult,
  type CaptchaSolveTelemetry,
} from "../captcha";

/** Candidate selectors for the CAPTCHA image, ordered most→least specific. */
const UK_CAPTCHA_IMAGE_SELECTORS = [
  "#captchaImage",
  'img[id*="captcha" i]',
  'img[alt*="captcha" i]',
  'img[src*="captcha" i]',
  ".captcha img",
] as const;

/** Candidate selectors for the CAPTCHA answer text input. */
const UK_CAPTCHA_INPUT_SELECTORS = [
  "#captcha",
  "#captchaText",
  'input[name*="captcha" i]',
  'input[id*="captcha" i]',
] as const;

export type UkCaptchaOutcome =
  | { status: "solved"; solve: CaptchaSolveResult }
  | { status: "no_captcha" }
  | { status: "failed"; reason: string };

export interface UkCaptchaSolveWithTelemetry {
  solve: CaptchaSolveResult | null;
  telemetry: CaptchaSolveTelemetry[];
}

async function firstPresent(page: Page, selectors: readonly string[]) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0) return { locator, selector };
  }
  return null;
}

/**
 * Detect + solve the registration CAPTCHA. Does NOT click submit — the caller
 * advances the form after every field (including the CAPTCHA answer) is filled.
 */
export async function solveUkRegistrationCaptcha(page: Page): Promise<UkCaptchaOutcome> {
  const image = await firstPresent(page, UK_CAPTCHA_IMAGE_SELECTORS);
  if (!image) return { status: "no_captcha" };

  try {
    await image.locator.waitFor({ state: "visible", timeout: 15_000 });
    await image.locator.scrollIntoViewIfNeeded({ timeout: 5_000 }).catch(() => undefined);
    const box = await image.locator.boundingBox({ timeout: 5_000 });
    if (!box || box.width <= 0 || box.height <= 0) {
      return { status: "failed", reason: "CAPTCHA image has no visible size" };
    }
  } catch (err) {
    return {
      status: "failed",
      reason: `CAPTCHA image did not load: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const imageBuffer = await image.locator.screenshot({ timeout: 15_000 });
  if (imageBuffer.byteLength === 0) {
    return { status: "failed", reason: "empty CAPTCHA image buffer" };
  }

  let solve: CaptchaSolveResult;
  try {
    solve = await solveImageCaptcha(imageBuffer);
  } catch (err) {
    return {
      status: "failed",
      reason: `2captcha solve failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const input = await firstPresent(page, UK_CAPTCHA_INPUT_SELECTORS);
  if (!input) return { status: "failed", reason: "CAPTCHA input not found" };
  try {
    await input.locator.fill(solve.text.trim(), { timeout: 10_000 });
  } catch (err) {
    return {
      status: "failed",
      reason: `CAPTCHA input fill failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return { status: "solved", solve };
}

/**
 * Solve with retry. On a failed solve the registration page is reloaded (which
 * clears every field), so callers pass a `refillForm` that re-enters the
 * email/password fields before the next attempt — mirroring the France flow.
 *
 * Returns `{ solve: null }` when the page never presents a CAPTCHA, so the
 * caller can proceed straight to submit.
 */
export async function solveUkRegistrationCaptchaWithRetry(
  page: Page,
  maxAttempts: number,
  refillForm: () => Promise<void>,
): Promise<UkCaptchaSolveWithTelemetry> {
  const telemetry: CaptchaSolveTelemetry[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const outcome = await solveUkRegistrationCaptcha(page);

    if (outcome.status === "solved") {
      telemetry.push({
        solveId: outcome.solve.solveId,
        durationMs: outcome.solve.durationMs,
        attempt,
        outcome: "solved",
      });
      return { solve: outcome.solve, telemetry };
    }

    if (outcome.status === "no_captcha") {
      return { solve: null, telemetry };
    }

    telemetry.push({ solveId: "", durationMs: 0, attempt, outcome: "failed" });
    if (attempt === maxAttempts) break;
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => undefined);
    await refillForm();
  }

  throw new Error(`UK registration CAPTCHA solve failed after ${maxAttempts} attempts`);
}

export { reportBadCaptcha };
