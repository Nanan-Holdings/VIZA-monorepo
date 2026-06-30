import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { type CDPSession, type Download, type Page } from "@playwright/test";
import { createArrivalCardBrowserSession } from "../arrival-card-browser";
import { TDAC_OFFICIAL_PORTAL_URL, type TdacPortalPayload } from "./normalize";

export interface TdacPortalSubmissionResult {
  submitted: boolean;
  confirmationNumber?: string | null;
  referenceNumber?: string | null;
  portalUrl: string;
  portalResponseSummary: string;
  screenshots: string[];
  pdfs: string[];
  logs: string[];
}

export class TdacPortalError extends Error {
  readonly screenshotPaths: string[];
  readonly portalSummary?: string;
  readonly code: string;
  readonly logs: string[];

  constructor(message: string, options: { code: string; screenshotPaths?: string[]; portalSummary?: string; logs?: string[] }) {
    super(message);
    this.name = "TdacPortalError";
    this.code = options.code;
    this.screenshotPaths = (options.screenshotPaths ?? []).filter(Boolean);
    this.portalSummary = options.portalSummary;
    this.logs = options.logs ?? [];
  }
}

function isRemoteBrowserPolicyBlock(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /classified as Government and blocked by Bright Data|proxy_error|network-access#residential-proxy-network-policy/i.test(message);
}

async function saveScreenshot(page: Page, name: string, logs: string[]): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "viza-tdac-"));
  const filePath = path.join(dir, `${name}-${Date.now()}.png`);
  try {
    await page.screenshot({ path: filePath, fullPage: true });
    logs.push(`tdac_screenshot ${filePath}`);
    return filePath;
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
    logs.push(`tdac_screenshot_failed ${name} ${message}`);
    return "";
  }
}

async function installTurnstileHook(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as typeof window & {
      turnstile?: { render?: (container: unknown, options?: Record<string, unknown>) => unknown };
      __vizaTurnstileHooked?: boolean;
      __vizaTurnstileParams?: Record<string, unknown>;
      __vizaTurnstileCallback?: (token: string) => void;
    };
    const timer = window.setInterval(() => {
      if (!w.turnstile?.render || w.__vizaTurnstileHooked) return;
      const originalRender = w.turnstile.render.bind(w.turnstile);
      w.turnstile.render = (container: unknown, options: Record<string, unknown> = {}) => {
        w.__vizaTurnstileParams = {
          sitekey: options.sitekey,
          cData: options.cData,
          chlPageData: options.chlPageData,
          action: options.action,
          pageUrl: window.location.href,
          userAgent: navigator.userAgent,
        };
        if (typeof options.callback === "function") {
          w.__vizaTurnstileCallback = options.callback as (token: string) => void;
        }
        return originalRender(container, options);
      };
      w.__vizaTurnstileHooked = true;
      window.clearInterval(timer);
    }, 10);
  });
}

async function arrivalButtonEnabled(page: Page): Promise<boolean> {
  const arrivalButton = page.locator("button", { hasText: /arrival card/i }).first();
  return !(await arrivalButton.isDisabled().catch(() => true));
}

async function waitForArrivalButtonEnabled(page: Page, timeoutMs: number): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await arrivalButtonEnabled(page)) return true;
    await page.waitForTimeout(2_000);
  }
  return arrivalButtonEnabled(page);
}

async function solveWithBrowserApiCaptchaCdp(page: Page, logs: string[], stage: string): Promise<boolean> {
  const hasChallenge = await page
    .locator("input[name='cf-turnstile-response'], textarea[name='cf-turnstile-response'], iframe[src*='challenges.cloudflare.com'], iframe[title*='Cloudflare']")
    .first()
    .count()
    .catch(() => 0);
  if (hasChallenge === 0) {
    logs.push(`tdac_brightdata_captcha_solve_skipped_no_challenge stage=${stage}`);
    return false;
  }

  let session: CDPSession | null = null;
  try {
    logs.push(`tdac_brightdata_captcha_solve_started stage=${stage}`);
    session = await page.context().newCDPSession(page);
    const sendBrightDataCommand = session.send.bind(session) as unknown as (
      method: string,
      params?: Record<string, unknown>,
    ) => Promise<unknown>;
    await sendBrightDataCommand("Captcha.setAutoSolve", { autoSolve: true }).catch(() => undefined);
    const result = await sendBrightDataCommand("Captcha.solve", {
      detectTimeout: 90_000,
      options: [{ type: "cf_turnstile" }, { type: "turnstile" }],
    }).catch(async (solveError) => {
      logs.push(
        `tdac_brightdata_captcha_solve_command_failed stage=${stage} ${
          solveError instanceof Error ? solveError.message.split("\n")[0] : String(solveError)
        }`,
      );
      return sendBrightDataCommand("Captcha.waitForSolve", { detectTimeout: 90_000 });
    });
    const status = typeof result === "object" && result && "status" in result
      ? String((result as { status?: unknown }).status ?? "unknown")
      : "unknown";
    logs.push(`tdac_brightdata_captcha_solve_status stage=${stage} status=${status}`);
    await page.waitForTimeout(5_000);
    return /solve_finished|finished|success|solved/i.test(status) && !/failed|invalid/i.test(status);
  } catch (error) {
    logs.push(`tdac_brightdata_captcha_solve_failed stage=${stage} ${error instanceof Error ? error.message : String(error)}`);
    return false;
  } finally {
    await session?.detach().catch(() => undefined);
  }
}

async function waitForTdacCloudflareClearance(page: Page, logs: string[], timeoutMs: number): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await arrivalButtonEnabled(page)) {
      logs.push("tdac_cloudflare_clearance_button_enabled");
      return true;
    }
    await page.waitForTimeout(2_000);
  }

  const state = await page.evaluate(() => {
    const text = document.body?.innerText?.replace(/\s+/g, " ").slice(0, 240) ?? "";
    const hasChallenge = Boolean(
      document.querySelector("iframe[src*='challenges.cloudflare.com'], input[name='cf-turnstile-response'], textarea[name='cf-turnstile-response']"),
    );
    const hasArrivalButton = Array.from(document.querySelectorAll("button"))
      .some((button) => /Arrival Card/i.test(button.textContent ?? ""));
    return { hasChallenge, hasArrivalButton, text };
  }).catch(() => ({ hasChallenge: true, hasArrivalButton: false, text: "" }));
  logs.push(
    `tdac_cloudflare_clearance_timeout hasChallenge=${state.hasChallenge} hasArrivalButton=${state.hasArrivalButton} text=${state.text}`,
  );
  return false;
}

async function waitForTdacPersonalForm(page: Page, timeoutMs: number): Promise<boolean> {
  const selectors = "input[formcontrolname='familyName'], #mat-input-0";
  return page.locator(selectors).first().waitFor({ state: "visible", timeout: timeoutMs }).then(() => true).catch(() => false);
}

async function waitForTdacLandingUnblocked(page: Page, logs: string[], timeoutMs = 120_000): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const state = await page.evaluate(() => {
      const text = document.body?.innerText?.replace(/\s+/g, " ").trim() ?? "";
      const hasArrivalButton = Array.from(document.querySelectorAll("button"))
        .some((button) => /Arrival Card/i.test(button.textContent ?? "") && !(button as HTMLButtonElement).disabled);
      const hasCloudflareChallenge = Boolean(
        document.querySelector("iframe[src*='challenges.cloudflare.com'], input[name='cf-turnstile-response'], textarea[name='cf-turnstile-response']"),
      );
      const hasCloudflareSuccessOverlay = /Success!\s*CLOUDFLARE|CLOUDFLARE\s*Privacy|验证成功\s*故障排除/i.test(text);
      const hasBusyBackdrop = Boolean(
        document.querySelector(".cdk-overlay-backdrop, .ngx-spinner-overlay, .loading, .spinner, [class*='spinner']"),
      );
      return {
        hasArrivalButton,
        hasCloudflareChallenge,
        hasCloudflareSuccessOverlay,
        hasBusyBackdrop,
        text: text.slice(0, 240),
      };
    }).catch(() => ({
      hasArrivalButton: false,
      hasCloudflareChallenge: true,
      hasCloudflareSuccessOverlay: true,
      hasBusyBackdrop: true,
      text: "",
    }));

    if (
      state.hasArrivalButton
      && !state.hasCloudflareChallenge
      && !state.hasCloudflareSuccessOverlay
      && !state.hasBusyBackdrop
    ) {
      logs.push("tdac_landing_unblocked_ready");
      return true;
    }

    await page.waitForTimeout(1_500);
  }

  logs.push("tdac_landing_unblocked_timeout_continue");
  return false;
}

