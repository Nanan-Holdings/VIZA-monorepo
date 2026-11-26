/**
 * France-Visas Keycloak registration flow.
 *
 * End-to-end:
 *   launch a standard Playwright Chromium browser
 *   → go to application entry URL (redirects to Keycloak login)
 *   → click "Create an account" to reach Keycloak registration
 *   → fill name / email / password / language
 *   → solve the registration image CAPTCHA when explicitly configured
 *   → wait for the verification email and open the official verification link
 *   → return credentials plus storageState for the subsequent sign-in/fill.
 */

import type { BrowserContext, Page } from "@playwright/test";
import { launchFvBrowser, type FvBrowserHandles } from "./browser";
import { FV_URLS, FV_REGISTRATION_SELECTORS } from "./selectors";
import { detectPage, waitForPage } from "./pages";
import { assertNoGate, ENTRY_RENDER_TIMEOUT_MS, waitForRenderedPage } from "./gates";
import type { MailboxProvider } from "./inbox-poller";
import { RegistrationFailedError } from "./errors";
import { redactOfficialUrl } from "../appointment-free-smoke";
import { pollInboxForVerificationLink } from "./inbox-poller";
import { reportBadCaptcha } from "../captcha";
import {
  solveRegistrationCaptcha,
  type FvCaptchaSolveWithTelemetry,
} from "./registration-captcha";

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
  enableCaptchaSolving?: boolean;
}

export interface FvRegistrationResult {
  email: string;
  password: string;
  verificationUrl: string;
  storageState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  captcha: FvCaptchaSolveWithTelemetry | null;
  runId?: string;
}

async function hasInvalidSecurityCodeMessage(page: { locator: (selector: string) => { innerText: (options?: { timeout?: number }) => Promise<string> } }): Promise<boolean> {
  const body = await page.locator("body").innerText({ timeout: 2_000 }).catch(() => "");
  return /invalid security code|code de sécurité invalide|security code.*try again/i.test(body);
}

/**
 * PII-free snapshot of the registration form after a submit that did not
 * advance: which fields are empty or invalid, whether the CAPTCHA token is
 * present, and any feedback text Keycloak shows. Field values are never read.
 */
