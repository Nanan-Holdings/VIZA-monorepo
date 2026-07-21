import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { Page } from "@playwright/test";
import { createArrivalCardBrowserSession } from "../arrival-card-browser";
import { solveCaptcha } from "../captcha";
import {
  fillPhEtravelOfficialDeclaration,
  isPhEtravelPublicLandingText,
  PhEtravelFormFillError,
} from "./form-filler";
import { PH_ETRAVEL_REFERENCE_PATTERNS } from "./official-options";
import { PH_ETRAVEL_OFFICIAL_PORTAL_URL, type PhEtravelPortalPayload } from "./normalize";
import { createPhEtravelMailboxProvider, type PhEtravelMailboxProvider } from "./mailbox-provider";

export interface PhEtravelPortalSubmissionResult {
  submitted: boolean;
  confirmationNumber?: string | null;
  referenceNumber?: string | null;
  portalUrl: string;
  portalResponseSummary: string;
  screenshots: string[];
  pdfs: string[];
  logs: string[];
}

export class PhEtravelPortalError extends Error {
  readonly screenshotPaths: string[];
  readonly portalSummary?: string;
  readonly code: string;
  logs: string[];
  readonly filledFields: string[];
  readonly reachedReview: boolean;

  constructor(message: string, options: { code: string; screenshotPaths?: string[]; portalSummary?: string; logs?: string[]; filledFields?: string[]; reachedReview?: boolean }) {
    super(message);
    this.name = "PhEtravelPortalError";
    this.code = options.code;
    this.screenshotPaths = options.screenshotPaths ?? [];
    this.portalSummary = options.portalSummary;
    this.logs = options.logs ?? [];
    this.filledFields = options.filledFields ?? [];
    this.reachedReview = options.reachedReview ?? false;
  }
}

export interface PhEtravelRunnerOptions {
  headless?: boolean;
  stopBeforeSubmit?: boolean;
  applicantId?: string;
  profilePhotoPath?: string;
  officialAccountEmail?: string;
  officialAccountPassword?: string | null;
  officialAccountMpin?: string | null;
  forceAccountRegistration?: boolean;
  forceLocalBrowser?: boolean;
  mailbox?: PhEtravelMailboxProvider;
  emailVerificationTimeoutMs?: number;
}

export function isPhEtravelRemotePolicyBlockMessage(message: string): boolean {
  return /bright\s*data|proxy_error|classified\s+as\s+government|residential.*policy/i.test(message) &&
    /access denied|blocked|policy|government|proxy_error/i.test(message);
}

async function saveScreenshot(page: Page, name: string, logs: string[]): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "viza-ph-etravel-"));
  const filePath = path.join(dir, `${name}-${Date.now()}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  logs.push(`ph_etravel_screenshot ${filePath}`);
  return filePath;
}

async function saveHtmlSnapshot(page: Page, name: string, logs: string[]): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "viza-ph-etravel-html-"));
  const filePath = path.join(dir, `${name}-${Date.now()}.html`);
  fs.writeFileSync(filePath, await page.content(), "utf8");
  logs.push(`ph_etravel_html_snapshot ${filePath}`);
  return filePath;
}

async function bodyText(page: Page): Promise<string> {
  return page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
}

async function firstSuccessful<T>(promises: Array<Promise<T>>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let pending = promises.length;
    const errors: unknown[] = [];
    for (const promise of promises) {
      promise.then(resolve).catch((error: unknown) => {
        errors.push(error);
        pending -= 1;
        if (pending === 0) {
          const firstError = errors[0];
          reject(firstError instanceof Error ? firstError : new Error(String(firstError)));
        }
      });
    }
  });
}

function extractReference(text: string): string | null {
  for (const pattern of PH_ETRAVEL_REFERENCE_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function hasQrEvidence(pageText: string): boolean {
  return /qr\s*code|scan\s+this|eTravel\s+QR|border\s+control|reference/i.test(pageText);
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? fullName.trim(), lastName: "" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function formatUsDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${month}/${day}/${year}`;
}

function countryOptionPattern(value: string): RegExp {
  const normalized = value.trim();
  if (/china|chinese|cn|chn/i.test(normalized)) return /china|chinese/i;
  if (/singapore|sg|sgp/i.test(normalized)) return /singapore/i;
  return new RegExp(normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

function sexOptionPattern(value: string): RegExp {
  if (/^m|male/i.test(value)) return /^male$/i;
  if (/^f|female/i.test(value)) return /^female$/i;
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

function occupationOptionPattern(value: string): RegExp {
  if (/software|engineer|developer|programmer|it|technology/i.test(value)) {
    return /software|engineer|information technology|it|professional/i;
  }
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

async function clickFirstAvailable(page: Page, locators: Array<ReturnType<Page["locator"]>>): Promise<boolean> {
  for (const locator of locators) {
    const target = locator.first();
    if (await target.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await target.click({ timeout: 10_000, force: true });
      return true;
    }
  }
  return false;
}

async function clickFirstEnabledAvailable(
  page: Page,
  locators: Array<ReturnType<Page["locator"]>>,
  timeoutMs = 240_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const locator of locators) {
      const target = locator.first();
      if (
        await target.isVisible({ timeout: 1_000 }).catch(() => false) &&
        await target.isEnabled({ timeout: 1_000 }).catch(() => false)
      ) {
        await target.click({ timeout: 10_000, force: true });
        return true;
      }
    }
    await page.waitForTimeout(2_000);
  }
  return false;
}

async function installTurnstileCapture(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const win = window as typeof window & {
      __vizaTurnstileHooked?: boolean;
      __vizaTurnstile?: Record<string, unknown>;
      __vizaTurnstileCallback?: (token: string) => void;
      turnstile?: { render?: (container: unknown, options?: Record<string, unknown>) => unknown };
    };
    const hook = () => {
      if (!win.turnstile?.render || win.__vizaTurnstileHooked) return;
      const originalRender = win.turnstile.render.bind(win.turnstile);
      win.turnstile.render = (container: unknown, options: Record<string, unknown> = {}) => {
        win.__vizaTurnstile = {
          sitekey: options.sitekey,
          action: options.action,
          cData: options.cData ?? options.cdata,
          chlPageData: options.chlPageData ?? options.pagedata,
        };
        if (typeof options.callback === "function") {
          win.__vizaTurnstileCallback = options.callback as (token: string) => void;
        }
        return originalRender(container, options);
      };
      win.__vizaTurnstileHooked = true;
    };
    hook();
    const timer = window.setInterval(() => {
      hook();
      if (win.__vizaTurnstileHooked) window.clearInterval(timer);
    }, 50);
  });
}

async function solveTurnstileWithBrowserApi(page: Page, logs: string[]): Promise<boolean> {
  const hasResponseField = await page
    .locator("input[name='cf-turnstile-response'], textarea[name='cf-turnstile-response']")
    .first()
    .count()
    .catch(() => 0);
  if (hasResponseField === 0) return false;

  const client = await page.context().newCDPSession(page);
  try {
    const sendCustom = client.send as unknown as (
      method: string,
      params?: Record<string, unknown>,
    ) => Promise<unknown>;
    await sendCustom("Captcha.setAutoSolve", { autoSolve: true }).catch(() => undefined);
    const result = await sendCustom("Captcha.solve", { detectTimeout: 30_000 }).catch(async () =>
      sendCustom("Captcha.waitForSolve", {}),
    );
    const status = typeof result === "object" && result && "status" in result
      ? String((result as { status?: unknown }).status ?? "unknown")
      : "unknown";
    logs.push(`ph_etravel_browser_api_captcha_solve status=${status}`);
    await page.waitForTimeout(2_000);
    return /solve_finished|finished|success|solved/i.test(status) && !/failed|invalid/i.test(status);
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
    logs.push(`ph_etravel_browser_api_captcha_solve_failed ${message}`);
    return false;
  } finally {
    await client.detach().catch(() => undefined);
  }
}

async function solveTurnstileIfPresent(page: Page, logs: string[], nativeCloudflareUnblock = false): Promise<boolean> {
  const hiddenResponse = page.locator("input[name='cf-turnstile-response'], textarea[name='cf-turnstile-response']").first();
  const hasResponseField = await hiddenResponse.count().catch(() => 0);
  const hasChallengeSurface = hasResponseField > 0 || await page
    .locator("iframe[src*='challenges.cloudflare.com'], .cf-turnstile, [data-sitekey]")
    .first()
    .count()
    .then((count) => count > 0)
    .catch(() => false);
  if (!hasChallengeSurface) return false;

  if (nativeCloudflareUnblock) {
    const solvedByBrowserApi = await solveTurnstileWithBrowserApi(page, logs);
    if (solvedByBrowserApi) {
      const tokenReady = await page.waitForFunction(() => {
        const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          "input[name='cf-turnstile-response'], textarea[name='cf-turnstile-response']",
        );
        return Boolean(field?.value?.trim());
      }, null, { timeout: 10_000 }).then(() => true).catch(() => false);
      logs.push(`ph_etravel_browser_api_captcha_token_ready=${tokenReady}`);
      return tokenReady;
    }
  }

  const captured = await page.waitForFunction(() => {
    const win = window as typeof window & { __vizaTurnstile?: Record<string, unknown> };
    return win.__vizaTurnstile?.sitekey ? win.__vizaTurnstile : null;
  }, null, { timeout: 15_000 }).then((handle) => handle.jsonValue()).catch(() => null);
  const siteKey = typeof captured === "object" && captured && "sitekey" in captured
    ? String((captured as { sitekey?: unknown }).sitekey ?? "")
    : "";
  if (!siteKey) return false;

  const userAgent = await page.evaluate(() => navigator.userAgent).catch(() => undefined);
  const solved = await solveCaptcha({
    type: "turnstile",
    siteKey,
    pageUrl: page.url(),
    action: typeof (captured as { action?: unknown }).action === "string" ? (captured as { action: string }).action : undefined,
    cdata: typeof (captured as { cData?: unknown }).cData === "string" ? (captured as { cData: string }).cData : undefined,
    pageData: typeof (captured as { chlPageData?: unknown }).chlPageData === "string" ? (captured as { chlPageData: string }).chlPageData : undefined,
    userAgent,
    timeoutMs: Number(process.env.PH_ETRAVEL_TURNSTILE_TIMEOUT_MS ?? "180000"),
  });

  await page.evaluate((captchaToken) => {
    const fields = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      "input[name='cf-turnstile-response'], textarea[name='cf-turnstile-response']",
    );
    for (const field of Array.from(fields)) {
      field.value = captchaToken;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const win = window as typeof window & { __vizaTurnstileCallback?: (token: string) => void };
    win.__vizaTurnstileCallback?.(captchaToken);
  }, solved.text);
  logs.push(`ph_etravel_turnstile_solved solveId=${solved.solveId ? "[redacted]" : "unknown"}`);
  await page.waitForTimeout(1_000);
  return true;
}

