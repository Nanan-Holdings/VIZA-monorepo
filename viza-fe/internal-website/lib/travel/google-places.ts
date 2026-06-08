export const TRAVEL_PLACE_FALLBACK_IMAGE = "/travel/cities/travel-fallback.svg";

export const SUPPORTED_GOOGLE_ATTRACTION_TYPES = [
  "tourist_attraction",
  "museum",
  "art_gallery",
  "historical_landmark",
  "historical_place",
  "monument",
  "park",
  "national_park",
  "garden",
  "observation_deck",
  "amusement_park",
  "zoo",
  "aquarium",
  "church",
  "temple",
  "mosque",
  "synagogue",
  "stadium",
  "cultural_landmark",
  "performing_arts_theater",
] as const;

export type SupportedGoogleAttractionType =
  (typeof SUPPORTED_GOOGLE_ATTRACTION_TYPES)[number];

export type TravelPlaceAttribution = {
  displayName?: string;
  uri?: string;
  photoUri?: string;
};

export type TravelPlaceCard = {
  id: string;
  source: "google";
  title: string;
  subtitle?: string;
  address?: string;
  type?: string;
  types: string[];
  rating?: number | null;
  reviewCount?: number;
  location?: {
    lat: number;
    lng: number;
  };
  imageUrl: string;
  photoName?: string;
  googleMapsUri?: string;
  attribution?: TravelPlaceAttribution[];
  businessStatus?: string;
};

export type TravelPlaceDetails = TravelPlaceCard & {
  openingHoursText?: string[];
  websiteUri?: string;
  editorialSummary?: string;
};

export type GooglePlaceAuthorAttribution = {
  displayName?: string;
  uri?: string;
  photoUri?: string;
};

export type GooglePlacePhoto = {
  name?: string;
  widthPx?: number;
  heightPx?: number;
  authorAttributions?: GooglePlaceAuthorAttribution[];
};

export type GooglePlace = {
  id?: string;
  displayName?: {
    text?: string;
    languageCode?: string;
  };
  formattedAddress?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
  primaryType?: string;
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  photos?: GooglePlacePhoto[];
  googleMapsUri?: string;
  businessStatus?: string;
  regularOpeningHours?: {
    weekdayDescriptions?: string[];
  };
  websiteUri?: string;
  editorialSummary?: {
    text?: string;
    languageCode?: string;
  };
};

const HIGH_VALUE_ATTRACTION_TYPES = new Set<string>([
  "tourist_attraction",
  "museum",
  "historical_landmark",
  "park",
  "observation_deck",
  "art_gallery",
  "zoo",
  "aquarium",
  "amusement_park",
  "national_park",
  "garden",
  "monument",
  "historical_place",
]);

export function isSupportedGoogleAttractionType(
  value: string
): value is SupportedGoogleAttractionType {
  return SUPPORTED_GOOGLE_ATTRACTION_TYPES.includes(
    value as SupportedGoogleAttractionType
  );
}

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function toFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getPrimaryPhoto(place: GooglePlace): GooglePlacePhoto | undefined {
  return place.photos?.find((photo) => cleanString(photo.name));
}

function normalizeAttributions(
  photo: GooglePlacePhoto | undefined
): TravelPlaceAttribution[] | undefined {
  const attributions = photo?.authorAttributions
    ?.map((attribution) => {
      const normalized: TravelPlaceAttribution = {};
      const displayName = cleanString(attribution.displayName);
      const uri = cleanString(attribution.uri);
      const photoUri = cleanString(attribution.photoUri);
      if (displayName) normalized.displayName = displayName;
      if (uri) normalized.uri = uri;
      if (photoUri) normalized.photoUri = photoUri;
      return normalized;
    })
    .filter(
      (attribution) =>
        attribution.displayName || attribution.uri || attribution.photoUri
    );

  return attributions?.length ? attributions : undefined;
}

function getPlaceTypeSet(place: GooglePlace): Set<string> {
  return new Set(
    [place.primaryType, ...(place.types ?? [])]
      .map((value) => cleanString(value))
      .filter((value): value is string => Boolean(value))
  );
}

