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

function cleanupExpired(referenceTime = nowMs()) {
  for (const [jobId, session] of sessions.entries()) {
    if (session.expiresAt <= referenceTime) {
      sessions.delete(jobId);
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
  const timeCards = page.locator("a").filter({ hasText: /\d{2}:\d{2}\s*\S*/ });
  if ((await timeCards.count()) === 0) {
    throw new Error("No Beijing KVAC appointment time card was found after choosing a date.");
  }
  await timeCards.first().click({ timeout: 10_000 });
  await page.waitForTimeout(1_000);

  const detailedTimes = page.locator("a, button").filter({ hasText: /\d{2}:\d{2}\s*~\s*\d{2}:\d{2}/ });
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

export async function clearKoreaKvacOfficialSession(jobId: string): Promise<void> {
  await cleanupSession(jobId);
}
