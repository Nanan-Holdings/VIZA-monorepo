import { chromium, type Browser, type Page } from "@playwright/test";
import { artifact } from "../artifact.js";
import {
  classifyPage,
  isTrustedInOfficialUrl,
  type InRunnerError,
} from "./errors";
import { solveImageCaptcha } from "../captcha/index.js";
import { forceFill } from "../shared/form-helpers.js";
import { brightDataProxy } from "../shared/proxy-launch.js";
import { inbox, type InboundMessage } from "../inbox/wait-for-message.js";
import { extractAuto } from "../inbox/extractors/index.js";
import {
  unavailableManagedPaymentBoundary,
  type ManagedPaymentHooks,
} from "../runners/managed-payment-boundary.js";
import { TOURIST_LIVE_CHECKPOINTS } from "../tourist-live-checkpoints.js";
import { evaluateInPortalServiceEligibility } from "./preflight.js";

/**
 * India e-Visa prefill runner (AUTO-IN-01 + AUTO-IN-02).
 *
 * Drives the public indianvisaonline.gov.in/evisa registration screen from
 * the canonical IN_E_VISA tourist-only answer set. It reads the official
 * nationality/service allowlist, solves the registration CAPTCHA, and by
 * default halts before Continue creates a government Temporary Application
 * ID. An explicit live-QA gate may create that ID, but still stops before any
 * unverified downstream form or payment action.
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
const LANDING_URL = process.env.IN_PORTAL_URL ?? TOURIST_LIVE_CHECKPOINTS.india.url;

function assertTrustedInOfficialPage(page: Page, checkpoint: string): void {
  if (!isTrustedInOfficialUrl(page.url())) {
    throw new Error(`India official portal trust check failed at ${checkpoint}`);
  }
}

/**
 * India e-Visa Registration page bindings — harvested live (see
 * recon-out/in/fields.json, promoted into selectors.generated.ts).
 * The registration step is the first data-entry form; the safe
 * fill+halt checkpoint is *before* submitting it, since submission
 * mints a government Temporary Application ID.
 */
const REG = {
  nationality: "#nationality_id",
  passportType: "#ppt_type_id",
  mission: "#missioncode_id",
  birthdate: 'input[name="appl.birthdate"]',
  email: 'input[name="appl.email"]',
  emailRe: 'input[name="appl.email_re"]',
  journeydate: 'input[name="appl.journeydate"]',
  visaPurpose: "#visaPurposeDropdown",
  instructions: '#read_instructions_check',
  captchaInput: '#captcha',
  captchaImg: '#capt',
} as const;

const GATE = {
  passport: "#gate_passport",
  nationality: "#gate_nationality",
  name: "#gate_name",
  start: "#startQuestionsBtn",
  q1: 'input[name="q1"]',
  q2: 'input[name="q2"]',
  q3: 'input[name="q3"]',
  symptom: "#symptomDropdown",
  dialog: "#gatekeeper-popup",
  registration: "#registrationFormContainer",
} as const;

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
  /** Hidden service group generated from the exact tourist purpose. */
  visa_service_id?: string;
  /** Official e-Tourist purpose ID derived from validity + tourist_purpose. */
  visa_purpose: string;
  visited_drc_uganda_south_sudan_last_21_days: string;
  completed_21_days_after_exit?: string;
  ebola_symptoms_last_21_days?: string;
  ebola_symptom?: string;
}

export interface InRunInput {
  jobId: string;
  applicationId: string;
  answers: InCanonicalAnswers;
  headless?: boolean;
  paymentHooks?: ManagedPaymentHooks;
  /** Explicitly permits creating a Temporary Application ID for live QA. */
  allowOfficialApplicationCreation?: boolean;
}

