type GeocodeRequestItem = {
  key: string;
  query: string;
};

type GoogleGeocodeLocation = {
  lat: number;
  lng: number;
};

type GoogleGeocodeResult = {
  formatted_address?: string;
  place_id?: string;
  partial_match?: boolean;
  geometry?: {
    location?: GoogleGeocodeLocation;
    location_type?: string;
  };
};

type GoogleGeocodeResponse = {
  status?: string;
  error_message?: string;
  results?: GoogleGeocodeResult[];
};

type TravelGeocodeResult = {
  key: string;
  query: string;
  lat?: number;
  lng?: number;
  formattedAddress?: string;
  placeId?: string;
  locationType?: string;
  partialMatch?: boolean;
  status: string;
  error?: string;
};

const GOOGLE_GEOCODE_ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";
const geocodeCache = new Map<string, TravelGeocodeResult>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseRequestItems(payload: unknown): GeocodeRequestItem[] {
  if (!isRecord(payload) || !Array.isArray(payload.items)) return [];

  return payload.items
    .map((item) => {
      if (!isRecord(item)) return null;
      const key = typeof item.key === "string" ? item.key.trim() : "";
      const query = typeof item.query === "string" ? item.query.trim() : "";
      if (!key || !query) return null;
      return { key, query };
    })
    .filter((item): item is GeocodeRequestItem => Boolean(item))
    .slice(0, 40);
}

function normalizeCacheKey(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function isFiniteLocation(location: GoogleGeocodeLocation | undefined): location is GoogleGeocodeLocation {
  return Boolean(
    location &&
      Number.isFinite(location.lat) &&
      Number.isFinite(location.lng)
  );
}

async function geocodeItem(
  item: GeocodeRequestItem,
  apiKey: string
): Promise<TravelGeocodeResult> {
  const cacheKey = normalizeCacheKey(item.query);
  const cached = geocodeCache.get(cacheKey);
  if (cached) {
    return { ...cached, key: item.key, query: item.query };
  }

  const params = new URLSearchParams({
    address: item.query,
    key: apiKey,
    language: "zh-CN",
  });
  const response = await fetch(`${GOOGLE_GEOCODE_ENDPOINT}?${params.toString()}`, {
    cache: "force-cache",
    next: { revalidate: 60 * 60 * 24 * 14 },
  });

  if (!response.ok) {
    return {
      key: item.key,
      query: item.query,
      status: "HTTP_ERROR",
      error: `Google Geocoding API returned HTTP ${response.status}`,
    };
  }

  const payload = (await response.json()) as GoogleGeocodeResponse;
  const status = payload.status ?? "UNKNOWN";
  const firstResult = payload.results?.[0];
  const location = firstResult?.geometry?.location;

  if (status !== "OK" || !isFiniteLocation(location)) {
    const result = {
      key: item.key,
      query: item.query,
      status,
      error: payload.error_message || "No geocoding result returned.",
    };
    geocodeCache.set(cacheKey, result);
    return result;
  }

  const result: TravelGeocodeResult = {
    key: item.key,
    query: item.query,
    lat: location.lat,
    lng: location.lng,
    formattedAddress: firstResult?.formatted_address,
    placeId: firstResult?.place_id,
    locationType: firstResult?.geometry?.location_type,
    partialMatch: firstResult?.partial_match,
    status,
  };
  geocodeCache.set(cacheKey, result);
  return result;
}

export async function POST(request: Request) {
  try {
    const apiKey =
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
      "";

    if (!apiKey) {
      return Response.json(
        { error: "Missing GOOGLE_MAPS_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY." },
        { status: 500 }
      );
    }

    const payload = await request.json();
    const items = parseRequestItems(payload);
    if (items.length === 0) {
      return Response.json({ results: [] }, { status: 200 });
    }

    const results = await Promise.all(
      items.map((item) => geocodeItem(item, apiKey))
    );

    return Response.json({ results }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to resolve travel coordinates.";
    return Response.json({ error: message }, { status: 500 });
  }
}
