import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { chromium, type Page } from "@playwright/test";
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

function extractReference(text: string): string | null {
  const candidates = [
    /(?:reference|ref|application|registration)\s*(?:no\.?|number|id)?\s*[:#-]?\s*([A-Z0-9-]{6,})/i,
    /\b(MDAC[A-Z0-9-]{6,})\b/i,
  ];
  for (const pattern of candidates) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

export async function runMdacPortalSubmission(
  payload: MdacPortalPayload,
  options: { headless?: boolean; stopBeforeSubmit?: boolean } = {},
): Promise<MdacPortalSubmissionResult> {
  const logs: string[] = [`mdac_start application=${payload.applicationId}`];
  const screenshots: string[] = [];
  const browser = await chromium.launch({ headless: options.headless ?? true });
  const page = await browser.newPage({ acceptDownloads: true });

  try {
    await page.goto(MDAC_OFFICIAL_PORTAL_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(4_000);
    const bodyText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
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

    const entry = page
      .locator("a,button", { hasText: /register|submit|arrival|mdac|apply|new/i })
      .first();
    if ((await entry.count()) > 0) {
      await entry.click({ timeout: 10_000 }).catch((error) => {
        logs.push(`mdac_entry_click_failed ${error instanceof Error ? error.message : String(error)}`);
      });
      await page.waitForTimeout(2_000);
      screenshots.push(await saveScreenshot(page, "after-entry", logs));
    }

    const currentText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => bodyText);
    if (options.stopBeforeSubmit) {
      throw new MdacPortalError("MDAC runner stopped before final submit because MDAC_STOP_BEFORE_SUBMIT is enabled.", {
        code: "mdac_stopped_before_submit",
        screenshotPaths: screenshots,
        portalSummary: currentText.slice(0, 500),
      });
    }

    throw new MdacPortalError(
      "Official Malaysia MDAC form is reachable but this runner could not identify a stable final submit path. Selector inventory is required for this portal version.",
      {
        code: "mdac_selector_inventory_required",
        screenshotPaths: screenshots,
        portalSummary: currentText.slice(0, 500),
      },
    );
  } finally {
    await browser.close();
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
