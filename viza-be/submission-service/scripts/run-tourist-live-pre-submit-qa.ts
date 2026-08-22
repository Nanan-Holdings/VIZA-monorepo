#!/usr/bin/env npx tsx
/**
 * Read-only live QA for CA/TR/IN/SA/AE tourist product entry points.
 *
 * It may select harmless public dropdown values, but never enters credentials,
 * solves a CAPTCHA, clicks Continue/Next, creates an application, uploads a
 * document, accepts a declaration, pays, or submits.
 */
import "dotenv/config";
import { chromium, type Browser, type Page } from "@playwright/test";
import {
  TOURIST_LIVE_CHECKPOINTS,
  type TouristLiveCountry,
} from "../src/tourist-live-checkpoints.js";

interface QaResult {
  country: TouristLiveCountry;
  product: string;
  ok: boolean;
  finalUrl: string;
  boundary: string;
  missing: string[];
  note: string;
}

async function missingSelectors(page: Page, selectors: readonly string[]): Promise<string[]> {
  const missing: string[] = [];
  for (const selector of selectors) {
    if ((await page.locator(selector).count()) === 0) missing.push(selector);
  }
  return missing;
}

async function setNativeSelectByLabel(
  page: Page,
  selector: string,
  label: string,
): Promise<void> {
  const matched = await page.evaluate(
    ({ selector: selectSelector, label: optionLabel }) => {
      const select = document.querySelector(selectSelector) as HTMLSelectElement | null;
      if (!select) return false;
      const option = Array.from(select.options).find(
        (candidate) => candidate.text.trim().toLowerCase() === optionLabel.toLowerCase(),
      );
      if (!option) return false;
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    },
    { selector, label },
  );
  if (!matched) throw new Error(`${selector}: option not found: ${label}`);
}

async function setNativeSelectByValue(
  page: Page,
  selector: string,
  value: string,
): Promise<void> {
  const matched = await page.evaluate(
    ({ selector: selectSelector, value: optionValue }) => {
      const select = document.querySelector(selectSelector) as HTMLSelectElement | null;
      if (!select || !Array.from(select.options).some((option) => option.value === optionValue)) {
        return false;
      }
      select.value = optionValue;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    },
    { selector, value },
  );
  if (!matched) throw new Error(`${selector}: option value not found: ${value}`);
}

async function openTurkeyApplication(page: Page): Promise<void> {
  if (new URL(page.url()).hostname === "dtvgroup.com.tr") {
    await page.getByRole("button", { name: /Apply for an e-Visa/i }).click({ timeout: 20_000 });
    await page.waitForLoadState("domcontentloaded");
  }
  if ((await page.locator("#vizeturuList").count()) === 0) {
    await page.getByRole("link", { name: /Apply Now/i }).click({ timeout: 20_000 });
    await page.waitForSelector("#vizeturuList", { state: "attached", timeout: 30_000 });
  }
}

async function runCountry(page: Page, country: TouristLiveCountry): Promise<QaResult> {
  const checkpoint = TOURIST_LIVE_CHECKPOINTS[country];
  await page.goto(checkpoint.url, { waitUntil: "domcontentloaded", timeout: 60_000 });

  if (country === "india") {
    const apply = page.getByRole("link", { name: /Apply here for e-visa/i });
    await apply.click({ timeout: 20_000 });
    await page.waitForSelector("#nationality_id", { timeout: 30_000 });
    await page.selectOption("#nationality_id", { label: "CHINA-CHINA" });
    await page.selectOption("#ppt_type_id", { label: "ORDINARY PASSPORT" });
  } else if (country === "turkey") {
    await openTurkeyApplication(page);
    await setNativeSelectByValue(page, "#vizeturuList", "1");
    await page.waitForTimeout(1_000);
    await setNativeSelectByValue(page, "#uyruklist", "CHN");
    await page.waitForTimeout(1_000);
    await setNativeSelectByValue(page, "#belgelist", "UMP");
  } else if (country === "saudi_arabia") {
    await setNativeSelectByLabel(page, "#PassportType", "Regular Passport");
    await setNativeSelectByLabel(page, "#Nationality", "China");
  } else if (country === "united_arab_emirates") {
    const heading = TOURIST_LIVE_CHECKPOINTS.united_arab_emirates.requiredText;
    await page
      .waitForFunction(
        (expected) => (document.body?.innerText ?? "").includes(expected),
        heading,
        { timeout: 20_000 },
      )
      .catch(async () => {
        await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
        await page.waitForTimeout(10_000);
      });
  }

  const requiredSelectors = "requiredSelectors" in checkpoint
    ? checkpoint.requiredSelectors
    : [];
  const missing = await missingSelectors(page, requiredSelectors);
  if ("requiredText" in checkpoint) {
    const body = await page.locator("body").innerText().catch(() => "");
    if (!body.includes(checkpoint.requiredText)) missing.push("expected product heading");
  }

  return {
    country,
    product: checkpoint.product,
    ok: missing.length === 0,
    finalUrl: page.url(),
    boundary: checkpoint.expectedBoundary,
    missing,
    note: "Stopped before credentials/CAPTCHA/Continue/application creation/payment/submission",
  };
}

async function launchBrowser(): Promise<Browser> {
  const headless = process.env.TOURIST_QA_HEADFUL !== "1";
  try {
    return await chromium.launch({ channel: "chrome", headless });
  } catch {
    return chromium.launch({ headless });
  }
}

async function main(): Promise<void> {
  const browser = await launchBrowser();
  const results: QaResult[] = [];
  try {
    for (const country of Object.keys(TOURIST_LIVE_CHECKPOINTS) as TouristLiveCountry[]) {
      const context = await browser.newContext({ locale: "en-US" });
      const page = await context.newPage();
      try {
        results.push(await runCountry(page, country));
      } catch (error) {
        results.push({
          country,
          product: TOURIST_LIVE_CHECKPOINTS[country].product,
          ok: false,
          finalUrl: page.url(),
          boundary: "qa_error",
          missing: [],
          note: error instanceof Error ? error.message : String(error),
        });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify({ capturedAt: new Date().toISOString(), results }, null, 2));
  if (results.some((result) => !result.ok)) process.exitCode = 1;
}

void main();
