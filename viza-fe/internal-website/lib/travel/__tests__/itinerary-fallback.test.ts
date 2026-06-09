import { afterEach, describe, expect, it, vi } from "vitest";
import {
  enrichDestinationWithGooglePlaces,
  type TravelGoogleEnrichedDestination,
} from "@/lib/travel/googlePlacesEnrichmentService";
import {
  generateItineraryWithFallback,
  normalizeItineraryFromResponse,
} from "@/lib/travel/itinerary-fallback";
import { TRAVEL_PLACE_FALLBACK_IMAGE } from "@/lib/travel/google-places";
import type { ItineraryDay } from "@/lib/travel/planner";

const changshaPayload = {
  country: "中国",
  countries: ["中国"],
  cities: ["长沙"],
  city_days: { 长沙: 2 },
  travel_days: 2,
  travelers: 2,
  budget: 4800,
  travel_order: ["长沙"],
  departure_date: "2026-08-09",
  locale: "zh-CN",
};

const fallbackItinerary: ItineraryDay[] = [
  {
    day: 1,
    city: "长沙",
    activities: ["岳麓山", "橘子洲"],
    food: ["坡子街小吃"],
    cost: "¥800",
  },
];

function mockEnrichment(
  overrides: Partial<TravelGoogleEnrichedDestination> = {}
): TravelGoogleEnrichedDestination {
  return {
    id: "places/changsha",
    canonicalName: "Changsha",
    nameZh: "长沙",
    nameEn: "Changsha",
    countryCode: "CN",
    latitude: 28.2282,
    longitude: 112.9388,
    source: "google_places",
    dataQuality: "api_enriched",
    descriptionZh: "长沙目的地介绍。",
    descriptionEn: "Changsha destination intro.",
    descriptionSource: "fallback_generic",
    coverImage: {
      url: "/api/places/photo?name=places%2Fchangsha%2Fphotos%2F1",
      provider: "google_places",
      confidence: 0.9,
      isPlaceholder: false,
    },
    attractions: [
      {
        nameZh: "岳麓山",
        nameEn: "Yuelu Mountain",
        latitude: 28.18,
        longitude: 112.94,
        descriptionZh: "岳麓山是长沙的 tourist attraction。",
        descriptionEn: "Yuelu Mountain is a tourist attraction in Changsha.",
        photo: {
          url: TRAVEL_PLACE_FALLBACK_IMAGE,
          provider: "placeholder",
          confidence: 0,
          isPlaceholder: true,
        },
        source: "google_places",
      },
    ],
    cache: { attempted: true, stored: true },
    ...overrides,
  };
}

