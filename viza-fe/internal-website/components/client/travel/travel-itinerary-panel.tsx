"use client";

import Image from "next/image";
import {
  CalendarDaysIcon,
  DownloadIcon,
  MapPinIcon,
  SparklesIcon,
  WalletIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { type ItineraryDay } from "@/lib/travel/planner";
import type { TravelChatMessage } from "@/lib/travel/chat-types";
import { Button } from "@/components/ui/button";
import {
  buildTravelPayloadFromChat,
  getTravelItineraryFromMessages,
} from "@/components/client/travel/travel-itinerary-data";

type TravelItineraryPanelProps = {
  messages: TravelChatMessage[];
  variant?: "full" | "compact";
};

const CITY_IMAGE_POOL = [
  "/globe/tokyo.jpg",
  "/globe/singapore.jpg",
  "/globe/sydney.jpg",
  "/globe/nyc.jpg",
  "/globe/beijing.jpg",
  "/globe/sf.jpg",
  "/globe/pisa.jpg",
  "/globe/egypt.jpg",
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getCityImage(city: string, index: number): string {
  const key = `${city}-${index}`;
  const imageIndex = hashString(key) % CITY_IMAGE_POOL.length;
  return CITY_IMAGE_POOL[imageIndex];
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

function summarizeDay(day: ItineraryDay): string {
  const firstActivity = day.activities[0] ?? "Explore city highlights";
  const firstFood = day.food[0] ?? "Local food tasting";
  return `${firstActivity} · ${firstFood}`;
}

export function TravelItineraryPanel({
  messages,
  variant = "full",
}: TravelItineraryPanelProps) {
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [isDownloadingWord, setIsDownloadingWord] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const itinerary = useMemo(() => {
    return getTravelItineraryFromMessages(messages);
  }, [messages]);

  const payload = useMemo(() => buildTravelPayloadFromChat(messages), [messages]);
  const activeDay = itinerary[activeDayIndex] ?? itinerary[0];
  const uniqueCities = useMemo(
    () => Array.from(new Set(itinerary.map((day) => day.city))),
    [itinerary]
  );

  const totalDays = itinerary.length;
  const estimatedBudget = payload?.budget
    ? `${payload.budget.toLocaleString()} RMB`
    : "Flexible";
  const showMapPanel = variant === "full";

  useEffect(() => {
    setActiveDayIndex(0);
  }, [itinerary]);

  if (!itinerary.length) {
    return null;
  }

  return (
    <section
      className="mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.09)]"
      data-testid="travel-itinerary-panel"
    >
      <header className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-r from-[#052b59] via-[#0c3f7e] to-[#135fa8] px-4 py-4 text-white md:px-6">
        <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-white/15 blur-3xl" />
        <div className="absolute -bottom-20 left-10 h-52 w-52 rounded-full bg-cyan-300/20 blur-3xl" />

        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-blue-50">
              <SparklesIcon className="h-3 w-3" />
              Visual Itinerary
            </p>
            <h3 className="mt-2 text-lg font-semibold md:text-xl">Your Journey Blueprint</h3>
            <p className="mt-1 text-xs text-blue-100/95 md:text-sm">
              {uniqueCities.join(" · ")} · {totalDays} days
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="border-white/40 bg-white/10 text-white hover:bg-white/20"
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
              className="border-white/40 bg-white/10 text-white hover:bg-white/20"
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
      </header>

      <div className="space-y-4 p-4 md:p-6">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
            <p className="text-[11px] text-slate-500">Total Days</p>
            <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-slate-800">
              <CalendarDaysIcon className="h-3.5 w-3.5 text-slate-500" />
              {totalDays} days
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
            <p className="text-[11px] text-slate-500">Cities</p>
            <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-slate-800">
              <MapPinIcon className="h-3.5 w-3.5 text-slate-500" />
              {uniqueCities.length} stops
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
            <p className="text-[11px] text-slate-500">Budget</p>
            <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-slate-800">
              <WalletIcon className="h-3.5 w-3.5 text-slate-500" />
              {estimatedBudget}
            </p>
          </div>
        </div>

        <div className={showMapPanel ? "grid gap-4 xl:grid-cols-[1.25fr_0.95fr]" : "space-y-3"}>
          <div className="space-y-3">
            {itinerary.map((day, index) => {
              const active = index === activeDayIndex;
              const imageSrc = getCityImage(day.city, index);

              return (
                <button
                  className={`w-full rounded-xl border text-left transition-all ${
                    active
                      ? "border-blue-300 bg-blue-50/60 shadow-[0_10px_28px_rgba(59,130,246,0.18)]"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
                  }`}
                  key={`${day.day}-${day.city}-${index}`}
                  onClick={() => setActiveDayIndex(index)}
                  type="button"
                >
                  <div className="grid gap-3 p-3 sm:grid-cols-[130px_1fr]">
                    <div className="relative h-24 overflow-hidden rounded-lg sm:h-full sm:min-h-24">
                      <Image
                        alt={`${day.city} view`}
                        className="h-full w-full object-cover"
                        height={200}
                        src={imageSrc}
                        width={320}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                      <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-[11px] font-medium text-white">
                        Day {day.day}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{day.city}</p>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                          {day.cost}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600">{summarizeDay(day)}</p>

                      <div className="flex flex-wrap gap-1.5">
                        {day.activities.slice(0, 3).map((activity) => (
                          <span
                            className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700"
                            key={`${day.city}-${activity}`}
                          >
                            {activity}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {showMapPanel && (
            <aside className="space-y-3 xl:sticky xl:top-4">
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">Map Reference</p>
                  <span className="text-xs text-slate-500">{activeDay?.city ?? "-"}</span>
                </div>

                <div className="h-80 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  {activeDay ? (
                    <iframe
                      className="h-full w-full"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      src={`https://www.google.com/maps?q=${encodeURIComponent(activeDay.city)}&output=embed`}
                      title={`map-${activeDay.city}`}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                      Map unavailable
                    </div>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {uniqueCities.map((city) => {
                    const isActive = activeDay?.city === city;
                    return (
                      <button
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                          isActive
                            ? "border-blue-300 bg-blue-50 text-blue-700"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
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

              {activeDay && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <p className="text-sm font-semibold text-slate-900">Today Highlights</p>
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
                    {activeDay.activities.slice(0, 4).map((activity) => (
                      <li key={`highlight-${activeDay.city}-${activity}`}>• {activity}</li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          )}
        </div>
      </div>
    </section>
  );
}
