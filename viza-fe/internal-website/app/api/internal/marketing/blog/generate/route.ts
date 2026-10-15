import { NextResponse } from "next/server";
import { runScheduledBlogGeneration } from "@/lib/marketing/automation";
import { authorizeMarketingCron } from "@/lib/marketing/cron-auth";

export const runtime = "nodejs";
export const preferredRegion = "iad1";
/* 800 s, not 300: from mid-October 2026 the scheduled run started dying at
   exactly 300 s ("Task timed out after 300 seconds") while the same code
   finished fine when run off-peak. The run is five sequential LLM calls and
   DeepSeek is slow at 01:00 UTC, which is 09:00 in Beijing. 800 s needs Fluid
   Compute on a Pro plan. The cron was also moved an hour
   earlier, into DeepSeek's off-peak window (see vercel.json). */
export const maxDuration = 800;
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
