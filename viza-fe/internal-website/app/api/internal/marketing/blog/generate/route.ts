import { NextResponse } from "next/server";
import { runScheduledBlogGeneration } from "@/lib/marketing/automation";
import { authorizeMarketingCron } from "@/lib/marketing/cron-auth";

export const runtime = "nodejs";
export const preferredRegion = "iad1";
/* Stays at 300 s: this project's Vercel plan rejects anything longer (a deploy
   with 800 failed on 2026-10-15). The run started dying at exactly 300 s from
   mid-October because DeepSeek is slow at 01:00 UTC (09:00 in Beijing), so the
   cron now runs at 00:00 UTC, inside DeepSeek's off-peak window (vercel.json).
   Off-peak the whole run finishes in about two minutes. */
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
