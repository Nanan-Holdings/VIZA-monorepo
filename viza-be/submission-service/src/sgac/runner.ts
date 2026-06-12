import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import type { SgacPortalPayload } from "./normalize";

export const SGAC_OFFICIAL_PORTAL_URL = "https://eservices.ica.gov.sg/sgarrivalcard/";

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

async function visibleBodySummary(page: Page, limit = 1600): Promise<string> {
  const body = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
  return body.replace(/\s+/g, " ").trim().slice(0, limit);
}

async function clickVisibleRoleButton(page: Page, name: RegExp): Promise<void> {
  const button = page.getByRole("button", { name }).last();
  await button.click({ timeout: 20_000 });
}

async function selectNgOption(page: Page, selector: string, query: string, expectedText?: string): Promise<string> {
  await page.locator(selector).click({ timeout: 20_000 });
  await page.keyboard.press("Control+A").catch(() => undefined);
  await page.keyboard.type(query);
  await page.waitForTimeout(900);
  const desired = expectedText ?? query;
  const options = page.locator(".ng-option");
  const exact = options.filter({ hasText: new RegExp(`^\\s*${escapeRegex(desired)}\\s*$`, "i") }).first();
  const candidate = (await exact.count()) > 0 ? exact : options.filter({ hasText: new RegExp(escapeRegex(desired), "i") }).first();
  const selected = (await candidate.innerText({ timeout: 10_000 })).trim();
  await candidate.click({ timeout: 10_000 });
  return selected;
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

async function launch(headless: boolean): Promise<Handles> {
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    viewport: { width: 1365, height: 950 },
    locale: "en-SG",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  return { browser, context, page };
}

async function fillTravellerStep(page: Page, payload: SgacPortalPayload): Promise<void> {
  await page.getByRole("button", { name: /Submit SGAC/i }).click();
  await page.getByRole("button", { name: /Foreign Visitor/i }).click();
  await page.waitForSelector("#indFullName_0", { timeout: 40_000 });

  const arrivalButton = page.getByRole("button", { name: new RegExp(escapeRegex(payload.arrivalDate)) }).first();
  await arrivalButton.click({ timeout: 20_000 });
  await page.locator("#indFullName_0").fill(payload.fullName);
  await page.locator("#indTdno_0").fill(payload.passportNumber);
  await page.locator("#indTdExpiry_0").fill(payload.passportExpiryDate);
  await page.locator(`#sex_${payload.sex}_0`).click();
  await page.locator("#indDob_0").fill(payload.dateOfBirth);
  await selectNgOption(page, "#nationality_0", payload.nationalityLabel, payload.nationalityLabel);
  await selectNgOption(page, "#place_of_birth_0", payload.placeOfBirthLabel, payload.placeOfBirthLabel);
  await selectNgOption(page, "#residence_city_0", payload.residenceCityQuery, payload.residenceCityQuery);
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
      await selectNgOption(page, "#carrierCodeInput_0", payload.transport.carrierCodeQuery ?? "", payload.transport.carrierCodeQuery);
      await page.locator("#flightNoInput_0").fill(payload.transport.flightNo ?? "");
    } else {
      await page.locator("#tptTypeInput_0_1").click();
      await fillIfPresent(page, "#flightNoInput_0", payload.transport.transportNumber);
    }
    return;
  }
  if (payload.transport.mode === "land") {
    await page.locator("#tptModeTypeInput_0_1").click();
    await fillIfPresent(page, "#vehicleNoInput_0", payload.transport.transportNumber);
    await fillIfPresent(page, "#carPlateNoInput_0", payload.transport.transportNumber);
    return;
  }
  await page.locator("#tptModeTypeInput_0_2").click();
  await fillIfPresent(page, "#vesselNameInput_0", payload.transport.transportNumber);
}

async function fillAccommodation(page: Page, payload: SgacPortalPayload): Promise<void> {
  const accommodation = payload.accommodation;
  if (accommodation.type === "hotel") {
    await page.locator("#accoTypeInput_0_0").click();
    await selectNgOption(page, "#hotelNameInput_0", accommodation.hotelNameQuery, accommodation.hotelNameQuery);
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

async function fillTripStep(page: Page, payload: SgacPortalPayload): Promise<void> {
  await selectNgOption(page, "#lastCityCityInput_0", payload.lastCityQuery, payload.lastCityQuery);
  await selectNgOption(page, "#purposeOfTravel_0", payload.purposeOfTravelLabel, payload.purposeOfTravelLabel);
  await fillTransport(page, payload);
  await fillAccommodation(page, payload);
  await page.locator("#eddInput_group_0").fill(payload.departureDate);
  if (payload.nextCityQuery === payload.lastCityQuery && (await page.locator("#copyLastCityInput_0").count()) > 0) {
    await page.locator("#copyLastCityInput_0").click();
  } else {
    await selectNgOption(page, "#nextCityCityInput_0", payload.nextCityQuery, payload.nextCityQuery);
  }
  await clickVisibleRoleButton(page, /^Next$/i);
  await page.waitForSelector("#hdc_Submission_Declaration", { timeout: 40_000 });
}

function extractReferenceNumbers(body: string): { confirmationNumber: string | null; referenceNumber: string | null } {
  const confirmation =
    /(?:DE\s*No\.?|Submission\s*(?:No\.?|Number)|Confirmation\s*(?:No\.?|Number))\s*[:：]?\s*([A-Z0-9-]{6,})/i.exec(body)?.[1] ??
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
    await fillTripStep(page, payload);
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
        logs,
      };
    }

    await page.locator("#hdc_Submission_Declaration").check({ force: true });
    await clickVisibleRoleButton(page, /^Next$/i);
    await Promise.race([
      page.waitForSelector("text=/Confirmation|Acknowledgement|Successfully|submitted/i", { timeout: 90_000 }),
      sleep(90_000),
    ]);
    const body = await visibleBodySummary(page, 4000);
    screenshots.push(await screenshot(page, artifactDir, "sgac-confirmation"));
    const refs = extractReferenceNumbers(body);
    return {
      submitted: true,
      status: "submitted",
      confirmationNumber: refs.confirmationNumber,
      referenceNumber: refs.referenceNumber,
      portalUrl: page.url(),
      portalResponseSummary: body || "ICA SGAC portal accepted the submission, but no readable summary was captured.",
      screenshots,
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
