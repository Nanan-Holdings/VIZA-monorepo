/**
 * Halt-before-government-payment runOne wrappers (QUE-005).
 *
 * United States (CEAC/DS-160), United Kingdom, France-Visas, and Australia
 * stop before the legacy government-payment boundary or signature. Applicants
 * must not be asked to enter a card; electronically payable fees migrate to
 * VIZA's application-scoped virtual-card flow. This module
 * exposes each as a `runOne(applicationId)` over the existing orchestrators,
 * so the same runner_job worker drives them. A halt resolves to a
 * `halted_before_pay` DispatchOutcome (worker → `succeeded`); portal failures
 * throw RetryableRunnerError; missing portal accounts / unmappable data throw
 * NeedsHumanError.
 */
import { createHash } from "node:crypto";
import { supabase } from "../supabase.js";
import {
  startCeacSession,
  createRecoveryTracker,
  recordBootstrapCheckpoint,
  handleConfirmApplicationPage,
  orchestrateFill,
  isSuccessResult,
  isFailureResult,
} from "../ceac/index.js";
import { resumeUkApplication, normalizeUkAnswers, UkNormalizationError } from "../uk/index.js";
import { registerUkAccount } from "../uk/register.js";
import { writeRunnerPoolSubmissionResult, writeSubmissionResult } from "../result-writer.js";
import type { UkSubmissionResult, TwSubmissionResult } from "../submission-result.js";
import {
  loadManagedOfficialFeeExecutionContext,
  OfficialFeeExecutionContextError,
  type ManagedOfficialFeeExecutionContext,
} from "../official-fee/execution-context.js";
import {
  persistOfficialFeeFundingState,
  recordOfficialFeePaid,
  recordOfficialFeeReview,
} from "../official-fee/accounting.js";
import {
  ensureManagedOfficialFeeCard,
  finalizeManagedOfficialFeeCard,
  type ManagedOfficialFeeCard,
} from "../issuing/managed-card-provider.js";
import { ukProgress, ukSafePendingResult } from "../uk/managed-result.js";
import {
  fillFranceVisasApplication,
  buildAnswerMap,
  normalizeFvAnswers,
  NormalizationError,
} from "../france-visas/index.js";
import { fillVisitor600Application } from "../au-visitor/run.js";
import { generateTotp } from "../au-visitor/totp.js";
import { launchStealthBrowser } from "../ceac/stealth-browser.js";
import { loadUkAccount, loadFvAccount, loadAuAccount } from "../account-loader.js";
import {
  fillTwEntryPermitApplication,
  type TwApplyInput,
  type TwApplyOptions,
  normalizeTwAnswers,
  TwNormalizationError,
  HK_MACAU_EMBASSY_OFFICE_VALUES,
  TwDuplicateRunError,
  TwOfficialLoginConfigurationError,
  createTwOfficialLoginProviderFromEnvironment,
  createTwOfficialLoginOtpProviderFromEnvironment,
  parseTwOfficialTermsConsentAudit,
  type TwOfficialTermsConsentAudit,
} from "../tw/index.js";
import { resolveApplicationDocumentPaths } from "../documents/resolve-application-documents.js";
import {
  assertTwPrepareGuard,
  TW_ACTIVE_RUNNER_JOB_STATUSES,
} from "../tw/prepare-guard.js";
import type { VisaApplicationAnswer, ApplicantProfile, Application } from "../types.js";
import {
  RetryableRunnerError,
  NeedsHumanError,
  type RunOne,
  type DispatchOutcome,
} from "./types.js";
import {
  requirePoolExecutionIdentity,
} from "./execution-context.js";

const HALTED: (reachedStep: string, artefacts?: string[]) => DispatchOutcome = (
  reachedStep,
  artefacts = [],
) => ({ outcome: "halted_before_pay", reachedStep, artefacts });

/* ----------------------------- loaders ----------------------------- */

async function loadFieldAnswers(applicationId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("visa_application_answers")
    .select("field_name, value_text")
    .eq("application_id", applicationId);
  if (error) throw new Error(`answers lookup failed: ${error.message}`);
  const out: Record<string, string> = {};
  for (const row of (data ?? []) as { field_name: string; value_text: string | null }[]) {
    if (row.value_text != null) out[row.field_name] = row.value_text;
  }
  return out;
}

