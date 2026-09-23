import { NextResponse } from "next/server";
import { failStuckMarketingRuns } from "@/lib/marketing/automation";
import { authorizeMarketingCron } from "@/lib/marketing/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!authorizeMarketingCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json({ ok: true, ...(await failStuckMarketingRuns()) }); }
  catch (error) { console.error("[marketing-cron] stuck check failed", error instanceof Error ? error.message : "Unknown error"); return NextResponse.json({ ok: false, error: "Stuck check failed" }, { status: 500 }); }
}
