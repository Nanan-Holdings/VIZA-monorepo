import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPublicCataloguePayload } from "@/lib/admin/catalogue";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("catalogue_publications")
    .select("version, published_payload, published_at")
    .eq("status", "published")
    .not("published_payload", "is", null)
    .order("published_at", { ascending: false });
  if (error) {
    return NextResponse.json({ ok: false, error: "catalogue_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const entries = (data ?? [])
    .filter((row) => isPublicCataloguePayload(row.published_payload))
    .map((row) => ({ ...row.published_payload, version: row.version, publishedAt: row.published_at }));
  return NextResponse.json(
    { ok: true, generatedAt: new Date().toISOString(), entries },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