async function loadRawAnswers(applicationId: string): Promise<VisaApplicationAnswer[]> {
  const { data, error } = await supabase
    .from("visa_application_answers")
    .select("*")
    .eq("application_id", applicationId);
  if (error) throw new Error(`raw answers lookup failed: ${error.message}`);
  return (data ?? []) as VisaApplicationAnswer[];
}

async function loadProfileAndApp(
  applicationId: string,
): Promise<{ applicantId: string; profile: ApplicantProfile; application: Application }> {
  const { data: app, error: appErr } = await supabase
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .single();
  if (appErr) throw new Error(`applications lookup failed: ${appErr.message}`);
  const application = app as Application;
  const { data: profile, error: profErr } = await supabase
    .from("applicant_profiles")
    .select("*")
    .eq("id", (app as { applicant_id: string }).applicant_id)
    .single();
  if (profErr) throw new Error(`applicant_profiles lookup failed: ${profErr.message}`);
  return {
    applicantId: (app as { applicant_id: string }).applicant_id,
    profile: profile as ApplicantProfile,
    application,
  };
}

function requireAnswer(map: Record<string, string | null>, key: string): string {
  const v = map[key];
  if (v == null || v === "") {
    throw new NeedsHumanError(`france: missing required answer '${key}'`);
  }
  return v;
}

/* --------------------------- US / CEAC --------------------------- */

export const runUsHalt: RunOne = async (applicationId, jobId) => {
  const runId = jobId ?? applicationId;
  const { profile } = await loadProfileAndApp(applicationId);
  const answers = await loadFieldAnswers(applicationId);

  const session = await startCeacSession({
    headless: process.env.CEAC_PLAYWRIGHT_HEADLESS !== "false",
    acceptDownloads: true,
    runId,
  });
  try {
    const tracker = createRecoveryTracker({ runId });
    await recordBootstrapCheckpoint(session.page, { sink: tracker, runId });

    const securityAnswer =
      answers["ds160_security_answer"] ?? answers["mother_surname"] ?? "VIZAREDOC";
    const confirm = await handleConfirmApplicationPage(session.page, {
      securityAnswer,
      securityQuestionValue: "3",
    });

    const profileRec = profile as unknown as Record<string, unknown>;
    const surname = (answers["surname"] ?? String(profileRec.surname ?? "")).toUpperCase();
    const dob = answers["date_of_birth"] ?? String(profileRec.date_of_birth ?? "");
    const { result } = await orchestrateFill(session, {
      answers,
      profile: profile as unknown as Record<string, unknown>,
      tracker,
      runId,
      recoveryCredentials: {
        applicationId: confirm.applicationId,
        surnameFirstFive: surname.replace(/[^A-Z]/g, "").slice(0, 5),
        yearOfBirth: dob.slice(0, 4),
        securityAnswer: confirm.securityAnswer,
      },
    });
    if (isSuccessResult(result)) {
      return HALTED("handoff_ready");
    }
    if (result.status === "submitted") {
      return HALTED("submitted");
    }
    if (result.status === "failed") {
    if (isFailureResult(result)) {
      throw new RetryableRunnerError(`ceac failed: ${JSON.stringify(result.error)}`);
    }
    }
    throw new RetryableRunnerError(`ceac ended with unsupported status: ${JSON.stringify(result)}`);
  } finally {
    await session.close();
  }
};

/* ------------------------------ UK ------------------------------ */

type UkFeeReadiness =
  | { kind: "ready"; context: ManagedOfficialFeeExecutionContext }
  | { kind: "funding_required" | "payment_pending"; code: string }
  | { kind: "staff_review"; code: string; message: string };

