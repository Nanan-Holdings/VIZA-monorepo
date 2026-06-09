/**
 * France-Visas Keycloak registration flow — manual checkpoint scaffold.
 *
 * End-to-end:
 *   launch a standard Playwright Chromium browser
 *   → go to application entry URL (redirects to Keycloak login)
 *   → click "Create an account" to reach Keycloak registration
 *   → fill name / email / password / language
 *   → stop before CAPTCHA / email verification and ask the applicant to
 *     complete account creation manually.
 */

import type { BrowserContext } from "@playwright/test";
import { launchFvBrowser, type FvBrowserHandles } from "./browser";
import { FV_URLS, FV_REGISTRATION_SELECTORS } from "./selectors";
import { waitForPage } from "./pages";
import { assertNoGate } from "./gates";
import type { MailboxProvider } from "./inbox-poller";
import { RegistrationFailedError } from "./errors";

export interface FvRegistrationInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  /** Keycloak locale. "Français"/"English"/"Español" — display text is the value. Default "English". */
  language?: "Français" | "English" | "Español";
}

export interface FvRegistrationOptions {
  mailbox: MailboxProvider;
  headless?: boolean;
  maxCaptchaAttempts?: number;
  verificationTimeoutMs?: number;
  runId?: string;
}

export interface FvRegistrationResult {
  email: string;
  password: string;
  verificationUrl: string;
  storageState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  captcha: null;
  runId?: string;
}

/**
 * Walk to the France-Visas registration page and stop at the manual account
 * creation checkpoint. Automated CAPTCHA solving and email verification are
 * intentionally disabled for France live-assisted runs.
 *
 * Throws `RegistrationFailedError` (or other FvError subclasses) on
 * unrecoverable failure. Transient failures inside the CAPTCHA loop are
 * retried internally up to `maxCaptchaAttempts`.
 */
export async function registerFvAccount(
  input: FvRegistrationInput,
  options: FvRegistrationOptions,
): Promise<FvRegistrationResult> {
  const {
    headless = true,
    runId,
  } = options;
  const language = input.language ?? "English";

  const handles = await launchFvBrowser({
    headless,
  });
  const { browser, context, page } = handles;

  try {
    // Start from the application entry URL — this sets OAuth session cookies
    // so we can reach Keycloak registration with a valid tab_id/client_data.
    await page.goto(`${FV_URLS.ACCUEIL.replace(/\/accueil\.xhtml$/, "/")}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await assertNoGate(page);

    // Click "Create an account" on the login page. This navigates to
    // /login-actions/registration with the session params populated.
    const createBtn = page.locator(
      'button:has-text("Create an account"), a:has-text("Create an account"), button:has-text("Créer un compte")',
    ).first();
    await createBtn.waitFor({ state: "visible", timeout: 30_000 });
    await Promise.all([
      page.waitForURL(/login-actions\/registration/i, { timeout: 30_000 }).catch(() => undefined),
      createBtn.click(),
    ]);
    await waitForPage(page, "registration", { timeoutMs: 30_000 });

    const fillRegistrationForm = async (): Promise<void> => {
      await page.locator(FV_REGISTRATION_SELECTORS.lastName).first().fill(input.lastName);
      await page.locator(FV_REGISTRATION_SELECTORS.firstName).first().fill(input.firstName);
      await page.locator(FV_REGISTRATION_SELECTORS.email).first().fill(input.email);
      await page.locator(FV_REGISTRATION_SELECTORS.emailConfirmation).first().fill(input.email);
      await page.locator(FV_REGISTRATION_SELECTORS.password).first().fill(input.password);
      await page.locator(FV_REGISTRATION_SELECTORS.passwordConfirm).first().fill(input.password);
      await page.locator(FV_REGISTRATION_SELECTORS.languageSelect).first().selectOption(language);
    };

    await fillRegistrationForm();
    throw new RegistrationFailedError(
      "France-Visas account creation requires manual CAPTCHA and email verification. Automated CAPTCHA solving is disabled for live assisted France runs.",
      { url: page.url(), details: { runId, manualAction: "account_creation_required" } },
    );
  } catch (err) {
    throw err instanceof RegistrationFailedError
      ? err
      : new RegistrationFailedError(
          `France-Visas registration failed: ${err instanceof Error ? err.message : String(err)}`,
          { url: page.url(), details: { runId } },
        );
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

export type FvStealthHandles = FvBrowserHandles;
