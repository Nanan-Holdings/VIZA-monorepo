/**
 * Halt-before-government-payment runOne wrappers (QUE-005).
 *
 * United States (CEAC/DS-160), United Kingdom, France-Visas, and Australia
 * stop before the applicant pays a government fee / signs. This module
 * exposes each as a `runOne(applicationId)` over the existing orchestrators,
 * so the same runner_job worker drives them. A halt resolves to a
 * `halted_before_pay` DispatchOutcome (worker → `succeeded`); portal failures
 * throw RetryableRunnerError; missing portal accounts / unmappable data throw
 * NeedsHumanError.
 */
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
import { resumeUkApplication } from "../uk/index.js";
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
import type { VisaApplicationAnswer, ApplicantProfile, Application } from "../types.js";
import {
  RetryableRunnerError,
  NeedsHumanError,
  type RunOne,
  type DispatchOutcome,
} from "./types.js";

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

  const session = await startCeacSession({ headless: true, acceptDownloads: true, runId });
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

export const runUkHalt: RunOne = async (applicationId, jobId) => {
  const runId = jobId ?? applicationId;
  const { applicantId } = await loadProfileAndApp(applicationId);
  const answers = await loadFieldAnswers(applicationId);

  const account = await loadUkAccount(applicantId);
  if (!account) {
    throw new NeedsHumanError("uk: no uk_accounts row provisioned for applicant");
  }
  const result = await resumeUkApplication(
    {
      resumeUrl: account.row.resume_url,
      password: account.password,
      email: account.row.email,
      answers,
    },
    { headless: true, runId },
  );
  switch (result.status) {
    case "stopped_at_pay":
    case "halted_before_pay":
      return HALTED(result.status);
    case "failed":
      throw new RetryableRunnerError(`uk failed at ${result.failedAt}`);
    default:
      throw new Error(`unexpected uk status: ${(result as { status: string }).status}`);
  }
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