async function loadUkFeeReadiness(applicationId: string): Promise<UkFeeReadiness> {
  try {
    return {
      kind: "ready",
      context: await loadManagedOfficialFeeExecutionContext(applicationId),
    };
  } catch (error) {
    if (error instanceof OfficialFeeExecutionContextError) {
      if (
        error.code === "managed_intent_missing" ||
        error.code === "managed_intent_not_consented" ||
        error.code === "allocation_missing"
      ) {
        return { kind: "funding_required", code: error.code };
      }
      if (error.code === "managed_intent_not_executable") {
        return { kind: "payment_pending", code: error.code };
      }
      return { kind: "staff_review", code: error.code, message: error.message };
    }
    throw error;
  }
}

async function persistUkStaffReview(input: {
  applicationId: string;
  context: ManagedOfficialFeeExecutionContext;
  code: string;
  message: string;
  result: { pagesFilled: string[]; pagesSkipped?: string[]; applicationReference?: string };
}): Promise<void> {
  await recordOfficialFeeReview({
    context: input.context,
    errorCode: input.code,
    message: input.message,
  });
  const payload: UkSubmissionResult = {
    country: "UK",
    status: "payment_review_required",
    paymentStatus: "review_required",
    staffReviewCode: input.code,
    ...(input.result.applicationReference
      ? { applicationReference: input.result.applicationReference }
      : {}),
    prefillProgress: ukProgress(input.result),
  };
  await writeSubmissionResult(input.applicationId, payload, "processing");
}

