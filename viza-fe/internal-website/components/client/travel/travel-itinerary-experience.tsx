"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BedDouble,
  CalendarDays,
  Car,
  Check,
  ChevronRight,
  Clock3,
  Compass,
  Download,
  FileText,
  MapPin,
  MapPinned,
  Pause,
  Pencil,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  FlightLegResult,
  FlightOptionResult,
  HotelOptionResult,
  HotelStayResult,
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
import {
  findTravelAttraction,
  getTravelAttractionNamesForCity,
  getTravelAttractionsForCity,
} from "@/components/client/travel/travel-attraction-knowledge";

type ItineryTableRow = {
  time?: string;
  type: string;
  date: string;
  route: string;
  name: string;
  details: string;
  contact: string;
};

type GoogleGeocodeCoordinate = {
  lat: number;
  lng: number;
  formattedAddress?: string;
  placeId?: string;
  locationType?: string;
};

type GoogleGeocodeResult = {
  key: string;
  query: string;
  lat?: number;
  lng?: number;
  formattedAddress?: string;
  placeId?: string;
  locationType?: string;
  status: string;
  error?: string;
};

type GoogleGeocodeRequestItem = {
  key: string;
  query: string;
};

type AttractionChoiceCard = {
  name: string;
  location: string;
  imageSrc: string;
  lat?: number;
  lng?: number;
};

type DetailResourceTab = "attractions" | "flights" | "hotels";
type ApiLoadStatus = "idle" | "loading" | "success" | "error";

type ItineraryOptionPanel =
  | {
      type: "flight";
      leg: FlightLegResult;
      legIndex: number;
    }
  | {
      type: "hotel";
      stay: HotelStayResult;
      stayIndex: number;
      city: string;
    }
  | null;

type TravelItineraryExperienceProps = {
  itinerary: ItineraryDay[];
  travelState: TravelState;
  orderedCities: string[];
  routeCoordinates: Array<[number, number]>;
  mapPoints: TripMapPoint[];
  activePointId?: string | null;
  initialItineryRows?: ItineryTableRow[];
  modulePatch?: Record<string, unknown>;
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

type TravelExportLanguage = "zh" | "en" | "bilingual";

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
  export_language: TravelExportLanguage;
};

const EXPORT_LANGUAGE_OPTIONS: Array<{
  value: TravelExportLanguage;
  label: string;
}> = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
  { value: "bilingual", label: "中英双语" },
];

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
  lyon: "/globe/paris.jpg",
  marseille: "/globe/paris.jpg",
  nice: "/globe/paris.jpg",
  newyork: "/globe/nyc.jpg",
  nyc: "/globe/nyc.jpg",
  beijing: "/globe/beijing.jpg",
  sanfrancisco: "/globe/sf.jpg",
  sf: "/globe/sf.jpg",
  pisa: "/globe/pisa.jpg",
  rome: "/globe/pisa.jpg",
  bangkok: "/globe/singapore.jpg",
  "曼谷": "/globe/singapore.jpg",
  phuket: "/globe/singapore.jpg",
  "普吉岛": "/globe/singapore.jpg",
  chiangmai: "/globe/singapore.jpg",
  "清迈": "/globe/singapore.jpg",
  pattaya: "/globe/singapore.jpg",
  "芭提雅": "/globe/singapore.jpg",
  "芭堤雅": "/globe/singapore.jpg",
};

const LOCAL_CITY_LABELS: Record<string, string> = {
  bali: "巴厘岛",
  denpasar: "登巴萨",
  chengdu: "成都",
  tokyo: "东京",
  kyoto: "京都",
  osaka: "大阪",
  singapore: "新加坡",
  sydney: "悉尼",
  london: "伦敦",
  paris: "巴黎",
  lyon: "里昂",
  marseille: "马赛",
  nice: "尼斯",
  newyork: "纽约",
  nyc: "纽约",
  beijing: "北京",
  sanfrancisco: "旧金山",
  sf: "旧金山",
  pisa: "比萨",
  naples: "那不勒斯",
  kohsamui: "苏梅岛",
  samui: "苏梅岛",
  "koh samui": "苏梅岛",
  rome: "罗马",
  seoul: "首尔",
  bangkok: "曼谷",
  "曼谷": "曼谷",
  phuket: "普吉岛",
  "普吉岛": "普吉岛",
  chiangmai: "清迈",
  "清迈": "清迈",
  pattaya: "芭提雅",
  "芭提雅": "芭提雅",
  "芭堤雅": "芭提雅",
  hongkong: "香港",
};

const LOCAL_TEXT_LABELS: Record<string, string> = {
  ...LOCAL_CITY_LABELS,
  "bali": "巴厘岛",
  "naples": "那不勒斯",
  "chengdu": "成都",
  "denpasar": "登巴萨",
  "kuta": "库塔",
  "ubud": "乌布",
  "nusa penida": "努沙佩尼达",
  "penida": "佩尼达",
  "jl.": "路",
  "jalan": "路",
  "hotel": "酒店",
  "villa": "别墅",
  "lodge": "旅馆",
  "ricefield": "稻田",
  "alba": "阿尔巴",
  "vita": "维塔",
  "domu alba vita": "多穆阿尔巴维塔酒店",
  "elmon ricefield hotel": "埃尔蒙稻田酒店",
  "amalla lodge penida by omanera": "奥马内拉佩尼达阿玛拉旅馆",
  "sayuban villa": "萨尤班别墅",
};

