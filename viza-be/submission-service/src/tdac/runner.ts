import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { type Download, type Page } from "@playwright/test";
import { solveCaptcha } from "../captcha";
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

  constructor(message: string, options: { code: string; screenshotPaths?: string[]; portalSummary?: string }) {
    super(message);
    this.name = "TdacPortalError";
    this.code = options.code;
    this.screenshotPaths = options.screenshotPaths ?? [];
    this.portalSummary = options.portalSummary;
  }
}

async function saveScreenshot(page: Page, name: string, logs: string[]): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "viza-tdac-"));
  const filePath = path.join(dir, `${name}-${Date.now()}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  logs.push(`tdac_screenshot ${filePath}`);
  return filePath;
}

async function saveConfirmationPagePdf(page: Page, logs: string[]): Promise<string | null> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "viza-tdac-confirmation-pdf-"));
  const filePath = path.join(dir, `tdac-confirmation-${Date.now()}.pdf`);
  try {
    await page.emulateMedia({ media: "screen" }).catch(() => undefined);
    await page.pdf({
      path: filePath,
      format: "A4",
      printBackground: true,
      margin: {
        top: "12mm",
        right: "10mm",
        bottom: "12mm",
        left: "10mm",
      },
    });
    const size = fs.statSync(filePath).size;
    if (size < 10_000) {
      logs.push(`tdac_confirmation_page_pdf_too_small bytes=${size}`);
      return null;
    }
    logs.push(`tdac_confirmation_page_pdf_saved ${filePath} bytes=${size}`);
    return filePath;
  } catch (error) {
    logs.push(`tdac_confirmation_page_pdf_failed ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    return null;
  }
}

