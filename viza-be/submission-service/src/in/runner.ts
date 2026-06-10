import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { chromium, type Browser, type Page } from "@playwright/test";
import { artifact } from "../artifact.js";
import { classifyPage, type InRunnerError } from "./errors";
import { IN_SELECTORS } from "./selectors";
import { solveImageCaptcha } from "../shared/captcha.js";
import { forceFill, chosenSelect } from "../shared/form-helpers.js";
import { brightDataProxy } from "../shared/proxy-launch.js";
import { inbox, type InboundMessage } from "../inbox/wait-for-message.js";
import { extractAuto } from "../inbox/extractors/index.js";

/**
 * India e-Visa prefill runner (AUTO-IN-01 + AUTO-IN-02).
 *
 * Drives indianvisaonline.gov.in/evisa from the canonical answer set
 * for IN_TOURIST_E_VISA. Multi-page state machine — Personal →
 * Passport → Visa Details → Address → Background → Review. Halts
 * before payment.
 *
 * Per-step PNG + post-run HAR uploaded under jobs/<jobId>/in-step-NN-*.{png,har}.
 */

/** Pull an IN portal confirmation email — when the portal sends one. */
export async function waitForInConfirmationEmail(
  applicantId: string,
  timeoutMs: number = 60_000,
): Promise<{ message: InboundMessage; reference: string | null }> {
  const message = await inbox.waitForMessage(
    applicantId,
    (m) => /indianvisaonline|gov\.in/i.test(m.from_addr),
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

// Public e-Visa landing. The "Apply" link to /evisa/Registration is
// Referer-gated, so we must click through from this page rather than
// deep-linking. Matches the recon walker (src/in/form-recon.ts).
const LANDING_URL = process.env.IN_PORTAL_URL ?? "https://indianvisaonline.gov.in/evisa/tvoa.html";

/**
 * India e-Visa Registration page bindings — harvested live (see
 * recon-out/in/fields.json, promoted into selectors.generated.ts).
 * The registration step is the first data-entry form; the safe
 * fill+halt checkpoint is *before* submitting it, since submission
 * mints a government Temporary Application ID.
 */
const REG = {
  nationality: 'select[name="appl.nationality"]',
  passportType: 'select[name="appl.ppt_type_id"]',
  visaType: 'select[name="appl.visa_type_id"]',
  mission: 'select[name="appl.missioncode"]',
  birthdate: 'input[name="appl.birthdate"]',
  email: 'input[name="appl.email"]',
  emailRe: 'input[name="appl.email_re"]',
  journeydate: 'input[name="appl.journeydate"]',
  visaPurpose: 'select[name="evisa_purpose"]',
  instructions: '#read_instructions_check',
  captchaInput: '#captcha',
  captchaImg: '#capt',
} as const;

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
  /** Registration page: passport class. Defaults to "Ordinary Passport". */
  passport_type?: string;
  /** Registration page: nearest Indian mission/embassy option value. */
  mission_code?: string;
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
  status: "stopped_before_pay" | "blocked" | "anti_bot_gate" | "needs_human";
  reason: string;
  reachedStep: string;
  artefacts: string[];
  error?: InRunnerError;
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

/** Select an <option> by value first, then by visible label. Tolerant. */
async function safeSelect(page: Page, selector: string, value: string | undefined, label: string): Promise<void> {
  if (!value) return;
  try {
    await page.selectOption(selector, { value }, { timeout: 5_000 });
  } catch {
    try {
      await page.selectOption(selector, { label: value }, { timeout: 5_000 });
    } catch (err) {
      console.warn(`[in] select ${label} (${selector}) failed: ${err instanceof Error ? err.message : err}`);
    }
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
  // Egress through the Bright Data residential proxy when configured so the
  // gov portal sees an in-country residential IP rather than a datacenter one.
  const proxy = brightDataProxy("in");
  const browser: Browser = await chromium.launch({ headless: input.headless ?? true, proxy });
  const tempHar = fs.mkdtempSync(path.join(os.tmpdir(), "in-har-"));
  const harPath = path.join(tempHar, `in-${input.jobId}.har`);
  const ctx = await browser.newContext({
    locale: "en-IN",
    recordHar: { path: harPath, mode: "minimal" },
    // Bright Data residential proxy presents a MITM cert; tolerate it when
    // egressing through the proxy (equivalent to curl --proxy ... -k).
    ignoreHTTPSErrors: Boolean(proxy),
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

  const probe = async (): Promise<InRunnerError | null> => {
    const title = (await page.title()).slice(0, 200);
    const bodyText = (
      await page.locator("body").innerText({ timeout: 2_000 }).catch(() => "")
    ).slice(0, 1024);
    return classifyPage({ title, bodyText });
  };
  const dispatchError = (err: InRunnerError): InRunResult => {
    result.error = err;
    result.reason = `${err.code}: ${err.message}`;
    if (err.disposition === "human") result.status = "needs_human";
    else if (err.code === "in.anti_bot.cloudflare") result.status = "anti_bot_gate";
    else result.status = "blocked";
    return result;
  };

  try {
    // 1) Landing — public e-Visa page.
    await page.goto(LANDING_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await captureStep(stepCtx, "landing");
    result.reachedStep = "landing";
    const landingErr = await probe();
    if (landingErr) return dispatchError(landingErr);

    // 2) Referer-gated click into /evisa/Registration. Deep-linking
    //    redirects back to the landing, so the click is mandatory.
    const opened =
      (await safeClick(page, 'a[href="Registration"]', "registration-link")) ||
      (await safeClick(page, 'a[title="e-Visa Application"]', "registration-title"));
    if (!opened) {
      result.status = "blocked";
      result.reason = "could not open the Registration page from the landing";
      await captureStep(stepCtx, "no-registration");
      return result;
    }
    await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});
    await page.waitForSelector(REG.nationality, { timeout: 20_000 });
    await captureStep(stepCtx, "registration");
    result.reachedStep = "registration";
    const regErr = await probe();
    if (regErr) return dispatchError(regErr);

    // 3) Fill the registration form with real harvested selectors.
    // Selects are jQuery-Chosen wrapped (hidden native <select>); dates are
    // readonly datepickers — both need the in-page helpers, not page.fill.
    await chosenSelect(page, REG.nationality, input.answers.nationality, "nationality");
    await chosenSelect(page, REG.passportType, input.answers.passport_type ?? "Ordinary Passport", "passport_type");
    await chosenSelect(page, REG.mission, input.answers.mission_code, "mission");
    await forceFill(page, REG.birthdate, input.answers.date_of_birth, "birthdate");
    await safeFill(page, REG.email, input.answers.email, "email");
    await safeFill(page, REG.emailRe, input.answers.email, "email_re");
    await forceFill(page, REG.journeydate, input.answers.intended_arrival_date, "journeydate");
    await chosenSelect(page, REG.visaPurpose, input.answers.visa_purpose, "visa_purpose");
    await page.check(REG.instructions, { timeout: 5_000 }).catch(() => {});
    await captureStep(stepCtx, "registration_filled");
    result.reachedStep = "registration_filled";

    // 4) Solve the image captcha via 2Captcha (fills #captcha; does NOT submit).
    try {
      const img = await page.locator(REG.captchaImg).screenshot({ timeout: 10_000 });
      const code = await solveImageCaptcha(img, { hint: "in-evisa" });
      if (code) {
        await page.fill(REG.captchaInput, code, { timeout: 5_000 });
        result.reachedStep = "captcha_solved";
      }
    } catch (capErr) {
      // Captcha failure is non-fatal for fill+halt — the form is still
      // filled; we just stop before submit either way.
      console.warn(`[in] captcha solve skipped: ${capErr instanceof Error ? capErr.message : capErr}`);
    }
    await captureStep(stepCtx, "pre_submit");

    // 5) HALT. Submitting registration would mint a government Temporary
    //    Application ID — that is the line we never cross in fill+halt QA.
    result.status = "stopped_before_pay";
    result.reason = "filled e-Visa registration; halted before submit (no government record created)";
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

// RUN-IN-001: dispatch runOne (loads answers, maps result). See runners/legacy-prefill-adapters.ts.
export { runIndia as runOne } from "../runners/legacy-prefill-adapters.js";
