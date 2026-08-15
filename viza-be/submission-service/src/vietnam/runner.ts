import { fillVietnamApplication } from "./run.js";
import { loadCanonicalAnswers } from "../queue/answers.js";
import { RetryableRunnerError, type DispatchOutcome } from "../queue/types.js";
import {
  requirePoolExecutionIdentity,
  type RunnerExecutionContext,
} from "../queue/execution-context.js";

/**
 * Vietnam e-Visa dispatch entrypoint (RUN-VN-001).
 *
 * Loads canonical answers and runs the live per-step fill
 * (fillVietnamApplication → fillers.fillFormStep), mapping the result to a
 * DispatchOutcome:
 *   - submitted_pending_pay   → submitted_pending_pay (worker: succeeded)
 *   - scaffolded_pending_walk → halted_before_pay      (worker: succeeded)
 *   - failed                  → RetryableRunnerError    (worker: retry)
 *
 * The scaffolded_pending_walk branch keeps the existing index.ts VN path
 * compatible (registration-code selector pending recon confirmation).
 */
async function runVietnamCore(
  applicationId: string,
  jobId: string,
  executionContext?: RunnerExecutionContext,
): Promise<DispatchOutcome> {
  executionContext?.assertOwned();
  const answers = await loadCanonicalAnswers(applicationId);
  const result = await fillVietnamApplication({ answers }, {
    runId: jobId,
    executionContext,
  });
  // A browser close caused by lease loss may make the fill runner return a
  // structured failed result. Never convert that cancellation into a portal
  // retry or persist a misleading submission outcome.
  executionContext?.assertOwned();
  switch (result.status) {
    case "submitted_pending_pay":
      return { outcome: "submitted_pending_pay", reachedStep: "submitted", artefacts: [] };
    case "scaffolded_pending_walk":
      return { outcome: "halted_before_pay", reachedStep: "scaffolded", artefacts: [] };
    case "failed":
      throw new RetryableRunnerError(`vietnam failed at ${result.failedStep}`);
    default:
      throw new Error(`unexpected vietnam status: ${(result as { status: string }).status}`);
  }
}

/** Shared-pool runner_job entrypoint. Pool claims must carry exact identity. */
export async function runOne(
  applicationId: string,
  jobId?: string,
  executionContext?: RunnerExecutionContext,
): Promise<DispatchOutcome> {
  const identity = requirePoolExecutionIdentity(
    executionContext,
    jobId,
    "Vietnam e-Visa pool execution",
  );
  return runVietnamCore(applicationId, identity.jobId, identity.executionContext);
}

/** Explicit legacy submission_queue entrypoint; never used by runner_job pool dispatch. */
export async function runLegacy(
  applicationId: string,
  jobId?: string,
): Promise<DispatchOutcome> {
  return runVietnamCore(applicationId, jobId ?? applicationId);
}
