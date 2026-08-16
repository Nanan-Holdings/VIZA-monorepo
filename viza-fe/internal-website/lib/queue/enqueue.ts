import { withAdmin } from "@/lib/auth/with-admin";
import {
  ensureFlyMachineCapacity,
} from "@/lib/fly-machine-wake.server";
import { assertKnownCountry } from "@/lib/queue/countries";
import {
  resolveRunnerPoolFlow,
  shouldUseSharedRunnerPool,
  type RunnerPoolFlowKey,
} from "@/lib/queue/flows";
import {
  isIndonesiaEVisaApplication,
  isVietnamEVisaApplication,
  queueProviderForApplication,
  queueStatusForApplication,
} from "@/lib/submission-queue";
import { wakeCloudSubmissionWorker } from "@/lib/submission-worker-wake.server";
import {
  isQaDryRunPurpose,
  isSyntheticQaValue,
} from "@/lib/applications/qa-safety";
import { assertRunnerCutoverActive } from "@/lib/runner-cutover-pause.server";

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

async function assertApplicationHasNoSyntheticQaData(
  applicationId: string
): Promise<void> {
  await withAdmin("system", "lib/queue:qa-safety", async (admin) => {
    const [{ data: application, error: applicationError }, { data: answers, error: answerError }] =
      await Promise.all([
        admin
          .from("applications")
          .select("purpose")
          .eq("id", applicationId)
          .single(),
        admin
          .from("visa_application_answers")
          .select("field_name, value_text, value_json")
          .eq("application_id", applicationId),
      ]);
    if (applicationError || !application) {
      throw new Error(
        `submission safety application lookup: ${applicationError?.message ?? "no data"}`
      );
    }
    if (answerError) {
      throw new Error(`submission safety answer lookup: ${answerError.message}`);
    }
    if (isQaDryRunPurpose(application.purpose)) {
      throw new Error("Synthetic QA applications cannot enter a live runner queue.");
    }
    const unsafe = (answers ?? []).find(
      (answer) =>
        isSyntheticQaValue(answer.value_text) ||
        isSyntheticQaValue(JSON.stringify(answer.value_json ?? null))
    );
    if (unsafe) {
      throw new Error(
        `Application contains synthetic QA data in ${unsafe.field_name}; live submission is blocked.`
      );
    }
  });
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
  assertRunnerCutoverActive();
  await assertApplicationHasNoSyntheticQaData(applicationId);
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
    const wake = await wakeCloudSubmissionWorker(row.legacy_queue_id, {
      target: "legacy",
    });
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
      const endpointWake = wake.ok
        ? await wakeCloudSubmissionWorker(row.runner_job_id, { target: "pool" })
        : { ok: false as const, reason: "request_failed" as const };
      workerTriggered = endpointWake.ok;
      if (!wake.ok && wake.reason !== "not_configured") {
        console.warn("[runner-pool] Immediate Fly capacity wake failed; reconciler will recover.", {
          jobId: row.runner_job_id.slice(0, 8),
          reason: wake.reason,
          desired,
        });
      }
      if (!endpointWake.ok && endpointWake.reason !== "not_configured") {
        console.warn("[runner-pool] Runner endpoint wake failed; recovery reconciler will retry.", {
          jobId: row.runner_job_id.slice(0, 8),
          reason: endpointWake.reason,
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
  assertRunnerCutoverActive();
  await assertApplicationHasNoSyntheticQaData(applicationId);
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

  const wake = await wakeCloudSubmissionWorker(result.id, { target: "pool" });
  if (!wake.ok && wake.reason !== "not_configured") {
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
  assertRunnerCutoverActive();
  await assertApplicationHasNoSyntheticQaData(applicationId);
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
    const wake = await wakeCloudSubmissionWorker(result.id, { target: "indonesia" });
    if (!wake.ok && wake.reason !== "not_configured") {
      console.warn("[indonesia] Sticky Fly wake failed; reconciler will recover.", {
        jobId: result.id.slice(0, 8),
        reason: wake.reason,
      });
    }
    return result;
  }
  if (isVietnamEVisaApplication(normalizedCountry, visaType)) {
    const status = queueStatusForApplication(normalizedCountry, visaType, "live_assisted");
    const provider = queueProviderForApplication(normalizedCountry, visaType, "live_assisted");
    const result = await withAdmin(
      "system",
      "lib/queue:enqueue-vietnam-sticky",
      async (admin) => {
        const { data, error } = await admin.rpc("enqueue_submission_retry", {
          p_application_id: applicationId,
          p_status: status,
          p_mode: "live_assisted",
          p_provider: provider,
          p_current_stage: "queued_for_vietnam_sticky_worker",
        });
        if (error) throw new Error(`Vietnam sticky enqueue: ${error.message}`);
        const row = Array.isArray(data) ? data[0] : data;
        if (!row?.queue_id) {
          throw new Error("Vietnam sticky enqueue returned no queue id");
        }
        return {
          id: String(row.queue_id),
          created: !row.reused_existing,
        };
      },
    );
    const wake = await wakeCloudSubmissionWorker(result.id, { target: "legacy" });
    if (!wake.ok && wake.reason !== "not_configured") {
      console.warn("[vietnam] Sticky Fly wake failed; reconciler will recover.", {
        jobId: result.id.slice(0, 8),
        reason: wake.reason,
      });
    }
    return result;
  }
  if (flowKey && shouldUseSharedRunnerPool(flowKey, poolMigrationEnabled())) {
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
  const wake = await wakeCloudSubmissionWorker(result.id, {
    target: "pool",
  });
  if (!wake.ok && wake.reason !== "not_configured") {
    console.warn("[runner-job] Fly wake failed; scheduled autoscaling remains available.", {
      country: normalizedCountry,
      jobId: result.id.slice(0, 8),
      reason: wake.reason,
    });
  }
  return result;
}