describe("travel itinerary fallback pipeline", () => {
  it("continues from primary fetch failure to Google and LLM fallback", async () => {
    const googleEnricher = vi.fn(async () => mockEnrichment());
    const llmGenerator = vi.fn(async () => fallbackItinerary);

    const result = await generateItineraryWithFallback(changshaPayload, {
      primaryGenerator: async () => {
        throw new Error("fetch failed");
      },
      googleEnricher,
      llmGenerator,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.itinerary).toEqual(fallbackItinerary);
    expect(result.fallbackUsed).toEqual(["google_places", "llm_text"]);
    expect(result.diagnostics.primaryTravelServiceStatus).toBe("failed");
    expect(result.diagnostics.googleFallbackSucceeded).toBe(true);
    expect(googleEnricher).toHaveBeenCalledTimes(1);
    expect(llmGenerator).toHaveBeenCalledWith(
      expect.objectContaining({ cities: ["长沙"] }),
      expect.objectContaining({ source: "google_places" })
    );
  });

  it("falls back to LLM text-only itinerary when Google fails", async () => {
    const result = await generateItineraryWithFallback(changshaPayload, {
      primaryGenerator: async () => {
        throw new Error("fetch failed");
      },
      googleEnricher: async () => {
        throw new Error("Google Places API returned HTTP 403.");
      },
      llmGenerator: async () => fallbackItinerary,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.fallbackUsed).toEqual(["llm_text"]);
    expect(result.warnings).toContain("google_places_unavailable");
    expect(result.diagnostics.googleFallbackAttempted).toBe(true);
  });

  it("returns a controlled retryable error when every generation path fails", async () => {
    const result = await generateItineraryWithFallback(changshaPayload, {
      primaryGenerator: async () => {
        throw new Error("fetch failed");
      },
      googleEnricher: async () => {
        throw new Error("fetch failed");
      },
      llmGenerator: async () => {
        throw new Error("fetch failed");
      },
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.retryable).toBe(true);
    expect(result.error.userMessageZh).not.toContain("fetch failed");
    expect(result.error.userMessageEn).not.toContain("fetch failed");
    expect(result.error.stage).toBe("llm_itinerary_generation");
  });

  it("triggers Google fallback for a local destination miss", async () => {
    const googlePayloads: Record<string, unknown>[] = [];
    const googleEnricher = vi.fn(async (payload: Record<string, unknown>) => {
      googlePayloads.push(payload);
      return mockEnrichment();
    });

    const result = await generateItineraryWithFallback(
      { ...changshaPayload, cities: ["Xyzabc"], travel_order: ["Xyzabc"] },
      {
        primaryGenerator: async () => {
          throw new Error("fetch failed");
        },
        googleEnricher,
        llmGenerator: async () => fallbackItinerary,
      }
    );

    expect(result.success).toBe(true);
    expect(googleEnricher).toHaveBeenCalledTimes(1);
    expect(googlePayloads[0]).toMatchObject({
      cities: ["Xyzabc"],
    });
  });

  it("normalizes primary service response variants", () => {
    expect(normalizeItineraryFromResponse({ reply: fallbackItinerary })).toEqual(
      fallbackItinerary
    );
    expect(normalizeItineraryFromResponse({ itinerary: fallbackItinerary })).toEqual(
      fallbackItinerary
    );
    expect(normalizeItineraryFromResponse({ error: "fetch failed" })).toEqual([]);
  });
});

describe("Google Places enrichment service", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalizes Google city, attraction, photo, and placeholder data", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-google-key");
    vi.stubEnv("TRAVEL_GOOGLE_FALLBACK_ENABLED", "true");
    vi.stubEnv("GOOGLE_PLACES_API_ENABLED", "true");

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          places: [
            {
              id: "changsha-place",
              displayName: { text: "长沙市" },
              formattedAddress: "Changsha, Hunan, China",
              location: { latitude: 28.2282, longitude: 112.9388 },
              photos: [{ name: "places/changsha/photos/city", widthPx: 640 }],
              types: ["locality", "political"],
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          id: "changsha-place",
          displayName: { text: "长沙市" },
          formattedAddress: "Changsha, Hunan, China",
          location: { latitude: 28.2282, longitude: 112.9388 },
          photos: [{ name: "places/changsha/photos/city", widthPx: 640 }],
          editorialSummary: { text: "长沙是湖南省会。" },
          types: ["locality", "political"],
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          places: [
            {
              id: "yuelu",
              displayName: { text: "岳麓山" },
              formattedAddress: "长沙市岳麓区",
              location: { latitude: 28.18, longitude: 112.94 },
              primaryType: "tourist_attraction",
              types: ["tourist_attraction"],
              rating: 4.7,
              userRatingCount: 1000,
              photos: [{ name: "places/yuelu/photos/1", heightPx: 480 }],
              businessStatus: "OPERATIONAL",
            },
            {
              id: "no-photo",
              displayName: { text: "太平老街" },
              formattedAddress: "长沙市天心区",
              location: { latitude: 28.19, longitude: 112.97 },
              primaryType: "tourist_attraction",
              types: ["tourist_attraction"],
              rating: 4.5,
              userRatingCount: 800,
              businessStatus: "OPERATIONAL",
            },
          ],
        })
      );

    const result = await enrichDestinationWithGooglePlaces(
      { city: "长沙", country: "中国", locale: "zh-CN" },
      { fetchImpl, cacheResult: false }
    );

    expect(result).toMatchObject({
      canonicalName: "Changsha",
      nameZh: "长沙",
      countryCode: "CN",
      source: "google_places",
      dataQuality: "api_enriched",
      descriptionSource: "google_places",
    });
    expect(result.coverImage.provider).toBe("google_places");
    expect(result.coverImage.url).toContain("/api/places/photo?name=");
    expect(result.attractions).toHaveLength(2);
    expect(result.attractions[0].photo.provider).toBe("google_places");
    expect(result.attractions[1].photo).toMatchObject({
      provider: "placeholder",
      url: TRAVEL_PLACE_FALLBACK_IMAGE,
      isPlaceholder: true,
    });
    expect(result.cache).toMatchObject({
      attempted: false,
      stored: false,
    });
  });
});
