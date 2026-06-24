import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import type { SgacPortalPayload } from "./normalize";
import { reportBadCaptcha, solveImageCaptcha } from "../captcha";

export const SGAC_OFFICIAL_PORTAL_URL = "https://eservices.ica.gov.sg/sgarrivalcard/fvipa";

export class SgacPortalError extends Error {
  readonly code: string;
  readonly screenshotPaths: string[];
  readonly portalSummary?: string;

  constructor(message: string, options: { code?: string; screenshotPaths?: string[]; portalSummary?: string } = {}) {
    super(message);
    this.name = "SgacPortalError";
    this.code = options.code ?? "sgac_portal_error";
    this.screenshotPaths = options.screenshotPaths ?? [];
    this.portalSummary = options.portalSummary;
  }
}

export interface RunSgacPortalOptions {
  headless?: boolean;
  stopBeforeSubmit?: boolean;
  artifactDir?: string;
  timeoutMs?: number;
}

export interface SgacPortalRunResult {
  submitted: boolean;
  status: "submitted" | "stopped_before_submit";
  confirmationNumber?: string | null;
  referenceNumber?: string | null;
  portalResponseSummary: string;
  portalUrl: string;
  screenshots: string[];
  pdfs: string[];
  logs: string[];
}

interface Handles {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function screenshot(page: Page, artifactDir: string, name: string): Promise<string> {
  fs.mkdirSync(artifactDir, { recursive: true });
  const file = path.join(artifactDir, `${name}-${Date.now()}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

function looksLikeNonEmptyPdf(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 10_000) return false;
  const head = buffer.subarray(0, 16).toString("latin1");
  if (!head.startsWith("%PDF-")) return false;
  const text = buffer.toString("latin1");
  return /\/Type\s*\/Page\b/.test(text) || /\/Pages\b/.test(text);
}

async function closeFeedbackPopupIfPresent(page: Page, logs: string[]): Promise<void> {
  const popup = page.locator(".modal-content, .modal-dialog, [role='dialog']").filter({
    hasText: /Rate your experience with this transaction/i,
  }).last();
  if (!(await popup.isVisible({ timeout: 2_000 }).catch(() => false))) return;
  await popup.locator("button, [role='button']").filter({ hasText: /^×$|^x$/i }).last().click({ timeout: 5_000 }).catch(async () => {
    await page.keyboard.press("Escape").catch(() => undefined);
  });
  logs.push("sgac_feedback_popup_closed_before_pdf_download");
}

async function captureConfirmationPdf(
  page: Page,
  artifactDir: string,
  logs: string[],
): Promise<string | null> {
  fs.mkdirSync(artifactDir, { recursive: true });
  await closeFeedbackPopupIfPresent(page, logs);

  const downloadButton = page.getByRole("button", { name: /Download PDF/i }).last();
  const downloadLink = page.getByRole("link", { name: /Download PDF/i }).last();
  const downloadControl = await downloadButton.isVisible({ timeout: 5_000 }).catch(() => false)
    ? downloadButton
    : downloadLink;
  if (await downloadControl.isVisible({ timeout: 5_000 }).catch(() => false)) {
    try {
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 20_000 }),
        downloadControl.click({ timeout: 10_000 }),
      ]);
      const filename = download.suggestedFilename() || `sgac-confirmation-official-${Date.now()}.pdf`;
      const filePath = path.join(artifactDir, filename.toLowerCase().endsWith(".pdf")
        ? filename
        : `sgac-confirmation-official-${Date.now()}.pdf`);
      await download.saveAs(filePath);
      if (!looksLikeNonEmptyPdf(filePath)) {
        logs.push(`sgac_confirmation_pdf_download_rejected path=${filePath}`);
        return null;
      }
      logs.push("sgac_confirmation_pdf_downloaded official=true");
      return filePath;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logs.push(`sgac_confirmation_pdf_download_failed ${message}`);
    }
  }

  logs.push("sgac_confirmation_pdf_not_captured official_download_unavailable");
  return null;
}

async function visibleBodySummary(page: Page, limit = 1600): Promise<string> {
  const body = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
  return body.replace(/\s+/g, " ").trim().slice(0, limit);
}

async function clickVisibleRoleButton(page: Page, name: RegExp): Promise<void> {
  const button = page.getByRole("button", { name }).last();
  await button.click({ timeout: 20_000 });
}

function isConfirmationBody(body: string): boolean {
  if (/Security Verification|Enter text here|Try another text/i.test(body)) return false;
  return /Submission\s*(?:is\s*)?(?:Successful|Completed)|Successfully\s*submitted|DE\s*(?:No\.?|Number)|Disembarkation\/Embarkation\s*\(DE\)\s*Number|Acknowledgement\s*(?:No\.?|Number)|Reference\s*(?:No\.?|Number)/i.test(body);
}

function isLikelyCaptchaImageBox(box: { width: number; height: number } | null): boolean {
  if (!box) return false;
  return box.width >= 80 && box.height >= 25;
}

async function captureSecurityCaptchaImage(dialog: ReturnType<Page["locator"]>): Promise<Buffer> {
  const images = dialog.locator("canvas, img");
  const count = await images.count();
  for (let index = 0; index < count; index += 1) {
    const image = images.nth(index);
    if (!(await image.isVisible().catch(() => false))) continue;
    const box = await image.boundingBox().catch(() => null);
    if (!isLikelyCaptchaImageBox(box)) continue;
    return await image.screenshot({ timeout: 10_000 });
  }
  return await dialog.screenshot({ timeout: 10_000 });
}

async function containsLikelyCaptchaImage(dialog: Locator): Promise<boolean> {
  const images = dialog.locator("canvas, img");
  const count = await images.count();
  for (let index = 0; index < count; index += 1) {
    const image = images.nth(index);
    if (!(await image.isVisible().catch(() => false))) continue;
    const box = await image.boundingBox().catch(() => null);
    if (isLikelyCaptchaImageBox(box)) return true;
  }
  return false;
}

async function findVisibleTextInput(scope: Locator): Promise<Locator | null> {
  const inputs = scope.locator("input[type='text'], input:not([type])");
  const count = await inputs.count().catch(() => 0);
  for (let index = count - 1; index >= 0; index -= 1) {
    const input = inputs.nth(index);
    if (await input.isVisible().catch(() => false)) return input;
  }
  return null;
}

interface SecurityVerificationTarget {
  dialog: Locator;
  input: Locator;
}

async function findSecurityVerificationTarget(page: Page): Promise<SecurityVerificationTarget | null> {
  const candidates = page.locator(".modal-content, .modal-dialog, [role='dialog'], body");
  const count = await candidates.count();
  for (let index = count - 1; index >= 0; index -= 1) {
    const candidate = candidates.nth(index);
    if (!(await candidate.isVisible().catch(() => false))) continue;
    const text = await candidate.innerText({ timeout: 1000 }).catch(() => "");
    const hasCaptchaCopy = /Security Verification|Enter text here|Try another text|Incorrect captcha/i.test(text);
    const input = await findVisibleTextInput(candidate);
    const hasCaptchaImage = await containsLikelyCaptchaImage(candidate);
    if ((hasCaptchaCopy || input) && hasCaptchaImage && input) return { dialog: candidate, input };
  }
  return null;
}

async function pageHasSecurityVerificationCopy(page: Page): Promise<boolean> {
  const body = await visibleBodySummary(page, 4000);
  return /Security Verification|Enter text here|Try another text|Incorrect captcha/i.test(body);
}

async function waitForSecurityVerificationTarget(page: Page, timeoutMs: number): Promise<SecurityVerificationTarget | null> {
  const deadline = Date.now() + timeoutMs;
  do {
    const target = await findSecurityVerificationTarget(page);
    if (target) return target;
    await page.waitForTimeout(500);
  } while (Date.now() < deadline);
  return null;
}

async function solveSecurityVerificationIfPresent(
  page: Page,
  artifactDir: string,
  logs: string[],
): Promise<void> {
  const initialTarget = await waitForSecurityVerificationTarget(page, 8_000);
  if (!initialTarget) {
    if (await pageHasSecurityVerificationCopy(page)) {
      const shot = await screenshot(page, artifactDir, "sgac-captcha-dialog-missing");
      throw new SgacPortalError(
        "ICA SGAC showed Security Verification, but the CAPTCHA dialog input was not visible. Please retry; if it repeats, ICA changed the verification widget.",
        {
          code: "sgac_captcha_input_not_visible",
          screenshotPaths: [shot],
          portalSummary: await visibleBodySummary(page),
        },
      );
    }
    return;
  }

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const target = attempt === 1 ? initialTarget : await waitForSecurityVerificationTarget(page, 30_000);
    if (!target) {
      logs.push(`sgac_captcha_dialog_missing attempt=${attempt}`);
      break;
    }
    const { dialog, input: captchaInput } = target;
    await page.waitForTimeout(2_000);
    const captchaBuffer = await captureSecurityCaptchaImage(dialog);
    const solve = await solveImageCaptcha(captchaBuffer, 120_000);
    logs.push(`sgac_captcha_solved attempt=${attempt} solveId=${solve.solveId}`);
    await captchaInput.fill(solve.text.trim());
    await dialog.getByRole("button", { name: /^Submit$/i }).last().click({ timeout: 20_000 });

    await Promise.race([
      page.waitForFunction(
        () => !/Security Verification|Enter text here/i.test(document.body.innerText),
        null,
        { timeout: 20_000 },
      ),
      page.waitForTimeout(20_000),
    ]);
    const body = await visibleBodySummary(page, 4000);
    if (/Incorrect captcha/i.test(body)) {
      logs.push(`sgac_captcha_wrong_answer attempt=${attempt}`);
      await reportBadCaptcha(solve.solveId).catch(() => undefined);
      await screenshot(page, artifactDir, `sgac-captcha-wrong-answer-${attempt}`).catch(() => "");
      const tryAnotherText = dialog.getByText(/Try another text/i).last();
      if (await tryAnotherText.isVisible().catch(() => false)) {
        await tryAnotherText.click().catch(() => undefined);
      } else {
        await clickVisibleRoleButton(page, /^Next$/i).catch(() => undefined);
      }
      await waitForSecurityVerificationTarget(page, 30_000);
      continue;
    }
    if (!/Security Verification|Enter text here/i.test(body)) return;

    logs.push(`sgac_captcha_retry_required attempt=${attempt}`);
    await screenshot(page, artifactDir, `sgac-captcha-retry-${attempt}`).catch(() => "");
    const tryAnotherText = dialog.getByText(/Try another text/i).last();
    if (await tryAnotherText.isVisible().catch(() => false)) {
      await tryAnotherText.click().catch(() => undefined);
    } else {
      await clickVisibleRoleButton(page, /^Next$/i).catch(() => undefined);
    }
  }

  const shot = await screenshot(page, artifactDir, "sgac-captcha-failed");
  throw new SgacPortalError("ICA SGAC security verification CAPTCHA could not be solved.", {
    code: "sgac_captcha_failed",
    screenshotPaths: [shot],
    portalSummary: await visibleBodySummary(page),
  });
}

async function selectNgOption(
  page: Page,
  selector: string,
  query: string,
  expectedText?: string,
  fieldLabel = selector,
): Promise<string> {
  await page.locator(selector).click({ timeout: 20_000 });
  await page.keyboard.press("Control+A").catch(() => undefined);
  await page.keyboard.type(query);
  await page.waitForTimeout(900);
  const desired = expectedText ?? query;
  const options = page.locator(".ng-option");
  const exact = options.filter({ hasText: new RegExp(`^\\s*${escapeRegex(desired)}\\s*$`, "i") }).first();
  const candidate = (await exact.count()) > 0 ? exact : options.filter({ hasText: new RegExp(escapeRegex(desired), "i") }).first();
  try {
    const selected = (await candidate.innerText({ timeout: 10_000 })).trim();
    await candidate.click({ timeout: 10_000 });
    return selected;
  } catch {
    const summary = await visibleBodySummary(page, 1200);
    throw new SgacPortalError(
      `ICA SGAC dropdown option not found for ${fieldLabel}: "${desired}". Please use a value that appears in the official ICA dropdown list.`,
      {
        code: "sgac_dropdown_option_not_found",
        portalSummary: summary,
      },
    );
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function fillIfPresent(page: Page, selector: string, value: string | undefined): Promise<void> {
  if (!value) return;
  const locator = page.locator(selector);
  if ((await locator.count()) > 0) {
    await locator.fill(value);
  }
}

async function fillFirstVisible(page: Page, selectors: string[], value: string | undefined): Promise<boolean> {
  if (!value) return false;
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (!(await candidate.isVisible().catch(() => false))) continue;
      await candidate.fill(value, { timeout: 10_000 });
      return true;
    }
  }
  return false;
}

async function clickIfVisible(page: Page, selector: string): Promise<boolean> {
  const locator = page.locator(selector);
  if ((await locator.count().catch(() => 0)) === 0) return false;
  const first = locator.first();
  if (!(await first.isVisible().catch(() => false))) return false;
  await first.click({ timeout: 10_000 });
  return true;
}

async function clickTransportChoice(page: Page, labels: string[], selectors: string[]): Promise<void> {
  for (const selector of selectors) {
    if (await clickIfVisible(page, selector)) return;
  }
  for (const label of labels) {
    const control = page.getByText(new RegExp(`^\\s*${escapeRegex(label)}\\s*$`, "i")).last();
    if (await control.isVisible().catch(() => false)) {
      await control.click({ timeout: 10_000 });
      return;
    }
  }
}

async function assertNoVisiblePortalErrors(page: Page, artifactDir: string, stage: string): Promise<void> {
  await page.waitForTimeout(800);
  const errors = page.locator(".error, .invalid-feedback, .text-danger, .alert-danger, .mat-error, [role='alert']");
  const errorText: string[] = [];
  for (let i = 0; i < await errors.count(); i += 1) {
    const item = errors.nth(i);
    if (await item.isVisible().catch(() => false)) {
      errorText.push(await item.innerText().catch(() => ""));
    }
  }
  const joined = errorText.map((item) => item.trim()).filter(Boolean).join(" | ");
  if (joined) {
    const shot = await screenshot(page, artifactDir, `sgac-${stage}-portal-error`);
    throw new SgacPortalError(`ICA SGAC portal validation error at ${stage}: ${joined}`, {
      code: "sgac_portal_validation_error",
      screenshotPaths: [shot],
      portalSummary: await visibleBodySummary(page),
    });
  }
}

async function collectVisiblePortalErrors(page: Page): Promise<string> {
  const errors = page.locator(".error, .invalid-feedback, .text-danger, .alert-danger, .mat-error, [role='alert']");
  const errorText: string[] = [];
  const count = await errors.count().catch(() => 0);
  for (let i = 0; i < count; i += 1) {
    const item = errors.nth(i);
    if (await item.isVisible().catch(() => false)) {
      errorText.push(await item.innerText().catch(() => ""));
    }
  }
  return errorText.map((item) => item.trim()).filter(Boolean).join(" | ");
}

async function waitForReviewStep(page: Page, artifactDir: string): Promise<void> {
  await Promise.race([
    page.waitForSelector("#hdc_Submission_Declaration", { state: "visible", timeout: 45_000 }).catch(() => undefined),
    page.waitForFunction(
      () => /Review/i.test(document.body.innerText) && /Declaration|Submit|Previous/i.test(document.body.innerText),
      null,
      { timeout: 45_000 },
    ).catch(() => undefined),
  ]);

  const visibleErrors = await collectVisiblePortalErrors(page);
  const body = await visibleBodySummary(page, 2500);
  if (visibleErrors || /There are missing or erroneous field\(s\)|Please fill in the field above/i.test(body)) {
    const shot = await screenshot(page, artifactDir, "sgac-trip-portal-error");
    throw new SgacPortalError(
      `ICA SGAC portal validation error at trip: ${visibleErrors || body}`,
      {
        code: "sgac_portal_validation_error",
        screenshotPaths: [shot],
        portalSummary: body,
      },
    );
  }

  const declaration = page.locator("#hdc_Submission_Declaration");
  if (await declaration.isVisible().catch(() => false)) return;
  if (/Review/i.test(body)) return;

  const shot = await screenshot(page, artifactDir, "sgac-review-not-reached");
  throw new SgacPortalError("ICA SGAC Review page was not reached after completing Trip Information.", {
    code: "sgac_review_not_reached",
    screenshotPaths: [shot],
    portalSummary: body,
  });
}

async function checkReviewDeclaration(page: Page, artifactDir: string): Promise<void> {
  const selectors = [
    "#hdc_Submission_Declaration",
    "input[type='checkbox'][id*='Declaration' i]",
    "input[type='checkbox'][name*='Declaration' i]",
    "input[type='checkbox']",
    "[role='checkbox']",
  ];
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = count - 1; index >= 0; index -= 1) {
      const candidate = locator.nth(index);
      if (!(await candidate.isVisible().catch(() => false))) continue;
      if (selector === "[role='checkbox']") {
        await candidate.click({ timeout: 10_000 });
      } else {
        await candidate.check({ force: true, timeout: 10_000 });
      }
      return;
    }
  }

  const body = await visibleBodySummary(page, 2500);
  const shot = await screenshot(page, artifactDir, "sgac-review-declaration-missing");
  throw new SgacPortalError("ICA SGAC Review declaration checkbox was not visible.", {
    code: "sgac_review_declaration_not_visible",
    screenshotPaths: [shot],
    portalSummary: body,
  });
}

async function launch(headless: boolean): Promise<Handles> {
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    viewport: { width: 1365, height: 950 },
    locale: "en-SG",
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  return { browser, context, page };
}

async function fillTravellerStep(page: Page, payload: SgacPortalPayload): Promise<void> {
  const fullNameInput = page.locator("#indFullName_0");
  const waitForTravellerForm = async (timeout = 8_000): Promise<boolean> => {
    await fullNameInput.waitFor({ state: "visible", timeout }).catch(() => undefined);
    return fullNameInput.isVisible().catch(() => false);
  };

  if (!(await waitForTravellerForm(10_000))) {
    const submitSgacButton = page.getByRole("button", { name: /Submit SGAC/i }).last();
    if (await submitSgacButton.isVisible().catch(() => false)) {
      await submitSgacButton.click({ timeout: 20_000 });
      await waitForTravellerForm();
    }
  }

  if (!(await fullNameInput.isVisible().catch(() => false))) {
    const foreignVisitorButtons = page.getByRole("button", { name: /Foreign Visitor/i });
    const count = await foreignVisitorButtons.count();
    for (let index = count - 1; index >= 0; index -= 1) {
      const button = foreignVisitorButtons.nth(index);
      if (!(await button.isVisible().catch(() => false))) continue;
      await button.click({ timeout: 20_000 });
      if (await waitForTravellerForm()) break;
    }
  }

  if (!(await fullNameInput.isVisible().catch(() => false))) {
    await page.goto(SGAC_OFFICIAL_PORTAL_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  }
  await fullNameInput.waitFor({ state: "visible", timeout: 40_000 });

  const arrivalButton = page.getByRole("button", { name: new RegExp(escapeRegex(payload.arrivalDate)) }).first();
  await arrivalButton.click({ timeout: 20_000 });
  await page.locator("#indFullName_0").fill(payload.fullName);
  await page.locator("#indTdno_0").fill(payload.passportNumber);
  await page.locator("#indTdExpiry_0").fill(payload.passportExpiryDate);
  await page.locator(`#sex_${payload.sex}_0`).click();
  await page.locator("#indDob_0").fill(payload.dateOfBirth);
  await selectNgOption(page, "#nationality_0", payload.nationalityLabel, payload.nationalityLabel, "Nationality/Citizenship");
  await selectNgOption(page, "#place_of_birth_0", payload.placeOfBirthLabel, payload.placeOfBirthLabel, "Country/Place of Birth");
  await selectNgOption(page, "#residence_city_0", payload.residenceCityQuery, payload.residenceCityQuery, "Place of Residence");
  await page.locator("#email_0").fill(payload.email);
  await page.locator("#ccNo_0").fill(payload.phoneCountryCode);
  await page.locator("#contactNo_0").fill(payload.phoneNumber);
  await page.locator(`#individual_0_sq1_${payload.hasUsedDifferentName ? "Y" : "N"}`).click();
  await page.locator(`#individual_0_qn8_${payload.hasHealthSymptoms ? "Y" : "N"}`).click();
  await page.waitForTimeout(500);
  const yellowFever = page.locator(`#individual_0_qn9_${payload.hasYellowFeverTravelHistory ? "Y" : "N"}`);
  if ((await yellowFever.count()) > 0) await yellowFever.click();
  await clickVisibleRoleButton(page, /^Next$/i);
  await page.waitForSelector("#lastCityCityInput_0", { timeout: 40_000 });
}

async function fillTransport(page: Page, payload: SgacPortalPayload): Promise<void> {
  if (payload.transport.mode === "air") {
    await page.locator("#tptModeTypeInput_0_0").click();
    if (payload.transport.airTransportType === "commercial") {
      await page.locator("#tptTypeInput_0_0").click();
      await selectNgOption(page, "#carrierCodeInput_0", payload.transport.carrierCodeQuery ?? "", payload.transport.carrierCodeQuery, "Airline code");
      await page.locator("#flightNoInput_0").fill(payload.transport.flightNo ?? "");
    } else {
      await page.locator("#tptTypeInput_0_1").click();
      const carrierFlightValue = [payload.transport.carrierName, payload.transport.transportNumber].filter(Boolean).join(" ");
      await fillFirstVisible(
        page,
        [
          "#carrierNameInput_0",
          "#carrierNmInput_0",
          "#flightNoInput_0",
          "input[formcontrolname*='carrier' i]",
          "input[formcontrolname*='flight' i]",
          "input[id*='carrier' i]",
          "input[id*='flight' i]",
        ],
        carrierFlightValue || payload.transport.transportNumber,
      );
    }
    return;
  }
  if (payload.transport.mode === "land") {
    await page.locator("#tptModeTypeInput_0_1").click();
    const landTransportType = payload.transport.landTransportType;
    if (landTransportType) {
      await selectNgOption(
        page,
        "#tptTypeInput_0",
        landTransportType,
        landTransportType,
        "Mode of Transport",
      ).catch(async () => {
        await clickTransportChoice(page, [landTransportType], []);
      });
    }
    await fillIfPresent(page, "#vehicleNoInput_0", payload.transport.transportNumber);
    await fillIfPresent(page, "#carPlateNoInput_0", payload.transport.transportNumber);
    return;
  }
  await page.locator("#tptModeTypeInput_0_2").click();
  const seaType = payload.transport.seaTransportType ?? "cruise";
  if (seaType === "cruise") {
    await clickTransportChoice(page, ["CRUISE"], ["#tptTypeInput_0_0"]);
    await selectNgOption(
      page,
      "#cruiseNameInput_0",
      payload.transport.transportNumber,
      payload.transport.transportNumber,
      "Cruise Name",
    ).catch(async () => {
      await fillIfPresent(page, "#vesselNameInput_0", payload.transport.transportNumber);
    });
    return;
  }
  const seaTypeIndex = seaType === "commercial_vessel" ? "1" : seaType === "ferry" ? "2" : "3";
  await clickTransportChoice(
    page,
    [seaType === "commercial_vessel" ? "COMMERCIAL VESSEL" : seaType === "ferry" ? "FERRY" : "PRIVATE CRAFT"],
    [`#tptTypeInput_0_${seaTypeIndex}`],
  );
  await fillIfPresent(page, "#vesselNameInput_0", payload.transport.transportNumber);
}

async function fillAccommodation(page: Page, payload: SgacPortalPayload): Promise<void> {
  const accommodation = payload.accommodation;
  if (accommodation.type === "hotel") {
    await page.locator("#accoTypeInput_0_0").click();
    await selectNgOption(page, "#hotelNameInput_0", accommodation.hotelNameQuery, accommodation.hotelNameQuery, "Hotel Name");
    return;
  }
  if (accommodation.type === "residential") {
    await page.locator("#accoTypeInput_0_1").click();
    await page.locator("#addrPostalCdInput_0").fill(accommodation.postalCode);
    await page.locator("#addrHouseNoInput_0").fill(accommodation.blockNumber);
    await page.locator("#addrStreetInput_0").fill(accommodation.streetName);
    await fillIfPresent(page, "#addrBldgInput_0", accommodation.buildingName);
    if (accommodation.floorNumber) {
      await page.locator("#addrFloorNoInput_0").fill(accommodation.floorNumber);
    } else if ((await page.locator("#addrFloorNoDisableInput_0").count()) > 0) {
      await page.locator("#addrFloorNoDisableInput_0").click();
    }
    if (accommodation.unitNumber) {
      await page.locator("#addrUnitNoInput_0").fill(accommodation.unitNumber);
    } else if ((await page.locator("#addrUnitNoDisableInput_0").count()) > 0) {
      await page.locator("#addrUnitNoDisableInput_0").click();
    }
    return;
  }
  await page.locator("#accoTypeInput_0_2").click();
  await page.locator(`#accoOthInput_0_${accommodation.otherType === "day_trip" ? "0" : "1"}`).click();
}

async function fillTripStep(page: Page, payload: SgacPortalPayload, artifactDir: string): Promise<void> {
  await selectNgOption(page, "#lastCityCityInput_0", payload.lastCityQuery, payload.lastCityQuery, "Last City/Port of Embarkation Before Singapore");
  await selectNgOption(page, "#purposeOfTravel_0", payload.purposeOfTravelLabel, payload.purposeOfTravelLabel, "Purpose of Travel");
  await fillTransport(page, payload);
  await fillAccommodation(page, payload);
  await page.locator("#eddInput_group_0").fill(payload.departureDate);
  if (payload.nextCityQuery === payload.lastCityQuery && (await page.locator("#copyLastCityInput_0").count()) > 0) {
    await page.locator("#copyLastCityInput_0").click();
  } else {
    await selectNgOption(page, "#nextCityCityInput_0", payload.nextCityQuery, payload.nextCityQuery, "Next City/Port of Disembarkation After Singapore");
  }
  await clickVisibleRoleButton(page, /^Next$/i);
  await waitForReviewStep(page, artifactDir);
}

function extractReferenceNumbers(body: string): { confirmationNumber: string | null; referenceNumber: string | null } {
  const confirmation =
    /(?:DE\s*(?:No\.?|Number)|Disembarkation\/Embarkation\s*\(DE\)\s*Number|Submission\s*(?:No\.?|Number)|Confirmation\s*(?:No\.?|Number))\s*[:：]?\s*([A-Z0-9-]{6,})/i.exec(body)?.[1] ??
    null;
  const reference =
    /(?:Reference\s*(?:No\.?|Number)|Acknowledgement\s*(?:No\.?|Number))\s*[:：]?\s*([A-Z0-9-]{6,})/i.exec(body)?.[1] ??
    confirmation;
  return { confirmationNumber: confirmation, referenceNumber: reference };
}

export async function runSgacPortalSubmission(
  payload: SgacPortalPayload,
  options: RunSgacPortalOptions = {},
): Promise<SgacPortalRunResult> {
  const artifactDir =
    options.artifactDir ?? fs.mkdtempSync(path.join(os.tmpdir(), `viza-sgac-${payload.applicationId}-`));
  const screenshots: string[] = [];
  const logs: string[] = [];
  const headless = options.headless ?? process.env.SGAC_PLAYWRIGHT_HEADLESS !== "false";
  const handles = await launch(headless);

  try {
    const { page } = handles;
    await page.goto(SGAC_OFFICIAL_PORTAL_URL, { waitUntil: "domcontentloaded", timeout: options.timeoutMs ?? 60_000 });
    await fillTravellerStep(page, payload);
    screenshots.push(await screenshot(page, artifactDir, "sgac-trip-step"));
    await fillTripStep(page, payload, artifactDir);
    await assertNoVisiblePortalErrors(page, artifactDir, "trip");
    screenshots.push(await screenshot(page, artifactDir, "sgac-review"));

    if (options.stopBeforeSubmit) {
      return {
        submitted: false,
        status: "stopped_before_submit",
        confirmationNumber: null,
        referenceNumber: null,
        portalUrl: page.url(),
        portalResponseSummary: "ICA SGAC form reached the Review page; final submit was intentionally skipped.",
        screenshots,
        pdfs: [],
        logs,
      };
    }

    await checkReviewDeclaration(page, artifactDir);
    await clickVisibleRoleButton(page, /^Next$/i);
    await solveSecurityVerificationIfPresent(page, artifactDir, logs);
    await Promise.race([
      page.waitForFunction(
        () => /Submission\s*(?:is\s*)?(?:Successful|Completed)|Successfully\s*submitted|DE\s*(?:No\.?|Number)|Disembarkation\/Embarkation\s*\(DE\)\s*Number|Acknowledgement\s*(?:No\.?|Number)|Reference\s*(?:No\.?|Number)/i.test(document.body.innerText) &&
          !/Security Verification|Enter text here|Try another text/i.test(document.body.innerText),
        null,
        { timeout: 90_000 },
      ),
      sleep(90_000),
    ]);
    const body = await visibleBodySummary(page, 4000);
    screenshots.push(await screenshot(page, artifactDir, "sgac-confirmation"));
    if (!isConfirmationBody(body)) {
      throw new SgacPortalError("ICA SGAC final confirmation page was not reached after final submit.", {
        code: "sgac_confirmation_not_reached",
        screenshotPaths: screenshots,
        portalSummary: body,
      });
    }
    const refs = extractReferenceNumbers(body);
    const confirmationPdf = await captureConfirmationPdf(page, artifactDir, logs);
    return {
      submitted: true,
      status: "submitted",
      confirmationNumber: refs.confirmationNumber,
      referenceNumber: refs.referenceNumber,
      portalUrl: page.url(),
      portalResponseSummary: body || "ICA SGAC portal accepted the submission, but no readable summary was captured.",
      screenshots,
      pdfs: confirmationPdf ? [confirmationPdf] : [],
      logs,
    };
  } catch (err) {
    const extraScreenshot = await screenshot(handles.page, artifactDir, "sgac-error").catch(() => null);
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof SgacPortalError) {
      throw new SgacPortalError(message, {
        code: err.code,
        screenshotPaths: [...err.screenshotPaths, ...(extraScreenshot ? [extraScreenshot] : [])],
        portalSummary: err.portalSummary,
      });
    }
    throw new SgacPortalError(message, {
      code: "sgac_portal_runner_error",
      screenshotPaths: extraScreenshot ? [extraScreenshot] : [],
      portalSummary: await visibleBodySummary(handles.page).catch(() => undefined),
    });
  } finally {
    await handles.context.close().catch(() => undefined);
    await handles.browser.close().catch(() => undefined);
  }
}