async function dismissCloudflareSuccessArtifacts(page: Page, logs: string[]): Promise<void> {
  const dismissed = await page.evaluate(() => {
    const bodyText = document.body?.innerText?.replace(/\s+/g, " ") ?? "";
    const hasSolvedWidget = /Success!\s*CLOUDFLARE|CLOUDFLARE\s*Privacy|验证成功\s*故障排除/i.test(bodyText);
    const hasEnabledArrivalButton = Array.from(document.querySelectorAll("button"))
      .some((button) => /Arrival Card/i.test(button.textContent ?? "") && !(button as HTMLButtonElement).disabled);

    if (!hasSolvedWidget || !hasEnabledArrivalButton) {
      return 0;
    }

    let count = 0;
    const selectors = [
      "iframe[src*='challenges.cloudflare.com']",
      "input[name='cf-turnstile-response']",
      "textarea[name='cf-turnstile-response']",
      ".cf-turnstile",
      ".cdk-overlay-backdrop",
      ".ngx-spinner-overlay",
    ];

    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((element) => {
        const removable = element.closest("div") ?? element;
        (removable as HTMLElement).style.setProperty("display", "none", "important");
        (removable as HTMLElement).style.setProperty("pointer-events", "none", "important");
        count += 1;
      });
    }

    document.querySelectorAll("div, iframe").forEach((element) => {
      const rect = element.getBoundingClientRect();
      const text = element.textContent?.replace(/\s+/g, " ") ?? "";
      const style = window.getComputedStyle(element);
      const zIndex = Number.parseInt(style.zIndex || "0", 10);
      const looksLikeSolvedWidget = /Success!\s*CLOUDFLARE|CLOUDFLARE\s*Privacy|验证成功\s*故障排除/i.test(text);
      const coversCenter = rect.width > 200 && rect.height > 50 && rect.left < window.innerWidth / 2 && rect.right > window.innerWidth / 2;
      if (looksLikeSolvedWidget || (coversCenter && zIndex >= 0 && /fixed|absolute/i.test(style.position))) {
        (element as HTMLElement).style.setProperty("display", "none", "important");
        (element as HTMLElement).style.setProperty("pointer-events", "none", "important");
        count += 1;
      }
    });

    document.body.style.removeProperty("overflow");
    document.documentElement.style.removeProperty("overflow");
    return count;
  }).catch(() => 0);

  if (dismissed > 0) {
    logs.push(`tdac_cloudflare_success_artifacts_dismissed=${dismissed}`);
    await page.waitForTimeout(1_000);
  }
}