const LOCAL_AIRLINE_LABELS: Record<string, string> = {
  "air china": "中国国际航空",
  "cathay pacific airways": "国泰航空",
  "cathay pacific": "国泰航空",
  "china eastern": "中国东方航空",
  "china eastern airlines": "中国东方航空",
  "shenzhen airlines": "深圳航空",
  "jeju air": "济州航空",
  scoot: "酷航",
  peach: "乐桃航空",
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
  lyon: [
    "富维耶圣母圣殿",
    "里昂老城与圣让街区",
    "白莱果广场",
    "金头公园",
    "里昂美术馆",
    "特拉布勒隐秘通道",
  ],
  marseille: [
    "马赛老港",
    "守护圣母圣殿",
    "卡朗格国家公园",
    "欧洲及地中海文明博物馆 Mucem",
    "伊夫堡",
    "勒帕尼耶老城区",
  ],
  nice: [
    "英国人漫步大道",
    "城堡山公园",
    "尼斯老城",
    "马塞纳广场",
    "萨雷雅市场",
    "马蒂斯美术馆",
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
  "曼谷": [
    "大皇宫与玉佛寺",
    "卧佛寺",
    "郑王庙",
    "乍都乍周末市场",
    "唐人街耀华力路",
    "ICONSIAM",
  ],
  phuket: [
    "普吉老镇与彩色骑楼",
    "查龙寺",
    "普吉大佛",
    "卡塔海滩",
    "神仙半岛观景台",
    "班赞海鲜市场",
  ],
  "普吉岛": [
    "普吉老镇与彩色骑楼",
    "查龙寺",
    "普吉大佛",
    "卡塔海滩",
    "神仙半岛观景台",
    "班赞海鲜市场",
  ],
  chiangmai: [
    "契迪龙寺",
    "帕辛寺",
    "素贴山双龙寺",
    "清迈古城塔佩门",
    "宁曼路咖啡街区",
    "清迈夜间动物园",
  ],
  "清迈": [
    "契迪龙寺",
    "帕辛寺",
    "素贴山双龙寺",
    "清迈古城塔佩门",
    "宁曼路咖啡街区",
    "清迈夜间动物园",
  ],
  pattaya: [
    "真理寺",
    "格兰岛",
    "芭提雅海滩路",
    "四方水上市场",
    "东芭乐园",
    "乔木提恩海滩",
  ],
  "芭提雅": [
    "真理寺",
    "格兰岛",
    "芭提雅海滩路",
    "四方水上市场",
    "东芭乐园",
    "乔木提恩海滩",
  ],
  "芭堤雅": [
    "真理寺",
    "格兰岛",
    "芭提雅海滩路",
    "四方水上市场",
    "东芭乐园",
    "乔木提恩海滩",
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
  lyon: [45.764, 4.8357],
  marseille: [43.2965, 5.3698],
  nice: [43.7102, 7.262],
  newyork: [40.7128, -74.006],
  nyc: [40.7128, -74.006],
  beijing: [39.9042, 116.4074],
  sanfrancisco: [37.7749, -122.4194],
  sf: [37.7749, -122.4194],
  pisa: [43.7228, 10.4017],
  rome: [41.9028, 12.4964],
  seoul: [37.5665, 126.978],
  bangkok: [13.7563, 100.5018],
  "曼谷": [13.7563, 100.5018],
  phuket: [7.8804, 98.3923],
  "普吉岛": [7.8804, 98.3923],
  chiangmai: [18.7883, 98.9853],
  "清迈": [18.7883, 98.9853],
  pattaya: [12.9236, 100.8825],
  "芭提雅": [12.9236, 100.8825],
  "芭堤雅": [12.9236, 100.8825],
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

function containsCjk(value: string): boolean {
  return /[\u3400-\u9fff]/.test(value);
}

function localizeKnownTravelText(value: string | null | undefined): string {
  const raw = value?.trim() ?? "";
  if (!raw) return "";
  if (containsCjk(raw)) return raw;

  const exact = LOCAL_TEXT_LABELS[normalizeLookupKey(raw)];
  if (exact) return exact;

  return Object.entries(LOCAL_TEXT_LABELS)
    .sort((first, second) => second[0].length - first[0].length)
    .reduce((text, [source, target]) => {
      const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return text.replace(new RegExp(`\\b${escaped}\\b`, "gi"), target);
    }, raw);
}

function getLocalizedPlaceLabel(value: string): string {
  return localizeKnownTravelText(getLocalCityLabel(value));
}

function getLocalizedHotelName(
  option: HotelOptionResult | null | undefined,
  fallbackCity: string
): string {
  const rawName = option?.name?.trim();
  const localized = localizeKnownTravelText(rawName);
  if (localized) return localized;
  return `${getLocalCityLabel(fallbackCity)}酒店`;
}

function getLocalizedHotelAddress(
  option: HotelOptionResult | null | undefined,
  fallbackCity: string
): string {
  const rawAddress = option?.address?.trim();
  const localized = localizeKnownTravelText(rawAddress);
  if (localized) return localized;
  return `${getLocalCityLabel(fallbackCity)}市中心区域`;
}

function getLocalizedAirlineName(option: FlightOptionResult | null | undefined): string {
  const rawName = option?.airline ?? option?.provider ?? "";
  const exact = LOCAL_AIRLINE_LABELS[normalizeLookupKey(rawName)];
  if (exact) return exact;
  return localizeKnownTravelText(rawName) || "已选航班";
}

function formatLocalizedRoute(from: string, to: string): string {
  return `${getLocalCityLabel(from)} → ${getLocalCityLabel(to)}`;
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

  const attractions = getTravelAttractionsForCity(city);
  if (attractions.length) {
    const total = attractions.reduce(
      (sum, item) => ({
        lat: sum.lat + item.lat,
        lng: sum.lng + item.lng,
      }),
      { lat: 0, lng: 0 }
    );
    return [
      Number((total.lat / attractions.length).toFixed(6)),
      Number((total.lng / attractions.length).toFixed(6)),
    ];
  }

  const seed = hashString(city);
  const lat = (seed % 110) - 45;
  const lng = ((seed * 7) % 260) - 130;
  return [lat, lng];
}

function offsetCoordinate(
  center: [number, number],
  seed: string,
  radius = 0.045
): [number, number] {
  const hash = hashString(seed);
  const angle = ((hash % 360) * Math.PI) / 180;
  const distance = radius * (0.55 + (hash % 45) / 100);
  const lat = center[0] + Math.sin(angle) * distance;
  const lngScale = Math.max(0.35, Math.cos((center[0] * Math.PI) / 180));
  const lng = center[1] + (Math.cos(angle) * distance) / lngScale;
  return [Number(lat.toFixed(6)), Number(lng.toFixed(6))];
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

function getDepartureDate(travelState: TravelState): string {
  return travelState.departure_date ?? new Date().toISOString().slice(0, 10);
}

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const datePart = value.includes("T") ? value.split("T")[0] : value;
  const parsed = new Date(`${datePart}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDayNumberForDate(value: string | null | undefined, travelState: TravelState) {
  const start = parseIsoDate(getDepartureDate(travelState));
  const target = parseIsoDate(value);
  if (!start || !target) return 1;
  const diff = target.getTime() - start.getTime();
  return Math.max(1, Math.round(diff / 86_400_000) + 1);
}

function getDayNumber(day: ItineraryDay): number {
  if (typeof day.day === "number" && Number.isFinite(day.day)) {
    return Math.max(1, day.day);
  }
  const match = String(day.day).match(/\d+/);
  return match ? Math.max(1, Number(match[0])) : 1;
}

function extractClockTime(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const match = value.match(/(?:T|\s)(\d{1,2}):(\d{2})/);
  if (match) return `${match[1].padStart(2, "0")}:${match[2]}`;
  const loose = value.match(/\b(\d{1,2}):(\d{2})\b/);
  if (loose) return `${loose[1].padStart(2, "0")}:${loose[2]}`;
  return fallback;
}

function timeToMinutes(value: string): number {
  const match = value.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

function makeTimelineSortKey(dayNumber: number, time: string): number {
  return dayNumber * 1440 + timeToMinutes(time);
}

type TimedItineryRow = ItineryTableRow & { sortKey: number };

function createTimedItineryRow(
  row: ItineryTableRow,
  dayNumber: number,
  time: string
): TimedItineryRow {
  return {
    ...row,
    time,
    sortKey: makeTimelineSortKey(dayNumber, time),
  };
}

function finalizeTimedRows(rows: TimedItineryRow[]): ItineryTableRow[] {
  return [...rows]
    .sort((first, second) => first.sortKey - second.sortKey)
    .map(({ sortKey: _sortKey, ...row }) => row);
}

function getFlightNumberFallback(route: string): string {
  return `VZ${String((hashString(route) % 900) + 100)}`;
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

function getAttractionCoordinateKey(city: string, attraction: string): string {
  return `${normalizeLookupKey(city)}:${normalizeLookupKey(attraction)}`;
}

function isFiniteCoordinate(
  coordinate: GoogleGeocodeCoordinate | undefined
): coordinate is GoogleGeocodeCoordinate {
  return Boolean(
    coordinate &&
      Number.isFinite(coordinate.lat) &&
      Number.isFinite(coordinate.lng)
  );
}

function buildAttractionGeocodeItems(
  city: string,
  attractionNames: string[]
): GoogleGeocodeRequestItem[] {
  const cityLabel = getLocalCityLabel(city);
  const seen = new Set<string>();

  return attractionNames
    .map((name) => name.trim())
    .filter((name) => {
      const key = getAttractionCoordinateKey(city, name);
      if (!name || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 14)
    .map((name) => ({
      key: getAttractionCoordinateKey(city, name),
      query: `${name}, ${cityLabel}`,
    }));
}

function getAttractionChoicesForCity(city: string): AttractionChoiceCard[] {
  const cityKey = normalizeLookupKey(city);
  const knowledgeChoices = getTravelAttractionsForCity(city).map((item) => ({
    name: item.name,
    location: item.location,
    imageSrc: item.imageSrc,
    lat: item.lat,
    lng: item.lng,
  }));
  const knownKeys = new Set(
    knowledgeChoices.map((item) => normalizeLookupKey(item.name))
  );
  const fallbackNames = SPECIFIC_ATTRACTIONS_BY_KEY[cityKey] ?? [];
  const fallbackChoices = fallbackNames
    .filter((name) => !knownKeys.has(normalizeLookupKey(name)))
    .map((name, index) => ({
      name,
      location: `${getLocalCityLabel(city)} · Google Maps 精准定位`,
      imageSrc: getCityImage(city, `attraction-choice-${name}-${index}`),
    }));

  return [...knowledgeChoices, ...fallbackChoices].slice(0, 10);
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
  const attractionImages = getTravelAttractionsForCity(segment.city).map(
    (item) => item.imageSrc
  );
  const images = [
    ...attractionImages,
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

function getFlightNumber(flight: SelectedFlightOption): string {
  const route = `${flight.from} → ${flight.to}`;
  return flight.option?.flight_number ?? getFlightNumberFallback(route);
}

function getFlightDisplayPrice(flight: SelectedFlightOption): string {
  const price = flight.option?.price;
  if (!price) return "API 默认";
  const currency = flight.option?.currency?.trim();
  if (!currency || price.includes(currency)) return price;
  const currencyLabel = currency.toUpperCase() === "AUD" ? "AU$" : currency;
  return `${currencyLabel}${price}`;
}

function getSegmentFlights(
  flights: SelectedFlightOption[],
  segment: CitySegment
): SelectedFlightOption[] {
  const cityKey = normalizeLookupKey(segment.city);
  return flights.filter((flight) => {
    if (flight.skip || !flight.option) return false;
    return (
      normalizeLookupKey(flight.from) === cityKey ||
      normalizeLookupKey(flight.to) === cityKey
    );
  });
}

function getSegmentFlightLegs(
  legs: FlightLegResult[],
  segment: CitySegment
): Array<{ leg: FlightLegResult; legIndex: number }> {
  const cityKey = normalizeLookupKey(segment.city);
  return legs
    .map((leg, index) => ({ leg, legIndex: index + 1 }))
    .filter(({ leg }) => {
      return (
        normalizeLookupKey(leg.from) === cityKey ||
        normalizeLookupKey(leg.to) === cityKey
      );
    });
}

function findHotelStayForCity(
  stays: HotelStayResult[],
  city: string
): { stay: HotelStayResult; stayIndex: number } | null {
  const cityKey = normalizeLookupKey(city);
  const stayIndex = stays.findIndex(
    (stay) => normalizeLookupKey(stay.city) === cityKey
  );
  if (stayIndex < 0) return null;
  return {
    stay: stays[stayIndex],
    stayIndex: stayIndex + 1,
  };
}

function getSelectedFlightForLeg(
  flights: SelectedFlightOption[],
  legIndex: number
): SelectedFlightOption | null {
  return (
    flights.find((flight) => flight.leg_index === legIndex && !flight.skip) ?? null
  );
}

function getSelectedHotelForStay(
  hotels: SelectedHotelOption[],
  stayIndex: number
): SelectedHotelOption | null {
  return hotels.find((hotel) => hotel.stay_index === stayIndex) ?? null;
}

function createSelectedFlightFromOption(
  leg: FlightLegResult,
  legIndex: number,
  option: FlightOptionResult,
  optionIndex: number
): SelectedFlightOption {
  return {
    leg_index: legIndex,
    from: leg.from,
    to: leg.to,
    departure_date: leg.departure_date,
    skip: false,
    option_index: optionIndex,
    option,
  };
}

function createSelectedHotelFromOption(
  stay: HotelStayResult,
  stayIndex: number,
  option: HotelOptionResult,
  optionIndex: number
): SelectedHotelOption {
  return {
    stay_index: stayIndex,
    city: stay.city,
    check_in: stay.check_in,
    check_out: stay.check_out,
    nights: stay.nights,
    option_index: optionIndex,
    option,
  };
}

function getFlightOptionDisplayPrice(option: FlightOptionResult): string {
  const price = option.price;
  if (!price) return "API 推荐";
  const currency = option.currency?.trim();
  if (!currency || price.includes(currency)) return price;
  const currencyLabel = currency.toUpperCase() === "AUD" ? "AU$" : currency;
  return `${currencyLabel}${price}`;
}

function getHotelOptionDisplayPrice(option: HotelOptionResult): string {
  const rawPrice =
    option.total_price ?? option.average_price_per_night ?? option.price_per_night;
  if (!rawPrice) return "API 推荐";
  const currency = option.currency?.trim();
  if (!currency || rawPrice.includes(currency)) return rawPrice;
  const currencyLabel = currency.toUpperCase() === "AUD" ? "AU$" : currency;
  return `${currencyLabel}${rawPrice}`;
}

function getHotelContactLabel(option: HotelOptionResult): string {
  return (
    option.contact_phone ??
    option.contact_email ??
    option.website ??
    "联系电话请通过预订平台确认"
  );
}

function getFlightOptionKey(
  legIndex: number,
  option: FlightOptionResult,
  optionIndex: number
): string {
  return [
    legIndex,
    optionIndex,
    option.flight_number,
    option.airline,
    option.departure,
    option.arrival,
  ]
    .filter(Boolean)
    .join(":");
}

function getHotelOptionKey(
  stayIndex: number,
  option: HotelOptionResult,
  optionIndex: number
): string {
  return [
    stayIndex,
    optionIndex,
    option.hotel_id,
    option.name,
    option.address,
  ]
    .filter(Boolean)
    .join(":");
}

function getFlightDirectionLabel(
  flight: SelectedFlightOption,
  segment: CitySegment
): string {
  const cityKey = normalizeLookupKey(segment.city);
  if (normalizeLookupKey(flight.to) === cityKey) return "抵达航班";
  if (normalizeLookupKey(flight.from) === cityKey) return "离开航班";
  return "相关航班";
}

type DayTimelineItem = {
  time: string;
  label: string;
  value: string;
};

const MORNING_SLOT_TIME = "09:00";
const AFTERNOON_SLOT_TIME = "14:30";
const HOTEL_SLOT_TIME = "21:00";

function getFlightsForDay(
  flights: SelectedFlightOption[],
  travelState: TravelState,
  dayNumber: number
): SelectedFlightOption[] {
  return flights
    .filter((flight) => !flight.skip && flight.option)
    .filter(
      (flight) =>
        getDayNumberForDate(flight.departure_date, travelState) === dayNumber
    )
    .sort((first, second) => {
      const firstTime = extractClockTime(first.option?.departure, MORNING_SLOT_TIME);
      const secondTime = extractClockTime(second.option?.departure, MORNING_SLOT_TIME);
      return timeToMinutes(firstTime) - timeToMinutes(secondTime);
    });
}

function formatFlightTimelineValue(flight: SelectedFlightOption): string {
  const airline = flight.option?.airline ?? flight.option?.provider ?? "航班";
  const route = `${getLocalCityLabel(flight.from)} → ${getLocalCityLabel(flight.to)}`;
  const flightNumber = getFlightNumber(flight);
  const departureTime = extractClockTime(flight.option?.departure, "待确认");
  return `${route} · ${airline} ${flightNumber} · ${departureTime}`;
}

function buildDayTimelineItems(
  day: ItineraryDay,
  dayIndex: number,
  travelState: TravelState,
  flights: SelectedFlightOption[],
  hotels: SelectedHotelOption[]
): DayTimelineItem[] {
  const morningActivity = isVagueActivityName(day.activities[0] ?? "")
    ? getSpecificAttraction(day.city, dayIndex, 0)
    : day.activities[0] ?? getSpecificAttraction(day.city, dayIndex, 0);
  const afternoonActivity = isVagueActivityName(day.activities[1] ?? "")
    ? getSpecificAttraction(day.city, dayIndex, 1)
    : day.activities[1] ?? getSpecificAttraction(day.city, dayIndex, 1);
  const dayNumber = getDayNumber(day);
  const dayFlights = getFlightsForDay(flights, travelState, dayNumber).slice(0, 2);
  const hotel = findHotelForCity(hotels, day.city);
  const hotelLabel = hotel?.option.name ?? "待选择酒店";
  const hotelItem: DayTimelineItem = {
    time: HOTEL_SLOT_TIME,
    label: "住宿",
    value: hotelLabel,
  };

  let morningItem: DayTimelineItem = {
    time: MORNING_SLOT_TIME,
    label: "上午",
    value: morningActivity,
  };
  let afternoonItem: DayTimelineItem = {
    time: AFTERNOON_SLOT_TIME,
    label: "下午",
    value: afternoonActivity,
  };

  if (dayFlights.length === 1) {
    const flight = dayFlights[0];
    const departureTime = extractClockTime(flight.option?.departure, MORNING_SLOT_TIME);
    const isMorning = timeToMinutes(departureTime) < 13 * 60;
    const flightItem: DayTimelineItem = {
      time: isMorning ? MORNING_SLOT_TIME : AFTERNOON_SLOT_TIME,
      label: "航班",
      value: formatFlightTimelineValue(flight),
    };
    if (isMorning) {
      morningItem = flightItem;
    } else {
      afternoonItem = flightItem;
    }
  } else if (dayFlights.length >= 2) {
    morningItem = {
      time: MORNING_SLOT_TIME,
      label: "航班",
      value: formatFlightTimelineValue(dayFlights[0]),
    };
    afternoonItem = {
      time: AFTERNOON_SLOT_TIME,
      label: "航班",
      value: formatFlightTimelineValue(dayFlights[1]),
    };
  }

  return [
    {
      time: morningItem.time,
      label: morningItem.label,
      value: morningItem.value,
    },
    {
      time: "12:30",
      label: "午餐",
      value: day.food[0] ?? `${getLocalCityLabel(day.city)}本地餐厅`,
    },
    {
      time: afternoonItem.time,
      label: afternoonItem.label,
      value: afternoonItem.value,
    },
    {
      time: "18:30",
      label: "晚餐",
      value: day.food[1] ?? day.food[0] ?? `${getLocalCityLabel(day.city)}晚餐`,
    },
    hotelItem,
  ];
}

function isVagueActivityName(value: string): boolean {
  return !value.trim() || VAGUE_ACTIVITY_RE.test(value);
}

function getSpecificAttraction(city: string, dayIndex: number, activityIndex: number): string {
  const knowledgeAttractions = getTravelAttractionNamesForCity(city);
  if (knowledgeAttractions.length) {
    return knowledgeAttractions[
      (dayIndex * 2 + activityIndex) % knowledgeAttractions.length
    ];
  }

  const key = normalizeLookupKey(city);
  const attractions = SPECIFIC_ATTRACTIONS_BY_KEY[key];
  if (!attractions?.length) {
    return `${getLocalCityLabel(city)} 市中心历史街区`;
  }

  return attractions[(dayIndex * 2 + activityIndex) % attractions.length];
}

function renumberItineraryDays(days: ItineraryDay[]): ItineraryDay[] {
  return days.map((day, index) => ({
    ...day,
    day: index + 1,
  }));
}

function shouldSuppressFlights(modulePatch?: Record<string, unknown>): boolean {
  return (
    modulePatch?.remove_flights === true ||
    modulePatch?.flight_policy === "skip_all"
  );
}

function shouldPreferFourStarHotel(modulePatch?: Record<string, unknown>): boolean {
  return (
    typeof modulePatch?.hotel_note === "string" &&
    /4星|四星|four.?star|4.?star/i.test(modulePatch.hotel_note)
  );
}

function buildAttractionMapPoints(
  days: ItineraryDay[],
  city: string,
  seedPrefix: string,
  googleCoordinates: Record<string, GoogleGeocodeCoordinate> = {}
): TripMapPoint[] {
  const cityKey = normalizeLookupKey(city);
  const cityLabel = getLocalCityLabel(city);
  const center = getCityCoordinates(city);
  const seen = new Set<string>();
  const activities = days
    .filter((day) => normalizeLookupKey(day.city) === cityKey)
    .flatMap((day) => day.activities)
    .map((activity) => activity.trim())
    .filter((activity) => {
      const key = normalizeLookupKey(activity);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const pointNames =
    activities.length >= 2
      ? activities
      : [
          getSpecificAttraction(city, 0, 0),
          getSpecificAttraction(city, 0, 1),
          getSpecificAttraction(city, 1, 0),
        ];

  return pointNames.slice(0, 8).map((activity, index) => {
    const attraction = findTravelAttraction(city, activity);
    const googleCoordinate = googleCoordinates[getAttractionCoordinateKey(city, activity)];
    const [lat, lng] = isFiniteCoordinate(googleCoordinate)
      ? [googleCoordinate.lat, googleCoordinate.lng]
      : attraction
      ? [attraction.lat, attraction.lng]
      : offsetCoordinate(center, `${seedPrefix}-${city}-${activity}`, 0.05);
    const locationText =
      googleCoordinate?.formattedAddress ?? attraction?.location ?? cityLabel;
    return {
      id: `${seedPrefix}-${cityKey}-${index}`,
      kind: "hotspot",
      label: activity,
      subtitle: `${cityLabel}第 ${index + 1} 站`,
      localName: cityLabel,
      intro: `${activity} 位于 ${locationText}，地图路线会按当天顺序串联这些景点。`,
      imageSrc: attraction?.imageSrc ?? getCityImage(city, `${seedPrefix}-${index}`),
      lat,
      lng,
      city,
    };
  });
}

function buildAttractionRows(itinerary: ItineraryDay[]): TimedItineryRow[] {
  return itinerary.flatMap((day, dayIndex) => {
    const dayNumber = getDayNumber(day);
    const activities =
      day.activities.length > 0
        ? day.activities
        : [
            getSpecificAttraction(day.city, dayIndex, 0),
            getSpecificAttraction(day.city, dayIndex, 1),
          ];

    const morningActivity = isVagueActivityName(activities[0] ?? "")
      ? getSpecificAttraction(day.city, dayIndex, 0)
      : activities[0];
    const afternoonActivity = isVagueActivityName(activities[1] ?? "")
      ? getSpecificAttraction(day.city, dayIndex, 1)
      : activities[1] ?? getSpecificAttraction(day.city, dayIndex, 1);
    const cityLabel = getLocalCityLabel(day.city);
    const rows: TimedItineryRow[] = [
      createTimedItineryRow(
        {
          time: "09:00 上午",
          type: "景点",
          date: formatDayTab(day),
          route: cityLabel,
          name: morningActivity,
          details: `上午：抵达并游览 ${morningActivity}，建议停留 2-3 小时。`,
          contact: "-",
        },
        dayNumber,
        "09:00"
      ),
    ];

    if (day.food[0]) {
      rows.push(
        createTimedItineryRow(
          {
            time: "12:30 午餐",
            type: "餐饮",
            date: formatDayTab(day),
            route: cityLabel,
            name: day.food[0],
            details: `午餐：${day.food[0]}。`,
            contact: "-",
          },
          dayNumber,
          "12:30"
        )
      );
    }

    rows.push(
      createTimedItineryRow(
        {
          time: "14:30 下午",
          type: "景点",
          date: formatDayTab(day),
          route: cityLabel,
          name: afternoonActivity,
          details: `下午：继续游览 ${afternoonActivity}，可安排拍照、步行和周边街区体验。`,
          contact: "-",
        },
        dayNumber,
        "14:30"
      )
    );

    if (day.food[1]) {
      rows.push(
        createTimedItineryRow(
          {
            time: "18:30 晚餐",
            type: "餐饮",
            date: formatDayTab(day),
            route: cityLabel,
            name: day.food[1],
            details: `晚餐：${day.food[1]}。`,
            contact: "-",
          },
          dayNumber,
          "18:30"
        )
      );
    }

    return rows;
  });
}

function buildSelectedHotelRows(
  hotels: SelectedHotelOption[],
  travelState: TravelState,
  modulePatch?: Record<string, unknown>
): TimedItineryRow[] {
  const preferFourStar = shouldPreferFourStarHotel(modulePatch);
  return hotels.map((hotel) => {
    const cityLabel = getLocalCityLabel(hotel.city);
    const checkInTime = extractClockTime(hotel.option.check_in_time, "15:00");
    const checkOutTime = hotel.option.check_out_time ?? "11:00";
    const address = hotel.option.address ?? `${cityLabel}市中心区域`;
    const contact = getHotelContactLabel(hotel.option);

    return createTimedItineryRow(
      {
        time: `${checkInTime} 入住`,
        type: "酒店",
        date: `${formatMonthDay(hotel.check_in)} - ${formatMonthDay(hotel.check_out)}`,
        route: cityLabel,
        name: hotel.option.name ?? `${cityLabel}酒店`,
        details: `${hotel.nights}晚；地址：${address}；价格：${getHotelDisplayPrice(
          hotel
        )}；${preferFourStar ? "偏好：4星级酒店；" : ""}入住 ${checkInTime}，退房 ${checkOutTime}。`,
        contact,
      },
      getDayNumberForDate(hotel.check_in, travelState),
      checkInTime
    );
  });
}

function buildSelectedFlightRows(
  flights: SelectedFlightOption[],
  travelState: TravelState
): TimedItineryRow[] {
  return flights
    .filter((flight) => !flight.skip)
    .map((flight) => {
      const option = flight.option;
      const airline = option?.airline ?? option?.provider ?? "已选航班";
      const route = `${flight.from} → ${flight.to}`;
      const departureTime = extractClockTime(option?.departure, "08:00");
      const arrivalTime = extractClockTime(option?.arrival, "");
      const airports = [option?.from_id ?? option?.from, option?.to_id ?? option?.to]
        .filter(Boolean)
        .join(" → ");
      const stops =
        option?.stops === 0
          ? "直飞"
          : typeof option?.stops === "number"
            ? `${option.stops}次中转`
            : "-";

      const flightNumber = option?.flight_number ?? getFlightNumberFallback(route);
      const detailItems = [
        option?.departure ? `出发：${option.departure}` : `出发：${departureTime}`,
        option?.arrival ? `到达：${option.arrival}` : arrivalTime ? `到达：${arrivalTime}` : "",
        airports ? `机场：${airports}` : "",
        option?.duration ? `时长：${option.duration}` : "",
        `经停：${stops}`,
        option?.cabin_class ? `舱位：${option.cabin_class}` : "",
        option?.price ? `价格：${option.price} ${option.currency ?? ""}`.trim() : "",
      ].filter(Boolean);

      return createTimedItineryRow(
        {
          time: `${departureTime} 出发`,
          type: "航班",
          date: formatMonthDay(flight.departure_date),
          route,
          name: `${airline} ${flightNumber}`,
          details: detailItems.join("；") || "-",
          contact: flightNumber,
        },
        getDayNumberForDate(flight.departure_date, travelState),
        departureTime
      );
    });
}

function buildItineryTableRows(
  itinerary: ItineraryDay[],
  travelState: TravelState,
  modulePatch?: Record<string, unknown>
): ItineryTableRow[] {
  const attractionRows = buildAttractionRows(itinerary);
  const hotelRows = travelState.selected_hotels.length
    ? buildSelectedHotelRows(travelState.selected_hotels, travelState, modulePatch)
    : [];
  const selectedFlightRows = buildSelectedFlightRows(
    travelState.selected_flights,
    travelState
  );
  const flightRows = shouldSuppressFlights(modulePatch)
    ? []
    : selectedFlightRows;

  return finalizeTimedRows([...flightRows, ...hotelRows, ...attractionRows]);
}

function buildTravelExportPayload(
  itinerary: ItineraryDay[],
  travelState: TravelState,
  orderedCities: string[],
  itineryRows: ItineryTableRow[],
  exportLanguage: TravelExportLanguage
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
    export_language: exportLanguage,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function numberField(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function coerceFlightOption(value: unknown): FlightOptionResult {
  const record = asRecord(value);
  if (!record) return {};

  const stops = numberField(record, "stops");
  return {
    provider: stringField(record, "provider"),
    airline: stringField(record, "airline"),
    price: stringField(record, "price"),
    currency: stringField(record, "currency"),
    departure: stringField(record, "departure"),
    arrival: stringField(record, "arrival"),
    from: stringField(record, "from"),
    to: stringField(record, "to"),
    from_id: stringField(record, "from_id"),
    to_id: stringField(record, "to_id"),
    offer_token: stringField(record, "offer_token"),
    departure_airport: stringField(record, "departure_airport"),
    arrival_airport: stringField(record, "arrival_airport"),
    duration: stringField(record, "duration"),
    stops,
    cabin_class: stringField(record, "cabin_class"),
    booking_url: stringField(record, "booking_url"),
    flight_number: stringField(record, "flight_number"),
    aircraft: stringField(record, "aircraft"),
  };
}

function coerceHotelOption(value: unknown): HotelOptionResult {
  const record = asRecord(value);
  if (!record) return {};

  const adults = numberField(record, "adults");
  const ratingValue = record.rating;
  const rating =
    typeof ratingValue === "number" || typeof ratingValue === "string"
      ? ratingValue
      : undefined;
  const latitudeValue = record.latitude;
  const longitudeValue = record.longitude;

  return {
    provider: stringField(record, "provider"),
    city: stringField(record, "city"),
    name: stringField(record, "name"),
    hotel_id: stringField(record, "hotel_id") ?? numberField(record, "hotel_id"),
    price_per_night: stringField(record, "price_per_night"),
    taxes_and_fees: stringField(record, "taxes_and_fees"),
    currency: stringField(record, "currency"),
    check_in: stringField(record, "check_in"),
    check_out: stringField(record, "check_out"),
    adults,
    rating,
    average_price_per_night: stringField(record, "average_price_per_night"),
    total_price: stringField(record, "total_price"),
    address: stringField(record, "address"),
    latitude:
      typeof latitudeValue === "number" || typeof latitudeValue === "string"
        ? latitudeValue
        : undefined,
    longitude:
      typeof longitudeValue === "number" || typeof longitudeValue === "string"
        ? longitudeValue
        : undefined,
    contact_phone: stringField(record, "contact_phone"),
    contact_email: stringField(record, "contact_email"),
    website: stringField(record, "website"),
    review_text: stringField(record, "review_text"),
    check_in_time: stringField(record, "check_in_time"),
    check_out_time: stringField(record, "check_out_time"),
    distance_to_center: stringField(record, "distance_to_center"),
  };
}

function coerceApiFlightLegs(payload: unknown): FlightLegResult[] {
  const record = asRecord(payload);
  const rawLegs = Array.isArray(record?.legs) ? record.legs : [];

  return rawLegs
    .map((rawLeg) => {
      const leg = asRecord(rawLeg);
      if (!leg) return null;
      const from = stringField(leg, "from");
      const to = stringField(leg, "to");
      const departureDate = stringField(leg, "departure_date");
      if (!from || !to || !departureDate) return null;

      const options = Array.isArray(leg.options)
        ? leg.options.map(coerceFlightOption)
        : [];
      return {
        from,
        to,
        departure_date: departureDate,
        options,
      };
    })
    .filter((leg): leg is FlightLegResult => leg !== null);
}

function coerceApiHotelStays(payload: unknown): HotelStayResult[] {
  const record = asRecord(payload);
  const rawStays = Array.isArray(record?.stays) ? record.stays : [];

  return rawStays
    .map((rawStay): HotelStayResult | null => {
      const stay = asRecord(rawStay);
      if (!stay) return null;
      const city = stringField(stay, "city");
      const checkIn = stringField(stay, "check_in");
      const checkOut = stringField(stay, "check_out");
      const nights = numberField(stay, "nights") ?? 1;
      if (!city || !checkIn || !checkOut) return null;

      const adults = numberField(stay, "adults");
      const options = Array.isArray(stay.options)
        ? stay.options.map(coerceHotelOption)
        : [];
      return {
        city,
        check_in: checkIn,
        check_out: checkOut,
        nights,
        ...(adults === undefined ? {} : { adults }),
        options,
      };
    })
    .filter((stay): stay is HotelStayResult => stay !== null);
}

function selectApiDefaultFlights(legs: FlightLegResult[]): SelectedFlightOption[] {
  return legs
    .map((leg, index): SelectedFlightOption | null => {
      const option = leg.options[0];
      if (!option) return null;
      return {
        leg_index: index + 1,
        from: leg.from,
        to: leg.to,
        departure_date: leg.departure_date,
        skip: false,
        option_index: 1,
        option,
      };
    })
    .filter((flight): flight is SelectedFlightOption => flight !== null);
}

function selectApiDefaultHotels(stays: HotelStayResult[]): SelectedHotelOption[] {
  return stays
    .map((stay, index): SelectedHotelOption | null => {
      const option = stay.options[0];
      if (!option) return null;
      return {
        stay_index: index + 1,
        city: stay.city,
        check_in: stay.check_in,
        check_out: stay.check_out,
        nights: stay.nights,
        option_index: 1,
        option,
      };
    })
    .filter((hotel): hotel is SelectedHotelOption => hotel !== null);
}

function hasSelectedFlightOption(flights: SelectedFlightOption[]): boolean {
  return flights.some((flight) => !flight.skip && Boolean(flight.option));
}

function hasSelectedHotelOption(hotels: SelectedHotelOption[]): boolean {
  return hotels.some((hotel) => {
    const provider = hotel.option.provider ?? "";
    const name = hotel.option.name ?? "";
    return provider !== "self-arranged" && name !== "自行安排";
  });
}

function buildApiOptionsPayload(
  travelState: TravelState,
  orderedCities: string[]
): Omit<TravelExportPayload, "itinerary" | "itinery_rows" | "export_language"> {
  const cities =
    travelState.cities.length > 0
      ? travelState.cities
      : orderedCities.length > 0
        ? orderedCities
        : travelState.travel_order;
  const travelOrder =
    travelState.travel_order.length > 0 ? travelState.travel_order : cities;

  return {
    country: travelState.country ?? travelState.countries[0] ?? "",
    countries: travelState.countries,
    cities,
    city_days: travelState.city_days,
    departure_date: travelState.departure_date ?? undefined,
    date_flexibility: travelState.date_flexibility ?? undefined,
    travel_days: travelState.travel_days ?? Math.max(1, cities.length),
    travelers: travelState.travelers ?? 1,
    budget: travelState.budget ?? 1,
    travel_order: travelOrder,
    origin_country: travelState.origin_country ?? undefined,
    origin_city: travelState.origin_city ?? undefined,
    return_country: travelState.return_country ?? undefined,
    return_city: travelState.return_city ?? undefined,
    selected_flights: [],
    selected_hotels: [],
    final_note: travelState.final_note ?? "",
    attached_files: travelState.attached_files,
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
  modulePatch,
  onPointSelect,
}: TravelItineraryExperienceProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [fullMapOpen, setFullMapOpen] = useState(false);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [activeCityKey, setActiveCityKey] = useState("");
  const [highlightCityKey, setHighlightCityKey] = useState("");
  const [fullMapActiveCity, setFullMapActiveCity] = useState("");
  const [isRoutePlaying, setIsRoutePlaying] = useState(true);
  const [editableItinerary, setEditableItinerary] =
    useState<ItineraryDay[]>(itinerary);
  const [editableItineryRows, setEditableItineryRows] = useState<ItineryTableRow[]>([]);
  const [isDownloadingWord, setIsDownloadingWord] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isSharingLink, setIsSharingLink] = useState(false);
  const [exportLanguage, setExportLanguage] = useState<TravelExportLanguage>("zh");
  const [detailResourceTab, setDetailResourceTab] =
    useState<DetailResourceTab>("attractions");
  const [customizeDayEditor, setCustomizeDayEditor] = useState(false);
  const [apiFlightLegs, setApiFlightLegs] = useState<FlightLegResult[]>([]);
  const [apiHotelStays, setApiHotelStays] = useState<HotelStayResult[]>([]);
  const [apiDefaultFlights, setApiDefaultFlights] = useState<
    SelectedFlightOption[]
  >([]);
  const [apiDefaultHotels, setApiDefaultHotels] = useState<
    SelectedHotelOption[]
  >([]);
  const [localSelectedFlights, setLocalSelectedFlights] = useState<
    SelectedFlightOption[] | null
  >(null);
  const [localSelectedHotels, setLocalSelectedHotels] = useState<
    SelectedHotelOption[] | null
  >(null);
  const [googleAttractionCoordinates, setGoogleAttractionCoordinates] = useState<
    Record<string, GoogleGeocodeCoordinate>
  >({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const citySectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failedAttractionGeocodeKeysRef = useRef<Set<string>>(new Set());

  const apiOptionsPayload = useMemo(
    () => buildApiOptionsPayload(travelState, orderedCities),
    [orderedCities, travelState]
  );
  const apiOptionsPayloadKey = useMemo(
    () => JSON.stringify(apiOptionsPayload),
    [apiOptionsPayload]
  );
  const baseSelectedFlights = localSelectedFlights ?? travelState.selected_flights;
  const baseSelectedHotels = localSelectedHotels ?? travelState.selected_hotels;
  const shouldLoadApiFlightOptions =
    !shouldSuppressFlights(modulePatch) && apiOptionsPayload.cities.length > 0;
  const shouldLoadApiHotelOptions = apiOptionsPayload.cities.length > 0;
  const shouldUseApiFlightDefaults = !hasSelectedFlightOption(baseSelectedFlights);
  const shouldUseApiHotelDefaults = !hasSelectedHotelOption(baseSelectedHotels);

  const effectiveSelectedFlights = useMemo(
    () =>
      hasSelectedFlightOption(baseSelectedFlights)
        ? baseSelectedFlights
        : apiDefaultFlights,
    [apiDefaultFlights, baseSelectedFlights]
  );
  const effectiveSelectedHotels = useMemo(
    () =>
      hasSelectedHotelOption(baseSelectedHotels)
        ? baseSelectedHotels
        : apiDefaultHotels,
    [apiDefaultHotels, baseSelectedHotels]
  );
  const effectiveTravelState = useMemo(
    () => ({
      ...travelState,
      selected_flights: effectiveSelectedFlights,
      selected_hotels: effectiveSelectedHotels,
    }),
    [effectiveSelectedFlights, effectiveSelectedHotels, travelState]
  );

  const segments = useMemo(
    () => buildCitySegments(editableItinerary, orderedCities, effectiveTravelState),
    [editableItinerary, effectiveTravelState, orderedCities]
  );
  const routeNodes = useMemo(
    () => createRouteNodes(effectiveTravelState, segments),
    [effectiveTravelState, segments]
  );
  const title = useMemo(
    () =>
      createTripTitle(
        editableItinerary.length,
        segments.map((segment) => segment.city)
      ),
    [editableItinerary.length, segments]
  );
  const activeDay = editableItinerary[activeDayIndex] ?? editableItinerary[0];
  const activeDayTimeline = useMemo(
    () =>
      activeDay
        ? buildDayTimelineItems(
            activeDay,
            activeDayIndex,
            effectiveTravelState,
            effectiveSelectedFlights,
            effectiveSelectedHotels
          )
        : [],
    [
      activeDay,
      activeDayIndex,
      effectiveSelectedFlights,
      effectiveSelectedHotels,
      effectiveTravelState,
    ]
  );
  const activeDayAttractionChoices = useMemo(
    () => (activeDay ? getAttractionChoicesForCity(activeDay.city) : []),
    [activeDay]
  );
  const heroImage = segments[0]?.imageSrc ?? getDayImage(editableItinerary[0], 0);
  const totalExperiences = editableItinerary.reduce(
    (sum, day) => sum + day.activities.length,
    0
  );
  const hotelDisplayCount = Math.max(
    effectiveTravelState.selected_hotels.length,
    segments.length
  );
  const preferFourStarHotel = shouldPreferFourStarHotel(modulePatch);
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
        ? buildFallbackRouteCoordinates(effectiveTravelState, segments)
        : routeCoordinates,
    [effectiveTravelState, routeCoordinates, segments]
  );
  const essentialMapPoints = useMemo(
    () => filterEssentialMapPoints(resolvedMapPoints),
    [resolvedMapPoints]
  );
  const activeSegment = useMemo(
    () =>
      segments.find(
        (segment) => getCitySectionKey(segment.city) === activeCityKey
      ) ?? segments[0],
    [activeCityKey, segments]
  );
  const activeDaySegment = useMemo(() => {
    if (!activeDay) return activeSegment;
    const activeDayNumber = getDayNumber(activeDay);
    return (
      segments.find(
        (segment) =>
          activeDayNumber >= segment.dayStart &&
          activeDayNumber <= segment.dayEnd
      ) ??
      segments.find(
        (segment) =>
          normalizeLookupKey(segment.city) === normalizeLookupKey(activeDay.city)
      ) ??
      activeSegment
    );
  }, [activeDay, activeSegment, segments]);
  const activeCityDays = useMemo(
    () =>
      activeSegment
        ? getSegmentDays(editableItinerary, activeSegment)
        : [],
    [activeSegment, editableItinerary]
  );
  const activeCityAttractionPoints = useMemo(
    () =>
      activeSegment
        ? buildAttractionMapPoints(
            activeCityDays,
            activeSegment.city,
            "itinerary-attraction",
            googleAttractionCoordinates
          )
        : [],
    [activeCityDays, activeSegment, googleAttractionCoordinates]
  );
  const activeCityHotelPoints = useMemo(
    () =>
      activeSegment
        ? resolvedMapPoints.filter(
            (point) =>
              point.kind === "hotel" &&
              normalizeLookupKey(point.city ?? point.label) ===
                normalizeLookupKey(activeSegment.city)
          )
        : [],
    [activeSegment, resolvedMapPoints]
  );
  const cityFocusedMapPoints = useMemo(
    () =>
      activeCityAttractionPoints.length
        ? [...activeCityAttractionPoints, ...activeCityHotelPoints]
        : essentialMapPoints,
    [activeCityAttractionPoints, activeCityHotelPoints, essentialMapPoints]
  );
  const cityFocusedRouteCoordinates = useMemo<Array<[number, number]>>(
    () =>
      activeCityAttractionPoints.length >= 2
        ? activeCityAttractionPoints.map((point) => [point.lat, point.lng])
        : resolvedRouteCoordinates,
    [activeCityAttractionPoints, resolvedRouteCoordinates]
  );
  const activeDayMapPoints = useMemo(
    () =>
      activeDay
        ? buildAttractionMapPoints(
            [activeDay],
            activeDay.city,
            "detail-attraction",
            googleAttractionCoordinates
          )
        : [],
    [activeDay, googleAttractionCoordinates]
  );
  const activeDayFlightLegs = useMemo(
    () =>
      activeDaySegment ? getSegmentFlightLegs(apiFlightLegs, activeDaySegment) : [],
    [activeDaySegment, apiFlightLegs]
  );
  const activeDayHotelStay = useMemo(
    () =>
      activeDaySegment
        ? findHotelStayForCity(apiHotelStays, activeDaySegment.city)
        : null,
    [activeDaySegment, apiHotelStays]
  );
  const activeDayHotel = useMemo(
    () =>
      activeDaySegment
        ? findHotelForCity(effectiveSelectedHotels, activeDaySegment.city)
        : null,
    [activeDaySegment, effectiveSelectedHotels]
  );
  const attractionGeocodeItems = useMemo(() => {
    const city = activeDay?.city ?? activeSegment?.city ?? "";
    if (!city) return [];
    const activeNames = activeDay
      ? [...activeDay.activities, ...activeDayAttractionChoices.map((item) => item.name)]
      : activeCityDays.flatMap((day) => day.activities);
    return buildAttractionGeocodeItems(city, activeNames);
  }, [activeDay, activeDayAttractionChoices, activeCityDays, activeSegment]);
  const detailMapPoints = activeDayMapPoints.length
    ? activeDayMapPoints
    : cityFocusedMapPoints;
  const detailRouteCoordinates =
    activeDayMapPoints.length >= 2
      ? activeDayMapPoints.map((point) => [point.lat, point.lng] as [number, number])
      : cityFocusedRouteCoordinates;
  const focusedPointId = activeDay
    ? activeDayMapPoints[0]?.id ??
      activeCityAttractionPoints[0]?.id ??
      getPointIdForCity(resolvedMapPoints, activeDay.city) ??
      activePointId ??
      null
    : activePointId ?? null;
  const fullMapActivePointId = fullMapActiveCity
    ? getPointIdForCity(resolvedMapPoints, fullMapActiveCity)
    : null;
  const defaultItineryRows = useMemo(
    () =>
      buildItineryTableRows(
        editableItinerary,
        effectiveTravelState,
        modulePatch
      ),
    [editableItinerary, effectiveTravelState, modulePatch]
  );
  const exportPayload = useMemo(
    () =>
      buildTravelExportPayload(
        editableItinerary,
        effectiveTravelState,
        orderedCities,
        editableItineryRows,
        exportLanguage
      ),
    [
      editableItinerary,
      editableItineryRows,
      exportLanguage,
      orderedCities,
      effectiveTravelState,
    ]
  );
  const sharePayload = useMemo(
    () =>
      buildTravelItinerarySharePayload(
        title,
        editableItinerary,
        effectiveTravelState,
        editableItineryRows
      ),
    [editableItinerary, editableItineryRows, effectiveTravelState, title]
  );
  const exportFilenameSuffix =
    exportLanguage === "zh" ? "" : `-${exportLanguage}`;

  useEffect(() => {
    setEditableItinerary(itinerary);
    setActiveDayIndex(0);
    setLocalSelectedFlights(null);
    setLocalSelectedHotels(null);
    setDetailResourceTab("attractions");
    setCustomizeDayEditor(false);
  }, [itinerary]);

  useEffect(() => {
    if (!shouldLoadApiFlightOptions) {
      setApiFlightLegs([]);
      setApiDefaultFlights([]);
      return;
    }

    let disposed = false;
    fetch("/api/travel/flights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: apiOptionsPayloadKey,
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({ legs: [] }))) as unknown;
        return response.ok ? payload : { legs: [] };
      })
      .then((payload) => {
        if (disposed) return;
        const legs = coerceApiFlightLegs(payload);
        setApiFlightLegs(legs);
        setApiDefaultFlights(
          shouldUseApiFlightDefaults ? selectApiDefaultFlights(legs) : []
        );
      })
      .catch(() => {
        if (disposed) return;
        setApiFlightLegs([]);
        setApiDefaultFlights([]);
      });

    return () => {
      disposed = true;
    };
  }, [
    apiOptionsPayloadKey,
    shouldLoadApiFlightOptions,
    shouldUseApiFlightDefaults,
  ]);

  useEffect(() => {
    if (!shouldLoadApiHotelOptions) {
      setApiHotelStays([]);
      setApiDefaultHotels([]);
      return;
    }

    let disposed = false;
    fetch("/api/travel/hotels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: apiOptionsPayloadKey,
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({ stays: [] }))) as unknown;
        return response.ok ? payload : { stays: [] };
      })
      .then((payload) => {
        if (disposed) return;
        const stays = coerceApiHotelStays(payload);
        setApiHotelStays(stays);
        setApiDefaultHotels(
          shouldUseApiHotelDefaults ? selectApiDefaultHotels(stays) : []
        );
      })
      .catch(() => {
        if (disposed) return;
        setApiHotelStays([]);
        setApiDefaultHotels([]);
      });

    return () => {
      disposed = true;
    };
  }, [
    apiOptionsPayloadKey,
    shouldLoadApiHotelOptions,
    shouldUseApiHotelDefaults,
  ]);

  useEffect(() => {
    const pendingItems = attractionGeocodeItems.filter((item) => {
      if (googleAttractionCoordinates[item.key]) return false;
      return !failedAttractionGeocodeKeysRef.current.has(item.key);
    });

    if (pendingItems.length === 0) return;

    let disposed = false;

    void (async () => {
      try {
        const response = await fetch("/api/travel/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: pendingItems }),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          results?: GoogleGeocodeResult[];
          error?: string;
        };

        if (!response.ok) {
          pendingItems.forEach((item) =>
            failedAttractionGeocodeKeysRef.current.add(item.key)
          );
          return;
        }

        const nextCoordinates: Record<string, GoogleGeocodeCoordinate> = {};
        payload.results?.forEach((result) => {
          if (
            typeof result.lat === "number" &&
            Number.isFinite(result.lat) &&
            typeof result.lng === "number" &&
            Number.isFinite(result.lng)
          ) {
            nextCoordinates[result.key] = {
              lat: result.lat,
              lng: result.lng,
              formattedAddress: result.formattedAddress,
              placeId: result.placeId,
              locationType: result.locationType,
            };
            return;
          }

          failedAttractionGeocodeKeysRef.current.add(result.key);
        });

        if (!disposed && Object.keys(nextCoordinates).length > 0) {
          setGoogleAttractionCoordinates((current) => ({
            ...current,
            ...nextCoordinates,
          }));
        }
      } catch {
        pendingItems.forEach((item) =>
          failedAttractionGeocodeKeysRef.current.add(item.key)
        );
      }
    })();

    return () => {
      disposed = true;
    };
  }, [attractionGeocodeItems, googleAttractionCoordinates]);

  useEffect(() => {
    setEditableItineryRows(defaultItineryRows);
  }, [defaultItineryRows]);

  useEffect(() => {
    setDetailResourceTab("attractions");
    setCustomizeDayEditor(false);
  }, [activeDayIndex, detailOpen]);

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
    setFullMapActiveCity(city);
    setHighlightCityKey(cityKey);
    const firstDayIndex = editableItinerary.findIndex(
      (day) => normalizeLookupKey(day.city) === normalizeLookupKey(city)
    );
    if (firstDayIndex >= 0) {
      setActiveDayIndex(firstDayIndex);
    }
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = setTimeout(() => {
      setHighlightCityKey((currentKey) => (currentKey === cityKey ? "" : currentKey));
    }, 1600);
    node?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editableItinerary]);

  const openDetailAtDay = (index: number) => {
    setActiveDayIndex(index);
    setDetailOpen(true);
  };

  const updateItineraryList = useCallback(
    (updater: (days: ItineraryDay[]) => ItineraryDay[]) => {
      setEditableItinerary((days) => {
        const nextDays = renumberItineraryDays(updater(days));
        const nextActiveIndex = Math.min(
          activeDayIndex,
          Math.max(0, nextDays.length - 1)
        );
        if (nextActiveIndex !== activeDayIndex) {
          setActiveDayIndex(nextActiveIndex);
        }
        return nextDays;
      });
    },
    [activeDayIndex]
  );

  const updateItineraryActivity = useCallback(
    (dayIndex: number, activityIndex: number, value: string) => {
      updateItineraryList((days) =>
        days.map((day, index) =>
          index === dayIndex
            ? {
                ...day,
                activities: day.activities.map((activity, itemIndex) =>
                  itemIndex === activityIndex ? value : activity
                ),
              }
            : day
        )
      );
    },
    [updateItineraryList]
  );

  const addItineraryActivity = useCallback(
    (dayIndex: number) => {
      updateItineraryList((days) =>
        days.map((day, index) =>
          index === dayIndex
            ? {
                ...day,
                activities: [
                  ...day.activities,
                  getSpecificAttraction(day.city, dayIndex, day.activities.length),
                ],
              }
            : day
        )
      );
    },
    [updateItineraryList]
  );

  const addKnowledgeAttractionToDay = useCallback(
    (dayIndex: number, attraction: AttractionChoiceCard) => {
      updateItineraryList((days) =>
        days.map((day, index) =>
          index === dayIndex
            ? {
                ...day,
                activities: day.activities.includes(attraction.name)
                  ? day.activities
                  : [...day.activities, attraction.name],
              }
            : day
        )
      );
    },
    [updateItineraryList]
  );

  const selectFlightOption = useCallback(
    (
      leg: FlightLegResult,
      legIndex: number,
      option: FlightOptionResult,
      optionIndex: number
    ) => {
      const nextFlight = createSelectedFlightFromOption(
        leg,
        legIndex,
        option,
        optionIndex
      );
      setLocalSelectedFlights((current) => {
        const seed = current ?? effectiveSelectedFlights;
        const withoutLeg = seed.filter((flight) => flight.leg_index !== legIndex);
        return [...withoutLeg, nextFlight].sort(
          (first, second) => first.leg_index - second.leg_index
        );
      });
      toast.success("已更新这段航班。");
    },
    [effectiveSelectedFlights]
  );

  const selectHotelOption = useCallback(
    (
      stay: HotelStayResult,
      stayIndex: number,
      option: HotelOptionResult,
      optionIndex: number
    ) => {
      const nextHotel = createSelectedHotelFromOption(
        stay,
        stayIndex,
        option,
        optionIndex
      );
      setLocalSelectedHotels((current) => {
        const seed = current ?? effectiveSelectedHotels;
        const withoutStay = seed.filter((hotel) => hotel.stay_index !== stayIndex);
        return [...withoutStay, nextHotel].sort(
          (first, second) => first.stay_index - second.stay_index
        );
      });
      toast.success("已更新这段住宿。");
    },
    [effectiveSelectedHotels]
  );

  const removeItineraryActivity = useCallback(
    (dayIndex: number, activityIndex: number) => {
      updateItineraryList((days) =>
        days.map((day, index) =>
          index === dayIndex
            ? {
                ...day,
                activities: day.activities.filter(
                  (_, itemIndex) => itemIndex !== activityIndex
                ),
              }
            : day
        )
      );
    },
    [updateItineraryList]
  );

  const updateItineraryFood = useCallback(
    (dayIndex: number, foodIndex: number, value: string) => {
      updateItineraryList((days) =>
        days.map((day, index) =>
          index === dayIndex
            ? {
                ...day,
                food: day.food.map((food, itemIndex) =>
                  itemIndex === foodIndex ? value : food
                ),
              }
            : day
        )
      );
    },
    [updateItineraryList]
  );

  const addItineraryFood = useCallback(
    (dayIndex: number) => {
      updateItineraryList((days) =>
        days.map((day, index) =>
          index === dayIndex
            ? {
                ...day,
                food: [...day.food, `${getLocalCityLabel(day.city)}本地餐厅`],
              }
            : day
        )
      );
    },
    [updateItineraryList]
  );

  const removeItineraryFood = useCallback(
    (dayIndex: number, foodIndex: number) => {
      updateItineraryList((days) =>
        days.map((day, index) =>
          index === dayIndex
            ? {
                ...day,
                food: day.food.filter((_, itemIndex) => itemIndex !== foodIndex),
              }
            : day
        )
      );
    },
    [updateItineraryList]
  );

  const addItineraryDay = useCallback(
    (city: string) => {
      updateItineraryList((days) => {
        const insertAfter = (() => {
          for (let index = days.length - 1; index >= 0; index -= 1) {
            if (normalizeLookupKey(days[index].city) === normalizeLookupKey(city)) {
              return index + 1;
            }
          }
          return days.length;
        })();
        const newDay: ItineraryDay = {
          day: insertAfter + 1,
          city,
          activities: [
            getSpecificAttraction(city, insertAfter, 0),
            getSpecificAttraction(city, insertAfter, 1),
          ],
          food: [`${getLocalCityLabel(city)}本地餐厅`],
          cost: "¥800",
        };
        return [...days.slice(0, insertAfter), newDay, ...days.slice(insertAfter)];
      });
    },
    [updateItineraryList]
  );

  const removeItineraryDay = useCallback(
    (dayIndex: number) => {
      updateItineraryList((days) => days.filter((_, index) => index !== dayIndex));
    },
    [updateItineraryList]
  );

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
        time: "09:00 上午",
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

  const renderExportLanguageSwitch = (placement: string) => (
    <div
      className="flex rounded-full bg-[#f6efff] p-1"
      data-testid={`travel-itinerary-export-language-${placement}`}
    >
      {EXPORT_LANGUAGE_OPTIONS.map((option) => (
        <button
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
            exportLanguage === option.value
              ? "bg-white text-[#2d1635] shadow-sm"
              : "text-[#7b4de8] hover:bg-white/70"
          )}
          key={`${placement}-${option.value}`}
          onClick={() => setExportLanguage(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
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
                    {editableItinerary.length} 天数
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
                    {Math.max(
                      routeNodes.length - 1,
                      effectiveTravelState.selected_flights.length
                    )} 运输
                  </span>
                  {effectiveTravelState.travelers ? (
                    <span className="inline-flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      {effectiveTravelState.travelers} 旅行者
                    </span>
                  ) : null}
                </div>
              </div>
            </button>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              {renderExportLanguageSwitch("hero")}
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
                    `travel-itinerary${exportFilenameSuffix}.docx`,
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
                    `travel-itinerary${exportFilenameSuffix}.pdf`,
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
              <table className="min-w-[1180px] w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-[#efe5ff] text-[#2d1635]">
                  <tr>
                    {[
                      "时间",
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
                            ["time", "时间"],
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
                                value={row[field] ?? ""}
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
                                value={row[field] ?? ""}
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
                      <td className="px-4 py-4 text-[#5f5166]" colSpan={8}>
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
              activePointId={
                activeCityAttractionPoints[0]?.id ?? focusedPointId
              }
              className="h-[300px] w-full md:h-[360px]"
              onPointSelect={onPointSelect}
              points={cityFocusedMapPoints}
              routeCoordinates={cityFocusedRouteCoordinates}
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
                const days = getSegmentDays(editableItinerary, segment);
                const hotel = findHotelForCity(
                  effectiveTravelState.selected_hotels,
                  segment.city
                );
                const nextSegment = segments[segmentIndex + 1];
                const galleryImages = getCityGalleryImages(segment, days);
                const firstDayIndex = days[0]
                  ? Math.max(0, editableItinerary.indexOf(days[0]))
                  : 0;
                const segmentFlights = getSegmentFlights(
                  effectiveTravelState.selected_flights,
                  segment
                );
                const segmentFlightLegs = getSegmentFlightLegs(apiFlightLegs, segment);
                const segmentHotelStay = findHotelStayForCity(
                  apiHotelStays,
                  segment.city
                );

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
                          <div className="flex flex-wrap gap-2">
                            <Button
                              className="rounded-full border-[#d8c5ff] text-[#6f40cc] hover:bg-[#f6efff]"
                              onClick={() => addItineraryDay(segment.city)}
                              type="button"
                              variant="outline"
                            >
                              <Plus className="h-4 w-4" />
                              添加天数
                            </Button>
                            <Button
                              className="rounded-full border-[#d8c5ff] text-[#6f40cc] hover:bg-[#f6efff]"
                              onClick={() => openDetailAtDay(firstDayIndex)}
                              type="button"
                              variant="outline"
                            >
                              查看/编辑
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
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

                      {segmentFlights.length ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          {segmentFlights.map((flight) => (
                            <article
                              className="rounded-[24px] bg-white p-4 shadow-[0_14px_42px_rgba(32,20,43,0.08)]"
                              data-testid={`travel-itinerary-flight-card-${cityKey}-${flight.leg_index}`}
                              key={`${cityKey}-flight-${flight.leg_index}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="inline-flex items-center gap-2 text-sm font-bold text-[#6f40cc]">
                                    <Plane className="h-4 w-4" />
                                    {getFlightDirectionLabel(flight, segment)}
                                  </p>
                                  <h4 className="mt-2 truncate text-lg font-bold text-[#2d1635]">
                                    {flight.option?.airline ?? "API 推荐航班"}{" "}
                                    {getFlightNumber(flight)}
                                  </h4>
                                </div>
                                <span className="shrink-0 rounded-full bg-[#f6efff] px-3 py-1 text-sm font-bold text-[#6f40cc]">
                                  {getFlightDisplayPrice(flight)}
                                </span>
                              </div>
                              <div className="mt-4 grid gap-3 text-sm font-semibold text-[#5f5166] sm:grid-cols-2">
                                <span>
                                  <span className="block text-xs text-[#8d8391]">
                                    航线
                                  </span>
                                  {getLocalCityLabel(flight.from)} →{" "}
                                  {getLocalCityLabel(flight.to)}
                                </span>
                                <span>
                                  <span className="block text-xs text-[#8d8391]">
                                    时间
                                  </span>
                                  {extractClockTime(
                                    flight.option?.departure,
                                    "08:00"
                                  )}{" "}
                                  出发
                                  {flight.option?.arrival
                                    ? ` · ${extractClockTime(
                                        flight.option.arrival,
                                        ""
                                      )} 到达`
                                    : ""}
                                </span>
                                <span>
                                  <span className="block text-xs text-[#8d8391]">
                                    日期
                                  </span>
                                  {formatMonthDay(flight.departure_date)}
                                </span>
                                <span>
                                  <span className="block text-xs text-[#8d8391]">
                                    时长/经停
                                  </span>
                                  {flight.option?.duration ?? "待确认"} ·{" "}
                                  {flight.option?.stops === 0
                                    ? "直飞"
                                    : typeof flight.option?.stops === "number"
                                      ? `${flight.option.stops} 次中转`
                                      : "经停待确认"}
                                </span>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : null}

                      {segmentFlightLegs.length ? (
                        <div className="rounded-[24px] bg-white p-5 shadow-[0_14px_42px_rgba(32,20,43,0.08)]">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="inline-flex items-center gap-2 text-sm font-bold text-[#2d1635]">
                              <Plane className="h-4 w-4 text-[#6f40cc]" />
                              可选航班
                            </p>
                            <span className="text-xs font-semibold text-[#8d8391]">
                              来自 API，点击卡片替换默认选择
                            </span>
                          </div>
                          <div className="mt-4 grid gap-3 lg:grid-cols-2">
                            {segmentFlightLegs.map(({ leg, legIndex }) => {
                              const selectedFlight = getSelectedFlightForLeg(
                                effectiveTravelState.selected_flights,
                                legIndex
                              );

                              return leg.options.slice(0, 3).map((option, optionIndex) => {
                                const displayOptionIndex = optionIndex + 1;
                                const selected =
                                  selectedFlight?.option_index === displayOptionIndex ||
                                  getFlightOptionKey(
                                    legIndex,
                                    selectedFlight?.option ?? {},
                                    selectedFlight?.option_index ?? 0
                                  ) ===
                                    getFlightOptionKey(
                                      legIndex,
                                      option,
                                      displayOptionIndex
                                    );

                                return (
                                  <button
                                    className={cn(
                                      "rounded-2xl border p-4 text-left transition-colors",
                                      selected
                                        ? "border-[#b990ff] bg-[#f7efff]"
                                        : "border-[#eadfff] bg-white hover:border-[#c9a8ff]"
                                    )}
                                    key={`${cityKey}-flight-option-${getFlightOptionKey(
                                      legIndex,
                                      option,
                                      displayOptionIndex
                                    )}`}
                                    onClick={() =>
                                      selectFlightOption(
                                        leg,
                                        legIndex,
                                        option,
                                        displayOptionIndex
                                      )
                                    }
                                    type="button"
                                  >
                                    <span className="flex items-start justify-between gap-3">
                                      <span className="min-w-0">
                                        <span className="block text-xs font-bold text-[#8d5df7]">
                                          {getLocalCityLabel(leg.from)} →{" "}
                                          {getLocalCityLabel(leg.to)}
                                        </span>
                                        <span className="mt-1 block truncate text-base font-bold text-[#2d1635]">
                                          {option.airline ?? "API 推荐航司"}{" "}
                                          {option.flight_number ?? "航班号待补充"}
                                        </span>
                                      </span>
                                      {selected ? (
                                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#6f40cc] text-white">
                                          <Check className="h-4 w-4" />
                                        </span>
                                      ) : null}
                                    </span>
                                    <span className="mt-3 grid gap-2 text-xs font-semibold text-[#5f5166] sm:grid-cols-2">
                                      <span>
                                        {extractClockTime(option.departure, "08:00")} 出发
                                      </span>
                                      <span>{option.duration ?? "时长待确认"}</span>
                                      <span>
                                        {option.stops === 0
                                          ? "直飞"
                                          : typeof option.stops === "number"
                                            ? `${option.stops} 次中转`
                                            : "经停待确认"}
                                      </span>
                                      <span className="font-bold text-[#2d1635]">
                                        {getFlightOptionDisplayPrice(option)}
                                      </span>
                                    </span>
                                  </button>
                                );
                              });
                            })}
                          </div>
                        </div>
                      ) : null}

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
                              {Array.from({
                                length: preferFourStarHotel ? 4 : 3,
                              }).map((_, item) => (
                                <Star
                                  className="h-4 w-4 fill-current"
                                  key={`hotel-star-${cityKey}-${item}`}
                                />
                              ))}
                            </div>
                            <h4 className="mt-2 text-xl font-bold text-[#2d1635]">
                              {hotel.option.name ?? `${segment.label}精选酒店`}
                            </h4>
                            {preferFourStarHotel ? (
                              <p className="mt-1 text-sm font-bold text-[#6f40cc]">
                                已应用 4 星酒店偏好，可继续编辑替换
                              </p>
                            ) : null}
                            <p className="mt-1 text-sm font-semibold text-[#756a7b]">
                              {hotel.nights} 晚上 · {formatMonthDay(hotel.check_in)} -{" "}
                              {formatMonthDay(hotel.check_out)}
                            </p>
                            {hotel.option.address ? (
                              <p className="mt-2 line-clamp-1 text-sm text-[#756a7b]">
                                {hotel.option.address}
                              </p>
                            ) : null}
                            <p className="mt-1 line-clamp-1 text-sm text-[#756a7b]">
                              联系电话：{getHotelContactLabel(hotel.option)}
                            </p>
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

                      {segmentHotelStay ? (
                        <div className="rounded-[24px] bg-white p-5 shadow-[0_14px_42px_rgba(32,20,43,0.08)]">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="inline-flex items-center gap-2 text-sm font-bold text-[#2d1635]">
                              <BedDouble className="h-4 w-4 text-[#6f40cc]" />
                              可选酒店
                            </p>
                            <span className="text-xs font-semibold text-[#8d8391]">
                              地址和电话随选择同步到 itinerary
                            </span>
                          </div>
                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            {segmentHotelStay.stay.options
                              .slice(0, 4)
                              .map((option, optionIndex) => {
                                const displayOptionIndex = optionIndex + 1;
                                const selectedHotel = getSelectedHotelForStay(
                                  effectiveTravelState.selected_hotels,
                                  segmentHotelStay.stayIndex
                                );
                                const selected =
                                  selectedHotel?.option_index === displayOptionIndex ||
                                  getHotelOptionKey(
                                    segmentHotelStay.stayIndex,
                                    selectedHotel?.option ?? {},
                                    selectedHotel?.option_index ?? 0
                                  ) ===
                                    getHotelOptionKey(
                                      segmentHotelStay.stayIndex,
                                      option,
                                      displayOptionIndex
                                    );

                                return (
                                  <button
                                    className={cn(
                                      "rounded-2xl border p-4 text-left transition-colors",
                                      selected
                                        ? "border-[#b990ff] bg-[#f7efff]"
                                        : "border-[#eadfff] bg-white hover:border-[#c9a8ff]"
                                    )}
                                    key={`${cityKey}-hotel-option-${getHotelOptionKey(
                                      segmentHotelStay.stayIndex,
                                      option,
                                      displayOptionIndex
                                    )}`}
                                    onClick={() =>
                                      selectHotelOption(
                                        segmentHotelStay.stay,
                                        segmentHotelStay.stayIndex,
                                        option,
                                        displayOptionIndex
                                      )
                                    }
                                    type="button"
                                  >
                                    <span className="flex items-start justify-between gap-3">
                                      <span className="min-w-0">
                                        <span className="block truncate text-base font-bold text-[#2d1635]">
                                          {option.name ?? `${segment.label} API 酒店`}
                                        </span>
                                        <span className="mt-1 line-clamp-1 block text-xs font-semibold text-[#756a7b]">
                                          {option.address ?? "地址由 API 返回后显示"}
                                        </span>
                                      </span>
                                      {selected ? (
                                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#6f40cc] text-white">
                                          <Check className="h-4 w-4" />
                                        </span>
                                      ) : null}
                                    </span>
                                    <span className="mt-3 grid gap-2 text-xs font-semibold text-[#5f5166] sm:grid-cols-2">
                                      <span>{segmentHotelStay.stay.nights} 晚</span>
                                      <span>{option.rating ? `${option.rating} 分` : "评分待补充"}</span>
                                      <span className="line-clamp-1">
                                        {getHotelContactLabel(option)}
                                      </span>
                                      <span className="font-bold text-[#2d1635]">
                                        {getHotelOptionDisplayPrice(option)}
                                      </span>
                                    </span>
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      ) : null}

                      <div className="space-y-3">
                        {days.map((day) => {
                          const dayIndex = editableItinerary.indexOf(day);
                          const safeDayIndex = dayIndex >= 0 ? dayIndex : 0;
                          const timelineItems = buildDayTimelineItems(
                            day,
                            safeDayIndex,
                            effectiveTravelState,
                            effectiveSelectedFlights,
                            effectiveSelectedHotels
                          );

                          return (
                            <article
                              className="grid w-full gap-4 rounded-[24px] bg-white p-3 text-left shadow-[0_12px_36px_rgba(32,20,43,0.08)] transition-transform hover:-translate-y-0.5 md:grid-cols-[150px_1fr_auto]"
                              data-testid={`travel-itinerary-day-card-${cityKey}-${day.day}`}
                              key={`${cityKey}-day-${day.day}`}
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
                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                  {timelineItems.map((item) => (
                                    <div
                                      className="rounded-2xl bg-[#f8f3ff] px-3 py-2"
                                      key={`${cityKey}-${day.day}-${item.time}-${item.label}`}
                                    >
                                      <p className="text-xs font-bold text-[#8d5df7]">
                                        {item.time} · {item.label}
                                      </p>
                                      <p className="mt-0.5 line-clamp-1 text-sm font-semibold text-[#2d1635]">
                                        {item.value}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center justify-end gap-2 self-center">
                                <Button
                                  aria-label={`编辑${formatDayTab(day)}`}
                                  className="rounded-full border-[#d8c5ff] text-[#6f40cc] hover:bg-[#f6efff]"
                                  onClick={() => openDetailAtDay(safeDayIndex)}
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                >
                                  编辑
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                                <Button
                                  aria-label={`删除${formatDayTab(day)}`}
                                  className="h-9 w-9 rounded-full border-[#f2c7d0] text-[#b42348] hover:bg-[#fff1f3]"
                                  onClick={() => removeItineraryDay(safeDayIndex)}
                                  size="icon"
                                  type="button"
                                  variant="outline"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </article>
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
                  {editableItinerary.map((day, index) => (
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
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-2xl font-bold text-[#2d1635]">
                            {getLocalCityLabel(activeDay.city)}
                          </h3>
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#efe5ff] px-2.5 py-1 text-sm font-bold text-[#6f40cc]">
                            <Clock3 className="h-4 w-4" />
                            {activeDay.cost}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            className="rounded-full border-[#d8c5ff] text-[#6f40cc] hover:bg-[#f6efff]"
                            onClick={() =>
                              setCustomizeDayEditor((current) => !current)
                            }
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <Pencil className="h-4 w-4" />
                            自定义
                          </Button>
                          <Button
                            className="rounded-full border-[#f2c7d0] text-[#b42348] hover:bg-[#fff1f3]"
                            onClick={() => removeItineraryDay(activeDayIndex)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <Trash2 className="h-4 w-4" />
                            删除当天
                          </Button>
                        </div>
                      </div>
                      <p className="mt-2 text-base text-[#5f5166]">
                        {summarizeDay(activeDay)}
                      </p>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {activeDayTimeline.map((item) => (
                        <div
                          className="rounded-2xl border border-[#eadfff] bg-white px-4 py-3"
                          key={`detail-timeline-${item.time}-${item.label}`}
                        >
                          <p className="text-xs font-bold text-[#8d5df7]">
                            {item.time} · {item.label}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm font-semibold text-[#2d1635]">
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-2xl border border-[#eadfff] bg-white px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#8d8391]">当晚酒店</p>
                          <p className="mt-1 truncate text-sm font-bold text-[#2d1635]">
                            {activeDayHotel?.option.name ?? "待选择酒店"}
                          </p>
                          {activeDayHotel ? (
                            <p className="mt-1 text-xs font-semibold text-[#756a7b]">
                              {formatMonthDay(activeDayHotel.check_in)} - {formatMonthDay(activeDayHotel.check_out)}
                            </p>
                          ) : activeDayHotelStay ? (
                            <p className="mt-1 text-xs font-semibold text-[#756a7b]">
                              {formatMonthDay(activeDayHotelStay.stay.check_in)} - {formatMonthDay(activeDayHotelStay.stay.check_out)}
                            </p>
                          ) : null}
                        </div>
                        <Button
                          className="rounded-full border-[#d8c5ff] text-[#6f40cc] hover:bg-[#f6efff]"
                          onClick={() => setDetailResourceTab("hotels")}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {activeDayHotel ? "修改酒店" : "选择酒店"}
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 rounded-[22px] bg-[#efe5ff] p-1">
                      {(
                        [
                          ["attractions", "景点"],
                          ["flights", "航班"],
                          ["hotels", "酒店"],
                        ] as const
                      ).map(([tab, label]) => (
                        <button
                          className={cn(
                            "rounded-[18px] px-3 py-2 text-sm font-bold transition-colors",
                            detailResourceTab === tab
                              ? "bg-white text-[#2d1635] shadow-sm"
                              : "text-[#6f40cc] hover:bg-white/55"
                          )}
                          key={`detail-resource-tab-${tab}`}
                          onClick={() => setDetailResourceTab(tab)}
                          type="button"
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {customizeDayEditor ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#eadfff] bg-white p-4 text-sm font-semibold text-[#5f5166]">
                        <span>
                          自定义模式已开启。常规修改优先通过下面的候选卡片完成；只有需要临时补充时再手动输入。
                        </span>
                        <span className="flex gap-2">
                          <Button
                            className="h-8 rounded-full border-[#d8c5ff] text-[#6f40cc] hover:bg-[#f6efff]"
                            onClick={() => addItineraryActivity(activeDayIndex)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <Plus className="h-4 w-4" />
                            景点
                          </Button>
                          <Button
                            className="h-8 rounded-full border-[#d8c5ff] text-[#6f40cc] hover:bg-[#f6efff]"
                            onClick={() => addItineraryFood(activeDayIndex)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <Plus className="h-4 w-4" />
                            餐饮
                          </Button>
                        </span>
                      </div>
                    ) : null}

                    {detailResourceTab === "attractions" ? (
                      <>
                    {activeDayAttractionChoices.length ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_36px_rgba(32,20,43,0.08)]">
                        <div className="flex items-center justify-between gap-3">
                          <p className="inline-flex items-center gap-2 text-sm font-bold text-[#2d1635]">
                            <MapPinned className="h-4 w-4 text-[#6f40cc]" />
                            景点库
                          </p>
                          <span className="text-xs font-semibold text-[#8d8391]">
                            点击加入当天行程
                          </span>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {activeDayAttractionChoices.map((attraction) => (
                            <button
                              className="grid min-h-28 grid-cols-[88px_1fr] gap-3 rounded-2xl border border-[#eadfff] bg-[#fbf8ff] p-2 text-left transition-colors hover:border-[#b990ff] hover:bg-white"
                              key={`${activeDay.city}-${attraction.name}`}
                              onClick={() =>
                                addKnowledgeAttractionToDay(
                                  activeDayIndex,
                                  attraction
                                )
                              }
                              type="button"
                            >
                              <span className="relative h-full min-h-24 overflow-hidden rounded-xl bg-slate-200">
                                <Image
                                  alt={attraction.name}
                                  className="h-full w-full object-cover"
                                  height={140}
                                  src={attraction.imageSrc}
                                  width={140}
                                />
                              </span>
                              <span className="min-w-0 py-1">
                                <span className="line-clamp-2 text-sm font-bold text-[#2d1635]">
                                  {attraction.name}
                                </span>
                                <span className="mt-1 line-clamp-2 block text-xs font-semibold text-[#756a7b]">
                                  {attraction.location}
                                </span>
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-4">
                      {activeDay.activities.map((activity, index) => (
                        <div
                          className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_36px_rgba(32,20,43,0.08)] sm:grid-cols-[96px_1fr]"
                          key={`${activeDay.city}-activity-${activity}-${index}`}
                        >
                          <div className="relative h-24 overflow-hidden rounded-xl bg-slate-200">
                            <Image
                              alt={activity}
                              className="h-full w-full object-cover"
                              height={120}
                              src={
                                findTravelAttraction(activeDay.city, activity)?.imageSrc ??
                                getCityImage(activeDay.city, activity)
                              }
                              width={140}
                            />
                          </div>
                          <div className="flex items-start gap-4">
                            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#efe5ff] font-bold text-[#6f40cc]">
                              {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-[#756a7b]">
                                {index === 0
                                  ? "09:00 · 上午景点"
                                  : index === 1
                                    ? "14:30 · 下午景点"
                                    : "加选景点"}
                              </p>
                              {customizeDayEditor ? (
                                <input
                                  aria-label={`景点 ${index + 1}`}
                                  className="mt-1 w-full rounded-xl border border-[#eadfff] bg-white px-3 py-2 text-lg font-bold text-[#2d1635] outline-none transition-colors focus:border-[#b990ff]"
                                  onChange={(event) =>
                                    updateItineraryActivity(
                                      activeDayIndex,
                                      index,
                                      event.target.value
                                    )
                                  }
                                  value={activity}
                                />
                              ) : (
                                <p className="mt-1 text-lg font-bold text-[#2d1635]">
                                  {activity}
                                </p>
                              )}
                              {googleAttractionCoordinates[
                                getAttractionCoordinateKey(activeDay.city, activity)
                              ]?.formattedAddress ? (
                                <p className="mt-1 line-clamp-1 text-xs font-semibold text-[#8d8391]">
                                  {
                                    googleAttractionCoordinates[
                                      getAttractionCoordinateKey(
                                        activeDay.city,
                                        activity
                                      )
                                    ]?.formattedAddress
                                  }
                                </p>
                              ) : null}
                            </div>
                            <Button
                              aria-label={`删除景点 ${index + 1}`}
                              className="h-9 w-9 shrink-0 rounded-full border-[#f2c7d0] text-[#b42348] hover:bg-[#fff1f3]"
                              onClick={() =>
                                removeItineraryActivity(activeDayIndex, index)
                              }
                              size="icon"
                              type="button"
                              variant="outline"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {activeDay.food.length ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_36px_rgba(32,20,43,0.08)]">
                        <div className="flex items-center justify-between gap-3">
                          <p className="inline-flex items-center gap-2 text-sm font-bold text-[#2d1635]">
                            <Utensils className="h-4 w-4 text-[#6f40cc]" />
                            今日餐厅
                          </p>
                          {customizeDayEditor ? (
                            <Button
                              className="h-8 rounded-full border-[#d8c5ff] text-[#6f40cc] hover:bg-[#f6efff]"
                              onClick={() => addItineraryFood(activeDayIndex)}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Plus className="h-4 w-4" />
                              餐饮
                            </Button>
                          ) : null}
                        </div>
                        <div className="mt-3 grid gap-2">
                          {activeDay.food.map((food, index) => (
                            <div
                              className="flex items-center gap-2 rounded-2xl bg-[#f6efff] px-3 py-2"
                              key={`${activeDay.city}-food-${food}-${index}`}
                            >
                              {customizeDayEditor ? (
                                <input
                                  aria-label={`餐饮 ${index + 1}`}
                                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#6f40cc] outline-none"
                                  onChange={(event) =>
                                    updateItineraryFood(
                                      activeDayIndex,
                                      index,
                                      event.target.value
                                    )
                                  }
                                  value={food}
                                />
                              ) : (
                                <span className="min-w-0 flex-1 text-sm font-semibold text-[#6f40cc]">
                                  {food}
                                </span>
                              )}
                              <Button
                                aria-label={`删除餐饮 ${index + 1}`}
                                className="h-8 w-8 rounded-full text-[#b42348] hover:bg-white"
                                onClick={() =>
                                  removeItineraryFood(activeDayIndex, index)
                                }
                                size="icon"
                                type="button"
                                variant="ghost"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                      </>
                    ) : null}

                    {detailResourceTab === "flights" ? (
                      <div className="space-y-4">
                        {activeDayFlightLegs.length ? (
                          activeDayFlightLegs.map(({ leg, legIndex }) => {
                            const selectedFlight = getSelectedFlightForLeg(
                              effectiveTravelState.selected_flights,
                              legIndex
                            );

                            return (
                              <div
                                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_36px_rgba(32,20,43,0.08)]"
                                key={`detail-flight-leg-${legIndex}`}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <p className="inline-flex items-center gap-2 text-sm font-bold text-[#2d1635]">
                                    <Plane className="h-4 w-4 text-[#6f40cc]" />
                                    {getLocalCityLabel(leg.from)} →{" "}
                                    {getLocalCityLabel(leg.to)}
                                  </p>
                                  <span className="text-xs font-semibold text-[#8d8391]">
                                    {formatMonthDay(leg.departure_date)}
                                  </span>
                                </div>
                                <div className="mt-4 grid gap-3">
                                  {leg.options.slice(0, 5).map((option, optionIndex) => {
                                    const displayOptionIndex = optionIndex + 1;
                                    const selected =
                                      selectedFlight?.option_index ===
                                        displayOptionIndex ||
                                      getFlightOptionKey(
                                        legIndex,
                                        selectedFlight?.option ?? {},
                                        selectedFlight?.option_index ?? 0
                                      ) ===
                                        getFlightOptionKey(
                                          legIndex,
                                          option,
                                          displayOptionIndex
                                        );

                                    return (
                                      <button
                                        className={cn(
                                          "rounded-2xl border p-4 text-left transition-colors",
                                          selected
                                            ? "border-[#b990ff] bg-[#f7efff]"
                                            : "border-[#eadfff] bg-white hover:border-[#c9a8ff]"
                                        )}
                                        key={`detail-flight-option-${getFlightOptionKey(
                                          legIndex,
                                          option,
                                          displayOptionIndex
                                        )}`}
                                        onClick={() =>
                                          selectFlightOption(
                                            leg,
                                            legIndex,
                                            option,
                                            displayOptionIndex
                                          )
                                        }
                                        type="button"
                                      >
                                        <span className="flex items-start justify-between gap-3">
                                          <span className="min-w-0">
                                            <span className="block text-base font-bold text-[#2d1635]">
                                              {option.airline ?? "API 推荐航司"}{" "}
                                              {option.flight_number ?? "航班号待补充"}
                                            </span>
                                            <span className="mt-1 block text-xs font-semibold text-[#756a7b]">
                                              {extractClockTime(
                                                option.departure,
                                                "08:00"
                                              )}{" "}
                                              出发 ·{" "}
                                              {option.duration ?? "时长待确认"} ·{" "}
                                              {option.stops === 0
                                                ? "直飞"
                                                : typeof option.stops === "number"
                                                  ? `${option.stops} 次中转`
                                                  : "经停待确认"}
                                            </span>
                                          </span>
                                          <span className="flex shrink-0 items-center gap-2">
                                            <span className="rounded-full bg-[#efe5ff] px-3 py-1 text-sm font-bold text-[#6f40cc]">
                                              {getFlightOptionDisplayPrice(option)}
                                            </span>
                                            {selected ? (
                                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#6f40cc] text-white">
                                                <Check className="h-4 w-4" />
                                              </span>
                                            ) : null}
                                          </span>
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="rounded-2xl border border-[#eadfff] bg-white p-5 text-sm font-semibold text-[#5f5166]">
                            这个城市暂时没有 API 航班候选。若这是陆路移动城市，地图会继续显示景点动线。
                          </div>
                        )}
                      </div>
                    ) : null}

                    {detailResourceTab === "hotels" ? (
                      <div className="space-y-4">
                        {activeDayHotel ? (
                          <div className="rounded-2xl border border-[#d8c5ff] bg-[#fbf8ff] p-5">
                            <p className="inline-flex items-center gap-2 text-sm font-bold text-[#2d1635]">
                              <BedDouble className="h-4 w-4 text-[#6f40cc]" />
                              当前住宿
                            </p>
                            <h4 className="mt-3 text-lg font-bold text-[#2d1635]">
                              {activeDayHotel.option.name ?? "API 默认酒店"}
                            </h4>
                            <p className="mt-1 text-sm font-semibold text-[#756a7b]">
                              {activeDayHotel.option.address ?? "地址待补充"} ·{" "}
                              {getHotelContactLabel(activeDayHotel.option)}
                            </p>
                          </div>
                        ) : null}

                        {activeDayHotelStay ? (
                          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_36px_rgba(32,20,43,0.08)]">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="inline-flex items-center gap-2 text-sm font-bold text-[#2d1635]">
                                <BedDouble className="h-4 w-4 text-[#6f40cc]" />
                                酒店候选
                              </p>
                              <span className="text-xs font-semibold text-[#8d8391]">
                                {formatMonthDay(activeDayHotelStay.stay.check_in)} -{" "}
                                {formatMonthDay(activeDayHotelStay.stay.check_out)}
                              </span>
                            </div>
                            <div className="mt-4 grid gap-3">
                              {activeDayHotelStay.stay.options
                                .slice(0, 6)
                                .map((option, optionIndex) => {
                                  const displayOptionIndex = optionIndex + 1;
                                  const selectedHotel = getSelectedHotelForStay(
                                    effectiveTravelState.selected_hotels,
                                    activeDayHotelStay.stayIndex
                                  );
                                  const selected =
                                    selectedHotel?.option_index ===
                                      displayOptionIndex ||
                                    getHotelOptionKey(
                                      activeDayHotelStay.stayIndex,
                                      selectedHotel?.option ?? {},
                                      selectedHotel?.option_index ?? 0
                                    ) ===
                                      getHotelOptionKey(
                                        activeDayHotelStay.stayIndex,
                                        option,
                                        displayOptionIndex
                                      );

                                  return (
                                    <button
                                      className={cn(
                                        "rounded-2xl border p-4 text-left transition-colors",
                                        selected
                                          ? "border-[#b990ff] bg-[#f7efff]"
                                          : "border-[#eadfff] bg-white hover:border-[#c9a8ff]"
                                      )}
                                      key={`detail-hotel-option-${getHotelOptionKey(
                                        activeDayHotelStay.stayIndex,
                                        option,
                                        displayOptionIndex
                                      )}`}
                                      onClick={() =>
                                        selectHotelOption(
                                          activeDayHotelStay.stay,
                                          activeDayHotelStay.stayIndex,
                                          option,
                                          displayOptionIndex
                                        )
                                      }
                                      type="button"
                                    >
                                      <span className="flex items-start justify-between gap-3">
                                        <span className="min-w-0">
                                          <span className="block text-base font-bold text-[#2d1635]">
                                            {option.name ?? "API 推荐酒店"}
                                          </span>
                                          <span className="mt-1 line-clamp-2 block text-xs font-semibold text-[#756a7b]">
                                            {option.address ?? "地址待补充"} ·{" "}
                                            {getHotelContactLabel(option)}
                                          </span>
                                        </span>
                                        <span className="flex shrink-0 items-center gap-2">
                                          <span className="rounded-full bg-[#efe5ff] px-3 py-1 text-sm font-bold text-[#6f40cc]">
                                            {getHotelOptionDisplayPrice(option)}
                                          </span>
                                          {selected ? (
                                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#6f40cc] text-white">
                                              <Check className="h-4 w-4" />
                                            </span>
                                          ) : null}
                                        </span>
                                      </span>
                                    </button>
                                  );
                                })}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-[#eadfff] bg-white p-5 text-sm font-semibold text-[#5f5166]">
                            这个城市暂时没有 API 酒店候选。系统会继续保留当前 itinerary。
                          </div>
                        )}
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
                points={detailMapPoints}
                routeCoordinates={detailRouteCoordinates}
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
