/**
 * France-Visas Keycloak registration flow — full implementation.
 *
 * End-to-end:
 *   launch stealth browser
 *   → go to application entry URL (redirects to Keycloak login)
 *   → click "Create an account" to reach Keycloak registration
 *   → fill name / email / password / language
 *   → solve CAPTCHA (retries up to maxCaptchaAttempts)
 *   → submit → wait for check_mailbox
 *   → poll mailbox provider for verification link
 *   → click link → land on accueil
 *   → return storageState for downstream sign-in reuse
 */

import type { BrowserContext } from "@playwright/test";
import { launchStealthBrowser, type StealthBrowserHandles } from "../ceac/stealth-browser";
import { FV_URLS, FV_REGISTRATION_SELECTORS } from "./selectors";
import { waitForPage } from "./pages";
import { assertNoGate } from "./gates";
import {
  solveRegistrationCaptchaWithRetry,
  type FvCaptchaSolveWithTelemetry,
} from "./registration-captcha";
import { pollInboxForVerificationLink, type MailboxProvider } from "./inbox-poller";
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
  captcha: FvCaptchaSolveWithTelemetry | null;
  runId?: string;
}

/**
 * Run one end-to-end France-Visas registration. On success the returned
 * storageState is a fully-authenticated session sitting on accueil.xhtml.
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
    mailbox,
    headless = true,
    maxCaptchaAttempts = 5,
    verificationTimeoutMs = 120_000,
    runId,
  } = options;
  const language = input.language ?? "English";

  const handles = await launchStealthBrowser({
    headless,
    hardening: "france-visas",
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
    const captcha = await solveRegistrationCaptchaWithRetry(
      page,
      maxCaptchaAttempts,
      fillRegistrationForm,
    );

    // Submit. The submit button toggles from disabled → enabled once all
    // client-side validations pass, which includes the CAPTCHA answer.
    await page.locator(FV_REGISTRATION_SELECTORS.submit).first().click();
    await waitForPage(page, "check_mailbox", { timeoutMs: 30_000 });

    // Mailbox provider polls for the verification email and returns the URL.
    const verificationUrl = await pollInboxForVerificationLink(mailbox, {
      mailboxAddress: input.email,
      timeoutMs: verificationTimeoutMs,
    });

    // Clicking the verification link authenticates the new account and
    // redirects to the OAuth callback → accueil.
    await page.goto(verificationUrl.toString(), { waitUntil: "domcontentloaded", timeout: 60_000 });
    await waitForPage(page, ["accueil", "email_verified"], { timeoutMs: 60_000 });

    // Some Keycloak themes land on an intermediate "email verified, continue"
    // page before the auth callback fires. Look for a Continue link.
    const cont = page.locator('a:has-text("Continue"), button:has-text("Continue")').first();
    if ((await cont.count()) > 0) {
      await cont.click().catch(() => undefined);
      await waitForPage(page, "accueil", { timeoutMs: 60_000 });
    }

    const storageState = await context.storageState();
    return {
      email: input.email,
      password: input.password,
      verificationUrl: verificationUrl.toString(),
      storageState,
      captcha,
      runId,
    };
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

export type FvStealthHandles = StealthBrowserHandles;
