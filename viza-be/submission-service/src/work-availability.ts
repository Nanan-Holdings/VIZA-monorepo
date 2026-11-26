import { supabase } from "./supabase.js";
import { isScheduledSubmissionDue } from "./scheduled-work.js";

export const LEGACY_IMMEDIATE_QUEUE_STATUSES = [
  "pending",
  "ds160_prefill_pending",
  "ds160_live_assisted_pending",
  "ds160_proof_pending",
  "fv_prefill_pending",
  "france_live_assisted_pending",
  "uk_prefill_pending",
  "uk_live_assisted_pending",
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

export const LEGACY_SCHEDULED_QUEUE_STATUSES = [
  "sgac_live_assisted_scheduled",
  "mdac_live_assisted_scheduled",
  "tdac_live_assisted_scheduled",
  "phetravel_live_assisted_scheduled",
] as const;

/**
 * What a legacy-kind worker can actually claim. A dedicated worker (DS-160,
 * France-Visas) narrows the providers it serves, and the Singapore worker
 * denylists those; the idle check must count only that work, or a dedicated
 * worker sees another worker's job, never claims it and never stops.
 */
export interface LegacyWorkScope {
  providerAllowlist?: Iterable<string>;
  providerDenylist?: Iterable<string>;
  vietnamStatusChecks?: boolean;
}

interface ProviderFilterable {
  in(column: string, values: readonly string[]): ProviderFilterable;
  or(filters: string): ProviderFilterable;
}

// PostgREST filter builders return themselves, so the scoped query keeps the
// caller's type; checking Supabase's deep builder generics against a
// structural constraint overflows tsc (TS2589), hence the narrow cast.
export function scopeProviders<Q>(query: Q, scope: LegacyWorkScope): Q {
  const allow = [...(scope.providerAllowlist ?? [])];
  const deny = [...(scope.providerDenylist ?? [])];
  let scoped = query as unknown as ProviderFilterable;
  if (allow.length > 0) scoped = scoped.in("provider", allow);
  if (deny.length > 0) scoped = scoped.or(`provider.is.null,provider.not.in.(${deny.join(",")})`);
  return scoped as unknown as Q;
}

type ScheduledQueueRow = {
  application_id: string;
  status: string;
};

type ScheduledApplicationRow = {
  id: string;
  submission_result: unknown;
};

async function hasDueScheduledSubmission(now: Date, scope: LegacyWorkScope): Promise<boolean> {
  const { data: scheduledRows, error } = await scopeProviders(
    supabase
      .from("submission_queue")
      .select("application_id, status")
      .in("status", [...LEGACY_SCHEDULED_QUEUE_STATUSES])
      .lt("attempts", 3),
    scope,
  ).limit(1_000);
  if (error) throw new Error(`scheduled submission work check: ${error.message}`);
  const rows = (scheduledRows ?? []) as ScheduledQueueRow[];
  if (rows.length === 0) return false;

  const applicationIds = [...new Set(rows.map((row) => row.application_id))];
  const { data: applications, error: applicationError } = await supabase
    .from("applications")
    .select("id, submission_result")
    .in("id", applicationIds);
  if (applicationError) {
    throw new Error(`scheduled application work check: ${applicationError.message}`);
  }
  const resultByApplication = new Map(
    ((applications ?? []) as ScheduledApplicationRow[]).map((row) => [
      row.id,
      row.submission_result,
    ]),
  );
  return rows.some((row) =>
    isScheduledSubmissionDue(row, resultByApplication.get(row.application_id), now),
  );
}

async function hasDueVietnamStatusCheck(nowIso: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("official_status_checks")
    .select("id", { count: "exact", head: true })
    .eq("country_code", "VN")
    .eq("status", "queued")
    .lte("scheduled_for", nowIso);
  if (error) {
    const message = error.message.toLowerCase();
    if (
      error.code === "PGRST204" ||
      error.code === "PGRST205" ||
      message.includes("official_status_checks") ||
      message.includes("schema cache")
    ) {
      return false;
    }
    throw new Error(`Vietnam status work check: ${error.message}`);
  }
  return (count ?? 0) > 0;
}

export async function hasCountryRunnerWork(country?: string): Promise<boolean> {
  let query = supabase
    .from("runner_job")
    .select("id", { count: "exact", head: true })
    .in("status", ["queued", "running"]);
  if (country) query = query.eq("country", country);
  const { count, error } = await query;
  if (error) throw new Error(`runner_job idle work check: ${error.message}`);
  return (count ?? 0) > 0;
}

export async function hasIndonesiaWorkerWork(): Promise<boolean> {
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
  if (error) throw new Error(`Indonesia submission_queue work check: ${error.message}`);
  if ((count ?? 0) > 0) return true;
  // An open applicant handoff keeps the worker alive so its watcher can
  // record the official receipt or expire the handoff.
  const { count: handoffCount, error: handoffError } = await supabase
    .from("submission_queue")
    .select("id", { count: "exact", head: true })
    .in("status", ["id_c1_applicant_handoff", "id_b1_evoa_applicant_handoff"]);
  if (handoffError) throw new Error(`Indonesia handoff work check: ${handoffError.message}`);
  return (handoffCount ?? 0) > 0;
}

export async function hasLegacyWorkerWork(
  scope: LegacyWorkScope = {},
  now = new Date(),
): Promise<boolean> {
  const { count, error } = await scopeProviders(
    supabase
      .from("submission_queue")
      .select("id", { count: "exact", head: true })
      .in("status", [...LEGACY_IMMEDIATE_QUEUE_STATUSES])
      .lt("attempts", 3),
    scope,
  );
  if (error) throw new Error(`submission_queue idle work check: ${error.message}`);
  if ((count ?? 0) > 0) return true;

  // An open Vietnam applicant handoff keeps the worker alive so its watcher
  // can record the official registration code or expire the handoff.
  const { count: handoffCount, error: handoffError } = await scopeProviders(
    supabase
      .from("submission_queue")
      .select("id", { count: "exact", head: true })
      .in("status", ["vn_applicant_handoff", "vn_applicant_submitted"]),
    scope,
  );
  if (handoffError) throw new Error(`Vietnam handoff work check: ${handoffError.message}`);
  if ((handoffCount ?? 0) > 0) return true;

  const [scheduledDue, statusDue] = await Promise.all([
    hasDueScheduledSubmission(now, scope),
    scope.vietnamStatusChecks === false
      ? Promise.resolve(false)
      : hasDueVietnamStatusCheck(now.toISOString()),
  ]);
  return scheduledDue || statusDue;
}
