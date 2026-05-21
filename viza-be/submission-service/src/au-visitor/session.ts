/**
 * ImmiAccount session bootstrap for the Subclass 600 prefill assistant.
 *
 * ImmiAccount enforces TOTP MFA on every login. The session helper
 * exposes a callback hook (`mfaCodeProvider`) so the surrounding
 * orchestrator can prompt the operator (or a stored secret) for the
 * 6-digit code without hard-coding credentials in the runner.
 *
 * Login URL: https://online.immi.gov.au/lusc/login
 * After login the user is redirected to the "My applications summary"
 * dashboard at /ola/app, where a "New application" button opens the
 * picker for VSS-AP-600.
 */

import type { Page, BrowserContext } from "playwright";
import { MfaRequiredError, SessionBootstrapError } from "./errors";

const LOGIN_URL = "https://online.immi.gov.au/lusc/login";
const APPLICATIONS_URL = "https://online.immi.gov.au/ola/app";
const NEW_APP_URL = "https://online.immi.gov.au/elp/app?action=new&formId=VSS-AP-600";

export interface AuLoginCredentials {
  username: string;
  password: string;
  /**
   * Optional: returns a 6-digit TOTP code. If omitted, the orchestrator
   * must throw `MfaRequiredError` and let a higher-level UI capture
   * the code from the operator.
   */
  mfaCodeProvider?: () => Promise<string>;
}

export interface AuSessionBootstrapResult {
  page: Page;
  /** True if this run reused a previously stored authenticated session. */
  reusedSession: boolean;
}

/**
 * Drive the ImmiAccount login flow end-to-end. Returns when the
 * applications dashboard is reached (post-MFA, post-"Login successful"
 * splash).
 */
export async function loginToImmiAccount(
  context: BrowserContext,
  credentials: AuLoginCredentials,
): Promise<AuSessionBootstrapResult> {
  const page = await context.newPage();
  await page.goto(LOGIN_URL, { waitUntil: "networkidle" });

  // If we land on the dashboard already, an existing session is being
  // reused.
  if (page.url().includes("/ola/app")) {
    return { page, reusedSession: true };
  }

  await page.fill('input[name="username"]', credentials.username);
  await page.fill('input[name="password"]', credentials.password);
  await Promise.all([
    page.waitForLoadState("networkidle"),
    page.click('button[name="login"]:not([name="cancel"])'),
  ]);

  // MFA prompt
  const mfaInput = page.locator('input[name="totpCode"], input[aria-label*="Authentication code" i]').first();
  if (await mfaInput.isVisible().catch(() => false)) {
    if (!credentials.mfaCodeProvider) {
      throw new MfaRequiredError(
        "ImmiAccount required a 6-digit TOTP code but no mfaCodeProvider was supplied.",
        { url: page.url() },
      );
    }
    const code = await credentials.mfaCodeProvider();
    if (!/^\d{6}$/.test(code)) {
      throw new MfaRequiredError(`mfaCodeProvider returned a non-6-digit value: ${code}`);
    }
    await mfaInput.fill(code);
    await Promise.all([
      page.waitForLoadState("networkidle"),
      page.locator('button:has-text("Submit")').click(),
    ]);
  }

  // Login-successful splash → click Next
  const nextBtn = page.locator('button:has-text("Next")').first();
  if (await nextBtn.isVisible().catch(() => false)) {
    await Promise.all([
      page.waitForURL(/\/ola\/app/),
      nextBtn.click(),
    ]);
  }

  if (!page.url().includes("/ola/app")) {
    throw new SessionBootstrapError("Did not reach the applications dashboard after login.", {
      url: page.url(),
    });
  }

  return { page, reusedSession: false };
}

/**
 * Open a fresh Subclass 600 application from the dashboard.
 * Caller must already be logged in.
 */
export async function startNewVisitor600Application(page: Page): Promise<void> {
  await page.goto(APPLICATIONS_URL, { waitUntil: "networkidle" });
  await page.click("#btn_newapp");
  // Picker tree → Visitor → Visitor Visa (600)
  await page.waitForSelector("#mainpanel_parentSection_1b0a0bg1b", { state: "visible" });
  await Promise.all([
    page.waitForURL(/formId=VSS-AP-600/),
    page.click("#mainpanel_parentSection_1b0a0bg1b"),
  ]);
  await page.waitForLoadState("networkidle");
}

/**
 * Resume a draft application by Transaction Reference Number (TRN).
 * Subclass 600 saves drafts after every Next click; the draft is
 * surfaced on the dashboard with the TRN displayed.
 */
export async function resumeApplicationByTrn(page: Page, trn: string): Promise<void> {
  await page.goto(APPLICATIONS_URL, { waitUntil: "networkidle" });
  // The dashboard renders the TRN as plain text in the table — click
  // the row's "Edit" link.
  const row = page.locator(`tr:has-text("${trn}")`).first();
  if (!(await row.isVisible().catch(() => false))) {
    throw new SessionBootstrapError(`No draft application found for TRN ${trn}.`, { url: page.url() });
  }
  await Promise.all([
    page.waitForURL(/\/elp\/app/),
    row.locator('button:has-text("Edit"), a:has-text("Edit")').first().click(),
  ]);
  await page.waitForLoadState("networkidle");
}

export const URLS = {
  login: LOGIN_URL,
  applications: APPLICATIONS_URL,
  newApplication: NEW_APP_URL,
};
