import type { Json } from "@/types/database";

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
  countryCode: string | null;
  countryName: string | null;
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

export type DestinationResolution =
  | {
      status: "resolved";
      query: string;
      destinations: TravelDestinationSearchResult[];
      confidenceScore: number;
      tripHints: DestinationTripHints;
      cards: LazyTravelDestinationCard[];
    }
  | {
      status: "ambiguous";
      query: string;
      clarificationQuestion: string;
      options: TravelDestinationSearchResult[];
      tripHints: DestinationTripHints;
      cards: [];
    }
  | {
      status: "temporary";
      query: string;
      destination: TravelDestinationSearchResult;
      confidenceScore: number;
      tripHints: DestinationTripHints;
      cards: LazyTravelDestinationCard[];
    }
  | {
      status: "unresolved";
      query: string;
      message: string;
      tripHints: DestinationTripHints;
      cards: [];
    };

type LocalDestination = TravelDestinationSearchResult & {
  aliases: string[];
  ambiguousGroup?: string;
};

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
  "计划",
  "旅行",
  "路线",
  "天",
  "做一个",
]);

const RAW_PROMPT_DESTINATION_PATTERNS = [
  /^我想去(.+)$/,
  /^想去(.+)$/,
  /^我要去(.+)$/,
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

export function extractDestinationIntentLabel(value: string): string {
  const trimmed = value.trim().replace(/[。.!！?？]+$/g, "").trim();
  for (const pattern of RAW_PROMPT_DESTINATION_PATTERNS) {
    const match = trimmed.match(pattern);
    const candidate = match?.[1]?.trim();
    if (candidate) return candidate.replace(/旅行$/u, "").trim();
  }
  return trimmed;
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
  country_code: string | null;
  country_name: string | null;
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
}): TravelDestinationSearchResult {
  const normalizedName =
    row.normalized_name ?? normalizeDestinationText(row.canonical_name);
  return {
    id: row.id,
    canonicalName: row.canonical_name,
    displayName: row.display_name,
    normalizedName,
    countryCode: row.country_code,
    countryName: row.country_name,
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
  return [
    destination.canonicalName,
    destination.displayName,
    destination.normalizedName,
    destination.city ?? "",
    destination.countryName ?? "",
    ...(destination.aliases ?? []),
  ].filter(Boolean);
}

function scoreDestination(query: string, destination: TravelDestinationSearchResult): number {
  const normalizedQuery = normalizeDestinationText(query);
  const tokens = tokenize(query);
  let score = 0;

  destinationAliases(destination).forEach((alias) => {
    const normalizedAlias = normalizeDestinationText(alias);
    if (!normalizedAlias) return;

    if (normalizedAlias === normalizedQuery) score += 120;
    if (normalizedQuery.includes(normalizedAlias)) score += normalizedAlias.length > 3 ? 80 : 45;
    if (normalizedAlias.includes(normalizedQuery) && normalizedQuery.length >= 3) score += 45;

    tokens.forEach((token) => {
      if (token === normalizedAlias) score += 90;
      if (normalizedAlias.includes(token) || token.includes(normalizedAlias)) score += 30;
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
    return LOCAL_DESTINATIONS.filter(
      (destination) => destination.isFeatured || destination.showOnHome
    )
      .sort((left, right) => right.popularityScore - left.popularityScore)
      .slice(0, limit);
  }

  if (normalizedQuery.length < 2) return [];

  return LOCAL_DESTINATIONS.map((destination) => ({
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
  const hits = LOCAL_DESTINATIONS.filter((destination) =>
    destinationAliases(destination).some((alias) => {
      const normalizedAlias = normalizeDestinationText(alias);
      return normalizedAlias.length >= 2 && normalizedQuery.includes(normalizedAlias);
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

  const options = LOCAL_DESTINATIONS.filter(
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

export function extractDestinationTripHints(rawText: string): DestinationTripHints {
  const preferences: string[] = [];
  const dayMatch = rawText.match(/(\d{1,2})\s*(?:天|day|days|日)/i);
  const travelDays = dayMatch ? Number.parseInt(dayMatch[1], 10) : undefined;
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

export function resolveLocalDestinationText(rawText: string): DestinationResolution {
  const query = extractDestinationIntentLabel(rawText);
  const tripHints = extractDestinationTripHints(query);
  if (!query) {
    return {
      status: "unresolved",
      query,
      message: "No destination text was provided.",
      tripHints,
      cards: [],
    };
  }

  if (UNDECIDED_DESTINATION_PATTERNS.some((pattern) => pattern.test(query))) {
    return {
      status: "unresolved",
      query,
      message: "The user is asking for destination inspiration, not naming a destination.",
      tripHints,
      cards: [],
    };
  }

  const ambiguous = ambiguousGroupForQuery(query);
  if (ambiguous) {
    const group = ambiguous[0].ambiguousGroup ?? "destination";
    return {
      status: "ambiguous",
      query,
      clarificationQuestion:
        AMBIGUOUS_QUERY_LABELS[group] ?? "这个目的地有多个可能选项，请先确认具体地区。",
      options: ambiguous,
      tripHints,
      cards: [],
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
  };
}

export function toTravelDestinationChatCard(
  destination: TravelDestinationSearchResult,
  rawText = ""
) {
  const candidatePayload = buildTravelCandidatePayload([destination], rawText);
  const highlights = [
    destination.placeType ? `${destination.placeType} route` : "travel route",
    destination.countryName ?? destination.region ?? "destination context",
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
        : "Temporary destination card generated from your message.",
    country: destination.countryName ?? destination.displayName,
    city: destination.city ?? destination.displayName,
    image_key: destination.imageKey ?? null,
    highlights,
    suggested_days:
      typeof candidatePayload.travel_days === "number"
        ? `${candidatePayload.travel_days} days`
        : null,
    action_label: "加入计划",
    payload: candidatePayload,
  };
}
