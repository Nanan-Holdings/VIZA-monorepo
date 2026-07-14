import { chromium, type Browser, type Page } from "@playwright/test";

export interface KoreaKvacStartSmsInput {
  applicationId: string;
  jobId: string;
  centerCode: string;
  bookingUrl: string;
  applicantName: string;
  mobilePhone: string;
}

export interface KoreaKvacStartSmsResult {
  status: "sms_verification_required";
  officialSessionId: string;
  centerCode: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentEndTime: string;
  appointmentLocation: string;
  phoneMasked: string;
  expiresAtIso: string;
  screenshotPath: string | null;
  officialMessage: string;
}

export interface KoreaKvacSubmitSmsResult {
  status: "appointment_slots_observed";
  officialSessionId: string;
  slots: Array<{
    id: string;
    appointment_date: string;
    appointment_time: string;
    appointment_location: string;
    appointment_type: string;
    source: string;
    status: string;
    metadata_redacted_json: Record<string, unknown>;
  }>;
  screenshotPath: string | null;
}

export interface KoreaKvacCompleteBookingResult {
  status: "appointment_booked";
  officialSessionId: string;
  confirmationNumber: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentLocation: string;
  appointmentType: string;
  screenshotPath: string | null;
  confirmationPdfUrl: string | null;
}

export interface KoreaKvacCancelQueryInput {
  applicationId: string;
  jobId: string;
  centerCode: string;
  bookingSearchUrl: string;
  applicantName: string;
  mobilePhone: string;
}

export interface KoreaKvacCancelQueryResult {
  status: "cancellation_confirmation_required" | "cancellation_manual_checkpoint";
  officialSessionId: string;
  centerCode: string;
  phoneMasked: string;
  screenshotPath: string | null;
  officialMessage: string;
  canCancel: boolean;
}

export interface KoreaKvacCancelConfirmResult {
  status: "appointment_cancelled";
  officialSessionId: string;
  screenshotPath: string | null;
  officialMessage: string;
}

interface KoreaKvacLiveSession {
  applicationId: string;
  jobId: string;
  centerCode: string;
  browser: Browser;
  page: Page;
  appointmentDate: string;
  appointmentTime: string;
  appointmentEndTime: string;
  appointmentLocation: string;
  expiresAt: number;
  screenshotPath: string | null;
}

const SESSION_TTL_MS = 5 * 60 * 1000;
const sessions = new Map<string, KoreaKvacLiveSession>();
const cancelSessions = new Map<string, { browser: Browser; page: Page; expiresAt: number; screenshotPath: string | null }>();
const VISAFORKOREA_CENTER_CONFIG: Record<string, { hostPattern: RegExp; location: string; label: string }> = {
  beijing: {
    hostPattern: /visaforkorea-bj\.com/i,
    location: "Korea Visa Application Center Beijing",
    label: "Beijing KVAC",
  },
  shanghai: {
    hostPattern: /visaforkorea-sh\.com/i,
    location: "Korea Visa Application Center Shanghai",
    label: "Shanghai KVAC",
  },
  guangzhou: {
    hostPattern: /visaforkorea-gz\.com/i,
    location: "Korea Visa Application Center Guangzhou",
    label: "Guangzhou KVAC",
  },
  xian: {
    hostPattern: /visaforkorea-xa\.com/i,
    location: "Korea Visa Application Center Xi'an",
    label: "Xi'an KVAC",
  },
};

function nowMs() {
  return Date.now();
}

function normalizePhoneForKvac(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("86") && digits.length === 13) return digits.slice(2);
  return digits;
}

function maskPhone(phone: string) {
  const digits = normalizePhoneForKvac(phone);
  return digits.replace(/(\d{3})\d+(\d{4})/, "$1****$2");
}

function getVisaforkoreaConfig(input: KoreaKvacStartSmsInput) {
  const config = VISAFORKOREA_CENTER_CONFIG[input.centerCode];
  if (!config) {
    throw new Error(
      `Korea KVAC official SMS sync is not enabled for ${input.centerCode}. ` +
      "This center is covered as guidance/reachability only and must stop at a manual checkpoint.",
    );
  }
  if (!config.hostPattern.test(input.bookingUrl)) {
    throw new Error(`${config.label} booking URL is required for official SMS sync.`);
  }
  return config;
}

