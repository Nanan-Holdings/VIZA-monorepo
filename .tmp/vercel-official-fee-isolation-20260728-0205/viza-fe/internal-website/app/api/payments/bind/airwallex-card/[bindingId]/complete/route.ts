import { NextResponse } from "next/server";
import { getCommercialAuthenticatedUser } from "@/lib/payments/commercial-session";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BINDING_FEE_TYPE = "payment_method_binding";

function cardIdentifier(paymentMethod: unknown): string {
  if (!paymentMethod || typeof paymentMethod !== "object") return "银行卡 · 已通过安全验证";
  const card = (paymentMethod as { card?: unknown }).card;
  const source = card && typeof card === "object" ? card : paymentMethod;
  const object = source as Record<string, unknown>;
  const brand = typeof object.brand === "string" && object.brand.trim() ? object.brand.trim() : "银行卡";
  const last4 = typeof object.last4 === "string" && object.last4.trim() ? object.last4.trim() : null;
  return last4 ? `${brand.toUpperCase()} · **** ${last4}` : `${brand.toUpperCase()} · 已通过安全验证`;
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
    customerId?: unknown;
    paymentMethod?: unknown;
  };
  const paymentConsentId = typeof body.paymentConsentId === "string" ? body.paymentConsentId : null;

  if (!paymentConsentId) {
    return NextResponse.json({ error: "Payment consent id is required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: record, error: lookupError } = await admin
    .from("payment_records")
    .select("id, auth_user_id, metadata")
    .eq("id", bindingId)
    .eq("auth_user_id", user.id)
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
  const now = new Date().toISOString();
  const identifier = cardIdentifier(body.paymentMethod);

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
          customer_id: typeof body.customerId === "string" ? body.customerId : null,
          payment_method: body.paymentMethod ?? null,
          completed_at: now,
        },
      },
    })
    .eq("id", record.id);

  if (error) {
    console.error("[payment-binding-airwallex-card-complete] Update failed:", error.message);
    return NextResponse.json({ error: "Could not save card verification." }, { status: 500 });
  }

  return NextResponse.json({
    bindingId: record.id,
    method: "bank_card",
    status: "bound",
    accountLabel: "银行卡",
    identifier,
  });
}
