import curatedTravelCardData from "../../components/client/travel/travel-card-curated-data.json";
import {
  CURATED_CITIES_BY_COUNTRY,
  type CuratedCity,
} from "./locations";
import { TRAVEL_PLACE_FALLBACK_IMAGE } from "./google-places";

export type TravelDataQuality =
  | "verified"
  | "enriched"
  | "generated"
  | "placeholder"
  | "incomplete";

export type TravelCardSourceStatus =
  | "local_verified"
  | "local_cached"
  | "api_enriched"
  | "llm_generated"
  | "placeholder";

export type TravelDestinationMissingField =
  | "cover_image"
  | "attractions"
  | "attraction_images"
  | "coordinates"
  | "descriptions"
  | "localized_names";

export type TravelImageVerification = {
  confidenceScore: number;
  verified: boolean;
  reasons: string[];
};

export type TravelDestinationAssetContract = {
  entityType: "destination" | "attraction";
  entityKey: string;
  assetType: "cover_image" | "gallery_image" | "thumbnail";
  imageUrl: string;
  thumbnailUrl?: string | null;
  source: string;
  sourceUrl: string;
  attribution: string;
  license: string;
  confidenceScore: number;
  verified: boolean;
  isPrimary: boolean;
};

export type TravelAttractionContract = {
  key: string;
  canonicalName: string;
  nameEn: string;
  nameZh: string;
  descriptionEn: string;
  descriptionZh: string;
  category: string;
  latitude: number | null;
  longitude: number | null;
  recommendedDurationMinutes: number;
  popularityScore: number;
  dataQuality: TravelDataQuality;
  source: string;
  sourceUrl: string;
  image?: TravelDestinationAssetContract | null;
};

export type TravelDestinationContract = {
  key: string;
  canonicalName: string;
  nameEn: string;
  nameZh: string;
  aliases: string[];
  countryCode: string;
  countryNameEn: string;
  countryNameZh: string;
  region: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  currency: string | null;
  isDropdownEnabled: boolean;
  isPopular: boolean;
  isActive: boolean;
  dataQuality: TravelDataQuality;
  sourceStatus: TravelCardSourceStatus;
  completenessScore: number;
  missingFields: TravelDestinationMissingField[];
  coverImage?: TravelDestinationAssetContract | null;
  attractions: TravelAttractionContract[];
};

export type LocalFirstDestinationPayload = {
  destination: TravelDestinationContract;
  coverImage: TravelDestinationAssetContract | null;
  attractionCards: TravelAttractionContract[];
  mapMarkers: Array<{
    id: string;
    type: "destination" | "attraction";
    labelEn: string;
    labelZh: string;
    latitude: number;
    longitude: number;
    imageUrl: string;
    dataQuality: TravelDataQuality;
    sourceStatus: TravelCardSourceStatus;
  }>;
  dataQuality: TravelDataQuality;
  sourceStatus: TravelCardSourceStatus;
  completenessScore: number;
  missingFields: TravelDestinationMissingField[];
  enrichment: {
    needed: boolean;
    status: "not_needed" | "queued" | "unavailable";
    messageEn: string;
    messageZh: string;
  };
};

type CuratedTravelCity = {
  cityKeys: string[];
  cityLabel: string;
  imageSrc: string;
  sourceUrl: string;
};

type CuratedTravelAttraction = {
  cityKeys: string[];
  cityLabel: string;
  name: string;
  aliases?: string[];
  location: string;
  lat?: number;
  lng?: number;
  imageSrc: string;
  sourceUrl: string;
  description?: string;
};

type CuratedTravelCardData = {
  cities: CuratedTravelCity[];
  attractions: CuratedTravelAttraction[];
};

type CountryMeta = {
  code: string;
  zh: string;
  timezone: string;
  currency: string;
};

const CURATED_CARD_DATA = curatedTravelCardData as CuratedTravelCardData;