export const runUkHalt: RunOne = async (applicationId, jobId) => {
  const runId = jobId ?? applicationId;
  const { applicantId, profile, application } = await loadProfileAndApp(applicationId);
  const answerMap = buildAnswerMap(await loadRawAnswers(applicationId));

  // Translate the wizard's answer shape → the seed wire-shape the
  // page-bindings fillers consume (mirrors runFranceHalt + normalizeFvAnswers).
  let answers: Record<string, string>;
  try {
    answers = normalizeUkAnswers({ answers: answerMap, profile });
  } catch (err) {
    if (err instanceof UkNormalizationError) {
      throw new NeedsHumanError(`uk: ${err.message}`);
    }
    throw err;
  }

  let account = await loadUkAccount(applicantId);
  if (!account) {
    // No saved-application (email+password) provisioned yet → register one on
    // gov.uk: fills the "Enter an email address and password to save your
    // answers" page and captures the emailed unique resume link into
    // uk_accounts. Real account creation stays gated behind UK_REGISTER_COMMIT,
    // so this is safe to reach in QA without creating live accounts.
    const reg = await registerUkAccount({
      applicantId,
      biometricsCountryIso3: profile.nationality ?? undefined,
      runId,
    });
    if (reg.status === "stopped_before_commit") {
      throw new NeedsHumanError(
        "uk: account provisioning is gated — set UK_REGISTER_COMMIT=1 to create the UKVI saved-application account",
      );
    }
    if (reg.status !== "registered") {
      throw new RetryableRunnerError(`uk: account registration failed (${reg.reason})`);
    }
    account = await loadUkAccount(applicantId);
    if (!account) {
      throw new RetryableRunnerError("uk: account registered but uk_accounts row not yet readable");
    }
  }
  const feeReadiness = await loadUkFeeReadiness(applicationId);
  let issuerCard: ManagedOfficialFeeCard | null = null;
  const issuerFailure: { error: Error | null } = { error: null };
  const context = feeReadiness.kind === "ready" ? feeReadiness.context : null;
  const expectedAmountCents = context ? Number(context.allocation.amount_cents) : null;
  const result = await resumeUkApplication(
    {
      resumeUrl: account.row.resume_url,
      password: account.password,
      email: account.row.email,
      answers,
    },
    {
      headless: process.env.UK_PLAYWRIGHT_HEADLESS !== "false",
      runId,
      ...(context && expectedAmountCents !== null
        ? {
            expectedPaymentAmount: expectedAmountCents / 100,
            expectedPaymentCurrency: context.allocation.currency,
            takePaymentCard: async () => {
              try {
                issuerCard = await ensureManagedOfficialFeeCard({
                  execution: context,
                  workerId: runId,
                  country: application.country ?? "united_kingdom",
                  visaType: application.visa_type ?? "UK_STANDARD_VISITOR",
                });
                return issuerCard;
              } catch (error) {
                issuerFailure.error = error instanceof Error ? error : new Error(String(error));
                return null;
              }
            },
          }
        : {}),
    },
  );
  if (result.status === "stopped_at_pay" || result.status === "halted_before_pay") {
    if (feeReadiness.kind === "staff_review") {
      // No card was issued because the financial context failed closed.
      await persistOfficialFeeFundingState(applicationId, "official_fee_payment_manual_review");
      const payload: UkSubmissionResult = {
        country: "UK",
        status: "payment_review_required",
        paymentStatus: "review_required",
        staffReviewCode: feeReadiness.code,
        prefillProgress: ukProgress(result),
      };
      await writeSubmissionResult(applicationId, payload, "processing");
      return HALTED("uk_official_fee_staff_review");
    }
    const pendingReadiness = feeReadiness.kind === "ready"
      ? { kind: "payment_pending" as const, code: "official_payment_page_pending" }
      : feeReadiness;
    await persistOfficialFeeFundingState(
      applicationId,
      pendingReadiness.kind === "funding_required"
        ? "official_fee_funding_required"
        : "official_fee_payment_pending",
    );
    const ukPayload = ukSafePendingResult(pendingReadiness, result);
    await writeSubmissionResult(applicationId, ukPayload, "stopped_at_pay");
    return HALTED(pendingReadiness.kind);
  }
  if (result.status === "paid" && context && issuerCard) {
    let evidence: { attemptId: string; receiptId: string };
    try {
      evidence = await recordOfficialFeePaid({
        context,
        receiptNumber: result.portalReceiptId,
        ...(result.applicationReference ? { applicationReference: result.applicationReference } : {}),
      });
    } finally {
      await finalizeManagedOfficialFeeCard(issuerCard, runId, "consumed");
      issuerCard = null;
    }
    const ukPayload: UkSubmissionResult = {
      country: "UK",
      status: "paid",
      paymentStatus: "paid",
      officialFeeReceiptId: evidence.receiptId,
      ...(result.applicationReference ? { applicationReference: result.applicationReference } : {}),
      prefillProgress: ukProgress(result),
    };
    await writeSubmissionResult(applicationId, ukPayload, "submitted");
    return HALTED("uk_official_fee_paid", [evidence.attemptId, evidence.receiptId]);
  }
  if (result.status === "payment_review_required" && context) {
    if (issuerCard) {
      await finalizeManagedOfficialFeeCard(issuerCard, runId, "review_required");
      issuerCard = null;
    }
    const code = issuerFailure.error
      ? "issuer_card_review_required"
      : result.paymentOutcome === "declined"
        ? "official_payment_declined"
        : /amount|currency/i.test(result.reason)
          ? "official_payment_amount_unverified"
          : /3DS|authentication/i.test(result.reason)
            ? "official_payment_authentication_review"
            : "official_payment_portal_review";
    await persistUkStaffReview({
      applicationId,
      context,
      code,
      message: issuerFailure.error?.message ?? result.reason,
      result,
    });
    return HALTED("uk_official_fee_staff_review");
  }
  if (result.status === "failed") {
    if (issuerCard && context) {
      await finalizeManagedOfficialFeeCard(issuerCard, runId, "review_required");
      issuerCard = null;
      await persistUkStaffReview({
        applicationId,
        context,
        code: "official_payment_portal_failure_after_card_issue",
        message: `UK official payment failed after card issuance at ${result.failedAt}`,
        result: { pagesFilled: [], pagesSkipped: [] },
      });
      return HALTED("uk_official_fee_staff_review");
    }
    throw new RetryableRunnerError(`uk failed at ${result.failedAt}`);
  }
  throw new Error(`unexpected uk status: ${(result as { status: string }).status}`);
};

/* ---------------------------- France ---------------------------- */

