"use server";

import { randomBytes, randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/rbac";
import { hashBetaCode, hashBetaIdentity } from "@/lib/checkout/beta-access";

const BETA_CAMPAIGN = "launch-beta-2026";
const SOCIAL_COHORT_SIZE = 100;

export type BetaDelivery = "promo_code" | "link_suffix";
export type BetaOperatorErrorCode =
  | "unauthorized"
  | "already_initialized"
  | "not_initialized"
  | "invalid_evidence"
  | "invalid_expiration"
  | "exhausted"
  | "conflict"
  | "launch_not_ready"
  | "backend_error";

export type BetaLaunchConfigIssue =
  | "identity_hmac_key_missing"
  | "checkout_handoff_key_missing";

export type BetaActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: BetaOperatorErrorCode };

export type IssuedBetaInvite = {
  value: string;
  deliveryMethod: BetaDelivery;
  slotNumber?: number;
  assignmentId?: string;
};

export type UndeliveredSocialInvite = {
  assignmentId: string;
  slotNumber: number;
  deliveryMethod: BetaDelivery;
  platform: string;
  recipientReference: string;
  issuedAt: string;
};

export type SocialBetaVariantMetrics = {
  deliveryMethod: BetaDelivery;
  delivered: number;
  checkoutStarted: number;
  converted: number;
  submitted: number;
};

export type BetaOperatorState = {
  campaign: string;
  initialized: boolean;
  cohortState: string | null;
  targetCount: number;
  issued: number;
  delivered: number;
  remainingIssuable: number;
  issuedUndelivered: UndeliveredSocialInvite[];
  friendInvitesIssued: number;
  canInitialize: boolean;
  launchConfigReady: boolean;
  launchConfigIssues: BetaLaunchConfigIssue[];
  metrics: SocialBetaVariantMetrics[];
};

function betaLaunchConfigReadiness(
  env: NodeJS.ProcessEnv = process.env,
): { ready: boolean; issues: BetaLaunchConfigIssue[] } {
  if (env.NODE_ENV !== "production") return { ready: true, issues: [] };
  const issues: BetaLaunchConfigIssue[] = [];
  if ((env.BETA_IDENTITY_HMAC_KEY?.trim().length ?? 0) < 32) {
    issues.push("identity_hmac_key_missing");
  }
  const handoffKey = env.CHECKOUT_HANDOFF_ENCRYPTION_KEY?.trim() ?? "";
  const handoffKeyBytes = /^[A-Za-z0-9+/]+={0,2}$/.test(handoffKey) && handoffKey.length % 4 === 0
    ? Buffer.from(handoffKey, "base64")
    : Buffer.alloc(0);
  if (
    handoffKeyBytes.length !== 32
    || handoffKeyBytes.toString("base64") !== handoffKey
  ) {
    issues.push("checkout_handoff_key_missing");
  }
  return { ready: issues.length === 0, issues };
}

function generateCode(audience: "social" | "friends"): string {
  const body = randomBytes(7).toString("hex").toUpperCase();
  return `${audience === "social" ? "VIZA50" : "VIZAFREE"}-${body}`;
}

function shuffledSocialPlan(): BetaDelivery[] {
  const plan: BetaDelivery[] = [
    ...Array.from({ length: SOCIAL_COHORT_SIZE / 2 }, () => "promo_code" as const),
    ...Array.from({ length: SOCIAL_COHORT_SIZE / 2 }, () => "link_suffix" as const),
  ];
  for (let index = plan.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [plan[index], plan[swapIndex]] = [plan[swapIndex], plan[index]];
  }
  return plan;
}

function publicInviteValue(code: string, deliveryMethod: BetaDelivery): string {
  if (deliveryMethod === "promo_code") return code;
  const base = (process.env.VIZA_MARKETING_PUBLIC_BASE_URL ?? "https://viza.it.com").replace(/\/$/, "");
  return `${base}/apply?beta=${encodeURIComponent(code)}`;
}

function cleanEvidence(value: string, maxLength: number): string | null {
  const cleaned = value.trim();
  return cleaned && cleaned.length <= maxLength ? cleaned : null;
}

function cleanExpiration(value?: string | null): string | null | undefined {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) return undefined;
  return new Date(timestamp).toISOString();
}

function errorResult(error: unknown, operation: "initialize" | "issue"): BetaActionResult<never> {
  const message = error instanceof Error
    ? error.message.toLowerCase()
    : typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "").toLowerCase()
      : "";
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
  if (/auth|admin|staff|permission|role/.test(message)) return { ok: false, error: "unauthorized" };
  if (operation === "initialize" && (code === "23505" || /already|initialized|exists|duplicate/.test(message))) {
    return { ok: false, error: "already_initialized" };
  }
  if (/not initialized|not_initialized|missing cohort/.test(message)) return { ok: false, error: "not_initialized" };
  if (/exhausted|no unassigned|cohort full/.test(message)) return { ok: false, error: "exhausted" };
  if (code === "40001" || code === "40P01" || /conflict|concurrent/.test(message)) {
    return { ok: false, error: "conflict" };
  }
  return { ok: false, error: "backend_error" };
}

