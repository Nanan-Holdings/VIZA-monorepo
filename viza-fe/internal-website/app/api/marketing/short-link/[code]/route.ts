import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { asMarketingDb } from "@/lib/marketing/db";
import { countryCode, referrerHost, sessionHash, userAgentFamily } from "@/lib/marketing/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(code)) return NextResponse.json({ error: "Short link not found" }, { status: 404 });
  const db = asMarketingDb(createAdminClient());
  const lookup = await db.from("marketing_short_links").select("id, destination_url").eq("code", code).eq("active", true).maybeSingle();
  if (lookup.error || !lookup.data || typeof lookup.data !== "object" || Array.isArray(lookup.data)) {
    return NextResponse.json({ error: "Short link not found" }, { status: 404 });
  }
  const row = lookup.data as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.destination_url !== "string") return NextResponse.json({ error: "Short link not found" }, { status: 404 });
  let destination: URL;
  try { destination = new URL(row.destination_url); } catch { return NextResponse.json({ error: "Short link not found" }, { status: 404 }); }
  if (destination.protocol !== "https:") return NextResponse.json({ error: "Short link not found" }, { status: 404 });

  const recorded = await db.rpc("record_marketing_short_link_click", {
    p_short_link_id: row.id,
    p_referrer_host: referrerHost(request.headers.get("referer")),
    p_user_agent_family: userAgentFamily(request.headers.get("user-agent")),
    p_country_code: countryCode(request.headers.get("x-vercel-ip-country")),
    p_session_hash: sessionHash(request.headers.get("cookie"), process.env.VIZA_MARKETING_SESSION_HASH_SALT),
  });
  if (recorded.error) {
    console.error("[marketing-short-link] click record failed", recorded.error.message);
  }
  return NextResponse.json({ destinationUrl: destination.toString() }, {
    headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
  });
}
