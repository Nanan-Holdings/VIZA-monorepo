import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { chromium, type Browser, type Page } from "@playwright/test";
import { artifact } from "../artifact.js";
import { classifyPage, type AuRunnerError } from "./errors";
import { inbox, type InboundMessage } from "../inbox/wait-for-message.js";
import { extractAuto } from "../inbox/extractors/index.js";

/**
 * Australia Subclass 600 (Visitor Visa) runner (AUTO-AU-01 + AUTO-AU-02).
 *
 * Drives ImmiAccount for the Subclass 600 lodgement; halts before
 * the digital signature + payment step. Per-step PNG + post-run HAR.
 */

const BASE_URL = process.env.AU_PORTAL_URL ?? "https://online.immi.gov.au";

export interface AuCanonicalAnswers {
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
  occupation?: string;
  visit_purpose?: "tourism" | "business" | "family";
  /** ImmiAccount login email — applicant or VIZA-managed sub-account. */
  immi_account_email: string;
  /** ImmiAccount login password — fetched from per-applicant vault, not from canonical answers. */
  immi_account_password_ref: string;
}

export interface AuRunInput {
  jobId: string;
  applicationId: string;
  answers: AuCanonicalAnswers;
  headless?: boolean;
}

export interface AuRunResult {
  status: "stopped_before_signature" | "blocked" | "anti_bot_gate" | "needs_human";
  reason: string;
  reachedStep: string;
  artefacts: string[];
  error?: AuRunnerError;
}

export async function waitForAuConfirmationEmail(
  applicantId: string,
  timeoutMs: number = 60_000,
): Promise<{ message: InboundMessage; reference: string | null }> {
  const message = await inbox.waitForMessage(
    applicantId,
    (m) => /immi\.gov\.au|homeaffairs/i.test(m.from_addr),
    timeoutMs,
  );
  const parsed = extractAuto({
    from: message.from_addr,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  return { message, reference: parsed.reference ?? null };
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
    const ref = await artifact.put(ctx.jobId, `au-step-${idx}-${name}.png`, png, {
      contentType: "image/png",
      upsert: true,
    });
    ctx.artefactPaths.push(ref.path);
  } catch (err) {
    console.error(`[au] screenshot ${name} failed: ${err instanceof Error ? err.message : err}`);
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
    console.warn(`[au] fill ${label} (${selector}) failed: ${err instanceof Error ? err.message : err}`);
  }
}

async function safeClick(page: Page, selector: string, label: string): Promise<boolean> {
  try {
    await page.click(selector, { timeout: 5_000 });
    return true;
  } catch (err) {
    console.warn(`[au] click ${label} (${selector}) failed: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

export async function runAuPrefill(input: AuRunInput): Promise<AuRunResult> {
  const browser: Browser = await chromium.launch({ headless: input.headless ?? true });
  const tempHar = fs.mkdtempSync(path.join(os.tmpdir(), "au-har-"));
  const harPath = path.join(tempHar, `au-${input.jobId}.har`);
  const ctx = await browser.newContext({
    locale: "en-AU",
    recordHar: { path: harPath, mode: "minimal" },
  });
  const page = await ctx.newPage();
  const stepCtx: StepCtx = { page, jobId: input.jobId, artefactPaths: [], attemptCount: 0 };

  const result: AuRunResult = {
    status: "blocked",
    reason: "runner did not reach checkpoint",
    reachedStep: "init",
    artefacts: [],
  };

  const probe = async (): Promise<AuRunnerError | null> => {
    const title = (await page.title()).slice(0, 200);
    const bodyText = (
      await page.locator("body").innerText({ timeout: 2_000 }).catch(() => "")
    ).slice(0, 1024);
    return classifyPage({ title, bodyText });
  };
  const dispatchError = (err: AuRunnerError): AuRunResult => {
    result.error = err;
    result.reason = `${err.code}: ${err.message}`;
    if (err.disposition === "human") result.status = "needs_human";
    else if (err.code === "au.anti_bot.cloudflare") result.status = "anti_bot_gate";
    else result.status = "blocked";
    return result;
  };

  try {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await captureStep(stepCtx, "landing");
    result.reachedStep = "landing";
    const landingErr = await probe();
    if (landingErr) return dispatchError(landingErr);

    // ImmiAccount login. The password lives in the per-applicant vault
    // and the loader is a separate concern (see secrets/vault.ts).
    await safeFill(page, 'input[name="username"]', input.answers.immi_account_email, "username");
    await safeFill(page, 'input[name="password"]', input.answers.immi_account_password_ref, "password_ref");
    if (await safeClick(page, 'button:has-text("Login")', "login")) {
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
      await captureStep(stepCtx, "logged_in");
      result.reachedStep = "logged_in";
    }

    // Start a new Subclass 600 application
    if (await safeClick(page, 'a:has-text("New application")', "new-application")) {
      await safeClick(page, 'a:has-text("Visitor")', "visitor-flow");
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await captureStep(stepCtx, "subclass_600");
      result.reachedStep = "subclass_600";
    }

    // Personal info
    await safeFill(page, 'input[name="given_names"]', input.answers.given_names, "given_names");
    await safeFill(page, 'input[name="family_name"]', input.answers.surname, "surname");
    await safeFill(page, 'input[name="email"]', input.answers.email, "email");
    await safeFill(page, 'input[name="phone"]', input.answers.phone, "phone");
    await safeFill(page, 'input[name="date_of_birth"]', input.answers.date_of_birth, "dob");
    await safeFill(page, 'select[name="nationality"]', input.answers.nationality, "nationality");
    await safeFill(page, 'input[name="passport_number"]', input.answers.passport_number, "passport_number");
    await safeFill(page, 'input[name="passport_expiry"]', input.answers.passport_expiry_date, "passport_expiry");
    await safeFill(page, 'input[name="arrival_date"]', input.answers.intended_arrival_date, "arrival_date");
    await safeFill(page, 'input[name="departure_date"]', input.answers.intended_departure_date, "departure_date");
    await safeFill(page, 'select[name="visit_purpose"]', input.answers.visit_purpose, "visit_purpose");
    await captureStep(stepCtx, "personal_filled");
    result.reachedStep = "personal_filled";

    // Advance to the digital-signature page (we halt before signing)
    if (await safeClick(page, 'button:has-text("Continue"), button:has-text("Next")', "next-personal")) {
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await captureStep(stepCtx, "review");
      result.reachedStep = "review";
      const reviewErr = await probe();
      if (reviewErr) return dispatchError(reviewErr);
    }

    result.status = "stopped_before_signature";
    result.reason = "runner halted at the declaration / signature step before payment";
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
      const ref = await artifact.put(stepCtx.jobId, `au-network.har`, harBytes, {
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

/**
 * RUN-AU-001: runner_job dispatch entrypoint. Wraps the au-visitor halt flow
 * (loadAuAccount + fillVisitor600Application, outcome "review_reached" ->
 * halted_before_pay) from src/queue/halt-runners.ts (QUE-005). Legacy
 * submission_queue AU transitions in index.ts remain compatible.
 */
export { runAuHalt as runOne } from "../queue/halt-runners.js";
