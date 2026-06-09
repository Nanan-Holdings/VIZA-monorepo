import "server-only";

import fs from "node:fs";
import path from "node:path";

import { forwardJsonToTravelBackend } from "./backend";
import {
  buildLocalFirstDestinationPayload,
  findDropdownDestinationContract,
  normalizeDestinationContractKey,
} from "./destination-contracts";
import {
  enrichDestinationWithGooglePlaces,
  isGooglePlacesFallbackEnabled,
  type TravelGoogleEnrichedDestination,
} from "./googlePlacesEnrichmentService";
import type { ItineraryDay } from "./planner";
import {
  createTravelDebugId,
  getErrorMessage,
  logTravelPipelineEvent,
  normalizeTravelPipelineError,
  type TravelPipelineError,
} from "./travel-errors";

export type TravelItineraryFallbackResponse = {
  success: true;
  itinerary: ItineraryDay[];
  reply: ItineraryDay[];
  fallbackUsed: string[];
  warnings: string[];
  debugId: string;
  enrichment?: TravelGoogleEnrichedDestination | null;
  diagnostics: {
    localDestinationHit: boolean;
    localDestinationSufficient: boolean;
    primaryTravelServiceStatus: "success" | "failed" | "skipped";
    googleFallbackAttempted: boolean;
    googleFallbackSucceeded: boolean;
    llmFallbackAttempted: boolean;
    llmFallbackSucceeded: boolean;
    finalSource: "primary_travel_service" | "llm_text";
  };
};

export type TravelItineraryFailureResponse = {
  success: false;
  error: TravelPipelineError;
  warnings: string[];
  debugId: string;
};

type PrimaryResult = {
  itinerary: ItineraryDay[];
  raw: unknown;
};

type GenerateDependencies = {
  primaryGenerator?: (payload: Record<string, unknown>) => Promise<PrimaryResult>;
  googleEnricher?: (
    payload: Record<string, unknown>,
    debugId: string
  ) => Promise<TravelGoogleEnrichedDestination>;
  llmGenerator?: (
    payload: Record<string, unknown>,
    enrichment: TravelGoogleEnrichedDestination | null
  ) => Promise<ItineraryDay[] | null>;
};

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

function normalizeLocale(value: unknown): "zh" | "en" {
  return typeof value === "string" && value.toLowerCase().startsWith("en")
    ? "en"
    : "zh";
}

export function normalizeItineraryFromResponse(raw: unknown): ItineraryDay[] {
  if (!isRecord(raw)) return [];
  const source = Array.isArray(raw.itinerary)
    ? raw.itinerary
    : Array.isArray(raw.reply)
      ? raw.reply
      : Array.isArray(raw.result)
        ? raw.result
        : null;
  if (!source) return [];

  return source
    .map((item): ItineraryDay | null => {
      if (!isRecord(item)) return null;
      const day = item.day;
      const city = typeof item.city === "string" ? item.city.trim() : "";
      if (!city) return null;
      return {
        day: typeof day === "number" || typeof day === "string" ? day : "-",
        city,
        activities: stringArray(item.activities).slice(0, 4),
        food: stringArray(item.food).slice(0, 3),
        cost: typeof item.cost === "string" && item.cost.trim() ? item.cost : "N/A",
      };
    })
    .filter((item): item is ItineraryDay => Boolean(item));
}

