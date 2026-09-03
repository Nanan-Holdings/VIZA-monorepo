import { NextResponse } from "next/server";
import { runSocialReconciliation } from "@/lib/marketing/automation";
import { authorizeMarketingCron } from "@/lib/marketing/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!authorizeMarketingCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json({ ok: true, ...(await runSocialReconciliation()) }); }
  catch (error) { console.error("[marketing-cron] social reconciliation failed", error instanceof Error ? error.message : "Unknown error"); return NextResponse.json({ ok: false, error: "Social reconciliation failed" }, { status: 500 }); }
}
