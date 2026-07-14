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

function officialOptionValue(value: string): string {
  const officialValues: Record<string, string> = {
    P: "P - Popular Passport",
    EV: "Electronic Visa (E-Visa)",
    "18A-131": "Vietnam Immigration Department - Ministry of Public Security",
    male: "Male",
    female: "Female",
    other: "Other",
    air: "Air",
    land: "Land",
    sea: "Sea",
    hotel: "Hotel",
    residential: "Residential",
    others: "Others",
    business_trip: "Business trip",
    travel: "Travel",
    study_abroad: "Study abroad",
    work: "Work",
    transit: "Transit",
  };
  return officialValues[value] ?? value;
}

async function fillLabeledInputAt(page: Page, label: RegExp, index: number, value: string): Promise<boolean> {
  const inputs = page.getByLabel(label);
  const count = await inputs.count().catch(() => 0);
  if (count <= index) return false;
  const input = inputs.nth(index);
  if (!(await input.isVisible().catch(() => false))) return false;
  await input.fill(value);
  return true;
}

function officialDate(value: string): string {
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return isoDate ? `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}` : value;
}

async function selectNearLabel(page: Page, labels: RegExp[], value: string): Promise<boolean> {
  const officialValue = officialOptionValue(value);
  for (const label of labels) {
    const byLabel = page.getByLabel(label).first();
    if (await byLabel.isVisible().catch(() => false)) {
      await byLabel.click();
      await page.getByText(officialValue, { exact: true }).click({ timeout: 5_000 });
      return true;
    }
    const labelText = page.getByText(label).first();
    if (await labelText.isVisible().catch(() => false)) {
      const control = labelText.locator("xpath=following::*[@role='combobox' or self::select][1]").first();
      if (await control.isVisible().catch(() => false)) {
        await control.click();
        await page.getByText(officialValue, { exact: true }).click({ timeout: 5_000 });
        return true;
      }
    }
  }
  return false;
}

async function selectOfficialRadio(page: Page, value: string): Promise<boolean> {
  const officialValue = officialOptionValue(value);
  const radio = page.getByRole("radio", { name: officialValue, exact: true });
  const radioCount = await radio.count().catch(() => 0);
  if (radioCount === 1 && (await radio.isVisible().catch(() => false))) {
    await radio.check();
    return true;
  }

  const label = page.getByText(officialValue, { exact: true });
  const labelCount = await label.count().catch(() => 0);
  if (labelCount !== 1 || !(await label.isVisible().catch(() => false))) return false;
  await label.click();
  return true;
}

async function completeNationalityGate(page: Page, nationality: string): Promise<boolean> {
  const bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  if (!/select your nationality/i.test(bodyText)) return true;

  const inputs = page.locator("input");
  const inputCount = await inputs.count().catch(() => 0);
  if (inputCount !== 1) return false;
  const input = inputs.nth(0);
  if (!(await input.isVisible().catch(() => false))) return false;

  await input.fill(nationality);
  // The official nationality control is an autocomplete rather than a native
  // select. Click its returned option and confirm the input accepted it before
  // continuing; typing alone leaves the official Next action on the same page.
  const nationalityOption = page.getByText(nationality, { exact: true });
  try {
    await nationalityOption.waitFor({ state: "visible", timeout: 10_000 });
  } catch {
    return false;
  }
  const optionCount = await nationalityOption.count().catch(() => 0);
  if (optionCount !== 1) return false;
  await nationalityOption.click();
  if ((await input.inputValue()) !== nationality) return false;

  const next = page.getByText("Next", { exact: true });
  const nextCount = await next.count().catch(() => 0);
  if (nextCount !== 1) return false;
  await next.click();
  await page.waitForTimeout(1_500);
  const afterNextBody = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  return !/select your nationality/i.test(afterNextBody) || /captcha/i.test(afterNextBody);
}

async function clickOfficialPrimaryAction(page: Page, labels: string[]): Promise<boolean> {
  for (const label of labels) {
    // The landing page hydrates its cards after the initial DOM load. Let the
    // exact control wait for hydration instead of treating a zero early count
    // as a missing official action.
    const action = page.getByText(label, { exact: true });
    try {
      await action.click({ timeout: 15_000 });
      return true;
    } catch {
      // Try the next localized official label.
    }
  }
  return false;
}

