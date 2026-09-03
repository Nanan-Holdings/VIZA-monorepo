import { NextResponse } from "next/server";
import { runScheduledBlogGeneration } from "@/lib/marketing/automation";
import { authorizeMarketingCron } from "@/lib/marketing/cron-auth";

export const runtime = "nodejs";
export const preferredRegion = "iad1";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!authorizeMarketingCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await runScheduledBlogGeneration();
    return NextResponse.json({ ok: true, skipped: result.skipped, draftId: result.post?.id ?? null });
  } catch (error) {
    console.error("[marketing-cron] scheduled blog generation failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ ok: false, error: "Scheduled generation failed" }, { status: 500 });
  }
}