const SUPPLEMENTAL_CITY_CARDS: CuratedTravelCity[] = [
  {
    cityKeys: ["Hong Kong", "香港", "HK"],
    cityLabel: "香港",
    imageSrc:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Hong_Kong_Victoria_Harbour_-_Hong_Kong.jpg/1280px-Hong_Kong_Victoria_Harbour_-_Hong_Kong.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Hong_Kong_Victoria_Harbour_-_Hong_Kong.jpg",
  },
];

const HONG_KONG_CITY_KEYS = new Set(["hongkong", "hk", "香港"]);

const COUNTRY_META_BY_NAME: Record<string, CountryMeta> = {
  Argentina: {
    code: "AR",
    zh: "阿根廷",
    timezone: "America/Argentina/Buenos_Aires",
    currency: "ARS",
  },
  Australia: {
    code: "AU",
    zh: "澳大利亚",
    timezone: "Australia/Sydney",
    currency: "AUD",
  },
  Austria: {
    code: "AT",
    zh: "奥地利",
    timezone: "Europe/Vienna",
    currency: "EUR",
  },
  Brazil: {
    code: "BR",
    zh: "巴西",
    timezone: "America/Sao_Paulo",
    currency: "BRL",
  },
  Canada: {
    code: "CA",
    zh: "加拿大",
    timezone: "America/Toronto",
    currency: "CAD",
  },
  China: {
    code: "CN",
    zh: "中国",
    timezone: "Asia/Shanghai",
    currency: "CNY",
  },
  Egypt: {
    code: "EG",
    zh: "埃及",
    timezone: "Africa/Cairo",
    currency: "EGP",
  },
  France: {
    code: "FR",
    zh: "法国",
    timezone: "Europe/Paris",
    currency: "EUR",
  },
  Germany: {
    code: "DE",
    zh: "德国",
    timezone: "Europe/Berlin",
    currency: "EUR",
  },
  Greece: {
    code: "GR",
    zh: "希腊",
    timezone: "Europe/Athens",
    currency: "EUR",
  },
  "Hong Kong": {
    code: "HK",
    zh: "香港",
    timezone: "Asia/Hong_Kong",
    currency: "HKD",
  },
  India: {
    code: "IN",
    zh: "印度",
    timezone: "Asia/Kolkata",
    currency: "INR",
  },
  Indonesia: {
    code: "ID",
    zh: "印度尼西亚",
    timezone: "Asia/Jakarta",
    currency: "IDR",
  },
  Ireland: {
    code: "IE",
    zh: "爱尔兰",
    timezone: "Europe/Dublin",
    currency: "EUR",
  },
  Italy: {
    code: "IT",
    zh: "意大利",
    timezone: "Europe/Rome",
    currency: "EUR",
  },
  Japan: {
    code: "JP",
    zh: "日本",
    timezone: "Asia/Tokyo",
    currency: "JPY",
  },
  Malaysia: {
    code: "MY",
    zh: "马来西亚",
    timezone: "Asia/Kuala_Lumpur",
    currency: "MYR",
  },
  Mexico: {
    code: "MX",
    zh: "墨西哥",
    timezone: "America/Mexico_City",
    currency: "MXN",
  },
  Morocco: {
    code: "MA",
    zh: "摩洛哥",
    timezone: "Africa/Casablanca",
    currency: "MAD",
  },
  Netherlands: {
    code: "NL",
    zh: "荷兰",
    timezone: "Europe/Amsterdam",
    currency: "EUR",
  },
  "New Zealand": {
    code: "NZ",
    zh: "新西兰",
    timezone: "Pacific/Auckland",
    currency: "NZD",
  },
  Philippines: {
    code: "PH",
    zh: "菲律宾",
    timezone: "Asia/Manila",
    currency: "PHP",
  },
  Portugal: {
    code: "PT",
    zh: "葡萄牙",
    timezone: "Europe/Lisbon",
    currency: "EUR",
  },
  Singapore: {
    code: "SG",
    zh: "新加坡",
    timezone: "Asia/Singapore",
    currency: "SGD",
  },
  "South Korea": {
    code: "KR",
    zh: "韩国",
    timezone: "Asia/Seoul",
    currency: "KRW",
  },
  Spain: {
    code: "ES",
    zh: "西班牙",
    timezone: "Europe/Madrid",
    currency: "EUR",
  },
  Switzerland: {
    code: "CH",
    zh: "瑞士",
    timezone: "Europe/Zurich",
    currency: "CHF",
  },
  Thailand: {
    code: "TH",
    zh: "泰国",
    timezone: "Asia/Bangkok",
    currency: "THB",
  },
  Turkey: {
    code: "TR",
    zh: "土耳其",
    timezone: "Europe/Istanbul",
    currency: "TRY",
  },
  "United Arab Emirates": {
    code: "AE",
    zh: "阿联酋",
    timezone: "Asia/Dubai",
    currency: "AED",
  },
  "United Kingdom": {
    code: "GB",
    zh: "英国",
    timezone: "Europe/London",
    currency: "GBP",
  },
  "United States": {
    code: "US",
    zh: "美国",
    timezone: "America/New_York",
    currency: "USD",
  },
  Vietnam: {
    code: "VN",
    zh: "越南",
    timezone: "Asia/Ho_Chi_Minh",
    currency: "VND",
  },
};