export function googlePlaceMatchesTypes(
  place: GooglePlace,
  requestedTypes: readonly string[]
): boolean {
  if (requestedTypes.length === 0) return true;
  const placeTypes = getPlaceTypeSet(place);
  return requestedTypes.some((type) => placeTypes.has(type));
}

export function scoreGooglePlace(place: GooglePlace): number {
  const rating = toFiniteNumber(place.rating) ?? 0;
  const userRatingCount = toFiniteNumber(place.userRatingCount) ?? 0;
  const hasPhotoBonus = getPrimaryPhoto(place) ? 0.5 : 0;
  const placeTypes = getPlaceTypeSet(place);
  const typeBonus = [...placeTypes].some((type) =>
    HIGH_VALUE_ATTRACTION_TYPES.has(type)
  )
    ? 0.3
    : 0;

  return rating * Math.log10(userRatingCount + 10) + hasPhotoBonus + typeBonus;
}

export function filterAndSortGooglePlaces(
  places: GooglePlace[],
  limit: number,
  requestedTypes: readonly string[] = []
): GooglePlace[] {
  const byId = new Map<string, GooglePlace>();
  places.forEach((place) => {
    const id = cleanString(place.id);
    if (!id || place.businessStatus === "CLOSED_PERMANENTLY") return;
    if (!googlePlaceMatchesTypes(place, requestedTypes)) return;
    if (!byId.has(id)) byId.set(id, place);
  });

  const candidates = Array.from(byId.values());
  const strictCandidates = candidates.filter((place) => {
    const rating = toFiniteNumber(place.rating) ?? 0;
    const userRatingCount = toFiniteNumber(place.userRatingCount) ?? 0;
    return rating >= 4 && userRatingCount >= 100;
  });
  const pool = strictCandidates.length >= limit ? strictCandidates : candidates;

  return pool
    .sort((left, right) => scoreGooglePlace(right) - scoreGooglePlace(left))
    .slice(0, limit);
}

export function normalizeGooglePlaceToCard(place: GooglePlace): TravelPlaceCard {
  const id = cleanString(place.id) ?? "";
  const title =
    cleanString(place.displayName?.text) ??
    cleanString(place.formattedAddress)?.split(",")[0]?.trim() ??
    "Untitled place";
  const address = cleanString(place.formattedAddress);
  const primaryType = cleanString(place.primaryType);
  const types = (place.types ?? []).filter(
    (type): type is string => Boolean(cleanString(type))
  );
  const rating = toFiniteNumber(place.rating) ?? null;
  const reviewCount = Math.max(0, Math.round(toFiniteNumber(place.userRatingCount) ?? 0));
  const latitude = toFiniteNumber(place.location?.latitude);
  const longitude = toFiniteNumber(place.location?.longitude);
  const photo = getPrimaryPhoto(place);
  const photoName = cleanString(photo?.name);
  const googleMapsUri = cleanString(place.googleMapsUri);
  const businessStatus = cleanString(place.businessStatus);

  return {
    id,
    source: "google",
    title,
    subtitle: address,
    address,
    type: primaryType,
    types,
    rating,
    reviewCount,
    location:
      latitude === undefined || longitude === undefined
        ? undefined
        : { lat: latitude, lng: longitude },
    imageUrl: photoName
      ? `/api/places/photo?name=${encodeURIComponent(photoName)}`
      : TRAVEL_PLACE_FALLBACK_IMAGE,
    photoName,
    googleMapsUri,
    attribution: normalizeAttributions(photo),
    businessStatus,
  };
}

export function normalizeGooglePlaceToDetails(
  place: GooglePlace
): TravelPlaceDetails {
  const card = normalizeGooglePlaceToCard(place);
  const openingHoursText = place.regularOpeningHours?.weekdayDescriptions?.filter(
    (item): item is string => Boolean(cleanString(item))
  );
  const websiteUri = cleanString(place.websiteUri);
  const editorialSummary = cleanString(place.editorialSummary?.text);

  return {
    ...card,
    openingHoursText: openingHoursText?.length ? openingHoursText : undefined,
    websiteUri,
    editorialSummary,
  };
}
