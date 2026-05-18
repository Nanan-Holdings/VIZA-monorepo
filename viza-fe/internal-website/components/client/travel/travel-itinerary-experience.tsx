"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BedDouble,
  CalendarDays,
  Car,
  ChevronRight,
  Clock3,
  Compass,
  Download,
  FileText,
  MapPin,
  MapPinned,
  Pause,
  Plane,
  Play,
  Plus,
  Route,
  Share2,
  Sparkles,
  Star,
  TrainFront,
  Trash2,
  Utensils,
  Users,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
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
  SelectedFlightOption,
  SelectedHotelOption,
  TravelState,
} from "@/lib/travel/planner";
import {
  TripRouteMap,
  type TripMapPoint,
} from "@/components/client/travel/trip-route-map";
import {
  TRAVEL_ITINERARY_SHARE_PARAM,
  buildTravelItinerarySharePayload,
  encodeTravelItinerarySharePayload,
} from "@/components/client/travel/travel-itinerary-data";

type ItineryTableRow = {
  type: string;
  date: string;
  route: string;
  name: string;
  details: string;
  contact: string;
};

type TravelItineraryExperienceProps = {
  itinerary: ItineraryDay[];
  travelState: TravelState;
  orderedCities: string[];
  routeCoordinates: Array<[number, number]>;
  mapPoints: TripMapPoint[];
  activePointId?: string | null;
  initialItineryRows?: ItineryTableRow[];
  versionOptions?: TravelItineraryVersionOption[];
  activeVersionId?: string;
  activeVersionSummary?: string;
  onPointSelect?: (id: string) => void;
  onVersionSelect?: (versionId: string) => void;
};

type TravelItineraryVersionOption = {
  id: string;
  label: string;
  createdAt: string;
  editSummary?: string;
  isLatest: boolean;
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
  city?: string;
};

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
  itinery_rows: ItineryTableRow[];
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

const SPECIFIC_ATTRACTIONS_BY_KEY: Record<string, string[]> = {
  tokyo: [
    "浅草寺与仲见世商店街",
    "东京塔与芝公园",
    "明治神宫",
    "涩谷十字路口与忠犬八公像",
    "筑地场外市场",
    "上野公园与东京国立博物馆",
    "新宿御苑",
    "秋叶原电器街",
  ],
  kyoto: [
    "清水寺与二年坂三年坂",
    "伏见稻荷大社千本鸟居",
    "金阁寺",
    "岚山竹林小径与渡月桥",
    "祇园花见小路",
    "锦市场",
  ],
  osaka: [
    "大阪城公园与天守阁",
    "道顿堀格力高跑者看板",
    "黑门市场",
    "梅田蓝天大厦空中庭园",
    "通天阁与新世界",
    "心斋桥筋商店街",
  ],
  paris: [
    "埃菲尔铁塔与战神广场",
    "卢浮宫与玻璃金字塔",
    "奥赛博物馆",
    "巴黎圣母院与西岱岛",
    "蒙马特高地与圣心大教堂",
    "凯旋门与香榭丽舍大街",
  ],
  singapore: [
    "滨海湾金沙空中花园",
    "滨海湾花园云雾林与擎天树",
    "鱼尾狮公园",
    "牛车水佛牙寺",
    "小印度实龙岗路",
    "圣淘沙西乐索海滩",
  ],
  sydney: [
    "悉尼歌剧院",
    "海港大桥观景点",
    "岩石区 The Rocks",
    "邦迪海滩与 Bondi to Coogee 海岸步道",
    "达令港",
    "皇家植物园麦考利夫人椅",
  ],
  london: [
    "大英博物馆",
    "塔桥与伦敦塔",
    "威斯敏斯特宫与大本钟",
    "白金汉宫",
    "科文特花园",
    "博罗市场",
  ],
  rome: [
    "罗马斗兽场",
    "古罗马广场",
    "万神殿",
    "特莱维喷泉",
    "梵蒂冈博物馆与西斯廷礼拜堂",
    "特拉斯提弗列街区",
  ],
  seoul: [
    "景福宫与光化门",
    "北村韩屋村",
    "明洞购物街",
    "南山首尔塔",
    "广藏市场",
    "弘大街区",
  ],
  bangkok: [
    "大皇宫与玉佛寺",
    "卧佛寺",
    "郑王庙",
    "乍都乍周末市场",
    "唐人街耀华力路",
    "ICONSIAM",
  ],
  hongkong: [
    "太平山顶凌霄阁",
    "中环半山扶梯",
    "尖沙咀星光大道",
    "天星小轮",
    "香港故宫文化博物馆",
    "庙街夜市",
  ],
  beijing: [
    "故宫博物院",
    "天安门广场",
    "天坛公园",
    "颐和园",
    "八达岭长城",
    "什刹海与烟袋斜街",
  ],
  sanfrancisco: [
    "金门大桥游客中心",
    "渔人码头 39 号码头",
    "恶魔岛",
    "九曲花街",
    "渡轮大厦市场",
    "双子峰",
  ],
  sf: [
    "金门大桥游客中心",
    "渔人码头 39 号码头",
    "恶魔岛",
    "九曲花街",
    "渡轮大厦市场",
    "双子峰",
  ],
  pisa: [
    "比萨斜塔",
    "奇迹广场",
    "比萨主教座堂",
    "圣若望洗礼堂",
    "骑士广场",
    "阿诺河岸 Lungarni",
  ],
};

const VAGUE_ACTIVITY_RE =
  /(城市地标|地标打卡|本地文化|当地文化|当地特色|本地特色|文化体验|自由活动|城市漫步|city landmark|local culture|local experience)/i;