export interface InRunResult {
  status:
    | "stopped_before_official_record"
    | "blocked"
    | "anti_bot_gate"
    | "needs_human";
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
    // India forms display applicant data and the government application ID as
    // ordinary page text, so a full-page screenshot cannot be reliably masked
    // after data entry. Persist a PII-free checkpoint manifest instead. Public
    // selector screenshots belong in the dedicated read-only recon harness.
    const evidence = Buffer.from(
      JSON.stringify({
        country: "IN",
        checkpoint: name,
        portalHost: new URL(ctx.page.url()).hostname,
        capturedAt: new Date().toISOString(),
      }),
      "utf8",
    );
    const ref = await artifact.put(ctx.jobId, `in-step-${idx}-${name}.json`, evidence, {
      contentType: "application/json",
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

async function selectExact(
  page: Page,
  selector: string,
  value: string | undefined,
  fieldKey: string,
): Promise<void> {
  if (!value?.trim()) throw new Error(`India ${fieldKey} is missing`);
  const matched = await page.evaluate(
    ({ selectSelector, expectedValue }) => {
      const select = document.querySelector(selectSelector) as HTMLSelectElement | null;
      if (!select) return false;
      const option = Array.from(select.options).find(
        (candidate) =>
          candidate.value === expectedValue ||
          candidate.text.trim().toLowerCase() === expectedValue.toLowerCase(),
      );
      if (!option || option.disabled) return false;
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      const host = window as unknown as {
        jQuery?: (element: Element) => { trigger: (eventName: string) => void };
      };
      host.jQuery?.(select).trigger("chosen:updated");
      return select.value === option.value;
    },
    { selectSelector: selector, expectedValue: value.trim() },
  );
  if (!matched) throw new Error(`India ${fieldKey} option is unavailable`);
}

interface EvisaServiceAllowedResponse {
  evisa_service_allowed?: unknown;
}

async function selectNationalityAndVerifyTouristService(
  page: Page,
  answers: InCanonicalAnswers,
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  const responsePromise = page.waitForResponse(
    (response) => {
      try {
        const responseUrl = response.url();
        const path = new URL(responseUrl).pathname;
        return (
          isTrustedInOfficialUrl(responseUrl) &&
          response.request().method() === "POST" &&
          path.endsWith("/evisa/json/evisaServiceAllowed")
        );
      } catch {
        return false;
      }
    },
    { timeout: 15_000 },
  );

  await selectExact(page, REG.nationality, answers.nationality, "nationality");
  await acceptNationalityConfirmation(page);

  const response = await responsePromise;
  if (!response.ok()) {
    return {
      allowed: false,
      reason: "India official nationality/service eligibility check failed",
    };
  }
  const body = (await response.json()) as EvisaServiceAllowedResponse;
  const allowedServiceIds =
    typeof body.evisa_service_allowed === "string"
      ? body.evisa_service_allowed.split(",")
      : [];
  const eligibility = evaluateInPortalServiceEligibility({
    allowedServiceIds,
    requestedServiceId: answers.visa_service_id ?? "",
  });
  if (!eligibility.allowed) {
    // Report what the portal *does* offer. Without it an operator cannot tell a
    // genuine nationality restriction from a requested-validity mismatch. These
    // are public service codes, not applicant data.
    const offered = allowedServiceIds.map((value) => value.trim()).filter(Boolean);
    return {
      allowed: false,
      reason:
        "India official portal does not currently offer the requested e-Tourist service for the applicant nationality " +
        `(requested service ${answers.visa_service_id ?? "none"}; portal offered ${
          offered.length > 0 ? offered.join(",") : "none"
        })`,
    };
  }

  await page.waitForFunction(
    ({ purposeSelector, expectedPurpose }) => {
      const select = document.querySelector<HTMLSelectElement>(purposeSelector);
      const option = select
        ? Array.from(select.options).find((candidate) => candidate.value === expectedPurpose)
        : null;
      return Boolean(option && !option.disabled);
    },
    { purposeSelector: REG.visaPurpose, expectedPurpose: answers.visa_purpose },
    { timeout: 10_000 },
  );
  return { allowed: true };
}

async function acceptNationalityConfirmation(page: Page): Promise<void> {
  const dialog = page.locator(".ui-dialog").filter({ hasText: /Nationality selected/i });
  await dialog.waitFor({ state: "visible", timeout: 10_000 });
  const ok = dialog.getByRole("button", { name: /^Ok$/i });
  if ((await ok.count()) !== 1) {
    throw new Error("India nationality confirmation control drifted");
  }
  await ok.click({ timeout: 5_000 });
  await dialog.waitFor({ state: "hidden", timeout: 10_000 });
}

async function assertRegistrationValues(page: Page, answers: InCanonicalAnswers): Promise<void> {
  const expected: Array<[selector: string, value: string | undefined, fieldKey: string]> = [
    [REG.nationality, answers.nationality, "nationality"],
    [REG.passportType, answers.passport_type ?? "1", "passport_type"],
    [REG.mission, answers.mission_code, "port_of_arrival"],
    [REG.birthdate, answers.date_of_birth, "date_of_birth"],
    [REG.email, answers.email, "email_address"],
    [REG.emailRe, answers.email, "email_address_confirmation"],
    [REG.journeydate, answers.intended_arrival_date, "expected_arrival_date"],
    [REG.visaPurpose, answers.visa_purpose, "tourist_purpose"],
    ["#evisa_service_input_id", answers.visa_service_id, "tourist_service"],
  ];
  for (const [selector, value, fieldKey] of expected) {
    if (!value?.trim()) throw new Error(`India ${fieldKey} is missing`);
    const actual = await page.locator(selector).inputValue({ timeout: 5_000 });
    const retained = fieldKey.startsWith("email_address")
      ? actual.trim().toLowerCase() === value.trim().toLowerCase()
      : actual.trim() === value.trim();
    if (!retained) {
      if (fieldKey === "tourist_purpose") {
        throw new Error(
          `India registration did not retain tourist_purpose (expected ${value.trim()}, actual ${actual.trim() || "empty"})`,
        );
      }
      throw new Error(`India registration did not retain ${fieldKey}`);
    }
  }
  if (!(await page.locator(REG.instructions).isChecked())) {
    throw new Error("India document-readiness acknowledgement was not retained");
  }
  const visibleDialogCount = await page.locator(".ui-dialog:visible").count();
  if (visibleDialogCount > 0) {
    throw new Error("India registration has an unresolved official dialog");
  }
}

function yesNo(value: string | undefined): "YES" | "NO" | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "yes") return "YES";
  if (normalized === "no") return "NO";
  return null;
}

async function completeEligibilityGate(
  page: Page,
  answers: InCanonicalAnswers,
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  const gateCount = await page.locator(GATE.passport).count();
  if (gateCount !== 1) {
    return { allowed: false, reason: "India e-Visa eligibility gate selector drift" };
  }

  const nationalityLabel = /^(chn|china|china-china)$/i.test(answers.nationality.trim())
    ? "CHINA-CHINA"
    : answers.nationality.trim();
  const passportName = `${answers.surname} ${answers.given_names}`
    .replace(/[^A-Za-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  await page.locator(GATE.passport).fill(answers.passport_number);
  await page.locator(GATE.nationality).selectOption({ label: nationalityLabel });
  await page.locator(GATE.name).fill(passportName);
  await page.locator(GATE.start).click();

  const q1 = yesNo(answers.visited_drc_uganda_south_sudan_last_21_days);
  if (!q1) return { allowed: false, reason: "India e-Visa recent-region screening answer is missing" };
  await page.locator(`${GATE.q1}[value="${q1}"]`).check();
  if (q1 === "NO") {
    await page.locator(GATE.dialog).waitFor({ state: "hidden", timeout: 10_000 });
    return { allowed: true };
  }

  const q2 = yesNo(answers.completed_21_days_after_exit);
  if (!q2) return { allowed: false, reason: "India e-Visa 21-day exit-window answer is missing" };
  await page.locator(`${GATE.q2}[value="${q2}"]`).check();
  if (q2 === "NO") {
    return {
      allowed: false,
      reason: "India e-Visa official gate requires waiting until 21 days after exit",
    };
  }

  const q3 = yesNo(answers.ebola_symptoms_last_21_days);
  if (!q3) return { allowed: false, reason: "India e-Visa Ebola symptom answer is missing" };
  await page.locator(`${GATE.q3}[value="${q3}"]`).check();
  if (q3 === "YES") {
    if (!answers.ebola_symptom?.trim()) {
      return { allowed: false, reason: "India e-Visa symptom selection is missing" };
    }
    await page.locator(GATE.symptom).selectOption({ label: answers.ebola_symptom.trim() });
    return {
      allowed: false,
      reason: "India e-Visa official gate blocks travel until recovery",
    };
  }

  await page.locator(GATE.dialog).waitFor({ state: "hidden", timeout: 10_000 });
  return { allowed: true };
}

export async function runInPrefill(input: InRunInput): Promise<InRunResult> {
  if (!isTrustedInOfficialUrl(LANDING_URL)) {
    return {
      status: "blocked",
      reason: "India official portal entry URL is not trusted",
      reachedStep: "portal_url_untrusted",
      artefacts: [],
    };
  }
  // Egress through the Bright Data residential proxy when configured so the
  // gov portal sees an in-country residential IP rather than a datacenter one.
  const proxy = brightDataProxy("in");
  const launchOptions = {
    headless: input.headless ?? true,
    proxy,
  };
  let browser: Browser;
  try {
    browser = await chromium.launch({ channel: "chrome", ...launchOptions });
  } catch {
    browser = await chromium.launch(launchOptions);
  }
  const ctx = await browser.newContext({
    locale: "en-IN",
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
    assertTrustedInOfficialPage(page, "landing");
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
    assertTrustedInOfficialPage(page, "registration_entry");
    await page.waitForSelector(REG.nationality, { timeout: 20_000 });
    const gate = await completeEligibilityGate(page, input.answers);
    if (!gate.allowed) {
      result.status = "needs_human";
      result.reason = gate.reason;
      result.reachedStep = "eligibility_gate";
      await captureStep(stepCtx, "eligibility_gate");
      return result;
    }
    await captureStep(stepCtx, "registration");
    result.reachedStep = "registration";
    const regErr = await probe();
    if (regErr) return dispatchError(regErr);

    // 3) Fill the registration form with real harvested selectors.
    // Selects are jQuery-Chosen wrapped (hidden native <select>); dates are
    // readonly datepickers — both need the in-page helpers, not page.fill.
    const serviceEligibility = await selectNationalityAndVerifyTouristService(page, input.answers);
    if (!serviceEligibility.allowed) {
      result.status = "needs_human";
      result.reason = serviceEligibility.reason;
      result.reachedStep = "tourist_service_ineligible";
      await captureStep(stepCtx, "tourist_service_ineligible");
      return result;
    }
    assertTrustedInOfficialPage(page, "registration_fill");
    await selectExact(page, REG.passportType, input.answers.passport_type ?? "1", "passport_type");
    await selectExact(page, REG.mission, input.answers.mission_code, "port_of_arrival");
    await forceFill(page, REG.birthdate, input.answers.date_of_birth, "birthdate");
    await forceFill(page, REG.journeydate, input.answers.intended_arrival_date, "journeydate");
    await safeFill(page, REG.email, input.answers.email, "email");
    await safeFill(page, REG.emailRe, input.answers.email, "email_re");
    // Date/email handlers can clear dependent purpose state, so select the
    // exact tourist purpose only after every upstream registration input.
    await selectExact(page, REG.visaPurpose, input.answers.visa_purpose, "tourist_purpose");
    const purposeAfterSelection = await page.locator(REG.visaPurpose).inputValue();
    if (purposeAfterSelection !== input.answers.visa_purpose) {
      throw new Error("India tourist purpose was rejected immediately after selection");
    }
    await page.check(REG.instructions, { timeout: 5_000 }).catch(() => {});
    await assertRegistrationValues(page, input.answers);
    await captureStep(stepCtx, "registration_filled");
    result.reachedStep = "registration_filled";

    // 4) Solve the image captcha via the shared TWOCAPTCHA client. This fills
    // the challenge only and deliberately does not click Continue, because
    // Continue creates an official Temporary Application ID.
    try {
      const img = await page.locator(REG.captchaImg).screenshot({ timeout: 10_000 });
      const solved = await solveImageCaptcha(img, 120_000, {
        comment: "India e-Visa registration CAPTCHA",
      });
      if (solved.text) {
        await page.fill(REG.captchaInput, solved.text, { timeout: 5_000 });
        const retainedCaptcha = await page.inputValue(REG.captchaInput, { timeout: 5_000 });
        if (retainedCaptcha.trim() !== solved.text.trim()) {
          throw new Error(
            "official portal discarded the CAPTCHA value; eligibility gate may still be active",
          );
        }
        result.reachedStep = "captcha_solved";
      }
    } catch (capErr) {
      result.status = "needs_human";
      result.reason = `captcha solve unavailable: ${capErr instanceof Error ? capErr.message : String(capErr)}`;
      result.reachedStep = "captcha_required";
      await captureStep(stepCtx, "captcha_required");
      return result;
    }
    await captureStep(stepCtx, "pre_submit");

    if (!input.allowOfficialApplicationCreation) {
      result.status = "stopped_before_official_record";
      result.reason = "registration prepared; India live-QA application-creation gate is disabled";
      result.reachedStep = "captcha_solved_pre_application";
      return result;
    }

    assertTrustedInOfficialPage(page, "registration_continue");
    const action = page.locator('input[onclick*="submit_registration_form"]');
    if ((await action.count()) !== 1) {
      result.status = "blocked";
      result.reason = "India registration Continue control drifted";
      result.reachedStep = "registration_continue_missing";
      return result;
    }
    await action.click({ timeout: 10_000 });
    const documentDialog = page.locator(".ui-dialog").filter({
      has: page.locator("#document-message"),
    });
    await documentDialog.waitFor({ state: "visible", timeout: 15_000 });
    const documentDialogOk = documentDialog.getByRole("button", { name: /^Ok$/i });
    if ((await documentDialogOk.count()) !== 1) {
      result.status = "blocked";
      result.reason = "India required-document confirmation control drifted";
      result.reachedStep = "required_document_confirmation_missing";
      return result;
    }
    await captureStep(stepCtx, "required_documents_confirmed");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => null),
      documentDialogOk.click({ timeout: 10_000 }),
    ]);
    assertTrustedInOfficialPage(page, "temporary_application_result");
    const nextBody = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
    const temporaryId = /Temporary Application ID\s*[:\-]?\s*([A-Z0-9-]{6,})/i.exec(nextBody)?.[1] ?? null;
    await captureStep(stepCtx, "temporary_application_created");
    if (!temporaryId) {
      result.status = "blocked";
      result.reason = "India Continue did not expose the expected Temporary Application ID checkpoint";
      result.reachedStep = "temporary_application_id_missing";
      return result;
    }

    // The furthest verified point. Resolve the halt through the shared
    // staff-review boundary so the reason is standardized and no managed card
    // is ever acquired or finalized, exactly as every other generic runner does.
    const boundary = await unavailableManagedPaymentBoundary({
      country: "india",
      visaType: "IN_E_VISA",
      hooks: input.paymentHooks,
    });
    result.status = "needs_human";
    result.reason =
      `${boundary.reason}; India Temporary Application ID created and the downstream ` +
      "personal-details selectors require verified mapping before payment-page automation can be enabled";
    result.reachedStep = "temporary_application_created_downstream_mapping_required";
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
    result.artefacts = stepCtx.artefactPaths;
  }
}

// RUN-IN-001: dispatch runOne (loads answers, maps result). See runners/legacy-prefill-adapters.ts.
export { runIndia as runOne } from "../runners/legacy-prefill-adapters.js";
