import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { chromium, type Browser, type Page } from "@playwright/test";
import { artifact } from "../artifact.js";

/**
 * South Africa eVisa prefill runner (AUTO-ZA-01).
 *
 * Drives the public ZA eVisa portal from the canonical answer set
 * for ZA_TOURIST_E_VISA and **stops before payment / signature**.
 * Per-step screenshot + a network HAR are uploaded via INFRA-006
 * artifact.put under `jobs/<jobId>/za-step-NN-<name>.{png,har}`.
 *
 * NOTE: AUTO-ZA-02 will graft on the error catalog + needs-human
 * dispatch path (mirrors la/runner.ts shape).
 */

const BASE_URL = process.env.ZA_PORTAL_URL ?? "https://visa.vfsglobal.com/zaf/en/dha";

export interface ZaCanonicalAnswers {
  surname: string;
  given_names: string;
  date_of_birth: string;
  nationality: string;
  passport_number: string;
  passport_expiry_date: string;
  passport_issuing_country: string;
  email: string;
  phone: string;
  intended_arrival_date: string;
  intended_departure_date?: string;
  purpose_of_visit?: string;
  occupation?: string;
}

export interface ZaRunInput {
  jobId: string;
  applicationId: string;
  answers: ZaCanonicalAnswers;
  headless?: boolean;
}

export interface ZaRunResult {
  status: "stopped_before_pay" | "blocked" | "anti_bot_gate";
  reason: string;
  reachedStep: string;
  artefacts: string[];
}

interface StepCtx {
  page: Page;
  jobId: string;
  artefactPaths: string[];
  attemptCount: number;
}

async function captureStep(ctx: StepCtx, name: string): Promise<void> {
  ctx.attemptCount += 1;
  const idx = String(ctx.attemptCount).padStart(2, "0");
  try {
    const png = await ctx.page.screenshot({ fullPage: true });
    const ref = await artifact.put(ctx.jobId, `za-step-${idx}-${name}.png`, png, {
      contentType: "image/png",
      upsert: true,
    });
    ctx.artefactPaths.push(ref.path);
  } catch (err) {
    console.error(`[za] screenshot ${name} failed: ${err instanceof Error ? err.message : err}`);
  }
}

async function safeFill(
  page: Page,
  selector: string,
  value: string | undefined,
  label: string,
): Promise<void> {
  if (!value) return;
  try {
    await page.fill(selector, value, { timeout: 5_000 });
  } catch (err) {
    console.warn(`[za] fill ${label} (${selector}) failed: ${err instanceof Error ? err.message : err}`);
  }
}

async function safeClick(page: Page, selector: string, label: string): Promise<boolean> {
  try {
    await page.click(selector, { timeout: 5_000 });
    return true;
  } catch (err) {
    console.warn(`[za] click ${label} (${selector}) failed: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

async function detectAntiBotGate(page: Page): Promise<boolean> {
  try {
    const title = (await page.title()).toLowerCase();
    if (title.includes("just a moment")) return true;
    const body = await page.locator("body").innerText({ timeout: 2_000 }).catch(() => "");
    return /checking your browser|cloudflare/i.test(body);
  } catch {
    return false;
  }
}

export async function runZaPrefill(input: ZaRunInput): Promise<ZaRunResult> {
  const browser: Browser = await chromium.launch({ headless: input.headless ?? true });
  const tempHar = fs.mkdtempSync(path.join(os.tmpdir(), "za-har-"));
  const harPath = path.join(tempHar, `za-${input.jobId}.har`);
  const ctx = await browser.newContext({
    locale: "en-ZA",
    recordHar: { path: harPath, mode: "minimal" },
  });
  const page = await ctx.newPage();
  const stepCtx: StepCtx = { page, jobId: input.jobId, artefactPaths: [], attemptCount: 0 };

  const result: ZaRunResult = {
    status: "blocked",
    reason: "runner did not reach checkpoint",
    reachedStep: "init",
    artefacts: [],
  };

  try {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await captureStep(stepCtx, "landing");
    result.reachedStep = "landing";
    if (await detectAntiBotGate(page)) {
      result.status = "anti_bot_gate";
      result.reason = "VFS Global anti-bot interstitial blocked the runner";
      return result;
    }

    const opened =
      (await safeClick(page, 'a:has-text("Apply")', "apply-link")) ||
      (await safeClick(page, 'a[href*="/apply"]', "apply-href")) ||
      (await safeClick(page, 'a:has-text("Start application")', "start-application"));
    if (!opened) {
      await page.goto(`${BASE_URL}/apply`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    }
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await captureStep(stepCtx, "apply");
    result.reachedStep = "apply";

    await safeFill(page, 'input[name="given_names"]', input.answers.given_names, "given_names");
    await safeFill(page, 'input[name="surname"]', input.answers.surname, "surname");
    await safeFill(page, 'input[name="email"]', input.answers.email, "email");
    await safeFill(page, 'input[name="phone"]', input.answers.phone, "phone");
    await safeFill(page, 'input[name="date_of_birth"]', input.answers.date_of_birth, "dob");
    await safeFill(page, 'select[name="nationality"]', input.answers.nationality, "nationality");
    await safeFill(page, 'input[name="passport_number"]', input.answers.passport_number, "passport_number");
    await safeFill(page, 'input[name="passport_expiry"]', input.answers.passport_expiry_date, "passport_expiry");
    await safeFill(
      page,
      'select[name="passport_issuing_country"]',
      input.answers.passport_issuing_country,
      "passport_issuing_country",
    );
    await safeFill(page, 'input[name="arrival_date"]', input.answers.intended_arrival_date, "arrival_date");
    await safeFill(page, 'input[name="departure_date"]', input.answers.intended_departure_date, "departure_date");
    await safeFill(page, 'select[name="purpose"]', input.answers.purpose_of_visit, "purpose");
    await safeFill(page, 'input[name="occupation"]', input.answers.occupation, "occupation");
    await captureStep(stepCtx, "personal_filled");
    result.reachedStep = "personal_filled";

    const advanced = await safeClick(
      page,
      'button:has-text("Next"), button:has-text("Continue")',
      "next-personal",
    );
    if (advanced) {
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await captureStep(stepCtx, "review");
      result.reachedStep = "review";
    }

    result.status = "stopped_before_pay";
    result.reason = "runner halted at the review step before payment / signature";
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Timeout/i.test(msg)) {
      result.status = "blocked";
      result.reason = `timeout: ${msg}`;
    } else {
      result.reason = msg;
    }
    await captureStep(stepCtx, "error");
    return result;
  } finally {
    await ctx.close().catch(() => {});
    await browser.close().catch(() => {});
    try {
      const harBytes = fs.readFileSync(harPath);
      const ref = await artifact.put(stepCtx.jobId, `za-network.har`, harBytes, {
        contentType: "application/json",
        upsert: true,
      });
      stepCtx.artefactPaths.push(ref.path);
    } catch {
      // HAR may not exist
    }
    fs.rmSync(tempHar, { recursive: true, force: true });
    result.artefacts = stepCtx.artefactPaths;
  }
}