async function clickOfficialButton(page: Page, name: string): Promise<boolean> {
  const button = page.getByRole("button", { name, exact: true });
  const buttonCount = await button.count().catch(() => 0);
  if (buttonCount !== 1 || !(await button.isVisible().catch(() => false))) return false;
  await button.click({ timeout: 15_000 });
  return true;
}

async function saveQrArtifact(page: Page, dir: string, logs: string[]): Promise<string | null> {
  const qrLocator = page.locator("canvas, img[alt*='QR' i], img[src*='qr' i]").first();
  if (!(await qrLocator.isVisible().catch(() => false))) return null;
  const filePath = path.join(dir, "confirmation-qr.png");
  try {
    await qrLocator.screenshot({ path: filePath });
    logs.push("vn_prearrival_qr_saved");
    return filePath;
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
    logs.push(`vn_prearrival_qr_save_failed ${message}`);
    return null;
  }
}

async function downloadConfirmationPdf(page: Page, dir: string, logs: string[]): Promise<string | null> {
  const downloadButton = page.getByText(/download pdf pre-arrival information|download pdf/i).first();
  if (!(await downloadButton.isVisible().catch(() => false))) return null;
  try {
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15_000 }),
      downloadButton.click(),
    ]);
    const filePath = path.join(dir, "vietnam-prearrival-confirmation.pdf");
    await download.saveAs(filePath);
    logs.push("vn_prearrival_pdf_downloaded");
    return filePath;
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
    logs.push(`vn_prearrival_pdf_download_failed ${message}`);
    return null;
  }
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

