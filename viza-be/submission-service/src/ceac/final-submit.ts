import type { Page } from "@playwright/test";
import { solveImageCaptcha } from "../captcha";
import { CEAC_APPLICATION_ID_PATTERN, CEAC_SIGN_AND_SUBMIT_MARKERS } from "./selectors";
import { detectPage, isOfficialDs160ConfirmationPage } from "./pages";
import { detectSignAndSubmit } from "./stop-at-sign";
import type { Ds160FinalSubmissionGuard } from "./final-submission-guard";

const FINAL_CAPTCHA_INPUT_SELECTOR =
  'input[id*="CaptchaCodeTextBox"], input[id*="IdentifyCaptcha"][type="text"], input[id*="captcha" i][type="text"], input[name*="captcha" i]';

export interface FinalSubmitOptions {
  passportNumber: string;
  /** Expected CEAC Application ID; confirmation must contain this exact ID. */
  applicationId?: string | null;
  /** Maximum time to wait for official confirmation after the one click. */
  confirmationTimeoutMs?: number;
  /** Retained for API compatibility; final submission never retries the click. */
  maxCaptchaAttempts?: number;
  /** Persistent cross-run reservation required immediately before the click. */
  finalSubmissionGuard?: Ds160FinalSubmissionGuard;
}

export interface FinalSubmitResult {
  status: "submitted";
  applicationId: string | null;
  confirmationNumber: string | null;
  submittedAt: string;
  url: string;
  captchaAttempts: number;
}

export async function signAndSubmitApplication(
  page: Page,
  options: FinalSubmitOptions,
): Promise<FinalSubmitResult> {
  const identity = await detectSignAndSubmit(page);
  if (!identity) {
    const probe = await detectPage(page);
    throw new Error(`Expected Sign and Submit page before final submission, got ${probe.id}`);
  }

  const expectedApplicationId =
    options.applicationId?.trim().toUpperCase() ??
    (await readApplicationId(page));
  if (!expectedApplicationId) {
    throw new Error("Cannot perform final DS-160 submission without an Application ID to verify.");
  }
  const confirmationTimeoutMs = options.confirmationTimeoutMs ?? 45_000;
  if (!Number.isFinite(confirmationTimeoutMs) || confirmationTimeoutMs <= 0) {
    throw new Error("confirmationTimeoutMs must be a positive number.");
  }

  const signatureInput = page.locator(CEAC_SIGN_AND_SUBMIT_MARKERS.passportSignatureSelector).first();
  await signatureInput.waitFor({ state: "visible", timeout: 10_000 });
  await signatureInput.fill(options.passportNumber.trim());

  const captchaImage = page.locator(CEAC_SIGN_AND_SUBMIT_MARKERS.captchaSelector).first();
  if ((await captchaImage.count()) > 0 && (await captchaImage.isVisible().catch(() => false))) {
    const captchaPng = await captchaImage.screenshot({ timeout: 10_000 });
    const solve = await solveImageCaptcha(captchaPng);
    const captchaInput = page.locator(FINAL_CAPTCHA_INPUT_SELECTOR).first();
    await captchaInput.waitFor({ state: "visible", timeout: 10_000 });
    await captchaInput.fill(solve.text.trim());
  }

  const guard = options.finalSubmissionGuard;
  if (!guard) {
    throw new Error("Persistent DS-160 final submission guard is required before the final click.");
  }

  // The final action is irreversible. Reserve the logical operation in the
  // database immediately before clicking. An existing started/unknown/
  // confirmed reservation is always a hard stop; recovery must inspect CEAC
  // and save evidence instead of clicking again.
  const reservation = await guard.begin();
  if (reservation.kind !== "acquired") {
    throw new Error(
      `DS-160 final submission is already ${reservation.kind.replace("already_", "")}; recover the existing CEAC attempt before retrying.`,
    );
  }

  try {
    await clickFinalSubmit(page);

    const submitted = await waitForConfirmation(page, expectedApplicationId, confirmationTimeoutMs);
    if (!submitted) {
      throw new Error("Final DS-160 submission did not reach a verified confirmation after the one allowed click.");
    }

    const bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
    const applicationId = extractApplicationId(bodyText);
    if (!applicationId || applicationId.toUpperCase() !== expectedApplicationId) {
      throw new Error("CEAC confirmation did not contain the expected Application ID.");
    }

    const confirmationNumber = extractConfirmationNumber(bodyText);
    await guard.markConfirmed({
      officialApplicationId: applicationId,
      confirmationNumber,
      confirmationPageUrl: page.url(),
    });

    return {
      status: "submitted",
      applicationId,
      confirmationNumber,
      submittedAt: new Date().toISOString(),
      url: page.url(),
      captchaAttempts: 1,
    };
  } catch (error) {
    // A reserved operation is never silently reusable after any final-click
    // path failure. The guard remains started if this update loses the lease,
    // which still blocks an automatic cross-run duplicate click.
    await guard.markUnknown("confirmation_unknown").catch(() => undefined);
    throw error;
  }
}

async function clickFinalSubmit(page: Page): Promise<void> {
  const submitButton = page.locator(CEAC_SIGN_AND_SUBMIT_MARKERS.finalSubmitSelector).first();
  await submitButton.waitFor({ state: "visible", timeout: 10_000 });
  await Promise.all([
    page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined),
    submitButton.click({ force: true, timeout: 10_000 }),
  ]);
}

async function waitForConfirmation(
  page: Page,
  expectedApplicationId: string,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isOfficialDs160ConfirmationPage(page, expectedApplicationId)) return true;
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    await page.waitForTimeout(Math.min(250, remainingMs));
  }
  return false;
}

function extractApplicationId(text: string): string | null {
  return text.match(CEAC_APPLICATION_ID_PATTERN)?.[0] ?? null;
}

function extractConfirmationNumber(text: string): string | null {
  const labeled = text.match(/confirmation\s+(?:number|no\.?|#)\s*:?\s*([A-Z0-9-]{6,})/i);
  return labeled?.[1] ?? null;
}

async function readApplicationId(page: Page): Promise<string | null> {
  try {
    const bodyText = await page.locator("body").innerText({ timeout: 5_000 });
    return extractApplicationId(bodyText)?.toUpperCase() ?? null;
  } catch {
    return null;
  }
}
