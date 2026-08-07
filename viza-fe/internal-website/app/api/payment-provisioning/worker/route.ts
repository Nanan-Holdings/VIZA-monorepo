import { NextResponse } from "next/server";
import { runPaymentProvisioningWorker } from "@/lib/checkout/payment-provisioning";
import { withAdmin } from "@/lib/auth/with-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const configured = process.env.PAYMENT_PROVISIONING_WORKER_TOKEN?.trim();
  const authorization = request.headers.get("authorization") ?? "";
  return Boolean(configured) && authorization === `Bearer ${configured}`;
}

/**
 * Internal scheduler/worker entry point. The payment webhook only needs to
 * persist the event and job; this endpoint can be invoked repeatedly by a
 * scheduler or restarted worker to reclaim expired leases.
 */
export async function POST(request: Request) {
  if (!process.env.PAYMENT_PROVISIONING_WORKER_TOKEN?.trim()) {
    return NextResponse.json({ error: "worker not configured" }, { status: 503 });
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { limit?: number };
    const limit = Math.max(1, Math.min(20, Number(body.limit ?? 5)));
    const result = await withAdmin(
      "system",
      "api/payment-provisioning/worker",
      (admin) => runPaymentProvisioningWorker(admin, limit),
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "[payment-provisioning-worker] failed",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ error: "worker failed" }, { status: 500 });
  }
}