async function clickTurnstileProtectedContinue(
  page: Page,
  logs: string[],
  nativeCloudflareUnblock: boolean,
  locators: Array<ReturnType<Page["locator"]>>,
  options: {
    responseUrlPattern?: RegExp;
    prepareRetry?: () => Promise<void>;
  } = {},
): Promise<{ pageText: string; responseStatus?: number; responseSummary?: string }> {
  let lastText = await bodyText(page);
  let lastResponseStatus: number | undefined;
  let lastResponseSummary: string | undefined;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const hasChallenge = await page
      .locator("input[name='cf-turnstile-response'], textarea[name='cf-turnstile-response'], iframe[src*='challenges.cloudflare.com'], .cf-turnstile, [data-sitekey]")
      .first()
      .count()
      .catch(() => 0);
    if (hasChallenge > 0) {
      const solved = await solveTurnstileIfPresent(page, logs, nativeCloudflareUnblock);
      logs.push(`ph_etravel_turnstile_before_continue attempt=${attempt} solved=${solved}`);
      if (!solved) {
        const officialContinueEnabled = await Promise.all(locators.map(async (locator) => {
          const target = locator.first();
          return await target.isVisible({ timeout: 1_000 }).catch(() => false) &&
            await target.isEnabled({ timeout: 1_000 }).catch(() => false);
        })).then((states) => states.some(Boolean));
        if (!officialContinueEnabled) {
          lastText = await bodyText(page);
          continue;
        }
        logs.push(`ph_etravel_turnstile_native_success attempt=${attempt}`);
      }
    }
    const responsePromise = options.responseUrlPattern
      ? page.waitForResponse((response) =>
        options.responseUrlPattern!.test(response.url()) && response.request().method() === "POST",
      { timeout: 30_000 }).catch(() => null)
      : Promise.resolve(null);
    const clicked = await clickFirstAvailable(page, locators);
    logs.push(`ph_etravel_continue_click attempt=${attempt} clicked=${clicked}`);
    const response = clicked ? await responsePromise : null;
    if (response) {
      lastResponseStatus = response.status();
      const responseBody = await response.text().catch(() => "");
      try {
        const payload = JSON.parse(responseBody) as { error?: unknown; message?: unknown };
        lastResponseSummary = String(payload.error ?? payload.message ?? "").slice(0, 240) || undefined;
      } catch {
        lastResponseSummary = responseBody.trim().slice(0, 240) || undefined;
      }
      logs.push(
        `ph_etravel_continue_response attempt=${attempt} status=${lastResponseStatus}` +
        (lastResponseSummary ? ` summary=${lastResponseSummary}` : ""),
      );
      if (isPhEtravelRegistrationResponseRejected(lastResponseStatus)) {
        lastText = await bodyText(page);
        if (attempt < 3) {
          logs.push(`ph_etravel_continue_response_retry attempt=${attempt}`);
          await page.reload({ waitUntil: "domcontentloaded", timeout: 45_000 }).catch(() => undefined);
          await page.waitForTimeout(2_000);
          await options.prepareRetry?.();
          continue;
        }
        return { pageText: lastText, responseStatus: lastResponseStatus, responseSummary: lastResponseSummary };
      }
    }
    await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(2_000);
    lastText = await bodyText(page);
    if (!/verification failed|troubleshooting|cloudflare|turnstile|验证失败|故障排除/i.test(lastText)) {
      return { pageText: lastText, responseStatus: lastResponseStatus, responseSummary: lastResponseSummary };
    }
    logs.push(`ph_etravel_turnstile_continue_failed attempt=${attempt}`);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 45_000 }).catch(() => undefined);
    await page.waitForTimeout(2_000);
    lastText = await bodyText(page);
  }
  return { pageText: lastText, responseStatus: lastResponseStatus, responseSummary: lastResponseSummary };
}

export function isPhEtravelRegistrationResponseRejected(status: number): boolean {
  return status >= 400;
}

export const PH_ETRAVEL_EXISTING_ACCOUNT_NOTICE_GRACE_MS = 90_000;

async function fillFirstVisibleInput(page: Page, selectors: string[], value: string): Promise<boolean> {
  for (const selector of selectors) {
    const inputs = page.locator(selector);
    const count = await inputs.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const input = inputs.nth(index);
      if (await input.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await input.fill(value, { timeout: 15_000 });
        return true;
      }
    }
  }
  return false;
}

async function fillLastVisibleInput(page: Page, selector: string, value: string): Promise<boolean> {
  const inputs = page.locator(selector);
  const count = await inputs.count().catch(() => 0);
  for (let index = count - 1; index >= 0; index -= 1) {
    const input = inputs.nth(index);
    if (await input.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await input.fill(value, { timeout: 15_000 });
      return true;
    }
  }
  return false;
}

async function fillVisibleByPlaceholder(page: Page, pattern: RegExp, value: string): Promise<boolean> {
  const inputs = page.locator("input, textarea");
  const count = await inputs.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const input = inputs.nth(index);
    if (!await input.isVisible({ timeout: 500 }).catch(() => false)) continue;
    const placeholder = await input.getAttribute("placeholder").catch(() => null);
    if (!placeholder || !pattern.test(placeholder)) continue;
    await input.fill(value, { timeout: 15_000 });
    return true;
  }
  return false;
}

async function fillVisibleTextField(page: Page, label: string, value: string): Promise<boolean> {
  const labelPattern = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const byLabel = page.getByLabel(labelPattern).first();
  if (await byLabel.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await byLabel.fill(value, { timeout: 15_000 });
    return true;
  }

  if (await fillVisibleByPlaceholder(page, labelPattern, value)) return true;

  const byFollowingLabel = page
    .locator(`xpath=//*[self::label or self::div or self::span or self::p][contains(normalize-space(.), '${label}')]/following::input[not(@type='hidden')][1]`)
    .first();
  if (await byFollowingLabel.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await byFollowingLabel.fill(value, { timeout: 15_000 });
    return true;
  }

  return false;
}

async function fillMobileNumberField(page: Page, mobileCountryCode: string, mobileNumber: string): Promise<boolean> {
  const normalized = mobileNumber.replace(/[^\d]/g, "");
  const countryCode = mobileCountryCode.replace(/[^\d]/g, "");
  const fullInternationalNumber = `${countryCode ? `+${countryCode}` : ""}${normalized}`;
  const numberForSelectedCountry = countryCode === "86" ? normalized : fullInternationalNumber;
  if (!normalized) return false;

  if (countryCode === "86") {
    const flag = page.locator(".react-tel-input .selected-flag").first();
    if (await flag.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await flag.click({ timeout: 10_000, force: true });
      await page.waitForTimeout(500);
      const searchBox = page.locator(".react-tel-input .search-box").first();
      if (await searchBox.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await searchBox.fill("China", { timeout: 5_000 });
      } else {
        await page.keyboard.type("China", { delay: 30 }).catch(() => undefined);
      }
      await page.waitForTimeout(500);
      await clickFirstAvailable(page, [
        page.locator(".react-tel-input .country-list .country").filter({ hasText: /China/i }),
        page.locator(".react-tel-input li").filter({ hasText: /China/i }),
      ]);
      await page.waitForTimeout(500);
    }
  }

  const telInputs = page.locator("input[type='tel']");
  const telCount = await telInputs.count().catch(() => 0);
  for (let index = 0; index < telCount; index += 1) {
    const telInput = telInputs.nth(index);
    if (!await telInput.isVisible({ timeout: 500 }).catch(() => false)) continue;
    await telInput.fill(numberForSelectedCountry, { timeout: 10_000 }).catch(() => undefined);
    await telInput.dispatchEvent("input").catch(() => undefined);
    await telInput.dispatchEvent("change").catch(() => undefined);
    await page.waitForTimeout(500);
    const value = await telInput.inputValue().catch(() => "");
    if (value.replace(/[^\d]/g, "").includes(normalized)) return true;
  }

  const directFilled = await page.evaluate(({ fullValue }) => {
    const textNodes = Array.from(document.querySelectorAll("label, div, span, p"))
      .filter((node) => /mobile number/i.test(node.textContent ?? ""));
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    for (const node of textNodes) {
      let scope: Element | null = node;
      for (let depth = 0; depth < 5 && scope; depth += 1) {
        const targets = Array.from(scope.querySelectorAll<HTMLInputElement>("input[type='tel'], input:not([type='hidden'])"))
          .filter((input) => !input.disabled && input.type !== "hidden");
        for (const target of targets.reverse()) {
          target.focus();
          setValue?.call(target, fullValue);
          if (target.value !== fullValue) target.value = fullValue;
          target.dispatchEvent(new InputEvent("input", { bubbles: true, data: target.value, inputType: "insertText" }));
          target.dispatchEvent(new Event("change", { bubbles: true }));
          target.blur();
          if (target.value === fullValue) return true;
        }
        scope = scope.parentElement;
      }
    }
    return false;
  }, { fullValue: numberForSelectedCountry }).catch(() => false);
  if (directFilled) {
    await page.waitForTimeout(500);
    return true;
  }

  const mobileLabel = page.getByText(/mobile number/i).last();
  if (await mobileLabel.isVisible({ timeout: 1_000 }).catch(() => false)) {
    const box = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll("label, div, span, p"))
        .filter((node) => /mobile number/i.test(node.textContent ?? ""));
      for (const node of nodes) {
        let scope: Element | null = node;
        for (let depth = 0; depth < 6 && scope; depth += 1) {
          const rect = scope.getBoundingClientRect();
          if (rect.width > 220 && rect.height > 45) {
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          }
          scope = scope.parentElement;
        }
      }
      return null;
    }).catch(() => null);
    if (box) {
      await page.mouse.click(box.x + 42, box.y + box.height * 0.62);
      await page.waitForTimeout(500);
      await page.keyboard.type("China", { delay: 30 }).catch(() => undefined);
      await page.waitForTimeout(500);
      await clickFirstAvailable(page, [
        page.getByText(/^China$/i),
        page.locator("[role='option'], li, button, div, p").filter({ hasText: /^China$/i }),
      ]);
      await page.waitForTimeout(500);
      await page.mouse.click(box.x + box.width * 0.62, box.y + box.height * 0.62);
    } else {
      await mobileLabel.click({ timeout: 10_000, force: true });
    }
    await page.keyboard.press("Control+A").catch(() => undefined);
    await page.keyboard.type(numberForSelectedCountry, { delay: 30 });
    await page.waitForTimeout(300);
    return true;
  }
  return false;
}

