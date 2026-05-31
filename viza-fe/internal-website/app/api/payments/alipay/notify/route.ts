import { NextResponse } from "next/server";
import { verifyAlipayNotify } from "@/lib/alipay/client";
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
    alipay: {
      ...((base as { alipay?: Record<string, unknown> }).alipay ?? {}),
      ...next,
    },
  };
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const params: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") params[key] = value;
  }

  if (!verifyAlipayNotify(params)) {
    return new NextResponse("fail", { status: 401 });
  }

  const outTradeNo = params.out_trade_no;
  if (!outTradeNo) return new NextResponse("fail", { status: 400 });

  const paid = params.trade_status === "TRADE_SUCCESS" || params.trade_status === "TRADE_FINISHED";
  const admin = createAdminClient();
  const { data: record, error } = await admin
    .from("payment_records")
    .select("id, metadata")
    .eq("provider", "alipay")
    .eq("provider_session_id", outTradeNo)
    .maybeSingle();

  if (error) {
    console.error("[payments-alipay-notify] lookup failed:", error.message);
    return new NextResponse("fail", { status: 500 });
  }

  if (!record) return new NextResponse("success");

  const { error: updateError } = await admin
    .from("payment_records")
    .update({
      provider_payment_id: params.trade_no ?? null,
      status: paid ? "paid" : "pending",
      paid_at: paid ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
      metadata: mergeMetadata(record.metadata, {
        out_trade_no: outTradeNo,
        trade_no: params.trade_no ?? null,
        trade_status: params.trade_status ?? null,
        buyer_logon_id: params.buyer_logon_id ?? null,
        total_amount: params.total_amount ?? null,
        receipt_amount: params.receipt_amount ?? null,
      }),
    })
    .eq("id", record.id);

  if (updateError) {
    console.error("[payments-alipay-notify] update failed:", updateError.message);
    return new NextResponse("fail", { status: 500 });
  }

  return new NextResponse("success");
}
