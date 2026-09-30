import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubmissionQueueItem } from "./types";

type RecordValue = Record<string, unknown>;
type SourceRow = {
  id: string;
  application_id: string;
  ceac_result_payload: RecordValue;
  locked_until?: string;
};
const DEADLINE_MS = 15_000;
const INTENT_STATUS = "ceac_result_payload->automaticEmail->>status";
const INTENT_VERSION = "ceac_result_payload->automaticEmail->>version";
function record(value: unknown): RecordValue | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue : null;
}
function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Stored with the confirmed submission; never added by reading a result page. */
export function createDs160AutomaticEmailIntent(): RecordValue {
  return { version: 1, status: "waiting_for_cleanup" };
}

async function verifiedOwner(client: SupabaseClient, source: SourceRow): Promise<string> {
  const { data: application, error } = await client.from("applications")
    .select("applicant_id,submission_result,ds160_application_id")
    .eq("id", source.application_id).abortSignal(AbortSignal.timeout(DEADLINE_MS)).maybeSingle();
  const result = record(application?.submission_result);
  const officialId = application?.ds160_application_id;
  if (error || !application || result?.country !== "US" || result.status !== "submitted"
    || typeof officialId !== "string" || !officialId.trim()
    || result.applicationId !== officialId || source.ceac_result_payload.applicationId !== officialId) {
    throw new Error("ds160_auto_email_submission_unverified");
  }
  const { data: fences, error: fenceError } = await client.from("ds160_final_submission_attempts")
    .select("id").eq("application_id", source.application_id).eq("state", "confirmed")
    .eq("official_application_id_hash", digest(officialId.trim()))
    .limit(1).abortSignal(AbortSignal.timeout(DEADLINE_MS));
  if (fenceError || !Array.isArray(fences) || fences.length !== 1) {
    throw new Error("ds160_auto_email_confirmation_unverified");
  }
  const { data: profile, error: profileError } = await client.from("applicant_profiles")
    .select("auth_user_id").eq("id", application.applicant_id)
    .abortSignal(AbortSignal.timeout(DEADLINE_MS)).maybeSingle();
  if (profileError || !profile || typeof profile.auth_user_id !== "string" || !profile.auth_user_id) {
    throw new Error("ds160_auto_email_owner_unavailable");
  }
  return profile.auth_user_id;
}

/**
 * Caller MUST have awaited browser close and heartbeat stop. An interrupted
 * cleanup cannot call this function. Only the exact completed claim is released;
 * no processing/stale row or final-submission fence is modified.
 */
export async function markDs160AutomaticEmailReady(
  client: SupabaseClient,
  item: Pick<SubmissionQueueItem, "id" | "application_id" | "locked_by" | "locked_at">,
): Promise<boolean> {
  if (!item.locked_by || !item.locked_at) return false;
  const { data, error } = await client.from("submission_queue")
    .select("id,application_id,ceac_result_payload,locked_until")
    .eq("id", item.id).eq("application_id", item.application_id).eq("status", "ds160_submitted")
    .eq("provider", "ceac_live").eq("mode", "live_assisted").eq(INTENT_VERSION, "1")
    .eq("locked_by", item.locked_by).eq("locked_at", item.locked_at)
    .gt("locked_until", new Date().toISOString()).eq(INTENT_STATUS, "waiting_for_cleanup")
    .abortSignal(AbortSignal.timeout(DEADLINE_MS)).maybeSingle();
  if (error) throw new Error("ds160_auto_email_source_unavailable");
  if (!data) return false;
  const source = data as SourceRow;
  await verifiedOwner(client, source);
  const automaticEmail = record(source.ceac_result_payload.automaticEmail);
  const { data: updated, error: updateError } = await client.from("submission_queue").update({
    ceac_result_payload: {
      ...source.ceac_result_payload,
      automaticEmail: { ...automaticEmail, status: "ready" },
    },
    locked_by: null, locked_at: null, locked_until: null,
  }).eq("id", item.id).eq("application_id", item.application_id).eq("status", "ds160_submitted")
    .eq("provider", "ceac_live").eq("mode", "live_assisted").eq(INTENT_VERSION, "1")
    .eq("locked_by", item.locked_by).eq("locked_at", item.locked_at)
    .eq("locked_until", source.locked_until)
    .gt("locked_until", new Date().toISOString()).eq(INTENT_STATUS, "waiting_for_cleanup")
    .select("id").abortSignal(AbortSignal.timeout(DEADLINE_MS)).maybeSingle();
  if (updateError) throw new Error("ds160_auto_email_cleanup_handoff_unavailable");
  return updated !== null;
}

