import { chromium, type Browser, type Page } from "@playwright/test";
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
    "input[type='email'], input[name*='email' i], input[id*='email' i], input[name*='user' i], input[id*='user' i]",
  passwordInputs:
    "input[type='password'], input[name*='password' i], input[id*='password' i]",
  loginButtons:
    "button:has-text('Sign In'), button:has-text('Login'), button:has-text('Log in'), button:has-text('Continue'), input[type='submit'], text=/登录|登入|继续/",
  slotCandidates:
    "[data-viza-appointment-slot], [data-slot-id], [data-appointment-slot], table tbody tr, .appointment-slot, .slot",
  confirmButtons:
    "button:has-text('Confirm'), button:has-text('Schedule'), button:has-text('Book'), button:has-text('Submit'), input[type='submit'], text=/确认|预约|提交/",
  confirmationText:
    "[data-confirmation-number], .confirmation-number, text=/Confirmation|确认|预约成功|Appointment/i",
  statusText:
    "[data-appointment-status], .appointment-status, text=/Appointment|Scheduled|Cancelled|确认|已预约|取消/i",
} as const;

interface VisibleSlotCandidate {
  text: string;
  externalSlotId: string | null;
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
  private page: Page | null = null;

  constructor(private readonly config: USAppointmentRunnerConfig) {}

  async prepareAppointmentFlow(
    _job: USAppointmentJobRow,
    credentials: AppointmentAccountCredentials | null,
  ): Promise<{ readyForSlotCapture: boolean; gate?: AppointmentPortalGate }> {
    const page = await this.getPage();
    await this.openPortal(page);
    const initialGate = await this.detectGate(page);
    if (initialGate) {
      return { readyForSlotCapture: false, gate: initialGate };
    }

    if (credentials && await this.isLoginVisible(page)) {
      await this.login(page, credentials);
      await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
      const loginGate = await this.detectGate(page);
      if (loginGate) {
        return { readyForSlotCapture: false, gate: loginGate };
      }
    }

    const slots = await this.readVisibleSlotCandidates(page);
    if (slots.length > 0) return { readyForSlotCapture: true };

    const calendarLink = page
      .locator("a:has-text('Appointment'), a:has-text('Schedule'), button:has-text('Schedule'), text=/预约|日历/")
      .first();
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

    return { readyForSlotCapture: false };
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
    await this.browser?.close();
    this.browser = null;
    this.page = null;
  }

  private async getPage(): Promise<Page> {
    if (this.page) return this.page;
    this.browser = await chromium.launch({ headless: this.config.playwrightHeadless });
    this.page = await this.browser.newPage();
    return this.page;
  }

  private async openPortal(page: Page): Promise<void> {
    await page.goto(this.config.baseUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
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
    await page.locator(US_VISA_SCHEDULING_SELECTORS.emailInputs)
      .first()
      .fill(credentials.email, { timeout: 15_000 });
    await page.locator(US_VISA_SCHEDULING_SELECTORS.passwordInputs)
      .first()
      .fill(credentials.password, { timeout: 15_000 });
    await this.clickFirstVisible(page, US_VISA_SCHEDULING_SELECTORS.loginButtons);
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
