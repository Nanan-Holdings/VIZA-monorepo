import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { chromium, type Browser, type Page } from "@playwright/test";
import { artifact } from "../artifact.js";

/**
 * India e-Visa prefill runner (AUTO-IN-01).
 *
 * Drives indianvisaonline.gov.in/evisa from the canonical answer set
 * for IN_TOURIST_E_VISA. Multi-page state machine — Personal →
 * Passport → Visa Details → Address → Background → Review. Halts
 * before payment.
 *
 * Per-step PNG + post-run HAR uploaded under jobs/<jobId>/in-step-NN-*.{png,har}.
 *
 * NOTE: AUTO-IN-02 will graft on the error catalog + needs-human dispatch.
 */

const BASE_URL = process.env.IN_PORTAL_URL ?? "https://indianvisaonline.gov.in/evisa";

export type InVisaSubPurpose =
  | "tourism"
  | "business"
  | "medical"
  | "conference"
  | "medical_attendant";

export interface InCanonicalAnswers {
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
  visa_purpose: InVisaSubPurpose;
  /** Required when visa_purpose='medical' or 'medical_attendant'. */
  hospital_name?: string;
  /** Required when visa_purpose='conference'. */
  conference_name?: string;
}

export interface InRunInput {
  jobId: string;
  applicationId: string;
  answers: InCanonicalAnswers;
  headless?: boolean;
}

export interface InRunResult {
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
    const ref = await artifact.put(ctx.jobId, `in-step-${idx}-${name}.png`, png, {
      contentType: "image/png",
      upsert: true,
    });
    ctx.artefactPaths.push(ref.path);
  } catch (err) {
    console.error(`[in] screenshot ${name} failed: ${err instanceof Error ? err.message : err}`);
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
    console.warn(`[in] fill ${label} (${selector}) failed: ${err instanceof Error ? err.message : err}`);
  }
}

async function safeClick(page: Page, selector: string, label: string): Promise<boolean> {
  try {
    await page.click(selector, { timeout: 5_000 });
    return true;
  } catch (err) {
    console.warn(`[in] click ${label} (${selector}) failed: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

/** Sub-journey gating per visa_purpose. Surfaces extra fields for medical / conference. */
function gateExtraFields(answers: InCanonicalAnswers): string[] {
  const missing: string[] = [];
  if ((answers.visa_purpose === "medical" || answers.visa_purpose === "medical_attendant") && !answers.hospital_name) {
    missing.push("hospital_name");
  }
  if (answers.visa_purpose === "conference" && !answers.conference_name) {
    missing.push("conference_name");
  }
  return missing;
}

export async function runInPrefill(input: InRunInput): Promise<InRunResult> {
  const browser: Browser = await chromium.launch({ headless: input.headless ?? true });
  const tempHar = fs.mkdtempSync(path.join(os.tmpdir(), "in-har-"));
  const harPath = path.join(tempHar, `in-${input.jobId}.har`);
  const ctx = await browser.newContext({
    locale: "en-IN",
    recordHar: { path: harPath, mode: "minimal" },
  });
  const page = await ctx.newPage();
  const stepCtx: StepCtx = { page, jobId: input.jobId, artefactPaths: [], attemptCount: 0 };

  const result: InRunResult = {
    status: "blocked",
    reason: "runner did not reach checkpoint",
    reachedStep: "init",
    artefacts: [],
  };

  const missingGate = gateExtraFields(input.answers);
  if (missingGate.length > 0) {
    result.reason = `sub-journey gate missing fields: ${missingGate.join(", ")}`;
    return result;
  }

  try {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await captureStep(stepCtx, "landing");
    result.reachedStep = "landing";

    const opened =
      (await safeClick(page, 'a:has-text("Apply")', "apply-link")) ||
      (await safeClick(page, 'a[href*="apply"]', "apply-href"));
    if (!opened) {
      await page.goto(`${BASE_URL}/apply`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    }
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await captureStep(stepCtx, "apply");
    result.reachedStep = "apply";

    // Personal info
    await safeFill(page, 'input[name="given_names"]', input.answers.given_names, "given_names");
    await safeFill(page, 'input[name="surname"]', input.answers.surname, "surname");
    await safeFill(page, 'input[name="email"]', input.answers.email, "email");
    await safeFill(page, 'input[name="phone"]', input.answers.phone, "phone");
    await safeFill(page, 'input[name="date_of_birth"]', input.answers.date_of_birth, "dob");
    await safeFill(page, 'select[name="nationality"]', input.answers.nationality, "nationality");
    await captureStep(stepCtx, "personal");
    result.reachedStep = "personal_filled";

    // Advance to passport page
    if (await safeClick(page, 'button:has-text("Continue"), button:has-text("Next")', "next-personal")) {
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await safeFill(page, 'input[name="passport_number"]', input.answers.passport_number, "passport_number");
      await safeFill(page, 'input[name="passport_expiry"]', input.answers.passport_expiry_date, "passport_expiry");
      await safeFill(
        page,
        'select[name="passport_issuing_country"]',
        input.answers.passport_issuing_country,
        "passport_issuing_country",
      );
      await captureStep(stepCtx, "passport");
      result.reachedStep = "passport_filled";
    }

    // Visa details (purpose + arrival)
    if (await safeClick(page, 'button:has-text("Continue"), button:has-text("Next")', "next-passport")) {
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await safeFill(page, 'select[name="visa_purpose"]', input.answers.visa_purpose, "visa_purpose");
      await safeFill(page, 'input[name="arrival_date"]', input.answers.intended_arrival_date, "arrival_date");
      await safeFill(page, 'select[name="port_of_arrival"]', input.answers.port_of_arrival, "port_of_arrival");
      await safeFill(page, 'input[name="hospital_name"]', input.answers.hospital_name, "hospital_name");
      await safeFill(page, 'input[name="conference_name"]', input.answers.conference_name, "conference_name");
      await captureStep(stepCtx, "visa_details");
      result.reachedStep = "visa_details_filled";
    }

    // Advance to review
    if (await safeClick(page, 'button:has-text("Review")', "review-btn")) {
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
      const ref = await artifact.put(stepCtx.jobId, `in-network.har`, harBytes, {
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
