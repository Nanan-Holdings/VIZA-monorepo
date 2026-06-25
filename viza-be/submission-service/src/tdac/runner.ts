import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { chromium, type Page } from "@playwright/test";
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
  const browser = await chromium.launch({ headless: options.headless ?? true });
  const page = await browser.newPage({ acceptDownloads: true });

  try {
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
      const text = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
      throw new TdacPortalError(
        "Official TDAC Arrival Card button is disabled by the portal; the runner cannot start a new submission in this browser session.",
        {
          code: "tdac_arrival_button_disabled",
          screenshotPaths: screenshots,
          portalSummary: text.slice(0, 500),
        },
      );
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
    await browser.close();
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
