import { NextResponse } from "next/server";
import { getCommercialAuthenticatedUser } from "@/lib/payments/commercial-session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  StripeRouteConfigError,
  getAppBaseUrl,
  getStripeClient,
} from "@/app/api/stripe/_shared";

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

export async function POST(request: Request) {
  const user = await getCommercialAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseCardRequest(request);
  if (!parsed) {
    return NextResponse.json({ error: "Card nickname is required." }, { status: 400 });
  }

  let stripe;
  try {
    stripe = getStripeClient();
  } catch (error) {
    if (error instanceof StripeRouteConfigError) {
      return NextResponse.json({ error: "Hosted card verification is not configured." }, { status: 503 });
    }
    throw error;
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
      provider: "stripe",
      provider_session_id: null,
      provider_payment_id: null,
      amount_cents: 0,
      currency: "USD",
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
    console.error("[payment-binding-stripe-card] Failed to create binding record:", error?.message);
    return NextResponse.json({ error: "Could not start card verification." }, { status: 500 });
  }

  const successUrl = new URL("/client/settings/payment-methods", getAppBaseUrl(request));
  successUrl.searchParams.set("payment_bind", "success");
  successUrl.searchParams.set("bindingId", record.id);
  successUrl.searchParams.set("provider", "stripe");
  successUrl.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");

  const cancelUrl = new URL("/client/settings/payment-methods", getAppBaseUrl(request));
  cancelUrl.searchParams.set("payment_bind", "cancelled");
  cancelUrl.searchParams.set("bindingId", record.id);
  cancelUrl.searchParams.set("provider", "stripe");

  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    customer_email: user.email,
    payment_method_types: ["card"],
    success_url: successUrl.toString().replace("%7BCHECKOUT_SESSION_ID%7D", "{CHECKOUT_SESSION_ID}"),
    cancel_url: cancelUrl.toString(),
    client_reference_id: record.id,
    metadata: {
      ...metadata,
      paymentRecordId: record.id,
      payment_record_id: record.id,
    },
    setup_intent_data: {
      metadata: {
        ...metadata,
        paymentRecordId: record.id,
        payment_record_id: record.id,
      },
    },
  });

  await createAdminClient()
    .from("payment_records")
    .update({
      provider_session_id: session.id,
      metadata: {
        ...metadata,
        stripe: {
          checkout_session_id: session.id,
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", record.id);

  if (!session.url) {
    return NextResponse.json({ error: "Card verification session could not be created." }, { status: 502 });
  }

  return NextResponse.json({
    bindingId: record.id,
    checkoutUrl: session.url,
  });
}
