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

async function saveScreenshot(page: Page, dir: string, name: string): Promise<string> {
  const filePath = path.join(dir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
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
    screenshots.push(await saveScreenshot(page, tempDir, "loaded"));

    await clickFirstVisible(page, [
      /submit pre-arrival information/i,
      /pre-arrival information/i,
      /khai báo/i,
      /tiếp tục/i,
    ]);

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

    screenshots.push(await saveScreenshot(page, tempDir, "after-fill-attempt"));
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
    screenshots.push(await saveScreenshot(page, tempDir, "after-submit"));
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
