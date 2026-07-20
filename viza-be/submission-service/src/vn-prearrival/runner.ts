import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { Locator, Page } from "@playwright/test";
import {
  createArrivalCardBrowserSession,
  type ArrivalCardBrowserSession,
} from "../arrival-card-browser";
import {
  VN_PREARRIVAL_OFFICIAL_PORTAL_URL,
  type VnPrearrivalPortalPayload,
} from "./normalize";
import { formatOfficialFlightDisplayLabel } from "./flight-label";
import { solveVietnamImageCaptcha } from "../vietnam/captcha";
import { inbox, type InboundMessage } from "../inbox/wait-for-message";

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
  return officialValues[value] ?? value.replace(/^([A-Z0-9]+)_([A-Z]{3})$/i, "$1 - $2");
}

type OfficialStaticItem = {
  code?: string;
  en_value?: string;
  english_value?: string;
  airport?: string;
};

type AdministrativeItem = {
  value?: string;
  label_en?: string;
};

type OfficialStaticCatalog = {
  sources?: Record<string, OfficialStaticItem[] | undefined>;
};

type AdministrativeCatalog = {
  provinces?: AdministrativeItem[];
  wards_by_province?: Record<string, AdministrativeItem[] | undefined>;
};

let officialStaticCatalog: OfficialStaticCatalog | null | undefined;
let administrativeCatalog: AdministrativeCatalog | null | undefined;

function readWorkspaceJson<T>(relativePath: string): T | null {
  const candidates = [
    path.resolve(process.cwd(), relativePath),
    path.resolve(process.cwd(), "..", "..", relativePath),
    path.resolve(__dirname, "..", "..", "..", "..", relativePath),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return JSON.parse(fs.readFileSync(candidate, "utf8")) as T;
    } catch {
      // Try the next monorepo/runtime layout.
    }
  }
  return null;
}

function loadOfficialStaticCatalog(): OfficialStaticCatalog | null {
  if (officialStaticCatalog !== undefined) return officialStaticCatalog;
  officialStaticCatalog = readWorkspaceJson<OfficialStaticCatalog>(
    "viza-fe/internal-website/lib/vn-prearrival/official-static-options.json",
  );
  return officialStaticCatalog;
}

function loadAdministrativeCatalog(): AdministrativeCatalog | null {
  if (administrativeCatalog !== undefined) return administrativeCatalog;
  administrativeCatalog = readWorkspaceJson<AdministrativeCatalog>(
    "viza-fe/internal-website/lib/vn-prearrival/administrative-units-legacy.json",
  );
  return administrativeCatalog;
}

function officialCatalogLabel(source: string, value: string, parent = ""): string {
  if (!value) return value;
  if (source === "province") {
    return loadAdministrativeCatalog()?.provinces?.find((item) => item.value === value)?.label_en ?? value;
  }
  if (source === "ward") {
    return loadAdministrativeCatalog()?.wards_by_province?.[parent]?.find((item) => item.value === value)?.label_en ?? value;
  }
  const item = loadOfficialStaticCatalog()?.sources?.[source]?.find((candidate) => candidate.code === value);
  if (!item) return officialOptionValue(value);
  const label = item.en_value ?? item.english_value ?? value;
  return source === "flight"
    ? formatOfficialFlightDisplayLabel(label, item.airport)
    : label;
}

function caseInsensitiveExactText(value: string): RegExp {
  return new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
}

