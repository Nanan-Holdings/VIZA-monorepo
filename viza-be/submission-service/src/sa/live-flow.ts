import { randomInt } from "node:crypto";
import type { Page } from "@playwright/test";
import {
  reportBadCaptcha,
  reportGoodCaptcha,
  solveImageCaptcha,
  TwoCaptchaApiError,
  type CaptchaSolveResult,
} from "../captcha/two-captcha.js";
import type { SaDocumentKey } from "./field-mappings.js";
import {
  assertSaudiPrivacyAuthorization,
  type SaudiPrivacyAuthorization,
} from "./privacy-authorization.js";

const ACCOUNT_EMAIL_KEY = "sa.visitsaudi.account_email";
const ACCOUNT_PASSWORD_KEY = "sa.visitsaudi.account_password";
const ACCOUNT_STATUS_KEY = "sa.visitsaudi.account_status";
const ACCOUNT_SECRET_QUESTION_KEY = "sa.visitsaudi.secret_question";
const ACCOUNT_SECRET_ANSWER_KEY = "sa.visitsaudi.secret_answer";
const ACTOR = "sa-visitsaudi@submission-service";
const SA_EMAIL_AUTHSERV_ID = "mx.cloudflare.net";

export const SA_OFFICIAL_HOST = "visa.visitsaudi.com";
export const SA_LOGIN_URL = "https://visa.visitsaudi.com/Login?lang=en";
export const SA_PUBLIC_SELECTORS = {
  passportType: "#PassportType",
  nationality: "#Nationality",
  captchaImage: "#imgCaptcha",
  captchaInput: "#CaptchaCode",
  eligibilityNext: "#btnVerify",
  loginEmail: "#EmailId",
  loginPassword: "#Password",
  loginSubmit: "#btnSignIn",
  registrationFirstName: "#FirstName",
  registrationLastName: "#LastName",
  registrationCountryCode: "#CountryCode",
  registrationMobileNumber: "#MobileNumber",
  registrationEmail: "#Email",
  registrationConfirmEmail: "#AlternativeEmail",
  registrationSecretQuestion: "#SecretQuestion",
  registrationSecretAnswer: "#Answer",
  registrationPassword: "#password",
  registrationConfirmPassword: "#ConfirmPassword",
  registrationPrivacy: "#chkPPAgree",
  registrationSubmit: "#btnAdd",
} as const;

export function isOfficialSaudiPortalUrl(value: string | URL): boolean {
  try {
    const url = value instanceof URL ? value : new URL(value);
    return url.protocol === "https:" &&
      url.hostname.toLowerCase() === SA_OFFICIAL_HOST &&
      !url.port &&
      !url.username &&
      !url.password;
  } catch {
    return false;
  }
}

export function requireOfficialSaudiPortalUrl(value: string, boundary: string): string {
  if (!isOfficialSaudiPortalUrl(value)) {
    throw new Error(`VisitSaudi ${boundary} left the verified official host`);
  }
  return value;
}

export function redactSaudiRunnerError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[redacted URL]")
    .replace(/\b(?:token|code|upn|activation|verify|confirmation)=([^\s&]+)/gi, (match) =>
      `${match.slice(0, match.indexOf("=") + 1)}[redacted]`
    )
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted email]");
}

export interface SaudiLiveConfig {
  preSubmitEnabled: boolean;
  accountPreparationEnabled: boolean;
  loginEnabled: boolean;
  twoCaptchaEnabled: boolean;
  documentUploadEnabled: boolean;
  paymentCheckpointEnabled: boolean;
}

export function readSaudiLiveConfig(env: NodeJS.ProcessEnv = process.env): SaudiLiveConfig {
  const enabled = (name: string): boolean => env[name]?.trim().toLowerCase() === "true";
  return {
    preSubmitEnabled: enabled("SA_PRE_SUBMIT_QA_ENABLED"),
    accountPreparationEnabled: enabled("SA_ACCOUNT_PREPARATION_ENABLED"),
    loginEnabled: enabled("SA_LOGIN_ENABLED"),
    twoCaptchaEnabled: enabled("SA_TWOCAPTCHA_ENABLED"),
    documentUploadEnabled: enabled("SA_DOCUMENT_UPLOAD_ENABLED"),
    paymentCheckpointEnabled: enabled("SA_PAYMENT_CHECKPOINT_ENABLED"),
  };
}

export function validateSaudiLiveConfig(
  config: SaudiLiveConfig,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const blockers: string[] = [];
  if ((config.accountPreparationEnabled || config.loginEnabled) && !env.SUBMISSION_RESULT_SECRET_KEY?.trim()) {
    blockers.push("SUBMISSION_RESULT_SECRET_KEY");
  }
  if ((config.accountPreparationEnabled || config.loginEnabled) && !config.twoCaptchaEnabled) {
    blockers.push("SA_TWOCAPTCHA_ENABLED");
  }
  if (config.twoCaptchaEnabled && !env.TWOCAPTCHA_API_KEY?.trim()) {
    blockers.push("TWOCAPTCHA_API_KEY");
  }
  if (config.documentUploadEnabled && !config.loginEnabled) {
    blockers.push("SA_LOGIN_ENABLED");
  }
  if (config.paymentCheckpointEnabled && !config.documentUploadEnabled) {
    blockers.push("SA_DOCUMENT_UPLOAD_ENABLED");
  }
  if (
    config.preSubmitEnabled &&
    env.SA_REQUIRE_BROWSER_API?.trim().toLowerCase() === "true" &&
    !env.SA_BROWSER_API_ENDPOINT?.trim() &&
    !env.SA_BRIGHTDATA_BROWSER_API_ENDPOINT?.trim()
  ) {
    blockers.push("SA_BROWSER_API_ENDPOINT");
  }
  return blockers;
}

