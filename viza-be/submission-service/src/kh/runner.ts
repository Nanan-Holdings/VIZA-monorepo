import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { chromium, type Browser, type Page } from "@playwright/test";
import { artifact } from "../artifact.js";
import { classifyPage, type KhRunnerError } from "./errors";
import { KH_SELECTORS } from "./selectors";
import { inbox, type InboundMessage } from "../inbox/wait-for-message.js";
import { extractAuto } from "../inbox/extractors/index.js";

/**
 * Cambodia e-Visa prefill runner (AUTO-KH-01 + AUTO-KH-02).
 *
 * Drives the public evisa.gov.kh form from the canonical answer set
 * for KH_TOURIST_E_VISA and **stops before payment**. The runner
 * never clicks the final submit / pay button — the applicant signs
 * + pays in their own session, or VIZA's escrow card pays via the
 * runner once the payment-routing escrow flow is wired in
 * (PAY-003 mechanism `runner_escrow_card`).
 *
 * Public form, no auth gate, no per-applicant credentials. Each run
 * captures a screenshot + HAR + console log under
 * `jobs/<jobId>/kh-step-NNN.{png,har,log}` via INFRA-006's
 * artifact.put().
 */

const BASE_URL = process.env.KH_PORTAL_URL ?? "https://www.evisa.gov.kh";

export interface KhCanonicalAnswers {
  surname: string;
  given_names: string;
  date_of_birth: string; // YYYY-MM-DD
  nationality: string;   // ISO 3166-1 alpha-3
  passport_number: string;
  passport_expiry_date: string; // YYYY-MM-DD
  passport_issuing_country: string;
  email: string;
  phone: string;
  /** Optional photo + passport scan storage paths in the artefact bucket. */
  photo_storage_path?: string;
  passport_scan_storage_path?: string;
  /** "Tourist" — KH currently has only one e-Visa product. */
  visa_purpose?: string;
}

export interface KhRunInput {
  jobId: string;
  applicationId: string;
  answers: KhCanonicalAnswers;
  /** Override headless mode for ops triage. Defaults to true. */
  headless?: boolean;
}

export interface KhRunResult {
  status: "stopped_before_pay" | "blocked" | "anti_bot_gate" | "needs_human";
  reason: string;
  /** Last step the runner reached. */
  reachedStep: string;
  /** Artefact paths recorded. */
  artefacts: string[];
  /** When status='needs_human', the structured error code that triggered escalation. */
  error?: KhRunnerError;
}

/**
 * Pull a KH portal confirmation email from the applicant inbox
 * (AUTO-KH-02). KH sends an account-less confirmation referencing
 * an Application ID — we wait up to 60 s by default.
 */
export async function waitForKhConfirmationEmail(
  applicantId: string,
  timeoutMs: number = 60_000,
): Promise<{ message: InboundMessage; reference: string | null }> {
  const message = await inbox.waitForMessage(
    applicantId,
    (m) => /evisa\.gov\.kh|cambodia/i.test(m.from_addr),
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
    const ref = await artifact.put(ctx.jobId, `kh-step-${idx}-${name}.png`, png, {
      contentType: "image/png",
      upsert: true,
    });
    ctx.artefactPaths.push(ref.path);
  } catch (err) {
    console.error(`[kh] screenshot ${name} failed: ${err instanceof Error ? err.message : err}`);
  }
}