function refreshBetaPages() {
  revalidatePath("/admin/marketing/beta");
  revalidatePath("/admin/cs/beta");
}

export async function initializeSocialBetaCohort(): Promise<BetaActionResult<{ targetCount: 100 }>> {
  try {
    const actor = await requireRole("admin");
    const admin = createAdminClient();
    const { error } = await admin.rpc("initialize_beta_social_cohort", {
      p_delivery_plan: shuffledSocialPlan(),
      p_created_by: actor.id,
    });
    if (error) throw error;
    refreshBetaPages();
    return { ok: true, data: { targetCount: SOCIAL_COHORT_SIZE } };
  } catch (error) {
    return errorResult(error, "initialize");
  }
}

export async function issueNextSocialBetaInvite(input: {
  platform: string;
  recipientReference: string;
  recipientEmail: string;
  proofReference: string;
  expiresAt?: string | null;
}): Promise<BetaActionResult<{ invite: IssuedBetaInvite }>> {
  try {
    if (!betaLaunchConfigReadiness().ready) return { ok: false, error: "launch_not_ready" };
    const actor = await requireRole("admin", "staff", "customer_service");
    const platform = cleanEvidence(input.platform, 80);
    const recipientReference = cleanEvidence(input.recipientReference, 240);
    const recipientEmail = input.recipientEmail.trim().toLowerCase();
    const proofReference = cleanEvidence(input.proofReference, 500);
    if (
      !platform
      || !recipientReference
      || !proofReference
      || recipientEmail.length > 320
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)
    ) {
      return { ok: false, error: "invalid_evidence" };
    }
    const expiresAt = cleanExpiration(input.expiresAt);
    if (expiresAt === undefined) return { ok: false, error: "invalid_expiration" };

    const code = generateCode("social");
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("issue_verified_social_invite", {
      p_recipient_reference: recipientReference,
      p_recipient_identity_hmac: hashBetaIdentity(recipientEmail),
      p_platform: platform,
      p_proof_reference: proofReference,
      p_actor_id: actor.id,
      p_code_hash: hashBetaCode(code),
      p_code_hint: code.slice(-6),
      p_expires_at: expiresAt,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    const deliveryMethod = row && typeof row === "object" && "delivery_method" in row
      ? String(row.delivery_method)
      : "";
    const slotNumber = row && typeof row === "object" && "slot_number" in row
      ? Number(row.slot_number)
      : Number.NaN;
    const assignmentId = row && typeof row === "object" && "assignment_id" in row
      ? String(row.assignment_id)
      : "";
    if (!(["promo_code", "link_suffix"] as string[]).includes(deliveryMethod) || !Number.isInteger(slotNumber) || !assignmentId) {
      throw new Error("Invalid social invitation assignment response");
    }
    refreshBetaPages();
    return {
      ok: true,
      data: {
        invite: {
          value: publicInviteValue(code, deliveryMethod as BetaDelivery),
          deliveryMethod: deliveryMethod as BetaDelivery,
          slotNumber,
          assignmentId,
        },
      },
    };
  } catch (error) {
    return errorResult(error, "issue");
  }
}

export async function markSocialBetaInviteDelivered(input: {
  assignmentId: string;
  deliveryReference: string;
}): Promise<BetaActionResult<{ assignmentId: string }>> {
  try {
    const actor = await requireRole("admin", "staff", "customer_service");
    const assignmentId = cleanEvidence(input.assignmentId, 80);
    const deliveryReference = cleanEvidence(input.deliveryReference, 500);
    if (!assignmentId || !deliveryReference) return { ok: false, error: "invalid_evidence" };
    const admin = createAdminClient();
    const { error } = await admin.rpc("mark_social_invite_delivered", {
      p_assignment_id: assignmentId,
      p_actor_id: actor.id,
      p_delivery_reference: deliveryReference,
    });
    if (error) throw error;
    refreshBetaPages();
    return { ok: true, data: { assignmentId } };
  } catch (error) {
    return errorResult(error, "issue");
  }
}

export async function cancelUndeliveredSocialInvite(input: {
  assignmentId: string;
  reason: string;
}): Promise<BetaActionResult<{ assignmentId: string }>> {
  try {
    const actor = await requireRole("admin", "staff", "customer_service");
    const assignmentId = cleanEvidence(input.assignmentId, 80);
    const reason = cleanEvidence(input.reason, 500);
    if (!assignmentId || !reason) return { ok: false, error: "invalid_evidence" };
    const admin = createAdminClient();
    const { error } = await admin.rpc("cancel_undelivered_social_invite", {
      p_assignment_id: assignmentId,
      p_actor_id: actor.id,
      p_reason: reason,
    });
    if (error) throw error;
    refreshBetaPages();
    return { ok: true, data: { assignmentId } };
  } catch (error) {
    return errorResult(error, "issue");
  }
}

export async function issueFriendBetaInvite(input: {
  expiresAt?: string | null;
} = {}): Promise<BetaActionResult<{ invite: IssuedBetaInvite }>> {
  try {
    if (!betaLaunchConfigReadiness().ready) return { ok: false, error: "launch_not_ready" };
    const actor = await requireRole("admin", "staff", "customer_service");
    const expiresAt = cleanExpiration(input.expiresAt);
    if (expiresAt === undefined) return { ok: false, error: "invalid_expiration" };
    const code = generateCode("friends");
    const admin = createAdminClient();
    const { error } = await admin.from("beta_access_codes").insert({
      campaign: BETA_CAMPAIGN,
      audience: "friends",
      delivery_method: "promo_code",
      discount_percent: 100,
      access_scope: "all_countries",
      code_hash: hashBetaCode(code),
      code_hint: code.slice(-6),
      expires_at: expiresAt,
      created_by: actor.id,
    });
    if (error) throw error;
    refreshBetaPages();
    return {
      ok: true,
      data: { invite: { value: code, deliveryMethod: "promo_code" } },
    };
  } catch (error) {
    return errorResult(error, "issue");
  }
}

export async function getBetaOperatorState(): Promise<BetaOperatorState> {
  const actor = await requireRole("admin", "staff", "customer_service");
  const admin = createAdminClient();
  const [cohortResult, assignmentsResult, grantsResult, friendsResult] = await Promise.all([
    admin
      .from("beta_campaign_cohorts")
      .select("campaign, target_count, state")
      .eq("campaign", BETA_CAMPAIGN)
      .eq("audience", "social")
      .maybeSingle(),
    admin
      .from("beta_social_assignments")
      .select("id, slot_number, delivery_method, platform, recipient_reference, issued_at, delivered_at, code_id")
      .eq("campaign", BETA_CAMPAIGN),
    admin
      .from("beta_access_grants")
      .select("code_id, delivery_method, checkout_started_at, converted_at, submitted_at")
      .eq("campaign", BETA_CAMPAIGN)
      .eq("audience", "social"),
    admin
      .from("beta_access_codes")
      .select("id", { count: "exact", head: true })
      .eq("campaign", BETA_CAMPAIGN)
      .eq("audience", "friends"),
  ]);
  const databaseError = cohortResult.error || assignmentsResult.error || grantsResult.error || friendsResult.error;
  if (databaseError) throw new Error(databaseError.message || "Unable to load beta operator state");

  const assignments = assignmentsResult.data ?? [];
  const grants = grantsResult.data ?? [];
  const metrics = (["promo_code", "link_suffix"] as const).map((deliveryMethod): SocialBetaVariantMetrics => {
    const deliveredAssignments = assignments.filter((row) =>
      row.delivery_method === deliveryMethod && Boolean(row.delivered_at),
    );
    const deliveredCodeIds = new Set(deliveredAssignments.map((row) => row.code_id).filter(Boolean));
    const variantGrants = grants.filter((row) =>
      row.delivery_method === deliveryMethod && deliveredCodeIds.has(row.code_id),
    );
    return {
      deliveryMethod,
      delivered: deliveredAssignments.length,
      checkoutStarted: variantGrants.filter((row) => row.checkout_started_at).length,
      converted: variantGrants.filter((row) => row.converted_at).length,
      submitted: variantGrants.filter((row) => row.submitted_at).length,
    };
  });
  const targetCount = Number(cohortResult.data?.target_count ?? SOCIAL_COHORT_SIZE);
  const issuedAssignments = assignments.filter((row) => Boolean(row.code_id));
  const delivered = metrics.reduce((sum, row) => sum + row.delivered, 0);
  const issuedUndelivered = issuedAssignments
    .filter((row) => !row.delivered_at)
    .map((row): UndeliveredSocialInvite => ({
      assignmentId: String(row.id),
      slotNumber: Number(row.slot_number),
      deliveryMethod: row.delivery_method as BetaDelivery,
      platform: String(row.platform ?? ""),
      recipientReference: String(row.recipient_reference ?? ""),
      issuedAt: String(row.issued_at ?? ""),
    }));
  const launchConfig = betaLaunchConfigReadiness();
  return {
    campaign: BETA_CAMPAIGN,
    initialized: Boolean(cohortResult.data),
    cohortState: cohortResult.data?.state ? String(cohortResult.data.state) : null,
    targetCount,
    issued: issuedAssignments.length,
    delivered,
    remainingIssuable: Math.max(0, targetCount - issuedAssignments.length),
    issuedUndelivered,
    friendInvitesIssued: friendsResult.count ?? 0,
    canInitialize: actor.role === "admin",
    launchConfigReady: launchConfig.ready,
    launchConfigIssues: launchConfig.issues,
    metrics,
  };
}