const POPULAR_CITY_KEYS = new Set([
  "bangkok",
  "dubai",
  "guangzhou",
  "hangzhou",
  "hongkong",
  "lasvegas",
  "london",
  "losangeles",
  "newyork",
  "paris",
  "sanfrancisco",
  "seoul",
  "shanghai",
  "singapore",
  "tokyo",
]);

export function normalizeDestinationContractKey(
  value: string | null | undefined
): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/ø/g, "o")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]+/g, "")
    .trim();
}

export function normalizeDestinationSearchText(
  value: string | null | undefined
): string {
  return String(value ?? "")
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

function cityKeysFor(city: CuratedCity): string[] {
  return [city.en, city.zh, ...(city.aliases ?? [])]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim());
}

function findCuratedCityCard(city: CuratedCity): CuratedTravelCity | null {
  const keys = cityKeysFor(city).map(normalizeDestinationContractKey);
  return (
    [...CURATED_CARD_DATA.cities, ...SUPPLEMENTAL_CITY_CARDS].find((item) =>
      item.cityKeys.some((key) =>
        keys.includes(normalizeDestinationContractKey(key))
      )
    ) ?? null
  );
}

function isHongKongAttraction(item: CuratedTravelAttraction): boolean {
  const searchable = [
    item.name,
    item.location,
    item.cityLabel,
    item.sourceUrl,
    ...(item.aliases ?? []),
  ].join(" ");
  const searchText = normalizeDestinationSearchText(searchable);
  const compactText = normalizeDestinationContractKey(searchable);

  return (
    searchText.includes("hong kong") ||
    compactText.includes("hongkong") ||
    compactText.includes("香港")
  );
}

function findCuratedAttractions(city: CuratedCity): CuratedTravelAttraction[] {
  const keys = cityKeysFor(city).map(normalizeDestinationContractKey);
  const isHongKongCity = keys.some((key) => HONG_KONG_CITY_KEYS.has(key));
  const cityAttractions = CURATED_CARD_DATA.attractions.filter((item) =>
    item.cityKeys.some((key) => keys.includes(normalizeDestinationContractKey(key))) &&
    (isHongKongCity || !isHongKongAttraction(item))
  );

  if (!isHongKongCity) {
    return cityAttractions;
  }

  const hongKongAttractions =
    CURATED_CARD_DATA.attractions.filter(isHongKongAttraction);

  return Array.from(
    new Map(
      [...cityAttractions, ...hongKongAttractions].map((item) => [
        `${item.name}|${item.imageSrc}`,
        item,
      ])
    ).values()
  );
}

