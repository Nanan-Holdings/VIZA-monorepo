import { NextResponse } from "next/server";
import {
  syncAirwallexWalletConsent,
  walletMethodFromMetadata,
} from "@/lib/airwallex/payment-consent-record";
import { getCommercialAuthenticatedUser } from "@/lib/payments/commercial-session";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BINDING_FEE_TYPE = "payment_method_binding";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function providerLabel(method: "wechat_pay" | "alipay") {
  return method === "wechat_pay" ? "WeChat Pay" : "Alipay";
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ bindingId: string }> },
) {
  const user = await getCommercialAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { bindingId } = await context.params;
  if (!UUID_PATTERN.test(bindingId)) {
    return NextResponse.json({ error: "Invalid binding." }, { status: 400 });
  }

  const { data: record, error } = await createAdminClient()
    .from("payment_records")
    .select("id, applicant_id, provider, provider_payment_id, status, metadata")
    .eq("id", bindingId)
    .eq("applicant_id", user.id)
    .eq("fee_type", BINDING_FEE_TYPE)
    .maybeSingle();
  if (error) {
    console.error("[payment-binding-status] Lookup failed:", error.message);
    return NextResponse.json({ error: "Could not load binding status." }, { status: 500 });
  }
  if (!record) return NextResponse.json({ error: "Binding not found." }, { status: 404 });

  const method = walletMethodFromMetadata(record.metadata);
  if (record.provider !== "airwallex" || !record.provider_payment_id || !method) {
    return NextResponse.json({ error: "Wallet authorization was not found." }, { status: 409 });
  }

  try {
    const synced = await syncAirwallexWalletConsent(record.provider_payment_id);
    if (!synced || synced.applicantId !== user.id) {
      return NextResponse.json({ error: "Wallet authorization was not found." }, { status: 404 });
    }
    const bound = synced.status === "bound";
    return NextResponse.json({
      bindingId: synced.bindingId,
      method: synced.method,
      status: synced.status,
      accountLabel: synced.label,
      identifier: bound ? `${providerLabel(synced.method)} · authorized` : null,
    });
  } catch (caught) {
    console.error(
      "[payment-binding-status] Provider sync failed:",
      caught instanceof Error ? caught.message : "Unknown error",
    );
    return NextResponse.json({ error: "Could not verify wallet authorization." }, { status: 502 });
  }
}