export const runFranceHalt: RunOne = async (applicationId, jobId) => {
  const runId = jobId ?? applicationId;
  const { applicantId, profile, application } = await loadProfileAndApp(applicationId);
  const rawAnswers = await loadRawAnswers(applicationId);
  const answerMap = buildAnswerMap(rawAnswers);

  let answers;
  try {
    answers = normalizeFvAnswers({
      answers: answerMap,
      profile,
      application,
      fvOverrides: {
        depositCountry: requireAnswer(answerMap, "fv_deposit_country"),
        depositTown: requireAnswer(answerMap, "fv_deposit_town"),
        purpose: requireAnswer(answerMap, "fv_purpose"),
        authority: answerMap["fv_authority"] ?? undefined,
        destination: answerMap["fv_destination"] ?? undefined,
        occupationCode: answerMap["fv_occupation_code"] ?? undefined,
        businessSegment: answerMap["fv_business_segment"] ?? undefined,
      },
    });
  } catch (err) {
    if (err instanceof NormalizationError) {
      throw new NeedsHumanError(`france: ${err.message}`);
    }
    throw err;
  }

  const account = await loadFvAccount(applicantId);
  if (!account) {
    throw new NeedsHumanError("france: no fv_accounts row provisioned for applicant");
  }
  const result = await fillFranceVisasApplication(
    { credentials: { email: account.row.email, password: account.password }, answers },
    { headless: true, runId },
  );
  switch (result.status) {
    case "prefilled":
      return HALTED("prefilled");
    case "failed":
      throw new RetryableRunnerError(`france failed at ${result.failedStep}`);
    default:
      throw new Error(`unexpected france status: ${(result as { status: string }).status}`);
  }
};

/* ----------------------------- Taiwan ----------------------------- */

export interface PreparedTwEntryPermitApplication {
  applicantId: string;
  alias: string;
  answers: Record<string, string>;
  input: TwApplyInput;
  applyOptions: Pick<TwApplyOptions, "photoFilePath" | "supportingDocuments">;
  requiredDocumentCount: number;
}

/**
 * Taiwan Online Entry Permit (旅居海外大陸地區人民申請來臺觀光入境許可). VIZA does
 * not create Taiwan official accounts. Every run uses a deterministic,
 * application-scoped VIZA managed inbox alias for the official email OTP.
 * The optional official-login hook is only used if the NIA page actually
 * presents a username/password login page. See src/tw/AGENTS.md.
 */
export const runTwHalt: RunOne = async (applicationId, jobId, execution) => {
  const identity = requirePoolExecutionIdentity(execution, jobId, "taiwan runner");
  const { executionContext } = identity;
  const runId = identity.jobId;
  const officialTermsConsent = await loadTwOfficialTermsConsent(identity.jobId, applicationId);
  let prepared: PreparedTwEntryPermitApplication;
  try {
    prepared = await prepareTwEntryPermitApplication(applicationId, { currentJobId: identity.jobId });
  } catch (err) {
    if (err instanceof TwDuplicateRunError) throw new NeedsHumanError(err.message);
    if (err instanceof TwNormalizationError) throw new NeedsHumanError(`taiwan: ${err.message}`);
    throw err;
  }

  const { input, applyOptions } = prepared;

  let result;
  try {
    result = await fillTwEntryPermitApplication(
      input,
      {
        ...applyOptions,
        headless: true,
        runId,
        mode: "submit",
        officialTermsConsent,
        executionContext,
        officialLoginProvider: createTwOfficialLoginProviderFromEnvironment(),
        officialLoginOtpProvider: createTwOfficialLoginOtpProviderFromEnvironment(),
      },
    );
  } catch (err) {
    if (err instanceof TwOfficialLoginConfigurationError) {
      throw new NeedsHumanError(err.message);
    }
    throw err;
  }

  if (result.status === "ready_to_submit") {
    throw new RetryableRunnerError("taiwan unexpectedly stopped in pre-submit mode during runner execution");
  }
  if (result.status === "stopped_at_captcha") {
    throw new RetryableRunnerError(
      "taiwan formal submission stopped before final confirmation without official receipt evidence",
    );
  }
  if (result.status === "submitted") {
    const twPayload: TwSubmissionResult & { runMetadata: typeof result.runMetadata } = {
      country: "TW",
      status: "submitted",
      portalUrl: result.portalUrl,
      pagesFilled: result.pagesFilled,
      capturedAt: result.capturedAt,
      submittedAt: result.submittedAt,
      officialReceipt: result.officialReceipt,
      runMetadata: result.runMetadata,
      captchaSolve: {
        telemetry: result.captchaSolve.telemetry,
        solve: {
          solveId: result.captchaSolve.solve.solveId,
          durationMs: result.captchaSolve.solve.durationMs,
          text: "[redacted]",
          ...(result.captchaSolve.solve.userAgent ? { userAgent: result.captchaSolve.solve.userAgent } : {}),
        },
      },
      captchaAutoFilled: true,
      officialTermsConsent,
      ...(result.caseNumber ? { caseNumber: result.caseNumber } : {}),
    };
    await writeRunnerPoolSubmissionResult(executionContext, twPayload, "completed");
    return HALTED("submitted");
  }
  if (result.status === "failed") {
    throw new RetryableRunnerError(`taiwan failed: ${result.error}`);
  }
  throw new Error(`unexpected taiwan status: ${(result as { status: string }).status}`);
};

