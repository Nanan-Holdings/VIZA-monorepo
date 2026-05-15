"use client";

import Image from "next/image";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  MapPin,
  MessageSquare,
  MessageSquarePlus,
  PanelLeft,
  Route,
  Sparkles,
  X,
} from "lucide-react";
import { ChatInput } from "@/components/client/companion/chat-input";
import { ChatMessage } from "@/components/client/companion/chat-message";
import { ScrollToBottomFab } from "@/components/client/companion/scroll-to-bottom-fab";
import { TravelItineraryExperience } from "@/components/client/travel/travel-itinerary-experience";
import { TravelItineraryPanel } from "@/components/client/travel/travel-itinerary-panel";
import { getTravelItineraryFromMessages } from "@/components/client/travel/travel-itinerary-data";
import { TravelPlannerForm } from "@/components/client/travel/travel-planner-form";
import {
  TripRouteMap,
  type TripMapPoint,
} from "@/components/client/travel/trip-route-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FORM_PAYLOAD_PREFIX,
  buildTravelStateFromMessages,
  createTravelFormMessage,
  getFieldQuestionForState,
  nextMissingField,
  toTravelPayload,
  type ChatLikeMessage,
  type ItineraryDay,
  type SelectedFlightOption,
  type SelectedHotelOption,
} from "@/lib/travel/planner";
import type {
  TravelDestinationCard,
  TravelChatInputMessage,
  TravelChatMessage,
  TravelChatMessagePart,
  TravelQuickReply,
  TravelChatStatus,
} from "@/lib/travel/chat-types";

type TravelChatClientProps = {
  applicationId?: string | null;
  embedded?: boolean;
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
  localName?: string;
  intro?: string;
  countryLabel?: string;
  recommendedDays?: string;
  imageSrc: string;
  lat: number;
  lng: number;
  city?: string;
};

type TravelAgentChatResponse = {
  reply?: string;
  mode?: string;
  quick_replies?: TravelQuickReply[];
  cards?: TravelDestinationCard[];
  candidate_payload?: Record<string, unknown>;
  sources?: Array<{ id?: string; title?: string; type?: string }>;
};

type TravelFormCandidatePayload = Parameters<typeof createTravelFormMessage>[0];

type ScrollThumbState = {
  top: number;
  height: number;
  visible: boolean;
};

type TravelChatSession = {
  id: string;
  title: string;
  messages: TravelChatMessage[];
  updatedAt: string;
};

const INITIAL_ASSISTANT_TEXT =
  "嗨，我是 VIZA Travel Buddy。你可以直接告诉我想去的国家、旅行天数、预算和偏好，也可以先让我给你一些目的地灵感。";

const INITIAL_QUICK_REPLIES: TravelQuickReply[] = [
  { label: "我不知道去哪", value: "我不知道去哪" },
  { label: "想去日本", value: "我想去日本" },
  { label: "想去欧洲", value: "我想去欧洲" },
];

const EMPTY_TRAVEL_MESSAGES: TravelChatMessage[] = [];

const TRAVEL_CHAT_ARCHIVE_VERSION = 1;

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
  "/globe/london.jpg",
  "/globe/paris.jpg",
  "/globe/sf.jpg",
  "/globe/pisa.jpg",
  "/globe/egypt.jpg",
] as const;

const DESTINATION_IMAGE_BY_KEY: Record<string, string> = {
  tokyo: "/globe/tokyo.jpg",
  singapore: "/globe/singapore.jpg",
  sydney: "/globe/sydney.jpg",
  london: "/globe/london.jpg",
  paris: "/globe/paris.jpg",
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
  kyoto: [35.0116, 135.7681],
  bangkok: [13.7563, 100.5018],
  hongkong: [22.3193, 114.1694],
};

const LOCAL_NAME_BY_KEY: Record<string, string> = {
  japan: "日本",
  china: "中国",
  singapore: "新加坡",
  australia: "澳大利亚",
  france: "法国",
  italy: "意大利",
  thailand: "泰国",
  indonesia: "印度尼西亚",
  southkorea: "韩国",
  unitedkingdom: "英国",
  unitedstates: "美国",
  malaysia: "马来西亚",
  vietnam: "越南",
  philippines: "菲律宾",
  india: "印度",
  germany: "德国",
  spain: "西班牙",
  switzerland: "瑞士",
  austria: "奥地利",
  greece: "希腊",
  portugal: "葡萄牙",
  europe: "欧洲",
  tokyo: "东京",
  sydney: "悉尼",
  newyork: "纽约",
  nyc: "纽约",
  beijing: "北京",
  sanfrancisco: "旧金山",
  sf: "旧金山",
  pisa: "比萨",
  rome: "罗马",
  paris: "巴黎",
  london: "伦敦",
  dubai: "迪拜",
  seoul: "首尔",
  osaka: "大阪",
  kyoto: "京都",
  phuket: "普吉",
  bali: "巴厘岛",
  bangkok: "曼谷",
  hongkong: "香港",
  "marinabaysands": "滨海湾金沙",
  "sydneyoperahouse": "悉尼歌剧院",
  "shibuyacrossing": "涩谷十字路口",
  "sensojitemple": "浅草寺",
  "tokyoskytree": "东京晴空塔",
  "tsukijioutermarket": "筑地场外市场",
  "gardensbythebay": "滨海湾花园",
  "chinatown": "牛车水",
  "sentosa": "圣淘沙",
  "bondibeach": "邦迪海滩",
  "therocks": "岩石区",
  "darlingharbour": "达令港",
  "eiffeltower": "埃菲尔铁塔",
  "louvremuseum": "卢浮宫",
  "montmartre": "蒙马特",
  "lemarais": "玛黑区",
  "coventgarden": "科文特花园",
  "towerbridge": "塔桥",
  "camdentown": "卡姆登",
  "boroughmarket": "博罗市场",
  "colosseum": "斗兽场",
  "trevifountain": "特莱维喷泉",
  "trastevere": "特拉斯提弗列",
  "vaticanmuseums": "梵蒂冈博物馆",
  "bigben": "大本钟",
};