async function describeRegistrationForm(page: Page): Promise<Record<string, unknown>> {
  return page
    .evaluate(
      ({ uuidSelector, captchaInputSelector }) => {
        const fields = Array.from(document.querySelectorAll("form input, form select")) as HTMLInputElement[];
        const visible = fields.filter((el) => el.type !== "hidden");
        const feedback = Array.from(
          document.querySelectorAll(
            '.alert, .kc-feedback-text, [id^="input-error"], .error, .invalid-feedback, [aria-live]',
          ),
        )
          .map((el) => (el as HTMLElement).innerText.replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .slice(0, 5);
        const captchaImage = document.querySelector("#captchaImage") as HTMLImageElement | null;
        return {
          url: location.pathname,
          emptyFields: visible.filter((el) => !el.value).map((el) => el.name || el.id),
          invalidFields: visible.filter((el) => !el.checkValidity()).map((el) => el.name || el.id),
          captchaUuidSet: Boolean((document.querySelector(uuidSelector) as HTMLInputElement | null)?.value),
          captchaAnswerLength: (document.querySelector(captchaInputSelector) as HTMLInputElement | null)?.value.length ?? null,
          captchaImageLoaded: Boolean(captchaImage?.complete && captchaImage.naturalWidth > 0),
          feedback,
        };
      },
      {
        uuidSelector: FV_REGISTRATION_SELECTORS.captchaUuidHidden,
        captchaInputSelector: FV_REGISTRATION_SELECTORS.captchaInput,
      },
    )
    .catch((error: unknown) => ({ describeFailed: error instanceof Error ? error.message : String(error) }));
}

/**
 * Walk through France-Visas registration after the applicant has explicitly
 * authorized live-assisted account creation. Only the registration image
 * CAPTCHA is solved; anti-bot, final validation, payment, and appointment
 * checkpoints remain out of scope.
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
    maxCaptchaAttempts = 3,
    verificationTimeoutMs = 180_000,
    enableCaptchaSolving = false,
  } = options;
  const language = input.language ?? "English";
  let captcha: FvCaptchaSolveWithTelemetry | null = null;

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
      // The current France-Visas form no longer asks for a password at
      // registration (it is set after the verification link); fill the
      // password fields only where an older form still shows them.
      await fillIfPresent(page, FV_REGISTRATION_SELECTORS.password, input.password);
      await fillIfPresent(page, FV_REGISTRATION_SELECTORS.passwordConfirm, input.password);
      await page.locator(FV_REGISTRATION_SELECTORS.languageSelect).first().selectOption(language);
    };

    if (!enableCaptchaSolving) {
      throw new RegistrationFailedError(
        "France-Visas registration CAPTCHA solving is disabled by configuration.",
        { url: redactOfficialUrl(page.url()), details: { runId, manualAction: "captcha_required" } },
      );
    }

    const telemetry: FvCaptchaSolveWithTelemetry["telemetry"] = [];
    let pageAfterSubmit: Awaited<ReturnType<typeof waitForPage>> | "registration" | null = null;
    let lastRegistrationFailure = "unknown";
    for (let attempt = 1; attempt <= maxCaptchaAttempts; attempt += 1) {
      await fillRegistrationForm();
      const outcome = await solveRegistrationCaptcha(page);
      if (outcome.status === "solved") {
        captcha = {
          solve: outcome.solve,
          telemetry,
        };
        telemetry.push({
          solveId: outcome.solve.solveId,
          durationMs: outcome.solve.durationMs,
          attempt,
          outcome: "solved",
        });
      } else if (outcome.status === "no_captcha") {
        telemetry.push({ solveId: "", durationMs: 0, attempt, outcome: "failed" });
      } else {
        telemetry.push({ solveId: "", durationMs: 0, attempt, outcome: "failed" });
        lastRegistrationFailure = outcome.status === "failed" ? outcome.reason : outcome.status;
        if (attempt === maxCaptchaAttempts) break;
        await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => undefined);
        continue;
      }

      const submit = page.locator(FV_REGISTRATION_SELECTORS.submit).first();
      await submit.click();
      pageAfterSubmit = await waitForPage(page, ["check_mailbox", "email_verified", "login", "accueil"], {
        timeoutMs: 45_000,
      }).catch(async () => {
        const detected = await detectPage(page);
        if (detected.id === "registration") {
          return detected.id;
        }
        throw new RegistrationFailedError(
          `France-Visas registration did not reach the email verification step; detected ${detected.id}.`,
          { url: redactOfficialUrl(detected.url), details: { runId, captchaTelemetry: telemetry } },
        );
      });

      if (pageAfterSubmit !== "registration") break;

      const invalidSecurityCode = await hasInvalidSecurityCodeMessage(page);
      lastRegistrationFailure = invalidSecurityCode
        ? "invalid_security_code"
        : "registration_form_still_visible";
      console.warn(
        `[france-visas] registration attempt ${attempt}/${maxCaptchaAttempts} did not advance`,
        JSON.stringify({
          runId,
          captcha: outcome.status,
          captchaAnswerLength: outcome.status === "solved" ? outcome.solve.text.trim().length : null,
          failure: lastRegistrationFailure,
          form: await describeRegistrationForm(page),
        }),
      );
      if (outcome.status === "solved") {
        telemetry[telemetry.length - 1] = {
          solveId: outcome.solve.solveId,
          durationMs: outcome.solve.durationMs,
          attempt,
          outcome: invalidSecurityCode ? "wrong_answer_retry" : "failed",
        };
        try { await reportBadCaptcha(outcome.solve.solveId); } catch { /* best-effort */ }
      }
      if (attempt === maxCaptchaAttempts) break;
      await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => undefined);
    }

    if (pageAfterSubmit === "registration" || pageAfterSubmit === null) {
      throw new RegistrationFailedError(
        `France-Visas registration did not advance after CAPTCHA submission (${lastRegistrationFailure}).`,
        { url: redactOfficialUrl(page.url()), details: { runId, captchaTelemetry: telemetry } },
      );
    }

    const verificationUrl = await pollInboxForVerificationLink(options.mailbox, {
      mailboxAddress: input.email,
      timeoutMs: verificationTimeoutMs,
    });

    await page.goto(verificationUrl.toString(), {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await waitForRenderedPage(page, ENTRY_RENDER_TIMEOUT_MS);
    // The verification link now leads to a "choose your password" step.
    if (await setPasswordIfAsked(page, input.password)) {
      await waitForRenderedPage(page, ENTRY_RENDER_TIMEOUT_MS);
    }
    await waitForPage(page, ["email_verified", "login", "accueil"], { timeoutMs: 60_000 }).catch(async () => {
      const detected = await detectPage(page);
      if (detected.id === "registration" || detected.id === "check_mailbox" || detected.id === "session_expired") {
        throw new RegistrationFailedError(
          `France-Visas email verification did not complete; detected ${detected.id}.`,
          { url: redactOfficialUrl(detected.url), details: { runId } },
        );
      }
    });
    await assertNoGate(page);

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
          { url: redactOfficialUrl(page.url()), details: { runId } },
        );
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

/** Fill the first matching field if the page shows one. */
async function fillIfPresent(page: Page, selector: string, value: string): Promise<boolean> {
  const field = page.locator(selector).first();
  if ((await field.count()) === 0) return false;
  await field.fill(value);
  return true;
}

/**
 * If the page asks the applicant to choose a password (Keycloak's
 * update-password step after email verification), fill every visible password
 * field with the generated password and submit. Returns whether it did.
 */
export async function setPasswordIfAsked(page: Page, password: string): Promise<boolean> {
  const fields = page.locator('input[type="password"]:visible');
  const count = await fields.count();
  if (count === 0) return false;
  for (let index = 0; index < count; index += 1) {
    await fields.nth(index).fill(password);
  }
  const submit = page.locator('button[type="submit"], input[type="submit"]').first();
  await Promise.all([
    page.waitForLoadState("domcontentloaded", { timeout: 60_000 }).catch(() => undefined),
    submit.click(),
  ]);
  return true;
}

export type FvStealthHandles = FvBrowserHandles;
