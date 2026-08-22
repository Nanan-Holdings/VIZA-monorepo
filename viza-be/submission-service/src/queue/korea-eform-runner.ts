import { runKoreaOfficialEform } from "../korea-eform/runner.js";
import {
  writeRunnerPoolSubmissionResult,
} from "../result-writer.js";
import type { KrSubmissionResult } from "../submission-result.js";
import { loadCountrySubmissionContext } from "./answers.js";
import type { DispatchOutcome } from "./types.js";
import {
  requirePoolExecutionIdentity,
  type RunnerExecutionContext,
} from "./execution-context.js";

const KOREA_VISA_PORTAL_EFORM_URL =
  "https://www.visa.go.kr/openPage.do?MENU_ID=10204";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function profileAnswerFallbacks(
  profile: Awaited<ReturnType<typeof loadCountrySubmissionContext>>["profile"],
): Record<string, string> {
  const fullName = profile.full_name?.trim() ?? "";
  const nameParts = fullName.split(/\s+/u).filter(Boolean);
  const values: Record<string, unknown> = {
    family_name: nameParts.length > 1 ? nameParts.at(-1) : null,
    given_names:
      nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : fullName,
    date_of_birth: profile.date_of_birth,
    gender: profile.gender,
    nationality: profile.nationality,
    country_of_birth: profile.place_of_birth,
    passport_number: profile.passport_number,
    passport_expiry_date: profile.passport_expiry_date,
    passport_issue_date: profile.passport_issue_date,
    passport_place_of_issue: profile.issuing_authority,
    email: profile.email,
    phone: profile.phone,
    home_address: profile.address,
  };
  return Object.fromEntries(
    Object.entries(values)
      .filter((entry): entry is [string, string] => (
        typeof entry[1] === "string" && entry[1].trim().length > 0
      ))
      .map(([key, value]) => [key, value.trim()]),
  );
}

function previousKoreaResult(value: unknown): Partial<KrSubmissionResult> {
  return isRecord(value) && value.country === "KR"
    ? (value as Partial<KrSubmissionResult>)
    : {};
}

export function runKoreaEformBackground(
  applicationId: string,
  executionContext?: RunnerExecutionContext,
): Promise<DispatchOutcome>;
export function runKoreaEformBackground(
  applicationId: string,
  jobId: string,
  executionContext?: RunnerExecutionContext,
): Promise<DispatchOutcome>;
export async function runKoreaEformBackground(
  applicationId: string,
  jobIdOrExecution?: string | RunnerExecutionContext,
  maybeExecutionContext?: RunnerExecutionContext,
): Promise<DispatchOutcome> {
  const jobId = typeof jobIdOrExecution === "string" ? jobIdOrExecution : undefined;
  const executionContext = typeof jobIdOrExecution === "string"
    ? maybeExecutionContext
    : jobIdOrExecution;
  const identity = requirePoolExecutionIdentity(
    executionContext,
    jobId ?? executionContext?.jobId,
    "Korea e-Form pool execution",
  );
  const poolExecutionContext = identity.executionContext;
  const context = await loadCountrySubmissionContext(applicationId);
  const applicationWithResult = context.application as typeof context.application & {
    submission_result?: unknown;
  };
  const previous = previousKoreaResult(applicationWithResult.submission_result);
  const answers = {
    ...profileAnswerFallbacks(context.profile),
    ...context.answers,
  };
  const result = await runKoreaOfficialEform({
    applicationId,
    answers,
    officialPdfStoragePath: previous.officialEformPdfStoragePath ?? null,
    finalReviewApproved: false,
    pdfLanguage: "zh-CN",
    executionContext: poolExecutionContext,
  });
  poolExecutionContext.assertOwned();

  let submissionResult: KrSubmissionResult;
  if (result.status === "official_eform_ready") {
    submissionResult = {
      ...previous,
      country: "KR",
      status: "official_eform_ready",
      applicationId,
      annex17PdfUrl: null,
      officialEformPortalUrl: result.portalUrl,
      officialEformStatus: "ready",
      officialEformPdfStoragePath: result.officialPdfStoragePath,
      officialEformApplicationNumber:
        result.officialEformApplicationNumber ?? null,
      manualAction: undefined,
    };
  } else if (result.status === "validation_failed") {
    submissionResult = {
      ...previous,
      country: "KR",
      status: "official_eform_required",
      applicationId,
      annex17PdfUrl: null,
      officialEformPortalUrl: KOREA_VISA_PORTAL_EFORM_URL,
      officialEformStatus: "failed",
      manualAction: {
        type: "official_eform_generation_required",
        status: "open",
        instructions: result.message,
      },
    };
  } else {
    const manualActionType =
      result.manualActionType === "official_eform_first_page_filled"
        ? "official_eform_portal_review_required"
        : result.manualActionType;
    submissionResult = {
      ...previous,
      country: "KR",
      status: "official_eform_required",
      applicationId,
      annex17PdfUrl: null,
      officialEformPortalUrl: result.portalUrl,
      officialEformStatus: "manual_action_required",
      manualAction: {
        type: manualActionType,
        status: "open",
        instructions: result.message,
      },
    };
  }

  poolExecutionContext.assertOwned();
  const resultStatus = result.status === "official_eform_ready" ? "completed" : "needs_user_action";
  await writeRunnerPoolSubmissionResult(poolExecutionContext, submissionResult, resultStatus);
  return {
    outcome: result.status === "official_eform_ready" ? "paper_ready" : "halted_before_pay",
    reachedStep:
      result.status === "official_eform_ready"
        ? "korea_official_eform_ready"
        : "korea_official_eform_review_required",
    artefacts:
      result.status === "official_eform_ready"
        ? [result.officialPdfStoragePath]
        : [],
  };
}
