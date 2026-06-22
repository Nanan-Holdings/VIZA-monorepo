/**
 * Resume an existing DS-160 application on CEAC after mid-orchestration
 * session expiry.
 *
 * CEAC will drop the server-side session if no postback has happened for
 * ~10 minutes (the default ASP.NET session timeout). When that fires,
 * any subsequent click from the form redirects to `SessionTimedOut.aspx`
 * (the same URL we see from the start-page modal race, but for a
 * different reason). Unlike the start-page race, the saved application
 * IS recoverable — CEAC persists all section data keyed to the
 * Application ID, and the applicant resumes by going back to the start
 * page, clicking "RETRIEVE AN APPLICATION", and re-authenticating with:
 *
 *   - Application ID (assigned at ConfirmApplicationID)
 *   - First five letters of surname (applicant-supplied)
 *   - Year of birth (applicant-supplied)
 *   - Answer to the security question chosen at ConfirmApplicationID
 *
 * After a successful retrieve, CEAC lands the user at the section they
 * last saved. The orchestrator can then continue its fill loop.
 */

import type { Page } from "@playwright/test";
import { CEAC_URLS } from "./selectors";

export interface RecoveryCredentials {
  /** Application ID captured from ConfirmApplicationID.aspx, e.g. "AA00FHOZ99". */
  applicationId: string;
  /** First 5 letters of applicant's surname, uppercase. */
  surnameFirstFive: string;
  /** Applicant's 4-digit year of birth. */
  yearOfBirth: string;
  /** Answer to the security question chosen at ConfirmApplicationID. */
  securityAnswer: string;
}

// CEAC's Retrieve Application form uses ASP.NET IDs under
// ctl00_SiteContentPlaceHolder_. The exact IDs vary slightly between
// CEAC deployments; we match by substring so minor renames don't break
// recovery. Multiple candidates cover observed variants.
const RETRIEVE_FORM_SELECTORS = {
  // The "RETRIEVE AN APPLICATION" link on Default.aspx — post-CAPTCHA.
  retrieveLink:
    'a[id*="lnkRetrieve"], a[id*="lnkContinueApp"], input[id*="btnRetrieve"]',
  applicationId:
    'input[id*="tbxApplicationID"], input[id*="txtApplicationID"], input[id*="ApplicationID"][type="text"]',
  applicationIdSubmit:
    'input[id*="btnBarcodeSubmit"], input[type="submit"][value="Retrieve Application"]',
  surnameFive:
    'input[id*="tbxSurname"]:visible, input[id*="txtSurname"]:visible, input[id*="txbSname"]:visible, input[id*="Surname"][type="text"]:visible',
  yearOfBirth:
    'input[id*="tbxDOBYear"]:visible, input[id*="txtYearOfBirth"]:visible, input[id*="txbYear"]:visible, select[id*="ddlDOBYear"]:visible',
  securityAnswer:
    'input[id*="tbxAnswer"]:visible, input[id*="txtAnswer"]:visible, input[id*="txbAnswer1"]:visible, input[id*="SecurityAnswer"][type="text"]:visible',
  continue:
    'input[id*="btnRetrieve"]:visible, input[name*="ApplicationRecovery1$Button1"]:visible, input[id*="btnContinue"]:visible, input[type="submit"][value*="Continue"]:visible, a[id*="lnkContinue"]:visible',
} as const;

/**
 * Fill and submit the CEAC Retrieve Application form.
 *
 * Assumes the browser is already on the CEAC Default.aspx start page
 * AND the start-page CAPTCHA has already been solved (the location
 * post-back + modal dismiss + CAPTCHA fill happen in the caller via the
 * standard session bootstrap).
 *
 * The caller is responsible for advancing the page to "Retrieve" mode by
 * clicking the RETRIEVE link and for the downstream orchestration once
 * CEAC lands back on the last-saved form page.
 */
