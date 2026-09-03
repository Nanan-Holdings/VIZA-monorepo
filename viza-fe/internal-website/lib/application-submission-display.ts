import {
  hasSuccessfulArrivalCardSubmission,
} from "@/features/arrival-cards/application-lifecycle";
import {
  createPhEtravelStoredResultRecoveryPresentation,
} from "@/features/ph-etravel/status";
import type {
  DigitalArrivalCardSubmissionResult,
  SubmissionResult,
  SubmissionResultStatus,
} from "@/lib/submission-result";

export const JP_VJW_PAYLOAD_VALIDATION_ERROR_CODE =
  "jp_vjw_payload_validation_failed";

const TERMINAL_RESULT_STATUSES = new Set([
  "completed",
  "submitted",
  "submitted_mock",
  "form_ready_for_agency",
  "failed",
  "stalled",
  "needs_user_action",
  "action_required",
  "stopped_at_sign",
  "stopped_at_pay",
  "stopped_at_review",
  "unsupported",
]);

export function hasDurableTerminalSubmissionResult(input: {
  submissionResultStatus?: SubmissionResultStatus | null;
  submissionResult?: SubmissionResult | null;
}): boolean {
  const normalizedStatus = (input.submissionResultStatus ?? "").trim().toLowerCase();
  return Boolean(input.submissionResult) && TERMINAL_RESULT_STATUSES.has(normalizedStatus);
}

export function shouldShowSubmissionStatusStep(input: {
  submittedAt?: string | null;
  submissionResultStatus?: SubmissionResultStatus | null;
  submissionResult?: SubmissionResult | null;
}): boolean {
  if (input.submittedAt) return true;
  if (input.submissionResult) return true;
  return Boolean(input.submissionResultStatus);
}

