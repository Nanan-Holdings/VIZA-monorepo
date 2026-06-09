import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import {
  findDropdownDestinationContract,
  normalizeDestinationSearchText,
} from "./destination-contracts";
import {
  TRAVEL_PLACE_FALLBACK_IMAGE,
  filterAndSortGooglePlaces,
  normalizeGooglePlaceToCard,
  type GooglePlace,
  type TravelPlaceAttribution,
} from "./google-places";

const GOOGLE_PLACES_BASE_URL = "https://places.googleapis.com/v1";

const CITY_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.primaryType",
  "places.types",
  "places.photos",
  "places.googleMapsUri",
].join(",");

const DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "editorialSummary",
  "photos",
  "googleMapsUri",
  "primaryType",
  "types",
  "businessStatus",
].join(",");

export type TravelGooglePhoto = {
  url: string;
  provider: "google_places" | "placeholder";
  attribution?: string | null;
  width?: number | null;
  height?: number | null;
  confidence: number;
  isPlaceholder: boolean;
};

export type TravelGoogleAttraction = {
  nameZh: string;
  nameEn: string;
  latitude: number | null;
  longitude: number | null;
  descriptionZh: string;
  descriptionEn: string;
  photo: TravelGooglePhoto;
  source: "google_places";
  googleMapsUri?: string | null;
  placeId?: string | null;
  category?: string | null;
};

export type TravelGoogleEnrichedDestination = {
  id: string;
  canonicalName: string;
  nameZh: string;
  nameEn: string;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  source: "google_places";
  dataQuality: "api_enriched";
  descriptionZh: string;
  descriptionEn: string;
  descriptionSource:
    | "google_places"
    | "llm_from_google_facts"
    | "local_curated"
    | "fallback_generic";
  coverImage: TravelGooglePhoto;
  attractions: TravelGoogleAttraction[];
  cache: {
    attempted: boolean;
    stored: boolean;
    skippedReason?: string;
  };
};

type GoogleTextSearchResponse = {
  places?: GooglePlace[];
};

type GooglePlaceDetails = GooglePlace & {
  editorialSummary?: {
    text?: string;
    languageCode?: string;
  };
};

export type GooglePlacesEnrichmentInput = {
  city: string;
  country?: string | null;
  locale?: string | null;
  debugId?: string;
};

type EnrichmentFetch = typeof fetch;

function isExplicitlyDisabled(value: string | undefined): boolean {
  return /^(0|false|off|no)$/i.test(value?.trim() ?? "");
}

export function isGooglePlacesFallbackEnabled(): boolean {
  return (
    !isExplicitlyDisabled(process.env.TRAVEL_GOOGLE_FALLBACK_ENABLED) &&
    !isExplicitlyDisabled(process.env.GOOGLE_PLACES_API_ENABLED)
  );
}