async function openTdacAddRoute(page: Page, logs: string[], screenshots: string[]): Promise<boolean> {
  const addRoute = "https://tdac.immigration.go.th/arrival-card/#/tac/arrival-card/add";
  const arrivalButton = page.locator("button", { hasText: /arrival card/i }).first();
  const arrivalButtonCount = await arrivalButton.count().catch(() => 0);

  if (arrivalButtonCount > 0 && !(await arrivalButton.isDisabled().catch(() => true))) {
    logs.push("tdac_open_add_route_via_arrival_button");
    await waitForTdacLandingUnblocked(page, logs, 10_000);
    await dismissCloudflareSuccessArtifacts(page, logs);
    await arrivalButton.scrollIntoViewIfNeeded({ timeout: 5_000 }).catch(() => undefined);
    await arrivalButton.click({ timeout: 15_000, force: true }).catch(async (error) => {
      logs.push(`tdac_arrival_button_playwright_click_failed ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
      await arrivalButton.evaluate((button) => {
        (button as HTMLButtonElement).click();
      });
    });
    if (await waitForTdacPersonalForm(page, 60_000)) return true;
    await dismissCloudflareSuccessArtifacts(page, logs);
    if (await waitForTdacPersonalForm(page, 30_000)) return true;
    screenshots.push(await saveScreenshot(page, "after-arrival-button-click-no-form", logs));
  }

  logs.push("tdac_open_add_route_hash_current_page");
  await dismissCloudflareSuccessArtifacts(page, logs);
  await page.evaluate(() => {
    window.location.hash = "/tac/arrival-card/add";
  }).catch((error) => {
    logs.push(`tdac_current_hash_navigation_failed ${error instanceof Error ? error.message : String(error)}`);
  });
  if (await waitForTdacPersonalForm(page, 60_000)) return true;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    logs.push(`tdac_open_add_route_hash_attempt=${attempt}`);
    await page.goto(TDAC_OFFICIAL_PORTAL_URL, { waitUntil: "domcontentloaded", timeout: 90_000 }).catch((error) => {
      logs.push(`tdac_home_reload_before_hash_timeout_continue attempt=${attempt} ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    });
    await page.waitForTimeout(2_000 * attempt);
    await page.evaluate(() => {
      window.location.hash = "/tac/arrival-card/add";
    }).catch((error) => {
      throw new Error(`tdac_hash_navigation_failed: ${error instanceof Error ? error.message : String(error)}`);
    });
    if (await waitForTdacPersonalForm(page, 60_000)) return true;

    logs.push(`tdac_open_add_route_direct_attempt=${attempt}`);
    await page.goto(addRoute, { waitUntil: "domcontentloaded", timeout: 90_000 }).catch((error) => {
      logs.push(`tdac_direct_add_route_timeout_continue attempt=${attempt} ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    });
    if (await waitForTdacPersonalForm(page, 60_000)) return true;
    screenshots.push(await saveScreenshot(page, `after-add-route-attempt-${attempt}`, logs));
  }

  return false;
}

async function clickTurnstileCheckboxIfVisible(page: Page, logs: string[]): Promise<boolean> {
  const candidateFrames = page.locator("iframe[src*='challenges.cloudflare.com'], iframe[title*='Cloudflare']");
  const count = await candidateFrames.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const frameElement = await candidateFrames.nth(index).elementHandle().catch(() => null);
    const frame = await frameElement?.contentFrame().catch(() => null);

    if (frame) {
      const checkbox = frame.locator("input[type='checkbox'], label, [role='checkbox']").first();
      if ((await checkbox.count().catch(() => 0)) > 0) {
        try {
          logs.push(`tdac_turnstile_checkbox_click_attempt frame=${index}`);
          await checkbox.click({ timeout: 10_000 });
          await page.waitForTimeout(7_000);
          await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
          if (await arrivalButtonEnabled(page)) {
            logs.push("tdac_turnstile_checkbox_click_enabled_arrival_button");
            return true;
          }
        } catch (error) {
          logs.push(`tdac_turnstile_checkbox_click_failed ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    const box = await candidateFrames.nth(index).boundingBox().catch(() => null);
    if (!box) continue;
    try {
      logs.push(`tdac_turnstile_iframe_coordinate_click_attempt frame=${index}`);
      await page.mouse.click(box.x + 24, box.y + box.height / 2);
      await page.waitForTimeout(10_000);
      await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
      if (await arrivalButtonEnabled(page)) {
        logs.push("tdac_turnstile_iframe_coordinate_click_enabled_arrival_button");
        return true;
      }
    } catch (error) {
      logs.push(`tdac_turnstile_iframe_coordinate_click_failed ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return false;
}

function extractReference(text: string): string | null {
  const candidates = [
    /TH\s+Digital\s+Arrival\s+Card\s+No\.?\s*[:#-]?\s*([A-Z0-9-]{6,})/i,
    /(?:document|reference|arrival card|application|registration|tdac)\s*(?:code|no\.?|number|id)?\s*[:#-]?\s*([A-Z0-9-]{6,})/i,
    /(?:reference|arrival card|application|registration)\s*(?:no\.?|number|id)?\s*[:#-]?\s*([A-Z0-9-]{6,})/i,
    /\b(TDAC[A-Z0-9-]{6,})\b/i,
  ];
  for (const pattern of candidates) {
    const match = text.match(pattern);
    if (match?.[1] && /\d/.test(match[1])) return match[1].trim();
  }
  return null;
}

function dateParts(isoDate: string): { year: string; month: string; day: string; slashDate: string } {
  const [year, month, day] = isoDate.split("-");
  return {
    year,
    month,
    day,
    slashDate: `${year}/${month}/${day}`,
  };
}

function officialCountryPattern(value: string): RegExp {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return /$a/;
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b|${escaped.replace(/\s+/g, "\\s+")}`, "i");
}

function normalizeTdacDropdownText(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .normalize("NFKD")
    .replace(/[^\p{L}0-9]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tdacDropdownMatchText(target: string, option: string): boolean {
  const normalizedTarget = normalizeTdacDropdownText(target);
  const normalizedOption = normalizeTdacDropdownText(option);
  if (!normalizedTarget || !normalizedOption) return false;
  if (normalizedOption === normalizedTarget) return true;
  if (normalizedOption.includes(normalizedTarget)) return true;
  if (normalizedTarget.includes(normalizedOption)) return true;

  const targetNoSpace = normalizedTarget.replace(/\s+/g, "");
  const optionNoSpace = normalizedOption.replace(/\s+/g, "");
  if (targetNoSpace.length >= 4 && optionNoSpace.includes(targetNoSpace)) return true;

  const targetTokens = normalizedTarget.split(" ").filter(Boolean);
  const optionTokens = new Set(normalizedOption.split(" ").filter(Boolean));
  return targetTokens.every((token) => optionTokens.has(token));
}

function tdacOptionMatches(optionText: RegExp | string, optionValue: string): boolean {
  if (typeof optionText === "string") {
    if (optionValue.includes(optionText)) return true;
    return tdacDropdownMatchText(optionText, optionValue);
  }
  const normalizedOption = normalizeTdacDropdownText(optionValue);
  return optionText.test(optionValue) || optionText.test(normalizedOption);
}

function tdacCountrySearchValue(value: string): string {
  const normalized = value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
  const aliases: Record<string, string> = {
    CHINA: "CHINA",
    "PEOPLE S REPUBLIC OF CHINA": "CHINA",
    KOREA: "REPUBLIC OF KOREA",
    "KOREA REPUBLIC OF": "REPUBLIC OF KOREA",
    "REPUBLIC OF KOREA": "REPUBLIC OF KOREA",
    "SOUTH KOREA": "REPUBLIC OF KOREA",
    "UNITED STATES": "UNITED STATES",
    "UNITED STATES OF AMERICA": "UNITED STATES",
    AMERICA: "UNITED STATES",
    MALAYSIA: "MALAYSIA",
    SINGAPORE: "SINGAPORE",
    THAILAND: "THAILAND",
  };
  const codeMatch = normalized.match(/^[A-Z]{3}\b/);
  return aliases[normalized] ?? codeMatch?.[0] ?? value.toUpperCase();
}

function tdacNationalitySearchValue(value: string): string {
  const normalized = value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
  const aliases: Record<string, string> = {
    CHINA: "CHINESE",
    CHN: "CHINESE",
    "PEOPLE S REPUBLIC OF CHINA": "CHINESE",
    KOREA: "KOREAN",
    "KOREA REPUBLIC OF": "KOREAN",
    "REPUBLIC OF KOREA": "KOREAN",
    "SOUTH KOREA": "KOREAN",
    "UNITED STATES": "AMERICAN",
    "UNITED STATES OF AMERICA": "AMERICAN",
    USA: "AMERICAN",
    AMERICA: "AMERICAN",
    MALAYSIA: "MALAYSIAN",
    SINGAPORE: "SINGAPOREAN",
    THAILAND: "THAI",
  };
  return aliases[normalized] ?? value.toUpperCase();
}

function tdacOfficialOptionSearchValue(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function tdacGenderLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith("f")) return "FEMALE";
  if (normalized.startsWith("m")) return "MALE";
  return "UNDEFINED";
}

function tdacTravelModeLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "land") return "LAND";
  if (normalized === "sea") return "SEA";
  return "AIR";
}

function tdacTransportLabel(value: string): RegExp {
  const normalized = value.trim().toLowerCase();
  const labels: Record<string, RegExp> = {
    commercial_flight: /COMMERCIAL\s+FLIGHT/i,
    private_cargo_airline: /PRIVATE\/CARGO\s+AIRLINE/i,
    car: /^CAR$/i,
    train: /^TRAIN$/i,
    cruise: /^CRUISE$/i,
    commercial_vessel: /COMMERCIAL\s+VESSEL/i,
    others: /OTHERS\s*\(PLEASE\s+SPECIFY\)/i,
  };
  return labels[normalized] ?? new RegExp(normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

function tdacPurposeLabel(value: string): RegExp {
  const normalized = value.trim().toLowerCase();
  const labels: Record<string, RegExp> = {
    holiday: /^(HOLIDAY|TOURISM|VACATION|LEISURE)$/i,
    business: /^BUSINESS$/i,
    education: /^EDUCATION$/i,
    employment: /^EMPLOYMENT$/i,
    meeting: /^MEETING$/i,
    medical: /^MEDICAL$/i,
    return_resident: /RETURN\s+RESIDENT/i,
    transit: /^TRANSIT$/i,
    others: /OTHERS\s*\(PLEASE\s+SPECIFY\)/i,
  };
  return labels[normalized] ?? new RegExp(normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

function tdacAccommodationLabel(value: string): RegExp {
  const normalized = value.trim().toLowerCase();
  const labels: Record<string, RegExp> = {
    hotel: /^HOTEL$/i,
    youth_hostel: /YOUTH\s+HOSTEL/i,
    guest_house: /GUEST\s+HOUSE/i,
    friends_house: /FRIEND'S\s+HOUSE/i,
    apartment: /^APARTMENT$/i,
    others: /OTHERS\s*\(PLEASE\s+SPECIFY\)/i,
  };
  return labels[normalized] ?? new RegExp(normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

async function fillInput(page: Page, selector: string, value: string, logs: string[]): Promise<void> {
  const field = page.locator(selector).first();
  await field.waitFor({ state: "visible", timeout: 30_000 });
  await field.fill(value, { timeout: 15_000 });
  await field.blur().catch(() => undefined);
  logs.push(`tdac_filled ${selector}`);
}

async function firstVisibleSelector(page: Page, selectors: string[], timeoutMs = 30_000): Promise<string> {
  const startedAt = Date.now();
  let diagnostics: string[] = [];
  while (Date.now() - startedAt < timeoutMs) {
    diagnostics = [];
    for (const selector of selectors) {
      const locator = page.locator(selector);
      const count = await locator.count().catch(() => 0);
      let visibleCount = 0;
      for (let index = 0; index < count; index += 1) {
        if (await locator.nth(index).isVisible().catch(() => false)) visibleCount += 1;
      }
      diagnostics.push(`${selector}:count=${count}:visible=${visibleCount}`);
      if (visibleCount > 0) return selector;
    }
    await page.waitForTimeout(250);
  }
  throw new Error(`TDAC visible selector not found. Tried ${diagnostics.join(" | ") || selectors.join(" | ")}`);
}

async function fillInputAny(page: Page, selectors: string[], value: string, logs: string[], label: string): Promise<void> {
  const selector = await firstVisibleSelector(page, selectors);
  await fillInput(page, selector, value, logs);
  logs.push(`tdac_filled_any ${label} selector=${selector}`);
}

async function forceSetInputAny(page: Page, selectors: string[], value: string, logs: string[], label: string): Promise<void> {
  const selector = await firstVisibleSelector(page, selectors);
  await forceSetInput(page, selector, value, logs);
  logs.push(`tdac_force_filled_any ${label} selector=${selector}`);
}

async function forceSetInput(page: Page, selector: string, value: string, logs: string[]): Promise<void> {
  const field = page.locator(selector).first();
  await field.waitFor({ state: "attached", timeout: 30_000 });
  await field.evaluate((element, nextValue) => {
    const input = element as HTMLInputElement | HTMLTextAreaElement;
    input.removeAttribute("disabled");
    input.value = nextValue;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("blur", { bubbles: true }));
  }, value);
  logs.push(`tdac_force_filled ${selector}`);
}

async function fillMaterialDateInput(page: Page, selector: string, value: string, logs: string[]): Promise<void> {
  const field = page.locator(selector).first();
  await field.waitFor({ state: "attached", timeout: 30_000 });
  await field.evaluate((element, nextValue) => {
    const input = element as HTMLInputElement;
    input.removeAttribute("disabled");

    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    valueSetter?.call(input, nextValue);
    input.setAttribute("value", nextValue);

    for (const eventName of ["input", "change", "dateInput", "dateChange", "blur"]) {
      input.dispatchEvent(new Event(eventName, { bubbles: true }));
    }
  }, value);
  await page.waitForTimeout(300);
  logs.push(`tdac_date_filled ${selector}`);
}

async function waitForEnabled(page: Page, selector: string, logs: string[], timeout = 60_000): Promise<void> {
  await page.waitForFunction(
    (targetSelector) => {
      const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(targetSelector);
      return Boolean(input && !input.disabled);
    },
    selector,
    { timeout },
  );
  logs.push(`tdac_enabled ${selector}`);
}

async function waitForMatSelectEnabled(page: Page, selector: string, logs: string[], timeout = 60_000): Promise<void> {
  await page.waitForFunction(
    (targetSelector) => {
      const select = document.querySelector<HTMLElement>(targetSelector);
      return Boolean(select && select.getAttribute("aria-disabled") !== "true");
    },
    selector,
    { timeout },
  );
  logs.push(`tdac_mat_enabled ${selector}`);
}

async function selectAutocomplete(
  page: Page,
  selector: string,
  value: string,
  logs: string[],
  optionText: RegExp | string = value,
): Promise<void> {
  const field = page.locator(selector).first();
  await field.waitFor({ state: "visible", timeout: 30_000 });
  await field.click({ timeout: 10_000 }).catch(() => undefined);
  await field.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => undefined);
  await field.fill(value, { timeout: 15_000 });
  await page.waitForTimeout(800);
  const option = typeof optionText === "string"
    ? page.locator("mat-option, .mat-mdc-option, [role='option']").filter({ hasText: optionText }).first()
    : page.locator("mat-option, .mat-mdc-option, [role='option']").filter({ hasText: optionText }).first();
  if (await option.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await option.click({ timeout: 10_000 });
  } else {
    await field.press("ArrowDown").catch(() => undefined);
    await field.press("Enter").catch(() => undefined);
  }
  await page.waitForTimeout(500);
  logs.push(`tdac_selected ${selector}=${value}`);
}

async function selectAutocompleteAny(
  page: Page,
  selectors: string[],
  value: string,
  logs: string[],
  label: string,
  optionText: RegExp | string = value,
): Promise<void> {
  const selector = await firstVisibleSelector(page, selectors);
  await selectAutocomplete(page, selector, value, logs, optionText);
  logs.push(`tdac_selected_any ${label} selector=${selector}`);
}

async function selectOfficialAutocomplete(
  page: Page,
  selector: string,
  value: string,
  logs: string[],
  label: string,
  optionText: RegExp | string = value,
): Promise<void> {
  const field = page.locator(selector).first();
  await field.waitFor({ state: "visible", timeout: 30_000 });
  await waitForEnabled(page, selector, logs, 30_000).catch(() => {
    throw new TdacPortalError(
      `Official TDAC ${label} field stayed disabled before selecting "${value}". Check the parent official dropdown value first.`,
      {
        code: "tdac_official_dependent_dropdown_disabled",
        portalSummary: `${label}: ${value}`,
      },
    );
  });
  await field.click({ timeout: 10_000 }).catch(() => undefined);
  await field.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => undefined);
  await field.fill("", { timeout: 15_000 }).catch(() => undefined);
  await field.type(value, { delay: 35, timeout: 15_000 });
  await field.press("ArrowDown").catch(() => undefined);
  await page.waitForTimeout(800);
  try {
    await clickVisibleOption(page, optionText, logs, label, 8_000);
  } catch {
    const visibleOptions = await page.locator("mat-option, .mat-mdc-option, [role='option']")
      .evaluateAll((elements) => elements
        .map((element) => element.textContent?.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .slice(0, 12))
      .catch(() => []);
    throw new TdacPortalError(
      `Official TDAC dropdown option not found for ${label}: "${value}". Please use a value from the official TDAC dropdown list.`,
      {
        code: "tdac_official_dropdown_option_not_found",
        portalSummary: `${label}: ${value}; visible options: ${visibleOptions.join(" | ") || "none"}`,
      },
    );
  }
  await page.waitForTimeout(500);
  logs.push(`tdac_selected_official ${selector}=${value}`);
}

async function selectOfficialAutocompleteAny(
  page: Page,
  selectors: string[],
  value: string,
  logs: string[],
  label: string,
  optionText: RegExp | string = value,
): Promise<void> {
  const selector = await firstVisibleSelector(page, selectors);
  await selectOfficialAutocomplete(page, selector, value, logs, label, optionText);
  logs.push(`tdac_selected_official_any ${label} selector=${selector}`);
}

async function clickVisibleOption(
  page: Page,
  optionText: RegExp | string,
  logs: string[],
  label: string,
  timeoutMs = 20_000,
): Promise<void> {
  const startedAt = Date.now();
  const matches = (text: string): boolean => (typeof optionText === "string"
    ? text.includes(optionText)
    : optionText.test(text));
  let visibleOptions: string[] = [];
  while (Date.now() - startedAt < timeoutMs) {
    const options = page.locator("mat-option, .mat-mdc-option, [role='option']");
    const count = await options.count().catch(() => 0);
    visibleOptions = [];
    for (let index = 0; index < count; index += 1) {
      const option = options.nth(index);
      if (!(await option.isVisible().catch(() => false))) continue;
      const text = (await option.innerText().catch(() => "")).replace(/\s+/g, " ").trim();
      if (text) visibleOptions.push(text);
      if (matches(text)) {
        await option.click({ timeout: 10_000 });
        logs.push(`tdac_clicked_visible_option ${label}=${text}`);
        return;
      }
    }
    await page.waitForTimeout(250);
  }
  throw new Error(`TDAC dropdown option not found for ${label}: ${optionText}; visibleOptions=${JSON.stringify(visibleOptions.slice(0, 40))}`);
}

async function selectMatSelect(
  page: Page,
  selector: string,
  optionText: RegExp,
  logs: string[],
): Promise<void> {
  const field = page.locator(selector).first();
  if (!await field.isVisible({ timeout: 10_000 }).catch(() => false)) {
    const controls = await page.evaluate(() => Array.from(document.querySelectorAll("mat-select"))
      .map((element) => ({
        formcontrolname: element.getAttribute("formcontrolname"),
        text: element.textContent?.replace(/\s+/g, " ").trim(),
      })));
    throw new Error(`TDAC mat-select not found: ${selector}; available=${JSON.stringify(controls).slice(0, 1200)}`);
  }
  await waitForMatSelectEnabled(page, selector, logs, 30_000);
  await field.click({ timeout: 15_000 });
  await clickVisibleOption(page, optionText, logs, selector);
  logs.push(`tdac_selected_mat ${selector}`);
}

async function fillVisibleInputNearMatSelect(
  page: Page,
  selector: string,
  value: string,
  logs: string[],
  label: string,
): Promise<void> {
  await page.locator(selector).first().waitFor({ state: "attached", timeout: 10_000 });
  const filled = await page.evaluate(
    ({ targetSelector, nextValue }) => {
      const select = document.querySelector<HTMLElement>(targetSelector);
      if (!select) return false;
      const selectRect = select.getBoundingClientRect();
      const inputs = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea"));
      const candidates = inputs
        .filter((input) => {
          const rect = input.getBoundingClientRect();
          const style = window.getComputedStyle(input);
          const type = input instanceof HTMLInputElement ? input.type : "textarea";
          if (type === "hidden") return false;
          if (input.disabled || input.readOnly) return false;
          if (style.visibility === "hidden" || style.display === "none" || style.pointerEvents === "none") return false;
          if (rect.width <= 0 || rect.height <= 0) return false;
          if (rect.top < selectRect.top - 24 || rect.top > selectRect.bottom + 96) return false;
          if (rect.left < selectRect.left - 8) return false;
          return true;
        })
        .sort((left, right) => {
          const leftRect = left.getBoundingClientRect();
          const rightRect = right.getBoundingClientRect();
          const leftDistance = Math.abs(leftRect.top - selectRect.top) + Math.max(0, leftRect.left - selectRect.right);
          const rightDistance = Math.abs(rightRect.top - selectRect.top) + Math.max(0, rightRect.left - selectRect.right);
          return leftDistance - rightDistance;
        });
      const input = candidates[0];
      if (!input) return false;
      input.focus();
      const setter = input instanceof HTMLInputElement
        ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
        : Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setter?.call(input, nextValue);
      input.setAttribute("value", nextValue);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new Event("blur", { bubbles: true }));
      return true;
    },
    { targetSelector: selector, nextValue: value },
  );
  if (!filled) {
    throw new TdacPortalError(`Official TDAC ${label} "Others" detail field was not available after selecting Others.`, {
      code: "tdac_other_detail_field_not_found",
      portalSummary: `${label}: ${value}`,
    });
  }
  logs.push(`tdac_filled_near_mat_select ${label}`);
}

async function clickRadioByText(page: Page, text: string, logs: string[], occurrence = 0): Promise<void> {
  const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const selectors = [
    "mat-radio-button, .mat-mdc-radio-button",
    ".mat-button-toggle, button, label",
  ];
  for (const selector of selectors) {
    const candidates = page.locator(selector).filter({ hasText: new RegExp(`\\b${escapedText}\\b`, "i") });
    const count = await candidates.count().catch(() => 0);
    let visibleIndex = 0;
    for (let index = 0; index < count; index += 1) {
      const candidate = candidates.nth(index);
      const visible = await candidate.isVisible().catch(() => false);
      if (!visible) continue;
      if (visibleIndex === occurrence) {
        await candidate.scrollIntoViewIfNeeded().catch(() => undefined);
        await candidate.click({ timeout: 10_000 }).catch(async () => {
          await candidate.click({ timeout: 10_000, force: true });
        });
        logs.push(`tdac_radio ${text} occurrence=${occurrence} selector=${selector} candidate=${index}`);
        return;
      }
      visibleIndex += 1;
    }
  }
  throw new Error(`Official TDAC radio option not visible: ${text} occurrence=${occurrence}`);
}

async function checkTransitPassenger(page: Page, logs: string[]): Promise<void> {
  const checkbox = page.locator("mat-checkbox, .mat-mdc-checkbox, label").filter({
    hasText: /transit passenger|don't stay in Thailand/i,
  }).first();
  if (!(await checkbox.isVisible({ timeout: 5_000 }).catch(() => false))) {
    logs.push("tdac_transit_checkbox_not_visible");
    return;
  }
  const checked = await checkbox.getAttribute("aria-checked").then((value) => value === "true").catch(() => false);
  if (!checked) {
    await checkbox.scrollIntoViewIfNeeded().catch(() => undefined);
    const container = page.locator("[sit-validate-input='notStayInTh']").first();
    if (await container.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await container.click({ timeout: 5_000, force: true }).catch(() => undefined);
    }
    const nowChecked = await checkbox.getAttribute("aria-checked").then((value) => value === "true").catch(() => false);
    if (!nowChecked) {
      await checkbox.click({ timeout: 10_000, force: true });
    }
  }
  const finalChecked = await checkbox.getAttribute("aria-checked").then((value) => value === "true").catch(() => false);
  logs.push(`tdac_transit_passenger_checked=${finalChecked}`);
  if (!finalChecked) {
    throw new Error("Official TDAC transit passenger checkbox could not be selected while same-day arrival/departure made accommodation fields unavailable.");
  }
}

async function clickFirstEnabledButton(page: Page, label: RegExp, logs: string[]): Promise<void> {
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
  await page.waitForTimeout(800);
  const buttons = page.locator("button, [role='button'], input[type='button'], input[type='submit']").filter({ hasText: label });
  const count = await buttons.count();
  const diagnostics: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index);
    const text = (await button.innerText().catch(() => "")).replace(/\s+/g, " ").trim();
    const visible = await button.isVisible().catch(() => false);
    const disabled = await button.isDisabled().catch(() => true);
    diagnostics.push(`${index}:${visible ? "visible" : "hidden"}:${disabled ? "disabled" : "enabled"}:${text}`);
    if (visible && !disabled) {
      await button.scrollIntoViewIfNeeded().catch(() => undefined);
      await button.click({ timeout: 15_000 });
      logs.push(`tdac_clicked_button ${label} index=${index}`);
      return;
    }
  }
  const textButton = page.getByText(label).last();
  if (await textButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await textButton.scrollIntoViewIfNeeded().catch(() => undefined);
    await textButton.click({ timeout: 15_000 });
    logs.push(`tdac_clicked_text_button ${label}`);
    return;
  }
  const fallbackText = label.test("Preview") ? "Preview" : label.test("Submit") ? "Submit" : "Continue";
  const xpathText = page.locator(`xpath=//*[normalize-space()='${fallbackText}']`).last();
  if (await xpathText.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await xpathText.scrollIntoViewIfNeeded().catch(() => undefined);
    const box = await xpathText.boundingBox().catch(() => null);
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      logs.push(`tdac_clicked_xpath_text ${label}`);
      return;
    }
  }
  const clickedByDom = await page.evaluate((expected) => {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>("*"))
      .filter((element) => element.textContent?.trim() === expected)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      });
    const target = candidates.at(-1);
    target?.scrollIntoView({ block: "center", inline: "center" });
    target?.click();
    return Boolean(target);
  }, fallbackText);
  if (clickedByDom) {
    logs.push(`tdac_clicked_dom_text ${label}`);
    return;
  }
  const body = (await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "")).replace(/\s+/g, " ").trim();
  throw new Error(
    `TDAC button not available: ${label}; buttons=${diagnostics.join(" | ") || "none"}; body=${body.slice(0, 700)}`,
  );
}

async function clickButtonIfVisible(page: Page, label: RegExp, logs: string[], timeoutMs = 8_000): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const buttonGroups = [
      page.locator(".cdk-overlay-container button, .cdk-overlay-container [role='button']"),
      page.locator("button, [role='button'], input[type='button'], input[type='submit']"),
    ];
    for (const buttons of buttonGroups) {
      const count = await buttons.count().catch(() => 0);
      for (let index = 0; index < count; index += 1) {
        const button = buttons.nth(index);
        const text = ((await button.innerText({ timeout: 500 }).catch(() => ""))
          || (await button.getAttribute("value").catch(() => ""))
          || "").replace(/\s+/g, " ").trim();
        const visible = await button.isVisible().catch(() => false);
        const disabled = await button.isDisabled().catch(() => true);
        if (visible && !disabled && label.test(text)) {
          await button.scrollIntoViewIfNeeded().catch(() => undefined);
          await button.click({ timeout: 5_000 }).catch(async () => {
            await button.click({ timeout: 5_000, force: true });
          });
          logs.push(`tdac_optional_button_clicked text=${text}`);
          return true;
        }
      }
    }
    await page.waitForTimeout(250);
  }
  return false;
}

