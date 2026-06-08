import { forwardJsonToTravelBackend } from "@/lib/travel/backend";
import {
  buildLocalFirstDestinationPayload,
  findDropdownDestinationContract,
} from "@/lib/travel/destination-contracts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function withLocalFirstDestinationContext(payload: unknown): unknown {
  if (!isRecord(payload)) return payload;
  const cities = stringArray(payload.cities);
  if (cities.length === 0) return payload;

  const destinationContext = cities
    .map((city) => findDropdownDestinationContract(city))
    .filter((destination): destination is NonNullable<typeof destination> =>
      Boolean(destination)
    )
    .map((destination) => {
      const localPayload = buildLocalFirstDestinationPayload(destination);
      return {
        destination_id: destination.key,
        canonical_name: destination.canonicalName,
        name_en: destination.nameEn,
        name_zh: destination.nameZh,
        country_code: destination.countryCode,
        country_name_en: destination.countryNameEn,
        country_name_zh: destination.countryNameZh,
        coordinates:
          destination.latitude !== null && destination.longitude !== null
            ? { lat: destination.latitude, lng: destination.longitude }
            : null,
        cover_image_url: localPayload.coverImage?.imageUrl ?? null,
        data_quality: localPayload.dataQuality,
        source_status: localPayload.sourceStatus,
        attractions: localPayload.attractionCards.slice(0, 8).map((item) => ({
          attraction_id: item.key,
          name_en: item.nameEn,
          name_zh: item.nameZh,
          description_en: item.descriptionEn,
          description_zh: item.descriptionZh,
          latitude: item.latitude,
          longitude: item.longitude,
          image_url: item.image?.imageUrl ?? null,
          data_quality: item.dataQuality,
          source_url: item.sourceUrl,
        })),
      };
    });

  return {
    ...payload,
    local_first_destination_context: destinationContext,
  };
}

export async function POST(request: Request) {
  try {
    const payload = withLocalFirstDestinationContext(await request.json());
    const candidatePaths = ["/generate", "/generate-itinerary", "/api/generate"];
    const tried: Array<{ path: string; status: number; detail: string }> = [];

    for (const path of candidatePaths) {
      const response = await forwardJsonToTravelBackend(path, payload);
      const text = await response.text();

      if (response.ok) {
        try {
          return Response.json(JSON.parse(text), { status: 200 });
        } catch {
          return Response.json({ itinerary: [] }, { status: 200 });
        }
      }

      tried.push({
        path,
        status: response.status,
        detail: text || "",
      });

      if (response.status !== 404) {
        return Response.json(
          {
            error: text || "Failed to generate itinerary.",
            debug: { path, status: response.status },
          },
          { status: response.status }
        );
      }
    }

    return Response.json(
      {
        error:
          "No compatible itinerary endpoint found on backend. Please verify backend routes.",
        debug: tried,
      },
      { status: 502 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate itinerary.";
    return Response.json({ error: message }, { status: 500 });
  }
}
