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

export async function runPhEtravelPortalSubmission(
  payload: PhEtravelPortalPayload,
  options: { headless?: boolean; stopBeforeSubmit?: boolean } = {},
): Promise<PhEtravelPortalSubmissionResult> {
  const logs: string[] = [`ph_etravel_start application=${payload.applicationId}`];
  const screenshots: string[] = [];
  const browserSession = await createArrivalCardBrowserSession({
    prefix: "PH_ETRAVEL",
    headless: options.headless,
  });
  const page = browserSession.page;
  logs.push(`ph_etravel_browser_provider=${browserSession.provider}`);
  logs.push(...browserSession.diagnostics);

  try {
    await page.goto(PH_ETRAVEL_OFFICIAL_PORTAL_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });
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

    throw new PhEtravelPortalError(
      "Philippines eTravel official form selector mapping is incomplete; live submit is blocked until the portal flow is mapped end to end.",
      {
        code: "ph_etravel_selector_mapping_incomplete",
        screenshotPaths: screenshots,
        portalSummary: landingText.slice(0, 700),
      },
    );
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