export async function prepareTwEntryPermitApplication(
  applicationId: string,
  options: { currentJobId?: string } = {},
): Promise<PreparedTwEntryPermitApplication> {
  await assertTwPrepareIsAllowed(applicationId, options.currentJobId);
  const { applicantId, profile } = await loadProfileAndApp(applicationId);
  const answerMap = buildAnswerMap(await loadRawAnswers(applicationId));
  const answers = normalizeTwAnswers({ answers: answerMap, profile });

  // Deterministic per application so retries reuse the same generated alias.
  // The current routable alias domain is viza.it.com unless overridden by env.
  const alias = twApplicationInboxAlias(applicationId);

  // Applicant-uploaded documents (photo + the "應檢附文件" supporting
  // documents) live in application_documents, keyed by requirement_key —
  // NOT in visa_application_answers, so they can't come through `answers`
  // (see the comment on this in src/tw/normalize.ts). Resolve them here.
  const documentPaths = await resolveApplicationDocumentPaths(applicationId);
  let requiredDocumentCount = 0;
  const requiredDocMissing = (key: string, condition: boolean): void => {
    if (condition) requiredDocumentCount += 1;
    if (condition && !documentPaths.get(key)) {
      throw new NeedsHumanError(`taiwan: required document "${key}" has not been uploaded yet`);
    }
  };
  // The "eligibility_supporting_document" requirement is split into 4
  // category-specific document_requirements rows
  // (eligibility_supporting_document_1..4, one per eligibility_category
  // value) so the Documents step only shows the applicant the ONE document
  // description relevant to their actual answer, instead of all 4 lumped
  // together. Resolve the correct key from the answered category here.
  const eligibilityDocKey = `eligibility_supporting_document_${answers.eligibility_category}`;
  requiredDocMissing("photo", true);
  requiredDocMissing("mainland_travel_document", true);
  requiredDocMissing(eligibilityDocKey, true);
  requiredDocMissing("hk_macau_id_scan", HK_MACAU_EMBASSY_OFFICE_VALUES.has(answers.embassy_office));
  requiredDocMissing("other_nationality_passport_scan", answers.has_other_nationality_passport === "yes");
  requiredDocMissing(
    "mainland_id_card_scan",
    answers.eligibility_category === "4" || answers.mainland_id_number_not_applicable !== "true",
  );

  return {
    applicantId,
    alias,
    answers,
    input: { applicantId, email: alias, answers },
    applyOptions: {
        photoFilePath: documentPaths.get("photo") ?? null,
        supportingDocuments: {
          mainlandTravelDocumentPath: documentPaths.get("mainland_travel_document"),
          eligibilityProofPath: documentPaths.get(eligibilityDocKey),
          hkMacauIdScanPath: documentPaths.get("hk_macau_id_scan"),
          otherNationalityPassportScanPath: documentPaths.get("other_nationality_passport_scan"),
          mainlandIdCardScanPath: documentPaths.get("mainland_id_card_scan"),
          otherSupportingDocumentPath: documentPaths.get("other_supporting_document"),
        },
      },
    requiredDocumentCount,
  };
}

