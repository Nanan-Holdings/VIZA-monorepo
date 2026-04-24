/**
 * Handle the CEAC "Confirm Application ID / Security Question" page.
 *
 * Immediately after the start-page CAPTCHA is solved, CEAC lands on
 * `ConfirmApplicationID.aspx?node=SecureQuestion`. The page displays:
 *   - the newly-assigned Application ID (needed for recovery & handoff)
 *   - a Privacy Act / Computer Fraud Act checkbox that must be checked
 *   - a security-question dropdown (20 options)
 *   - an answer input
 *   - a Continue button
 *
 * The user MUST choose a question and provide an answer before CEAC will
 * let them begin the actual DS-160 form. The answer is the secondary
 * recovery factor — the applicant needs it later (plus their Application
 * ID and first five letters of their surname) to retrieve the application.
 */

import type { Page } from "@playwright/test";
import { CEAC_APPLICATION_ID_PATTERN } from "./selectors";

const PRIVACY_CHECKBOX_SELECTOR = '#ctl00_SiteContentPlaceHolder_chkbxPrivacyAct';
const APPLICATION_ID_LABEL_SELECTOR = '#ctl00_SiteContentPlaceHolder_lblBarcode';
const SECURITY_QUESTION_SELECTOR = '#ctl00_SiteContentPlaceHolder_ddlQuestions';
const SECURITY_ANSWER_SELECTOR = '#ctl00_SiteContentPlaceHolder_txtAnswer';
const CONTINUE_BUTTON_SELECTOR = '#ctl00_SiteContentPlaceHolder_btnContinue';

export interface ConfirmApplicationOptions {
  /** Applicant's answer to the chosen security question. Required for recovery later. */
  securityAnswer: string;
  /**
   * Dropdown value (1-20) of the security question to choose. Defaults to
   * "3" ("What is your maternal grandmother's maiden name?") — a question
   * most applicants can answer deterministically.
   */
  securityQuestionValue?: string;
  /** Timeout for the Continue-click postback in ms. Default 30_000. */
  timeoutMs?: number;
}

export interface ConfirmApplicationResult {
  /** The CEAC Application ID assigned to this new application (AA + 8 chars). */
  applicationId: string;
  /** The dropdown value that was selected (1-20). */
  securityQuestionValue: string;
  /** The human-readable question text associated with the chosen value. */
  securityQuestionText: string;
  /** The answer that was typed in. Stored so operators can pass it to the applicant. */
  securityAnswer: string;
  /** URL landed on after clicking Continue. */
  postContinueUrl: string;
}

/**
 * Run the Confirm-Application-ID / Security-Question page:
 *  1. Check the Privacy Act checkbox (gates the Continue button).
 *  2. Capture and return the assigned Application ID.
 *  3. Select a security question from the dropdown.
 *  4. Type the answer.
 *  5. Click Continue and wait for the next page to load.
 *
 * Throws if the Application ID cannot be captured — without it, the
 * applicant cannot recover their DS-160 later and the run has no value.
 */
export async function handleConfirmApplicationPage(
  page: Page,
  options: ConfirmApplicationOptions,
): Promise<ConfirmApplicationResult> {
  const timeoutMs = options.timeoutMs ?? 30_000;

  // 1. Check Privacy Act / Computer Fraud Act acknowledgment.
  //    CEAC renders the Continue button disabled (or no-ops the postback)
  //    until this is checked. Use .check() which is idempotent — if it's
  //    already checked we skip the action but don't error.
  const privacyChk = page.locator(PRIVACY_CHECKBOX_SELECTOR).first();
  if ((await privacyChk.count()) > 0) {
    try {
      await privacyChk.check({ force: true, timeout: 5_000 });
    } catch {
      // The checkbox may be wrapped in a label that intercepts clicks;
      // fall back to a direct JS click on the underlying input.
      try {
        await privacyChk.evaluate("el => el.click()");
      } catch {
        // best-effort — Continue may still work
      }
    }
  }

  // 2. Capture Application ID from the displayed barcode label. CEAC
  //    renders the ID like "Application ID AA00ABCDEF" in the label; we
  //    extract via the canonical `AA\w{8,10}` regex so cosmetic text
  //    changes around the ID don't break capture.
  const barcode = page.locator(APPLICATION_ID_LABEL_SELECTOR).first();
  const barcodeText = await barcode.textContent({ timeout: 10_000 }).catch(() => null);
  const match = barcodeText?.match(CEAC_APPLICATION_ID_PATTERN);
  if (!match) {
    throw new Error(
      `Could not capture Application ID from SecureQuestion page (label text="${barcodeText?.trim() ?? ""}")`,
    );
  }
  const applicationId = match[0];

  // 3. Select security question (default value "3": maternal grandmother maiden).
  const questionValue = options.securityQuestionValue ?? "3";
  const ddl = page.locator(SECURITY_QUESTION_SELECTOR).first();
  await ddl.waitFor({ state: "attached", timeout: 10_000 });
  await ddl.selectOption(questionValue);
  const questionText = (await ddl.evaluate(
    `s => s.options[s.selectedIndex] ? s.options[s.selectedIndex].text : ""`,
  )) as string;

  // 4. Fill answer.
  const answerInput = page.locator(SECURITY_ANSWER_SELECTOR).first();
  await answerInput.fill(options.securityAnswer);

  // 5. Click Continue and wait for the next page to settle.
  const btnContinue = page.locator(CONTINUE_BUTTON_SELECTOR).first();
  await btnContinue.waitFor({ state: "attached", timeout: 10_000 });
  await btnContinue.click({ force: true, timeout: timeoutMs });

  try {
    await page.waitForLoadState("networkidle", { timeout: timeoutMs });
  } catch {
    // CEAC's UpdatePanels sometimes hold long-lived connections — fall
    // back to a short settle and let the caller verify the page identity.
    await page.waitForTimeout(2_000);
  }

  return {
    applicationId,
    securityQuestionValue: questionValue,
    securityQuestionText: (questionText || "").trim(),
    securityAnswer: options.securityAnswer,
    postContinueUrl: page.url(),
  };
}
