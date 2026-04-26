import { supabase } from "./supabase";
import type { SubmissionResult, SubmissionResultStatus } from "./submission-result";

/**
 * Persist the canonical per-country result payload to applications.submission_result
 * and flip submission_result_status. The frontend's existing realtime
 * subscription on applications then drives the user-facing card transition
 * without any new socket plumbing.
 *
 * Service role bypasses RLS — safe to call from any submission-service
 * runner. Caller is responsible for ensuring `applicationId` exists.
 */
export async function writeSubmissionResult(
  applicationId: string,
  result: SubmissionResult,
  status: SubmissionResultStatus,
): Promise<void> {
  const { error } = await supabase
    .from("applications")
    .update({
      submission_result: result as unknown as Record<string, unknown>,
      submission_result_status: status,
      submission_result_updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  if (error) {
    throw new Error(
      `writeSubmissionResult(${applicationId}, ${result.country}, ${status}) failed: ${error.message}`,
    );
  }
}

/**
 * Mark an application as failed without a structured payload. Use when a
 * runner aborts before it can produce any country-specific artifacts.
 */
export async function markSubmissionFailed(
  applicationId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase
    .from("applications")
    .update({
      submission_result: { error: reason } as unknown as Record<string, unknown>,
      submission_result_status: "failed" as SubmissionResultStatus,
      submission_result_updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  if (error) {
    throw new Error(
      `markSubmissionFailed(${applicationId}) failed: ${error.message}`,
    );
  }
}

/**
 * Bump submission_result_status without changing the payload. Use to
 * advance the FE waiting UI through phases ("processing" once the runner
 * starts, etc.).
 */
export async function setSubmissionStatus(
  applicationId: string,
  status: SubmissionResultStatus,
): Promise<void> {
  const { error } = await supabase
    .from("applications")
    .update({
      submission_result_status: status,
      submission_result_updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  if (error) {
    throw new Error(
      `setSubmissionStatus(${applicationId}, ${status}) failed: ${error.message}`,
    );
  }
}