export function generateSaudiAccountPassword(): string {
  const groups = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnopqrstuvwxyz",
    "23456789",
    "!@#$%^&*_~",
  ];
  const all = groups.join("");
  const characters = groups.map((group) => group[randomInt(group.length)]);
  while (characters.length < 16) characters.push(all[randomInt(all.length)]);
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swap = randomInt(index + 1);
    [characters[index], characters[swap]] = [characters[swap], characters[index]];
  }
  return characters.join("");
}

export function isValidSaudiAccountPassword(value: string): boolean {
  return value.length >= 8 && value.length <= 20 &&
    /^[A-Za-z0-9!@#$%^&*()\-_=+~]+$/.test(value) &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[!%&@#$^*_~]/.test(value);
}

export function generateSaudiSecretAnswer(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from({ length: 20 }, () => alphabet[randomInt(alphabet.length)]).join("");
}

export interface SaudiManagedAccount {
  email: string;
  password: string;
  secretQuestion: string;
  secretAnswer: string;
  created: boolean;
  confirmed: boolean;
  registrationSubmitted: boolean;
}

/**
 * Prepare credentials in the encrypted applicant vault. This does not claim
 * that an official VisitSaudi account exists and does not open the portal.
 */
export async function prepareSaudiManagedAccount(input: {
  applicantId: string;
  applicationId: string;
  alias: string;
  privacyAuthorization: SaudiPrivacyAuthorization | null;
  correlationId?: string;
}): Promise<SaudiManagedAccount> {
  assertSaudiPrivacyAuthorization(input.privacyAuthorization, input.applicationId);
  const { applicantVault } = await import("../applicant-vault.js");
  const alias = input.alias.trim().toLowerCase();
  const managedDomain = process.env.INBOX_ALIAS_DOMAIN?.trim().toLowerCase().replace(/^@/, "") || "viza.it.com";
  if (!/^appl-[a-z0-9]+@/i.test(alias) || !alias.endsWith(`@${managedDomain}`)) {
    throw new Error("Saudi account preparation requires the applicant's VIZA-managed alias");
  }
  const opts = { actor: ACTOR, correlationId: input.correlationId };
  const [storedEmail, storedPassword, storedStatus, storedSecretQuestion, storedSecretAnswer] = await Promise.all([
    applicantVault.get(input.applicantId, ACCOUNT_EMAIL_KEY, opts),
    applicantVault.get(input.applicantId, ACCOUNT_PASSWORD_KEY, opts),
    applicantVault.get(input.applicantId, ACCOUNT_STATUS_KEY, opts),
    applicantVault.get(input.applicantId, ACCOUNT_SECRET_QUESTION_KEY, opts),
    applicantVault.get(input.applicantId, ACCOUNT_SECRET_ANSWER_KEY, opts),
  ]);
  if (storedEmail && storedEmail.toLowerCase() !== alias) {
    throw new Error("Stored VisitSaudi account alias does not match the applicant alias");
  }
  const validStoredPassword = storedPassword && isValidSaudiAccountPassword(storedPassword)
    ? storedPassword
    : null;
  const validStoredSecretAnswer = storedSecretAnswer && /^(?!\s*$)[A-Za-z0-9 ]{2,250}$/.test(storedSecretAnswer)
    ? storedSecretAnswer
    : null;
  const password = validStoredPassword ?? generateSaudiAccountPassword();
  const secretQuestion = storedSecretQuestion ?? "1";
  const secretAnswer = validStoredSecretAnswer ?? generateSaudiSecretAnswer();
  const writes: Array<Promise<void>> = [];
  if (!storedEmail) {
    writes.push(applicantVault.set(input.applicantId, ACCOUNT_EMAIL_KEY, alias, {
      ...opts,
      note: "VIZA-managed VisitSaudi account alias",
    }));
  }
  if (!validStoredPassword) {
    writes.push(applicantVault.set(input.applicantId, ACCOUNT_PASSWORD_KEY, password, {
      ...opts,
      note: "VIZA-managed VisitSaudi account password; official registration not yet confirmed",
    }));
  }
  if (!storedSecretQuestion) {
    writes.push(applicantVault.set(input.applicantId, ACCOUNT_SECRET_QUESTION_KEY, secretQuestion, {
      ...opts,
      note: "VIZA-managed VisitSaudi recovery question identifier",
    }));
  }
  if (!validStoredSecretAnswer) {
    writes.push(applicantVault.set(input.applicantId, ACCOUNT_SECRET_ANSWER_KEY, secretAnswer, {
      ...opts,
      note: "VIZA-managed VisitSaudi recovery answer",
    }));
  }
  if (!storedStatus) {
    writes.push(applicantVault.set(input.applicantId, ACCOUNT_STATUS_KEY, "prepared", {
      ...opts,
      note: "VisitSaudi credential lifecycle; official account not yet confirmed",
    }));
  }
  await Promise.all(writes);
  return {
    email: alias,
    password,
    secretQuestion,
    secretAnswer,
    created: !validStoredPassword,
    confirmed: storedStatus === "confirmed",
    registrationSubmitted: storedStatus === "registration_submitted",
  };
}

async function markSaudiManagedAccountStatus(input: {
  applicantId: string;
  status: "registration_submitted" | "confirmed";
  correlationId?: string;
  note: string;
}): Promise<void> {
  const { applicantVault } = await import("../applicant-vault.js");
  await applicantVault.set(input.applicantId, ACCOUNT_STATUS_KEY, input.status, {
    actor: ACTOR,
    correlationId: input.correlationId,
    note: input.note,
  });
}

export async function markSaudiManagedAccountConfirmed(input: {
  applicantId: string;
  applicationId: string;
  privacyAuthorization: SaudiPrivacyAuthorization | null;
  correlationId?: string;
}): Promise<void> {
  assertSaudiPrivacyAuthorization(input.privacyAuthorization, input.applicationId);
  await markSaudiManagedAccountStatus({
    applicantId: input.applicantId,
    status: "confirmed",
    correlationId: input.correlationId,
    note: "VisitSaudi account activation verified from official page evidence",
  });
}

export async function markSaudiManagedAccountRegistrationSubmitted(input: {
  applicantId: string;
  applicationId: string;
  privacyAuthorization: SaudiPrivacyAuthorization | null;
  correlationId?: string;
}): Promise<void> {
  assertSaudiPrivacyAuthorization(input.privacyAuthorization, input.applicationId);
  await markSaudiManagedAccountStatus({
    applicantId: input.applicantId,
    status: "registration_submitted",
    correlationId: input.correlationId,
    note: "VisitSaudi accepted registration and activation email is pending",
  });
}

export async function solveSaudiNumericCaptchaResult(
  page: Page,
  maxAttempts = 3,
): Promise<CaptchaSolveResult> {
  const image = page.locator(SA_PUBLIC_SELECTORS.captchaImage);
  if ((await image.count()) !== 1) throw new Error("VisitSaudi CAPTCHA image is unavailable");

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const buffer = await image.screenshot({ type: "png" });
      const solve = await solveImageCaptcha(buffer, 120_000, {
        numeric: 1,
        minLength: 5,
        maxLength: 5,
        case: false,
        comment: "Five-digit VisitSaudi CAPTCHA",
      });
      const value = solve.text.trim();
      if (/^\d{5}$/.test(value)) return { ...solve, text: value };
      lastError = new Error("TWOCAPTCHA returned a non-five-digit VisitSaudi solution");
    } catch (error) {
      lastError = error;
      const retryable =
        error instanceof TwoCaptchaApiError &&
        error.apiErrorCode === "ERROR_CAPTCHA_UNSOLVABLE";
      if (!retryable) throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("TWOCAPTCHA could not solve the VisitSaudi CAPTCHA");
}

export async function solveSaudiNumericCaptcha(page: Page, maxAttempts = 3): Promise<string> {
  return (await solveSaudiNumericCaptchaResult(page, maxAttempts)).text;
}

export async function advanceSaudiEligibilityCaptcha(
  page: Page,
  applicationId: string,
  privacyAuthorization: SaudiPrivacyAuthorization | null,
): Promise<SaudiPortalState> {
  assertSaudiPrivacyAuthorization(privacyAuthorization, applicationId);
  requireOfficialSaudiPortalUrl(page.url(), "eligibility CAPTCHA");
  const captcha = await solveSaudiNumericCaptchaResult(page);
  await page.locator(SA_PUBLIC_SELECTORS.captchaInput).fill(captcha.text);
  await page.locator(SA_PUBLIC_SELECTORS.eligibilityNext).click();
  await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(1_000);
  requireOfficialSaudiPortalUrl(page.url(), "eligibility transition");
  const state = classifySaudiPortalState({
    url: page.url(),
    title: await page.title().catch(() => ""),
    bodyText: await page.locator("body").innerText({ timeout: 5_000 }).catch(() => ""),
    hasCaptchaImage: (await page.locator(SA_PUBLIC_SELECTORS.captchaImage).count()) > 0,
    hasLoginEmail: (await page.locator(SA_PUBLIC_SELECTORS.loginEmail).count()) > 0,
    hasDocumentInput: (await page.locator('input[type="file"]').count()) > 0,
  });
  if (state.checkpoint === "captcha") {
    await reportBadCaptcha(captcha.solveId).catch(() => undefined);
  } else {
    await reportGoodCaptcha(captcha.solveId).catch(() => undefined);
  }
  return state;
}

export type SaudiPortalCheckpoint =
  | "account_registration"
  | "application"
  | "account_exists"
  | "activation_pending"
  | "activation_verified"
  | "captcha"
  | "credentials_rejected"
  | "document_upload"
  | "login"
  | "maintenance"
  | "payment"
  | "selector_drift"
  | "sms_otp"
  | "unknown";

export interface SaudiPortalState {
  checkpoint: SaudiPortalCheckpoint;
  message: string;
  observedAmount?: string;
  observedCurrency?: string;
  observedComponents?: string[];
}

export function classifySaudiPortalState(input: {
  url: string;
  title: string;
  bodyText: string;
  hasCaptchaImage?: boolean;
  hasLoginEmail?: boolean;
  hasDocumentInput?: boolean;
  hasPaymentControl?: boolean;
  productVerified?: boolean;
}): SaudiPortalState {
  if (!isOfficialSaudiPortalUrl(input.url)) {
    return {
      checkpoint: "selector_drift",
      message: "VisitSaudi navigation left the verified official host.",
    };
  }
  const body = input.bodyText.replace(/\s+/g, " ").trim();
  const haystack = `${input.url} ${input.title} ${body}`.toLowerCase();
  if (/maintenance|temporarily unavailable|coming back soon/.test(haystack)) {
    return { checkpoint: "maintenance", message: "VisitSaudi is showing an official maintenance page." };
  }
  if (/\/login\/otpauth(?:\?|$)/i.test(input.url) || /verification code/i.test(body)) {
    return {
      checkpoint: "sms_otp",
      message: "VisitSaudi accepted the managed credentials and requires the phone verification code.",
    };
  }
  if (input.hasLoginEmail || /\/login(?:\?|$)/i.test(input.url)) {
    return { checkpoint: input.hasCaptchaImage ? "captcha" : "login", message: "VisitSaudi login is visible." };
  }
  if (/\/registration\/(?:add|register)(?:\?|$)/i.test(input.url) || (/registration/i.test(input.url) && /create.*account|sign up/i.test(body))) {
    return { checkpoint: "account_registration", message: "VisitSaudi account registration is visible." };
  }
  const amount = body.match(/(?:SAR|ر\.س\.?|Saudi Riyals?)\s*([0-9][0-9,.]*)|([0-9][0-9,.]*)\s*(?:SAR|ر\.س\.?|Saudi Riyals?)/i);
  if (
    input.productVerified === true &&
    input.hasPaymentControl === true &&
    /payment|pay now|insurance premium|order summary/i.test(body) &&
    amount
  ) {
    const observedComponents = [
      /visa fee/i.test(body) ? "visa_fee" : "",
      /insurance/i.test(body) ? "insurance" : "",
      /vat|value added tax/i.test(body) ? "vat" : "",
    ].filter(Boolean);
    return {
      checkpoint: "payment",
      message: "VisitSaudi payment or insurance summary is visible; no payment action was taken.",
      observedAmount: amount[1] ?? amount[2],
      observedCurrency: "SAR",
      observedComponents,
    };
  }
  if (input.hasDocumentInput && /passport|photo|upload/i.test(body)) {
    return { checkpoint: "document_upload", message: "VisitSaudi document upload controls are visible." };
  }
  if (/my application|application details|applicant information/i.test(body)) {
    return { checkpoint: "application", message: "VisitSaudi authenticated application content is visible." };
  }
  if (input.hasCaptchaImage) {
    return { checkpoint: "captcha", message: "VisitSaudi CAPTCHA is visible." };
  }
  return { checkpoint: "unknown", message: "VisitSaudi page state is not yet evidenced." };
}

function normalizeSaudiRegistrationPhone(countryCode: string, phoneNumber: string): {
  countryCode: string;
  localNumber: string;
} {
  const digits = countryCode.replace(/\D/g, "");
  if (!digits) throw new Error("VisitSaudi registration requires a numeric phone country code");
  const normalizedCountryCode = `+${digits}`;
  let localNumber = phoneNumber.replace(/\D/g, "");
  if (localNumber.startsWith(digits) && localNumber.length > digits.length + 4) {
    localNumber = localNumber.slice(digits.length);
  }
  if (!/^\d{5,15}$/.test(localNumber)) {
    throw new Error("VisitSaudi registration requires a valid local mobile number");
  }
  return { countryCode: normalizedCountryCode, localNumber };
}

async function assertSingleSaudiControl(page: Page, selector: string, label: string): Promise<void> {
  if ((await page.locator(selector).count()) !== 1) {
    throw new Error(`VisitSaudi ${label} selector drift`);
  }
}

/** Fill the verified empty registration form without clicking Register. */
export async function fillSaudiRegistrationForm(input: {
  page: Page;
  applicationId: string;
  answers: Record<string, string>;
  account: SaudiManagedAccount;
  privacyAuthorization: SaudiPrivacyAuthorization | null;
}): Promise<void> {
  assertSaudiPrivacyAuthorization(input.privacyAuthorization, input.applicationId);
  requireOfficialSaudiPortalUrl(input.page.url(), "registration form");
  const selectors = SA_PUBLIC_SELECTORS;
  const requiredControls = [
    [selectors.registrationFirstName, "registration first-name"],
    [selectors.registrationLastName, "registration last-name"],
    [selectors.registrationCountryCode, "registration country-code"],
    [selectors.registrationMobileNumber, "registration mobile-number"],
    [selectors.registrationEmail, "registration email"],
    [selectors.registrationConfirmEmail, "registration email confirmation"],
    [selectors.registrationSecretQuestion, "registration recovery-question"],
    [selectors.registrationSecretAnswer, "registration recovery-answer"],
    [selectors.registrationPassword, "registration password"],
    [selectors.registrationConfirmPassword, "registration password confirmation"],
    [selectors.registrationPrivacy, "Privacy Policy checkbox"],
    [selectors.registrationSubmit, "registration submit"],
    [selectors.captchaImage, "registration CAPTCHA image"],
    [selectors.captchaInput, "registration CAPTCHA input"],
  ] as const;
  for (const [selector, label] of requiredControls) {
    await assertSingleSaudiControl(input.page, selector, label);
  }

  const firstName = input.answers.given_name?.trim();
  const lastName = input.answers.family_name?.trim();
  if (!firstName || !lastName) throw new Error("VisitSaudi registration requires applicant first and last names");
  const phone = normalizeSaudiRegistrationPhone(
    input.answers.phone_country_code ?? "",
    input.answers.phone_number ?? "",
  );

  await input.page.locator(selectors.registrationFirstName).fill(firstName);
  await input.page.locator(selectors.registrationLastName).fill(lastName);
  await input.page.locator(selectors.registrationCountryCode).selectOption(phone.countryCode);
  await input.page.locator(selectors.registrationMobileNumber).fill(phone.localNumber);
  await input.page.locator(selectors.registrationEmail).fill(input.account.email);
  await input.page.locator(selectors.registrationConfirmEmail).fill(input.account.email);
  await input.page.locator(selectors.registrationSecretQuestion).selectOption(input.account.secretQuestion);
  await input.page.locator(selectors.registrationSecretAnswer).fill(input.account.secretAnswer);
  await input.page.locator(selectors.registrationPassword).fill(input.account.password);
  await input.page.locator(selectors.registrationConfirmPassword).fill(input.account.password);
  await authorizeSaudiPrivacyControl({
    page: input.page,
    selector: selectors.registrationPrivacy,
    applicationId: input.applicationId,
    privacyAuthorization: input.privacyAuthorization,
  });
}

export function classifySaudiRegistrationResult(input: {
  url: string;
  bodyText: string;
  hasRegistrationForm: boolean;
  hasLoginEmail: boolean;
}): SaudiPortalState {
  if (!isOfficialSaudiPortalUrl(input.url)) {
    return {
      checkpoint: "selector_drift",
      message: "VisitSaudi registration left the verified official host.",
    };
  }
  const body = input.bodyText.replace(/\s+/g, " ").trim();
  if (
    /activation|verification/i.test(body) &&
    /email|link|account/i.test(body) &&
    /sent|check|confirm|activate|verify/i.test(body)
  ) {
    return {
      checkpoint: "activation_pending",
      message: "VisitSaudi accepted the managed-account registration and activation email is pending.",
    };
  }
  if (/already (?:exists|registered)|email.{0,40}(?:exists|registered|used)/i.test(body)) {
    return {
      checkpoint: "account_exists",
      message: "VisitSaudi reports that the managed alias already has an account.",
    };
  }
  if (input.hasLoginEmail || /\/login(?:\?|$)/i.test(input.url)) {
    return { checkpoint: "login", message: "VisitSaudi registration reached the login page." };
  }
  if (input.hasRegistrationForm) {
    return {
      checkpoint: "account_registration",
      message: "VisitSaudi kept the registration form open after Register; official validation must be reviewed.",
    };
  }
  return {
    checkpoint: "selector_drift",
    message: "VisitSaudi registration left the verified flow without activation or login evidence.",
  };
}

async function saudiRegistrationValidationKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const keys = new Set<string>();
    for (const element of Array.from(document.querySelectorAll<HTMLElement>("[data-valmsg-for]"))) {
      if (!element.textContent?.trim()) continue;
      const key = element.getAttribute("data-valmsg-for")?.trim();
      if (key) keys.add(key);
    }
    const summary = document.querySelector<HTMLElement>(".validation-summary-errors");
    if (summary?.textContent?.trim()) keys.add("form");
    return [...keys].sort();
  });
}

