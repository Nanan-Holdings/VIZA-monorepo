import type { Page } from "@playwright/test";
import { solveImageCaptcha, reportBadCaptcha } from "../captcha";
import { CEAC_APPLICATION_ID_PATTERN, CEAC_SIGN_AND_SUBMIT_MARKERS } from "./selectors";
import { detectPage } from "./pages";
import { detectSignAndSubmit } from "./stop-at-sign";

const FINAL_CAPTCHA_INPUT_SELECTOR =
  'input[id*="CaptchaCodeTextBox"], input[id*="IdentifyCaptcha"][type="text"], input[id*="captcha" i][type="text"], input[name*="captcha" i]';

export interface FinalSubmitOptions {
  passportNumber: string;
  maxCaptchaAttempts?: number;
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

  const maxCaptchaAttempts = options.maxCaptchaAttempts ?? 3;
  let lastSolveId: string | null = null;

  for (let attempt = 1; attempt <= maxCaptchaAttempts; attempt += 1) {
    const signatureInput = page.locator(CEAC_SIGN_AND_SUBMIT_MARKERS.passportSignatureSelector).first();
    await signatureInput.waitFor({ state: "visible", timeout: 10_000 });
    await signatureInput.fill(options.passportNumber.trim());

    const captchaImage = page.locator(CEAC_SIGN_AND_SUBMIT_MARKERS.captchaSelector).first();
    if ((await captchaImage.count()) > 0 && (await captchaImage.isVisible().catch(() => false))) {
      const captchaPng = await captchaImage.screenshot({ timeout: 10_000 });
      const solve = await solveImageCaptcha(captchaPng);
      lastSolveId = solve.solveId;

      const captchaInput = page.locator(FINAL_CAPTCHA_INPUT_SELECTOR).first();
      await captchaInput.waitFor({ state: "visible", timeout: 10_000 });
      await captchaInput.fill(solve.text.trim());
    }

    await clickFinalSubmit(page);

    const submitted = await waitForConfirmation(page);
    if (submitted) {
      const bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
      return {
        status: "submitted",
        applicationId: extractApplicationId(bodyText),
        confirmationNumber: extractConfirmationNumber(bodyText),
        submittedAt: new Date().toISOString(),
        url: page.url(),
        captchaAttempts: attempt,
      };
    }

    if (lastSolveId) {
      await reportBadCaptcha(lastSolveId).catch(() => undefined);
      lastSolveId = null;
    }
  }

  throw new Error(`Final DS-160 submission did not reach confirmation after ${maxCaptchaAttempts} CAPTCHA attempt(s)`);
}

async function clickFinalSubmit(page: Page): Promise<void> {
  const submitButton = page.locator(CEAC_SIGN_AND_SUBMIT_MARKERS.finalSubmitSelector).first();
  await submitButton.waitFor({ state: "visible", timeout: 10_000 });
  await Promise.all([
    page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined),
    submitButton.click({ force: true, timeout: 10_000 }),
  ]);
}

async function waitForConfirmation(page: Page): Promise<boolean> {
  try {
    await page.waitForURL(/complete_confirmation\.aspx|Confirmation\.aspx|node=Confirmation/i, {
      timeout: 45_000,
    });
    return true;
  } catch {
    const probe = await detectPage(page);
    return probe.id === "confirmation";
  }
}

function extractApplicationId(text: string): string | null {
  return text.match(CEAC_APPLICATION_ID_PATTERN)?.[0] ?? null;
}

function extractConfirmationNumber(text: string): string | null {
  const labeled = text.match(/confirmation\s+(?:number|no\.?|#)\s*:?\s*([A-Z0-9-]{6,})/i);
  return labeled?.[1] ?? extractApplicationId(text);
}
