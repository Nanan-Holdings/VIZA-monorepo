import type { Json } from "@/types/database";
import type { TravelDestinationCard } from "@/lib/travel/chat-types";
import {
  findDropdownDestinationContract,
  getDropdownDestinationContracts,
  normalizeDestinationContractKey,
  type TravelCardSourceStatus,
  type TravelDataQuality,
} from "@/lib/travel/destination-contracts";

export const LAZY_DESTINATION_CARD_TYPES = [
  "destination_overview",
  "top_attractions",
  "food_and_restaurants",
  "transport",
  "hotel_area",
  "budget",
  "weather_season",
  "packing_preparation",
  "visa_document",
  "local_tips",
  "safety_warning",
  "itinerary_day",
  "map_route",
  "alternative_plan",
  "booking_cta",
  "save_itinerary",
] as const;

export type LazyDestinationCardType =
  (typeof LAZY_DESTINATION_CARD_TYPES)[number];

export type TravelDestinationSearchResult = {
  id: string;
  canonicalName: string;
  displayName: string;
  normalizedName: string;
  nameEn?: string | null;
  nameZh?: string | null;
  countryCode: string | null;
  countryName: string | null;
  countryNameEn?: string | null;
  countryNameZh?: string | null;
  region: string | null;
  city: string | null;
  placeType: string | null;
  latitude: number | null;
  longitude: number | null;
  popularityScore: number;
  source: string;
  confidenceScore: number;
  isVerified: boolean;
  isFeatured?: boolean;
  showOnHome?: boolean;
  aliases?: string[];
  imageKey?: string | null;
  coverImageUrl?: string | null;
  dataQuality?: TravelDataQuality;
  sourceStatus?: TravelCardSourceStatus;
  completenessScore?: number;
  attractionCount?: number;
  missingFields?: string[];
};

export type LazyTravelDestinationCard = {
  id: string;
  destinationId: string;
  cardType: LazyDestinationCardType;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  payloadJson: Json;
  source: string;
  isGenerated: boolean;
  confidenceScore: number;
};

export type DestinationTripHints = {
  travelDays?: number;
  finalNote?: string;
  preferences: string[];
};

export type TravelIntentKind =
  | "plan_trip"
  | "create_itinerary"
  | "choose_destination"
  | "destination_lookup"
  | "edit_itinerary"
  | "modify_itinerary"
  | "remove_item"
  | "replace_item"
  | "clarify_needed"
  | "ask_question"
  | "invalid_or_unrelated"
  | "unknown";

export type DestinationResolutionMethod =
  | "exact_local"
  | "alias_match"
  | "localized_name_match"
  | "fuzzy_match"
  | "typo_alias_correction"
  | "raw_extraction"
  | "ambiguous"
  | "unresolved";

export type TravelIntentDuration = {
  minDays: number;
  maxDays: number;
  raw: string;
};

export type TravelIntentDestinationCandidate = {
  raw: string;
  normalized: string;
  canonicalName: string | null;
  nameZh: string | null;
  countryCode: string | null;
  confidence: number;
  resolutionMethod: DestinationResolutionMethod;
};

export type TravelIntentParseResult = {
  intent: TravelIntentKind;
  normalizedInput: string;
  destinations: TravelIntentDestinationCandidate[];
  duration: TravelIntentDuration | null;
  dates: null;
  travelers: null;
  budget: null;
  preferences: string[];
  needsClarification: boolean;
  clarificationQuestion: string | null;
};

export type TravelDestinationPipelineDebug = {
  rawInput: string;
  normalizedInput: string;
  detectedIntent: TravelIntentKind;
  extractedDestinations: TravelIntentDestinationCandidate[];
  canonicalizedDestinations: TravelIntentDestinationCandidate[];
  resolverResult: string;
  localDb: "not_checked" | "local_index_hit" | "local_index_miss";
  geocodeApi: "not_checked" | "not_available_in_sync_resolver";
  fallbackReason: string | null;
  cardSourceStatus: TravelCardSourceStatus | "none" | "temporary_resolver";
};

type DestinationResolutionDebug = {
  debugTrace?: TravelDestinationPipelineDebug;
};

export type DestinationResolution =
  | (DestinationResolutionDebug & {
      status: "resolved";
      query: string;
      destinations: TravelDestinationSearchResult[];
      confidenceScore: number;
      tripHints: DestinationTripHints;
      cards: LazyTravelDestinationCard[];
    })
  | (DestinationResolutionDebug & {
      status: "ambiguous";
      query: string;
      clarificationQuestion: string;
      options: TravelDestinationSearchResult[];
      tripHints: DestinationTripHints;
      cards: [];
    })
  | (DestinationResolutionDebug & {
      status: "temporary";
      query: string;
      destination: TravelDestinationSearchResult;
      confidenceScore: number;
      tripHints: DestinationTripHints;
      cards: LazyTravelDestinationCard[];
    })
  | (DestinationResolutionDebug & {
      status: "unresolved";
      query: string;
      message: string;
      tripHints: DestinationTripHints;
      cards: [];
    });

type LocalDestination = TravelDestinationSearchResult & {
  aliases: string[];
  ambiguousGroup?: string;
};

const DROPDOWN_LOCAL_DESTINATIONS: LocalDestination[] =
  getDropdownDestinationContracts().map((destination) => ({
    id: `dropdown-${destination.key}`,
    canonicalName: destination.canonicalName,
    displayName: destination.nameEn,
    normalizedName: normalizeDestinationText(destination.canonicalName),
    nameEn: destination.nameEn,
    nameZh: destination.nameZh,
    countryCode: destination.countryCode,
    countryName: destination.countryNameEn,
    countryNameEn: destination.countryNameEn,
    countryNameZh: destination.countryNameZh,
    region: destination.region,
    city: destination.city,
    placeType: "city",
    latitude: destination.latitude,
    longitude: destination.longitude,
    popularityScore: destination.isPopular ? 94 : 72,
    source: "local_dropdown_contract",
    confidenceScore: destination.completenessScore >= 80 ? 0.98 : 0.9,
    isVerified: destination.dataQuality === "verified",
    isFeatured: destination.isPopular,
    showOnHome: destination.isPopular,
    aliases: destination.aliases,
    imageKey: normalizeDestinationContractKey(destination.nameEn),
    coverImageUrl: destination.coverImage?.imageUrl ?? null,
    dataQuality: destination.dataQuality,
    sourceStatus: destination.sourceStatus,
    completenessScore: destination.completenessScore,
    attractionCount: destination.attractions.length,
    missingFields: destination.missingFields,
  }));