const PLACE_TEXT_REPLACEMENTS = [
  ["South Korea", "韩国"],
  ["United Kingdom", "英国"],
  ["United States", "美国"],
  ["New Zealand", "新西兰"],
  ["China", "中国"],
  ["Japan", "日本"],
  ["Singapore", "新加坡"],
  ["Australia", "澳大利亚"],
  ["France", "法国"],
  ["Italy", "意大利"],
  ["Thailand", "泰国"],
  ["Indonesia", "印度尼西亚"],
  ["Malaysia", "马来西亚"],
  ["Vietnam", "越南"],
  ["Philippines", "菲律宾"],
  ["India", "印度"],
  ["Germany", "德国"],
  ["Spain", "西班牙"],
  ["Switzerland", "瑞士"],
  ["Austria", "奥地利"],
  ["Greece", "希腊"],
  ["Portugal", "葡萄牙"],
  ["Tokyo", "东京"],
  ["Seoul", "首尔"],
  ["Paris", "巴黎"],
  ["Phuket", "普吉"],
  ["Sydney", "悉尼"],
  ["Beijing", "北京"],
  ["Rome", "罗马"],
  ["London", "伦敦"],
  ["Osaka", "大阪"],
  ["Kyoto", "京都"],
  ["Bangkok", "曼谷"],
  ["Bali", "巴厘岛"],
] as const;

const CITY_CONTEXT: Record<
  string,
  {
    countryEn: string;
    countryZh: string;
    days: string;
    intro: string;
  }
> = {
  tokyo: {
    countryEn: "Japan",
    countryZh: "日本",
    days: "3-5 days",
    intro: "东京融合了潮流街区、传统神社与深夜美食，非常适合第一次日本自由行。",
  },
  kyoto: {
    countryEn: "Japan",
    countryZh: "日本",
    days: "2-4 days",
    intro: "京都适合寺社巡礼、传统街区散步和慢节奏文化体验。",
  },
  osaka: {
    countryEn: "Japan",
    countryZh: "日本",
    days: "2-4 days",
    intro: "大阪美食密集、交通方便，适合把购物、夜景和关西短途串联起来。",
  },
  singapore: {
    countryEn: "Singapore",
    countryZh: "新加坡",
    days: "2-4 days",
    intro: "滨海湾夜景和多元美食非常集中，城市交通高效，适合轻松城市度假。",
  },
  sydney: {
    countryEn: "Australia",
    countryZh: "澳大利亚",
    days: "3-6 days",
    intro: "从歌剧院到海岸线步道，城市与自然结合紧密，适合慢节奏旅行。",
  },
  paris: {
    countryEn: "France",
    countryZh: "法国",
    days: "3-5 days",
    intro: "艺术馆、历史街区与咖啡文化兼具，适合文化体验与城市漫游。",
  },
  london: {
    countryEn: "United Kingdom",
    countryZh: "英国",
    days: "3-5 days",
    intro: "博物馆、音乐剧和经典地标密集，公共交通完善，适合城市探索。",
  },
  rome: {
    countryEn: "Italy",
    countryZh: "意大利",
    days: "3-5 days",
    intro: "古罗马遗迹与美食并存，步行探索体验好，适合历史文化路线。",
  },
  beijing: {
    countryEn: "China",
    countryZh: "中国",
    days: "2-4 days",
    intro: "历史建筑与现代城市共存，景点密度高，适合短途深度游。",
  },
};

function createMessageId(): string {
  return `travel-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createSessionId(): string {
  return `travel-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createInitialTravelMessages(): TravelChatMessage[] {
  return [
    {
      id: createMessageId(),
      role: "assistant",
      parts: [
        { type: "text", text: INITIAL_ASSISTANT_TEXT },
        { type: "quick_replies", quick_replies: INITIAL_QUICK_REPLIES },
      ],
    },
  ];
}

function createTravelChatSession(): TravelChatSession {
  return {
    id: createSessionId(),
    title: "新的旅行对话",
    messages: createInitialTravelMessages(),
    updatedAt: new Date().toISOString(),
  };
}

function getTravelChatArchiveKey(applicationId?: string | null): string {
  return `viza:travel-chat:${TRAVEL_CHAT_ARCHIVE_VERSION}:${
    applicationId ?? "standalone"
  }`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isTravelDestinationCard(value: unknown): value is TravelDestinationCard {
  if (!isRecord(value)) return false;

  return (
    value.type === "destination" &&
    typeof value.title === "string" &&
    typeof value.subtitle === "string" &&
    typeof value.country === "string" &&
    isNullableString(value.city) &&
    isNullableString(value.image_key) &&
    isStringArray(value.highlights) &&
    isNullableString(value.suggested_days) &&
    typeof value.action_label === "string" &&
    isRecord(value.payload)
  );
}

function isTravelQuickReply(value: unknown): value is TravelQuickReply {
  return (
    isRecord(value) &&
    typeof value.label === "string" &&
    typeof value.value === "string"
  );
}

function isTravelChatMessagePart(value: unknown): value is TravelChatMessagePart {
  if (!isRecord(value) || typeof value.type !== "string") return false;

  if (value.type === "text") {
    return typeof value.text === "string";
  }

  if (value.type === "destination_cards") {
    return (
      Array.isArray(value.cards) &&
      value.cards.every((card) => isTravelDestinationCard(card))
    );
  }

  if (value.type === "quick_replies") {
    return (
      Array.isArray(value.quick_replies) &&
      value.quick_replies.every((reply) => isTravelQuickReply(reply))
    );
  }

  return value.type === "planner_form";
}

function isTravelChatMessage(value: unknown): value is TravelChatMessage {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.role === "user" || value.role === "assistant") &&
    Array.isArray(value.parts) &&
    value.parts.every((part) => isTravelChatMessagePart(part))
  );
}

function isTravelChatSession(value: unknown): value is TravelChatSession {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.updatedAt === "string" &&
    Array.isArray(value.messages) &&
    value.messages.every((message) => isTravelChatMessage(message))
  );
}

function createSessionTitle(messages: TravelChatMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === "user");
  const visibleText = firstUserMessage
    ? getVisibleMessageText(firstUserMessage).replace(/\s+/g, " ").trim()
    : "";

  if (!visibleText) return "新的旅行对话";
  return visibleText.length > 22 ? `${visibleText.slice(0, 22)}...` : visibleText;
}

function normalizeTravelChatSession(session: TravelChatSession): TravelChatSession {
  return {
    ...session,
    title: createSessionTitle(session.messages),
    updatedAt: session.updatedAt || new Date().toISOString(),
  };
}

