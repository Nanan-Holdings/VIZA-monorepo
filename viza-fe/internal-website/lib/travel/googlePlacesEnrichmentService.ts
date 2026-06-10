import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import {
  findDropdownDestinationContract,
  normalizeDestinationContractKey,
  normalizeDestinationSearchText,
} from "./destination-contracts";
import type {
  TravelGoogleAttraction,
  TravelGoogleCallEvidence,
  TravelGoogleEnrichedDestination,
  TravelGooglePhoto,
} from "./google-places-enrichment-types";
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
  "places.addressComponents",
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
  "addressComponents",
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

type GoogleTextSearchResponse = {
  places?: GooglePlace[];
};

type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
  languageCode?: string;
};

type GooglePlaceDetails = GooglePlace & {
  addressComponents?: GoogleAddressComponent[];
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

function includesAnyDestinationName(
  place: GooglePlace,
  destinationNames: string[]
): boolean {
  const expectedNames = destinationNames
    .map(compactSearchText)
    .filter(Boolean);
  if (expectedNames.length === 0) return true;
  const haystack = compactSearchText(
    [
      place.displayName?.text,
      place.formattedAddress,
      ...(place.types ?? []),
    ]
      .filter(Boolean)
      .join(" ")
  );
  return expectedNames.some(
    (expected) => haystack.includes(expected) || expected.includes(haystack)
  );
}

function isWithinBounds(
  latitude: number | null,
  longitude: number | null,
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }
): boolean {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    latitude >= bounds.minLat &&
    latitude <= bounds.maxLat &&
    longitude >= bounds.minLng &&
    longitude <= bounds.maxLng
  );
}

const CHINA_BOUNDS = {
  minLat: 18,
  maxLat: 54,
  minLng: 73,
  maxLng: 135,
};

const HUNAN_CHANGSHA_BOUNDS = {
  minLat: 27.4,
  maxLat: 29.4,
  minLng: 111.5,
  maxLng: 114.3,
};

function isChangshaDestination(city: string): boolean {
  const key = normalizeDestinationContractKey(city);
  return [
    "changsha",
    "长沙",
    "长沙市",
    "湖南长沙",
    "changshahunan",
    "hunanchangsha",
  ].includes(key);
}

function extractAddressPart(
  components: GoogleAddressComponent[] | undefined,
  type: string,
  textFallback: string
): string | null {
  const component = components?.find((item) => item.types?.includes(type));
  const value = cleanString(component?.shortText) ?? cleanString(component?.longText);
  if (value) return value;
  const normalizedFallback = textFallback.toLowerCase();
  if (type === "country") {
    if (normalizedFallback.includes("china") || textFallback.includes("中国")) {
      return "CN";
    }
  }
  if (type === "administrative_area_level_1") {
    if (normalizedFallback.includes("hunan") || textFallback.includes("湖南")) {
      return textFallback.includes("湖南") ? "湖南" : "Hunan";
    }
  }
  return null;
}

function placeCountryCode(place: GooglePlaceDetails | GooglePlace): string | null {
  const details = place as GooglePlaceDetails;
  const country = extractAddressPart(
    details.addressComponents,
    "country",
    cleanString(place.formattedAddress) ?? ""
  );
  if (!country) return null;
  if (/^(cn|china|中国)$/i.test(country)) return "CN";
  return country.toUpperCase();
}

function placeAdminArea(place: GooglePlaceDetails | GooglePlace): string | null {
  const details = place as GooglePlaceDetails;
  return extractAddressPart(
    details.addressComponents,
    "administrative_area_level_1",
    cleanString(place.formattedAddress) ?? ""
  );
}

function placeCoordinates(place: GooglePlace): { latitude: number | null; longitude: number | null } {
  return {
    latitude: toFiniteNumber(place.location?.latitude),
    longitude: toFiniteNumber(place.location?.longitude),
  };
}

function isValidDestinationPlace(options: {
  place: GooglePlaceDetails | GooglePlace;
  cityEn: string;
  cityZh: string;
  countryCode: string | null;
}): boolean {
  if (!includesAnyDestinationName(options.place, [options.cityEn, options.cityZh])) {
    return false;
  }

  const { latitude, longitude } = placeCoordinates(options.place);
  if (options.countryCode === "CN" && !isWithinBounds(latitude, longitude, CHINA_BOUNDS)) {
    return false;
  }

  if (isChangshaDestination(options.cityEn) || isChangshaDestination(options.cityZh)) {
    const address = cleanString(options.place.formattedAddress) ?? "";
    const countryCode = placeCountryCode(options.place);
    const adminArea = placeAdminArea(options.place);
    const hasHunanText = /hunan/i.test(address) || address.includes("湖南");
    const hasChinaText = /china/i.test(address) || address.includes("中国");
    return (
      isWithinBounds(latitude, longitude, HUNAN_CHANGSHA_BOUNDS) &&
      (countryCode === null || countryCode === "CN") &&
      (adminArea === null || /hunan|湖南/i.test(adminArea)) &&
      (hasHunanText || hasChinaText || countryCode === "CN")
    );
  }

  return true;
}

