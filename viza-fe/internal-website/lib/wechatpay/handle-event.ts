import type { SupabaseClient } from "@supabase/supabase-js";
import type { DecryptedResource } from "./client";
import { isPayableOrderStatus } from "@/lib/checkout/payment-state";

/**
 * Pure handler for a decrypted WeChat Pay v3 callback resource.
 *
 * Separated from the route handler so the integration test can feed
 * fixtures through `applyWechatEvent` without standing up an HTTP
 * server. Mirrors `lib/stripe/handle-event.ts`.
 */

export type WechatHandled =
  | { kind: "ignored"; reason: string }
  | { kind: "paid"; orderId: string };

export interface WechatRefundResource {
  refund_id?: string;
  out_refund_no?: string;
  transaction_id?: string;
  out_trade_no?: string;
  status?: string;
  success_time?: string;
  amount?: {
    refund?: number;
    total?: number;
    currency?: string;
  };
}

export type WechatRefundHandled =
  { kind: "refunded"; orderId: string; partial: boolean };

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export async function applyWechatRefundEvent(
  admin: SupabaseClient,
  resource: WechatRefundResource,
  eventId?: string,
): Promise<WechatRefundHandled> {
  if (resource.status !== "SUCCESS") {
    throw new Error(`WeChat refund callback status is ${resource.status ?? "missing"}`);
  }
  if (
    !resource.refund_id
    || !resource.out_refund_no
    || !resource.transaction_id
    || !resource.out_trade_no
    || !Number.isSafeInteger(resource.amount?.refund)
    || !Number.isSafeInteger(resource.amount?.total)
    || !resource.amount?.currency
  ) {
    throw new Error("WeChat refund callback identity is incomplete");
  }

  const refundMinor = Number(resource.amount.refund);
  const totalMinor = Number(resource.amount.total);
  const currency = resource.amount.currency.toUpperCase();
  if (refundMinor <= 0 || totalMinor <= 0 || refundMinor > totalMinor) {
    throw new Error("WeChat refund callback amount is invalid");
  }

  const { data: order, error: orderError } = await admin
    .from("order")
    .select("id, application_id, status, currency, wechat_out_trade_no, wechat_transaction_id, metadata")
    .eq("wechat_out_trade_no", resource.out_trade_no)
    .maybeSingle();
  if (orderError) throw new Error(`refund order lookup: ${orderError.message}`);
  if (!order) throw new Error("WeChat refund callback order was not found");

  const checkout = objectRecord(objectRecord(order.metadata)?.checkout_payment);
  const expectedTotal = checkout?.expected_amount_minor;
  const expectedCurrency = typeof checkout?.currency === "string"
    ? checkout.currency.toUpperCase()
    : null;
  if (
    checkout?.provider !== "wechat"
    || order.wechat_out_trade_no !== resource.out_trade_no
    || order.wechat_transaction_id !== resource.transaction_id
    || !Number.isSafeInteger(expectedTotal)
    || Number(expectedTotal) !== totalMinor
    || expectedCurrency !== currency
    || String(order.currency).toUpperCase() !== currency
  ) {
    throw new Error(`WeChat refund order identity mismatch for ${String(order.id)}`);
  }

  const { data: refundLine, error: refundLineError } = await admin
    .from("order_line")
    .select("id, amount_cents, currency, metadata")
    .eq("order_id", order.id)
    .eq("kind", "refund")
    .eq("metadata->wechat_pay_refund->>out_refund_no", resource.out_refund_no)
    .maybeSingle();
  if (refundLineError) throw new Error(`refund line lookup: ${refundLineError.message}`);
  if (!refundLine) throw new Error("WeChat refund callback ledger row was not found");

  const lineMetadata = objectRecord(refundLine.metadata) ?? {};
  const storedRefund = objectRecord(lineMetadata.wechat_pay_refund);
  if (
    !storedRefund
    || refundLine.amount_cents !== -refundMinor
    || String(refundLine.currency).toUpperCase() !== currency
    || storedRefund.refund_id !== resource.refund_id
    || storedRefund.out_refund_no !== resource.out_refund_no
    || storedRefund.out_trade_no !== resource.out_trade_no
    || storedRefund.transaction_id !== resource.transaction_id
    || storedRefund.refund_amount_minor !== refundMinor
    || storedRefund.total_amount_minor !== totalMinor
    || storedRefund.currency !== currency
  ) {
    throw new Error(`WeChat refund ledger identity mismatch for ${String(order.id)}`);
  }

  const callbackAlreadyApplied = storedRefund.callback_applied === true
    && storedRefund.status === "SUCCESS";
  if (!callbackAlreadyApplied) {
    const { error: updateLineError } = await admin
      .from("order_line")
      .update({
        metadata: {
          ...lineMetadata,
          wechat_pay_refund: {
            ...storedRefund,
            status: "SUCCESS",
            success_time: resource.success_time ?? null,
            callback_event_id: eventId ?? null,
            callback_applied: true,
          },
        },
      })
      .eq("id", refundLine.id);
    if (updateLineError) {
      throw new Error(`refund line update: ${updateLineError.message}`);
    }
  }

  const partial = refundMinor < totalMinor;
  const targetStatus = partial ? "partially_refunded" : "refunded";
  if (order.status !== targetStatus) {
    const now = resource.success_time ?? new Date().toISOString();
    const { error: updateOrderError } = await admin
      .from("order")
      .update({
        status: targetStatus,
        refunded_at: now,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);
    if (updateOrderError) {
      throw new Error(`refund order update: ${updateOrderError.message}`);
    }
  }

  // `stripe_refund_id` is the legacy provider-refund-id correlation column.
  // Resolve it before acknowledging the callback: a callback that races the
  // admin action's correlation write must fail so WeChat retries it later.
  const { data: refundRequest, error: requestLookupError } = await admin
    .from("refund_request")
    .select("id, status, stripe_refund_id")
    .eq("application_id", order.application_id)
    .eq("stripe_refund_id", resource.refund_id)
    .maybeSingle();
  if (requestLookupError) {
    throw new Error(`refund request lookup: ${requestLookupError.message}`);
  }
  if (!refundRequest) {
    throw new Error("WeChat refund callback request correlation was not found");
  }
  if (refundRequest.status !== "approved" && refundRequest.status !== "refunded") {
    throw new Error(`WeChat refund request has invalid status ${String(refundRequest.status)}`);
  }

  if (refundRequest.status === "refunded") {
    return { kind: "refunded", orderId: order.id as string, partial };
  }

  const { data: updatedRequest, error: requestUpdateError } = await admin
    .from("refund_request")
    .update({
      status: "refunded",
      updated_at: new Date().toISOString(),
    })
    .eq("id", refundRequest.id)
    .eq("status", "approved")
    .select("id")
    .maybeSingle();
  if (requestUpdateError) {
    throw new Error(`refund request update: ${requestUpdateError.message}`);
  }
  if (!updatedRequest) {
    throw new Error("WeChat refund request changed before callback completion");
  }

  return { kind: "refunded", orderId: order.id as string, partial };
}

export async function applyWechatEvent(
  admin: SupabaseClient,
  resource: DecryptedResource,
): Promise<WechatHandled> {
  if (resource.trade_state !== "SUCCESS") {
    return { kind: "ignored", reason: `trade_state=${resource.trade_state ?? "?"}` };
  }
  if (!resource.out_trade_no) {
    return { kind: "ignored", reason: "missing out_trade_no" };
  }

  const { data: order, error: lookupErr } = await admin
    .from("order")
    .select("id, status, metadata")
    .eq("wechat_out_trade_no", resource.out_trade_no)
    .maybeSingle();
  if (lookupErr) throw new Error(`order lookup: ${lookupErr.message}`);
  if (!order) {
    return { kind: "ignored", reason: `no order for ${resource.out_trade_no}` };
  }

  if (!isPayableOrderStatus(order.status as string | null)) {
    return { kind: "ignored", reason: `order status=${order.status}` };
  }

  const orderMetadata = order.metadata && typeof order.metadata === "object" && !Array.isArray(order.metadata)
    ? order.metadata as Record<string, unknown>
    : {};
  const checkoutMetadata = orderMetadata.checkout_payment && typeof orderMetadata.checkout_payment === "object" && !Array.isArray(orderMetadata.checkout_payment)
    ? orderMetadata.checkout_payment as Record<string, unknown>
    : {};
  const expectedAmount = Number.isInteger(checkoutMetadata.expected_amount_minor)
    ? Number(checkoutMetadata.expected_amount_minor)
    : null;
  const expectedCurrency = typeof checkoutMetadata.currency === "string"
    ? checkoutMetadata.currency.toUpperCase()
    : null;
  if (expectedAmount !== null) {
    const collectedAmount = resource.amount?.total;
    const collectedCurrency = resource.amount?.currency?.toUpperCase() ?? null;
    if (!Number.isInteger(collectedAmount) || collectedAmount !== expectedAmount || collectedCurrency !== expectedCurrency) {
      throw new Error(`WeChat amount/currency mismatch for order ${String(order.id)}`);
    }
  }

  // Idempotency: if already paid, return the orderId so the caller can
  // re-emit the post-paid side-effects only if they themselves are
  // idempotent (mailer + queue enqueue both are).
  if (order.status === "paid" || order.status === "submitted" || order.status === "completed") {
    return { kind: "paid", orderId: order.id as string };
  }

  const paidAt = resource.success_time ?? new Date().toISOString();
  const { error: updErr } = await admin
    .from("order")
    .update({
      status: "paid",
      wechat_transaction_id: resource.transaction_id ?? null,
      wechat_payer_openid: resource.payer?.openid ?? null,
      paid_at: paidAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id);
  if (updErr) throw new Error(`order paid update: ${updErr.message}`);

  return { kind: "paid", orderId: order.id as string };
}