function normalizedOptionText(value: string): string {
  return value.replace(/\s+/g, "").toLocaleLowerCase();
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

async function selectExpectedArrivalDate(page: Page, value: string): Promise<boolean> {
  const officialValue = officialDate(value);
  const radio = page.getByRole("radio", { name: officialValue, exact: true }).first();
  if (await radio.isVisible().catch(() => false)) {
    await radio.check();
    return true;
  }
  const dateChoice = page.getByText(officialValue, { exact: true }).first();
  if (!(await dateChoice.isVisible().catch(() => false))) return false;
  await dateChoice.click();
  return true;
}

async function selectNearLabel(
  page: Page,
  labels: RegExp[],
  value: string,
  searchValue = value,
): Promise<boolean> {
  const officialValue = officialOptionValue(value);
  const chooseAutocompleteOption = async (control: Locator): Promise<void> => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (await control.isEnabled().catch(() => false)) break;
      await page.waitForTimeout(500);
    }
    if (!(await control.isEnabled().catch(() => false))) {
      throw new Error(`Official control did not become enabled for ${officialValue}.`);
    }
    await control.click();
    // Official Material UI controls only render the matching option after text
    // is entered. Opening the menu alone leaves large lists (countries,
    // flights, hotels, consular posts) unfiltered and can time out.
    const tagName = await control.evaluate((element) => element.tagName.toLowerCase()).catch(() => "");
    const editable = await control.isEditable().catch(() => false);
    if ((tagName === "input" || tagName === "textarea") && editable) {
      await control.fill(searchValue);
    } else {
      // Flight number is currently rendered as a Material UI select trigger,
      // not an ARIA combobox. Once its list is open, the portal accepts type
      // ahead on that trigger and filters the same official listbox.
      await page.keyboard.type(searchValue);
    }
    // The official site is built with Material UI. Its remote autocomplete
    // choices are listbox options, not stable text nodes, so wait for and
    // select the actual accessible option first.
    const roleOption = page.getByRole("option", { name: caseInsensitiveExactText(officialValue) }).first();
    try {
      await roleOption.click({ timeout: 15_000 });
      return;
    } catch {
      const options = page.getByRole("option");
      const count = await options.count().catch(() => 0);
      const expected = normalizedOptionText(officialValue);
      for (let index = 0; index < count; index += 1) {
        const option = options.nth(index);
        const text = await option.textContent().catch(() => "");
        if (text && normalizedOptionText(text) === expected) {
          await option.click({ timeout: 5_000 });
          return;
        }
      }
    }
    const exactOption = page.getByText(officialValue, { exact: true });
    try {
      await exactOption.click({ timeout: 15_000 });
      return;
    } catch {
      // The official country data has minor title-case variations (for example
      // "And" versus "and"). Keep the displayed official text as the source
      // of truth while matching that harmless casing variation.
      await page.getByText(caseInsensitiveExactText(officialValue)).click({ timeout: 15_000 });
    }
  };
  for (const label of labels) {
    const byLabel = page.getByLabel(label).first();
    if (await byLabel.isVisible().catch(() => false)) {
      try {
        await chooseAutocompleteOption(byLabel);
        return true;
      } catch {
        // Continue so the caller can save an official-page diagnostic rather
        // than aborting before the after-fill screenshot is captured.
      }
    }
    const labelText = page.getByText(label).first();
    if (await labelText.isVisible().catch(() => false)) {
      // The official field implementation varies between input, combobox, and
      // select-trigger markup. Try each associated shape, but still select
      // only an exact official option in chooseAutocompleteOption.
      const controls = [
        labelText.locator(
          "xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' MuiGrid-item ')][1]//input[1]",
        ).first(),
        labelText.locator("xpath=following::input[1]").first(),
        labelText.locator("xpath=following::*[@role='combobox'][1]").first(),
        labelText.locator("xpath=following::*[@aria-haspopup='listbox'][1]").first(),
        labelText.locator("xpath=following::button[1]").first(),
      ];
      for (const control of controls) {
        if (!(await control.isVisible().catch(() => false))) continue;
        try {
          await chooseAutocompleteOption(control);
          return true;
        } catch {
          // Try the next official control shape.
        }
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

function extractSixDigitCode(message: Pick<InboundMessage, "subject" | "text" | "html">): string | null {
  const haystack = [message.subject ?? "", message.text ?? "", message.html ?? ""].join("\n");
  return /(?<![\w-])\d{6}(?![\w-])/.exec(haystack)?.[0] ?? null;
}

async function isEmailVerificationVisible(page: Page): Promise<boolean> {
  const bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  return /verify your email|sent a 6-digit code|enter it below/i.test(bodyText);
}

async function fillEmailVerificationCode(page: Page, code: string): Promise<boolean> {
  const dialog = page.getByRole("dialog");
  const scope = (await dialog.count().catch(() => 0)) === 1 ? dialog : page.locator("body");
  const inputs = scope.locator("input");
  const visibleInputs: Array<ReturnType<typeof inputs.nth>> = [];
  const count = await inputs.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const input = inputs.nth(index);
    if (await input.isVisible().catch(() => false)) visibleInputs.push(input);
  }

  if (visibleInputs.length >= 6) {
    for (let index = 0; index < 6; index += 1) {
      await visibleInputs[index].fill(code[index]);
    }
  } else if (visibleInputs.length === 1) {
    await visibleInputs[0].fill(code);
  } else {
    return false;
  }

  const verify = scope.getByRole("button", { name: /^verify$/i });
  const verifyCount = await verify.count().catch(() => 0);
  if (verifyCount !== 1 || !(await verify.isVisible().catch(() => false))) return false;
  await verify.click({ timeout: 15_000 });
  return true;
}

async function handleEmailVerification(
  page: Page,
  applicantId: string | undefined,
  requestedAfter: string,
  screenshots: string[],
  logs: string[],
  tempDir: string,
): Promise<void> {
  if (!(await isEmailVerificationVisible(page))) return;

  const screenshot = await saveScreenshot(page, tempDir, "email-verification", logs);
  if (screenshot) screenshots.push(screenshot);
  if (!applicantId) {
    throw new VnPrearrivalPortalError(
      "Vietnam Pre-Arrival requested an email verification code, but the applicant inbox identity was unavailable.",
      "vn_prearrival_otp_applicant_missing",
      "The official portal requested email verification, but VIZA could not resolve the applicant alias inbox.",
      screenshots,
      logs,
    );
  }

  logs.push("vn_prearrival_otp_wait_started");
  const timeoutMs = Number.parseInt(process.env.VN_PREARRIVAL_OTP_TIMEOUT_MS ?? "300000", 10);
  const message = await inbox.waitForMessage(
    applicantId,
    (candidate) => {
      const content = [candidate.subject ?? "", candidate.text ?? "", candidate.html ?? ""].join("\n");
      return /verification|verify|one[- ]?time|otp|6-digit|pre-arrival/i.test(content)
        && extractSixDigitCode(candidate) !== null;
    },
    timeoutMs,
    { since: requestedAfter, pollIntervalMs: 3_000, includeProcessed: true, markProcessed: false },
  );
  const code = extractSixDigitCode(message);
  if (!code || !(await fillEmailVerificationCode(page, code))) {
    throw new VnPrearrivalPortalError(
      "Vietnam Pre-Arrival email verification code was received but could not be entered on the official portal.",
      "vn_prearrival_otp_fill_failed",
      "The official email code arrived, but the verification dialog could not be completed.",
      screenshots,
      logs,
    );
  }

  logs.push("vn_prearrival_otp_verified");
  await page.waitForTimeout(1_000);
  if (await isEmailVerificationVisible(page)) {
    throw new VnPrearrivalPortalError(
      "Vietnam Pre-Arrival email verification dialog remained open after verification.",
      "vn_prearrival_otp_rejected",
      "The official portal did not accept the email verification code.",
      screenshots,
      logs,
    );
  }
}

async function openOfficialReviewPage(
  page: Page,
  screenshots: string[],
  logs: string[],
  tempDir: string,
): Promise<void> {
  const reviewClicked = await clickOfficialButton(page, "Review & Submit")
    || await clickOfficialButton(page, "Review and Submit");
  if (!reviewClicked) {
    throw new VnPrearrivalPortalError(
      "Vietnam Pre-Arrival Review & Submit control was not found.",
      "vn_prearrival_review_control_not_found",
      "The official trip form was filled, but VIZA could not open the official review page.",
      screenshots,
      logs,
    );
  }
  logs.push("vn_prearrival_review_opened");
  const finalDeclaration = page.getByText(/^i confirm that the information is correct\.?$/i);
  try {
    await finalDeclaration.waitFor({ state: "visible", timeout: 15_000 });
  } catch {
    const blockedScreenshot = await saveScreenshot(page, tempDir, "review-not-reached", logs);
    if (blockedScreenshot) screenshots.push(blockedScreenshot);
    throw new VnPrearrivalPortalError(
      "Vietnam Pre-Arrival did not enter the official review page after Review & Submit was clicked.",
      "vn_prearrival_review_page_not_reached",
      "The official trip form rejected or did not finish its transition to the review page.",
      screenshots,
      logs,
    );
  }
  const reviewScreenshot = await saveScreenshot(page, tempDir, "review", logs);
  if (reviewScreenshot) screenshots.push(reviewScreenshot);
}

async function completeOfficialSubmissionFromReview(
  page: Page,
  applicantId: string | undefined,
  screenshots: string[],
  logs: string[],
  tempDir: string,
): Promise<void> {
  const confirmed = await clickFirstVisible(page, [
    /^i confirm that the information is correct\.?$/i,
    /^tôi xác nhận.*chính xác/i,
  ]);
  if (!confirmed) {
    throw new VnPrearrivalPortalError(
      "Vietnam Pre-Arrival final declaration checkbox was not found on the review page.",
      "vn_prearrival_final_declaration_not_found",
      "The official review page loaded, but its required final declaration could not be confirmed.",
      screenshots,
      logs,
    );
  }

  const otpRequestedAfter = new Date(Date.now() - 5_000).toISOString();
  if (!(await clickOfficialButton(page, "Submit"))) {
    throw new VnPrearrivalPortalError(
      "Vietnam Pre-Arrival final Submit control was not found on the review page.",
      "vn_prearrival_submit_control_not_found",
      "The official review page was confirmed, but its final Submit control was unavailable.",
      screenshots,
      logs,
    );
  }
  logs.push("vn_prearrival_final_submit_clicked");

  for (let attempt = 0; attempt < 6; attempt += 1) {
    await page.waitForTimeout(750);
    await handleEmailVerification(page, applicantId, otpRequestedAfter, screenshots, logs, tempDir);
    await handleCaptchaGate(page, screenshots, logs, tempDir);
    const bodyText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
    if (/your submission is successful|submission is successful|acknowledgement message/i.test(bodyText)) {
      logs.push("vn_prearrival_official_success_visible");
      return;
    }
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  }
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

async function waitForPassengerForm(
  page: Page,
  nationality: string,
  screenshots: string[],
  logs: string[],
  tempDir: string,
): Promise<boolean> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await handleCaptchaGate(page, screenshots, logs, tempDir);
    const passengerHeading = page.getByText(/passenger information/i);
    const headingCount = await passengerHeading.count().catch(() => 0);
    if (headingCount > 0 && (await passengerHeading.first().isVisible().catch(() => false))) return true;
    // The portal occasionally returns to the nationality gate after CAPTCHA
    // verification. Re-select the official option rather than treating it as
    // a completed transition.
    if (!(await completeNationalityGate(page, nationality))) return false;
    await page.waitForTimeout(2_000);
  }
  return false;
}

async function waitForTripForm(page: Page): Promise<boolean> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const tripHeading = page.getByText(/trip information/i);
    const headingCount = await tripHeading.count().catch(() => 0);
    const purposeControl = page.getByText(/purpose of travel/i);
    const purposeCount = await purposeControl.count().catch(() => 0);
    if (headingCount > 0 && purposeCount > 0) return true;
    await page.waitForTimeout(1_500);
  }
  return false;
}