const LOCAL_DESTINATIONS: LocalDestination[] = [
  {
    id: "local-europe-classic-route",
    canonicalName: "Europe Classic Route",
    displayName: "Europe Classic Route",
    normalizedName: "europe classic route",
    countryCode: null,
    countryName: "Europe",
    region: "Europe",
    city: "Paris",
    placeType: "route",
    latitude: 48.8566,
    longitude: 2.3522,
    popularityScore: 93,
    source: "curated_fallback",
    confidenceScore: 0.94,
    isVerified: true,
    aliases: [
      "europe",
      "europe trip",
      "europe route",
      "欧洲",
      "欧洲旅行",
      "欧洲路线",
    ],
    imageKey: "paris",
  },
  {
    id: "local-tokyo",
    canonicalName: "Tokyo",
    displayName: "Tokyo",
    normalizedName: "tokyo",
    countryCode: "JP",
    countryName: "Japan",
    region: "Tokyo",
    city: "Tokyo",
    placeType: "city",
    latitude: 35.6762,
    longitude: 139.6503,
    popularityScore: 98,
    source: "curated_fallback",
    confidenceScore: 0.98,
    isVerified: true,
    isFeatured: true,
    showOnHome: true,
    aliases: [
      "tokyo",
      "tokio",
      "东京",
      "東京",
      "とうきょう",
      "japan",
      "日本",
      "日本旅行",
    ],
    imageKey: "tokyo",
  },
  {
    id: "local-seoul",
    canonicalName: "Seoul",
    displayName: "Seoul",
    normalizedName: "seoul",
    countryCode: "KR",
    countryName: "South Korea",
    region: "Seoul",
    city: "Seoul",
    placeType: "city",
    latitude: 37.5665,
    longitude: 126.978,
    popularityScore: 96,
    source: "curated_fallback",
    confidenceScore: 0.98,
    isVerified: true,
    isFeatured: true,
    showOnHome: true,
    aliases: ["seoul", "首尔", "首爾", "서울", "korea", "south korea", "韩国", "韓國"],
    imageKey: "seoul",
  },
  {
    id: "local-paris",
    canonicalName: "Paris",
    displayName: "Paris",
    normalizedName: "paris",
    countryCode: "FR",
    countryName: "France",
    region: "Ile-de-France",
    city: "Paris",
    placeType: "city",
    latitude: 48.8566,
    longitude: 2.3522,
    popularityScore: 97,
    source: "curated_fallback",
    confidenceScore: 0.98,
    isVerified: true,
    isFeatured: true,
    showOnHome: true,
    aliases: ["paris", "巴黎", "france", "法国", "法國"],
    imageKey: "paris",
  },
  {
    id: "local-hong-kong",
    canonicalName: "Hong Kong",
    displayName: "Hong Kong",
    normalizedName: "hong kong",
    countryCode: "HK",
    countryName: "Hong Kong SAR",
    region: "Hong Kong",
    city: "Hong Kong",
    placeType: "city",
    latitude: 22.3193,
    longitude: 114.1694,
    popularityScore: 94,
    source: "curated_fallback",
    confidenceScore: 0.98,
    isVerified: true,
    isFeatured: true,
    showOnHome: true,
    aliases: ["hong kong", "hk", "香港", "xianggang"],
    imageKey: "hongkong",
  },
  {
    id: "local-singapore",
    canonicalName: "Singapore",
    displayName: "Singapore",
    normalizedName: "singapore",
    countryCode: "SG",
    countryName: "Singapore",
    region: "Singapore",
    city: "Singapore",
    placeType: "city",
    latitude: 1.3521,
    longitude: 103.8198,
    popularityScore: 95,
    source: "curated_fallback",
    confidenceScore: 0.98,
    isVerified: true,
    isFeatured: true,
    showOnHome: true,
    aliases: ["singapore", "singaproe", "新加坡", "sg"],
    imageKey: "singapore",
  },
  {
    id: "local-sydney",
    canonicalName: "Sydney",
    displayName: "Sydney",
    normalizedName: "sydney",
    countryCode: "AU",
    countryName: "Australia",
    region: "New South Wales",
    city: "Sydney",
    placeType: "city",
    latitude: -33.8688,
    longitude: 151.2093,
    popularityScore: 94,
    source: "curated_fallback",
    confidenceScore: 0.97,
    isVerified: true,
    isFeatured: true,
    showOnHome: true,
    aliases: ["sydney", "悉尼", "australia", "澳大利亚", "澳洲"],
    imageKey: "sydney",
  },
  {
    id: "local-london",
    canonicalName: "London",
    displayName: "London",
    normalizedName: "london",
    countryCode: "GB",
    countryName: "United Kingdom",
    region: "England",
    city: "London",
    placeType: "city",
    latitude: 51.5072,
    longitude: -0.1276,
    popularityScore: 96,
    source: "curated_fallback",
    confidenceScore: 0.98,
    isVerified: true,
    isFeatured: true,
    showOnHome: true,
    aliases: ["london", "伦敦", "英伦", "united kingdom", "uk", "英国"],
    imageKey: "london",
  },
  {
    id: "local-beijing",
    canonicalName: "Beijing",
    displayName: "Beijing",
    normalizedName: "beijing",
    countryCode: "CN",
    countryName: "China",
    region: "Beijing",
    city: "Beijing",
    placeType: "city",
    latitude: 39.9042,
    longitude: 116.4074,
    popularityScore: 90,
    source: "curated_fallback",
    confidenceScore: 0.97,
    isVerified: true,
    isFeatured: true,
    showOnHome: true,
    aliases: ["beijing", "北京", "china", "中国"],
    imageKey: "beijing",
  },
  {
    id: "local-changsha",
    canonicalName: "Changsha",
    displayName: "Changsha",
    normalizedName: "changsha",
    nameEn: "Changsha",
    nameZh: "长沙",
    countryCode: "CN",
    countryName: "China",
    countryNameEn: "China",
    countryNameZh: "中国",
    region: "Hunan",
    city: "Changsha",
    placeType: "city",
    latitude: 28.2282,
    longitude: 112.9388,
    popularityScore: 87,
    source: "curated_fallback",
    confidenceScore: 0.97,
    isVerified: true,
    aliases: ["changsha", "长沙", "长沙市", "hunan changsha", "湖南长沙"],
    imageKey: "changsha",
    dataQuality: "incomplete",
    sourceStatus: "local_cached",
    completenessScore: 45,
    attractionCount: 0,
    missingFields: ["cover_image", "attractions", "attraction_images"],
  },
  {
    id: "local-changchun",
    canonicalName: "Changchun",
    displayName: "Changchun",
    normalizedName: "changchun",
    nameEn: "Changchun",
    nameZh: "长春",
    countryCode: "CN",
    countryName: "China",
    countryNameEn: "China",
    countryNameZh: "中国",
    region: "Jilin",
    city: "Changchun",
    placeType: "city",
    latitude: 43.8171,
    longitude: 125.3235,
    popularityScore: 70,
    source: "curated_fallback",
    confidenceScore: 0.92,
    isVerified: true,
    aliases: ["changchun", "长春", "长春市"],
    imageKey: "changchun",
    dataQuality: "incomplete",
    sourceStatus: "local_cached",
    completenessScore: 40,
    attractionCount: 0,
    missingFields: ["cover_image", "attractions", "attraction_images"],
  },
  {
    id: "local-san-francisco",
    canonicalName: "San Francisco",
    displayName: "San Francisco",
    normalizedName: "san francisco",
    countryCode: "US",
    countryName: "United States",
    region: "California",
    city: "San Francisco",
    placeType: "city",
    latitude: 37.7749,
    longitude: -122.4194,
    popularityScore: 89,
    source: "curated_fallback",
    confidenceScore: 0.96,
    isVerified: true,
    isFeatured: true,
    showOnHome: true,
    aliases: ["san francisco", "sf", "旧金山", "舊金山"],
    imageKey: "sanfrancisco",
  },
  {
    id: "local-dubai",
    canonicalName: "Dubai",
    displayName: "Dubai",
    normalizedName: "dubai",
    countryCode: "AE",
    countryName: "United Arab Emirates",
    region: "Dubai",
    city: "Dubai",
    placeType: "city",
    latitude: 25.2048,
    longitude: 55.2708,
    popularityScore: 91,
    source: "curated_fallback",
    confidenceScore: 0.97,
    isVerified: true,
    isFeatured: true,
    showOnHome: true,
    aliases: ["dubai", "迪拜", "uae", "united arab emirates", "阿联酋"],
    imageKey: "dubai",
  },
  {
    id: "local-bali",
    canonicalName: "Bali",
    displayName: "Bali",
    normalizedName: "bali",
    countryCode: "ID",
    countryName: "Indonesia",
    region: "Bali",
    city: "Bali",
    placeType: "island",
    latitude: -8.3405,
    longitude: 115.092,
    popularityScore: 92,
    source: "curated_fallback",
    confidenceScore: 0.97,
    isVerified: true,
    isFeatured: true,
    showOnHome: true,
    aliases: ["bali", "巴厘岛", "峇里岛", "indonesia", "印度尼西亚"],
    imageKey: "bali",
  },
  {
    id: "local-kyoto",
    canonicalName: "Kyoto",
    displayName: "Kyoto",
    normalizedName: "kyoto",
    countryCode: "JP",
    countryName: "Japan",
    region: "Kyoto",
    city: "Kyoto",
    placeType: "city",
    latitude: 35.0116,
    longitude: 135.7681,
    popularityScore: 92,
    source: "curated_fallback",
    confidenceScore: 0.97,
    isVerified: true,
    aliases: ["kyoto", "京都"],
    imageKey: "kyoto",
  },
  {
    id: "local-bangkok",
    canonicalName: "Bangkok",
    displayName: "Bangkok",
    normalizedName: "bangkok",
    countryCode: "TH",
    countryName: "Thailand",
    region: "Bangkok",
    city: "Bangkok",
    placeType: "city",
    latitude: 13.7563,
    longitude: 100.5018,
    popularityScore: 93,
    source: "curated_fallback",
    confidenceScore: 0.97,
    isVerified: true,
    aliases: ["bangkok", "bankok", "曼谷", "thailand", "泰国", "泰國"],
    imageKey: "bangkok",
  },
  {
    id: "local-new-york",
    canonicalName: "New York",
    displayName: "New York",
    normalizedName: "new york",
    countryCode: "US",
    countryName: "United States",
    region: "New York",
    city: "New York",
    placeType: "city",
    latitude: 40.7128,
    longitude: -74.006,
    popularityScore: 94,
    source: "curated_fallback",
    confidenceScore: 0.97,
    isVerified: true,
    aliases: ["new york", "nyc", "纽约", "紐約"],
    imageKey: "newyork",
  },
  {
    id: "local-osaka",
    canonicalName: "Osaka",
    displayName: "Osaka",
    normalizedName: "osaka",
    countryCode: "JP",
    countryName: "Japan",
    region: "Osaka",
    city: "Osaka",
    placeType: "city",
    latitude: 34.6937,
    longitude: 135.5023,
    popularityScore: 91,
    source: "curated_fallback",
    confidenceScore: 0.97,
    isVerified: true,
    aliases: ["osaka", "大阪"],
    imageKey: "osaka",
  },
  {
    id: "local-nara",
    canonicalName: "Nara",
    displayName: "Nara",
    normalizedName: "nara",
    countryCode: "JP",
    countryName: "Japan",
    region: "Nara",
    city: "Nara",
    placeType: "city",
    latitude: 34.6851,
    longitude: 135.8048,
    popularityScore: 82,
    source: "curated_fallback",
    confidenceScore: 0.96,
    isVerified: true,
    aliases: ["nara", "奈良"],
    imageKey: "nara",
  },
  {
    id: "local-nagasaki",
    canonicalName: "Nagasaki",
    displayName: "Nagasaki",
    normalizedName: "nagasaki",
    nameEn: "Nagasaki",
    nameZh: "长崎",
    countryCode: "JP",
    countryName: "Japan",
    countryNameEn: "Japan",
    countryNameZh: "日本",
    region: "Nagasaki",
    city: "Nagasaki",
    placeType: "city",
    latitude: 32.7503,
    longitude: 129.8777,
    popularityScore: 71,
    source: "curated_fallback",
    confidenceScore: 0.92,
    isVerified: true,
    aliases: ["nagasaki", "长崎", "長崎"],
    imageKey: "nagasaki",
    dataQuality: "incomplete",
    sourceStatus: "local_cached",
    completenessScore: 40,
    attractionCount: 0,
    missingFields: ["cover_image", "attractions", "attraction_images"],
  },
  {
    id: "local-macau",
    canonicalName: "Macau",
    displayName: "Macau",
    normalizedName: "macau",
    countryCode: "MO",
    countryName: "Macau SAR",
    region: "Macau",
    city: "Macau",
    placeType: "city",
    latitude: 22.1987,
    longitude: 113.5439,
    popularityScore: 86,
    source: "curated_fallback",
    confidenceScore: 0.97,
    isVerified: true,
    aliases: ["macau", "macao", "澳门", "澳門"],
    imageKey: "macau",
  },
  {
    id: "local-nice",
    canonicalName: "Nice",
    displayName: "Nice",
    normalizedName: "nice",
    countryCode: "FR",
    countryName: "France",
    region: "Provence-Alpes-Cote d'Azur",
    city: "Nice",
    placeType: "city",
    latitude: 43.7102,
    longitude: 7.262,
    popularityScore: 84,
    source: "curated_fallback",
    confidenceScore: 0.96,
    isVerified: true,
    aliases: ["nice", "尼斯"],
    imageKey: "nice",
  },
  {
    id: "local-monaco",
    canonicalName: "Monaco",
    displayName: "Monaco",
    normalizedName: "monaco",
    countryCode: "MC",
    countryName: "Monaco",
    region: "Monaco",
    city: "Monaco",
    placeType: "city",
    latitude: 43.7384,
    longitude: 7.4246,
    popularityScore: 82,
    source: "curated_fallback",
    confidenceScore: 0.96,
    isVerified: true,
    aliases: ["monaco", "摩纳哥", "摩納哥"],
    imageKey: "monaco",
  },
  {
    id: "local-tromso",
    canonicalName: "Tromso",
    displayName: "Tromso",
    normalizedName: "tromso",
    countryCode: "NO",
    countryName: "Norway",
    region: "Troms",
    city: "Tromso",
    placeType: "city",
    latitude: 69.6492,
    longitude: 18.9553,
    popularityScore: 76,
    source: "curated_fallback",
    confidenceScore: 0.95,
    isVerified: true,
    aliases: ["tromso", "tromsø", "特罗姆瑟", "特羅姆瑟"],
    imageKey: "tromso",
  },
  {
    id: "local-matera",
    canonicalName: "Matera",
    displayName: "Matera",
    normalizedName: "matera",
    countryCode: "IT",
    countryName: "Italy",
    region: "Basilicata",
    city: "Matera",
    placeType: "city",
    latitude: 40.6664,
    longitude: 16.6043,
    popularityScore: 75,
    source: "curated_fallback",
    confidenceScore: 0.95,
    isVerified: true,
    aliases: ["matera", "马泰拉", "馬泰拉"],
    imageKey: "matera",
  },
  {
    id: "local-zhangjiajie",
    canonicalName: "Zhangjiajie",
    displayName: "Zhangjiajie",
    normalizedName: "zhangjiajie",
    countryCode: "CN",
    countryName: "China",
    region: "Hunan",
    city: "Zhangjiajie",
    placeType: "city",
    latitude: 29.1171,
    longitude: 110.4792,
    popularityScore: 79,
    source: "curated_fallback",
    confidenceScore: 0.96,
    isVerified: true,
    aliases: ["zhangjiajie", "张家界", "張家界"],
    imageKey: "zhangjiajie",
  },
  {
    id: "local-gjirokaster",
    canonicalName: "Gjirokaster",
    displayName: "Gjirokaster",
    normalizedName: "gjirokaster",
    countryCode: "AL",
    countryName: "Albania",
    region: "Gjirokaster",
    city: "Gjirokaster",
    placeType: "city",
    latitude: 40.0758,
    longitude: 20.1389,
    popularityScore: 66,
    source: "curated_fallback",
    confidenceScore: 0.93,
    isVerified: true,
    aliases: ["gjirokaster", "gjirokastër", "吉诺卡斯特"],
    imageKey: "gjirokaster",
  },
  {
    id: "local-svaneti",
    canonicalName: "Svaneti",
    displayName: "Svaneti",
    normalizedName: "svaneti",
    countryCode: "GE",
    countryName: "Georgia",
    region: "Samegrelo-Zemo Svaneti",
    city: "Mestia",
    placeType: "region",
    latitude: 43.043,
    longitude: 42.729,
    popularityScore: 68,
    source: "curated_fallback",
    confidenceScore: 0.93,
    isVerified: true,
    aliases: ["svaneti", "斯瓦涅季", "mestia", "梅斯蒂亚"],
    imageKey: "svaneti",
  },
  {
    id: "local-jiufen",
    canonicalName: "Jiufen",
    displayName: "Jiufen",
    normalizedName: "jiufen",
    countryCode: "TW",
    countryName: "Taiwan",
    region: "New Taipei",
    city: "Jiufen",
    placeType: "town",
    latitude: 25.1099,
    longitude: 121.8452,
    popularityScore: 72,
    source: "curated_fallback",
    confidenceScore: 0.95,
    isVerified: true,
    aliases: ["jiufen", "九份"],
    imageKey: "jiufen",
  },
  {
    id: "local-pingxi",
    canonicalName: "Pingxi",
    displayName: "Pingxi",
    normalizedName: "pingxi",
    countryCode: "TW",
    countryName: "Taiwan",
    region: "New Taipei",
    city: "Pingxi",
    placeType: "town",
    latitude: 25.0257,
    longitude: 121.7384,
    popularityScore: 70,
    source: "curated_fallback",
    confidenceScore: 0.95,
    isVerified: true,
    aliases: ["pingxi", "平溪"],
    imageKey: "pingxi",
  },
  {
    id: "local-okinawa",
    canonicalName: "Okinawa",
    displayName: "Okinawa",
    normalizedName: "okinawa",
    countryCode: "JP",
    countryName: "Japan",
    region: "Okinawa",
    city: "Okinawa",
    placeType: "region",
    latitude: 26.5013,
    longitude: 127.9454,
    popularityScore: 84,
    source: "curated_fallback",
    confidenceScore: 0.95,
    isVerified: true,
    aliases: ["okinawa", "冲绳", "沖繩", "small island in okinawa"],
    imageKey: "okinawa",
  },
  {
    id: "local-georgia-country",
    canonicalName: "Georgia",
    displayName: "Georgia",
    normalizedName: "georgia",
    countryCode: "GE",
    countryName: "Georgia",
    region: "Georgia",
    city: null,
    placeType: "country",
    latitude: 42.3154,
    longitude: 43.3569,
    popularityScore: 82,
    source: "curated_fallback",
    confidenceScore: 0.92,
    isVerified: true,
    aliases: ["georgia", "格鲁吉亚", "格魯吉亞"],
    ambiguousGroup: "georgia",
    imageKey: "georgia",
  },
  {
    id: "local-georgia-us",
    canonicalName: "Georgia, United States",
    displayName: "Georgia, United States",
    normalizedName: "georgia united states",
    countryCode: "US",
    countryName: "United States",
    region: "Georgia",
    city: "Atlanta",
    placeType: "region",
    latitude: 32.1656,
    longitude: -82.9001,
    popularityScore: 78,
    source: "curated_fallback",
    confidenceScore: 0.9,
    isVerified: true,
    aliases: ["georgia state", "georgia usa", "georgia us", "美国乔治亚", "美國喬治亞"],
    ambiguousGroup: "georgia",
    imageKey: "atlanta",
  },
  {
    id: "local-san-jose-cr",
    canonicalName: "San Jose",
    displayName: "San Jose, Costa Rica",
    normalizedName: "san jose costa rica",
    countryCode: "CR",
    countryName: "Costa Rica",
    region: "San Jose",
    city: "San Jose",
    placeType: "city",
    latitude: 9.9281,
    longitude: -84.0907,
    popularityScore: 77,
    source: "curated_fallback",
    confidenceScore: 0.91,
    isVerified: true,
    aliases: ["san jose", "san josé", "圣何塞"],
    ambiguousGroup: "san jose",
    imageKey: "sanjose",
  },
  {
    id: "local-san-jose-us",
    canonicalName: "San Jose, California",
    displayName: "San Jose, California",
    normalizedName: "san jose california",
    countryCode: "US",
    countryName: "United States",
    region: "California",
    city: "San Jose",
    placeType: "city",
    latitude: 37.3382,
    longitude: -121.8863,
    popularityScore: 78,
    source: "curated_fallback",
    confidenceScore: 0.91,
    isVerified: true,
    aliases: ["san jose california", "san jose ca", "硅谷圣何塞"],
    ambiguousGroup: "san jose",
    imageKey: "sanjose",
  },
  {
    id: "local-springfield-il",
    canonicalName: "Springfield, Illinois",
    displayName: "Springfield, Illinois",
    normalizedName: "springfield illinois",
    countryCode: "US",
    countryName: "United States",
    region: "Illinois",
    city: "Springfield",
    placeType: "city",
    latitude: 39.7817,
    longitude: -89.6501,
    popularityScore: 61,
    source: "curated_fallback",
    confidenceScore: 0.88,
    isVerified: true,
    aliases: ["springfield", "springfield illinois"],
    ambiguousGroup: "springfield",
    imageKey: null,
  },
  {
    id: "local-springfield-ma",
    canonicalName: "Springfield, Massachusetts",
    displayName: "Springfield, Massachusetts",
    normalizedName: "springfield massachusetts",
    countryCode: "US",
    countryName: "United States",
    region: "Massachusetts",
    city: "Springfield",
    placeType: "city",
    latitude: 42.1015,
    longitude: -72.5898,
    popularityScore: 60,
    source: "curated_fallback",
    confidenceScore: 0.88,
    isVerified: true,
    aliases: ["springfield massachusetts", "springfield ma"],
    ambiguousGroup: "springfield",
    imageKey: null,
  },
  {
    id: "local-victoria-bc",
    canonicalName: "Victoria",
    displayName: "Victoria, British Columbia",
    normalizedName: "victoria british columbia",
    countryCode: "CA",
    countryName: "Canada",
    region: "British Columbia",
    city: "Victoria",
    placeType: "city",
    latitude: 48.4284,
    longitude: -123.3656,
    popularityScore: 76,
    source: "curated_fallback",
    confidenceScore: 0.9,
    isVerified: true,
    aliases: ["victoria", "victoria bc", "维多利亚"],
    ambiguousGroup: "victoria",
    imageKey: "victoria",
  },
  {
    id: "local-victoria-au",
    canonicalName: "Victoria, Australia",
    displayName: "Victoria, Australia",
    normalizedName: "victoria australia",
    countryCode: "AU",
    countryName: "Australia",
    region: "Victoria",
    city: "Melbourne",
    placeType: "region",
    latitude: -37.4713,
    longitude: 144.7852,
    popularityScore: 82,
    source: "curated_fallback",
    confidenceScore: 0.9,
    isVerified: true,
    aliases: ["victoria australia", "澳洲维多利亚", "維多利亞州"],
    ambiguousGroup: "victoria",
    imageKey: "melbourne",
  },
  {
    id: "local-granada-es",
    canonicalName: "Granada",
    displayName: "Granada, Spain",
    normalizedName: "granada spain",
    countryCode: "ES",
    countryName: "Spain",
    region: "Andalusia",
    city: "Granada",
    placeType: "city",
    latitude: 37.1773,
    longitude: -3.5986,
    popularityScore: 83,
    source: "curated_fallback",
    confidenceScore: 0.91,
    isVerified: true,
    aliases: ["granada", "granada spain", "格拉纳达"],
    ambiguousGroup: "granada",
    imageKey: "granada",
  },
  {
    id: "local-granada-ni",
    canonicalName: "Granada, Nicaragua",
    displayName: "Granada, Nicaragua",
    normalizedName: "granada nicaragua",
    countryCode: "NI",
    countryName: "Nicaragua",
    region: "Granada",
    city: "Granada",
    placeType: "city",
    latitude: 11.9344,
    longitude: -85.956,
    popularityScore: 70,
    source: "curated_fallback",
    confidenceScore: 0.89,
    isVerified: true,
    aliases: ["granada nicaragua", "尼加拉瓜格拉纳达"],
    ambiguousGroup: "granada",
    imageKey: "granada",
  },
];

