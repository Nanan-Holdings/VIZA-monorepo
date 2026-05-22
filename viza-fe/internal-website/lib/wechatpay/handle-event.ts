import type { SupabaseClient } from "@supabase/supabase-js";
import type { DecryptedResource } from "./client";

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
    .select("id, status")
    .eq("wechat_out_trade_no", resource.out_trade_no)
    .maybeSingle();
  if (lookupErr) throw new Error(`order lookup: ${lookupErr.message}`);
  if (!order) {
    return { kind: "ignored", reason: `no order for ${resource.out_trade_no}` };
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
