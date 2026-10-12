import { NextResponse } from "next/server";
import { runPaymentProvisioningAlertSweep } from "@/lib/checkout/payment-provisioning-alerts";
import { runPaymentProvisioningWorker } from "@/lib/checkout/payment-provisioning";
import { withAdmin } from "@/lib/auth/with-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const configured = process.env.PAYMENT_PROVISIONING_WORKER_TOKEN?.trim();
  const authorization = request.headers.get("authorization") ?? "";
  return Boolean(configured) && authorization === `Bearer ${configured}`;
}

function isCronAuthorized(request: Request): boolean {
  const configured = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization") ?? "";
  return Boolean(configured) && authorization === `Bearer ${configured}`;
}

async function runWorker(limit: number) {
  try {
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

async function runCronSweep() {
  try {
    const result = await withAdmin(
      "system",
      "api/payment-provisioning/worker",
      async (admin) => {
        const worker = await runPaymentProvisioningWorker(admin, 20);
        const alerts = await runPaymentProvisioningAlertSweep(admin);
        return { ...worker, alerts };
      },
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "[payment-provisioning-worker] cron sweep failed",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ error: "worker failed" }, { status: 500 });
  }
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

  const body = (await request.json().catch(() => ({}))) as { limit?: number };
  const parsedLimit = Number(body.limit ?? 5);
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(20, Math.floor(parsedLimit)))
    : 5;
  return runWorker(limit);
}

/**
 * Vercel Cron retry sweep. Vercel supplies CRON_SECRET as an Authorization
 * bearer token; keep this separate from the compatible manual POST token.
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json({ error: "cron not configured" }, { status: 503 });
  }
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return runCronSweep();
}
