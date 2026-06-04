import {
  RetryableRunnerError,
  NeedsHumanError,
  type DispatchOutcome,
} from "../queue/types.js";

/**
 * Standard runner-result → runner_job outcome mapping (RUN-CORE-002).
 *
 * Single place that maps every runner outcome to a DispatchOutcome (normal
 * return → worker marks `succeeded`) or a thrown error (worker retries →
 * eventually `failed`/`dead_letter`). Keeps status semantics uniform with
 * worker.ts across every RUN-* runner.
 *
 *   submitted            → submitted_pending_pay   (succeeded)
 *   stopped_before_pay   → halted_before_pay       (succeeded)
 *   stopped_before_signature → halted_before_pay   (succeeded)
 *   submitted_pending_pay → submitted_pending_pay  (succeeded)
 *   paper_ready          → paper_ready             (succeeded)
 *   blocked / anti_bot_gate → throw RetryableRunnerError (retry → failed)
 *   needs_human          → throw NeedsHumanError   (retry → failed)
 */

export interface StandardRunResultLike {
  status: string;
  reason?: string;
  reachedStep?: string;
  artefacts?: string[];
}

export function mapStandardToOutcome(r: StandardRunResultLike): DispatchOutcome {
  const reachedStep = r.reachedStep ?? "unknown";
  const artefacts = r.artefacts ?? [];
  switch (r.status) {
    case "submitted":
    case "submitted_pending_pay":
      return { outcome: "submitted_pending_pay", reachedStep, artefacts };
    case "stopped_before_pay":
    case "stopped_before_signature":
    case "halted_before_pay":
      return { outcome: "halted_before_pay", reachedStep, artefacts };
    case "paper_ready":
      return { outcome: "paper_ready", reachedStep, artefacts };
    case "blocked":
    case "anti_bot_gate":
      throw new RetryableRunnerError(`${r.status}: ${r.reason ?? ""}`);
    case "needs_human":
      throw new NeedsHumanError(r.reason ?? "needs human intervention");
    default:
      throw new Error(`unexpected runner status: ${r.status}`);
  }
}

/** Terminal runner_job status a normal/return outcome maps to. */
export type RunnerJobStatus = "succeeded" | "failed";

/** A returned DispatchOutcome always means the worker marks the job succeeded. */
export function outcomeToJobStatus(_outcome: DispatchOutcome): RunnerJobStatus {
  return "succeeded";
}
