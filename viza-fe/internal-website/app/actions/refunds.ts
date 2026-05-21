"use server";

import { withAdmin } from "@/lib/auth/with-admin";
import { createRefund } from "@/lib/stripe/client";
import { classifyRefundability, type LineKind } from "@/lib/payments/refund-rules";
import { pricingFor } from "@/lib/pricing";

/**
 * Staff-side refund action (PAY-004).
 *
 * `refundOrderLines(orderId, lineIds)` walks the requested lines,
 * runs each through `classifyRefundability(kind, ctx)`, sums the
 * refundable amount, and asks Stripe for a single refund against
 * `order.stripe_payment_intent_id`. Non-refundable lines are
 * surfaced in the result rather than silently skipped, so the staff
 * UI can show the refusal reason next to the line.
 *
 * Refund webhook (`charge.refunded`) flips order.status → 'refunded'.
 */

export interface RefundLineDecision {
  lineId: string;
  kind: LineKind;
  amountCents: number;
  refundable: boolean;
  reason?: string;
}

export interface RefundOutput {
  orderId: string;
  refundId: string | null;
  refundedCents: number;
  currency: string;
  decisions: RefundLineDecision[];
}

export async function refundOrderLines(
  orderId: string,
  lineIds: string[],
): Promise<RefundOutput> {
  if (lineIds.length === 0) {
    throw new Error("refundOrderLines: at least one line id required");
  }
  return withAdmin("admin", "actions/refunds:refundOrderLines", async (admin) => {
    const { data: order, error: orderErr } = await admin
      .from("order")
      .select(
        "id, application_id, applicant_id, status, currency, stripe_payment_intent_id",
      )
      .eq("id", orderId)
      .maybeSingle();
    if (orderErr) throw new Error(`order fetch: ${orderErr.message}`);
    if (!order) throw new Error(`Order not found: ${orderId}`);
    if (!order.stripe_payment_intent_id) {
      throw new Error(`Order has no Stripe payment_intent — nothing to refund.`);
    }

    const { data: app } = await admin
      .from("applications")
      .select("country, visa_type")
      .eq("id", order.application_id)
      .single();
    if (!app) throw new Error("Application not found for order");
    const pricing = pricingFor(app.country, app.visa_type);
    const govtFeeChannel = pricing?.govtFeeChannel ?? "viza_passthrough";

    const { data: lines, error: linesErr } = await admin
      .from("order_line")
      .select("id, kind, amount_cents")
      .eq("order_id", orderId)
      .in("id", lineIds);
    if (linesErr) throw new Error(`lines fetch: ${linesErr.message}`);
    if (!lines || lines.length === 0) {
      throw new Error("No matching order_line rows for the supplied lineIds");
    }

    const decisions: RefundLineDecision[] = lines.map((l) => {
      const verdict = classifyRefundability(l.kind as LineKind, {
        orderStatus: order.status,
        govtFeeChannel,
      });
      return {
        lineId: l.id as string,
        kind: l.kind as LineKind,
        amountCents: l.amount_cents as number,
        refundable: verdict.refundable,
        reason: verdict.reason,
      };
    });

    const refundableCents = decisions
      .filter((d) => d.refundable)
      .reduce((sum, d) => sum + d.amountCents, 0);

    if (refundableCents === 0) {
      return {
        orderId,
        refundId: null,
        refundedCents: 0,
        currency: order.currency,
        decisions,
      };
    }

    const refund = await createRefund({
      paymentIntentId: order.stripe_payment_intent_id,
      amountCents: refundableCents,
      reason: "requested_by_customer",
      metadata: {
        order_id: orderId,
        application_id: order.application_id,
        line_ids: decisions
          .filter((d) => d.refundable)
          .map((d) => d.lineId)
          .join(","),
      },
    });

    // Append a `refund` line tying the Stripe refund to the order.
    await admin.from("order_line").insert({
      order_id: orderId,
      kind: "refund",
      amount_cents: -refundableCents,
      currency: order.currency,
      payee: "VIZA→client",
      description: `Stripe refund ${refund.id}`,
      metadata: {
        stripe_refund_id: refund.id,
        stripe_status: refund.status,
        line_ids: decisions
          .filter((d) => d.refundable)
          .map((d) => d.lineId),
      },
    });

    return {
      orderId,
      refundId: refund.id,
      refundedCents: refundableCents,
      currency: order.currency,
      decisions,
    };
  });
}
