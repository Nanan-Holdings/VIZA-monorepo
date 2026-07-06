import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { Page } from "@playwright/test";
import {
  createArrivalCardBrowserSession,
  type ArrivalCardBrowserSession,
} from "../arrival-card-browser";
import {
  VN_PREARRIVAL_OFFICIAL_PORTAL_URL,
  type VnPrearrivalPortalPayload,
} from "./normalize";
import { solveVietnamImageCaptcha } from "../vietnam/captcha";

export interface VnPrearrivalPortalSubmissionResult {
  submitted: boolean;
  confirmationNumber?: string | null;
  referenceNumber?: string | null;
  portalUrl: string;
  portalResponseSummary: string;
  screenshots: string[];
  pdfs: string[];
  logs: string[];
}

export class VnPrearrivalPortalError extends Error {
  constructor(
    message: string,
    readonly code = "vn_prearrival_portal_error",
    readonly portalSummary = "Vietnam Pre-Arrival portal did not return a confirmation.",
    readonly screenshotPaths: string[] = [],
    readonly logs: string[] = [],
  ) {
    super(message);
    this.name = "VnPrearrivalPortalError";
  }
}

async function saveScreenshot(page: Page, dir: string, name: string, logs: string[]): Promise<string | null> {
  const filePath = path.join(dir, `${name}.png`);
  try {
    await page.screenshot({ path: filePath, fullPage: true });
    return filePath;
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
    logs.push(`screenshot_failed name=${name} ${message}`);
    return null;
  }
}

async function clickFirstVisible(page: Page, selectors: Array<string | RegExp>): Promise<boolean> {
  for (const selector of selectors) {
    const locator = typeof selector === "string" ? page.locator(selector) : page.getByText(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible().catch(() => false)) {
        await candidate.click();
        return true;
      }
    }
  }
  return false;
}

async function fillNearLabel(page: Page, labels: RegExp[], value: string): Promise<boolean> {
  for (const label of labels) {
    const byLabel = page.getByLabel(label).first();
    if (await byLabel.isVisible().catch(() => false)) {
      await byLabel.fill(value);
      return true;
    }
    const labelText = page.getByText(label).first();
    if (await labelText.isVisible().catch(() => false)) {
      const input = labelText.locator("xpath=following::input[1]").first();
      if (await input.isVisible().catch(() => false)) {
        await input.fill(value);
        return true;
      }
    }
  }
  return false;
}

async function selectNearLabel(page: Page, labels: RegExp[], value: string): Promise<boolean> {
  for (const label of labels) {
    const byLabel = page.getByLabel(label).first();
    if (await byLabel.isVisible().catch(() => false)) {
      await byLabel.click();
      await page.getByText(value, { exact: true }).click({ timeout: 5_000 });
      return true;
    }
    const labelText = page.getByText(label).first();
    if (await labelText.isVisible().catch(() => false)) {
      const control = labelText.locator("xpath=following::*[@role='combobox' or self::select][1]").first();
      if (await control.isVisible().catch(() => false)) {
        await control.click();
        await page.getByText(value, { exact: true }).click({ timeout: 5_000 });
        return true;
      }
    }
  }
  return false;
}

