import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  decideAirwallexRemoteAuthorization,
  parseAirwallexDailyLimits,
  parseAirwallexRemoteAuthorizationRequest,
  verifyAirwallexRemoteAuthorizationSignature,
  type AirwallexAuthorizationCardContext,
} from "./route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadManagedCardContext(
  cardId: string,
): Promise<{ card: AirwallexAuthorizationCardContext; dailyReservedAmount: number } | null> {
  const admin = createAdminClient();
  const { data: attempt, error: attemptError } = await admin
    .from("issuer_card_attempts")
    .select("allocation_id, issuer, status, currency, limit_amount")
    .eq("issuer", "airwallex")
    .eq("issuer_card_id", cardId)
    .maybeSingle();

  if (attemptError) throw new Error("managed card lookup failed");
  if (!attempt) return null;

  const currency = String(attempt.currency).toUpperCase();
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const [allocationResult, reservedResult] = await Promise.all([
    admin
      .from("government_fee_allocations")
      .select("state")
      .eq("id", attempt.allocation_id)
      .maybeSingle(),
    admin
      .from("issuer_card_attempts")
      .select("limit_amount")
      .eq("issuer", "airwallex")
      .eq("currency", currency)
      .in("status", ["issued", "portal_processing", "consumed"])
      .gte("created_at", dayStart.toISOString()),
  ]);
  const { data: allocation, error: allocationError } = allocationResult;
  const { data: reservedAttempts, error: reservedError } = reservedResult;
  if (allocationError) throw new Error("managed allocation lookup failed");
  if (!allocation) return null;
  if (reservedError) throw new Error("daily issuer reservation lookup failed");
  const dailyReservedAmount = (reservedAttempts ?? []).reduce(
    (total, row) => total + Number(row.limit_amount),
    0,
  );

  return {
    card: {
      issuer: String(attempt.issuer),
      attemptStatus: String(attempt.status),
      currency,
      limitAmount: Number(attempt.limit_amount),
      allocationState: String(allocation.state),
    },
    dailyReservedAmount,
  };
}

export async function POST(request: Request) {
  const sharedSecret = process.env.AIRWALLEX_REMOTE_AUTH_SHARED_SECRET?.trim() ?? "";
  const expectedAccountId = process.env.AIRWALLEX_ISSUING_ACCOUNT_ID?.trim() ?? "";
  if (!sharedSecret || !expectedAccountId) {
    return NextResponse.json({ error: "Remote authorization is not configured." }, { status: 503 });
  }

  const verified = verifyAirwallexRemoteAuthorizationSignature({
    nonce: request.headers.get("x-nonce"),
    signature: request.headers.get("x-signature"),
    sharedSecret,
  });
  if (!verified) {
    return NextResponse.json({ error: "Invalid remote authorization signature." }, { status: 401 });
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(await request.text()) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const payload = parseAirwallexRemoteAuthorizationRequest(rawPayload);
  if (!payload) {
    return NextResponse.json({ error: "Unsupported remote authorization payload." }, { status: 400 });
  }

  try {
    const loaded = await loadManagedCardContext(payload.cardId);
    const dailyLimits = parseAirwallexDailyLimits(
      process.env.AIRWALLEX_REMOTE_AUTH_DAILY_LIMITS,
    );
    return NextResponse.json(decideAirwallexRemoteAuthorization({
      request: payload,
      expectedAccountId,
      card: loaded?.card ?? null,
      dailyLimit: dailyLimits.get(payload.transactionCurrency) ?? null,
      dailyReservedAmount: loaded?.dailyReservedAmount ?? 0,
    }));
  } catch {
    return NextResponse.json({
      card_transaction_event_id: payload.cardTransactionEventId,
      response_status: "DECLINED",
      status_reason: "internal safety check unavailable",
    });
  }
}