function primaryPayloadWithLocalContext(payload: Record<string, unknown>) {
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

function getPrimaryCity(payload: Record<string, unknown>): string | null {
  const travelOrder = stringArray(payload.travel_order);
  if (travelOrder.length > 0) return travelOrder[0];
  const cities = stringArray(payload.cities);
  return cities[0] ?? null;
}

function getCountry(payload: Record<string, unknown>): string | null {
  const countries = stringArray(payload.countries);
  if (countries.length > 0) return countries[0];
  return typeof payload.country === "string" && payload.country.trim()
    ? payload.country.trim()
    : null;
}

function buildAllowedCityKeys(cities: string[]): Set<string> {
  const keys = new Set<string>();
  cities.forEach((city) => {
    const contract = findDropdownDestinationContract(city);
    [
      city,
      contract?.canonicalName,
      contract?.nameEn,
      contract?.nameZh,
      ...(contract?.aliases ?? []),
    ].forEach((value) => {
      const key = normalizeDestinationContractKey(value);
      if (key) keys.add(key);
    });
  });
  return keys;
}

function itineraryUsesOnlyRequestedCities(
  payload: Record<string, unknown>,
  itinerary: ItineraryDay[]
): boolean {
  const requestedCities = stringArray(payload.travel_order).length
    ? stringArray(payload.travel_order)
    : stringArray(payload.cities);
  if (requestedCities.length === 0) return true;
  const allowedKeys = buildAllowedCityKeys(requestedCities);
  return itinerary.every((day) => allowedKeys.has(normalizeDestinationContractKey(day.city)));
}

function getLocalDestinationState(payload: Record<string, unknown>) {
  const city = getPrimaryCity(payload);
  const contract = city ? findDropdownDestinationContract(city) : null;
  if (!contract) {
    return {
      hit: false,
      sufficient: false,
      needsGoogle: true,
    };
  }
  const localPayload = buildLocalFirstDestinationPayload(contract);
  const sufficient =
    localPayload.completenessScore >= 70 &&
    localPayload.attractionCards.length >= 3 &&
    !localPayload.coverImage?.imageUrl.includes("travel-fallback");
  return {
    hit: true,
    sufficient,
    needsGoogle: !sufficient,
  };
}

async function generateWithPrimaryBackend(
  payload: Record<string, unknown>
): Promise<PrimaryResult> {
  const candidatePaths = ["/generate", "/generate-itinerary", "/api/generate"];
  const tried: Array<{ path: string; status: number; detail: string }> = [];

  for (const backendPath of candidatePaths) {
    const response = await forwardJsonToTravelBackend(backendPath, payload);
    const text = await response.text();
    if (response.ok) {
      const raw = text ? (JSON.parse(text) as unknown) : { itinerary: [] };
      const itinerary = normalizeItineraryFromResponse(raw);
      if (itinerary.length === 0) {
        throw new Error("Primary travel service returned an empty itinerary.");
      }
      if (!itineraryUsesOnlyRequestedCities(payload, itinerary)) {
        throw new Error("Primary travel service returned cities outside the requested route.");
      }
      return { itinerary, raw };
    }

    tried.push({
      path: backendPath,
      status: response.status,
      detail: text ? text.slice(0, 300) : "",
    });

    if (response.status !== 404) {
      throw new Error(
        `Primary travel service failed on ${backendPath} with HTTP ${response.status}.`
      );
    }
  }

  throw new Error(
    `No compatible itinerary endpoint found on backend. ${JSON.stringify(tried)}`
  );
}

function readEnvValue(filePath: string, key: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, "utf8");
  const pattern = new RegExp(`^${key}\\s*=\\s*(.*)$`, "m");
  const match = content.match(pattern);
  if (!match?.[1]) return null;
  return match[1].trim().replace(/^["']|["']$/g, "") || null;
}

function getOpenAiApiKey(): string | null {
  const directKey = process.env.OPENAI_API_KEY?.trim();
  if (directKey) return directKey;

  const candidateEnvFiles = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "viza-be/travel-service/.env"),
    path.resolve(process.cwd(), "..", "viza-be/travel-service/.env"),
    path.resolve(process.cwd(), "../..", "viza-be/travel-service/.env"),
  ];

  for (const envFile of candidateEnvFiles) {
    const value = readEnvValue(envFile, "OPENAI_API_KEY");
    if (value) return value;
  }

  return null;
}