function readArchivedTravelSessions(storageKey: string): TravelChatSession[] {
  if (typeof window === "undefined") {
    return [createTravelChatSession()];
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [createTravelChatSession()];

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.version !== TRAVEL_CHAT_ARCHIVE_VERSION) {
      return [createTravelChatSession()];
    }

    if (Array.isArray(parsed.sessions)) {
      const sessions = parsed.sessions
        .filter(isTravelChatSession)
        .map(normalizeTravelChatSession);
      return sessions.length > 0 ? sessions : [createTravelChatSession()];
    }

    if (Array.isArray(parsed.messages)) {
      const messages = parsed.messages.filter(isTravelChatMessage);
      return [
        normalizeTravelChatSession({
          id: createSessionId(),
          title: "新的旅行对话",
          messages: messages.length > 0 ? messages : createInitialTravelMessages(),
          updatedAt:
            typeof parsed.updatedAt === "string"
              ? parsed.updatedAt
              : new Date().toISOString(),
        }),
      ];
    }

    return [createTravelChatSession()];
  } catch {
    return [createTravelChatSession()];
  }
}

function writeArchivedTravelSessions(
  storageKey: string,
  sessions: TravelChatSession[]
): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        version: TRAVEL_CHAT_ARCHIVE_VERSION,
        updatedAt: new Date().toISOString(),
        sessions,
      })
    );
  } catch {
    // Local persistence is a convenience layer; chat remains usable if storage is full.
  }
}