/** Register the prepared VIZA alias account; never advances into a visa application. */
export async function registerSaudiManagedAccount(input: {
  page: Page;
  applicantId: string;
  applicationId: string;
  answers: Record<string, string>;
  account: SaudiManagedAccount;
  privacyAuthorization: SaudiPrivacyAuthorization | null;
  correlationId?: string;
}): Promise<SaudiPortalState> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await fillSaudiRegistrationForm(input);
    const solve = await solveSaudiNumericCaptchaResult(input.page);
    await input.page.locator(SA_PUBLIC_SELECTORS.captchaInput).fill(solve.text);
    await input.page.locator(SA_PUBLIC_SELECTORS.registrationSubmit).click();
    await input.page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
    await input.page.waitForTimeout(1_000);
    requireOfficialSaudiPortalUrl(input.page.url(), "registration transition");
    const bodyText = await input.page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
    const state = classifySaudiRegistrationResult({
      url: input.page.url(),
      bodyText,
      hasRegistrationForm: (await input.page.locator("#formAdd").count()) > 0,
      hasLoginEmail: (await input.page.locator(SA_PUBLIC_SELECTORS.loginEmail).count()) > 0,
    });
    if (state.checkpoint === "account_registration") {
      const validationKeys = await saudiRegistrationValidationKeys(input.page);
      const captchaRejected = validationKeys.some((key) => /captcha/i.test(key)) ||
        /captcha.{0,40}(?:invalid|incorrect|required)|(?:invalid|incorrect).{0,40}captcha/i.test(bodyText);
      if (captchaRejected) {
        await reportBadCaptcha(solve.solveId).catch(() => undefined);
        if (attempt < 3) continue;
      }
      return {
        ...state,
        message: validationKeys.length > 0
          ? `VisitSaudi registration validation remains for: ${validationKeys.join(", ")}`
          : state.message,
      };
    }
    await reportGoodCaptcha(solve.solveId).catch(() => undefined);
    if (state.checkpoint === "activation_pending" || state.checkpoint === "login") {
      await markSaudiManagedAccountRegistrationSubmitted({
        applicantId: input.applicantId,
        applicationId: input.applicationId,
        privacyAuthorization: input.privacyAuthorization,
        correlationId: input.correlationId,
      });
    }
    return state;
  }
  return {
    checkpoint: "captcha",
    message: "VisitSaudi rejected three bounded registration CAPTCHA attempts.",
  };
}