async function uploadEgovProfilePhoto(
  page: Page,
  photoPath: string | undefined,
  logs: string[],
): Promise<boolean> {
  if (!photoPath || !fs.existsSync(photoPath)) return false;
  const extension = path.extname(photoPath).toLowerCase();
  const filePayload = {
    name: path.basename(photoPath),
    mimeType: extension === ".png" ? "image/png" : "image/jpeg",
    buffer: fs.readFileSync(photoPath),
  };
  const browserFilePayload = {
    name: filePayload.name,
    mimeType: filePayload.mimeType,
    base64: filePayload.buffer.toString("base64"),
  };
  const uploadDirectlyAndInjectUrl = async (): Promise<boolean> => {
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([new Uint8Array(filePayload.buffer)], { type: filePayload.mimeType }),
      filePayload.name,
    );
    const uploadResponse = await fetch(
      process.env.PH_ETRAVEL_EGOV_UPLOAD_URL?.trim() || "https://egov-upload-ws.e.gov.ph/ext/etravel/upload",
      {
        method: "POST",
        headers: {
          "X-Api-Key": process.env.PH_ETRAVEL_EGOV_UPLOAD_API_KEY?.trim() || "3fcc23fb808f43b4b474f478c62e035d",
        },
        body: formData,
      },
    ).catch(() => null);
    if (!uploadResponse) {
      logs.push("ph_etravel_egov_profile_photo_direct_upload_unreachable");
      return false;
    }

    logs.push(`ph_etravel_egov_profile_photo_direct_upload_response status=${uploadResponse.status}`);
    const responseBody = await uploadResponse.json().catch(() => null) as {
      data?: { url?: unknown };
    } | null;
    const uploadedUrl = typeof responseBody?.data?.url === "string" ? responseBody.data.url.trim() : "";
    if (!uploadResponse.ok || !uploadedUrl) return false;

    const injected = await page.evaluate((photoUrl) => {
      type ReactFiberNode = {
        memoizedProps?: {
          environment?: unknown;
          project?: unknown;
          onChange?: unknown;
        };
        return?: ReactFiberNode | null;
      };
      const roots = Array.from(document.querySelectorAll(
        ".egov-upload-widget, input[type='file'], [class*='upload' i]",
      ));
      for (const root of roots) {
        const fiberKey = Object.keys(root).find((key) => key.startsWith("__reactFiber$"));
        let fiber = fiberKey
          ? (root as unknown as Record<string, ReactFiberNode>)[fiberKey]
          : null;
        for (let depth = 0; fiber && depth < 30; depth += 1, fiber = fiber.return ?? null) {
          const props = fiber.memoizedProps;
          if (
            props?.environment === "PRODUCTION" &&
            props.project === "etravel" &&
            typeof props.onChange === "function"
          ) {
            (props.onChange as (event: { target: { value: { url: string } } }) => void)({
              target: { value: { url: photoUrl } },
            });
            return true;
          }
        }
      }
      return false;
    }, uploadedUrl).catch(() => false);
    if (!injected) {
      logs.push("ph_etravel_egov_profile_photo_url_injection_failed");
      return false;
    }

    await page.waitForTimeout(1_000);
    logs.push("ph_etravel_egov_profile_photo_url_injected");
    return true;
  };

  // Browserbase can preserve the filename while losing the native File body
  // across remote CDP. Use the same public eGov upload endpoint as the official
  // widget, then notify the widget with the returned URL so Formik receives the
  // exact value it would get after a successful local-browser upload.
  if (await uploadDirectlyAndInjectUrl()) {
    logs.push("ph_etravel_egov_profile_photo_uploaded");
    return true;
  }

  const trySetInputFiles = async (): Promise<boolean> => {
    const inputs = page.locator("input[type='file']");
    const count = await inputs.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const input = inputs.nth(index);
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        await input.setInputFiles([], { timeout: 5_000 }).catch(() => undefined);
        const uploadResponsePromise = page.waitForResponse(
          (response) => /egov-upload-ws\.e\.gov\.ph\/.*\/upload/i.test(response.url()),
          { timeout: 30_000 },
        ).catch(() => null);
        if (attempt === 1) {
          await input.setInputFiles(filePayload, { timeout: 15_000 }).catch(() => undefined);
        } else {
          // Browserbase transports Playwright file payloads over a remote CDP
          // connection. Some sessions preserve the filename but lose the native
          // File body, which the eGov upload service rejects with HTTP 422. Build
          // the File inside the remote page so the official widget receives the
          // same browser-native object as a user-selected local file.
          await input.evaluate((element, payload) => {
            const binary = window.atob(payload.base64);
            const bytes = new Uint8Array(binary.length);
            for (let offset = 0; offset < binary.length; offset += 1) {
              bytes[offset] = binary.charCodeAt(offset);
            }
            const file = new File([bytes], payload.name, { type: payload.mimeType });
            const transfer = new DataTransfer();
            transfer.items.add(file);
            (element as HTMLInputElement).files = transfer.files;
            element.dispatchEvent(new Event("input", { bubbles: true }));
            element.dispatchEvent(new Event("change", { bubbles: true }));
          }, browserFilePayload).catch(() => undefined);
        }
        const uploadResponse = await uploadResponsePromise;
        await page.waitForTimeout(5_000);
        if (uploadResponse) {
          logs.push(`ph_etravel_egov_profile_photo_upload_response attempt=${attempt} status=${uploadResponse.status()}`);
          if (uploadResponse.ok()) return true;
          // A selected filename only proves that the browser control changed.
          // The official upload response remains the source of truth.
          continue;
        }
        const uploadError = await page
          .getByText(/error uploading file|network error|upload failed/i)
          .first()
          .isVisible({ timeout: 500 })
          .catch(() => false);
        if (uploadError) {
          logs.push(`ph_etravel_egov_profile_photo_upload_retry attempt=${attempt}`);
          continue;
        }
        const selectedFileName = await input.evaluate((element) =>
          (element as HTMLInputElement).files?.[0]?.name ?? "",
        ).catch(() => "");
        const uploadedState = await page
          .locator("[class*='preview' i], [class*='file_status_uploaded' i], img[src^='blob:']")
          .count()
          .catch(() => 0);
        if (selectedFileName || uploadedState > 0) return true;
      }
    }
    return false;
  };

  if (await trySetInputFiles()) {
    logs.push("ph_etravel_egov_profile_photo_uploaded");
    return true;
  }

  await clickFirstAvailable(page, [
    page.getByText(/take a photo|upload a file|click to select|select/i).first(),
    page.locator("button, div, label").filter({ hasText: /take a photo|upload a file|click to select|select/i }).first(),
  ]);
  await page.waitForTimeout(1_500);
  if (!await trySetInputFiles()) return false;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const clicked = await clickFirstAvailable(page, [
      page.getByRole("button", { name: /done|add|upload|select|choose|confirm|save/i }),
      page.locator("button").filter({ hasText: /done|add|upload|select|choose|confirm|save/i }),
    ]);
    if (!clicked) break;
    await page.waitForTimeout(1_500);
  }

  logs.push("ph_etravel_egov_profile_photo_uploaded");
  return true;
}

