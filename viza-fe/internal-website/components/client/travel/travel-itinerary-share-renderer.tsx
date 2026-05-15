"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CalendarDays,
  Download,
  FileText,
  Hotel,
  MapPin,
  Plane,
  Share2,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  TRAVEL_ITINERARY_SHARE_PARAM,
  decodeTravelItinerarySharePayload,
  type TravelItineryShareRow,
  type TravelItinerarySharePayload,
} from "@/components/client/travel/travel-itinerary-data";
import type {
  ItineraryDay,
  SelectedFlightOption,
  SelectedHotelOption,
  TravelState,
} from "@/lib/travel/planner";

type TravelDownloadEndpoint =
  | "/api/travel/download-word"
  | "/api/travel/download-pdf";

type TravelExportPayload = {
  country: string;
  countries: string[];
  cities: string[];
  city_days: Record<string, number>;
  departure_date?: string;
  date_flexibility?: string;
  travel_days: number;
  travelers: number;
  budget: number;
  travel_order: string[];
  origin_country?: string;
  origin_city?: string;
  return_country?: string;
  return_city?: string;
  selected_flights: SelectedFlightOption[];
  selected_hotels: SelectedHotelOption[];
  final_note: string;
  attached_files: string[];
  itinerary: ItineraryDay[];
  itinery_rows: TravelItineryShareRow[];
};

const CITY_IMAGE_POOL = [
  "/globe/tokyo.jpg",
  "/globe/singapore.jpg",
  "/globe/sydney.jpg",
  "/globe/nyc.jpg",
  "/globe/beijing.jpg",
  "/globe/london.jpg",
  "/globe/paris.jpg",
  "/globe/sf.jpg",
  "/globe/pisa.jpg",
] as const;

const CITY_IMAGE_BY_KEY: Record<string, string> = {
  tokyo: "/globe/tokyo.jpg",
  kyoto: "/globe/tokyo.jpg",
  osaka: "/globe/tokyo.jpg",
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
  rome: "/globe/pisa.jpg",
};

const LOCAL_CITY_LABELS: Record<string, string> = {
  tokyo: "东京",
  kyoto: "京都",
  osaka: "大阪",
  singapore: "新加坡",
  sydney: "悉尼",
  london: "伦敦",
  paris: "巴黎",
  newyork: "纽约",
  nyc: "纽约",
  beijing: "北京",
  sanfrancisco: "旧金山",
  sf: "旧金山",
  pisa: "比萨",
  rome: "罗马",
  seoul: "首尔",
  bangkok: "曼谷",
  hongkong: "香港",
};

function normalizeLookupKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getLocalCityLabel(city: string): string {
  return LOCAL_CITY_LABELS[normalizeLookupKey(city)] ?? city;
}

function getCityImage(city: string, seed = "share"): string {
  const key = normalizeLookupKey(city);
  const direct = CITY_IMAGE_BY_KEY[key];
  if (direct) return direct;
  return CITY_IMAGE_POOL[hashString(`${key}-${seed}`) % CITY_IMAGE_POOL.length];
}

function formatDayTab(day: ItineraryDay): string {
  return `天 ${typeof day.day === "number" ? day.day : String(day.day)}`;
}

function joinList(items: string[]): string {
  return items.filter(Boolean).join("、") || "-";
}