function hasNonEmptyArtifact(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasVietnamPrearrivalQr(result: DigitalArrivalCardSubmissionResult): boolean {
  return Boolean(result.artifacts?.qrCodes?.some(hasNonEmptyArtifact));
}

/**
 * A confirmation is not a generic "terminal" state. It is reserved for a
 * verified official success, so an applicant never mistakes a queued,
 * failed, payment, or manual-handoff state for a completed submission.
 *
 * Country-specific evidence remains deliberately strict where the official
 * flow requires it. In particular, Korea requires its official issue number,
 * portal URL, and saved PDF through `hasSuccessfulArrivalCardSubmission`.
 */
export function hasConfirmedTerminalSubmissionSuccess(input: {
  country?: string | null;
  visaType?: string | null;
  submissionResultStatus?: SubmissionResultStatus | null;
  submissionResult?: SubmissionResult | null;
}): boolean {
  const result = input.submissionResult;
  if (!result) return false;

  const durableStatus = input.submissionResultStatus?.trim().toLowerCase();
  if (
    durableStatus &&
    [
      "failed",
      "rejected",
      "stalled",
      "needs_attention",
      "needs_user_action",
      "action_required",
      "blocked",
      "unsupported",
      "stopped_at_pay",
      "stopped_at_sign",
      "stopped_at_review",
      "final_review_required",
    ].includes(durableStatus)
  ) {
    return false;
  }

  if (result.country === "PH") {
    const reference = result.issueNumber ?? result.referenceNumber ?? result.confirmationNumber;
    const evidence = result.resultEvidence?.authoritativeRead;
    return result.submitted === true && result.status === "submitted" &&
      createPhEtravelStoredResultRecoveryPresentation(result).state === "submitted_candidate" &&
      Boolean(reference?.trim()) &&
      Boolean(result.artifacts?.qrCodes?.some(hasNonEmptyArtifact)) &&
      evidence?.postSubmitRead === true && evidence.stableReference === true;
  }

  if (result.country === "KR" && "visaType" in result && result.visaType === "KR_E_ARRIVAL_CARD") {
    return hasSuccessfulArrivalCardSubmission({
      country: input.country ?? "south_korea",
      visaType: input.visaType ?? result.visaType,
      submissionResult: result,
    });
  }

  if (result.country === "VN" && "visaType" in result && result.visaType === "VN_PREARRIVAL_DECLARATION") {
    return result.submitted && result.status === "submitted" && hasVietnamPrearrivalQr(result);
  }

  if (result.country === "MY" || result.country === "TH") {
    return "submitted" in result && result.submitted === true && result.status === "submitted";
  }

  if (result.country === "SG") {
    const evidence = result.resultEvidence?.authoritativeRead;
    return result.submitted === true && result.status === "submitted" &&
      evidence?.postSubmitRead === true && evidence.stableReference === true &&
      Boolean(evidence.referenceNumber?.trim());
  }

  if (result.country === "TW") {
    return result.status === "submitted" &&
      result.officialReceipt?.source === "official_success_page_with_application_number" &&
      Boolean(result.officialReceipt.caseNumber?.trim());
  }

  if (result.country === "US") {
    return result.status === "submitted" && result.finalSubmissionMode === "external_verified" &&
      Boolean(result.confirmationNumber?.trim());
  }

  if (result.country === "FR") {
    return result.status === "submitted" &&
      (result.officialStatus === "lodged_at_visa_centre" || Boolean(result.applicationReference?.trim()));
  }

  if (result.country === "JP" && "qrReady" in result) {
    return result.status === "qr_ready" && result.qrReady === true &&
      Boolean(result.artifacts?.qrCodes?.some(hasNonEmptyArtifact));
  }

  if (result.country === "KE") {
    return result.status === "approved" && hasNonEmptyArtifact(result.approvalPdfStoragePath);
  }

  // Generic e-visa status strings alone are not authoritative. Require both
  // the official reference and the stored success artifact written by the
  // runner after the portal confirms completion.
  if (["ID", "EG", "SA", "MY", "TH", "AE", "CA", "TR", "IT", "IN"].includes(result.country)) {
    return "artifactStoragePath" in result && result.status === "submitted" &&
      Boolean(result.reference?.trim()) && hasNonEmptyArtifact(result.artifactStoragePath);
  }

  return false;
}

/** The long form uses this to place the result without country-specific UI branching. */
export function getSubmissionResultPlacement(input: {
  submittedAt?: string | null;
  country?: string | null;
  visaType?: string | null;
  submissionResultStatus?: SubmissionResultStatus | null;
  submissionResult?: SubmissionResult | null;
}): "confirmation" | "review" | "none" {
  if (!shouldShowSubmissionStatusStep(input)) return "none";
  return hasConfirmedTerminalSubmissionSuccess(input) ? "confirmation" : "review";
}

/**
 * The saved application review is part of the application record, not a
 * transient submission-state view. Once a status card is shown, keep the
 * review beside it for every country and every status so applicants can
 * always audit and amend the answers used for a retry or official handoff.
 */
export function shouldShowReviewAlongsideSubmissionStatus(): true {
  return true;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * A payload-validation failure happened before any official-site side effect.
 * Once the applicant edits their answers, that stale result must no longer
 * replace the primary review/submit action. Official portal failures and
 * active/terminal results remain untouched.
 */
export function shouldResetJpVjwPreflightAfterAnswerSave(input: {
  visaType?: string | null;
  submissionResultStatus?: string | null;
  submissionResult?: unknown;
}): boolean {
  if ((input.visaType ?? "").trim().toUpperCase() !== "JP_VISIT_JAPAN_WEB") {
    return false;
  }
  if ((input.submissionResultStatus ?? "").trim().toLowerCase() !== "needs_attention") {
    return false;
  }

  const result = asRecord(input.submissionResult);
  const errorDetails = asRecord(result?.errorDetails);
  return errorDetails?.code === JP_VJW_PAYLOAD_VALIDATION_ERROR_CODE;
}