export async function loginSaudiManagedAccount(
  page: Page,
  account: SaudiManagedAccount,
  applicationId: string,
  privacyAuthorization: SaudiPrivacyAuthorization | null,
): Promise<SaudiPortalState> {
  assertSaudiPrivacyAuthorization(privacyAuthorization, applicationId);
  if (!account.confirmed) {
    return {
      checkpoint: "account_registration",
      message: "VisitSaudi credentials are prepared but the official account is not confirmed; refusing a login attempt that could trigger lockout.",
    };
  }
  await page.goto(SA_LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  requireOfficialSaudiPortalUrl(page.url(), "login navigation");
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    requireOfficialSaudiPortalUrl(page.url(), "credential entry");
    await page.locator(SA_PUBLIC_SELECTORS.loginEmail).fill(account.email);
    await page.locator(SA_PUBLIC_SELECTORS.loginPassword).fill(account.password);
    const solve = await solveSaudiNumericCaptchaResult(page);
    await page.locator(SA_PUBLIC_SELECTORS.captchaInput).fill(solve.text);
    await page.locator(SA_PUBLIC_SELECTORS.loginSubmit).click();
    await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(750);
    requireOfficialSaudiPortalUrl(page.url(), "login transition");
    const bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
    const state = classifySaudiPortalState({
      url: page.url(),
      title: await page.title().catch(() => ""),
      bodyText,
      hasCaptchaImage: (await page.locator(SA_PUBLIC_SELECTORS.captchaImage).count()) > 0,
      hasLoginEmail: (await page.locator(SA_PUBLIC_SELECTORS.loginEmail).count()) > 0,
      hasDocumentInput: (await page.locator('input[type="file"]').count()) > 0,
      hasPaymentControl: (await page.getByRole("button", { name: /pay|payment/i }).count()) > 0,
      productVerified: isOfficialSaudiPortalUrl(page.url()),
    });
    if (state.checkpoint !== "login" && state.checkpoint !== "captcha") {
      await reportGoodCaptcha(solve.solveId).catch(() => undefined);
      return state.checkpoint === "unknown"
        ? { checkpoint: "selector_drift", message: "VisitSaudi login left the known page without a verified application marker." }
        : state;
    }
    const validationKeys = await saudiRegistrationValidationKeys(page);
    const captchaRejected = validationKeys.some((key) => /captcha/i.test(key)) ||
      /captcha.{0,40}(?:invalid|incorrect|required)|(?:invalid|incorrect).{0,40}captcha/i.test(bodyText);
    if (captchaRejected) {
      await reportBadCaptcha(solve.solveId).catch(() => undefined);
      if (attempt < 3) continue;
      return { checkpoint: "captcha", message: "VisitSaudi rejected three bounded login CAPTCHA attempts." };
    }
    await reportGoodCaptcha(solve.solveId).catch(() => undefined);
    if (/invalid.{0,40}(?:email|password|credential)|incorrect.{0,40}(?:email|password)|account.{0,40}(?:not found|locked)/i.test(bodyText)) {
      return {
        checkpoint: "credentials_rejected",
        message: "VisitSaudi rejected the managed-account credentials.",
      };
    }
    if (/activat|verify your (?:account|email)|email.{0,40}not verified/i.test(bodyText)) {
      return {
        checkpoint: "activation_pending",
        message: "VisitSaudi requires managed-account activation before login.",
      };
    }
    return validationKeys.length > 0
      ? { checkpoint: "login", message: `VisitSaudi login validation remains for: ${validationKeys.join(", ")}` }
      : state;
  }
  return { checkpoint: "captcha", message: "VisitSaudi login CAPTCHA retry budget was exhausted." };
}

