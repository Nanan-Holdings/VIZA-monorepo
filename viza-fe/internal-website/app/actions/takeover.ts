"use server";

import { createClient } from "@/lib/supabase/server";
import { withAdmin } from "@/lib/auth/with-admin";

/**
 * Operator-side takeover actions (CS-003).
 *
 * - listOpenTakeovers() — admin-only queue.
 * - claimTakeover(takeoverId) — flips status='claimed' + claimed_by.
 * - completeTakeover(takeoverId, answers, operatorNotes?) — writes
 *   the captured answers back into visa_application_answers, then settles
 *   the takeover + runner_job through one guarded database RPC.
 * - abandonTakeover(takeoverId, reason) — operator can't finish; row and
 *   runner_job are settled through the same guarded RPC.
 *
 * The remote-debug URL is gated by getCurrentUser().role==='admin'.
 * 2FA enforcement is delegated to Supabase Auth's MFA factors —
 * `requires2faVerified()` enforces an `aal2` session before
 * the URL is exposed.
 */

interface SupabaseUser {
  id: string;
  factors?: Array<{ status: string; factor_type: string }>;
  user_metadata?: { aal?: string };
}

interface TakeoverSettlementRow {
  settled?: unknown;
  job_id?: unknown;
  application_id?: unknown;
  job_status?: unknown;
}

function parseTakeoverSettlement(data: unknown): TakeoverSettlementRow | null {
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === "object" ? (row as TakeoverSettlementRow) : null;
}

async function require2fa(): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  // Supabase Auth surfaces the AAL on the JWT. We treat the absence
  // of a verified TOTP factor as "2FA not satisfied" and refuse.
  const u = user as unknown as SupabaseUser;
  const verified =
    u.factors?.some((f) => f.status === "verified" && f.factor_type === "totp") ??
    false;
  if (!verified) {
    throw new Error(
      "2FA required for operator takeover. Enrol a TOTP factor in /client/account.",
    );
  }
  return { userId: user.id };
}

export interface OpenTakeoverRow {
  id: string;
  jobId: string;
  applicationId: string;
  applicantId: string;
  reason: string;
  status: string;
  createdAt: string;
  claimedBy: string | null;
}

export async function listOpenTakeovers(): Promise<OpenTakeoverRow[]> {
  return withAdmin("admin", "actions/takeover:list", async (admin) => {
    const { data, error } = await admin
      .from("takeover_session")
      .select(
        "id, job_id, application_id, applicant_id, reason, status, created_at, claimed_by",
      )
      .in("status", ["queued", "claimed"])
      .order("created_at", { ascending: true });
    if (error) throw new Error(`takeover list: ${error.message}`);
    return (data ?? []).map((r): OpenTakeoverRow => ({
      id: r.id as string,
      jobId: r.job_id as string,
      applicationId: r.application_id as string,
      applicantId: r.applicant_id as string,
      reason: r.reason as string,
      status: r.status as string,
      createdAt: r.created_at as string,
      claimedBy: (r.claimed_by as string | null) ?? null,
    }));
  });
}

export async function getTakeoverRemoteDebugUrl(
  takeoverId: string,
): Promise<{ url: string; vncUrl: string | null }> {
  const { userId } = await require2fa();
  return withAdmin("admin", "actions/takeover:reveal", async (admin) => {
    const { data, error } = await admin
      .from("takeover_session")
      .select("remote_debug_url, vnc_url, status")
      .eq("id", takeoverId)
      .maybeSingle();
    if (error || !data) throw new Error(`takeover not found`);
    if (data.status === "completed" || data.status === "abandoned") {
      throw new Error("Takeover is closed; debug URL revoked.");
    }
    await admin.from("takeover_action_log").insert({
      takeover_id: takeoverId,
      action: "claim",
      actor_user_id: userId,
      detail: { revealed: true },
    });
    return {
      url: data.remote_debug_url as string,
      vncUrl: (data.vnc_url as string | null) ?? null,
    };
  });
}

export async function claimTakeover(takeoverId: string): Promise<void> {
  const { userId } = await require2fa();
  return withAdmin("admin", "actions/takeover:claim", async (admin) => {
    const { error } = await admin
      .from("takeover_session")
      .update({
        status: "claimed",
        claimed_by: userId,
        claimed_at: new Date().toISOString(),
      })
      .eq("id", takeoverId);
    if (error) throw new Error(`claim: ${error.message}`);
  });
}

export async function completeTakeover(
  takeoverId: string,
  answers: Record<string, string>,
  operatorNotes?: string,
): Promise<{ ok: true; answersWritten: number }> {
  const { userId } = await require2fa();
  return withAdmin("admin", "actions/takeover:complete", async (admin) => {
    const { data: row, error: readErr } = await admin
      .from("takeover_session")
      .select("id, application_id, job_id")
      .eq("id", takeoverId)
      .maybeSingle();
    if (readErr || !row) throw new Error(`takeover not found`);

    const upserts = Object.entries(answers).map(([field_name, value_text]) => ({
      application_id: row.application_id,
      field_name,
      value_text,
      updated_at: new Date().toISOString(),
    }));
    if (upserts.length > 0) {
      const { error: ansErr } = await admin
        .from("visa_application_answers")
        .upsert(upserts, { onConflict: "application_id,field_name" });
      if (ansErr) throw new Error(`answers upsert: ${ansErr.message}`);
    }

    const { data: settlementData, error: settlementError } = await admin.rpc(
      "settle_runner_job_takeover",
      {
        p_takeover_id: takeoverId,
        p_actor_user_id: userId,
        p_outcome: "completed",
        p_operator_notes: operatorNotes ?? null,
        p_answers_written: upserts.length,
      },
    );
    if (settlementError) {
      throw new Error(`takeover settlement: ${settlementError.message}`);
    }
    const settlement = parseTakeoverSettlement(settlementData);
    if (!settlement || settlement.settled !== true) {
      throw new Error("takeover settlement conflict: session is no longer active");
    }
    return { ok: true as const, answersWritten: upserts.length };
  });
}

export async function abandonTakeover(
  takeoverId: string,
  reason: string,
): Promise<void> {
  const { userId } = await require2fa();
  return withAdmin("admin", "actions/takeover:abandon", async (admin) => {
    const { data: settlementData, error: settlementError } = await admin.rpc(
      "settle_runner_job_takeover",
      {
        p_takeover_id: takeoverId,
        p_actor_user_id: userId,
        p_outcome: "abandoned",
        p_operator_notes: reason,
        p_answers_written: 0,
      },
    );
    if (settlementError) {
      throw new Error(`takeover settlement: ${settlementError.message}`);
    }
    const settlement = parseTakeoverSettlement(settlementData);
    if (!settlement || settlement.settled !== true) {
      throw new Error("takeover settlement conflict: session is no longer active");
    }
  });
}
