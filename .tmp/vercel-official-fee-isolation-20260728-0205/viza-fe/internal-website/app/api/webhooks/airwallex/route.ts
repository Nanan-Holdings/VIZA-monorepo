import { NextResponse } from "next/server";
import { verifyAirwallexWebhookSignature } from "@/lib/airwallex/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleAirwallexPaymentSucceeded, updateRecordFromAirwallexIntent } from "../../payments/airwallex/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getEventType(payload: Record<string, unknown>): string {
  const name = payload.name ?? payload.event_type ?? payload.type;
  return typeof name === "string" ? name : "";
}

function getIntentId(payload: Record<string, unknown>): string | null {
  const data = payload.data;
  const object =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as { object?: unknown }).object ?? data
      : payload.object;
  if (!object || typeof object !== "object" || Array.isArray(object)) return null;
  const id = (object as { id?: unknown }).id;
  return typeof id === "string" ? id : null;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const verified = verifyAirwallexWebhookSignature({
    rawBody,
    timestamp: request.headers.get("x-timestamp"),
    signature: request.headers.get("x-signature"),
  });

  if (!verified) return NextResponse.json({ error: "Invalid Airwallex signature." }, { status: 400 });

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const intentId = getIntentId(payload);
  if (!intentId) return NextResponse.json({ received: true });

  try {
    const { data: record, error } = await createAdminClient()
      .from("payment_records")
      .select("id")
      .eq("provider", "airwallex")
      .eq("provider_session_id", intentId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!record) return NextResponse.json({ received: true });

    const eventType = getEventType(payload);
    if (eventType.includes("succeeded") || eventType.includes("SUCCEEDED")) {
      await handleAirwallexPaymentSucceeded(record.id, intentId);
    } else {
      await updateRecordFromAirwallexIntent(record.id, intentId);
    }
  } catch (error) {
    console.error("[airwallex-webhook]", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
