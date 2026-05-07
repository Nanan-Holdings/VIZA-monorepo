import type { SupabaseClient } from "@supabase/supabase-js";
import type { StripeEventBase } from "./client";

/**
 * Pure handler for Stripe webhook events (PAY-002).
 *
 * Separated from the route handler so the integration test can drive
 * fixtures through `applyStripeEvent` without standing up an HTTP
 * server.
 */

export type StripeHandled =
  | { kind: "ignored"; type: string }
  | { kind: "paid"; orderId: string }
  | { kind: "refunded"; orderId: string };

export async function applyStripeEvent(
  admin: SupabaseClient,
  event: StripeEventBase,
): Promise<StripeHandled> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as {
        id?: string;
        payment_status?: string;
        payment_intent?: string;
        amount_total?: number;
        metadata?: { order_id?: string };
      };
      const orderId = session.metadata?.order_id;
      if (!orderId) return { kind: "ignored", type: event.type };
      if (session.payment_status !== "paid") {
        return { kind: "ignored", type: event.type };
      }
      const { error } = await admin
        .from("order")
        .update({
          status: "paid",
          stripe_payment_intent_id: session.payment_intent ?? null,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);
      if (error) {
        throw new Error(`order paid update: ${error.message}`);
      }
      return { kind: "paid", orderId };
    }

    case "charge.refunded":
    case "charge.refund.updated": {
      const charge = event.data.object as {
        payment_intent?: string;
        refunded?: boolean;
      };
      const pi = charge.payment_intent;
      if (!pi) return { kind: "ignored", type: event.type };
      const { data: order, error: lookupErr } = await admin
        .from("order")
        .select("id")
        .eq("stripe_payment_intent_id", pi)
        .maybeSingle();
      if (lookupErr) throw new Error(`order lookup: ${lookupErr.message}`);
      if (!order) return { kind: "ignored", type: event.type };
      const { error } = await admin
        .from("order")
        .update({
          status: "refunded",
          refunded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
      if (error) throw new Error(`order refunded update: ${error.message}`);
      return { kind: "refunded", orderId: order.id as string };
    }

    default:
      return { kind: "ignored", type: event.type };
  }
}
