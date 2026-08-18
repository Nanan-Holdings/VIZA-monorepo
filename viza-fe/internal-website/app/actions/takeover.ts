"use server";

import { createClient } from "@/lib/supabase/server";
import { withAdmin } from "@/lib/auth/with-admin";

/**
 * Operator-side takeover actions (CS-003).
 *
 * - listOpenTakeovers() — admin-only queue.
 * - claimTakeover(takeoverId) — claims the session through the guarded RPC.
 * - completeTakeover(takeoverId, answers, operatorNotes?) — passes bounded
 *   captured answers to the guarded settlement RPC, which atomically writes
 *   answers and settles the takeover + runner_job.
 * - abandonTakeover(takeoverId, reason) — operator can't finish; row and
 *   runner_job are settled through the same guarded RPC.
 *
 * The remote-debug URL is gated by getCurrentUser().role==='admin'.
 * 2FA enforcement is delegated to Supabase Auth's MFA factors —
 * `requires2faVerified()` enforces an `aal2` session before
 * the URL is exposed.
 */

interface TakeoverSettlementRow {
  settled?: unknown;
  job_id?: unknown;
  application_id?: unknown;
  job_status?: unknown;
}

interface TakeoverClaimRow {
  claimed?: unknown;
  job_id?: unknown;
  application_id?: unknown;
  handoff_kind?: unknown;
}

const MAX_TAKEOVER_ANSWER_FIELDS = 200;
const MAX_TAKEOVER_ANSWER_FIELD_LENGTH = 200;
const MAX_TAKEOVER_ANSWER_VALUE_LENGTH = 4_000;
const MAX_TAKEOVER_ANSWERS_JSON_BYTES = 256 * 1024;
const MAX_TAKEOVER_OPERATOR_NOTES_LENGTH = 4_000;

function parseTakeoverClaim(data: unknown): TakeoverClaimRow | null {
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === "object" ? (row as TakeoverClaimRow) : null;
}

function parseTakeoverSettlement(data: unknown): TakeoverSettlementRow | null {
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === "object" ? (row as TakeoverSettlementRow) : null;
}

function normalizeTakeoverAnswers(answers: Record<string, string>): Record<string, string> {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    throw new Error("takeover answers must be an object");
  }
  const entries = Object.entries(answers);
  if (entries.length > MAX_TAKEOVER_ANSWER_FIELDS) {
    throw new Error(`takeover answers exceed ${MAX_TAKEOVER_ANSWER_FIELDS} fields`);
  }
  const normalized: Record<string, string> = {};
  for (const [field, value] of entries) {
    if (!field || field.length > MAX_TAKEOVER_ANSWER_FIELD_LENGTH) {
      throw new Error("takeover answer field name is invalid");
    }
    if (typeof value !== "string" || value.length > MAX_TAKEOVER_ANSWER_VALUE_LENGTH) {
      throw new Error("takeover answer value is invalid");
    }
    normalized[field] = value;
  }
  const serialized = JSON.stringify(normalized);
  if (Buffer.byteLength(serialized, "utf8") > MAX_TAKEOVER_ANSWERS_JSON_BYTES) {
    throw new Error("takeover answers exceed 256 KiB");
  }
  return normalized;
}

function normalizeOperatorNotes(operatorNotes: string | undefined): string | null {
  if (operatorNotes === undefined) return null;
  if (typeof operatorNotes !== "string" || operatorNotes.length > MAX_TAKEOVER_OPERATOR_NOTES_LENGTH) {
    throw new Error("takeover operator notes must be at most 4000 characters");
  }
  return operatorNotes;
}

async function require2fa(): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: assurance, error: assuranceError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError || assurance.currentLevel !== "aal2") {
    throw new Error(
      "A current 2FA-verified session is required for operator takeover.",
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
      .select("remote_debug_url, vnc_url, status, claimed_by")
      .eq("id", takeoverId)
      .maybeSingle();
    if (error || !data) throw new Error(`takeover not found`);
    if (data.status === "completed" || data.status === "abandoned") {
      throw new Error("Takeover is closed; debug URL revoked.");
    }
    if (data.status !== "claimed" || data.claimed_by !== userId) {
      throw new Error("Claim this takeover before revealing the operator session.");
    }
    const { error: logError } = await admin.from("takeover_action_log").insert({
      takeover_id: takeoverId,
      action: "claim",
      actor_user_id: userId,
      detail: { revealed: true },
    });
    if (logError) throw new Error(`takeover reveal audit: ${logError.message}`);
    return {
      url: data.remote_debug_url as string,
      vncUrl: (data.vnc_url as string | null) ?? null,
    };
  });
}

export async function claimTakeover(takeoverId: string): Promise<void> {
  const { userId } = await require2fa();
  return withAdmin("admin", "actions/takeover:claim", async (admin) => {
    const { data, error } = await admin.rpc("claim_takeover_session", {
      p_takeover_id: takeoverId,
      p_claimant_id: userId,
      p_expected_handoff_kind: null,
    });
    if (error) throw new Error(`takeover claim: ${error.message}`);
    const claim = parseTakeoverClaim(data);
    if (!claim || claim.claimed !== true) {
      throw new Error("takeover claim conflict: session is no longer available");
    }
  });
}

export async function completeTakeover(
  takeoverId: string,
  answers: Record<string, string>,
  operatorNotes?: string,
): Promise<{ ok: true; answersWritten: number }> {
  const { userId } = await require2fa();
  return withAdmin("admin", "actions/takeover:complete", async (admin) => {
    const boundedAnswers = normalizeTakeoverAnswers(answers);
    const boundedOperatorNotes = normalizeOperatorNotes(operatorNotes);

    const { data: settlementData, error: settlementError } = await admin.rpc(
      "settle_runner_job_takeover",
      {
        p_takeover_id: takeoverId,
        p_actor_user_id: userId,
        p_outcome: "completed",
        p_operator_notes: boundedOperatorNotes,
        p_answers: boundedAnswers,
      },
    );
    if (settlementError) {
      throw new Error(`takeover settlement: ${settlementError.message}`);
    }
    const settlement = parseTakeoverSettlement(settlementData);
    if (!settlement || settlement.settled !== true) {
      throw new Error("takeover settlement conflict: session is no longer active");
    }
    return { ok: true as const, answersWritten: Object.keys(boundedAnswers).length };
  });
}

export async function abandonTakeover(
  takeoverId: string,
  reason: string,
): Promise<void> {
  const { userId } = await require2fa();
  return withAdmin("admin", "actions/takeover:abandon", async (admin) => {
    const boundedReason = normalizeOperatorNotes(reason);
    const { data: settlementData, error: settlementError } = await admin.rpc(
      "settle_runner_job_takeover",
      {
        p_takeover_id: takeoverId,
        p_actor_user_id: userId,
        p_outcome: "abandoned",
        p_operator_notes: boundedReason,
        p_answers: {},
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