function buildLlmFallbackPrompt(
  payload: Record<string, unknown>,
  enrichment: TravelGoogleEnrichedDestination | null
): string {
  const locale = normalizeLocale(payload.locale);
  const cities = stringArray(payload.travel_order).length
    ? stringArray(payload.travel_order)
    : stringArray(payload.cities);
  const cityDays = isRecord(payload.city_days) ? payload.city_days : {};
  const attractionFacts =
    enrichment?.attractions.map((item) => ({
      name: locale === "zh" ? item.nameZh : item.nameEn,
      category: item.category,
      latitude: item.latitude,
      longitude: item.longitude,
    })) ?? [];
  const description =
    locale === "zh" ? enrichment?.descriptionZh : enrichment?.descriptionEn;

  return `You are VIZA Travel AI. Generate a text-only itinerary as JSON.

Rules:
- Return only JSON object: {"itinerary":[{"day":1,"city":"","activities":[],"food":[],"cost":""}]}
- Use ${locale === "zh" ? "Simplified Chinese" : "English"} for every user-facing field.
- Use only the cities supplied by the user.
- Use real, specific places only when present in the factual context.
- Do not invent opening hours, ticket prices, or reservations.
- Use RMB costs.

User payload:
${JSON.stringify(
  {
    country: payload.country,
    cities,
    city_days: cityDays,
    travel_days: payload.travel_days,
    travelers: payload.travelers,
    budget: payload.budget,
    departure_date: payload.departure_date,
    final_note: payload.final_note,
  },
  null,
  2
)}

Google/local factual context:
${JSON.stringify({ description, attractions: attractionFacts }, null, 2)}`;
}

async function generateWithOpenAiFallback(
  payload: Record<string, unknown>,
  enrichment: TravelGoogleEnrichedDestination | null
): Promise<ItineraryDay[] | null> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TRAVEL_ITINERARY_MODEL ?? "gpt-4o-mini",
      temperature: 0.25,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a strict JSON generator for safe travel itineraries. Never output Markdown.",
        },
        { role: "user", content: buildLlmFallbackPrompt(payload, enrichment) },
      ],
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || "OpenAI text itinerary fallback failed.");
  }

  const raw = JSON.parse(text) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = raw.choices?.[0]?.message?.content;
  if (!content) return null;
  return normalizeItineraryFromResponse(JSON.parse(content));
}

