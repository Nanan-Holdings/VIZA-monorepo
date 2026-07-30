import { withAdmin } from "@/lib/auth/with-admin";
import { ensureFlyMachineStarted } from "@/lib/fly-machine-wake.server";
import { assertKnownCountry } from "@/lib/queue/countries";

/**
 * Producer for the runner_job queue (INFRA-002).
 *
 * `enqueueRunnerJob(applicationId, country, opts?)` is idempotent on
 * the application_id: a queued / running row for the same application
 * is reused rather than duplicated. Returns the runner_job id either
 * way.
 *
 * Called from the Stripe webhook handler on `order paid` (PAY-002 gate)
 * and any future server action that elects to fast-path an admin-paid
 * application.
 */

export interface EnqueueOpts {
  correlationId?: string;
  maxAttempts?: number;
  metadata?: Record<string, unknown>;
}

export type EnqueueSgacRetryResult =
  | {
      route: "runner_job";
      id: string;
      created: boolean;
      workerTriggered: boolean;
    }
  | {
      route: "legacy";
      id: string;
      status: string;
    };

/**
 * Atomically routes an immediate SGAC retry to the Singapore runner.
 *
 * The database RPC holds a per-application lock and refuses to create a
 * runner_job while a legacy submission_queue row is active. This prevents a
 * retry click during the migration from submitting the same application in
 * both transports.
 */
export async function enqueueSgacRunnerRetry(
  applicationId: string,
  opts: EnqueueOpts = {},
): Promise<EnqueueSgacRetryResult> {
  const result = await withAdmin("system", "lib/queue:enqueue-sgac-retry", async (admin) => {
    const { data, error } = await admin.rpc("enqueue_sgac_country_runner_retry", {
      p_application_id: applicationId,
      p_max_attempts: opts.maxAttempts ?? 3,
      p_correlation_id: opts.correlationId ?? null,
      p_metadata: opts.metadata ?? {},
    });
    if (error) {
      throw new Error(`SGAC runner enqueue: ${error.message}`);
    }

    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
    if (row?.blocked_by_legacy === true) {
      const legacyQueueId = typeof row.legacy_queue_id === "string" ? row.legacy_queue_id : null;
      const legacyQueueStatus =
        typeof row.legacy_queue_status === "string" ? row.legacy_queue_status : null;
      if (!legacyQueueId || !legacyQueueStatus) {
        throw new Error("SGAC runner enqueue returned an invalid legacy fallback.");
      }
      return {
        route: "legacy" as const,
        id: legacyQueueId,
        status: legacyQueueStatus,
      };
    }

    const id = typeof row?.runner_job_id === "string" ? row.runner_job_id : null;
    if (!id) {
      throw new Error("SGAC runner enqueue returned no runner job.");
    }
    return {
      route: "runner_job" as const,
      id,
      created: row?.reused_existing !== true,
    };
  });

  if (result.route === "legacy") return result;

  const wake = await ensureFlyMachineStarted("singapore");
  if (!wake.ok && wake.reason !== "unmanaged_target" && wake.reason !== "not_configured") {
    console.warn("[runner-job] Singapore Fly wake failed; queued work remains recoverable.", {
      jobId: result.id.slice(0, 8),
      reason: wake.reason,
    });
  }
  return {
    ...result,
    workerTriggered: wake.ok,
  };
}

export async function enqueueRunnerJob(
  applicationId: string,
  country: string,
  opts: EnqueueOpts = {},
): Promise<{ id: string; created: boolean }> {
  // QUE-004: validate + normalize the country against the shared contract
  // so the consumer's dispatch table never sees an unroutable value.
  const normalizedCountry = assertKnownCountry(country);
  const result = await withAdmin("system", "lib/queue:enqueue", async (admin) => {
    const { data: existing } = await admin
      .from("runner_job")
      .select("id, status")
      .eq("application_id", applicationId)
      .in("status", ["queued", "running"])
      .order("enqueued_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      return { id: existing.id as string, created: false };
    }
    const { data, error } = await admin
      .from("runner_job")
      .insert({
        application_id: applicationId,
        country: normalizedCountry,
        status: "queued",
        attempts: 0,
        max_attempts: opts.maxAttempts ?? 3,
        correlation_id: opts.correlationId ?? null,
        metadata: opts.metadata ?? null,
      })
      .select("id")
      .single();
    if (error || !data) {
      throw new Error(`runner_job insert: ${error?.message ?? "no data"}`);
    }
    return { id: data.id as string, created: true };
  });
  const wake = await ensureFlyMachineStarted(normalizedCountry);
  if (!wake.ok && wake.reason !== "unmanaged_target" && wake.reason !== "not_configured") {
    console.warn("[runner-job] Fly wake failed; scheduled autoscaling remains available.", {
      country: normalizedCountry,
      jobId: result.id.slice(0, 8),
      reason: wake.reason,
    });
  }
  return result;
}
