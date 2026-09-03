import { NextResponse } from "next/server";
import { retrieveAirwallexPaymentConsent } from "@/lib/airwallex/client";
import { getCommercialAuthenticatedUser } from "@/lib/payments/commercial-session";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BINDING_FEE_TYPE = "payment_method_binding";

function cardIdentifier(paymentMethod: unknown): string {
  if (!paymentMethod || typeof paymentMethod !== "object") return "Card · verified";
  const card = (paymentMethod as { card?: unknown }).card;
  const source = card && typeof card === "object" ? card : paymentMethod;
  const object = source as Record<string, unknown>;
  const brand = typeof object.brand === "string" && object.brand.trim() ? object.brand.trim() : "Card";
  const last4 = typeof object.last4 === "string" && object.last4.trim() ? object.last4.trim() : null;
  return last4 ? `${brand.toUpperCase()} · **** ${last4}` : `${brand.toUpperCase()} · verified`;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ bindingId: string }> },
) {
  const user = await getCommercialAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bindingId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    paymentConsentId?: unknown;
  };
  const paymentConsentId = typeof body.paymentConsentId === "string" ? body.paymentConsentId : null;

  if (!paymentConsentId) {
    return NextResponse.json({ error: "Payment consent id is required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: record, error: lookupError } = await admin
    .from("payment_records")
    .select("id, applicant_id, metadata")
    .eq("id", bindingId)
    .eq("applicant_id", user.id)
    .eq("provider", "airwallex")
    .eq("fee_type", BINDING_FEE_TYPE)
    .maybeSingle();

  if (lookupError) {
    console.error("[payment-binding-airwallex-card-complete] Lookup failed:", lookupError.message);
    return NextResponse.json({ error: "Could not load card verification." }, { status: 500 });
  }
  if (!record) {
    return NextResponse.json({ error: "Card verification was not found." }, { status: 404 });
  }

  const metadata =
    record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
      ? record.metadata
      : {};
  const storedCustomerId = (metadata as { airwallex?: { customer_id?: unknown } }).airwallex
    ?.customer_id;
  if (typeof storedCustomerId !== "string" || !storedCustomerId) {
    return NextResponse.json({ error: "Card verification customer was not found." }, { status: 409 });
  }

  let consent;
  try {
    consent = await retrieveAirwallexPaymentConsent(paymentConsentId);
  } catch (error) {
    console.error("[payment-binding-airwallex-card-complete] Consent lookup failed:", error);
    return NextResponse.json({ error: "Could not verify the payment consent." }, { status: 502 });
  }
  if (consent.id !== paymentConsentId || consent.customer_id !== storedCustomerId) {
    return NextResponse.json({ error: "Payment consent does not belong to this account." }, { status: 409 });
  }
  if (consent.status.toUpperCase() !== "VERIFIED") {
    return NextResponse.json({ error: "Payment consent is not verified." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const identifier = cardIdentifier(consent.payment_method);
  const label =
    typeof (metadata as { card_nickname?: unknown }).card_nickname === "string"
      ? String((metadata as { card_nickname: string }).card_nickname).trim()
      : "Card";
  const { count: existingBindingCount, error: countError } = await admin
    .from("payment_records")
    .select("id", { count: "exact", head: true })
    .eq("applicant_id", user.id)
    .eq("fee_type", BINDING_FEE_TYPE)
    .eq("status", "bound")
    .neq("id", record.id);
  if (countError) {
    console.error("[payment-binding-airwallex-card-complete] Default lookup failed:", countError.message);
    return NextResponse.json({ error: "Could not verify saved payment methods." }, { status: 500 });
  }

  const { error } = await admin
    .from("payment_records")
    .update({
      status: "bound",
      provider_payment_id: paymentConsentId,
      updated_at: now,
      metadata: {
        ...metadata,
        airwallex: {
          ...((metadata as { airwallex?: Record<string, unknown> }).airwallex ?? {}),
          payment_consent_id: paymentConsentId,
          customer_id: storedCustomerId,
          payment_method: consent.payment_method ?? null,
          completed_at: now,
        },
        settings: {
          ...((metadata as { settings?: Record<string, unknown> }).settings ?? {}),
          label,
          method: "bank_card",
          is_default: false,
        },
      },
    })
    .eq("id", record.id);

  if (error) {
    console.error("[payment-binding-airwallex-card-complete] Update failed:", error.message);
    return NextResponse.json({ error: "Could not save card verification." }, { status: 500 });
  }

  if ((existingBindingCount ?? 0) === 0) {
    const { error: defaultError } = await admin.rpc("set_default_client_payment_binding", {
      p_applicant_id: user.id,
      p_binding_id: record.id,
    });
    if (defaultError) {
      console.error("[payment-binding-airwallex-card-complete] Default update failed:", defaultError.message);
    }
  }

  return NextResponse.json({
    bindingId: record.id,
    method: "bank_card",
    status: "bound",
    accountLabel: label,
    identifier,
  });
}
