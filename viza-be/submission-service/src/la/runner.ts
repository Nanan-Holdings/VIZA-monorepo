import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { chromium, type Browser, type Page } from "@playwright/test";
import { artifact } from "../artifact.js";
import { classifyPage, type LaRunnerError } from "./errors";
import { LA_SELECTORS } from "./selectors";
import { inbox, type InboundMessage } from "../inbox/wait-for-message.js";
import { extractAuto } from "../inbox/extractors/index.js";

/**
 * Laos Tourist e-Visa prefill runner (AUTO-LA-01 + AUTO-LA-02).
 *
 * Drives the public laoevisa.gov.la form from the canonical answer
 * set for LA_TOURIST_E_VISA and **stops before payment**. Per-step
 * screenshot + a network HAR are uploaded via INFRA-006 artifact.put
 * under `jobs/<jobId>/la-step-NN-<name>.{png,har}`.
 */

const BASE_URL = process.env.LA_PORTAL_URL ?? "https://laoevisa.gov.la";

export interface LaCanonicalAnswers {
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
  port_of_entry?: string;
  occupation?: string;
}

export interface LaRunInput {
  jobId: string;
  applicationId: string;
  answers: LaCanonicalAnswers;
  headless?: boolean;
}

export interface LaRunResult {
  status: "stopped_before_pay" | "blocked" | "anti_bot_gate" | "needs_human";
  reason: string;
  reachedStep: string;
  artefacts: string[];
  /** Structured error code when status='needs_human' or 'blocked' from a portal-side condition. */
  error?: LaRunnerError;
}

/** Pull a LA portal confirmation email — when the portal sends one. */
export async function waitForLaConfirmationEmail(
  applicantId: string,
  timeoutMs: number = 60_000,
): Promise<{ message: InboundMessage; reference: string | null }> {
  const message = await inbox.waitForMessage(
    applicantId,
    (m) => /laoevisa\.gov\.la|laos/i.test(m.from_addr),
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
    const ref = await artifact.put(ctx.jobId, `la-step-${idx}-${name}.png`, png, {
      contentType: "image/png",
      upsert: true,
    });
    ctx.artefactPaths.push(ref.path);
  } catch (err) {
    console.error(`[la] screenshot ${name} failed: ${err instanceof Error ? err.message : err}`);
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
    console.warn(`[la] fill ${label} (${selector}) failed: ${err instanceof Error ? err.message : err}`);
  }
}

async function safeClick(page: Page, selector: string, label: string): Promise<boolean> {
  try {
    await page.click(selector, { timeout: 5_000 });
    return true;
  } catch (err) {
    console.warn(`[la] click ${label} (${selector}) failed: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

export async function runLaPrefill(input: LaRunInput): Promise<LaRunResult> {
  const browser: Browser = await chromium.launch({ headless: input.headless ?? true });
  const tempHar = fs.mkdtempSync(path.join(os.tmpdir(), "la-har-"));
  const harPath = path.join(tempHar, `la-${input.jobId}.har`);
  const ctx = await browser.newContext({
    locale: "en-US",
    recordHar: { path: harPath, mode: "minimal" },
  });
  const page = await ctx.newPage();
  const stepCtx: StepCtx = { page, jobId: input.jobId, artefactPaths: [], attemptCount: 0 };

  const result: LaRunResult = {
    status: "blocked",
    reason: "runner did not reach checkpoint",
    reachedStep: "init",
    artefacts: [],
  };

  const probe = async (): Promise<LaRunnerError | null> => {
    const title = (await page.title()).slice(0, 200);
    const bodyText = (
      await page.locator("body").innerText({ timeout: 2_000 }).catch(() => "")
    ).slice(0, 1024);
    return classifyPage({ title, bodyText });
  };
  const dispatchError = (err: LaRunnerError): LaRunResult => {
    result.error = err;
    result.reason = `${err.code}: ${err.message}`;
    if (err.disposition === "human") result.status = "needs_human";
    else if (err.code === "la.anti_bot.cloudflare") result.status = "anti_bot_gate";
    else result.status = "blocked";
    return result;
  };

  try {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await captureStep(stepCtx, "landing");
    result.reachedStep = "landing";
    const landingErr = await probe();
    if (landingErr) return dispatchError(landingErr);

    // Click into the apply path (button or link by text/href).
    const opened =
      (await safeClick(page, 'a:has-text("Apply")', "apply-link")) ||
      (await safeClick(page, 'a[href*="/apply"]', "apply-href"));
    if (!opened) {
      await page.goto(`${BASE_URL}/apply`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    }
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await captureStep(stepCtx, "apply");
    result.reachedStep = "apply";

    // Personal-info section. The Laos portal uses generic name attrs;
    // the recon walker captured the live set — keep selectors loose.
    await safeFill(page, LA_SELECTORS.first_name, input.answers.given_names, "given_names");
    await safeFill(page, LA_SELECTORS.last_name, input.answers.surname, "surname");
    await safeFill(page, LA_SELECTORS.email, input.answers.email, "email");
    await safeFill(page, LA_SELECTORS.phone, input.answers.phone, "phone");
    await safeFill(page, LA_SELECTORS.date_of_birth, input.answers.date_of_birth, "dob");
    await safeFill(page, LA_SELECTORS.nationality, input.answers.nationality, "nationality");
    await safeFill(page, LA_SELECTORS.passport_number, input.answers.passport_number, "passport_number");
    await safeFill(page, LA_SELECTORS.passport_expiry, input.answers.passport_expiry_date, "passport_expiry");
    await safeFill(
      page,
      'select[name="passport_issuing_country"]',
      input.answers.passport_issuing_country,
      "passport_issuing_country",
    );
    await safeFill(page, LA_SELECTORS.arrival_date, input.answers.intended_arrival_date, "arrival_date");
    await safeFill(page, LA_SELECTORS.port_of_entry, input.answers.port_of_entry, "port_of_entry");
    await safeFill(page, LA_SELECTORS.occupation, input.answers.occupation, "occupation");
    await captureStep(stepCtx, "personal_filled");
    result.reachedStep = "personal_filled";

    // Advance to review.
    const advanced = await safeClick(page, LA_SELECTORS.next_button, "next-personal");
    if (advanced) {
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await captureStep(stepCtx, "review");
      result.reachedStep = "review";
      const reviewErr = await probe();
      if (reviewErr) return dispatchError(reviewErr);
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
      const ref = await artifact.put(stepCtx.jobId, `la-network.har`, harBytes, {
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