async function handleCaptchaGate(page: Page, screenshots: string[], logs: string[], tempDir: string): Promise<void> {
  const bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  if (!/captcha verification|enter captcha|captcha/i.test(bodyText)) return;

  const captchaScreenshot = await saveScreenshot(page, tempDir, "captcha-gate", logs);
  if (captchaScreenshot) screenshots.push(captchaScreenshot);
  const outcome = await solveVietnamImageCaptcha(
    page,
    Number.parseInt(process.env.VN_PREARRIVAL_CAPTCHA_TIMEOUT_MS ?? "180000", 10),
  );
  if (!outcome.solved) {
    throw new VnPrearrivalPortalError(
      `Vietnam Pre-Arrival CAPTCHA could not be solved: ${outcome.reason ?? "unknown CAPTCHA error"}.`,
      "vn_prearrival_captcha_required",
      "The official portal presented a CAPTCHA before the declaration form. No submission was attempted.",
      screenshots,
      logs,
    );
  }
  logs.push(`captcha_solved solveId=${outcome.telemetry?.solveId ?? "unknown"} durationMs=${outcome.telemetry?.durationMs ?? 0}`);
  const verified = await clickFirstVisible(page, [/^verify$/i, /^xác nhận$/i]);
  if (!verified) {
    throw new VnPrearrivalPortalError(
      "Vietnam Pre-Arrival CAPTCHA was solved but the Verify control was not found.",
      "vn_prearrival_captcha_verify_not_found",
      "The official portal CAPTCHA was solved, but VIZA could not continue past the CAPTCHA gate.",
      screenshots,
      logs,
    );
  }
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(1_000);
}
export async function runVietnamPrearrivalPortalSubmission(
  payload: VnPrearrivalPortalPayload,
  options: {
    headless?: boolean;
    stopBeforeSubmit?: boolean;
  } = {},
): Promise<VnPrearrivalPortalSubmissionResult> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `viza-vn-prearrival-${payload.applicationId}-`));
  let session: ArrivalCardBrowserSession | null = null;
  const logs: string[] = [];
  const screenshots: string[] = [];

  try {
    session = await createArrivalCardBrowserSession({
      prefix: "VN_PREARRIVAL",
      headless: options.headless,
    });
    logs.push(...session.diagnostics);
    const { page } = session;
    await page.goto(VN_PREARRIVAL_OFFICIAL_PORTAL_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const loadedScreenshot = await saveScreenshot(page, tempDir, "loaded", logs);
    if (loadedScreenshot) screenshots.push(loadedScreenshot);

    const openedDeclaration = await clickFirstVisible(page, [
      /create\s*&\s*submit pre-arrival information/i,
      /submit pre-arrival information/i,
      /pre-arrival information/i,
      /khai báo/i,
      /tiếp tục/i,
    ]);
    if (openedDeclaration) {
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
      await page.waitForTimeout(1_000);
    }
    await handleCaptchaGate(page, screenshots, logs, tempDir);

    const missingControls: string[] = [];
    const fillTasks: Array<[RegExp[], string, string]> = [
      [[/full name/i, /họ.*tên/i], payload.fullName, "full_name"],
      [[/date of birth/i, /ngày sinh/i], payload.dateOfBirth, "date_of_birth"],
      [[/nationality/i, /quốc tịch/i], payload.nationality, "nationality"],
      [[/email/i], payload.emailAddress, "email_address"],
      [[/phone/i, /điện thoại/i], `${payload.phoneCountryCode}${payload.phoneNumber}`, "phone_number"],
      [[/passport/i, /hộ chiếu/i], payload.passportNumber, "passport_number"],
      [[/arrival date/i, /ngày nhập cảnh/i], payload.arrivalDate, "arrival_date"],
      [[/flight|transport/i, /chuyến bay|phương tiện/i], payload.flightOrTransportNumber, "flight_or_transport_number"],
      [[/address.*viet/i, /địa chỉ/i], payload.addressInVietnam, "address_in_vietnam"],
    ];
    for (const [labels, value, field] of fillTasks) {
      if (!(await fillNearLabel(page, labels, value))) missingControls.push(field);
    }

    const selectTasks: Array<[RegExp[], string, string]> = [
      [[/sex|gender/i, /giới tính/i], payload.sex, "sex"],
      [[/entry port|border gate|port of entry/i, /cửa khẩu/i], payload.entryPort, "entry_port"],
      [[/purpose/i, /mục đích/i], payload.purposeOfEntry, "purpose_of_entry"],
      [[/transport mode|mode of transport/i, /loại phương tiện/i], payload.transportMode, "transport_mode"],
    ];
    for (const [labels, value, field] of selectTasks) {
      if (!(await selectNearLabel(page, labels, value))) missingControls.push(field);
    }

    const fillScreenshot = await saveScreenshot(page, tempDir, "after-fill-attempt", logs);
    if (fillScreenshot) screenshots.push(fillScreenshot);
    if (missingControls.length > 0) {
      throw new VnPrearrivalPortalError(
        `Vietnam Pre-Arrival portal controls were not matched exactly: ${missingControls.join(", ")}.`,
        "vn_prearrival_portal_controls_not_matched",
        "The official portal loaded, but VIZA could not match every required official field exactly. No submission was attempted.",
        screenshots,
        logs,
      );
    }

    if (options.stopBeforeSubmit) {
      return {
        submitted: false,
        confirmationNumber: null,
        referenceNumber: null,
        portalUrl: page.url(),
        portalResponseSummary: "Vietnam Pre-Arrival form was filled in stop-before-submit mode; no official submission was made.",
        screenshots,
        pdfs: [],
        logs,
      };
    }

    const submitted = await clickFirstVisible(page, [/submit/i, /gửi/i, /hoàn thành/i]);
    if (!submitted) {
      throw new VnPrearrivalPortalError(
        "Vietnam Pre-Arrival submit control was not found.",
        "vn_prearrival_submit_control_not_found",
        "The official portal form was filled, but no exact submit control was found. No submission was attempted.",
        screenshots,
        logs,
      );
    }

    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
    const submitScreenshot = await saveScreenshot(page, tempDir, "after-submit", logs);
    if (submitScreenshot) screenshots.push(submitScreenshot);
    const bodyText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
    const confirmationNumber =
      bodyText.match(/\b(?:VN|PAI|QR)[A-Z0-9-]{6,}\b/i)?.[0] ??
      bodyText.match(/\b[A-Z0-9]{10,}\b/)?.[0] ??
      null;
    const hasQr = await page.locator("canvas, img[alt*='QR' i], img[src*='qr' i]").count().catch(() => 0);
    if (!confirmationNumber && hasQr === 0) {
      throw new VnPrearrivalPortalError(
        "Vietnam Pre-Arrival portal did not expose a QR code or confirmation number after submit.",
        "vn_prearrival_confirmation_not_captured",
        "The official portal did not return a confirmation artifact that VIZA can verify.",
        screenshots,
        logs,
      );
    }

    return {
      submitted: true,
      confirmationNumber,
      referenceNumber: confirmationNumber,
      portalUrl: page.url(),
      portalResponseSummary: confirmationNumber
        ? `Vietnam Pre-Arrival confirmation captured: ${confirmationNumber}.`
        : "Vietnam Pre-Arrival QR confirmation was captured.",
      screenshots,
      pdfs: [],
      logs,
    };
  } finally {
    if (session) await session.close().catch(() => undefined);
  }
}
