import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyStripeEvent } from "@/lib/stripe/handle-event";
import { runPostPaidSideEffects } from "@/lib/checkout/post-paid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DEV-ONLY e2e shim: mark a guest order paid through the SAME code the
 * Stripe webhook runs (applyStripeEvent + runPostPaidSideEffects), without
 * a live Stripe session/retrieve. Guarded to non-production. Delete after QA.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, { status: 403 });
  }
  const { orderId, amountTotal } = await request.json();
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  const admin = createAdminClient() as never;
  const result = await applyStripeEvent(admin, {
    id: `evt_sim_${orderId.slice(0, 8)}`,
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_test_sim_${orderId.slice(0, 8)}`,
        payment_status: "paid",
        payment_intent: `pi_test_sim_${orderId.slice(0, 8)}`,
        amount_total: amountTotal ?? 12400,
        total_details: { amount_tax: 0 },
        customer_details: { address: { country: "US" } },
        metadata: { order_id: orderId },
      },
    },
  });

  if (result.kind === "paid") {
    runPostPaidSideEffects(result.orderId, "card");
  }

  return NextResponse.json({ result });
}
