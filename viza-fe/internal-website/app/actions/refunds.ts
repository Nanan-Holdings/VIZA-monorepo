"use server";

import { createHash } from "node:crypto";
import { withAdmin } from "@/lib/auth/with-admin";
import { createRefund } from "@/lib/stripe/client";
import { createDomesticRefund } from "@/lib/wechatpay/client";
import { classifyRefundability, type LineKind } from "@/lib/payments/refund-rules";
import { pricingFor } from "@/lib/pricing";
import {
  applyAgencyDiscountToRefundLines,
  betaAgencyDiscount,
  capRefundToCollectedAmount,
} from "@/lib/payments/refund-amount";

/**
 * Staff-side refund action (PAY-004).
 *
 * `refundOrderLines(orderId, lineIds)` walks the requested lines,
 * runs each through `classifyRefundability(kind, ctx)`, sums the
 * refundable amount, and asks the payment provider for a single refund.
 * Native WeChat refunds use the stored transaction and collected CNY/fen
 * identity; other orders use `order.stripe_payment_intent_id`. Non-refundable lines are
 * surfaced in the result rather than silently skipped, so the staff
 * UI can show the refusal reason next to the line.
 *
 * Provider refund callbacks reconcile the terminal order state.
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
  provider: "stripe" | "wechat";
  refundId: string | null;
  refundedCents: number;
  currency: string;
  decisions: RefundLineDecision[];
}

interface CheckoutPaymentMetadata {
  provider: string;
  expectedAmountMinor: number;
  currency: string;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function checkoutPaymentMetadata(metadata: unknown): CheckoutPaymentMetadata | null {
  const checkout = record(record(metadata)?.checkout_payment);
  const provider = checkout?.provider;
  const amount = checkout?.expected_amount_minor;
  const currency = checkout?.currency;
  if (
    typeof provider !== "string"
    || !Number.isSafeInteger(amount)
    || Number(amount) <= 0
    || typeof currency !== "string"
    || !currency.trim()
  ) {
    return null;
  }
  return {
    provider,
    expectedAmountMinor: Number(amount),
    currency: currency.toUpperCase(),
  };
}

function deterministicWechatRefundNo(
  orderId: string,
  decisions: RefundLineDecision[],
): string {
  const identity = decisions
    .filter((decision) => decision.refundable)
    .map((decision) => decision.lineId)
    .sort()
    .join(",");
  const digest = createHash("sha256")
    .update(`${orderId}:${identity}`)
    .digest("hex")
    .slice(0, 20);
  return `viza_${orderId.replace(/-/g, "").slice(0, 32)}_${digest}`;
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
        "id, application_id, applicant_id, status, currency, stripe_payment_intent_id, wechat_out_trade_no, wechat_transaction_id, metadata",
      )
      .eq("id", orderId)
      .maybeSingle();
    if (orderErr) throw new Error(`order fetch: ${orderErr.message}`);
    if (!order) throw new Error(`Order not found: ${orderId}`);
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

    const decisions = applyAgencyDiscountToRefundLines(lines.map((l) => {
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
    }), betaAgencyDiscount(order.metadata)) satisfies RefundLineDecision[];

    const requestedRefundableCents = decisions
      .filter((d) => d.refundable)
      .reduce((sum, d) => sum + d.amountCents, 0);
    let refundableCents = capRefundToCollectedAmount(
      requestedRefundableCents,
      order.metadata,
    );

    const checkoutPayment = checkoutPaymentMetadata(order.metadata);
    const declaredProvider = record(record(order.metadata)?.checkout_payment)?.provider;
    if (declaredProvider === "wechat" && !checkoutPayment) {
      throw new Error("Stored WeChat collection metadata is incomplete");
    }
    if (checkoutPayment?.provider === "wechat") {
      if (
        checkoutPayment.currency !== "CNY"
        || String(order.currency).toUpperCase() !== checkoutPayment.currency
        || !order.wechat_out_trade_no
        || !order.wechat_transaction_id
      ) {
        throw new Error("WeChat refund configuration does not match the collected payment");
      }

      const outRefundNo = deterministicWechatRefundNo(orderId, decisions);
      const { data: priorRefundLines, error: priorRefundsError } = await admin
        .from("order_line")
        .select("id, amount_cents, currency, metadata")
        .eq("order_id", orderId)
        .eq("kind", "refund");
      if (priorRefundsError) {
        throw new Error(`refund history fetch: ${priorRefundsError.message}`);
      }

      let reservedRefundMinor = 0;
      for (const priorLine of priorRefundLines ?? []) {
        const priorMetadata = record(record(priorLine.metadata)?.wechat_pay_refund);
        if (priorMetadata?.out_refund_no === outRefundNo) {
          const priorRefundAmount = priorMetadata.refund_amount_minor;
          const exactMatch = priorLine.currency === checkoutPayment.currency
            && Number.isSafeInteger(priorRefundAmount)
            && Number(priorRefundAmount) > 0
            && Number(priorRefundAmount) <= requestedRefundableCents
            && priorLine.amount_cents === -Number(priorRefundAmount)
            && priorMetadata.out_trade_no === order.wechat_out_trade_no
            && priorMetadata.transaction_id === order.wechat_transaction_id
            && priorMetadata.total_amount_minor === checkoutPayment.expectedAmountMinor
            && priorMetadata.currency === checkoutPayment.currency
            && typeof priorMetadata.refund_id === "string";
          if (!exactMatch) {
            throw new Error("Stored WeChat refund identity does not match this request");
          }
          return {
            orderId,
            provider: "wechat",
            refundId: priorMetadata.refund_id as string,
            refundedCents: Number(priorRefundAmount),
            currency: checkoutPayment.currency,
            decisions,
          };
        }
        if (priorLine.amount_cents < 0) {
          reservedRefundMinor += Math.abs(priorLine.amount_cents as number);
        }
      }

      const remainingCollectedMinor = Math.max(
        0,
        checkoutPayment.expectedAmountMinor - reservedRefundMinor,
      );
      refundableCents = Math.min(refundableCents, remainingCollectedMinor);
      if (refundableCents === 0) {
        return {
          orderId,
          provider: "wechat",
          refundId: null,
          refundedCents: 0,
          currency: checkoutPayment.currency,
          decisions,
        };
      }

      const notifyUrl = process.env.WECHAT_PAY_REFUND_NOTIFY_URL?.trim();
      if (!notifyUrl) {
        throw new Error("WECHAT_PAY_REFUND_NOTIFY_URL is not configured");
      }
      const refund = await createDomesticRefund({
        transactionId: order.wechat_transaction_id,
        outRefundNo,
        refundFen: refundableCents,
        totalFen: checkoutPayment.expectedAmountMinor,
        reason: "Customer-requested VIZA order refund",
        notifyUrl,
      });
      if (
        refund.amount?.refund !== refundableCents
        || refund.amount.total !== checkoutPayment.expectedAmountMinor
        || refund.amount.currency?.toUpperCase() !== checkoutPayment.currency
        || refund.out_trade_no !== order.wechat_out_trade_no
        || refund.transaction_id !== order.wechat_transaction_id
      ) {
        throw new Error("WeChat refund response amount or order identity mismatch");
      }

      const { error: refundLineError } = await admin.from("order_line").insert({
        order_id: orderId,
        kind: "refund",
        amount_cents: -refundableCents,
        currency: checkoutPayment.currency,
        payee: "VIZA→client",
        description: `WeChat refund ${refund.refund_id}`,
        metadata: {
          wechat_pay_refund: {
            refund_id: refund.refund_id,
            out_refund_no: outRefundNo,
            out_trade_no: order.wechat_out_trade_no,
            transaction_id: order.wechat_transaction_id,
            refund_amount_minor: refundableCents,
            total_amount_minor: checkoutPayment.expectedAmountMinor,
            currency: checkoutPayment.currency,
            status: refund.status,
            callback_applied: false,
          },
        },
      });
      if (refundLineError) {
        throw new Error(`WeChat refund ledger insert: ${refundLineError.message}`);
      }

      return {
        orderId,
        provider: "wechat",
        refundId: refund.refund_id,
        refundedCents: refundableCents,
        currency: checkoutPayment.currency,
        decisions,
      };
    }

    if (!order.stripe_payment_intent_id) {
      throw new Error(`Order has no Stripe payment_intent — nothing to refund.`);
    }

    if (refundableCents === 0) {
      return {
        orderId,
        provider: "stripe",
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
      provider: "stripe",
      refundId: refund.id,
      refundedCents: refundableCents,
      currency: order.currency,
      decisions,
    };
  });
}