function isValidAttractionPlace(options: {
  place: GooglePlaceDetails | GooglePlace;
  cityEn: string;
  cityZh: string;
  countryCode: string | null;
}): boolean {
  const { latitude, longitude } = placeCoordinates(options.place);
  if (options.countryCode === "CN" && !isWithinBounds(latitude, longitude, CHINA_BOUNDS)) {
    return false;
  }
  if (isChangshaDestination(options.cityEn) || isChangshaDestination(options.cityZh)) {
    return isWithinBounds(latitude, longitude, HUNAN_CHANGSHA_BOUNDS);
  }
  return latitude !== null && longitude !== null;
}

function recordPlacesCall(
  evidence: TravelGoogleCallEvidence,
  query: string,
  places: GooglePlace[],
  kind: "destination" | "attraction"
): void {
  evidence.textSearchCount += 1;
  evidence.queries.push(query);
  if (kind === "destination" && !evidence.destinationQuery) {
    evidence.destinationQuery = query;
  }
  if (kind === "attraction") {
    evidence.attractionQueries.push(query);
  }
  places.forEach((place) => {
    const id = cleanString(place.id);
    if (id && !evidence.placeIds.includes(id)) evidence.placeIds.push(id);
  });
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
  regionCode?: string | null;
}): Promise<GooglePlace[]> {
  const body: Record<string, unknown> = {
    textQuery: options.query,
    languageCode: options.languageCode,
    pageSize: options.pageSize,
  };

  if (options.regionCode) {
    body.regionCode = options.regionCode;
  }

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
          aliases_json: [
            destination.nameEn,
            destination.nameZh,
            destination.adminAreaEn
              ? `${destination.nameEn} ${destination.adminAreaEn}`
              : null,
            destination.adminAreaZh
              ? `${destination.adminAreaZh}${destination.nameZh}`
              : null,
          ].filter(Boolean),
          country_code: destination.countryCode,
          country_name: destination.countryCode === "CN" ? "China" : destination.countryCode,
          country_name_en:
            destination.countryCode === "CN" ? "China" : destination.countryCode,
          country_name_zh:
            destination.countryCode === "CN" ? "中国" : destination.countryCode,
          region: destination.adminAreaEn ?? null,
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
          payload_json: toJson({
            ...destination,
            googlePlaceId: destination.placeId,
            calls: destination.calls,
          }),
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
          payload_json: toJson({
            googlePlaceId: destination.placeId,
            calls: destination.calls,
            attractions: destination.attractions,
          }),
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
  const isChangsha = isChangshaDestination(cityEn) || isChangshaDestination(cityZh);
  const adminAreaEn = isChangsha ? "Hunan" : contract?.region ?? null;
  const adminAreaZh = isChangsha ? "湖南" : null;
  const evidence: TravelGoogleCallEvidence = {
    textSearchCount: 0,
    detailsCount: 0,
    queries: [],
    placeIds: [],
    destinationPlaceId: null,
    destinationQuery: null,
    attractionQueries: [],
  };

  const cityQueries = Array.from(
    new Set(
      isChangsha
        ? [
            `${cityZh} ${adminAreaZh} 中国`,
            `${cityEn} ${adminAreaEn} China`,
            `${cityEn}, ${adminAreaEn}, China`,
          ]
        : [
            [cityEn, contract?.region, country].filter(Boolean).join(", "),
            [cityZh, contract?.countryNameZh ?? country].filter(Boolean).join(" "),
          ].filter(Boolean)
    )
  );

  let cityPlace: GooglePlace | null = null;
  for (const query of cityQueries) {
    const cityCandidates = await requestPlacesTextSearch({
      query,
      apiKey,
      fetchImpl,
      languageCode,
      fieldMask: CITY_FIELD_MASK,
      pageSize: 5,
      lat: contract?.latitude,
      lng: contract?.longitude,
      regionCode: countryCode,
    });
    recordPlacesCall(evidence, query, cityCandidates, "destination");
    cityPlace =
      cityCandidates.find((place) =>
        isValidDestinationPlace({ place, cityEn, cityZh, countryCode })
      ) ?? null;
    if (cityPlace) break;
  }

  if (!cityPlace) {
    throw new Error("Google Places did not return a validated destination match.");
  }

  const cityDetails = cityPlace.id
    ? await requestPlaceDetails({
        placeId: cityPlace.id,
        apiKey,
        fetchImpl,
        languageCode,
      })
    : null;
  if (cityDetails) {
    evidence.detailsCount += 1;
    const id = cleanString(cityDetails.id);
    if (id && !evidence.placeIds.includes(id)) evidence.placeIds.push(id);
  }
  const destinationPlace = cityDetails ?? cityPlace;
  if (
    !isValidDestinationPlace({
      place: destinationPlace,
      cityEn,
      cityZh,
      countryCode,
    })
  ) {
    throw new Error("Google Places destination failed country/admin validation.");
  }
  const latitude =
    toFiniteNumber(destinationPlace.location?.latitude) ?? contract?.latitude ?? null;
  const longitude =
    toFiniteNumber(destinationPlace.location?.longitude) ?? contract?.longitude ?? null;
  evidence.destinationPlaceId = cleanString(destinationPlace.id);

  const changshaHints = [
    "岳麓山",
    "橘子洲",
    "湖南博物院",
    "太平老街",
    "黄兴路步行街",
    "杜甫江阁",
    "长沙IFS国金中心",
    "烈士公园",
    "谢子龙影像艺术馆",
    "梅溪湖国际文化艺术中心",
  ];
  const attractionQueries = Array.from(
    new Set(
      isChangsha
        ? [
            `长沙 景点 湖南 中国`,
            `top tourist attractions in Changsha Hunan China`,
            ...changshaHints.map((name) => `${name} 长沙 湖南 中国`),
          ]
        : [
            `top tourist attractions in ${cityEn} ${country ?? ""}`.trim(),
            `${cityZh} 景点 ${contract?.countryNameZh ?? country ?? ""}`.trim(),
          ]
    )
  );
  const attractionCandidatesById = new Map<string, GooglePlace>();
  for (const query of attractionQueries) {
    const places = await requestPlacesTextSearch({
      query,
      apiKey,
      fetchImpl,
      languageCode,
      fieldMask: CITY_FIELD_MASK,
      pageSize: isChangsha ? 5 : 12,
      lat: latitude,
      lng: longitude,
      regionCode: countryCode,
    });
    recordPlacesCall(evidence, query, places, "attraction");
    places
      .filter((place) => isValidAttractionPlace({ place, cityEn, cityZh, countryCode }))
      .forEach((place) => {
        const id = cleanString(place.id);
        if (id && !attractionCandidatesById.has(id)) {
          attractionCandidatesById.set(id, place);
        }
      });
  }

  const rankedAttractionCandidates = filterAndSortGooglePlaces(
    Array.from(attractionCandidatesById.values()),
    12
  );
  const attractionDetails: GooglePlace[] = [];
  for (const place of rankedAttractionCandidates) {
    if (!place.id) {
      attractionDetails.push(place);
      continue;
    }
    const details = await requestPlaceDetails({
      placeId: place.id,
      apiKey,
      fetchImpl,
      languageCode,
    });
    evidence.detailsCount += 1;
    if (details) {
      const id = cleanString(details.id);
      if (id && !evidence.placeIds.includes(id)) evidence.placeIds.push(id);
    }
    const detailedPlace = details ?? place;
    if (isValidAttractionPlace({ place: detailedPlace, cityEn, cityZh, countryCode })) {
      attractionDetails.push(detailedPlace);
    }
    if (
      attractionDetails.length >= 8 &&
      attractionDetails.filter((item) => !photoFromPlace(item).isPlaceholder).length >= 3
    ) {
      break;
    }
  }
  const attractions = attractionDetails.slice(0, 10).map((place) =>
    normalizeAttraction(place, cityZh)
  );
  const firstVerifiedAttractionPhoto = attractions.find(
    (item) => !item.photo.isPlaceholder
  )?.photo;
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
    adminAreaZh,
    adminAreaEn,
    googleMapsUri: cleanString(destinationPlace.googleMapsUri),
    placeId: cleanString(destinationPlace.id),
    coverImage: photoFromPlace(destinationPlace).isPlaceholder && firstVerifiedAttractionPhoto
      ? firstVerifiedAttractionPhoto
      : photoFromPlace(destinationPlace),
    attractions,
    calls: evidence,
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
