import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { type Page } from "@playwright/test";
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
    /(?:reference|arrival card|application|registration)\s*(?:no\.?|number|id)?\s*[:#-]?\s*([A-Z0-9-]{6,})/i,
    /\b(TDAC[A-Z0-9-]{6,})\b/i,
  ];
  for (const pattern of candidates) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
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
    await page.goto(TDAC_OFFICIAL_PORTAL_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(8_000);
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

    await arrivalButton.click({ timeout: 15_000 });
    await page.waitForTimeout(3_000);
    screenshots.push(await saveScreenshot(page, "after-entry", logs));

    const currentText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
    if (options.stopBeforeSubmit) {
      throw new TdacPortalError("TDAC runner stopped before final submit because TDAC_STOP_BEFORE_SUBMIT is enabled.", {
        code: "tdac_stopped_before_submit",
        screenshotPaths: screenshots,
        portalSummary: currentText.slice(0, 500),
      });
    }

    throw new TdacPortalError(
      "Official Thailand TDAC form was opened, but this runner could not identify a stable final submit path. Selector inventory is required for this portal version.",
      {
        code: "tdac_selector_inventory_required",
        screenshotPaths: screenshots,
        portalSummary: currentText.slice(0, 500),
      },
    );
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
