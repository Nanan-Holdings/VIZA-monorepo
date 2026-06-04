import { fillVietnamApplication } from "./run.js";
import { loadCanonicalAnswers } from "../queue/answers.js";
import { RetryableRunnerError, type DispatchOutcome } from "../queue/dispatch.js";

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
export async function runOne(applicationId: string, jobId?: string): Promise<DispatchOutcome> {
  const answers = await loadCanonicalAnswers(applicationId);
  const result = await fillVietnamApplication({ answers }, { runId: jobId ?? applicationId });
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
