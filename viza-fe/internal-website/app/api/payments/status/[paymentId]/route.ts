import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PaymentStatus = "pending" | "paid" | "failed";

function normalizeStatus(status: string | null | undefined): PaymentStatus {
  if (status === "paid" || status === "succeeded" || status === "complete") return "paid";
  if (status === "failed" || status === "canceled" || status === "expired" || status === "cancelled") {
    return "failed";
  }
  return "pending";
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ paymentId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ status: "failed" }, { status: 401 });

  const { paymentId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(paymentId)) {
    return NextResponse.json({ status: "failed" }, { status: 400 });
  }

  const { data, error } = await createAdminClient()
    .from("payment_records")
    .select("status, paid_at")
    .eq("id", paymentId)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ status: "failed" }, { status: 404 });

  return NextResponse.json({
    status: normalizeStatus(data.status),
    paidAt: data.paid_at ?? null,
  });
}
