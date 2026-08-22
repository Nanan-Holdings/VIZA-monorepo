"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { success: true } | { success: false; error: string };

export async function retryAdminRunnerJob(input: { jobId: string; reason: string }): Promise<Result> {
  try {
    const actor = await requireRole("admin");
    if (input.reason.trim().length < 5) return { success: false, error: "A retry reason is required" };
    const admin = createAdminClient();
    const { data: before, error: readError } = await admin.from("runner_job").select("*").eq("id", input.jobId).maybeSingle();
    if (readError || !before) return { success: false, error: readError?.message || "Runner job not found" };
    if (!["failed", "dead_letter", "paused", "needs_human"].includes(before.status)) {
      return { success: false, error: `A ${before.status} runner job cannot be retried` };
    }
    const { data: takeover } = await admin.from("takeover_session").select("id").eq("job_id", input.jobId).in("status", ["queued", "claimed"]).limit(1).maybeSingle();
    if (takeover) return { success: false, error: "Close or abandon the active operator takeover before retrying" };
    const now = new Date().toISOString();
    const changes = { status: "queued", attempts: 0, enqueued_at: now, started_at: null, finished_at: null, leased_by: null, leased_until: null };
    const { error: auditError } = await admin.from("admin_command_events").insert({
      actor_user_id: actor.id,
      command: "runner_job.retry_requested",
      target_type: "runner_job",
      target_id: input.jobId,
      reason: input.reason.trim(),
      before_state: {
        application_id: before.application_id,
        country: before.country,
        status: before.status,
        attempts: before.attempts,
        max_attempts: before.max_attempts,
        enqueued_at: before.enqueued_at,
        finished_at: before.finished_at,
      },
      after_state: changes,
    });
    if (auditError) return { success: false, error: `Retry not queued because audit failed: ${auditError.message}` };
    const { error: updateError } = await admin.from("runner_job").update(changes).eq("id", input.jobId).eq("status", before.status);
    if (updateError) return { success: false, error: updateError.message };
    revalidatePath("/admin");
    revalidatePath("/admin/work");
    revalidatePath(`/admin/jobs/${input.jobId}`);
    revalidatePath(`/admin/applications/${before.application_id}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to retry runner job" };
  }
}
