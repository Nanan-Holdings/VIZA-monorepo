import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPhotonPayWebhook } from "@/lib/photonpay/client";
import { parsePhotonPayFundingEvent, recordPhotonPayFundingEvent } from "@/lib/treasury/reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROGER = { roger: true };

/**
 * Signed PhotonPay issuing/funding evidence receiver.
 *
 * This endpoint does not subscribe to topics, issue cards, recharge cards, or
 * move funds. It is safe to deploy before the vendor-side funding contract is
 * enabled; a verified callback is reduced to an idempotent, redacted row.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const sign = request.headers.get("x-pd-sign") ?? request.headers.get("X-PD-SIGN");
  const verdict = verifyPhotonPayWebhook(rawBody, sign);
  if (verdict === "not-configured") return NextResponse.json({ error: "not configured" }, { status: 503 });
  if (verdict === "bad-signature") return NextResponse.json({ error: "invalid signature" }, { status: 401 });

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    // The signature is valid but the body cannot be acted on; retrying cannot
    // repair malformed provider data, so acknowledge it and leave no row.
    return NextResponse.json(ROGER);
  }

  try {
    await recordPhotonPayFundingEvent(createAdminClient(), parsePhotonPayFundingEvent(rawBody, payload));
  } catch (error) {
    console.error("[photonpay-funding-webhook] recording failed:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "recording failed" }, { status: 500 });
  }

  return NextResponse.json(ROGER);
}