function slugifyDestination(city: string, countryCode: string): string {
  return `${normalizeDestinationSearchText(city).replace(/\s+/g, "-")}-${countryCode.toLowerCase()}`;
}

function wordsForRelevance(value: string): string[] {
  return normalizeDestinationSearchText(value)
    .split(" ")
    .filter((token) => token.length >= 3);
}

function imageLooksLikePlaceholder(imageUrl: string): boolean {
  const normalized = imageUrl.toLowerCase();
  return (
    !normalized ||
    normalized.includes("travel-fallback") ||
    normalized.includes("placeholder")
  );
}

export function verifyTravelImageRelevance(options: {
  imageUrl: string | null | undefined;
  sourceUrl: string | null | undefined;
  entityNames: string[];
  cityNames: string[];
}): TravelImageVerification {
  const imageUrl = options.imageUrl?.trim() ?? "";
  const sourceUrl = options.sourceUrl?.trim() ?? "";
  const haystack = normalizeDestinationSearchText(`${imageUrl} ${sourceUrl}`);
  const entityWords = options.entityNames.flatMap(wordsForRelevance);
  const cityWords = options.cityNames.flatMap(wordsForRelevance);
  const reasons: string[] = [];
  let score = 0;

  if (!imageUrl || imageLooksLikePlaceholder(imageUrl)) {
    return {
      confidenceScore: 0,
      verified: false,
      reasons: ["missing_or_placeholder_image"],
    };
  }

  if (sourceUrl) {
    score += 0.2;
    reasons.push("source_url_present");
  }

  if (
    entityWords.some((word) => haystack.includes(word)) ||
    options.entityNames.some(
      (name) =>
        normalizeDestinationContractKey(name).length >= 4 &&
        haystack.includes(normalizeDestinationSearchText(name))
    )
  ) {
    score += 0.45;
    reasons.push("entity_name_match");
  }

  if (
    cityWords.some((word) => haystack.includes(word)) ||
    options.cityNames.some(
      (name) =>
        normalizeDestinationContractKey(name).length >= 4 &&
        haystack.includes(normalizeDestinationSearchText(name))
    )
  ) {
    score += 0.3;
    reasons.push("city_name_match");
  }

  if (imageUrl.startsWith("/travel/")) {
    score += 0.15;
    reasons.push("local_travel_asset");
  }

  const confidenceScore = Math.min(1, Number(score.toFixed(2)));
  return {
    confidenceScore,
    verified: confidenceScore >= 0.55,
    reasons,
  };
}

function toAssetContract(options: {
  entityType: "destination" | "attraction";
  entityKey: string;
  assetType: "cover_image" | "gallery_image" | "thumbnail";
  imageUrl: string;
  sourceUrl: string;
  entityNames: string[];
  cityNames: string[];
  isPrimary?: boolean;
}): TravelDestinationAssetContract | null {
  const verification = verifyTravelImageRelevance({
    imageUrl: options.imageUrl,
    sourceUrl: options.sourceUrl,
    entityNames: options.entityNames,
    cityNames: options.cityNames,
  });
  if (!verification.verified) return null;

  return {
    entityType: options.entityType,
    entityKey: options.entityKey,
    assetType: options.assetType,
    imageUrl: options.imageUrl,
    source: "local_curated",
    sourceUrl: options.sourceUrl,
    attribution: `Source page: ${options.sourceUrl}`,
    license: "see_source_page",
    confidenceScore: verification.confidenceScore,
    verified: true,
    isPrimary: options.isPrimary ?? false,
  };
}