async function chooseReactSelectByHiddenName(
  page: Page,
  hiddenName: string,
  typedText: string,
  expectedValue: RegExp,
): Promise<boolean> {
  const opened = await page.evaluate((name) => {
    const hidden = document.querySelector<HTMLInputElement>(`input[type="hidden"][name="${name}"]`);
    const root = hidden?.parentElement;
    const input = root?.querySelector<HTMLInputElement>("input[role='combobox']");
    input?.focus();
    input?.click();
    return Boolean(input);
  }, hiddenName).catch(() => false);
  if (!opened) return false;

  await page.keyboard.press("Control+A").catch(() => undefined);
  await page.keyboard.type(typedText, { delay: 30 });
  await page.waitForTimeout(700);
  await clickFirstAvailable(page, [
    page.getByRole("option", { name: new RegExp(`^${typedText}$`, "i") }),
    page.getByText(new RegExp(`^${typedText}$`, "i")),
    page.locator("[role='option'], div, p").filter({ hasText: new RegExp(`^${typedText}$`, "i") }),
  ]);
  await page.keyboard.press("Enter").catch(() => undefined);
  await page.waitForTimeout(700);

  const value = await page.locator(`input[type="hidden"][name="${hiddenName}"]`).first().inputValue().catch(() => "");
  if (expectedValue.test(value)) return true;

  const visibleText = await bodyText(page);
  const selectedTextPattern = new RegExp(`\\b${typedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return selectedTextPattern.test(visibleText);
}

async function chooseHeadlessComboboxByInputName(
  page: Page,
  inputName: string,
  typedText: string,
  expectedText: RegExp,
): Promise<boolean> {
  const input = page.locator(`input[name="${inputName}"]`).first();
  if (!await input.isVisible({ timeout: 2_000 }).catch(() => false)) return false;
  await input.click({ timeout: 10_000, force: true });
  await input.fill(typedText, { timeout: 10_000 });
  await page.waitForTimeout(700);
  const clicked = await clickFirstAvailable(page, [
    page.getByText(expectedText),
    page.getByRole("option", { name: expectedText }),
    page.locator("[role='option'], li, [data-slot='select-item']").filter({ hasText: expectedText }),
  ]);
  if (!clicked) {
    await page.keyboard.press("Enter").catch(() => undefined);
  }
  await page.waitForTimeout(700);
  const value = await input.inputValue().catch(() => "");
  return expectedText.test(value);
}

async function chooseDropdownOption(
  page: Page,
  triggerText: RegExp,
  optionText: RegExp,
  typedText?: string,
): Promise<boolean> {
  const nativeSelect = page.locator("select").filter({ hasText: triggerText }).first();
  if (await nativeSelect.isVisible({ timeout: 1_000 }).catch(() => false)) {
    const optionValue = await nativeSelect.evaluate((select, pattern) => {
      const regex = new RegExp(pattern.source, pattern.flags);
      const option = Array.from((select as HTMLSelectElement).options).find((candidate) =>
        regex.test(candidate.label) || regex.test(candidate.textContent ?? ""),
      );
      return option?.value ?? null;
    }, { source: optionText.source, flags: optionText.flags }).catch(() => null);
    if (optionValue) {
      const selected = await nativeSelect.selectOption(optionValue, { timeout: 5_000 }).catch(() => null);
      if (selected) return true;
    }
  }

  let typedIntoCombobox = false;
  if (typedText) {
    const namedCombobox = page.getByRole("combobox", { name: triggerText }).first();
    if (await namedCombobox.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await namedCombobox.click({ timeout: 10_000, force: true });
      await namedCombobox.fill(typedText, { timeout: 10_000 });
      typedIntoCombobox = true;
      await page.waitForTimeout(700);
    }
  }
  if (!typedIntoCombobox) {
    const trigger = page.locator("button, [role='button'], [role='combobox'], div, input").filter({ hasText: triggerText }).last();
    if (await trigger.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await trigger.click({ timeout: 10_000, force: true });
    } else {
      const label = page.getByText(triggerText).last();
      if (!await label.isVisible({ timeout: 2_000 }).catch(() => false)) return false;
      await label.click({ timeout: 10_000, force: true });
    }
    await page.waitForTimeout(500);
    if (typedText) {
      await page.keyboard.press("Control+A").catch(() => undefined);
      await page.keyboard.type(typedText, { delay: 30 }).catch(() => undefined);
      await page.waitForTimeout(700);
    }
  }
  const exactTypedText = typedText
    ? new RegExp(`^${typedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")
    : null;
  const clicked = await clickFirstAvailable(page, [
    exactTypedText ? page.getByText(exactTypedText) : page.locator("__never__"),
    page.getByRole("option", { name: optionText }),
    page.locator(".ant-select-item-option, .select__option, [data-slot='select-item'], [role='option'], li").filter({ hasText: optionText }),
    typedText ? page.getByText(new RegExp(`^${typedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")) : page.locator("__never__"),
  ]);
  if (clicked) {
    await page.waitForTimeout(700);
    return true;
  }

  if (!typedText) return false;
  await page.keyboard.press("Enter").catch(() => undefined);
  await page.waitForTimeout(700);
  return true;
}

async function completeEgovPermanentResidenceOnboarding(
  page: Page,
  payload: PhEtravelPortalPayload,
  logs: string[],
  screenshots: string[],
): Promise<string> {
  let text = await bodyText(page);
  if (/profile is complete|onboarding summary/i.test(text)) {
    await page.waitForFunction(
      () => /dashboard|new travel declaration|travel history/i.test(document.body?.innerText ?? ""),
      undefined,
      { timeout: 30_000 },
    ).catch(() => undefined);
    return bodyText(page);
  }
  if (!/permanent country of residence|address information|no\.?\/bldg/i.test(text)) {
    return text;
  }

  logs.push("ph_etravel_egov_onboarding_residence_detected");
  const countryText = /china|chinese|cn|chn/i.test(payload.countryOfResidence) ? "China" : payload.countryOfResidence;
  const choseCountry = await chooseHeadlessComboboxByInputName(
    page,
    "country_code",
    countryText,
    countryOptionPattern(payload.countryOfResidence),
  );
  const address = payload.residenceAddress || payload.countryOfResidence;
  const filledAddress = await fillVisibleByPlaceholder(page, /no\.?\/bldg|city|state|province|address/i, address)
    || await fillVisibleTextField(page, "No./Bldg./City/State/Province", address);

  if (!choseCountry || !filledAddress) {
    logs.push(`ph_etravel_egov_residence_precheck_incomplete ${JSON.stringify({ choseCountry, filledAddress })}`);
  }

  const clickedContinue = await clickFirstEnabledAvailable(page, [
    page.getByRole("button", { name: /continue|next|submit|save/i }),
    page.locator("button").filter({ hasText: /continue|next|submit|save/i }),
  ], 60_000);
  if (!clickedContinue) {
    screenshots.push(await saveScreenshot(page, "egov-residence-continue-disabled", logs));
    throw new PhEtravelPortalError(
      "Official eGovPH permanent-residence onboarding did not enable continue after address information was filled.",
      {
        code: "ph_etravel_egov_residence_continue_disabled",
        screenshotPaths: screenshots,
        portalSummary: text.slice(0, 700),
      },
    );
  }

  await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(2_000);
  text = await bodyText(page);
  if (/onboarding summary|kindly double check/i.test(text)) {
    await clickFirstEnabledAvailable(page, [
      page.getByRole("button", { name: /continue|next|submit|save/i }),
      page.locator("button").filter({ hasText: /continue|next|submit|save/i }),
    ], 60_000);
    logs.push("ph_etravel_egov_onboarding_summary_submitted");
    await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
    await page.waitForFunction(
      () => {
        const current = document.body?.innerText ?? "";
        return /dashboard|new travel declaration|travel history/i.test(current)
          || !/^loading/i.test(current.trim());
      },
      undefined,
      { timeout: 20_000 },
    ).catch(() => undefined);
    await page.waitForTimeout(3_000);
    text = await bodyText(page);
    logs.push("ph_etravel_egov_onboarding_residence_submitted");
    return text;
  }
  if (/permanent country of residence|please make sure to fill out all required fields/i.test(text)) {
    screenshots.push(await saveScreenshot(page, "egov-residence-still-required", logs));
    await saveHtmlSnapshot(page, "egov-residence-still-required", logs);
    throw new PhEtravelPortalError(
      "Official eGovPH onboarding still shows required permanent-residence fields after automation clicked Next.",
      {
        code: "ph_etravel_egov_residence_required_fields_remaining",
        screenshotPaths: screenshots,
        portalSummary: text.slice(0, 700),
      },
    );
  }

  logs.push("ph_etravel_egov_onboarding_residence_submitted");
  return text;
}

async function fillMpinInputs(page: Page, mpin: string): Promise<boolean> {
  const digits = mpin.trim().split("");
  const inputs = page.locator("input:not([type='hidden'])");
  const count = await inputs.count().catch(() => 0);
  const visibleIndexes: number[] = [];
  for (let index = 0; index < count; index += 1) {
    if (await inputs.nth(index).isVisible({ timeout: 500 }).catch(() => false)) {
      visibleIndexes.push(index);
    }
  }
  if (visibleIndexes.length >= digits.length * 2) {
    for (let offset = 0; offset < digits.length * 2; offset += 1) {
      await inputs.nth(visibleIndexes[offset]).fill(digits[offset % digits.length], { timeout: 10_000 });
    }
    return true;
  }
  return fillOtpInputs(page, mpin);
}

async function fillOtpInputs(page: Page, otp: string): Promise<boolean> {
  const digits = otp.trim().split("");
  const inputs = page.locator("input:not([type='hidden'])");
  const count = await inputs.count().catch(() => 0);
  const visibleIndexes: number[] = [];
  for (let index = 0; index < count; index += 1) {
    if (await inputs.nth(index).isVisible({ timeout: 500 }).catch(() => false)) {
      visibleIndexes.push(index);
    }
  }
  if (visibleIndexes.length >= digits.length) {
    const otpIndexes = visibleIndexes.slice(-digits.length);
    await inputs.nth(otpIndexes[0]).click({ timeout: 10_000 });
    await page.keyboard.type(otp.trim(), { delay: 40 });
    await page.waitForTimeout(300);
    for (let index = 0; index < digits.length; index += 1) {
      const value = await inputs.nth(otpIndexes[index]).inputValue({ timeout: 1_000 }).catch(() => "");
      if (value !== digits[index]) {
        await inputs.nth(otpIndexes[index]).fill(digits[index], { timeout: 10_000 });
      }
    }
    return true;
  }
  return fillLastVisibleInput(page, "input:not([type='hidden'])", otp);
}

async function fillMpinPrompt(
  page: Page,
  options: PhEtravelRunnerOptions,
  logs: string[],
  screenshots: string[],
): Promise<string> {
  const mpin = options.officialAccountMpin?.trim();
  if (!mpin || !/^\d{6}$/.test(mpin)) {
    screenshots.push(await saveScreenshot(page, "official-mpin-required", logs));
    throw new PhEtravelPortalError(
      "Official Philippines eTravel/eGovPH account requires a 6-digit MPIN before automation can continue.",
      {
        code: "ph_etravel_official_mpin_required",
        screenshotPaths: screenshots,
        portalSummary: (await bodyText(page)).slice(0, 700),
      },
    );
  }

  const text = await bodyText(page);
  if (/create|set|confirm|re[-\s]?enter/i.test(text)) {
    await fillMpinInputs(page, mpin);
  } else {
    await fillOtpInputs(page, mpin);
  }
  await clickFirstAvailable(page, [
    page.getByRole("button", { name: /next|continue|submit|confirm/i }),
    page.locator("button").filter({ hasText: /next|continue|submit|confirm/i }),
  ]);
  logs.push("ph_etravel_egov_mpin_submitted");
  await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(3_000);
  const afterMpinText = await bodyText(page);
  if (isPhEtravelMpinRejectedText(afterMpinText)) {
    screenshots.push(await saveScreenshot(page, "official-mpin-invalid", logs));
    throw new PhEtravelPortalError(
      "The saved 6-digit eGovPH MPIN was rejected by the official Philippines eTravel portal.",
      {
        code: "ph_etravel_official_mpin_invalid",
        screenshotPaths: screenshots,
        portalSummary: afterMpinText.slice(0, 700),
      },
    );
  }
  return afterMpinText;
}

export function isPhEtravelMpinRejectedText(value: string): boolean {
  return (
    /invalid\s+(?:credentials|mpin|passcode)/i.test(value) ||
    /incorrect\s+(?:mpin|passcode)/i.test(value)
  );
}

async function completeEgovPersonalInformationOnboarding(
  page: Page,
  payload: PhEtravelPortalPayload,
  options: PhEtravelRunnerOptions,
  logs: string[],
  screenshots: string[],
): Promise<string> {
  let text = await bodyText(page);
  if (/profile is complete|onboarding summary/i.test(text)) {
    await page.waitForFunction(
      () => /dashboard|new travel declaration|travel history/i.test(document.body?.innerText ?? ""),
      undefined,
      { timeout: 30_000 },
    ).catch(() => undefined);
    return bodyText(page);
  }
  if (/permanent country of residence|address information|no\.?\/bldg/i.test(text)) {
    return completeEgovPermanentResidenceOnboarding(page, payload, logs, screenshots);
  }
  if (!/onboarding|personal information|foreign passport holder|first name|citizenship/i.test(text)) {
    return text;
  }

  logs.push("ph_etravel_egov_onboarding_personal_information_detected");
  const uploadedPhoto = await uploadEgovProfilePhoto(page, options.profilePhotoPath, logs);
  const foreignPassportRadio = page.getByRole("radio", { name: /foreign passport holder/i }).first();
  if (await foreignPassportRadio.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await foreignPassportRadio.check({ force: true }).catch(() => undefined);
  }
  const selectedForeignPassport = await foreignPassportRadio.isChecked().catch(() => false) || await clickFirstAvailable(page, [
    page.locator("label").filter({ hasText: /foreign passport holder/i }),
    page.locator("button, div").filter({ hasText: /^\s*foreign passport\s*holder\s*$/i }),
  ]);
  logs.push(`ph_etravel_egov_foreign_passport_selected=${selectedForeignPassport}`);

  const name = splitFullName(payload.fullName);
  const filled = {
    firstName: await fillVisibleTextField(page, "First Name", name.firstName),
    lastName: await fillVisibleTextField(page, "Last Name", name.lastName || name.firstName),
    birthDate: await fillVisibleTextField(page, "Birth Date", formatUsDate(payload.dateOfBirth)),
    mobile: await fillMobileNumberField(page, payload.mobileCountryCode, payload.mobileNumber),
    passportNumber: await fillVisibleTextField(page, "Passport Number", payload.passportNumber),
    passportIssueDate: await fillVisibleTextField(page, "Passport Issued Date", formatUsDate(payload.passportIssueDate)),
  };
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.waitForTimeout(300);
  const sexText = /^m|male/i.test(payload.sex) ? "MALE" : /^f|female/i.test(payload.sex) ? "FEMALE" : payload.sex.toUpperCase();
  const choseSex = await chooseReactSelectByHiddenName(page, "gender", sexText, sexOptionPattern(payload.sex));
  const citizenshipText = /china|chinese|cn|chn/i.test(payload.nationality) ? "Chinese" : payload.nationality;
  const choseCitizenship = await chooseHeadlessComboboxByInputName(
    page,
    "nationality_country_code",
    citizenshipText,
    countryOptionPattern(payload.nationality),
  );
  const choseCountryOfBirth = await chooseDropdownOption(
    page,
    /country of birth/i,
    countryOptionPattern(payload.countryOfBirth),
    payload.countryOfBirth,
  );
  const chosePassportIssuingAuthority = await chooseDropdownOption(
    page,
    /passport issuing authority/i,
    countryOptionPattern(payload.passportIssuingAuthority),
    payload.passportIssuingAuthority,
  );
  const choseOccupation = await chooseDropdownOption(
    page,
    /occupation/i,
    occupationOptionPattern(payload.occupation),
    /software|engineer|developer|programmer|it|technology/i.test(payload.occupation) ? "Professional" : payload.occupation,
  );
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.waitForTimeout(500);

  if (
    !filled.firstName ||
    !filled.lastName ||
    !filled.birthDate ||
    !filled.mobile ||
    !filled.passportNumber ||
    !filled.passportIssueDate ||
    !uploadedPhoto ||
    !selectedForeignPassport ||
    !choseSex ||
    !choseCitizenship ||
    !choseCountryOfBirth ||
    !chosePassportIssuingAuthority ||
    !choseOccupation
  ) {
    logs.push(`ph_etravel_egov_onboarding_precheck_incomplete ${JSON.stringify({
      ...filled,
      choseSex,
      choseCitizenship,
      choseCountryOfBirth,
      chosePassportIssuingAuthority,
      choseOccupation,
      uploadedPhoto,
      selectedForeignPassport,
    })}`);
  }

  const clickedContinue = await clickFirstEnabledAvailable(page, [
    page.getByRole("button", { name: /continue|next|submit|save/i }),
    page.locator("button").filter({ hasText: /continue|next|submit|save/i }),
  ], 60_000);
  if (!clickedContinue) {
    screenshots.push(await saveScreenshot(page, "egov-onboarding-continue-disabled", logs));
    throw new PhEtravelPortalError(
      "Official eGovPH onboarding page did not enable continue after personal information was filled.",
      {
        code: "ph_etravel_egov_onboarding_continue_disabled",
        screenshotPaths: screenshots,
        portalSummary: (await bodyText(page)).slice(0, 700),
      },
    );
  }

  await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(3_000);
  text = await bodyText(page);
  if (/permanent country of residence|address information|no\.?\/bldg/i.test(text)) {
    text = await completeEgovPermanentResidenceOnboarding(page, payload, logs, screenshots);
  }
  if (
    !/profile is complete|begin creating your etravel transactions/i.test(text) &&
    /personal information|required|fill out all required fields/i.test(text) &&
    /onboarding|personal information/i.test(text)
  ) {
    screenshots.push(await saveScreenshot(page, "egov-onboarding-still-required", logs));
    await saveHtmlSnapshot(page, "egov-onboarding-still-required", logs);
    throw new PhEtravelPortalError(
      "Official eGovPH onboarding still shows required personal-information fields after automation clicked Next.",
      {
        code: "ph_etravel_egov_onboarding_required_fields_remaining",
        screenshotPaths: screenshots,
        portalSummary: text.slice(0, 700),
      },
    );
  }
  if (/mpin|6[-\s]?digit passcode|enter your passcode|create.*passcode|set.*passcode/i.test(text)) {
    text = await fillMpinPrompt(page, options, logs, screenshots);
  }
  logs.push("ph_etravel_egov_onboarding_personal_information_submitted");
  return text;
}

async function reachAuthenticatedPhEtravelSession(
  page: Page,
  payload: PhEtravelPortalPayload,
  options: PhEtravelRunnerOptions,
  logs: string[],
  screenshots: string[],
  nativeCloudflareUnblock = false,
): Promise<void> {
  const initialText = await bodyText(page);
  const signedInAlready = /dashboard|new travel declaration|etravel registration|personal information/i.test(initialText);
  if (signedInAlready && !/enter email address|password|create an account/i.test(initialText)) {
    await completeEgovPersonalInformationOnboarding(page, payload, options, logs, screenshots);
    logs.push("ph_etravel_existing_session_detected");
    return;
  }

  let clickedSignIn = false;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    clickedSignIn = await clickFirstAvailable(page, [
      page.getByRole("button", { name: /click here to sign in/i }),
      page.getByRole("link", { name: /^sign in$/i }),
      page.locator("button, a").filter({ hasText: /sign in/i }),
    ]);
    if (!clickedSignIn) break;
    logs.push(`ph_etravel_signin_entry_clicked attempt=${attempt}`);
    await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
    const transitioned = await page.waitForFunction(() => {
      const current = document.body?.innerText ?? "";
      const loginReady = /enter email address|password|create an account|sign in to etravel/i.test(current);
      const authenticatedReady = /dashboard|new travel declaration|etravel registration|personal information/i.test(current);
      return (loginReady || authenticatedReady) && !/^loading/i.test(current.trim());
    }, undefined, { timeout: 20_000 }).then(() => true).catch(() => false);
    if (transitioned) break;
    logs.push(`ph_etravel_signin_entry_transition_pending attempt=${attempt}`);
    await page.waitForTimeout(2_000);
  }

  const loginText = await bodyText(page);
  if (!/enter email address|password|create an account|sign in to etravel/i.test(loginText)) {
    if (/dashboard|new travel declaration|etravel registration|personal information/i.test(loginText)) {
      await completeEgovPersonalInformationOnboarding(page, payload, options, logs, screenshots);
      logs.push("ph_etravel_login_not_required_after_signin_click");
      return;
    }
    screenshots.push(await saveScreenshot(page, "official-signin-transition-pending", logs));
    throw new PhEtravelPortalError(
      "Official Philippines eTravel sign-in page did not finish loading after the sign-in entry was clicked.",
      {
        code: "ph_etravel_signin_transition_failed",
        screenshotPaths: screenshots,
        portalSummary: loginText.slice(0, 700),
      },
    );
  }

  const email = options.officialAccountEmail?.trim() || process.env.PH_ETRAVEL_ACCOUNT_EMAIL?.trim();
  const password = options.officialAccountPassword?.trim() || process.env.PH_ETRAVEL_ACCOUNT_PASSWORD?.trim();
  if (!email || !password) {
    screenshots.push(await saveScreenshot(page, "official-account-required", logs));
    throw new PhEtravelPortalError(
      "Official Philippines eTravel now requires an eTravel/eGovPH account before the arrival-card form can be opened.",
      {
        code: "ph_etravel_official_account_required",
        screenshotPaths: screenshots,
        portalSummary: loginText.slice(0, 700),
      },
    );
  }

  const fillLoginCredentials = async (): Promise<void> => {
    await page.locator("input[type='email'], input[name*='email' i], input[placeholder*='Email' i]").first().fill(email, { timeout: 15_000 });
    await page.locator("input[type='password'], input[name*='password' i], input[placeholder*='Password' i]").first().fill(password, { timeout: 15_000 });
  };
  await fillLoginCredentials();
  const loginAttempt = await clickTurnstileProtectedContinue(page, logs, nativeCloudflareUnblock, [
    page.getByRole("button", { name: /sign in to etravel|sign in|login/i }),
    page.locator("button").filter({ hasText: /sign in|login/i }),
  ], {
    responseUrlPattern: /\/authenticate(?:[/?]|$)/i,
    prepareRetry: fillLoginCredentials,
  });
  logs.push(
    `ph_etravel_login_response status=${loginAttempt.responseStatus ?? "missing"}` +
    (loginAttempt.responseSummary ? ` summary=${loginAttempt.responseSummary}` : ""),
  );
  if (loginAttempt.responseStatus === undefined) {
    screenshots.push(await saveScreenshot(page, "official-login-request-missing", logs));
    throw new PhEtravelPortalError(
      "Official Philippines eTravel did not accept the login request after Cloudflare verification.",
      {
        code: "ph_etravel_official_login_request_missing",
        screenshotPaths: screenshots,
        portalSummary: loginAttempt.pageText.slice(0, 700),
      },
    );
  }
  if (isPhEtravelRegistrationResponseRejected(loginAttempt.responseStatus)) {
    screenshots.push(await saveScreenshot(page, "official-login-rejected", logs));
    throw new PhEtravelPortalError(
      "Official Philippines eTravel rejected the account login request.",
      {
        code: "ph_etravel_official_login_rejected",
        screenshotPaths: screenshots,
        portalSummary: (loginAttempt.responseSummary || loginAttempt.pageText).slice(0, 700),
      },
    );
  }
  await page.waitForFunction(() => {
    const text = document.body?.innerText ?? "";
    const stillOnLogin = /enter email address|create an account|sign in to etravel/i.test(text);
    return !stillOnLogin && !/^loading/i.test(text.trim());
  }, undefined, { timeout: 45_000 }).catch(() => undefined);
  await page.waitForTimeout(2_000);

  let afterLoginText = await bodyText(page);
  if (/mobile number|use email/i.test(afterLoginText)) {
    afterLoginText = await completeEgovEmailVerification(page, options, email, logs, screenshots);
  }
  if (/important account security notice/i.test(afterLoginText)) {
    await clickFirstAvailable(page, [
      page.getByRole("button", { name: /next|continue/i }),
      page.locator("button").filter({ hasText: /next|continue/i }),
    ]);
    logs.push("ph_etravel_egov_security_notice_acknowledged");
    await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(3_000);
    afterLoginText = await bodyText(page);
  }
  if (/mpin|6[-\s]?digit passcode|enter your passcode/i.test(afterLoginText)) {
    afterLoginText = await fillMpinPrompt(page, options, logs, screenshots);
  }
  afterLoginText = await completeEgovPersonalInformationOnboarding(page, payload, options, logs, screenshots);
  if (/invalid|incorrect|otp|one-time|enter code|captcha|turnstile|verification failed/i.test(afterLoginText)) {
    screenshots.push(await saveScreenshot(page, "official-login-blocked", logs));
    throw new PhEtravelPortalError(
      "Official Philippines eTravel account login needs additional verification before automation can continue.",
      {
        code: "ph_etravel_official_login_verification_required",
        screenshotPaths: screenshots,
        portalSummary: afterLoginText.slice(0, 700),
      },
    );
  }
  logs.push("ph_etravel_official_account_login_attempted");
}

async function completeEgovEmailVerification(
  page: Page,
  options: PhEtravelRunnerOptions,
  accountEmail: string,
  logs: string[],
  screenshots: string[],
): Promise<string> {
  const applicantId = options.applicantId?.trim();
  if (!applicantId) {
    return bodyText(page);
  }
  const clickedUseEmail = await clickFirstAvailable(page, [
    page.getByText(/use email/i),
    page.getByRole("button", { name: /use email/i }),
    page.locator("button, a").filter({ hasText: /use email/i }),
  ]);
  if (!clickedUseEmail) return bodyText(page);

  const since = new Date().toISOString();
  await page.waitForTimeout(1_000);
  await fillFirstVisibleInput(page, [
    "input[type='email']",
    "input[name*='email' i]",
    "input[placeholder*='Email' i]",
  ], accountEmail);
  await fillLastVisibleInput(page, "input:not([type='hidden'])", accountEmail);
  await clickFirstAvailable(page, [
    page.getByRole("button", { name: /next|continue|send|submit/i }),
    page.locator("button").filter({ hasText: /next|continue|send|submit/i }),
  ]);
  await page.waitForTimeout(2_000);

  let text = await bodyText(page);
  if (/otp|code|verification|one[-\s]?time/i.test(text)) {
    const mailbox = options.mailbox ?? createPhEtravelMailboxProvider(applicantId);
    const timeoutMs = options.emailVerificationTimeoutMs
      ?? Number(process.env.PH_ETRAVEL_EMAIL_VERIFICATION_TIMEOUT_MS ?? "180000");
    const otp = await mailbox.waitForOtp({ timeoutMs, since });
    await fillOtpInputs(page, otp);
    const clickedOtpContinue = await clickFirstEnabledAvailable(page, [
      page.getByRole("button", { name: /verify|continue|next|submit/i }),
      page.locator("button").filter({ hasText: /verify|continue|next|submit/i }),
    ]);
    if (!clickedOtpContinue) {
      screenshots.push(await saveScreenshot(page, "egov-email-otp-continue-disabled", logs));
      throw new PhEtravelPortalError(
        "Official Philippines eGovPH email OTP page did not enable the continue button before timeout.",
        {
          code: "ph_etravel_otp_continue_disabled",
          screenshotPaths: screenshots,
          portalSummary: (await bodyText(page)).slice(0, 700),
        },
      );
    }
    logs.push("ph_etravel_egov_email_otp_consumed");
    await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(3_000);
    text = await bodyText(page);
  }

  if (/mobile number|sms|app|captcha|turnstile|verification failed/i.test(text)) {
    screenshots.push(await saveScreenshot(page, "egov-email-verification-blocked", logs));
  }
  return text;
}

async function maybeCreatePhEtravelAccount(
  page: Page,
  payload: PhEtravelPortalPayload,
  options: PhEtravelRunnerOptions,
  logs: string[],
  screenshots: string[],
  nativeCloudflareUnblock = false,
): Promise<boolean> {
  const accountEmail = options.officialAccountEmail?.trim();
  const applicantId = options.applicantId?.trim();
  if (!accountEmail || (!applicantId && !options.mailbox)) return false;

  if (!/create an account/i.test(await bodyText(page))) {
    await clickFirstAvailable(page, [
      page.getByRole("button", { name: /click here to sign in/i }),
      page.getByRole("link", { name: /^sign in$/i }),
      page.locator("button, a").filter({ hasText: /sign in/i }),
    ]);
    await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(1_500);
  }

  const mailbox = options.mailbox ?? createPhEtravelMailboxProvider(applicantId as string);
  let since = new Date().toISOString();
  const clickedCreate = await clickFirstAvailable(page, [
    page.getByText(/create an account/i),
    page.getByRole("link", { name: /create an account/i }),
    page.locator("button, a").filter({ hasText: /create an account/i }),
  ]);
  if (!clickedCreate) return false;

  await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(1_500);
  await fillFirstVisibleInput(page, [
    "input[type='email']",
    "input[name*='email' i]",
    "input[placeholder*='Email' i]",
    "input:not([type='hidden'])",
  ], accountEmail);
  let currentText: string;
  const registrationAttempt = await clickTurnstileProtectedContinue(page, logs, nativeCloudflareUnblock, [
      page.getByRole("button", { name: /continue|next|submit|send/i }),
      page.locator("button").filter({ hasText: /continue|next|submit|send/i }),
    ], {
      responseUrlPattern: /\/api\/v2\/traveller\/email_sign_in(?:\?|$)/,
      prepareRetry: async () => {
        await fillFirstVisibleInput(page, [
          "input[type='email']",
          "input[name*='email' i]",
          "input[placeholder*='Email' i]",
          "input:not([type='hidden'])",
        ], accountEmail);
      },
    });
  currentText = registrationAttempt.pageText;
  const registrationChallengeVisible = await page
    .locator("input[name='cf-turnstile-response'], textarea[name='cf-turnstile-response'], iframe[src*='challenges.cloudflare.com'], .cf-turnstile, [data-sitekey]")
    .first()
    .count()
    .then((count) => count > 0)
    .catch(() => false);
  const registrationContinue = page.getByRole("button", { name: /continue|next|submit|send/i }).first();
  const registrationContinueEnabled = await registrationContinue.isVisible({ timeout: 1_000 }).catch(() => false) &&
    await registrationContinue.isEnabled({ timeout: 1_000 }).catch(() => false);
  const registrationAdvancedToOtp = /enter one[-\s]?time[-\s]?(?:password|code)|\botp\b|resend email code/i.test(currentText);
  if (registrationChallengeVisible && !registrationContinueEnabled && !registrationAdvancedToOtp) {
    screenshots.push(await saveScreenshot(page, "registration-turnstile-failed", logs));
    throw new PhEtravelPortalError(
      "Official Philippines eTravel registration Turnstile could not be solved by the configured browser channel.",
      {
        code: "ph_etravel_registration_turnstile_blocked",
        screenshotPaths: screenshots,
        portalSummary: currentText.slice(0, 700),
      },
    );
  }
  if (
    registrationAttempt.responseStatus !== undefined &&
    isPhEtravelRegistrationResponseRejected(registrationAttempt.responseStatus)
  ) {
    screenshots.push(await saveScreenshot(page, "registration-request-rejected", logs));
    throw new PhEtravelPortalError(
      `Official Philippines eTravel registration request was rejected with HTTP ${registrationAttempt.responseStatus}.`,
      {
        code: "ph_etravel_registration_request_rejected",
        screenshotPaths: screenshots,
        portalSummary: registrationAttempt.responseSummary ?? currentText.slice(0, 700),
      },
    );
  }
  if (/enter one[-\s]?time[-\s]?password|resend email code/i.test(currentText)) {
    const resendButton = page.getByRole("button", { name: /resend email code/i }).first();
    if (
      await resendButton.isVisible({ timeout: 1_000 }).catch(() => false) &&
      await resendButton.isEnabled({ timeout: 1_000 }).catch(() => false)
    ) {
      since = new Date().toISOString();
      await resendButton.click({ timeout: 10_000 });
      logs.push("ph_etravel_registration_otp_resend_clicked");
      await page.waitForTimeout(1_000);
      currentText = await bodyText(page);
    }
  }
  if (/already\s+(?:registered|exists)|account\s+already/i.test(currentText)) {
    logs.push("ph_etravel_alias_account_already_exists");
    return false;
  }
  if (/verification failed|troubleshooting|cloudflare|turnstile|验证失败|故障排除/i.test(currentText)) {
    screenshots.push(await saveScreenshot(page, "registration-turnstile-failed", logs));
    throw new PhEtravelPortalError(
      "Official Philippines eTravel registration Turnstile could not be solved by the configured Browser API.",
      {
        code: "ph_etravel_registration_turnstile_blocked",
        screenshotPaths: screenshots,
        portalSummary: currentText.slice(0, 700),
      },
    );
  }

  const timeoutMs = options.emailVerificationTimeoutMs
    ?? Number(process.env.PH_ETRAVEL_EMAIL_VERIFICATION_TIMEOUT_MS ?? "180000");
  const waitForExistingAccountNotice = () => mailbox
    .waitForExistingAccountNotice({ timeoutMs, since })
    .then(async () => {
      // eGovPH can send a generic registration-attempt notice before sending
      // the actionable OTP for the same successful request. Give the OTP/link
      // pollers time to win before treating that notice as terminal evidence
      // that the account already exists.
      await new Promise((resolve) => setTimeout(resolve, PH_ETRAVEL_EXISTING_ACCOUNT_NOTICE_GRACE_MS));
      return { kind: "existing" as const };
    });
  if (/otp|code|verification|one[-\s]?time/i.test(currentText)) {
    type EmailVerificationResult =
      | { kind: "otp"; otp: string }
      | { kind: "url"; url: URL }
      | { kind: "existing" };
    const emailVerification = await firstSuccessful<EmailVerificationResult>([
      mailbox.waitForOtp({ timeoutMs, since }).then((otp) => ({ kind: "otp" as const, otp })),
      mailbox.waitForVerificationLink({ timeoutMs, since }).then((url) => ({ kind: "url" as const, url })),
      waitForExistingAccountNotice(),
    ]);
    if (emailVerification.kind === "existing") {
      logs.push("ph_etravel_alias_account_already_exists_email");
      return false;
    }
    if (emailVerification.kind === "url") {
      await page.goto(emailVerification.url.toString(), { waitUntil: "domcontentloaded", timeout: 45_000 });
      logs.push("ph_etravel_email_verification_link_opened");
    } else {
      await fillOtpInputs(page, emailVerification.otp);
      await solveTurnstileIfPresent(page, logs, nativeCloudflareUnblock);
      const clickedOtpContinue = await clickFirstEnabledAvailable(page, [
        page.getByRole("button", { name: /verify|continue|next|submit/i }),
        page.locator("button").filter({ hasText: /verify|continue|next|submit/i }),
      ]);
      if (!clickedOtpContinue) {
        screenshots.push(await saveScreenshot(page, "registration-email-otp-continue-disabled", logs));
        throw new PhEtravelPortalError(
          "Official Philippines eTravel registration OTP page did not enable the continue button before timeout.",
          {
            code: "ph_etravel_registration_otp_continue_disabled",
            screenshotPaths: screenshots,
            portalSummary: (await bodyText(page)).slice(0, 700),
          },
        );
      }
      logs.push("ph_etravel_email_otp_consumed");
    }
    await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(2_000);
    currentText = await bodyText(page);
  } else if (!/password|set password|create password/i.test(currentText)) {
    // The current eTravel registration page may keep the email-entry screen
    // visible while it sends either a numeric code or a verification link.
    // Wait for both official delivery shapes instead of assuming a link.
    type EmailVerificationResult =
      | { kind: "otp"; otp: string }
      | { kind: "url"; url: URL }
      | { kind: "existing" };
    const emailVerification = await firstSuccessful<EmailVerificationResult>([
      mailbox.waitForOtp({ timeoutMs, since }).then((otp) => ({ kind: "otp" as const, otp })),
      mailbox.waitForVerificationLink({ timeoutMs, since }).then((url) => ({ kind: "url" as const, url })),
      waitForExistingAccountNotice(),
    ]);
    if (emailVerification.kind === "existing") {
      logs.push("ph_etravel_alias_account_already_exists_email");
      return false;
    }
    if (emailVerification.kind === "url") {
      await page.goto(emailVerification.url.toString(), { waitUntil: "domcontentloaded", timeout: 45_000 });
      logs.push("ph_etravel_email_verification_link_opened");
    } else {
      await fillOtpInputs(page, emailVerification.otp);
      const clickedOtpContinue = await clickFirstEnabledAvailable(page, [
        page.getByRole("button", { name: /verify|continue|next|submit/i }),
        page.locator("button").filter({ hasText: /verify|continue|next|submit/i }),
      ]);
      if (!clickedOtpContinue) {
        screenshots.push(await saveScreenshot(page, "registration-email-otp-continue-disabled", logs));
        throw new PhEtravelPortalError(
          "Official Philippines eTravel registration OTP page did not enable the continue button before timeout.",
          {
            code: "ph_etravel_registration_otp_continue_disabled",
            screenshotPaths: screenshots,
            portalSummary: (await bodyText(page)).slice(0, 700),
          },
        );
      }
      logs.push("ph_etravel_email_otp_consumed");
    }
    await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(2_000);
    currentText = await bodyText(page);
  }

  if (!/password|set password|create password/i.test(currentText)) {
    // OTP verification is an SPA transition. Browserbase can report the click
    // and load-state completion before the create-password route has rendered.
    // Wait for a concrete post-OTP state so registration is not mistaken for a
    // completed authenticated session and redirected back through Sign In.
    await page.waitForFunction(() => {
      const text = document.body?.innerText ?? "";
      return /create your password|password confirmation|mpin|personal information|new travel declaration|travel history/i.test(text)
        || !/verify-email/i.test(window.location.pathname);
    }, undefined, { timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(1_000);
    currentText = await bodyText(page);
  }

  if (/password|set password|create password/i.test(currentText)) {
    const password = options.officialAccountPassword?.trim() || process.env.PH_ETRAVEL_ACCOUNT_PASSWORD?.trim() || payload.passportNumber;
    await page.locator("input[type='password']").nth(0).fill(password, { timeout: 15_000 });
    const confirmPassword = page.locator("input[type='password']").nth(1);
    if (await confirmPassword.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmPassword.fill(password, { timeout: 15_000 });
    }
    const clickedPasswordContinue = await clickFirstEnabledAvailable(page, [
      page.getByRole("button", { name: /continue|next|submit|create|register/i }),
      page.locator("button").filter({ hasText: /continue|next|submit|create|register/i }),
    ], 60_000);
    if (!clickedPasswordContinue) {
      screenshots.push(await saveScreenshot(page, "registration-password-continue-disabled", logs));
      throw new PhEtravelPortalError(
        "Official eTravel password page did not enable Continue after both password fields were filled.",
        {
          code: "ph_etravel_registration_password_continue_disabled",
          screenshotPaths: screenshots,
          portalSummary: (await bodyText(page)).slice(0, 700),
        },
      );
    }
    logs.push("ph_etravel_alias_account_password_submitted");
    await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
    await page.waitForFunction(
      () => !/create your password|password confirmation/i.test(document.body?.innerText ?? ""),
      undefined,
      { timeout: 30_000 },
    ).catch(() => undefined);
    await page.waitForTimeout(2_000);
    currentText = await bodyText(page);
    if (/create your password|password confirmation/i.test(currentText)) {
      screenshots.push(await saveScreenshot(page, "registration-password-still-visible", logs));
      throw new PhEtravelPortalError(
        "Official eTravel remained on the password page after Continue was clicked.",
        {
          code: "ph_etravel_registration_password_not_accepted",
          screenshotPaths: screenshots,
          portalSummary: currentText.slice(0, 700),
        },
      );
    }
  }

  if (/mpin|6[-\s]?digit passcode|enter your passcode/i.test(currentText)) {
    currentText = await fillMpinPrompt(page, options, logs, screenshots);
  }
  currentText = await completeEgovPersonalInformationOnboarding(page, payload, options, logs, screenshots);

  // A rendered Turnstile widget includes its own legal/help text even after a
  // successful challenge. Treat only explicit challenge failures (checked
  // above) and actual non-email verification gates as registration blockers.
  if (/sms verification|sms code|authenticator code|verification failed|troubleshooting/i.test(currentText)) {
    screenshots.push(await saveScreenshot(page, "official-registration-blocked", logs));
    throw new PhEtravelPortalError(
      "Official Philippines eTravel account registration needs a non-email verification step before automation can continue.",
      {
        code: "ph_etravel_official_registration_verification_required",
        screenshotPaths: screenshots,
        portalSummary: currentText.slice(0, 700),
      },
    );
  }

  logs.push("ph_etravel_alias_account_registration_attempted");
  return true;
}

export async function runPhEtravelPortalSubmission(
  payload: PhEtravelPortalPayload,
  options: PhEtravelRunnerOptions = {},
): Promise<PhEtravelPortalSubmissionResult> {
  return runPhEtravelPortalSubmissionWithBrowser(payload, options, false);
}

async function runPhEtravelPortalSubmissionWithBrowser(
  payload: PhEtravelPortalPayload,
  options: PhEtravelRunnerOptions,
  forceLocal: boolean,
): Promise<PhEtravelPortalSubmissionResult> {
  const logs: string[] = [`ph_etravel_start application=${payload.applicationId}`];
  const screenshots: string[] = [];
  const browserSession = await createArrivalCardBrowserSession({
    prefix: "PH_ETRAVEL",
    headless: options.headless,
    forceLocal: options.forceLocalBrowser ? true : forceLocal,
  });
  const page = browserSession.page;
  logs.push(`ph_etravel_browser_provider=${browserSession.provider}`);
  logs.push(...browserSession.diagnostics);

  try {
    await installTurnstileCapture(page);
    await page.goto(PH_ETRAVEL_OFFICIAL_PORTAL_URL, { waitUntil: "domcontentloaded", timeout: 90_000 }).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      const code = /access denied|blocked|policy|proxy_error|forbidden/i.test(message)
        ? "ph_etravel_official_portal_blocked"
        : "ph_etravel_official_portal_navigation_failed";
      throw new PhEtravelPortalError("Official Philippines eTravel portal could not be reached by the runner.", {
        code,
        screenshotPaths: screenshots,
        portalSummary: message.slice(0, 700),
      });
    });
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch((error) => {
      logs.push(`ph_etravel_networkidle_timeout ${error instanceof Error ? error.message : String(error)}`);
    });
    await page.waitForTimeout(1_500);
    screenshots.push(await saveScreenshot(page, "landing", logs));

    const landingText = await bodyText(page);
    if (/access denied|blocked|forbidden|cloudflare|captcha|turnstile/i.test(landingText)) {
      throw new PhEtravelPortalError(
        "Official Philippines eTravel portal blocked access before the form could be opened.",
        {
          code: "ph_etravel_official_portal_blocked",
          screenshotPaths: screenshots,
          portalSummary: landingText.slice(0, 700),
        },
      );
    }

    try {
      let handledRegistration = false;
      if (options.forceAccountRegistration) {
        const created = await maybeCreatePhEtravelAccount(
          page,
          payload,
          options,
          logs,
          screenshots,
          browserSession.nativeCloudflareUnblock,
        );
        if (created) {
          const afterRegistrationText = await bodyText(page);
          if (/new travel declaration|travel history|logout/i.test(afterRegistrationText)) {
            logs.push("ph_etravel_registration_authenticated_session_retained");
          } else {
            await reachAuthenticatedPhEtravelSession(
              page,
              payload,
              options,
              logs,
              screenshots,
              browserSession.nativeCloudflareUnblock,
            );
          }
          handledRegistration = true;
        }
      }
      if (!handledRegistration) {
        await reachAuthenticatedPhEtravelSession(
          page,
          payload,
          options,
          logs,
          screenshots,
          browserSession.nativeCloudflareUnblock,
        );
      }
    } catch (error) {
      if (error instanceof PhEtravelPortalError && error.code === "ph_etravel_official_account_required") {
        const created = await maybeCreatePhEtravelAccount(
          page,
          payload,
          options,
          logs,
          screenshots,
          browserSession.nativeCloudflareUnblock,
        );
        if (!created) throw error;
      } else {
        throw error;
      }
    }
    let authenticatedText = await bodyText(page);
    if (isPhEtravelPublicLandingText(authenticatedText)) {
      logs.push("ph_etravel_post_auth_landing_detected_retrying_login");
      await reachAuthenticatedPhEtravelSession(
        page,
        payload,
        options,
        logs,
        screenshots,
        browserSession.nativeCloudflareUnblock,
      );
      authenticatedText = await bodyText(page);
    }
    if (isPhEtravelPublicLandingText(authenticatedText)) {
      throw new PhEtravelPortalError(
        "Official Philippines eTravel session returned to the public landing page after authentication.",
        {
          code: "ph_etravel_form_authentication_required",
          screenshotPaths: screenshots,
          portalSummary: authenticatedText.slice(0, 700),
        },
      );
    }
    screenshots.push(await saveScreenshot(page, "after-auth", logs));
    let formResult;
    try {
      formResult = await fillPhEtravelOfficialDeclaration(page, payload, {
        stopBeforeSubmit: options.stopBeforeSubmit !== false,
        onStep: async (name) => {
          screenshots.push(await saveScreenshot(page, name, logs));
        },
      });
    } catch (error) {
      if (error instanceof PhEtravelFormFillError) {
        screenshots.push(await saveScreenshot(page, "form-fill-error", logs).catch(() => ""));
        await saveHtmlSnapshot(page, "form-fill-error", logs).catch(() => "");
        throw new PhEtravelPortalError(error.message, {
          code: error.code,
          screenshotPaths: screenshots.filter(Boolean),
          portalSummary: error.portalSummary,
        });
      }
      throw error;
    }

    if (formResult.reachedReview && !formResult.submitted) {
      throw new PhEtravelPortalError(
        "Philippines eTravel form was filled and reached Review; final submit was intentionally not clicked.",
        {
          code: "ph_etravel_stopped_before_submit",
          screenshotPaths: screenshots,
          portalSummary: formResult.portalText.slice(0, 700),
          filledFields: formResult.filledFields,
          reachedReview: true,
        },
      );
    }

    return buildPhEtravelSuccessFromPortalText(
      payload,
      formResult.portalText,
      page.url(),
      screenshots,
      [],
      logs,
    );
  } catch (error) {
    if (
      !forceLocal &&
      browserSession.provider === "remote-browser-api" &&
      error instanceof PhEtravelPortalError &&
      error.code === "ph_etravel_official_portal_blocked" &&
      process.env.PH_ETRAVEL_REQUIRE_BROWSER_API?.trim() === "false" &&
      isPhEtravelRemotePolicyBlockMessage(error.portalSummary ?? error.message)
    ) {
      logs.push("ph_etravel_remote_policy_blocked_fallback_to_local");
      return runPhEtravelPortalSubmissionWithBrowser(payload, options, true);
    }
    if (!(error instanceof PhEtravelPortalError)) {
      screenshots.push(await saveScreenshot(page, "unexpected-error", logs).catch(() => ""));
      const message = error instanceof Error ? error.message : String(error);
      throw new PhEtravelPortalError(message, {
        code: "ph_etravel_unexpected_portal_error",
        screenshotPaths: screenshots.filter(Boolean),
        portalSummary: (await bodyText(page)).slice(0, 700),
        logs,
      });
    }
    error.logs = logs;
    throw error;
  } finally {
    await browserSession.close();
  }
}

export function buildPhEtravelSuccessFromPortalText(
  payload: PhEtravelPortalPayload,
  portalText: string,
  portalUrl: string,
  screenshots: string[],
  pdfs: string[],
  logs: string[],
): PhEtravelPortalSubmissionResult {
  const referenceNumber = extractReference(portalText);
  if (!referenceNumber || !hasQrEvidence(portalText)) {
    throw new PhEtravelPortalError(
      "Official Philippines eTravel confirmation did not include both a reference and QR-code evidence.",
      {
        code: "ph_etravel_confirmation_evidence_missing",
        screenshotPaths: screenshots,
        portalSummary: portalText.slice(0, 700),
      },
    );
  }
  return {
    submitted: true,
    confirmationNumber: referenceNumber,
    referenceNumber,
    portalUrl,
    portalResponseSummary: "Philippines eTravel official portal returned a QR/reference confirmation.",
    screenshots,
    pdfs,
    logs: [`ph_etravel_submitted application=${payload.applicationId}`, ...logs],
  };
}
