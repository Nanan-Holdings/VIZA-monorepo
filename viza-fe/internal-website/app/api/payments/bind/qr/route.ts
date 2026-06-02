import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import QRCode from "qrcode";
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

export async function POST(request: Request) {
  const user = await getCommercialAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const method = await parseMethod(request);
  if (!method) {
    return NextResponse.json({ error: "Unsupported wallet method." }, { status: 400 });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  const nonce = randomBytes(18).toString("hex");
  const metadata = {
    source: "client_settings_payment_binding",
    binding: {
      method,
      nonce,
      expires_at: expiresAt,
    },
  };

  const { data, error } = await createAdminClient()
    .from("payment_records")
    .insert({
      application_id: null,
      applicant_id: user.id,
      visa_package_id: null,
      auth_user_id: user.id,
      provider: method,
      provider_session_id: null,
      provider_payment_id: null,
      amount_cents: 0,
      currency: "CNY",
      status: "pending",
      fee_type: BINDING_FEE_TYPE,
      receipt_url: null,
      metadata,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[payment-binding-qr] Failed to create binding intent:", error?.message);
    return NextResponse.json({ error: "Could not create binding QR code." }, { status: 500 });
  }

  const callbackUrl = new URL(`/api/payments/bind/status/${data.id}`, getAppBaseUrl(request));
  callbackUrl.searchParams.set("complete", "1");
  callbackUrl.searchParams.set("nonce", nonce);
  const qrCodeDataUrl = await QRCode.toDataURL(callbackUrl.toString(), {
    margin: 1,
    width: 240,
    errorCorrectionLevel: "M",
  });

  await createAdminClient()
    .from("payment_records")
    .update({
      provider_session_id: data.id,
      metadata: {
        ...metadata,
        binding: {
          ...metadata.binding,
          callback_url: callbackUrl.toString(),
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.id);

  return NextResponse.json({
    bindingId: data.id,
    method,
    qrCodeDataUrl,
    expiresAt,
  });
}