function deriveCityCoordinate(
  attractions: CuratedTravelAttraction[]
): [number, number] | [null, null] {
  const coordinates = attractions
    .map((item): [number, number] | null => {
      if (
        typeof item.lat !== "number" ||
        !Number.isFinite(item.lat) ||
        typeof item.lng !== "number" ||
        !Number.isFinite(item.lng)
      ) {
        return null;
      }
      return [item.lat, item.lng];
    })
    .filter((item): item is [number, number] => Boolean(item));

  if (!coordinates.length) return [null, null];

  const total = coordinates.reduce(
    (sum, item) => ({
      lat: sum.lat + item[0],
      lng: sum.lng + item[1],
    }),
    { lat: 0, lng: 0 }
  );

  return [
    Number((total.lat / coordinates.length).toFixed(6)),
    Number((total.lng / coordinates.length).toFixed(6)),
  ];
}

function attractionNameEn(item: CuratedTravelAttraction): string {
  return item.aliases?.find((alias) => /[A-Za-z]/.test(alias)) ?? item.name;
}

function toAttractionContract(
  item: CuratedTravelAttraction,
  destinationKey: string,
  city: CuratedCity
): TravelAttractionContract {
  const key = `${destinationKey}-${normalizeDestinationContractKey(item.name)}`;
  const image =
    toAssetContract({
      entityType: "attraction",
      entityKey: key,
      assetType: "thumbnail",
      imageUrl: item.imageSrc,
      sourceUrl: item.sourceUrl,
      entityNames: [item.name, ...(item.aliases ?? [])],
      cityNames: cityKeysFor(city),
      isPrimary: true,
    }) ?? null;

  return {
    key,
    canonicalName: attractionNameEn(item),
    nameEn: attractionNameEn(item),
    nameZh: item.name,
    descriptionEn: item.description ?? `${attractionNameEn(item)} local attraction.`,
    descriptionZh: item.description ?? `${item.name}是当地推荐景点。`,
    category: "attraction",
    latitude: typeof item.lat === "number" && Number.isFinite(item.lat) ? item.lat : null,
    longitude: typeof item.lng === "number" && Number.isFinite(item.lng) ? item.lng : null,
    recommendedDurationMinutes: 90,
    popularityScore: image ? 90 : 70,
    dataQuality: image ? "verified" : "incomplete",
    source: "local_curated",
    sourceUrl: item.sourceUrl,
    image,
  };
}

function scoreCompleteness(options: {
  coverImage: TravelDestinationAssetContract | null;
  attractions: TravelAttractionContract[];
  latitude: number | null;
  longitude: number | null;
  nameZh?: string | null;
  nameEn?: string | null;
}): { score: number; missingFields: TravelDestinationMissingField[] } {
  const missingFields: TravelDestinationMissingField[] = [];
  let score = 0;

  if (options.nameEn && options.nameZh) score += 15;
  else missingFields.push("localized_names");

  if (
    typeof options.latitude === "number" &&
    Number.isFinite(options.latitude) &&
    typeof options.longitude === "number" &&
    Number.isFinite(options.longitude)
  ) {
    score += 20;
  } else {
    missingFields.push("coordinates");
  }

  if (options.coverImage) score += 20;
  else missingFields.push("cover_image");

  if (options.attractions.length >= 3) score += 25;
  else missingFields.push("attractions");

  const attractionImages = options.attractions.filter((item) => item.image).length;
  if (attractionImages >= Math.min(3, options.attractions.length)) score += 15;
  else missingFields.push("attraction_images");

  if (options.attractions.some((item) => item.descriptionZh || item.descriptionEn)) {
    score += 5;
  } else {
    missingFields.push("descriptions");
  }

  return {
    score: Math.min(100, score),
    missingFields,
  };
}