const DROPDOWN_DESTINATION_KEYS = new Set(
  DROPDOWN_LOCAL_DESTINATIONS.map(
    (destination) =>
      `${normalizeDestinationText(destination.canonicalName)}|${destination.countryCode ?? ""}`
  )
);

const ALL_LOCAL_DESTINATIONS: LocalDestination[] = [
  ...DROPDOWN_LOCAL_DESTINATIONS,
  ...LOCAL_DESTINATIONS.filter((destination) => {
    const key = `${normalizeDestinationText(destination.canonicalName)}|${destination.countryCode ?? ""}`;
    return !DROPDOWN_DESTINATION_KEYS.has(key);
  }),
];

const AMBIGUOUS_QUERY_LABELS: Record<string, string> = {
  georgia: "你说的是格鲁吉亚这个国家，还是美国 Georgia 州？",
  "san jose": "你说的是哥斯达黎加 San Jose，还是美国加州 San Jose？",
  springfield: "Springfield 有很多同名城市。你想去哪个州或国家的 Springfield？",
  victoria: "你说的是加拿大 Victoria，还是澳大利亚 Victoria 州？",
  granada: "你说的是西班牙 Granada，还是尼加拉瓜 Granada？",
};

const STOP_WORDS = new Set([
  "plan",
  "trip",
  "travel",
  "to",
  "a",
  "an",
  "the",
  "for",
  "days",
  "day",
  "weekend",
  "please",
  "帮我",
  "帮",
  "计划",
  "规划",
  "旅行",
  "旅游",
  "路线",
  "行程",
  "天",
  "做一个",
  "怎么玩",
]);

