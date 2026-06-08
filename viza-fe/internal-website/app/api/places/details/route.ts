import {
  normalizeGooglePlaceToDetails,
  type GooglePlace,
} from "@/lib/travel/google-places";
import {
  GOOGLE_PLACES_BASE_URL,
  GOOGLE_PLACES_MISSING_KEY_MESSAGE,
  GooglePlacesApiError,
  getGooglePlacesApiKey,
  normalizePlacesLanguage,
  parseGoogleError,
  runInFlightDeduped,
} from "../_google-places-api";

export const dynamic = "force-dynamic";

const DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "regularOpeningHours",
  "websiteUri",
  "googleMapsUri",
  "photos",
  "editorialSummary",
  "primaryType",
  "types",
  "businessStatus",
].join(",");

function normalizePlaceId(value: string | null): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  if (trimmed.startsWith("places/")) {
    return trimmed.slice("places/".length).split("/")[0]?.trim() ?? "";
  }
  return trimmed;
}

async function requestPlaceDetails(
  placeId: string,
  lang: string,
  apiKey: string
): Promise<GooglePlace> {
  const requestUrl = new URL(
    `${GOOGLE_PLACES_BASE_URL}/places/${encodeURIComponent(placeId)}`
  );
  requestUrl.searchParams.set("languageCode", lang);
  const dedupeKey = `places-details:${placeId}:${lang}:${DETAILS_FIELD_MASK}`;

  return runInFlightDeduped(dedupeKey, async () => {
    const response = await fetch(requestUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": DETAILS_FIELD_MASK,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw await parseGoogleError(response);
    }

    return (await response.json()) as GooglePlace;
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const placeId = normalizePlaceId(url.searchParams.get("placeId"));
  const lang = normalizePlacesLanguage(url.searchParams.get("lang"));

  if (!placeId) {
    return Response.json({ error: "placeId is required." }, { status: 400 });
  }

  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) {
    return Response.json({ error: GOOGLE_PLACES_MISSING_KEY_MESSAGE }, { status: 500 });
  }

  try {
    const place = await requestPlaceDetails(placeId, lang, apiKey);
    return Response.json(
      { details: normalizeGooglePlaceToDetails(place) },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof GooglePlacesApiError
        ? "Google Places details failed. Please try again later."
        : "Travel place details are unavailable.";
    return Response.json({ error: message }, { status: 502 });
  }
}
