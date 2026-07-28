/**
 * Taiwan NIA CAPTCHA — best-effort auto-fill only, never auto-submit.
 *
 * Confirmed live on the real "確認資料" page (coa.immigration.gov.tw):
 *   - image: <img class="captcha" alt="驗證碼" src="/coa-frontend/captcha">
 *   - input: <input id="captchaToken" name="captchaToken" maxlength="6" placeholder="請輸入驗證碼">
 *   - refresh: <a class="reload-captcha">換下一組</a>
 *   - submit:  <button type="submit" class="btn btn-primary">確認資料</button>
 *              inside <form id="traveller-apply-form" method="post"
 *              action=".../overseas-foreign-china/apply"> — a REAL form POST
 *              directly to the National Immigration Agency, not a client-side
 *              preview step. Confirmed by inspecting the live DOM (no hidden
 *              review/preview modal exists for this button).
 *
 * This module screenshots the CAPTCHA image, solves it via the shared
 * 2captcha client (../captcha/two-captcha.ts — already used by CEAC/France-
 * Visas/UK/Egypt/Italy/Indonesia), and fills the decoded text into the
 * input. It deliberately does NOT click "確認資料": since that button is a
 * genuine, irreversible POST of a real immigration application, and the
 * site only validates the CAPTCHA answer on submit, there is no safe way to
 * verify the solve was correct without actually submitting. The applicant
 * reviews the pre-filled value (and can retype it, or click "換下一組" for a
 * fresh code) before submitting themselves — see fillTwEntryPermitApplication
 * in apply.ts and docs/tw-entry-permit-auto-submit-plan.md.
 */

import type { Page } from "@playwright/test";
import {
  solveImageCaptcha,
  TwoCaptchaConfigError,
  TwoCaptchaZeroBalanceError,
} from "../captcha/two-captcha.js";

const CAPTCHA_IMAGE_SELECTOR = 'img.captcha[alt="驗證碼"]';
const CAPTCHA_INPUT_SELECTOR = "input#captchaToken";
const DEFAULT_TW_CAPTCHA_TIMEOUT_MS = 120_000;

export interface TwCaptchaSolveOutcome {
  solved: boolean;
  reason?: string;
  telemetry?: { solveId: string; durationMs: number };
}

function describeError(error: unknown): string {
  if (error instanceof TwoCaptchaConfigError) {
    return "TWOCAPTCHA_API_KEY is missing; cannot solve the Taiwan NIA CAPTCHA.";
  }
  if (error instanceof TwoCaptchaZeroBalanceError) {
    return "2captcha account has zero balance; cannot solve the Taiwan NIA CAPTCHA.";
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * Best-effort auto-fill of the CAPTCHA input. Never throws — a failed solve
 * just leaves the field blank, identical to the pre-existing behavior before
 * this was added, so it can never make the halt-before-submit outcome worse.
 */
export async function solveTwCaptcha(
  page: Page,
  timeoutMs = DEFAULT_TW_CAPTCHA_TIMEOUT_MS,
): Promise<TwCaptchaSolveOutcome> {
  const image = page.locator(CAPTCHA_IMAGE_SELECTOR).first();
  const input = page.locator(CAPTCHA_INPUT_SELECTOR).first();

  const hasImage = await image.isVisible().catch(() => false);
  const hasInput = await input.isVisible().catch(() => false);
  if (!hasImage || !hasInput) {
    return { solved: false, reason: "Taiwan NIA CAPTCHA controls were not found on the confirm page." };
  }

  try {
    const buffer = await image.screenshot({ timeout: Math.min(timeoutMs, 30_000) });
    const result = await solveImageCaptcha(buffer, timeoutMs);
    await input.fill(result.text, { timeout: 10_000 });
    return { solved: true, telemetry: { solveId: result.solveId, durationMs: result.durationMs } };
  } catch (error) {
    return { solved: false, reason: describeError(error) };
  }
}