export async function fillRetrieveApplicationForm(
  page: Page,
  credentials: RecoveryCredentials,
): Promise<void> {
  // Click the RETRIEVE AN APPLICATION link (instead of the START link
  // the normal bootstrap uses). CEAC's post-CAPTCHA surface has BOTH
  // links; the one that fires the retrieve flow is `lnkRetrieve` or
  // `lnkContinueApp`.
  const retrieveLink = page.locator(RETRIEVE_FORM_SELECTORS.retrieveLink).first();
  if ((await retrieveLink.count()) > 0) {
    try {
      await retrieveLink.click({ force: true, timeout: 10_000 });
    } catch {
      await retrieveLink.evaluate("el => el.click()");
    }
    try {
      await page.waitForLoadState("networkidle", { timeout: 15_000 });
    } catch {
      await page.waitForTimeout(2_000);
    }
  }

  // Fill the retrieve form. Each field is attempted best-effort; if a
  // field isn't on the page (CEAC variations omit some), we skip it and
  // let server-side validation surface a clearer error downstream.
  await fillIfPresent(page, RETRIEVE_FORM_SELECTORS.applicationId, credentials.applicationId);

  // Current CEAC renders retrieval as two postbacks. The first accepts only
  // the Application ID; surname/year/security answer are attached after it.
  const applicationIdSubmit = page.locator(RETRIEVE_FORM_SELECTORS.applicationIdSubmit).first();
  if ((await applicationIdSubmit.count()) > 0) {
    await clickAndSettle(page, applicationIdSubmit);
  }

  await fillIfPresent(
    page,
    RETRIEVE_FORM_SELECTORS.surnameFive,
    credentials.surnameFirstFive.slice(0, 5).toUpperCase(),
  );
  // Year-of-birth field could be a text input OR a dropdown. `fill()`
  // on a <select> throws; try fill first, then selectOption as fallback.
  const yob = page.locator(RETRIEVE_FORM_SELECTORS.yearOfBirth).first();
  if ((await yob.count()) > 0) {
    try {
      await yob.fill(credentials.yearOfBirth, { timeout: 3_000 });
    } catch {
      try {
        await yob.selectOption(credentials.yearOfBirth, { timeout: 3_000 });
      } catch {
        await assignDomValue(yob, credentials.yearOfBirth);
      }
    }
  }
  await fillIfPresent(page, RETRIEVE_FORM_SELECTORS.securityAnswer, credentials.securityAnswer);

  // Submit. After this click CEAC re-lands on the last saved form page.
  const continueBtn = page.locator(RETRIEVE_FORM_SELECTORS.continue).first();
  if ((await continueBtn.count()) === 0) {
    throw new Error("CEAC Retrieve form: no Continue button found");
  }
  await clickAndSettle(page, continueBtn);
}

/**
 * Return a retrieval URL that pre-fills the Application ID in the
 * Retrieve form. CEAC honors `?ApplicationID=<id>` on Default.aspx as
 * a deep link into the retrieve flow.
 */
export function retrievalUrlFor(applicationId: string): string {
  return `${CEAC_URLS.RETRIEVAL_BASE}${encodeURIComponent(applicationId)}`;
}

async function fillIfPresent(page: Page, selector: string, value: string): Promise<void> {
  const el = page.locator(selector).first();
  if ((await el.count()) === 0) return;
  try {
    await el.fill(value, { timeout: 3_000 });
  } catch {
    await assignDomValue(el, value);
  }
}

async function assignDomValue(locator: ReturnType<Page["locator"]>, value: string): Promise<void> {
  await locator.evaluate((node, nextValue) => {
    const input = node as HTMLInputElement | HTMLSelectElement;
    input.value = nextValue;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function clickAndSettle(page: Page, locator: ReturnType<Page["locator"]>): Promise<void> {
  try {
    await locator.click({ force: true, timeout: 10_000 });
  } catch {
    await locator.evaluate("el => el.click()");
  }
  try {
    await page.waitForLoadState("networkidle", { timeout: 30_000 });
  } catch {
    await page.waitForTimeout(3_000);
  }
}