export function getServerGooglePlacesApiKey(): string {
  return process.env.GOOGLE_MAPS_API_KEY?.trim() ?? "";
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function languageForLocale(locale: string | null | undefined): string {
  if (!locale) return "zh-CN";
  return locale.toLowerCase().startsWith("en") ? "en" : "zh-CN";
}

function compactSearchText(value: string): string {
  return normalizeDestinationSearchText(value).replace(/\s+/g, "");
}

function includesDestinationName(place: GooglePlace, city: string): boolean {
  const expected = compactSearchText(city);
  if (!expected) return true;
  const haystack = compactSearchText(
    [
      place.displayName?.text,
      place.formattedAddress,
      ...(place.types ?? []),
    ]
      .filter(Boolean)
      .join(" ")
  );
  return haystack.includes(expected) || expected.includes(haystack);
}

function photoAttributionText(
  attributions: TravelPlaceAttribution[] | undefined
): string | null {
  if (!attributions?.length) return null;
  return attributions
    .map((item) => item.displayName ?? item.uri ?? item.photoUri)
    .filter((item): item is string => Boolean(item?.trim()))
    .join(", ");
}

function photoFromPlace(place: GooglePlace): TravelGooglePhoto {
  const card = normalizeGooglePlaceToCard(place);
  const photo = place.photos?.find((item) => cleanString(item.name));
  if (!card.photoName || !photo) {
    return {
      url: TRAVEL_PLACE_FALLBACK_IMAGE,
      provider: "placeholder",
      confidence: 0,
      isPlaceholder: true,
    };
  }

  return {
    url: card.imageUrl,
    provider: "google_places",
    attribution: photoAttributionText(card.attribution),
    width: toFiniteNumber(photo.widthPx),
    height: toFiniteNumber(photo.heightPx),
    confidence: 0.9,
    isPlaceholder: false,
  };
}

function displayName(place: GooglePlace, fallback: string): string {
  return cleanString(place.displayName?.text) ?? fallback;
}

function descriptionFromFacts(options: {
  cityZh: string;
  cityEn: string;
  country?: string | null;
  attractionNames: string[];
  editorialSummary?: string | null;
  locale: string;
}): { zh: string; en: string; source: TravelGoogleEnrichedDestination["descriptionSource"] } {
  if (options.editorialSummary) {
    return {
      zh: options.editorialSummary,
      en: options.editorialSummary,
      source: "google_places",
    };
  }

  const attractionTextZh = options.attractionNames.slice(0, 4).join("、");
  const attractionTextEn = options.attractionNames.slice(0, 4).join(", ");
  const countryText = options.country ? `${options.country} ` : "";

  return {
    zh: `${options.cityZh}是${countryText}的城市目的地。可围绕${attractionTextZh || "城市核心景点、美食街区和文化地标"}安排行程；具体开放时间和门票请以官方来源为准。`,
    en: `${options.cityEn} is a city destination${options.country ? ` in ${options.country}` : ""}. Plan around ${attractionTextEn || "central sights, food districts, and cultural landmarks"}; verify opening hours and ticket details with official sources before visiting.`,
    source: "fallback_generic",
  };
}

async function requestPlacesTextSearch(options: {
  query: string;
  apiKey: string;
  fetchImpl: EnrichmentFetch;
  languageCode: string;
  fieldMask: string;
  pageSize: number;
  lat?: number | null;
  lng?: number | null;
}): Promise<GooglePlace[]> {
  const body: Record<string, unknown> = {
    textQuery: options.query,
    languageCode: options.languageCode,
    pageSize: options.pageSize,
  };

  if (options.lat !== null && options.lng !== null) {
    body.locationBias = {
      circle: {
        center: {
          latitude: options.lat,
          longitude: options.lng,
        },
        radius: 20000,
      },
    };
  }

  const response = await options.fetchImpl(
    `${GOOGLE_PLACES_BASE_URL}/places:searchText`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": options.apiKey,
        "X-Goog-FieldMask": options.fieldMask,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`Google Places Text Search failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as GoogleTextSearchResponse;
  return Array.isArray(payload.places) ? payload.places : [];
}

async function requestPlaceDetails(options: {
  placeId: string;
  apiKey: string;
  fetchImpl: EnrichmentFetch;
  languageCode: string;
}): Promise<GooglePlaceDetails | null> {
  const requestUrl = new URL(
    `${GOOGLE_PLACES_BASE_URL}/places/${encodeURIComponent(options.placeId)}`
  );
  requestUrl.searchParams.set("languageCode", options.languageCode);

  const response = await options.fetchImpl(requestUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": options.apiKey,
      "X-Goog-FieldMask": DETAILS_FIELD_MASK,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google Places Details failed with HTTP ${response.status}.`);
  }

  return (await response.json()) as GooglePlaceDetails;
}

function normalizeAttraction(place: GooglePlace, fallbackCity: string): TravelGoogleAttraction {
  const card = normalizeGooglePlaceToCard(place);
  const name = displayName(place, card.title);
  const latitude = toFiniteNumber(place.location?.latitude);
  const longitude = toFiniteNumber(place.location?.longitude);
  const category = cleanString(place.primaryType);
  const typeText = category?.replace(/_/g, " ") ?? "tourist attraction";

  return {
    nameZh: name,
    nameEn: name,
    latitude,
    longitude,
    descriptionZh: `${name}是${fallbackCity}的${typeText}。开放时间、门票和预约要求请以官方来源为准。`,
    descriptionEn: `${name} is a ${typeText} in ${fallbackCity}. Check official sources for hours, tickets, and reservations.`,
    photo: photoFromPlace(place),
    source: "google_places",
    googleMapsUri: cleanString(place.googleMapsUri),
    placeId: cleanString(place.id),
    category,
  };
}

function isMissingDatabaseShapeError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  const message =
    typeof record.message === "string" ? record.message.toLowerCase() : "";
  const code = typeof record.code === "string" ? record.code : "";
  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST205" ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("column")
  );
}

