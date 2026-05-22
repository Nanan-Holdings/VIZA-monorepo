import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth/with-admin";

export const dynamic = "force-dynamic";

/**
 * Polling endpoint for the WeChat Pay QR page. The order UUID acts as
 * a capability — no auth, but the id is opaque and only known to the
 * browser session that started checkout.
 *
 * Response: { status: "pending" | "paid" | "failed", paidAt: string | null }
 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return NextResponse.json({ status: "failed" }, { status: 400 });
  }
  const result = await withAdmin(
    "system",
    "api/wechat-pay/status:get",
    async (admin) => {
      const { data, error } = await admin
        .from("order")
        .select("status, paid_at")
        .eq("id", orderId)
        .maybeSingle();
      if (error || !data) return null;
      return data as { status: string; paid_at: string | null };
    },
  );
  if (!result) {
    return NextResponse.json({ status: "failed" }, { status: 404 });
  }
  const isPaid =
    result.status === "paid" ||
    result.status === "submitted" ||
    result.status === "completed";
  return NextResponse.json({
    status: isPaid ? "paid" : "pending",
    paidAt: result.paid_at,
  });
}
