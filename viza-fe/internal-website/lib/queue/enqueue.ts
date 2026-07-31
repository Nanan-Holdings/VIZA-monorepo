import { withAdmin } from "@/lib/auth/with-admin";
import {
  ensureFlyMachineCapacity,
  ensureFlyMachineStarted,
} from "@/lib/fly-machine-wake.server";
import { assertKnownCountry } from "@/lib/queue/countries";
import {
  resolveRunnerPoolFlow,
  type RunnerPoolFlowKey,
} from "@/lib/queue/flows";
import { isIndonesiaEVisaApplication } from "@/lib/submission-queue";

/**
 * Producers for shared-pool and sticky submission runners.
 *
 * New supported flows use one service-role-only database RPC so a repeated
 * click cannot race another request or an in-flight legacy submission. The
 * direct insert path remains available behind the migration flag as a
 * rollback path until each flow's pool parity gate is opened.
 */

export interface EnqueueOpts {
  correlationId?: string;
  maxAttempts?: number;
  metadata?: Record<string, unknown>;
  flowKey?: RunnerPoolFlowKey;
  availableAt?: string;
}

export type EnqueueRunnerPoolResult =
  | {
      transport: "runner_job";
      id: string;
      created: boolean;
      workerTriggered: boolean;
    }
  | {
      transport: "submission_queue";
      id: string;
      status: string | null;
      created: false;
      workerTriggered: boolean;
    };

type PoolDepthRow = {
  max_concurrent: number;
  paused: boolean;
  claimable: number;
  running: number;
};

function poolMigrationEnabled(): boolean {
  return process.env.RUNNER_POOL_MIGRATION_ENABLED === "true";
}

async function desiredRunnerPoolCapacity(): Promise<number> {
  return withAdmin("system", "lib/queue:pool-depth", async (admin) => {
    const { data, error } = await admin
      .from("runner_pool_depth")
      .select("max_concurrent, paused, claimable, running");
    if (error) {
      throw new Error(`runner pool depth: ${error.message}`);
    }
    return Math.min(
      10,
      ((data ?? []) as PoolDepthRow[]).reduce((total, row) => {
        if (row.paused) return total;
        const demand = Math.max(0, Number(row.claimable) + Number(row.running));
        return total + Math.min(Number(row.max_concurrent), demand);
      }, 0),
    );
  });
}

export async function enqueueRunnerPoolJob(
  applicationId: string,
  country: string,
  flowKey: RunnerPoolFlowKey,
  opts: EnqueueOpts = {},
): Promise<EnqueueRunnerPoolResult> {
  const normalizedCountry = assertKnownCountry(country);
  const row = await withAdmin("system", "lib/queue:enqueue-pool", async (admin) => {
    const { data, error } = await admin.rpc("enqueue_runner_pool_job", {
      p_application_id: applicationId,
      p_country: normalizedCountry,
      p_flow_key: flowKey,
      p_available_at: opts.availableAt ?? new Date().toISOString(),
      p_max_attempts: opts.maxAttempts ?? 3,
      p_correlation_id: opts.correlationId ?? null,
      p_metadata: opts.metadata ?? {},
    });
    if (error) {
      throw new Error(`runner pool enqueue: ${error.message}`);
    }
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) throw new Error("runner pool enqueue returned no row");
    return result as {
      runner_job_id: string | null;
      reused_existing: boolean;
      blocked_by_legacy: boolean;
      legacy_queue_id: string | null;
      legacy_queue_status: string | null;
    };
  });

  if (row.blocked_by_legacy) {
    if (!row.legacy_queue_id) {
      throw new Error("runner pool enqueue reported a legacy collision without a queue id");
    }
    const wake = await ensureFlyMachineStarted("legacy");
    return {
      transport: "submission_queue",
      id: row.legacy_queue_id,
      status: row.legacy_queue_status,
      created: false,
      workerTriggered: wake.ok,
    };
  }

  if (!row.runner_job_id) {
    throw new Error("runner pool enqueue returned no runner job id");
  }
  let workerTriggered = false;
  try {
    const desired = await desiredRunnerPoolCapacity();
    if (desired > 0) {
      const wake = await ensureFlyMachineCapacity("pool", desired);
      workerTriggered = wake.ok;
      if (!wake.ok && wake.reason !== "not_configured") {
        console.warn("[runner-pool] Immediate Fly capacity wake failed; reconciler will recover.", {
          jobId: row.runner_job_id.slice(0, 8),
          reason: wake.reason,
          desired,
        });
      }
    }
  } catch (error) {
    console.warn("[runner-pool] Capacity calculation failed; reconciler will recover.", {
      jobId: row.runner_job_id.slice(0, 8),
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    transport: "runner_job",
    id: row.runner_job_id,
    created: !row.reused_existing,
    workerTriggered,
  };
}

export async function enqueueRunnerJob(
  applicationId: string,
  country: string,
  opts: EnqueueOpts = {},
): Promise<{ id: string; created: boolean }> {
  const normalizedCountry = assertKnownCountry(country);
  const visaType = await withAdmin("system", "lib/queue:application-flow", async (admin) => {
    const { data, error } = await admin
      .from("applications")
      .select("visa_type")
      .eq("id", applicationId)
      .single();
    if (error || !data) {
      throw new Error(`runner job application lookup: ${error?.message ?? "no data"}`);
    }
    return (data.visa_type as string | null) ?? null;
  });
  const flowKey = opts.flowKey ?? resolveRunnerPoolFlow(normalizedCountry, visaType);
  if (isIndonesiaEVisaApplication(normalizedCountry, visaType)) {
    const isB1 = visaType?.trim().toUpperCase().includes("B1") ?? false;
    const status = isB1
      ? "id_b1_evoa_live_assisted_pending"
      : "id_c1_live_assisted_pending";
    const provider = isB1
      ? "indonesia_b1_evoa_live"
      : "indonesia_c1_live";
    const result = await withAdmin(
      "system",
      "lib/queue:enqueue-indonesia-sticky",
      async (admin) => {
        const { data, error } = await admin.rpc("enqueue_submission_retry", {
          p_application_id: applicationId,
          p_status: status,
          p_mode: "live_assisted",
          p_provider: provider,
          p_current_stage: "queued_for_indonesia_sticky_worker",
        });
        if (error) throw new Error(`Indonesia sticky enqueue: ${error.message}`);
        const row = Array.isArray(data) ? data[0] : data;
        if (!row?.queue_id) {
          throw new Error("Indonesia sticky enqueue returned no queue id");
        }
        return {
          id: String(row.queue_id),
          created: !row.reused_existing,
        };
      },
    );
    const wake = await ensureFlyMachineStarted("indonesia");
    if (!wake.ok && wake.reason !== "not_configured") {
      console.warn("[indonesia] Sticky Fly wake failed; reconciler will recover.", {
        jobId: result.id.slice(0, 8),
        reason: wake.reason,
      });
    }
    return result;
  }
  if ((poolMigrationEnabled() || flowKey === "vn_prearrival") && flowKey) {
    const result = await enqueueRunnerPoolJob(applicationId, normalizedCountry, flowKey, opts);
    return { id: result.id, created: result.created };
  }

  const result = await withAdmin("system", "lib/queue:enqueue-rollback", async (admin) => {
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
        flow_key: flowKey,
        available_at: opts.availableAt ?? new Date().toISOString(),
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
