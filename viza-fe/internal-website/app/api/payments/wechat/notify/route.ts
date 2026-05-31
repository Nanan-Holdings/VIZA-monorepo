import { NextResponse } from "next/server";
import {
  decryptCallbackResource,
  readCallbackHeaders,
  verifyCallbackSignature,
  WechatPaySignatureError,
} from "@/lib/wechatpay/client";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mergeMetadata(existing: unknown, next: Record<string, unknown>) {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? existing
      : {};
  return {
    ...base,
    wechat_pay: {
      ...((base as { wechat_pay?: Record<string, unknown> }).wechat_pay ?? {}),
      ...next,
    },
  };
}

export async function POST(request: Request) {
  const raw = await request.text();
  const callbackHeaders = readCallbackHeaders(request.headers);

  try {
    await verifyCallbackSignature(callbackHeaders, raw);
  } catch (error) {
    if (error instanceof WechatPaySignatureError) {
      return NextResponse.json({ code: "FAIL", message: error.message }, { status: 401 });
    }
    throw error;
  }

  let parsed: {
    resource?: {
      algorithm: string;
      ciphertext: string;
      associated_data?: string;
      nonce: string;
    };
  };

  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return NextResponse.json({ code: "FAIL", message: "invalid JSON" }, { status: 400 });
  }

  if (!parsed.resource) {
    return NextResponse.json({ code: "FAIL", message: "missing resource" }, { status: 400 });
  }

  const resource = decryptCallbackResource(parsed.resource);
  if (!resource.out_trade_no) {
    return NextResponse.json({ code: "FAIL", message: "missing out_trade_no" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: record, error } = await admin
    .from("payment_records")
    .select("id, status, metadata")
    .eq("provider", "wechat_pay")
    .eq("provider_session_id", resource.out_trade_no)
    .maybeSingle();

  if (error) {
    console.error("[payments-wechat-notify] lookup failed:", error.message);
    return NextResponse.json({ code: "FAIL", message: "lookup failed" }, { status: 500 });
  }

  if (!record) {
    return NextResponse.json({ code: "SUCCESS", message: "ignored" });
  }

  const paid = resource.trade_state === "SUCCESS";
  const paidAt = resource.success_time ?? new Date().toISOString();
  const { error: updateError } = await admin
    .from("payment_records")
    .update({
      provider_payment_id: resource.transaction_id ?? null,
      status: paid ? "paid" : "pending",
      paid_at: paid ? paidAt : null,
      updated_at: new Date().toISOString(),
      metadata: mergeMetadata(record.metadata, {
        out_trade_no: resource.out_trade_no,
        transaction_id: resource.transaction_id ?? null,
        trade_state: resource.trade_state ?? null,
        trade_state_desc: resource.trade_state_desc ?? null,
        payer_openid: resource.payer?.openid ?? null,
        amount_total: resource.amount?.total ?? null,
      }),
    })
    .eq("id", record.id);

  if (updateError) {
    console.error("[payments-wechat-notify] update failed:", updateError.message);
    return NextResponse.json({ code: "FAIL", message: "update failed" }, { status: 500 });
  }

  return NextResponse.json({ code: "SUCCESS", message: "OK" });
}