const RAW_PROMPT_DESTINATION_PATTERNS = [
  /^我想去(.+)$/,
  /^我想要去(.+)$/,
  /^我想要区(.+)$/,
  /^我想要(.+)$/,
  /^想去(.+)$/,
  /^我要去(.+)$/,
  /^我要区(.+)$/,
  /^我想去(.+)旅行$/,
  /^想去(.+)旅行$/,
  /^i want to (?:visit|go to|travel to) (.+)$/i,
  /^i'?d like to (?:visit|go to|travel to) (.+)$/i,
];

const UNDECIDED_DESTINATION_PATTERNS = [
  /我不知道去哪/,
  /不知道去哪/,
  /不确定去哪/,
  /not sure where to go/i,
  /do not know where to go/i,
  /don't know where to go/i,
];

const EDIT_INTENT_PATTERNS = [
  /(删除|删掉|移除|去掉|重排|调整|修改|换到|改成|刷新|重做|重新安排|第二天|第[一二三四五六七八九十\d]+天)/,
  /\b(delete|remove|reorder|refresh|change|edit|revise|move|replace)\b/i,
];

const REMOVE_ITEM_INTENT_PATTERNS = [
  /^(?:不要|别要|不想要|删除|删掉|移除|去掉)(?:这个|这个卡片|这张卡片|它|此项)?$/u,
  /^(?:这个|这张卡片|它)(?:不要|删掉|删除|移除|去掉)$/u,
  /^(?:不要|别安排|不安排|删除|删掉|移除|去掉).{1,20}$/u,
  /我不(?:喜欢|想去|想要).{0,12}(?:这个|景点|卡片|地方)?$/u,
  /\b(?:remove|delete|drop)\s+(?:this|this card|it)\b/i,
  /\b(?:remove|delete|drop)\s+.{1,40}$/i,
];

const REPLACE_ITEM_INTENT_PATTERNS = [
  /^(?:换一个|换个|换一下|换掉|替换|换成)$/u,
  /(?:换掉|替换|换成|改成)/u,
  /\b(?:replace|swap|change)\b/i,
];

const CLARIFY_COMMAND_PATTERNS = [
  /^(?:换一个|换个|改一下|不要|太累了|这个太远了|重新来|重新生成)$/u,
  /^(?:too far|too tiring|try again|redo|another one)$/i,
];

const MODIFY_ITINERARY_INTENT_PATTERNS = [
  /(?:太满|太累|轻松一点|节奏|晚上不要|不要安排|重新安排|重排|调整|修改|改一下|删除第[一二三四五六七八九十\d]+天)/u,
  /\b(?:lighter|relax|too full|too tiring|revise|adjust|reschedule)\b/i,
];

const NON_DESTINATION_QUESTION_PATTERNS = [
  /(签证|申根|保险|护照|材料|准备什么|需要买吗|可以带|安全吗|退改|报销)/,
  /\b(visa|insurance|passport|document|documents|refund|question)\b/i,
];

const DESTINATION_CONTEXT_PATTERNS = [
  /(想去|我要去|我想要去|我想要区|计划|规划|旅行|旅游|路线|行程|怎么玩|目的地|周末游)/,
  /\b(plan|trip|travel|visit|go to|destination|itinerary|weekend)\b/i,
];

const DESTINATION_PREFIX_PATTERNS = [
  /^(?:我想要去|我想要区|我想去|我要去|我要区|想去|去|想要去|想要区|想要|我要|我想要)\s*/u,
  /^(?:请)?帮我(?:做|规划|计划)?(?:一个)?\s*/u,
  /^(?:做|规划|计划)(?:一个)?\s*/u,
  /^(?:i want to|i would like to|i'd like to|help me|please)?\s*(?:plan(?: a)?(?: trip)?(?: to)?|visit|go to|travel to)\s*/i,
];

const DESTINATION_SUFFIX_PATTERNS = [
  /(?:旅行计划|旅游计划|旅行路线|旅游路线|行程规划|旅行|旅游|路线|行程|攻略|怎么玩|玩|周末游)$/u,
  /\b(?:travel plan|trip plan|itinerary|travel|trip|city)$/i,
];

const SHORT_AMBIGUOUS_DESTINATION_IDS: Record<string, string[]> = {
  长: ["Changsha", "Changchun", "Nagasaki"],
};

const COUNTRY_DEFAULT_DESTINATIONS: Record<string, string> = {
  japan: "Tokyo",
  jp: "Tokyo",
  日本: "Tokyo",
};

function toNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizeDestinationText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/ø/g, "o")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function parseChineseNumber(value: string): number | null {
  const digits: Record<string, number> = {
    零: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized === "十") return 10;
  if (!normalized.includes("十")) {
    return normalized.split("").reduce((total, char) => {
      const digit = digits[char];
      return typeof digit === "number" ? total * 10 + digit : Number.NaN;
    }, 0);
  }

  const [tensText, onesText] = normalized.split("十");
  const tens = tensText ? digits[tensText] : 1;
  const ones = onesText ? digits[onesText] : 0;
  if (typeof tens !== "number" || typeof ones !== "number") return null;
  return tens * 10 + ones;
}

function unitMultiplier(unit: string): number {
  return /week|周|星期/i.test(unit) ? 7 : 1;
}

function isOrdinalDurationMatch(value: string, index: number | undefined): boolean {
  if (typeof index !== "number" || index <= 0) return false;
  return value[index - 1] === "第";
}

export function extractTravelDuration(value: string): TravelIntentDuration | null {
  const raw = value.trim();
  const digitRange = raw.match(
    /(\d{1,2})\s*(?:-|~|至|到|—|–)\s*(\d{1,2})\s*(天|日|days?|weeks?|周|星期)/i
  );
  if (digitRange && !isOrdinalDurationMatch(raw, digitRange.index)) {
    const multiplier = unitMultiplier(digitRange[3] ?? "");
    const left = Number.parseInt(digitRange[1] ?? "", 10) * multiplier;
    const right = Number.parseInt(digitRange[2] ?? "", 10) * multiplier;
    if (Number.isFinite(left) && Number.isFinite(right)) {
      return {
        minDays: Math.min(left, right),
        maxDays: Math.max(left, right),
        raw: digitRange[0],
      };
    }
  }

  const chineseRange = raw.match(
    /([一二两三四五六七八九十]{1,3})\s*(?:-|~|至|到|—|–)\s*([一二两三四五六七八九十]{1,3})\s*(天|日|周|星期)/
  );
  if (chineseRange && !isOrdinalDurationMatch(raw, chineseRange.index)) {
    const multiplier = unitMultiplier(chineseRange[3] ?? "");
    const left = parseChineseNumber(chineseRange[1] ?? "");
    const right = parseChineseNumber(chineseRange[2] ?? "");
    if (left && right) {
      return {
        minDays: Math.min(left * multiplier, right * multiplier),
        maxDays: Math.max(left * multiplier, right * multiplier),
        raw: chineseRange[0],
      };
    }
  }

  const digitSingle = raw.match(/(\d{1,2})\s*(天|日|days?|weeks?|周|星期)/i);
  if (digitSingle && !isOrdinalDurationMatch(raw, digitSingle.index)) {
    const days = Number.parseInt(digitSingle[1] ?? "", 10) * unitMultiplier(digitSingle[2] ?? "");
    if (Number.isFinite(days) && days > 0) {
      return { minDays: days, maxDays: days, raw: digitSingle[0] };
    }
  }

  const chineseSingle = raw.match(/([一二两三四五六七八九十]{1,3})\s*(天|日|周|星期)/);
  if (chineseSingle && !isOrdinalDurationMatch(raw, chineseSingle.index)) {
    const parsed = parseChineseNumber(chineseSingle[1] ?? "");
    if (parsed) {
      const days = parsed * unitMultiplier(chineseSingle[2] ?? "");
      return { minDays: days, maxDays: days, raw: chineseSingle[0] };
    }
  }

  if (/weekend|周末/i.test(raw)) {
    const match = raw.match(/weekend|周末/i);
    return { minDays: 2, maxDays: 2, raw: match?.[0] ?? "weekend" };
  }

  return null;
}