async function waitForAirBorderGate(page: Page, expectedAirport: string): Promise<boolean> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const labelled = page.getByLabel(/border gate|port of entry/i).first();
    const labelledValue = await labelled.inputValue().catch(() => "");
    if (labelledValue.trim() && labelledValue.toUpperCase().includes(expectedAirport.toUpperCase())) return true;

    const labelText = page.getByText(/border gate|port of entry/i).first();
    if (await labelText.isVisible().catch(() => false)) {
      const input = labelText.locator(
        "xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' MuiGrid-item ')][1]//input[1]",
      ).first();
      const value = await input.inputValue().catch(() => "");
      if (value.trim() && value.toUpperCase().includes(expectedAirport.toUpperCase())) return true;
    }

    const bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
    const gateLine = bodyText.match(/Border Gate[^\n]*\n([^\n]+)/i)?.[1] ?? "";
    if (gateLine.toUpperCase().includes(expectedAirport.toUpperCase())) return true;
    await page.waitForTimeout(1_000);
  }
  return false;
}

export async function runVietnamPrearrivalPortalSubmission(
  payload: VnPrearrivalPortalPayload,
  options: {
    headless?: boolean;
    stopBeforeSubmit?: boolean;
    applicantId?: string;
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
    if (!(await waitForPassengerForm(page, payload.nationality, screenshots, logs, tempDir))) {
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
    if (!(await selectExpectedArrivalDate(page, payload.expectedArrivalDate))) {
      missingControls.push("expected_arrival_date");
    }
    const passengerFillTasks: Array<[RegExp[], string, string]> = [
      [[/passport number/i, /số hộ chiếu/i], payload.passportNumber, "passport_number"],
      [[/surname/i], payload.surname ?? "", "surname"],
      [[/given name/i], payload.givenName, "given_name"],
      [[/date of birth/i, /ngày sinh/i], officialDate(payload.dateOfBirth), "date_of_birth"],
      [[/email/i], payload.emailAddress, "email_address"],
      // The official form separates the dialling code from the local number.
      // Supplying both here duplicates the country prefix and fails its 3-14
      // digit validation before the Trip Information action can proceed.
      [[/phone/i, /điện thoại/i], payload.phoneNumber.replace(/\D/g, "").replace(/^86(?=\d{3,14}$)/, ""), "phone_number"],
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

    const passengerSelectTasks: Array<[RegExp[], string, string, string?]> = [
      [[/passport type/i], payload.passportType, "passport_type"],
      [[/visa type\s*\/\s*purpose/i], payload.visaType, "visa_type", "Electronic Visa"],
      [
        [/issued place/i],
        payload.visaIssuedPlace ? officialCatalogLabel("visa_issue_place", payload.visaIssuedPlace) : "",
        "visa_issued_place",
        "Vietnam Immigration Department",
      ],
    ];
    for (const [labels, value, field, searchValue] of passengerSelectTasks) {
      if (!value) continue;
      if (!(await selectNearLabel(page, labels, value, searchValue ?? value))) missingControls.push(field);
    }

    if (!(await selectOfficialRadio(page, payload.gender))) missingControls.push("gender");
    if (!(await clickFirstVisible(page, [/^i have read and understood this information\.?$/i]))) {
      missingControls.push("visa_information_acknowledgement");
    }

    if (missingControls.length === 0 && !(await clickOfficialButton(page, "Trip Information"))) {
      missingControls.push("trip_information_next");
    }
    if (missingControls.length === 0 && !(await waitForTripForm(page))) {
      missingControls.push("trip_information_form_not_ready");
    }

    // These controls are dependent in the official UI. In particular, an air
    // border gate is read-only and only becomes populated after a flight option
    // is selected from the official autocomplete list.
    if (!(await selectOfficialRadio(page, payload.modeOfTravel))) missingControls.push("mode_of_travel");
    if (!(await selectNearLabel(page, [/departure country before arrival/i], payload.departureCountryBeforeArrival))) {
      missingControls.push("departure_country_before_arrival");
    }
    if (!(await selectNearLabel(page, [/purpose of travel/i, /mục đích/i], payload.purposeOfTravel))) {
      missingControls.push("purpose_of_travel");
    }

    let verifyAirBorderGate = false;
    if (payload.modeOfTravel === "air") {
      const flightLabel = officialCatalogLabel("flight", payload.flightNumber ?? "");
      const flightSearchValue = (payload.flightNumber ?? "").replace(/_([A-Z]{3})$/i, "");
      logs.push(`vn_prearrival_option_resolved field=flight_number value=${flightLabel}`);
      if (!(await selectNearLabel(page, [/flight number/i, /chuyến bay/i], flightLabel, flightSearchValue))) {
        missingControls.push("flight_number");
      } else verifyAirBorderGate = true;
    } else {
      if (!(await fillNearLabel(page, [/vehicle identification number/i], payload.vehicleIdentificationNumber ?? ""))) {
        missingControls.push("vehicle_identification_number");
      }
      const borderGate = payload.landBorderGate ?? payload.seaPort ?? "";
      if (!(await selectNearLabel(page, [/border gate|port of entry/i, /cửa khẩu/i], borderGate))) {
        missingControls.push("border_gate");
      }
    }

    if (!(await selectOfficialRadio(page, payload.accommodationType))) missingControls.push("accommodation_type");
    if (payload.accommodationType === "hotel") {
      const provinceLabel = officialCatalogLabel("province", payload.provinceCityOfHotel);
      const wardLabel = officialCatalogLabel("ward", payload.wardCommuneOfHotel, payload.provinceCityOfHotel);
      const accommodationLabel = officialCatalogLabel("hotel", payload.accommodationAddress);
      logs.push(`vn_prearrival_option_resolved field=province_city_of_hotel value=${provinceLabel}`);
      logs.push(`vn_prearrival_option_resolved field=ward_commune_of_hotel value=${wardLabel}`);
      logs.push(`vn_prearrival_option_resolved field=accommodation_address value=${accommodationLabel}`);
      const hotelSelectTasks: Array<[RegExp[], string, string]> = [
        [[/province.*city/i], provinceLabel, "province_city_of_hotel"],
        [[/ward.*commune/i], wardLabel, "ward_commune_of_hotel"],
        [[/accommodation address/i, /địa chỉ/i], accommodationLabel, "accommodation_address"],
      ];
      for (const [labels, value, field] of hotelSelectTasks) {
        if (!(await selectNearLabel(page, labels, value))) missingControls.push(field);
      }
    } else if (!(await fillNearLabel(page, [/accommodation address/i, /địa chỉ/i], payload.accommodationAddress))) {
      missingControls.push("accommodation_address");
    }
    if (payload.workplaceInformation && !(await fillNearLabel(page, [/workplace information/i], payload.workplaceInformation))) {
      missingControls.push("workplace_information");
    }
    if (
      payload.departureDateFromVietnam
      && !(await fillNearLabel(
        page,
        [/expected date of departure from vietnam/i, /date of departure from vietnam/i],
        officialDate(payload.departureDateFromVietnam),
      ))
    ) {
      missingControls.push("departure_date_from_vietnam");
    }
    if (
      verifyAirBorderGate
      && !(await waitForAirBorderGate(page, payload.borderGateAirport ?? ""))
    ) {
      // The current portal renders this locked value outside a stable input
      // node. Let its own Review & Submit validation prove the dependency was
      // accepted instead of rejecting a visibly populated airport field.
      logs.push("vn_prearrival_airport_autofill_dom_value_not_observed");
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

    await openOfficialReviewPage(page, screenshots, logs, tempDir);
    if (options.stopBeforeSubmit) {
      return {
        submitted: false,
        confirmationNumber: null,
        referenceNumber: null,
        portalUrl: page.url(),
        portalResponseSummary: "Vietnam Pre-Arrival official review page was reached in stop-before-submit mode; no official submission was made.",
        screenshots,
        pdfs: [],
        logs,
      };
    }

    await completeOfficialSubmissionFromReview(page, options.applicantId, screenshots, logs, tempDir);
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
