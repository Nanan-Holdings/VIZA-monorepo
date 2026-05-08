"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Loader2, PlaneTakeoff, Sparkles, Target } from "lucide-react";
import { TravelItineraryPanel } from "@/components/client/travel/travel-itinerary-panel";
import { TravelPlannerForm } from "@/components/client/travel/travel-planner-form";
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

const HERO_IMAGES = [
  "/globe/singapore.jpg",
  "/globe/tokyo.jpg",
  "/globe/sydney.jpg",
  "/globe/pisa.jpg",
] as const;

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

  const stageIndex = useMemo(() => {
    if (!missingField) return TRAVEL_STAGE_ORDER.length;
    const index = TRAVEL_STAGE_ORDER.indexOf(missingField);
    return index < 0 ? 0 : index;
  }, [missingField]);

  const progressPercent = useMemo(
    () => Math.round((stageIndex / TRAVEL_STAGE_ORDER.length) * 100),
    [stageIndex]
  );

  const selectedCityChips = useMemo(
    () => travelState.cities.filter(Boolean).slice(0, 6),
    [travelState.cities]
  );

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
    <div className="relative mx-auto w-full max-w-6xl px-4 pb-10 pt-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.25),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(14,116,144,0.22),transparent_45%)]" />

      <section className="relative mb-6 overflow-hidden rounded-3xl border border-sky-100/70 bg-gradient-to-br from-[#04244a] via-[#0a3e7a] to-[#0f5ca9] p-5 text-white shadow-[0_18px_55px_rgba(2,20,50,0.35)] md:p-6">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 left-20 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" />

        <div className="relative grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5" />
              AI Travel Studio
            </div>

            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Build a fun trip, not just a form
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-blue-100/95 md:text-base">
              Share your style, budget, route, and preferences. We will turn it into a visual travel plan with flight, hotel, map, and export-ready files.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge className="rounded-full bg-white/20 text-white hover:bg-white/25">
                Application: {applicationId ?? "Not linked"}
              </Badge>
              <Badge className="rounded-full bg-cyan-300/20 text-cyan-50 hover:bg-cyan-300/30">
                Progress {progressPercent}%
              </Badge>
              {selectedCityChips.map((city) => (
                <span
                  className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-xs"
                  key={city}
                >
                  {city}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:gap-3">
            {HERO_IMAGES.map((src, index) => (
              <div
                className="relative overflow-hidden rounded-2xl border border-white/20"
                key={`${src}-${index}`}
              >
                <Image
                  alt="Travel inspiration"
                  className="h-full w-full object-cover"
                  height={280}
                  src={src}
                  width={420}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-[#03346E]/10 p-2 text-[#03346E]">
            <PlaneTakeoff className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Travel Chatbot</h2>
            <p className="text-sm text-gray-500">
              Plan smarter with interactive choices and visual itinerary cards.
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
          <TravelItineraryPanel messages={messages} />
        </CardContent>
      </Card>
    </div>
  );
}
