import type { SupabaseClient } from "@supabase/supabase-js";
import type { StripeEventBase } from "./client";
import { isPayableOrderStatus } from "@/lib/checkout/payment-state";

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
  | { kind: "refunded"; orderId: string }
  | { kind: "disputed"; orderId: string };

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
        currency?: string;
        total_details?: { amount_tax?: number };
        customer_details?: { address?: { country?: string } | null };
        metadata?: { order_id?: string };
      };
      const orderId = session.metadata?.order_id;
      if (!orderId) return { kind: "ignored", type: event.type };
      if (session.payment_status !== "paid") {
        return { kind: "ignored", type: event.type };
      }
      const { data: existingOrder, error: existingOrderError } = await admin
        .from("order")
        .select("status, agency_fee_cents, govt_fee_cents, currency")
        .eq("id", orderId)
        .maybeSingle();
      if (existingOrderError) {
        throw new Error(`order status lookup: ${existingOrderError.message}`);
      }
      if (existingOrder && !isPayableOrderStatus(existingOrder.status as string | null)) {
        return { kind: "ignored", type: event.type };
      }
      const taxCents = session.total_details?.amount_tax ?? 0;
      const taxCountry = session.customer_details?.address?.country ?? null;
      const amountTotal = session.amount_total ?? 0;

      // Amount integrity (PAY-002): the amount Stripe collected must match the
      // order we are about to mark paid. Stripe adds tax on top of our line
      // items, so compare the pre-tax total in exact minor units (no rounding
      // tolerance is needed — both sides are integer cents) and the currency.
      // On mismatch we refuse to confirm and log for investigation rather than
      // marking a wrong-priced order paid.
      if (existingOrder) {
        const expectedNet =
          ((existingOrder.agency_fee_cents as number | null) ?? 0) +
          ((existingOrder.govt_fee_cents as number | null) ?? 0);
        const collectedNet = amountTotal - taxCents;
        const expectedCurrency =
          (existingOrder.currency as string | null)?.toLowerCase() ?? null;
        const collectedCurrency = session.currency?.toLowerCase() ?? null;
        const currencyMismatch =
          expectedCurrency !== null &&
          collectedCurrency !== null &&
          expectedCurrency !== collectedCurrency;
        if (collectedNet !== expectedNet || currencyMismatch) {
          console.error(
            `[stripe] order ${orderId} amount/currency mismatch: collected ` +
              `${collectedNet} ${collectedCurrency ?? "?"} vs expected ` +
              `${expectedNet} ${expectedCurrency ?? "?"} — refusing to confirm payment`,
          );
          return { kind: "ignored", type: event.type };
        }
      }

      const taxRateBps =
        amountTotal > taxCents && taxCents > 0
          ? Math.round((taxCents * 10_000) / (amountTotal - taxCents))
          : 0;
      const { error: confirmError } = await admin.rpc(
        "confirm_submission_order_payment",
        {
          p_order_id: orderId,
          p_provider_payment_id: session.payment_intent ?? "",
          p_provider_session_id: session.id ?? "",
          p_paid_at: new Date().toISOString(),
          p_tax_amount_cents: taxCents,
          p_tax_country: taxCountry,
          p_tax_rate_basis_points: taxRateBps,
          p_provider: "stripe",
        },
      );
      if (confirmError) {
        throw new Error(`atomic order payment confirmation: ${confirmError.message}`);
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

    case "refund.created":
    case "refund.updated": {
      // PAY-002: Refund-object events (distinct from charge.refunded). Flip the
      // matching order to refunded so entitlement and the submission runner
      // follow the money even when the charge.refunded event is missed. A
      // dispute outranks a refund, so never downgrade a disputed order.
      const refund = event.data.object as {
        id?: string;
        payment_intent?: string;
        status?: string;
      };
      if (refund.status && refund.status !== "succeeded") {
        return { kind: "ignored", type: event.type };
      }
      const pi = refund.payment_intent;
      if (!pi) return { kind: "ignored", type: event.type };
      const { data: order, error: lookupErr } = await admin
        .from("order")
        .select("id, status")
        .eq("stripe_payment_intent_id", pi)
        .maybeSingle();
      if (lookupErr) throw new Error(`order lookup: ${lookupErr.message}`);
      if (!order) return { kind: "ignored", type: event.type };
      if ((order.status as string | null) === "disputed") {
        return { kind: "ignored", type: event.type };
      }
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

    case "charge.dispute.created":
    case "charge.dispute.updated": {
      // PAY-004: chargebacks. Mark the order disputed and pause the
      // submission queue row so the runner does not continue spending
      // money against a charged-back card.
      const dispute = event.data.object as {
        id?: string;
        payment_intent?: string;
        reason?: string;
        status?: string;
      };
      const pi = dispute.payment_intent;
      if (!pi) return { kind: "ignored", type: event.type };
      const { data: order, error: lookupErr } = await admin
        .from("order")
        .select("id, application_id")
        .eq("stripe_payment_intent_id", pi)
        .maybeSingle();
      if (lookupErr) throw new Error(`order lookup: ${lookupErr.message}`);
      if (!order) return { kind: "ignored", type: event.type };
      const { error } = await admin
        .from("order")
        .update({
          status: "disputed",
          metadata: {
            stripe_dispute_id: dispute.id ?? null,
            dispute_reason: dispute.reason ?? null,
            dispute_status: dispute.status ?? null,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
      if (error) throw new Error(`order dispute update: ${error.message}`);

      // Pause any in-flight automation. We use a sentinel status so the
      // runner skips the row; ops can resume by flipping back manually.
      if (order.application_id) {
        await admin
          .from("submission_queue")
          .update({
            status: "paused_dispute",
            last_error: `Stripe dispute ${dispute.id ?? "unknown"}: ${dispute.reason ?? ""}`.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("application_id", order.application_id);
      }
      return { kind: "disputed", orderId: order.id as string };
    }

    default:
      return { kind: "ignored", type: event.type };
  }
}
