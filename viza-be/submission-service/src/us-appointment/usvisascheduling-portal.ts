import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { solveCaptcha } from "../captcha";
import type {
  AppointmentAccountCredentials,
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
    "input[type='email'], input[name*='email' i], input[id*='email' i], input[name*='user' i], input[id*='user' i], input[placeholder*='Username' i], input[aria-label*='Username' i]",
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
  sendVerificationCodeButtons:
    "button:has-text('Send Verification Code'), button:has-text('Send New Code'), button:has-text('Send Verification'), button:has-text('发送验证码')",
  verificationCodeInputs:
    "input#verificationCode, input#emailVerificationControl_code, input[name*='verificationCode' i], input[name*='verification_code' i], input[aria-label*='Verification Code' i], input[placeholder*='Verification Code' i], input[aria-label*='验证码' i], input[placeholder*='验证码' i]",
  verifyCodeButtons:
    "button:has-text('Verify Code'), button:has-text('Verify'), button:has-text('Continue'), button:has-text('验证'), button:has-text('继续')",
  createAccountButtons:
    "button:has-text('Create'), button:has-text('Continue'), button:has-text('Submit'), button:has-text('Create Account'), button:has-text('创建'), button:has-text('继续'), button:has-text('提交'), input[type='submit']",
  slotCandidates:
    "[data-viza-appointment-slot], [data-slot-id], [data-appointment-slot], table tbody tr, .appointment-slot, .slot",
  confirmButtons:
    "button:has-text('Confirm'), button:has-text('Schedule'), button:has-text('Book'), button:has-text('Submit'), button:has-text('确认'), button:has-text('预约'), button:has-text('提交'), input[type='submit']",
  confirmationText:
    "[data-confirmation-number], .confirmation-number, *:has-text('Confirmation'), *:has-text('确认'), *:has-text('预约成功'), *:has-text('Appointment')",
  statusText:
    "[data-appointment-status], .appointment-status, *:has-text('Appointment'), *:has-text('Scheduled'), *:has-text('Cancelled'), *:has-text('确认'), *:has-text('已预约'), *:has-text('取消')",
} as const;

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

