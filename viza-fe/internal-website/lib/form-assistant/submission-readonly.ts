import { hasSuccessfulArrivalCardSubmission } from "@/features/arrival-cards/application-lifecycle";
import { isDigitalArrivalCardApplication } from "@/lib/submission-queue";
import {
  getAutomatedOnlineSubmissionEvidence,
  isAutomatedOnlineVisaType,
} from "@/lib/submission-result-evidence";
import type { FormAssistantState } from "@/types/form-assistant";

const SUCCESSFUL_RESULT_STATUSES = new Set([
  "approved",
  "completed",
  "paid",
  "submitted",
  "submitted_mock",
  "submitted_pending_email",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * A durable successful result makes the completed application immutable while
 * leaving its form-assistant history available for audit. Status text alone
 * is never sufficient: the saved submission_result must also be present.
 * Workflows with stronger evidence contracts keep their dedicated checks.
 */
export function hasSuccessfulFormSubmission(input: {
  country?: string | null;
  visaType?: string | null;
  submissionResultStatus?: string | null;
  submissionResult: unknown;
}): boolean {
  if (isDigitalArrivalCardApplication(input.country, input.visaType)) {
    return hasSuccessfulArrivalCardSubmission({
      country: input.country,
      visaType: input.visaType,
      submissionResult: input.submissionResult,
    });
  }

  if (isAutomatedOnlineVisaType(input.visaType)) {
    return getAutomatedOnlineSubmissionEvidence(
      input.submissionResult,
      input.visaType,
    ).submitted;
  }

  const result = asRecord(input.submissionResult);
  if (!result) return false;

  const payloadStatus = normalize(result.status);
  const storedStatus = normalize(input.submissionResultStatus);
  if (payloadStatus) return SUCCESSFUL_RESULT_STATUSES.has(payloadStatus);
  return SUCCESSFUL_RESULT_STATUSES.has(storedStatus);
}

/**
 * A successful submission is historical evidence, not a draft that should be
 * revalidated against today's date. Keep the saved conversation while showing
 * the readiness that was necessarily reached at submission time.
 */
export function toSubmittedFormAssistantState(
  state: FormAssistantState,
): FormAssistantState {
  const total = Math.max(0, state.progress.total);
  return {
    ...state,
    missingFields: [],
    progress: { completed: total, total },
    canRunFinalCheck: false,
  };
}
