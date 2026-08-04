#!/usr/bin/env npx tsx
/**
 * Five-minute recovery reconciler for the hybrid Fly runner fleet.
 *
 * The website performs the latency-sensitive first wake. This script repairs
 * missed wakes and scales the shared pool back to current claimable demand.
 * Pool Machines are retained and stopped, never destroyed.
 */

import "dotenv/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

interface PoolDepthRow {
  country: string;
  max_concurrent: number;
  paused: boolean;
  claimable: number;
  scheduled: number;
  running: number;
}

interface PoolScaleDecision {
  kind: "pool";
  app: string;
  desired: number;
  demand: number;
  stickySlots: number;
  busyMachineIds: string[];
  countries: Array<{
    country: string;
    cap: number;
    claimable: number;
    scheduled: number;
    running: number;
    desired: number;
    violation: boolean;
  }>;
}

interface LegacyScaleDecision {
  kind: "legacy";
  app: string;
  queued: number;
  desired: 0 | 1;
}

interface IndonesiaScaleDecision {
  kind: "indonesia";
  app: string;
  queued: number;
  desired: 0 | 1;
}

const RUNNER_POOL_APP =
  process.env.FLY_RUNNER_POOL_APP?.trim() || "viza-runner-pool";
const SUBMISSION_LEGACY_APP =
  process.env.FLY_SUBMISSION_LEGACY_APP?.trim() || "viza-submission-legacy";
const RUNNER_INDONESIA_APP =
  process.env.FLY_RUNNER_INDONESIA_APP?.trim() || "viza-runner-indonesia";

const LEGACY_CLAIMABLE_QUEUE_STATUSES = [
  "pending",
  "ds160_prefill_pending",
  "ds160_live_assisted_pending",
  "ds160_proof_pending",
  "fv_prefill_pending",
  "france_live_assisted_pending",
  "uk_prefill_pending",
  "vn_dry_run_pending",
  "vn_live_assisted_pending",
  "vn_cloud_live_pending",
  "vn_payment_pending",
  "sgac_dry_run_pending",
  "sgac_live_assisted_pending",
  "mdac_dry_run_pending",
  "mdac_live_assisted_pending",
  "tdac_dry_run_pending",
  "tdac_live_assisted_pending",
  "phetravel_dry_run_pending",
  "phetravel_live_assisted_pending",
  "vn_prefill_pending",
  "au_prefill_pending",
] as const;

const LEGACY_SCHEDULED_QUEUE_STATUSES = [
  "sgac_live_assisted_scheduled",
  "mdac_live_assisted_scheduled",
  "tdac_live_assisted_scheduled",
  "phetravel_live_assisted_scheduled",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function scheduledTimeZone(status: string): string {
  if (status.startsWith("vn_")) return "Asia/Ho_Chi_Minh";
  if (status.startsWith("tdac_")) return "Asia/Bangkok";
  if (status.startsWith("phetravel_")) return "Asia/Manila";
  return "Asia/Singapore";
}

function dateInTimeZone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function client(): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  );
}

async function fetchPoolDecision(supabase: SupabaseClient): Promise<PoolScaleDecision> {
  const [
    { data: depth, error: depthError },
    { data: slots, error: slotsError },
    { data: runningJobs, error: runningJobsError },
  ] =
    await Promise.all([
      supabase.from("runner_pool_depth").select("*"),
      supabase
        .from("runner_machine_slot")
        .select("owner_machine_id, owner_kind, lease_until")
        .gt("lease_until", new Date().toISOString()),
      supabase
        .from("runner_job")
        .select("leased_by")
        .eq("status", "running")
        .not("leased_by", "is", null),
    ]);
  if (depthError) throw new Error(`runner_pool_depth read: ${depthError.message}`);
  if (slotsError) throw new Error(`runner_machine_slot read: ${slotsError.message}`);
  if (runningJobsError) throw new Error(`runner_job leases read: ${runningJobsError.message}`);

  const rows = (depth ?? []) as PoolDepthRow[];
  const countries = rows.map((row) => {
    const demand = row.paused ? 0 : Math.max(0, row.claimable + row.running);
    return {
      country: row.country,
      cap: row.max_concurrent,
      claimable: row.claimable,
      scheduled: row.scheduled,
      running: row.running,
      desired: Math.min(row.max_concurrent, demand),
      violation: row.running > row.max_concurrent,
    };
  });
  const stickySlots = (slots ?? []).filter((slot) => slot.owner_kind !== "pool").length;
  const busyMachineIds = [
    ...new Set(
      (runningJobs ?? [])
        .filter((row) => row.leased_by)
        .map((row) => String(row.leased_by)),
    ),
  ];
  const demand = countries.reduce((total, row) => total + row.desired, 0);
  return {
    kind: "pool",
    app: RUNNER_POOL_APP,
    desired: Math.min(demand, Math.max(0, 10 - stickySlots)),
    demand,
    stickySlots,
    busyMachineIds,
    countries,
  };
}

