"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  BedDouble,
  CalendarDays,
  Car,
  ChevronRight,
  Clock3,
  Compass,
  MapPin,
  MapPinned,
  Plane,
  Play,
  Route,
  Sparkles,
  Star,
  TrainFront,
  Utensils,
  Users,
  WalletCards,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  ItineraryDay,
  SelectedHotelOption,
  TravelState,
} from "@/lib/travel/planner";
import {
  TripRouteMap,
  type TripMapPoint,
} from "@/components/client/travel/trip-route-map";

type TravelItineraryExperienceProps = {
  itinerary: ItineraryDay[];
  travelState: TravelState;
  orderedCities: string[];
  routeCoordinates: Array<[number, number]>;
  mapPoints: TripMapPoint[];
  activePointId?: string | null;
  onPointSelect?: (id: string) => void;
};

type CitySegment = {
  city: string;
  label: string;
  dayStart: number;
  dayEnd: number;
  rangeLabel: string;
  imageSrc: string;
};

type RouteNode = {
  id: string;
  label: string;
  caption: string;
  kind: "origin" | "city" | "return";
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
  "/globe/egypt.jpg",
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
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getLocalCityLabel(city: string): string {
  const key = normalizeLookupKey(city);
  return LOCAL_CITY_LABELS[key] ?? city;
}

function getCityImage(city: string, seed: string = "default"): string {
  const key = normalizeLookupKey(city);
  const direct = CITY_IMAGE_BY_KEY[key];
  if (direct) return direct;

  const index = hashString(`${key}-${seed}`) % CITY_IMAGE_POOL.length;
  return CITY_IMAGE_POOL[index];
}

function getUniqueCities(itinerary: ItineraryDay[], orderedCities: string[]): string[] {
  const preferred = orderedCities.filter(Boolean);
  if (preferred.length) return preferred;

  const seen = new Set<string>();
  const result: string[] = [];
  for (const day of itinerary) {
    const key = normalizeLookupKey(day.city);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(day.city);
  }
  return result;
}

function formatMonthDay(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${parsed.getMonth() + 1}月${parsed.getDate()}日`;
}

function findHotelForCity(
  hotels: SelectedHotelOption[],
  city: string
): SelectedHotelOption | null {
  const cityKey = normalizeLookupKey(city);
  return (
    hotels.find((hotel) => normalizeLookupKey(hotel.city) === cityKey) ?? null
  );
}

function formatCityRange(
  segment: Pick<CitySegment, "dayStart" | "dayEnd">,
  hotel: SelectedHotelOption | null
): string {
  if (hotel) {
    const checkIn = formatMonthDay(hotel.check_in);
    const checkOut = formatMonthDay(hotel.check_out);
    return checkIn === checkOut ? checkIn : `${checkIn} - ${checkOut}`;
  }

  if (segment.dayStart === segment.dayEnd) return `第 ${segment.dayStart} 天`;
  return `第 ${segment.dayStart} - ${segment.dayEnd} 天`;
}

function buildCitySegments(
  itinerary: ItineraryDay[],
  orderedCities: string[],
  travelState: TravelState
): CitySegment[] {
  const cities = getUniqueCities(itinerary, orderedCities);
  let cursor = 1;

  return cities.map((city, index) => {
    const daysFromState = travelState.city_days[city];
    const normalizedCity = normalizeLookupKey(city);
    const daysFromItinerary = itinerary.filter(
      (day) => normalizeLookupKey(day.city) === normalizedCity
    ).length;
    const dayCount = Math.max(1, daysFromState ?? daysFromItinerary);
    const dayStart = cursor;
    const dayEnd = cursor + dayCount - 1;
    cursor = dayEnd + 1;

    const partialSegment = { dayStart, dayEnd };
    const hotel = findHotelForCity(travelState.selected_hotels, city);

    return {
      city,
      label: getLocalCityLabel(city),
      dayStart,
      dayEnd,
      rangeLabel: formatCityRange(partialSegment, hotel),
      imageSrc: getCityImage(city, `segment-${index}`),
    };
  });
}

function createRouteNodes(
  travelState: TravelState,
  segments: CitySegment[]
): RouteNode[] {
  const nodes: RouteNode[] = [];
  const originCity = travelState.origin_city?.trim();
  const returnCity = travelState.return_city?.trim();

  if (originCity) {
    nodes.push({
      id: "origin",
      label: getLocalCityLabel(originCity),
      caption: "出发",
      kind: "origin",
    });
  }

  segments.forEach((segment) => {
    nodes.push({
      id: `city-${segment.city}`,
      label: segment.label,
      caption: segment.rangeLabel,
      kind: "city",
    });
  });

  const lastTripCity = segments[segments.length - 1]?.city ?? originCity ?? "";
  if (
    returnCity &&
    normalizeLookupKey(returnCity) !== normalizeLookupKey(lastTripCity)
  ) {
    nodes.push({
      id: "return",
      label: getLocalCityLabel(returnCity),
      caption: "返程",
      kind: "return",
    });
  }

  return nodes;
}

function createTripTitle(totalDays: number, cities: string[]): string {
  const cityTitle = cities.map(getLocalCityLabel).join("");
  if (cityTitle) return `${totalDays}天${cityTitle}经典游`;
  return `${totalDays}天定制旅行`;
}

function summarizeDay(day: ItineraryDay): string {
  const firstActivity = day.activities[0] ?? "城市精华体验";
  const secondActivity = day.activities[1] ?? day.food[0] ?? "当地美食";
  return `${firstActivity} · ${secondActivity}`;
}

function getDayImage(day: ItineraryDay, index: number): string {
  return getCityImage(day.city, `day-${day.day}-${index}`);
}

function getPointIdForCity(points: TripMapPoint[], city: string): string | null {
  const cityKey = normalizeLookupKey(city);
  const point = points.find((item) => {
    if (item.kind !== "city") return false;
    const pointCity = item.city ?? item.label;
    return normalizeLookupKey(pointCity) === cityKey;
  });
  return point?.id ?? null;
}

function filterEssentialMapPoints(points: TripMapPoint[]): TripMapPoint[] {
  const essential = points.filter(
    (point) => point.kind === "city" || point.kind === "hotel"
  );
  return essential.length ? essential : points;
}

function formatDayTab(day: ItineraryDay): string {
  const dayNumber = typeof day.day === "number" ? day.day : String(day.day);
  return `天 ${dayNumber}`;
}

export function TravelItineraryExperience({
  itinerary,
  travelState,
  orderedCities,
  routeCoordinates,
  mapPoints,
  activePointId,
  onPointSelect,
}: TravelItineraryExperienceProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [fullMapOpen, setFullMapOpen] = useState(false);
  const [activeDayIndex, setActiveDayIndex] = useState(0);

  const segments = useMemo(
    () => buildCitySegments(itinerary, orderedCities, travelState),
    [itinerary, orderedCities, travelState]
  );
  const routeNodes = useMemo(
    () => createRouteNodes(travelState, segments),
    [segments, travelState]
  );
  const title = useMemo(
    () => createTripTitle(itinerary.length, segments.map((segment) => segment.city)),
    [itinerary.length, segments]
  );
  const activeDay = itinerary[activeDayIndex] ?? itinerary[0];
  const heroImage = segments[0]?.imageSrc ?? getDayImage(itinerary[0], 0);
  const totalExperiences = itinerary.reduce(
    (sum, day) => sum + day.activities.length,
    0
  );
  const essentialMapPoints = useMemo(
    () => filterEssentialMapPoints(mapPoints),
    [mapPoints]
  );
  const focusedPointId = activeDay
    ? getPointIdForCity(mapPoints, activeDay.city) ?? activePointId ?? null
    : activePointId ?? null;

  useEffect(() => {
    setActiveDayIndex(0);
  }, [itinerary]);

  const openDetailAtDay = (index: number) => {
    setActiveDayIndex(index);
    setDetailOpen(true);
  };

  return (
    <>
      <div
        className="h-full min-h-0 overflow-y-auto bg-[#f7f6f2] px-5 py-6 [scrollbar-width:none] md:px-8 md:py-8 [&::-webkit-scrollbar]:hidden"
        data-testid="travel-itinerary-experience"
      >
        <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-6">
          <section className="rounded-[28px] bg-white px-5 py-6 shadow-[0_22px_70px_rgba(32,20,43,0.12)] md:px-8 md:py-8">
            <button
              className="grid w-full gap-6 text-left outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#c5a8ff] lg:grid-cols-[270px_1fr]"
              data-testid="travel-itinerary-cover-card"
              onClick={() => openDetailAtDay(0)}
              type="button"
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-[22px] bg-slate-200 shadow-[0_16px_35px_rgba(32,20,43,0.18)]">
                <Image
                  alt={title}
                  className="h-full w-full object-cover"
                  height={360}
                  priority={false}
                  src={heroImage}
                  width={480}
                />
                <div className="absolute inset-0 bg-black/18" />
                <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-[#271431] shadow-lg">
                  <Play className="h-8 w-8 fill-current" />
                </span>
                <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm font-semibold text-white underline underline-offset-4">
                  预览
                </span>
              </div>

              <div className="flex min-w-0 flex-col justify-center">
                <p className="inline-flex w-fit items-center gap-2 rounded-full bg-[#efe5ff] px-3 py-1 text-xs font-semibold text-[#6f40cc]">
                  <Sparkles className="h-3.5 w-3.5" />
                  最新行程
                </p>
                <h2 className="mt-4 text-2xl font-bold text-[#2d1635] md:text-4xl">
                  {title}
                </h2>
                <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-[#2d1635] md:text-lg">
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="h-5 w-5" />
                    {itinerary.length} 天数
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    {segments.length} 城市
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Star className="h-5 w-5" />
                    {totalExperiences} 体验
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <BedDouble className="h-5 w-5" />
                    {travelState.selected_hotels.length} 酒店
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Car className="h-5 w-5" />
                    {Math.max(routeNodes.length - 1, travelState.selected_flights.length)} 运输
                  </span>
                  {travelState.travelers ? (
                    <span className="inline-flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      {travelState.travelers} 旅行者
                    </span>
                  ) : null}
                </div>
              </div>
            </button>

            <div className="mt-8 flex items-center gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {routeNodes.map((node, index) => (
                <div className="flex shrink-0 items-center gap-3" key={node.id}>
                  <div
                    className={cn(
                      "flex min-w-[132px] items-center gap-3 rounded-2xl px-4 py-3 text-[#2d1635]",
                      node.kind === "city"
                        ? "bg-white shadow-[0_8px_28px_rgba(32,20,43,0.08)]"
                        : "bg-transparent"
                    )}
                  >
                    {node.kind === "city" ? (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#efe5ff] text-xs font-bold text-[#6f40cc]">
                        {segments.findIndex((segment) => segment.label === node.label) + 1}
                      </span>
                    ) : (
                      <MapPin className="h-5 w-5" />
                    )}
                    <span>
                      <span className="block text-base font-bold">{node.label}</span>
                      <span className="block text-sm text-[#5f5166]">{node.caption}</span>
                    </span>
                  </div>
                  {index < routeNodes.length - 1 ? (
                    <div className="flex items-center gap-3 text-[#bcb5c2]">
                      <span className="h-px w-9 bg-[#d8d2dd]" />
                      {index === 0 || index === routeNodes.length - 2 ? (
                        <Plane className="h-5 w-5 text-[#2d1635]" />
                      ) : (
                        <TrainFront className="h-5 w-5 text-[#6f40cc]" />
                      )}
                      <span className="h-px w-9 bg-[#d8d2dd]" />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className="relative min-h-[260px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(32,20,43,0.1)]">
            <TripRouteMap
              activePointId={focusedPointId}
              className="h-[300px] w-full md:h-[360px]"
              onPointSelect={onPointSelect}
              points={essentialMapPoints}
              routeCoordinates={routeCoordinates}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/8 via-transparent to-white/10" />
            <Button
              className="absolute bottom-5 right-5 h-14 rounded-full bg-white px-6 text-base font-bold text-[#2d1635] shadow-[0_12px_32px_rgba(32,20,43,0.18)] hover:bg-white"
              data-testid="travel-itinerary-full-map-button"
              onClick={() => setFullMapOpen(true)}
              type="button"
            >
              <MapPinned className="h-5 w-5" />
              查看完整地图
            </Button>
          </section>

          <section className="space-y-3 pb-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-[#2d1635]">行程过程</h3>
              <Button
                className="rounded-full border-[#d8c5ff] text-[#6f40cc] hover:bg-[#f6efff]"
                onClick={() => openDetailAtDay(activeDayIndex)}
                type="button"
                variant="outline"
              >
                展开行程
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3">
              {itinerary.map((day, index) => (
                <button
                  className="grid w-full gap-4 rounded-2xl bg-white p-3 text-left shadow-[0_12px_36px_rgba(32,20,43,0.08)] transition-transform hover:-translate-y-0.5 md:grid-cols-[132px_1fr_auto]"
                  key={`${day.day}-${day.city}-${index}`}
                  onClick={() => openDetailAtDay(index)}
                  type="button"
                >
                  <div className="relative h-24 overflow-hidden rounded-xl md:h-full">
                    <Image
                      alt={`${getLocalCityLabel(day.city)} itinerary`}
                      className="h-full w-full object-cover"
                      height={160}
                      src={getDayImage(day, index)}
                      width={220}
                    />
                  </div>
                  <div className="min-w-0 py-1">
                    <p className="text-sm font-semibold text-[#8d5df7]">
                      {formatDayTab(day)} · {day.activities.length} 体验 · {day.cost}
                    </p>
                    <p className="mt-1 text-lg font-bold text-[#2d1635]">
                      {getLocalCityLabel(day.city)}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[#5f5166]">
                      {summarizeDay(day)}
                    </p>
                  </div>
                  <span className="self-center justify-self-end text-[#918796]">
                    <ChevronRight className="h-6 w-6" />
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent
          className="h-[88vh] max-w-[min(1500px,94vw)] overflow-hidden p-0"
          data-testid="travel-itinerary-detail-dialog"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>查看每天行程和地图路线</DialogDescription>
          </DialogHeader>
          <div className="grid h-full min-h-0 bg-white lg:grid-cols-[minmax(420px,0.92fr)_minmax(520px,1.08fr)]">
            <section className="flex min-h-0 flex-col border-r border-slate-200">
              <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-5">
                <div className="flex items-center gap-3 text-sm font-semibold text-[#756a7b]">
                  <Route className="h-4 w-4" />
                  <span>行程计划</span>
                  <ChevronRight className="h-4 w-4" />
                  <span className="text-[#2d1635]">行程</span>
                </div>
                <div className="mt-6 flex items-center gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {itinerary.map((day, index) => (
                    <button
                      className={cn(
                        "shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors",
                        index === activeDayIndex
                          ? "bg-[#d9c2ff] text-[#2d1635]"
                          : "text-[#756a7b] hover:bg-slate-100"
                      )}
                      key={`tab-${day.day}-${index}`}
                      onClick={() => setActiveDayIndex(index)}
                      type="button"
                    >
                      {formatDayTab(day)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-[#faf9f7] px-6 py-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {activeDay ? (
                  <div className="space-y-5">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-2xl font-bold text-[#2d1635]">
                          {getLocalCityLabel(activeDay.city)}
                        </h3>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#efe5ff] px-2.5 py-1 text-sm font-bold text-[#6f40cc]">
                          <Clock3 className="h-4 w-4" />
                          {activeDay.cost}
                        </span>
                      </div>
                      <p className="mt-2 text-base text-[#5f5166]">
                        {summarizeDay(activeDay)}
                      </p>
                    </div>

                    <div className="space-y-4">
                      {activeDay.activities.map((activity, index) => (
                        <div
                          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_36px_rgba(32,20,43,0.08)]"
                          key={`${activeDay.city}-activity-${activity}`}
                        >
                          <div className="flex items-start gap-4">
                            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#efe5ff] font-bold text-[#6f40cc]">
                              {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-[#756a7b]">
                                景点
                              </p>
                              <p className="mt-1 text-lg font-bold text-[#2d1635]">
                                {activity}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {activeDay.food.length ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_36px_rgba(32,20,43,0.08)]">
                        <p className="inline-flex items-center gap-2 text-sm font-bold text-[#2d1635]">
                          <Utensils className="h-4 w-4 text-[#6f40cc]" />
                          今日餐厅
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {activeDay.food.map((food) => (
                            <span
                              className="rounded-full bg-[#f6efff] px-3 py-1 text-sm font-semibold text-[#6f40cc]"
                              key={`${activeDay.city}-food-${food}`}
                            >
                              {food}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_36px_rgba(32,20,43,0.08)]">
                      <p className="inline-flex items-center gap-2 text-sm font-bold text-[#2d1635]">
                        <Compass className="h-4 w-4 text-[#6f40cc]" />
                        备注
                      </p>
                      <p className="mt-3 text-base font-semibold text-[#2d1635]">
                        建议把同区域体验排在一起，减少跨城折返。
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <aside className="min-h-0 bg-slate-100 max-lg:h-[44vh]">
              <TripRouteMap
                activePointId={focusedPointId}
                className="h-full w-full"
                onPointSelect={onPointSelect}
                points={mapPoints}
                routeCoordinates={routeCoordinates}
              />
            </aside>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={fullMapOpen} onOpenChange={setFullMapOpen}>
        <DialogContent
          className="h-[88vh] max-w-[min(1560px,94vw)] overflow-hidden p-0"
          data-testid="travel-itinerary-dynamic-map-dialog"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{title}完整地图</DialogTitle>
            <DialogDescription>动态查看完整行程路线</DialogDescription>
          </DialogHeader>
          <div className="flex h-full min-h-0 flex-col bg-white">
            <div className="shrink-0 border-b border-slate-200 px-6 py-5 text-center">
              <h3 className="text-2xl font-bold text-[#2d1635]">{title}</h3>
              <p className="mt-1 text-sm font-semibold text-[#756a7b]">
                {routeNodes.map((node) => node.label).join(" → ")}
              </p>
            </div>

            <div className="relative min-h-0 flex-1">
              <TripRouteMap
                activePointId={focusedPointId}
                animateRoute
                className="h-full w-full"
                onPointSelect={onPointSelect}
                points={mapPoints}
                routeCoordinates={routeCoordinates}
              />
              <div className="absolute bottom-5 left-5 max-w-[min(520px,calc(100%-40px))] rounded-2xl bg-white/92 p-4 shadow-[0_18px_45px_rgba(32,20,43,0.18)] backdrop-blur">
                <p className="inline-flex items-center gap-2 text-sm font-bold text-[#2d1635]">
                  <WalletCards className="h-4 w-4 text-[#6f40cc]" />
                  动态行程
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {segments.map((segment) => (
                    <span
                      className="rounded-full bg-[#f6efff] px-3 py-1 text-sm font-semibold text-[#6f40cc]"
                      key={`full-map-${segment.city}`}
                    >
                      {segment.label} · {segment.rangeLabel}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