interface TdacOfficialInvalidField {
  label: string;
  message: string;
}

async function getTdacOfficialInvalidFields(page: Page): Promise<TdacOfficialInvalidField[]> {
  await page.evaluate("globalThis.__name = globalThis.__name || ((fn) => fn)").catch(() => undefined);
  return page.evaluate(() => {
    const compact = (value: string | null | undefined): string => (value ?? "").replace(/\s+/g, " ").trim();
    const isVisible = (element: Element): boolean => {
      const htmlElement = element as HTMLElement;
      const rect = htmlElement.getBoundingClientRect();
      const style = window.getComputedStyle(htmlElement);
      return rect.width > 0
        && rect.height > 0
        && style.display !== "none"
        && style.visibility !== "hidden"
        && style.opacity !== "0";
    };
    const labelFor = (element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string => {
      const explicitId = element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`) : null;
      const container = element.closest(".mat-mdc-form-field, .mat-form-field, .row, .form-group, div");
      const candidate = compact([
        element.getAttribute("aria-label"),
        element.getAttribute("placeholder"),
        explicitId?.textContent,
        container?.querySelector("label, mat-label, .mat-mdc-form-field-label")?.textContent,
        element.getAttribute("formcontrolname"),
        element.getAttribute("name"),
        element.id,
      ].find((value) => compact(value)));
      return candidate || "Unknown TDAC field";
    };

    const invalidControls = Array.from(document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      "input, select, textarea",
    ))
      .filter((element) => {
        const type = element instanceof HTMLInputElement ? element.type : "";
        return type !== "hidden" && !element.disabled && isVisible(element);
      })
      .filter((element) => {
        try {
          return typeof element.checkValidity === "function" && !element.checkValidity();
        } catch {
          return false;
        }
      })
      .map((element) => ({
        label: labelFor(element),
        message: compact(element.validationMessage) || "Invalid or missing value",
      }));

    const errorTexts = Array.from(document.querySelectorAll<HTMLElement>(
      "mat-error, .mat-mdc-form-field-error, .invalid-feedback, .text-danger, .error-message, [class*='error']",
    ))
      .filter(isVisible)
      .map((element) => compact(element.textContent))
      .filter((text) => text && !/cloudflare|debug|stack/i.test(text))
      .slice(0, 12)
      .map((text) => ({ label: "Official TDAC message", message: text }));

    const seen = new Set<string>();
    return [...invalidControls, ...errorTexts].filter((entry) => {
      const key = `${entry.label}:${entry.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 20);
  });
}

async function assertTdacOfficialFormValid(
  page: Page,
  screenshots: string[],
  logs: string[],
  stage: string,
): Promise<void> {
  const invalidFields = await getTdacOfficialInvalidFields(page);
  if (invalidFields.length === 0) {
    logs.push(`tdac_official_form_valid stage=${stage}`);
    return;
  }
  screenshots.push(await saveScreenshot(page, `official-invalid-${stage}`, logs));
  const summary = invalidFields.map((field) => `${field.label}: ${field.message}`).join(" | ");
  throw new TdacPortalError(`Official TDAC form validation failed before ${stage}: ${summary}`, {
    code: "tdac_official_form_validation_failed",
    screenshotPaths: screenshots,
    portalSummary: summary,
  });
}

async function waitForTdacSubmissionOutcome(page: Page, screenshots: string[], logs: string[]): Promise<string> {
  const startedAt = Date.now();
  let latestText = "";
  while (Date.now() - startedAt < 120_000) {
    await page.waitForLoadState("domcontentloaded", { timeout: 5_000 }).catch(() => undefined);
    latestText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => latestText);
    const normalized = latestText.replace(/\s+/g, " ").trim();
    const stillOnPreview = /Please verify the accuracy of all information before submitting the form/i.test(normalized);
    const successLike = /successfully|submitted|submission complete|arrival card (?:no|number)|tdac (?:no|number)|document code|download pdf|print/i.test(normalized);
    const errorLike = /unsuccessful|failed|error|required|invalid|try again|not found|cannot|unable/i.test(normalized);

    if (successLike && !stillOnPreview) {
      screenshots.push(await saveScreenshot(page, "after-submit-success", logs));
      return normalized;
    }

    if (errorLike && !stillOnPreview) {
      screenshots.push(await saveScreenshot(page, "after-submit-error", logs));
      const invalidFields = await getTdacOfficialInvalidFields(page);
      const invalidSummary = invalidFields.map((field) => `${field.label}: ${field.message}`).join(" | ");
      throw new TdacPortalError(invalidSummary
        ? `Official TDAC portal returned validation errors after final submit: ${invalidSummary}`
        : "Official TDAC portal returned an error after final submit.", {
        code: "tdac_official_submit_error",
        screenshotPaths: screenshots,
        portalSummary: (invalidSummary || normalized).slice(0, 1_000),
      });
    }

    await page.waitForTimeout(2_000);
  }

  screenshots.push(await saveScreenshot(page, "after-submit-timeout", logs));
  const invalidFields = await getTdacOfficialInvalidFields(page);
  if (invalidFields.length > 0) {
    const summary = invalidFields.map((field) => `${field.label}: ${field.message}`).join(" | ");
    throw new TdacPortalError(`Official TDAC form validation failed after final submit: ${summary}`, {
      code: "tdac_official_form_validation_failed",
      screenshotPaths: screenshots,
      portalSummary: summary,
    });
  }
  throw new TdacPortalError("Official TDAC final confirmation page was not reached after final submit.", {
    code: "tdac_final_confirmation_not_reached",
    screenshotPaths: screenshots,
    portalSummary: latestText.replace(/\s+/g, " ").trim().slice(0, 1_000),
  });
}

async function downloadTdacPdfIfAvailable(page: Page, logs: string[]): Promise<string[]> {
  const pdfs: string[] = [];
  const makeFilePath = (fileName: string): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "viza-tdac-pdf-"));
    return path.join(dir, fileName.replace(/[<>:"/\\|?*]+/g, "-"));
  };

  const saveConfirmationPagePdf = async (): Promise<string | null> => {
    const filePath = makeFilePath(`tdac-confirmation-page-${Date.now()}.pdf`);
    try {
      await page.pdf({
        path: filePath,
        format: "A4",
        printBackground: true,
      });
      const stat = await fs.promises.stat(filePath);
      if (stat.size < 10_000) {
        logs.push(`tdac_confirmation_page_pdf_too_small bytes=${stat.size}`);
        return null;
      }
      logs.push(`tdac_confirmation_page_pdf_saved ${filePath} bytes=${stat.size}`);
      return filePath;
    } catch (error) {
      logs.push(`tdac_confirmation_page_pdf_failed ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
      return null;
    }
  };

  const saveDownload = async (download: Download | null): Promise<string | null> => {
    if (!download) return null;
    const suggested = download.suggestedFilename() || `tdac-confirmation-${Date.now()}.pdf`;
    const safeName = suggested.toLowerCase().endsWith(".pdf") ? suggested : `${suggested}.pdf`;
    const filePath = makeFilePath(safeName);
    try {
      await download.saveAs(filePath);
      logs.push(`tdac_pdf_downloaded ${filePath}`);
      return filePath;
    } catch (error) {
      logs.push(`tdac_pdf_saveas_failed ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    }
    try {
      const downloadedPath = await download.path().catch(() => null);
      if (!downloadedPath) return null;
      await fs.promises.copyFile(downloadedPath, filePath);
      logs.push(`tdac_pdf_downloaded ${filePath}`);
      return filePath;
    } catch (error) {
      logs.push(`tdac_pdf_copy_failed ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    }
    return null;
  };

  const trigger = page.locator("a, button", { hasText: /download|pdf|print/i }).first();
  if (!(await trigger.isVisible({ timeout: 5_000 }).catch(() => false))) {
    logs.push("tdac_pdf_download_not_visible");
    return pdfs;
  }

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 10_000 }).catch(() => null),
    trigger.click({ timeout: 5_000 }).catch((error) => {
      logs.push(`tdac_pdf_download_click_failed ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    }),
  ]);
  if (!download) {
    logs.push("tdac_pdf_download_not_started_after_primary_click");
  } else {
    const savedPath = await saveDownload(download);
    if (savedPath) pdfs.push(savedPath);
    if (savedPath) return pdfs;
  }

  const modalDownloadPromise = page.waitForEvent("download", { timeout: 15_000 }).catch(() => null);
  if (await clickButtonIfVisible(page, /^Download$/i, logs, 10_000)) {
    const modalDownload = await modalDownloadPromise;
    if (modalDownload) {
      const savedPath = await saveDownload(modalDownload);
      if (savedPath) pdfs.push(savedPath);
    }
  }
  if (pdfs.length === 0) {
    const fallbackPath = await saveConfirmationPagePdf();
    if (fallbackPath) pdfs.push(fallbackPath);
  }
  if (pdfs.length === 0) logs.push("tdac_pdf_download_unavailable_after_success");
  return pdfs;
}

async function prepareTdacFinalSubmit(page: Page, payload: TdacPortalPayload, logs: string[]): Promise<void> {
  const emailInput = page.locator("input[type='email'], input[placeholder*='@'], input[placeholder*='EXAMPLE']").last();
  await emailInput.waitFor({ state: "visible", timeout: 20_000 });
  await emailInput.fill(payload.emailAddress, { timeout: 10_000 });
  logs.push("tdac_final_email_filled");

  const termsCheckbox = page.locator("mat-checkbox, .mat-mdc-checkbox, input[type='checkbox']").last();
  await termsCheckbox.scrollIntoViewIfNeeded().catch(() => undefined);
  await termsCheckbox.click({ timeout: 10_000, force: true });
  await clickButtonIfVisible(page, /^Agree$/i, logs, 10_000);
  logs.push("tdac_final_terms_checked");
  await page.waitForTimeout(1_000);
}

async function fillTdacPersonalStep(
  page: Page,
  payload: TdacPortalPayload,
  screenshots: string[],
  logs: string[],
): Promise<void> {
  const dob = dateParts(payload.dateOfBirth);
  await fillInputAny(page, ["input[formcontrolname='familyName']", "#mat-input-0"], payload.familyName.toUpperCase(), logs, "family_name");
  await fillInputAny(page, ["input[formcontrolname='firstName']", "#mat-input-1"], payload.firstName.toUpperCase(), logs, "first_name");
  await fillInputAny(page, ["input[formcontrolname='middleName']", "#mat-input-2"], (payload.middleName || "").toUpperCase(), logs, "middle_name");
  await fillInputAny(page, ["input[formcontrolname='passportNo']", "input[formcontrolname='passportNumber']", "#mat-input-3"], payload.passportNumber.toUpperCase(), logs, "passport_number");
  const nationalitySearch = tdacNationalitySearchValue(payload.nationality);
  await selectOfficialAutocompleteAny(page, ["input[formcontrolname='nationality']", "#mat-input-25"], nationalitySearch, logs, "nationality", officialCountryPattern(nationalitySearch));
  await selectAutocompleteAny(page, ["input[formcontrolname='birthYear']", "#mat-input-18"], dob.year, logs, "birth_year");
  await selectAutocompleteAny(page, ["input[formcontrolname='birthMonth']", "#mat-input-19"], dob.month, logs, "birth_month");
  await selectAutocompleteAny(page, ["input[formcontrolname='birthDay']", "#mat-input-20"], dob.day, logs, "birth_day");
  await fillInputAny(page, ["input[formcontrolname='occupation']", "#mat-input-4"], payload.occupation.toUpperCase(), logs, "occupation");
  await clickRadioByText(page, tdacGenderLabel(payload.gender), logs);
  if (payload.visaNumber) {
    await fillInputAny(page, ["input[formcontrolname='visaNo']", "input[formcontrolname='visaNumber']", "#mat-input-5"], payload.visaNumber.toUpperCase(), logs, "visa_number");
  }
  const residenceCountrySearch = tdacCountrySearchValue(payload.residenceCountry);
  await selectOfficialAutocompleteAny(page, ["input[formcontrolname='countryOfResidence']", "input[formcontrolname='residenceCountry']", "#mat-input-26"], residenceCountrySearch, logs, "residence_country", officialCountryPattern(residenceCountrySearch));
  const residenceRegionSearch = tdacOfficialOptionSearchValue(payload.residenceCity);
  await selectOfficialAutocompleteAny(
    page,
    ["input[formcontrolname='cityStateOfResidence']", "input[formcontrolname='residenceCity']", "#mat-input-27"],
    residenceRegionSearch,
    logs,
    "residence_city",
    new RegExp(residenceRegionSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
  );
  await fillInputAny(page, ["input[formcontrolname='telCode']", "input[formcontrolname='phoneCountryCode']", "#mat-input-6"], payload.phoneCountryCode.replace(/\D/g, ""), logs, "phone_country_code");
  await fillInputAny(page, ["input[formcontrolname='telNo']", "input[formcontrolname='phoneNumber']", "#mat-input-7"], payload.phoneNumber.replace(/\D/g, ""), logs, "phone_number");
  await assertTdacOfficialFormValid(page, screenshots, logs, "personal-continue");
  await saveScreenshot(page, "personal-before-continue", logs);
  await clickFirstEnabledButton(page, /^Continue$/i, logs);
}

async function fillTdacTripStep(
  page: Page,
  payload: TdacPortalPayload,
  screenshots: string[],
  logs: string[],
): Promise<void> {
  const arrival = dateParts(payload.arrivalDate);
  const departure = dateParts(payload.departureDate);
  await page.waitForTimeout(2_000);
  await fillMaterialDateInput(page, "input[formcontrolname='arrDate']", arrival.slashDate, logs);
  const countryBoardedSearch = tdacCountrySearchValue(payload.countryBoarded);
  await selectOfficialAutocompleteAny(page, ["input[formcontrolname='countryBoarded']", "input[formcontrolname='countryTerritoryBoarded']", "#mat-input-28"], countryBoardedSearch, logs, "country_boarded", officialCountryPattern(countryBoardedSearch));
  await selectMatSelect(page, "mat-select[formcontrolname='traPurposeId']", tdacPurposeLabel(payload.purposeOfTravel), logs);
  if (payload.purposeOfTravel === "others" && payload.purposeOfTravelOther) {
    await fillVisibleInputNearMatSelect(
      page,
      "mat-select[formcontrolname='traPurposeId']",
      payload.purposeOfTravelOther.toUpperCase(),
      logs,
      "purpose_of_travel_other",
    );
  }
  await clickRadioByText(page, tdacTravelModeLabel(payload.arrivalModeOfTravel), logs, 0);
  await selectMatSelect(page, "mat-select[formcontrolname='tranModeId']", tdacTransportLabel(payload.arrivalModeOfTransport), logs);
  if (payload.arrivalModeOfTransport === "others" && payload.arrivalTransportOther) {
    await fillVisibleInputNearMatSelect(
      page,
      "mat-select[formcontrolname='tranModeId']",
      payload.arrivalTransportOther.toUpperCase(),
      logs,
      "arrival_transport_other",
    );
  }
  await fillInputAny(page, ["input[formcontrolname='arrFlightNo']", "input[formcontrolname='arrVehicleNo']", "input[formcontrolname='arrivalTransportNo']", "#mat-input-11"], payload.arrivalTransportNumber.toUpperCase(), logs, "arrival_transport_number");
  if (payload.isTransitTraveler) {
    await checkTransitPassenger(page, logs);
  }
  await fillMaterialDateInput(page, "input[formcontrolname='deptDate']", departure.slashDate, logs);
  await clickRadioByText(page, tdacTravelModeLabel(payload.departureModeOfTravel), logs, 1);
  await selectMatSelect(page, "mat-select[formcontrolname='deptTranModeId']", tdacTransportLabel(payload.departureModeOfTransport), logs);
  if (payload.departureModeOfTransport === "others" && payload.departureTransportOther) {
    await fillVisibleInputNearMatSelect(
      page,
      "mat-select[formcontrolname='deptTranModeId']",
      payload.departureTransportOther.toUpperCase(),
      logs,
      "departure_transport_other",
    );
  }
  await fillInputAny(page, ["input[formcontrolname='deptFlightNo']", "input[formcontrolname='deptVehicleNo']", "input[formcontrolname='departureTransportNo']", "#mat-input-14"], payload.departureTransportNumber.toUpperCase(), logs, "departure_transport_number");
  await page.keyboard.press("Tab").catch(() => undefined);
  await page.locator("mat-select[formcontrolname='accTypeId']").first().scrollIntoViewIfNeeded().catch(() => undefined);
  await saveScreenshot(page, "trip-before-accommodation", logs);
  const accommodationEnabled = await waitForMatSelectEnabled(page, "mat-select[formcontrolname='accTypeId']", logs, 30_000)
    .then(() => true)
    .catch(() => false);
  if (accommodationEnabled && !payload.isTransitTraveler) {
    const province = tdacOfficialOptionSearchValue(payload.province || "");
    const district = tdacOfficialOptionSearchValue(payload.district || "");
    const subDistrict = tdacOfficialOptionSearchValue(payload.subDistrict || "");
    const postalCode = payload.postalCode || "";
    await selectMatSelect(page, "mat-select[formcontrolname='accTypeId']", tdacAccommodationLabel(payload.accommodationType || "hotel"), logs);
    if (payload.accommodationType === "others" && payload.accommodationTypeOther) {
      await fillVisibleInputNearMatSelect(
        page,
        "mat-select[formcontrolname='accTypeId']",
        payload.accommodationTypeOther.toUpperCase(),
        logs,
        "accommodation_type_other",
      );
    }
    await selectOfficialAutocompleteAny(page, ["input[formcontrolname='province']", "#mat-input-29"], province, logs, "Province", new RegExp(province.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    if (district) {
      await selectOfficialAutocompleteAny(page, ["input[formcontrolname='district']", "input[formcontrolname='area']", "#mat-input-30"], district, logs, "District", new RegExp(district.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    }
    if (subDistrict) {
      await selectOfficialAutocompleteAny(page, ["input[formcontrolname='subDistrict']", "input[formcontrolname='subArea']", "#mat-input-31"], subDistrict, logs, "Subdistrict", new RegExp(subDistrict.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    }
    if (postalCode) {
      await forceSetInputAny(page, ["input[formcontrolname='postCode']", "input[formcontrolname='postalCode']", "#mat-input-16"], postalCode, logs, "postal_code");
    }
    await forceSetInputAny(page, ["textarea[formcontrolname='address']", "input[formcontrolname='address']", "#mat-input-17"], payload.addressInThailand || "", logs, "address_in_thailand");
  } else if (payload.isTransitTraveler) {
    logs.push("tdac_same_day_transit_skip_accommodation");
  } else {
    screenshots.push(await saveScreenshot(page, "accommodation-section-unavailable", logs));
    throw new TdacPortalError(
      "Official TDAC accommodation section was not available for a non-transit traveller after trip details were filled.",
      {
        code: "tdac_accommodation_section_unavailable",
        screenshotPaths: screenshots,
        portalSummary: "Non-transit TDAC submissions require accommodation_type, address_in_thailand, and province.",
      },
    );
  }
  await assertTdacOfficialFormValid(page, screenshots, logs, "trip-continue");
  await clickFirstEnabledButton(page, /^Continue$/i, logs);
}

async function fillTdacHealthStep(page: Page, payload: TdacPortalPayload, logs: string[]): Promise<void> {
  await page.waitForTimeout(1_000);
  for (const country of payload.countriesVisitedLast14Days) {
    const countrySearch = tdacCountrySearchValue(country);
    await selectAutocompleteAny(page, ["input[matchipinputfor]", "#mat-mdc-chip-list-input-0"], countrySearch, logs, "countries_visited_last_14_days", officialCountryPattern(countrySearch));
  }
  await clickFirstEnabledButton(page, /^Preview$/i, logs);
}

export async function runTdacPortalSubmission(
  payload: TdacPortalPayload,
  options: { headless?: boolean; stopBeforeSubmit?: boolean } = {},
): Promise<TdacPortalSubmissionResult> {
  const logs: string[] = [`tdac_start application=${payload.applicationId}`];
  const screenshots: string[] = [];
  let browserSession = await createArrivalCardBrowserSession({
    prefix: "TDAC",
    headless: options.headless,
  });
  let page = browserSession.page;
  logs.push(`tdac_browser_provider=${browserSession.provider}`);
  logs.push(...browserSession.diagnostics);

  try {
    const prepareBrowserPage = async () => {
      if (!browserSession.nativeCloudflareUnblock) {
        await installTurnstileHook(page);
      } else {
        logs.push("tdac_brightdata_native_cloudflare_unblock_enabled");
      }
    };
    const gotoOfficialPortal = async (): Promise<boolean> => {
      let policyBlocked = false;
      await page.goto(TDAC_OFFICIAL_PORTAL_URL, { waitUntil: "domcontentloaded", timeout: 120_000 }).catch((error) => {
        if (isRemoteBrowserPolicyBlock(error)) {
          policyBlocked = true;
          logs.push("tdac_remote_browser_api_policy_blocked");
          return;
        }
        logs.push(`tdac_goto_domcontentloaded_timeout_continue ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
      });
      return policyBlocked;
    };

    await prepareBrowserPage();
    let policyBlocked = await gotoOfficialPortal();
    if (policyBlocked && browserSession.provider === "remote-browser-api") {
      await page.waitForTimeout(5_000);
      const loadedDespiteGotoError = await page.locator("button", { hasText: /arrival card/i }).first().count().then((count) => count > 0).catch(() => false);
      if (loadedDespiteGotoError) {
        logs.push("tdac_remote_browser_api_policy_blocked_but_landing_loaded");
        policyBlocked = false;
      }
    }
    for (let retry = 1; policyBlocked && browserSession.provider === "remote-browser-api" && retry <= 2; retry += 1) {
      screenshots.push(await saveScreenshot(page, `browser-api-policy-blocked-retry-${retry}`, logs));
      await browserSession.close().catch(() => undefined);
      logs.push(`tdac_remote_browser_api_policy_blocked_retry_browser_api attempt=${retry}`);
      browserSession = await createArrivalCardBrowserSession({
        prefix: "TDAC",
        headless: options.headless,
      });
      page = browserSession.page;
      logs.push(`tdac_browser_provider=${browserSession.provider}`);
      logs.push(...browserSession.diagnostics);
      await prepareBrowserPage();
      policyBlocked = await gotoOfficialPortal();
      if (policyBlocked) {
        await page.waitForTimeout(5_000);
        const loadedDespiteRetryError = await page.locator("button", { hasText: /arrival card/i }).first().count().then((count) => count > 0).catch(() => false);
        if (loadedDespiteRetryError) {
          logs.push(`tdac_remote_browser_api_policy_blocked_but_landing_loaded retry=${retry}`);
          policyBlocked = false;
        }
      }
    }
    if (policyBlocked) {
      screenshots.push(await saveScreenshot(page, "browser-api-policy-blocked-final", logs));
      const text = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
      throw new TdacPortalError("TDAC Browser API provider blocked the official portal.", {
        code: "tdac_browser_api_provider_blocked",
        screenshotPaths: screenshots,
        portalSummary: text.slice(0, 500),
        logs,
      });
    }
    await page.waitForTimeout(8_000);
    await page.locator("button", { hasText: /arrival card/i }).first().waitFor({
      state: "visible",
      timeout: 90_000,
    }).catch(() => undefined);
    screenshots.push(await saveScreenshot(page, "landing", logs));

    const arrivalButton = page.locator("button", { hasText: /arrival card/i }).first();
    const arrivalButtonCount = await arrivalButton.count();
    if (arrivalButtonCount === 0) {
      const text = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
      logs.push(`tdac_arrival_button_not_found_continue_to_add_route ${text.slice(0, 500).replace(/\s+/g, " ")}`);
    } else if (await arrivalButton.isDisabled().catch(() => false)) {
      screenshots.push(await saveScreenshot(page, "turnstile-before-solve", logs));
      if (browserSession.nativeCloudflareUnblock) {
        const solved = await solveWithBrowserApiCaptchaCdp(page, logs, "initial");
        logs.push(`tdac_browser_api_captcha_solved=${solved}`);
        logs.push("tdac_waiting_for_browser_api_cloudflare_clearance");
        let enabledAfterNativeSolve = await waitForTdacCloudflareClearance(page, logs, 60_000);
        if (!enabledAfterNativeSolve) {
          logs.push("tdac_browser_api_captcha_native_solve_did_not_enable_button_try_checkbox");
          await clickTurnstileCheckboxIfVisible(page, logs);
          const solvedAfterClick = await solveWithBrowserApiCaptchaCdp(page, logs, "after_checkbox");
          logs.push(`tdac_browser_api_captcha_solved_after_checkbox=${solvedAfterClick}`);
          enabledAfterNativeSolve = await waitForTdacCloudflareClearance(page, logs, 120_000);
        }
        if (!enabledAfterNativeSolve) {
          screenshots.push(await saveScreenshot(page, "cloudflare-not-cleared", logs));
          const text = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
          throw new TdacPortalError("TDAC Cloudflare challenge was not cleared by Browser API.", {
            code: "tdac_cloudflare_not_cleared",
            screenshotPaths: screenshots,
            portalSummary: text.slice(0, 500),
            logs,
          });
        }
      } else {
        const text = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
        throw new TdacPortalError("TDAC Cloudflare challenge requires Browser API clearance; 2captcha is disabled for TDAC.", {
          code: "tdac_browser_api_required",
          screenshotPaths: screenshots,
          portalSummary: text.slice(0, 500),
          logs,
        });
      }
      await page.waitForTimeout(3_000);
      screenshots.push(await saveScreenshot(page, "turnstile-after-solve", logs));
      if (await arrivalButton.isDisabled().catch(() => false)) {
        const text = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
        const remoteBrowserFailure = browserSession.diagnostics.find((line) =>
          line.startsWith("tdac_remote_browser_api_failed"),
        );
        logs.push([
          "tdac_arrival_button_disabled_after_captcha_continue_to_add_route",
          remoteBrowserFailure,
          text.slice(0, 500).replace(/\s+/g, " "),
        ].filter(Boolean).join(" | "));
      }
    }

    const personalFormReady = await openTdacAddRoute(page, logs, screenshots);
    screenshots.push(await saveScreenshot(page, "after-entry", logs));
    if (!personalFormReady) {
      const text = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
      throw new TdacPortalError("Official TDAC form did not finish loading after retries.", {
        code: "tdac_form_not_loaded",
        screenshotPaths: screenshots,
        portalSummary: text.slice(0, 500),
        logs,
      });
    }

    await fillTdacPersonalStep(page, payload, screenshots, logs);
    await page.waitForTimeout(3_000);
    screenshots.push(await saveScreenshot(page, "after-personal", logs));

    await fillTdacTripStep(page, payload, screenshots, logs);
    await page.waitForTimeout(3_000);
    screenshots.push(await saveScreenshot(page, "after-trip", logs));

    await fillTdacHealthStep(page, payload, logs);
    await page.waitForTimeout(3_000);
    screenshots.push(await saveScreenshot(page, "after-health-preview", logs));

    const currentText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
    if (options.stopBeforeSubmit) {
      throw new TdacPortalError("TDAC runner stopped before final submit because TDAC_STOP_BEFORE_SUBMIT is enabled.", {
        code: "tdac_stopped_before_submit",
        screenshotPaths: screenshots,
        portalSummary: currentText.slice(0, 500),
        logs,
      });
    }

    page.on("dialog", (dialog) => {
      logs.push(`tdac_dialog_${dialog.type()} ${dialog.message().slice(0, 300)}`);
      void dialog.accept().catch((error) => {
        logs.push(`tdac_dialog_accept_failed ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
      });
    });
    await prepareTdacFinalSubmit(page, payload, logs);
    screenshots.push(await saveScreenshot(page, "before-final-submit", logs));
    await assertTdacOfficialFormValid(page, screenshots, logs, "final-submit");
    await clickFirstEnabledButton(page, /^Submit$/i, logs);
    await page.waitForTimeout(2_000);
    await clickButtonIfVisible(page, /^(Confirm|OK|Yes|Submit)$/i, logs, 10_000);
    const portalText = await waitForTdacSubmissionOutcome(page, screenshots, logs);
    const pdfs = await downloadTdacPdfIfAvailable(page, logs);
    return buildTdacSuccessFromPortalText(payload, portalText, page.url(), screenshots, pdfs, logs);
  } finally {
    await browserSession.close();
  }
}

export function buildTdacSuccessFromPortalText(
  payload: TdacPortalPayload,
  portalText: string,
  portalUrl: string,
  screenshots: string[],
  pdfs: string[],
  logs: string[],
): TdacPortalSubmissionResult {
  const referenceNumber = extractReference(portalText);
  return {
    submitted: true,
    confirmationNumber: referenceNumber,
    referenceNumber,
    portalUrl,
    portalResponseSummary: "Thailand TDAC official portal returned a submission confirmation.",
    screenshots,
    pdfs,
    logs: [`tdac_submitted application=${payload.applicationId}`, ...logs],
  };
}
