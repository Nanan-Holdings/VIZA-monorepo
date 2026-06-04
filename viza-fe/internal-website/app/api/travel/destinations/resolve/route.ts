import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildTravelCandidatePayload,
  generateLazyDestinationCards,
  normalizeDestinationText,
  parseDatabaseDestination,
  resolveLocalDestinationText,
  searchLocalDestinations,
  type DestinationResolution,
  type TravelDestinationSearchResult,
} from "@/lib/travel/destination-resolver";

type ResolveRequestBody = {
  rawText?: string;
  destinationText?: string;
  context?: unknown;
};

type DestinationRow = Parameters<typeof parseDatabaseDestination>[0];

const DESTINATION_SELECT =
  "id, canonical_name, display_name, normalized_name, country_code, country_name, region, city, place_type, latitude, longitude, popularity_score, source, confidence_score, is_verified, is_featured, show_on_home";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseBody(value: unknown): ResolveRequestBody {
  if (!isRecord(value)) return {};
  return {
    rawText:
      typeof value.rawText === "string"
        ? value.rawText
        : typeof value.destinationText === "string"
          ? value.destinationText
          : undefined,
    destinationText:
      typeof value.destinationText === "string" ? value.destinationText : undefined,
    context: value.context,
  };
}

function resolutionWithDatabaseDestination(
  query: string,
  destination: TravelDestinationSearchResult
): DestinationResolution {
  return {
    status: "resolved",
    query,
    destinations: [destination],
    confidenceScore: destination.confidenceScore,
    tripHints: resolveLocalDestinationText(query).tripHints,
    cards: generateLazyDestinationCards(destination, { source: "database" }),
  };
}

async function resolveFromDatabase(
  query: string
): Promise<TravelDestinationSearchResult | null> {
  const normalizedQuery = normalizeDestinationText(query);
  if (normalizedQuery.length < 2) return null;

  const admin = createAdminClient();
  const { data: exactRows, error: exactError } = await admin
    .from("travel_destinations")
    .select(DESTINATION_SELECT)
    .eq("is_active", true)
    .eq("is_searchable", true)
    .or(
      [
        `normalized_name.eq.${normalizedQuery}`,
        `canonical_name.ilike.${query}`,
        `display_name.ilike.${query}`,
      ].join(",")
    )
    .order("popularity_score", { ascending: false })
    .limit(3);

  if (exactError) throw new Error(exactError.message);
  const exactDestinations = ((exactRows ?? []) as DestinationRow[]).map(
    parseDatabaseDestination
  );
  if (exactDestinations.length > 0) return exactDestinations[0];

  const { data: aliasRows, error: aliasError } = await admin
    .from("travel_destination_aliases")
    .select("destination_id")
    .eq("normalized_alias", normalizedQuery)
    .limit(3);

  if (aliasError) throw new Error(aliasError.message);
  const destinationIds = Array.from(
    new Set(
      ((aliasRows ?? []) as Array<{ destination_id: string }>).map(
        (row) => row.destination_id
      )
    )
  );
  if (destinationIds.length === 0) return null;

  const { data: destinationRows, error: destinationError } = await admin
    .from("travel_destinations")
    .select(DESTINATION_SELECT)
    .in("id", destinationIds)
    .eq("is_active", true)
    .eq("is_searchable", true)
    .order("popularity_score", { ascending: false })
    .limit(3);

  if (destinationError) throw new Error(destinationError.message);
  return (
    ((destinationRows ?? []) as DestinationRow[])
      .map(parseDatabaseDestination)
      .sort((left, right) => right.popularityScore - left.popularityScore)[0] ??
    null
  );
}

async function persistTemporaryDestination(
  query: string,
  fallback: TravelDestinationSearchResult
): Promise<TravelDestinationSearchResult> {
  const admin = createAdminClient();
  const normalizedName = normalizeDestinationText(fallback.displayName);

  const { data: existingRows, error: existingError } = await admin
    .from("travel_destinations")
    .select(DESTINATION_SELECT)
    .eq("normalized_name", normalizedName)
    .limit(1);

  if (existingError) throw new Error(existingError.message);
  const existing = ((existingRows ?? []) as DestinationRow[])[0];
  if (existing) return parseDatabaseDestination(existing);

  const { data: inserted, error: insertError } = await admin
    .from("travel_destinations")
    .insert({
      canonical_name: fallback.canonicalName,
      display_name: fallback.displayName,
      normalized_name: normalizedName,
      country_code: fallback.countryCode,
      country_name: fallback.countryName,
      region: fallback.region,
      city: fallback.city,
      place_type: fallback.placeType ?? "city",
      latitude: fallback.latitude,
      longitude: fallback.longitude,
      popularity_score: 0,
      source: "temporary_resolver",
      confidence_score: fallback.confidenceScore,
      is_verified: false,
      is_active: true,
      is_searchable: true,
      show_on_home: false,
      is_featured: false,
    })
    .select(DESTINATION_SELECT)
    .single();

  if (insertError) throw new Error(insertError.message);

  await admin.from("travel_unresolved_destinations").insert({
    user_input: query,
    resolved_name: fallback.displayName,
    llm_guess_json: {
      destination: fallback.displayName,
      source: "temporary_resolver",
      candidate_payload: buildTravelCandidatePayload([fallback], query),
    },
    confidence_score: fallback.confidenceScore,
    status: "temporary_created",
  });

  return parseDatabaseDestination(inserted as DestinationRow);
}

export async function POST(request: Request) {
  try {
    const body = parseBody(await request.json().catch(() => ({})));
    const rawText = (body.rawText ?? body.destinationText ?? "").trim();
    if (!rawText) {
      return Response.json(
        { error: "rawText or destinationText is required." },
        { status: 400 }
      );
    }

    const localResolution = resolveLocalDestinationText(rawText);
    if (localResolution.status === "ambiguous") {
      return Response.json(localResolution, { status: 200 });
    }

    try {
      const databaseDestination = await resolveFromDatabase(rawText);
      if (databaseDestination) {
        return Response.json(
          resolutionWithDatabaseDestination(rawText, databaseDestination),
          { status: 200 }
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Database resolve failed.";
      console.warn("Travel destination database resolve unavailable:", message);
    }

    if (localResolution.status === "resolved") {
      return Response.json(localResolution, { status: 200 });
    }

    if (localResolution.status === "temporary") {
      try {
        const persisted = await persistTemporaryDestination(
          rawText,
          localResolution.destination
        );
        return Response.json(
          {
            status: "temporary",
            query: rawText,
            destination: persisted,
            confidenceScore: persisted.confidenceScore,
            tripHints: localResolution.tripHints,
            cards: generateLazyDestinationCards(persisted, {
              source: "temporary_resolver",
            }),
          },
          { status: 200 }
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Temporary destination persistence failed.";
        console.warn("Travel temporary destination using in-memory fallback:", message);
        return Response.json(localResolution, { status: 200 });
      }
    }

    const fallback = searchLocalDestinations(rawText, { limit: 1 })[0];
    if (fallback) {
      return Response.json(
        resolutionWithDatabaseDestination(rawText, fallback),
        { status: 200 }
      );
    }

    return Response.json(localResolution, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to resolve travel destination.";
    return Response.json({ error: message }, { status: 500 });
  }
}
