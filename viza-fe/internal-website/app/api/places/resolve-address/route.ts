import { NextResponse } from "next/server";
import {
  GOOGLE_PLACES_BASE_URL,
  GOOGLE_PLACES_MISSING_KEY_MESSAGE,
  getGooglePlacesApiKey,
  normalizePlacesLanguage,
  parseGoogleError,
  runInFlightDeduped,
} from "../_google-places-api";

export const dynamic = "force-dynamic";

/**
 * Resolve a free-text address, hotel name, or postal code into its administrative
 * parts (state / city / postcode / country).
 *
 * Booking confirmations rarely spell out the state or city an official visa form
 * asks for — a hotel address is often just a street plus a postcode. Applicants had
 * to look it up themselves, which is where the wrong-state answers came from.
 *
 * Uses Google Places Text Search plus the address components of the top match.
 * Returns 200 with `{ ok: false }` and an empty result rather than an error when
 * nothing matches, so the caller can fall back to manual entry quietly.
 */

const FIELD_MASK = [
  "places.id",
  "places.formattedAddress",
  "places.addressComponents",
  "places.displayName",
].join(",");

interface GoogleAddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

interface GoogleAddressPlace {
  id?: string;
  formattedAddress?: string;
  displayName?: { text?: string };
  addressComponents?: GoogleAddressComponent[];
}

export interface ResolvedAddress {
  formattedAddress: string;
  /** administrative_area_level_1 — what visa forms call "state" or "province". */
  state: string;
  /** Best available city: locality, else the next administrative level down. */
  city: string;
  postalCode: string;
  country: string;
  countryCode: string;
}

function pick(
  components: GoogleAddressComponent[],
  type: string,
  variant: "longText" | "shortText" = "longText",
): string {
  return components.find((c) => c.types?.includes(type))?.[variant]?.trim() ?? "";
}

function toResolvedAddress(place: GoogleAddressPlace): ResolvedAddress {
  const components = place.addressComponents ?? [];
  return {
    formattedAddress: place.formattedAddress?.trim() ?? "",
    state: pick(components, "administrative_area_level_1"),
    // Many countries put the city in `locality`; some (e.g. parts of Malaysia and
    // the UK) only populate the lower administrative levels or a postal town.
    city:
      pick(components, "locality") ||
      pick(components, "postal_town") ||
      pick(components, "administrative_area_level_2") ||
      pick(components, "sublocality_level_1"),
    postalCode: pick(components, "postal_code"),
    country: pick(components, "country"),
    countryCode: pick(components, "country", "shortText"),
  };
}

export async function POST(request: Request) {
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: GOOGLE_PLACES_MISSING_KEY_MESSAGE }, { status: 503 });
  }

  let body: { query?: unknown; countryHint?: unknown; locale?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (query.length < 3) {
    return NextResponse.json({ ok: false, error: "Query too short." }, { status: 400 });
  }

  const countryHint = typeof body.countryHint === "string" ? body.countryHint.trim() : "";
  const lang = normalizePlacesLanguage(typeof body.locale === "string" ? body.locale : null);
  // Biasing by country keeps "Jalan Teluk Kumbar" from resolving to a same-named
  // street elsewhere; it is a bias, not a hard restriction.
  const textQuery = countryHint ? `${query}, ${countryHint}` : query;

  try {
    const place = await runInFlightDeduped<GoogleAddressPlace | null>(
      `places-resolve-address:${textQuery}:${lang}`,
      async () => {
        const response = await fetch(`${GOOGLE_PLACES_BASE_URL}/places:searchText`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": FIELD_MASK,
          },
          body: JSON.stringify({ textQuery, languageCode: lang, maxResultCount: 1 }),
          signal: AbortSignal.timeout(8_000),
        });

        if (!response.ok) throw await parseGoogleError(response);

        const payload = (await response.json()) as { places?: GoogleAddressPlace[] };
        return payload.places?.[0] ?? null;
      },
    );

    if (!place) return NextResponse.json({ ok: false, result: null });
    return NextResponse.json({ ok: true, result: toResolvedAddress(place) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Address lookup failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
