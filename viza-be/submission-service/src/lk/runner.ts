import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { chromium, type Browser, type Page } from "@playwright/test";
import { artifact } from "../artifact.js";

/**
 * Sri Lanka ETA prefill runner (AUTO-LK-01).
 *
 * Drives the public eta.gov.lk form from the canonical answer set
 * for LK_ETA and **stops before payment**. Per-step screenshot and
 * a network HAR upload via INFRA-006 artifact.put under
 * `jobs/<jobId>/lk-step-NN-<name>.{png,har}`.
 */

const BASE_URL = process.env.LK_PORTAL_URL ?? "https://www.eta.gov.lk";

export interface LkCanonicalAnswers {
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
  port_of_arrival?: string;
  occupation?: string;
  address_in_sri_lanka?: string;
  /** "Tourist single" | "Tourist double" | "Tourist multiple" | "Business single" */
  visa_variant?: string;
}

export interface LkRunInput {
  jobId: string;
  applicationId: string;
  answers: LkCanonicalAnswers;
  headless?: boolean;
}

export interface LkRunResult {
  status: "stopped_before_pay" | "blocked" | "anti_bot_gate" | "needs_human";
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
    const ref = await artifact.put(ctx.jobId, `lk-step-${idx}-${name}.png`, png, {
      contentType: "image/png",
      upsert: true,
    });
    ctx.artefactPaths.push(ref.path);
  } catch (err) {
    console.error(`[lk] screenshot ${name} failed: ${err instanceof Error ? err.message : err}`);
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
    console.warn(`[lk] fill ${label} (${selector}) failed: ${err instanceof Error ? err.message : err}`);
  }
}

async function safeClick(page: Page, selector: string, label: string): Promise<boolean> {
  try {
    await page.click(selector, { timeout: 5_000 });
    return true;
  } catch (err) {
    console.warn(`[lk] click ${label} (${selector}) failed: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

export async function runLkPrefill(input: LkRunInput): Promise<LkRunResult> {
  const browser: Browser = await chromium.launch({ headless: input.headless ?? true });
  const tempHar = fs.mkdtempSync(path.join(os.tmpdir(), "lk-har-"));
  const harPath = path.join(tempHar, `lk-${input.jobId}.har`);
  const ctx = await browser.newContext({
    locale: "en-US",
    recordHar: { path: harPath, mode: "minimal" },
  });
  const page = await ctx.newPage();
  const stepCtx: StepCtx = { page, jobId: input.jobId, artefactPaths: [], attemptCount: 0 };

  const result: LkRunResult = {
    status: "blocked",
    reason: "runner did not reach checkpoint",
    reachedStep: "init",
    artefacts: [],
  };

  try {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await captureStep(stepCtx, "landing");
    result.reachedStep = "landing";

    if ((await page.title()).toLowerCase().includes("just a moment")) {
      result.status = "anti_bot_gate";
      result.reason = "cloudflare challenge on landing";
      return result;
    }

    // Click into the apply path.
    const opened =
      (await safeClick(page, 'a:has-text("Apply")', "apply-link")) ||
      (await safeClick(page, 'a[href*="apply"]', "apply-href"));
    if (!opened) {
      await page.goto(`${BASE_URL}/index.jsp`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
    }
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await captureStep(stepCtx, "apply");
    result.reachedStep = "apply";

    // Personal info — selectors loose, derived from recon walker.
    await safeFill(page, 'input[name="surname"]', input.answers.surname, "surname");
    await safeFill(page, 'input[name="given_name"]', input.answers.given_names, "given_names");
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
    await safeFill(page, 'select[name="port_of_arrival"]', input.answers.port_of_arrival, "port_of_arrival");
    await safeFill(page, 'input[name="occupation"]', input.answers.occupation, "occupation");
    await safeFill(page, 'input[name="address_in_sri_lanka"]', input.answers.address_in_sri_lanka, "address_in_sri_lanka");
    await safeFill(page, 'select[name="visa_variant"]', input.answers.visa_variant, "visa_variant");
    await captureStep(stepCtx, "personal_filled");
    result.reachedStep = "personal_filled";

    // Advance to review.
    const advanced = await safeClick(page, 'button:has-text("Next"), button:has-text("Continue")', "next-personal");
    if (advanced) {
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await captureStep(stepCtx, "review");
      result.reachedStep = "review";
    }

    result.status = "stopped_before_pay";
    result.reason = "runner halted at the review step before payment";
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
      const ref = await artifact.put(stepCtx.jobId, `lk-network.har`, harBytes, {
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
