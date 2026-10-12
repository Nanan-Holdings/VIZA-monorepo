import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPublicCataloguePayload, type PublicCataloguePayload } from "@/lib/admin/catalogue";
import { BoundedSingleFlightCache } from "@/lib/static-visa-metadata-cache";

export const dynamic = "force-dynamic";

const PUBLIC_CATALOGUE_CACHE_KEY = "published";
const PUBLIC_CATALOGUE_CACHE_TTL_MS = 60_000;

type PublicCatalogueEntry = PublicCataloguePayload & {
  version: number;
  publishedAt: string | null;
};

type PublishedCatalogueRow = {
  version: number;
  published_payload: unknown;
  published_at: string | null;
};

const publicCatalogueCache = new BoundedSingleFlightCache<PublicCatalogueEntry[]>(
  1,
  PUBLIC_CATALOGUE_CACHE_TTL_MS,
);

function toPublicCatalogueEntry(row: PublishedCatalogueRow): PublicCatalogueEntry {
  return {
    ...(row.published_payload as Record<string, unknown>),
    version: row.version,
    publishedAt: row.published_at,
  } as PublicCatalogueEntry;
}

async function loadPublishedCatalogue(): Promise<PublicCatalogueEntry[]> {
  const admin = createAdminClient({
    requestTimeoutMs: 4_000,
    retryDelaysMs: [],
  });
  const { data, error } = await admin
    .from("catalogue_publications")
    .select("version, published_payload, published_at")
    .eq("status", "published")
    .not("published_payload", "is", null)
    .order("published_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data as PublishedCatalogueRow[] | null ?? [])
    .filter((row) => isPublicCataloguePayload(row.published_payload))
    .map(toPublicCatalogueEntry);
}

async function getPublishedCatalogue(): Promise<PublicCatalogueEntry[]> {
  const result = await publicCatalogueCache.getOrCreate(
    PUBLIC_CATALOGUE_CACHE_KEY,
    loadPublishedCatalogue,
  );
  return result.value;
}

export async function GET() {
  try {
    const entries = await getPublishedCatalogue();
    return NextResponse.json(
      { ok: true, generatedAt: new Date().toISOString(), entries },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch {
    return NextResponse.json({ ok: false, error: "catalogue_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
