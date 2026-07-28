import { NextResponse } from "next/server";
import { createAirwallexCustomer, isAirwallexConfigured } from "@/lib/airwallex/client";
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

  try {
    const customer = await createAirwallexCustomer({
      requestId: `viza-customer-${record.id}`.slice(0, 64),
      merchantCustomerId: record.id,
      email: user.email,
      firstName: user.name || "VIZA",
      metadata: {
        ...metadata,
        payment_record_id: record.id,
      },
    });

    if (!customer.client_secret) {
      throw new Error("Airwallex customer response did not include a client secret.");
    }

    await createAdminClient()
      .from("payment_records")
      .update({
        provider_session_id: customer.id,
        provider_payment_id: customer.id,
        metadata: {
          ...metadata,
          airwallex: {
            customer_id: customer.id,
            customer_request_id: customer.request_id ?? `viza-customer-${record.id}`,
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", record.id);

    return NextResponse.json({
      bindingId: record.id,
      customerId: customer.id,
      clientSecret: customer.client_secret,
      currency: "CNY",
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