async function cacheGoogleEnrichmentResult(
  destination: Omit<TravelGoogleEnrichedDestination, "cache">
): Promise<TravelGoogleEnrichedDestination["cache"]> {
  try {
    const admin = createAdminClient();
    const normalizedName = normalizeDestinationSearchText(destination.canonicalName);
    const now = new Date().toISOString();
    const { data: destinationRow, error: destinationError } = await admin
      .from("travel_destinations")
      .upsert(
        {
          canonical_name: destination.canonicalName,
          display_name: destination.nameEn,
          normalized_name: normalizedName,
          name_en: destination.nameEn,
          name_zh: destination.nameZh,
          aliases_json: [destination.nameEn, destination.nameZh],
          country_code: destination.countryCode,
          country_name: destination.countryCode,
          country_name_en: destination.countryCode,
          country_name_zh: destination.countryCode,
          city: destination.nameEn,
          place_type: "city",
          latitude: destination.latitude,
          longitude: destination.longitude,
          popularity_score: 72,
          source: "google_places",
          source_updated_at: now,
          confidence_score: 0.82,
          is_verified: true,
          is_active: true,
          is_searchable: true,
          is_dropdown_enabled: false,
          is_popular: false,
          data_quality: "enriched",
          completeness_score: destination.attractions.length > 0 ? 82 : 60,
          last_enriched_at: now,
        },
        { onConflict: "normalized_name,country_code" }
      )
      .select("id")
      .maybeSingle();

    if (destinationError) throw destinationError;
    const destinationId = destinationRow?.id;
    if (!destinationId) {
      return {
        attempted: true,
        stored: false,
        skippedReason: "destination_upsert_returned_no_id",
      };
    }

    if (!destination.coverImage.isPlaceholder) {
      await admin.from("travel_assets").upsert(
        {
          entity_type: "destination",
          entity_id: destinationId,
          asset_type: "cover_image",
          image_url: destination.coverImage.url,
          thumbnail_url: destination.coverImage.url,
          width: destination.coverImage.width ?? null,
          height: destination.coverImage.height ?? null,
          source: "google_places",
          source_url: destination.coverImage.url,
          attribution: destination.coverImage.attribution ?? null,
          license: "Google Places",
          confidence_score: destination.coverImage.confidence,
          verified: true,
          is_primary: true,
        },
        { onConflict: "entity_type,entity_id,asset_type,image_url" }
      );
    }

    for (const attraction of destination.attractions) {
      const { data: attractionRow, error: attractionError } = await admin
        .from("travel_attractions")
        .upsert(
          {
            destination_id: destinationId,
            canonical_name: attraction.nameEn,
            name_en: attraction.nameEn,
            name_zh: attraction.nameZh,
            description_en: attraction.descriptionEn,
            description_zh: attraction.descriptionZh,
            category: attraction.category,
            latitude: attraction.latitude,
            longitude: attraction.longitude,
            recommended_duration_minutes: 120,
            popularity_score: 70,
            data_quality: "enriched",
            source: "google_places",
            source_url: attraction.googleMapsUri ?? null,
          },
          { onConflict: "destination_id,canonical_name" }
        )
        .select("id")
        .maybeSingle();

      if (attractionError) throw attractionError;
      if (attractionRow?.id && !attraction.photo.isPlaceholder) {
        await admin.from("travel_assets").upsert(
          {
            entity_type: "attraction",
            entity_id: attractionRow.id,
            asset_type: "cover_image",
            image_url: attraction.photo.url,
            thumbnail_url: attraction.photo.url,
            width: attraction.photo.width ?? null,
            height: attraction.photo.height ?? null,
            source: "google_places",
            source_url: attraction.googleMapsUri ?? attraction.photo.url,
            attribution: attraction.photo.attribution ?? null,
            license: "Google Places",
            confidence_score: attraction.photo.confidence,
            verified: true,
            is_primary: true,
          },
          { onConflict: "entity_type,entity_id,asset_type,image_url" }
        );
      }
    }

    await admin.from("travel_destination_cards").upsert(
      [
        {
          destination_id: destinationId,
          card_type: "destination_overview",
          title: destination.nameEn,
          title_en: destination.nameEn,
          title_zh: destination.nameZh,
          subtitle: "Google Places enriched destination",
          subtitle_en: "Google Places enriched destination",
          subtitle_zh: "Google Places 补全目的地",
          description_en: destination.descriptionEn,
          description_zh: destination.descriptionZh,
          image_url: destination.coverImage.isPlaceholder
            ? null
            : destination.coverImage.url,
          payload_json: toJson(destination),
          source: "google_places",
          source_status: "api_enriched",
          is_generated: false,
          confidence_score: 0.82,
        },
        {
          destination_id: destinationId,
          card_type: "top_attractions",
          title: `${destination.nameEn} attractions`,
          title_en: `${destination.nameEn} attractions`,
          title_zh: `${destination.nameZh}景点`,
          subtitle: `${destination.attractions.length} Google Places attractions`,
          subtitle_en: `${destination.attractions.length} Google Places attractions`,
          subtitle_zh: `${destination.attractions.length} 个 Google Places 景点`,
          description_en: destination.attractions
            .map((item) => item.descriptionEn)
            .join("\n"),
          description_zh: destination.attractions
            .map((item) => item.descriptionZh)
            .join("\n"),
          image_url:
            destination.attractions.find((item) => !item.photo.isPlaceholder)?.photo
              .url ?? null,
          payload_json: toJson({ attractions: destination.attractions }),
          source: "google_places",
          source_status: "api_enriched",
          is_generated: false,
          confidence_score: 0.8,
        },
      ],
      { onConflict: "destination_id,card_type" }
    );

    return { attempted: true, stored: true };
  } catch (error) {
    if (!isMissingDatabaseShapeError(error)) {
      console.warn(
        "[travel-google-enrichment] cache skipped:",
        error instanceof Error ? error.message : "unknown cache error"
      );
    }
    return {
      attempted: true,
      stored: false,
      skippedReason: isMissingDatabaseShapeError(error)
        ? "database_schema_missing"
        : "database_cache_failed",
    };
  }
}

