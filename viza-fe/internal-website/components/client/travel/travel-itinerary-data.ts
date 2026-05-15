"use client";

import {
  buildTravelStateFromMessages,
  parseItineraryText,
  toTravelPayload,
  type ChatLikeMessage,
  type ItineraryDay,
} from "@/lib/travel/planner";
import type { TravelChatMessage } from "@/lib/travel/chat-types";

type ToolItineraryPart = {
  type?: string;
  output?: Array<{
    day?: number | string;
    city?: string;
    activities?: string[];
    food?: string[];
    cost?: string;
  }>;
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

function extractToolItinerary(messages: TravelChatMessage[]): ItineraryDay[] {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "assistant") continue;

    const rawToolPart = message.parts.find(
      (part) => (part as ToolItineraryPart).type === "tool-itinerary"
    ) as ToolItineraryPart | undefined;
    if (!rawToolPart || !Array.isArray(rawToolPart.output)) continue;

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
