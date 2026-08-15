import { supabase } from "./supabase";
import type { SubmissionResult, SubmissionResultStatus } from "./submission-result";
import {
  RunnerJobOwnershipLostError,
  type RunnerExecutionContext,
} from "./queue/execution-context.js";

const MAX_POOL_RESULT_ERROR_LENGTH = 500;

function boundedErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, MAX_POOL_RESULT_ERROR_LENGTH);
}

function firstRpcRow(data: unknown): Record<string, unknown> | null {
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === "object" ? (row as Record<string, unknown>) : null;
}

/**
 * Persist a result for a claimed shared-pool job through the ownership-fenced
 * service-role RPC. The database checks the live lease and updates the
 * application row atomically; no direct applications update is safe here.
 */
export async function writeRunnerPoolSubmissionResult(
  execution: RunnerExecutionContext,
  result: SubmissionResult,
  status: SubmissionResultStatus,
): Promise<void> {
  execution.assertOwned();
  if (!execution.jobId || !execution.workerId) {
    throw new Error("runner pool result persistence requires job and worker identity");
  }

  let data: unknown;
  let error: { message?: string } | null;
  try {
    const response = await supabase.rpc("write_runner_pool_submission_result", {
      p_job_id: execution.jobId,
      p_worker_id: execution.workerId,
      p_submission_result: result as unknown as Record<string, unknown>,
      p_submission_result_status: status,
    });
    data = response.data;
    error = response.error;
  } catch (rpcError) {
    throw new Error(
      `write_runner_pool_submission_result failed: ${boundedErrorMessage(rpcError)}`,
    );
  }
  if (error) {
    throw new Error(
      `write_runner_pool_submission_result failed: ${boundedErrorMessage(error.message ?? error)}`,
    );
  }
  if (!firstRpcRow(data)) {
    throw new RunnerJobOwnershipLostError(
      "runner job lease ownership was lost while persisting the submission result",
    );
  }
}

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
      ...(status === "submitted" ? { status: "submitted" } : {}),
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

export async function markSubmissionStalled(
  applicationId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase
    .from("applications")
    .update({
      submission_result: { error: reason } as unknown as Record<string, unknown>,
      submission_result_status: "stalled" as SubmissionResultStatus,
      submission_result_updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  if (error) {
    throw new Error(
      `markSubmissionStalled(${applicationId}) failed: ${error.message}`,
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