interface TurnstileParams {
  sitekey: string | null;
  action: string | null;
  cData: string | null;
  chlPageData: string | null;
  pageUrl: string;
  userAgent: string;
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

async function readTurnstileParams(page: Page): Promise<TurnstileParams> {
  return page.evaluate(() => {
    const w = window as typeof window & {
      __vizaTurnstileParams?: Record<string, unknown>;
    };
    const captured = w.__vizaTurnstileParams ?? {};
    const elementSitekey = document.querySelector("[data-sitekey]")?.getAttribute("data-sitekey");
    const iframeSitekey = Array.from(document.querySelectorAll<HTMLIFrameElement>("iframe"))
      .map((iframe) => {
        try {
          const url = new URL(iframe.src);
          return url.searchParams.get("sitekey") ?? url.searchParams.get("k");
        } catch {
          return null;
        }
      })
      .find((value): value is string => Boolean(value));
    const capturedSitekey = typeof captured.sitekey === "string" && captured.sitekey.trim()
      ? captured.sitekey
      : null;
    const capturedAction = typeof captured.action === "string" && captured.action.trim()
      ? captured.action
      : null;
    const capturedCData = typeof captured.cData === "string" && captured.cData.trim()
      ? captured.cData
      : null;
    const capturedChlPageData = typeof captured.chlPageData === "string" && captured.chlPageData.trim()
      ? captured.chlPageData
      : null;
    const capturedPageUrl = typeof captured.pageUrl === "string" && captured.pageUrl.trim()
      ? captured.pageUrl
      : null;
    const capturedUserAgent = typeof captured.userAgent === "string" && captured.userAgent.trim()
      ? captured.userAgent
      : null;

    return {
      sitekey: capturedSitekey ?? elementSitekey ?? iframeSitekey ?? null,
      action: capturedAction,
      cData: capturedCData,
      chlPageData: capturedChlPageData,
      pageUrl: capturedPageUrl ?? window.location.href,
      userAgent: capturedUserAgent ?? navigator.userAgent,
    };
  });
}

async function waitForTurnstileParams(page: Page, timeoutMs = 15_000): Promise<TurnstileParams> {
  const started = Date.now();
  let latest = await readTurnstileParams(page);
  while (!latest.sitekey && Date.now() - started < timeoutMs) {
    await page.waitForTimeout(250);
    latest = await readTurnstileParams(page);
  }
  return latest;
}

async function applyTurnstileToken(page: Page, token: string): Promise<void> {
  await page.evaluate((captchaToken) => {
    const w = window as typeof window & {
      __vizaTurnstileCallback?: (token: string) => void;
    };
    const fields = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      "input[name='cf-turnstile-response'], textarea[name='cf-turnstile-response'], input[name='g-recaptcha-response'], textarea[name='g-recaptcha-response']",
    );
    fields.forEach((field) => {
      field.value = captchaToken;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    });
    if (typeof w.__vizaTurnstileCallback === "function") {
      w.__vizaTurnstileCallback(captchaToken);
    }
  }, token);
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

async function solveWithBrowserApiCaptchaCdp(page: Page, logs: string[]): Promise<void> {
  try {
    logs.push("tdac_brightdata_captcha_solve_started");
    const session = await page.context().newCDPSession(page);
    const sendBrightDataCommand = session.send as unknown as (
      method: string,
      params?: Record<string, unknown>,
    ) => Promise<unknown>;
    const result = await sendBrightDataCommand("Captcha.solve", { detectTimeout: 30_000 });
    logs.push(`tdac_brightdata_captcha_solve_result ${JSON.stringify(result)}`);
  } catch (error) {
    logs.push(`tdac_brightdata_captcha_solve_failed ${error instanceof Error ? error.message : String(error)}`);
  }
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

async function solveTurnstileIfPresent(page: Page, logs: string[]): Promise<boolean> {
  if (await clickTurnstileCheckboxIfVisible(page, logs)) return true;

  const params = await waitForTurnstileParams(page);
  if (!params.sitekey) return false;

  logs.push("tdac_turnstile_solve_started");
  const solve = await solveCaptcha({
    type: "turnstile",
    siteKey: params.sitekey,
    pageUrl: params.pageUrl,
    action: params.action ?? undefined,
    cdata: params.cData ?? undefined,
    pageData: params.chlPageData ?? undefined,
    userAgent: params.userAgent,
    timeoutMs: 120_000,
  });
  await applyTurnstileToken(page, solve.text);
  logs.push(`tdac_turnstile_solved durationMs=${solve.durationMs} solveId=${solve.solveId}`);
  await page.waitForTimeout(3_000);
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
  return true;
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

function splitTravellerName(fullName: string): { familyName: string; firstName: string; middleName: string } {
  const parts = fullName.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { familyName: parts[0] ?? "NA", firstName: "NA", middleName: "NA" };
  }
  return {
    familyName: parts[0],
    firstName: parts.slice(1).join(" "),
    middleName: "NA",
  };
}

async function fillInput(page: Page, selector: string, value: string, logs: string[]): Promise<void> {
  const field = page.locator(selector).first();
  await field.waitFor({ state: "visible", timeout: 30_000 });
  await field.fill(value, { timeout: 15_000 });
  await field.blur().catch(() => undefined);
  logs.push(`tdac_filled ${selector}`);
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
  const option = page.locator("mat-option, .mat-mdc-option, [role='option']").filter({ hasText: optionText }).first();
  await option.waitFor({ state: "visible", timeout: 20_000 });
  await option.click({ timeout: 15_000 });
  logs.push(`tdac_selected_mat ${selector}`);
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
      throw new TdacPortalError("Official TDAC portal returned an error after final submit.", {
        code: "tdac_official_submit_error",
        screenshotPaths: screenshots,
        portalSummary: normalized.slice(0, 1_000),
      });
    }

    await page.waitForTimeout(2_000);
  }

  screenshots.push(await saveScreenshot(page, "after-submit-timeout", logs));
  throw new TdacPortalError("Official TDAC final confirmation page was not reached after final submit.", {
    code: "tdac_final_confirmation_not_reached",
    screenshotPaths: screenshots,
    portalSummary: latestText.replace(/\s+/g, " ").trim().slice(0, 1_000),
  });
}

