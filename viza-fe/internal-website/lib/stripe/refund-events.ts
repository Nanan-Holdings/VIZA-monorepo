import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Webhook-only refund/dispute ledger writes (PRODUCT-001 / PAY-004).
 *
 * These are server-to-server side effects invoked from the Stripe webhook
 * (`app/api/stripe/webhook/route.ts`), which runs with no user session. They
 * deliberately live in a plain server module — NOT the `"use server"`
 * `app/actions/refund-request.ts` file — so they are never exposed as
 * client-callable server actions. The applicant-facing request/decision
 * lifecycle (with its own auth) stays in `refund-request.ts`.
 */

export async function recordStripeRefund(input: {
  paymentIntentId: string;
  refundId: string;
}): Promise<void> {
  const adminClient = createAdminClient();
  await adminClient
    .from("refund_request")
    .update({
      status: "refunded",
      stripe_refund_id: input.refundId,
      updated_at: new Date().toISOString(),
    })
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
    .update({
      status: "disputed",
      stripe_dispute_id: input.disputeId,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_payment_intent_id", input.paymentIntentId);
}