export function twApplicationInboxAlias(applicationId: string): string {
  const domain = normalizeTwInboxDomain(
    process.env.TW_ENTRY_PERMIT_ALIAS_DOMAIN ??
    process.env.VIZA_MANAGED_INBOX_DOMAIN ??
    "viza.it.com",
  );
  const digest = createHash("sha256")
    .update(`tw-entry-permit:${applicationId}`)
    .digest("hex")
    .slice(0, 24);
  return `tw-${digest}@${domain}`;
}

function normalizeTwInboxDomain(domain: string): string {
  const normalized = domain.trim().toLowerCase();
  return normalized.startsWith("@") ? normalized.slice(1) : normalized;
}

async function assertTwPrepareIsAllowed(applicationId: string, currentJobId?: string): Promise<void> {
  const { data, error } = await supabase
    .from("applications")
    .select("submission_result_status, submission_result")
    .eq("id", applicationId)
    .single();
  if (error) throw new Error(`taiwan duplicate-run guard lookup failed: ${error.message}`);
  const row = data as { submission_result_status?: string | null; submission_result?: Record<string, unknown> | null } | null;

  const { data: activeRunnerJobs, error: activeJobError } = await supabase
    .from("runner_job")
    .select("id")
    .eq("application_id", applicationId)
    .eq("country", "taiwan")
    .in("status", [...TW_ACTIVE_RUNNER_JOB_STATUSES]);
  if (activeJobError) throw new Error(`taiwan active-job guard lookup failed: ${activeJobError.message}`);

  assertTwPrepareGuard({
    submissionResultStatus: row?.submission_result_status ?? null,
    submissionResult: row?.submission_result ?? null,
    activeRunnerJobs: ((activeRunnerJobs ?? []) as Array<{ id: string }>),
    ...(currentJobId ? { currentJobId } : {}),
  });
}

async function loadTwOfficialTermsConsent(
  jobId: string,
  applicationId: string,
): Promise<TwOfficialTermsConsentAudit> {
  const { data, error } = await supabase
    .from("runner_job")
    .select("metadata")
    .eq("id", jobId)
    .eq("application_id", applicationId)
    .eq("country", "taiwan")
    .single();
  if (error || !data) {
    throw new NeedsHumanError(
      `taiwan: official terms authorization lookup failed: ${error?.message ?? "job not found"}`,
    );
  }
  const metadata = (data as { metadata?: Record<string, unknown> | null }).metadata;
  const consent = parseTwOfficialTermsConsentAudit(metadata?.taiwanOfficialTermsConsent);
  if (!consent) {
    throw new NeedsHumanError(
      "taiwan: both official entry-prompt and terms-modal authorizations are required before formal submission",
    );
  }
  return consent;
}

/* --------------------------- Australia --------------------------- */

export const runAuHalt: RunOne = async (applicationId, jobId) => {
  const { applicantId } = await loadProfileAndApp(applicationId);
  const answers = await loadFieldAnswers(applicationId);

  const account = await loadAuAccount(applicantId);
  if (!account) {
    throw new NeedsHumanError("australia: no au_accounts row provisioned for applicant");
  }
  const totpSecret = account.totpSecret;
  const handles = await launchStealthBrowser({ headless: true, acceptDownloads: true });
  try {
    const result = await fillVisitor600Application({
      context: handles.context,
      credentials: {
        username: account.row.username,
        password: account.password,
        mfaCodeProvider: totpSecret ? async () => generateTotp(totpSecret) : undefined,
      },
      answers,
      resumeTrn: account.row.resume_trn ?? answers["au_resume_trn"] ?? null,
      options: {},
    });
    switch (result.outcome) {
      case "review_reached":
        return HALTED("review_reached");
      case "stopped_early":
        throw new RetryableRunnerError("australia stopped before review");
      case "failed":
        throw new RetryableRunnerError(`australia failed: ${JSON.stringify(result.error)}`);
      default:
        throw new Error(`unexpected au outcome: ${(result as { outcome: string }).outcome}`);
    }
  } finally {
    await handles.context.close();
    await handles.browser.close();
  }
};
