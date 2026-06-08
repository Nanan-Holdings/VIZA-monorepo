import { NextResponse } from "next/server";
import { getAuthorizedAirwallexRecord, isUuid, updateRecordFromAirwallexIntent } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ paymentId: string }> },
) {
  const { paymentId } = await context.params;
  if (!isUuid(paymentId)) return NextResponse.json({ status: "failed" }, { status: 400 });

  try {
    const record = await getAuthorizedAirwallexRecord(paymentId);
    if (!record) return NextResponse.json({ status: "failed" }, { status: 404 });
    if (!record.provider_session_id) {
      return NextResponse.json({ status: "pending", paidAt: record.paid_at ?? null });
    }

    const result = await updateRecordFromAirwallexIntent(record.id, record.provider_session_id);
    return NextResponse.json({
      status: result.status,
      paidAt: result.paidAt,
      providerStatus: result.intent.status,
      attemptStatus: result.attemptStatus,
      expiresAt: result.attemptExpiresAt,
      nextAction: result.intent.next_action ?? null,
    });
  } catch (error) {
    console.error("[airwallex-status]", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ status: "failed" }, { status: 500 });
  }
}