async function waitForPassengerForm(page: Page, screenshots: string[], logs: string[], tempDir: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await handleCaptchaGate(page, screenshots, logs, tempDir);
    const passengerHeading = page.getByText(/passenger information/i);
    const headingCount = await passengerHeading.count().catch(() => 0);
    if (headingCount > 0 && (await passengerHeading.first().isVisible().catch(() => false))) return true;
    await page.waitForTimeout(2_000);
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
    const loadedScreenshot = await saveScreenshot(page, tempDir, "loaded", logs);
    if (loadedScreenshot) screenshots.push(loadedScreenshot);

    // The header itself includes "Pre-arrival Information". Match only the
    // official primary action so the landing page is never mistaken for the form.
    const openedDeclaration = await clickOfficialPrimaryAction(page, [
      "Create & Submit Pre-arrival Information",
      "Khai báo thông tin trước khi nhập cảnh",
    ]);
    if (!openedDeclaration) {
      throw new VnPrearrivalPortalError(
        "Vietnam Pre-Arrival primary declaration action was not found on the official landing page.",
        "vn_prearrival_start_control_not_found",
        "The official portal loaded, but its declaration start control could not be matched. No submission was attempted.",
        screenshots,
        logs,
      );
    }
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(1_000);
    await handleCaptchaGate(page, screenshots, logs, tempDir);
    if (!(await completeNationalityGate(page, payload.nationality))) {
      throw new VnPrearrivalPortalError(
        "Vietnam Pre-Arrival nationality selection could not be completed on the official portal.",
        "vn_prearrival_nationality_gate_not_completed",
        "The official portal requires a nationality selection before the declaration form. No submission was attempted.",
        screenshots,
        logs,
      );
    }
    // The official portal can present the image CAPTCHA again after the
    // nationality screen. Do not treat the modal as an empty declaration form.
    if (!(await waitForPassengerForm(page, screenshots, logs, tempDir))) {
      const waitingScreenshot = await saveScreenshot(page, tempDir, "passenger-form-not-ready", logs);
      if (waitingScreenshot) screenshots.push(waitingScreenshot);
      throw new VnPrearrivalPortalError(
        "Vietnam Pre-Arrival passenger form did not load after nationality and CAPTCHA verification.",
        "vn_prearrival_passenger_form_not_ready",
        "The official portal did not render the passenger-information form after verification. No submission was attempted.",
        screenshots,
        logs,
      );
    }

    const missingControls: string[] = [];
    const passengerFillTasks: Array<[RegExp[], string, string]> = [
      [[/passport number/i, /số hộ chiếu/i], payload.passportNumber, "passport_number"],
      [[/surname/i], payload.surname ?? "", "surname"],
      [[/given name/i], payload.givenName, "given_name"],
      [[/date of birth/i, /ngày sinh/i], officialDate(payload.dateOfBirth), "date_of_birth"],
      [[/email/i], payload.emailAddress, "email_address"],
      [[/phone/i, /điện thoại/i], `${payload.phoneCountryCode}${payload.phoneNumber}`, "phone_number"],
      [[/^number\b/i], payload.visaNumber, "visa_number"],
      [[/^date of issue/i], payload.visaIssueDate ? officialDate(payload.visaIssueDate) : "", "visa_issue_date"],
    ];
    for (const [labels, value, field] of passengerFillTasks) {
      if (!value && (field === "surname" || field === "visa_issue_date")) continue;
      if (!(await fillNearLabel(page, labels, value))) missingControls.push(field);
    }
    if (!(await fillLabeledInputAt(page, /^date of expiry/i, 0, officialDate(payload.passportExpiryDate)))) {
      missingControls.push("passport_expiry_date");
    }
    if (!(await fillLabeledInputAt(page, /^date of expiry/i, 1, officialDate(payload.visaExpiryDate)))) {
      missingControls.push("visa_expiry_date");
    }

    const passengerSelectTasks: Array<[RegExp[], string, string]> = [
      [[/passport type/i], payload.passportType, "passport_type"],
      [[/visa type|purpose/i], payload.visaType, "visa_type"],
      [[/issued place/i], payload.visaIssuedPlace ?? "", "visa_issued_place"],
    ];
    for (const [labels, value, field] of passengerSelectTasks) {
      if (!value) continue;
      if (!(await selectNearLabel(page, labels, value))) missingControls.push(field);
    }

    if (!(await selectOfficialRadio(page, payload.gender))) missingControls.push("gender");
    if (!(await clickFirstVisible(page, [/^i have read and understood this information\.?$/i]))) {
      missingControls.push("visa_information_acknowledgement");
    }

    if (missingControls.length === 0 && !(await clickOfficialButton(page, "Trip Information"))) {
      missingControls.push("trip_information_next");
    }
    await page.waitForTimeout(1_000);

    const tripFillTasks: Array<[RegExp[], string, string]> = [
      [[/departure country before arrival/i], payload.departureCountryBeforeArrival, "departure_country_before_arrival"],
      [[/flight number/i, /chuyến bay/i], payload.flightNumber ?? "", "flight_number"],
      [[/vehicle identification number/i], payload.vehicleIdentificationNumber ?? "", "vehicle_identification_number"],
      [[/accommodation address/i, /địa chỉ/i], payload.accommodationAddress, "accommodation_address"],
      [[/workplace information/i], payload.workplaceInformation ?? "", "workplace_information"],
    ];
    for (const [labels, value, field] of tripFillTasks) {
      if (!value && (field === "workplace_information" || field === "vehicle_identification_number")) continue;
      if (!(await fillNearLabel(page, labels, value))) missingControls.push(field);
    }
    const tripSelectTasks: Array<[RegExp[], string, string]> = [
      [[/purpose of travel/i, /mục đích/i], payload.purposeOfTravel, "purpose_of_travel"],
      [[/border gate|port of entry/i, /cửa khẩu/i], payload.borderGateAirport ?? payload.landBorderGate ?? payload.seaPort ?? "", "border_gate"],
      [[/province.*city/i], payload.provinceCityOfHotel, "province_city_of_hotel"],
      [[/ward.*commune/i], payload.wardCommuneOfHotel, "ward_commune_of_hotel"],
    ];
    for (const [labels, value, field] of tripSelectTasks) {
      if (!value) continue;
      if (!(await selectNearLabel(page, labels, value))) missingControls.push(field);
    }
    for (const [value, field] of [[payload.modeOfTravel, "mode_of_travel"], [payload.accommodationType, "accommodation_type"]] as const) {
      if (!(await selectOfficialRadio(page, value))) missingControls.push(field);
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
    const qrPath = await saveQrArtifact(page, tempDir, logs);
    if (qrPath) screenshots.push(qrPath);
    const pdfPath = await downloadConfirmationPdf(page, tempDir, logs);
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
      pdfs: pdfPath ? [pdfPath] : [],
      logs,
    };
  } finally {
    if (session) await session.close().catch(() => undefined);
  }
}