export async function submitSaudiLoginOtp(input: {
  page: Page;
  otp: string;
}): Promise<SaudiPortalState> {
  if (!/^\d{4,8}$/.test(input.otp.trim())) {
    throw new Error("VisitSaudi phone verification code must contain four to eight digits");
  }
  if (!isOfficialSaudiPortalUrl(input.page.url()) || !/\/Login\/OTPAuth/i.test(input.page.url())) {
    throw new Error("VisitSaudi phone verification page is not active");
  }
  const otpControl = input.page.locator("#Otp");
  const submitControl = input.page.locator("#btnSubmit");
  if ((await otpControl.count()) !== 1 || (await submitControl.count()) !== 1) {
    throw new Error("VisitSaudi phone verification selector drift");
  }
  await otpControl.fill(input.otp.trim());
  await submitControl.click();
  await input.page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
  await input.page.waitForTimeout(750);
  requireOfficialSaudiPortalUrl(input.page.url(), "phone verification transition");
  const state = classifySaudiPortalState({
    url: input.page.url(),
    title: await input.page.title().catch(() => ""),
    bodyText: await input.page.locator("body").innerText({ timeout: 5_000 }).catch(() => ""),
    hasCaptchaImage: (await input.page.locator(SA_PUBLIC_SELECTORS.captchaImage).count()) > 0,
    hasLoginEmail: (await input.page.locator(SA_PUBLIC_SELECTORS.loginEmail).count()) > 0,
    hasDocumentInput: (await input.page.locator('input[type="file"]').count()) > 0,
    hasPaymentControl: (await input.page.getByRole("button", { name: /pay|payment/i }).count()) > 0,
    productVerified: isOfficialSaudiPortalUrl(input.page.url()),
  });
  return state.checkpoint === "unknown"
    ? { checkpoint: "selector_drift", message: "VisitSaudi phone verification left the known flow without an authenticated marker." }
    : state;
}

