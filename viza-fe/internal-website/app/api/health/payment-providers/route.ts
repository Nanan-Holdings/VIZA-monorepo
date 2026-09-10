import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { getPaymentProviderConfigReport } from "@/lib/payments/validate-provider-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseInit = {
  headers: { "Cache-Control": "private, no-store" },
} as const;

export async function GET() {
  try {
    await requireRole("admin", "staff");
  } catch {
    return NextResponse.json({ error: "Authentication required" }, { ...responseInit, status: 401 });
  }

  const report = getPaymentProviderConfigReport();
  const status = process.env.NODE_ENV === "production" && !report.ready ? 503 : 200;
  return NextResponse.json(report, { ...responseInit, status });
}