function removeDurationText(value: string): string {
  return value
    .replace(/\d{1,2}\s*(?:-|~|至|到|—|–)\s*\d{1,2}\s*(?:天|日|days?|weeks?|周|星期)/gi, " ")
    .replace(/[一二两三四五六七八九十]{1,3}\s*(?:-|~|至|到|—|–)\s*[一二两三四五六七八九十]{1,3}\s*(?:天|日|周|星期)/g, " ")
    .replace(/\d{1,2}\s*(?:天|日|days?|weeks?|周|星期)/gi, " ")
    .replace(/[一二两三四五六七八九十]{1,3}\s*(?:天|日|周|星期)/g, " ")
    .replace(/weekend|周末/gi, " ");
}

export function normalizeUserUtterance(value: string): string {
  return value
    .trim()
    .replace(/[。.!！?？]+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/我想要区(?=[\u3400-\u9fffA-Za-z])/gu, "我想要去")
    .replace(/我要区(?=[\u3400-\u9fffA-Za-z])/gu, "我要去")
    .replace(/想区(?=[\u3400-\u9fffA-Za-z])/gu, "想去")
    .trim();
}

export function normalizeDestinationCandidate(
  raw: string,
  locale: "zh" | "en" | string = "zh"
): {
  raw: string;
  normalized: string;
  confidence: number;
  resolutionMethod: DestinationResolutionMethod;
} {
  const original = raw.trim();
  let candidate = normalizeUserUtterance(original);
  let method: DestinationResolutionMethod = "raw_extraction";
  let confidence = /[A-Za-z\u3400-\u9fff]/.test(candidate) ? 0.68 : 0.2;

  candidate = removeDurationText(candidate)
    .replace(/[，,；;].*$/u, " ")
    .replace(/\bfor\s*$/i, " ")
    .trim();

  let changed = true;
  while (changed) {
    const before = candidate;
    for (const pattern of DESTINATION_PREFIX_PATTERNS) {
      candidate = candidate.replace(pattern, "").trim();
    }
    changed = before !== candidate;
  }

  if (/^区(?=[\u3400-\u9fff]{2,})/u.test(candidate)) {
    candidate = candidate.replace(/^区/u, "").trim();
    method = "typo_alias_correction";
    confidence = 0.92;
  }

  for (const pattern of DESTINATION_SUFFIX_PATTERNS) {
    candidate = candidate.replace(pattern, "").trim();
  }

  candidate = candidate
    .replace(/^(?:中国|日本|美国|英国|法国|韩国|泰国|新加坡)\s*(?=[\u3400-\u9fff]{2,})/u, (match) =>
      locale === "zh" && match.length <= 2 ? match : ""
    )
    .replace(/\s+(?:city)$/i, "")
    .replace(/市$/u, "")
    .replace(/^[去到]\s*/u, "")
    .replace(/\s+/g, " ")
    .trim();

  const compact = normalizeDestinationText(candidate);
  return {
    raw: original,
    normalized: compact,
    confidence: compact ? confidence : 0,
    resolutionMethod: method,
  };
}

function classifyTravelIntent(value: string): TravelIntentKind {
  const normalized = normalizeUserUtterance(value);
  if (CLARIFY_COMMAND_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "clarify_needed";
  }
  if (REPLACE_ITEM_INTENT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "replace_item";
  }
  if (REMOVE_ITEM_INTENT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "remove_item";
  }
  if (MODIFY_ITINERARY_INTENT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "modify_itinerary";
  }
  if (EDIT_INTENT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "edit_itinerary";
  }
  const hasNonDestinationQuestion = NON_DESTINATION_QUESTION_PATTERNS.some((pattern) =>
    pattern.test(normalized)
  );
  const hasExplicitDestinationRequest =
    /(想去|我要去|我想要去|我想要区|计划|规划|目的地)/.test(normalized) ||
    /\b(plan|visit|go to|travel to|destination)\b/i.test(normalized);
  if (hasNonDestinationQuestion && !hasExplicitDestinationRequest) {
    return "ask_question";
  }
  if (DESTINATION_CONTEXT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return /计划|规划|行程|路线|plan|itinerary/i.test(normalized)
      ? "plan_trip"
      : "choose_destination";
  }
  if (hasNonDestinationQuestion) {
    return "ask_question";
  }
  if (normalized.split(/\s+/).filter(Boolean).length <= 4 && /[A-Za-z\u3400-\u9fff]/.test(normalized)) {
    return "choose_destination";
  }
  return "unknown";
}

function isTravelCommandIntent(intent: TravelIntentKind): boolean {
  return (
    intent === "edit_itinerary" ||
    intent === "modify_itinerary" ||
    intent === "remove_item" ||
    intent === "replace_item" ||
    intent === "clarify_needed"
  );
}

function rawMentionForDestination(
  rawText: string,
  destination: TravelDestinationSearchResult
): string {
  const aliases = destinationAliases(destination).sort((left, right) => right.length - left.length);
  const normalizedRaw = normalizeDestinationText(rawText);
  for (const alias of aliases) {
    const normalizedAlias = normalizeDestinationText(alias);
    if (!normalizedAlias) continue;
    if (normalizedRaw.includes(`区${normalizedAlias}`)) return `区${alias}`;
    if (queryContainsAlias(normalizedRaw, normalizedAlias)) return alias;
  }
  return destination.displayName;
}

function toIntentDestinationCandidate(
  raw: string,
  destination: TravelDestinationSearchResult | null,
  fallback: ReturnType<typeof normalizeDestinationCandidate>,
  method: DestinationResolutionMethod
): TravelIntentDestinationCandidate {
  return {
    raw,
    normalized: fallback.normalized,
    canonicalName: destination?.canonicalName ?? null,
    nameZh: destination?.nameZh ?? null,
    countryCode: destination?.countryCode ?? null,
    confidence: destination
      ? Math.max(fallback.confidence, destination.confidenceScore)
      : fallback.confidence,
    resolutionMethod: destination ? method : fallback.resolutionMethod,
  };
}

function shortAmbiguousOptions(query: string): LocalDestination[] {
  const normalized = normalizeDestinationText(query);
  const identifiers = SHORT_AMBIGUOUS_DESTINATION_IDS[normalized];
  if (!identifiers) return [];
  return identifiers
    .map((identifier) => {
      const normalizedIdentifier = normalizeDestinationText(identifier);
      return ALL_LOCAL_DESTINATIONS.find(
        (destination) =>
          destination.id === identifier ||
          normalizeDestinationText(destination.canonicalName) === normalizedIdentifier
      );
    })
    .filter((destination): destination is LocalDestination => Boolean(destination));
}

function clarificationForQuery(
  query: string
): { question: string; options: TravelDestinationSearchResult[] } | null {
  const shortOptions = shortAmbiguousOptions(query);
  if (shortOptions.length > 1) {
    return {
      question: "你是想去长沙、长春，还是长崎？",
      options: shortOptions,
    };
  }

  const ambiguous = ambiguousGroupForQuery(query);
  if (!ambiguous) return null;
  const group = ambiguous[0].ambiguousGroup ?? "destination";
  return {
    question:
      AMBIGUOUS_QUERY_LABELS[group] ?? "这个目的地有多个可能选项，请先确认具体地区。",
    options: ambiguous,
  };
}

export function canonicalizeDestination(
  rawCandidate: string,
  locale: "zh" | "en" | string = "zh"
): TravelIntentDestinationCandidate {
  const normalized = normalizeDestinationCandidate(rawCandidate, locale);
  if (!normalized.normalized) {
    return toIntentDestinationCandidate(rawCandidate, null, normalized, "unresolved");
  }

  const countryDefault = countryDefaultDestinationForQuery(normalized.normalized);
  if (countryDefault) {
    return toIntentDestinationCandidate(
      rawCandidate,
      countryDefault,
      normalized,
      "alias_match"
    );
  }

  const mentioned = findMentionedDestinations(normalized.normalized)[0];
  if (mentioned) {
    const method =
      normalized.resolutionMethod === "typo_alias_correction"
        ? "typo_alias_correction"
        : normalizeDestinationText(mentioned.canonicalName) === normalized.normalized
          ? "exact_local"
          : mentioned.nameZh && normalizeDestinationText(mentioned.nameZh) === normalized.normalized
            ? "localized_name_match"
            : "alias_match";
    return toIntentDestinationCandidate(rawCandidate, mentioned, normalized, method);
  }

  const fuzzy = searchLocalDestinations(normalized.normalized, { limit: 1 })[0];
  if (fuzzy) {
    return toIntentDestinationCandidate(rawCandidate, fuzzy, normalized, "fuzzy_match");
  }

  if (clarificationForQuery(normalized.normalized)) {
    return toIntentDestinationCandidate(rawCandidate, null, normalized, "ambiguous");
  }

  return toIntentDestinationCandidate(rawCandidate, null, normalized, "unresolved");
}

