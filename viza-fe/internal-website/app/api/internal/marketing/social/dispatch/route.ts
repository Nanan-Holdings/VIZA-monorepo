import { NextResponse } from "next/server";
import { dispatchDueSocialCompositions } from "@/lib/marketing/automation";
import { authorizeMarketingCron } from "@/lib/marketing/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/* A YouTube upload downloads and re-uploads the short inside the request. */
export const maxDuration = 300;

/* Called every five minutes by Supabase pg_cron (job viza-social-dispatch),
   with CRON_SECRET read from Supabase Vault. */
export async function GET(request: Request) {
  if (!authorizeMarketingCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json({ ok: true, ...(await dispatchDueSocialCompositions()) }); }
  catch (error) { console.error("[marketing-cron] social dispatch failed", error instanceof Error ? error.message : "Unknown error"); return NextResponse.json({ ok: false, error: "Social dispatch failed" }, { status: 500 }); }
}
