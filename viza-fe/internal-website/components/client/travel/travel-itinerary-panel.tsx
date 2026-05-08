"use client";

import { DownloadIcon, MapPinIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  buildTravelStateFromMessages,
  parseItineraryText,
  toTravelPayload,
  type ChatLikeMessage,
  type ItineraryDay,
} from "@/lib/travel/planner";
import type { TravelChatMessage } from "@/lib/travel/chat-types";
import { Button } from "@/components/ui/button";

type TravelItineraryPanelProps = {
  messages: TravelChatMessage[];
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
      (part) => (part as { type?: string }).type === "tool-itinerary"
    ) as unknown;
    if (!rawToolPart || typeof rawToolPart !== "object") continue;

    const toolPart = rawToolPart as {
      output?: Array<{
        day?: number | string;
        city?: string;
        activities?: string[];
        food?: string[];
        cost?: string;
      }>;
    };

    if (!Array.isArray(toolPart.output) || toolPart.output.length === 0) continue;

    return toolPart.output
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

function buildTravelPayloadFromChat(messages: TravelChatMessage[]) {
  const chatLikeMessages: ChatLikeMessage[] = messages.map((message) => ({
    role: message.role,
    parts: message.parts
      .filter((part) => part.type === "text")
      .map((part) => ({ type: "text", text: part.text ?? "" })),
  }));

  const state = buildTravelStateFromMessages(chatLikeMessages);
  return toTravelPayload(state);
}

async function downloadBlob(
  endpoint: "/api/travel/download-word" | "/api/travel/download-pdf",
  payload: unknown,
  fallbackFilename: string
) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Failed to download ${fallbackFilename}.`);
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get("content-disposition");
  const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/i);
  const filename = filenameMatch?.[1] ?? fallbackFilename;

  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(blobUrl);
}

function findFirstDayIndexByCity(itinerary: ItineraryDay[], city: string): number {
  const index = itinerary.findIndex((day) => day.city === city);
  return index >= 0 ? index : 0;
}

export function TravelItineraryPanel({ messages }: TravelItineraryPanelProps) {
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [isDownloadingWord, setIsDownloadingWord] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const itinerary = useMemo(() => {
    const toolItinerary = extractToolItinerary(messages);
    if (toolItinerary.length) return toolItinerary;

    const assistantText = extractAssistantText(messages);
    return parseItineraryText(assistantText);
  }, [messages]);

  const payload = useMemo(() => buildTravelPayloadFromChat(messages), [messages]);
  const activeDay = itinerary[activeDayIndex] ?? itinerary[0];
  const uniqueCities = useMemo(
    () => Array.from(new Set(itinerary.map((day) => day.city))),
    [itinerary]
  );

  useEffect(() => {
    setActiveDayIndex(0);
  }, [itinerary]);

  if (!itinerary.length) {
    return null;
  }

  return (
    <div
      className="mt-3 w-full rounded-xl border border-border/40 bg-card/40 p-4 md:p-5"
      data-testid="travel-itinerary-panel"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-foreground text-sm md:text-base">
          Travel Plan
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={!payload || isDownloadingWord}
            onClick={async () => {
              if (!payload) {
                toast.error("Please complete trip information before exporting.");
                return;
              }
              setIsDownloadingWord(true);
              try {
                await downloadBlob(
                  "/api/travel/download-word",
                  payload,
                  "travel-itinerary.docx"
                );
              } catch (error) {
                const message =
                  error instanceof Error
                    ? error.message
                    : "Failed to download Word file.";
                toast.error(message);
              } finally {
                setIsDownloadingWord(false);
              }
            }}
            size="sm"
            variant="outline"
          >
            <DownloadIcon className="size-3.5" />
            Word
          </Button>
          <Button
            disabled={!payload || isDownloadingPdf}
            onClick={async () => {
              if (!payload) {
                toast.error("Please complete trip information before exporting.");
                return;
              }
              setIsDownloadingPdf(true);
              try {
                await downloadBlob(
                  "/api/travel/download-pdf",
                  payload,
                  "travel-itinerary.pdf"
                );
              } catch (error) {
                const message =
                  error instanceof Error
                    ? error.message
                    : "Failed to download PDF file.";
                toast.error(message);
              } finally {
                setIsDownloadingPdf(false);
              }
            }}
            size="sm"
            variant="outline"
          >
            <DownloadIcon className="size-3.5" />
            PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-2">
          {itinerary.map((day, index) => {
            const active = index === activeDayIndex;
            return (
              <button
                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                  active
                    ? "border-blue-500/60 bg-blue-500/10"
                    : "border-border/40 hover:bg-muted/45"
                }`}
                key={`${day.day}-${day.city}-${index}`}
                onClick={() => setActiveDayIndex(index)}
                type="button"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-sm">
                    Day {day.day} · {day.city}
                  </span>
                  <span className="text-muted-foreground text-xs">{day.cost}</span>
                </div>
                <div className="mt-1 text-muted-foreground text-xs">
                  {day.activities.join(" · ")}
                </div>
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <div className="h-72 overflow-hidden rounded-lg border border-border/40 bg-background">
            {activeDay ? (
              <iframe
                className="h-full w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.google.com/maps?q=${encodeURIComponent(activeDay.city)}&output=embed`}
                title={`map-${activeDay.city}`}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                Map unavailable
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {uniqueCities.map((city) => {
              const isActive = activeDay?.city === city;
              return (
                <button
                  className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors ${
                    isActive
                      ? "border-blue-500/60 bg-blue-500/10 text-blue-600 dark:text-blue-300"
                      : "border-border/40 text-muted-foreground hover:bg-muted/45"
                  }`}
                  key={city}
                  onClick={() =>
                    setActiveDayIndex(findFirstDayIndexByCity(itinerary, city))
                  }
                  type="button"
                >
                  <MapPinIcon className="size-3.5" />
                  {city}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
