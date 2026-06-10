import type { JobHandler } from "./worker.js";
import { getRunOne } from "./dispatch.js";
import { emitRunnerEvent } from "../metrics/emit.js";

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
export const runnerJobHandler: JobHandler = async (job) => {
  const cid = job.correlation_id ?? "-";
  emitRunnerEvent(job.country, "started", job.id);
  console.log(`[queue] cid=${cid} job=${job.id.slice(0, 8)} country=${job.country} dispatch`);
  try {
    const runOne = getRunOne(job.country);
    const outcome = await runOne(job.application_id, job.id);
    emitRunnerEvent(job.country, outcome.outcome === "halted_before_pay" ? "halted" : "succeeded", job.id);
    console.log(
      `[queue] cid=${cid} job=${job.id.slice(0, 8)} country=${job.country} -> ${outcome.outcome} @ ${outcome.reachedStep}`,
    );
  } catch (err) {
    emitRunnerEvent(job.country, "failed", job.id);
    console.error(`[queue] cid=${cid} job=${job.id.slice(0, 8)} country=${job.country} threw`, err);
    throw err; // worker handles retry/dead-letter
  }
};