async function safeClick(page: Page, selector: string, label: string): Promise<boolean> {
  try {
    await page.click(selector, { timeout: 5_000 });
    return true;
  } catch (err) {
    console.warn(`[kh] click ${label} (${selector}) failed: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

async function safeFill(
  page: Page,
  selector: string,
  value: string,
  label: string,
): Promise<void> {
  try {
    await page.fill(selector, value, { timeout: 5_000 });
  } catch (err) {
    console.warn(`[kh] fill ${label} (${selector}) failed: ${err instanceof Error ? err.message : err}`);
  }
}

export async function runKhPrefill(input: KhRunInput): Promise<KhRunResult> {
  const browser: Browser = await chromium.launch({
    headless: input.headless ?? true,
  });
  const tempHar = fs.mkdtempSync(path.join(os.tmpdir(), "kh-har-"));
  const harPath = path.join(tempHar, `kh-${input.jobId}.har`);
  const ctx = await browser.newContext({
    locale: "en-US",
    recordHar: { path: harPath, mode: "minimal" },
  });
  const page = await ctx.newPage();
  const stepCtx: StepCtx = {
    page,
    jobId: input.jobId,
    artefactPaths: [],
    attemptCount: 0,
  };

  const result: KhRunResult = {
    status: "blocked",
    reason: "runner did not reach checkpoint",
    reachedStep: "init",
    artefacts: [],
  };

  try {
    // Helper: classify the current page and bail if anything's off.
    const probe = async (): Promise<KhRunnerError | null> => {
      const title = (await page.title()).slice(0, 200);
      const bodyText = (
        await page.locator("body").innerText({ timeout: 2_000 }).catch(() => "")
      ).slice(0, 1024);
      return classifyPage({ title, bodyText });
    };
    const dispatchError = (err: KhRunnerError): KhRunResult => {
      result.error = err;
      result.reason = `${err.code}: ${err.message}`;
      if (err.disposition === "human") {
        result.status = "needs_human";
      } else if (err.code === "kh.anti_bot.cloudflare") {
        result.status = "anti_bot_gate";
      } else {
        result.status = "blocked";
      }
      return result;
    };

    // 01 — landing.
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await captureStep(stepCtx, "landing");
    result.reachedStep = "landing";
    const landingErr = await probe();
    if (landingErr) return dispatchError(landingErr);

    // 02 — open New Application route.
    await page.goto(`${BASE_URL}/application_new`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await captureStep(stepCtx, "application_new");
    result.reachedStep = "application_new";

    // 03 — fill personal info. Selectors derive from form-recon.ts walker;
    // KH renders a Livewire-driven SPA with stable name attributes.
    await safeFill(page, KH_SELECTORS.last_name, input.answers.surname, "surname");
    await safeFill(page, KH_SELECTORS.first_name, input.answers.given_names, "given_names");
    await safeFill(page, KH_SELECTORS.email, input.answers.email, "email");
    await safeFill(page, KH_SELECTORS.phone, input.answers.phone, "phone");
    await safeFill(page, KH_SELECTORS.date_of_birth, input.answers.date_of_birth, "dob");
    await safeFill(page, KH_SELECTORS.nationality, input.answers.nationality, "nationality");
    await safeFill(page, KH_SELECTORS.passport_number, input.answers.passport_number, "passport_number");
    await safeFill(page, KH_SELECTORS.passport_expiry, input.answers.passport_expiry_date, "passport_expiry");
    await safeFill(
      page,
      KH_SELECTORS.passport_issuing_country,
      input.answers.passport_issuing_country,
      "passport_issuing_country",
    );
    await captureStep(stepCtx, "personal_filled");
    result.reachedStep = "personal_filled";

    // 04 — advance to review. The KH form's "Next" button typically has
    // wire:click hooks; we rely on a stable text match.
    const advanced = await safeClick(page, KH_SELECTORS.next_button, "next-personal");
    if (advanced) {
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await captureStep(stepCtx, "review");
      result.reachedStep = "review";
      const reviewErr = await probe();
      if (reviewErr) return dispatchError(reviewErr);
    }

    // 05 — STOP before final submit / pay. We deliberately do NOT
    // click any button matching /pay|submit|confirm/i.
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
      const ref = await artifact.put(stepCtx.jobId, `kh-network.har`, harBytes, {
        contentType: "application/json",
        upsert: true,
      });
      stepCtx.artefactPaths.push(ref.path);
    } catch {
      // HAR may not exist if the run failed before context close.
    }
    fs.rmSync(tempHar, { recursive: true, force: true });
    result.artefacts = stepCtx.artefactPaths;
  }
}
