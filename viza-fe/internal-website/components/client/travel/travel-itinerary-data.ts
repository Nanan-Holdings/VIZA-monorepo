"use client";

import {
  buildTravelStateFromMessages,
  parseItineraryText,
  toTravelPayload,
  type ChatLikeMessage,
  type ItineraryDay,
  type TravelState,
} from "@/lib/travel/planner";
import type {
  TravelChatMessage,
  TravelChatToolItineraryPart,
} from "@/lib/travel/chat-types";

export const TRAVEL_ITINERARY_SHARE_PARAM = "travelShare";
const ITINERY_ROWS_PAYLOAD_PREFIX = "__TRAVEL_ITINERY_ROWS__:";

export type TravelItineryShareRow = {
  time?: string;
  type: string;
  date: string;
  route: string;
  name: string;
  details: string;
  contact: string;
};

export type TravelItinerarySharePayload = {
  version: 1;
  title: string;
  itinerary: ItineraryDay[];
  travelState: TravelState;
  itineryRows?: TravelItineryShareRow[];
  locale?: "zh" | "en";
  createdAt: string;
};

function getLatestAssistantMessage(
  messages: TravelChatMessage[]
): TravelChatMessage | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role === "assistant") return message;
  }

  return null;
}

function isToolItineraryPart(
  part: TravelChatMessage["parts"][number]
): part is TravelChatToolItineraryPart {
  return part.type === "tool-itinerary";
}

function extractToolItinerary(message: TravelChatMessage): ItineraryDay[] {
  const rawToolPart = message.parts.find(isToolItineraryPart);
  if (!rawToolPart) return [];

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

function isTravelItineryShareRow(value: unknown): value is TravelItineryShareRow {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;

  return (
    (record.time === undefined || typeof record.time === "string") &&
    typeof record.type === "string" &&
    typeof record.date === "string" &&
    typeof record.route === "string" &&
    typeof record.name === "string" &&
    typeof record.details === "string" &&
    typeof record.contact === "string"
  );
}

function createShareUserMessage(payload: TravelItinerarySharePayload): string {
  if (payload.locale !== "en") {
    // The Chinese planner sentence is also the canonical parser-compatible
    // representation used by older shared links.
    const state = payload.travelState;
    const destinations = state.cities.length
      ? `我选择了城市：${state.cities.join("、")}。`
      : state.countries.length
        ? `我选择了国家：${state.countries.join("、")}。`
        : "我更新了旅行信息。";
    return destinations;
  }

  const state = payload.travelState;
  if (state.origin_city || state.return_city) {
    const originCity = state.origin_city ?? "the departure city";
    const originCountry = state.origin_country
      ? `, ${state.origin_country}`
      : "";
    const returnCity = state.return_city ?? "the return city";
    const returnCountry = state.return_country ? `, ${state.return_country}` : "";
    return `Departure: ${originCity}${originCountry}; return: ${returnCity}${returnCountry}.`;
  }
  if (state.cities.length) {
    return `I selected these cities: ${state.cities.join(", ")}.`;
  }
  if (state.countries.length) {
    return `I selected these countries: ${state.countries.join(", ")}.`;
  }
  return "I updated the travel details.";
}

export function getTravelItineraryFromMessages(
  messages: TravelChatMessage[]
): ItineraryDay[] {
  const latestAssistantMessage = getLatestAssistantMessage(messages);
  if (!latestAssistantMessage) return [];

  const toolItinerary = extractToolItinerary(latestAssistantMessage);
  if (toolItinerary.length) return toolItinerary;

  const assistantText = latestAssistantMessage.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
  return parseItineraryText(assistantText);
}

export function getTravelItineryRowsFromMessages(
  messages: TravelChatMessage[]
): TravelItineryShareRow[] {
  const latestAssistantMessage = getLatestAssistantMessage(messages);
  if (!latestAssistantMessage) return [];

  const assistantText = latestAssistantMessage.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
  const prefix = `<!--${ITINERY_ROWS_PAYLOAD_PREFIX}`;
  const startIndex = assistantText.indexOf(prefix);
  if (startIndex < 0) return [];

  const endIndex = assistantText.indexOf("-->", startIndex + prefix.length);
  if (endIndex <= startIndex) return [];

  const rawJson = assistantText.slice(startIndex + prefix.length, endIndex).trim();
  if (!rawJson) return [];

  try {
    const parsed = JSON.parse(rawJson) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isTravelItineryShareRow);
  } catch {
    return [];
  }
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
  travelState: TravelState,
  itineryRows: TravelItineryShareRow[] = [],
  locale: "zh" | "en" = "zh"
): TravelItinerarySharePayload {
  return {
    version: 1,
    title,
    itinerary,
    travelState,
    itineryRows,
    locale,
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
    const itineryRows = record.itineryRows;

    if (
      record.version !== 1 ||
      typeof record.title !== "string" ||
      typeof record.createdAt !== "string" ||
      !Array.isArray(itinerary) ||
      !itinerary.every(isItineraryDay) ||
      !isTravelState(travelState) ||
      (itineryRows !== undefined &&
        (!Array.isArray(itineryRows) ||
          !itineryRows.every(isTravelItineryShareRow)))
    ) {
      return null;
    }

    return {
      version: 1,
      title: record.title,
      itinerary,
      travelState,
      itineryRows: Array.isArray(itineryRows) ? itineryRows : undefined,
      locale: record.locale === "en" ? "en" : "zh",
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
  const rowComment = payload.itineryRows?.length
    ? `\n\n<!--${ITINERY_ROWS_PAYLOAD_PREFIX}${JSON.stringify(payload.itineryRows)}-->`
    : "";
  return [
    {
      id: `travel-share-user-${suffix}`,
      role: "user",
      parts: [
        {
          type: "text",
          text: createShareUserMessage(payload),
        },
      ],
    },
    {
      id: `travel-share-assistant-${suffix}`,
      role: "assistant",
      parts: [
        {
          type: "text",
          text:
            payload.locale === "en"
              ? `This is the shared final itinerary. I organized each day into itinerary cards.${rowComment}`
              : `这是分享的最终行程。我已经把每天安排整理到行程卡片里。${rowComment}`,
        },
        {
          type: "tool-itinerary",
          output: payload.itinerary,
        },
      ],
    },
  ];
}
