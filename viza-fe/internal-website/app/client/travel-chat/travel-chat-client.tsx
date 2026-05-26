"use client";

import Image from "next/image";
import { useLocale } from "next-intl";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  MapPin,
  MessageSquare,
  MessageSquarePlus,
  PanelLeft,
  Pencil,
  Route,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { ChatInput } from "@/components/client/companion/chat-input";
import { ChatMessage } from "@/components/client/companion/chat-message";
import { ScrollToBottomFab } from "@/components/client/companion/scroll-to-bottom-fab";
import { ThinkingIndicator } from "@/components/client/companion/thinking-indicator";
import { TravelItineraryExperience } from "@/components/client/travel/travel-itinerary-experience";
import {
  TRAVEL_ITINERARY_SHARE_PARAM,
  createTravelShareMessages,
  decodeTravelItinerarySharePayload,
  getTravelItineryRowsFromMessages,
  getTravelItineraryFromMessages,
  type TravelItinerarySharePayload,
} from "@/components/client/travel/travel-itinerary-data";
import { TravelPlannerForm } from "@/components/client/travel/travel-planner-form";
import {
  TripRouteMap,
  type TripMapPoint,
} from "@/components/client/travel/trip-route-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FORM_PAYLOAD_PREFIX,
  buildTravelStateFromMessages,
  createTravelFormMessage,
  getFieldQuestionForState,
  nextMissingField,
  toTravelPayload,
  type ChatLikeMessage,
  type ItineraryDay,
  type SelectedFlightOption,
  type SelectedHotelOption,
  type TravelField,
  type TravelState,
} from "@/lib/travel/planner";
import {
  isChineseLocale,
  toTravelAgentLocale,
  type InterfaceLocale,
} from "@/lib/i18n/locale";
import type {
  TravelDestinationCard,
  TravelChatInputMessage,
  TravelChatMessage,
  TravelChatMessagePart,
  TravelQuickReply,
  TravelChatStatus,
} from "@/lib/travel/chat-types";

type TravelChatClientProps = {
  applicationId?: string | null;
  embedded?: boolean;
};

type ProgressItem = {
  id: string;
  label: string;
  done: boolean;
  detail: string;
};

