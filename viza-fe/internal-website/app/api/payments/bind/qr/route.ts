import { NextResponse } from "next/server";
import QRCode from "qrcode";
import {
  createAirwallexCustomer,
  createAirwallexPaymentConsent,
  disableAirwallexPaymentConsent,
  getAirwallexEnvironment,
  isAirwallexConfigured,
  isAirwallexWechatRecurringConfigured,
  verifyAirwallexWalletPaymentConsent,
} from "@/lib/airwallex/client";
import { syncAirwallexWalletConsent } from "@/lib/airwallex/payment-consent-record";
import { getCommercialAuthenticatedUser } from "@/lib/payments/commercial-session";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BINDING_FEE_TYPE = "payment_method_binding";
const WALLET_METHODS = new Set(["wechat_pay", "alipay"]);

function getAppBaseUrl(request: Request): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/+$/, "");
  return new URL(request.url).origin.replace(/\/+$/, "");
}

async function parseMethod(request: Request): Promise<"wechat_pay" | "alipay" | null> {
  try {
    const body = (await request.json()) as { method?: unknown };
    return typeof body.method === "string" && WALLET_METHODS.has(body.method)
      ? (body.method as "wechat_pay" | "alipay")
      : null;
  } catch {
    return null;
  }
}

function walletLabel(method: "wechat_pay" | "alipay") {
  return method === "wechat_pay" ? "WeChat Pay" : "Alipay";
}

function safeAuthorizationUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const user = await getCommercialAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const method = await parseMethod(request);
  if (!method) {
    return NextResponse.json({ error: "Unsupported wallet method." }, { status: 400 });
  }
  if (!isAirwallexConfigured()) {
    return NextResponse.json(
      { error: "Airwallex wallet authorization is not configured." },
      { status: 503 },
    );
  }
  if (method === "wechat_pay" && !isAirwallexWechatRecurringConfigured()) {
    return NextResponse.json(
      { error: "Airwallex WeChat recurring authorization is not configured for a single plan." },
      { status: 503 },
    );
  }

  const admin = createAdminClient();
  const { count: openBindingCount, error: countError } = await admin
    .from("payment_records")
    .select("id", { count: "exact", head: true })
    .eq("applicant_id", user.id)
    .eq("provider", "airwallex")
    .eq("fee_type", BINDING_FEE_TYPE)
    .eq("status", "requires_action");
  if (countError) {
    return NextResponse.json({ error: "Could not check wallet authorizations." }, { status: 500 });
  }
  if ((openBindingCount ?? 0) >= 5) {
    return NextResponse.json(
      { error: "Too many wallet authorizations are awaiting completion." },
      { status: 429 },
    );
  }

  const now = new Date().toISOString();
  const initialMetadata = {
    source: "client_settings_payment_binding",
    feeType: BINDING_FEE_TYPE,
    payment_method_type: method,
    settings: {
      method,
      label: walletLabel(method),
      is_default: false,
    },
  };
  const { data: record, error: insertError } = await admin
    .from("payment_records")
    .insert({
      application_id: null,
      applicant_id: user.id,
      visa_package_id: null,
      auth_user_id: user.authUserId,
      provider: "airwallex",
      provider_session_id: null,
      provider_payment_id: null,
      amount_cents: 0,
      currency: "CNY",
      status: "requires_action",
      fee_type: BINDING_FEE_TYPE,
      receipt_url: null,
      metadata: initialMetadata,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (insertError || !record) {
    console.error("[payment-binding-wallet] Record create failed:", insertError?.message);
    return NextResponse.json({ error: "Could not start wallet authorization." }, { status: 500 });
  }

  let createdConsentId: string | null = null;
  try {
    const customer = await createAirwallexCustomer({
      requestId: `wallet-customer-${record.id}`,
      merchantCustomerId: record.id,
      email: user.email,
      firstName: user.name || "VIZA",
      metadata: { payment_record_id: record.id, wallet_method: method },
    });
    const consent = await createAirwallexPaymentConsent({
      requestId: `wallet-consent-${record.id}`,
      customerId: customer.id,
    });
    createdConsentId = consent.id;

    const { error: consentPersistError } = await admin
      .from("payment_records")
      .update({
        provider_session_id: consent.id,
        provider_payment_id: consent.id,
        metadata: {
          ...initialMetadata,
          airwallex: {
            customer_id: customer.id,
            payment_consent_id: consent.id,
            consent_status: consent.status,
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", record.id)
      .eq("applicant_id", user.id);
    if (consentPersistError) throw new Error(consentPersistError.message);

    const returnUrl = new URL("/client/settings/payment-methods", getAppBaseUrl(request));
    returnUrl.searchParams.set("wallet_binding", "return");
    returnUrl.searchParams.set("bindingId", record.id);
    const verification = await verifyAirwallexWalletPaymentConsent({
      paymentConsentId: consent.id,
      method,
      requestId: `wallet-verify-${record.id}`,
      returnUrl: returnUrl.toString(),
    });
    const authorizationTarget = verification.next_action?.qrcode ?? verification.next_action?.url;
    const authorizationUrl =
      safeAuthorizationUrl(verification.next_action?.url) ??
      safeAuthorizationUrl(verification.next_action?.qrcode);
    const isVerified = verification.status.toUpperCase() === "VERIFIED";
    if (!authorizationTarget && !isVerified) {
      throw new Error("Airwallex did not return a wallet authorization action.");
    }

    const { error: verificationPersistError } = await admin
      .from("payment_records")
      .update({
        metadata: {
          ...initialMetadata,
          airwallex: {
            customer_id: customer.id,
            payment_consent_id: consent.id,
            consent_status: verification.status,
            next_action_type: verification.next_action?.type ?? null,
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", record.id)
      .eq("applicant_id", user.id);
    if (verificationPersistError) throw new Error(verificationPersistError.message);

    if (isVerified) {
      await syncAirwallexWalletConsent(consent.id);
    }

    const qrCodeDataUrl = authorizationTarget
      ? await QRCode.toDataURL(authorizationTarget, {
          margin: 1,
          width: 280,
          errorCorrectionLevel: "M",
        })
      : null;
    return NextResponse.json({
      bindingId: record.id,
      method,
      qrCodeDataUrl,
      authorizationUrl,
      completed: isVerified,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      environment: getAirwallexEnvironment(),
    });
  } catch (error) {
    console.error(
      "[payment-binding-wallet] Provider authorization failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    if (createdConsentId) {
      try {
        await disableAirwallexPaymentConsent({
          paymentConsentId: createdConsentId,
          requestId: `wallet-cleanup-${record.id}`,
        });
      } catch (cleanupError) {
        console.error(
          "[payment-binding-wallet] Consent cleanup failed:",
          cleanupError instanceof Error ? cleanupError.message : "Unknown error",
        );
      }
    }
    await admin
      .from("payment_records")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", record.id)
      .eq("applicant_id", user.id);
    return NextResponse.json({ error: "Could not start wallet authorization." }, { status: 502 });
  }
}