export function extractSaudiActivationUrl(content: string): URL | null {
  const candidates = content.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
  for (const raw of candidates) {
    try {
      const url = new URL(raw.replace(/&amp;/g, "&"));
      if (
        isOfficialSaudiPortalUrl(url) &&
        /activat|confirm|verify/i.test(`${url.pathname}${url.search}`)
      ) {
        return url;
      }
    } catch {
      // Ignore malformed links and continue through the message.
    }
  }
  return null;
}

interface SaudiActivationMessageLike {
  from_addr: string;
  subject?: string | null;
  headers?: unknown;
  text?: string | null;
  html?: string | null;
}

function saudiHeaderValue(headers: unknown, name: string): string {
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) return "";
  const matches = Object.entries(headers).filter(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  );
  return matches.length === 1 && typeof matches[0][1] === "string"
    ? matches[0][1]
    : "";
}

function saudiSingleEmailDomain(value: string): string {
  const domains = [...value.toLowerCase().matchAll(/@([a-z0-9.-]+)/g)]
    .map((match) => match[1].replace(/\.+$/, ""));
  return domains.length === 1 ? domains[0] : "";
}

function isVisitSaudiMailDomain(value: string): boolean {
  const domain = value.trim().replace(/\.$/, "").toLowerCase();
  return domain === "visitsaudi.com" || domain.endsWith(".visitsaudi.com");
}