type MapTarget = {
  id: string;
  kind: "route" | "city" | "hotel" | "hotspot";
  label: string;
  subtitle: string;
  localName?: string;
  intro?: string;
  countryLabel?: string;
  recommendedDays?: string;
  imageSrc: string;
  lat: number;
  lng: number;
  city?: string;
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

type TravelAgentChatResponse = {
  reply?: string;
  mode?: string;
  quick_replies?: TravelQuickReply[];
  cards?: TravelDestinationCard[];
  candidate_payload?: Record<string, unknown>;
  sources?: Array<{ id?: string; title?: string; type?: string }>;
};

type TravelFormCandidatePayload = Parameters<typeof createTravelFormMessage>[0];

type ScrollThumbState = {
  top: number;
  height: number;
  visible: boolean;
};

type TravelIpLocation = {
  country: string;
  city: string;
  countryCode?: string;
  source?: string;
};

type TravelChatSession = {
  id: string;
  title: string;
  customTitle?: boolean;
  messages: TravelChatMessage[];
  activeVersionId?: string;
  versions?: TravelTripVersion[];
  updatedAt: string;
};

type TravelTripVersion = {
  id: string;
  versionNumber: number;
  title: string;
  createdAt: string;
  parentVersionId?: string;
  sourceMessageId?: string;
  userPrompt?: string;
  editSummary?: string;
  travelState: TravelState;
  itinerary: ItineraryDay[];
  selectedFlights: SelectedFlightOption[];
  selectedHotels: SelectedHotelOption[];
  modulePatch?: Record<string, unknown>;
};

type TravelRevisionAction = "revise" | "restart" | "clarify";

type TravelRevisionResult = {
  action: TravelRevisionAction;
  reply: string;
  itinerary: ItineraryDay[];
  statePatch: Record<string, unknown>;
  modulePatch: Record<string, unknown>;
  editSummary: string;
  quickReplies: TravelQuickReply[];
};

const INITIAL_ASSISTANT_TEXT =
  "嗨，我是 VIZA Travel Buddy。你可以直接告诉我想去的国家、出行日期、天数、预算和偏好，也可以先让我给你一些目的地灵感。";
const INITIAL_ASSISTANT_TEXT_EN =
  "Hi, I’m VIZA Travel Buddy. Tell me your destination, travel dates, trip length, budget, and preferences, or ask me for destination ideas first.";

const INITIAL_QUICK_REPLIES: TravelQuickReply[] = [
  { label: "我不知道去哪", value: "我不知道去哪" },
  { label: "想去日本", value: "我想去日本" },
  { label: "想去欧洲", value: "我想去欧洲" },
];
const INITIAL_QUICK_REPLIES_EN: TravelQuickReply[] = [
  { label: "I’m not sure where to go", value: "I’m not sure where to go" },
  { label: "I want to visit Japan", value: "I want to visit Japan" },
  { label: "I want to visit Europe", value: "I want to visit Europe" },
];

const ITINERARY_REVISION_QUICK_REPLIES: TravelQuickReply[] = [
  { label: "便宜一点", value: "把这次旅行便宜一点" },
  { label: "减少航班", value: "把航班去掉，尽量用其他交通方式" },
  { label: "换4星酒店", value: "把酒店换成4星酒店" },
  { label: "加本地美食", value: "每天加更多本地美食" },
  { label: "重排行程", value: "重新安排每天的顺序" },
];
const ITINERARY_REVISION_QUICK_REPLIES_EN: TravelQuickReply[] = [
  { label: "Make it cheaper", value: "Make this trip cheaper" },
  {
    label: "Reduce flights",
    value: "Remove flights and use other transport where possible",
  },
  { label: "Use 4-star hotels", value: "Change the hotels to 4-star hotels" },
  { label: "Add local food", value: "Add more local food each day" },
  { label: "Reorder itinerary", value: "Reorder the daily itinerary" },
];

const EMPTY_TRAVEL_MESSAGES: TravelChatMessage[] = [];

const TRAVEL_CHAT_ARCHIVE_VERSION = 1;
const TRAVEL_JSON_CODE_BLOCK_PATTERN =
  /```json[^\S\r\n]*(?:\r?\n)?[\s\S]*?```/gi;
const TRAVEL_MARKDOWN_CODE_BLOCK_PATTERN =
  /```[a-zA-Z0-9_-]*[^\S\r\n]*(?:\r?\n)?([\s\S]*?)```/g;

const TRAVEL_STAGE_ORDER: readonly TravelField[] = [
  "country",
  "cities",
  "destination_confirmation",
  "departure_date",
  "travel_days",
  "travelers",
  "budget",
  "origin",
  "travel_order",
  "final_note",
] as const;

const DESTINATION_IMAGE_BY_KEY: Record<string, string> = {
  tokyo: "/globe/tokyo.jpg",
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
  dubai:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Burj_Khalifa_from_a_ferry%2C_Dubai.jpg/960px-Burj_Khalifa_from_a_ferry%2C_Dubai.jpg",
  moscow:
    "https://upload.wikimedia.org/wikipedia/commons/5/50/Saint_Basil%27s_Cathedral%2C_Red_Square%2C_Moscow%2C_Russia.jpg",
  bali: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Jimbaran_Bay._Bali_%2815208714849%29.jpg/960px-Jimbaran_Bay._Bali_%2815208714849%29.jpg",
  istanbul:
    "https://upload.wikimedia.org/wikipedia/commons/b/b0/Istanbul_asv2020-02_img45_Hagia_Sophia.jpg",
  melbourne:
    "https://upload.wikimedia.org/wikipedia/commons/2/24/Melbourne_skyline_2008.jpg",
  hawaii:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Waikiki_from_Diamond_Head.jpg/960px-Waikiki_from_Diamond_Head.jpg",
  egypt: "/globe/egypt.jpg",
  japan: "/globe/tokyo.jpg",
  singaporecountry: "/globe/singapore.jpg",
  australia: "/globe/sydney.jpg",
  france: "/globe/paris.jpg",
  unitedkingdom: "/globe/london.jpg",
  unitedstates: "/globe/nyc.jpg",
  china: "/globe/beijing.jpg",
  italy: "/globe/pisa.jpg",
};

const HOTSPOTS_BY_CITY: Record<string, string[]> = {
  tokyo: ["涩谷十字路口", "浅草寺", "东京晴空塔", "筑地场外市场"],
  singapore: ["滨海湾金沙", "滨海湾花园", "牛车水", "圣淘沙"],
  sydney: ["悉尼歌剧院", "邦迪海滩", "岩石区", "达令港"],
  newyork: ["时代广场", "中央公园", "布鲁克林大桥", "苏豪区"],
  paris: ["埃菲尔铁塔", "卢浮宫", "蒙马特", "玛黑区"],
  london: ["科文特花园", "塔桥", "卡姆登", "博罗市场"],
  rome: ["斗兽场", "特莱维喷泉", "特拉斯提弗列", "梵蒂冈博物馆"],
  beijing: ["故宫", "天坛", "颐和园", "慕田峪长城"],
  sanfrancisco: ["金门大桥", "渔人码头", "九曲花街", "联合广场"],
  pisa: ["比萨斜塔", "奇迹广场", "比萨主教座堂", "阿诺河岸"],
  dubai: ["哈利法塔", "迪拜喷泉", "朱美拉海滩", "迪拜老城"],
  moscow: ["红场", "圣瓦西里大教堂", "克里姆林宫", "阿尔巴特街"],
  bali: ["乌鲁瓦图寺", "德格拉朗梯田", "库塔海滩", "乌布猴林"],
  istanbul: ["圣索菲亚大教堂", "蓝色清真寺", "大巴扎", "博斯普鲁斯海峡"],
  melbourne: ["联邦广场", "维多利亚女王市场", "大洋路", "霍西尔巷"],
  hawaii: ["威基基海滩", "钻石山", "珍珠港", "哈雷阿卡拉国家公园"],
};

const FALLBACK_HOTSPOTS = [
  "Old Town",
  "Night Market",
  "Historic Landmark",
  "Local Food Street",
];

const WORLD_CITY_SUGGESTIONS = [
  "Tokyo",
  "Singapore",
  "Sydney",
  "London",
  "Paris",
  "New York",
  "Beijing",
  "San Francisco",
  "Pisa",
  "Dubai",
  "Moscow",
  "Bali",
  "Istanbul",
  "Melbourne",
  "Hawaii",
] as const;

const LOCAL_NAME_BY_KEY: Record<string, string> = {
  japan: "日本",
  unitedarabemirates: "阿联酋",
  uae: "阿联酋",
  russia: "俄罗斯",
  turkey: "土耳其",
  china: "中国",
  singapore: "新加坡",
  australia: "澳大利亚",
  france: "法国",
  italy: "意大利",
  thailand: "泰国",
  indonesia: "印度尼西亚",
  southkorea: "韩国",
  unitedkingdom: "英国",
  unitedstates: "美国",
  malaysia: "马来西亚",
  vietnam: "越南",
  philippines: "菲律宾",
  india: "印度",
  germany: "德国",
  spain: "西班牙",
  switzerland: "瑞士",
  austria: "奥地利",
  greece: "希腊",
  portugal: "葡萄牙",
  europe: "欧洲",
  tokyo: "东京",
  sydney: "悉尼",
  newyork: "纽约",
  nyc: "纽约",
  beijing: "北京",
  sanfrancisco: "旧金山",
  sf: "旧金山",
  pisa: "比萨",
  rome: "罗马",
  paris: "巴黎",
  london: "伦敦",
  dubai: "迪拜",
  moscow: "莫斯科",
  istanbul: "伊斯坦布尔",
  melbourne: "墨尔本",
  hawaii: "夏威夷",
  seoul: "首尔",
  osaka: "大阪",
  kyoto: "京都",
  phuket: "普吉",
  chiangmai: "清迈",
  pattaya: "芭提雅",
  krabi: "甲米",
  bali: "巴厘岛",
  bangkok: "曼谷",
  hongkong: "香港",
  marinabaysands: "滨海湾金沙",
  sydneyoperahouse: "悉尼歌剧院",
  shibuyacrossing: "涩谷十字路口",
  sensojitemple: "浅草寺",
  tokyoskytree: "东京晴空塔",
  tsukijioutermarket: "筑地场外市场",
  gardensbythebay: "滨海湾花园",
  chinatown: "牛车水",
  sentosa: "圣淘沙",
  bondibeach: "邦迪海滩",
  therocks: "岩石区",
  darlingharbour: "达令港",
  eiffeltower: "埃菲尔铁塔",
  louvremuseum: "卢浮宫",
  montmartre: "蒙马特",
  lemarais: "玛黑区",
  coventgarden: "科文特花园",
  towerbridge: "塔桥",
  camdentown: "卡姆登",
  boroughmarket: "博罗市场",
  colosseum: "斗兽场",
  trevifountain: "特莱维喷泉",
  trastevere: "特拉斯提弗列",
  vaticanmuseums: "梵蒂冈博物馆",
  bigben: "大本钟",
};

function normalizePlaceLookupKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

const CANONICAL_PLACE_KEY_ALIASES: Record<string, string> = {
  pattayacity: "pattaya",
  chiangmaicity: "chiangmai",
  phuketcity: "phuket",
  krungthepmahanakhon: "bangkok",
  bangkokmetropolis: "bangkok",
};

const CANONICAL_PLACE_KEY_BY_LOCAL_NAME = Object.entries(
  LOCAL_NAME_BY_KEY
).reduce<Record<string, string>>((lookup, [key, localName]) => {
  const localKey = normalizePlaceLookupKey(localName);
  lookup[localKey] ??= key;
  return lookup;
}, {});

const PLACE_TEXT_REPLACEMENTS = [
  ["South Korea", "韩国"],
  ["United Arab Emirates", "阿联酋"],
  ["United Kingdom", "英国"],
  ["United States", "美国"],
  ["New Zealand", "新西兰"],
  ["Russia", "俄罗斯"],
  ["Turkey", "土耳其"],
  ["China", "中国"],
  ["Japan", "日本"],
  ["Singapore", "新加坡"],
  ["Australia", "澳大利亚"],
  ["France", "法国"],
  ["Italy", "意大利"],
  ["Thailand", "泰国"],
  ["Indonesia", "印度尼西亚"],
  ["Malaysia", "马来西亚"],
  ["Vietnam", "越南"],
  ["Philippines", "菲律宾"],
  ["India", "印度"],
  ["Germany", "德国"],
  ["Spain", "西班牙"],
  ["Switzerland", "瑞士"],
  ["Austria", "奥地利"],
  ["Greece", "希腊"],
  ["Portugal", "葡萄牙"],
  ["Tokyo", "东京"],
  ["Seoul", "首尔"],
  ["Paris", "巴黎"],
  ["Phuket", "普吉"],
  ["Sydney", "悉尼"],
  ["Beijing", "北京"],
  ["Rome", "罗马"],
  ["London", "伦敦"],
  ["Osaka", "大阪"],
  ["Kyoto", "京都"],
  ["Bangkok", "曼谷"],
  ["Chiang Mai", "清迈"],
  ["Pattaya", "芭提雅"],
  ["Krabi", "甲米"],
  ["Bali", "巴厘岛"],
  ["Dubai", "迪拜"],
  ["Moscow", "莫斯科"],
  ["Istanbul", "伊斯坦布尔"],
  ["Melbourne", "墨尔本"],
  ["Hawaii", "夏威夷"],
] as const;

const CITY_CONTEXT: Record<
  string,
  {
    countryEn: string;
    countryZh: string;
    days: string;
    intro: string;
  }
> = {
  tokyo: {
    countryEn: "Japan",
    countryZh: "日本",
    days: "3-5 days",
    intro: "东京融合了潮流街区、传统神社与深夜美食，非常适合第一次日本自由行。",
  },
  kyoto: {
    countryEn: "Japan",
    countryZh: "日本",
    days: "2-4 days",
    intro: "京都适合寺社巡礼、传统街区散步和慢节奏文化体验。",
  },
  osaka: {
    countryEn: "Japan",
    countryZh: "日本",
    days: "2-4 days",
    intro: "大阪美食密集、交通方便，适合把购物、夜景和关西短途串联起来。",
  },
  singapore: {
    countryEn: "Singapore",
    countryZh: "新加坡",
    days: "2-4 days",
    intro: "滨海湾夜景和多元美食非常集中，城市交通高效，适合轻松城市度假。",
  },
  bangkok: {
    countryEn: "Thailand",
    countryZh: "泰国",
    days: "3-5 days",
    intro: "曼谷寺庙、夜市和河岸体验密集，适合把美食、购物和文化景点串起来。",
  },
  phuket: {
    countryEn: "Thailand",
    countryZh: "泰国",
    days: "3-5 days",
    intro: "普吉适合海岛度假、出海和海滩夜生活，节奏可以比城市行程更放松。",
  },
  chiangmai: {
    countryEn: "Thailand",
    countryZh: "泰国",
    days: "2-4 days",
    intro: "清迈适合古城寺庙、咖啡小店和山地自然体验，整体节奏更慢。",
  },
  pattaya: {
    countryEn: "Thailand",
    countryZh: "泰国",
    days: "1-3 days",
    intro: "芭提雅适合海滨短停、夜市和周边岛屿体验，适合从曼谷顺路延伸。",
  },
  krabi: {
    countryEn: "Thailand",
    countryZh: "泰国",
    days: "2-4 days",
    intro: "甲米以石灰岩海岸和跳岛路线为主，适合喜欢自然景观和轻户外的行程。",
  },
  sydney: {
    countryEn: "Australia",
    countryZh: "澳大利亚",
    days: "3-6 days",
    intro: "从歌剧院到海岸线步道，城市与自然结合紧密，适合慢节奏旅行。",
  },
  paris: {
    countryEn: "France",
    countryZh: "法国",
    days: "3-5 days",
    intro: "艺术馆、历史街区与咖啡文化兼具，适合文化体验与城市漫游。",
  },
  london: {
    countryEn: "United Kingdom",
    countryZh: "英国",
    days: "3-5 days",
    intro: "博物馆、音乐剧和经典地标密集，公共交通完善，适合城市探索。",
  },
  rome: {
    countryEn: "Italy",
    countryZh: "意大利",
    days: "3-5 days",
    intro: "古罗马遗迹与美食并存，步行探索体验好，适合历史文化路线。",
  },
  beijing: {
    countryEn: "China",
    countryZh: "中国",
    days: "2-4 days",
    intro: "历史建筑与现代城市共存，景点密度高，适合短途深度游。",
  },
  newyork: {
    countryEn: "United States",
    countryZh: "美国",
    days: "3-5 days",
    intro: "纽约节奏鲜明，博物馆、城市街区和经典天际线密集，适合城市探索。",
  },
  sanfrancisco: {
    countryEn: "United States",
    countryZh: "美国",
    days: "2-4 days",
    intro: "旧金山海湾景观、坡道街区与文化社区集中，适合轻松步行和短途延伸。",
  },
  pisa: {
    countryEn: "Italy",
    countryZh: "意大利",
    days: "1-2 days",
    intro: "比萨适合安排轻量文化停留，经典地标集中，便于衔接托斯卡纳路线。",
  },
  dubai: {
    countryEn: "United Arab Emirates",
    countryZh: "阿联酋",
    days: "2-4 days",
    intro: "迪拜适合城市天际线、沙漠体验和海滨度假组合，节奏现代且选择丰富。",
  },
  moscow: {
    countryEn: "Russia",
    countryZh: "俄罗斯",
    days: "3-5 days",
    intro:
      "莫斯科适合红场、历史建筑和艺术街区路线，城市尺度大，建议按片区安排。",
  },
  bali: {
    countryEn: "Indonesia",
    countryZh: "印度尼西亚",
    days: "4-6 days",
    intro: "巴厘岛适合海滩、梯田、寺庙和度假村体验，适合把放松和轻户外结合。",
  },
  istanbul: {
    countryEn: "Turkey",
    countryZh: "土耳其",
    days: "3-5 days",
    intro:
      "伊斯坦布尔横跨欧亚，清真寺、集市与海峡风景密集，适合文化和美食路线。",
  },
  melbourne: {
    countryEn: "Australia",
    countryZh: "澳大利亚",
    days: "3-5 days",
    intro: "墨尔本适合咖啡街区、艺术巷弄和近郊公路旅行，城市氛围年轻好逛。",
  },
  hawaii: {
    countryEn: "United States",
    countryZh: "美国",
    days: "5-7 days",
    intro: "夏威夷适合海滩、火山、冲浪和自驾路线，适合慢节奏度假和自然景观。",
  },
};

function createMessageId(): string {
  return `travel-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createSessionId(): string {
  return `travel-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createVersionId(): string {
  return `travel-version-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createInitialTravelMessages(
  locale: InterfaceLocale
): TravelChatMessage[] {
  const isZh = locale === "zh";
  return [
    {
      id: createMessageId(),
      role: "assistant",
      parts: [
        {
          type: "text",
          text: isZh ? INITIAL_ASSISTANT_TEXT : INITIAL_ASSISTANT_TEXT_EN,
        },
        {
          type: "quick_replies",
          quick_replies: isZh
            ? INITIAL_QUICK_REPLIES
            : INITIAL_QUICK_REPLIES_EN,
        },
      ],
    },
  ];
}

function createTravelChatSession(locale: InterfaceLocale): TravelChatSession {
  return {
    id: createSessionId(),
    title: locale === "zh" ? "新的旅行对话" : "New travel chat",
    messages: createInitialTravelMessages(locale),
    versions: [],
    updatedAt: new Date().toISOString(),
  };
}

function getTravelChatArchiveKey(applicationId?: string | null): string {
  return `viza:travel-chat:${TRAVEL_CHAT_ARCHIVE_VERSION}:${
    applicationId ?? "standalone"
  }`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isTravelDestinationCard(
  value: unknown
): value is TravelDestinationCard {
  if (!isRecord(value)) return false;

  return (
    value.type === "destination" &&
    typeof value.title === "string" &&
    typeof value.subtitle === "string" &&
    typeof value.country === "string" &&
    isNullableString(value.city) &&
    isNullableString(value.image_key) &&
    isStringArray(value.highlights) &&
    isNullableString(value.suggested_days) &&
    typeof value.action_label === "string" &&
    isRecord(value.payload)
  );
}

function isTravelQuickReply(value: unknown): value is TravelQuickReply {
  return (
    isRecord(value) &&
    typeof value.label === "string" &&
    typeof value.value === "string"
  );
}

function isTravelToolItineraryDay(value: unknown): boolean {
  if (!isRecord(value)) return false;

  return (
    (value.day === undefined ||
      typeof value.day === "number" ||
      typeof value.day === "string") &&
    (value.city === undefined || typeof value.city === "string") &&
    (value.activities === undefined || isStringArray(value.activities)) &&
    (value.food === undefined || isStringArray(value.food)) &&
    (value.cost === undefined || typeof value.cost === "string")
  );
}

function normalizeItineraryDays(value: unknown): ItineraryDay[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const city = typeof item.city === "string" ? item.city.trim() : "";
      if (!city) return null;

      return {
        day:
          typeof item.day === "number" || typeof item.day === "string"
            ? item.day
            : "-",
        city,
        activities: isStringArray(item.activities) ? item.activities : [],
        food: isStringArray(item.food) ? item.food : [],
        cost: typeof item.cost === "string" ? item.cost : "N/A",
      } satisfies ItineraryDay;
    })
    .filter((day): day is ItineraryDay => Boolean(day));
}

function isTravelStateLike(value: unknown): value is TravelState {
  if (!isRecord(value)) return false;

  return (
    Array.isArray(value.countries) &&
    Array.isArray(value.cities) &&
    isRecord(value.city_days) &&
    Array.isArray(value.travel_order) &&
    Array.isArray(value.selected_flights) &&
    Array.isArray(value.selected_hotels) &&
    Array.isArray(value.attached_files)
  );
}

function isTravelTripVersion(value: unknown): value is TravelTripVersion {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.versionNumber === "number" &&
    typeof value.title === "string" &&
    typeof value.createdAt === "string" &&
    isTravelStateLike(value.travelState) &&
    normalizeItineraryDays(value.itinerary).length > 0 &&
    Array.isArray(value.selectedFlights) &&
    Array.isArray(value.selectedHotels)
  );
}

function isTravelChatMessagePart(
  value: unknown
): value is TravelChatMessagePart {
  if (!isRecord(value) || typeof value.type !== "string") return false;

  if (value.type === "text") {
    return typeof value.text === "string";
  }

  if (value.type === "destination_cards") {
    return (
      Array.isArray(value.cards) &&
      value.cards.every((card) => isTravelDestinationCard(card))
    );
  }

  if (value.type === "quick_replies") {
    return (
      Array.isArray(value.quick_replies) &&
      value.quick_replies.every((reply) => isTravelQuickReply(reply))
    );
  }

  if (value.type === "tool-itinerary") {
    return (
      Array.isArray(value.output) &&
      value.output.every((item) => isTravelToolItineraryDay(item))
    );
  }

  return value.type === "planner_form";
}

function isTravelChatMessage(value: unknown): value is TravelChatMessage {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.role === "user" || value.role === "assistant") &&
    Array.isArray(value.parts) &&
    value.parts.every((part) => isTravelChatMessagePart(part))
  );
}

function isTravelChatSession(value: unknown): value is TravelChatSession {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    (value.customTitle === undefined ||
      typeof value.customTitle === "boolean") &&
    (value.activeVersionId === undefined ||
      typeof value.activeVersionId === "string") &&
    (value.versions === undefined ||
      (Array.isArray(value.versions) &&
        value.versions.every((version) => isTravelTripVersion(version)))) &&
    typeof value.updatedAt === "string" &&
    Array.isArray(value.messages) &&
    value.messages.every((message) => isTravelChatMessage(message))
  );
}

function createSessionTitle(messages: TravelChatMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === "user");
  const visibleText = firstUserMessage
    ? getVisibleMessageText(firstUserMessage).replace(/\s+/g, " ").trim()
    : "";

  if (!visibleText) return "新的旅行对话";
  return visibleText.length > 22
    ? `${visibleText.slice(0, 22)}...`
    : visibleText;
}

function createTripVersionTitle(
  itinerary: ItineraryDay[],
  travelState: TravelState
): string {
  const cities =
    travelState.travel_order.length > 0
      ? travelState.travel_order
      : travelState.cities.length > 0
        ? travelState.cities
        : Array.from(new Set(itinerary.map((day) => day.city).filter(Boolean)));
  const prefix = itinerary.length > 0 ? `${itinerary.length}天` : "旅行";
  return `${prefix}${cities.slice(0, 3).join("、") || "定制"}行程`;
}

function createTravelTripVersion(options: {
  itinerary: ItineraryDay[];
  travelState: TravelState;
  versionNumber: number;
  parentVersionId?: string;
  sourceMessageId?: string;
  userPrompt?: string;
  editSummary?: string;
  modulePatch?: Record<string, unknown>;
  createdAt?: string;
}): TravelTripVersion {
  return {
    id: createVersionId(),
    versionNumber: options.versionNumber,
    title: createTripVersionTitle(options.itinerary, options.travelState),
    createdAt: options.createdAt ?? new Date().toISOString(),
    parentVersionId: options.parentVersionId,
    sourceMessageId: options.sourceMessageId,
    userPrompt: options.userPrompt,
    editSummary: options.editSummary,
    travelState: options.travelState,
    itinerary: options.itinerary,
    selectedFlights: options.travelState.selected_flights,
    selectedHotels: options.travelState.selected_hotels,
    modulePatch: options.modulePatch,
  };
}

function getLatestToolItineraryMessageId(
  messages: TravelChatMessage[]
): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (
      message.role === "assistant" &&
      message.parts.some((part) => part.type === "tool-itinerary")
    ) {
      return message.id;
    }
  }

  return undefined;
}

function normalizeTravelChatSession(
  session: TravelChatSession
): TravelChatSession {
  const manualTitle = session.customTitle ? session.title.trim() : "";
  const versions = (session.versions ?? [])
    .filter(isTravelTripVersion)
    .map((version) => ({
      ...version,
      itinerary: normalizeItineraryDays(version.itinerary),
      selectedFlights: version.travelState.selected_flights,
      selectedHotels: version.travelState.selected_hotels,
    }));
  const migratedVersions =
    versions.length > 0
      ? versions
      : (() => {
          const itinerary = getTravelItineraryFromMessages(session.messages);
          if (!itinerary.length) return [];
          const travelState = buildTravelStateFromMessages(
            toChatLikeMessages(session.messages)
          );
          return [
            createTravelTripVersion({
              itinerary,
              travelState,
              versionNumber: 1,
              sourceMessageId: getLatestToolItineraryMessageId(
                session.messages
              ),
              editSummary: "从旧聊天记录自动迁移",
              createdAt: session.updatedAt || new Date().toISOString(),
            }),
          ];
        })();
  const activeVersionId =
    migratedVersions.find((version) => version.id === session.activeVersionId)
      ?.id ?? migratedVersions[migratedVersions.length - 1]?.id;

  return {
    ...session,
    title: manualTitle || createSessionTitle(session.messages),
    customTitle: Boolean(manualTitle),
    activeVersionId,
    versions: migratedVersions,
    updatedAt: session.updatedAt || new Date().toISOString(),
  };
}

function createTravelShareSession(
  payload: TravelItinerarySharePayload
): TravelChatSession {
  return normalizeTravelChatSession({
    id: createSessionId(),
    title: payload.title || "分享行程",
    customTitle: true,
    messages: createTravelShareMessages(payload),
    updatedAt: new Date().toISOString(),
  });
}

function readArchivedTravelSessions(
  storageKey: string,
  locale: InterfaceLocale
): TravelChatSession[] {
  if (typeof window === "undefined") {
    return [createTravelChatSession(locale)];
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [createTravelChatSession(locale)];

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.version !== TRAVEL_CHAT_ARCHIVE_VERSION) {
      return [createTravelChatSession(locale)];
    }

    if (Array.isArray(parsed.sessions)) {
      const sessions = parsed.sessions
        .filter(isTravelChatSession)
        .map(normalizeTravelChatSession);
      return sessions.length > 0 ? sessions : [createTravelChatSession(locale)];
    }

    if (Array.isArray(parsed.messages)) {
      const messages = parsed.messages.filter(isTravelChatMessage);
      return [
        normalizeTravelChatSession({
          id: createSessionId(),
          title: "新的旅行对话",
          messages:
            messages.length > 0
              ? messages
              : createInitialTravelMessages(locale),
          updatedAt:
            typeof parsed.updatedAt === "string"
              ? parsed.updatedAt
              : new Date().toISOString(),
        }),
      ];
    }

    return [createTravelChatSession(locale)];
  } catch {
    return [createTravelChatSession(locale)];
  }
}

function writeArchivedTravelSessions(
  storageKey: string,
  sessions: TravelChatSession[]
): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        version: TRAVEL_CHAT_ARCHIVE_VERSION,
        updatedAt: new Date().toISOString(),
        sessions,
      })
    );
  } catch {
    // Local persistence is a convenience layer; chat remains usable if storage is full.
  }
}

function getMessageText(message: TravelChatMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function stripTravelMarkdown(value: string): string {
  return value
    .replace(TRAVEL_JSON_CODE_BLOCK_PATTERN, "")
    .replace(TRAVEL_MARKDOWN_CODE_BLOCK_PATTERN, (_block, body: string) => {
      const trimmedBody = body.trim();
      return trimmedBody.startsWith("{") || trimmedBody.startsWith("[")
        ? ""
        : trimmedBody;
    })
    .replace(/\[([^]]+)]\(([^)]+)\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/gm, "")
    .replace(/^\s*\|(.+)\|\s*$/gm, (_line, cells: string) =>
      cells
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean)
        .join("，")
    )
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/\s+\|\s+/g, "，")
    .replace(/\s+->\s+/g, " 到 ")
    .replace(/^\s*---+\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getVisibleMessageText(message: TravelChatMessage): string {
  const visibleText = getMessageText(message)
    .replace(/<!--__TRAVEL_FORM__:[\s\S]*?-->/g, "")
    .replace(/<!--__TRAVEL_ITINERY_ROWS__:[\s\S]*?-->/g, "")
    .replace(TRAVEL_JSON_CODE_BLOCK_PATTERN, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return message.role === "assistant"
    ? stripTravelMarkdown(visibleText)
    : visibleText;
}

function toChatLikeMessages(messages: TravelChatMessage[]): ChatLikeMessage[] {
  return messages.map((message) => ({
    role: message.role,
    parts: message.parts
      .filter((part) => part.type === "text")
      .map((part) => ({
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
        food: Array.isArray(day.food)
          ? day.food.map((food) => String(food))
          : [],
        cost: typeof day.cost === "string" ? day.cost : "N/A",
      } satisfies ItineraryDay;
    })
    .filter((day): day is ItineraryDay => Boolean(day && day.city));
}

function parseTravelRevisionResponse(
  raw: unknown,
  fallbackItinerary: ItineraryDay[],
  locale: InterfaceLocale
): TravelRevisionResult {
  if (!isRecord(raw)) {
    throw new Error("行程修改返回格式无效。");
  }

  const rawAction = typeof raw.action === "string" ? raw.action : "";
  const action: TravelRevisionAction =
    rawAction === "revise" || rawAction === "restart" || rawAction === "clarify"
      ? rawAction
      : "clarify";
  const itinerary = normalizeItineraryDays(raw.itinerary);

  if (action === "revise" && itinerary.length === 0) {
    throw new Error("后端返回的修改后行程为空或格式无效。");
  }

  const quickReplies = Array.isArray(raw.quick_replies)
    ? raw.quick_replies.filter(isTravelQuickReply)
    : locale === "zh"
      ? ITINERARY_REVISION_QUICK_REPLIES
      : ITINERARY_REVISION_QUICK_REPLIES_EN;

  return {
    action,
    reply:
      typeof raw.reply === "string" && raw.reply.trim()
        ? localizeTravelText(raw.reply.trim(), locale)
        : action === "restart"
          ? locale === "zh"
            ? "可以，我们保留旧版本，先回到地图重新规划。"
            : "Sure. I’ll keep the old version and restart from the map."
          : locale === "zh"
            ? "我已处理这次行程修改。"
            : "I’ve handled this itinerary change.",
    itinerary: itinerary.length > 0 ? itinerary : fallbackItinerary,
    statePatch: isRecord(raw.state_patch) ? raw.state_patch : {},
    modulePatch: isRecord(raw.module_patch) ? raw.module_patch : {},
    editSummary:
      typeof raw.edit_summary === "string" && raw.edit_summary.trim()
        ? raw.edit_summary.trim()
        : action === "revise"
          ? "已更新行程"
          : "",
    quickReplies:
      quickReplies.length > 0
        ? quickReplies
        : locale === "zh"
          ? ITINERARY_REVISION_QUICK_REPLIES
          : ITINERARY_REVISION_QUICK_REPLIES_EN,
  };
}

function itineraryRevisionSignature(itinerary: ItineraryDay[]): string {
  return JSON.stringify(
    itinerary.map((day) => ({
      day: String(day.day ?? ""),
      city: day.city.trim(),
      activities: day.activities.map((activity) => activity.trim()),
      food: day.food.map((food) => food.trim()),
      cost: day.cost.trim(),
    }))
  );
}

function hasRevisionPatch(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0;
}

function hasVisibleRevisionChange(
  currentItinerary: ItineraryDay[],
  revision: TravelRevisionResult
): boolean {
  if (
    itineraryRevisionSignature(currentItinerary) !==
    itineraryRevisionSignature(revision.itinerary)
  ) {
    return true;
  }

  return (
    hasRevisionPatch(revision.statePatch) ||
    hasRevisionPatch(revision.modulePatch)
  );
}

function applyRevisionPatches(
  baseState: TravelState,
  statePatch: Record<string, unknown>,
  modulePatch: Record<string, unknown>
): TravelState {
  const nextState: TravelState = {
    ...baseState,
    countries: [...baseState.countries],
    cities: [...baseState.cities],
    city_days: { ...baseState.city_days },
    travel_order: [...baseState.travel_order],
    selected_flights: baseState.selected_flights.map((flight) => ({
      ...flight,
    })),
    selected_hotels: baseState.selected_hotels.map((hotel) => ({ ...hotel })),
    attached_files: [...baseState.attached_files],
  };

  if (isStringArray(statePatch.countries)) {
    nextState.countries = statePatch.countries;
    nextState.country = statePatch.countries[0] ?? nextState.country;
  }

  if (isStringArray(statePatch.cities)) {
    nextState.cities = statePatch.cities;
  }

  if (isStringArray(statePatch.travel_order)) {
    nextState.travel_order = statePatch.travel_order;
  }

  if (isRecord(statePatch.city_days)) {
    const cityDays: Record<string, number> = {};
    Object.entries(statePatch.city_days).forEach(([city, value]) => {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) {
        cityDays[city] = Math.round(parsed);
      }
    });
    if (Object.keys(cityDays).length > 0) {
      nextState.city_days = cityDays;
    }
  }

  if (typeof statePatch.final_note === "string") {
    nextState.final_note = statePatch.final_note;
  }

  if (
    typeof statePatch.travel_days === "number" &&
    statePatch.travel_days > 0
  ) {
    nextState.travel_days = Math.round(statePatch.travel_days);
  }

  if (typeof statePatch.budget === "number" && statePatch.budget > 0) {
    nextState.budget = Math.round(statePatch.budget);
  }

  const shouldRemoveFlights =
    modulePatch.remove_flights === true ||
    modulePatch.flight_policy === "skip_all";
  if (shouldRemoveFlights) {
    nextState.selected_flights = nextState.selected_flights.map((flight) => ({
      ...flight,
      skip: true,
      option: null,
      option_index: undefined,
    }));
  }

  return nextState;
}

function revisionRemovesFlights(
  modulePatch?: Record<string, unknown>
): boolean {
  return (
    modulePatch?.remove_flights === true ||
    modulePatch?.flight_policy === "skip_all"
  );
}

function revisionPrefersFourStarHotels(
  modulePatch?: Record<string, unknown>
): boolean {
  return (
    typeof modulePatch?.hotel_note === "string" &&
    /4星|四星|four.?star|4.?star/i.test(modulePatch.hotel_note)
  );
}

function formatSelectedFlights(
  flights: SelectedFlightOption[],
  modulePatch?: Record<string, unknown>,
  locale: InterfaceLocale = "zh"
): string {
  const isZh = locale === "zh";
  if (revisionRemovesFlights(modulePatch)) {
    return isZh
      ? "已按你的要求减少或移除航班，itinerary 表格中不会再自动补默认航班。"
      : "I reduced or removed flights as requested, so the itinerary table will not auto-fill default flights.";
  }

  if (!flights.length) {
    return isZh
      ? "默认航班会在行程表格中生成，可直接编辑航司、时间、价格和航班号。"
      : "Default flight rows will be generated in the itinerary table, and you can edit airline, time, price, and flight number.";
  }

  return flights
    .map((flight) => {
      if (flight.skip) {
        return isZh
          ? `路线 ${flight.leg_index}：${flight.from} 到 ${flight.to}。`
          : `Leg ${flight.leg_index}: ${flight.from} to ${flight.to}.`;
      }

      const option = flight.option;
      const airline =
        option?.airline ?? (isZh ? "未命名航司" : "Unnamed airline");
      const price = option?.price
        ? `${option.price} ${option.currency ?? "CNY"}`
        : isZh
          ? "价格未知"
          : "price unknown";
      const flightNumber = option?.flight_number
        ? isZh
          ? `，航班号 ${option.flight_number}`
          : `, flight ${option.flight_number}`
        : "";

      return isZh
        ? `路线 ${flight.leg_index}：${flight.from} 到 ${flight.to}，${airline}，${price}${flightNumber}。`
        : `Leg ${flight.leg_index}: ${flight.from} to ${flight.to}, ${airline}, ${price}${flightNumber}.`;
    })
    .join("\n");
}

function formatSelectedHotels(
  hotels: SelectedHotelOption[],
  modulePatch?: Record<string, unknown>,
  locale: InterfaceLocale = "zh"
): string {
  const isZh = locale === "zh";
  const fourStarNote = revisionPrefersFourStarHotels(modulePatch)
    ? isZh
      ? "已应用 4 星酒店偏好；"
      : "Applied the 4-star hotel preference; "
    : "";

  if (!hotels.length) {
    return isZh
      ? `${fourStarNote}默认酒店会在行程表格中生成，可直接编辑酒店名、地址、价格和联系方式。`
      : `${fourStarNote}default hotel rows will be generated in the itinerary table, and you can edit hotel name, address, price, and contact details.`;
  }

  return hotels
    .map((hotel) => {
      const option = hotel.option;
      const name = option?.name ?? (isZh ? "未命名酒店" : "Unnamed hotel");
      const price = option?.price_per_night
        ? `${option.price_per_night} ${option.currency ?? "CNY"}${isZh ? "/晚" : "/night"}`
        : isZh
          ? "价格未知"
          : "price unknown";
      const rating =
        option?.rating !== undefined && option?.rating !== null
          ? isZh
            ? `评分 ${option.rating}`
            : `rating ${option.rating}`
          : isZh
            ? "暂无评分"
            : "no rating yet";
      const address = option?.address
        ? isZh
          ? `，地址 ${option.address}`
          : `, address ${option.address}`
        : "";
      const contact = option?.contact_phone
        ? isZh
          ? `，电话 ${option.contact_phone}`
          : `, phone ${option.contact_phone}`
        : "";

      return isZh
        ? `城市 ${hotel.stay_index}：${hotel.city}，${hotel.check_in} 到 ${hotel.check_out}，${hotel.nights} 晚，${fourStarNote}${name}，${price}，${rating}${address}${contact}。`
        : `City ${hotel.stay_index}: ${hotel.city}, ${hotel.check_in} to ${hotel.check_out}, ${hotel.nights} nights, ${fourStarNote}${name}, ${price}, ${rating}${address}${contact}.`;
    })
    .join("\n");
}

function createItineraryAssistantMessage(options: {
  itinerary: ItineraryDay[];
  selectedFlights: SelectedFlightOption[];
  selectedHotels: SelectedHotelOption[];
  intro?: string;
  modulePatch?: Record<string, unknown>;
  quickReplies?: TravelQuickReply[];
  locale: InterfaceLocale;
}): TravelChatMessage {
  const intro =
    options.intro?.trim() ||
    (options.locale === "zh"
      ? "行程已经生成，我已经把每天安排整理到行程卡片里。"
      : "Your itinerary is ready. I organized each day into itinerary cards.");
  const content =
    `${intro}\n\n` +
    `${options.locale === "zh" ? "路线节点" : "Route nodes"}：\n${formatSelectedFlights(
      options.selectedFlights,
      options.modulePatch,
      options.locale
    )}\n\n` +
    `${options.locale === "zh" ? "已选酒店" : "Selected hotels"}：\n${formatSelectedHotels(
      options.selectedHotels,
      options.modulePatch,
      options.locale
    )}`;

  return {
    id: createMessageId(),
    role: "assistant",
    parts: [
      { type: "text", text: content },
      { type: "tool-itinerary", output: options.itinerary },
      ...(options.quickReplies?.length
        ? [
            {
              type: "quick_replies" as const,
              quick_replies: options.quickReplies,
            },
          ]
        : []),
    ],
  };
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isStructuredTravelFormText(text: string): boolean {
  return text.includes(FORM_PAYLOAD_PREFIX);
}

function appendHiddenTravelFormPayload(
  text: string,
  payload: Record<string, unknown>
): string {
  return `${text.trim()}\n\n<!--${FORM_PAYLOAD_PREFIX}${JSON.stringify(payload)}-->`;
}

function withLatestUserResetPayload(
  messages: TravelChatMessage[]
): TravelChatMessage[] {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "user") continue;

    return messages.map((item, itemIndex) => {
      if (itemIndex !== index) return item;

      let resetAttached = false;
      return {
        ...item,
        parts: item.parts.map((part) => {
          if (part.type !== "text" || resetAttached) return part;
          resetAttached = true;
          return {
            ...part,
            text: appendHiddenTravelFormPayload(part.text, { reset: true }),
          };
        }),
      };
    });
  }

  return messages;
}

function toAgentChatMessages(messages: TravelChatMessage[]) {
  return messages
    .map((message) => ({
      role: message.role,
      content: getMessageText(message),
    }))
    .filter((message) => message.content);
}

function createAssistantMessageFromAgentResponse(
  response: TravelAgentChatResponse,
  locale: InterfaceLocale
): TravelChatMessage {
  const parts: TravelChatMessage["parts"] = [];
  const reply = response.reply?.trim();

  if (reply) {
    parts.push({ type: "text", text: localizeTravelText(reply, locale) });
  }

  if (response.cards?.length) {
    parts.push({ type: "destination_cards", cards: response.cards });
  }

  if (response.quick_replies?.length) {
    parts.push({
      type: "quick_replies",
      quick_replies: response.quick_replies.map((reply) => ({
        ...reply,
        label: localizeTravelText(reply.label, locale),
        value: localizeTravelText(reply.value, locale),
      })),
    });
  }

  return {
    id: createMessageId(),
    role: "assistant",
    parts: parts.length
      ? parts
      : [{ type: "text", text: "我在，想从哪里开始规划？" }],
  };
}

function normalizeCandidateString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function normalizeCandidateStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return normalized.length ? Array.from(new Set(normalized)) : undefined;
}

function coerceTravelIpLocation(raw: unknown): TravelIpLocation | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const country =
    typeof record.country === "string" ? record.country.trim() : "";
  const city = typeof record.city === "string" ? record.city.trim() : "";
  if (!country || !city) return null;

  return {
    country,
    city,
    countryCode:
      typeof record.countryCode === "string"
        ? record.countryCode.trim()
        : undefined,
    source:
      typeof record.source === "string" ? record.source.trim() : undefined,
  };
}

function coerceTravelFormCandidatePayload(
  payload: Record<string, unknown>
): TravelFormCandidatePayload {
  const result: TravelFormCandidatePayload = {};
  const seedCountry = normalizeCandidateString(payload.seed_country);
  const seedCity = normalizeCandidateString(payload.seed_city);
  const country = normalizeCandidateString(payload.country);
  const countries = normalizeCandidateStringArray(payload.countries);
  const cities = normalizeCandidateStringArray(payload.cities);

  if (seedCountry) {
    result.seed_country = seedCountry;
    if (seedCity) {
      result.seed_city = seedCity;
    }
  }

  if (seedCity) result.seed_city = seedCity;
  if (country) result.country = country;

  const normalizedCountries =
    countries ?? (seedCountry ? [seedCountry] : undefined);
  if (normalizedCountries) {
    result.countries = normalizedCountries;
    if (!result.country) {
      result.country = normalizedCountries.join("、");
    }
  }

  const normalizedCities = cities ?? (seedCity ? [seedCity] : undefined);
  if (normalizedCities) {
    result.cities = normalizedCities;
    if (normalizedCities.length === 1) {
      result.travel_order = normalizedCities;
    }
  }

  return result;
}

function withLocalCandidateDisplay(
  payload: TravelFormCandidatePayload
): TravelFormCandidatePayload {
  const display: TravelFormCandidatePayload["display"] = {};

  if (payload.seed_country) {
    display.seed_country = getLocalDisplayName(payload.seed_country);
  }
  if (payload.seed_city) {
    display.seed_city = getLocalDisplayName(payload.seed_city);
  }
  if (payload.country) {
    display.country = getLocalDisplayName(payload.country);
  }
  if (payload.countries?.length) {
    display.countries = payload.countries.map(getLocalDisplayName);
  }
  if (payload.cities?.length) {
    display.cities = payload.cities.map(getLocalDisplayName);
    display.city_labels = Object.fromEntries(
      payload.cities.map((city) => [city, getLocalDisplayName(city)])
    );
  }
  if (payload.travel_order?.length) {
    display.travel_order = payload.travel_order.map(getLocalDisplayName);
  }

  return Object.keys(display).length > 0 ? { ...payload, display } : payload;
}

function normalizeCityKey(city: string): string {
  const key = normalizePlaceLookupKey(city);
  return (
    CANONICAL_PLACE_KEY_BY_LOCAL_NAME[key] ??
    CANONICAL_PLACE_KEY_ALIASES[key] ??
    key
  );
}

function getLocalDisplayName(value: string): string {
  const key = normalizeCityKey(value);
  return LOCAL_NAME_BY_KEY[key] ?? value;
}

function appendUniquePlaces(
  values: string[],
  additions: Array<string | undefined>
): string[] {
  const result = values.filter((value) => value.trim());
  const seen = new Set(result.map((value) => normalizeCityKey(value)));

  additions.forEach((addition) => {
    const value = addition?.trim();
    if (!value) return;

    const key = normalizeCityKey(value);
    if (seen.has(key)) return;

    seen.add(key);
    result.push(value);
  });

  return result;
}

function createDestinationAppendPayload(
  state: TravelState,
  destination: {
    country?: string;
    countries?: string[];
    city?: string;
    cities?: string[];
    includeCityDays?: boolean;
    defaultCityDays?: number;
  }
): TravelFormCandidatePayload | null {
  const existingCountries =
    state.countries.length > 0
      ? state.countries
      : state.country
        ? [state.country]
        : state.seed_country
          ? [state.seed_country]
          : [];
  const existingCities =
    state.cities.length > 0
      ? state.cities
      : state.seed_city
        ? [state.seed_city]
        : [];
  const targetCountries = [
    ...(destination.countries ?? []),
    destination.country,
  ];
  const targetCities = [...(destination.cities ?? []), destination.city];
  const nextCountries = appendUniquePlaces(existingCountries, targetCountries);
  const nextCities = appendUniquePlaces(existingCities, targetCities);
  const countryChanged = nextCountries.length !== existingCountries.length;
  const cityChanged = nextCities.length !== existingCities.length;

  if (!countryChanged && !cityChanged) return null;

  const nextOrder = state.travel_order.length
    ? appendUniquePlaces(
        state.travel_order.filter((city) =>
          nextCities.some(
            (nextCity) => normalizeCityKey(nextCity) === normalizeCityKey(city)
          )
        ),
        targetCities
      )
    : [];
  const payload: TravelFormCandidatePayload = {
    country: nextCountries.length > 0 ? nextCountries.join("、") : undefined,
    countries: nextCountries,
    cities: nextCities,
    travel_order:
      nextOrder.length === nextCities.length ? nextOrder : undefined,
  };

  if (destination.includeCityDays) {
    const nextCityDays = { ...state.city_days };
    targetCities.forEach((city) => {
      const value = city?.trim();
      if (!value) return;
      nextCityDays[value] ??= destination.defaultCityDays ?? 2;
    });
    if (Object.keys(nextCityDays).length > 0) {
      payload.city_days = nextCityDays;
    }
  }

  return withLocalCandidateDisplay(payload);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function localizeTravelText(value: string, locale: InterfaceLocale): string {
  if (locale === "en") return stripTravelMarkdown(value);

  const localized = PLACE_TEXT_REPLACEMENTS.reduce((text, [source, target]) => {
    const pattern = new RegExp(`\\b${escapeRegExp(source)}\\b`, "g");
    return text.replace(pattern, target);
  }, value).replace(/\b(\d+(?:-\d+)?)\s*days\b/gi, "$1 天");

  return stripTravelMarkdown(localized);
}

function localizeSuggestedDays(
  value: string | null | undefined,
  locale: InterfaceLocale
): string {
  if (!value) return locale === "zh" ? "3-5 天" : "3-5 days";
  return localizeTravelText(value, locale);
}

function getCityContext(city: string) {
  const key = normalizeCityKey(city);
  return CITY_CONTEXT[key] ?? null;
}

function buildMapIntro(
  kind: MapTarget["kind"],
  label: string,
  city?: string
): string {
  const context = city ? getCityContext(city) : null;
  if (kind === "hotel") {
    const cityName = city ? getLocalDisplayName(city) : "目的地";
    return `酒店位置已加入路线。建议优先选择靠近交通枢纽或核心景区的住宿，便于压缩通勤时间。${cityName}可按预算分区筛选。`;
  }

  if (kind === "hotspot") {
    const cityName = city ? getLocalDisplayName(city) : "当地";
    return `${cityName}热门景点：${label}。建议错峰前往，优先安排在白天与傍晚两个黄金时段，拍照和步行体验更好。`;
  }

  if (kind === "city") {
    if (context) return context.intro;
    return `${label}是这条路线中的关键停靠城市，可围绕地标、街区步行和本地美食构建 1-3 天节奏。`;
  }

  return `${label}路线总览。建议把同区域景点聚在同一天，减少折返，提高游玩效率。`;
}

function formatMapTargetDisplayName(
  target: MapTarget | null | undefined,
  isZh: boolean
): string {
  if (!target) return isZh ? "旅行地图" : "Travel map";
  const label = getLocalDisplayName(target.label);
  if (!target.localName || target.localName === label) return label;
  return `${label} · ${target.localName}`;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getRemoteCityImage(city: string): string {
  const cityTag = encodeURIComponent(city.trim() || "travel");
  const lock = (hashString(cityTag) % 7000) + 1000;
  return `https://loremflickr.com/640/420/${cityTag},city,landmark,travel?lock=${lock}`;
}

function getCityImage(city: string, seed: string = "default"): string {
  const key = normalizeCityKey(city);
  const direct = DESTINATION_IMAGE_BY_KEY[key];
  if (direct) return direct;

  const seedKey = normalizeCityKey(seed);
  const seedDirect = DESTINATION_IMAGE_BY_KEY[seedKey];
  if (seedDirect) return seedDirect;

  return getRemoteCityImage(city);
}

function getGoogleCityCoordinates(
  city: string,
  lookup: Record<string, GoogleGeocodeCoordinate>
): [number, number] | null {
  const key = normalizeCityKey(city);
  return getGoogleCoordinateByKey(key, lookup);
}

function getGoogleCoordinateByKey(
  key: string,
  lookup: Record<string, GoogleGeocodeCoordinate>
): [number, number] | null {
  const coordinate = lookup[key];
  if (!coordinate) return null;
  return [coordinate.lat, coordinate.lng];
}

function buildGoogleGeocodeItem(city: string): GoogleGeocodeRequestItem | null {
  const trimmedCity = city.trim();
  if (!trimmedCity) return null;

  const key = normalizeCityKey(trimmedCity);
  const localName = getLocalDisplayName(trimmedCity);
  const context = getCityContext(trimmedCity);
  const query = context
    ? `${localName}, ${context.countryZh}`
    : localName !== trimmedCity
      ? `${localName}, ${trimmedCity}`
      : trimmedCity;

  return { key, query };
}

function getHotspotGeocodeKey(city: string, hotspot: string): string {
  return `${normalizeCityKey(city)}:${normalizePlaceLookupKey(hotspot)}`;
}

function buildGoogleHotspotGeocodeItem(
  city: string,
  hotspot: string
): GoogleGeocodeRequestItem | null {
  const trimmedCity = city.trim();
  const trimmedHotspot = hotspot.trim();
  if (!trimmedCity || !trimmedHotspot) return null;

  const cityName = getLocalDisplayName(trimmedCity);
  const hotspotName = getLocalDisplayName(trimmedHotspot);
  const context = getCityContext(trimmedCity);
  const query = context
    ? `${hotspotName}, ${cityName}, ${context.countryZh}`
    : `${hotspotName}, ${cityName}`;

  return {
    key: getHotspotGeocodeKey(trimmedCity, trimmedHotspot),
    query,
  };
}

function buildRouteCityNames(
  originCity: string | null,
  orderedCities: string[],
  returnCity: string | null
): string[] {
  if (orderedCities.length === 0) return [];

  const routeCities: string[] = [];
  const origin = originCity?.trim();
  const destination = returnCity?.trim();

  if (origin) routeCities.push(origin);
  routeCities.push(...orderedCities);
  if (destination && routeCities[routeCities.length - 1] !== destination) {
    routeCities.push(destination);
  }

  return routeCities;
}

function buildGoogleRouteCoordinates(
  routeCities: string[],
  lookup: Record<string, GoogleGeocodeCoordinate>
): Array<[number, number]> {
  const coordinates = routeCities
    .map((city) => getGoogleCityCoordinates(city, lookup))
    .filter((coordinate): coordinate is [number, number] =>
      Boolean(coordinate)
    );

  return coordinates.length === routeCities.length ? coordinates : [];
}

function withOffset(
  center: [number, number],
  seed: string,
  amplitude: number = 0.22
): [number, number] {
  const value = hashString(seed);
  const angle = (value % 360) * (Math.PI / 180);
  const radius = ((value % 100) / 100) * amplitude + 0.06;
  const lat = center[0] + Math.sin(angle) * radius;
  const lng = center[1] + Math.cos(angle) * radius;
  return [lat, lng];
}

function toCoordinate(value: string | number | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getHotspotsForCity(city: string): string[] {
  const key = normalizeCityKey(city);
  const matched = HOTSPOTS_BY_CITY[key];
  if (matched && matched.length) return matched;
  return FALLBACK_HOTSPOTS;
}

function buildProgressItems(
  progressPercent: number,
  state: ReturnType<typeof buildTravelStateFromMessages>,
  isZh: boolean
): ProgressItem[] {
  return [
    {
      id: "destinations",
      label: isZh ? "目的地" : "Destinations",
      done: state.cities.length > 0,
      detail: state.cities.length
        ? isZh
          ? `已选 ${state.cities.length} 个城市`
          : `${state.cities.length} cities selected`
        : isZh
          ? "等待中"
          : "Waiting",
    },
    {
      id: "dates",
      label: isZh ? "日期天数" : "Dates and length",
      done: Boolean(state.departure_date && state.travel_days),
      detail:
        state.departure_date && state.travel_days
          ? `${state.date_flexibility === "flexible" ? (isZh ? "灵活出行" : "Flexible dates") : isZh ? "指定日期" : "Fixed date"} · ${state.departure_date} · ${state.travel_days} ${isZh ? "天" : "days"}`
          : isZh
            ? "等待中"
            : "Waiting",
    },
    {
      id: "transport",
      label: isZh ? "路线顺序" : "Route order",
      done:
        state.cities.length > 0 &&
        state.travel_order.length === state.cities.length,
      detail:
        state.cities.length > 0 &&
        state.travel_order.length === state.cities.length
          ? isZh
            ? `已连接 ${state.travel_order.length} 站`
            : `${state.travel_order.length} stops connected`
          : isZh
            ? "等待中"
            : "Waiting",
    },
    {
      id: "stay",
      label: isZh ? "航班酒店" : "Flights and hotels",
      done: Boolean(
        state.origin_city && state.return_city && state.cities.length
      ),
      detail:
        state.origin_city && state.return_city && state.cities.length
          ? isZh
            ? "已生成默认项，可在 itinerary 编辑"
            : "Defaults generated; editable in the itinerary"
          : isZh
            ? "等待中"
            : "Waiting",
    },
    {
      id: "final",
      label: isZh ? "整体进度" : "Overall progress",
      done: progressPercent >= 100,
      detail: isZh
        ? `完成 ${progressPercent}%`
        : `${progressPercent}% complete`,
    },
  ];
}

export function TravelChatClient({
  applicationId,
  embedded = false,
}: TravelChatClientProps) {
  const locale = useLocale();
  const interfaceLocale = isChineseLocale(locale) ? "zh" : "en";
  const isZh = interfaceLocale === "zh";
  const travelAgentLocale = toTravelAgentLocale(locale);
  const archiveKey = useMemo(
    () => getTravelChatArchiveKey(applicationId),
    [applicationId]
  );
  const [sessions, setSessions] = useState<TravelChatSession[]>(() => [
    createTravelChatSession(interfaceLocale),
  ]);
  const sessionsRef = useRef<TravelChatSession[]>(sessions);
  const [activeSessionId, setActiveSessionId] = useState(() => sessions[0].id);
  const [archiveLoadedKey, setArchiveLoadedKey] = useState<string | null>(null);
  const [status, setStatus] = useState<TravelChatStatus>("ready");
  const [activeMapTargetId, setActiveMapTargetId] = useState<string>("");
  const [sessionsPanelOpen, setSessionsPanelOpen] = useState(false);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(
    null
  );
  const [renamingSessionTitle, setRenamingSessionTitle] = useState("");
  const [mapModeSessionIds, setMapModeSessionIds] = useState<string[]>([]);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [prefetchedIpLocation, setPrefetchedIpLocation] =
    useState<TravelIpLocation | null>(null);
  const [prefetchedIpLocationError, setPrefetchedIpLocationError] = useState<
    string | null
  >(null);
  const [isPrefetchingIpLocation, setIsPrefetchingIpLocation] = useState(false);
  const [googleCityCoordinates, setGoogleCityCoordinates] = useState<
    Record<string, GoogleGeocodeCoordinate>
  >({});
  const messageScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollRailRef = useRef<HTMLDivElement | null>(null);
  const scrollDragOffsetRef = useRef(0);
  const lastAutoScrolledMessageIdRef = useRef<string | null>(null);
  const selectedCityFocusKeyRef = useRef("");
  const failedGeocodeKeysRef = useRef<Set<string>>(new Set());
  const [scrollThumb, setScrollThumb] = useState<ScrollThumbState>({
    top: 0,
    height: 0,
    visible: false,
  });

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const activeSession = useMemo(
    () =>
      sessions.find((session) => session.id === activeSessionId) ?? sessions[0],
    [activeSessionId, sessions]
  );
  const messages = activeSession?.messages ?? EMPTY_TRAVEL_MESSAGES;

  const updateTravelSession = useCallback(
    (
      sessionId: string,
      updater: (session: TravelChatSession) => TravelChatSession
    ) => {
      setSessions((currentSessions) => {
        const nextSessions = currentSessions.map((session) => {
          if (session.id !== sessionId) return session;
          return normalizeTravelChatSession(updater(session));
        });
        sessionsRef.current = nextSessions;
        return nextSessions;
      });
    },
    []
  );

  const setSessionMessages = useCallback(
    (
      sessionId: string,
      next:
        | TravelChatMessage[]
        | ((current: TravelChatMessage[]) => TravelChatMessage[])
    ) => {
      updateTravelSession(sessionId, (session) => {
        const nextMessages =
          typeof next === "function" ? next(session.messages) : next;
        return {
          ...session,
          messages: nextMessages,
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateTravelSession]
  );

  const travelState = useMemo(
    () => buildTravelStateFromMessages(toChatLikeMessages(messages)),
    [messages]
  );
  const latestItinerary = useMemo(
    () => getTravelItineraryFromMessages(messages),
    [messages]
  );
  const sharedItineryRows = useMemo(
    () => getTravelItineryRowsFromMessages(messages),
    [messages]
  );
  const activeTravelVersion = useMemo(() => {
    const versions = activeSession?.versions ?? [];
    return (
      versions.find(
        (version) => version.id === activeSession?.activeVersionId
      ) ??
      versions[versions.length - 1] ??
      null
    );
  }, [activeSession?.activeVersionId, activeSession?.versions]);
  const displayItinerary = activeTravelVersion?.itinerary ?? latestItinerary;
  const displayTravelState = activeTravelVersion?.travelState ?? travelState;
  const missingField = useMemo(
    () => nextMissingField(travelState),
    [travelState]
  );
  const hasDestinationSelection = useMemo(() => {
    const hasCountry =
      travelState.countries.length > 0 || Boolean(travelState.country);
    const hasCities = travelState.cities.length > 0;

    return hasCountry && hasCities;
  }, [
    travelState.cities.length,
    travelState.countries.length,
    travelState.country,
  ]);
  const canAddDestinationFromMap = status === "ready";

  const stageIndex = useMemo(() => {
    if (!missingField) return TRAVEL_STAGE_ORDER.length;
    const index = TRAVEL_STAGE_ORDER.indexOf(missingField);
    return index < 0 ? 0 : index;
  }, [missingField]);

  const progressPercent = useMemo(
    () => Math.round((stageIndex / TRAVEL_STAGE_ORDER.length) * 100),
    [stageIndex]
  );
  const orderedCities = useMemo(() => {
    const order = travelState.travel_order.filter((city) =>
      travelState.cities.includes(city)
    );
    return order.length === travelState.cities.length
      ? order
      : travelState.cities;
  }, [travelState.cities, travelState.travel_order]);
  const displayOrderedCities = useMemo(() => {
    const order = displayTravelState.travel_order.filter((city) =>
      displayTravelState.cities.includes(city)
    );
    return order.length === displayTravelState.cities.length
      ? order
      : displayTravelState.cities;
  }, [displayTravelState.cities, displayTravelState.travel_order]);
  const selectedCityFocusKey = useMemo(
    () => travelState.cities.map((city) => normalizeCityKey(city)).join("|"),
    [travelState.cities]
  );
  const routeCityNames = useMemo(
    () =>
      buildRouteCityNames(
        travelState.origin_city,
        orderedCities,
        travelState.return_city
      ),
    [orderedCities, travelState.origin_city, travelState.return_city]
  );
  const displayItineraryRouteCityNames = useMemo(
    () =>
      buildRouteCityNames(
        displayTravelState.origin_city,
        displayOrderedCities,
        displayTravelState.return_city
      ),
    [
      displayOrderedCities,
      displayTravelState.origin_city,
      displayTravelState.return_city,
    ]
  );
  const googleGeocodeItems = useMemo(() => {
    const itemByKey = new Map<string, GoogleGeocodeRequestItem>();
    const addItem = (item: GoogleGeocodeRequestItem | null) => {
      if (!item) return;
      itemByKey.set(item.key, item);
    };
    const addCity = (city: string | null | undefined) => {
      const trimmedCity = city?.trim();
      if (!trimmedCity) return;
      addItem(buildGoogleGeocodeItem(trimmedCity));
    };
    const addHotspotsForCity = (city: string | null | undefined) => {
      const trimmedCity = city?.trim();
      if (!trimmedCity) return;
      getHotspotsForCity(trimmedCity).forEach((hotspot) => {
        addItem(buildGoogleHotspotGeocodeItem(trimmedCity, hotspot));
      });
    };

    WORLD_CITY_SUGGESTIONS.forEach(addCity);
    routeCityNames.forEach(addCity);
    displayItineraryRouteCityNames.forEach(addCity);
    orderedCities.forEach(addCity);
    displayOrderedCities.forEach(addCity);
    travelState.selected_hotels.forEach((hotel) => addCity(hotel.city));
    displayTravelState.selected_hotels.forEach((hotel) => addCity(hotel.city));
    orderedCities.forEach(addHotspotsForCity);
    displayOrderedCities.forEach(addHotspotsForCity);

    return Array.from(itemByKey.values());
  }, [
    displayItineraryRouteCityNames,
    displayOrderedCities,
    orderedCities,
    routeCityNames,
    travelState.selected_hotels,
    displayTravelState.selected_hotels,
  ]);

  const progressItems = useMemo(
    () => buildProgressItems(progressPercent, travelState, isZh),
    [isZh, progressPercent, travelState]
  );
  const completedProgressCount = useMemo(
    () => progressItems.filter((item) => item.done).length,
    [progressItems]
  );

  useEffect(() => {
    const pendingItems = googleGeocodeItems.filter((item) => {
      if (googleCityCoordinates[item.key]) return false;
      return !failedGeocodeKeysRef.current.has(item.key);
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
            failedGeocodeKeysRef.current.add(item.key)
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

          failedGeocodeKeysRef.current.add(result.key);
        });

        if (!disposed && Object.keys(nextCoordinates).length > 0) {
          setGoogleCityCoordinates((current) => ({
            ...current,
            ...nextCoordinates,
          }));
        }
      } catch {
        pendingItems.forEach((item) =>
          failedGeocodeKeysRef.current.add(item.key)
        );
      }
    })();

    return () => {
      disposed = true;
    };
  }, [googleGeocodeItems, googleCityCoordinates]);

  const routeCoordinates = useMemo(
    () => buildGoogleRouteCoordinates(routeCityNames, googleCityCoordinates),
    [googleCityCoordinates, routeCityNames]
  );

  const shouldShowRouteLine = useMemo(() => {
    if (orderedCities.length <= 1) return false;
    const confirmedOrder = travelState.travel_order.filter((city) =>
      orderedCities.includes(city)
    );
    return confirmedOrder.length === orderedCities.length;
  }, [orderedCities, travelState.travel_order]);

  const displayRouteCoordinates = useMemo<Array<[number, number]>>(
    () => (shouldShowRouteLine ? routeCoordinates : []),
    [routeCoordinates, shouldShowRouteLine]
  );
  const displayItineraryRouteCoordinates = useMemo(
    () =>
      buildGoogleRouteCoordinates(
        displayItineraryRouteCityNames,
        googleCityCoordinates
      ),
    [displayItineraryRouteCityNames, googleCityCoordinates]
  );

  const selectedCityKeys = useMemo(
    () => new Set(orderedCities.map((city) => normalizeCityKey(city))),
    [orderedCities]
  );

  const citySuggestionTargets = useMemo<MapTarget[]>(() => {
    const targets: MapTarget[] = [];
    WORLD_CITY_SUGGESTIONS.filter(
      (city) => !selectedCityKeys.has(normalizeCityKey(city))
    ).forEach((city, index) => {
      const coordinate = getGoogleCityCoordinates(city, googleCityCoordinates);
      if (!coordinate) return;
      const [lat, lng] = coordinate;
      const context = getCityContext(city);
      targets.push({
        id: `city-suggestion-${normalizeCityKey(city)}`,
        kind: "city",
        label: city,
        subtitle: "城市候选",
        localName: getLocalDisplayName(city),
        intro: buildMapIntro("city", city, city),
        countryLabel: context
          ? `${context.countryZh} (${context.countryEn})`
          : undefined,
        recommendedDays: context?.days,
        imageSrc: getCityImage(city, `city-suggestion-${index}`),
        lat,
        lng,
        city,
      });
    });
    return targets;
  }, [googleCityCoordinates, selectedCityKeys]);

  const baseMapTargets = useMemo(() => {
    const targets: MapTarget[] = [];

    if (displayRouteCoordinates.length >= 2) {
      const originLabel =
        travelState.origin_city?.trim() || orderedCities[0] || "Origin";
      const returnLabel =
        travelState.return_city?.trim() ||
        orderedCities[orderedCities.length - 1] ||
        "Destination";
      const [routeStartLat, routeStartLng] = displayRouteCoordinates[0];
      targets.push({
        id: "route-overview",
        kind: "route",
        label: "Route Overview",
        subtitle: `${originLabel} → ${returnLabel}`,
        localName: `${getLocalDisplayName(originLabel)} → ${getLocalDisplayName(returnLabel)}`,
        intro: buildMapIntro("route", "Route Overview", orderedCities[0]),
        imageSrc: getCityImage(originLabel, "route"),
        lat: routeStartLat,
        lng: routeStartLng,
        city: orderedCities[0],
      });
    }

    orderedCities.forEach((city, index) => {
      const days = travelState.city_days[city];
      const coordinate = getGoogleCityCoordinates(city, googleCityCoordinates);
      if (!coordinate) return;
      const [lat, lng] = coordinate;
      const context = getCityContext(city);
      targets.push({
        id: `city-${normalizeCityKey(city)}-${index}`,
        kind: "city",
        label: city,
        subtitle: days ? `${days} days stay` : "Destination selected",
        localName: getLocalDisplayName(city),
        intro: buildMapIntro("city", city, city),
        countryLabel: context
          ? `${context.countryZh} (${context.countryEn})`
          : undefined,
        recommendedDays: context?.days ?? undefined,
        imageSrc: getCityImage(city, `city-${index}`),
        lat,
        lng,
        city,
      });
    });

    travelState.selected_hotels.forEach((hotel) => {
      const lat = toCoordinate(hotel.option.latitude);
      const lng = toCoordinate(hotel.option.longitude);
      const hotelName = hotel.option.name ?? `Hotel ${hotel.stay_index}`;
      const city = hotel.city;
      const cityCenter = getGoogleCityCoordinates(city, googleCityCoordinates);
      const fallbackCoordinate = cityCenter
        ? withOffset(cityCenter, `hotel-${hotel.stay_index}-${city}`, 0.12)
        : null;
      const finalLat = lat ?? fallbackCoordinate?.[0] ?? null;
      const finalLng = lng ?? fallbackCoordinate?.[1] ?? null;
      if (finalLat === null || finalLng === null) return;

      targets.push({
        id: `hotel-${hotel.stay_index}-${normalizeCityKey(city)}`,
        kind: "hotel",
        label: hotelName,
        subtitle: `Hotel in ${city}`,
        localName: getLocalDisplayName(city),
        intro: buildMapIntro("hotel", hotelName, city),
        countryLabel: (() => {
          const context = getCityContext(city);
          return context
            ? `${context.countryZh} (${context.countryEn})`
            : undefined;
        })(),
        recommendedDays: (() => {
          const context = getCityContext(city);
          return context?.days;
        })(),
        imageSrc: getCityImage(city, `hotel-${hotel.stay_index}`),
        lat: finalLat,
        lng: finalLng,
        city,
      });
    });

    return targets;
  }, [
    orderedCities,
    displayRouteCoordinates,
    googleCityCoordinates,
    travelState.city_days,
    travelState.origin_city,
    travelState.return_city,
    travelState.selected_hotels,
  ]);

  const activeBaseTarget = useMemo(
    () =>
      baseMapTargets.find((target) => target.id === activeMapTargetId) ?? null,
    [activeMapTargetId, baseMapTargets]
  );

  const activeCityForHotspots = useMemo(() => {
    if (activeBaseTarget?.city) return activeBaseTarget.city;
    if (orderedCities.length > 0) return orderedCities[0];
    return travelState.selected_hotels[0]?.city ?? null;
  }, [activeBaseTarget?.city, orderedCities, travelState.selected_hotels]);

  const hotspotMapTargets = useMemo(() => {
    if (!hasDestinationSelection || !activeCityForHotspots) return [];
    const activeCityKey = normalizeCityKey(activeCityForHotspots);
    if (!selectedCityKeys.has(activeCityKey)) return [];

    const cityCenter = getGoogleCityCoordinates(
      activeCityForHotspots,
      googleCityCoordinates
    );
    if (!cityCenter) return [];

    return getHotspotsForCity(activeCityForHotspots).map((spot, index) => ({
      id: `hotspot-${activeCityForHotspots}-${index}`,
      kind: "hotspot" as const,
      label: spot,
      subtitle: `Hotspot in ${activeCityForHotspots}`,
      localName: getLocalDisplayName(activeCityForHotspots),
      intro: buildMapIntro("hotspot", spot, activeCityForHotspots),
      countryLabel: (() => {
        const context = getCityContext(activeCityForHotspots);
        return context
          ? `${context.countryZh} (${context.countryEn})`
          : undefined;
      })(),
      recommendedDays: (() => {
        const context = getCityContext(activeCityForHotspots);
        return context?.days;
      })(),
      imageSrc: getCityImage(activeCityForHotspots, `hotspot-${index}`),
      ...(() => {
        const exactCoordinate = getGoogleCoordinateByKey(
          getHotspotGeocodeKey(activeCityForHotspots, spot),
          googleCityCoordinates
        );
        const [lat, lng] =
          exactCoordinate ??
          withOffset(
            cityCenter,
            `hotspot-${activeCityForHotspots}-${index}`,
            0.26
          );
        return { lat, lng };
      })(),
      city: activeCityForHotspots,
    }));
  }, [
    activeCityForHotspots,
    googleCityCoordinates,
    hasDestinationSelection,
    selectedCityKeys,
  ]);

  const allMapTargets = useMemo(
    () => [...baseMapTargets, ...citySuggestionTargets, ...hotspotMapTargets],
    [baseMapTargets, citySuggestionTargets, hotspotMapTargets]
  );

  const activeMapTarget = useMemo(
    () =>
      allMapTargets.find((target) => target.id === activeMapTargetId) ?? null,
    [activeMapTargetId, allMapTargets]
  );

  const activePlannerFormMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (
        message.role === "assistant" &&
        message.parts.some((part) => part.type === "planner_form")
      ) {
        return message.id;
      }
    }

    return null;
  }, [messages]);

  const selectedCityTargets = useMemo(
    () => baseMapTargets.filter((target) => target.kind === "city"),
    [baseMapTargets]
  );

  const selectedHotelTargets = useMemo(
    () => baseMapTargets.filter((target) => target.kind === "hotel"),
    [baseMapTargets]
  );
  const hasFinalItinerary = displayItinerary.length > 0;
  const showFinalItinerary =
    hasFinalItinerary && !mapModeSessionIds.includes(activeSessionId);
  const itineraryVersionOptions = useMemo(() => {
    const versions = activeSession?.versions ?? [];
    const latestVersionId = versions[versions.length - 1]?.id;
    return versions.map((version) => ({
      id: version.id,
      label: `版本 ${version.versionNumber}`,
      createdAt: version.createdAt,
      editSummary: version.editSummary,
      isLatest: version.id === latestVersionId,
    }));
  }, [activeSession?.versions]);

  const setSessionMapMode = useCallback(
    (sessionId: string, enabled: boolean) => {
      setMapModeSessionIds((currentSessionIds) => {
        const exists = currentSessionIds.includes(sessionId);
        if (enabled) {
          return exists ? currentSessionIds : [...currentSessionIds, sessionId];
        }

        return exists
          ? currentSessionIds.filter(
              (currentSessionId) => currentSessionId !== sessionId
            )
          : currentSessionIds;
      });
    },
    []
  );

  const setActiveTravelVersion = useCallback(
    (sessionId: string, versionId: string) => {
      updateTravelSession(sessionId, (session) => {
        if (!session.versions?.some((version) => version.id === versionId)) {
          return session;
        }

        return {
          ...session,
          activeVersionId: versionId,
          updatedAt: new Date().toISOString(),
        };
      });
      setSessionMapMode(sessionId, false);
    },
    [setSessionMapMode, updateTravelSession]
  );

  const updateConversationScrollThumb = useCallback(() => {
    const scrollElement = messageScrollRef.current;
    const railElement = scrollRailRef.current;
    if (!scrollElement || !railElement) return;

    const maxScroll = scrollElement.scrollHeight - scrollElement.clientHeight;
    const railHeight = railElement.clientHeight;
    if (maxScroll <= 1 || railHeight <= 0) {
      setShowScrollToBottom(false);
      setScrollThumb((previous) =>
        previous.visible ? { top: 0, height: 0, visible: false } : previous
      );
      return;
    }

    const distanceFromBottom =
      scrollElement.scrollHeight -
      scrollElement.scrollTop -
      scrollElement.clientHeight;
    setShowScrollToBottom(distanceFromBottom > 220);

    const thumbHeight = clampNumber(
      (scrollElement.clientHeight / scrollElement.scrollHeight) * railHeight,
      34,
      railHeight
    );
    const maxThumbTop = Math.max(0, railHeight - thumbHeight);
    const thumbTop =
      maxScroll > 0 ? (scrollElement.scrollTop / maxScroll) * maxThumbTop : 0;

    setScrollThumb((previous) => {
      if (
        previous.visible &&
        Math.abs(previous.top - thumbTop) < 0.5 &&
        Math.abs(previous.height - thumbHeight) < 0.5
      ) {
        return previous;
      }

      return {
        top: thumbTop,
        height: thumbHeight,
        visible: true,
      };
    });
  }, []);

  const scrollConversationToThumbTop = useCallback(
    (rawTop: number) => {
      const scrollElement = messageScrollRef.current;
      const railElement = scrollRailRef.current;
      if (!scrollElement || !railElement || !scrollThumb.visible) return;

      const maxScroll = scrollElement.scrollHeight - scrollElement.clientHeight;
      const maxThumbTop = Math.max(
        0,
        railElement.clientHeight - scrollThumb.height
      );
      const nextTop = clampNumber(rawTop, 0, maxThumbTop);
      const ratio = maxThumbTop > 0 ? nextTop / maxThumbTop : 0;

      scrollElement.scrollTop = ratio * maxScroll;
    },
    [scrollThumb.height, scrollThumb.visible]
  );

  const startConversationScrollDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!scrollThumb.visible) return;
      event.preventDefault();

      const railElement = scrollRailRef.current;
      if (!railElement) return;

      const moveThumb = (clientY: number) => {
        const railRect = railElement.getBoundingClientRect();
        scrollConversationToThumbTop(
          clientY - railRect.top - scrollDragOffsetRef.current
        );
      };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        moveThumb(moveEvent.clientY);
      };

      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp, { once: true });
      moveThumb(event.clientY);
    },
    [scrollConversationToThumbTop, scrollThumb.visible]
  );

  const scrollConversationToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const scrollElement = messageScrollRef.current;
      if (!scrollElement) return;

      scrollElement.scrollTo({
        top: scrollElement.scrollHeight,
        behavior,
      });
    },
    []
  );

  const mapPoints = useMemo<TripMapPoint[]>(
    () =>
      allMapTargets
        .filter((target) => target.kind !== "route")
        .map((target) => ({
          id: target.id,
          kind: target.kind as "city" | "hotel" | "hotspot",
          label: target.label,
          subtitle: target.subtitle,
          localName: target.localName,
          intro: target.intro,
          countryLabel: target.countryLabel,
          recommendedDays: target.recommendedDays,
          imageSrc: target.imageSrc,
          lat: target.lat,
          lng: target.lng,
          city: target.city,
        })),
    [allMapTargets]
  );

  useEffect(() => {
    const archivedSessions = readArchivedTravelSessions(
      archiveKey,
      interfaceLocale
    );
    let nextSessions = archivedSessions;
    let nextActiveSessionId = archivedSessions[0].id;

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const sharePayload = decodeTravelItinerarySharePayload(
        url.searchParams.get(TRAVEL_ITINERARY_SHARE_PARAM)
      );

      if (sharePayload) {
        const sharedSession = createTravelShareSession(sharePayload);
        nextSessions = [sharedSession, ...archivedSessions];
        nextActiveSessionId = sharedSession.id;
        url.searchParams.delete(TRAVEL_ITINERARY_SHARE_PARAM);
        window.history.replaceState(null, "", url.toString());
      }
    }

    setSessions(nextSessions);
    setActiveSessionId(nextActiveSessionId);
    setActiveMapTargetId("");
    setRenamingSessionId(null);
    setRenamingSessionTitle("");
    setArchiveLoadedKey(archiveKey);
  }, [archiveKey, interfaceLocale]);

  useEffect(() => {
    let disposed = false;
    setIsPrefetchingIpLocation(true);
    setPrefetchedIpLocationError(null);

    fetch("/api/travel/ip-location", { method: "GET" })
      .then(async (response) => {
        const text = await response.text();
        if (!response.ok) {
          throw new Error("无法根据 IP 推断城市。");
        }

        try {
          return JSON.parse(text) as unknown;
        } catch {
          return {} as unknown;
        }
      })
      .then((payload) => {
        if (disposed) return;
        const location = coerceTravelIpLocation(payload);
        if (!location) {
          throw new Error("无法根据 IP 推断城市。");
        }
        setPrefetchedIpLocation(location);
      })
      .catch((error) => {
        if (disposed) return;
        const message =
          error instanceof Error ? error.message : "无法根据 IP 推断城市。";
        setPrefetchedIpLocationError(message);
      })
      .finally(() => {
        if (disposed) return;
        setIsPrefetchingIpLocation(false);
      });

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (archiveLoadedKey !== archiveKey) return;

    writeArchivedTravelSessions(archiveKey, sessions);
  }, [archiveKey, archiveLoadedKey, sessions]);

  useEffect(() => {
    const latestMessage = messages[messages.length - 1];
    if (!latestMessage || latestMessage.role !== "assistant") return;
    if (lastAutoScrolledMessageIdRef.current === latestMessage.id) return;

    lastAutoScrolledMessageIdRef.current = latestMessage.id;

    let timeoutId: number | undefined;
    const frameId = window.requestAnimationFrame(() => {
      scrollConversationToBottom("smooth");
      timeoutId = window.setTimeout(() => {
        scrollConversationToBottom("smooth");
        updateConversationScrollThumb();
      }, 140);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [messages, scrollConversationToBottom, updateConversationScrollThumb]);

  useEffect(() => {
    const scrollElement = messageScrollRef.current;
    if (!scrollElement) return;

    const handleScroll = () => updateConversationScrollThumb();
    const timeoutId = window.setTimeout(handleScroll, 80);

    handleScroll();
    scrollElement.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(handleScroll);
    resizeObserver?.observe(scrollElement);

    return () => {
      window.clearTimeout(timeoutId);
      scrollElement.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      resizeObserver?.disconnect();
    };
  }, [
    activeMapTarget?.id,
    messages,
    missingField,
    updateConversationScrollThumb,
  ]);

  useEffect(() => {
    if (!activeMapTargetId && baseMapTargets.length > 0) {
      setActiveMapTargetId(baseMapTargets[0].id);
      return;
    }

    if (!activeMapTargetId) {
      return;
    }

    if (!allMapTargets.some((target) => target.id === activeMapTargetId)) {
      setActiveMapTargetId("");
      return;
    }
  }, [activeMapTargetId, allMapTargets, baseMapTargets]);

  useEffect(() => {
    if (!selectedCityFocusKey) {
      selectedCityFocusKeyRef.current = "";
      return;
    }

    if (selectedCityFocusKeyRef.current === selectedCityFocusKey) {
      return;
    }

    selectedCityFocusKeyRef.current = selectedCityFocusKey;

    const latestCity = travelState.cities[travelState.cities.length - 1];
    const latestCityKey = latestCity ? normalizeCityKey(latestCity) : "";
    const nextCityTarget =
      baseMapTargets.find(
        (target) =>
          target.kind === "city" &&
          normalizeCityKey(target.city ?? target.label) === latestCityKey
      ) ?? baseMapTargets.find((target) => target.kind === "city");

    if (nextCityTarget) {
      setActiveMapTargetId(nextCityTarget.id);
    }
  }, [baseMapTargets, selectedCityFocusKey, travelState.cities]);

  const respondToConversation = useCallback(
    async (nextMessages: TravelChatMessage[], sessionId: string) => {
      setStatus("submitted");

      try {
        const state = buildTravelStateFromMessages(
          toChatLikeMessages(nextMessages)
        );
        const payload = toTravelPayload(state);
        const latestUserMessage = [...nextMessages]
          .reverse()
          .find((message) => message.role === "user");
        const latestUserText = latestUserMessage
          ? getMessageText(latestUserMessage)
          : "";
        const latestVisibleUserText = latestUserMessage
          ? getVisibleMessageText(latestUserMessage)
          : "";
        const latestSessions = sessionsRef.current;
        const sessionSnapshot =
          latestSessions.find((session) => session.id === sessionId) ??
          sessions.find((session) => session.id === sessionId) ??
          activeSession;
        const sessionVersions = sessionSnapshot?.versions ?? [];
        const currentVersion =
          sessionVersions.find(
            (version) => version.id === sessionSnapshot?.activeVersionId
          ) ??
          sessionVersions[sessionVersions.length - 1] ??
          null;
        const messageItinerary = getTravelItineraryFromMessages(nextMessages);
        const currentItinerary = currentVersion?.itinerary ?? messageItinerary;
        const revisionBaseState = currentVersion?.travelState ?? state;
        const isStructuredMessage = isStructuredTravelFormText(latestUserText);

        if (
          currentItinerary.length > 0 &&
          latestVisibleUserText &&
          !isStructuredMessage
        ) {
          const response = await fetch("/api/travel/itinerary/revise", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              current_version_id: currentVersion?.id,
              user_prompt: latestVisibleUserText,
              state: revisionBaseState,
              current_itinerary: currentItinerary,
              active_modules: {
                selected_flights: revisionBaseState.selected_flights,
                selected_hotels: revisionBaseState.selected_hotels,
              },
              locale: travelAgentLocale,
            }),
          });

          if (!response.ok) {
            const detail = await response.text();
            throw new Error(
              detail ||
                (interfaceLocale === "zh"
                  ? "无法修改行程。"
                  : "Unable to revise the itinerary.")
            );
          }

          const result = (await response.json()) as unknown;
          const revision = parseTravelRevisionResponse(
            result,
            currentItinerary,
            interfaceLocale
          );

          if (
            revision.action === "revise" &&
            !hasVisibleRevisionChange(currentItinerary, revision)
          ) {
            throw new Error(
              interfaceLocale === "zh"
                ? "我可以继续帮你改这份行程。你想改哪一天、加在哪个城市，还是让我按当前路线自动安排？"
                : "I can keep revising this itinerary. Which day should change, which city should I add it to, or should I place it automatically along the current route?"
            );
          }

          if (revision.action === "restart") {
            setSessionMapMode(sessionId, true);
            setActiveMapTargetId("");
            setSessionMessages(sessionId, [
              ...withLatestUserResetPayload(nextMessages),
              {
                id: createMessageId(),
                role: "assistant",
                parts: [
                  { type: "text", text: revision.reply },
                  {
                    type: "quick_replies",
                    quick_replies:
                      revision.quickReplies.length > 0
                        ? revision.quickReplies
                        : interfaceLocale === "zh"
                          ? INITIAL_QUICK_REPLIES
                          : INITIAL_QUICK_REPLIES_EN,
                  },
                ],
              },
            ]);
            return;
          }

          if (revision.action === "clarify") {
            setSessionMessages(sessionId, (prev) => [
              ...prev,
              {
                id: createMessageId(),
                role: "assistant",
                parts: [
                  { type: "text", text: revision.reply },
                  ...(revision.quickReplies.length > 0
                    ? [
                        {
                          type: "quick_replies" as const,
                          quick_replies: revision.quickReplies,
                        },
                      ]
                    : []),
                ],
              },
            ]);
            return;
          }

          const revisedState = applyRevisionPatches(
            revisionBaseState,
            revision.statePatch,
            revision.modulePatch
          );
          const editSummaryText = revision.editSummary
            ? interfaceLocale === "zh"
              ? `\n\n修改摘要：${revision.editSummary}`
              : `\n\nEdit summary: ${revision.editSummary}`
            : "";
          const assistantMessage = createItineraryAssistantMessage({
            itinerary: revision.itinerary,
            selectedFlights: revisedState.selected_flights,
            selectedHotels: revisedState.selected_hotels,
            intro: `${revision.reply}${editSummaryText}`,
            modulePatch: revision.modulePatch,
            quickReplies: revision.quickReplies,
            locale: interfaceLocale,
          });

          setSessionMapMode(sessionId, false);
          updateTravelSession(sessionId, (session) => {
            const versions = session.versions ?? [];
            const baseMessages = session.messages.some(
              (message) => message.id === latestUserMessage?.id
            )
              ? session.messages
              : nextMessages;
            const version = createTravelTripVersion({
              itinerary: revision.itinerary,
              travelState: revisedState,
              versionNumber: versions.length + 1,
              parentVersionId:
                session.activeVersionId ?? versions[versions.length - 1]?.id,
              sourceMessageId: assistantMessage.id,
              userPrompt: latestVisibleUserText,
              editSummary: revision.editSummary,
              modulePatch: revision.modulePatch,
            });
            return {
              ...session,
              messages: [...baseMessages, assistantMessage],
              versions: [...versions, version],
              activeVersionId: version.id,
              updatedAt: new Date().toISOString(),
            };
          });
          return;
        }

        if (!payload) {
          if (isStructuredMessage) {
            const field = nextMissingField(state) ?? "country";
            const followUp = getFieldQuestionForState(state, field);
            setSessionMessages(sessionId, (prev) => [
              ...prev,
              {
                id: createMessageId(),
                role: "assistant",
                parts: [
                  { type: "text", text: followUp },
                  { type: "planner_form" },
                ],
              },
            ]);
            return;
          }

          const response = await fetch("/api/travel/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messages: toAgentChatMessages(nextMessages),
              state,
              locale: travelAgentLocale,
            }),
          });

          if (!response.ok) {
            const detail = await response.text();
            throw new Error(
              detail ||
                (interfaceLocale === "zh"
                  ? "无法生成旅行对话回复。"
                  : "Unable to generate a travel chat response.")
            );
          }

          const result = (await response.json()) as TravelAgentChatResponse;
          setSessionMessages(sessionId, (prev) => [
            ...prev,
            createAssistantMessageFromAgentResponse(result, interfaceLocale),
          ]);
          return;
        }

        setSessionMapMode(sessionId, false);

        const response = await fetch("/api/travel/itinerary", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const detail = await response.text();
          throw new Error(
            detail ||
              (interfaceLocale === "zh"
                ? "无法生成行程。"
                : "Unable to generate the itinerary.")
          );
        }

        const result = (await response.json()) as unknown;
        const itinerary = parseItineraryFromResponse(result);
        if (itinerary.length === 0) {
          throw new Error(
            interfaceLocale === "zh"
              ? "后端返回的行程为空或格式无效。"
              : "The backend returned an empty or invalid itinerary."
          );
        }

        const assistantMessage = createItineraryAssistantMessage({
          itinerary,
          selectedFlights: payload.selected_flights,
          selectedHotels: payload.selected_hotels,
          intro:
            interfaceLocale === "zh"
              ? "行程已经生成，我已经把每天安排整理到行程卡片里。之后可以直接在聊天里继续修改，我会保存成新版本。"
              : "Your itinerary is ready. I organized each day into itinerary cards, and you can keep editing it in chat; I’ll save changes as new versions.",
          quickReplies:
            interfaceLocale === "zh"
              ? ITINERARY_REVISION_QUICK_REPLIES
              : ITINERARY_REVISION_QUICK_REPLIES_EN,
          locale: interfaceLocale,
        });

        updateTravelSession(sessionId, (session) => {
          const versions = session.versions ?? [];
          const baseMessages = session.messages.some(
            (message) => message.id === latestUserMessage?.id
          )
            ? session.messages
            : nextMessages;
          const version = createTravelTripVersion({
            itinerary,
            travelState: state,
            versionNumber: versions.length + 1,
            parentVersionId:
              session.activeVersionId ?? versions[versions.length - 1]?.id,
            sourceMessageId: assistantMessage.id,
            editSummary:
              versions.length > 0
                ? interfaceLocale === "zh"
                  ? "重新生成了一版完整行程"
                  : "Regenerated a full itinerary"
                : interfaceLocale === "zh"
                  ? "生成初始行程"
                  : "Generated the initial itinerary",
          });
          return {
            ...session,
            messages: [...baseMessages, assistantMessage],
            versions: [...versions, version],
            activeVersionId: version.id,
            updatedAt: new Date().toISOString(),
          };
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : "未知错误";
        setSessionMessages(sessionId, (prev) => [
          ...prev,
          {
            id: createMessageId(),
            role: "assistant",
            parts: [
              {
                type: "text",
                text:
                  (interfaceLocale === "zh"
                    ? "抱歉，暂时无法生成旅行计划。请检查 travel service 是否启动，以及 API key 是否已配置。\n\n"
                    : "Sorry, I can’t generate the travel plan right now. Please check that the travel service is running and the API key is configured.\n\n") +
                  detail,
              },
            ],
          },
        ]);
      } finally {
        setStatus("ready");
      }
    },
    [
      activeSession,
      interfaceLocale,
      sessions,
      setSessionMapMode,
      setSessionMessages,
      travelAgentLocale,
      updateTravelSession,
    ]
  );

  const sendMessage = useCallback(
    (message: TravelChatInputMessage) => {
      if (status !== "ready") return;
      const sessionId = activeSessionId;
      const userMessage: TravelChatMessage = {
        id: createMessageId(),
        role: message.role,
        parts: message.parts,
      };

      const nextMessages = [...messages, userMessage];
      setSessionMessages(sessionId, nextMessages);
      window.requestAnimationFrame(() => {
        scrollConversationToBottom("smooth");
        window.setTimeout(() => {
          scrollConversationToBottom("smooth");
          updateConversationScrollThumb();
        }, 80);
      });
      void respondToConversation(nextMessages, sessionId);
    },
    [
      activeSessionId,
      messages,
      respondToConversation,
      scrollConversationToBottom,
      setSessionMessages,
      status,
      updateConversationScrollThumb,
    ]
  );

  const sendFreeTextMessage = useCallback(
    (text: string) => {
      const normalized = text.trim();
      if (!normalized) return;

      sendMessage({
        role: "user",
        parts: [{ type: "text", text: normalized }],
      });
    },
    [sendMessage]
  );

  const handleQuickReply = useCallback(
    (reply: TravelQuickReply) => {
      sendFreeTextMessage(reply.value || reply.label);
    },
    [sendFreeTextMessage]
  );

  const handleDestinationCardAction = useCallback(
    (card: TravelDestinationCard) => {
      const candidate = coerceTravelFormCandidatePayload(card.payload);
      const payload = createDestinationAppendPayload(travelState, {
        country: candidate.seed_country ?? candidate.country ?? card.country,
        countries: candidate.countries,
        city: candidate.seed_city ?? card.city ?? undefined,
        cities: candidate.cities,
        includeCityDays:
          missingField !== "country" && missingField !== "cities",
      });

      if (!payload) {
        sendFreeTextMessage(
          `我想了解 ${getLocalDisplayName(card.city ?? card.country)}`
        );
        return;
      }

      sendMessage({
        role: "user",
        parts: [{ type: "text", text: createTravelFormMessage(payload) }],
      });
    },
    [missingField, sendFreeTextMessage, sendMessage, travelState]
  );

  const handleAddDestinationFromMap = useCallback(
    (point: TripMapPoint) => {
      if (!canAddDestinationFromMap) return;

      const targetCity = (point.city ?? point.label).trim();
      if (!targetCity) return;

      const cityContext = getCityContext(targetCity);
      const seedCountry =
        cityContext?.countryEn ?? cityContext?.countryZh ?? null;
      const shouldPrefillDays =
        missingField !== "country" && missingField !== "cities";
      const payload = createDestinationAppendPayload(travelState, {
        country: seedCountry ?? undefined,
        city: targetCity,
        includeCityDays: shouldPrefillDays,
        defaultCityDays: 2,
      });
      if (!payload) return;

      sendMessage({
        role: "user",
        parts: [{ type: "text", text: createTravelFormMessage(payload) }],
      });
    },
    [canAddDestinationFromMap, missingField, sendMessage, travelState]
  );

  const handleMapPointSelect = useCallback((id: string) => {
    setActiveMapTargetId(id);
  }, []);

  const handleNewSession = useCallback(() => {
    if (status !== "ready") return;
    const nextSession = createTravelChatSession(interfaceLocale);
    setSessions((currentSessions) => [nextSession, ...currentSessions]);
    setActiveSessionId(nextSession.id);
    setActiveMapTargetId("");
    setRenamingSessionId(null);
    setRenamingSessionTitle("");
  }, [interfaceLocale, status]);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      if (status !== "ready" || sessionId === activeSessionId) return;
      setActiveSessionId(sessionId);
      setActiveMapTargetId("");
    },
    [activeSessionId, status]
  );

  const handleStartRenameSession = useCallback((session: TravelChatSession) => {
    setRenamingSessionId(session.id);
    setRenamingSessionTitle(session.title);
  }, []);

  const handleCancelRenameSession = useCallback(() => {
    setRenamingSessionId(null);
    setRenamingSessionTitle("");
  }, []);

  const handleSaveRenameSession = useCallback(() => {
    if (!renamingSessionId) return;
    const title = renamingSessionTitle.trim();
    if (!title) return;

    setSessions((currentSessions) =>
      currentSessions.map((session) =>
        session.id === renamingSessionId
          ? {
              ...session,
              title,
              customTitle: true,
              updatedAt: new Date().toISOString(),
            }
          : session
      )
    );
    setRenamingSessionId(null);
    setRenamingSessionTitle("");
  }, [renamingSessionId, renamingSessionTitle]);

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      if (status !== "ready") return;

      setSessions((currentSessions) => {
        const targetIndex = currentSessions.findIndex(
          (session) => session.id === sessionId
        );
        if (targetIndex < 0) return currentSessions;

        const nextSessions = currentSessions.filter(
          (session) => session.id !== sessionId
        );
        if (nextSessions.length === 0) {
          const replacement = createTravelChatSession(interfaceLocale);
          setActiveSessionId(replacement.id);
          setActiveMapTargetId("");
          return [replacement];
        }

        if (activeSessionId === sessionId) {
          const nextActive =
            nextSessions[Math.min(targetIndex, nextSessions.length - 1)];
          setActiveSessionId(nextActive.id);
          setActiveMapTargetId("");
        }

        return nextSessions;
      });

      if (renamingSessionId === sessionId) {
        setRenamingSessionId(null);
        setRenamingSessionTitle("");
      }
    },
    [activeSessionId, interfaceLocale, renamingSessionId, status]
  );

  return (
    <div
      className={`relative mx-auto flex w-full max-w-[2300px] flex-col overflow-hidden px-2 pb-2 pt-1 sm:px-3 sm:pb-3 sm:pt-2 lg:px-5 ${
        embedded
          ? "h-full min-h-0"
          : "h-[calc(100dvh-8.75rem)] min-h-0 sm:h-[calc(100dvh-9rem)] lg:h-[calc(100dvh-9.5rem)]"
      }`}
    >
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_clamp(180px,30dvh,320px)] gap-3 sm:gap-4 lg:grid-cols-[minmax(360px,0.78fr)_minmax(500px,1.22fr)] lg:grid-rows-none xl:grid-cols-[minmax(390px,0.7fr)_minmax(640px,1.3fr)] 2xl:grid-cols-[minmax(430px,0.66fr)_minmax(760px,1.34fr)]">
        <div className="relative h-full min-h-0">
          <Button
            className="absolute left-3 top-3 z-30 h-8 w-8 bg-white/95 shadow-sm"
            data-testid="travel-session-toggle"
            onClick={() => setSessionsPanelOpen(true)}
            size="icon"
            title={isZh ? "打开对话进程" : "Open chat sessions"}
            type="button"
            variant="outline"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>

          {sessionsPanelOpen && (
            <>
              <button
                aria-label={isZh ? "关闭对话进程" : "Close chat sessions"}
                className="absolute inset-0 z-30 bg-slate-950/10 backdrop-blur-[1px]"
                data-testid="travel-session-backdrop"
                onClick={() => setSessionsPanelOpen(false)}
                type="button"
              />
              <aside
                className="absolute inset-y-0 left-0 z-40 flex w-[320px] max-w-[calc(100%-1rem)] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_18px_60px_rgba(15,23,42,0.22)] backdrop-blur"
                data-testid="travel-chat-session-sidebar"
              >
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {isZh ? "旅行 AI" : "Travel AI"}
                    </p>
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {isZh ? "对话进程" : "Chat sessions"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      className="h-8 w-8"
                      data-testid="travel-new-session-button"
                      disabled={status !== "ready"}
                      onClick={handleNewSession}
                      size="icon"
                      title={isZh ? "新建旅行对话" : "New travel chat"}
                      type="button"
                      variant="outline"
                    >
                      <MessageSquarePlus className="h-4 w-4" />
                    </Button>
                    <Button
                      className="h-8 w-8"
                      data-testid="travel-session-close-button"
                      onClick={() => setSessionsPanelOpen(false)}
                      size="icon"
                      title={isZh ? "隐藏对话进程" : "Hide chat sessions"}
                      type="button"
                      variant="ghost"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                  {sessions.map((session) => {
                    const active = session.id === activeSessionId;
                    const renaming = session.id === renamingSessionId;
                    const userMessageCount = session.messages.filter(
                      (message) => message.role === "user"
                    ).length;

                    return (
                      <div
                        aria-current={active ? "true" : undefined}
                        className={`rounded-xl border p-2 transition-colors ${
                          active
                            ? "border-[#03346E] bg-[#03346E] text-white shadow-sm"
                            : "border-transparent bg-slate-50 text-slate-700 hover:border-slate-200 hover:bg-white"
                        }`}
                        data-testid="travel-session-item"
                        key={session.id}
                      >
                        {renaming ? (
                          <div className="space-y-2">
                            <input
                              autoFocus
                              className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 outline-none focus:border-blue-400"
                              data-testid="travel-session-rename-input"
                              onChange={(event) =>
                                setRenamingSessionTitle(event.target.value)
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  handleSaveRenameSession();
                                }
                                if (event.key === "Escape") {
                                  handleCancelRenameSession();
                                }
                              }}
                              value={renamingSessionTitle}
                            />
                            <div className="flex justify-end gap-1">
                              <Button
                                className="h-7 w-7"
                                data-testid="travel-session-save-rename"
                                disabled={!renamingSessionTitle.trim()}
                                onClick={handleSaveRenameSession}
                                size="icon"
                                title={isZh ? "保存名称" : "Save name"}
                                type="button"
                                variant="outline"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                className="h-7 w-7"
                                data-testid="travel-session-cancel-rename"
                                onClick={handleCancelRenameSession}
                                size="icon"
                                title={isZh ? "取消重命名" : "Cancel rename"}
                                type="button"
                                variant="ghost"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2">
                            <button
                              aria-current={active ? "true" : undefined}
                              className="min-w-0 flex-1 text-left"
                              disabled={status !== "ready" && !active}
                              onClick={() => handleSelectSession(session.id)}
                              type="button"
                            >
                              <span className="flex items-center gap-2">
                                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate text-sm font-semibold">
                                  {session.title}
                                </span>
                              </span>
                              <span
                                className={`mt-1 block text-xs ${
                                  active ? "text-white/70" : "text-slate-500"
                                }`}
                              >
                                {userMessageCount > 0
                                  ? isZh
                                    ? `${userMessageCount} 条用户消息`
                                    : `${userMessageCount} user messages`
                                  : isZh
                                    ? "还没开始"
                                    : "Not started yet"}
                              </span>
                            </button>
                            <div className="flex shrink-0 gap-1">
                              <Button
                                className={`h-7 w-7 ${
                                  active
                                    ? "text-white hover:text-slate-900"
                                    : ""
                                }`}
                                data-testid="travel-session-rename-button"
                                disabled={status !== "ready"}
                                onClick={() =>
                                  handleStartRenameSession(session)
                                }
                                size="icon"
                                title={isZh ? "重命名对话" : "Rename chat"}
                                type="button"
                                variant={active ? "ghost" : "outline"}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                className={`h-7 w-7 ${
                                  active ? "text-white hover:text-red-700" : ""
                                }`}
                                data-testid="travel-session-delete-button"
                                disabled={status !== "ready"}
                                onClick={() => handleDeleteSession(session.id)}
                                size="icon"
                                title={isZh ? "删除对话" : "Delete chat"}
                                type="button"
                                variant={active ? "ghost" : "outline"}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </aside>
            </>
          )}

          <Card className="h-full min-h-0 overflow-hidden rounded-xl border-slate-200/80 bg-white/95 shadow-[0_14px_45px_rgba(15,23,42,0.08)] backdrop-blur sm:rounded-2xl">
            <CardContent className="h-full p-0">
              <div className="flex h-full min-h-0 flex-col bg-white">
                <div
                  className="shrink-0 border-b border-slate-200 bg-white/95 px-3 py-2 pl-11 shadow-sm sm:px-4 sm:py-3 md:px-6 md:pl-12"
                  data-testid="travel-map-summary"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <Sparkles className="h-3 w-3 text-blue-600" />
                        {showFinalItinerary
                          ? isZh
                            ? "行程焦点"
                            : "Itinerary focus"
                          : isZh
                            ? "地图焦点"
                            : "Map focus"}
                      </p>
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {showFinalItinerary
                          ? isZh
                            ? `${displayItinerary.length}天${displayOrderedCities.join("、") || "定制"}行程`
                            : `${displayItinerary.length}-day ${displayOrderedCities.join(", ") || "custom"} itinerary`
                          : formatMapTargetDisplayName(activeMapTarget, isZh)}
                      </p>
                    </div>
                    <Badge className="shrink-0 bg-cyan-100 text-cyan-800 hover:bg-cyan-100">
                      {progressPercent}%
                    </Badge>
                  </div>

                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#03346E]"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <Badge variant="outline">
                      {status === "submitted" || status === "streaming"
                        ? isZh
                          ? "规划中"
                          : "Planning"
                        : isZh
                          ? "就绪"
                          : "Ready"}
                    </Badge>
                    <span>
                      {isZh ? "已完成" : "Completed"} {completedProgressCount}/
                      {progressItems.length}
                    </span>
                    {selectedCityTargets.length > 0 && (
                      <span className="truncate">
                        {isZh ? "城市：" : "Cities: "}{" "}
                        {selectedCityTargets
                          .slice(0, 3)
                          .map((target) => target.localName ?? target.label)
                          .join(isZh ? "、" : ", ")}
                      </span>
                    )}
                    {selectedHotelTargets.length > 0 && (
                      <span className="truncate">
                        {isZh ? "酒店：" : "Hotels: "}{" "}
                        {selectedHotelTargets
                          .slice(0, 2)
                          .map((target) => target.label)
                          .join(isZh ? "、" : ", ")}
                      </span>
                    )}
                    {displayRouteCoordinates.length >= 2 && (
                      <button
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 transition-colors ${
                          activeMapTarget?.id === "route-overview"
                            ? "border-blue-300 bg-blue-50 text-blue-700"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                        onClick={() => setActiveMapTargetId("route-overview")}
                        type="button"
                      >
                        <Route className="h-3 w-3" />
                        {isZh ? "路线" : "Route"}
                      </button>
                    )}
                  </div>
                </div>
                <div className="relative min-h-0 flex-1">
                  <div
                    ref={scrollRailRef}
                    className="absolute bottom-5 left-3 top-5 z-20 hidden w-5 sm:block"
                    data-testid="travel-scroll-rail"
                    onPointerDown={(event) => {
                      scrollDragOffsetRef.current = scrollThumb.height / 2;
                      startConversationScrollDrag(event);
                    }}
                  >
                    <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 rounded-full bg-slate-200" />
                    {scrollThumb.visible && (
                      <button
                        aria-label={
                          isZh
                            ? "拖动查看对话位置"
                            : "Drag to browse chat position"
                        }
                        className="absolute left-1/2 w-2.5 -translate-x-1/2 cursor-grab rounded-full bg-slate-400/80 transition-colors hover:bg-slate-500 active:cursor-grabbing"
                        data-testid="travel-scroll-thumb"
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          const rect =
                            event.currentTarget.getBoundingClientRect();
                          scrollDragOffsetRef.current =
                            event.clientY - rect.top;
                          startConversationScrollDrag(event);
                        }}
                        style={{
                          height: scrollThumb.height,
                          top: scrollThumb.top,
                        }}
                        type="button"
                      />
                    )}
                  </div>
                  <div
                    ref={messageScrollRef}
                    className="h-full space-y-4 overflow-y-auto overscroll-y-contain px-3 py-4 [scrollbar-width:none] sm:pl-10 sm:pr-4 md:py-6 md:pl-12 md:pr-6 [&::-webkit-scrollbar]:hidden"
                    data-testid="travel-message-scroll"
                  >
                    <div className="space-y-6 sm:space-y-8">
                      {messages.map((message) => {
                        const visibleText = getVisibleMessageText(message);
                        const destinationCards = message.parts
                          .filter((part) => part.type === "destination_cards")
                          .flatMap((part) => part.cards);
                        const quickReplies = message.parts
                          .filter((part) => part.type === "quick_replies")
                          .flatMap((part) => part.quick_replies);
                        const showPlannerForm =
                          message.id === activePlannerFormMessageId &&
                          message.parts.some(
                            (part) => part.type === "planner_form"
                          ) &&
                          Boolean(missingField);
                        if (
                          !visibleText &&
                          destinationCards.length === 0 &&
                          quickReplies.length === 0 &&
                          !showPlannerForm
                        ) {
                          return null;
                        }

                        return (
                          <div className="w-full" key={message.id}>
                            {visibleText && (
                              <ChatMessage
                                content={visibleText}
                                role={
                                  message.role === "user" ? "user" : "agent"
                                }
                              />
                            )}

                            {(destinationCards.length > 0 ||
                              quickReplies.length > 0 ||
                              showPlannerForm) && (
                              <div
                                className={
                                  message.role === "user"
                                    ? "ml-auto mt-3 max-w-[85%]"
                                    : "mt-4 w-full"
                                }
                              >
                                {destinationCards.length > 0 && (
                                  <div
                                    className="grid gap-3 sm:grid-cols-2"
                                    data-testid="travel-destination-cards"
                                  >
                                    {destinationCards.map((card) => {
                                      const rawDisplayCity =
                                        card.city ?? card.country;
                                      const displayCity =
                                        getLocalDisplayName(rawDisplayCity);
                                      const suggestedDays =
                                        localizeSuggestedDays(
                                          card.suggested_days,
                                          interfaceLocale
                                        );
                                      const localizedSubtitle =
                                        localizeTravelText(
                                          card.subtitle,
                                          interfaceLocale
                                        );
                                      const actionLabel =
                                        card.action_label &&
                                        card.action_label !== "加入计划"
                                          ? localizeTravelText(
                                              card.action_label,
                                              interfaceLocale
                                            )
                                          : interfaceLocale === "zh"
                                            ? `加入计划：${displayCity}`
                                            : `Add to plan: ${displayCity}`;
                                      const imageSrc = getCityImage(
                                        rawDisplayCity,
                                        card.image_key ?? card.title
                                      );
                                      return (
                                        <div
                                          className="group overflow-hidden rounded-xl border border-white/80 bg-white text-slate-900 shadow-[0_12px_30px_rgba(15,23,42,0.12)] transition-transform hover:-translate-y-0.5"
                                          data-testid="travel-destination-card"
                                          key={`${card.country}-${displayCity}-${card.title}`}
                                        >
                                          <div className="relative">
                                            <Image
                                              alt={displayCity}
                                              className="h-28 w-full object-cover sm:h-36"
                                              height={144}
                                              src={imageSrc}
                                              unoptimized={imageSrc.startsWith(
                                                "http"
                                              )}
                                              width={320}
                                            />
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-8 text-white">
                                              <p className="text-sm font-semibold leading-tight">
                                                {displayCity}
                                              </p>
                                              <p className="mt-1 flex items-center gap-1 text-[11px] text-white/85">
                                                <MapPin className="h-3 w-3" />
                                                {displayCity} · {suggestedDays}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="space-y-2 p-3">
                                            <p className="line-clamp-3 text-xs leading-relaxed text-slate-600">
                                              {localizedSubtitle}
                                            </p>
                                            {card.highlights.length > 0 && (
                                              <div className="flex flex-wrap gap-1">
                                                {card.highlights
                                                  .slice(0, 3)
                                                  .map((highlight) => (
                                                    <span
                                                      className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] text-sky-800"
                                                      key={highlight}
                                                    >
                                                      {localizeTravelText(
                                                        highlight,
                                                        interfaceLocale
                                                      )}
                                                    </span>
                                                  ))}
                                              </div>
                                            )}
                                            <Button
                                              className="w-full bg-[#03346E] text-white hover:bg-[#022b5d]"
                                              disabled={status !== "ready"}
                                              onClick={() =>
                                                handleDestinationCardAction(
                                                  card
                                                )
                                              }
                                              size="sm"
                                              type="button"
                                            >
                                              {actionLabel}
                                            </Button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {quickReplies.length > 0 &&
                                  message.role === "assistant" && (
                                    <div
                                      className="mt-3 flex flex-wrap gap-2"
                                      data-testid="travel-quick-replies"
                                    >
                                      {quickReplies.map((reply) => (
                                        <Button
                                          disabled={status !== "ready"}
                                          key={`${message.id}-${reply.label}`}
                                          onClick={() =>
                                            handleQuickReply(reply)
                                          }
                                          size="sm"
                                          type="button"
                                          variant="outline"
                                        >
                                          {reply.label}
                                        </Button>
                                      ))}
                                    </div>
                                  )}

                                {showPlannerForm && (
                                  <div
                                    className="mt-3"
                                    data-testid="travel-inline-planner-form"
                                  >
                                    <TravelPlannerForm
                                      isPrefetchingIpLocation={
                                        isPrefetchingIpLocation
                                      }
                                      messages={messages}
                                      prefetchedIpLocation={
                                        prefetchedIpLocation
                                      }
                                      prefetchedIpLocationError={
                                        prefetchedIpLocationError
                                      }
                                      sendMessage={sendMessage}
                                      status={status}
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {(status === "submitted" || status === "streaming") && (
                        <div
                          aria-live="polite"
                          className="flex justify-start"
                          data-testid="travel-thinking-indicator"
                        >
                          <ThinkingIndicator className="px-1 py-2" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div
                  className="relative shrink-0 border-t border-slate-200 bg-white/95 px-2 py-2 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur sm:px-3"
                  data-testid="travel-free-chat-form"
                >
                  <ScrollToBottomFab
                    className="-top-20 right-2"
                    hasNewMessage={false}
                    onClick={() => scrollConversationToBottom("smooth")}
                    show={showScrollToBottom}
                  />
                  <ChatInput
                    buttonClassName="h-9 w-9"
                    className="mx-auto w-full max-w-[620px] gap-2 rounded-xl px-3 pb-2 pt-1 sm:rounded-2xl sm:px-4 sm:pb-3"
                    disabled={status !== "ready"}
                    isConnecting={
                      status === "submitted" || status === "streaming"
                    }
                    onSend={sendFreeTextMessage}
                    placeholder={
                      isZh ? "问问旅行计划..." : "Ask about your travel plan..."
                    }
                    textareaClassName="pb-1 pt-2 text-sm leading-6 sm:text-base"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="h-full min-h-0 overflow-hidden rounded-xl border border-slate-200/90 bg-[#08213b] shadow-[0_14px_45px_rgba(15,23,42,0.12)] sm:rounded-2xl">
          <div className="relative h-full min-h-0 overflow-hidden bg-slate-50">
            {showFinalItinerary ? (
              <TravelItineraryExperience
                activePointId={
                  activeMapTarget?.kind === "route" ? null : activeMapTarget?.id
                }
                activeVersionId={activeTravelVersion?.id}
                activeVersionSummary={activeTravelVersion?.editSummary}
                initialItineryRows={sharedItineryRows}
                itinerary={displayItinerary}
                mapPoints={mapPoints}
                modulePatch={activeTravelVersion?.modulePatch}
                onPointSelect={handleMapPointSelect}
                onVersionSelect={(versionId) =>
                  setActiveTravelVersion(activeSessionId, versionId)
                }
                orderedCities={displayOrderedCities}
                routeCoordinates={displayItineraryRouteCoordinates}
                travelState={displayTravelState}
                versionOptions={itineraryVersionOptions}
              />
            ) : (
              <TripRouteMap
                activePointId={
                  activeMapTarget?.kind === "route" ? null : activeMapTarget?.id
                }
                className="h-full w-full"
                onAddDestination={
                  canAddDestinationFromMap
                    ? handleAddDestinationFromMap
                    : undefined
                }
                onPointSelect={handleMapPointSelect}
                points={mapPoints}
                routeCoordinates={displayRouteCoordinates}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
