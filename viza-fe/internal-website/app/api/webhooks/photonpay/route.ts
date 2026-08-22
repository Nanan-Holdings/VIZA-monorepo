import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runPostPaidSideEffects } from "@/lib/checkout/post-paid";
import { isPayableOrderStatus } from "@/lib/checkout/payment-state";
import { verifyPhotonPayWebhook } from "@/lib/photonpay/client";
import { orderIdFromReqId } from "@/lib/photonpay/reqid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PhotonPay async payment notification (收单 webhook).
 *
 * PhotonPay POSTs the transaction result here (the `notifyUrl` we set on the
 * cashier session). We:
 *   1. verify `x-pd-sign` against PhotonPay's platform public key,
 *   2. on a successful sale, mark the order paid and run the shared post-paid
 *      side-effects (magic-link + provisioning + runner) — the same pipeline
 *      the Stripe and WeChat guest paths use,
 *   3. reply the EXACT `{"roger": true}` PhotonPay expects.
 *
 * PhotonPay retries until it gets a conforming ack and disables the ENTIRE
 * subscription (every topic, not just this one) after 8 consecutive
 * non-conforming responses. So: ack anything we have genuinely finished with,
 * including payloads we cannot act on, and reserve non-2xx for failures where
 * a retry could still succeed.
 *
 * We deliberately do NOT ack when the signature cannot be checked. Acking an
 * unverified payload would mean trusting an unauthenticated caller about money;
 * losing the subscription is recoverable by re-subscribing, silently accepting
 * a forged payment is not.
 *
 * This route is inbound-only, so it works from the Vercel runtime — unlike the
 * outbound cashier-session call, which needs an allowlisted egress IP.
 */

const ROGER = { roger: true };

/** Order states that already represent a completed payment. Matches the WeChat
 * handler: a later notification must not re-run post-paid side effects or drag
 * an order backwards from `submitted`/`completed` to `paid`. */
const SETTLED_STATUSES = new Set(["paid", "submitted", "completed"]);

function isSucceeded(status?: string, code?: string): boolean {
  if (status) return /^succe/i.test(status);
  return code === "0000";
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const sign = request.headers.get("x-pd-sign") ?? request.headers.get("X-PD-SIGN");

  // Verification depends only on the platform public key — NOT on
  // PHOTONPAY_ENABLED. Sessions already in flight must still settle after that
  // flag is switched off, and the webhook receiver need not be the host that
  // mints sessions. See verifyPhotonPayWebhook for why.
  const verdict = verifyPhotonPayWebhook(raw, sign);
  if (verdict === "not-configured") {
    console.error("[photonpay-webhook] PHOTONPAY_PLATFORM_PUBLIC_KEY(_PATH) not set — cannot authenticate caller");
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  if (verdict === "bad-signature") {
    console.warn("[photonpay-webhook] signature verification failed");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // Signed but malformed — ack so PhotonPay stops resending; nothing to do.
    console.error("[photonpay-webhook] signed payload was not valid JSON");
    return NextResponse.json(ROGER);
  }

  const reqId = String(payload.reqId ?? "");
  const orderId = orderIdFromReqId(reqId);
  const succeeded = isSucceeded(payload.status as string | undefined, payload.code as string | undefined);

  if (succeeded && !orderId) {
    // A real payment we cannot attribute. Ack (retrying will not help — the
    // reqId is already fixed) but make it loud: this is money received against
    // an order that will stay `pending` until someone reconciles it by hand.
    console.error(`[photonpay-webhook] PAID but reqId does not decode to an order id: ${reqId}`);
    return NextResponse.json(ROGER);
  }

  try {
    if (orderId && succeeded) {
      const admin = createAdminClient();
      const { data: order, error: lookupErr } = await admin
        .from("order")
        .select("id, status, metadata")
        .eq("id", orderId)
        .maybeSingle();
      if (lookupErr) throw new Error(`order lookup: ${lookupErr.message}`);

      if (!order) {
        console.error(`[photonpay-webhook] PAID for unknown order ${orderId}`);
        return NextResponse.json(ROGER);
      }

      // Idempotent: only a payable order can advance, while every duplicate
      // successful notification still re-emits the durable event key.
      if (isPayableOrderStatus(String(order.status))) {
        if (!SETTLED_STATUSES.has(String(order.status))) {
          const existingMetadata =
            order.metadata && typeof order.metadata === "object" && !Array.isArray(order.metadata)
              ? (order.metadata as Record<string, unknown>)
              : {};
          const { error: updErr } = await admin
            .from("order")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              // `order` has no PhotonPay columns (unlike WeChat's dedicated ones),
              // so the settlement ids go in the generic metadata jsonb for
              // reconciliation against the PhotonPay portal.
              metadata: {
                ...existingMetadata,
                photonpay: {
                  reqId,
                  payId: payload.payId ?? null,
                  transactionId: payload.transactionId ?? payload.tradeNo ?? null,
                  payMethod: payload.payMethod ?? null,
                  notifiedAt: new Date().toISOString(),
                },
              },
            })
            .eq("id", orderId);
          if (updErr) throw new Error(`order paid update: ${updErr.message}`);
        }

        await runPostPaidSideEffects(orderId, "photonpay", reqId, {
          req_id: reqId,
          pay_id: payload.payId ?? null,
          transaction_id: payload.transactionId ?? payload.tradeNo ?? null,
        });
      }
    }
  } catch (err) {
    console.error("[photonpay-webhook] processing failed:", err instanceof Error ? err.message : err);
    // Non-2xx → PhotonPay retries. Appropriate for a transient DB error, and
    // rare enough not to approach the 8-strike disable.
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }

  return NextResponse.json(ROGER);
}
