import type { JobHandler } from "./worker.js";
import { getRunOne } from "./dispatch.js";

/**
 * runner_job JobHandler (QUE-003). Looks up the job's country in the
 * dispatch table and invokes its `runOne(applicationId)`. A normal return
 * lets the worker mark the job `succeeded` (including halt-before-pay
 * outcomes); a throw routes through the worker's retry/dead-letter logic.
 *
 * `UnsupportedCountryError` (unwired country) propagates as a throw so the
 * worker records `last_error` and dead-letters once retries are exhausted,
 * instead of silently dropping a paid order.
 */
export const runnerJobHandler: JobHandler = async (job) => {
  const runOne = getRunOne(job.country);
  const outcome = await runOne(job.application_id, job.id);
  console.log(
    `[queue] job ${job.id.slice(0, 8)} ${job.country} -> ${outcome.outcome} @ ${outcome.reachedStep}`,
  );
};