function getCities(payload: TravelItinerarySharePayload): string[] {
  const state = payload.travelState;
  const fromOrder = state.travel_order.filter(Boolean);
  if (fromOrder.length) return fromOrder;
  if (state.cities.length) return state.cities;

  const seen = new Set<string>();
  return payload.itinerary
    .map((day) => day.city)
    .filter((city) => {
      const key = normalizeLookupKey(city);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildRowsFromItinerary(itinerary: ItineraryDay[]): TravelItineryShareRow[] {
  return itinerary.flatMap((day) =>
    day.activities.map((activity) => ({
      type: "景点",
      date: formatDayTab(day),
      route: getLocalCityLabel(day.city),
      name: activity,
      details: day.food.length ? `餐饮：${joinList(day.food)}` : "-",
      contact: "-",
    }))
  );
}

function buildExportPayload(
  payload: TravelItinerarySharePayload,
  rows: TravelItineryShareRow[]
): TravelExportPayload {
  const state: TravelState = payload.travelState;
  const cities = getCities(payload);
  const travelOrder = state.travel_order.length ? state.travel_order : cities;

  return {
    country: state.country ?? state.countries[0] ?? "",
    countries: state.countries,
    cities,
    city_days: state.city_days,
    departure_date: state.departure_date ?? undefined,
    date_flexibility: state.date_flexibility ?? undefined,
    travel_days: state.travel_days ?? Math.max(1, payload.itinerary.length),
    travelers: state.travelers ?? 1,
    budget: state.budget ?? 1,
    travel_order: travelOrder,
    origin_country: state.origin_country ?? undefined,
    origin_city: state.origin_city ?? undefined,
    return_country: state.return_country ?? undefined,
    return_city: state.return_city ?? undefined,
    selected_flights: state.selected_flights,
    selected_hotels: state.selected_hotels,
    final_note: state.final_note ?? "",
    attached_files: state.attached_files,
    itinerary: payload.itinerary,
    itinery_rows: rows,
  };
}

async function downloadBlob(
  endpoint: TravelDownloadEndpoint,
  payload: TravelExportPayload,
  fallbackFilename: string
): Promise<void> {
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

function Metric({
  icon: Icon,
  label,
}: {
  icon: typeof CalendarDays;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-[#2d1635] shadow-[0_8px_24px_rgba(32,20,43,0.08)]">
      <Icon className="h-4 w-4 text-[#7b4de8]" />
      {label}
    </span>
  );
}

export function TravelItineraryShareRenderer() {
  const searchParams = useSearchParams();
  const encoded = searchParams.get(TRAVEL_ITINERARY_SHARE_PARAM);
  const [hasMounted, setHasMounted] = useState(false);
  const [isDownloadingWord, setIsDownloadingWord] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const payload = useMemo(
    () => (hasMounted ? decodeTravelItinerarySharePayload(encoded) : null),
    [encoded, hasMounted]
  );

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const rows = useMemo(
    () =>
      payload?.itineryRows?.length
        ? payload.itineryRows
        : buildRowsFromItinerary(payload?.itinerary ?? []),
    [payload]
  );
  const cities = useMemo(() => (payload ? getCities(payload) : []), [payload]);
  const exportPayload = useMemo(
    () => (payload ? buildExportPayload(payload, rows) : null),
    [payload, rows]
  );

  if (!hasMounted) {
    return (
      <main className="min-h-screen bg-[#f7f4f0] px-5 py-8 text-[#2d1635]">
        <div className="mx-auto h-64 max-w-6xl animate-pulse rounded-[30px] bg-white" />
      </main>
    );
  }

  if (!payload || !exportPayload) {
    return (
      <main className="min-h-screen bg-[#f7f4f0] px-5 py-10 text-[#2d1635]">
        <section className="mx-auto max-w-3xl rounded-[28px] bg-white p-8 text-center shadow-[0_18px_55px_rgba(32,20,43,0.1)]">
          <h1 className="text-3xl font-bold">行程链接不可用</h1>
          <p className="mt-3 text-base font-semibold text-[#756a7b]">
            请确认分享链接完整，或让分享者重新生成链接。
          </p>
        </section>
      </main>
    );
  }

  const title = payload.title || `${payload.itinerary.length}天定制旅行`;
  const totalDays = payload.travelState.travel_days ?? payload.itinerary.length;
  const heroCity = cities[0] ?? payload.itinerary[0]?.city ?? "";
  const heroImage = getCityImage(heroCity);
  const hotelRows = rows.filter((row) => row.type.includes("酒店"));
  const flightRows = rows.filter((row) => row.type.includes("航班"));

  const handleCopyLink = async () => {
    if (!navigator.clipboard?.writeText) return;
    await navigator.clipboard.writeText(window.location.href);
    toast.success("分享链接已复制。");
  };

  const handleDownload = async (
    endpoint: TravelDownloadEndpoint,
    filename: string,
    setBusy: (busy: boolean) => void
  ) => {
    setBusy(true);
    try {
      await downloadBlob(endpoint, exportPayload, filename);
      toast.success(`${filename} 已开始下载。`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `${filename} 下载失败。`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f4f0] px-4 py-6 text-[#2d1635] md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="grid overflow-hidden rounded-[30px] bg-white shadow-[0_24px_70px_rgba(32,20,43,0.12)] md:grid-cols-[360px_minmax(0,1fr)]">
          <div className="relative h-[260px] bg-slate-200 md:h-[320px]">
            <Image
              alt={title}
              className="h-full w-full object-cover"
              height={720}
              priority
              src={heroImage}
              width={720}
            />
            <div className="absolute left-5 top-5 rounded-full bg-white/92 px-4 py-2 text-sm font-bold text-[#2d1635] shadow-lg">
              Shared itinery
            </div>
          </div>
          <div className="flex flex-col justify-between gap-5 p-6 md:p-8">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#7b4de8]">
                <Sparkles className="h-4 w-4" />
                {cities.map(getLocalCityLabel).join(" → ") || "定制行程"}
              </div>
              <h1 className="mt-4 text-4xl font-bold leading-tight md:text-5xl">
                {title}
              </h1>
              <div className="mt-6 flex flex-wrap gap-3">
                <Metric icon={CalendarDays} label={`${totalDays} 天数`} />
                <Metric icon={MapPin} label={`${cities.length} 城市`} />
                <Metric icon={Star} label={`${rows.length} 项`} />
                <Metric
                  icon={Users}
                  label={`${payload.travelState.travelers ?? 1} 旅行者`}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                className="rounded-full border-[#d8c5ff] text-[#6f40cc] hover:bg-[#f6efff]"
                onClick={handleCopyLink}
                type="button"
                variant="outline"
              >
                <Share2 className="h-4 w-4" />
                分享
              </Button>
              <Button
                className="rounded-full bg-[#d9c2ff] text-[#2d1635] hover:bg-[#c9acff]"
                disabled={isDownloadingWord}
                onClick={() =>
                  handleDownload(
                    "/api/travel/download-word",
                    "travel-itinerary.docx",
                    setIsDownloadingWord
                  )
                }
                type="button"
              >
                <FileText className="h-4 w-4" />
                Word
              </Button>
              <Button
                className="rounded-full bg-[#2d1635] text-white hover:bg-[#42214d]"
                disabled={isDownloadingPdf}
                onClick={() =>
                  handleDownload(
                    "/api/travel/download-pdf",
                    "travel-itinerary.pdf",
                    setIsDownloadingPdf
                  )
                }
                type="button"
              >
                <Download className="h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] bg-white p-5 shadow-[0_18px_55px_rgba(32,20,43,0.08)] md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-3xl font-bold">itinery</h2>
            <span className="rounded-full bg-[#f6efff] px-4 py-2 text-sm font-bold text-[#6f40cc]">
              {rows.length} 项
            </span>
          </div>
          <div className="mt-5 overflow-auto rounded-2xl border border-[#e6dff0]">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead className="bg-[#efe5ff] text-[#2d1635]">
                <tr>
                  {[
                    "类型",
                    "日期/天数",
                    "城市/路线",
                    "名称",
                    "详情",
                    "联系电话/航班号",
                  ].map((header) => (
                    <th className="px-4 py-3 font-bold" key={header}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eee7f5]">
                {rows.map((row, index) => (
                  <tr className="align-top" key={`${row.type}-${row.name}-${index}`}>
                    <td className="whitespace-nowrap px-4 py-4 font-bold">
                      {row.type}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 font-semibold text-[#5f5166]">
                      {row.date}
                    </td>
                    <td className="px-4 py-4 font-semibold text-[#5f5166]">
                      {row.route}
                    </td>
                    <td className="px-4 py-4 font-bold">{row.name}</td>
                    <td className="px-4 py-4 text-[#5f5166]">{row.details}</td>
                    <td className="px-4 py-4 font-bold">{row.contact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {hotelRows.map((row, index) => (
            <article
              className="flex items-center gap-4 rounded-[24px] bg-white p-5 shadow-[0_14px_45px_rgba(32,20,43,0.08)]"
              key={`hotel-${row.name}-${index}`}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#efe5ff] text-[#6f40cc]">
                <Hotel className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#7b4de8]">{row.date}</p>
                <h3 className="mt-1 text-xl font-bold">{row.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm font-semibold text-[#756a7b]">
                  {row.route} · {row.details}
                </p>
              </div>
            </article>
          ))}
          {flightRows.map((row, index) => (
            <article
              className="flex items-center gap-4 rounded-[24px] bg-white p-5 shadow-[0_14px_45px_rgba(32,20,43,0.08)]"
              key={`flight-${row.route}-${index}`}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#2d1635] text-white">
                <Plane className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#7b4de8]">{row.date}</p>
                <h3 className="mt-1 text-xl font-bold">{row.route}</h3>
                <p className="mt-1 line-clamp-2 text-sm font-semibold text-[#756a7b]">
                  {row.name} · {row.details} · {row.contact}
                </p>
              </div>
            </article>
          ))}
        </section>

        <section className="space-y-4 pb-8">
          {payload.itinerary.map((day, index) => (
            <article
              className="grid gap-4 rounded-[28px] bg-white p-4 shadow-[0_14px_45px_rgba(32,20,43,0.08)] md:grid-cols-[220px_minmax(0,1fr)]"
              key={`${day.city}-${day.day}-${index}`}
            >
              <div className="relative h-36 overflow-hidden rounded-[22px] bg-slate-200 md:h-full">
                <Image
                  alt={`${day.city} day ${day.day}`}
                  className="h-full w-full object-cover"
                  height={220}
                  src={getCityImage(day.city, `day-${day.day}`)}
                  width={320}
                />
              </div>
              <div className="min-w-0 p-2">
                <p className="text-sm font-bold text-[#7b4de8]">
                  {formatDayTab(day)} · {getLocalCityLabel(day.city)} · {day.cost}
                </p>
                <h3 className="mt-2 text-2xl font-bold">
                  {day.activities.slice(0, 2).join(" · ")}
                </h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {day.activities.map((activity) => (
                    <span
                      className="rounded-full bg-[#f6efff] px-3 py-1 text-sm font-bold text-[#6f40cc]"
                      key={`${day.day}-${activity}`}
                    >
                      {activity}
                    </span>
                  ))}
                </div>
                {day.food.length ? (
                  <p className="mt-4 text-sm font-semibold text-[#756a7b]">
                    餐饮：{joinList(day.food)}
                  </p>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