export async function enrichDestinationWithGooglePlaces(
  input: GooglePlacesEnrichmentInput,
  options: {
    fetchImpl?: EnrichmentFetch;
    cacheResult?: boolean;
  } = {}
): Promise<TravelGoogleEnrichedDestination> {
  if (!isGooglePlacesFallbackEnabled()) {
    throw new Error("Google Places fallback is disabled by env.");
  }

  const apiKey = getServerGooglePlacesApiKey();
  if (!apiKey) {
    throw new Error("Missing GOOGLE_MAPS_API_KEY for Google Places fallback.");
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const languageCode = languageForLocale(input.locale);
  const contract = findDropdownDestinationContract(input.city);
  const cityEn = contract?.nameEn ?? input.city;
  const cityZh = contract?.nameZh ?? input.city;
  const countryCode = contract?.countryCode ?? null;
  const country = input.country ?? contract?.countryNameEn ?? null;
  const cityQuery = [cityEn, country].filter(Boolean).join(", ");

  const cityCandidates = await requestPlacesTextSearch({
    query: cityQuery,
    apiKey,
    fetchImpl,
    languageCode,
    fieldMask: CITY_FIELD_MASK,
    pageSize: 3,
  });
  const cityPlace =
    cityCandidates.find((place) => includesDestinationName(place, cityEn)) ??
    cityCandidates[0];
  if (!cityPlace) {
    throw new Error("Google Places did not return a destination match.");
  }

  const cityDetails = cityPlace.id
    ? await requestPlaceDetails({
        placeId: cityPlace.id,
        apiKey,
        fetchImpl,
        languageCode,
      })
    : null;
  const destinationPlace = cityDetails ?? cityPlace;
  const latitude =
    toFiniteNumber(destinationPlace.location?.latitude) ?? contract?.latitude ?? null;
  const longitude =
    toFiniteNumber(destinationPlace.location?.longitude) ?? contract?.longitude ?? null;
  const attractionCandidates = await requestPlacesTextSearch({
    query: `top tourist attractions in ${cityEn}`,
    apiKey,
    fetchImpl,
    languageCode,
    fieldMask: CITY_FIELD_MASK,
    pageSize: 12,
    lat: latitude,
    lng: longitude,
  });
  const attractions = filterAndSortGooglePlaces(attractionCandidates, 8).map(
    (place) => normalizeAttraction(place, cityZh)
  );
  const descriptions = descriptionFromFacts({
    cityZh,
    cityEn,
    country,
    attractionNames: attractions.map((item) => item.nameZh),
    editorialSummary: cleanString(cityDetails?.editorialSummary?.text),
    locale: languageCode,
  });

  const resultWithoutCache: Omit<TravelGoogleEnrichedDestination, "cache"> = {
    id: cleanString(destinationPlace.id) ?? `google-${normalizeDestinationSearchText(cityEn)}`,
    canonicalName: cityEn,
    nameZh: cityZh,
    nameEn: cityEn,
    countryCode,
    latitude,
    longitude,
    source: "google_places",
    dataQuality: "api_enriched",
    descriptionZh: descriptions.zh,
    descriptionEn: descriptions.en,
    descriptionSource: descriptions.source,
    coverImage: photoFromPlace(destinationPlace),
    attractions,
  };

  const cache =
    options.cacheResult === false
      ? { attempted: false, stored: false, skippedReason: "disabled_for_test" }
      : await cacheGoogleEnrichmentResult(resultWithoutCache);

  return {
    ...resultWithoutCache,
    cache,
  };
}