function buildDestinationContract(
  countryNameEn: string,
  city: CuratedCity
): TravelDestinationContract | null {
  const countryMeta = COUNTRY_META_BY_NAME[countryNameEn];
  if (!countryMeta) return null;

  const destinationKey = slugifyDestination(city.en, countryMeta.code);
  const curatedCity = findCuratedCityCard(city);
  const curatedAttractions = findCuratedAttractions(city);
  const [latitude, longitude] = deriveCityCoordinate(curatedAttractions);
  const coverImage = curatedCity
    ? toAssetContract({
        entityType: "destination",
        entityKey: destinationKey,
        assetType: "cover_image",
        imageUrl: curatedCity.imageSrc,
        sourceUrl: curatedCity.sourceUrl,
        entityNames: [city.en, city.zh ?? city.en],
        cityNames: cityKeysFor(city),
        isPrimary: true,
      })
    : null;
  const attractions = curatedAttractions
    .map((item) => toAttractionContract(item, destinationKey, city))
    .sort((left, right) => right.popularityScore - left.popularityScore);
  const completeness = scoreCompleteness({
    coverImage,
    attractions,
    latitude,
    longitude,
    nameEn: city.en,
    nameZh: city.zh,
  });
  const dataQuality: TravelDataQuality =
    completeness.score >= 80 ? "verified" : "incomplete";

  return {
    key: destinationKey,
    canonicalName: city.en,
    nameEn: city.en,
    nameZh: city.zh ?? city.en,
    aliases: Array.from(new Set(cityKeysFor(city))),
    countryCode: countryMeta.code,
    countryNameEn,
    countryNameZh: countryMeta.zh,
    region: countryNameEn,
    city: city.en,
    latitude,
    longitude,
    timezone: countryMeta.timezone,
    currency: countryMeta.currency,
    isDropdownEnabled: true,
    isPopular: POPULAR_CITY_KEYS.has(normalizeDestinationContractKey(city.en)),
    isActive: true,
    dataQuality,
    sourceStatus: dataQuality === "verified" ? "local_verified" : "placeholder",
    completenessScore: completeness.score,
    missingFields: completeness.missingFields,
    coverImage,
    attractions,
  };
}

const DROPDOWN_DESTINATION_CONTRACTS = Object.entries(CURATED_CITIES_BY_COUNTRY)
  .flatMap(([countryNameEn, cities]) =>
    cities
      .map((city) => buildDestinationContract(countryNameEn, city))
      .filter((item): item is TravelDestinationContract => Boolean(item))
  )
  .sort((left, right) => {
    if (left.isPopular !== right.isPopular) return left.isPopular ? -1 : 1;
    return left.nameEn.localeCompare(right.nameEn);
  });

const CONTRACTS_BY_KEY = new Map<string, TravelDestinationContract>();

DROPDOWN_DESTINATION_CONTRACTS.forEach((destination) => {
  [
    destination.nameEn,
    destination.nameZh,
    destination.canonicalName,
    destination.city,
    destination.key,
    ...destination.aliases,
  ].forEach((label) => {
    const key = normalizeDestinationContractKey(label);
    if (key) CONTRACTS_BY_KEY.set(key, destination);
  });
});

export function getDropdownDestinationContracts(): TravelDestinationContract[] {
  return DROPDOWN_DESTINATION_CONTRACTS;
}

export function findDropdownDestinationContract(
  value: string | null | undefined
): TravelDestinationContract | null {
  const normalized = normalizeDestinationContractKey(value);
  if (!normalized) return null;

  return (
    CONTRACTS_BY_KEY.get(normalized) ??
    DROPDOWN_DESTINATION_CONTRACTS.find((destination) =>
      destination.aliases.some((alias) => {
        const aliasKey = normalizeDestinationContractKey(alias);
        return aliasKey && (normalized.includes(aliasKey) || aliasKey.includes(normalized));
      })
    ) ??
    null
  );
}

export function getLocalizedDestinationName(
  destination: Pick<TravelDestinationContract, "nameEn" | "nameZh" | "canonicalName">,
  locale: "zh" | "en"
): string {
  return locale === "zh"
    ? destination.nameZh || destination.canonicalName
    : destination.nameEn || destination.canonicalName;
}

