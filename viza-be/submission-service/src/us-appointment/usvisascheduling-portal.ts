import { existsSync, mkdirSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { dirname } from "node:path";
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { solveCaptcha } from "../captcha";
import {
  browserbaseEnabled,
  connectReconnectableBrowserbaseCloudBrowser,
  releaseBrowserbaseCloudSession,
  type ReconnectableBrowserbaseCloudBrowser,
} from "../browserbase-session";
import {
  extractUSAppointmentConfirmationNumber,
  hasUSAppointmentNoSlotsMessage,
  parseUSAppointmentDate,
  parseUSAppointmentTime,
} from "./portal-observation";
import { setupUSVisaSchedulingProfile } from "./profile-setup";
import {
  fillUSVisaSchedulingApplicantDetails,
  US_VISA_SCHEDULING_APPLICANT_DETAILS_PATH,
  US_VISA_SCHEDULING_OFFICIAL_ORIGIN,
} from "./applicant-details";
import type { USAppointmentApplicantDetailsResult } from "./applicant-details-data";
import type {
  AppointmentAccountCredentials,
  AppointmentPreparationResult,
  AppointmentPortalGate,
  AppointmentSlotRow,
  ConfirmationInsert,
  JsonObject,
  SlotInsert,
  StatusCheckInsert,
  USAppointmentJobRow,
  USAppointmentPortalClient,
  USAppointmentRunnerConfig,
} from "./runner";

export const US_VISA_SCHEDULING_SELECTORS = {
  emailInputs:
    "input#signInName, input[name='signInName'], input[type='email'], input[name*='email' i], input[id*='email' i], input[name*='user' i], input[id*='user' i], input[placeholder*='Username' i], input[aria-label*='Username' i]",
  passwordInputs:
    "input[type='password'], input[name*='password' i], input[id*='password' i]",
  loginButtons:
    "button:has-text('Sign In'), button:has-text('Login'), button:has-text('Log in'), button:has-text('Continue'), button:has-text('登录'), button:has-text('登入'), button:has-text('继续'), input[type='submit']",
  signUpLinks:
    "a:has-text('Sign up now'), a:has-text('Sign up'), a:has-text('New User'), a:has-text('创建'), a:has-text('注册'), button:has-text('Sign up'), button:has-text('New User'), button:has-text('创建'), button:has-text('注册')",
  registrationUsernameInputs:
    "input#signInName, input[name='signInName'], input[aria-label='Username'], input[placeholder*='Username' i]",
  registrationNewPasswordInputs:
    "input#newPassword, input[name='newPassword'], input[aria-label='New Password'], input[placeholder*='New Password' i]",
  registrationConfirmPasswordInputs:
    "input#reenterPassword, input[name='reenterPassword'], input[aria-label='Confirm New Password'], input[placeholder*='Confirm New Password' i]",
  registrationEmailInputs:
    "input#email, input[name='email'], input[aria-label='Email Address'], input[placeholder*='Email' i]",
  registrationGivenNameInputs:
    "input#givenName, input[name='givenName'], input[aria-label='Given Name'], input[placeholder*='Given Name' i]",
  registrationSurnameInputs:
    "input#surname, input[name='surname'], input[aria-label='Surname'], input[placeholder*='Surname' i]",
  registrationSecurityQuestionInputs:
    "select#extension_kbq1, select#extension_kbq2, select#extension_kbq3",
  registrationSecurityAnswerInputs:
    "input#extension_kba1, input#extension_kba2, input#extension_kba3",
  sendVerificationCodeButtons:
    "button#emailVerificationControl_but_send_code, input#emailVerificationControl_but_send_code, button:has-text('Send Verification Code'), button:has-text('Send New Code'), button:has-text('Send Verification'), button:has-text('发送验证码')",
  verificationCodeInputs:
    "input#email_ver_input, input#verificationCode, input#emailVerificationControl_code, input[name*='verificationCode' i], input[name*='verification_code' i], input[aria-label*='Verification Code' i], input[placeholder*='Verification Code' i], input[aria-label*='验证码' i], input[placeholder*='验证码' i]",
  verifyCodeButtons:
    "button#email_ver_but_verify, input#email_ver_but_verify, button#emailVerificationControl_but_verify_code, input#emailVerificationControl_but_verify_code, button:has-text('Verify Code'), button:has-text('Verify'), button:has-text('Continue'), button:has-text('验证'), button:has-text('继续')",
  createAccountButtons:
    "button#createAccount, button#create, button#continue, button:has-text('Create Account'), button:has-text('Create'), button:has-text('创建'), input[type='submit'][value*='Create' i], input[type='submit'][value*='Submit' i], input[type='submit'][value*='创建' i]",
  slotCandidates:
    "[data-viza-appointment-slot], [data-slot-id], [data-appointment-slot], table tbody tr, .appointment-slot, .slot",
  confirmButtons:
    "button:has-text('Confirm'), button:has-text('Schedule'), button:has-text('Book'), button:has-text('Submit'), button:has-text('确认'), button:has-text('预约'), button:has-text('提交'), input[type='submit']",
  confirmationText:
    "[data-confirmation-number], .confirmation-number, *:has-text('Confirmation'), *:has-text('确认'), *:has-text('预约成功'), *:has-text('Appointment')",
  statusText:
    "[data-appointment-status], .appointment-status",
} as const;

export async function isUSVisaSchedulingRegistrationFormVisible(page: Page): Promise<boolean> {
  const [usernameVisible, newPasswordVisible] = await Promise.all([
    page.locator(US_VISA_SCHEDULING_SELECTORS.registrationUsernameInputs)
      .first()
      .isVisible()
      .catch(() => false),
    page.locator(US_VISA_SCHEDULING_SELECTORS.registrationNewPasswordInputs)
      .first()
      .isVisible()
      .catch(() => false),
  ]);
  return usernameVisible && newPasswordVisible;
}

export async function reachUSVisaSchedulingRegistrationForm(page: Page): Promise<{
  clicked: boolean;
  reached: boolean;
}> {
  if (await isUSVisaSchedulingRegistrationFormVisible(page)) {
    return { clicked: false, reached: true };
  }
  const signUp = page.locator(US_VISA_SCHEDULING_SELECTORS.signUpLinks).first();
  await signUp.waitFor({ state: "visible", timeout: 30_000 });
  await signUp.scrollIntoViewIfNeeded().catch(() => undefined);
  await signUp.click({ timeout: 15_000 });
  await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(1_000);
  const deadline = Date.now() + 45_000;
  let reached = false;
  while (!reached && Date.now() < deadline) {
    reached = await isUSVisaSchedulingRegistrationFormVisible(page);
    if (!reached) await page.waitForTimeout(500);
  }
  return { clicked: true, reached };
}

interface VisibleSlotCandidate {
  text: string;
  externalSlotId: string | null;
}

interface PortalDiagnostics {
  currentUrl: string;
  title: string;
  bodyTextLength: number;
  loginVisible: boolean;
  scheduleControlVisible: boolean;
  slotCandidateCount: number;
}

interface TurnstileParams {
  sitekey: string | null;
  action: string | null;
  cData: string | null;
  chlPageData: string | null;
  pageUrl: string;
  userAgent: string;
}

interface CapturedSignInPost {
  url: string;
  body: string;
}

interface ApplicantDetailsSubmitAttempt {
  page: Page;
  jobId: string;
  origin: string;
}

const COMPLETED_ACCOUNT_STATUSES = new Set([
  "created",
  "active",
  "verified",
  "registered",
  "logged_in",
  "account_created",
  "account_active",
  "account_verified",
]);

const REGISTRATION_ACCOUNT_STATUSES = new Set([
  "registration_started",
  "account_creation_started",
  "verification_pending",
  "account_email_verification",
]);

export function isUSVisaSchedulingRegistrationPasswordValid(password: string): boolean {
  const symbols = "@#$%^&*-_+=[]{}|\\:',?/";
  if (password.length < 8 || password.length > 16) return false;
  if ([...password].some((character) => !/[a-z0-9]/i.test(character) && !symbols.includes(character))) return false;
  return [/[a-z]/.test(password), /[A-Z]/.test(password), /[0-9]/.test(password),
    [...password].some((character) => symbols.includes(character))].filter(Boolean).length >= 3;
}

function hasCompletedAppointmentAccount(credentials: AppointmentAccountCredentials): boolean {
  const status = normalizeVisibleText(credentials.accountStatus).toLowerCase();
  return COMPLETED_ACCOUNT_STATUSES.has(status) || credentials.emailVerified === true;
}

function shouldRegisterAppointmentAccount(
  job: USAppointmentJobRow,
  credentials: AppointmentAccountCredentials,
): boolean {
  if (hasCompletedAppointmentAccount(credentials)) return false;
  return ["appointment_consent_received", "appointment_account_required", "appointment_login_required"].includes(job.status)
    && REGISTRATION_ACCOUNT_STATUSES.has(normalizeVisibleText(credentials.accountStatus).toLowerCase());
}

export interface PlaywrightUSVisaSchedulingPortalClientOptions {
  /** Injected only for local browser tests or an already-authorized browser session. */
  page?: Page;
}

export function shouldInstallUSVisaSchedulingTurnstileHook(
  playwrightCdpEndpoint: string | null | undefined,
  browserbaseSession: boolean,
): boolean {
  // Browserbase owns its challenge page and native Turnstile lifecycle. The
  // interception hook is only safe for local/CDP sessions where VIZA itself
  // supplies the configured solver token.
  return !browserbaseSession && !/brd\.superproxy\.io|brightdata|browser-?api/i.test(playwrightCdpEndpoint ?? "");
}

function normalizeVisibleText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function readPageOrigin(page: Page): string | null {
  try {
    const origin = new URL(page.url()).origin;
    return origin === "null" ? null : origin;
  } catch {
    return null;
  }
}

function readPageUrl(page: Page): URL | null {
  try {
    return new URL(page.url());
  } catch {
    // During a same-tab redirect Playwright can briefly expose about:blank or
    // an empty URL. The authentication poll must keep observing that tab
    // instead of converting the transient URL into a login failure.
    return null;
  }
}

const US_VISA_SCHEDULING_AUTH_WAITING_ROOM_TIMEOUT_MS = 600_000;

function isUSVisaSchedulingWaitingRoom(
  current: URL | null,
  title: string,
  bodyText: string,
): boolean {
  const normalized = normalizeVisibleText(`${title} ${bodyText}`).toLowerCase();
  if (
    /waiting\s*[- ]?room|you are now in line|your estimated wait(?:ing)? time|estimated wait time|queue position/.test(normalized)
  ) return true;
  return Boolean(current && /waiting\s*[-_]?room/i.test(current.pathname));
}

function isUSVisaSchedulingTermsUrl(current: URL | null): boolean {
  return current !== null
    && /(^|\.)usvisascheduling\.com$/i.test(current.hostname)
    && /\/Account\/Login\/TermsAndConditions\/?$/i.test(current.pathname);
}

function isExactUSVisaSchedulingApplicantDetailsUrl(value: string): boolean {
  try {
    const current = new URL(value);
    return current.origin === US_VISA_SCHEDULING_OFFICIAL_ORIGIN
      && current.pathname === US_VISA_SCHEDULING_APPLICANT_DETAILS_PATH
      && current.search === ""
      && current.hash === "";
  } catch {
    return false;
  }
}

export function buildUSVisaSchedulingUsername(email: string): string {
  return `viza${createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 16)}`;
}

export function buildUSAppointmentBrowserApiEndpointForAttempt(
  endpoint: string,
  attemptIndex: number,
): string {
  if (attemptIndex <= 0 || !/brd\.superproxy\.io|brightdata|browser-?api/i.test(endpoint)) {
    return endpoint;
  }
  try {
    const parsed = new URL(endpoint);
    if (!parsed.username) return endpoint;
    const sessionToken = `vizaus${randomBytes(4).toString("hex")}`;
    const username = decodeURIComponent(parsed.username);
    const rotatedUsername = /-session-[^-]+/i.test(username)
      ? username.replace(/-session-[^-]+/i, `-session-${sessionToken}`)
      : `${username}-session-${sessionToken}`;
    parsed.username = rotatedUsername;
    return parsed.toString();
  } catch {
    return endpoint;
  }
}

const US_VISA_SCHEDULING_SECURITY_ANSWERS = [
  "VizaAnswer1",
  "VizaAnswer2",
  "VizaAnswer3",
] as const;

export type USVisaSchedulingAuthenticationState =
  | "authenticated"
  | "pending"
  | "rejected";

export interface USAppointmentAccountSessionDiagnostics {
  currentHost: string | null;
  pageTitlePresent: boolean;
  bodyTextLength: number;
  loginVisible: boolean;
  scheduleControlVisible: boolean;
  slotCandidateCount: number;
  visibleInputIds: string[];
  hasCaptchaImage: boolean;
  securityQuestionInputCount: number;
}

export interface USAppointmentAccountSessionInspection {
  state: USVisaSchedulingAuthenticationState;
  gate?: AppointmentPortalGate;
  diagnostics: USAppointmentAccountSessionDiagnostics;
}

type AccountSessionInspectionOperation =
  | "navigation"
  | "input"
  | "submit"
  | "wait"
  | "diagnostics";

function emptyAccountSessionDiagnostics(): USAppointmentAccountSessionDiagnostics {
  return {
    currentHost: null,
    pageTitlePresent: false,
    bodyTextLength: 0,
    loginVisible: false,
    scheduleControlVisible: false,
    slotCandidateCount: 0,
    visibleInputIds: [],
    hasCaptchaImage: false,
    securityQuestionInputCount: 0,
  };
}

function buildAccountSessionInspectionFailureGate(
  operation: AccountSessionInspectionOperation,
): AppointmentPortalGate {
  const loginOperation = operation === "input" || operation === "submit" || operation === "wait";
  return {
    jobStatus: "appointment_manual_required",
    actionType: loginOperation ? "login" : "site_policy_review",
    instruction:
      "USVisaScheduling account inspection stopped at a known browser operation. Review the masked evidence before retrying.",
    metadata: {
      gate_type: "account_session_inspection_failed",
      provider: "usvisascheduling",
      operation,
      raw_error: "[REDACTED]",
    },
    errorCode: "account_session_inspection_failed",
    errorMessage: "USVisaScheduling account inspection did not complete at the recorded operation.",
  };
}

export function classifyUSVisaSchedulingAuthenticationState(input: {
  url: string;
  bodyText?: string | null;
  loginVisible: boolean;
  invalidCredentialsVisible: boolean;
}): USVisaSchedulingAuthenticationState {
  const normalizedBody = normalizeVisibleText(input.bodyText).toLowerCase();
  if (
    input.invalidCredentialsVisible
    || /isportaluserloggedin\s*=\s*['"]?false/.test(normalizedBody)
  ) {
    return "rejected";
  }

  const gate = classifyUSVisaSchedulingGateText(normalizedBody);
  if (gate?.errorCode === "portal_access_blocked"
    || gate?.errorCode === "portal_connection_interrupted"
    || gate?.errorCode === "captcha_checkpoint"
    || gate?.errorCode === "waiting_room") return "pending";

  try {
    const url = new URL(input.url);
    const authenticatedHost = url.hostname === "usvisascheduling.com"
      || url.hostname.endsWith(".usvisascheduling.com");
    const authTransit = /b2clogin|atlasauth/i.test(url.hostname)
      || /\/signin-aad-|\/oauth2\/|\/authorize|\/account\/login$/i.test(url.pathname);
    if (authenticatedHost && !authTransit && !input.loginVisible && normalizedBody.length > 0) {
      return "authenticated";
    }
  } catch {
    // Continue waiting while the official OAuth redirect is between URLs.
  }
  return "pending";
}

export function classifyUSVisaSchedulingGateText(text: string): AppointmentPortalGate | null {
  const normalized = normalizeVisibleText(text).toLowerCase();
  if (!normalized) return null;

  // This is the terminal access-denial page observed after the login queue,
  // not a Turnstile widget. Its Cloudflare footer must not invoke a solver.
  if (/sorry,? you have been blocked|sorry,? you are blocked/.test(normalized)
    && /cloudflare|you are unable to access|why have i been blocked/.test(normalized)) {
    return {
      jobStatus: "appointment_manual_required",
      actionType: "site_policy_review",
      instruction: "USVisaScheduling explicitly blocked this browser session. Review the recorded portal access denial before resuming.",
      metadata: { gate_type: "portal_access_blocked", provider: "cloudflare", visible_text: "[REDACTED]" },
      errorCode: "portal_access_blocked",
      errorMessage: "USVisaScheduling blocked access to this browser session.",
    };
  }

  if (/\berr_(?:connection_(?:closed|reset|aborted|refused|timed_out)|tunnel_connection_failed|proxy_connection_failed|timed_out|network_changed)\b/.test(normalized)
    && /this site can.?t be reached|this page isn.?t working|无法访问此网站|网页无法正常运作|chrome-error:\/\//.test(normalized)) {
    return {
      jobStatus: "appointment_manual_required",
      actionType: "site_policy_review",
      instruction: "The browser connection to USVisaScheduling was interrupted. Review the recorded interruption before resuming; it does not establish a credential rejection.",
      metadata: { gate_type: "portal_connection_interrupted", provider: "usvisascheduling", visible_text: "[REDACTED]" },
      errorCode: "portal_connection_interrupted",
      errorMessage: "The browser connection to USVisaScheduling was interrupted.",
    };
  }

  if (/mfa|multi-factor|authenticator|one-time password|security code sent to/.test(normalized)) {
    return {
      jobStatus: "appointment_manual_required",
      actionType: "login",
      instruction: "USVisaScheduling requires an applicant-controlled MFA step before VIZA can continue.",
      metadata: {
        gate_type: "mfa_required",
        provider: "usvisascheduling",
        visible_text: "[REDACTED]",
      },
      errorCode: "mfa_required",
      errorMessage: "USVisaScheduling requires applicant-controlled MFA.",
    };
  }

  // Cloudflare's waiting room includes its footer in the visible text. Match
  // the queue-specific headings before the generic Cloudflare CAPTCHA check,
  // while leaving a standalone Cloudflare challenge classified as CAPTCHA.
  if (
    /waiting room|queue|too many requests|rate limit|temporarily unavailable/.test(normalized)
    || /you are now in line|your estimated wait time|estimated wait time/.test(normalized)
  ) {
    return {
      jobStatus: "appointment_manual_required",
      actionType: "site_policy_review",
      instruction: "USVisaScheduling presented a waiting-room or rate-limit gate.",
      metadata: {
        gate_type: "waiting_room",
        visible_text: "[REDACTED]",
      },
      errorCode: "waiting_room",
      errorMessage: "USVisaScheduling presented a waiting-room or rate-limit gate.",
    };
  }

  if (
    /hcaptcha|captcha|recaptcha|cloudflare|verification challenge/.test(normalized)
    || /just a moment|请稍候|verify you are human|checking your browser|安全验证/.test(normalized)
  ) {
    let provider = "captcha";
    if (normalized.includes("hcaptcha")) provider = "hcaptcha";
    if (normalized.includes("recaptcha")) provider = "recaptcha";
    if (
      normalized.includes("cloudflare")
      || /just a moment|请稍候|verify you are human|checking your browser|安全验证/.test(normalized)
    ) {
      provider = "cloudflare";
    }

    return {
      jobStatus: "appointment_manual_required",
      actionType: "captcha",
      instruction: "USVisaScheduling presented a CAPTCHA checkpoint that requires the configured solver or manual completion.",
      metadata: {
        gate_type: "captcha_checkpoint",
        provider,
        visible_text: "[REDACTED]",
      },
      errorCode: "captcha_checkpoint",
      errorMessage: "USVisaScheduling presented a CAPTCHA checkpoint.",
    };
  }

  if (
    /access denied|you.?re offline|read only version/.test(normalized)
    || /account\/login\/termsandconditions/i.test(normalized)
    || /isportaluserloggedin\s*=\s*['"]?false/.test(normalized)
  ) {
    return {
      jobStatus: "appointment_manual_required",
      actionType: "site_policy_review",
      instruction:
        "USVisaScheduling reached a Microsoft Power Pages access or terms checkpoint after authentication. Review whether the account contact/profile is provisioned and terms were accepted before slot observation continues.",
      metadata: {
        gate_type: "power_pages_access_or_terms",
        visible_text: "[REDACTED]",
      },
      errorCode: "power_pages_access_or_terms",
      errorMessage:
        "USVisaScheduling reached a Power Pages access or terms checkpoint after authentication.",
    };
  }

  if (
    /review and accept/.test(normalized)
    || /accept.*(?:privacy policy|terms)/.test(normalized)
    || /(?:privacy policy|terms).*accept/.test(normalized)
    || /i agree to (?:the )?(?:privacy policy|terms)/.test(normalized)
  ) {
    return {
      jobStatus: "appointment_manual_required",
      actionType: "site_policy_review",
      instruction: "USVisaScheduling requires manual review of an official policy checkpoint.",
      metadata: {
        gate_type: "site_policy_review",
        visible_text: "[REDACTED]",
      },
      errorCode: "site_policy_review",
      errorMessage: "USVisaScheduling requires manual review of an official policy checkpoint.",
    };
  }

  if (/payment (?:is )?required|pay (?:the )?(?:mrv |visa )?fee|unpaid (?:mrv |visa )?fee|payment (?:failed|pending)|receipt (?:is )?(?:required|invalid)|请.*支付.*费用|尚未付款/.test(normalized)) {
    return {
      jobStatus: "appointment_manual_required",
      actionType: "payment",
      instruction: "USVisaScheduling requires an official payment checkpoint before scheduling.",
      metadata: {
        gate_type: "payment_required",
        visible_text: "[REDACTED]",
      },
      errorCode: "payment_required",
      errorMessage: "USVisaScheduling requires an official payment checkpoint before scheduling.",
    };
  }

  return null;
}

function buildUnknownPortalStateGate(diagnostics: PortalDiagnostics): AppointmentPortalGate {
  return {
    jobStatus: "appointment_manual_required",
    actionType: "site_policy_review",
    instruction:
      "USVisaScheduling reached an official page state that VIZA does not yet recognize. Review the captured page diagnostics before continuing.",
    metadata: {
      gate_type: "unknown_official_state",
      current_url: diagnostics.currentUrl,
      page_title: diagnostics.title ? "[REDACTED]" : null,
      body_text_length: diagnostics.bodyTextLength,
      login_visible: diagnostics.loginVisible,
      schedule_control_visible: diagnostics.scheduleControlVisible,
      slot_candidate_count: diagnostics.slotCandidateCount,
    },
    errorCode: "unknown_official_state",
    errorMessage: "USVisaScheduling reached an unrecognized official page state.",
  };
}

function buildApplicantDetailsStepGate(input: {
  errorCode: string;
  instruction: string;
  metadata?: JsonObject;
}): AppointmentPortalGate {
  return {
    jobStatus: "appointment_manual_required",
    actionType: "site_policy_review",
    instruction: input.instruction,
    metadata: {
      provider: "usvisascheduling",
      gate_type: input.errorCode,
      official_path: "/en-US/applicant_details/",
      ...input.metadata,
    },
    errorCode: input.errorCode,
    errorMessage: input.instruction,
  };
}

function buildAccountEmailVerificationGate(email: string): AppointmentPortalGate {
  return {
    jobStatus: "appointment_manual_required",
    actionType: "account_email_verification",
    instruction:
      "USVisaScheduling sent an official account verification code. Enter the email verification code before VIZA continues account creation.",
    userInputSchemaJson: {
      type: "object",
      properties: {
        emailCode: { type: "string" },
      },
      required: ["emailCode"],
    },
    metadata: {
      gate_type: "account_email_verification",
      provider: "usvisascheduling",
      account_email: email ? "[REDACTED]" : null,
      explicit_user_action_required: true,
    },
    errorCode: "account_email_verification_required",
    errorMessage: "USVisaScheduling requires an official account email verification code.",
  };
}

function buildRegistrationGate(input: {
  gateType: string;
  errorCode: string;
  errorMessage: string;
  instruction: string;
  operation: string;
  actionType?: AppointmentPortalGate["actionType"];
  metadata?: JsonObject;
}): AppointmentPortalGate {
  return {
    jobStatus: "appointment_manual_required",
    actionType: input.actionType ?? "account_email_verification",
    instruction: input.instruction,
    metadata: {
      gate_type: input.gateType,
      provider: "usvisascheduling",
      operation: input.operation,
      ...input.metadata,
    },
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
  };
}

function buildRegistrationFailureResult(input: {
  gate: AppointmentPortalGate;
  errorCode?: string;
  errorMessage?: string;
  verificationRequestedAt?: string;
  emailVerified?: boolean;
  accountCreated?: boolean;
}): AppointmentPreparationResult {
  return {
    readyForSlotCapture: false,
    gate: input.gate,
    errorCode: input.errorCode ?? input.gate.errorCode,
    errorMessage: input.errorMessage ?? input.gate.errorMessage,
    ...(input.verificationRequestedAt
      ? { verificationRequestedAt: input.verificationRequestedAt }
      : {}),
    emailVerified: input.emailVerified ?? false,
    accountCreated: input.accountCreated ?? false,
  };
}

function buildMissingRegistrationFieldsGate(fields: string[]): AppointmentPortalGate {
  return buildRegistrationGate({
    gateType: "registration_required_fields_missing",
    errorCode: "registration_required_fields_missing",
    errorMessage: "USVisaScheduling registration requires all applicant and security-question fields.",
    instruction: "Complete the required USVisaScheduling registration fields before requesting an email code.",
    operation: "preflight",
    actionType: "login",
    metadata: { missing_fields: fields },
  });
}

function missingRegistrationCredentialFields(
  credentials: AppointmentAccountCredentials,
): string[] {
  const missing: string[] = [];
  const email = normalizeVisibleText(credentials.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) missing.push("email");
  if (!normalizeVisibleText(credentials.password)) missing.push("password");
  if (!normalizeVisibleText(credentials.givenName)) missing.push("givenName");
  if (!normalizeVisibleText(credentials.surname)) missing.push("surname");
  return missing;
}

function buildExistingAccountGate(accountStatus: string | null | undefined): AppointmentPortalGate {
  const normalizedStatus = normalizeVisibleText(accountStatus).toLowerCase();
  return buildRegistrationGate({
    gateType: "account_already_exists",
    errorCode: "account_already_exists",
    errorMessage: "The stored USVisaScheduling account is already created; automatic duplicate registration is blocked.",
    instruction: "Use the existing USVisaScheduling account credentials instead of starting registration again.",
    operation: "preflight",
    actionType: "login",
    metadata: {
      account_status: COMPLETED_ACCOUNT_STATUSES.has(normalizedStatus) ? normalizedStatus : "verified",
      duplicate_registration_blocked: true,
    },
  });
}

function buildRegistrationFormGate(
  errorCode: string,
  errorMessage: string,
  instruction: string,
): AppointmentPortalGate {
  return buildRegistrationGate({
    gateType: "registration_form_unavailable",
    errorCode,
    errorMessage,
    instruction,
    operation: "registration_form",
    actionType: "login",
  });
}

function buildVerificationFailureGate(
  gateType: string,
  errorCode: string,
  errorMessage: string,
  operation: string,
  metadata?: JsonObject,
  accountCreationSubmitted = false,
): AppointmentPortalGate {
  return buildRegistrationGate({
    gateType,
    errorCode,
    errorMessage,
    instruction: accountCreationSubmitted
      ? "USVisaScheduling submitted account creation but did not confirm success; do not retry automatically."
      : "USVisaScheduling email verification did not complete; no account creation action was taken.",
    operation,
    metadata: { ...metadata, account_creation_submitted: accountCreationSubmitted },
  });
}

function redactSlotMetadata(candidate: VisibleSlotCandidate): JsonObject {
  return {
    externalSlotId: candidate.externalSlotId ? "[REDACTED]" : null,
    calendarPageContext: {
      textFingerprint: candidate.text ? "[REDACTED]" : null,
    },
  };
}

function buildSlotInsert(
  job: USAppointmentJobRow,
  candidate: VisibleSlotCandidate,
): SlotInsert | null {
  const date = parseUSAppointmentDate(candidate.text);
  const time = parseUSAppointmentTime(candidate.text);
  if (!date || !time) return null;
  return {
    job_id: job.id,
    application_id: job.application_id,
    appointment_date: date,
    appointment_time: time,
    appointment_location: normalizeVisibleText(job.applying_post_city) || "USVisaScheduling",
    appointment_type: "interview",
    source: "usvisascheduling",
    status: "observed",
    metadata_redacted_json: redactSlotMetadata(candidate),
  };
}

export function inferStatusFromText(text: string): string {
  const normalized = normalizeVisibleText(text).toLowerCase();
  if (!normalized) return "unknown";

  // Evaluate explicit absence before positive words so "No appointments
  // scheduled" cannot be misclassified as an existing appointment.
  if (
    /\bno\s+(?:current\s+)?appointments?\b/.test(normalized)
    || /\bappointments?\s+(?:are\s+)?not\s+scheduled\b/.test(normalized)
    || /\bnot\s+scheduled\b/.test(normalized)
    || /\bnone\s+scheduled\b/.test(normalized)
    || /无预约|没有预约|暂无预约|未预约|未安排预约/.test(normalized)
  ) {
    return "appointment_not_found";
  }
  if (/\bcancel(?:led|ed|lation)\b/.test(normalized) || /取消/.test(normalized)) {
    return "appointment_cancelled";
  }
  if (
    /\bappointments?\s+(?:(?:is|are|was|were|has been|have been)\s+)?(?:now\s+)?(?:scheduled|confirmed)\b/.test(normalized)
    || /\bappointments?\s+(?:scheduled|confirmed)\b/.test(normalized)
    || /\b(?:scheduled|confirmed)\s+appointments?\b/.test(normalized)
    || /^\s*(?:appointment\s+)?(?:is\s+)?(?:scheduled|confirmed)\s*[.!]?\s*$/.test(normalized)
    || /已预约|预约成功|预约已确认|已确认预约/.test(normalized)
  ) {
    return "appointment_exists";
  }
  return "unknown";
}

export class PlaywrightUSVisaSchedulingPortalClient implements USAppointmentPortalClient {
  private aborted = false;
  private browserbaseSessionId: string | null = null;
  private browserbaseCloud: ReconnectableBrowserbaseCloudBrowser | null = null;
  private entranceRecoveryAvailable = true;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private readonly injectedPage: Page | null;
  private connectedToUserBrowser = false;
  private browserApiSessionAttemptIndex = 0;
  private pendingRegistrationCredentials: AppointmentAccountCredentials | null = null;
  private preparedJobId: string | null = null;
  private preparedPage: Page | null = null;
  private preparedPageOrigin: string | null = null;
  private securityQuestionAttempt: { page: Page; signature: string } | null = null;
  private pendingRegistrationPage: Page | null = null;
  private pendingRegistrationPageOrigin: string | null = null;
  private pendingRegistrationVerificationRequestedAt: string | null = null;
  private pendingRegistrationEmailVerified = false;
  private pendingRegistrationAccountCreated = false;
  private pendingRegistrationPostCreateLoginAttempted = false;
  private applicantDetailsSubmitAttempt: ApplicantDetailsSubmitAttempt | null = null;

  constructor(
    private readonly config: USAppointmentRunnerConfig,
    options: PlaywrightUSVisaSchedulingPortalClientOptions = {},
  ) {
    this.injectedPage = options.page ?? null;
    this.page = this.injectedPage;
    this.context = this.injectedPage?.context() ?? null;
  }

  /**
   * Open the configured entry point, solve only the supported Turnstile path,
   * and report the authentication state. This method deliberately stops after
   * login diagnostics; it never registers an account, accepts policy terms,
   * fills an applicant profile, pays, selects a slot, or books.
   */
  async inspectAccountSession(
    credentials: AppointmentAccountCredentials,
  ): Promise<USAppointmentAccountSessionInspection> {
    let page: Page | null = null;
    let operation: AccountSessionInspectionOperation = "navigation";

    try {
      operation = "navigation";
      page = await this.getPage();
      page = await this.openPortal(page);

      operation = "wait";
      let gate = await this.detectGate(page);
      if (gate?.actionType === "captcha") {
        operation = "submit";
        const solved = await this.solveTurnstileIfPresent(page);
        if (solved) {
          operation = "wait";
          await this.waitForPortalNavigationSettle(page);
          gate = await this.detectGate(page);
        }
      }

      if (gate) {
        operation = "diagnostics";
        return {
          state: "pending",
          gate,
          diagnostics: await this.readAccountSessionDiagnostics(page),
        };
      }

      operation = "input";
      const loginVisible = await this.isLoginVisible(page);
      let invalidCredentialsVisible = false;
      if (loginVisible) {
        operation = "submit";
        await this.login(page, credentials);
        operation = "wait";
        await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
        await page.waitForTimeout(1_000);
        invalidCredentialsVisible = await this.isInvalidCredentialsVisible(page);

        gate = await this.detectGate(page);
        if (gate?.actionType === "captcha") {
          operation = "submit";
          const solved = await this.solveTurnstileIfPresent(page);
          if (solved) {
            operation = "wait";
            await this.waitForPortalNavigationSettle(page);
            gate = await this.detectGate(page);
          }
        }
      }

      operation = "diagnostics";
      const bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
      const state = classifyUSVisaSchedulingAuthenticationState({
        url: page.url(),
        bodyText,
        loginVisible: await this.isLoginVisible(page),
        invalidCredentialsVisible,
      });
      const finalState = gate ? (state === "rejected" ? "rejected" : "pending") : state;
      return {
        state: finalState,
        ...(gate ? { gate } : {}),
        diagnostics: await this.readAccountSessionDiagnostics(page),
      };
    } catch {
      return {
        state: "pending",
        gate: buildAccountSessionInspectionFailureGate(operation),
        diagnostics: page
          ? await this.readAccountSessionDiagnostics(page).catch(() => emptyAccountSessionDiagnostics())
          : emptyAccountSessionDiagnostics(),
      };
    }
  }

  /**
   * Capture layout-only diagnostics for a local operator. All rendered text
   * and image/canvas content is masked before the screenshot is written.
   */
  async captureDebugScreenshot(path: string): Promise<void> {
    if (!path.trim()) throw new Error("USVisaScheduling debug screenshot path is required.");
    const page = await this.getPage();
    mkdirSync(dirname(path), { recursive: true });
    await page.screenshot({
      path,
      animations: "disabled",
      mask: [page.locator("img"), page.locator("canvas"), page.locator("iframe")],
      maskColor: "#777777",
      style: `
        *, *::before, *::after {
          color: transparent !important;
          text-shadow: none !important;
          caret-color: transparent !important;
          background-image: none !important;
        }
        svg text, svg tspan {
          fill: transparent !important;
          stroke: transparent !important;
        }
      `,
    });
  }

  async registerAccount(
    credentials: AppointmentAccountCredentials,
  ): Promise<AppointmentPreparationResult> {
    this.clearPendingRegistration();
    const missingFields = missingRegistrationCredentialFields(credentials);
    if (missingFields.length > 0) {
      const gate = buildMissingRegistrationFieldsGate(missingFields);
      return buildRegistrationFailureResult({ gate });
    }
    if (hasCompletedAppointmentAccount(credentials)) {
      const gate = buildExistingAccountGate(
        credentials.accountStatus,
      );
      return buildRegistrationFailureResult({ gate });
    }
    if (!REGISTRATION_ACCOUNT_STATUSES.has(normalizeVisibleText(credentials.accountStatus).toLowerCase())) {
      return buildRegistrationFailureResult({ gate: buildRegistrationFormGate(
        "account_registration_state_unknown",
        "The saved official account is not in a known registration-pending state.",
        "Reconcile the existing account state before attempting registration.",
      ) });
    }
    if (!isUSVisaSchedulingRegistrationPasswordValid(credentials.password)) {
      return buildRegistrationFailureResult({ gate: buildRegistrationFormGate(
        "registration_password_policy_invalid",
        "The pending account password does not satisfy the official registration policy.",
        "Provision a compliant password for this unregistered account before requesting an email code.",
      ) });
    }

    const page = await this.openPortal(await this.getPage());
    await this.acceptTermsCheckpointIfPresent(page);
    const initialGate = await this.detectGate(page);
    if (initialGate) {
      const solved = initialGate.actionType === "captcha"
        ? await this.solveTurnstileIfPresent(page)
        : null;
      if (!solved) return { readyForSlotCapture: false, gate: initialGate };
      const gateAfterSolve = await this.detectGate(page);
      if (gateAfterSolve) {
        return { readyForSlotCapture: false, gate: gateAfterSolve };
      }
    }

    return this.startAccountRegistration(page, credentials);
  }

  async completeAccountEmailVerification(input: {
    emailCode?: string | null;
    verificationLink?: string | null;
  }): Promise<AppointmentPreparationResult> {
    const page = await this.getPage();
    const pendingSession = this.requirePendingRegistrationSession(page);
    if (pendingSession.gate) return buildRegistrationFailureResult({ gate: pendingSession.gate });
    if (this.pendingRegistrationAccountCreated) {
      return {
        readyForSlotCapture: await this.isCalendarReady(page),
        verificationRequestedAt: this.pendingRegistrationVerificationRequestedAt ?? undefined,
        emailVerified: true,
        accountCreated: true,
      };
    }

    const code = normalizeVisibleText(input.emailCode);
    const link = normalizeVisibleText(input.verificationLink);
    if (code && !/^[A-Z0-9]{4,16}$/i.test(code)) {
      const gate = buildVerificationFailureGate(
        "verification_code_invalid",
        "verification_code_invalid",
        "USVisaScheduling rejected the supplied email verification code format.",
        "verify_code",
      );
      return buildRegistrationFailureResult({ gate });
    }

    if (code) {
      if (!this.pendingRegistrationEmailVerified) {
        const missingControls = await this.missingVisibleControls(page, [
          { name: "verificationCode", selector: US_VISA_SCHEDULING_SELECTORS.verificationCodeInputs },
          { name: "verifyCode", selector: US_VISA_SCHEDULING_SELECTORS.verifyCodeButtons },
        ]);
        if (missingControls.length > 0) {
          const gate = buildVerificationFailureGate(
            "verification_controls_missing",
            "verification_controls_missing",
            "USVisaScheduling did not show the email verification controls.",
            "verify_code",
            { missing_controls: missingControls },
          );
          return buildRegistrationFailureResult({
            gate,
            verificationRequestedAt: this.pendingRegistrationVerificationRequestedAt ?? undefined,
          });
        }
        const beforeVerifyError = await this.readRegistrationError(page);
        if (beforeVerifyError) {
          const gate = this.registrationErrorGate(beforeVerifyError, "verify_code");
          return buildRegistrationFailureResult({
            gate,
            verificationRequestedAt: this.pendingRegistrationVerificationRequestedAt ?? undefined,
          });
        }
        try {
          await this.fillFirstVisible(
            page,
            US_VISA_SCHEDULING_SELECTORS.verificationCodeInputs,
            code,
          );
          await this.clickFirstVisible(page, US_VISA_SCHEDULING_SELECTORS.verifyCodeButtons);
        } catch {
          const gate = buildVerificationFailureGate(
            "verification_submit_failed",
            "verification_submit_failed",
            "USVisaScheduling could not submit the email verification code.",
            "verify_code",
          );
          return buildRegistrationFailureResult({
            gate,
            verificationRequestedAt: this.pendingRegistrationVerificationRequestedAt ?? undefined,
          });
        }
        await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
        await page.waitForTimeout(1_000);
        const postCodeError = await this.readRegistrationError(page);
        if (postCodeError) {
          const gate = this.registrationErrorGate(postCodeError, "verify_code");
          return buildRegistrationFailureResult({
            gate,
            verificationRequestedAt: this.pendingRegistrationVerificationRequestedAt ?? undefined,
          });
        }
        const postCodeGate = await this.detectGate(page);
        if (postCodeGate) {
          return buildRegistrationFailureResult({
            gate: postCodeGate,
            verificationRequestedAt: this.pendingRegistrationVerificationRequestedAt ?? undefined,
          });
        }
        if (!await this.hasRegistrationVerificationSuccessEvidence(page)) {
          const gate = buildVerificationFailureGate(
            "verification_not_confirmed",
            "verification_not_confirmed",
            "USVisaScheduling did not show explicit evidence that the email code was accepted.",
            "verify_code",
          );
          return buildRegistrationFailureResult({
            gate,
            verificationRequestedAt: this.pendingRegistrationVerificationRequestedAt ?? undefined,
          });
        }
        this.pendingRegistrationEmailVerified = true;
      }

      return this.createAccountAfterEmailVerification(page);
    }

    if (link) {
      const gate = buildVerificationFailureGate(
        "verification_link_unsupported",
        "verification_link_unsupported",
        "USVisaScheduling China B2C registration requires the visible email verification code control; link-only verification is unsupported.",
        "verify_link",
      );
      return buildRegistrationFailureResult({
        gate,
        verificationRequestedAt: this.pendingRegistrationVerificationRequestedAt ?? undefined,
      });
    }

    const gate = buildVerificationFailureGate(
      "verification_input_missing",
      "verification_input_missing",
      "USVisaScheduling requires the email verification code from the current registration request.",
      "verify_code",
    );
    return buildRegistrationFailureResult({
      gate,
      verificationRequestedAt: this.pendingRegistrationVerificationRequestedAt ?? undefined,
    });
  }

  private async createAccountAfterEmailVerification(
    page: Page,
  ): Promise<AppointmentPreparationResult> {
    const missingControls = await this.missingVisibleControls(page, [
      { name: "createAccount", selector: US_VISA_SCHEDULING_SELECTORS.createAccountButtons },
    ]);
    if (missingControls.length > 0) {
      const gate = buildVerificationFailureGate(
        "create_control_missing",
        "create_control_missing",
        "USVisaScheduling did not show the account creation control after email verification.",
        "create_account",
        { missing_controls: missingControls },
      );
      return buildRegistrationFailureResult({
        gate,
        verificationRequestedAt: this.pendingRegistrationVerificationRequestedAt ?? undefined,
        emailVerified: true,
      });
    }

    const beforeCreateError = await this.readRegistrationError(page);
    if (beforeCreateError) {
      const gate = this.registrationErrorGate(beforeCreateError, "create_account");
      return buildRegistrationFailureResult({
        gate,
        verificationRequestedAt: this.pendingRegistrationVerificationRequestedAt ?? undefined,
        emailVerified: true,
      });
    }

    try {
      await this.clickFirstVisible(page, US_VISA_SCHEDULING_SELECTORS.createAccountButtons);
    } catch {
      const gate = buildVerificationFailureGate(
        "account_creation_submit_failed",
        "account_creation_submit_failed",
        "USVisaScheduling account creation submission could not be confirmed.",
        "create_account",
        undefined,
        true,
      );
      return buildRegistrationFailureResult({
        gate,
        verificationRequestedAt: this.pendingRegistrationVerificationRequestedAt ?? undefined,
        emailVerified: true,
      });
    }
    await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(1_000);
    const createError = await this.readRegistrationError(page);
    if (createError) {
      const gate = this.registrationErrorGate(createError, "create_account", true);
      return buildRegistrationFailureResult({
        gate,
        verificationRequestedAt: this.pendingRegistrationVerificationRequestedAt ?? undefined,
        emailVerified: true,
      });
    }

    const returnedToSignIn = !await isUSVisaSchedulingRegistrationFormVisible(page)
      && await this.isLoginVisible(page);
    if (returnedToSignIn) {
      const loginCompleted = await this.loginAfterAccountCreation(page);
      if (!loginCompleted) {
        const gate = buildVerificationFailureGate(
          "account_creation_login_failed",
          "account_creation_login_failed",
          "USVisaScheduling returned to sign-in after Create, but the new account could not be authenticated.",
          "create_account",
          undefined,
          true,
        );
        return buildRegistrationFailureResult({
          gate,
          verificationRequestedAt: this.pendingRegistrationVerificationRequestedAt ?? undefined,
          emailVerified: true,
        });
      }
    }

    if (!await this.hasAccountCreationSuccessEvidence(page)) {
      const createGate = await this.detectGate(page);
      if (createGate) {
        return buildRegistrationFailureResult({
          gate: {
            ...createGate,
            metadata: { ...createGate.metadata, account_creation_submitted: true },
          },
          verificationRequestedAt: this.pendingRegistrationVerificationRequestedAt ?? undefined,
          emailVerified: true,
        });
      }
      const gate = buildVerificationFailureGate(
        "account_creation_unconfirmed",
        "account_creation_unconfirmed",
        "USVisaScheduling did not show explicit evidence that the account was created.",
        "create_account",
        undefined,
        true,
      );
      return buildRegistrationFailureResult({
        gate,
        verificationRequestedAt: this.pendingRegistrationVerificationRequestedAt ?? undefined,
        emailVerified: true,
      });
    }

    this.pendingRegistrationAccountCreated = true;
    return {
      readyForSlotCapture: await this.isCalendarReady(page),
      verificationRequestedAt: this.pendingRegistrationVerificationRequestedAt ?? undefined,
      emailVerified: true,
      accountCreated: true,
    };
  }

  private async loginAfterAccountCreation(page: Page): Promise<boolean> {
    if (this.pendingRegistrationPostCreateLoginAttempted) return false;
    this.pendingRegistrationPostCreateLoginAttempted = true;
    const credentials = this.pendingRegistrationCredentials;
    if (!credentials) return false;
    try {
      let authenticated = await this.login(page, credentials);
      if (!authenticated) {
        // The Create response can navigate the same tab to the official terms
        // URL before Power Pages has committed the new document. Re-check the
        // existing tab for a bounded period, but never submit the login form a
        // second time (or repeat account creation).
        const current = readPageUrl(page);
        if (isUSVisaSchedulingTermsUrl(current)
          && !await this.isInvalidCredentialsVisible(page).catch(() => false)) {
          authenticated = await this.waitForAuthenticatedPortal(page, 30_000);
        }
      }
      if (!authenticated) return false;
      await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
      await page.waitForTimeout(1_000);
      await this.acceptTermsCheckpointIfPresent(page);
      if (/\/profile\/?$/i.test(new URL(page.url()).pathname)) {
        await page.locator("#firstname").waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
      }
      return true;
    } catch {
      return false;
    }
  }

  async prepareAppointmentFlow(
    job: USAppointmentJobRow,
    credentials: AppointmentAccountCredentials | null,
    applicantDetails?: USAppointmentApplicantDetailsResult,
  ): Promise<AppointmentPreparationResult> {
    this.clearPreparedSession();
    const attempts = this.shouldRotateBrowserApiSession()
      ? Math.max(1, this.config.browserApiSessionAttempts)
      : 1;
    let latest: AppointmentPreparationResult | null = null;

    for (let attemptIndex = 0; attemptIndex < attempts; attemptIndex += 1) {
      this.browserApiSessionAttemptIndex = attemptIndex;
      latest = await this.prepareAppointmentFlowOnce(job, credentials, applicantDetails);
      if (
        latest.readyForSlotCapture
        || latest.readyForStatusCapture === true
        || !latest.gate
        || !this.isRetryableCloudflareGate(latest.gate)
        || attemptIndex === attempts - 1
      ) {
        if (latest.readyForSlotCapture || latest.readyForStatusCapture === true) {
          this.markPreparedSession(job.id, await this.getPage());
        }
        return this.withBrowserApiAttemptMetadata(latest, attemptIndex + 1);
      }
      await this.close();
    }

    return latest ?? { readyForSlotCapture: false };
  }

  private withBrowserApiAttemptMetadata(
    result: AppointmentPreparationResult,
    attemptsUsed: number,
): AppointmentPreparationResult {
    if (!result.gate || !this.shouldRotateBrowserApiSession()) return result;
    return {
      ...result,
      gate: {
        ...result.gate,
        metadata: {
          ...result.gate.metadata,
          browser_api_session_attempts: attemptsUsed,
        },
      },
    };
  }

  private async prepareAppointmentFlowOnce(
    _job: USAppointmentJobRow,
    credentials: AppointmentAccountCredentials | null,
    applicantDetails?: USAppointmentApplicantDetailsResult,
  ): Promise<AppointmentPreparationResult> {
    if (credentials && shouldRegisterAppointmentAccount(_job, credentials)) {
      return this.registerAccount(credentials);
    }
    const page = await this.openPortal(await this.getPage());
    await this.acceptTermsCheckpointIfPresent(page);
    const initialGate = await this.detectGate(page);
    if (initialGate) {
      const solved = initialGate.actionType === "captcha"
        ? await this.solveTurnstileIfPresent(page)
        : null;
      if (!solved) return { readyForSlotCapture: false, gate: initialGate };
      const gateAfterSolve = await this.detectGate(page);
      if (gateAfterSolve) {
        return {
          readyForSlotCapture: false,
          gate: {
            ...gateAfterSolve,
            metadata: {
              ...gateAfterSolve.metadata,
              turnstile_solve_attempted: true,
              turnstile_solve_id: solved.solveId ? "[REDACTED]" : null,
              turnstile_duration_ms: solved.durationMs,
            },
          },
        };
      }
    }

    if (credentials && await this.isLoginVisible(page)) {
      const authenticated = await this.login(page, credentials);
      await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
      await page.waitForTimeout(1_000);
      await this.acceptTermsCheckpointIfPresent(page);
      if (await this.isInvalidCredentialsVisible(page)) {
        return { readyForSlotCapture: false, gate: {
          jobStatus: "appointment_manual_required",
          actionType: "login",
          instruction: "The official portal rejected the saved username or password. Restore the existing account credentials before resuming.",
          metadata: { gate_type: "invalid_credentials", provider: "usvisascheduling" },
          errorCode: "invalid_credentials",
          errorMessage: "USVisaScheduling rejected the saved account credentials.",
        } };
      }
      if (!authenticated) {
        const loginGate = await this.detectGate(page);
        return {
          readyForSlotCapture: false,
          gate: loginGate ?? this.buildLoginNotAuthenticatedGate(),
        };
      }
      const loginGate = await this.detectGate(page);
      if (loginGate) {
        const solved = loginGate.actionType === "captcha"
          ? await this.solveTurnstileIfPresent(page)
          : null;
        if (!solved) return { readyForSlotCapture: false, gate: loginGate };
        const gateAfterSolve = await this.detectGate(page);
        if (gateAfterSolve) {
          await this.acceptTermsCheckpointIfPresent(page);
          const gateAfterTerms = await this.detectGate(page);
          if (!gateAfterTerms) {
            return {
              readyForSlotCapture: await this.isCalendarReady(page),
            };
          }
          return {
            readyForSlotCapture: false,
            gate: {
              ...gateAfterTerms,
              metadata: {
                ...gateAfterTerms.metadata,
                turnstile_solve_attempted: true,
                turnstile_solve_id: solved.solveId ? "[REDACTED]" : null,
                turnstile_duration_ms: solved.durationMs,
              },
            },
          };
        }
      }
    }

    if (credentials) {
      // Create may have succeeded before its callback disconnected. Recover
      // the existing account through the observed profile's bound mailto proof;
      // do not send another OTP/Create or submit applicant data while unverified.
      const reconcileRegistration = credentials.accountStatus === "registration_submitted"
        && credentials.emailVerified !== true;
      if (reconcileRegistration && readPageOrigin(page) === US_VISA_SCHEDULING_OFFICIAL_ORIGIN
        && ["/en-US/", "/en-US/applicant_details/"].includes(new URL(page.url()).pathname)) {
        await page.goto(`${US_VISA_SCHEDULING_OFFICIAL_ORIGIN}/en-US/profile/`, {
          waitUntil: "domcontentloaded", timeout: 30_000,
        });
      }
      const profile = await setupUSVisaSchedulingProfile({
        page, credentials, applyingCountryCode: _job.applying_country_code ?? "",
      });
      if (profile.state === "gate" || profile.state === "handled") {
        const code = profile.state === "gate" ? profile.gate.code : "profile_save_unconfirmed";
        return { readyForSlotCapture: false, gate: {
          jobStatus: "appointment_manual_required", actionType: "site_policy_review",
          instruction: "The official account profile could not be prepared for appointment scheduling.",
          errorCode: code, errorMessage: "USVisaScheduling profile setup requires review.",
          metadata: {
            provider: "usvisascheduling", gate_type: code,
            ...(profile.state === "gate" ? {
              profile_operation: profile.gate.operation,
              profile_field: profile.gate.field,
              profile_reason: profile.gate.reason,
            } : {}),
          },
        } };
      }
      if (reconcileRegistration && profile.state === "profileSaved") {
        return { readyForSlotCapture: false, emailVerified: true, accountCreated: true };
      }
    }

    if (_job.status === "appointment_status_check_in_progress") {
      const statusText = await this.readAppointmentStatusText(page);
      if (statusText && inferStatusFromText(statusText) !== "unknown") {
        return { readyForSlotCapture: false, readyForStatusCapture: true };
      }
      if (await this.isCalendarReady(page)) return { readyForSlotCapture: true };
      // A status read must not create or submit a new appointment application.
      return { readyForSlotCapture: false, gate: buildUnknownPortalStateGate(await this.readDiagnostics(page)) };
    }

    if (await this.isCalendarReady(page)) return { readyForSlotCapture: true };

    const startApplication = page.locator("a#start_application[href='/en-US/applicant_details/']");
    if (await startApplication.isVisible().catch(() => false)) {
      await startApplication.click();
      await page.locator("#atlas_passport_number").waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
    }
    if (/\/applicant_details\/?$/i.test(new URL(page.url()).pathname)
      && await page.locator("#atlas_passport_number").isVisible().catch(() => false)) {
      const filled = await fillUSVisaSchedulingApplicantDetails({ page, applicant: applicantDetails });
      if (filled.state !== "filled") {
        const code = filled.code ?? "appointment_applicant_details_required";
        return { readyForSlotCapture: false, gate: {
          ...buildApplicantDetailsStepGate({
            errorCode: code,
            instruction: "Review the missing or inconsistent contact, address, passport and identity fields in the VIZA application before continuing on the official portal.",
            metadata: {
              missing_fields: filled.missingFields ?? [],
              applicant_details_filled: false,
              account_authenticated: true,
            },
          }),
        } };
      }

      return this.submitApplicantDetailsStep(_job, page);
    }

    const calendarLink = this.scheduleControl(page);
    if (await calendarLink.isVisible().catch(() => false)) {
      await calendarLink.click();
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
      const postClickGate = await this.detectGate(page);
      if (postClickGate) {
        return { readyForSlotCapture: false, gate: postClickGate };
      }
      if (await this.isCalendarReady(page)) return { readyForSlotCapture: true };
    }

    return {
      readyForSlotCapture: false,
      gate: buildUnknownPortalStateGate(await this.readDiagnostics(page)),
    };
  }

  private async submitApplicantDetailsStep(
    job: USAppointmentJobRow,
    page: Page,
  ): Promise<AppointmentPreparationResult> {
    const initialUrl = page.url();
    const initialOrigin = readPageOrigin(page);
    const preSubmitMetadata = {
      submission_attempted: false,
      account_authenticated: true,
    } satisfies JsonObject;

    if (!initialOrigin || !isExactUSVisaSchedulingApplicantDetailsUrl(initialUrl)) {
      return {
        readyForSlotCapture: false,
        gate: buildApplicantDetailsStepGate({
          errorCode: "appointment_application_step_unmapped",
          instruction: "USVisaScheduling left the verified Applicant Details page before submission could be confirmed.",
          metadata: {
            ...preSubmitMetadata,
            origin_changed: initialOrigin !== US_VISA_SCHEDULING_OFFICIAL_ORIGIN,
          },
        }),
      };
    }

    const submittedMetadata = {
      ...preSubmitMetadata,
      submission_attempted: true,
    } satisfies JsonObject;

    const inspectPostSubmitState = async (): Promise<AppointmentPreparationResult | null> => {
      const postSubmitGate = await this.detectGate(page);
      if (postSubmitGate) {
        return {
          readyForSlotCapture: false,
          gate: {
            ...postSubmitGate,
            metadata: {
              ...postSubmitGate.metadata,
              provider: "usvisascheduling",
              official_path: US_VISA_SCHEDULING_APPLICANT_DETAILS_PATH,
              submission_attempted: true,
            },
          },
        };
      }
      if (await this.isLoginVisible(page)) {
        const loginGate = this.buildLoginNotAuthenticatedGate();
        return {
          readyForSlotCapture: false,
          gate: {
            ...loginGate,
            metadata: {
              ...loginGate.metadata,
              official_path: US_VISA_SCHEDULING_APPLICANT_DETAILS_PATH,
              submission_attempted: true,
            },
          },
        };
      }
      if (await this.isCalendarReady(page)) return { readyForSlotCapture: true };
      return null;
    };

    const previousAttempt = this.applicantDetailsSubmitAttempt;
    if (
      previousAttempt?.page === page
      && previousAttempt.jobId === job.id
      && previousAttempt.origin === initialOrigin
    ) {
      return {
        readyForSlotCapture: false,
        gate: buildApplicantDetailsStepGate({
          errorCode: "appointment_application_submit_unconfirmed",
          instruction: "USVisaScheduling Applicant Details submission has an unresolved prior attempt; do not retry automatically.",
          metadata: {
            ...submittedMetadata,
            retry_blocked: true,
          },
        }),
      };
    }

    const submitControls = page.locator("input[type='button'][value='Submit']");
    const visibleSubmitControls: Locator[] = [];
    const count = Math.min(await submitControls.count().catch(() => 0), 100);
    for (let index = 0; index < count; index += 1) {
      const candidate = submitControls.nth(index);
      if (
        await candidate.isVisible().catch(() => false)
        && await candidate.isEnabled().catch(() => false)
        && await candidate.getAttribute("aria-disabled").catch(() => null) !== "true"
      ) {
        visibleSubmitControls.push(candidate);
      }
    }
    if (visibleSubmitControls.length !== 1) {
      return {
        readyForSlotCapture: false,
        gate: buildApplicantDetailsStepGate({
          errorCode: "appointment_application_submit_control_unavailable",
          instruction: "USVisaScheduling did not expose exactly one enabled Applicant Details Submit control.",
          metadata: {
            ...submittedMetadata,
            submission_attempted: false,
            visible_submit_control_count: visibleSubmitControls.length,
          },
        }),
      };
    }

    // Record the attempt before clicking. Any click timeout or ambiguous page
    // result must remain a checkpoint instead of causing a duplicate submit.
    this.applicantDetailsSubmitAttempt = {
      page,
      jobId: job.id,
      origin: initialOrigin,
    };
    try {
      await visibleSubmitControls[0].click();
    } catch {
      return {
        readyForSlotCapture: false,
        gate: buildApplicantDetailsStepGate({
          errorCode: "appointment_application_submit_failed",
          instruction: "USVisaScheduling Applicant Details could not be submitted; review the page before retrying.",
          metadata: submittedMetadata,
        }),
      };
    }

    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      if (page.isClosed()) {
        return {
          readyForSlotCapture: false,
          gate: buildApplicantDetailsStepGate({
            errorCode: "appointment_application_submit_unconfirmed",
            instruction: "USVisaScheduling Applicant Details submission could not be confirmed because the browser page closed.",
            metadata: submittedMetadata,
          }),
        };
      }

      const currentUrl = page.url();
      const currentOrigin = readPageOrigin(page);
      if (currentUrl !== initialUrl) {
        if (currentOrigin === US_VISA_SCHEDULING_OFFICIAL_ORIGIN) {
          const postSubmitState = await inspectPostSubmitState();
          if (postSubmitState) return postSubmitState;
        }
        return {
          readyForSlotCapture: false,
          gate: buildApplicantDetailsStepGate({
            errorCode: "appointment_application_step_unmapped",
            instruction: "USVisaScheduling moved to an unobserved application step after Applicant Details submission; review before continuing.",
            metadata: {
              ...submittedMetadata,
              origin_changed: currentOrigin !== initialOrigin,
              navigation_observed: true,
            },
          }),
        };
      }

      if (currentOrigin !== US_VISA_SCHEDULING_OFFICIAL_ORIGIN) {
        return {
          readyForSlotCapture: false,
          gate: buildApplicantDetailsStepGate({
            errorCode: "appointment_application_step_unmapped",
            instruction: "USVisaScheduling Applicant Details submission left the verified origin; review before continuing.",
            metadata: {
              ...submittedMetadata,
              origin_changed: true,
            },
          }),
        };
      }

      const postSubmitState = await inspectPostSubmitState();
      if (postSubmitState) return postSubmitState;
      if (await this.hasAuthenticationValidationError(page)) {
        return {
          readyForSlotCapture: false,
          gate: buildApplicantDetailsStepGate({
            errorCode: "appointment_application_step_rejected",
            instruction: "USVisaScheduling displayed an error after Applicant Details submission; review before retrying.",
            metadata: submittedMetadata,
          }),
        };
      }
      await page.waitForTimeout(100);
    }

    return {
      readyForSlotCapture: false,
      gate: buildApplicantDetailsStepGate({
        errorCode: "appointment_application_submit_unconfirmed",
        instruction: "USVisaScheduling Applicant Details submission did not expose a confirmed result; do not retry automatically.",
        metadata: submittedMetadata,
      }),
    };
  }

  async observeSlots(job: USAppointmentJobRow): Promise<SlotInsert[]> {
    const page = await this.requirePreparedSession(job, true);
    const candidates = await this.readVisibleSlotCandidates(page);
    await this.requirePreparedSession(job, true);
    return candidates
      .map((candidate) => buildSlotInsert(job, candidate))
      .filter((slot): slot is SlotInsert => Boolean(slot));
  }

  async captureConfirmation(
    job: USAppointmentJobRow,
    selectedSlot: AppointmentSlotRow,
  ): Promise<ConfirmationInsert | null> {
    if (job.status !== "appointment_booked" || selectedSlot.job_id !== job.id) {
      throw new Error("USVisaScheduling booking requires the approved job and its selected slot.");
    }
    const page = await this.requirePreparedSession(job, true);
    await this.clickSelectedSlot(page, selectedSlot);
    await this.clickFirstVisible(page, US_VISA_SCHEDULING_SELECTORS.confirmButtons);
    // A second attempt must prepare and revalidate the official page again.
    this.clearPreparedSession();
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    const confirmationText = await this.readFirstVisibleText(
      page,
      US_VISA_SCHEDULING_SELECTORS.confirmationText,
    );
    const reference = page.locator("[data-confirmation-number]");
    let explicitReference: string | null = null;
    for (let index = 0; index < await reference.count(); index += 1) {
      if (await reference.nth(index).isVisible()) {
        explicitReference = await reference.nth(index).getAttribute("data-confirmation-number");
        break;
      }
    }
    const confirmationNumber = extractUSAppointmentConfirmationNumber(confirmationText, explicitReference);
    if (!confirmationNumber) return null;
    return {
      job_id: job.id,
      application_id: job.application_id,
      user_id: job.user_id,
      country_code: "US",
      visa_type: "B1/B2",
      appointment_date: selectedSlot.appointment_date,
      appointment_time: selectedSlot.appointment_time,
      appointment_location: selectedSlot.appointment_location,
      appointment_type: selectedSlot.appointment_type ?? "interview",
      confirmation_number: confirmationNumber,
      confirmation_pdf_url: null,
      confirmation_screenshot_url: null,
      raw_confirmation_redacted_json: {
        provider: "usvisascheduling",
        confirmationText: confirmationText ? "[REDACTED]" : null,
      },
    };
  }

  async captureStatusCheck(job: USAppointmentJobRow): Promise<StatusCheckInsert> {
    const page = await this.requirePreparedSession(job, false);
    const text = await this.readAppointmentStatusText(page);
    await this.requirePreparedSession(job, false);
    if (!text) {
      throw new Error("USVisaScheduling status evidence was not visible on the prepared page.");
    }
    return {
      job_id: job.id,
      application_id: job.application_id,
      user_id: job.user_id,
      status: inferStatusFromText(text),
      result_redacted_json: {
        provider: "usvisascheduling",
        statusText: text ? "[REDACTED]" : null,
      },
      screenshot_url: null,
    };
  }

  async abort(): Promise<void> {
    this.aborted = true;
    await Promise.all([
      this.page?.close().catch(() => undefined),
      this.close(),
    ]);
  }

  private async readyPage(page: Page): Promise<Page> {
    if (this.aborted) {
      await this.close().catch(() => undefined);
      throw new Error("USVisaScheduling execution was cancelled.");
    }
    return page;
  }

  async close(): Promise<void> {
    this.clearPreparedSession();
    this.clearPendingRegistration();
    const browser = this.browser;
    const page = this.page;
    const connectedToUserBrowser = this.connectedToUserBrowser;
    const sessionId = this.browserbaseSessionId;
    const cloud = this.browserbaseCloud;
    const save = this.aborted ? Promise.resolve() : this.saveStorageState().catch(() => undefined);
    this.browserbaseSessionId = null;
    this.browserbaseCloud = null;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.connectedToUserBrowser = false;
    // Provider release is independent of a hung Playwright close or storage save.
    await Promise.all([
      (async () => {
        await save;
        if (cloud) return;
        if (connectedToUserBrowser) {
          await page?.close().catch(() => undefined);
          await browser?.close().catch(() => undefined);
        } else if (!this.injectedPage) {
          await browser?.close();
        }
      })(),
      cloud ? cloud.close() : sessionId ? releaseBrowserbaseCloudSession(sessionId) : Promise.resolve(),
    ]);
  }

  private async getPage(): Promise<Page> {
    if (this.aborted) throw new Error("USVisaScheduling execution was cancelled.");
    if (this.page) {
      if (this.page.isClosed()) {
        throw new Error("USVisaScheduling browser page is closed.");
      }
      return this.page;
    }
    if (this.injectedPage) {
      if (this.injectedPage.isClosed()) {
        throw new Error("USVisaScheduling injected browser page is closed.");
      }
      this.page = this.injectedPage;
      this.context = this.injectedPage.context();
      return this.injectedPage;
    }
    if (browserbaseEnabled("US_APPOINTMENT")) {
      const cloud = await connectReconnectableBrowserbaseCloudBrowser({ prefix: "US_APPOINTMENT", timeoutSeconds: 900 });
      this.browserbaseCloud = cloud;
      this.browserbaseSessionId = cloud.sessionId;
      this.browser = cloud.browser;
      this.context = cloud.context;
      this.page = cloud.page;
      this.connectedToUserBrowser = true;
      if (this.shouldInstallTurnstileHook()) {
        await this.installTurnstileHook(this.page);
      }
      return this.readyPage(this.page);
    }
    const cdpEndpoint = this.currentPlaywrightCdpEndpoint();
    if (cdpEndpoint) {
      this.browser = await chromium.connectOverCDP(cdpEndpoint, {
        timeout: 60_000,
      });
      this.connectedToUserBrowser = true;
      this.context = this.browser.contexts()[0] ?? await this.browser.newContext();
      this.page = await this.context.newPage();
      if (this.shouldInstallTurnstileHook()) {
        await this.installTurnstileHook(this.page);
      }
      return this.readyPage(this.page);
    }
    this.browser = await chromium.launch({
      channel: this.config.playwrightChannel ?? undefined,
      headless: this.config.playwrightHeadless,
    });
    const storageState = this.config.playwrightStorageStatePath
      && existsSync(this.config.playwrightStorageStatePath)
      ? this.config.playwrightStorageStatePath
      : undefined;
    this.context = await this.browser.newContext({ storageState });
    this.page = await this.context.newPage();
    if (this.shouldInstallTurnstileHook()) {
      await this.installTurnstileHook(this.page);
    }
    return this.readyPage(this.page);
  }

  private shouldInstallTurnstileHook(): boolean {
    return shouldInstallUSVisaSchedulingTurnstileHook(
      this.config.playwrightCdpEndpoint,
      browserbaseEnabled("US_APPOINTMENT"),
    );
  }

  private currentPlaywrightCdpEndpoint(): string | null {
    const endpoint = this.config.playwrightCdpEndpoint;
    if (!endpoint) return null;
    return buildUSAppointmentBrowserApiEndpointForAttempt(
      endpoint,
      this.browserApiSessionAttemptIndex,
    );
  }

  private shouldRotateBrowserApiSession(): boolean {
    return Boolean(
      this.config.playwrightCdpEndpoint
      && this.config.browserApiSessionAttempts > 1
      && /brd\.superproxy\.io|brightdata|browser-?api/i.test(this.config.playwrightCdpEndpoint),
    );
  }

  private isRetryableCloudflareGate(gate: AppointmentPortalGate): boolean {
    return gate.actionType === "captcha"
      && gate.metadata.provider === "cloudflare";
  }

  private shouldUseLocalSignInPostBridge(): boolean {
    const remoteEndpoint = this.config.playwrightCdpEndpoint?.trim();
    const localEndpoint = this.config.localCdpEndpoint?.trim();
    if (!remoteEndpoint || !localEndpoint) return false;
    if (remoteEndpoint === localEndpoint) return false;
    return /brd\.superproxy\.io|brightdata|browser-?api/i.test(remoteEndpoint);
  }

  private async saveStorageState(): Promise<void> {
    if (!this.context || !this.config.playwrightStorageStatePath) return;
    mkdirSync(dirname(this.config.playwrightStorageStatePath), { recursive: true });
    await this.context.storageState({ path: this.config.playwrightStorageStatePath });
  }

  private async installTurnstileHook(page: Page): Promise<void> {
    await page.addInitScript(() => {
      const w = window as typeof window & {
        turnstile?: { render?: (container: unknown, options?: Record<string, unknown>) => unknown };
        __vizaTurnstileHooked?: boolean;
        __vizaTurnstileParams?: Record<string, unknown>;
        __vizaTurnstileCallback?: (token: string) => void;
      };
      const timer = window.setInterval(() => {
        if (!w.turnstile?.render || w.__vizaTurnstileHooked) return;
        const originalRender = w.turnstile.render.bind(w.turnstile);
        w.turnstile.render = (container: unknown, options: Record<string, unknown> = {}) => {
          const isChallengePage = Boolean(options.cData || options.chlPageData);
          w.__vizaTurnstileParams = {
            sitekey: options.sitekey,
            cData: options.cData,
            chlPageData: options.chlPageData,
            action: options.action,
            pageUrl: window.location.href,
            userAgent: navigator.userAgent,
          };
          if (typeof options.callback === "function") {
            w.__vizaTurnstileCallback = options.callback as (token: string) => void;
          }
          if (isChallengePage) {
            return "viza-turnstile-challenge";
          }
          return originalRender(container, options);
        };
        w.__vizaTurnstileHooked = true;
        window.clearInterval(timer);
      }, 10);
    });
  }

  private async openPortal(page: Page): Promise<Page> {
    this.clearPreparedSession();
    this.clearPendingRegistration();
    const allowRecovery = this.entranceRecoveryAvailable;
    try {
      try {
        await page.goto(this.config.baseUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
      } catch (error) {
        if (!allowRecovery || !this.browserbaseCloud
          || (this.browserbaseCloud.browser.isConnected() && !page.isClosed())) throw error;
        page = await this.recoverEntrancePage(page, allowRecovery);
      }
      return await this.waitForPortalNavigationSettle(page, allowRecovery);
    } finally {
      // Recovery is restricted to the first entry navigation. No authentication,
      // registration, profile save, applicant submit or booking is ever replayed.
      this.entranceRecoveryAvailable = false;
    }
  }

  private async recoverEntrancePage(page: Page, allowed: boolean): Promise<Page> {
    const cloud = this.browserbaseCloud;
    if (!cloud) {
      if (page.isClosed()) throw new Error("USVisaScheduling browser session interrupted.");
      return this.readyPage(page);
    }
    if (cloud.browser.isConnected() && !page.isClosed()) return this.readyPage(page);
    if (!allowed || this.aborted) throw new Error("USVisaScheduling browser session interrupted.");
    await cloud.reconnect();
    if (this.aborted || this.browserbaseCloud !== cloud) {
      await cloud.close();
      throw new Error("USVisaScheduling execution was cancelled.");
    }
    this.browser = cloud.browser;
    this.context = cloud.context;
    this.page = cloud.page;
    return this.readyPage(cloud.page);
  }

  private async waitForPortalNavigationSettle(page: Page, allowRecovery = false): Promise<Page> {
    const started = Date.now();
    let deadline = started + 90_000;
    while (Date.now() < deadline) {
      page = await this.recoverEntrancePage(page, allowRecovery);
      const [currentUrl, title, bodyText, loginVisible] = await Promise.all([
        Promise.resolve(page.url()),
        page.title().catch(() => ""),
        page.locator("body").innerText({ timeout: 3_000 }).catch(() => ""),
        this.isLoginVisible(page).catch(() => false),
      ]);
      const normalized = normalizeVisibleText(`${title} ${bodyText}`);
      const terminalGate = classifyUSVisaSchedulingGateText(normalized);
      if (terminalGate?.errorCode === "portal_access_blocked"
        || terminalGate?.errorCode === "portal_connection_interrupted") return page;
      if (/you are now in line|your estimated wait time|waiting room/i.test(normalized)) {
        // Keep the official queue cookie and tab. Reloading or creating a new
        // browser loses the visitor's queue position. A ten-minute bound keeps
        // the managed browser lifecycle finite if the provider never admits it.
        deadline = started + 600_000;
        await new Promise<void>((resolve) => setTimeout(resolve, 2_000));
        continue;
      }
      const isCloudflareTransit =
        /__cf_chl_rt_tk/.test(currentUrl)
        || /just a moment|loading|请稍候|正在验证|cloudflare|verify you are human|安全验证/i.test(normalized)
        || normalizeVisibleText(bodyText).length === 0;
      const reachedOfficialAuth =
        loginVisible
        || /b2clogin|signin|login|authorize/i.test(currentUrl)
        || /apply for a u\.s\. visa|user details|sign in/i.test(normalized);
      if (reachedOfficialAuth && !isCloudflareTransit && !/__cf_chl_rt_tk/.test(currentUrl)) return page;
      if (!isCloudflareTransit) return page;
      await new Promise<void>((resolve) => setTimeout(resolve, 2_000));
    }
    return page;
  }

  private async isLoginVisible(page: Page): Promise<boolean> {
    const hasVisibleInput = async (selector: string): Promise<boolean> => {
      const inputs = page.locator(selector);
      const count = await inputs.count().catch(() => 0);
      for (let index = 0; index < count; index += 1) {
        if (await inputs.nth(index).isVisible().catch(() => false)) return true;
      }
      return false;
    };
    const [emailVisible, passwordVisible] = await Promise.all([
      hasVisibleInput(US_VISA_SCHEDULING_SELECTORS.emailInputs),
      hasVisibleInput(US_VISA_SCHEDULING_SELECTORS.passwordInputs),
    ]);
    return emailVisible && passwordVisible;
  }

  private async login(
    page: Page,
    credentials: AppointmentAccountCredentials,
  ): Promise<boolean> {
    if (this.shouldUseLocalSignInPostBridge()) {
      return this.loginViaLocalSignInPostBridge(page, credentials);
    }
    return this.loginDirectly(page, credentials);
  }

  private async loginDirectly(
    page: Page,
    credentials: AppointmentAccountCredentials,
    waitForAuthenticatedRedirect = true,
  ): Promise<boolean> {
    await this.fillFirstVisible(
      page,
      US_VISA_SCHEDULING_SELECTORS.emailInputs,
      buildUSVisaSchedulingUsername(credentials.email),
    );
    await this.fillFirstVisible(page, US_VISA_SCHEDULING_SELECTORS.passwordInputs, credentials.password);
    await this.clickFirstVisible(page, US_VISA_SCHEDULING_SELECTORS.loginButtons);
    await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(1_000);
    const securityQuestionResult = await this.answerLoginSecurityQuestions(page);
    if (securityQuestionResult === "error") return false;
    if (!waitForAuthenticatedRedirect) return true;
    return this.waitForAuthenticatedPortal(page);
  }

  private async loginViaLocalSignInPostBridge(
    remotePage: Page,
    credentials: AppointmentAccountCredentials,
  ): Promise<boolean> {
    const signInPost = await this.captureSignInPostFromLocalBrowser(remotePage.url(), credentials);
    await this.submitCapturedSignInPost(remotePage, signInPost);
    return this.waitForAuthenticatedPortal(remotePage);
  }

  private async captureSignInPostFromLocalBrowser(
    loginUrl: string,
    credentials: AppointmentAccountCredentials,
  ): Promise<CapturedSignInPost> {
    const localEndpoint = this.config.localCdpEndpoint?.trim();
    if (!localEndpoint) {
      throw new Error("US appointment local CDP endpoint is required for Browser API sign-in bridge.");
    }

    const localBrowser = await chromium.connectOverCDP(localEndpoint, { timeout: 30_000 });
    const localContext = localBrowser.contexts()[0] ?? await localBrowser.newContext();
    const localPage = await localContext.newPage();
    let captured: CapturedSignInPost | null = null;

    localPage.on("request", (request) => {
      if (captured) return;
      if (request.method() !== "POST") return;
      if (!/usvisascheduling\.com\/signin-aad-b2c_1/i.test(request.url())) return;
      const body = request.postData();
      if (!body) return;
      captured = {
        url: request.url(),
        body,
      };
    });

    try {
      await localPage.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await this.loginDirectly(localPage, credentials, false);

      const started = Date.now();
      while (!captured && Date.now() - started < 120_000) {
        const securityQuestionResult = await this.answerLoginSecurityQuestions(localPage);
        if (securityQuestionResult === "error" || securityQuestionResult === "already_submitted") break;
        await localPage.waitForTimeout(1_000);
      }
    } finally {
      await localPage.close().catch(() => undefined);
      await localBrowser.close().catch(() => undefined);
    }

    if (!captured) {
      throw new Error("USVisaScheduling local sign-in did not produce the official B2C form POST.");
    }
    return captured;
  }

  private async submitCapturedSignInPost(
    remotePage: Page,
    signInPost: CapturedSignInPost,
  ): Promise<void> {
    await remotePage.evaluate(`(() => {
      const url = ${JSON.stringify(signInPost.url)};
      const body = ${JSON.stringify(signInPost.body)};
      const form = document.createElement("form");
      form.method = "POST";
      form.action = url;
      form.style.display = "none";
      const parameters = new URLSearchParams(body);
      parameters.forEach((value, key) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    })()`);
    await remotePage.waitForLoadState("domcontentloaded", { timeout: 45_000 }).catch(() => undefined);
    await remotePage.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
    await remotePage.waitForTimeout(1_000);
  }

  private async isInvalidCredentialsVisible(page: Page): Promise<boolean> {
    const bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
    return /username or password.*invalid|invalid.*username or password|credentials.*invalid/i
      .test(bodyText);
  }

  private async waitForAuthenticatedPortal(
    page: Page,
    timeoutMs = 120_000,
    // The third argument is used only by loopback tests to keep the same
    // waiting-room state machine fast; production uses the 600-second bound.
    waitingRoomTimeoutMs = US_VISA_SCHEDULING_AUTH_WAITING_ROOM_TIMEOUT_MS,
  ): Promise<boolean> {
    const started = Date.now();
    let deadline = started + timeoutMs;
    const boundedWaitingRoomTimeoutMs = Math.max(
      timeoutMs,
      Math.min(US_VISA_SCHEDULING_AUTH_WAITING_ROOM_TIMEOUT_MS, waitingRoomTimeoutMs),
    );
    let waitingRoomObserved = false;
    let stableLoginPolls = 0;
    const pageIsClosed = (): boolean => {
      try {
        return page.isClosed();
      } catch {
        return true;
      }
    };
    const waitForPoll = (delayMs: number): Promise<void> => new Promise((resolve) => {
      const remaining = Math.max(0, deadline - Date.now());
      setTimeout(resolve, Math.min(delayMs, remaining));
    });

    while (Date.now() < deadline) {
      if (pageIsClosed()) return false;
      const current = readPageUrl(page);
      if (!current) {
        // Do not let a transient about:blank/empty URL during a same-tab
        // redirect become a false login failure.
        await waitForPoll(500);
        continue;
      }

      const [transitTitle, transitBodyText] = await Promise.all([
        page.title().catch(() => ""),
        page.locator("body").innerText({ timeout: 5_000 }).catch(() => ""),
      ]);
      const transitPath = `${current.protocol}//${current.host}${current.pathname}`;
      const transitGate = classifyUSVisaSchedulingGateText(
        `${transitPath} ${transitTitle} ${transitBodyText}`,
      );
      if (transitGate?.errorCode === "portal_access_blocked"
        || transitGate?.errorCode === "portal_connection_interrupted") return false;
      if (isUSVisaSchedulingWaitingRoom(current, transitTitle, transitBodyText)) {
        // Waiting Room is an explicit post-login queue state. Keep this same
        // tab and continue reading it; do not run login or security-question
        // actions while the queue is active, and never classify its body as
        // authenticated merely because it uses the official host.
        waitingRoomObserved = true;
        deadline = started + boundedWaitingRoomTimeoutMs;
        await waitForPoll(2_000);
        continue;
      }
      const officialTerms = isUSVisaSchedulingTermsUrl(current);

      // A Power Pages callback commonly exposes the final URL before its
      // terms controls are attached. Treat the URL as a readiness target, not
      // as auth evidence by itself, and keep polling this same tab until both
      // controls are visible. In particular, do not let a stale sign-in form
      // increment the normal login failure counter while the new document is
      // still settling.
      if (officialTerms) {
        if (await page.locator("#privacy-act-visual").isVisible().catch(() => false)
          && await page.locator("#confidentiality-agreement").isVisible().catch(() => false)) return true;
        if (await this.isInvalidCredentialsVisible(page).catch(() => false)) return false;
        stableLoginPolls = 0;
        await waitForPoll(500);
        continue;
      }

      if (await this.hasAuthenticationValidationError(page)) return false;
      // A queue can briefly replace its document with a login-looking
      // refresh page. Once an explicit Waiting Room was observed, never
      // replay a security-question action from that transient document.
      if (!waitingRoomObserved) {
        await this.answerLoginSecurityQuestions(page).catch(() => "absent" as const);
      }
      const [bodyText, loginVisible, invalidCredentialsVisible] = await Promise.all([
        page.locator("body").innerText({ timeout: 5_000 }).catch(() => ""),
        this.isLoginVisible(page).catch(() => false),
        this.isInvalidCredentialsVisible(page).catch(() => false),
      ]);
      const settledUrl = readPageUrl(page);
      if (!settledUrl) {
        await waitForPoll(500);
        continue;
      }
      // The URL can change while the body/controls snapshot is being read.
      // Start a fresh poll so classification never combines two documents.
      if (settledUrl.href !== current.href) {
        stableLoginPolls = 0;
        continue;
      }
      const settledPath = `${settledUrl.protocol}//${settledUrl.host}${settledUrl.pathname}`;
      const settledGate = classifyUSVisaSchedulingGateText(`${settledPath} ${bodyText}`);
      if (settledGate?.errorCode === "portal_access_blocked"
        || settledGate?.errorCode === "portal_connection_interrupted") return false;
      if (isUSVisaSchedulingWaitingRoom(settledUrl, "", bodyText)) {
        waitingRoomObserved = true;
        deadline = started + boundedWaitingRoomTimeoutMs;
        await waitForPoll(2_000);
        continue;
      }
      const state = classifyUSVisaSchedulingAuthenticationState({
        url: settledUrl.href,
        bodyText,
        loginVisible,
        invalidCredentialsVisible,
      });
      if (state === "authenticated") return true;
      if (state === "rejected") return false;
      stableLoginPolls = loginVisible ? stableLoginPolls + 1 : 0;
      if (!waitingRoomObserved && stableLoginPolls >= 5) return false;
      await waitForPoll(2_000);
    }
    return false;
  }

  private buildLoginNotAuthenticatedGate(): AppointmentPortalGate {
    return {
      jobStatus: "appointment_manual_required",
      actionType: "login",
      instruction:
        "USVisaScheduling did not complete the official Microsoft B2C redirect after VIZA submitted the stored account credentials.",
      metadata: {
        gate_type: "login_redirect_incomplete",
        provider: "usvisascheduling",
      },
      errorCode: "login_redirect_incomplete",
      errorMessage: "USVisaScheduling login did not reach an authenticated portal page.",
    };
  }

  private async startAccountRegistration(
    page: Page,
    credentials: AppointmentAccountCredentials,
  ): Promise<AppointmentPreparationResult> {
    const missingFields = missingRegistrationCredentialFields(credentials);
    if (missingFields.length > 0) {
      const gate = buildMissingRegistrationFieldsGate(missingFields);
      return buildRegistrationFailureResult({ gate });
    }
    if (hasCompletedAppointmentAccount(credentials)) {
      const gate = buildExistingAccountGate(
        credentials.accountStatus,
      );
      return buildRegistrationFailureResult({ gate });
    }

    let registrationEntry: { clicked: boolean; reached: boolean };
    try {
      registrationEntry = await reachUSVisaSchedulingRegistrationForm(page);
    } catch {
      const gate = buildRegistrationFormGate(
        "registration_form_unavailable",
        "USVisaScheduling registration form did not appear.",
        "USVisaScheduling did not show the registration form; no verification email was requested.",
      );
      return buildRegistrationFailureResult({ gate });
    }
    if (!registrationEntry.reached) {
      const gate = buildRegistrationFormGate(
        "registration_form_unavailable",
        "USVisaScheduling registration form did not appear.",
        "USVisaScheduling did not show the registration form; no verification email was requested.",
      );
      return buildRegistrationFailureResult({ gate });
    }

    const missingControls = await this.missingRegistrationControls(page);
    if (missingControls.length > 0) {
      const gate = buildMissingRegistrationFieldsGate(missingControls);
      return buildRegistrationFailureResult({ gate });
    }

    const givenName = normalizeVisibleText(credentials.givenName);
    const surname = normalizeVisibleText(credentials.surname);
    try {
      await this.fillFirstVisible(
        page,
        US_VISA_SCHEDULING_SELECTORS.registrationUsernameInputs,
        buildUSVisaSchedulingUsername(credentials.email),
      );
      await this.fillFirstVisible(page, US_VISA_SCHEDULING_SELECTORS.registrationNewPasswordInputs, credentials.password);
      await this.fillFirstVisible(page, US_VISA_SCHEDULING_SELECTORS.registrationConfirmPasswordInputs, credentials.password);
      await this.fillFirstVisible(page, US_VISA_SCHEDULING_SELECTORS.registrationEmailInputs, credentials.email);
      await this.fillFirstVisible(
        page,
        US_VISA_SCHEDULING_SELECTORS.registrationGivenNameInputs,
        givenName,
      );
      await this.fillFirstVisible(
        page,
        US_VISA_SCHEDULING_SELECTORS.registrationSurnameInputs,
        surname,
      );
      if (!await this.fillSecurityQuestions(page)) {
        const gate = buildMissingRegistrationFieldsGate(["securityQuestions"]);
        return buildRegistrationFailureResult({ gate });
      }
    } catch {
      const gate = buildRegistrationFormGate(
        "registration_input_failed",
        "USVisaScheduling registration fields could not be filled.",
        "USVisaScheduling registration fields were not accepted; no verification email was requested.",
      );
      return buildRegistrationFailureResult({ gate });
    }

    const formError = await this.readRegistrationError(page);
    if (formError) {
      const gate = this.registrationErrorGate(formError, "registration_form");
      return buildRegistrationFailureResult({ gate });
    }

    const verificationRequestedAt = new Date().toISOString();
    try {
      await this.clickFirstVisible(page, US_VISA_SCHEDULING_SELECTORS.sendVerificationCodeButtons);
    } catch {
      const gate = buildVerificationFailureGate(
        "verification_send_failed",
        "verification_send_failed",
        "USVisaScheduling could not request the email verification code.",
        "send_verification",
      );
      return buildRegistrationFailureResult({ gate });
    }
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(500);
    const sendError = await this.readRegistrationError(page);
    if (sendError) {
      const gate = this.registrationErrorGate(sendError, "send_verification");
      return buildRegistrationFailureResult({ gate });
    }

    const requiredVerificationControls = [
      { name: "verificationCode", selector: US_VISA_SCHEDULING_SELECTORS.verificationCodeInputs },
      { name: "verifyCode", selector: US_VISA_SCHEDULING_SELECTORS.verifyCodeButtons },
    ];
    // B2C can settle its network requests while the send-code widget is still
    // showing email_ver_wait. Wait for the actual input instead of treating
    // that transient state as a missing registration form.
    const verificationDeadline = Date.now() + 30_000;
    let verificationControls = await this.missingVisibleControls(page, requiredVerificationControls);
    while (verificationControls.length > 0 && Date.now() < verificationDeadline) {
      const delayedSendError = await this.readRegistrationError(page);
      if (delayedSendError) {
        return buildRegistrationFailureResult({
          gate: this.registrationErrorGate(delayedSendError, "send_verification"),
          verificationRequestedAt,
        });
      }
      await page.waitForTimeout(250);
      verificationControls = await this.missingVisibleControls(page, requiredVerificationControls);
    }
    if (verificationControls.length > 0) {
      const gate = buildVerificationFailureGate(
        "verification_controls_missing",
        "verification_controls_missing",
        "USVisaScheduling did not show the email verification controls after sending the code.",
        "send_verification",
        { missing_controls: verificationControls },
      );
      return buildRegistrationFailureResult({
        gate,
        verificationRequestedAt,
      });
    }

    this.pendingRegistrationCredentials = credentials;
    this.pendingRegistrationPage = page;
    this.pendingRegistrationPageOrigin = readPageOrigin(page);
    this.pendingRegistrationVerificationRequestedAt = verificationRequestedAt;
    this.pendingRegistrationEmailVerified = false;
    this.pendingRegistrationAccountCreated = false;
    return {
      readyForSlotCapture: false,
      gate: buildAccountEmailVerificationGate(credentials.email),
      verificationRequestedAt,
      emailVerified: false,
      accountCreated: false,
    };
  }

  private async fillSecurityQuestions(page: Page): Promise<boolean> {
    const questionSelector = await this.resolveRegistrationQuestionSelector(page);
    const answerSelector = await this.resolveRegistrationAnswerSelector(page);
    const selects = page.locator(questionSelector);
    const answers = page.locator(answerSelector);
    const selectCount = await this.visibleEnabledCount(selects);
    const answerCount = await this.visibleEnabledCount(answers);
    if (selectCount < 3 || answerCount < 3) return false;

    let selected = 0;
    for (let index = 0; index < await selects.count() && selected < 3; index += 1) {
      const select = selects.nth(index);
      if (!await select.isVisible().catch(() => false)
        || !await select.isEnabled().catch(() => false)
        || await select.locator("option").count().catch(() => 0) < 2) continue;
      await select.selectOption({ index: 1 });
      selected += 1;
    }
    if (selected < 3) return false;

    let filled = 0;
    for (let index = 0; index < await answers.count() && filled < 3; index += 1) {
      const answer = answers.nth(index);
      if (!await answer.isVisible().catch(() => false)
        || !await answer.isEnabled().catch(() => false)) continue;
      await this.fillVisibleLocator(
        answer,
        US_VISA_SCHEDULING_SECURITY_ANSWERS[filled] ?? "VizaAnswer",
        5_000,
      );
      filled += 1;
    }
    return filled === 3;
  }

  private async resolveRegistrationQuestionSelector(page: Page): Promise<string> {
    const exact = US_VISA_SCHEDULING_SELECTORS.registrationSecurityQuestionInputs;
    if (await this.visibleEnabledCount(page.locator(exact)) >= 3) return exact;
    return `${exact}, select[id*='question' i], select[name*='question' i]`;
  }

  private async resolveRegistrationAnswerSelector(page: Page): Promise<string> {
    const exact = US_VISA_SCHEDULING_SELECTORS.registrationSecurityAnswerInputs;
    if (await this.visibleEnabledCount(page.locator(exact)) >= 3) return exact;
    return `${exact}, input[id*='answer' i], input[name*='answer' i], input[aria-label*='answer' i]`;
  }

  private async visibleEnabledCount(locator: Locator): Promise<number> {
    let visible = 0;
    const count = Math.min(await locator.count().catch(() => 0), 100);
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible().catch(() => false)
        && await candidate.isEnabled().catch(() => false)
        && await candidate.getAttribute("aria-disabled").catch(() => null) !== "true") {
        visible += 1;
      }
    }
    return visible;
  }

  private async missingVisibleControls(
    page: Page,
    controls: Array<{ name: string; selector: string }>,
  ): Promise<string[]> {
    const missing: string[] = [];
    for (const control of controls) {
      if (await this.visibleEnabledCount(page.locator(control.selector)) === 0) {
        missing.push(control.name);
      }
    }
    return missing;
  }

  private async missingRegistrationControls(page: Page): Promise<string[]> {
    const missing = await this.missingVisibleControls(page, [
      { name: "username", selector: US_VISA_SCHEDULING_SELECTORS.registrationUsernameInputs },
      { name: "newPassword", selector: US_VISA_SCHEDULING_SELECTORS.registrationNewPasswordInputs },
      { name: "confirmPassword", selector: US_VISA_SCHEDULING_SELECTORS.registrationConfirmPasswordInputs },
      { name: "email", selector: US_VISA_SCHEDULING_SELECTORS.registrationEmailInputs },
      { name: "givenName", selector: US_VISA_SCHEDULING_SELECTORS.registrationGivenNameInputs },
      { name: "surname", selector: US_VISA_SCHEDULING_SELECTORS.registrationSurnameInputs },
      { name: "sendVerificationCode", selector: US_VISA_SCHEDULING_SELECTORS.sendVerificationCodeButtons },
    ]);
    const questionSelector = await this.resolveRegistrationQuestionSelector(page);
    const answerSelector = await this.resolveRegistrationAnswerSelector(page);
    const questionCount = await this.visibleEnabledCount(page.locator(questionSelector));
    const answerCount = await this.visibleEnabledCount(page.locator(answerSelector));
    if (questionCount < 3) missing.push("securityQuestions");
    if (answerCount < 3) missing.push("securityAnswers");
    return missing;
  }

  private async readRegistrationError(
    page: Page,
  ): Promise<"duplicate" | "invalid_code" | "send_failed" | "create_failed" | "generic" | null> {
    const messages = await page.locator(
      ".error:visible, .error-message:visible, .errorMessage:visible, [role='alert']:visible, [aria-live='assertive']:visible, .validation-summary-errors:visible, [data-error]:visible",
    ).allTextContents().catch(() => []);
    const text = normalizeVisibleText(messages.join(" ")).toLowerCase();
    if (!text) return null;
    if (/8\s*[-–]\s*16 characters.*containing/.test(text)) return "generic";
    if (/already exists|already registered|duplicate|taken|in use|已存在|已注册|重复/.test(text)) return "duplicate";
    if (
      /(?:verification|security).*(?:code|token).*(?:invalid|incorrect|expired|not valid|wrong|rejected|failed|error)/.test(text)
      || /(?:invalid|incorrect|expired|not valid|wrong|rejected|failed|error).*(?:verification|security).*(?:code|token)/.test(text)
      || /验证码.*(?:错误|无效|过期|不正确|失败)/.test(text)
    ) {
      return "invalid_code";
    }
    if (/send|email|verification/.test(text) && /failed|error|unable|invalid|not available|cannot|无法|失败|错误/.test(text)) {
      return "send_failed";
    }
    if (/create|registration|account/.test(text) && /failed|error|unable|cannot|rejected|无法|失败|错误|拒绝/.test(text)) {
      return "create_failed";
    }
    if (/incorrect|invalid|failed|failure|unable|error|cannot|rejected|expired|too many|exceeded|locked|suspended|denied|unavailable|错误|无效|失败|过期|锁定|拒绝/.test(text)) {
      return "generic";
    }
    return null;
  }

  private registrationErrorGate(
    kind: "duplicate" | "invalid_code" | "send_failed" | "create_failed" | "generic",
    operation: string,
    accountCreationSubmitted = false,
  ): AppointmentPortalGate {
    if (kind === "duplicate") {
      return buildRegistrationGate({
        gateType: "account_already_exists",
        errorCode: "account_already_exists",
        errorMessage: "USVisaScheduling rejected registration because the account already exists.",
        instruction: "Use the existing USVisaScheduling account instead of registering it again.",
        operation,
        actionType: "login",
        metadata: { duplicate_registration_blocked: true },
      });
    }
    if (kind === "invalid_code") {
      return buildVerificationFailureGate(
        "verification_code_invalid",
        "verification_code_invalid",
        "USVisaScheduling rejected the email verification code; account creation was not confirmed.",
        operation,
        undefined,
        accountCreationSubmitted,
      );
    }
    if (kind === "send_failed") {
      return buildVerificationFailureGate(
        "verification_send_failed",
        "verification_send_failed",
        "USVisaScheduling did not send the email verification code.",
        operation,
        undefined,
        accountCreationSubmitted,
      );
    }
    if (kind === "create_failed") {
      return buildVerificationFailureGate(
        "account_creation_failed",
        "account_creation_failed",
        "USVisaScheduling rejected account creation; success was not recorded.",
        operation,
        undefined,
        accountCreationSubmitted,
      );
    }
    return buildVerificationFailureGate(
      "registration_step_failed",
      "registration_step_failed",
      "USVisaScheduling registration did not complete; no success was recorded.",
      operation,
      undefined,
      accountCreationSubmitted,
    );
  }

  private async hasRegistrationVerificationSuccessEvidence(page: Page): Promise<boolean> {
    const editVisible = await page.locator("#email_ver_but_edit").isVisible().catch(() => false);
    if (editVisible) {
      const [codeVisible, verifyVisible] = await Promise.all([
        this.visibleEnabledCount(page.locator(
          "#email_ver_input, #emailVerificationControl_code",
        ))
          .then((count) => count > 0),
        this.visibleEnabledCount(page.locator(
          "#email_ver_but_verify, #emailVerificationControl_but_verify_code",
        ))
          .then((count) => count > 0),
      ]);
      if (!codeVisible && !verifyVisible) return true;
    }

    const messages = await page.locator(
      "#email_success:visible, [role='status']:visible",
    ).allTextContents().catch(() => []);
    return messages.some((message) => /^(?:email )?(?:verified|confirmed)(?: successfully)?[.!]?$/i.test(normalizeVisibleText(message)));
  }

  private async hasAccountCreationSuccessEvidence(page: Page): Promise<boolean> {
    let current: URL;
    try {
      current = new URL(page.url());
    } catch {
      return false;
    }
    const officialPortal = current.hostname === "usvisascheduling.com"
      || current.hostname.endsWith(".usvisascheduling.com");
    const authTransit = /b2clogin|atlasauth/i.test(current.hostname)
      || /\/signin-aad-|\/oauth2\/|\/authorize|\/account\/login$/i.test(current.pathname);
    if (!officialPortal && current.origin !== this.pendingRegistrationPageOrigin) return false;
    if (officialPortal && !authTransit) {
      const signOut = page.locator(
        "a:has-text('Sign out'), button:has-text('Sign out'), a:has-text('Log out'), button:has-text('Log out'), a:has-text('退出'), button:has-text('退出')",
      ).first();
      const [signOutVisible, loginVisible, registrationVisible] = await Promise.all([
        signOut.isVisible().catch(() => false),
        this.isLoginVisible(page),
        isUSVisaSchedulingRegistrationFormVisible(page),
      ]);
      // A newly authenticated account can still need profile/payment setup.
      // Calendar availability is not evidence of whether registration succeeded.
      if (signOutVisible && !loginVisible && !registrationVisible) return true;
      if (/\/profile\/?$/i.test(current.pathname) && !loginVisible && !registrationVisible
        && this.pendingRegistrationCredentials) {
        const primaryEmails = await page.locator("a[href^='mailto:']").evaluateAll((links) =>
          links.map((link) => link.getAttribute("href")?.slice(7).split("?")[0].toLowerCase()));
        const logoutLink = page.locator("a[href*='/Account/Login/LogOff']");
        if (primaryEmails.includes(this.pendingRegistrationCredentials.email.toLowerCase())
          && await logoutLink.count() > 0
          && await page.locator("#change-password").isVisible().catch(() => false)
          && await page.locator("#firstname").isVisible().catch(() => false)) return true;
      }
    }

    const explicitMessages = await page.locator(
      "h1:visible, h2:visible, [role='status']:visible",
    ).allTextContents().catch(() => []);
    return explicitMessages.some((message) => /^(?:your )?account (?:has been )?created(?: successfully)?[.!]?$/i.test(normalizeVisibleText(message))
      || /^(?:account creation|registration) (?:was )?successful[.!]?$/i.test(normalizeVisibleText(message))
      || /^(?:账户已创建|注册成功)[。.!！]?$/u.test(normalizeVisibleText(message)));
  }

  private requirePendingRegistrationSession(page: Page): { gate?: AppointmentPortalGate } {
    if (
      !this.pendingRegistrationCredentials
      || !this.pendingRegistrationPage
      || !this.pendingRegistrationPageOrigin
      || !this.pendingRegistrationVerificationRequestedAt
    ) {
      return {
        gate: buildVerificationFailureGate(
          "registration_session_missing",
          "registration_session_missing",
          "USVisaScheduling registration has no pending verification session.",
          "verify_code",
        ),
      };
    }
    if (this.pendingRegistrationPage !== page || page.isClosed()) {
      return {
        gate: buildVerificationFailureGate(
          "registration_session_expired",
          "registration_session_expired",
          "USVisaScheduling registration verification must continue in the original browser session.",
          "verify_code",
        ),
      };
    }
    if (readPageOrigin(page) !== this.pendingRegistrationPageOrigin) {
      return {
        gate: buildVerificationFailureGate(
          "registration_session_expired",
          "registration_session_expired",
          "USVisaScheduling registration browser session was redirected or expired.",
          "verify_code",
        ),
      };
    }
    return {};
  }

  private async answerLoginSecurityQuestions(page: Page): Promise<"absent" | "error" | "already_submitted" | "submitted"> {
    const answers = page.locator("input#kba1_response, input#kba2_response, input#kba3_response");
    const visibleIds = await answers.evaluateAll((inputs) => inputs
      .filter((input) => input.checkVisibility()).map((input) => input.id).sort())
      .catch(() => [] as string[]);
    if (await this.hasAuthenticationValidationError(page)) return "error";
    if (visibleIds.length === 0) return "absent";
    // OAuth query parameters rotate; the visible question ids identify this
    // checkpoint without storing either an answer or an authorization token.
    const current = readPageUrl(page);
    if (!current) return "absent";
    const signature = `${current.pathname}:${visibleIds.join(",")}`;
    if (this.securityQuestionAttempt?.page === page && this.securityQuestionAttempt.signature === signature) return "already_submitted";
    const filled = await page.evaluate(`(() => {
      const valuesById = {
        kba1_response: ${JSON.stringify(US_VISA_SCHEDULING_SECURITY_ANSWERS[0])},
        kba2_response: ${JSON.stringify(US_VISA_SCHEDULING_SECURITY_ANSWERS[1])},
        kba3_response: ${JSON.stringify(US_VISA_SCHEDULING_SECURITY_ANSWERS[2])}
      };
      Object.entries(valuesById).forEach(([id, value]) => {
        const input = document.querySelector("input#" + id);
        if (!input) return;
        const descriptor = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        );
        descriptor?.set?.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      return true;
    })()`).catch(() => false);
    // A B2C navigation can replace the document between observation and fill.
    // No submit happened yet, so the bounded login loop may observe it again.
    if (!filled) return "absent";
    this.securityQuestionAttempt = { page, signature };
    await page.locator("button#continue, button:has-text('Continue'), input[value='Continue']")
      .first()
      .click()
      .catch(() => undefined);
    return "submitted";
  }

  private async hasAuthenticationValidationError(page: Page): Promise<boolean> {
    const messages = await page.locator(".error:visible, [role='alert']:visible, #claimVerificationServerError:visible, .validation-summary-errors:visible")
      .allTextContents().catch(() => []);
    return messages.some((message) => /incorrect|invalid|failed|failure|unable|error|too many|exceeded|locked|suspended|denied|unavailable/i.test(message));
  }

  private async acceptTermsCheckpointIfPresent(page: Page): Promise<void> {
    if (!isUSVisaSchedulingTermsUrl(readPageUrl(page))) return;
    await page.locator("#privacy-act-visual").waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
    if (!await page.locator("#privacy-act-visual").isVisible().catch(() => false)
      || !await page.locator("#confidentiality-agreement").isVisible().catch(() => false)) return;

    const checkboxes = page.locator("#privacy-act-visual, #confidentiality-agreement");
    const checkboxCount = await checkboxes.count().catch(() => 0);
    for (let index = 0; index < checkboxCount; index += 1) {
      const checkbox = checkboxes.nth(index);
      if (await checkbox.isVisible().catch(() => false)) {
        await checkbox.check();
      }
    }

    const continueControl = page
      .locator(
        "input#submit-agreement, button:has-text('Continue'), input[value='Continue'], button:has-text('I agree'), input[value*='Agree' i], a:has-text('Continue')",
      )
      .first();
    if (await continueControl.isVisible().catch(() => false)) {
      await continueControl.click();
      await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
      await page.waitForURL((url) => !/\/Account\/Login\/TermsAndConditions\/?$/i.test(url.pathname), { timeout: 30_000 }).catch(() => undefined);
      await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
    }
  }

  private async readVisibleSlotCandidates(page: Page): Promise<VisibleSlotCandidate[]> {
    const nodes = page.locator(US_VISA_SCHEDULING_SELECTORS.slotCandidates);
    const candidates: VisibleSlotCandidate[] = [];
    const count = Math.min(await nodes.count().catch(() => 0), 100);
    for (let index = 0; index < count; index += 1) {
      const node = nodes.nth(index);
      if (!await node.isVisible() || !await node.isEnabled()
        || await node.getAttribute("aria-disabled") === "true") continue;
      const text = (await node.innerText({ timeout: 1_000 })
        .catch(() => node.textContent({ timeout: 1_000 }))
        .catch(() => "")) ?? "";
      if (!text.trim()) continue;
      candidates.push({
        text,
        externalSlotId:
          await node.getAttribute("data-slot-id").catch(() => null)
          ?? await node.getAttribute("data-appointment-slot").catch(() => null)
          ?? await node.getAttribute("id").catch(() => null),
      });
    }
    return candidates;
  }

  private clearPreparedSession(): void {
    this.preparedJobId = null;
    this.preparedPage = null;
    this.preparedPageOrigin = null;
  }

  private clearPendingRegistration(): void {
    this.pendingRegistrationCredentials = null;
    this.pendingRegistrationPage = null;
    this.pendingRegistrationPageOrigin = null;
    this.pendingRegistrationVerificationRequestedAt = null;
    this.pendingRegistrationEmailVerified = false;
    this.pendingRegistrationAccountCreated = false;
    this.pendingRegistrationPostCreateLoginAttempted = false;
  }

  private markPreparedSession(jobId: string, page: Page): void {
    const origin = readPageOrigin(page);
    if (!origin) {
      throw new Error("USVisaScheduling prepared page has no usable browser origin.");
    }
    this.preparedJobId = jobId;
    this.preparedPage = page;
    this.preparedPageOrigin = origin;
  }

  private async requirePreparedSession(
    job: USAppointmentJobRow,
    requireCalendar: boolean,
  ): Promise<Page> {
    if (this.preparedJobId !== job.id || !this.preparedPage || !this.preparedPageOrigin) {
      throw new Error("USVisaScheduling page must be prepared for this job before continuing.");
    }

    const page = this.preparedPage;
    if (page.isClosed() || this.page !== page) {
      this.clearPreparedSession();
      throw new Error("USVisaScheduling prepared browser session is closed.");
    }

    const currentOrigin = readPageOrigin(page);
    if (!currentOrigin || currentOrigin !== this.preparedPageOrigin) {
      this.clearPreparedSession();
      throw new Error("USVisaScheduling prepared browser session was redirected or expired.");
    }

    const gate = await this.detectGate(page);
    if (gate) {
      this.clearPreparedSession();
      throw new Error(
        `USVisaScheduling prepared browser session reached ${gate.errorCode ?? "an official checkpoint"}.`,
      );
    }
    if (await this.isLoginVisible(page)) {
      this.clearPreparedSession();
      throw new Error("USVisaScheduling prepared browser session is no longer authenticated.");
    }

    const bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
    if (!normalizeVisibleText(bodyText)) {
      this.clearPreparedSession();
      throw new Error("USVisaScheduling prepared browser session has no visible page state.");
    }
    if (requireCalendar && !await this.isCalendarReady(page)) {
      this.clearPreparedSession();
      throw new Error("USVisaScheduling calendar is no longer ready for the requested operation.");
    }
    return page;
  }

  private async isCalendarReady(page: Page): Promise<boolean> {
    const candidates = await this.readVisibleSlotCandidates(page);
    if (candidates.some((candidate) => parseUSAppointmentDate(candidate.text)
      && parseUSAppointmentTime(candidate.text))) return true;
    const body = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
    return hasUSAppointmentNoSlotsMessage(body);
  }

  private async detectGate(page: Page): Promise<AppointmentPortalGate | null> {
    const [currentUrl, title, bodyText] = await Promise.all([
      Promise.resolve(page.url()),
      page.title().catch(() => ""),
      page.locator("body").innerText({ timeout: 5_000 }).catch(() => ""),
    ]);
    const parsedUrl = readPageUrl(page);
    const classificationUrl = parsedUrl ? `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}` : "";
    const gate = classifyUSVisaSchedulingGateText(`${classificationUrl} ${title} ${bodyText}`);
    if (gate) return gate;
    if (
      /usvisascheduling\.com/i.test(currentUrl)
      && normalizeVisibleText(bodyText).length === 0
    ) {
      return classifyUSVisaSchedulingGateText("Cloudflare empty official page while verifying browser.");
    }
    return null;
  }

  private async readTurnstileParams(page: Page): Promise<TurnstileParams> {
    return page.evaluate(`(() => {
      const w = window;
      const captured = w.__vizaTurnstileParams ?? {};
      const elementSitekey = document
        .querySelector("[data-sitekey]")
        ?.getAttribute("data-sitekey");
      const iframeSitekey = Array.from(document.querySelectorAll("iframe"))
        .map((iframe) => {
          try {
            const url = new URL(iframe.src);
            return url.searchParams.get("sitekey") ?? url.searchParams.get("k");
          } catch {
            return null;
          }
        })
        .find((value) => Boolean(value));

      const stringValue = (value) =>
        typeof value === "string" && value.trim() ? value : null;

      return {
        sitekey: stringValue(captured.sitekey) ?? elementSitekey ?? iframeSitekey ?? null,
        action: stringValue(captured.action),
        cData: stringValue(captured.cData),
        chlPageData: stringValue(captured.chlPageData),
        pageUrl: stringValue(captured.pageUrl) ?? window.location.href,
        userAgent: stringValue(captured.userAgent) ?? navigator.userAgent,
      };
    })()`);
  }

  private async waitForTurnstileParams(
    page: Page,
    timeoutMs = 15_000,
  ): Promise<TurnstileParams> {
    const started = Date.now();
    let latest = await this.readTurnstileParams(page);
    while (!latest.sitekey && Date.now() - started < timeoutMs) {
      await page.waitForTimeout(250);
      latest = await this.readTurnstileParams(page);
    }
    return latest;
  }

  private async applyTurnstileToken(page: Page, token: string): Promise<void> {
    await page.evaluate(`(() => {
      const captchaToken = ${JSON.stringify(token)};
      const w = window;
      const fields = document.querySelectorAll(
        "input[name='cf-turnstile-response'], textarea[name='cf-turnstile-response'], input[name='g-recaptcha-response'], textarea[name='g-recaptcha-response']",
      );
      fields.forEach((field) => {
        field.value = captchaToken;
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.dispatchEvent(new Event("change", { bubbles: true }));
      });
      if (typeof w.__vizaTurnstileCallback === "function") {
        w.__vizaTurnstileCallback(captchaToken);
      }
    })()`);
  }

  private async solveTurnstileIfPresent(
    page: Page,
  ): Promise<{ solveId: string; durationMs: number } | null> {
    if (!this.config.captchaSolvingEnabled || !this.config.twoCaptchaConfigured) {
      return null;
    }
    const params = await this.waitForTurnstileParams(page);
    if (!params.sitekey) return null;

    const solve = await solveCaptcha({
      type: "turnstile",
      siteKey: params.sitekey,
      pageUrl: params.pageUrl,
      action: params.action ?? undefined,
      cdata: params.cData ?? undefined,
      pageData: params.chlPageData ?? undefined,
      userAgent: params.userAgent,
      timeoutMs: 120_000,
    });
    await this.applyTurnstileToken(page, solve.text);
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
    await page.waitForFunction(() => {
      const text = document.body?.innerText ?? "";
      return !/Cloudflare|安全验证|verify you are human|checking your browser|Attention Required/i.test(text);
    }, { timeout: 30_000 }).catch(() => undefined);
    return { solveId: solve.solveId, durationMs: solve.durationMs };
  }

  private scheduleControl(page: Page) {
    return page
      .locator("a:has-text('Appointment'), a:has-text('Schedule'), button:has-text('Schedule'), button:has-text('Appointment'), a:has-text('预约'), button:has-text('预约'), a:has-text('日历'), button:has-text('日历')")
      .first();
  }

  private async readDiagnostics(page: Page): Promise<PortalDiagnostics> {
    const diagnosticUrl = readPageUrl(page);
    const [currentUrl, title, bodyText, loginVisible, scheduleControlVisible, slotCandidateCount] =
      await Promise.all([
        Promise.resolve(diagnosticUrl && ["http:", "https:"].includes(diagnosticUrl.protocol)
          ? `${diagnosticUrl.protocol}//${diagnosticUrl.host}${diagnosticUrl.pathname}`
          : ""),
        page.title().catch(() => ""),
        page.locator("body").innerText({ timeout: 5_000 }).catch(() => ""),
        this.isLoginVisible(page).catch(() => false),
        this.scheduleControl(page).isVisible().catch(() => false),
        page.locator(US_VISA_SCHEDULING_SELECTORS.slotCandidates).count().catch(() => 0),
      ]);
    return {
      currentUrl,
      title: normalizeVisibleText(title),
      bodyTextLength: normalizeVisibleText(bodyText).length,
      loginVisible,
      scheduleControlVisible,
      slotCandidateCount,
    };
  }

  private async readAccountSessionDiagnostics(
    page: Page,
  ): Promise<USAppointmentAccountSessionDiagnostics> {
    const diagnostics = await this.readDiagnostics(page);
    const visibleInputIds = await page.locator("input").evaluateAll((inputs) => inputs
      .filter((input) => input.checkVisibility()).map((input) => input.id).filter(Boolean)).catch(() => []);
    const hasCaptchaImage = await page.locator('img[id*="captcha" i], img[src*="captcha" i], canvas[id*="captcha" i]')
      .evaluateAll((elements) => elements.some((element) => element.checkVisibility())).catch(() => false);
    let currentHost: string | null = null;
    try {
      currentHost = new URL(diagnostics.currentUrl).hostname || null;
    } catch {
      currentHost = null;
    }
    return {
      currentHost,
      pageTitlePresent: Boolean(diagnostics.title),
      bodyTextLength: diagnostics.bodyTextLength,
      loginVisible: diagnostics.loginVisible,
      scheduleControlVisible: diagnostics.scheduleControlVisible,
      slotCandidateCount: diagnostics.slotCandidateCount,
      visibleInputIds,
      hasCaptchaImage,
      securityQuestionInputCount: visibleInputIds.filter((id) => /^kba[123]_response$/.test(id)).length,
    };
  }

  private async clickSelectedSlot(page: Page, selectedSlot: AppointmentSlotRow): Promise<void> {
    if (!selectedSlot.appointment_date || !selectedSlot.appointment_time
      || !selectedSlot.appointment_location) {
      throw new Error("Selected USVisaScheduling slot is missing date, time, or location.");
    }
    const candidates = page.locator(US_VISA_SCHEDULING_SELECTORS.slotCandidates);
    const count = await candidates.count();
    const matches: Locator[] = [];
    for (let index = 0; index < count; index += 1) {
      const candidate = candidates.nth(index);
      if (!await candidate.isVisible() || !await candidate.isEnabled()
        || await candidate.getAttribute("aria-disabled") === "true") continue;
      const text = await candidate.innerText().catch(() => "");
      if (
        parseUSAppointmentDate(text) === selectedSlot.appointment_date
        && parseUSAppointmentTime(text) === selectedSlot.appointment_time.slice(0, 5)
        && normalizeVisibleText(text).toLowerCase()
          .includes(normalizeVisibleText(selectedSlot.appointment_location).toLowerCase())
      ) {
        matches.push(candidate);
      }
    }
    if (matches.length !== 1) {
      throw new Error("Selected USVisaScheduling slot was missing or ambiguous on the official calendar.");
    }
    await matches[0].click();
  }

  private async clickFirstVisible(page: Page, selector: string): Promise<void> {
    const candidates = page.locator(selector);
    const deadline = Date.now() + 15_000;
    do {
      for (let index = 0; index < await candidates.count(); index += 1) {
        const candidate = candidates.nth(index);
        if (await candidate.isVisible() && await candidate.isEnabled()) {
          await candidate.click();
          return;
        }
      }
      await page.waitForTimeout(100);
    } while (Date.now() < deadline);
    throw new Error("USVisaScheduling did not show an enabled control for the current step.");
  }

  private async fillFirstVisible(page: Page, selector: string, value: string): Promise<void> {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (!await candidate.isVisible().catch(() => false)) continue;
      try {
        await this.fillVisibleLocator(candidate, value, 5_000);
        return;
      } catch {
        const filled = await this.assignFirstInputForSelector(page, selector, value);
        if (filled) return;
      }
    }
    const first = locator.first();
    await first.waitFor({ state: "attached", timeout: 15_000 });
    const filled =
      await this.assignFirstInputForSelector(page, selector, value)
      || await this.typeIntoFocusedInputForSelector(page, selector, value);
    if (filled) return;
    const diagnostics = await this.readInputAssignmentDiagnostics(page, selector);
    if (diagnostics) {
      console.warn("[us-appointment] input assignment fallback failed", diagnostics);
    }
    await this.fillVisibleLocator(first, value, 15_000);
  }

  private async typeIntoFocusedInputForSelector(
    page: Page,
    selector: string,
    value: string,
  ): Promise<boolean> {
    const focused = await page.evaluate(`(() => {
      const selectorText = ${JSON.stringify(selector)};
      const parts = selectorText
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      for (const part of parts) {
        let element = null;
        try {
          element = document.querySelector(part);
        } catch {
          continue;
        }
        if (!element) continue;
        const tagName = element.tagName.toLowerCase();
        if (!["input", "textarea"].includes(tagName)) continue;
        const field = element;
        field.focus();
        field.value = "";
        field.dispatchEvent(new Event("input", { bubbles: true }));
        return document.activeElement === field;
      }
      return false;
    })()`).catch(() => false);
    if (!focused) return false;

    for (const character of value) {
      await page.keyboard.type(character, { delay: this.randomTypingDelayMs() });
    }

    return page.evaluate(`(() => {
      const selectorText = ${JSON.stringify(selector)};
      const expectedValue = ${JSON.stringify(value)};
      const parts = selectorText
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      for (const part of parts) {
        let element = null;
        try {
          element = document.querySelector(part);
        } catch {
          continue;
        }
        if (!element) continue;
        const tagName = element.tagName.toLowerCase();
        if (!["input", "textarea"].includes(tagName)) continue;
        return element.value === expectedValue;
      }
      return false;
    })()`).then(Boolean).catch(() => false);
  }

  private async readInputAssignmentDiagnostics(
    page: Page,
    selector: string,
  ): Promise<unknown | null> {
    return page.evaluate(`(() => {
      const selectorText = ${JSON.stringify(selector)};
      const parts = selectorText
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      const details = [];
      for (const part of parts) {
        let elements = [];
        try {
          elements = Array.from(document.querySelectorAll(part));
        } catch (error) {
          details.push({
            selector: part,
            selectorError: error && error.message ? error.message : String(error),
          });
          continue;
        }
        for (const element of elements.slice(0, 3)) {
          const style = window.getComputedStyle(element);
          const input = element;
          const descriptor = Object.getOwnPropertyDescriptor(
            Object.getPrototypeOf(input),
            "value",
          );
          details.push({
            selector: part,
            tagName: element.tagName.toLowerCase(),
            type: input.type ?? null,
            disabled: Boolean(input.disabled),
            readOnly: Boolean(input.readOnly),
            ariaDisabled: element.getAttribute("aria-disabled"),
            display: style.display,
            visibility: style.visibility,
            pointerEvents: style.pointerEvents,
            offsetWidth: element.offsetWidth,
            offsetHeight: element.offsetHeight,
            hasValueSetter: typeof descriptor?.set === "function",
            valueLength: typeof input.value === "string" ? input.value.length : null,
          });
        }
      }
      return {
        matchedCount: details.length,
        details,
        activeTag: document.activeElement?.tagName.toLowerCase() ?? null,
        readyState: document.readyState,
      };
    })()`).catch(() => null);
  }

  private async assignFirstInputForSelector(
    page: Page,
    selector: string,
    value: string,
  ): Promise<boolean> {
    return page.evaluate(`(() => {
      const selectorText = ${JSON.stringify(selector)};
      const inputValue = ${JSON.stringify(value)};
      const candidates = selectorText
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      for (const candidate of candidates) {
        let element = null;
        try {
          element = document.querySelector(candidate);
        } catch {
          continue;
        }
        if (!element) continue;
        const tagName = element.tagName.toLowerCase();
        if (!["input", "textarea"].includes(tagName)) continue;
        const field = element;
        const prototype = tagName === "textarea"
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
        element.dispatchEvent(new Event("focus", { bubbles: true }));
        if (typeof descriptor?.set === "function") {
          descriptor.set.call(field, inputValue);
        } else {
          field.value = inputValue;
        }
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        element.dispatchEvent(new Event("blur", { bubbles: true }));
        return field.value === inputValue;
      }
      return false;
    })()`).then(Boolean).catch(() => false);
  }

  private async assignLocatorCollectionValue(
    locator: Locator,
    value: string,
  ): Promise<boolean> {
    void locator;
    void value;
    return false;
  }

  private async assignInputValue(locator: Locator, value: string): Promise<boolean> {
    void locator;
    void value;
    return false;
  }

  private randomTypingDelayMs(): number {
    const min = Math.max(0, this.config.typingDelayMinMs);
    const max = Math.max(min, this.config.typingDelayMaxMs);
    if (max === min) return min;
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  private async fillVisibleLocator(
    locator: Locator,
    value: string,
    timeout: number,
  ): Promise<void> {
    if (this.config.typingDelayMaxMs <= 0) {
      await locator.fill(value, { timeout });
      return;
    }
    await locator.click({ timeout });
    await locator.fill("", { timeout });
    for (const character of value) {
      await locator.pressSequentially(character, {
        delay: this.randomTypingDelayMs(),
        timeout,
      });
    }
  }

  private async readFirstVisibleText(page: Page, selector: string): Promise<string> {
    const locator = page.locator(selector).first();
    await locator.waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
    return normalizeVisibleText(await locator.innerText().catch(() => ""));
  }

  private async readAppointmentStatusText(page: Page): Promise<string> {
    const locator = page.locator(US_VISA_SCHEDULING_SELECTORS.statusText);
    const count = Math.min(await locator.count().catch(() => 0), 20);
    const texts: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (!await candidate.isVisible().catch(() => false)) continue;
      const text = normalizeVisibleText(await candidate.innerText().catch(() => ""));
      const attribute = normalizeVisibleText(
        await candidate.getAttribute("data-appointment-status").catch(() => null),
      );
      const evidence = text || attribute;
      if (evidence) texts.push(evidence);
    }
    return normalizeVisibleText(texts.join(" "));
  }

}

export async function createPlaywrightUSVisaSchedulingPortalClient(
  config: USAppointmentRunnerConfig,
  options: PlaywrightUSVisaSchedulingPortalClientOptions = {},
): Promise<PlaywrightUSVisaSchedulingPortalClient> {
  return new PlaywrightUSVisaSchedulingPortalClient(config, options);
}
