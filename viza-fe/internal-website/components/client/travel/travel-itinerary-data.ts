"use client";

import {
  buildTravelStateFromMessages,
  createTravelFormMessage,
  parseItineraryText,
  toTravelPayload,
  type ChatLikeMessage,
  type ItineraryDay,
  type TravelFormPayload,
  type TravelState,
} from "@/lib/travel/planner";
import type {
  TravelChatMessage,
  TravelChatToolItineraryPart,
} from "@/lib/travel/chat-types";

export const TRAVEL_ITINERARY_SHARE_PARAM = "travelShare";

export type TravelItinerarySharePayload = {
  version: 1;
  title: string;
  itinerary: ItineraryDay[];
  travelState: TravelState;
  createdAt: string;
};

function extractAssistantText(messages: TravelChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "assistant") continue;
    const text = message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join("\n")
      .trim();
    if (text) return text;
  }

  return "";
}

function isToolItineraryPart(
  part: TravelChatMessage["parts"][number]
): part is TravelChatToolItineraryPart {
  return part.type === "tool-itinerary";
}

function extractToolItinerary(messages: TravelChatMessage[]): ItineraryDay[] {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "assistant") continue;

    const rawToolPart = message.parts.find(isToolItineraryPart);
    if (!rawToolPart) continue;

    return rawToolPart.output
      .map((item) => ({
        day: item.day ?? "-",
        city: item.city ?? "",
        activities: Array.isArray(item.activities) ? item.activities : [],
        food: Array.isArray(item.food) ? item.food : [],
        cost: item.cost ?? "N/A",
      }))
      .filter((day) => Boolean(day.city));
  }

  return [];
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );
  const binary = window.atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function isItineraryDay(value: unknown): value is ItineraryDay {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;

  return (
    (typeof record.day === "number" || typeof record.day === "string") &&
    typeof record.city === "string" &&
    Array.isArray(record.activities) &&
    record.activities.every((item) => typeof item === "string") &&
    Array.isArray(record.food) &&
    record.food.every((item) => typeof item === "string") &&
    typeof record.cost === "string"
  );
}

function isTravelState(value: unknown): value is TravelState {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;

  return (
    Array.isArray(record.countries) &&
    Array.isArray(record.cities) &&
    record.city_days !== null &&
    typeof record.city_days === "object" &&
    Array.isArray(record.travel_order) &&
    Array.isArray(record.selected_flights) &&
    Array.isArray(record.selected_hotels) &&
    Array.isArray(record.attached_files)
  );
}

function toShareFormPayload(state: TravelState): TravelFormPayload {
  return {
    country: state.country ?? "",
    countries: state.countries,
    cities: state.cities,
    seed_country: state.seed_country ?? undefined,
    seed_city: state.seed_city ?? undefined,
    city_days: state.city_days,
    departure_date: state.departure_date ?? undefined,
    date_flexibility: state.date_flexibility ?? undefined,
    travel_days: state.travel_days ?? undefined,
    travelers: state.travelers ?? undefined,
    budget: state.budget ?? undefined,
    origin_country: state.origin_country ?? undefined,
    origin_city: state.origin_city ?? undefined,
    return_country: state.return_country ?? undefined,
    return_city: state.return_city ?? undefined,
    travel_order: state.travel_order,
    selected_flights: state.selected_flights,
    selected_hotels: state.selected_hotels,
    final_note: state.final_note ?? "",
    attached_files: state.attached_files,
  };
}

export function getTravelItineraryFromMessages(
  messages: TravelChatMessage[]
): ItineraryDay[] {
  const toolItinerary = extractToolItinerary(messages);
  if (toolItinerary.length) return toolItinerary;

  const assistantText = extractAssistantText(messages);
  return parseItineraryText(assistantText);
}

export function buildTravelPayloadFromChat(messages: TravelChatMessage[]) {
  const chatLikeMessages: ChatLikeMessage[] = messages.map((message) => ({
    role: message.role,
    parts: message.parts
      .filter((part) => part.type === "text")
      .map((part) => ({ type: "text", text: part.text ?? "" })),
  }));

  const state = buildTravelStateFromMessages(chatLikeMessages);
  return toTravelPayload(state);
}

export function buildTravelItinerarySharePayload(
  title: string,
  itinerary: ItineraryDay[],
  travelState: TravelState
): TravelItinerarySharePayload {
  return {
    version: 1,
    title,
    itinerary,
    travelState,
    createdAt: new Date().toISOString(),
  };
}

export function encodeTravelItinerarySharePayload(
  payload: TravelItinerarySharePayload
): string {
  return encodeBase64Url(JSON.stringify(payload));
}

export function decodeTravelItinerarySharePayload(
  encoded: string | null
): TravelItinerarySharePayload | null {
  if (!encoded) return null;

  try {
    const parsed = JSON.parse(decodeBase64Url(encoded)) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    const itinerary = record.itinerary;
    const travelState = record.travelState;

    if (
      record.version !== 1 ||
      typeof record.title !== "string" ||
      typeof record.createdAt !== "string" ||
      !Array.isArray(itinerary) ||
      !itinerary.every(isItineraryDay) ||
      !isTravelState(travelState)
    ) {
      return null;
    }

    return {
      version: 1,
      title: record.title,
      itinerary,
      travelState,
      createdAt: record.createdAt,
    };
  } catch {
    return null;
  }
}

export function createTravelShareMessages(
  payload: TravelItinerarySharePayload
): TravelChatMessage[] {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return [
    {
      id: `travel-share-user-${suffix}`,
      role: "user",
      parts: [
        {
          type: "text",
          text: createTravelFormMessage(toShareFormPayload(payload.travelState)),
        },
      ],
    },
    {
      id: `travel-share-assistant-${suffix}`,
      role: "assistant",
      parts: [
        {
          type: "text",
          text: "这是分享的最终行程。我已经把每天安排整理到行程卡片里。",
        },
        {
          type: "tool-itinerary",
          output: payload.itinerary,
        },
      ],
    },
  ];
}