async function fetchLegacyQueueDepth(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from("submission_queue")
    .select("id", { count: "exact", head: true })
    .in("status", [...LEGACY_CLAIMABLE_QUEUE_STATUSES])
    .lt("attempts", 3);
  if (error) throw new Error(`submission_queue depth read: ${error.message}`);

  const { data: scheduledRows, error: scheduledError } = await supabase
    .from("submission_queue")
    .select("application_id, status")
    .in("status", [...LEGACY_SCHEDULED_QUEUE_STATUSES])
    .lt("attempts", 3)
    .limit(1_000);
  if (scheduledError) {
    throw new Error(`scheduled submission_queue depth read: ${scheduledError.message}`);
  }
  if (!scheduledRows?.length) return count ?? 0;

  const applicationIds = [
    ...new Set(scheduledRows.map((row) => String(row.application_id))),
  ];
  const { data: applications, error: applicationError } = await supabase
    .from("applications")
    .select("id, submission_result")
    .in("id", applicationIds);
  if (applicationError) {
    throw new Error(`scheduled applications read: ${applicationError.message}`);
  }
  const resultByApplication = new Map(
    (applications ?? []).map((application) => [
      String(application.id),
      application.submission_result,
    ]),
  );
  const now = new Date();
  const dueScheduled = scheduledRows.filter((row) => {
    const result = resultByApplication.get(String(row.application_id));
    const scheduledFor =
      isRecord(result) && typeof result.scheduledFor === "string"
        ? result.scheduledFor.trim()
        : "";
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(scheduledFor)) return true;
    return scheduledFor <= dateInTimeZone(now, scheduledTimeZone(String(row.status)));
  }).length;
  return (count ?? 0) + dueScheduled;
}

async function fetchIndonesiaQueueDepth(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from("submission_queue")
    .select("id", { count: "exact", head: true })
    .in("status", [
      "id_c1_live_assisted_pending",
      "id_c1_live_assisted_processing",
      "id_c1_payment_processing",
      "id_b1_evoa_live_assisted_pending",
      "id_b1_evoa_live_assisted_processing",
      "id_b1_evoa_payment_processing",
    ])
    .lt("attempts", 3);
  if (error) throw new Error(`Indonesia submission_queue depth read: ${error.message}`);
  return count ?? 0;
}

async function alertViolations(decision: PoolScaleDecision): Promise<void> {
  const violations = decision.countries.filter((row) => row.violation);
  if (violations.length === 0 && decision.countries.reduce((sum, row) => sum + row.running, 0) <= 10) {
    return;
  }
  const to = process.env.RESEND_OPS_ALERT_TO;
  if (!to || !process.env.RESEND_API_KEY) {
    console.warn("[autoscale] concurrency violation; alert email is not configured");
    return;
  }
  const body = violations
    .map((row) => `${row.country}: running=${row.running} cap=${row.cap}`)
    .join("\n");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "VIZA OPS <ops@haggstorm.com>",
      to,
      subject: "[VIZA] shared runner concurrency violation",
      text: `Shared-pool concurrency violation detected.\n\n${body}`,
    }),
  });
  if (!response.ok) console.error(`[autoscale] alert send failed: ${response.status}`);
}

async function main(): Promise<void> {
  const supabase = client();
  const [pool, legacyQueued, indonesiaQueued] = await Promise.all([
    fetchPoolDecision(supabase),
    fetchLegacyQueueDepth(supabase),
    fetchIndonesiaQueueDepth(supabase),
  ]);
  await alertViolations(pool);
  const legacy: LegacyScaleDecision = {
    kind: "legacy",
    app: SUBMISSION_LEGACY_APP,
    queued: legacyQueued,
    desired: legacyQueued > 0 ? 1 : 0,
  };
  const indonesia: IndonesiaScaleDecision = {
    kind: "indonesia",
    app: RUNNER_INDONESIA_APP,
    queued: indonesiaQueued,
    desired: indonesiaQueued > 0 ? 1 : 0,
  };

  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify([pool, indonesia, legacy], null, 2)}\n`);
    return;
  }
  console.log(
    `${pool.app} desired=${pool.desired} demand=${pool.demand} stickySlots=${pool.stickySlots}`,
  );
  for (const row of pool.countries) {
    console.log(
      `${row.country.padEnd(16)} cap=${row.cap} claimable=${row.claimable} scheduled=${row.scheduled} running=${row.running} desired=${row.desired}${row.violation ? " VIOLATION" : ""}`,
    );
  }
  console.log(`${indonesia.app} queued=${indonesia.queued} desired=${indonesia.desired}`);
  console.log(`${legacy.app} queued=${legacy.queued} desired=${legacy.desired}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(2);
});
