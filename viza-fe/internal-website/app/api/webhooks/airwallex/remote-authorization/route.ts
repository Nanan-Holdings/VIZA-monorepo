import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function eventIdFromPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "unknown";
  }
  const eventId = (payload as Record<string, unknown>).card_transaction_event_id;
  return typeof eventId === "string" && eventId.trim() ? eventId : "unknown";
}

/**
 * Airwallex requires its remote-authorization response schema. Always decline
 * while payments are retired, without reading credentials or issuer state.
 */
export async function POST(request: Request) {
  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    // Return a schema-valid decline even when the provider body is malformed.
  }

  return NextResponse.json(
    {
      card_transaction_event_id: eventIdFromPayload(payload),
      response_status: "DECLINED",
      status_reason: "PAYMENT_REMOVED: payment processing has been removed",
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