export function extractDestinationCandidates(
  message: string,
  locale: "zh" | "en" | string = "zh"
): TravelIntentDestinationCandidate[] {
  const intent = classifyTravelIntent(message);
  if (isTravelCommandIntent(intent)) return [];

  const normalizedInput = normalizeUserUtterance(message);
  if (
    intent === "ask_question" &&
    !DESTINATION_CONTEXT_PATTERNS.some((pattern) => pattern.test(normalizedInput))
  ) {
    return [];
  }

  const mentioned = findMentionedDestinations(normalizedInput);
  if (mentioned.length > 0) {
    return mentioned.slice(0, 6).map((destination) => {
      const raw = rawMentionForDestination(message, destination);
      const normalized = normalizeDestinationCandidate(raw, locale);
      const method =
        normalized.resolutionMethod === "typo_alias_correction"
          ? "typo_alias_correction"
          : destination.nameZh && normalizeDestinationText(raw).includes(normalizeDestinationText(destination.nameZh))
            ? "localized_name_match"
            : "alias_match";
      return toIntentDestinationCandidate(raw, destination, normalized, method);
    });
  }

  const fallbackLabel = extractDestinationIntentLabel(normalizedInput);
  const normalized = normalizeDestinationCandidate(fallbackLabel, locale);
  if (!normalized.normalized) return [];
  if (
    intent === "ask_question" &&
    NON_DESTINATION_QUESTION_PATTERNS.some((pattern) => pattern.test(normalizedInput))
  ) {
    return [];
  }

  return [canonicalizeDestination(fallbackLabel, locale)];
}

export function parseTravelIntent(
  message: string,
  locale: "zh" | "en" | string = "zh"
): TravelIntentParseResult {
  const normalizedInput = normalizeUserUtterance(message);
  let intent = classifyTravelIntent(normalizedInput);
  const duration = extractTravelDuration(normalizedInput);
  const preferences = extractDestinationTripHints(normalizedInput).preferences;
  const destinations = extractDestinationCandidates(message, locale);
  if (intent === "unknown" && destinations.length > 0) {
    intent = duration ? "plan_trip" : "choose_destination";
  }
  const destinationQuery = destinations
    .map((destination) => destination.normalized)
    .filter(Boolean)
    .join(" ");
  const firstClarification =
    destinations.find((candidate) => candidate.resolutionMethod === "ambiguous") ??
    destinations.find((candidate) => candidate.confidence < 0.55);
  const clarification =
    clarificationForQuery(destinationQuery || normalizedInput) ??
    (firstClarification ? clarificationForQuery(firstClarification.normalized) : null);

  return {
    intent,
    normalizedInput,
    destinations,
    duration,
    dates: null,
    travelers: null,
    budget: null,
    preferences,
    needsClarification: Boolean(clarification),
    clarificationQuestion: clarification?.question ?? null,
  };
}

export function extractDestinationIntentLabel(value: string): string {
  const trimmed = normalizeUserUtterance(value);
  for (const pattern of RAW_PROMPT_DESTINATION_PATTERNS) {
    const match = trimmed.match(pattern);
    const candidate = match?.[1]?.trim();
    if (candidate) return normalizeDestinationCandidate(candidate).normalized;
  }
  return normalizeDestinationCandidate(trimmed).normalized;
}

export function isRawDestinationPromptText(value: string): boolean {
  const trimmed = value.trim().replace(/[。.!！?？]+$/g, "").trim();
  return RAW_PROMPT_DESTINATION_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function parseDatabaseDestination(row: {
  id: string;
  canonical_name: string;
  display_name: string;
  normalized_name: string | null;
  name_en?: string | null;
  name_zh?: string | null;
  country_code: string | null;
  country_name: string | null;
  country_name_en?: string | null;
  country_name_zh?: string | null;
  region: string | null;
  city: string | null;
  place_type: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  popularity_score: string | number | null;
  source: string | null;
  confidence_score: string | number | null;
  is_verified: boolean | null;
  is_featured?: boolean | null;
  show_on_home?: boolean | null;
  data_quality?: TravelDataQuality | null;
  completeness_score?: string | number | null;
}): TravelDestinationSearchResult {
  const normalizedName =
    row.normalized_name ?? normalizeDestinationText(row.canonical_name);
  const localContract = findDropdownDestinationContract(
    row.name_en ?? row.display_name ?? row.canonical_name
  );
  return {
    id: row.id,
    canonicalName: row.canonical_name,
    displayName: row.display_name,
    normalizedName,
    nameEn: row.name_en ?? localContract?.nameEn ?? row.display_name,
    nameZh: row.name_zh ?? localContract?.nameZh ?? null,
    countryCode: row.country_code,
    countryName: row.country_name,
    countryNameEn:
      row.country_name_en ?? row.country_name ?? localContract?.countryNameEn ?? null,
    countryNameZh: row.country_name_zh ?? localContract?.countryNameZh ?? null,
    region: row.region,
    city: row.city,
    placeType: row.place_type,
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    popularityScore: toNumber(row.popularity_score) ?? 0,
    source: row.source ?? "database",
    confidenceScore: toNumber(row.confidence_score) ?? 1,
    isVerified: row.is_verified ?? false,
    isFeatured: row.is_featured ?? false,
    showOnHome: row.show_on_home ?? false,
    coverImageUrl: localContract?.coverImage?.imageUrl ?? null,
    dataQuality: row.data_quality ?? localContract?.dataQuality,
    sourceStatus:
      row.data_quality === "verified"
        ? "local_verified"
        : row.data_quality === "enriched"
          ? "api_enriched"
          : localContract?.sourceStatus,
    completenessScore:
      toNumber(row.completeness_score) ?? localContract?.completenessScore,
    attractionCount: localContract?.attractions.length,
    missingFields: localContract?.missingFields,
  };
}

function tokenize(value: string): string[] {
  return normalizeDestinationText(value)
    .split(" ")
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let row = 1; row <= left.length; row += 1) {
    current[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + substitutionCost
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

function destinationAliases(destination: TravelDestinationSearchResult): string[] {
  const cityAlias =
    destination.placeType === "city" ||
    destination.placeType === "town" ||
    destination.placeType === "island"
      ? destination.city ?? ""
      : "";
  return [
    destination.canonicalName,
    destination.displayName,
    destination.normalizedName,
    cityAlias,
    destination.countryName ?? "",
    ...(destination.aliases ?? []),
  ].filter(Boolean);
}

function hasLatinLetters(value: string): boolean {
  return /[a-z]/.test(value);
}

function queryContainsAlias(normalizedQuery: string, normalizedAlias: string): boolean {
  if (!normalizedAlias) return false;
  if (normalizedQuery === normalizedAlias) return true;

  if (normalizedAlias.length <= 3 && hasLatinLetters(normalizedAlias)) {
    return normalizedQuery.split(" ").includes(normalizedAlias);
  }

  return normalizedQuery.includes(normalizedAlias);
}

function aliasContainsQuery(normalizedQuery: string, normalizedAlias: string): boolean {
  if (normalizedQuery.length < 3) return false;
  if (normalizedQuery === normalizedAlias) return true;

  if (normalizedQuery.length <= 3 && hasLatinLetters(normalizedQuery)) {
    return normalizedAlias.split(" ").includes(normalizedQuery);
  }

  return normalizedAlias.includes(normalizedQuery);
}

function tokenSubstringMatchesAlias(token: string, normalizedAlias: string): boolean {
  if (token === normalizedAlias) return true;
  if (Math.min(token.length, normalizedAlias.length) < 4) return false;

  return normalizedAlias.includes(token) || token.includes(normalizedAlias);
}

function scoreDestination(query: string, destination: TravelDestinationSearchResult): number {
  const normalizedQuery = normalizeDestinationText(query);
  const tokens = tokenize(query);
  let score = 0;

  destinationAliases(destination).forEach((alias) => {
    const normalizedAlias = normalizeDestinationText(alias);
    if (!normalizedAlias) return;

    if (normalizedAlias === normalizedQuery) score += 120;
    if (queryContainsAlias(normalizedQuery, normalizedAlias)) {
      score += normalizedAlias.length > 3 ? 80 : 45;
    }
    if (aliasContainsQuery(normalizedQuery, normalizedAlias)) score += 45;

    tokens.forEach((token) => {
      if (token === normalizedAlias) score += 90;
      if (tokenSubstringMatchesAlias(token, normalizedAlias)) score += 30;
      if (token.length >= 5 && normalizedAlias.length >= 5) {
        const distance = levenshteinDistance(token, normalizedAlias);
        if (distance <= 1) score += 60;
        else if (distance === 2) score += 35;
      }
    });
  });

  return score + Math.min(destination.popularityScore, 100) / 10;
}

function dedupeDestinations(
  destinations: TravelDestinationSearchResult[]
): TravelDestinationSearchResult[] {
  const byId = new Map<string, TravelDestinationSearchResult>();
  destinations.forEach((destination) => {
    byId.set(destination.id, destination);
  });
  return Array.from(byId.values());
}

export function searchLocalDestinations(
  query: string,
  options: { limit?: number; featuredOnly?: boolean } = {}
): TravelDestinationSearchResult[] {
  const limit = Math.min(Math.max(options.limit ?? 10, 1), 20);
  const normalizedQuery = normalizeDestinationText(query);

  if (options.featuredOnly && !normalizedQuery) {
    return ALL_LOCAL_DESTINATIONS.filter(
      (destination) => destination.isFeatured || destination.showOnHome
    )
      .sort((left, right) => right.popularityScore - left.popularityScore)
      .slice(0, limit);
  }

  if (normalizedQuery.length < 2) return [];

  return ALL_LOCAL_DESTINATIONS.map((destination) => ({
    destination,
    score: scoreDestination(query, destination),
  }))
    .filter((entry) => entry.score >= 25)
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.destination)
    .slice(0, limit);
}

function findMentionedDestinations(query: string): TravelDestinationSearchResult[] {
  const normalizedQuery = normalizeDestinationText(query);
  const hits = ALL_LOCAL_DESTINATIONS.filter((destination) =>
    destinationAliases(destination).some((alias) => {
      const normalizedAlias = normalizeDestinationText(alias);
      return normalizedAlias.length >= 2 && queryContainsAlias(normalizedQuery, normalizedAlias);
    })
  );

  return dedupeDestinations(hits).sort(
    (left, right) =>
      normalizedQuery.indexOf(left.normalizedName) -
        normalizedQuery.indexOf(right.normalizedName) ||
      right.popularityScore - left.popularityScore
  );
}

function ambiguousGroupForQuery(query: string): LocalDestination[] | null {
  const normalizedQuery = normalizeDestinationText(query);
  const exactGroup = Object.keys(AMBIGUOUS_QUERY_LABELS).find((key) => {
    const pattern = new RegExp(`(^|\\s)${key.replace(/\s+/g, "\\s+")}(\\s|$)`);
    return pattern.test(normalizedQuery);
  });
  if (!exactGroup) return null;

  const options = ALL_LOCAL_DESTINATIONS.filter(
    (destination) => destination.ambiguousGroup === exactGroup
  );
  if (options.length <= 1) return null;

  const disambiguatingAlias = options.find((destination) =>
    destination.aliases
      .filter((alias) => normalizeDestinationText(alias) !== exactGroup)
      .some((alias) => normalizedQuery.includes(normalizeDestinationText(alias)))
  );
  return disambiguatingAlias ? null : options;
}

function countryDefaultDestinationForQuery(
  query: string
): TravelDestinationSearchResult | null {
  const normalizedQuery = normalizeDestinationText(query);
  const defaultName = COUNTRY_DEFAULT_DESTINATIONS[normalizedQuery];
  if (!defaultName) return null;
  const normalizedDefaultName = normalizeDestinationText(defaultName);
  return (
    ALL_LOCAL_DESTINATIONS.find(
      (destination) =>
        normalizeDestinationText(destination.canonicalName) === normalizedDefaultName
    ) ?? null
  );
}

export function extractDestinationTripHints(rawText: string): DestinationTripHints {
  const preferences: string[] = [];
  const duration = extractTravelDuration(rawText);
  const travelDays = duration?.maxDays;
  const normalized = rawText.toLowerCase();

  const preferencePatterns: Array<[RegExp, string]> = [
    [/(中等预算|medium budget|预算中等)/i, "medium budget"],
    [/(低预算|cheaper|便宜|budget)/i, "budget conscious"],
    [/(高预算|luxury|奢华|豪华)/i, "higher comfort budget"],
    [/(第一次|first time|首次)/i, "first-time visitor"],
    [/(不吃海鲜|no seafood|without seafood)/i, "no seafood"],
    [/(咖啡|cafe|coffee)/i, "cafes"],
    [/(好吃|美食|food|restaurant|餐厅|餐廳)/i, "food-focused"],
    [/(拍照|photo|photography|打卡)/i, "photo spots"],
    [/(慢|轻松|relax|slow|不想每天太累)/i, "slow pace"],
    [/(购物|shopping|买东西)/i, "shopping"],
    [/(情侣|couple|romantic)/i, "couple-friendly"],
    [/(亲子|family|kids|children)/i, "family-friendly"],
  ];

  preferencePatterns.forEach(([pattern, label]) => {
    if (pattern.test(rawText) || pattern.test(normalized)) preferences.push(label);
  });

  const normalizedTravelDays =
    typeof travelDays === "number" &&
    Number.isFinite(travelDays) &&
    travelDays > 0
      ? travelDays
      : undefined;

  return {
    travelDays: normalizedTravelDays,
    finalNote:
      preferences.length > 0
        ? `User preferences from chat: ${Array.from(new Set(preferences)).join(", ")}.`
        : undefined,
    preferences: Array.from(new Set(preferences)),
  };
}

function extractTemporaryDestinationLabel(query: string): string | null {
  const cleaned = normalizeDestinationText(query);
  const tokens = cleaned
    .split(" ")
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token) && !/^\d+$/.test(token));

  if (tokens.length === 0) return null;

  const lastTokens = tokens.slice(-4).join(" ");
  return lastTokens.length >= 2 ? lastTokens : null;
}

function stableHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

export function createTemporaryDestination(
  query: string
): TravelDestinationSearchResult | null {
  const label = extractTemporaryDestinationLabel(query);
  if (!label) return null;

  const title = label
    .split(" ")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
  return {
    id: `temp-${stableHash(label)}`,
    canonicalName: title,
    displayName: title,
    normalizedName: normalizeDestinationText(title),
    countryCode: null,
    countryName: null,
    region: null,
    city: title,
    placeType: "city",
    latitude: null,
    longitude: null,
    popularityScore: 0,
    source: "temporary_resolver",
    confidenceScore: 0.62,
    isVerified: false,
    aliases: [label],
    imageKey: null,
  };
}

export function buildTravelCandidatePayload(
  destinations: TravelDestinationSearchResult[],
  rawText = ""
): Record<string, unknown> {
  const tripHints = extractDestinationTripHints(rawText);
  const countries = Array.from(
    new Set(destinations.map((destination) => destination.countryName).filter(Boolean))
  );
  const cities = destinations
    .map((destination) => destination.city ?? destination.displayName)
    .filter(Boolean);
  const first = destinations[0];
  const payload: Record<string, unknown> = {
    seed_country: first?.countryName ?? first?.displayName,
    seed_city: first?.city ?? first?.displayName,
    countries: countries.length > 0 ? countries : first ? [first.displayName] : [],
    cities,
    travel_order: cities,
  };

  if (tripHints.travelDays) {
    payload.travel_days = tripHints.travelDays;
    if (cities.length > 0) {
      const baseDays = Math.floor(tripHints.travelDays / cities.length);
      const extra = tripHints.travelDays % cities.length;
      payload.city_days = Object.fromEntries(
        cities.map((city, index) => [city, Math.max(1, baseDays + (index < extra ? 1 : 0))])
      );
    }
  }

  if (tripHints.finalNote) {
    payload.final_note = tripHints.finalNote;
  }

  return payload;
}

function cardSubtitle(
  cardType: LazyDestinationCardType,
  destination: TravelDestinationSearchResult
): string {
  const place = destination.displayName;
  const fallbacks: Record<LazyDestinationCardType, string> = {
    destination_overview: `${place} overview with trip rhythm, neighborhoods, and best-fit travel styles.`,
    top_attractions: `Top sights and neighborhoods for ${place}; generated on demand after destination selection.`,
    food_and_restaurants: `Food, cafe, and restaurant planning notes for ${place}.`,
    transport: `Arrival, local transit, and intercity transport notes for ${place}.`,
    hotel_area: `Suggested hotel bases near public transport and key itinerary zones.`,
    budget: `Budget ranges and cost drivers for this route.`,
    weather_season: `Season, weather, and timing considerations.`,
    packing_preparation: `Packing and preparation checklist for the selected destination.`,
    visa_document: `Visa, passport, and document reminders to verify against official sources.`,
    local_tips: `Local etiquette, payment, connectivity, and planning tips.`,
    safety_warning: `Safety, crowd, weather, and disruption watchpoints.`,
    itinerary_day: `Day-card scaffold; detailed itinerary cards are generated from the trip payload.`,
    map_route: `Map-route scaffold with graceful handling for missing coordinates.`,
    alternative_plan: `Backup plans for rain, crowding, or low-energy days.`,
    booking_cta: `Next actions for flights, hotels, and saved itinerary steps.`,
    save_itinerary: `Persistent itinerary save and refresh rehydration state.`,
  };
  return fallbacks[cardType];
}

export function generateLazyDestinationCards(
  destination: TravelDestinationSearchResult,
  options: { source?: string; isGenerated?: boolean } = {}
): LazyTravelDestinationCard[] {
  const source = options.source ?? "resolver_fallback";
  const isGenerated = options.isGenerated ?? true;

  return LAZY_DESTINATION_CARD_TYPES.map((cardType) => ({
    id: `${destination.id}-${cardType}`,
    destinationId: destination.id,
    cardType,
    title: `${destination.displayName} · ${cardType.replace(/_/g, " ")}`,
    subtitle: cardSubtitle(cardType, destination),
    imageUrl: null,
    payloadJson: {
      destination_id: destination.id,
      destination_name: destination.displayName,
      country_name: destination.countryName,
      city: destination.city,
      card_type: cardType,
      coordinates:
        destination.latitude !== null && destination.longitude !== null
          ? { lat: destination.latitude, lng: destination.longitude }
          : null,
      coordinate_status:
        destination.latitude !== null && destination.longitude !== null
          ? "exact_or_city_level"
          : "missing_placeholder",
    },
    source,
    isGenerated,
    confidenceScore: destination.confidenceScore,
  }));
}

function resolutionQueryFromIntent(
  rawText: string,
  intent: TravelIntentParseResult
): string {
  if (isTravelCommandIntent(intent.intent) || intent.intent === "ask_question") {
    return intent.normalizedInput;
  }
  const candidateQuery = intent.destinations
    .map((destination) => destination.normalized)
    .filter(Boolean)
    .join(" ");
  if (candidateQuery) return candidateQuery;
  return extractDestinationIntentLabel(rawText);
}

function sourceStatusForDestination(
  destination: TravelDestinationSearchResult | null
): TravelDestinationPipelineDebug["cardSourceStatus"] {
  if (!destination) return "none";
  if (destination.source === "temporary_resolver") return "temporary_resolver";
  return destination.sourceStatus ?? (destination.isVerified ? "local_verified" : "llm_generated");
}

function createPipelineDebug(options: {
  rawInput: string;
  intent: TravelIntentParseResult;
  resolverResult: string;
  localDb: TravelDestinationPipelineDebug["localDb"];
  fallbackReason: string | null;
  cardSourceStatus: TravelDestinationPipelineDebug["cardSourceStatus"];
}): TravelDestinationPipelineDebug {
  return {
    rawInput: options.rawInput,
    normalizedInput: options.intent.normalizedInput,
    detectedIntent: options.intent.intent,
    extractedDestinations: options.intent.destinations,
    canonicalizedDestinations: options.intent.destinations,
    resolverResult: options.resolverResult,
    localDb: options.localDb,
    geocodeApi: "not_available_in_sync_resolver",
    fallbackReason: options.fallbackReason,
    cardSourceStatus: options.cardSourceStatus,
  };
}