export function getLocalizedAttractionName(
  attraction: Pick<TravelAttractionContract, "nameEn" | "nameZh" | "canonicalName">,
  locale: "zh" | "en"
): string {
  return locale === "zh"
    ? attraction.nameZh || attraction.canonicalName
    : attraction.nameEn || attraction.canonicalName;
}

export function getLocalizedDescription(
  entity: Pick<
    TravelAttractionContract,
    "descriptionEn" | "descriptionZh"
  >,
  locale: "zh" | "en"
): string {
  return locale === "zh"
    ? entity.descriptionZh || entity.descriptionEn
    : entity.descriptionEn || entity.descriptionZh;
}

export function buildLocalFirstDestinationPayload(
  destination: TravelDestinationContract,
  options: { enrichmentQueued?: boolean } = {}
): LocalFirstDestinationPayload {
  const coverImage = destination.coverImage ?? null;
  const attractionCards = destination.attractions.slice(0, 12);
  const markers: LocalFirstDestinationPayload["mapMarkers"] = [];

  if (
    typeof destination.latitude === "number" &&
    typeof destination.longitude === "number"
  ) {
    markers.push({
      id: `${destination.key}-destination`,
      type: "destination",
      labelEn: destination.nameEn,
      labelZh: destination.nameZh,
      latitude: destination.latitude,
      longitude: destination.longitude,
      imageUrl: coverImage?.imageUrl ?? TRAVEL_PLACE_FALLBACK_IMAGE,
      dataQuality: destination.dataQuality,
      sourceStatus: destination.sourceStatus,
    });
  }

  attractionCards.forEach((attraction) => {
    if (
      typeof attraction.latitude !== "number" ||
      typeof attraction.longitude !== "number"
    ) {
      return;
    }
    markers.push({
      id: `${attraction.key}-marker`,
      type: "attraction",
      labelEn: attraction.nameEn,
      labelZh: attraction.nameZh,
      latitude: attraction.latitude,
      longitude: attraction.longitude,
      imageUrl: attraction.image?.imageUrl ?? TRAVEL_PLACE_FALLBACK_IMAGE,
      dataQuality: attraction.dataQuality,
      sourceStatus: attraction.dataQuality === "verified" ? "local_verified" : "placeholder",
    });
  });

  return {
    destination,
    coverImage,
    attractionCards,
    mapMarkers: markers,
    dataQuality: destination.dataQuality,
    sourceStatus: destination.sourceStatus,
    completenessScore: destination.completenessScore,
    missingFields: destination.missingFields,
    enrichment: {
      needed: destination.missingFields.length > 0,
      status:
        destination.missingFields.length === 0
          ? "not_needed"
          : options.enrichmentQueued
            ? "queued"
            : "unavailable",
      messageEn:
        destination.missingFields.length === 0
          ? "Local destination data is complete."
          : "Completing missing images and attraction data.",
      messageZh:
        destination.missingFields.length === 0
          ? "本地目的地资料已完整。"
          : "正在补全图片和景点信息",
    },
  };
}

export function createGeneratedDestinationDraft(
  label: string
): TravelDestinationContract {
  const cleaned = label.trim() || "Unknown destination";
  const key = `generated-${normalizeDestinationContractKey(cleaned) || "destination"}`;

  return {
    key,
    canonicalName: cleaned,
    nameEn: cleaned,
    nameZh: cleaned,
    aliases: [cleaned],
    countryCode: "",
    countryNameEn: "",
    countryNameZh: "",
    region: "",
    city: cleaned,
    latitude: null,
    longitude: null,
    timezone: null,
    currency: null,
    isDropdownEnabled: false,
    isPopular: false,
    isActive: true,
    dataQuality: "generated",
    sourceStatus: "llm_generated",
    completenessScore: 15,
    missingFields: [
      "cover_image",
      "attractions",
      "attraction_images",
      "coordinates",
      "descriptions",
      "localized_names",
    ],
    coverImage: null,
    attractions: [],
  };
}
