import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { type Page } from "@playwright/test";
import { createArrivalCardBrowserSession } from "../arrival-card-browser";
import { MDAC_OFFICIAL_PORTAL_URL, type MdacPortalPayload } from "./normalize";

export interface MdacPortalSubmissionResult {
  submitted: boolean;
  confirmationNumber?: string | null;
  referenceNumber?: string | null;
  portalUrl: string;
  portalResponseSummary: string;
  screenshots: string[];
  pdfs: string[];
  logs: string[];
}

export class MdacPortalError extends Error {
  readonly screenshotPaths: string[];
  readonly portalSummary?: string;
  readonly code: string;

  constructor(message: string, options: { code: string; screenshotPaths?: string[]; portalSummary?: string }) {
    super(message);
    this.name = "MdacPortalError";
    this.code = options.code;
    this.screenshotPaths = options.screenshotPaths ?? [];
    this.portalSummary = options.portalSummary;
  }
}

async function saveScreenshot(page: Page, name: string, logs: string[]): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "viza-mdac-"));
  const filePath = path.join(dir, `${name}-${Date.now()}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  logs.push(`mdac_screenshot ${filePath}`);
  return filePath;
}

async function installMdacSliderInstrumentation(page: Page): Promise<void> {
  await page.route("**/mdac/js/longbow.slidercaptcha.js", async (route) => {
    const response = await route.fetch();
    const original = await response.text();
    const instrumented = original.replace(
      "return new SliderCaptcha($this, options);",
      "var __vizaSliderInstance = new SliderCaptcha($this, options); window.__vizaMdacSliderCaptcha = __vizaSliderInstance; return __vizaSliderInstance;",
    );
    await route.fulfill({
      response,
      body: instrumented,
    });
  });
}

async function readMdacSliderData(page: Page): Promise<{
  x: number;
  width: number;
  sliderX: number;
  sliderY: number;
  sliderWidth: number;
  sliderHeight: number;
} | null> {
  return page.evaluate(() => {
    const captcha = (window as typeof window & {
      __vizaMdacSliderCaptcha?: {
        x?: number;
        options?: { width?: number };
        slider?: HTMLElement;
        sliderContainer?: HTMLElement;
      };
    }).__vizaMdacSliderCaptcha;
    if (!captcha?.slider || typeof captcha.x !== "number" || typeof captcha.options?.width !== "number") {
      return null;
    }
    const sliderRect = captcha.slider.getBoundingClientRect();
    return {
      x: captcha.x,
      width: captcha.options.width,
      sliderX: sliderRect.x,
      sliderY: sliderRect.y,
      sliderWidth: sliderRect.width,
      sliderHeight: sliderRect.height,
    };
  });
}

async function injectMdacSliderFallback(page: Page, logs: string[]): Promise<void> {
  const response = await fetch("https://imigresen-online.imi.gov.my/mdac/js/longbow.slidercaptcha.js");
  if (!response.ok) {
    logs.push(`mdac_slider_js_fetch_failed ${response.status}`);
    return;
  }
  const original = await response.text();
  const instrumented = original.replace(
    "return new SliderCaptcha($this, options);",
    "var __vizaSliderInstance = new SliderCaptcha($this, options); window.__vizaMdacSliderCaptcha = __vizaSliderInstance; return __vizaSliderInstance;",
  );
  await page.addScriptTag({ content: instrumented });
  await page.addScriptTag({
    content: `
      (function () {
        var target = document.getElementById("captcha");
        if (!target || typeof window.sliderCaptcha !== "function") return;
        target.innerHTML = "";
        window.__vizaMdacSliderCaptcha = window.sliderCaptcha({
          id: "captcha",
          height: 155,
          PI: Math.PI,
          sliderL: 42,
          sliderR: 9,
          offset: 5,
          loadingText: "Loading...",
          failedText: "Try It Again",
          barText: "Slide the Puzzle",
          maxLoadCount: 3,
          remoteUrl: "/mdac/captcha",
          setSrc: function () {
            return "/mdac/images/slider/" + Math.round(Math.random() * 4) + ".jpg";
          },
          onSuccess: function () {
            $("#submit").attr("disabled", false);
            verifyResult = true;
          },
          onFail: function () {
            $("#submit").attr("disabled", true);
            verifyResult = null;
          },
          onRefresh: function () {
            $("#submit").attr("disabled", true);
            verifyResult = null;
          }
        });
      })();
    `,
  });
  await page.waitForTimeout(1_500);
  logs.push("mdac_slider_fallback_injected");
}

async function waitForMdacLanding(page: Page, logs: string[]): Promise<string> {
  await page.waitForLoadState("domcontentloaded", { timeout: 60_000 }).catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch((error) => {
    logs.push(`mdac_networkidle_timeout ${error instanceof Error ? error.message : String(error)}`);
  });
  await page.waitForFunction(
    () => /Malaysia Digital Arrival Card|REGISTRATION|Web Page Blocked/i.test(document.body?.innerText ?? ""),
    undefined,
    { timeout: 30_000 },
  ).catch((error) => {
    logs.push(`mdac_landing_text_wait_timeout ${error instanceof Error ? error.message : String(error)}`);
  });
  await page.waitForTimeout(2_000);
  return page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
}

async function openMdacRegistration(page: Page, logs: string[]): Promise<boolean> {
  const closeDialog = page.locator(".modal-dialog button, [role='dialog'] button", { hasText: /×|close/i }).first();
  if ((await closeDialog.count().catch(() => 0)) > 0) {
    await closeDialog.click({ timeout: 10_000 }).catch((error) => {
      logs.push(`mdac_announcement_close_failed ${error instanceof Error ? error.message : String(error)}`);
    });
    await page.waitForTimeout(1_000);
  }

  const candidates = [
    page.locator("a[href='/mdac/main?registerMain'], a[href*='registerMain']").first(),
    page.getByRole("link", { name: "Register" }).first(),
    page.getByRole("link", { name: /^registration$/i }).first(),
    page.getByRole("button", { name: /^registration$/i }).first(),
    page.locator("a,button", { hasText: /^registration$/i }).first(),
    page.locator("a,button", { hasText: /register|submit|arrival|mdac|apply|new/i }).first(),
  ];

  for (const candidate of candidates) {
    if ((await candidate.count().catch(() => 0)) === 0) continue;
    try {
      await candidate.click({ timeout: 15_000 });
      await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
      await page.waitForTimeout(3_000);
      logs.push("mdac_registration_entry_clicked");
      await clickInnerRegisterIfPresent(page, logs);
      return true;
    } catch (error) {
      logs.push(`mdac_registration_entry_click_failed ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return false;
}

