import { NextResponse } from "next/server";
import { confirmPaymentIntent, type AirwallexPaymentMethodType } from "@/lib/airwallex/client";
import { getAppBaseUrl, getAuthorizedAirwallexRecord, isUuid, updateRecordFromAirwallexIntent } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supportedMethods = new Set<AirwallexPaymentMethodType>([
  "card",
  "alipaycn_mobile_web",
  "wechatpay_qrcode",
  "wechatpay_mobile_web",
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ paymentId: string }> },
) {
  const { paymentId } = await context.params;
  if (!isUuid(paymentId)) return NextResponse.json({ error: "Invalid payment id." }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { methodType?: unknown };
  const methodType = typeof body.methodType === "string" ? body.methodType : "";
  if (!supportedMethods.has(methodType as AirwallexPaymentMethodType)) {
    return NextResponse.json({ error: "Unsupported payment method." }, { status: 400 });
  }

  try {
    const record = await getAuthorizedAirwallexRecord(paymentId);
    if (!record?.provider_session_id) {
      return NextResponse.json({ error: "Payment intent is not ready." }, { status: 404 });
    }

    const appBaseUrl = await getAppBaseUrl();
    const returnUrl = new URL("/payments/result", appBaseUrl);
    returnUrl.searchParams.set("paymentId", record.id);

    const intent = await confirmPaymentIntent({
      intentId: record.provider_session_id,
      methodType: methodType as AirwallexPaymentMethodType,
      returnUrl: returnUrl.toString(),
    });
    const result = await updateRecordFromAirwallexIntent(record.id, intent.id);

    return NextResponse.json({
      status: result.status,
      providerStatus: intent.status,
      nextAction: intent.next_action ?? null,
    });
  } catch (error) {
    console.error("[airwallex-confirm-method]", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Unable to confirm payment method." }, { status: 500 });
  }
}
