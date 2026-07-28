"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Applicant-initiated refund flow (PRODUCT-001).
 *
 * Three entry points:
 *   - requestRefund({ applicationId, amountCents, reason })   applicant
 *   - decideRefund({ refundRequestId, approve, staffNote })   staff
 *   - recordStripeDispute({ paymentIntentId, disputeId })     webhook
 *
 * The actual Stripe refund call goes through the existing PAY-004
 * line-based helper (`refundOrderLines` in app/actions/refunds.ts) so
 * we don't duplicate the refundability-rules logic. This file owns
 * only the applicant request + staff decision lifecycle.
 */

export interface RefundRequestInput {
  applicationId: string;
  amountCents: number;
  reason: string;
}

export interface RefundActionResult {
  ok: boolean;
  refundRequestId?: string;
  reason?: string;
}

async function assertApplicant(): Promise<{ profileId?: string; userId?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile) return { error: "Profile not found" };
  return { profileId: profile.id as string, userId: user.id };
}

async function assertStaff(): Promise<{ userId?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const adminClient = createAdminClient();
  const { data: row } = await adminClient
    .from("users")
    .select("role")
    .eq("id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (row?.role !== "admin" && row?.role !== "staff") return { error: "Staff role required" };
  return { userId: user.id };
}

export async function requestRefund(input: RefundRequestInput): Promise<RefundActionResult> {
  if (input.reason.trim().length < 10) return { ok: false, reason: "Reason must be ≥10 characters" };
  if (input.amountCents <= 0) return { ok: false, reason: "amount_cents must be positive" };
  const me = await assertApplicant();
  if (!me.profileId) return { ok: false, reason: me.error };

  const adminClient = createAdminClient();
  const { data: app } = await adminClient
    .from("applications")
    .select("id, applicant_id")
    .eq("id", input.applicationId)
    .maybeSingle();
  if (!app || app.applicant_id !== me.profileId) {
    return { ok: false, reason: "Application not found or not yours" };
  }
  const { data: row, error } = await adminClient
    .from("refund_request")
    .insert({
      applicant_id: me.profileId,
      application_id: input.applicationId,
      amount_cents: input.amountCents,
      currency: "USD",
      reason: input.reason.trim(),
      status: "requested",
    })
    .select("id")
    .single();
  if (error || !row) return { ok: false, reason: error?.message ?? "insert failed" };
  return { ok: true, refundRequestId: row.id as string };
}

export async function decideRefund(input: {
  refundRequestId: string;
  approve: boolean;
  staffNote: string;
}): Promise<RefundActionResult> {
  const guard = await assertStaff();
  if (!guard.userId) return { ok: false, reason: guard.error };

  const adminClient = createAdminClient();
  const { data: row } = await adminClient
    .from("refund_request")
    .select("id, status")
    .eq("id", input.refundRequestId)
    .maybeSingle();
  if (!row) return { ok: false, reason: "Not found" };
  if (row.status !== "requested") return { ok: false, reason: `already ${row.status}` };

  await adminClient
    .from("refund_request")
    .update({
      status: input.approve ? "approved" : "denied",
      staff_note: input.staffNote,
      decided_by: guard.userId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", input.refundRequestId);

  // After approve, staff still needs to run the line-based Stripe refund
  // (refundOrderLines in app/actions/refunds.ts) — the request row will
  // flip to 'refunded' from the Stripe webhook (recordStripeRefund below).
  return { ok: true, refundRequestId: input.refundRequestId };
}

export async function recordStripeRefund(input: {
  paymentIntentId: string;
  refundId: string;
}): Promise<void> {
  const adminClient = createAdminClient();
  await adminClient
    .from("refund_request")
    .update({ status: "refunded", stripe_refund_id: input.refundId, updated_at: new Date().toISOString() })
    .eq("stripe_payment_intent_id", input.paymentIntentId)
    .eq("status", "approved");
}

export async function recordStripeDispute(input: {
  paymentIntentId: string;
  disputeId: string;
}): Promise<void> {
  const adminClient = createAdminClient();
  await adminClient
    .from("refund_request")
    .update({ status: "disputed", stripe_dispute_id: input.disputeId, updated_at: new Date().toISOString() })
    .eq("stripe_payment_intent_id", input.paymentIntentId);
}