function normalizeVisibleText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function classifyUSVisaSchedulingGateText(text: string): AppointmentPortalGate | null {
  const normalized = normalizeVisibleText(text).toLowerCase();
  if (!normalized) return null;

  if (/hcaptcha|captcha|recaptcha|cloudflare|mfa|multi-factor|verification challenge/.test(normalized)) {
    let provider = "captcha_or_mfa";
    if (normalized.includes("hcaptcha")) provider = "hcaptcha";
    if (normalized.includes("recaptcha")) provider = "recaptcha";
    if (normalized.includes("cloudflare")) provider = "cloudflare";

    return {
      jobStatus: "appointment_manual_required",
      actionType: "captcha",
      instruction: "USVisaScheduling presented an unsupported CAPTCHA or MFA checkpoint.",
      metadata: {
        gate_type: "unsupported_captcha",
        provider,
        visible_text: "[REDACTED]",
      },
      errorCode: "unsupported_captcha",
      errorMessage: "USVisaScheduling presented an unsupported CAPTCHA or MFA checkpoint.",
    };
  }

  if (/waiting room|queue|too many requests|rate limit|temporarily unavailable/.test(normalized)) {
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

  if (/privacy policy|terms|accept.*policy|policy.*accept|review and accept/.test(normalized)) {
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

  if (/payment required|pay fee|mrv|receipt|payment/.test(normalized)) {
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

function containsAllVisibleParts(text: string, parts: Array<string | null>): boolean {
  const normalized = normalizeVisibleText(text).toLowerCase();
  return parts
    .filter((part): part is string => Boolean(part?.trim()))
    .every((part) => normalized.includes(normalizeVisibleText(part).toLowerCase()));
}

function parseDateFromText(text: string): string | null {
  const iso = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }
  return null;
}

function parseTimeFromText(text: string): string | null {
  const match = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!match) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
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
  const date = parseDateFromText(candidate.text);
  const time = parseTimeFromText(candidate.text);
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

function inferStatusFromText(text: string): string {
  if (/cancel/i.test(text) || /取消/.test(text)) return "appointment_cancelled";
  if (/scheduled|appointment|confirmed/i.test(text) || /已预约|确认/.test(text)) {
    return "appointment_exists";
  }
  return "unknown";
}

export class PlaywrightUSVisaSchedulingPortalClient implements USAppointmentPortalClient {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private connectedToUserBrowser = false;

  constructor(private readonly config: USAppointmentRunnerConfig) {}

  async registerAccount(
    credentials: AppointmentAccountCredentials,
  ): Promise<{ readyForSlotCapture: boolean; gate?: AppointmentPortalGate }> {
    const page = await this.getPage();
    await this.openPortal(page);
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

    return {
      readyForSlotCapture: false,
      gate: await this.startAccountRegistration(page, credentials),
    };
  }

  async completeAccountEmailVerification(input: {
    emailCode?: string | null;
    verificationLink?: string | null;
  }): Promise<{ readyForSlotCapture: boolean; gate?: AppointmentPortalGate }> {
    const page = await this.getPage();
    if (input.emailCode?.trim()) {
      await this.fillFirstVisible(
        page,
        US_VISA_SCHEDULING_SELECTORS.verificationCodeInputs,
        input.emailCode.trim(),
      );
      await this.clickFirstVisible(page, US_VISA_SCHEDULING_SELECTORS.verifyCodeButtons);
      await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
      await page.waitForTimeout(1_000);
      const postCodeGate = await this.detectGate(page);
      if (postCodeGate) return { readyForSlotCapture: false, gate: postCodeGate };
      await this.clickFirstVisible(page, US_VISA_SCHEDULING_SELECTORS.createAccountButtons)
        .catch(() => undefined);
      await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
      await page.waitForTimeout(1_000);
      const finalGate = await this.detectGate(page);
      if (finalGate) return { readyForSlotCapture: false, gate: finalGate };
      return { readyForSlotCapture: await this.readVisibleSlotCandidates(page).then((slots) => slots.length > 0) };
    }

    if (input.verificationLink?.trim()) {
      await page.goto(input.verificationLink.trim(), {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      await this.waitForPortalNavigationSettle(page);
      const linkGate = await this.detectGate(page);
      return linkGate
        ? { readyForSlotCapture: false, gate: linkGate }
        : { readyForSlotCapture: await this.readVisibleSlotCandidates(page).then((slots) => slots.length > 0) };
    }

    return {
      readyForSlotCapture: false,
      gate: {
        jobStatus: "appointment_manual_required",
        actionType: "account_email_verification",
        instruction:
          "USVisaScheduling sent an account verification email, but VIZA could not extract a verification code or link from inbound_email.",
        metadata: {
          gate_type: "account_email_verification_unreadable",
          provider: "usvisascheduling",
        },
        errorCode: "account_email_verification_unreadable",
        errorMessage: "USVisaScheduling account verification email did not contain an extractable code or link.",
      },
    };
  }

  async prepareAppointmentFlow(
    _job: USAppointmentJobRow,
    credentials: AppointmentAccountCredentials | null,
  ): Promise<{ readyForSlotCapture: boolean; gate?: AppointmentPortalGate }> {
    const page = await this.getPage();
    await this.openPortal(page);
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
      await this.login(page, credentials);
      await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
      await page.waitForTimeout(1_000);
      if (await this.isInvalidCredentialsVisible(page)) {
        const gate = await this.startAccountRegistration(page, credentials);
        return { readyForSlotCapture: false, gate };
      }
      const loginGate = await this.detectGate(page);
      if (loginGate) {
        const solved = loginGate.actionType === "captcha"
          ? await this.solveTurnstileIfPresent(page)
          : null;
        if (!solved) return { readyForSlotCapture: false, gate: loginGate };
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
    }

    const slots = await this.readVisibleSlotCandidates(page);
    if (slots.length > 0) return { readyForSlotCapture: true };

    const calendarLink = this.scheduleControl(page);
    if (await calendarLink.isVisible().catch(() => false)) {
      await calendarLink.click();
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
      const postClickGate = await this.detectGate(page);
      if (postClickGate) {
        return { readyForSlotCapture: false, gate: postClickGate };
      }
      return {
        readyForSlotCapture: (await this.readVisibleSlotCandidates(page)).length > 0,
      };
    }

    return {
      readyForSlotCapture: false,
      gate: buildUnknownPortalStateGate(await this.readDiagnostics(page)),
    };
  }

  async observeSlots(job: USAppointmentJobRow): Promise<SlotInsert[]> {
    const page = await this.getPage();
    await this.openPortal(page);
    const candidates = await this.readVisibleSlotCandidates(page);
    return candidates
      .map((candidate) => buildSlotInsert(job, candidate))
      .filter((slot): slot is SlotInsert => Boolean(slot));
  }

  async captureConfirmation(
    job: USAppointmentJobRow,
    selectedSlot: AppointmentSlotRow,
  ): Promise<ConfirmationInsert | null> {
    const page = await this.getPage();
    await this.openPortal(page);
    await this.clickSelectedSlot(page, selectedSlot);
    await this.clickFirstVisible(page, US_VISA_SCHEDULING_SELECTORS.confirmButtons);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    const confirmationText = await this.readFirstVisibleText(
      page,
      US_VISA_SCHEDULING_SELECTORS.confirmationText,
    );
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
      confirmation_number: this.extractConfirmationNumber(confirmationText),
      confirmation_pdf_url: null,
      confirmation_screenshot_url: null,
      raw_confirmation_redacted_json: {
        provider: "usvisascheduling",
        confirmationText: confirmationText ? "[REDACTED]" : null,
      },
    };
  }

  async captureStatusCheck(job: USAppointmentJobRow): Promise<StatusCheckInsert> {
    const page = await this.getPage();
    await this.openPortal(page);
    const text = await this.readFirstVisibleText(
      page,
      US_VISA_SCHEDULING_SELECTORS.statusText,
    );
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

  async close(): Promise<void> {
    await this.saveStorageState().catch(() => undefined);
    if (this.connectedToUserBrowser) {
      await this.page?.close().catch(() => undefined);
    } else {
      await this.browser?.close();
    }
    this.browser = null;
    this.context = null;
    this.page = null;
    this.connectedToUserBrowser = false;
  }

  private async getPage(): Promise<Page> {
    if (this.page) return this.page;
    if (this.config.playwrightCdpEndpoint) {
      this.browser = await chromium.connectOverCDP(this.config.playwrightCdpEndpoint, {
        timeout: 60_000,
      });
      this.connectedToUserBrowser = true;
      this.context = this.browser.contexts()[0] ?? await this.browser.newContext();
      this.page = await this.context.newPage();
      if (this.shouldInstallTurnstileHook()) {
        await this.installTurnstileHook(this.page);
      }
      return this.page;
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
    return this.page;
  }

  private shouldInstallTurnstileHook(): boolean {
    return !/brd\.superproxy\.io/i.test(this.config.playwrightCdpEndpoint ?? "");
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

  private async openPortal(page: Page): Promise<void> {
    await page.goto(this.config.baseUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await this.waitForPortalNavigationSettle(page);
  }

  private async waitForPortalNavigationSettle(page: Page): Promise<void> {
    const started = Date.now();
    while (Date.now() - started < 90_000) {
      const [currentUrl, title, bodyText, loginVisible] = await Promise.all([
        Promise.resolve(page.url()),
        page.title().catch(() => ""),
        page.locator("body").innerText({ timeout: 3_000 }).catch(() => ""),
        this.isLoginVisible(page).catch(() => false),
      ]);
      const normalized = normalizeVisibleText(`${title} ${bodyText}`);
      const isCloudflareTransit =
        /__cf_chl_rt_tk/.test(currentUrl)
        || /just a moment|loading|请稍候|正在验证|cloudflare|verify you are human|安全验证/i.test(normalized)
        || normalizeVisibleText(bodyText).length === 0;
      const reachedOfficialAuth =
        loginVisible
        || /b2clogin|signin|login|authorize/i.test(currentUrl)
        || /apply for a u\.s\. visa|user details|sign in/i.test(normalized);
      if (reachedOfficialAuth && !/__cf_chl_rt_tk/.test(currentUrl)) return;
      if (!isCloudflareTransit) return;
      await page.waitForTimeout(2_000);
    }
  }

  private async isLoginVisible(page: Page): Promise<boolean> {
    const emailVisible = await page.locator(US_VISA_SCHEDULING_SELECTORS.emailInputs)
      .first()
      .isVisible()
      .catch(() => false);
    const passwordVisible = await page.locator(US_VISA_SCHEDULING_SELECTORS.passwordInputs)
      .first()
      .isVisible()
      .catch(() => false);
    return emailVisible && passwordVisible;
  }

  private async login(page: Page, credentials: AppointmentAccountCredentials): Promise<void> {
    await this.fillFirstVisible(page, US_VISA_SCHEDULING_SELECTORS.emailInputs, credentials.email);
    await this.fillFirstVisible(page, US_VISA_SCHEDULING_SELECTORS.passwordInputs, credentials.password);
    await this.clickFirstVisible(page, US_VISA_SCHEDULING_SELECTORS.loginButtons);
  }

  private async isInvalidCredentialsVisible(page: Page): Promise<boolean> {
    const bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
    return /username or password.*invalid|invalid.*username or password|credentials.*invalid/i
      .test(bodyText);
  }

  private async startAccountRegistration(
    page: Page,
    credentials: AppointmentAccountCredentials,
  ): Promise<AppointmentPortalGate> {
    if (!await this.isRegistrationVisible(page)) {
      await this.clickFirstVisible(page, US_VISA_SCHEDULING_SELECTORS.signUpLinks);
      await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
      await page.waitForTimeout(1_000);
    }
    await this.fillFirstVisible(page, US_VISA_SCHEDULING_SELECTORS.registrationUsernameInputs, credentials.email);
    await this.fillFirstVisible(page, US_VISA_SCHEDULING_SELECTORS.registrationNewPasswordInputs, credentials.password);
    await this.fillFirstVisible(page, US_VISA_SCHEDULING_SELECTORS.registrationConfirmPasswordInputs, credentials.password);
    await this.fillFirstVisible(page, US_VISA_SCHEDULING_SELECTORS.registrationEmailInputs, credentials.email);
    await this.fillFirstVisible(
      page,
      US_VISA_SCHEDULING_SELECTORS.registrationGivenNameInputs,
      normalizeVisibleText(credentials.givenName) || "VIZA",
    );
    await this.fillFirstVisible(
      page,
      US_VISA_SCHEDULING_SELECTORS.registrationSurnameInputs,
      normalizeVisibleText(credentials.surname) || "APPLICANT",
    );
    await this.fillSecurityQuestions(page);
    await this.clickFirstVisible(page, US_VISA_SCHEDULING_SELECTORS.sendVerificationCodeButtons);
    await page.waitForTimeout(2_000);
    return buildAccountEmailVerificationGate(credentials.email);
  }

  private async isRegistrationVisible(page: Page): Promise<boolean> {
    const usernameVisible = await page.locator(US_VISA_SCHEDULING_SELECTORS.registrationUsernameInputs)
      .first()
      .isVisible()
      .catch(() => false);
    const newPasswordVisible = await page.locator(US_VISA_SCHEDULING_SELECTORS.registrationNewPasswordInputs)
      .first()
      .isVisible()
      .catch(() => false);
    return usernameVisible && newPasswordVisible;
  }

  private async fillSecurityQuestions(page: Page): Promise<void> {
    const selects = page.locator("select");
    const count = Math.min(await selects.count().catch(() => 0), 3);
    for (let index = 0; index < count; index += 1) {
      await selects.nth(index).selectOption({ index: 0 }).catch(() => undefined);
    }
    const answerInputs = page.locator("input[id*='Answer' i], input[name*='Answer' i], input[aria-label*='Answer' i]");
    const answerCount = Math.min(await answerInputs.count().catch(() => 0), 3);
    for (let index = 0; index < answerCount; index += 1) {
      await this.fillVisibleLocator(answerInputs.nth(index), "VIZA", 5_000).catch(() => undefined);
    }
  }

  private async readVisibleSlotCandidates(page: Page): Promise<VisibleSlotCandidate[]> {
    return page.locator(US_VISA_SCHEDULING_SELECTORS.slotCandidates).evaluateAll((nodes) =>
      nodes
        .map((node) => {
          const element = node as HTMLElement;
          const text = element.innerText || element.textContent || "";
          return {
            text,
            externalSlotId:
              element.getAttribute("data-slot-id")
              ?? element.getAttribute("data-appointment-slot")
              ?? element.getAttribute("id"),
          };
        })
        .filter((candidate) => candidate.text.trim().length > 0),
    );
  }

  private async detectGate(page: Page): Promise<AppointmentPortalGate | null> {
    const bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
    return classifyUSVisaSchedulingGateText(bodyText);
  }

  private async readTurnstileParams(page: Page): Promise<TurnstileParams> {
    return page.evaluate(() => {
      const w = window as typeof window & {
        __vizaTurnstileParams?: Record<string, unknown>;
      };
      const captured = w.__vizaTurnstileParams ?? {};
      const elementSitekey = document
        .querySelector("[data-sitekey]")
        ?.getAttribute("data-sitekey");
      const iframeSitekey = Array.from(document.querySelectorAll<HTMLIFrameElement>("iframe"))
        .map((iframe) => {
          try {
            const url = new URL(iframe.src);
            return url.searchParams.get("sitekey") ?? url.searchParams.get("k");
          } catch {
            return null;
          }
        })
        .find((value): value is string => Boolean(value));

      const stringValue = (value: unknown): string | null =>
        typeof value === "string" && value.trim() ? value : null;

      return {
        sitekey: stringValue(captured.sitekey) ?? elementSitekey ?? iframeSitekey ?? null,
        action: stringValue(captured.action),
        cData: stringValue(captured.cData),
        chlPageData: stringValue(captured.chlPageData),
        pageUrl: stringValue(captured.pageUrl) ?? window.location.href,
        userAgent: stringValue(captured.userAgent) ?? navigator.userAgent,
      };
    });
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
    await page.evaluate((captchaToken) => {
      const w = window as typeof window & {
        __vizaTurnstileCallback?: (token: string) => void;
      };
      const fields = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
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
    }, token);
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
    const [currentUrl, title, bodyText, loginVisible, scheduleControlVisible, slotCandidateCount] =
      await Promise.all([
        Promise.resolve(page.url()),
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

  private async clickSelectedSlot(page: Page, selectedSlot: AppointmentSlotRow): Promise<void> {
    const candidates = page.locator(US_VISA_SCHEDULING_SELECTORS.slotCandidates);
    const count = await candidates.count();
    for (let index = 0; index < count; index += 1) {
      const candidate = candidates.nth(index);
      const text = await candidate.innerText().catch(() => "");
      if (
        containsAllVisibleParts(text, [
          selectedSlot.appointment_date,
          selectedSlot.appointment_time,
          selectedSlot.appointment_location,
        ])
      ) {
        await candidate.click();
        return;
      }
    }
    throw new Error("Selected USVisaScheduling slot was not visible on the official calendar.");
  }

  private async clickFirstVisible(page: Page, selector: string): Promise<void> {
    const locator = page.locator(selector).first();
    await locator.waitFor({ state: "visible", timeout: 15_000 });
    await locator.click();
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
        const filled =
          await this.assignInputValue(candidate, value)
          || await this.assignLocatorCollectionValue(locator, value)
          || await this.assignFirstInputForSelector(page, selector, value);
        if (filled) return;
      }
    }
    const first = locator.first();
    await first.waitFor({ state: "attached", timeout: 15_000 });
    const filled =
      await this.assignInputValue(first, value)
      || await this.assignLocatorCollectionValue(locator, value)
      || await this.assignFirstInputForSelector(page, selector, value)
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
        let element: Element | null = null;
        try {
          element = document.querySelector(part);
        } catch {
          continue;
        }
        if (!element) continue;
        const tagName = element.tagName.toLowerCase();
        if (!["input", "textarea"].includes(tagName)) continue;
        const field = element as HTMLInputElement | HTMLTextAreaElement;
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
        let element: Element | null = null;
        try {
          element = document.querySelector(part);
        } catch {
          continue;
        }
        if (!element) continue;
        const tagName = element.tagName.toLowerCase();
        if (!["input", "textarea"].includes(tagName)) continue;
        return (element as HTMLInputElement | HTMLTextAreaElement).value === expectedValue;
      }
      return false;
    })()`).then(Boolean).catch(() => false);
  }

  private async readInputAssignmentDiagnostics(
    page: Page,
    selector: string,
  ): Promise<unknown | null> {
    return page.evaluate((selectorText) => {
      const parts = selectorText
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      const details = [];
      for (const part of parts) {
        let elements: Element[] = [];
        try {
          elements = Array.from(document.querySelectorAll(part));
        } catch (error) {
          details.push({
            selector: part,
            selectorError: error instanceof Error ? error.message : String(error),
          });
          continue;
        }
        for (const element of elements.slice(0, 3)) {
          const style = window.getComputedStyle(element);
          const input = element as HTMLInputElement | HTMLTextAreaElement;
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
            offsetWidth: (element as HTMLElement).offsetWidth,
            offsetHeight: (element as HTMLElement).offsetHeight,
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
    }, selector).catch(() => null);
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
        let element: Element | null = null;
        try {
          element = document.querySelector(candidate);
        } catch {
          continue;
        }
        if (!element) continue;
        const tagName = element.tagName.toLowerCase();
        if (!["input", "textarea"].includes(tagName)) continue;
        const field = element as HTMLInputElement | HTMLTextAreaElement;
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
    return locator.evaluateAll((elements, inputValue) => {
      for (const element of elements) {
        const tagName = element.tagName.toLowerCase();
        if (!["input", "textarea"].includes(tagName)) continue;
        const field = element as HTMLInputElement | HTMLTextAreaElement;
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
    }, value).catch(() => false);
  }

  private async assignInputValue(locator: Locator, value: string): Promise<boolean> {
    return locator.evaluate((element, inputValue) => {
      const tagName = element.tagName.toLowerCase();
      if (!["input", "textarea"].includes(tagName)) {
        return false;
      }
      const field = element as HTMLInputElement | HTMLTextAreaElement;
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
    }, value).catch(() => false);
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

  private extractConfirmationNumber(text: string): string | null {
    const match = text.match(/\b[A-Z0-9][A-Z0-9-]{5,}\b/);
    return match?.[0] ?? null;
  }
}

export async function createPlaywrightUSVisaSchedulingPortalClient(
  config: USAppointmentRunnerConfig,
): Promise<USAppointmentPortalClient> {
  return new PlaywrightUSVisaSchedulingPortalClient(config);
}
