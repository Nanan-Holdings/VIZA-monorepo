import { NextResponse } from "next/server";
import { isAirwallexConfigured } from "@/lib/airwallex/client";
import { getCommercialProduct, commercialProductFeeType, formatCny } from "@/lib/payments/commercial-products";
import { getCommercialAuthenticatedUser } from "@/lib/payments/commercial-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureAirwallexIntent, getAuthorizedAirwallexRecord, isUuid, safePaymentResponse } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CreateIntentBody {
  paymentId?: unknown;
  productId?: unknown;
}

export async function POST(request: Request) {
  if (!isAirwallexConfigured()) {
    return NextResponse.json({ error: "Online payment is not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as CreateIntentBody;
  const paymentId = typeof body.paymentId === "string" ? body.paymentId : null;

  try {
    if (paymentId) {
      if (!isUuid(paymentId)) return NextResponse.json({ error: "Invalid payment id." }, { status: 400 });
      const record = await getAuthorizedAirwallexRecord(paymentId);
      if (!record) return NextResponse.json({ error: "Payment record not found." }, { status: 404 });
      const intent = await ensureAirwallexIntent(record);
      return NextResponse.json(safePaymentResponse(record, intent));
    }

    const productId = typeof body.productId === "string" ? body.productId.trim() : "";
    const product = getCommercialProduct(productId);
    if (!product) return NextResponse.json({ error: "Invalid product." }, { status: 400 });

    const user = await getCommercialAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const now = new Date().toISOString();
    const { data: record, error } = await createAdminClient()
      .from("payment_records")
      .insert({
        application_id: null,
        applicant_id: null,
        visa_package_id: null,
        auth_user_id: user.id,
        provider: "airwallex",
        amount_cents: product.amountFen,
        currency: "CNY",
        status: "pending",
        fee_type: commercialProductFeeType(product),
        receipt_url: null,
        metadata: {
          source: "airwallex_checkout",
          product_id: product.id,
          product_kind: product.kind,
          product_name: product.name,
          product_name_zh: product.nameZh,
          amount_label: formatCny(product.amountFen),
          country: product.country,
          visa_type: product.visaType,
        },
        created_at: now,
        updated_at: now,
      })
      .select("id, application_id, auth_user_id, provider, provider_session_id, provider_payment_id, amount_cents, currency, status, fee_type, metadata, paid_at")
      .single();

    if (error || !record) throw new Error(error?.message ?? "Payment record insert failed.");
    const intent = await ensureAirwallexIntent(record);
    return NextResponse.json(safePaymentResponse(record, intent));
  } catch (error) {
    console.error("[airwallex-create-intent]", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Unable to create online payment order." }, { status: 500 });
  }
}