export async function generateItineraryWithFallback(
  rawPayload: unknown,
  dependencies: GenerateDependencies = {}
): Promise<TravelItineraryFallbackResponse | TravelItineraryFailureResponse> {
  const debugId = createTravelDebugId();
  const payload = isRecord(rawPayload) ? rawPayload : {};
  const payloadWithContext = primaryPayloadWithLocalContext(payload);
  const fallbackUsed: string[] = [];
  const warnings: string[] = [];
  const diagnostics = {
    localDestinationHit: false,
    localDestinationSufficient: false,
    primaryTravelServiceStatus: "skipped" as "success" | "failed" | "skipped",
    googleFallbackAttempted: false,
    googleFallbackSucceeded: false,
    llmFallbackAttempted: false,
    llmFallbackSucceeded: false,
  };

  const localState = getLocalDestinationState(payload);
  diagnostics.localDestinationHit = localState.hit;
  diagnostics.localDestinationSufficient = localState.sufficient;

  logTravelPipelineEvent({
    debugId,
    stage: "local_destination_lookup",
    message: "Travel itinerary generation started.",
    details: {
      cities: stringArray(payload.cities),
      localDestinationHit: localState.hit,
      localDestinationSufficient: localState.sufficient,
    },
  });

  try {
    const primary = await (dependencies.primaryGenerator ?? generateWithPrimaryBackend)(
      payloadWithContext
    );
    diagnostics.primaryTravelServiceStatus = "success";
    logTravelPipelineEvent({
      debugId,
      stage: "success",
      message: "Primary travel service generated itinerary.",
      details: { itineraryDays: primary.itinerary.length },
    });
    return {
      success: true,
      itinerary: primary.itinerary,
      reply: primary.itinerary,
      fallbackUsed,
      warnings,
      debugId,
      enrichment: null,
      diagnostics: {
        ...diagnostics,
        finalSource: "primary_travel_service",
      },
    };
  } catch (error) {
    diagnostics.primaryTravelServiceStatus = "failed";
    warnings.push("primary_travel_service_unavailable");
    logTravelPipelineEvent({
      debugId,
      stage: "primary_travel_service",
      message: "Primary travel service failed; continuing to fallback.",
      details: { error: getErrorMessage(error) },
    });
  }

  let enrichment: TravelGoogleEnrichedDestination | null = null;
  const city = getPrimaryCity(payload);
  if (city && localState.needsGoogle && isGooglePlacesFallbackEnabled()) {
    diagnostics.googleFallbackAttempted = true;
    try {
      enrichment = await (dependencies.googleEnricher ??
        ((requestPayload, requestDebugId) =>
          enrichDestinationWithGooglePlaces({
            city,
            country: getCountry(requestPayload),
            locale:
              typeof requestPayload.locale === "string"
                ? requestPayload.locale
                : "zh-CN",
            debugId: requestDebugId,
          })))(payload, debugId);
      diagnostics.googleFallbackSucceeded = true;
      fallbackUsed.push("google_places");
      if (enrichment.coverImage.isPlaceholder) warnings.push("photos_pending");
      if (!enrichment.cache.stored) warnings.push("destination_cache_pending");
      logTravelPipelineEvent({
        debugId,
        stage: "google_places_search",
        message: "Google Places fallback succeeded.",
        details: {
          city,
          attractions: enrichment.attractions.length,
          photoProvider: enrichment.coverImage.provider,
          cache: enrichment.cache,
        },
      });
    } catch (error) {
      warnings.push("google_places_unavailable");
      logTravelPipelineEvent({
        debugId,
        stage: "google_places_search",
        message: "Google Places fallback failed; continuing to LLM fallback.",
        details: { city, error: getErrorMessage(error) },
      });
    }
  } else if (city && localState.needsGoogle) {
    warnings.push("google_places_disabled_or_missing_key");
  }

  try {
    diagnostics.llmFallbackAttempted = true;
    const itinerary = await (dependencies.llmGenerator ?? generateWithOpenAiFallback)(
      payload,
      enrichment
    );
    if (!itinerary?.length) {
      throw new Error("LLM text itinerary fallback returned no itinerary.");
    }
    diagnostics.llmFallbackSucceeded = true;
    fallbackUsed.push("llm_text");
    logTravelPipelineEvent({
      debugId,
      stage: "success",
      message: "LLM fallback generated itinerary.",
      details: {
        itineraryDays: itinerary.length,
        fallbackUsed,
        warnings,
      },
    });
    return {
      success: true,
      itinerary,
      reply: itinerary,
      fallbackUsed,
      warnings,
      debugId,
      enrichment,
      diagnostics: {
        ...diagnostics,
        finalSource: "llm_text",
      },
    };
  } catch (error) {
    warnings.push("llm_text_unavailable");
    logTravelPipelineEvent({
      debugId,
      stage: "llm_itinerary_generation",
      message: "All itinerary generation fallbacks failed.",
      details: { error: getErrorMessage(error), warnings },
    });

    return {
      success: false,
      error: normalizeTravelPipelineError({
        code: "TRAVEL_ITINERARY_UNAVAILABLE",
        stage: "llm_itinerary_generation",
        debugId,
        retryable: true,
        fallbackAttempted: true,
        fallbackUsed,
        userMessageZh:
          "旅行服务暂时不可用，备用数据源也没有完成生成。请稍后点击重试；已记录调试信息。",
        userMessageEn:
          "The travel service is temporarily unavailable, and backup generation could not finish. Please retry shortly; debug details were logged.",
      }),
      warnings,
      debugId,
    };
  }
}

export function summarizeItineraryFallbackForLocale(
  response: Pick<TravelItineraryFallbackResponse, "fallbackUsed" | "warnings">,
  locale: "zh" | "en"
): string | null {
  if (response.fallbackUsed.length === 0 && response.warnings.length === 0) {
    return null;
  }
  if (locale === "en") {
    if (response.fallbackUsed.includes("google_places")) {
      return response.warnings.includes("photos_pending")
        ? "I used backup destination data. Some real photos were unavailable, so placeholders are used until verified imagery is available."
        : "I used backup destination data to generate this itinerary.";
    }
    return "I used a text-only backup generator because the travel service was unavailable.";
  }

  if (response.fallbackUsed.includes("google_places")) {
    return response.warnings.includes("photos_pending")
      ? "已使用备用目的地数据生成行程；暂时无法获取真实图片的位置会显示占位图，稍后可补全。"
      : "已使用备用目的地数据生成行程。";
  }
  return "旅行服务暂时不可用，已使用文字备用生成行程。";
}