const CITY_COORDINATES: Record<string, [number, number]> = {
  tokyo: [35.6762, 139.6503],
  kyoto: [35.0116, 135.7681],
  osaka: [34.6937, 135.5023],
  singapore: [1.3521, 103.8198],
  sydney: [-33.8688, 151.2093],
  london: [51.5072, -0.1276],
  paris: [48.8566, 2.3522],
  newyork: [40.7128, -74.006],
  nyc: [40.7128, -74.006],
  beijing: [39.9042, 116.4074],
  sanfrancisco: [37.7749, -122.4194],
  sf: [37.7749, -122.4194],
  pisa: [43.7228, 10.4017],
  rome: [41.9028, 12.4964],
  seoul: [37.5665, 126.978],
  bangkok: [13.7563, 100.5018],
  hongkong: [22.3193, 114.1694],
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

function getCityCoordinates(city: string): [number, number] {
  const key = normalizeLookupKey(city);
  const direct = CITY_COORDINATES[key];
  if (direct) return direct;

  const seed = hashString(city);
  const lat = (seed % 110) - 45;
  const lng = ((seed * 7) % 260) - 130;
  return [lat, lng];
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

function addDays(value: string, days: number): string {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  parsed.setDate(parsed.getDate() + days);
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDepartureDate(travelState: TravelState): string {
  return travelState.departure_date ?? new Date().toISOString().slice(0, 10);
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
      id: `city-${normalizeLookupKey(segment.city)}`,
      label: segment.label,
      caption: segment.rangeLabel,
      kind: "city",
      city: segment.city,
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

function buildFallbackMapPoints(segments: CitySegment[]): TripMapPoint[] {
  return segments.map((segment, index) => {
    const [lat, lng] = getCityCoordinates(segment.city);
    return {
      id: `itinerary-city-${normalizeLookupKey(segment.city)}-${index}`,
      kind: "city",
      label: segment.city,
      subtitle: segment.rangeLabel,
      localName: segment.label,
      intro: `${segment.label}行程节点，建议围绕当天住宿和核心景点安排动线。`,
      imageSrc: segment.imageSrc,
      lat,
      lng,
      city: segment.city,
    };
  });
}

function buildFallbackRouteCoordinates(
  travelState: TravelState,
  segments: CitySegment[]
): Array<[number, number]> {
  if (!segments.length) return [];

  const routeCities: string[] = [];
  if (travelState.origin_city) routeCities.push(travelState.origin_city);
  routeCities.push(...segments.map((segment) => segment.city));
  if (
    travelState.return_city &&
    normalizeLookupKey(travelState.return_city) !==
      normalizeLookupKey(routeCities[routeCities.length - 1] ?? "")
  ) {
    routeCities.push(travelState.return_city);
  }

  return routeCities.map(getCityCoordinates);
}

function formatDayTab(day: ItineraryDay): string {
  const dayNumber = typeof day.day === "number" ? day.day : String(day.day);
  return `天 ${dayNumber}`;
}

function getCitySectionKey(city: string): string {
  return normalizeLookupKey(city) || city;
}

function getSegmentDays(
  itinerary: ItineraryDay[],
  segment: CitySegment
): ItineraryDay[] {
  const cityKey = normalizeLookupKey(segment.city);
  const daysByCity = itinerary.filter(
    (day) => normalizeLookupKey(day.city) === cityKey
  );
  if (daysByCity.length) return daysByCity;

  return itinerary.filter((day) => {
    const dayNumber =
      typeof day.day === "number" ? day.day : Number.parseInt(String(day.day), 10);
    return dayNumber >= segment.dayStart && dayNumber <= segment.dayEnd;
  });
}

function getCityIntro(segment: CitySegment, days: ItineraryDay[]): string {
  const highlights = Array.from(
    new Set(days.flatMap((day) => [...day.activities, ...day.food]).filter(Boolean))
  ).slice(0, 4);
  const highlightText = highlights.length
    ? highlights.join("、")
    : "经典景点、当地美食和顺路体验";

  return `在${segment.rangeLabel}的${segment.label}行程中，你会围绕${highlightText}展开安排。点击下方每天卡片可以进入详细动线，地图会同步展示当天城市和相关节点。`;
}

function getCityGalleryImages(segment: CitySegment, days: ItineraryDay[]): string[] {
  const images = [
    segment.imageSrc,
    ...days.map((day, index) => getDayImage(day, index)),
  ];
  return Array.from(new Set(images)).slice(0, 3);
}

function getHotelDisplayPrice(hotel: SelectedHotelOption): string {
  const rawPrice =
    hotel.option.total_price ??
    hotel.option.average_price_per_night ??
    hotel.option.price_per_night;
  if (!rawPrice) return "已选择";

  const currency = hotel.option.currency?.trim();
  const priceText = String(rawPrice);
  if (!currency || priceText.includes(currency)) return priceText;
  const currencyLabel = currency.toUpperCase() === "AUD" ? "AU$" : currency;
  return `${currencyLabel}${priceText}`;
}

function joinList(items: string[]): string {
  return items.filter(Boolean).join("、") || "-";
}

function isVagueActivityName(value: string): boolean {
  return !value.trim() || VAGUE_ACTIVITY_RE.test(value);
}

function getSpecificAttraction(city: string, dayIndex: number, activityIndex: number): string {
  const key = normalizeLookupKey(city);
  const attractions = SPECIFIC_ATTRACTIONS_BY_KEY[key];
  if (!attractions?.length) {
    return `${getLocalCityLabel(city)} 市中心历史街区`;
  }

  return attractions[(dayIndex * 2 + activityIndex) % attractions.length];
}

function buildAttractionRows(itinerary: ItineraryDay[]): ItineryTableRow[] {
  return itinerary.flatMap((day, dayIndex) => {
    const activities =
      day.activities.length > 0
        ? day.activities
        : [
            getSpecificAttraction(day.city, dayIndex, 0),
            getSpecificAttraction(day.city, dayIndex, 1),
          ];

    return activities.map((activity, activityIndex) => {
      const name = isVagueActivityName(activity)
        ? getSpecificAttraction(day.city, dayIndex, activityIndex)
        : activity;

      return {
        type: "景点",
        date: formatDayTab(day),
        route: getLocalCityLabel(day.city),
        name,
        details: day.food.length ? `餐饮：${joinList(day.food)}` : "-",
        contact: "-",
      };
    });
  });
}

function buildDefaultHotelRows(
  segments: CitySegment[],
  travelState: TravelState
): ItineryTableRow[] {
  const startDate = getDepartureDate(travelState);

  return segments.map((segment) => {
    const checkIn = addDays(startDate, segment.dayStart - 1);
    const nights = Math.max(1, segment.dayEnd - segment.dayStart);
    const checkOut = addDays(startDate, segment.dayStart - 1 + nights);

    return {
      type: "酒店",
      date: `${formatMonthDay(checkIn)} - ${formatMonthDay(checkOut)}`,
      route: segment.label,
      name: `${segment.label}默认酒店（可编辑）`,
      details: `${nights}晚；默认住宿占位；用户可修改酒店名、地址和价格`,
      contact: "待补充",
    };
  });
}

function buildSelectedHotelRows(hotels: SelectedHotelOption[]): ItineryTableRow[] {
  return hotels.map((hotel) => ({
    type: "酒店",
    date: `${formatMonthDay(hotel.check_in)} - ${formatMonthDay(hotel.check_out)}`,
    route: getLocalCityLabel(hotel.city),
    name: hotel.option.name ?? `${getLocalCityLabel(hotel.city)}酒店`,
    details: `${hotel.nights}晚；${hotel.option.address ?? "-"}；${getHotelDisplayPrice(
      hotel
    )}`,
    contact: hotel.option.contact_phone ?? "待补充",
  }));
}

function buildDefaultFlightRows(
  segments: CitySegment[],
  travelState: TravelState
): ItineryTableRow[] {
  const firstCity = segments[0]?.city;
  const lastCity = segments[segments.length - 1]?.city ?? firstCity;
  if (!firstCity || !lastCity) return [];

  const origin = travelState.origin_city?.trim() || firstCity;
  const returnCity = travelState.return_city?.trim() || origin;
  const startDate = getDepartureDate(travelState);
  const rows: ItineryTableRow[] = [];

  if (normalizeLookupKey(origin) !== normalizeLookupKey(firstCity)) {
    rows.push({
      type: "航班",
      date: formatMonthDay(startDate),
      route: `${getLocalCityLabel(origin)} → ${getLocalCityLabel(firstCity)}`,
      name: "默认航班（可编辑）",
      details: "经济舱；用户可修改时间、价格和航司",
      contact: "TBD",
    });
  }

  if (normalizeLookupKey(lastCity) !== normalizeLookupKey(returnCity)) {
    const returnDate = addDays(
      startDate,
      Math.max(0, segments[segments.length - 1].dayEnd - 1)
    );
    rows.push({
      type: "航班",
      date: formatMonthDay(returnDate),
      route: `${getLocalCityLabel(lastCity)} → ${getLocalCityLabel(returnCity)}`,
      name: "默认航班（可编辑）",
      details: "经济舱；用户可修改时间、价格和航司",
      contact: "TBD",
    });
  }

  if (!rows.length) {
    rows.push({
      type: "航班",
      date: formatMonthDay(startDate),
      route: `${getLocalCityLabel(origin)} → ${getLocalCityLabel(firstCity)}`,
      name: "默认航班（可编辑）",
      details: "经济舱；用户可修改出发/到达城市和航班号",
      contact: "TBD",
    });
  }

  return rows;
}

function buildSelectedFlightRows(flights: SelectedFlightOption[]): ItineryTableRow[] {
  return flights
    .filter((flight) => !flight.skip)
    .map((flight) => {
      const option = flight.option;
      const airline = option?.airline ?? option?.provider ?? "已选航班";
      const airports = [option?.from_id ?? option?.from, option?.to_id ?? option?.to]
        .filter(Boolean)
        .join(" → ");
      const stops =
        option?.stops === 0
          ? "直飞"
          : typeof option?.stops === "number"
            ? `${option.stops}次中转`
            : "-";

      return {
        type: "航班",
        date: flight.departure_date,
        route: `${flight.from} → ${flight.to}`,
        name: airline,
        details: [airports, option?.duration, stops].filter(Boolean).join("；") || "-",
        contact: option?.flight_number ?? "TBD",
      };
    });
}

function buildItineryTableRows(
  itinerary: ItineraryDay[],
  travelState: TravelState,
  segments: CitySegment[]
): ItineryTableRow[] {
  const attractionRows = buildAttractionRows(itinerary);
  const hotelRows = travelState.selected_hotels.length
    ? buildSelectedHotelRows(travelState.selected_hotels)
    : buildDefaultHotelRows(segments, travelState);
  const selectedFlightRows = buildSelectedFlightRows(travelState.selected_flights);
  const flightRows = selectedFlightRows.length
    ? selectedFlightRows
    : buildDefaultFlightRows(segments, travelState);

  return [...attractionRows, ...hotelRows, ...flightRows];
}

function buildTravelExportPayload(
  itinerary: ItineraryDay[],
  travelState: TravelState,
  orderedCities: string[],
  itineryRows: ItineryTableRow[]
): TravelExportPayload {
  const cities =
    travelState.cities.length > 0
      ? travelState.cities
      : orderedCities.length > 0
        ? orderedCities
        : getUniqueCities(itinerary, orderedCities);
  const travelOrder =
    travelState.travel_order.length > 0 ? travelState.travel_order : cities;

  return {
    country: travelState.country ?? travelState.countries[0] ?? "",
    countries: travelState.countries,
    cities,
    city_days: travelState.city_days,
    departure_date: travelState.departure_date ?? undefined,
    date_flexibility: travelState.date_flexibility ?? undefined,
    travel_days: travelState.travel_days ?? Math.max(1, itinerary.length),
    travelers: travelState.travelers ?? 1,
    budget: travelState.budget ?? 1,
    travel_order: travelOrder,
    origin_country: travelState.origin_country ?? undefined,
    origin_city: travelState.origin_city ?? undefined,
    return_country: travelState.return_country ?? undefined,
    return_city: travelState.return_city ?? undefined,
    selected_flights: travelState.selected_flights,
    selected_hotels: travelState.selected_hotels,
    final_note: travelState.final_note ?? "",
    attached_files: travelState.attached_files,
    itinerary,
    itinery_rows: itineryRows,
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

export function TravelItineraryExperience({
  itinerary,
  travelState,
  orderedCities,
  routeCoordinates,
  mapPoints,
  activePointId,
  initialItineryRows,
  versionOptions = [],
  activeVersionId,
  activeVersionSummary,
  onPointSelect,
  onVersionSelect,
}: TravelItineraryExperienceProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [fullMapOpen, setFullMapOpen] = useState(false);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [activeCityKey, setActiveCityKey] = useState("");
  const [highlightCityKey, setHighlightCityKey] = useState("");
  const [fullMapActiveCity, setFullMapActiveCity] = useState("");
  const [isRoutePlaying, setIsRoutePlaying] = useState(true);
  const [editableItineryRows, setEditableItineryRows] = useState<ItineryTableRow[]>([]);
  const [isDownloadingWord, setIsDownloadingWord] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isSharingLink, setIsSharingLink] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const citySectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const hotelDisplayCount = Math.max(
    travelState.selected_hotels.length,
    segments.length
  );
  const fallbackMapPoints = useMemo(
    () => buildFallbackMapPoints(segments),
    [segments]
  );
  const resolvedMapPoints = useMemo(
    () => [
      ...fallbackMapPoints,
      ...mapPoints.filter((point) => point.kind === "hotel"),
    ],
    [fallbackMapPoints, mapPoints]
  );
  const resolvedRouteCoordinates = useMemo(
    () =>
      segments.length
        ? buildFallbackRouteCoordinates(travelState, segments)
        : routeCoordinates,
    [routeCoordinates, segments, travelState]
  );
  const essentialMapPoints = useMemo(
    () => filterEssentialMapPoints(resolvedMapPoints),
    [resolvedMapPoints]
  );
  const focusedPointId = activeDay
    ? getPointIdForCity(resolvedMapPoints, activeDay.city) ?? activePointId ?? null
    : activePointId ?? null;
  const fullMapActivePointId = fullMapActiveCity
    ? getPointIdForCity(resolvedMapPoints, fullMapActiveCity)
    : null;
  const defaultItineryRows = useMemo(
    () =>
      initialItineryRows?.length
        ? initialItineryRows
        : buildItineryTableRows(itinerary, travelState, segments),
    [initialItineryRows, itinerary, segments, travelState]
  );
  const exportPayload = useMemo(
    () =>
      buildTravelExportPayload(
        itinerary,
        travelState,
        orderedCities,
        editableItineryRows
      ),
    [editableItineryRows, itinerary, orderedCities, travelState]
  );
  const sharePayload = useMemo(
    () =>
      buildTravelItinerarySharePayload(
        title,
        itinerary,
        travelState,
        editableItineryRows
      ),
    [editableItineryRows, itinerary, title, travelState]
  );

  useEffect(() => {
    setActiveDayIndex(0);
  }, [itinerary]);

  useEffect(() => {
    setEditableItineryRows(defaultItineryRows);
  }, [defaultItineryRows]);

  useEffect(() => {
    const firstCityKey = segments[0] ? getCitySectionKey(segments[0].city) : "";
    setActiveCityKey((currentKey) =>
      segments.some((segment) => getCitySectionKey(segment.city) === currentKey)
        ? currentKey
        : firstCityKey
    );
    setFullMapActiveCity((currentCity) =>
      segments.some(
        (segment) =>
          getCitySectionKey(segment.city) === getCitySectionKey(currentCity)
      )
        ? currentCity
        : segments[0]?.city ?? ""
    );
  }, [segments]);

  useEffect(
    () => () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    const root = scrollContainerRef.current;
    if (!root || !segments.length || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];
        const nextCityKey = visibleEntry?.target.getAttribute("data-city-key");
        if (nextCityKey) {
          setActiveCityKey(nextCityKey);
        }
      },
      {
        root,
        rootMargin: "-18% 0px -60% 0px",
        threshold: [0.2, 0.45, 0.7],
      }
    );

    segments.forEach((segment) => {
      const node = citySectionRefs.current[getCitySectionKey(segment.city)];
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, [segments]);

  const scrollToCity = useCallback((city: string) => {
    const cityKey = getCitySectionKey(city);
    const node = citySectionRefs.current[cityKey];
    setActiveCityKey(cityKey);
    setHighlightCityKey(cityKey);
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = setTimeout(() => {
      setHighlightCityKey((currentKey) => (currentKey === cityKey ? "" : currentKey));
    }, 1600);
    node?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const openDetailAtDay = (index: number) => {
    setActiveDayIndex(index);
    setDetailOpen(true);
  };

  const updateItineryRow = useCallback(
    (rowIndex: number, field: keyof ItineryTableRow, value: string) => {
      setEditableItineryRows((rows) =>
        rows.map((row, index) =>
          index === rowIndex
            ? {
                ...row,
                [field]: value,
              }
            : row
        )
      );
    },
    []
  );

  const removeItineryRow = useCallback((rowIndex: number) => {
    setEditableItineryRows((rows) => rows.filter((_, index) => index !== rowIndex));
  }, []);

  const addItineryRow = useCallback(() => {
    const city = activeDay?.city ?? segments[0]?.city ?? "";
    setEditableItineryRows((rows) => [
      ...rows,
      {
        type: "景点",
        date: activeDay ? formatDayTab(activeDay) : "天 1",
        route: city ? getLocalCityLabel(city) : "待填写",
        name: "新的景点/酒店/航班",
        details: "点击单元格修改详情",
        contact: "-",
      },
    ]);
  }, [activeDay, segments]);

  const resetItineryRows = useCallback(() => {
    setEditableItineryRows(defaultItineryRows);
  }, [defaultItineryRows]);

  const handleShareLink = async () => {
    if (typeof window === "undefined") return;

    setIsSharingLink(true);
    try {
      const url = new URL("/travel-itinerary", window.location.origin);
      url.searchParams.set(
        TRAVEL_ITINERARY_SHARE_PARAM,
        encodeTravelItinerarySharePayload(sharePayload)
      );
      url.hash = "";

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url.toString());
        toast.success("分享链接已复制。");
      } else {
        window.prompt("复制分享链接", url.toString());
      }
    } catch {
      toast.error("分享链接生成失败，请稍后再试。");
    } finally {
      setIsSharingLink(false);
    }
  };

  const handleDownload = async (
    endpoint: TravelDownloadEndpoint,
    fallbackFilename: string,
    setBusy: (busy: boolean) => void
  ) => {
    setBusy(true);
    try {
      await downloadBlob(endpoint, exportPayload, fallbackFilename);
      toast.success(`${fallbackFilename} 已开始下载。`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `${fallbackFilename} 下载失败。`;
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const handleFullMapOpenChange = useCallback(
    (open: boolean) => {
      setFullMapOpen(open);
      if (open) {
        setIsRoutePlaying(true);
        setFullMapActiveCity((currentCity) => currentCity || segments[0]?.city || "");
      }
    },
    [segments]
  );

  const handleFullMapPointSelect = useCallback(
    (id: string) => {
      onPointSelect?.(id);
      const point = resolvedMapPoints.find((item) => item.id === id);
      if (point) {
        setFullMapActiveCity(point.city ?? point.label);
      }
    },
    [onPointSelect, resolvedMapPoints]
  );

  const renderCityTabs = (placement: "map" | "sticky") => (
    <div
      className={cn(
        "flex max-w-full items-center gap-2 overflow-x-auto rounded-full bg-white/95 p-2 shadow-[0_14px_36px_rgba(32,20,43,0.16)] backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        placement === "map"
          ? "absolute left-1/2 top-4 z-20 -translate-x-1/2"
          : "sticky top-4 z-30 mx-auto w-fit"
      )}
      data-testid={`travel-itinerary-city-tabs-${placement}`}
    >
      {segments.map((segment, index) => {
        const cityKey = getCitySectionKey(segment.city);
        const active = cityKey === activeCityKey;

        return (
          <button
            aria-current={active ? "location" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-[#2d1635] transition-colors",
              active ? "bg-[#d9c2ff]" : "hover:bg-[#f5f0fb]"
            )}
            data-testid={`travel-itinerary-city-tab-${placement}-${cityKey}`}
            key={`city-tab-${cityKey}-${placement}`}
            onClick={() => scrollToCity(segment.city)}
            type="button"
          >
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border text-xs",
                active
                  ? "border-white bg-white text-[#2d1635]"
                  : "border-[#d8d2dd] bg-white text-[#5f5166]"
              )}
            >
              {index + 1}
            </span>
            {segment.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <div
        className="h-full min-h-0 overflow-y-auto bg-[#f7f6f2] px-5 py-6 [scrollbar-width:none] md:px-8 md:py-8 [&::-webkit-scrollbar]:hidden"
        data-testid="travel-itinerary-experience"
        ref={scrollContainerRef}
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
                    {hotelDisplayCount} 酒店
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

            {versionOptions.length > 0 && (
              <div
                className="mt-5 rounded-xl border border-[#eadfff] bg-[#fbf8ff] px-4 py-3"
                data-testid="travel-itinerary-version-bar"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="inline-flex items-center gap-2 text-xs font-semibold text-[#6f40cc]">
                      <Clock3 className="h-3.5 w-3.5" />
                      版本历史
                    </p>
                    <p className="mt-1 truncate text-sm text-[#4d3b55]">
                      {activeVersionSummary || "每次聊天修改都会保存为一个新版本。"}
                    </p>
                  </div>
                  <div className="flex max-w-full flex-wrap items-center gap-2">
                    {versionOptions.map((version) => {
                      const active = version.id === activeVersionId;
                      return (
                        <Button
                          className={cn(
                            "h-8 rounded-full px-3 text-xs",
                            active
                              ? "bg-[#03346E] text-white hover:bg-[#022b5d]"
                              : "border-[#d8c5ff] bg-white text-[#2d1635] hover:bg-[#f6efff]"
                          )}
                          data-testid="travel-itinerary-version-button"
                          key={version.id}
                          onClick={() => onVersionSelect?.(version.id)}
                          type="button"
                          variant={active ? "default" : "outline"}
                        >
                          {version.label}
                          {version.isLatest ? " · 最新" : active ? " · 已回退" : ""}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <Button
                className="rounded-full border-[#d8c5ff] bg-white text-[#2d1635] hover:bg-[#f6efff]"
                data-testid="travel-itinerary-share-link-button"
                disabled={isSharingLink}
                onClick={handleShareLink}
                type="button"
                variant="outline"
              >
                <Share2 className="h-4 w-4" />
                分享链接
              </Button>
              <Button
                className="rounded-full border-[#d8c5ff] bg-white text-[#2d1635] hover:bg-[#f6efff]"
                data-testid="travel-itinerary-download-word-button"
                disabled={isDownloadingWord}
                onClick={() =>
                  handleDownload(
                    "/api/travel/download-word",
                    "travel-itinerary.docx",
                    setIsDownloadingWord
                  )
                }
                type="button"
                variant="outline"
              >
                <FileText className="h-4 w-4" />
                Word
              </Button>
              <Button
                className="rounded-full border-[#d8c5ff] bg-white text-[#2d1635] hover:bg-[#f6efff]"
                data-testid="travel-itinerary-download-pdf-button"
                disabled={isDownloadingPdf}
                onClick={() =>
                  handleDownload(
                    "/api/travel/download-pdf",
                    "travel-itinerary.pdf",
                    setIsDownloadingPdf
                  )
                }
                type="button"
                variant="outline"
              >
                <Download className="h-4 w-4" />
                PDF
              </Button>
            </div>

            <div className="mt-8 flex items-center gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {routeNodes.map((node, index) => {
                const cityIndex = node.city
                  ? segments.findIndex(
                      (segment) =>
                        getCitySectionKey(segment.city) === getCitySectionKey(node.city ?? "")
                    )
                  : -1;
                const active =
                  node.city !== undefined &&
                  getCitySectionKey(node.city) === activeCityKey;
                const nodeClasses = cn(
                  "flex min-w-[132px] items-center gap-3 rounded-2xl px-4 py-3 text-[#2d1635]",
                  node.kind === "city"
                    ? "bg-white shadow-[0_8px_28px_rgba(32,20,43,0.08)] transition-colors hover:bg-[#f8f3ff]"
                    : "bg-transparent",
                  active && "bg-[#dcc7ff]"
                );
                const nodeContent = (
                  <>
                    {node.kind === "city" ? (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#efe5ff] text-xs font-bold text-[#6f40cc]">
                        {cityIndex + 1}
                      </span>
                    ) : (
                      <MapPin className="h-5 w-5" />
                    )}
                    <span>
                      <span className="block text-base font-bold">{node.label}</span>
                      <span className="block text-sm text-[#5f5166]">{node.caption}</span>
                    </span>
                  </>
                );

                return (
                  <div className="flex shrink-0 items-center gap-3" key={node.id}>
                    {node.kind === "city" && node.city ? (
                      <button
                        className={nodeClasses}
                        data-testid={`travel-itinerary-route-city-${getCitySectionKey(
                          node.city
                        )}`}
                        onClick={() => scrollToCity(node.city ?? "")}
                        type="button"
                      >
                        {nodeContent}
                      </button>
                    ) : (
                      <div className={nodeClasses}>{nodeContent}</div>
                    )}
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
                );
              })}
            </div>
          </section>

          <section
            className="rounded-[28px] bg-white p-5 shadow-[0_16px_46px_rgba(32,20,43,0.08)] md:p-6"
            data-testid="travel-itinerary-itinery-table"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-2xl font-bold text-[#2d1635]">itinery</h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#f6efff] px-3 py-1 text-sm font-bold text-[#6f40cc]">
                  {editableItineryRows.length} 项
                </span>
                <Button
                  className="rounded-full border-[#d8c5ff] text-[#6f40cc] hover:bg-[#f6efff]"
                  onClick={addItineryRow}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Plus className="h-4 w-4" />
                  添加项目
                </Button>
                <Button
                  className="rounded-full text-[#756a7b] hover:bg-slate-100"
                  onClick={resetItineryRows}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  重置默认
                </Button>
              </div>
            </div>
            <div className="mt-4 max-h-[360px] overflow-auto rounded-2xl border border-[#e6dff0] [scrollbar-width:thin]">
              <table className="min-w-[1080px] w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-[#efe5ff] text-[#2d1635]">
                  <tr>
                    {[
                      "类型",
                      "日期/天数",
                      "城市/路线",
                      "名称",
                      "详情",
                      "联系电话/航班号",
                      "操作",
                    ].map((header) => (
                      <th className="px-4 py-3 font-bold" key={header}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eee7f5]">
                  {editableItineryRows.length ? (
                    editableItineryRows.map((row, index) => (
                      <tr className="align-top text-[#3a273f]" key={`${row.type}-${index}`}>
                        {(
                          [
                            ["type", "类型"],
                            ["date", "日期/天数"],
                            ["route", "城市/路线"],
                            ["name", "名称"],
                            ["details", "详情"],
                            ["contact", "联系电话/航班号"],
                          ] as const
                        ).map(([field, label]) => (
                          <td className="px-3 py-2" key={`${field}-${index}`}>
                            {field === "details" ? (
                              <textarea
                                aria-label={`${label}-${index + 1}`}
                                className="min-h-16 w-full resize-none rounded-xl border border-transparent bg-transparent px-3 py-2 font-semibold text-[#5f5166] outline-none transition-colors hover:border-[#e6dff0] hover:bg-white focus:border-[#b990ff] focus:bg-white"
                                onChange={(event) =>
                                  updateItineryRow(index, field, event.target.value)
                                }
                                value={row[field]}
                              />
                            ) : (
                              <input
                                aria-label={`${label}-${index + 1}`}
                                className={cn(
                                  "w-full rounded-xl border border-transparent bg-transparent px-3 py-2 outline-none transition-colors hover:border-[#e6dff0] hover:bg-white focus:border-[#b990ff] focus:bg-white",
                                  field === "type" ||
                                    field === "name" ||
                                    field === "contact"
                                    ? "font-bold text-[#2d1635]"
                                    : "font-semibold text-[#5f5166]"
                                )}
                                onChange={(event) =>
                                  updateItineryRow(index, field, event.target.value)
                                }
                                value={row[field]}
                              />
                            )}
                          </td>
                        ))}
                        <td className="whitespace-nowrap px-4 py-3">
                          <Button
                            aria-label={`删除第 ${index + 1} 项`}
                            className="h-9 w-9 rounded-full border-[#d8c5ff] text-[#6f40cc] hover:bg-[#f6efff]"
                            onClick={() => removeItineryRow(index)}
                            size="icon"
                            type="button"
                            variant="outline"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-4 text-[#5f5166]" colSpan={7}>
                        暂无可导出的行程项目
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="relative min-h-[260px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(32,20,43,0.1)]">
            {segments.length > 1 ? renderCityTabs("map") : null}
            <TripRouteMap
              activePointId={focusedPointId}
              className="h-[300px] w-full md:h-[360px]"
              onPointSelect={onPointSelect}
              points={essentialMapPoints}
              routeCoordinates={resolvedRouteCoordinates}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/8 via-transparent to-white/10" />
            <Button
              className="absolute bottom-5 right-5 h-14 rounded-full bg-white px-6 text-base font-bold text-[#2d1635] shadow-[0_12px_32px_rgba(32,20,43,0.18)] hover:bg-white"
              data-testid="travel-itinerary-full-map-button"
              onClick={() => handleFullMapOpenChange(true)}
              type="button"
            >
              <MapPinned className="h-5 w-5" />
              查看完整地图
            </Button>
          </section>

          <section className="space-y-7 pb-3">
            {segments.length > 1 ? renderCityTabs("sticky") : null}

            <div className="space-y-9">
              {segments.map((segment, segmentIndex) => {
                const cityKey = getCitySectionKey(segment.city);
                const days = getSegmentDays(itinerary, segment);
                const hotel = findHotelForCity(travelState.selected_hotels, segment.city);
                const nextSegment = segments[segmentIndex + 1];
                const galleryImages = getCityGalleryImages(segment, days);
                const firstDayIndex = days[0]
                  ? Math.max(0, itinerary.indexOf(days[0]))
                  : 0;

                return (
                  <section
                    className={cn(
                      "grid scroll-mt-28 gap-5 rounded-[30px] transition-shadow duration-500 md:grid-cols-[164px_minmax(0,1fr)]",
                      highlightCityKey === cityKey &&
                        "ring-4 ring-[#d9c2ff] ring-offset-4 ring-offset-[#f7f6f2]"
                    )}
                    data-city-key={cityKey}
                    data-testid={`travel-itinerary-city-section-${cityKey}`}
                    id={`travel-itinerary-city-${cityKey}`}
                    key={`city-section-${cityKey}`}
                    ref={(node) => {
                      citySectionRefs.current[cityKey] = node;
                    }}
                  >
                    <aside className="relative hidden md:block">
                      {segmentIndex < segments.length - 1 ? (
                        <span className="absolute left-[31px] top-16 h-[calc(100%+48px)] w-px bg-[#d7d1dc]" />
                      ) : null}
                      <div className="sticky top-24 flex items-start gap-4">
                        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#2d1635] text-white shadow-[0_12px_28px_rgba(32,20,43,0.2)]">
                          <MapPin className="h-8 w-8" />
                        </span>
                        <span className="pt-2 text-[#2d1635]">
                          <span className="block text-base font-bold">
                            天数 {segment.dayStart}-{segment.dayEnd}
                          </span>
                          <span className="block text-sm font-semibold text-[#5f5166]">
                            {segment.rangeLabel}
                          </span>
                        </span>
                      </div>
                    </aside>

                    <div className="space-y-5">
                      <div className="rounded-[28px] bg-white p-5 shadow-[0_16px_46px_rgba(32,20,43,0.08)] md:p-7">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#8d5df7]">
                              {segment.rangeLabel}
                            </p>
                            <h3 className="mt-1 text-3xl font-bold text-[#2d1635]">
                              {segment.label}
                            </h3>
                          </div>
                          <Button
                            className="rounded-full border-[#d8c5ff] text-[#6f40cc] hover:bg-[#f6efff]"
                            onClick={() => openDetailAtDay(firstDayIndex)}
                            type="button"
                            variant="outline"
                          >
                            查看行程
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="mt-4 max-w-3xl text-base font-medium leading-relaxed text-[#3a273f]">
                          {getCityIntro(segment, days)}
                        </p>

                        <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(160px,0.6fr)]">
                          <div className="relative aspect-[16/9] overflow-hidden rounded-[22px] bg-slate-200">
                            <Image
                              alt={`${segment.label} itinerary hero`}
                              className="h-full w-full object-cover"
                              height={420}
                              src={galleryImages[0] ?? segment.imageSrc}
                              width={760}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4 md:grid-cols-1">
                            {(galleryImages.length > 1
                              ? galleryImages.slice(1, 3)
                              : [segment.imageSrc, segment.imageSrc]
                            ).map((imageSrc, imageIndex) => (
                              <div
                                className="relative min-h-28 overflow-hidden rounded-[20px] bg-slate-200"
                                key={`${cityKey}-gallery-${imageSrc}-${imageIndex}`}
                              >
                                <Image
                                  alt={`${segment.label} gallery ${imageIndex + 1}`}
                                  className="h-full w-full object-cover"
                                  height={240}
                                  src={imageSrc}
                                  width={320}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {hotel ? (
                        <article className="grid gap-4 rounded-[24px] bg-white p-4 shadow-[0_14px_42px_rgba(32,20,43,0.08)] md:grid-cols-[180px_minmax(0,1fr)_auto]">
                          <div className="relative h-36 overflow-hidden rounded-[18px] bg-slate-200 md:h-full">
                            <Image
                              alt={hotel.option.name ?? `${segment.label} hotel`}
                              className="h-full w-full object-cover"
                              height={220}
                              src={segment.imageSrc}
                              width={280}
                            />
                          </div>
                          <div className="min-w-0 py-1">
                            <div className="flex text-orange-500">
                              {[0, 1, 2].map((item) => (
                                <Star
                                  className="h-4 w-4 fill-current"
                                  key={`hotel-star-${cityKey}-${item}`}
                                />
                              ))}
                            </div>
                            <h4 className="mt-2 text-xl font-bold text-[#2d1635]">
                              {hotel.option.name ?? `${segment.label}精选酒店`}
                            </h4>
                            <p className="mt-1 text-sm font-semibold text-[#756a7b]">
                              {hotel.nights} 晚上 · {formatMonthDay(hotel.check_in)} -{" "}
                              {formatMonthDay(hotel.check_out)}
                            </p>
                            {hotel.option.address ? (
                              <p className="mt-2 line-clamp-1 text-sm text-[#756a7b]">
                                {hotel.option.address}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-end justify-between gap-3 md:flex-col">
                            {hotel.option.rating ? (
                              <span className="rounded-2xl bg-[#e7d3ff] px-3 py-2 text-lg font-bold text-[#2d1635]">
                                {hotel.option.rating}
                              </span>
                            ) : null}
                            <span className="text-right">
                              <span className="block text-xs font-semibold text-[#756a7b]">
                                来自
                              </span>
                              <span className="block text-2xl font-bold text-[#2d1635]">
                                {getHotelDisplayPrice(hotel)}
                              </span>
                            </span>
                          </div>
                        </article>
                      ) : null}

                      <div className="space-y-3">
                        {days.map((day) => {
                          const dayIndex = itinerary.indexOf(day);
                          const safeDayIndex = dayIndex >= 0 ? dayIndex : 0;

                          return (
                            <button
                              className="grid w-full gap-4 rounded-[24px] bg-white p-3 text-left shadow-[0_12px_36px_rgba(32,20,43,0.08)] transition-transform hover:-translate-y-0.5 md:grid-cols-[150px_1fr_auto]"
                              data-testid={`travel-itinerary-day-card-${cityKey}-${day.day}`}
                              key={`${cityKey}-day-${day.day}`}
                              onClick={() => openDetailAtDay(safeDayIndex)}
                              type="button"
                            >
                              <div className="relative h-24 overflow-hidden rounded-[18px] md:h-full">
                                <Image
                                  alt={`${getLocalCityLabel(day.city)} itinerary`}
                                  className="h-full w-full object-cover"
                                  height={160}
                                  src={getDayImage(day, safeDayIndex)}
                                  width={240}
                                />
                              </div>
                              <div className="min-w-0 py-1">
                                <p className="text-sm font-semibold text-[#8d5df7]">
                                  {formatDayTab(day)} · {day.activities.length} 体验 ·{" "}
                                  {day.cost}
                                </p>
                                <p className="mt-1 text-lg font-bold text-[#2d1635]">
                                  {summarizeDay(day)}
                                </p>
                                <p className="mt-1 line-clamp-1 text-sm leading-relaxed text-[#5f5166]">
                                  {getLocalCityLabel(day.city)}
                                </p>
                              </div>
                              <span className="self-center justify-self-end text-[#918796]">
                                <ChevronRight className="h-6 w-6" />
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {nextSegment ? (
                        <div className="rounded-[24px] bg-white p-5 shadow-[0_12px_36px_rgba(32,20,43,0.08)]">
                          <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr_auto]">
                            <div>
                              <p className="text-xl font-bold text-[#2d1635]">
                                {segment.label}
                              </p>
                              <p className="text-sm font-semibold text-[#756a7b]">
                                {segment.rangeLabel}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 text-[#6f40cc]">
                              <span className="h-1 w-20 rounded-full bg-[#eadcff]" />
                              <TrainFront className="h-8 w-8" />
                              <span className="h-1 w-20 rounded-full bg-[#eadcff]" />
                            </div>
                            <div className="md:text-right">
                              <p className="text-xl font-bold text-[#2d1635]">
                                {nextSegment.label}
                              </p>
                              <p className="text-sm font-semibold text-[#756a7b]">
                                {nextSegment.rangeLabel}
                              </p>
                            </div>
                            <span className="rounded-full border border-[#d8c5ff] px-4 py-2 text-sm font-bold text-[#6f40cc]">
                              建议交通
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </section>
                );
              })}
            </div>
          </section>

          <div
            className="sticky bottom-4 z-40 mt-2 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/80 bg-white/95 px-4 py-3 shadow-[0_18px_50px_rgba(32,20,43,0.18)] backdrop-blur md:px-5"
            data-testid="travel-itinerary-sticky-actions"
          >
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-[#2d1635]">{title}</p>
              <p className="truncate text-xs font-semibold text-[#756a7b]">
                {segments.map((segment) => segment.label).join(" → ")}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                className="h-10 rounded-full border-[#d8c5ff] bg-white px-3 text-[#2d1635] hover:bg-[#f6efff]"
                disabled={isSharingLink}
                onClick={handleShareLink}
                size="sm"
                type="button"
                variant="outline"
              >
                <Share2 className="h-4 w-4" />
                分享
              </Button>
              <Button
                className="h-10 rounded-full border-[#d8c5ff] bg-white px-3 text-[#2d1635] hover:bg-[#f6efff]"
                disabled={isDownloadingWord}
                onClick={() =>
                  handleDownload(
                    "/api/travel/download-word",
                    "travel-itinerary.docx",
                    setIsDownloadingWord
                  )
                }
                size="sm"
                type="button"
                variant="outline"
              >
                <FileText className="h-4 w-4" />
                Word
              </Button>
              <Button
                className="h-10 rounded-full bg-[#2d1635] px-4 text-white hover:bg-[#43204d]"
                disabled={isDownloadingPdf}
                onClick={() =>
                  handleDownload(
                    "/api/travel/download-pdf",
                    "travel-itinerary.pdf",
                    setIsDownloadingPdf
                  )
                }
                size="sm"
                type="button"
              >
                <Download className="h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>
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
                points={resolvedMapPoints}
                routeCoordinates={resolvedRouteCoordinates}
              />
            </aside>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={fullMapOpen} onOpenChange={handleFullMapOpenChange}>
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
                activePointId={fullMapActivePointId}
                animateRoute={isRoutePlaying}
                className="h-full w-full"
                onPointSelect={handleFullMapPointSelect}
                points={resolvedMapPoints}
                routeCoordinates={resolvedRouteCoordinates}
              />
              <div className="absolute bottom-5 left-5 flex max-w-[calc(100%-40px)] items-end gap-3">
                <Button
                  aria-label={isRoutePlaying ? "暂停动态行程" : "播放动态行程"}
                  className="h-14 w-14 shrink-0 rounded-full bg-[#d9c2ff] text-[#2d1635] shadow-[0_18px_45px_rgba(32,20,43,0.2)] hover:bg-[#cdb0ff]"
                  data-testid="travel-itinerary-full-map-play-toggle"
                  onClick={() => setIsRoutePlaying((playing) => !playing)}
                  size="icon"
                  type="button"
                >
                  {isRoutePlaying ? (
                    <Pause className="h-6 w-6 fill-current" />
                  ) : (
                    <Play className="h-6 w-6 fill-current" />
                  )}
                </Button>
                <div className="max-w-[min(620px,calc(100vw-150px))] rounded-2xl bg-white/95 p-4 shadow-[0_18px_45px_rgba(32,20,43,0.18)] backdrop-blur">
                  <p className="inline-flex items-center gap-2 text-sm font-bold text-[#2d1635]">
                    <WalletCards className="h-4 w-4 text-[#6f40cc]" />
                    动态行程
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {segments.map((segment) => {
                      const active =
                        getCitySectionKey(segment.city) ===
                        getCitySectionKey(fullMapActiveCity);

                      return (
                        <button
                          className={cn(
                            "rounded-full px-3 py-1 text-sm font-semibold transition-colors",
                            active
                              ? "bg-[#d9c2ff] text-[#2d1635]"
                              : "bg-[#f6efff] text-[#6f40cc] hover:bg-[#eadcff]"
                          )}
                          key={`full-map-${segment.city}`}
                          onClick={() => setFullMapActiveCity(segment.city)}
                          type="button"
                        >
                          {segment.label} · {segment.rangeLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