function saudiDomainsAlign(left: string, right: string): boolean {
  const a = left.trim().replace(/\.$/, "").toLowerCase();
  const b = right.trim().replace(/\.$/, "").toLowerCase();
  return Boolean(a && b) && (a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`));
}

function saudiAuthMethodDomains(
  authenticationResult: string,
  method: "dkim" | "dmarc",
  property: "header.d" | "header.from",
): string[] {
  const methodPattern = new RegExp(`(?:^|;)\\s*${method}=pass\\b([^;]*)`, "gi");
  const domains: string[] = [];
  for (const match of authenticationResult.matchAll(methodPattern)) {
    const propertyPattern = new RegExp(`\\b${property.replace(".", "\\.")}=([^\\s;]+)`, "i");
    const domain = match[1].match(propertyPattern)?.[1];
    if (domain) domains.push(domain.replace(/\.$/, "").toLowerCase());
  }
  return domains;
}

function trustedSaudiAuthenticationResult(message: SaudiActivationMessageLike): boolean {
  const fromDomain = saudiSingleEmailDomain(saudiHeaderValue(message.headers, "from"));
  if (!isVisitSaudiMailDomain(fromDomain)) return false;

  const authenticationResults = saudiHeaderValue(message.headers, "authentication-results");
  const trustedResults = authenticationResults
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter((value) => {
      const authservId = value.match(/^([^;\s]+)\s*;/)?.[1]?.toLowerCase();
      return authservId === SA_EMAIL_AUTHSERV_ID;
    });
  // A sender-injected duplicate using Cloudflare's authserv-id makes the
  // receiver result ambiguous and must fail closed.
  if (trustedResults.length !== 1) return false;

  const trusted = trustedResults[0];
  const dkimDomains = saudiAuthMethodDomains(trusted, "dkim", "header.d");
  const dmarcDomains = saudiAuthMethodDomains(trusted, "dmarc", "header.from");
  const smtpMailfrom = trusted.match(/\bsmtp\.mailfrom=([^\s;]+)/i)?.[1] ?? "";
  const smtpMailfromDomain = saudiSingleEmailDomain(smtpMailfrom);
  const envelopeDomain = saudiSingleEmailDomain(message.from_addr);
  return dkimDomains.some(
    (domain) => isVisitSaudiMailDomain(domain) && saudiDomainsAlign(domain, fromDomain),
  ) && dmarcDomains.some(
    (domain) => isVisitSaudiMailDomain(domain) && saudiDomainsAlign(domain, fromDomain),
  ) && saudiDomainsAlign(envelopeDomain, smtpMailfromDomain);
}

export function isTrustedSaudiActivationMessage(message: SaudiActivationMessageLike): boolean {
  const subject = message.subject ?? "";
  return trustedSaudiAuthenticationResult(message) &&
    /saudi/i.test(subject) && /visa/i.test(subject) && /activat|verify|confirm|account|registration/i.test(subject);
}

/** Match only a trusted message that can actually advance the activation flow. */
export function isReadySaudiActivationMessage(message: SaudiActivationMessageLike): boolean {
  if (!isTrustedSaudiActivationMessage(message)) return false;
  const content = `${message.text ?? ""}\n${message.html ?? ""}`;
  return Boolean(extractSaudiActivationUrl(content) || extractSaudiActivationTrackerUrl(content));
}

export function extractSaudiActivationTrackerUrl(content: string): URL | null {
  const normalized = content.replace(/=\r?\n/g, "");
  const candidates = normalized.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
  for (const raw of candidates) {
    try {
      const url = new URL(raw.replace(/&amp;/g, "&").replace(/=$/, ""));
      if (
        url.protocol === "https:" &&
        /\.ct\.sendgrid\.net$/i.test(url.hostname) &&
        url.pathname === "/ls/click" &&
        url.searchParams.has("upn")
      ) {
        return url;
      }
    } catch {
      // Ignore malformed links and continue through the message.
    }
  }
  return null;
}

export async function resolveSaudiActivationUrl(
  content: string,
  fetcher: typeof fetch = fetch,
): Promise<URL | null> {
  const direct = extractSaudiActivationUrl(content);
  if (direct) return direct;
  const tracker = extractSaudiActivationTrackerUrl(content);
  if (!tracker) return null;
  let response: Response;
  try {
    response = await fetcher(tracker, {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("VisitSaudi activation-link resolution failed");
  }
  if (![301, 302, 303, 307, 308].includes(response.status)) return null;
  const location = response.headers.get("location");
  if (!location) return null;
  const target = new URL(location, tracker);
  return extractSaudiActivationUrl(target.href);
}

export async function waitForSaudiActivationUrl(
  applicantId: string,
  since: string,
  timeoutMs = 120_000,
): Promise<URL> {
  const { inbox } = await import("../inbox/wait-for-message.js");
  const message = await inbox.waitForMessage(
    applicantId,
    (candidate) => isReadySaudiActivationMessage(candidate),
    timeoutMs,
    { since, includeProcessed: true, newestFirst: true },
  );
  const activationUrl = await resolveSaudiActivationUrl(`${message.text ?? ""}\n${message.html ?? ""}`);
  if (!activationUrl) throw new Error("VisitSaudi activation email did not contain a verified official activation URL");
  return activationUrl;
}

export async function activateSaudiManagedAccount(input: {
  page: Page;
  activationUrl: URL;
  applicantId: string;
  applicationId: string;
  privacyAuthorization: SaudiPrivacyAuthorization | null;
  correlationId?: string;
}): Promise<SaudiPortalState> {
  assertSaudiPrivacyAuthorization(input.privacyAuthorization, input.applicationId);
  if (
    !isOfficialSaudiPortalUrl(input.activationUrl) ||
    !/activat|confirm|verify/i.test(`${input.activationUrl.pathname}${input.activationUrl.search}`)
  ) {
    throw new Error("VisitSaudi activation URL is outside the verified official activation boundary");
  }
  try {
    await input.page.goto(input.activationUrl.href, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
  } catch {
    throw new Error("VisitSaudi activation navigation failed");
  }
  requireOfficialSaudiPortalUrl(input.page.url(), "activation navigation");
  const bodyText = await input.page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  if (!isSaudiActivationSuccessText(bodyText)) {
    return {
      checkpoint: "selector_drift",
      message: "VisitSaudi activation URL opened, but official activation success was not verified.",
    };
  }
  await markSaudiManagedAccountConfirmed({
    applicantId: input.applicantId,
    applicationId: input.applicationId,
    privacyAuthorization: input.privacyAuthorization,
    correlationId: input.correlationId,
  });
  return {
    checkpoint: "activation_verified",
    message: "VisitSaudi account activation was verified from the official success page.",
  };
}

export function isSaudiActivationSuccessText(bodyText: string): boolean {
  const body = bodyText.replace(/\s+/g, " ").trim();
  if (
    /account.{0,60}\b(?:not|never)\b.{0,30}\b(?:activated|verified)\b/i.test(body) ||
    /activation.{0,60}\b(?:not successful|unsuccessful|failed|invalid|expired|denied)\b/i.test(body) ||
    /\b(?:failed|unable)\b.{0,40}\bactivat/i.test(body)
  ) {
    return false;
  }
  return /account.{0,50}(?:activated|verified)|activation.{0,50}(?:complete|successful)/i.test(body);
}

/** Check a verified Privacy Policy control only after audited authorization. */
export async function authorizeSaudiPrivacyControl(input: {
  page: Page;
  selector: string;
  applicationId: string;
  privacyAuthorization: SaudiPrivacyAuthorization | null;
}): Promise<void> {
  assertSaudiPrivacyAuthorization(input.privacyAuthorization, input.applicationId);
  requireOfficialSaudiPortalUrl(input.page.url(), "Privacy Policy authorization");
  const checkbox = input.page.locator(input.selector);
  if ((await checkbox.count()) !== 1) throw new Error("VisitSaudi Privacy Policy checkbox selector drift");
  if (!(await checkbox.isChecked())) await checkbox.check({ force: true });
  if (!(await checkbox.isChecked())) throw new Error("VisitSaudi Privacy Policy checkbox was not authorized");
}

/** Upload only through selectors captured from the authenticated product. */
export async function uploadSaudiDocuments(input: {
  page: Page;
  paths: Record<SaDocumentKey, string>;
  selectors: Record<SaDocumentKey, string>;
}): Promise<void> {
  requireOfficialSaudiPortalUrl(input.page.url(), "document upload");
  for (const key of ["personal_photo", "passport_bio_page"] as const) {
    requireOfficialSaudiPortalUrl(input.page.url(), `document upload (${key})`);
    const control = input.page.locator(input.selectors[key]);
    if ((await control.count()) !== 1) throw new Error(`VisitSaudi ${key} upload selector drift`);
    await control.setInputFiles(input.paths[key]);
    requireOfficialSaudiPortalUrl(input.page.url(), `document upload transition (${key})`);
    const fileCount = await control.evaluate((element) => (element as HTMLInputElement).files?.length ?? 0);
    if (fileCount !== 1) throw new Error(`VisitSaudi ${key} was not attached`);
  }
}