function allowsTemporaryFallback(
  rawText: string,
  intent: TravelIntentParseResult,
  query: string
): { allowed: boolean; reason: string | null } {
  if (!query) return { allowed: false, reason: "empty_destination_query" };
  if (isTravelCommandIntent(intent.intent)) {
    return { allowed: false, reason: `${intent.intent}_does_not_create_destination` };
  }
  if (intent.intent === "ask_question") {
    return { allowed: false, reason: "question_intent_does_not_create_destination" };
  }
  if (intent.needsClarification) {
    return { allowed: false, reason: "awaiting_destination_clarification" };
  }

  const firstCandidate = intent.destinations[0];
  if (firstCandidate && firstCandidate.confidence < 0.55) {
    return { allowed: false, reason: "low_destination_confidence" };
  }

  const normalizedQuery = normalizeDestinationText(query);
  const cjkLength = (normalizedQuery.match(/[\u3400-\u9fff]/g) ?? []).length;
  const latinWords = normalizedQuery.split(/\s+/).filter(Boolean);
  if (cjkLength < 2 && latinWords.join("").length < 3) {
    return { allowed: false, reason: "destination_query_too_short" };
  }

  const hasTravelContext = DESTINATION_CONTEXT_PATTERNS.some((pattern) =>
    pattern.test(rawText)
  );
  const looksLikeShortPlaceName = latinWords.length > 0 && latinWords.length <= 4;
  if (!hasTravelContext && !looksLikeShortPlaceName && cjkLength < 2) {
    return { allowed: false, reason: "no_destination_context" };
  }

  return { allowed: true, reason: null };
}

export function resolveLocalDestinationText(rawText: string): DestinationResolution {
  const intent = parseTravelIntent(rawText);
  const query = resolutionQueryFromIntent(rawText, intent);
  const tripHints = extractDestinationTripHints(rawText);
  if (!query) {
    return {
      status: "unresolved",
      query,
      message: "No destination text was provided.",
      tripHints,
      cards: [],
      debugTrace: createPipelineDebug({
        rawInput: rawText,
        intent,
        resolverResult: "unresolved",
        localDb: "not_checked",
        fallbackReason: "empty_destination_query",
        cardSourceStatus: "none",
      }),
    };
  }

  if (isTravelCommandIntent(intent.intent)) {
    return {
      status: "unresolved",
      query,
      message: "The user is editing or removing itinerary content, not naming a new destination.",
      tripHints,
      cards: [],
      debugTrace: createPipelineDebug({
        rawInput: rawText,
        intent,
        resolverResult: "unresolved",
        localDb: "not_checked",
        fallbackReason: `${intent.intent}_does_not_create_destination`,
        cardSourceStatus: "none",
      }),
    };
  }

  if (
    intent.intent === "ask_question" ||
    UNDECIDED_DESTINATION_PATTERNS.some((pattern) => pattern.test(rawText))
  ) {
    return {
      status: "unresolved",
      query,
      message: "The user is asking a travel question, not naming a destination.",
      tripHints,
      cards: [],
      debugTrace: createPipelineDebug({
        rawInput: rawText,
        intent,
        resolverResult: "unresolved",
        localDb: "not_checked",
        fallbackReason: "question_intent_does_not_create_destination",
        cardSourceStatus: "none",
      }),
    };
  }

  const clarification = clarificationForQuery(query);
  if (clarification) {
    return {
      status: "ambiguous",
      query,
      clarificationQuestion: clarification.question,
      options: clarification.options,
      tripHints,
      cards: [],
      debugTrace: createPipelineDebug({
        rawInput: rawText,
        intent,
        resolverResult: "ambiguous",
        localDb: "local_index_hit",
        fallbackReason: "awaiting_destination_clarification",
        cardSourceStatus: "none",
      }),
    };
  }

  const countryDefault = countryDefaultDestinationForQuery(query);
  if (countryDefault) {
    return {
      status: "resolved",
      query,
      destinations: [countryDefault],
      confidenceScore: countryDefault.confidenceScore,
      tripHints,
      cards: generateLazyDestinationCards(countryDefault, { source: "curated_fallback" }),
      debugTrace: createPipelineDebug({
        rawInput: rawText,
        intent,
        resolverResult: "resolved",
        localDb: "local_index_hit",
        fallbackReason: null,
        cardSourceStatus: sourceStatusForDestination(countryDefault),
      }),
    };
  }

  const mentioned = findMentionedDestinations(query);
  if (mentioned.length > 0) {
    const destinations = mentioned.slice(0, 6);
    return {
      status: "resolved",
      query,
      destinations,
      confidenceScore: destinations[0].confidenceScore,
      tripHints,
      cards: destinations.flatMap((destination) =>
        generateLazyDestinationCards(destination, { source: "curated_fallback" })
      ),
      debugTrace: createPipelineDebug({
        rawInput: rawText,
        intent,
        resolverResult: "resolved",
        localDb: "local_index_hit",
        fallbackReason: null,
        cardSourceStatus: sourceStatusForDestination(destinations[0] ?? null),
      }),
    };
  }

  const fuzzy = searchLocalDestinations(query, { limit: 3 });
  if (fuzzy.length > 0) {
    return {
      status: "resolved",
      query,
      destinations: fuzzy.slice(0, 1),
      confidenceScore: Math.min(0.9, fuzzy[0].confidenceScore),
      tripHints,
      cards: generateLazyDestinationCards(fuzzy[0], {
        source: "curated_fuzzy_fallback",
      }),
      debugTrace: createPipelineDebug({
        rawInput: rawText,
        intent,
        resolverResult: "resolved",
        localDb: "local_index_hit",
        fallbackReason: null,
        cardSourceStatus: sourceStatusForDestination(fuzzy[0] ?? null),
      }),
    };
  }

  const fallbackGate = allowsTemporaryFallback(rawText, intent, query);
  if (!fallbackGate.allowed) {
    return {
      status: "unresolved",
      query,
      message: fallbackGate.reason ?? "The text does not look like a resolvable destination yet.",
      tripHints,
      cards: [],
      debugTrace: createPipelineDebug({
        rawInput: rawText,
        intent,
        resolverResult: "unresolved",
        localDb: "local_index_miss",
        fallbackReason: fallbackGate.reason,
        cardSourceStatus: "none",
      }),
    };
  }

  const temporaryDestination = createTemporaryDestination(query);
  if (!temporaryDestination) {
    return {
      status: "unresolved",
      query,
      message: "The text does not look like a resolvable destination yet.",
      tripHints,
      cards: [],
      debugTrace: createPipelineDebug({
        rawInput: rawText,
        intent,
        resolverResult: "unresolved",
        localDb: "local_index_miss",
        fallbackReason: "temporary_destination_label_empty",
        cardSourceStatus: "none",
      }),
    };
  }

  return {
    status: "temporary",
    query,
    destination: temporaryDestination,
    confidenceScore: temporaryDestination.confidenceScore,
    tripHints,
    cards: generateLazyDestinationCards(temporaryDestination, {
      source: "temporary_resolver",
    }),
    debugTrace: createPipelineDebug({
      rawInput: rawText,
      intent,
      resolverResult: "temporary",
      localDb: "local_index_miss",
      fallbackReason: "all_local_resolution_attempts_failed",
      cardSourceStatus: "temporary_resolver",
    }),
  };
}

export function toTravelDestinationChatCard(
  destination: TravelDestinationSearchResult,
  rawText = ""
): TravelDestinationCard {
  const candidatePayload = buildTravelCandidatePayload([destination], rawText);
  const localContract = findDropdownDestinationContract(
    destination.nameEn ?? destination.displayName ?? destination.canonicalName
  );
  const coverImageUrl = destination.coverImageUrl ?? localContract?.coverImage?.imageUrl ?? null;
  const dataQuality =
    destination.dataQuality ??
    localContract?.dataQuality ??
    (destination.isVerified ? "verified" : "generated");
  const sourceStatus =
    destination.sourceStatus ??
    localContract?.sourceStatus ??
    (destination.isVerified ? "local_verified" : "llm_generated");
  const attractionCount =
    destination.attractionCount ?? localContract?.attractions.length ?? 0;
  const missingFields =
    destination.missingFields ?? localContract?.missingFields ?? [];
  const imageStatus: TravelDestinationCard["image_status"] = coverImageUrl
    ? "verified"
    : "placeholder";
  const highlights = [
    sourceStatus === "llm_generated"
      ? "place information pending"
      : destination.placeType
        ? `${destination.placeType} route`
        : "travel route",
    destination.countryName ?? destination.region ?? "travel context",
    attractionCount >= 3
      ? `${attractionCount} local attraction cards`
      : "place data pending",
    destination.latitude !== null && destination.longitude !== null
      ? "map-ready"
      : "coordinate fallback ready",
  ];

  return {
    type: "destination" as const,
    id: destination.id,
    destination_id: destination.id,
    title: destination.displayName,
    subtitle:
      destination.countryName || destination.region
        ? `${destination.countryName ?? destination.region} · ${destination.placeType ?? "destination"}`
        : "Place information is being enriched.",
    country: destination.countryName ?? destination.displayName,
    city: destination.city ?? destination.displayName,
    image_key: destination.imageKey ?? null,
    cover_image_url: coverImageUrl,
    image_status: imageStatus,
    data_quality: dataQuality,
    source_status: sourceStatus,
    completeness_score:
      destination.completenessScore ?? localContract?.completenessScore ?? null,
    missing_fields: missingFields,
    attraction_count: attractionCount,
    map_marker:
      destination.latitude !== null && destination.longitude !== null
        ? { lat: destination.latitude, lng: destination.longitude }
        : null,
    localized_names: {
      en: destination.nameEn ?? localContract?.nameEn ?? destination.displayName,
      zh: destination.nameZh ?? localContract?.nameZh ?? destination.displayName,
    },
    highlights,
    suggested_days:
      typeof candidatePayload.travel_days === "number"
        ? `${candidatePayload.travel_days} days`
        : null,
    action_label: "加入计划",
    payload: candidatePayload,
  };
}