async function cleanupSession(jobId: string) {
  const existing = sessions.get(jobId);
  if (!existing) return;
  sessions.delete(jobId);
  await existing.browser.close().catch(() => undefined);
}

async function cleanupCancelSession(jobId: string) {
  const existing = cancelSessions.get(jobId);
  if (!existing) return;
  cancelSessions.delete(jobId);
  await existing.browser.close().catch(() => undefined);
}

function cleanupExpired(referenceTime = nowMs()) {
  for (const [jobId, session] of sessions.entries()) {
    if (session.expiresAt <= referenceTime) {
      sessions.delete(jobId);
      void session.browser.close().catch(() => undefined);
    }
  }
  for (const [jobId, session] of cancelSessions.entries()) {
    if (session.expiresAt <= referenceTime) {
      cancelSessions.delete(jobId);
      void session.browser.close().catch(() => undefined);
    }
  }
}

async function clickFirstAvailableDate(page: Page) {
  for (let monthOffset = 0; monthOffset < 3; monthOffset += 1) {
    const availableDates = page.locator(".ui-datepicker-calendar td a");
    const count = await availableDates.count();
    if (count > 0) {
      await availableDates.first().click({ timeout: 10_000 });
      await page.waitForTimeout(1_500);
      return;
    }
    if (monthOffset < 2) {
      await page.locator(".ui-datepicker-next").click({ timeout: 10_000 });
      await page.waitForTimeout(1_000);
    }
  }
  throw new Error("No selectable Beijing KVAC appointment date was found in the visible calendar window.");
}

async function clickFirstAvailableTime(page: Page) {
  const timeCards = page.locator(".time-table__item:not(.-done) a, .time-table__item:not(.-done) button");
  if ((await timeCards.count()) === 0) {
    throw new Error("No available Beijing KVAC appointment hour was found after choosing a date.");
  }
  await timeCards.first().click({ timeout: 10_000 });
  await page.waitForTimeout(1_000);

  const detailedTimes = page.locator(".time-table__ly-link:not(.-done), .time-table__ly-item:not(.-done) a, .time-table__ly-item:not(.-done) button");
  const detailedCount = await detailedTimes.count();
  if (detailedCount > 0) {
    await detailedTimes.nth(detailedCount - 1).click({ timeout: 10_000 });
    await page.waitForTimeout(1_500);
  }
}

async function readSelectedTime(page: Page) {
  return page.evaluate(() => ({
    day: (document.querySelector<HTMLInputElement>("#visit_sche_day")?.value ?? "").trim(),
    time: (document.querySelector<HTMLInputElement>("#visit_sche_time")?.value ?? "").trim(),
    nextTime: (document.querySelector<HTMLInputElement>("#visit_sche_next_time")?.value ?? "").trim(),
  }));
}

async function selectByVisibleText(page: Page, selector: string, textPattern: RegExp) {
  const value = await page.locator(selector).evaluate((select, patternSource) => {
    const element = select as HTMLSelectElement;
    const pattern = new RegExp(patternSource, "i");
    const option = Array.from(element.options).find((item) => pattern.test(item.textContent ?? ""));
    return option?.value ?? null;
  }, textPattern.source);
  if (value) await page.selectOption(selector, value);
}

async function screenshot(page: Page, jobId: string, label: string) {
  const path = `output/playwright/korea-kvac-${jobId}-${label}.png`;
  await page.screenshot({ path, fullPage: true }).catch(() => undefined);
  return path;
}

async function clickFinalBookingButton(page: Page) {
  const hasOfficialSubmit = await page.evaluate(() => typeof (window as unknown as { jsSave?: unknown }).jsSave === "function").catch(() => false);
  if (hasOfficialSubmit) {
    await page.evaluate(() => {
      (window as unknown as { jsSave: () => void }).jsSave();
    });
    await page.waitForTimeout(5_000);
    return;
  }

  const candidates = [
    page.locator("#btn_reserve").first(),
    page.locator("#btn_submit").first(),
    page.locator("button, a, input[type='button'], input[type='submit']").filter({
      hasText: /预约|申请|提交|确认预约|예약|신청|Reserve|Book|Submit/i,
    }).last(),
  ];

  for (const candidate of candidates) {
    if ((await candidate.count().catch(() => 0)) === 0) continue;
    const visible = await candidate.isVisible().catch(() => false);
    const enabled = await candidate.isEnabled().catch(() => true);
    if (!visible || !enabled) continue;
    await candidate.click({ timeout: 30_000 });
    await page.waitForTimeout(5_000);
    return;
  }
  throw new Error("Official KVAC final booking button was not found after user approval.");
}