async function clickInnerRegisterIfPresent(page: Page, logs: string[]): Promise<void> {
  const candidates = [
    page.getByRole("link", { name: /^register$/i }).first(),
    page.getByRole("button", { name: /^register$/i }).first(),
    page.locator("a,button", { hasText: /^register$/i }).first(),
  ];

  for (const candidate of candidates) {
    if ((await candidate.count().catch(() => 0)) === 0) continue;
    try {
      await candidate.click({ timeout: 15_000 });
      await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
      await page.waitForTimeout(3_000);
      logs.push("mdac_inner_register_clicked");
      return;
    } catch (error) {
      logs.push(`mdac_inner_register_click_failed ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

function formatDmy(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

function normalizeForMatch(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function officialMdacStateAlias(state: string): string {
  const normalized = normalizeForMatch(state);
  const aliases: Record<string, string> = {
    "WILAYAH PERSEKUTUAN KUALA LUMPUR": "WP KUALA LUMPUR",
    "FEDERAL TERRITORY KUALA LUMPUR": "WP KUALA LUMPUR",
    "KUALA LUMPUR": "WP KUALA LUMPUR",
    "WILAYAH PERSEKUTUAN LABUAN": "WP LABUAN",
    "FEDERAL TERRITORY LABUAN": "WP LABUAN",
    "WILAYAH PERSEKUTUAN PUTRAJAYA": "WP PUTRAJAYA",
    "FEDERAL TERRITORY PUTRAJAYA": "WP PUTRAJAYA",
  };
  return aliases[normalized] ?? state;
}

function mdacAddressLine1(payload: MdacPortalPayload): string {
  const base = payload.addressInMalaysia || payload.accommodationName;
  if (base.trim().split(/\s+/).length >= 3) return base;
  return [base, payload.city, officialMdacStateAlias(payload.state)]
    .filter(Boolean)
    .join(" ")
    .trim();
}

async function fillInput(page: Page, selector: string, value: string, logs: string[]): Promise<void> {
  const input = page.locator(selector).first();
  await input.waitFor({ state: "visible", timeout: 30_000 });
  const isReadonly = await input.evaluate((element) => (element as HTMLInputElement).readOnly).catch(() => false);
  if (isReadonly) {
    await input.evaluate((element, nextValue) => {
      const inputElement = element as HTMLInputElement;
      inputElement.value = nextValue;
      inputElement.dispatchEvent(new Event("input", { bubbles: true }));
      inputElement.dispatchEvent(new Event("change", { bubbles: true }));
      inputElement.dispatchEvent(new Event("blur", { bubbles: true }));
    }, value);
  } else {
    await input.fill(value);
  }
  logs.push(`mdac_filled ${selector}`);
}

async function selectOptionByTextOrValue(
  page: Page,
  selector: string,
  wanted: string,
  logs: string[],
  options: { byDialCode?: boolean } = {},
): Promise<void> {
  const select = page.locator(selector).first();
  await select.waitFor({ state: "visible", timeout: 30_000 });
  const desired = options.byDialCode ? wanted.replace(/\D/g, "") : normalizeForMatch(wanted);
  const match = await select.evaluate(
    (element, args) => {
      const selectElement = element as HTMLSelectElement;
      const candidates = Array.from(selectElement.options);
      const desiredValue = args.desired;
      const option = candidates.find((candidate) => {
        if (!candidate.value) return false;
        if (args.byDialCode) {
          const optionValueDigits = candidate.value.replace(/\D/g, "");
          const optionLabelDigits = (candidate.textContent ?? "").replace(/\D/g, "");
          return optionValueDigits === desiredValue || optionLabelDigits === desiredValue;
        }
        const label = (candidate.textContent ?? "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
        const value = candidate.value.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
        return value === desiredValue || label === desiredValue || label.includes(desiredValue);
      });
      return option ? { value: option.value, label: option.textContent ?? "" } : null;
    },
    { desired, byDialCode: options.byDialCode === true },
  );

  if (!match) {
    const sample = await select.evaluate((element) =>
      Array.from((element as HTMLSelectElement).options)
        .slice(0, 20)
        .map((option) => option.textContent?.trim())
        .filter(Boolean)
        .join(" | "),
    );
    throw new MdacPortalError(`MDAC dropdown option not found for ${selector}: "${wanted}".`, {
      code: "mdac_dropdown_option_not_found",
      portalSummary: sample,
    });
  }

  await select.selectOption(match.value);
  await select.dispatchEvent("change");
  logs.push(`mdac_selected ${selector}=${match.label.trim()}`);
  await page.waitForTimeout(800);
}

async function fillMdacRegistrationForm(page: Page, payload: MdacPortalPayload, logs: string[]): Promise<void> {
  await fillInput(page, "#name", payload.fullName, logs);
  await fillInput(page, "#passNo", payload.passportNumber, logs);
  await fillInput(page, "#dob", formatDmy(payload.dateOfBirth), logs);
  await selectOptionByTextOrValue(page, "#nationality", payload.nationality, logs);
  await selectOptionByTextOrValue(page, "#pob", payload.nationality, logs);
  await selectOptionByTextOrValue(page, "#sex", payload.sex, logs);
  await fillInput(page, "#passExpDte", formatDmy(payload.passportExpiryDate), logs);
  await fillInput(page, "#email", payload.emailAddress, logs);
  await fillInput(page, "#confirmEmail", payload.emailAddress, logs);
  await selectOptionByTextOrValue(page, "#region", payload.mobileCountryCode, logs, { byDialCode: true });
  await fillInput(page, "#mobile", payload.mobileNumber, logs);
  await fillInput(page, "#arrDt", formatDmy(payload.arrivalDate), logs);
  await fillInput(page, "#depDt", formatDmy(payload.departureDate), logs);
  await fillInput(page, "#vesselNm", payload.transportNumber, logs);
  await selectOptionByTextOrValue(page, "#trvlMode", payload.modeOfTravel, logs);
  await selectOptionByTextOrValue(page, "#embark", payload.lastEmbarkationCountry, logs);
  await selectOptionByTextOrValue(page, "#accommodationStay", payload.accommodationType, logs);
  await fillInput(page, "#accommodationAddress1", mdacAddressLine1(payload), logs);
  await fillInput(page, "#accommodationAddress2", payload.accommodationName, logs);
  await selectOptionByTextOrValue(page, "#accommodationState", officialMdacStateAlias(payload.state), logs);
  await fillInput(page, "#accommodationPostcode", payload.postcode, logs);
  await page.waitForTimeout(1_500);
  await selectOptionByTextOrValue(page, "#accommodationCity", payload.city, logs);
}

async function solveMdacSliderCaptcha(page: Page, logs: string[]): Promise<void> {
  await page.locator("#captcha .slider").first().scrollIntoViewIfNeeded({ timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  let sliderData = await readMdacSliderData(page);
  if (!sliderData) {
    await injectMdacSliderFallback(page, logs);
    await page.locator("#captcha .slider").first().scrollIntoViewIfNeeded({ timeout: 10_000 }).catch(() => undefined);
    await page.waitForTimeout(500);
    sliderData = await readMdacSliderData(page);
  }

  if (!sliderData) {
    throw new MdacPortalError("Official Malaysia MDAC slider CAPTCHA is present but could not be inspected.", {
      code: "mdac_slider_captcha_uninspectable",
    });
  }

  const moveX = Math.round((sliderData.x * (sliderData.width - 40)) / (sliderData.width - 60));
  const startX = sliderData.sliderX + sliderData.sliderWidth / 2;
  const startY = sliderData.sliderY + sliderData.sliderHeight / 2;
  const endX = startX + moveX;
  logs.push(`mdac_slider_drag x=${sliderData.x} moveX=${moveX}`);

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  const steps = 18;
  for (let step = 1; step <= steps; step += 1) {
    const progress = step / steps;
    const eased = 1 - Math.pow(1 - progress, 2);
    const jitter = step % 2 === 0 ? 2 : -1;
    await page.mouse.move(startX + moveX * eased, startY + jitter, { steps: 2 });
    await page.waitForTimeout(30 + (step % 3) * 15);
  }
  await page.mouse.move(endX, startY + 1, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(1_500);

  const submitEnabled = await page.locator("#submit").first().isEnabled().catch(() => false);
  if (!submitEnabled) {
    throw new MdacPortalError("Official Malaysia MDAC slider CAPTCHA was not accepted after drag.", {
      code: "mdac_slider_captcha_not_accepted",
    });
  }
}

function extractReference(text: string): string | null {
  const candidates = [
    /(?:reference|ref|application)\s*(?:no\.?|number|id)\s*[:#-]?\s*([A-Z0-9-]{6,})/i,
    /(?:registration)\s*(?:no\.?|number|id)\s*[:#-]?\s*([A-Z0-9-]{6,})/i,
    /\b(MDAC[A-Z0-9-]{6,})\b/i,
  ];
  for (const pattern of candidates) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function isMdacConfirmationText(text: string): boolean {
  return /successfully|submission\s+successful|registration\s+successful|thank\s+you|berjaya/i.test(text);
}

export async function runMdacPortalSubmission(
  payload: MdacPortalPayload,
  options: { headless?: boolean; stopBeforeSubmit?: boolean } = {},
): Promise<MdacPortalSubmissionResult> {
  const logs: string[] = [`mdac_start application=${payload.applicationId}`];
  const screenshots: string[] = [];
  const browserSession = await createArrivalCardBrowserSession({
    prefix: "MDAC",
    headless: options.headless,
  });
  const page = browserSession.page;
  logs.push(`mdac_browser_provider=${browserSession.provider}`);
  logs.push(...browserSession.diagnostics);

  try {
    await installMdacSliderInstrumentation(page);
    await page.goto(MDAC_OFFICIAL_PORTAL_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const bodyText = await waitForMdacLanding(page, logs);
    screenshots.push(await saveScreenshot(page, "landing", logs));

    if (/web page blocked|url you requested has been blocked|attack id/i.test(bodyText)) {
      throw new MdacPortalError(
        "Official Malaysia MDAC portal blocked access from this network before the form could be opened.",
        {
          code: "mdac_official_portal_blocked",
          screenshotPaths: screenshots,
          portalSummary: bodyText.slice(0, 500),
        },
      );
    }

    if (await openMdacRegistration(page, logs)) {
      screenshots.push(await saveScreenshot(page, "after-entry", logs));
    }

    await fillMdacRegistrationForm(page, payload, logs);
    screenshots.push(await saveScreenshot(page, "after-fill", logs));

    const currentText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => bodyText);
    if (options.stopBeforeSubmit) {
      throw new MdacPortalError("MDAC runner stopped before final submit because MDAC_STOP_BEFORE_SUBMIT is enabled.", {
        code: "mdac_stopped_before_submit",
        screenshotPaths: screenshots,
        portalSummary: currentText.slice(0, 500),
      });
    }

    await solveMdacSliderCaptcha(page, logs);
    screenshots.push(await saveScreenshot(page, "after-slider", logs));
    await page.locator("#submit, input[name='submitRegistration'], input[type='submit']").first().click({ timeout: 15_000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(3_000);
    screenshots.push(await saveScreenshot(page, "after-submit", logs));

    const portalText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => currentText);
    if (!isMdacConfirmationText(portalText)) {
      throw new MdacPortalError("Official Malaysia MDAC portal did not return a recognizable confirmation.", {
        code: "mdac_confirmation_not_reached",
        screenshotPaths: screenshots,
        portalSummary: portalText.slice(0, 500),
      });
    }

    return buildMdacSuccessFromPortalText(payload, portalText, page.url(), screenshots, [], logs);
  } finally {
    await browserSession.close();
  }
}

export function buildMdacSuccessFromPortalText(
  payload: MdacPortalPayload,
  portalText: string,
  portalUrl: string,
  screenshots: string[],
  pdfs: string[],
  logs: string[],
): MdacPortalSubmissionResult {
  const referenceNumber = extractReference(portalText);
  return {
    submitted: true,
    confirmationNumber: referenceNumber,
    referenceNumber,
    portalUrl,
    portalResponseSummary: "Malaysia MDAC official portal returned a submission confirmation.",
    screenshots,
    pdfs,
    logs: [`mdac_submitted application=${payload.applicationId}`, ...logs],
  };
}
