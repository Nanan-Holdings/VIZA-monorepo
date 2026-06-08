import { NextResponse } from "next/server";
import { createBindingPaymentIntent, isAirwallexConfigured } from "@/lib/airwallex/client";
import { getCommercialAuthenticatedUser } from "@/lib/payments/commercial-session";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BINDING_FEE_TYPE = "payment_method_binding";

async function parseCardRequest(request: Request): Promise<{
  nickname: string;
} | null> {
  try {
    const body = (await request.json()) as {
      nickname?: unknown;
    };
    const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
    if (!nickname) return null;
    return { nickname };
  } catch {
    return null;
  }
}

function appBaseUrl(request: Request): string {
  const configuredUrl = (process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL)?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/+$/, "");
  return new URL(request.url).origin.replace(/\/+$/, "");
}

export async function POST(request: Request) {
  const user = await getCommercialAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseCardRequest(request);
  if (!parsed) {
    return NextResponse.json({ error: "Card nickname is required." }, { status: 400 });
  }

  if (!isAirwallexConfigured()) {
    return NextResponse.json({ error: "Airwallex card verification is not configured." }, { status: 503 });
  }

  const now = new Date().toISOString();
  const metadata = {
    source: "client_settings_payment_binding",
    feeType: BINDING_FEE_TYPE,
    payment_method_type: "card",
    userId: user.id,
    card_nickname: parsed.nickname,
  };

  const { data: record, error } = await createAdminClient()
    .from("payment_records")
    .insert({
      application_id: null,
      applicant_id: user.id,
      visa_package_id: null,
      auth_user_id: user.id,
      provider: "airwallex",
      provider_session_id: null,
      provider_payment_id: null,
      amount_cents: 0,
      currency: "CNY",
      status: "requires_action",
      fee_type: BINDING_FEE_TYPE,
      receipt_url: null,
      metadata,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (error || !record) {
    console.error("[payment-binding-airwallex-card] Failed to create binding record:", error?.message);
    return NextResponse.json({ error: "Could not start card verification." }, { status: 500 });
  }

  const returnUrl = new URL("/client/settings/payment-methods", appBaseUrl(request));
  returnUrl.searchParams.set("payment_bind", "success");
  returnUrl.searchParams.set("bindingId", record.id);
  returnUrl.searchParams.set("provider", "airwallex");

  try {
    const intent = await createBindingPaymentIntent({
      currency: "CNY",
      merchantOrderId: record.id,
      requestId: `viza-bind-${record.id}`.slice(0, 64),
      returnUrl: returnUrl.toString(),
      customerEmail: user.email,
      customerName: user.name,
      metadata: {
        ...metadata,
        payment_record_id: record.id,
      },
    });

    await createAdminClient()
      .from("payment_records")
      .update({
        provider_session_id: intent.id,
        provider_payment_id: intent.id,
        metadata: {
          ...metadata,
          airwallex: {
            intent_id: intent.id,
            intent_status: intent.status,
            request_id: intent.request_id ?? `viza-bind-${record.id}`,
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", record.id);

    return NextResponse.json({
      bindingId: record.id,
      intentId: intent.id,
      clientSecret: intent.client_secret ?? null,
      currency: intent.currency,
    });
  } catch (caught) {
    console.error("[payment-binding-airwallex-card] Failed to create Airwallex intent:", caught);
    await createAdminClient()
      .from("payment_records")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", record.id);

    return NextResponse.json({ error: "Could not start Airwallex card verification." }, { status: 502 });
  }
}
