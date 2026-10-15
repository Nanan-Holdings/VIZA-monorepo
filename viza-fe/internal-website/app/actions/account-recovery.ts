"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/rbac";

const ALLOWED_KINDS = new Set(["reset_mfa", "force_password_reset", "both"]);
const REQUIRED_CHECKS = ["passport_match", "email_thread", "selfie_with_passport"] as const;

export interface IdentityChecks {
  passport_match: boolean;
  email_thread: boolean;
  selfie_with_passport: boolean;
  notes?: string;
}

export interface RecoveryActionResult {
  ok: boolean;
  auditId?: string;
  reason?: string;
}

/**
 * Staff-only action invoked from the support console after manual ID
 * verification. Drops every TOTP factor for the target auth user, then
 * sends them a Supabase password-reset email so they can re-secure the
 * account themselves. Always writes an account_recovery_audit row.
 */
export async function performAccountRecovery(args: {
  targetUserId: string;
  reason: string;
  identityChecks: IdentityChecks;
  actionKind: "reset_mfa" | "force_password_reset" | "both";
}): Promise<RecoveryActionResult> {
  if (!ALLOWED_KINDS.has(args.actionKind)) {
    return { ok: false, reason: `Unsupported action_kind '${args.actionKind}'` };
  }
  for (const k of REQUIRED_CHECKS) {
    if (!args.identityChecks[k]) {
      return { ok: false, reason: `Identity check '${k}' must be confirmed before recovery.` };
    }
  }
  if (args.reason.trim().length < 10) {
    return { ok: false, reason: "Reason is required (≥10 chars) for the audit log." };
  }

  // Use the canonical, revocation-aware identity resolver. Unlike an inline
  // `users.role` read, `getCurrentUser` returns null for an admin whose
  // `admin_memberships` grant has been revoked, closing the bypass where a
  // revoked admin could still perform account recovery.
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, reason: "Not authenticated" };
  if (actor.role !== "admin" && actor.role !== "staff") {
    return { ok: false, reason: "Recovery can only be performed by staff/admin roles." };
  }

  const adminClient = createAdminClient();

  if (args.actionKind === "reset_mfa" || args.actionKind === "both") {
    const { data: factors, error: listErr } = await adminClient.auth.admin.mfa.listFactors({
      userId: args.targetUserId,
    });
    if (listErr) return { ok: false, reason: `listFactors failed: ${listErr.message}` };
    for (const f of factors?.factors ?? []) {
      const { error: delErr } = await adminClient.auth.admin.mfa.deleteFactor({
        userId: args.targetUserId,
        id: f.id,
      });
      if (delErr) return { ok: false, reason: `deleteFactor failed: ${delErr.message}` };
    }
  }

  if (args.actionKind === "force_password_reset" || args.actionKind === "both") {
    const { data: targetUser, error: userErr } = await adminClient.auth.admin.getUserById(
      args.targetUserId,
    );
    if (userErr || !targetUser?.user?.email) {
      return { ok: false, reason: userErr?.message ?? "Target user has no email on file" };
    }
    const { error: linkErr } = await adminClient.auth.resetPasswordForEmail(targetUser.user.email);
    if (linkErr) return { ok: false, reason: `resetPasswordForEmail failed: ${linkErr.message}` };
  }

  const { data: auditRow, error: auditErr } = await adminClient
    .from("account_recovery_audit")
    .insert({
      target_user_id: args.targetUserId,
      performed_by: actor.id,
      reason: args.reason,
      identity_checks: args.identityChecks,
      action_kind: args.actionKind,
    })
    .select("id")
    .single();
  if (auditErr || !auditRow) {
    return { ok: false, reason: `audit insert failed: ${auditErr?.message ?? "unknown"}` };
  }

  return { ok: true, auditId: auditRow.id as string };
}
