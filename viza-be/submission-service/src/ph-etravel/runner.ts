import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { Page } from "@playwright/test";
import { createArrivalCardBrowserSession } from "../arrival-card-browser";
import { PH_ETRAVEL_REFERENCE_PATTERNS } from "./official-options";
import { PH_ETRAVEL_OFFICIAL_PORTAL_URL, type PhEtravelPortalPayload } from "./normalize";

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

  constructor(message: string, options: { code: string; screenshotPaths?: string[]; portalSummary?: string }) {
    super(message);
    this.name = "PhEtravelPortalError";
    this.code = options.code;
    this.screenshotPaths = options.screenshotPaths ?? [];
    this.portalSummary = options.portalSummary;
  }
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

async function bodyText(page: Page): Promise<string> {
  return page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
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

async function clickFirstAvailable(page: Page, locators: Array<ReturnType<Page["locator"]>>): Promise<boolean> {
  for (const locator of locators) {
    const target = locator.first();
    if (await target.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await target.click({ timeout: 10_000 });
      return true;
    }
  }
  return false;
}

async function reachAuthenticatedPhEtravelSession(page: Page, logs: string[], screenshots: string[]): Promise<void> {
  const signedInAlready = /dashboard|new travel declaration|etravel registration|personal information/i.test(await bodyText(page));
  if (signedInAlready && !/enter email address|password|create an account/i.test(await bodyText(page))) {
    logs.push("ph_etravel_existing_session_detected");
    return;
  }

  const clickedSignIn = await clickFirstAvailable(page, [
    page.getByRole("button", { name: /click here to sign in/i }),
    page.getByRole("link", { name: /^sign in$/i }),
    page.locator("button, a").filter({ hasText: /sign in/i }),
  ]);
  if (clickedSignIn) {
    await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(1_500);
  }

  const loginText = await bodyText(page);
  if (!/enter email address|password|create an account|sign in to etravel/i.test(loginText)) {
    logs.push("ph_etravel_login_not_required_after_signin_click");
    return;
  }

  const email = process.env.PH_ETRAVEL_ACCOUNT_EMAIL?.trim();
  const password = process.env.PH_ETRAVEL_ACCOUNT_PASSWORD?.trim();
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

  await page.locator("input[type='email'], input[name*='email' i], input[placeholder*='Email' i]").first().fill(email, { timeout: 15_000 });
  await page.locator("input[type='password'], input[name*='password' i], input[placeholder*='Password' i]").first().fill(password, { timeout: 15_000 });
  await clickFirstAvailable(page, [
    page.getByRole("button", { name: /sign in to etravel|sign in|login/i }),
    page.locator("button").filter({ hasText: /sign in|login/i }),
  ]);
  await page.waitForLoadState("domcontentloaded", { timeout: 45_000 }).catch(() => undefined);
  await page.waitForTimeout(3_000);

  const afterLoginText = await bodyText(page);
  if (/invalid|incorrect|verification|otp|one-time|enter code|captcha|turnstile/i.test(afterLoginText)) {
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

export async function runPhEtravelPortalSubmission(
  payload: PhEtravelPortalPayload,
  options: { headless?: boolean; stopBeforeSubmit?: boolean } = {},
): Promise<PhEtravelPortalSubmissionResult> {
  return runPhEtravelPortalSubmissionWithBrowser(payload, options, false);
}

async function runPhEtravelPortalSubmissionWithBrowser(
  payload: PhEtravelPortalPayload,
  options: { headless?: boolean; stopBeforeSubmit?: boolean },
  forceLocal: boolean,
): Promise<PhEtravelPortalSubmissionResult> {
  const logs: string[] = [`ph_etravel_start application=${payload.applicationId}`];
  const screenshots: string[] = [];
  const browserSession = await createArrivalCardBrowserSession({
    prefix: "PH_ETRAVEL",
    headless: options.headless,
    forceLocal,
  });
  const page = browserSession.page;
  logs.push(`ph_etravel_browser_provider=${browserSession.provider}`);
  logs.push(...browserSession.diagnostics);

  try {
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

    if (options.stopBeforeSubmit !== false) {
      throw new PhEtravelPortalError(
        "Philippines eTravel runner stopped before final submit because PH_ETRAVEL_STOP_BEFORE_SUBMIT is enabled.",
        {
          code: "ph_etravel_stopped_before_submit",
          screenshotPaths: screenshots,
          portalSummary: landingText.slice(0, 700),
        },
      );
    }

    await reachAuthenticatedPhEtravelSession(page, logs, screenshots);
    screenshots.push(await saveScreenshot(page, "after-auth", logs));

    throw new PhEtravelPortalError(
      "Philippines eTravel official form selector mapping is incomplete; live submit is blocked until the portal flow is mapped end to end.",
      {
        code: "ph_etravel_selector_mapping_incomplete",
        screenshotPaths: screenshots,
        portalSummary: landingText.slice(0, 700),
      },
    );
  } catch (error) {
    if (
      !forceLocal &&
      browserSession.provider === "remote-browser-api" &&
      error instanceof PhEtravelPortalError &&
      error.code === "ph_etravel_official_portal_blocked" &&
      isPhEtravelRemotePolicyBlockMessage(error.portalSummary ?? error.message)
    ) {
      logs.push("ph_etravel_remote_policy_blocked_fallback_to_local");
      return runPhEtravelPortalSubmissionWithBrowser(payload, options, true);
    }
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
