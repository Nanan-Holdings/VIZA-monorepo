import { createAdminClient } from "@/lib/supabase/admin";

/**
 * runner_job lifecycle → status-hub descriptor (POR-011).
 *
 * The full-cycle status hub reads runner_job (queued/running/succeeded/
 * failed/dead_letter/paused) IN ADDITION to the submission_queue-derived
 * application steps, and turns it into an actionable lifecycle phase:
 *   - halt-before-gov-pay (succeeded + outcome=halted_before_pay) → an
 *     actionable "pay government fee" step
 *   - dead_letter → a support-contact state
 *   - failed → a support/retry state
 * The pure `mapRunnerJobStatus` is unit-tested; `getRunnerLifecycle` is the
 * read path the status page calls per application.
 */

export type RunnerJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "dead_letter"
  | "paused";

export type LifecyclePhase =
  | "pending"
  | "in_progress"
  | "done"
  | "action_required"
  | "support"
  | "paused";

export interface RunnerLifecycle {
  status: RunnerJobStatus;
  phase: LifecyclePhase;
  /** Short label for the status hub. */
  label: string;
  /** True when the applicant must act (e.g. pay the government fee). */
  actionable: boolean;
  /** True when the job is stuck and the user should contact support. */
  supportNeeded: boolean;
}

export function mapRunnerJobStatus(
  status: string,
  metadata?: Record<string, unknown> | null,
): RunnerLifecycle {
  const outcome = metadata && typeof metadata.outcome === "string" ? metadata.outcome : null;
  switch (status) {
    case "queued":
      return { status: "queued", phase: "pending", label: "Queued for processing", actionable: false, supportNeeded: false };
    case "running":
      return { status: "running", phase: "in_progress", label: "Submitting your application", actionable: false, supportNeeded: false };
    case "paused":
      return { status: "paused", phase: "paused", label: "Temporarily paused", actionable: false, supportNeeded: false };
    case "succeeded":
      if (outcome === "halted_before_pay") {
        return { status: "succeeded", phase: "action_required", label: "Pay the government fee to finalize", actionable: true, supportNeeded: false };
      }
      return { status: "succeeded", phase: "done", label: "Submitted — awaiting decision", actionable: false, supportNeeded: false };
    case "failed":
      return { status: "failed", phase: "support", label: "Submission failed — we're on it", actionable: false, supportNeeded: true };
    case "dead_letter":
      return { status: "dead_letter", phase: "support", label: "Needs attention — please contact support", actionable: false, supportNeeded: true };
    default:
      return { status: "queued", phase: "pending", label: "Queued for processing", actionable: false, supportNeeded: false };
  }
}

/** Read the latest runner_job for an application and map it to a lifecycle. */
export async function getRunnerLifecycle(applicationId: string): Promise<RunnerLifecycle | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("runner_job")
    .select("status, metadata")
    .eq("application_id", applicationId)
    .order("enqueued_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return mapRunnerJobStatus(String(data.status), data.metadata as Record<string, unknown> | null);
}