function getMessageText(message: TravelChatMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function getVisibleMessageText(message: TravelChatMessage): string {
  return getMessageText(message)
    .replace(/<!--__TRAVEL_FORM__:[\s\S]*?-->/g, "")
    .trim();
}

function isDestinationEditRequest(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;

  const asksToChange =
    /(改|修改|换|更换|调整|重选|重新|change|edit|switch|replace|update)/i.test(
      normalized
    );
  if (!asksToChange) return false;

  return (
    /(城市|国家|目的地|行程|路线|city|cities|country|destination|destinations|route|trip)/i.test(
      normalized
    ) || normalized.length <= 24
  );
}

function toChatLikeMessages(messages: TravelChatMessage[]): ChatLikeMessage[] {
  return messages.map((message) => ({
    role: message.role,
    parts: message.parts
      .filter((part) => part.type === "text")
      .map((part) => ({
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

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isStructuredTravelFormText(text: string): boolean {
  return text.includes(FORM_PAYLOAD_PREFIX);
}

function toAgentChatMessages(messages: TravelChatMessage[]) {
  return messages
    .map((message) => ({
      role: message.role,
      content: getMessageText(message),
    }))
    .filter((message) => message.content);
}

function createAssistantMessageFromAgentResponse(
  response: TravelAgentChatResponse
): TravelChatMessage {
  const parts: TravelChatMessage["parts"] = [];
  const reply = response.reply?.trim();

  if (reply) {
    parts.push({ type: "text", text: localizeTravelText(reply) });
  }

  if (response.cards?.length) {
    parts.push({ type: "destination_cards", cards: response.cards });
  }

  if (response.quick_replies?.length) {
    parts.push({
      type: "quick_replies",
      quick_replies: response.quick_replies.map((reply) => ({
        ...reply,
        label: localizeTravelText(reply.label),
        value: localizeTravelText(reply.value),
      })),
    });
  }

  return {
    id: createMessageId(),
    role: "assistant",
    parts: parts.length ? parts : [{ type: "text", text: "我在，想从哪里开始规划？" }],
  };
}

function normalizeCandidateString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function normalizeCandidateStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return normalized.length ? Array.from(new Set(normalized)) : undefined;
}

function coerceTravelFormCandidatePayload(
  payload: Record<string, unknown>
): TravelFormCandidatePayload {
  const result: TravelFormCandidatePayload = {};
  const seedCountry = normalizeCandidateString(payload.seed_country);
  const seedCity = normalizeCandidateString(payload.seed_city);
  const country = normalizeCandidateString(payload.country);
  const countries = normalizeCandidateStringArray(payload.countries);
  const cities = normalizeCandidateStringArray(payload.cities);

  if (seedCountry) {
    result.seed_country = seedCountry;
    if (seedCity) {
      result.seed_city = seedCity;
    }
    return result;
  }

  if (seedCity) result.seed_city = seedCity;
  if (country) result.country = country;
  if (countries) {
    result.countries = countries;
    if (!result.country) {
      result.country = countries.join("、");
    }
  }
  if (cities) {
    result.cities = cities;
    if (cities.length === 1) {
      result.travel_order = cities;
    }
  }

  return result;
}

function withLocalCandidateDisplay(
  payload: TravelFormCandidatePayload
): TravelFormCandidatePayload {
  const display: TravelFormCandidatePayload["display"] = {};

  if (payload.seed_country) {
    display.seed_country = getLocalDisplayName(payload.seed_country);
  }
  if (payload.seed_city) {
    display.seed_city = getLocalDisplayName(payload.seed_city);
  }
  if (payload.country) {
    display.country = getLocalDisplayName(payload.country);
  }
  if (payload.countries?.length) {
    display.countries = payload.countries.map(getLocalDisplayName);
  }
  if (payload.cities?.length) {
    display.cities = payload.cities.map(getLocalDisplayName);
    display.city_labels = Object.fromEntries(
      payload.cities.map((city) => [city, getLocalDisplayName(city)])
    );
  }
  if (payload.travel_order?.length) {
    display.travel_order = payload.travel_order.map(getLocalDisplayName);
  }

  return Object.keys(display).length > 0 ? { ...payload, display } : payload;
}

function normalizeCityKey(city: string): string {
  return city.trim().toLowerCase().replace(/\s+/g, "");
}

function getLocalDisplayName(value: string): string {
  const key = normalizeCityKey(value);
  return LOCAL_NAME_BY_KEY[key] ?? value;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function localizeTravelText(value: string): string {
  return PLACE_TEXT_REPLACEMENTS.reduce((text, [source, target]) => {
    const pattern = new RegExp(`\\b${escapeRegExp(source)}\\b`, "g");
    return text.replace(pattern, target);
  }, value).replace(/\b(\d+(?:-\d+)?)\s*days\b/gi, "$1 天");
}

function localizeSuggestedDays(value: string | null | undefined): string {
  return value ? localizeTravelText(value) : "3-5 天";
}

function getCityContext(city: string) {
  const key = normalizeCityKey(city);
  return CITY_CONTEXT[key] ?? null;
}

function buildMapIntro(kind: MapTarget["kind"], label: string, city?: string): string {
  const context = city ? getCityContext(city) : null;
  if (kind === "hotel") {
    const cityName = city ? getLocalDisplayName(city) : "目的地";
    return `酒店位置已加入路线。建议优先选择靠近交通枢纽或核心景区的住宿，便于压缩通勤时间。${cityName}可按预算分区筛选。`;
  }

  if (kind === "hotspot") {
    const cityName = city ? getLocalDisplayName(city) : "当地";
    return `${cityName}热门景点：${label}。建议错峰前往，优先安排在白天与傍晚两个黄金时段，拍照和步行体验更好。`;
  }

  if (kind === "city") {
    if (context) return context.intro;
    return `${label}是这条路线中的关键停靠城市，可围绕地标、街区步行和本地美食构建 1-3 天节奏。`;
  }

  return `${label}路线总览。建议把同区域景点聚在同一天，减少折返，提高游玩效率。`;
}

function formatMapTargetDisplayName(target: MapTarget | null | undefined): string {
  if (!target) return "旅行地图";
  const label = getLocalDisplayName(target.label);
  if (!target.localName || target.localName === label) return label;
  return `${label} · ${target.localName}`;
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
      label: "目的地",
      done: state.cities.length > 0,
      detail: state.cities.length ? `已选 ${state.cities.length} 个城市` : "等待中",
    },
    {
      id: "dates",
      label: "停留天数",
      done: state.cities.length > 0 && state.cities.every((city) => (state.city_days[city] ?? 0) > 0),
      detail: state.cities.length ? "已按城市安排" : "等待中",
    },
    {
      id: "transport",
      label: "路线顺序",
      done: state.travel_order.length > 1,
      detail: state.travel_order.length > 1
        ? `已连接 ${state.travel_order.length} 站`
        : "等待中",
    },
    {
      id: "stay",
      label: "酒店",
      done: state.selected_hotels.length > 0,
      detail: state.selected_hotels.length
        ? `已选 ${state.selected_hotels.length} 家酒店`
        : "等待中",
    },
    {
      id: "final",
      label: "整体进度",
      done: progressPercent >= 100,
      detail: `完成 ${progressPercent}%`,
    },
  ];
}

export function TravelChatClient({
  applicationId,
  embedded = false,
}: TravelChatClientProps) {
  const archiveKey = useMemo(
    () => getTravelChatArchiveKey(applicationId),
    [applicationId]
  );
  const [sessions, setSessions] = useState<TravelChatSession[]>(() => [
    createTravelChatSession(),
  ]);
  const [activeSessionId, setActiveSessionId] = useState(() => sessions[0].id);
  const [archiveLoadedKey, setArchiveLoadedKey] = useState<string | null>(null);
  const [status, setStatus] = useState<TravelChatStatus>("ready");
  const [activeMapTargetId, setActiveMapTargetId] = useState<string>("");
  const [sessionsPanelOpen, setSessionsPanelOpen] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const messageScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollRailRef = useRef<HTMLDivElement | null>(null);
  const scrollDragOffsetRef = useRef(0);
  const [scrollThumb, setScrollThumb] = useState<ScrollThumbState>({
    top: 0,
    height: 0,
    visible: false,
  });

  const activeSession = useMemo(
    () =>
      sessions.find((session) => session.id === activeSessionId) ?? sessions[0],
    [activeSessionId, sessions]
  );
  const messages = activeSession?.messages ?? EMPTY_TRAVEL_MESSAGES;

  const setSessionMessages = useCallback(
    (
      sessionId: string,
      next:
        | TravelChatMessage[]
        | ((current: TravelChatMessage[]) => TravelChatMessage[])
    ) => {
      setSessions((currentSessions) =>
        currentSessions.map((session) => {
          if (session.id !== sessionId) return session;
          const nextMessages =
            typeof next === "function" ? next(session.messages) : next;
          return normalizeTravelChatSession({
            ...session,
            messages: nextMessages,
            updatedAt: new Date().toISOString(),
          });
        })
      );
    },
    []
  );

  const travelState = useMemo(
    () => buildTravelStateFromMessages(toChatLikeMessages(messages)),
    [messages]
  );
  const latestItinerary = useMemo(
    () => getTravelItineraryFromMessages(messages),
    [messages]
  );
  const missingField = useMemo(() => nextMissingField(travelState), [travelState]);
  const latestVisibleUserText = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === "user") {
        return getVisibleMessageText(message);
      }
    }

    return "";
  }, [messages]);
  const destinationSelectionLocked = useMemo(() => {
    const hasCountry = travelState.countries.length > 0 || Boolean(travelState.country);
    const hasCities = travelState.cities.length > 0;
    const choosingDestination =
      missingField === "country" || missingField === "cities";

    return hasCountry && hasCities && !choosingDestination;
  }, [
    missingField,
    travelState.cities.length,
    travelState.countries.length,
    travelState.country,
  ]);
  const canAddDestinationFromMap =
    !destinationSelectionLocked || isDestinationEditRequest(latestVisibleUserText);

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

  const progressItems = useMemo(
    () => buildProgressItems(progressPercent, travelState),
    [progressPercent, travelState]
  );
  const completedProgressCount = useMemo(
    () => progressItems.filter((item) => item.done).length,
    [progressItems]
  );

  const routeCoordinates = useMemo(
    () =>
      buildRouteCoordinates(travelState.origin_city, orderedCities, travelState.return_city),
    [orderedCities, travelState.origin_city, travelState.return_city]
  );

  const shouldShowRouteLine = useMemo(() => {
    if (orderedCities.length <= 1) return false;
    const confirmedOrder = travelState.travel_order.filter((city) =>
      orderedCities.includes(city)
    );
    return confirmedOrder.length === orderedCities.length;
  }, [orderedCities, travelState.travel_order]);

  const displayRouteCoordinates = useMemo<Array<[number, number]>>(
    () => (shouldShowRouteLine ? routeCoordinates : []),
    [routeCoordinates, shouldShowRouteLine]
  );

  const baseMapTargets = useMemo(() => {
    const targets: MapTarget[] = [];

    if (displayRouteCoordinates.length >= 2) {
      const originLabel = travelState.origin_city?.trim() || orderedCities[0] || "Origin";
      const returnLabel = travelState.return_city?.trim() || orderedCities[orderedCities.length - 1] || "Destination";
      const [routeStartLat, routeStartLng] = displayRouteCoordinates[0];
      targets.push({
        id: "route-overview",
        kind: "route",
        label: "Route Overview",
        subtitle: `${originLabel} → ${returnLabel}`,
        localName: `${getLocalDisplayName(originLabel)} → ${getLocalDisplayName(returnLabel)}`,
        intro: buildMapIntro("route", "Route Overview", orderedCities[0]),
        imageSrc: getCityImage(originLabel, "route"),
        lat: routeStartLat,
        lng: routeStartLng,
        city: orderedCities[0],
      });
    }

    orderedCities.forEach((city, index) => {
      const days = travelState.city_days[city];
      const [lat, lng] = getCityCoordinates(city);
      const context = getCityContext(city);
      targets.push({
        id: `city-${city}-${index}`,
        kind: "city",
        label: city,
        subtitle: days ? `${days} days stay` : "Destination selected",
        localName: getLocalDisplayName(city),
        intro: buildMapIntro("city", city, city),
        countryLabel: context ? `${context.countryZh} (${context.countryEn})` : undefined,
        recommendedDays: context?.days ?? undefined,
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
        localName: getLocalDisplayName(city),
        intro: buildMapIntro("hotel", hotelName, city),
        countryLabel: (() => {
          const context = getCityContext(city);
          return context ? `${context.countryZh} (${context.countryEn})` : undefined;
        })(),
        recommendedDays: (() => {
          const context = getCityContext(city);
          return context?.days;
        })(),
        imageSrc: getCityImage(city, `hotel-${hotel.stay_index}`),
        lat: finalLat,
        lng: finalLng,
        city,
      });
    });

    return targets;
  }, [
    orderedCities,
    displayRouteCoordinates,
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
          localName: getLocalDisplayName(entry.city),
          intro: buildMapIntro("hotspot", entry.spot, entry.city),
          countryLabel: (() => {
            const context = getCityContext(entry.city);
            return context ? `${context.countryZh} (${context.countryEn})` : undefined;
          })(),
          recommendedDays: (() => {
            const context = getCityContext(entry.city);
            return context?.days;
          })(),
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
      localName: getLocalDisplayName(activeCityForHotspots),
      intro: buildMapIntro("hotspot", spot, activeCityForHotspots),
      countryLabel: (() => {
        const context = getCityContext(activeCityForHotspots);
        return context ? `${context.countryZh} (${context.countryEn})` : undefined;
      })(),
      recommendedDays: (() => {
        const context = getCityContext(activeCityForHotspots);
        return context?.days;
      })(),
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

  const activePlannerFormMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (
        message.role === "assistant" &&
        message.parts.some((part) => part.type === "planner_form")
      ) {
        return message.id;
      }
    }

    return null;
  }, [messages]);

  const selectedCityTargets = useMemo(
    () => baseMapTargets.filter((target) => target.kind === "city"),
    [baseMapTargets]
  );

  const selectedHotelTargets = useMemo(
    () => baseMapTargets.filter((target) => target.kind === "hotel"),
    [baseMapTargets]
  );
  const hasFinalItinerary = latestItinerary.length > 0;

  const updateConversationScrollThumb = useCallback(() => {
    const scrollElement = messageScrollRef.current;
    const railElement = scrollRailRef.current;
    if (!scrollElement || !railElement) return;

    const maxScroll = scrollElement.scrollHeight - scrollElement.clientHeight;
    const railHeight = railElement.clientHeight;
    if (maxScroll <= 1 || railHeight <= 0) {
      setShowScrollToBottom(false);
      setScrollThumb((previous) =>
        previous.visible ? { top: 0, height: 0, visible: false } : previous
      );
      return;
    }

    const distanceFromBottom =
      scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight;
    setShowScrollToBottom(distanceFromBottom > 220);

    const thumbHeight = clampNumber(
      (scrollElement.clientHeight / scrollElement.scrollHeight) * railHeight,
      34,
      railHeight
    );
    const maxThumbTop = Math.max(0, railHeight - thumbHeight);
    const thumbTop =
      maxScroll > 0 ? (scrollElement.scrollTop / maxScroll) * maxThumbTop : 0;

    setScrollThumb((previous) => {
      if (
        previous.visible &&
        Math.abs(previous.top - thumbTop) < 0.5 &&
        Math.abs(previous.height - thumbHeight) < 0.5
      ) {
        return previous;
      }

      return {
        top: thumbTop,
        height: thumbHeight,
        visible: true,
      };
    });
  }, []);

  const scrollConversationToThumbTop = useCallback(
    (rawTop: number) => {
      const scrollElement = messageScrollRef.current;
      const railElement = scrollRailRef.current;
      if (!scrollElement || !railElement || !scrollThumb.visible) return;

      const maxScroll = scrollElement.scrollHeight - scrollElement.clientHeight;
      const maxThumbTop = Math.max(0, railElement.clientHeight - scrollThumb.height);
      const nextTop = clampNumber(rawTop, 0, maxThumbTop);
      const ratio = maxThumbTop > 0 ? nextTop / maxThumbTop : 0;

      scrollElement.scrollTop = ratio * maxScroll;
    },
    [scrollThumb.height, scrollThumb.visible]
  );

  const startConversationScrollDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!scrollThumb.visible) return;
      event.preventDefault();

      const railElement = scrollRailRef.current;
      if (!railElement) return;

      const moveThumb = (clientY: number) => {
        const railRect = railElement.getBoundingClientRect();
        scrollConversationToThumbTop(
          clientY - railRect.top - scrollDragOffsetRef.current
        );
      };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        moveThumb(moveEvent.clientY);
      };

      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp, { once: true });
      moveThumb(event.clientY);
    },
    [scrollConversationToThumbTop, scrollThumb.visible]
  );

  const scrollConversationToBottom = useCallback(() => {
    const scrollElement = messageScrollRef.current;
    if (!scrollElement) return;

    scrollElement.scrollTo({
      top: scrollElement.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  const mapPoints = useMemo<TripMapPoint[]>(
    () =>
      allMapTargets
        .filter((target) => target.kind !== "route")
        .map((target) => ({
          id: target.id,
          kind: target.kind as "city" | "hotel" | "hotspot",
          label: target.label,
          subtitle: target.subtitle,
          localName: target.localName,
          intro: target.intro,
          countryLabel: target.countryLabel,
          recommendedDays: target.recommendedDays,
          imageSrc: target.imageSrc,
          lat: target.lat,
          lng: target.lng,
          city: target.city,
        })),
    [allMapTargets]
  );

  useEffect(() => {
    const nextSessions = readArchivedTravelSessions(archiveKey);
    setSessions(nextSessions);
    setActiveSessionId(nextSessions[0].id);
    setActiveMapTargetId("");
    setArchiveLoadedKey(archiveKey);
  }, [archiveKey]);

  useEffect(() => {
    if (archiveLoadedKey !== archiveKey) return;

    writeArchivedTravelSessions(archiveKey, sessions);
  }, [archiveKey, archiveLoadedKey, sessions]);

  useEffect(() => {
    const scrollElement = messageScrollRef.current;
    if (!scrollElement) return;

    const handleScroll = () => updateConversationScrollThumb();
    const timeoutId = window.setTimeout(handleScroll, 80);

    handleScroll();
    scrollElement.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(handleScroll);
    resizeObserver?.observe(scrollElement);

    return () => {
      window.clearTimeout(timeoutId);
      scrollElement.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      resizeObserver?.disconnect();
    };
  }, [
    activeMapTarget?.id,
    messages,
    missingField,
    updateConversationScrollThumb,
  ]);

  useEffect(() => {
    if (allMapTargets.length === 0) {
      setActiveMapTargetId("");
      return;
    }
    if (!allMapTargets.some((target) => target.id === activeMapTargetId)) {
      setActiveMapTargetId(allMapTargets[0].id);
    }
  }, [activeMapTargetId, allMapTargets]);

  const respondToConversation = useCallback(async (
    nextMessages: TravelChatMessage[],
    sessionId: string
  ) => {
    setStatus("submitted");

    try {
      const state = buildTravelStateFromMessages(toChatLikeMessages(nextMessages));
      const payload = toTravelPayload(state);
      const latestUserMessage = [...nextMessages]
        .reverse()
        .find((message) => message.role === "user");
      const latestUserText = latestUserMessage ? getMessageText(latestUserMessage) : "";

      if (!payload) {
        if (isStructuredTravelFormText(latestUserText)) {
          const field = nextMissingField(state) ?? "country";
          const followUp = getFieldQuestionForState(state, field);
          setSessionMessages(sessionId, (prev) => [
            ...prev,
            {
              id: createMessageId(),
              role: "assistant",
              parts: [
                { type: "text", text: followUp },
                { type: "planner_form" },
              ],
            },
          ]);
          return;
        }

        const response = await fetch("/api/travel/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: toAgentChatMessages(nextMessages),
            state,
            locale: "zh-CN",
          }),
        });

        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || "无法生成旅行对话回复。");
        }

        const result = (await response.json()) as TravelAgentChatResponse;
        setSessionMessages(sessionId, (prev) => [
          ...prev,
          createAssistantMessageFromAgentResponse(result),
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

      setSessionMessages(sessionId, (prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: "assistant",
          parts: [{ type: "text", text: content }],
        },
      ]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "未知错误";
      setSessionMessages(sessionId, (prev) => [
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
  }, [setSessionMessages]);

  const sendMessage = useCallback(
    (message: TravelChatInputMessage) => {
      if (status !== "ready") return;
      const sessionId = activeSessionId;
      const userMessage: TravelChatMessage = {
        id: createMessageId(),
        role: message.role,
        parts: message.parts,
      };

      const nextMessages = [...messages, userMessage];
      setSessionMessages(sessionId, nextMessages);
      void respondToConversation(nextMessages, sessionId);
    },
    [activeSessionId, messages, respondToConversation, setSessionMessages, status]
  );

  const sendFreeTextMessage = useCallback(
    (text: string) => {
      const normalized = text.trim();
      if (!normalized) return;

      sendMessage({
        role: "user",
        parts: [{ type: "text", text: normalized }],
      });
    },
    [sendMessage]
  );

  const handleQuickReply = useCallback(
    (reply: TravelQuickReply) => {
      sendFreeTextMessage(reply.value || reply.label);
    },
    [sendFreeTextMessage]
  );

  const handleDestinationCardAction = useCallback(
    (card: TravelDestinationCard) => {
      const payload = withLocalCandidateDisplay(
        coerceTravelFormCandidatePayload(card.payload)
      );
      if (Object.keys(payload).length === 0) {
        sendFreeTextMessage(
          `我想了解 ${getLocalDisplayName(card.city ?? card.country)}`
        );
        return;
      }

      sendMessage({
        role: "user",
        parts: [{ type: "text", text: createTravelFormMessage(payload) }],
      });
    },
    [sendFreeTextMessage, sendMessage]
  );

  const handleAddDestinationFromMap = useCallback(
    (point: TripMapPoint) => {
      if (!canAddDestinationFromMap) return;

      const targetCity = (point.city ?? point.label).trim();
      if (!targetCity) return;

      const cityContext = getCityContext(targetCity);
      const seedCountry =
        cityContext?.countryEn ?? cityContext?.countryZh ?? null;
      const existingCities =
        travelState.cities.length > 0
          ? travelState.cities
          : travelState.seed_city
            ? [travelState.seed_city]
            : [];
      const alreadySelected = existingCities.some(
        (city) => normalizeCityKey(city) === normalizeCityKey(targetCity)
      );

      if (alreadySelected) return;

      const existingCountries =
        travelState.countries.length > 0
          ? travelState.countries
          : travelState.country
            ? [travelState.country]
            : travelState.seed_country
              ? [travelState.seed_country]
              : [];
      const nextCountries =
        seedCountry &&
        !existingCountries.some(
          (country) => normalizeCityKey(country) === normalizeCityKey(seedCountry)
        )
          ? [...existingCountries, seedCountry]
          : existingCountries;
      const nextCities = [...existingCities, targetCity];
      const shouldPrefillDays =
        missingField !== "country" && missingField !== "cities";
      const nextCityDays = shouldPrefillDays
        ? {
            ...travelState.city_days,
            [targetCity]: travelState.city_days[targetCity] ?? 2,
          }
        : travelState.city_days;
      const nextOrder = travelState.travel_order.length
        ? Array.from(new Set([...travelState.travel_order, targetCity]))
        : [];

      const payloadText = createTravelFormMessage({
        country:
          travelState.country ??
          (nextCountries.length > 0 ? nextCountries.join("、") : undefined),
        countries: nextCountries,
        cities: nextCities,
        city_days: nextCityDays,
        travel_order:
          nextOrder.length === nextCities.length ? nextOrder : undefined,
      });

      sendMessage({
        role: "user",
        parts: [{ type: "text", text: payloadText }],
      });
    },
    [
      canAddDestinationFromMap,
      missingField,
      sendMessage,
      travelState.cities,
      travelState.city_days,
      travelState.countries,
      travelState.country,
      travelState.seed_city,
      travelState.seed_country,
      travelState.travel_order,
    ]
  );

  const handleMapPointSelect = useCallback((id: string) => {
    setActiveMapTargetId(id);
  }, []);

  const handleNewSession = useCallback(() => {
    if (status !== "ready") return;
    const nextSession = createTravelChatSession();
    setSessions((currentSessions) => [nextSession, ...currentSessions]);
    setActiveSessionId(nextSession.id);
    setActiveMapTargetId("");
  }, [status]);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      if (status !== "ready" || sessionId === activeSessionId) return;
      setActiveSessionId(sessionId);
      setActiveMapTargetId("");
    },
    [activeSessionId, status]
  );

  return (
    <div
      className={`relative mx-auto flex w-full max-w-[2300px] flex-col overflow-hidden px-3 pb-3 pt-2 md:px-5 ${
        embedded ? "h-full min-h-0" : "h-[calc(100dvh-9rem)] min-h-0"
      }`}
    >
      <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[0.7fr_1.3fr] 2xl:grid-cols-[0.66fr_1.34fr]">
        <div className="relative h-full min-h-0">
          <Button
            className="absolute left-3 top-3 z-30 h-8 w-8 bg-white/95 shadow-sm"
            data-testid="travel-session-toggle"
            onClick={() => setSessionsPanelOpen(true)}
            size="icon"
            title="打开对话进程"
            type="button"
            variant="outline"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>

          {sessionsPanelOpen && (
            <>
              <button
                aria-label="关闭对话进程"
                className="absolute inset-0 z-30 bg-slate-950/10 backdrop-blur-[1px]"
                data-testid="travel-session-backdrop"
                onClick={() => setSessionsPanelOpen(false)}
                type="button"
              />
              <aside
                className="absolute inset-y-0 left-0 z-40 flex w-[320px] max-w-[calc(100%-1rem)] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_18px_60px_rgba(15,23,42,0.22)] backdrop-blur"
                data-testid="travel-chat-session-sidebar"
              >
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      旅行 AI
                    </p>
                    <p className="truncate text-sm font-semibold text-slate-950">
                      对话进程
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      className="h-8 w-8"
                      data-testid="travel-new-session-button"
                      disabled={status !== "ready"}
                      onClick={handleNewSession}
                      size="icon"
                      title="新建旅行对话"
                      type="button"
                      variant="outline"
                    >
                      <MessageSquarePlus className="h-4 w-4" />
                    </Button>
                    <Button
                      className="h-8 w-8"
                      data-testid="travel-session-close-button"
                      onClick={() => setSessionsPanelOpen(false)}
                      size="icon"
                      title="隐藏对话进程"
                      type="button"
                      variant="ghost"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                  {sessions.map((session) => {
                    const active = session.id === activeSessionId;
                    const userMessageCount = session.messages.filter(
                      (message) => message.role === "user"
                    ).length;

                    return (
                      <button
                        aria-current={active ? "true" : undefined}
                        className={`flex w-full flex-col gap-1 rounded-xl border px-3 py-2 text-left transition-colors ${
                          active
                            ? "border-[#03346E] bg-[#03346E] text-white shadow-sm"
                            : "border-transparent bg-slate-50 text-slate-700 hover:border-slate-200 hover:bg-white"
                        }`}
                        data-testid="travel-session-item"
                        disabled={status !== "ready" && !active}
                        key={session.id}
                        onClick={() => handleSelectSession(session.id)}
                        type="button"
                      >
                        <span className="flex items-center gap-2">
                          <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate text-sm font-semibold">
                            {session.title}
                          </span>
                        </span>
                        <span
                          className={`text-xs ${
                            active ? "text-white/70" : "text-slate-500"
                          }`}
                        >
                          {userMessageCount > 0
                            ? `${userMessageCount} 条用户消息`
                            : "还没开始"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </aside>
            </>
          )}

          <Card className="h-full min-h-0 overflow-hidden border-slate-200/80 bg-white/95 shadow-[0_14px_45px_rgba(15,23,42,0.08)] backdrop-blur">
          <CardContent className="h-full p-0">
            <div className="flex h-full min-h-0 flex-col bg-white">
              <div
                className="shrink-0 border-b border-slate-200 bg-white/95 px-4 py-3 pl-10 shadow-sm md:px-6 md:pl-12"
                data-testid="travel-map-summary"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <Sparkles className="h-3 w-3 text-blue-600" />
                      {hasFinalItinerary ? "行程焦点" : "地图焦点"}
                    </p>
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {hasFinalItinerary
                        ? `${latestItinerary.length}天${orderedCities.join("、") || "定制"}行程`
                        : formatMapTargetDisplayName(activeMapTarget)}
                    </p>
                  </div>
                  <Badge className="shrink-0 bg-cyan-100 text-cyan-800 hover:bg-cyan-100">
                    {progressPercent}%
                  </Badge>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#03346E]"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <Badge variant="outline">
                    {status === "submitted" || status === "streaming"
                      ? "规划中"
                      : "就绪"}
                  </Badge>
                  <span>
                    已完成 {completedProgressCount}/{progressItems.length}
                  </span>
                  {selectedCityTargets.length > 0 && (
                    <span className="truncate">
                      城市：{" "}
                      {selectedCityTargets
                        .slice(0, 3)
                        .map((target) => target.localName ?? target.label)
                        .join("、")}
                    </span>
                  )}
                  {selectedHotelTargets.length > 0 && (
                    <span className="truncate">
                      酒店：{" "}
                      {selectedHotelTargets
                        .slice(0, 2)
                        .map((target) => target.label)
                        .join("、")}
                    </span>
                  )}
                  {displayRouteCoordinates.length >= 2 && (
                    <button
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 transition-colors ${
                        activeMapTarget?.id === "route-overview"
                          ? "border-blue-300 bg-blue-50 text-blue-700"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                      onClick={() => setActiveMapTargetId("route-overview")}
                      type="button"
                    >
                      <Route className="h-3 w-3" />
                      路线
                    </button>
                  )}
                </div>
              </div>
              <div className="relative min-h-0 flex-1">
                <div
                  ref={scrollRailRef}
                  className="absolute bottom-5 left-3 top-5 z-20 w-5"
                  data-testid="travel-scroll-rail"
                  onPointerDown={(event) => {
                    scrollDragOffsetRef.current = scrollThumb.height / 2;
                    startConversationScrollDrag(event);
                  }}
                >
                  <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 rounded-full bg-slate-200" />
                  {scrollThumb.visible && (
                    <button
                      aria-label="拖动查看对话位置"
                      className="absolute left-1/2 w-2.5 -translate-x-1/2 cursor-grab rounded-full bg-slate-400/80 transition-colors hover:bg-slate-500 active:cursor-grabbing"
                      data-testid="travel-scroll-thumb"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        const rect = event.currentTarget.getBoundingClientRect();
                        scrollDragOffsetRef.current = event.clientY - rect.top;
                        startConversationScrollDrag(event);
                      }}
                      style={{
                        height: scrollThumb.height,
                        top: scrollThumb.top,
                      }}
                      type="button"
                    />
                  )}
                </div>
                <div
                  ref={messageScrollRef}
                  className="h-full space-y-4 overflow-y-auto overscroll-y-contain py-4 pl-10 pr-4 [scrollbar-width:none] md:py-6 md:pl-12 md:pr-6 [&::-webkit-scrollbar]:hidden"
                  data-testid="travel-message-scroll"
                >
                <div className="space-y-8">
                  {messages.map((message) => {
                const visibleText = getVisibleMessageText(message);
                const destinationCards = message.parts
                  .filter((part) => part.type === "destination_cards")
                  .flatMap((part) => part.cards);
                const quickReplies = message.parts
                  .filter((part) => part.type === "quick_replies")
                  .flatMap((part) => part.quick_replies);
                const showPlannerForm =
                  message.id === activePlannerFormMessageId &&
                  message.parts.some((part) => part.type === "planner_form") &&
                  Boolean(missingField);
                if (
                  !visibleText &&
                  destinationCards.length === 0 &&
                  quickReplies.length === 0 &&
                  !showPlannerForm
                ) {
                  return null;
                }

                return (
                  <div
                    className="w-full"
                    key={message.id}
                  >
                    {visibleText && (
                      <ChatMessage
                        content={visibleText}
                        role={message.role === "user" ? "user" : "agent"}
                      />
                    )}

                    {(destinationCards.length > 0 ||
                      quickReplies.length > 0 ||
                      showPlannerForm) && (
                      <div
                        className={
                          message.role === "user"
                            ? "ml-auto mt-3 max-w-[85%]"
                            : "mt-4 w-full"
                        }
                      >
                        {destinationCards.length > 0 && (
                          <div
                            className="grid gap-3 sm:grid-cols-2"
                            data-testid="travel-destination-cards"
                          >
                            {destinationCards.map((card) => {
                              const rawDisplayCity = card.city ?? card.country;
                              const displayCity = getLocalDisplayName(rawDisplayCity);
                              const suggestedDays = localizeSuggestedDays(
                                card.suggested_days
                              );
                              const actionLabel =
                                card.action_label && card.action_label !== "加入计划"
                                  ? localizeTravelText(card.action_label)
                                  : `加入计划：${displayCity}`;
                              const imageSrc = getCityImage(
                                card.image_key ?? rawDisplayCity,
                                card.title
                              );
                              return (
                                <div
                                  className="group overflow-hidden rounded-xl border border-white/80 bg-white text-slate-900 shadow-[0_12px_30px_rgba(15,23,42,0.12)] transition-transform hover:-translate-y-0.5"
                                  data-testid="travel-destination-card"
                                  key={`${card.country}-${displayCity}-${card.title}`}
                                >
                                  <div className="relative">
                                    <Image
                                      alt={card.title}
                                      className="h-36 w-full object-cover"
                                      height={144}
                                      src={imageSrc}
                                      width={320}
                                    />
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-8 text-white">
                                      <p className="text-sm font-semibold leading-tight">
                                        {card.title}
                                      </p>
                                      <p className="mt-1 flex items-center gap-1 text-[11px] text-white/85">
                                        <MapPin className="h-3 w-3" />
                                        {displayCity} · {suggestedDays}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="space-y-2 p-3">
                                    <p className="line-clamp-3 text-xs leading-relaxed text-slate-600">
                                      {card.subtitle}
                                    </p>
                                    {card.highlights.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {card.highlights.slice(0, 3).map((highlight) => (
                                          <span
                                            className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] text-sky-800"
                                            key={highlight}
                                          >
                                            {highlight}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    <Button
                                      className="w-full bg-[#03346E] text-white hover:bg-[#022b5d]"
                                      disabled={status !== "ready"}
                                      onClick={() => handleDestinationCardAction(card)}
                                      size="sm"
                                      type="button"
                                    >
                                      {actionLabel}
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {quickReplies.length > 0 && message.role === "assistant" && (
                          <div
                            className="mt-3 flex flex-wrap gap-2"
                            data-testid="travel-quick-replies"
                          >
                            {quickReplies.map((reply) => (
                              <Button
                                disabled={status !== "ready"}
                                key={`${message.id}-${reply.label}`}
                                onClick={() => handleQuickReply(reply)}
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                {reply.label}
                              </Button>
                            ))}
                          </div>
                        )}

                        {showPlannerForm && (
                          <div className="mt-3" data-testid="travel-inline-planner-form">
                            <TravelPlannerForm
                              messages={messages}
                              sendMessage={sendMessage}
                              status={status}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
                </div>

                <TravelItineraryPanel messages={messages} variant="compact" />
              </div>
              </div>
                <div
                  className="relative shrink-0 border-t border-slate-200 bg-white/95 px-3 py-2 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur"
                  data-testid="travel-free-chat-form"
                >
                  <ScrollToBottomFab
                    className="-top-20 right-2"
                    hasNewMessage={false}
                    onClick={scrollConversationToBottom}
                    show={showScrollToBottom}
                  />
                  <ChatInput
                    buttonClassName="h-9 w-9"
                    className="mx-auto w-full max-w-[620px] gap-2 rounded-2xl px-4 pb-3 pt-1"
                    disabled={status !== "ready"}
                    isConnecting={status === "submitted" || status === "streaming"}
                    onSend={sendFreeTextMessage}
                    placeholder="问问旅行计划..."
                    textareaClassName="pb-1 pt-2 text-base leading-6"
                  />
                </div>
              </div>
          </CardContent>
          </Card>
        </div>

        <aside className="h-full min-h-0 overflow-hidden rounded-2xl border border-slate-200/90 bg-[#08213b] shadow-[0_14px_45px_rgba(15,23,42,0.12)]">
          <div className="relative h-full min-h-0 overflow-hidden bg-slate-50">
            {hasFinalItinerary ? (
              <TravelItineraryExperience
                activePointId={
                  activeMapTarget?.kind === "route" ? null : activeMapTarget?.id
                }
                itinerary={latestItinerary}
                mapPoints={mapPoints}
                onPointSelect={handleMapPointSelect}
                orderedCities={orderedCities}
                routeCoordinates={displayRouteCoordinates}
                travelState={travelState}
              />
            ) : (
              <TripRouteMap
                activePointId={activeMapTarget?.kind === "route" ? null : activeMapTarget?.id}
                className="h-full w-full"
                onAddDestination={handleAddDestinationFromMap}
                onPointSelect={handleMapPointSelect}
                points={mapPoints}
                routeCoordinates={displayRouteCoordinates}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
