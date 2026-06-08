import { NextResponse } from "next/server";
import { TRAVEL_PLACE_FALLBACK_IMAGE } from "@/lib/travel/google-places";
import {
  GOOGLE_PLACES_BASE_URL,
  GOOGLE_PLACES_MISSING_KEY_MESSAGE,
  encodeGoogleResourcePath,
  getGooglePlacesApiKey,
  normalizeGooglePhotoName,
  parseBoundedInteger,
} from "../_google-places-api";

export const dynamic = "force-dynamic";

type GooglePhotoMediaResponse = {
  photoUri?: string;
};

function fallbackRedirect(request: Request): NextResponse {
  return NextResponse.redirect(new URL(TRAVEL_PLACE_FALLBACK_IMAGE, request.url));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const photoName = normalizeGooglePhotoName(url.searchParams.get("name"));
  const maxWidth = parseBoundedInteger(url.searchParams.get("maxWidth"), {
    defaultValue: 900,
    min: 1,
    max: 4800,
  });

  if (!photoName) {
    return fallbackRedirect(request);
  }

  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) {
    return Response.json({ error: GOOGLE_PLACES_MISSING_KEY_MESSAGE }, { status: 500 });
  }

  const googleUrl = new URL(
    `${GOOGLE_PLACES_BASE_URL}/${encodeGoogleResourcePath(photoName)}/media`
  );
  googleUrl.searchParams.set("maxWidthPx", String(maxWidth));
  googleUrl.searchParams.set("skipHttpRedirect", "true");
  googleUrl.searchParams.set("key", apiKey);

  try {
    const response = await fetch(googleUrl, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      return fallbackRedirect(request);
    }

    const payload = (await response.json().catch(() => null)) as
      | GooglePhotoMediaResponse
      | null;
    if (!payload?.photoUri) {
      return fallbackRedirect(request);
    }

    return NextResponse.redirect(payload.photoUri);
  } catch {
    return fallbackRedirect(request);
  }
}
