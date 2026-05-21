import { supabase } from "../supabase.js";
import { sendAlert } from "../alerts/dispatch.js";

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
  applicationId: string;
  applicantId: string;
  reason: string;
  remoteDebugUrl: string;
  vncUrl?: string;
}

export async function requestHumanTakeover(
  input: RequestTakeoverInput,
): Promise<{ takeoverId: string }> {
  const { error: jobErr } = await supabase
    .from("runner_job")
    .update({
      status: "needs_human",
      last_error: input.reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.jobId);
  if (jobErr) throw new Error(`runner_job update: ${jobErr.message}`);

  const { data, error } = await supabase
    .from("takeover_session")
    .insert({
      job_id: input.jobId,
      application_id: input.applicationId,
      applicant_id: input.applicantId,
      status: "queued",
      reason: input.reason,
      remote_debug_url: input.remoteDebugUrl,
      vnc_url: input.vncUrl ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`takeover_session insert: ${error?.message}`);
  }
  const takeoverId = data.id as string;

  await supabase.from("takeover_action_log").insert({
    takeover_id: takeoverId,
    action: "open",
    detail: { reason: input.reason, jobId: input.jobId },
  });

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
