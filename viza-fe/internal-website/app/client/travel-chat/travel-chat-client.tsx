"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Loader2, PlaneTakeoff } from "lucide-react";
import { TravelItineraryPanel } from "@/components/client/travel/travel-itinerary-panel";
import { TravelPlannerForm } from "@/components/client/travel/travel-planner-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  applicationId: string;
};

const INITIAL_ASSISTANT_TEXT =
  "旅行顾问已就绪。请按下方引导逐步填写，我会在信息完整后生成行程。\n\n" +
  FIELD_QUESTIONS.country;

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
        return `- 航段 ${flight.leg_index}：${flight.from} -> ${flight.to}（${flight.departure_date}）已跳过`;
      }

      const option = flight.option;
      const airline = option?.airline ?? "未命名航司";
      const price = option?.price ? `${option.price} ${option.currency ?? "CNY"}` : "价格未知";
      const departure = option?.departure ?? flight.departure_date;

      return `- 航段 ${flight.leg_index}：${flight.from} -> ${flight.to} | ${airline} | ${price} | 出发 ${departure}`;
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

export function TravelChatClient({ applicationId }: TravelChatClientProps) {
  const [messages, setMessages] = useState<TravelChatMessage[]>([
    {
      id: createMessageId(),
      role: "assistant",
      parts: [{ type: "text", text: INITIAL_ASSISTANT_TEXT }],
    },
  ]);
  const [status, setStatus] = useState<TravelChatStatus>("ready");

  const travelState = useMemo(
    () => buildTravelStateFromMessages(toChatLikeMessages(messages)),
    [messages]
  );
  const missingField = useMemo(() => nextMissingField(travelState), [travelState]);

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
        `### 已选航班\n${formatSelectedFlights(payload.selected_flights)}\n\n` +
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
    <div className="mx-auto w-full max-w-5xl px-4 pb-10 pt-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-[#03346E]/10 p-2 text-[#03346E]">
            <PlaneTakeoff className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Travel Chatbot</h1>
            <p className="text-sm text-gray-500">
              Application: {applicationId} · 仅在申请提交后可用
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/client/application">Back to Application</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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
                    ? "ml-auto w-fit max-w-[85%] rounded-xl rounded-br-sm bg-[#03346E] px-4 py-2 text-sm text-white"
                    : "mr-auto w-fit max-w-[90%] rounded-xl rounded-bl-sm bg-gray-100 px-4 py-2 text-sm text-gray-900"
                }
                key={message.id}
              >
                <pre className="whitespace-pre-wrap break-words font-sans">{text}</pre>
              </div>
            );
          })}

          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Badge variant="secondary">
              {status === "submitted" || status === "streaming"
                ? "Working"
                : "Ready"}
            </Badge>
            {missingField ? `Next: ${FIELD_QUESTIONS[missingField]}` : "Itinerary ready"}
            {(status === "submitted" || status === "streaming") && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
          </div>

          <TravelPlannerForm messages={messages} sendMessage={sendMessage} status={status} />
          <TravelItineraryPanel messages={messages} />
        </CardContent>
      </Card>
    </div>
  );
}
