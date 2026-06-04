import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeDestinationText,
  parseDatabaseDestination,
  searchLocalDestinations,
  type TravelDestinationSearchResult,
} from "@/lib/travel/destination-resolver";

type DestinationRow = Parameters<typeof parseDatabaseDestination>[0];
type AliasRow = {
  destination_id: string;
};

const DESTINATION_SELECT =
  "id, canonical_name, display_name, normalized_name, country_code, country_name, region, city, place_type, latitude, longitude, popularity_score, source, confidence_score, is_verified, is_featured, show_on_home";

function parseLimit(value: string | null): number {
  if (!value) return 10;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 10;
  return Math.min(Math.max(parsed, 1), 20);
}

function mergeResults(
  databaseResults: TravelDestinationSearchResult[],
  fallbackResults: TravelDestinationSearchResult[],
  limit: number
): TravelDestinationSearchResult[] {
  const byId = new Map<string, TravelDestinationSearchResult>();
  [...databaseResults, ...fallbackResults].forEach((result) => {
    byId.set(result.id, result);
  });

  return Array.from(byId.values())
    .sort((left, right) => right.popularityScore - left.popularityScore)
    .slice(0, limit);
}

async function searchDatabase(
  query: string,
  options: { limit: number; featuredOnly: boolean }
): Promise<TravelDestinationSearchResult[]> {
  const admin = createAdminClient();
  const normalizedQuery = normalizeDestinationText(query);
  const escapedQuery = query.replace(/[%_]/g, "\\$&");
  const escapedNormalized = normalizedQuery.replace(/[%_]/g, "\\$&");

  let destinationQuery = admin
    .from("travel_destinations")
    .select(DESTINATION_SELECT)
    .eq("is_active", true)
    .eq("is_searchable", true)
    .order("popularity_score", { ascending: false })
    .limit(options.limit);

  if (options.featuredOnly && !normalizedQuery) {
    destinationQuery = destinationQuery.or("show_on_home.eq.true,is_featured.eq.true");
  } else {
    destinationQuery = destinationQuery.or(
      [
        `canonical_name.ilike.%${escapedQuery}%`,
        `display_name.ilike.%${escapedQuery}%`,
        `normalized_name.ilike.%${escapedNormalized}%`,
        `country_name.ilike.%${escapedQuery}%`,
        `city.ilike.%${escapedQuery}%`,
      ].join(",")
    );
  }

  const { data: directRows, error: directError } = await destinationQuery;
  if (directError) {
    throw new Error(directError.message);
  }

  const directResults = ((directRows ?? []) as DestinationRow[]).map(
    parseDatabaseDestination
  );

  if (options.featuredOnly || normalizedQuery.length < 2) {
    return directResults;
  }

  const { data: aliasRows, error: aliasError } = await admin
    .from("travel_destination_aliases")
    .select("destination_id")
    .ilike("normalized_alias", `%${escapedNormalized}%`)
    .limit(options.limit);

  if (aliasError) {
    throw new Error(aliasError.message);
  }

  const aliasDestinationIds = Array.from(
    new Set(((aliasRows ?? []) as AliasRow[]).map((row) => row.destination_id))
  );
  if (aliasDestinationIds.length === 0) {
    return directResults;
  }

  const { data: aliasDestinationRows, error: aliasDestinationError } =
    await admin
      .from("travel_destinations")
      .select(DESTINATION_SELECT)
      .in("id", aliasDestinationIds)
      .eq("is_active", true)
      .eq("is_searchable", true)
      .order("popularity_score", { ascending: false })
      .limit(options.limit);

  if (aliasDestinationError) {
    throw new Error(aliasDestinationError.message);
  }

  return mergeResults(
    directResults,
    ((aliasDestinationRows ?? []) as DestinationRow[]).map(
      parseDatabaseDestination
    ),
    options.limit
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const featuredOnly = url.searchParams.get("featured") === "true";
  const limit = parseLimit(url.searchParams.get("limit"));

  if (!featuredOnly && normalizeDestinationText(query).length < 2) {
    return Response.json(
      {
        error:
          "Destination search requires q with at least 2 characters, unless featured=true is used.",
      },
      { status: 400 }
    );
  }

  const fallbackResults = searchLocalDestinations(query, {
    limit,
    featuredOnly,
  });

  try {
    const databaseResults = await searchDatabase(query, {
      limit,
      featuredOnly,
    });
    return Response.json(
      {
        results: mergeResults(databaseResults, fallbackResults, limit),
        source: databaseResults.length > 0 ? "database" : "fallback",
        limit,
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Destination search failed.";
    console.warn("Travel destination search using fallback:", message);
    return Response.json(
      {
        results: fallbackResults,
        source: "fallback",
        warning: "Database search unavailable; returned curated fallback results.",
        limit,
      },
      { status: 200 }
    );
  }
}
