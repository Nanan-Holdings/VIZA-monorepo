/**
 * Solve the France-Visas Keycloak registration CAPTCHA.
 *
 * The Captchetat image is served as an inline `data:image/png;base64,...`
 * URL on the `#captchaImage` element — much simpler than CEAC's BotDetect:
 * no HTTP fetch, no re-render race, no canvas dance. Read the data URL,
 * decode to a Buffer, hand off to 2captcha, type the answer.
 *
 * A hidden `captchetat-uuid` ties the image to the server-side validator.
 * It must NOT be cleared or regenerated between our read and the form
 * submit — which is fine because we only read the data URL once and leave
 * the DOM untouched.
 */

import type { Page } from "@playwright/test";
import {
  solveImageCaptcha,
  reportBadCaptcha,
  type CaptchaSolveResult,
  type CaptchaSolveTelemetry,
} from "../captcha";
import { RegistrationFailedError } from "./errors";
import { FV_REGISTRATION_SELECTORS, FV_URLS } from "./selectors";

export type FvCaptchaOutcome =
  | { status: "solved"; solve: CaptchaSolveResult }
  | { status: "wrong_answer"; solve: CaptchaSolveResult; validationHint: string }
  | { status: "no_captcha" }
  | { status: "failed"; reason: string };

export interface FvCaptchaSolveWithTelemetry {
  solve: CaptchaSolveResult | null;
  telemetry: CaptchaSolveTelemetry[];
}

/**
 * Read the CAPTCHA image `src` data URL, solve via 2captcha, and type the
 * answer into the CAPTCHA input. Does NOT click submit — caller advances
 * the form after all fields (including CAPTCHA answer) are filled.
 */
export async function solveRegistrationCaptcha(page: Page): Promise<FvCaptchaOutcome> {
  const captchaImage = page.locator(FV_REGISTRATION_SELECTORS.captchaImage).first();
  if ((await captchaImage.count()) === 0) {
    return { status: "no_captcha" };
  }

  try {
    await captchaImage.waitFor({ state: "visible", timeout: 15_000 });
    await captchaImage.scrollIntoViewIfNeeded({ timeout: 5_000 }).catch(() => undefined);
    const box = await captchaImage.boundingBox({ timeout: 5_000 });
    if (!box || box.width <= 0 || box.height <= 0) {
      return { status: "failed", reason: "CAPTCHA image has no visible size" };
    }
  } catch (err) {
    return { status: "failed", reason: `CAPTCHA image did not load: ${err instanceof Error ? err.message : String(err)}` };
  }

  const imageBuffer = await captchaImage.screenshot({ timeout: 15_000 });
  if (imageBuffer.byteLength === 0) {
    return { status: "failed", reason: "empty CAPTCHA image buffer" };
  }

  let solve: CaptchaSolveResult;
  try {
    solve = await solveImageCaptcha(imageBuffer);
  } catch (err) {
    return { status: "failed", reason: `2captcha solve failed: ${err instanceof Error ? err.message : String(err)}` };
  }

  const typed = await page.evaluate(
    ({ selector, text }) => {
      const el = document.querySelector(selector) as unknown as
        | { focus: () => void; value: string; dispatchEvent: (e: Event) => void }
        | null;
      if (!el) return false;
      el.focus();
      el.value = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true }));
      return true;
    },
    { selector: FV_REGISTRATION_SELECTORS.captchaInput, text: solve.text.trim() },
  );
  if (!typed) return { status: "failed", reason: "CAPTCHA input not found" };

  return { status: "solved", solve };
}

/**
 * Solve with retry. On wrong answer, reports to 2captcha for refund then
 * reloads the current registration page (Keycloak emits a fresh CAPTCHA on reload).
 *
 * Note: callers must call this AFTER filling the name/email/password fields
 * but BEFORE clicking Submit — since a reload clears every field, retrying
 * means re-filling everything. The registration flow in `registration.ts`
 * handles this by refilling after every retry.
 */
export async function solveRegistrationCaptchaWithRetry(
  page: Page,
  maxAttempts: number,
  refillForm: () => Promise<void>,
): Promise<FvCaptchaSolveWithTelemetry> {
  const telemetry: CaptchaSolveTelemetry[] = [];
  let lastOutcome: FvCaptchaOutcome | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const outcome = await solveRegistrationCaptcha(page);
    lastOutcome = outcome;

    switch (outcome.status) {
      case "solved":
        telemetry.push({
          solveId: outcome.solve.solveId,
          durationMs: outcome.solve.durationMs,
          attempt,
          outcome: "solved",
        });
        return { solve: outcome.solve, telemetry };

      case "wrong_answer":
        telemetry.push({
          solveId: outcome.solve.solveId,
          durationMs: outcome.solve.durationMs,
          attempt,
          outcome: "wrong_answer_retry",
        });
        try { await reportBadCaptcha(outcome.solve.solveId); } catch { /* best-effort */ }
        if (attempt === maxAttempts) break;
        await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => undefined);
        await refillForm();
        continue;

      case "no_captcha":
        telemetry.push({ solveId: "", durationMs: 0, attempt, outcome: "failed" });
        return { solve: null, telemetry };

      case "failed":
        telemetry.push({ solveId: "", durationMs: 0, attempt, outcome: "failed" });
        if (attempt === maxAttempts) break;
        await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => undefined);
        await refillForm();
        continue;
    }
  }

  throw new RegistrationFailedError(
    `CAPTCHA solve failed after ${maxAttempts} attempts (last: ${lastOutcome?.status ?? "unknown"})`,
    { url: page.url(), details: { telemetry, lastOutcome } },
  );
}
