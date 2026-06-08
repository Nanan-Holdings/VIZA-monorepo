import {
  filterAndSortGooglePlaces,
  normalizeGooglePlaceToCard,
  type GooglePlace,
  type SupportedGoogleAttractionType,
} from "@/lib/travel/google-places";
import {
  GOOGLE_PLACES_BASE_URL,
  GOOGLE_PLACES_MISSING_KEY_MESSAGE,
  GooglePlacesApiError,
  getGooglePlacesApiKey,
  normalizePlacesLanguage,
  parseAttractionTypes,
  parseBoundedInteger,
  parseFiniteNumber,
  parseGoogleError,
  runInFlightDeduped,
} from "../_google-places-api";

export const dynamic = "force-dynamic";

const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.primaryType",
  "places.types",
  "places.rating",
  "places.userRatingCount",
  "places.photos",
  "places.googleMapsUri",
  "places.businessStatus",
].join(",");

type GoogleTextSearchResponse = {
  places?: GooglePlace[];
};

type SearchPlan = {
  textQuery: string;
  includedType?: SupportedGoogleAttractionType;
};

function formatTypeForQuery(type: SupportedGoogleAttractionType): string {
  return type.replace(/_/g, " ");
}

function createSearchPlans(
  city: string,
  types: SupportedGoogleAttractionType[]
): SearchPlan[] {
  const broadPlan = { textQuery: `top tourist attractions in ${city}` };
  if (types.length === 0) return [broadPlan];

  return [
    ...types.slice(0, 4).map((type) => ({
      textQuery: `top ${formatTypeForQuery(type)} in ${city}`,
      includedType: type,
    })),
    broadPlan,
  ];
}

function isValidLatitude(value: number): boolean {
  return value >= -90 && value <= 90;
}

function isValidLongitude(value: number): boolean {
  return value >= -180 && value <= 180;
}

function buildSearchBody(options: {
  plan: SearchPlan;
  lang: string;
  limit: number;
  lat: number | null;
  lng: number | null;
  radius: number;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    textQuery: options.plan.textQuery,
    languageCode: options.lang,
    pageSize: Math.min(20, Math.max(12, options.limit)),
  };

  if (options.plan.includedType) {
    body.includedType = options.plan.includedType;
  }

  if (options.lat !== null && options.lng !== null) {
    body.locationBias = {
      circle: {
        center: {
          latitude: options.lat,
          longitude: options.lng,
        },
        radius: options.radius,
      },
    };
  }

  return body;
}

async function requestTextSearch(
  body: Record<string, unknown>,
  apiKey: string
): Promise<GooglePlace[]> {
  const dedupeKey = `places-search:${SEARCH_FIELD_MASK}:${JSON.stringify(body)}`;

  return runInFlightDeduped(dedupeKey, async () => {
    const response = await fetch(`${GOOGLE_PLACES_BASE_URL}/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": SEARCH_FIELD_MASK,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!response.ok) {
      throw await parseGoogleError(response);
    }

    const payload = (await response.json()) as GoogleTextSearchResponse;
    return Array.isArray(payload.places) ? payload.places : [];
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const city = url.searchParams.get("city")?.trim() ?? "";
  const lang = normalizePlacesLanguage(url.searchParams.get("lang"));
  const limit = parseBoundedInteger(url.searchParams.get("limit"), {
    defaultValue: 12,
    min: 1,
    max: 24,
  });
  const radius = parseBoundedInteger(url.searchParams.get("radius"), {
    defaultValue: 10000,
    min: 1,
    max: 50000,
  });
  const { types, invalidTypes } = parseAttractionTypes(
    url.searchParams.get("types")
  );
  const lat = parseFiniteNumber(url.searchParams.get("lat"));
  const lng = parseFiniteNumber(url.searchParams.get("lng"));
  const hasLocationParam =
    url.searchParams.has("lat") || url.searchParams.has("lng");

  if (!city) {
    return Response.json({ error: "city is required." }, { status: 400 });
  }

  if (invalidTypes.length > 0) {
    return Response.json(
      { error: "Unsupported place type.", invalidTypes },
      { status: 400 }
    );
  }

  if (
    hasLocationParam &&
    (lat === null ||
      lng === null ||
      !isValidLatitude(lat) ||
      !isValidLongitude(lng))
  ) {
    return Response.json(
      { error: "lat and lng must be valid coordinates when provided." },
      { status: 400 }
    );
  }

  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) {
    return Response.json({ error: GOOGLE_PLACES_MISSING_KEY_MESSAGE }, { status: 500 });
  }

  try {
    const candidates: GooglePlace[] = [];
    const plans = createSearchPlans(city, types);

    for (const plan of plans) {
      const body = buildSearchBody({
        plan,
        lang,
        limit,
        lat,
        lng,
        radius,
      });
      candidates.push(...(await requestTextSearch(body, apiKey)));

      if (filterAndSortGooglePlaces(candidates, limit, types).length >= limit) {
        break;
      }
    }

    const cards = filterAndSortGooglePlaces(candidates, limit, types).map(
      normalizeGooglePlaceToCard
    );

    return Response.json(
      {
        cards,
        source: "google",
        city,
        count: cards.length,
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof GooglePlacesApiError
        ? "Google Places search failed. Please try again later."
        : "Travel places search is unavailable.";
    return Response.json({ error: message }, { status: 502 });
  }
}