async function extractConfirmationNumber(page: Page) {
  const text = await page.locator("body").innerText({ timeout: 15_000 }).catch(() => "");
  const patterns = [
    /(?:预先预约受理编号|预约受理编号|受理编号)\s*([A-Z0-9-]{5,})/i,
    /(?:예약\s*번호|预约(?:确认)?(?:号|编号)|confirmation\s*(?:number|no\.?)|reference\s*(?:number|no\.?))\s*[:：]?\s*([A-Z0-9-]{5,})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

async function findOfficialActionControl(page: Page, action: "cancel" | "reschedule") {
  const selector = `[data-viza-kvac-action-target="${action}"]`;
  const tagged = await page.evaluate((targetAction) => {
    const attr = "data-viza-kvac-action-target";
    document.querySelectorAll(`[${attr}]`).forEach((element) => element.removeAttribute(attr));

    const positivePatterns =
      targetAction === "cancel"
        ? [
            /取消预约|预约取消|取消申请|撤销预约|取消/i,
            /cancel(?:lation)?|delete|remove/i,
            /예약\s*취소|예약취소|취소/i,
          ]
        : [
            /改约|变更预约|预约变更|修改预约|重新预约/i,
            /reschedule|change|modify/i,
            /예약\s*변경|예약변경|변경|수정/i,
          ];
    const intentPattern =
      targetAction === "cancel"
        ? /cancel|cancle|delete|remove|del|cncl|예약취소|취소|取消|撤销/i
        : /reschedule|change|modify|update|예약변경|변경|수정|改约|变更|修改/i;
    const bookingContextPattern = /book|booking|reserve|reservation|rsrv|visit|appoint|appointment|예약|预.?约|受理/i;
    const negativePattern = /关闭|返回|上一步|닫기|이전|back|close|reset|clear|home|print|download|search|query|조회|查询|打印|下载/i;

    const candidates = Array.from(
      document.querySelectorAll(
        [
          "button",
          "a",
          "input[type='button']",
          "input[type='submit']",
          "input[type='image']",
          "[role='button']",
          "[onclick]",
          "img[onclick]",
        ].join(","),
      ),
    );

    const isVisible = (element: Element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };

    const textFor = (element: Element) => {
      const parts: string[] = [];
      const htmlElement = element as HTMLElement;
      parts.push(htmlElement.innerText ?? "", element.textContent ?? "");
      if (element instanceof HTMLInputElement) {
        parts.push(element.value, element.name, element.id, element.type, element.src);
      }
      if (element instanceof HTMLAnchorElement) parts.push(element.href);
      if (element instanceof HTMLImageElement) parts.push(element.alt, element.src);
      parts.push(
        element.getAttribute("title") ?? "",
        element.getAttribute("aria-label") ?? "",
        element.getAttribute("alt") ?? "",
        element.getAttribute("onclick") ?? "",
        element.getAttribute("href") ?? "",
        element.id,
        element.className.toString(),
      );
      element.querySelectorAll("img,[alt],[title],[aria-label]").forEach((child) => {
        parts.push(
          child.textContent ?? "",
          child.getAttribute("alt") ?? "",
          child.getAttribute("title") ?? "",
          child.getAttribute("aria-label") ?? "",
          child.getAttribute("src") ?? "",
        );
      });
      return parts.filter(Boolean).join(" ");
    };

    let best: HTMLElement | null = null;
    let bestScore = 0;
    for (const element of candidates) {
      if (!(element instanceof HTMLElement) || !isVisible(element)) continue;
      const text = textFor(element).replace(/\s+/g, " ").trim();
      if (!text) continue;

      let score = 0;
      if (positivePatterns.some((pattern) => pattern.test(text))) score += 8;
      if (intentPattern.test(text)) score += 5;
      if (bookingContextPattern.test(text)) score += 3;
      if (/(onclick|href|id|name|class)/i.test(text) && intentPattern.test(text)) score += 2;
      if (negativePattern.test(text)) score -= 5;
      if (element instanceof HTMLInputElement && /reset|hidden/i.test(element.type)) score -= 8;
      if (element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true") score -= 10;

      if (score > bestScore) {
        best = element;
        bestScore = score;
      }
    }

    if (!best || bestScore < 6) return false;
    best.setAttribute(attr, targetAction);
    return true;
  }, action);

  if (!tagged) return null;
  const candidate = page.locator(selector).first();
  const visible = await candidate.isVisible().catch(() => false);
  const enabled = await candidate.isEnabled().catch(() => true);
  return visible && enabled ? candidate : null;
}

async function findOfficialCancelButton(page: Page) {
  return findOfficialActionControl(page, "cancel");
}

async function findOfficialCancellationConfirmationButton(page: Page) {
  const selector = "[data-viza-kvac-cancel-confirmation]";
  const bodyText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
  const cancellationPrompt = /要取消预约吗|确认取消|取消预约|预约取消|예약\s*취소|cancel(?:lation)?\s*(?:appointment|booking|reservation)?/i;
  if (!cancellationPrompt.test(bodyText)) return null;

  // The Beijing KVAC modal does not expose ARIA dialog semantics consistently.
  // With its cancellation prompt visible, an exact visible confirmation control
  // is scoped safely enough to act as the modal's final confirmation button.
  const controls = page.locator(
    "button, input[type='button'], input[type='submit'], [role='button'], a, [onclick], [class*='btn'], [class*='button']",
  );
  const controlCount = await controls.count();
  for (let index = 0; index < controlCount; index += 1) {
    const control = controls.nth(index);
    const visible = await control.isVisible().catch(() => false);
    if (!visible) continue;
    const label = await control.evaluate((element) => {
      const inputValue = element instanceof HTMLInputElement ? element.value : "";
      return [
        (element as HTMLElement).innerText ?? "",
        element.textContent ?? "",
        inputValue,
        element.getAttribute("aria-label") ?? "",
        element.getAttribute("title") ?? "",
      ]
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    });
    if (/^(?:确认|确定|确认取消|取消确认|confirm|yes|확인)(?:\s+(?:确认|确定|确认取消|取消确认|confirm|yes|확인))*$/i.test(label)) return control;
  }

  const tagged = await page.evaluate(() => {
    const attr = "data-viza-kvac-cancel-confirmation";
    document.querySelectorAll(`[${attr}]`).forEach((element) => element.removeAttribute(attr));

    const isVisible = (element: Element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const textFor = (element: Element) => {
      const inputValue = element instanceof HTMLInputElement ? element.value : "";
      return [
        (element as HTMLElement).innerText ?? "",
        element.textContent ?? "",
        inputValue,
        element.getAttribute("aria-label") ?? "",
        element.getAttribute("title") ?? "",
      ]
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    };
    const confirmationLabel = /^(?:确认|确定|确认取消|取消确认|confirm|yes|확인)(?:\s+(?:确认|确定|确认取消|取消确认|confirm|yes|확인))*$/i;
    const controls = Array.from(
      document.querySelectorAll("button, input[type='button'], input[type='submit'], [role='button'], a"),
    );

    for (const control of controls) {
      if (!(control instanceof HTMLElement) || !isVisible(control)) continue;
      if (!confirmationLabel.test(textFor(control))) continue;

      let container: Element | null = control;
      for (let depth = 0; container && depth < 8; depth += 1, container = container.parentElement) {
        if (!isVisible(container) || !cancellationPrompt.test(textFor(container))) continue;
        control.setAttribute(attr, "true");
        return true;
      }
    }
    return false;
  });

  if (!tagged) return null;
  const candidate = page.locator(selector).first();
  const visible = await candidate.isVisible().catch(() => false);
  const enabled = await candidate.isEnabled().catch(() => true);
  return visible && enabled ? candidate : null;
}

function hasOfficialCancellationSuccessEvidence(text: string) {
  return /取消成功|已取消|成功取消|预约已取消|예약\s*(?:이\s*)?취소(?:\s*완료|되었습니다)?|(?:appointment|booking|reservation)\s*(?:has\s*been\s*)?cancelled|cancellation\s*(?:completed|successful)/i.test(
    text,
  );
}

export async function startKoreaKvacOfficialSmsSession(input: KoreaKvacStartSmsInput): Promise<KoreaKvacStartSmsResult> {
  console.log(`[korea-kvac] start official SMS session job=${input.jobId} center=${input.centerCode}`);
  cleanupExpired();
  const centerConfig = getVisaforkoreaConfig(input);
  await cleanupSession(input.jobId);

  const phone = normalizePhoneForKvac(input.mobilePhone);
  if (!/^1\d{10}$/.test(phone)) {
    throw new Error(`${centerConfig.label} requires a mainland China 11-digit mobile number without +86 or hyphens.`);
  }
  const applicantName = input.applicantName.trim();
  if (!applicantName) throw new Error("Applicant name is required before starting Beijing KVAC SMS verification.");

  const browser = await chromium.launch({ headless: !/^(1|true|yes|on)$/i.test(process.env.KR_KVAC_HEADFUL ?? "") });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.accept().catch(() => undefined);
  });

  try {
    await page.goto(input.bookingUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
    console.log(`[korea-kvac] official page loaded job=${input.jobId}`);
    await page.waitForTimeout(3_000);
    await clickFirstAvailableDate(page);
    await clickFirstAvailableTime(page);
    const selected = await readSelectedTime(page);
    if (!selected.day || !selected.time) {
      throw new Error(`${centerConfig.label} date/time was not selected on the official page.`);
    }

    console.log(`[korea-kvac] selected ${selected.day} ${selected.time}-${selected.nextTime} job=${input.jobId}`);
    await selectByVisibleText(page, "#nationality_cd", /CHINA P\.?\s*R/i).catch(() => undefined);
    await page.selectOption("#purpose_cd", { index: 1 }).catch(() => undefined);
    await page.selectOption("#stay_duration_cd", { index: 1 }).catch(() => undefined);
    await page.locator("#general_rsrv_cnt").fill("1");
    await page.locator("#express_rsrv_cnt").fill("0");
    await page.locator("#visa_relationship_cd_1").check({ force: true });
    await page.locator("#booker_nm").fill(applicantName);
    await page.locator("#booker_phone").fill(phone);
    await page.locator("#btn_certify_send").click({ timeout: 30_000 });
    await page.waitForTimeout(6_000);
    console.log(`[korea-kvac] clicked official SMS send job=${input.jobId} dialogs=${dialogs.join(" | ") || "none"}`);

    const smsInputVisible = await page.locator("#certify_no").isVisible().catch(() => false);
    if (!smsInputVisible) {
      throw new Error(`Official KVAC SMS input did not appear. Messages: ${dialogs.join(" | ") || "none"}`);
    }

    const expiresAt = nowMs() + SESSION_TTL_MS;
    const screenshotPath = await screenshot(page, input.jobId, "sms-required");
    sessions.set(input.jobId, {
      applicationId: input.applicationId,
      jobId: input.jobId,
      centerCode: input.centerCode,
      browser,
      page,
      appointmentDate: selected.day,
      appointmentTime: selected.time,
      appointmentEndTime: selected.nextTime,
      appointmentLocation: centerConfig.location,
      expiresAt,
      screenshotPath,
    });

    return {
      status: "sms_verification_required",
      officialSessionId: input.jobId,
      centerCode: input.centerCode,
      appointmentDate: selected.day,
      appointmentTime: selected.time,
      appointmentEndTime: selected.nextTime,
      appointmentLocation: centerConfig.location,
      phoneMasked: maskPhone(phone),
      expiresAtIso: new Date(expiresAt).toISOString(),
      screenshotPath,
      officialMessage: dialogs.at(-1) ?? "SMS verification was requested on the official KVAC page.",
    };
  } catch (error) {
    await browser.close().catch(() => undefined);
    throw error;
  }
}

export async function submitKoreaKvacOfficialSmsCode(input: {
  jobId: string;
  smsCode: string;
}): Promise<KoreaKvacSubmitSmsResult> {
  cleanupExpired();
  const session = sessions.get(input.jobId);
  if (!session) throw new Error("Official KVAC browser session is missing or expired. Restart SMS verification.");
  if (!/^\d{4,8}$/.test(input.smsCode)) throw new Error("SMS code must be 4 to 8 digits.");

  await session.page.locator("#certify_no").fill(input.smsCode);
  const confirmButton = session.page.locator("button").filter({ hasText: /确认|Confirm/i }).first();
  await confirmButton.click({ timeout: 30_000 });
  await session.page.waitForTimeout(4_000);

  const screenshotPath = await screenshot(session.page, input.jobId, "sms-submitted");
  const slotId = `official-${session.centerCode}-${session.appointmentDate}-${session.appointmentTime}`.replace(/[^a-z0-9-]/gi, "-");
  session.screenshotPath = screenshotPath;
  return {
    status: "appointment_slots_observed",
    officialSessionId: input.jobId,
    slots: [
      {
        id: slotId,
        appointment_date: session.appointmentDate,
        appointment_time: session.appointmentTime,
        appointment_location: session.appointmentLocation,
        appointment_type: "C-3-9 document intake",
        source: "official_kvac_after_sms",
        status: "observed",
        metadata_redacted_json: {
          centerCode: session.centerCode,
          source: "official_kvac",
          appointmentEndTime: session.appointmentEndTime,
          officialSessionId: input.jobId,
          screenshotPath,
        },
      },
    ],
    screenshotPath,
  };
}

export async function completeKoreaKvacOfficialBooking(input: {
  jobId: string;
  selectedSlot?: {
    appointment_date?: string | null;
    appointment_time?: string | null;
    appointment_location?: string | null;
    appointment_type?: string | null;
    departure_date?: string | null;
  } | null;
}): Promise<KoreaKvacCompleteBookingResult> {
  cleanupExpired();
  const session = sessions.get(input.jobId);
  if (!session) {
    throw new Error("Official KVAC browser session is missing or expired. Restart SMS verification before final booking.");
  }

  const existingConfirmationNumber = await extractConfirmationNumber(session.page);
  if (existingConfirmationNumber) {
    const screenshotPath = await screenshot(session.page, input.jobId, "confirmation");
    await cleanupSession(input.jobId);
    return {
      status: "appointment_booked",
      officialSessionId: input.jobId,
      confirmationNumber: existingConfirmationNumber,
      appointmentDate: input.selectedSlot?.appointment_date ?? session.appointmentDate,
      appointmentTime: input.selectedSlot?.appointment_time ?? session.appointmentTime,
      appointmentLocation: input.selectedSlot?.appointment_location ?? session.appointmentLocation,
      appointmentType: input.selectedSlot?.appointment_type ?? "C-3-9 document intake",
      screenshotPath,
      confirmationPdfUrl: null,
    };
  }

  const departureDate = input.selectedSlot?.departure_date?.trim();
  if (departureDate) {
    await session.page.locator("#departure_day").evaluate((element, value) => {
      const input = element as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, departureDate);
  }
  await session.page.locator("#termsCheck").check({ force: true }).catch(() => undefined);
  await session.page.locator("#personal_info_agree_yn").check({ force: true }).catch(() => undefined);
  await clickFinalBookingButton(session.page);
  const confirmationNumber = await extractConfirmationNumber(session.page);
  const screenshotPath = await screenshot(session.page, input.jobId, "confirmation");
  if (!confirmationNumber) {
    throw new Error("Official KVAC final click completed, but no confirmation number was found. Preserve the screenshot and verify the official page before reporting success.");
  }

  await cleanupSession(input.jobId);
  return {
    status: "appointment_booked",
    officialSessionId: input.jobId,
    confirmationNumber,
    appointmentDate: input.selectedSlot?.appointment_date ?? session.appointmentDate,
    appointmentTime: input.selectedSlot?.appointment_time ?? session.appointmentTime,
    appointmentLocation: input.selectedSlot?.appointment_location ?? session.appointmentLocation,
    appointmentType: input.selectedSlot?.appointment_type ?? "C-3-9 document intake",
    screenshotPath,
    confirmationPdfUrl: null,
  };
}

export async function startKoreaKvacOfficialCancelQuery(input: KoreaKvacCancelQueryInput): Promise<KoreaKvacCancelQueryResult> {
  cleanupExpired();
  await cleanupCancelSession(input.jobId);

  const phone = normalizePhoneForKvac(input.mobilePhone);
  if (!/^1\d{10}$/.test(phone)) {
    throw new Error("Korea KVAC cancellation query requires a mainland China 11-digit mobile number without +86 or hyphens.");
  }
  const applicantName = input.applicantName.trim();
  if (!applicantName) throw new Error("Applicant name is required before querying the official KVAC appointment.");
  if (!/\/visacenter\/booking\/search/i.test(input.bookingSearchUrl)) {
    throw new Error("This Korea center does not expose a supported visaforkorea appointment query page.");
  }

  const browser = await chromium.launch({ headless: !/^(1|true|yes|on)$/i.test(process.env.KR_KVAC_HEADFUL ?? "") });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.accept().catch(() => undefined);
  });

  try {
    await page.goto(input.bookingSearchUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2_000);
    await page.locator("#booker_nm").fill(applicantName, { timeout: 20_000 });
    await page.locator("#booker_phone").fill(phone, { timeout: 20_000 });
    await page.locator("button[type='submit'], input[type='submit']").first().click({ timeout: 20_000 });
    await page.waitForTimeout(5_000);

    const cancelButton = await findOfficialCancelButton(page);
    const bodyText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
    const screenshotPath = await screenshot(page, input.jobId, cancelButton ? "cancel-confirmation-required" : "cancel-query");
    if (!cancelButton) {
      await browser.close().catch(() => undefined);
      return {
        status: "cancellation_manual_checkpoint",
        officialSessionId: input.jobId,
        centerCode: input.centerCode,
        phoneMasked: maskPhone(phone),
        screenshotPath,
        officialMessage:
          dialogs.at(-1) ??
          (bodyText ? bodyText.replace(/\s+/g, " ").slice(0, 280) : "Official query completed, but no cancellation button was detected."),
        canCancel: false,
      };
    }

    cancelSessions.set(input.jobId, {
      browser,
      page,
      expiresAt: nowMs() + SESSION_TTL_MS,
      screenshotPath,
    });
    return {
      status: "cancellation_confirmation_required",
      officialSessionId: input.jobId,
      centerCode: input.centerCode,
      phoneMasked: maskPhone(phone),
      screenshotPath,
      officialMessage: dialogs.at(-1) ?? "Official appointment record was found. User confirmation is required before cancelling.",
      canCancel: true,
    };
  } catch (error) {
    await browser.close().catch(() => undefined);
    throw error;
  }
}

export async function confirmKoreaKvacOfficialCancellation(input: { jobId: string }): Promise<KoreaKvacCancelConfirmResult> {
  cleanupExpired();
  const session = cancelSessions.get(input.jobId);
  if (!session) throw new Error("Official KVAC cancellation session is missing or expired. Start cancellation query again.");

  const dialogs: string[] = [];
  session.page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.accept().catch(() => undefined);
  });
  const cancelButton = await findOfficialCancelButton(session.page);
  if (!cancelButton) throw new Error("Official cancellation button is no longer visible. Start cancellation query again.");
  await cancelButton.click({ timeout: 30_000 });
  await session.page.waitForTimeout(500);

  const confirmationButton = await findOfficialCancellationConfirmationButton(session.page);
  if (!confirmationButton) {
    const screenshotPath = await screenshot(session.page, input.jobId, "cancel-confirmation-missing");
    await cleanupCancelSession(input.jobId);
    throw new Error(
      `Official KVAC cancellation confirmation dialog was not detected (${screenshotPath ?? "no screenshot"}). The appointment was not marked as cancelled.`,
    );
  }

  await confirmationButton.click({ timeout: 30_000 });

  let bodyText = "";
  let cancellationButtonStillVisible = true;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await session.page.waitForTimeout(1_000);
    bodyText = await session.page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
    cancellationButtonStillVisible = Boolean(await findOfficialCancelButton(session.page));
    if (!cancellationButtonStillVisible && (hasOfficialCancellationSuccessEvidence(bodyText) || dialogs.some(hasOfficialCancellationSuccessEvidence))) {
      break;
    }
  }

  const succeeded =
    !cancellationButtonStillVisible &&
    (hasOfficialCancellationSuccessEvidence(bodyText) || dialogs.some(hasOfficialCancellationSuccessEvidence));
  const screenshotPath = await screenshot(session.page, input.jobId, succeeded ? "cancelled" : "cancel-unverified");
  await cleanupCancelSession(input.jobId);

  if (!succeeded) {
    throw new Error(
      "Official KVAC cancellation could not be verified from the official result page. The appointment was not marked as cancelled.",
    );
  }

  return {
    status: "appointment_cancelled",
    officialSessionId: input.jobId,
    screenshotPath,
    officialMessage:
      [...dialogs].reverse().find(hasOfficialCancellationSuccessEvidence) ??
      (bodyText ? bodyText.replace(/\s+/g, " ").slice(0, 280) : "Official cancellation completed."),
  };
}

export async function clearKoreaKvacOfficialSession(jobId: string): Promise<void> {
  await cleanupSession(jobId);
  await cleanupCancelSession(jobId);
}
