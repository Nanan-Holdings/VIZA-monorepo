"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Compass,
  Loader2,
  MapPin,
  PlaneTakeoff,
  Route,
  Sparkles,
  Star,
  Target,
} from "lucide-react";
import { TravelItineraryPanel } from "@/components/client/travel/travel-itinerary-panel";
import { TravelPlannerForm } from "@/components/client/travel/travel-planner-form";
import {
  TripRouteMap,
  type TripMapPoint,
} from "@/components/client/travel/trip-route-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FIELD_QUESTIONS,
  buildTravelStateFromMessages,
  nextMissingField,
  toTravelPayload,
  type ChatLikeMessage,
  type ItineraryDay,
  type SelectedFlightOption,
  type SelectedHotelOption,
} from "@/lib/travel/planner";
import type {
  TravelChatInputMessage,
  TravelChatMessage,
  TravelChatStatus,
} from "@/lib/travel/chat-types";

type TravelChatClientProps = {
  applicationId?: string | null;
};

type ProgressItem = {
  id: string;
  label: string;
  done: boolean;
  detail: string;
};

type MapTarget = {
  id: string;
  kind: "route" | "city" | "hotel" | "hotspot";
  label: string;
  subtitle: string;
  imageSrc: string;
  lat: number;
  lng: number;
  city?: string;
};

const INITIAL_ASSISTANT_TEXT =
  "旅行顾问已就绪。请按下方引导逐步填写，我会在信息完整后生成行程。\n\n" +
  FIELD_QUESTIONS.country;

const TRAVEL_STAGE_ORDER = [
  "country",
  "cities",
  "city_days",
  "travelers",
  "budget",
  "origin",
  "return",
  "travel_order",
  "flight_selection",
  "hotel_selection",
  "final_note",
] as const;

const DESTINATION_IMAGE_POOL = [
  "/globe/tokyo.jpg",
  "/globe/singapore.jpg",
  "/globe/sydney.jpg",
  "/globe/nyc.jpg",
  "/globe/beijing.jpg",
  "/globe/sf.jpg",
  "/globe/pisa.jpg",
  "/globe/egypt.jpg",
] as const;

const DESTINATION_IMAGE_BY_KEY: Record<string, string> = {
  tokyo: "/globe/tokyo.jpg",
  singapore: "/globe/singapore.jpg",
  sydney: "/globe/sydney.jpg",
  newyork: "/globe/nyc.jpg",
  nyc: "/globe/nyc.jpg",
  beijing: "/globe/beijing.jpg",
  sanfrancisco: "/globe/sf.jpg",
  sf: "/globe/sf.jpg",
  pisa: "/globe/pisa.jpg",
  egypt: "/globe/egypt.jpg",
  rome: "/globe/pisa.jpg",
};

const HOTSPOTS_BY_CITY: Record<string, string[]> = {
  tokyo: ["Shibuya Crossing", "Senso-ji Temple", "Tokyo Skytree", "Tsukiji Outer Market"],
  singapore: ["Marina Bay Sands", "Gardens by the Bay", "Chinatown", "Sentosa"],
  sydney: ["Sydney Opera House", "Bondi Beach", "The Rocks", "Darling Harbour"],
  newyork: ["Times Square", "Central Park", "Brooklyn Bridge", "SoHo"],
  paris: ["Eiffel Tower", "Louvre Museum", "Montmartre", "Le Marais"],
  london: ["Covent Garden", "Tower Bridge", "Camden Town", "Borough Market"],
  rome: ["Colosseum", "Trevi Fountain", "Trastevere", "Vatican Museums"],
};

const FALLBACK_HOTSPOTS = [
  "Old Town",
  "Night Market",
  "Historic Landmark",
  "Local Food Street",
];

const WORLD_HOTSPOTS: Array<{ city: string; spot: string }> = [
  { city: "London", spot: "Big Ben" },
  { city: "Paris", spot: "Eiffel Tower" },
  { city: "Rome", spot: "Colosseum" },
  { city: "Tokyo", spot: "Shibuya Crossing" },
  { city: "Singapore", spot: "Marina Bay Sands" },
  { city: "Sydney", spot: "Opera House" },
];

