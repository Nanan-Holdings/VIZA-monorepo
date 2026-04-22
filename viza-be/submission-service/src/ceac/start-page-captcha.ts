/**
 * Solve the CEAC start-page image CAPTCHA during session bootstrap.
 *
 * Locates the CAPTCHA image on the start page, captures it as a PNG buffer,
 * submits it to 2captcha via the captcha-solver client, types the answer into
 * the code input, and returns a typed outcome.
 *
 * Retry policy: the caller may retry up to N times. On wrong-answer
 * validation, this module calls reportBadCaptcha for a 2captcha refund.
 */

import type { Page } from "@playwright/test";
import { solveImageCaptcha, reportBadCaptcha, type CaptchaSolveResult } from "./captcha-solver";
import { SessionBootstrapError } from "./errors";

// ---------------------------------------------------------------------------
// Selectors — CEAC start-page CAPTCHA elements
// ---------------------------------------------------------------------------

/** The <img> tag containing the CAPTCHA image. */
const CAPTCHA_IMAGE_SELECTOR = 'img[id*="Captcha"]';

/** The text input where the user types the CAPTCHA answer. */
const CAPTCHA_INPUT_SELECTOR =
  'input[id*="CaptchaCodeTextBox"], input[id*="captcha" i][type="text"]';

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type StartPageCaptchaOutcome =
  | { status: "solved"; solve: CaptchaSolveResult }
  | { status: "wrong_answer"; solve: CaptchaSolveResult; validationHint: string }
  | { status: "no_captcha" }
  | { status: "failed"; reason: string };

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Attempt to solve the CEAC start-page CAPTCHA once.
 *
 * Steps:
 *  1. Locate the CAPTCHA image via `img[id*="Captcha"]`.
 *  2. Screenshot just the image element to a PNG buffer.
 *  3. Send to 2captcha via `solveImageCaptcha()`.
 *  4. Type the answer into the CAPTCHA text input.
 *  5. Click the continue/next button to submit.
 *  6. Check for validation errors — if the CAPTCHA was wrong, report it.
 *
 * Does NOT retry internally — callers decide retry policy.
 */
export async function solveStartPageCaptcha(
  page: Page,
): Promise<StartPageCaptchaOutcome> {
  // 1. Find the CAPTCHA image
  const captchaImg = page.locator(CAPTCHA_IMAGE_SELECTOR).first();
  const imgCount = await captchaImg.count();
  if (imgCount === 0) {
    return { status: "no_captcha" };
  }

  // 2. Screenshot just the image element
  let imageBuffer: Buffer;
  try {
    imageBuffer = await captchaImg.screenshot({ type: "png" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "failed", reason: `Could not capture CAPTCHA image: ${msg}` };
  }

  // 3. Solve via 2captcha
  let solve: CaptchaSolveResult;
  try {
    solve = await solveImageCaptcha(imageBuffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "failed", reason: `2captcha solve failed: ${msg}` };
  }

  // 4. Type the answer into the CAPTCHA input
  const captchaInput = page.locator(CAPTCHA_INPUT_SELECTOR).first();
  const inputCount = await captchaInput.count();
  if (inputCount === 0) {
    return {
      status: "failed",
      reason: "CAPTCHA image found but no text input found on page",
    };
  }
  await captchaInput.fill(solve.text);

  // 5. Submit — click the continue/start application link
  //    CEAC start page uses either a "Continue" link or a submit button
  const submitSelector =
    'a[id*="lnkContinue"], input[id*="btnContinue"], input[type="submit"][value*="Continue"], input[type="submit"][value*="Start"]';
  const submitBtn = page.locator(submitSelector).first();
  if ((await submitBtn.count()) > 0) {
    await submitBtn.click();
  } else {
    // Fallback: press Enter on the input
    await captchaInput.press("Enter");
  }

  // 6. Wait briefly for navigation or validation
  try {
    await page.waitForLoadState("networkidle", { timeout: 15_000 });
  } catch {
    // Timeout is acceptable — page may have already settled
  }

  // 7. Check if we're still on the same page with a validation error
  //    CEAC shows inline validation messages when the CAPTCHA code is wrong
  const validationSelector =
    '[id*="ValidationSummary"], .error, [id*="RequiredFieldValidator"]:visible, [id*="Captcha"][style*="color"]';
  const validationEl = page.locator(validationSelector).first();
  const hasValidation = (await validationEl.count()) > 0;

  // Also check if the CAPTCHA image is still visible (means we didn't advance)
  const stillHasCaptcha = (await page.locator(CAPTCHA_IMAGE_SELECTOR).count()) > 0;

  if (stillHasCaptcha && hasValidation) {
    // Wrong answer — report to 2captcha for refund
    try {
      await reportBadCaptcha(solve.solveId);
    } catch {
      // Best effort — don't fail the run over a refund request
    }
    let hint = "";
    try {
      hint = await validationEl.innerText({ timeout: 2_000 });
    } catch {
      hint = "CAPTCHA validation failed (no text extracted)";
    }
    return { status: "wrong_answer", solve, validationHint: hint };
  }

  // Success — we advanced past the CAPTCHA
  return { status: "solved", solve };
}

/**
 * Attempt to solve the start-page CAPTCHA with retries.
 *
 * @param page - Playwright page on the CEAC start page.
 * @param maxAttempts - Maximum solve attempts (default 3).
 * @returns The final outcome after all attempts.
 * @throws SessionBootstrapError if all attempts are exhausted.
 */
export async function solveStartPageCaptchaWithRetry(
  page: Page,
  maxAttempts = 3,
): Promise<CaptchaSolveResult> {
  const attempts: StartPageCaptchaOutcome[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const outcome = await solveStartPageCaptcha(page);
    attempts.push(outcome);

    switch (outcome.status) {
      case "solved":
        return outcome.solve;

      case "no_captcha":
        // No CAPTCHA on page — nothing to solve, proceed normally
        return { text: "", solveId: "", durationMs: 0 };

      case "wrong_answer":
        // Retry — the CAPTCHA image should have refreshed
        if (attempt === maxAttempts) {
          throw new SessionBootstrapError(
            `CAPTCHA solve failed after ${maxAttempts} attempts (last: wrong answer)`,
            {
              url: page.url(),
              details: {
                attempts: attempts.map(summarizeOutcome),
                lastValidationHint: outcome.validationHint,
              },
            },
          );
        }
        // Wait briefly for CAPTCHA image to refresh before retrying
        try {
          await page.waitForTimeout(1_000);
        } catch {
          // ignore
        }
        continue;

      case "failed":
        throw new SessionBootstrapError(
          `CAPTCHA solve failed: ${outcome.reason}`,
          {
            url: page.url(),
            details: { attempts: attempts.map(summarizeOutcome) },
          },
        );
    }
  }

  // Should not reach here, but satisfy TypeScript
  throw new SessionBootstrapError("CAPTCHA solve exhausted all attempts", {
    url: page.url(),
    details: { attempts: attempts.map(summarizeOutcome) },
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function summarizeOutcome(o: StartPageCaptchaOutcome): Record<string, unknown> {
  switch (o.status) {
    case "solved":
      return { status: "solved", durationMs: o.solve.durationMs, solveId: o.solve.solveId };
    case "wrong_answer":
      return {
        status: "wrong_answer",
        durationMs: o.solve.durationMs,
        solveId: o.solve.solveId,
        hint: o.validationHint,
      };
    case "no_captcha":
      return { status: "no_captcha" };
    case "failed":
      return { status: "failed", reason: o.reason };
  }
}
