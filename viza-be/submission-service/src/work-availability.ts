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
  "vn_dry_run_pending",
  "vn_live_assisted_pending",
  "vn_cloud_live_pending",
  "vn_payment_pending",
  "vn_prearrival_dry_run_pending",
  "vn_prearrival_live_assisted_pending",
  "sgac_dry_run_pending",
  "sgac_live_assisted_pending",
  "mdac_dry_run_pending",
  "mdac_live_assisted_pending",
  "tdac_dry_run_pending",
  "tdac_live_assisted_pending",
  "id_c1_live_assisted_pending",
  "id_b1_evoa_live_assisted_pending",
  "phetravel_dry_run_pending",
  "phetravel_live_assisted_pending",
  "vn_prefill_pending",
  "au_prefill_pending",
] as const;

export const LEGACY_SCHEDULED_QUEUE_STATUSES = [
  "vn_prearrival_live_assisted_scheduled",
  "sgac_live_assisted_scheduled",
  "mdac_live_assisted_scheduled",
  "tdac_live_assisted_scheduled",
  "phetravel_live_assisted_scheduled",
] as const;

type ScheduledQueueRow = {
  application_id: string;
  status: string;
};

type ScheduledApplicationRow = {
  id: string;
  submission_result: unknown;
};

async function hasDueScheduledSubmission(now: Date): Promise<boolean> {
  const { data: scheduledRows, error } = await supabase
    .from("submission_queue")
    .select("application_id, status")
    .in("status", [...LEGACY_SCHEDULED_QUEUE_STATUSES])
    .lt("attempts", 3)
    .limit(1_000);
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

export async function hasCountryRunnerWork(country: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("runner_job")
    .select("id", { count: "exact", head: true })
    .eq("country", country)
    .in("status", ["queued", "running"]);
  if (error) throw new Error(`runner_job idle work check: ${error.message}`);
  return (count ?? 0) > 0;
}

export async function hasLegacyWorkerWork(now = new Date()): Promise<boolean> {
  const { count, error } = await supabase
    .from("submission_queue")
    .select("id", { count: "exact", head: true })
    .in("status", [...LEGACY_IMMEDIATE_QUEUE_STATUSES])
    .lt("attempts", 3);
  if (error) throw new Error(`submission_queue idle work check: ${error.message}`);
  if ((count ?? 0) > 0) return true;

  const [scheduledDue, statusDue] = await Promise.all([
    hasDueScheduledSubmission(now),
    hasDueVietnamStatusCheck(now.toISOString()),
  ]);
  return scheduledDue || statusDue;
}
