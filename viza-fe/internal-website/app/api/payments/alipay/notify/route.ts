import { NextResponse } from "next/server";
import { AlipayConfigError, getAlipayAppId, verifyAlipayNotify } from "@/lib/alipay/client";
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

function fenFromAlipayAmount(value: string | undefined): number | null {
  if (!value || !/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  return Math.round(Number(value) * 100);
}

function statusFromTradeStatus(tradeStatus: string | undefined, currentStatus: string | null): string {
  if (currentStatus === "paid" && tradeStatus !== "TRADE_CLOSED") return "paid";
  if (tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED") return "paid";
  if (tradeStatus === "TRADE_CLOSED") return currentStatus === "paid" ? "paid" : "cancelled";
  return currentStatus ?? "pending";
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const params: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") params[key] = value;
  }

  let expectedAppId: string;
  try {
    if (!verifyAlipayNotify(params)) {
      return new NextResponse("fail", { status: 401 });
    }
    expectedAppId = getAlipayAppId();
  } catch (error) {
    if (error instanceof AlipayConfigError) {
      console.error("[payments-alipay-notify] Alipay is not configured:", error.message);
      return new NextResponse("fail", { status: 503 });
    }
    throw error;
  }

  if (params.app_id !== expectedAppId) {
    return new NextResponse("fail", { status: 400 });
  }

  const outTradeNo = params.out_trade_no;
  if (!outTradeNo) return new NextResponse("fail", { status: 400 });

  const notifyAmountFen = fenFromAlipayAmount(params.total_amount);
  if (notifyAmountFen === null) return new NextResponse("fail", { status: 400 });

  const admin = createAdminClient();
  const { data: record, error } = await admin
    .from("payment_records")
    .select("id, amount_cents, currency, status, paid_at, metadata")
    .eq("provider", "alipay")
    .eq("provider_session_id", outTradeNo)
    .maybeSingle();

  if (error) {
    console.error("[payments-alipay-notify] lookup failed:", error.message);
    return new NextResponse("fail", { status: 500 });
  }

  if (!record) return new NextResponse("success");
  if (record.currency !== "CNY" || record.amount_cents !== notifyAmountFen) {
    console.error("[payments-alipay-notify] amount mismatch:", {
      paymentRecordId: record.id,
      expected: record.amount_cents,
      received: notifyAmountFen,
    });
    return new NextResponse("fail", { status: 400 });
  }

  const nextStatus = statusFromTradeStatus(params.trade_status, record.status ?? null);
  const paid = nextStatus === "paid";
  const now = new Date().toISOString();

  const { error: updateError } = await admin
    .from("payment_records")
    .update({
      provider_payment_id: params.trade_no ?? null,
      status: nextStatus,
      paid_at: paid ? record.paid_at ?? now : record.paid_at ?? null,
      cancelled_at: nextStatus === "cancelled" ? now : null,
      updated_at: now,
      metadata: mergeMetadata(record.metadata, {
        out_trade_no: outTradeNo,
        trade_no: params.trade_no ?? null,
        trade_status: params.trade_status ?? null,
        app_id: params.app_id ?? null,
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