/**
 * Called by the existing bounded legacy startup/drain. It never sends mail
 * itself. The existing enqueue RPC serializes by application, checks active
 * siblings, and reuses this stable request even after an ambiguous RPC response.
 * No historical application scan/backfill and no automatic failed-send replay.
 */
export async function dispatchDs160AutomaticEmails(client: SupabaseClient): Promise<number> {
  const { data, error } = await client.from("submission_queue")
    .select("id,application_id,ceac_result_payload")
    .eq("status", "ds160_submitted").eq(INTENT_STATUS, "ready")
    .eq("provider", "ceac_live").eq("mode", "live_assisted").eq(INTENT_VERSION, "1")
    .is("locked_by", null).is("locked_at", null).is("locked_until", null)
    .order("created_at", { ascending: true }).limit(10)
    .abortSignal(AbortSignal.timeout(DEADLINE_MS));
  if (error || !Array.isArray(data)) throw new Error("ds160_auto_email_intents_unavailable");
  let dispatched = 0;
  for (const source of data as SourceRow[]) {
    try {
      const authUserId = await verifiedOwner(client, source);
      const { data: auth, error: authError } = await client.auth.admin.getUserById(authUserId);
      const email = auth.user?.email?.trim().toLowerCase();
      if (authError || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("ds160_auto_email_account_unavailable");
      }
      const { data: jobs, error: enqueueError } = await client.rpc("enqueue_ds160_proof_email", {
        p_application_id: source.application_id,
        p_auth_user_id: authUserId,
        p_request_id: source.id,
        p_recipient_sha256: digest(email),
        p_retry: false,
      });
      if (enqueueError || !Array.isArray(jobs) || jobs.length !== 1) {
        throw new Error("ds160_auto_email_enqueue_unconfirmed");
      }
      const job = record(jobs[0]);
      const payload = record(job?.ceac_result_payload);
      if (typeof job?.id !== "string" || job.application_id !== source.application_id
        || payload?.action !== "official_ceac_email") {
        throw new Error("ds160_auto_email_job_unverified");
      }
      // A returned prior terminal email is intentionally reused, never retried.
      // If this write fails, replaying only enqueue with the same source UUID
      // reconciles the existing row; it cannot reserve another official send.
      const { data: updated, error: updateError } = await client.from("submission_queue").update({
        ceac_result_payload: {
          ...source.ceac_result_payload,
          automaticEmail: { ...record(source.ceac_result_payload.automaticEmail), status: "queued", jobId: job.id },
        },
      }).eq("id", source.id).eq("application_id", source.application_id)
        .eq("status", "ds160_submitted").eq(INTENT_STATUS, "ready")
        .eq("provider", "ceac_live").eq("mode", "live_assisted").eq(INTENT_VERSION, "1")
        .is("locked_by", null).is("locked_at", null).is("locked_until", null)
        .select("id").abortSignal(AbortSignal.timeout(DEADLINE_MS)).maybeSingle();
      if (updateError) throw new Error("ds160_auto_email_link_unconfirmed");
      if (updated) dispatched += 1;
    } catch {
      // Keep the durable intent; do not demote the submitted application or
      // expose account/portal details through logs. A later wake can reconcile.
      console.warn("[ceac-email] Automatic email intent retained for recovery.");
    }
  }
  return dispatched;
}
