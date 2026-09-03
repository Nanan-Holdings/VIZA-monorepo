import { NextResponse } from "next/server";
import {
  confirmPaymentIntent,
  confirmPaymentIntentWithConsent,
  getAirwallexEnvironment,
  type AirwallexPaymentMethodType,
} from "@/lib/airwallex/client";
import { syncAirwallexWalletConsent } from "@/lib/airwallex/payment-consent-record";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppBaseUrl, getAuthorizedAirwallexRecord, isUuid, updateRecordFromAirwallexIntent } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supportedMethods = new Set<AirwallexPaymentMethodType>([
  "card",
  "alipaycn_qrcode",
  "alipaycn_mobile_web",
  "wechatpay_qrcode",
  "wechatpay_mobile_web",
]);

function requestedMethodLabel(methodType: AirwallexPaymentMethodType): string {
  if (methodType === "wechatpay_qrcode" || methodType === "wechatpay_mobile_web") return "wechat";
  if (methodType === "alipaycn_qrcode" || methodType === "alipaycn_mobile_web") return "alipay";
  return "card";
}

function walletMethod(methodType: AirwallexPaymentMethodType): "wechat_pay" | "alipay" | null {
  if (methodType === "wechatpay_qrcode" || methodType === "wechatpay_mobile_web") return "wechat_pay";
  if (methodType === "alipaycn_qrcode" || methodType === "alipaycn_mobile_web") return "alipay";
  return null;
}

async function defaultWalletConsent(applicantId: string, method: "wechat_pay" | "alipay") {
  const { data, error } = await createAdminClient()
    .from("payment_records")
    .select("provider_payment_id, metadata")
    .eq("applicant_id", applicantId)
    .eq("provider", "airwallex")
    .eq("fee_type", "payment_method_binding")
    .eq("status", "bound")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);

  const binding = (data ?? []).find((row) => {
    const metadata =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as { settings?: { is_default?: unknown; method?: unknown } })
        : {};
    return metadata.settings?.is_default === true && metadata.settings.method === method;
  });
  return binding?.provider_payment_id ?? null;
}

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

    const typedMethod = methodType as AirwallexPaymentMethodType;
    const savedMethod = walletMethod(typedMethod);
    let paymentConsentId: string | null = null;
    if (savedMethod && record.applicant_id) {
      try {
        const candidate = await defaultWalletConsent(record.applicant_id, savedMethod);
        if (candidate) {
          const synced = await syncAirwallexWalletConsent(candidate);
          if (synced?.status === "bound" && synced.applicantId === record.applicant_id) {
            paymentConsentId = candidate;
          }
        }
      } catch (syncError) {
        console.error(
          "[airwallex-confirm-method] Saved consent refresh failed; using interactive payment:",
          syncError instanceof Error ? syncError.message : "Unknown error",
        );
      }
    }

    const intent = paymentConsentId
      ? await confirmPaymentIntentWithConsent({
          intentId: record.provider_session_id,
          paymentConsentId,
          requestId: `saved-consent-${record.id}`,
        })
      : await confirmPaymentIntent({
          intentId: record.provider_session_id,
          methodType: typedMethod,
          returnUrl: returnUrl.toString(),
        });
    const result = await updateRecordFromAirwallexIntent(record.id, intent.id, {
      requestedMethod: requestedMethodLabel(typedMethod),
      paymentConsentId: paymentConsentId ?? undefined,
    });

    return NextResponse.json({
      status: result.status,
      providerStatus: intent.status,
      environment: getAirwallexEnvironment(),
      nextAction: intent.next_action ?? null,
    });
  } catch (error) {
    console.error("[airwallex-confirm-method]", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Unable to confirm payment method." }, { status: 500 });
  }
}