async function downloadTdacPdfIfAvailable(page: Page, logs: string[]): Promise<string[]> {
  const pdfs: string[] = [];
  let confirmationPagePdf: string | null | undefined;
  const addConfirmationPagePdfFallback = async () => {
    if (confirmationPagePdf === undefined) {
      confirmationPagePdf = await saveConfirmationPagePdf(page, logs);
    }
    if (confirmationPagePdf && !pdfs.includes(confirmationPagePdf)) {
      pdfs.push(confirmationPagePdf);
    }
  };

  const saveDownload = async (download: Download | null): Promise<string | null> => {
    if (!download) return null;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "viza-tdac-pdf-"));
    const suggested = download.suggestedFilename() || `tdac-confirmation-${Date.now()}.pdf`;
    const safeName = suggested.toLowerCase().endsWith(".pdf") ? suggested : `${suggested}.pdf`;
    const filePath = path.join(dir, safeName.replace(/[<>:"/\\|?*]+/g, "-"));
    try {
      await download.saveAs(filePath);
      logs.push(`tdac_pdf_downloaded ${filePath}`);
      return filePath;
    } catch (error) {
      logs.push(`tdac_pdf_save_failed ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
      return null;
    }
  };

  const trigger = page.locator("a, button", { hasText: /download|pdf|print/i }).first();
  if (!(await trigger.isVisible({ timeout: 5_000 }).catch(() => false))) {
    logs.push("tdac_pdf_download_not_visible");
    await addConfirmationPagePdfFallback();
    return pdfs;
  }
  confirmationPagePdf = await saveConfirmationPagePdf(page, logs);

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
  if (pdfs.length === 0) logs.push("tdac_pdf_download_unavailable_after_success");
  if (pdfs.length === 0) {
    await addConfirmationPagePdfFallback();
  }
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

async function fillTdacPersonalStep(page: Page, payload: TdacPortalPayload, logs: string[]): Promise<void> {
  const name = splitTravellerName(payload.fullName);
  const dob = dateParts(payload.dateOfBirth);
  await fillInput(page, "#mat-input-0", name.familyName, logs);
  await fillInput(page, "#mat-input-1", name.firstName, logs);
  await fillInput(page, "#mat-input-2", name.middleName || "NA", logs);
  await fillInput(page, "#mat-input-3", payload.passportNumber.toUpperCase(), logs);
  const nationality = payload.nationality.toUpperCase() === "CHINA" ? "CHINESE" : payload.nationality.toUpperCase();
  await selectAutocomplete(page, "#mat-input-25", nationality, logs);
  await selectAutocomplete(page, "#mat-input-18", dob.year, logs);
  await selectAutocomplete(page, "#mat-input-19", dob.month, logs);
  await selectAutocomplete(page, "#mat-input-20", dob.day, logs);
  await fillInput(page, "#mat-input-4", payload.occupation.toUpperCase(), logs);
  await clickRadioByText(page, payload.sex, logs);
  await fillInput(page, "#mat-input-5", "-", logs);
  await selectAutocomplete(page, "#mat-input-26", "CHN", logs, /CHN\s*:\s*CHINA/i);
  await waitForEnabled(page, "#mat-input-27", logs);
  await selectAutocomplete(page, "#mat-input-27", "CHANGSHA", logs, /CHANGSHA|HUNAN|CHINA/i);
  await fillInput(page, "#mat-input-6", "86", logs);
  await fillInput(page, "#mat-input-7", payload.mobileNumber.replace(/^\+?86/, ""), logs);
  await saveScreenshot(page, "personal-before-continue", logs);
  await clickFirstEnabledButton(page, /^Continue$/i, logs);
}

async function fillTdacTripStep(page: Page, payload: TdacPortalPayload, logs: string[]): Promise<void> {
  const arrival = dateParts(payload.arrivalDate);
  const departure = dateParts(payload.departureDate);
  const sameDayArrivalDeparture = payload.arrivalDate === payload.departureDate;
  await page.waitForTimeout(2_000);
  await fillInput(page, "#mat-input-8", arrival.slashDate, logs);
  await selectAutocomplete(page, "#mat-input-28", "SGP", logs, /SGP\s*:\s*SINGAPORE|SINGAPORE/i);
  await selectMatSelect(page, "mat-select[formcontrolname='traPurposeId']", /Holiday|Sightseeing|Leisure/i, logs);
  await clickRadioByText(page, "AIR", logs, 0);
  await selectMatSelect(page, "mat-select[formcontrolname='tranModeId']", /COMMERCIAL\s+FLIGHT/i, logs);
  await fillInput(page, "#mat-input-11", payload.transportNumber.toUpperCase(), logs);
  if (sameDayArrivalDeparture) {
    await checkTransitPassenger(page, logs);
  }
  await fillInput(page, "#mat-input-12", departure.slashDate, logs);
  await clickRadioByText(page, "AIR", logs, 1);
  await selectMatSelect(page, "mat-select[formcontrolname='deptTranModeId']", /COMMERCIAL\s+FLIGHT/i, logs);
  await fillInput(page, "#mat-input-14", payload.transportNumber.toUpperCase(), logs);
  await page.keyboard.press("Tab").catch(() => undefined);
  await saveScreenshot(page, "trip-before-accommodation", logs);
  const accommodationEnabled = await waitForMatSelectEnabled(page, "mat-select[formcontrolname='accTypeId']", logs, 5_000)
    .then(() => true)
    .catch(() => false);
  if (accommodationEnabled && !sameDayArrivalDeparture) {
    const province = payload.province.toUpperCase();
    const district = payload.district.toUpperCase();
    const subDistrict = (payload.subDistrict || "LUMPHINI").toUpperCase();
    const postalCode = payload.postalCode || "10330";
    await selectMatSelect(page, "mat-select[formcontrolname='accTypeId']", /HOTEL/i, logs);
    await selectAutocomplete(page, "#mat-input-29", province, logs, new RegExp(province.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    await selectAutocomplete(page, "#mat-input-30", district, logs, new RegExp(district.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    await selectAutocomplete(page, "#mat-input-31", subDistrict, logs, new RegExp(subDistrict.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    await forceSetInput(page, "#mat-input-16", postalCode, logs);
    await forceSetInput(page, "#mat-input-17", payload.addressInThailand, logs);
  } else if (sameDayArrivalDeparture) {
    logs.push("tdac_same_day_transit_skip_accommodation");
  } else {
    logs.push("tdac_accommodation_disabled_by_portal_skip");
  }
  await clickFirstEnabledButton(page, /^Continue$/i, logs);
}

async function fillTdacHealthStep(page: Page, payload: TdacPortalPayload, logs: string[]): Promise<void> {
  await page.waitForTimeout(1_000);
  await selectAutocomplete(page, "#mat-mdc-chip-list-input-0", "CHN", logs, /CHN\s*:\s*CHINA|CHINA/i);
  await clickFirstEnabledButton(page, /^Preview$/i, logs);
}

export async function runTdacPortalSubmission(
  payload: TdacPortalPayload,
  options: { headless?: boolean; stopBeforeSubmit?: boolean } = {},
): Promise<TdacPortalSubmissionResult> {
  const logs: string[] = [`tdac_start application=${payload.applicationId}`];
  const screenshots: string[] = [];
  const browserSession = await createArrivalCardBrowserSession({
    prefix: "TDAC",
    headless: options.headless,
  });
  const page = browserSession.page;
  logs.push(`tdac_browser_provider=${browserSession.provider}`);
  logs.push(...browserSession.diagnostics);

  try {
    if (!browserSession.nativeCloudflareUnblock) {
      await installTurnstileHook(page);
    } else {
      logs.push("tdac_brightdata_native_cloudflare_unblock_enabled");
    }
    await page.goto(TDAC_OFFICIAL_PORTAL_URL, { waitUntil: "domcontentloaded", timeout: 120_000 }).catch((error) => {
      logs.push(`tdac_goto_domcontentloaded_timeout_continue ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    });
    await page.waitForTimeout(8_000);
    await page.locator("button", { hasText: /arrival card/i }).first().waitFor({
      state: "visible",
      timeout: 90_000,
    }).catch(() => undefined);
    screenshots.push(await saveScreenshot(page, "landing", logs));

    const arrivalButton = page.locator("button", { hasText: /arrival card/i }).first();
    if ((await arrivalButton.count()) === 0) {
      const text = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
      throw new TdacPortalError("Official TDAC Arrival Card button was not found on the portal landing page.", {
        code: "tdac_arrival_button_not_found",
        screenshotPaths: screenshots,
        portalSummary: text.slice(0, 500),
      });
    }
    if (await arrivalButton.isDisabled().catch(() => false)) {
      screenshots.push(await saveScreenshot(page, "turnstile-before-solve", logs));
      if (browserSession.nativeCloudflareUnblock) {
        await solveWithBrowserApiCaptchaCdp(page, logs);
        logs.push("tdac_waiting_for_browser_api_cloudflare_clearance");
        await waitForArrivalButtonEnabled(page, 120_000);
      } else {
        await solveTurnstileIfPresent(page, logs);
      }
      await page.waitForTimeout(3_000);
      screenshots.push(await saveScreenshot(page, "turnstile-after-solve", logs));
      if (await arrivalButton.isDisabled().catch(() => false)) {
        const text = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
        const remoteBrowserFailure = browserSession.diagnostics.find((line) =>
          line.startsWith("tdac_remote_browser_api_failed"),
        );
        const message = remoteBrowserFailure
          ? "Official TDAC Arrival Card button remained disabled after Cloudflare Turnstile verification. The configured Browser API endpoint could not be used; verify the Browser API zone is active, credentials are current, and any IP allowlist permits this workstation."
          : "Official TDAC Arrival Card button remained disabled after Turnstile solve.";
        throw new TdacPortalError(
          message,
          {
            code: "tdac_arrival_button_disabled_after_captcha",
            screenshotPaths: screenshots,
            portalSummary: [
              remoteBrowserFailure,
              text.slice(0, 500),
            ].filter(Boolean).join("\n\n"),
          },
        );
      }
    }

    await arrivalButton.click({ timeout: 15_000 }).catch((error) => {
      logs.push(`tdac_arrival_click_continue_to_route ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    });
    await page.waitForTimeout(3_000);
    const addRoute = "https://tdac.immigration.go.th/arrival-card/#/tac/arrival-card/add";
    let personalFormReady = await page.locator("#mat-input-0").first().isVisible({ timeout: 5_000 }).catch(() => false);
    for (let attempt = 1; !personalFormReady && attempt <= 3; attempt += 1) {
      logs.push(`tdac_open_add_route_attempt=${attempt}`);
      await page.goto(addRoute, {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
      }).catch((error) => {
        logs.push(`tdac_direct_add_route_timeout_continue attempt=${attempt} ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
      });
      personalFormReady = await page.locator("#mat-input-0").first().isVisible({ timeout: 45_000 }).catch(() => false);
      if (!personalFormReady) {
        await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => undefined);
        personalFormReady = await page.locator("#mat-input-0").first().isVisible({ timeout: 30_000 }).catch(() => false);
      }
    }
    screenshots.push(await saveScreenshot(page, "after-entry", logs));
    if (!personalFormReady) {
      const text = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
      throw new TdacPortalError("Official TDAC form did not finish loading after retries.", {
        code: "tdac_form_not_loaded",
        screenshotPaths: screenshots,
        portalSummary: text.slice(0, 500),
      });
    }

    await fillTdacPersonalStep(page, payload, logs);
    await page.waitForTimeout(3_000);
    screenshots.push(await saveScreenshot(page, "after-personal", logs));

    await fillTdacTripStep(page, payload, logs);
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
