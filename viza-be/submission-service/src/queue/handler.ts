import type { JobHandler } from "./worker.js";
import { getRunOne } from "./dispatch.js";
import { UnsupportedCountryError } from "./types.js";
import { emitRunnerEvent } from "../metrics/emit.js";
import { isRunnerJobOwnershipLost } from "./worker.js";

/**
 * runner_job JobHandler (QUE-003). Looks up the job's country in the
 * dispatch table and invokes its `runOne(applicationId)`. A normal return
 * lets the worker mark the job `succeeded` (including halt-before-pay
 * outcomes); a throw routes through the worker's retry/dead-letter logic.
 *
 * `UnsupportedCountryError` (unwired country) propagates as a throw so the
 * worker records `last_error` and dead-letters once retries are exhausted,
 * instead of silently dropping a paid order.
 *
 * OBSV-003: every log line carries the job's `correlation_id` (set by the
 * portal producer, lib/queue/enqueue.ts) so a run is traceable end-to-end
 * across portal → queue → runner. Format: docs/observability/logging.md.
 */
function requirePoolFlowKey(flowKey: string | null | undefined): string {
  if (typeof flowKey !== "string" || flowKey.trim().length === 0) {
    throw new UnsupportedCountryError("runner_job/missing flow_key");
  }
  return flowKey;
}

/** Build a queue handler with an injectable resolver for contract tests. */
export function createRunnerJobHandler(
  resolveRunOne: typeof getRunOne = getRunOne,
): JobHandler {
  return async (job, execution) => {
    const cid = job.correlation_id ?? "-";
    emitRunnerEvent(job.country, "started", job.id);
    console.log(`[queue] cid=${cid} job=${job.id.slice(0, 8)} country=${job.country} dispatch`);
    try {
      // runner_job is the typed pool transport. A missing flow key must never
      // fall through to the legacy country dispatch table.
      const flowKey = requirePoolFlowKey(job.flow_key);
      const runOne = resolveRunOne(job.country, flowKey);
      const outcome = await runOne(job.application_id, job.id, execution);
      emitRunnerEvent(job.country, outcome.outcome === "halted_before_pay" ? "halted" : "succeeded", job.id);
      console.log(
        `[queue] cid=${cid} job=${job.id.slice(0, 8)} country=${job.country} -> ${outcome.outcome} @ ${outcome.reachedStep}`,
      );
    } catch (err) {
      if (isRunnerJobOwnershipLost(err) || execution.signal.aborted) {
        emitRunnerEvent(job.country, "ownership_lost", job.id);
      } else {
        emitRunnerEvent(job.country, "failed", job.id);
      }
      console.error(`[queue] cid=${cid} job=${job.id.slice(0, 8)} country=${job.country} threw`, err);
      throw err; // worker handles retry/dead-letter
    }
  };
}

export const runnerJobHandler: JobHandler = createRunnerJobHandler();
