import { supabase } from "../supabase.js";
import { sendAlert } from "../alerts/dispatch.js";
import { RunnerJobOwnershipLostError } from "./execution-context.js";

/**
 * Request operator takeover (CS-003).
 *
 * Called by a country runner when it can't proceed: anti-bot wall,
 * new ID-verify page, unmatched selector. The runner:
 *   1. Captures `remoteDebugUrl` (browser.contexts()[0].pages()[0]
 *      Playwright tracing endpoint, or a CDP URL minted by the
 *      worker box).
 *   2. Calls `requestHumanTakeover` here.
 *   3. Pauses — the lease still holds, so other workers won't claim
 *      the same runner_job until the takeover closes.
 */

export interface RequestTakeoverInput {
  jobId: string;
  workerId: string;
  applicationId: string;
  applicantId: string;
  reason: string;
  remoteDebugUrl: string;
  vncUrl?: string;
}

export async function requestHumanTakeover(
  input: RequestTakeoverInput,
): Promise<{ takeoverId: string }> {
  const { data, error } = await supabase.rpc("open_runner_job_takeover", {
    p_job_id: input.jobId,
    p_worker_id: input.workerId,
    p_application_id: input.applicationId,
    p_applicant_id: input.applicantId,
    p_reason: input.reason,
    p_remote_debug_url: input.remoteDebugUrl,
    p_vnc_url: input.vncUrl ?? null,
  });
  if (error) throw new Error(`open_runner_job_takeover: ${error.message}`);

  const row = Array.isArray(data) ? data[0] : data;
  const takeoverId =
    typeof row === "object"
      && row !== null
      && typeof (row as { takeover_id?: unknown }).takeover_id === "string"
      ? (row as { takeover_id: string }).takeover_id
      : null;
  if (!takeoverId) {
    throw new RunnerJobOwnershipLostError(
      "runner job ownership was lost before opening a human takeover",
    );
  }

  void sendAlert({
    severity: "error",
    class: "runner.needs_human",
    title: "Runner needs operator takeover",
    body: `Reason: ${input.reason}\nJob: ${input.jobId}\nTakeover: ${takeoverId}`,
    jobId: input.jobId,
    applicationId: input.applicationId,
  });

  return { takeoverId };
}