const CITY_COORDINATES: Record<string, [number, number]> = {
  tokyo: [35.6762, 139.6503],
  singapore: [1.3521, 103.8198],
  sydney: [-33.8688, 151.2093],
  newyork: [40.7128, -74.006],
  nyc: [40.7128, -74.006],
  beijing: [39.9042, 116.4074],
  sanfrancisco: [37.7749, -122.4194],
  sf: [37.7749, -122.4194],
  pisa: [43.7228, 10.4017],
  rome: [41.9028, 12.4964],
  paris: [48.8566, 2.3522],
  london: [51.5072, -0.1276],
  dubai: [25.2048, 55.2708],
  seoul: [37.5665, 126.978],
  osaka: [34.6937, 135.5023],
  bangkok: [13.7563, 100.5018],
  hongkong: [22.3193, 114.1694],
};

function createMessageId(): string {
  return `travel-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toChatLikeMessages(messages: TravelChatMessage[]): ChatLikeMessage[] {
  return messages.map((message) => ({
    role: message.role,
    parts: message.parts.map((part) => ({
      type: part.type,
      text: part.text,
    })),
  }));
}

function parseItineraryFromResponse(raw: unknown): ItineraryDay[] {
  if (!raw || typeof raw !== "object") return [];
  const record = raw as Record<string, unknown>;

  const source = Array.isArray(record.itinerary)
    ? record.itinerary
    : Array.isArray(record.reply)
      ? record.reply
      : Array.isArray(record.result)
        ? record.result
        : null;

  if (!source) return [];

  return source
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const day = item as Record<string, unknown>;
      return {
        day: (day.day as number | string) ?? "-",
        city: typeof day.city === "string" ? day.city : "",
        activities: Array.isArray(day.activities)
          ? day.activities.map((activity) => String(activity))
          : [],
        food: Array.isArray(day.food) ? day.food.map((food) => String(food)) : [],
        cost: typeof day.cost === "string" ? day.cost : "N/A",
      } satisfies ItineraryDay;
    })
    .filter((day): day is ItineraryDay => Boolean(day && day.city));
}

function formatSelectedFlights(flights: SelectedFlightOption[]): string {
  if (!flights.length) return "- 无";

  return flights
    .map((flight) => {
      if (flight.skip) {
        return `- 路线 ${flight.leg_index}：${flight.from} -> ${flight.to}`;
      }

      const option = flight.option;
      const airline = option?.airline ?? "未命名航司";
      const price = option?.price ? `${option.price} ${option.currency ?? "CNY"}` : "价格未知";

      return `- 路线 ${flight.leg_index}：${flight.from} -> ${flight.to} | ${airline} | ${price}`;
    })
    .join("\n");
}

function formatSelectedHotels(hotels: SelectedHotelOption[]): string {
  if (!hotels.length) return "- 无";

  return hotels
    .map((hotel) => {
      const option = hotel.option;
      const name = option?.name ?? "未命名酒店";
      const price = option?.price_per_night
        ? `${option.price_per_night} ${option.currency ?? "CNY"}/晚`
        : "价格未知";
      const rating =
        option?.rating !== undefined && option?.rating !== null
          ? `评分 ${option.rating}`
          : "暂无评分";

      return `- 城市 ${hotel.stay_index}：${hotel.city}（${hotel.check_in} 到 ${hotel.check_out}，${hotel.nights} 晚）| ${name} | ${price} | ${rating}`;
    })
    .join("\n");
}

function normalizeCityKey(city: string): string {
  return city.trim().toLowerCase().replace(/\s+/g, "");
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getCityImage(city: string, seed: string = "default"): string {
  const key = normalizeCityKey(city);
  const direct = DESTINATION_IMAGE_BY_KEY[key];
  if (direct) return direct;

  const index = hashString(`${key}-${seed}`) % DESTINATION_IMAGE_POOL.length;
  return DESTINATION_IMAGE_POOL[index];
}

function getCityCoordinates(city: string): [number, number] {
  const key = normalizeCityKey(city);
  const direct = CITY_COORDINATES[key];
  if (direct) return direct;

  const seed = hashString(city);
  const lat = (seed % 140) - 60;
  const lng = ((seed * 7) % 320) - 160;
  return [lat, lng];
}

function withOffset(
  center: [number, number],
  seed: string,
  amplitude: number = 0.22
): [number, number] {
  const value = hashString(seed);
  const angle = (value % 360) * (Math.PI / 180);
  const radius = ((value % 100) / 100) * amplitude + 0.06;
  const lat = center[0] + Math.sin(angle) * radius;
  const lng = center[1] + Math.cos(angle) * radius;
  return [lat, lng];
}

function buildRouteCoordinates(
  originCity: string | null,
  orderedCities: string[],
  returnCity: string | null
): Array<[number, number]> {
  if (orderedCities.length === 0) return [];

  const routeCities: string[] = [];
  const origin = originCity?.trim();
  const destination = returnCity?.trim();

  if (origin) routeCities.push(origin);
  routeCities.push(...orderedCities);
  if (destination && routeCities[routeCities.length - 1] !== destination) {
    routeCities.push(destination);
  }

  return routeCities.map((city) => getCityCoordinates(city));
}

function toCoordinate(value: string | number | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getHotspotsForCity(city: string): string[] {
  const key = normalizeCityKey(city);
  const matched = HOTSPOTS_BY_CITY[key];
  if (matched && matched.length) return matched;
  return FALLBACK_HOTSPOTS;
}

function buildProgressItems(
  progressPercent: number,
  state: ReturnType<typeof buildTravelStateFromMessages>
): ProgressItem[] {
  return [
    {
      id: "destinations",
      label: "Destination",
      done: state.cities.length > 0,
      detail: state.cities.length ? `${state.cities.length} city selected` : "Waiting",
    },
    {
      id: "dates",
      label: "City Days",
      done: state.cities.length > 0 && state.cities.every((city) => (state.city_days[city] ?? 0) > 0),
      detail: state.cities.length ? "Days arranged by city" : "Waiting",
    },
    {
      id: "transport",
      label: "Route Path",
      done: state.travel_order.length > 1,
      detail: state.travel_order.length > 1
        ? `${state.travel_order.length} connected stops`
        : "Waiting",
    },
    {
      id: "stay",
      label: "Hotels",
      done: state.selected_hotels.length > 0,
      detail: state.selected_hotels.length
        ? `${state.selected_hotels.length} hotel selected`
        : "Waiting",
    },
    {
      id: "final",
      label: "Overall Progress",
      done: progressPercent >= 100,
      detail: `${progressPercent}% complete`,
    },
  ];
}

export function TravelChatClient({ applicationId }: TravelChatClientProps) {
  const [messages, setMessages] = useState<TravelChatMessage[]>([
    {
      id: createMessageId(),
      role: "assistant",
      parts: [{ type: "text", text: INITIAL_ASSISTANT_TEXT }],
    },
  ]);
  const [status, setStatus] = useState<TravelChatStatus>("ready");
  const [activeMapTargetId, setActiveMapTargetId] = useState<string>("");

  const travelState = useMemo(
    () => buildTravelStateFromMessages(toChatLikeMessages(messages)),
    [messages]
  );
  const missingField = useMemo(() => nextMissingField(travelState), [travelState]);

  const stageIndex = useMemo(() => {
    if (!missingField) return TRAVEL_STAGE_ORDER.length;
    const index = TRAVEL_STAGE_ORDER.indexOf(missingField);
    return index < 0 ? 0 : index;
  }, [missingField]);

  const progressPercent = useMemo(
    () => Math.round((stageIndex / TRAVEL_STAGE_ORDER.length) * 100),
    [stageIndex]
  );

  const orderedCities = useMemo(() => {
    const order = travelState.travel_order.filter((city) => travelState.cities.includes(city));
    return order.length === travelState.cities.length ? order : travelState.cities;
  }, [travelState.cities, travelState.travel_order]);

  const selectedCityChips = useMemo(
    () => orderedCities.filter(Boolean).slice(0, 6),
    [orderedCities]
  );

  const progressItems = useMemo(
    () => buildProgressItems(progressPercent, travelState),
    [progressPercent, travelState]
  );

  const routeCoordinates = useMemo(
    () =>
      buildRouteCoordinates(
        travelState.origin_city,
        orderedCities,
        travelState.return_city
      ),
    [orderedCities, travelState.origin_city, travelState.return_city]
  );

  const showcaseRouteCoordinates = useMemo<Array<[number, number]>>(
    () => WORLD_HOTSPOTS.slice(0, 4).map((entry) => getCityCoordinates(entry.city)),
    []
  );

  const displayRouteCoordinates = useMemo(
    () => (routeCoordinates.length >= 2 ? routeCoordinates : showcaseRouteCoordinates),
    [routeCoordinates, showcaseRouteCoordinates]
  );

  const baseMapTargets = useMemo(() => {
    const targets: MapTarget[] = [];

    if (routeCoordinates.length >= 2) {
      const originLabel = travelState.origin_city?.trim() || orderedCities[0] || "Origin";
      const returnLabel = travelState.return_city?.trim() || orderedCities[orderedCities.length - 1] || "Destination";
      const [routeStartLat, routeStartLng] = routeCoordinates[0];
      targets.push({
        id: "route-overview",
        kind: "route",
        label: "Route Overview",
        subtitle: `${originLabel} → ${returnLabel}`,
        imageSrc: getCityImage(originLabel, "route"),
        lat: routeStartLat,
        lng: routeStartLng,
        city: orderedCities[0],
      });
    }

    orderedCities.forEach((city, index) => {
      const days = travelState.city_days[city];
      const [lat, lng] = getCityCoordinates(city);
      targets.push({
        id: `city-${city}-${index}`,
        kind: "city",
        label: city,
        subtitle: days ? `${days} days stay` : "Destination selected",
        imageSrc: getCityImage(city, `city-${index}`),
        lat,
        lng,
        city,
      });
    });

    travelState.selected_hotels.forEach((hotel) => {
      const lat = toCoordinate(hotel.option.latitude);
      const lng = toCoordinate(hotel.option.longitude);
      const hotelName = hotel.option.name ?? `Hotel ${hotel.stay_index}`;
      const city = hotel.city;
      const cityCenter = getCityCoordinates(city);
      const [fallbackLat, fallbackLng] = withOffset(
        cityCenter,
        `hotel-${hotel.stay_index}-${city}`,
        0.12
      );
      const finalLat = lat ?? fallbackLat;
      const finalLng = lng ?? fallbackLng;

      targets.push({
        id: `hotel-${hotel.stay_index}-${city}`,
        kind: "hotel",
        label: hotelName,
        subtitle: `Hotel in ${city}`,
        imageSrc: getCityImage(city, `hotel-${hotel.stay_index}`),
        lat: finalLat,
        lng: finalLng,
        city,
      });
    });

    return targets;
  }, [
    orderedCities,
    routeCoordinates,
    travelState.city_days,
    travelState.origin_city,
    travelState.return_city,
    travelState.selected_hotels,
  ]);

  const activeBaseTarget = useMemo(
    () => baseMapTargets.find((target) => target.id === activeMapTargetId) ?? null,
    [activeMapTargetId, baseMapTargets]
  );

  const activeCityForHotspots = useMemo(() => {
    if (activeBaseTarget?.city) return activeBaseTarget.city;
    if (orderedCities.length > 0) return orderedCities[0];
    return travelState.selected_hotels[0]?.city ?? null;
  }, [activeBaseTarget?.city, orderedCities, travelState.selected_hotels]);

  const hotspotMapTargets = useMemo(() => {
    if (!activeCityForHotspots) {
      return WORLD_HOTSPOTS.map((entry, index) => {
        const cityCenter = getCityCoordinates(entry.city);
        const [lat, lng] = withOffset(cityCenter, `world-hotspot-${index}`, 0.18);
        return {
          id: `world-hotspot-${index}`,
          kind: "hotspot" as const,
          label: entry.spot,
          subtitle: `Hotspot in ${entry.city}`,
          imageSrc: getCityImage(entry.city, `world-hotspot-${index}`),
          lat,
          lng,
          city: entry.city,
        };
      });
    }

    const cityCenter = getCityCoordinates(activeCityForHotspots);
    return getHotspotsForCity(activeCityForHotspots).map((spot, index) => ({
      id: `hotspot-${activeCityForHotspots}-${index}`,
      kind: "hotspot" as const,
      label: spot,
      subtitle: `Hotspot in ${activeCityForHotspots}`,
      imageSrc: getCityImage(activeCityForHotspots, `hotspot-${index}`),
      ...(() => {
        const [lat, lng] = withOffset(
          cityCenter,
          `hotspot-${activeCityForHotspots}-${index}`,
          0.26
        );
        return { lat, lng };
      })(),
      city: activeCityForHotspots,
    }));
  }, [activeCityForHotspots]);

  const allMapTargets = useMemo(
    () => [...baseMapTargets, ...hotspotMapTargets],
    [baseMapTargets, hotspotMapTargets]
  );

  const activeMapTarget = useMemo(
    () => allMapTargets.find((target) => target.id === activeMapTargetId) ?? null,
    [activeMapTargetId, allMapTargets]
  );

  const selectedCityTargets = useMemo(
    () => baseMapTargets.filter((target) => target.kind === "city"),
    [baseMapTargets]
  );

  const selectedHotelTargets = useMemo(
    () => baseMapTargets.filter((target) => target.kind === "hotel"),
    [baseMapTargets]
  );

  const featuredHotspotCards = useMemo(
    () => hotspotMapTargets.slice(0, 4),
    [hotspotMapTargets]
  );

  const mapPoints = useMemo<TripMapPoint[]>(
    () =>
      allMapTargets
        .filter((target) => target.kind !== "route")
        .map((target) => ({
          id: target.id,
          kind: target.kind as "city" | "hotel" | "hotspot",
          label: target.label,
          subtitle: target.subtitle,
          imageSrc: target.imageSrc,
          lat: target.lat,
          lng: target.lng,
        })),
    [allMapTargets]
  );

  useEffect(() => {
    if (allMapTargets.length === 0) {
      setActiveMapTargetId("");
      return;
    }
    if (!allMapTargets.some((target) => target.id === activeMapTargetId)) {
      setActiveMapTargetId(allMapTargets[0].id);
    }
  }, [activeMapTargetId, allMapTargets]);

  const respondToConversation = useCallback(async (nextMessages: TravelChatMessage[]) => {
    setStatus("submitted");

    try {
      const state = buildTravelStateFromMessages(toChatLikeMessages(nextMessages));
      const payload = toTravelPayload(state);

      if (!payload) {
        const field = nextMissingField(state) ?? "country";
        const followUp = FIELD_QUESTIONS[field];
        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId(),
            role: "assistant",
            parts: [{ type: "text", text: followUp }],
          },
        ]);
        return;
      }

      const response = await fetch("/api/travel/itinerary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "无法生成行程。");
      }

      const result = (await response.json()) as unknown;
      const itinerary = parseItineraryFromResponse(result);
      if (itinerary.length === 0) {
        throw new Error("后端返回的行程为空或格式无效。");
      }

      const content =
        `\`\`\`json\n${JSON.stringify(itinerary, null, 2)}\n\`\`\`\n\n` +
        `### 路线节点\n${formatSelectedFlights(payload.selected_flights)}\n\n` +
        `### 已选酒店\n${formatSelectedHotels(payload.selected_hotels)}`;

      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: "assistant",
          parts: [{ type: "text", text: content }],
        },
      ]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "未知错误";
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: "assistant",
          parts: [
            {
              type: "text",
              text:
                "抱歉，暂时无法生成旅行计划。请检查 travel service 是否启动，以及 API key 是否已配置。\n\n" +
                detail,
            },
          ],
        },
      ]);
    } finally {
      setStatus("ready");
    }
  }, []);

  const sendMessage = useCallback(
    (message: TravelChatInputMessage) => {
      if (status !== "ready") return;
      const userMessage: TravelChatMessage = {
        id: createMessageId(),
        role: message.role,
        parts: message.parts,
      };

      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      void respondToConversation(nextMessages);
    },
    [messages, respondToConversation, status]
  );

  return (
    <div className="relative mx-auto w-full max-w-[1900px] px-4 pb-10 pt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-[#03346E]/10 p-2 text-[#03346E]">
            <PlaneTakeoff className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Travel Chatbot</h2>
            <p className="text-sm text-gray-500">
              Left side for chat, right side for a larger interactive route map.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {status === "submitted" || status === "streaming" ? "Working" : "Ready"}
          </Badge>
          <Badge className="gap-1" variant="outline">
            <Target className="h-3 w-3" />
            {missingField ? `Next: ${FIELD_QUESTIONS[missingField]}` : "Itinerary ready"}
          </Badge>
          {(status === "submitted" || status === "streaming") && (
            <Loader2 className="h-4 w-4 animate-spin text-[#03346E]" />
          )}
          <Button asChild size="sm" variant="outline">
            <Link href="/client/application">Back to Application</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.78fr_1.22fr]">
        <Card className="overflow-hidden border-slate-200/80 bg-white/95 shadow-[0_14px_45px_rgba(15,23,42,0.08)] backdrop-blur">
          <CardContent className="space-y-4 p-4 md:p-6">
            <div className="space-y-3">
              {messages.map((message) => {
                const text = message.parts
                  .filter((part) => part.type === "text")
                  .map((part) => part.text)
                  .join("\n")
                  .trim();
                if (!text) return null;

                return (
                  <div
                    className={
                      message.role === "user"
                        ? "ml-auto w-fit max-w-[88%] rounded-2xl rounded-br-md bg-[#03346E] px-4 py-2.5 text-sm text-white shadow-sm"
                        : "mr-auto w-fit max-w-[92%] rounded-2xl rounded-bl-md border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800"
                    }
                    key={message.id}
                  >
                    <pre className="whitespace-pre-wrap break-words font-sans leading-relaxed">{text}</pre>
                  </div>
                );
              })}
            </div>

            <TravelPlannerForm messages={messages} sendMessage={sendMessage} status={status} />
            <TravelItineraryPanel messages={messages} variant="compact" />
          </CardContent>
        </Card>

        <aside className="xl:sticky xl:top-4 xl:self-start">
          <Card className="overflow-hidden border-slate-200/90 bg-gradient-to-b from-white to-slate-50 shadow-[0_14px_45px_rgba(15,23,42,0.1)]">
            <CardContent className="space-y-4 p-4">
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur">
                <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  <Sparkles className="h-3 w-3 text-[#2563eb]" />
                  Trip Atlas
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  {activeMapTarget?.label ?? "Travel Map"}
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  {activeMapTarget?.subtitle ?? "Choose route, city, hotel, or hotspots"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge className="bg-[#03346E] text-white hover:bg-[#03346E]">
                    App: {applicationId ? "Linked" : "Not linked"}
                  </Badge>
                  <Badge className="bg-cyan-100 text-cyan-800 hover:bg-cyan-100">
                    Progress {progressPercent}%
                  </Badge>
                  <Badge variant="outline">
                    {activeMapTarget?.kind ?? "map"}
                  </Badge>
                  {selectedCityChips.map((city) => (
                    <span
                      className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600"
                      key={`map-chip-${city}`}
                    >
                      {city}
                    </span>
                  ))}
                </div>
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-[#08213b] p-1 shadow-[0_12px_34px_rgba(2,15,33,0.35)]">
                <div className="h-[68vh] min-h-[560px] overflow-hidden rounded-xl border border-white/20 bg-slate-50">
                  <TripRouteMap
                    activePointId={activeMapTarget?.kind === "route" ? null : activeMapTarget?.id}
                    className="h-full w-full"
                    onPointSelect={(id) => setActiveMapTargetId(id)}
                    points={mapPoints}
                    routeCoordinates={displayRouteCoordinates}
                  />
                </div>

                <div className="absolute bottom-3 left-3 rounded-full border border-white/25 bg-black/35 px-3 py-1 text-[11px] font-medium text-white backdrop-blur">
                  Route + Hotspot Mode
                </div>
              </div>

              {featuredHotspotCards.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-slate-500">
                    Visual Hotspots {activeCityForHotspots ? `in ${activeCityForHotspots}` : ""}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {featuredHotspotCards.map((target) => (
                      <button
                        className={`group relative overflow-hidden rounded-xl border transition-all ${
                          activeMapTargetId === target.id
                            ? "border-blue-300 shadow-[0_8px_22px_rgba(59,130,246,0.25)]"
                            : "border-slate-200 hover:border-slate-300 hover:shadow-[0_6px_18px_rgba(15,23,42,0.14)]"
                        }`}
                        key={target.id}
                        onClick={() => setActiveMapTargetId(target.id)}
                        type="button"
                      >
                        <Image
                          alt={target.label}
                          className="h-20 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          height={120}
                          src={target.imageSrc}
                          width={200}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
                        <div className="absolute bottom-1.5 left-2 right-2 text-left text-[11px] text-white">
                          <p className="truncate font-medium">{target.label}</p>
                          <p className="truncate text-[10px] text-blue-100">{target.subtitle}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {routeCoordinates.length >= 2 && (
                <button
                  className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    activeMapTarget?.id === "route-overview"
                      ? "border-blue-300 bg-blue-50 text-blue-700"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                  onClick={() => setActiveMapTargetId("route-overview")}
                  type="button"
                >
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Route className="h-3.5 w-3.5" />
                    Route Overview
                  </span>
                </button>
              )}

              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-medium text-slate-500">Selected Cities</p>
                  <div className="space-y-1.5">
                    {selectedCityTargets.length === 0 && (
                      <span className="text-xs text-slate-400">No city selected yet.</span>
                    )}
                    {selectedCityTargets.map((target) => (
                      <button
                        className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors ${
                          activeMapTargetId === target.id
                            ? "border-blue-300 bg-blue-50 text-blue-700"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                        key={target.id}
                        onClick={() => setActiveMapTargetId(target.id)}
                        type="button"
                      >
                        <Image
                          alt={target.label}
                          className="h-9 w-11 rounded-md object-cover"
                          height={36}
                          src={target.imageSrc}
                          width={44}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{target.label}</p>
                          <p className="truncate text-[10px] text-slate-500">{target.subtitle}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium text-slate-500">Selected Hotels</p>
                  <div className="space-y-1.5">
                    {selectedHotelTargets.length === 0 && (
                      <p className="text-xs text-slate-400">No hotel selected yet.</p>
                    )}
                    {selectedHotelTargets.map((target) => (
                      <button
                        className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors ${
                          activeMapTargetId === target.id
                            ? "border-blue-300 bg-blue-50 text-blue-700"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                        key={target.id}
                        onClick={() => setActiveMapTargetId(target.id)}
                        type="button"
                      >
                        <Image
                          alt={target.label}
                          className="h-9 w-11 rounded-md object-cover"
                          height={36}
                          src={target.imageSrc}
                          width={44}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{target.label}</p>
                          <p className="truncate text-[10px] text-slate-500">{target.subtitle}</p>
                        </div>
                        <Building2 className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-400" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-slate-500">
                  Popular Spots {activeCityForHotspots ? `in ${activeCityForHotspots}` : ""}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {hotspotMapTargets.length === 0 && (
                    <span className="text-xs text-slate-400">Select a city to preview hotspots.</span>
                  )}
                  {hotspotMapTargets.map((target) => (
                    <button
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        activeMapTargetId === target.id
                          ? "border-blue-300 bg-blue-50 text-blue-700"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                      key={target.id}
                      onClick={() => setActiveMapTargetId(target.id)}
                      type="button"
                    >
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {target.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <Compass className="h-3.5 w-3.5 text-slate-400" />
                  Progress Tracker
                </p>
                <div className="space-y-2">
                  {progressItems.map((item) => (
                    <div className="flex items-start justify-between gap-2" key={item.id}>
                      <div className="flex items-center gap-2">
                        <CheckCircle2
                          className={`h-4 w-4 ${item.done ? "text-emerald-500" : "text-slate-300"}`}
                        />
                        <span className="text-xs font-medium text-slate-700">{item.label}</span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                        {item.done && <Star className="h-3 w-3 text-amber-400" />}
                        {item.detail}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
