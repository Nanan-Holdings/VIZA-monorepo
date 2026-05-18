export type PopularVisaDestination = {
  id: string;
  country: string;
  countryName: string;
  countryNameZh: string;
  visaType: string;
  visaName: string;
  visaNameZh: string;
  description: string;
  descriptionZh: string;
  flag: string;
  region: string;
  supportLabel: string;
};

export const POPULAR_VISA_DESTINATIONS: PopularVisaDestination[] = [
  {
    id: "indonesia-b211a",
    country: "indonesia",
    countryName: "Indonesia",
    countryNameZh: "印度尼西亚",
    visaType: "B211A",
    visaName: "B211A Tourist Visa",
    visaNameZh: "B211A 旅游签证",
    description: "Single-entry visitor visa for tourism and short stays.",
    descriptionZh: "适合旅游和短期停留的单次入境访问签证。",
    flag: "🇮🇩",
    region: "Asia",
    supportLabel: "B211A form",
  },
  {
    id: "us-ds160",
    country: "united_states",
    countryName: "United States",
    countryNameZh: "美国",
    visaType: "DS160",
    visaName: "B1/B2 Visitor Visa",
    visaNameZh: "B1/B2 访客签证",
    description: "DS-160 based tourism or business visitor workflow.",
    descriptionZh: "基于 DS-160 的旅游或商务访客申请流程。",
    flag: "🇺🇸",
    region: "North America",
    supportLabel: "DS-160 form",
  },
  {
    id: "uk-standard-visitor",
    country: "united_kingdom",
    countryName: "United Kingdom",
    countryNameZh: "英国",
    visaType: "UK_STANDARD_VISITOR",
    visaName: "Standard Visitor Visa",
    visaNameZh: "标准访客签证",
    description: "Visitor route for tourism, family visits, business and short study.",
    descriptionZh: "适合旅游、探亲、商务和短期学习的访客路线。",
    flag: "🇬🇧",
    region: "Europe",
    supportLabel: "UKVI form",
  },
  {
    id: "france-schengen",
    country: "france",
    countryName: "France",
    countryNameZh: "法国",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    visaName: "Schengen Short-Stay Visa",
    visaNameZh: "申根短期签证",
    description: "Type C short-stay form for France as main destination.",
    descriptionZh: "以法国为主要目的地的申根 C 类短期签证表单。",
    flag: "🇫🇷",
    region: "Schengen",
    supportLabel: "Schengen Type C",
  },
  {
    id: "germany-schengen",
    country: "germany",
    countryName: "Germany",
    countryNameZh: "德国",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    visaName: "Schengen Short-Stay Visa",
    visaNameZh: "申根短期签证",
    description: "Type C short-stay form for Germany as main destination.",
    descriptionZh: "以德国为主要目的地的申根 C 类短期签证表单。",
    flag: "🇩🇪",
    region: "Schengen",
    supportLabel: "Schengen Type C",
  },
  {
    id: "italy-schengen",
    country: "italy",
    countryName: "Italy",
    countryNameZh: "意大利",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    visaName: "Schengen Short-Stay Visa",
    visaNameZh: "申根短期签证",
    description: "Type C short-stay form for Italy as main destination.",
    descriptionZh: "以意大利为主要目的地的申根 C 类短期签证表单。",
    flag: "🇮🇹",
    region: "Schengen",
    supportLabel: "Schengen Type C",
  },
  {
    id: "spain-schengen",
    country: "spain",
    countryName: "Spain",
    countryNameZh: "西班牙",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    visaName: "Schengen Short-Stay Visa",
    visaNameZh: "申根短期签证",
    description: "Type C short-stay form for Spain as main destination.",
    descriptionZh: "以西班牙为主要目的地的申根 C 类短期签证表单。",
    flag: "🇪🇸",
    region: "Schengen",
    supportLabel: "Schengen Type C",
  },
  {
    id: "netherlands-schengen",
    country: "netherlands",
    countryName: "Netherlands",
    countryNameZh: "荷兰",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    visaName: "Schengen Short-Stay Visa",
    visaNameZh: "申根短期签证",
    description: "Type C short-stay form for the Netherlands as main destination.",
    descriptionZh: "以荷兰为主要目的地的申根 C 类短期签证表单。",
    flag: "🇳🇱",
    region: "Schengen",
    supportLabel: "Schengen Type C",
  },
  {
    id: "switzerland-schengen",
    country: "switzerland",
    countryName: "Switzerland",
    countryNameZh: "瑞士",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    visaName: "Schengen Short-Stay Visa",
    visaNameZh: "申根短期签证",
    description: "Type C short-stay form for Switzerland as main destination.",
    descriptionZh: "以瑞士为主要目的地的申根 C 类短期签证表单。",
    flag: "🇨🇭",
    region: "Schengen",
    supportLabel: "Schengen Type C",
  },
  {
    id: "greece-schengen",
    country: "greece",
    countryName: "Greece",
    countryNameZh: "希腊",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    visaName: "Schengen Short-Stay Visa",
    visaNameZh: "申根短期签证",
    description: "Type C short-stay form for Greece as main destination.",
    descriptionZh: "以希腊为主要目的地的申根 C 类短期签证表单。",
    flag: "🇬🇷",
    region: "Schengen",
    supportLabel: "Schengen Type C",
  },
  {
    id: "portugal-schengen",
    country: "portugal",
    countryName: "Portugal",
    countryNameZh: "葡萄牙",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    visaName: "Schengen Short-Stay Visa",
    visaNameZh: "申根短期签证",
    description: "Type C short-stay form for Portugal as main destination.",
    descriptionZh: "以葡萄牙为主要目的地的申根 C 类短期签证表单。",
    flag: "🇵🇹",
    region: "Schengen",
    supportLabel: "Schengen Type C",
  },
  {
    id: "austria-schengen",
    country: "austria",
    countryName: "Austria",
    countryNameZh: "奥地利",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    visaName: "Schengen Short-Stay Visa",
    visaNameZh: "申根短期签证",
    description: "Type C short-stay form for Austria as main destination.",
    descriptionZh: "以奥地利为主要目的地的申根 C 类短期签证表单。",
    flag: "🇦🇹",
    region: "Schengen",
    supportLabel: "Schengen Type C",
  },
  {
    id: "belgium-schengen",
    country: "belgium",
    countryName: "Belgium",
    countryNameZh: "比利时",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    visaName: "Schengen Short-Stay Visa",
    visaNameZh: "申根短期签证",
    description: "Type C short-stay form for Belgium as main destination.",
    descriptionZh: "以比利时为主要目的地的申根 C 类短期签证表单。",
    flag: "🇧🇪",
    region: "Schengen",
    supportLabel: "Schengen Type C",
  },
  {
    id: "czechia-schengen",
    country: "czechia",
    countryName: "Czechia",
    countryNameZh: "捷克",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    visaName: "Schengen Short-Stay Visa",
    visaNameZh: "申根短期签证",
    description: "Type C short-stay form for Czechia as main destination.",
    descriptionZh: "以捷克为主要目的地的申根 C 类短期签证表单。",
    flag: "🇨🇿",
    region: "Schengen",
    supportLabel: "Schengen Type C",
  },
  {
    id: "denmark-schengen",
    country: "denmark",
    countryName: "Denmark",
    countryNameZh: "丹麦",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    visaName: "Schengen Short-Stay Visa",
    visaNameZh: "申根短期签证",
    description: "Type C short-stay form for Denmark as main destination.",
    descriptionZh: "以丹麦为主要目的地的申根 C 类短期签证表单。",
    flag: "🇩🇰",
    region: "Schengen",
    supportLabel: "Schengen Type C",
  },
  {
    id: "finland-schengen",
    country: "finland",
    countryName: "Finland",
    countryNameZh: "芬兰",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    visaName: "Schengen Short-Stay Visa",
    visaNameZh: "申根短期签证",
    description: "Type C short-stay form for Finland as main destination.",
    descriptionZh: "以芬兰为主要目的地的申根 C 类短期签证表单。",
    flag: "🇫🇮",
    region: "Schengen",
    supportLabel: "Schengen Type C",
  },
  {
    id: "hungary-schengen",
    country: "hungary",
    countryName: "Hungary",
    countryNameZh: "匈牙利",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    visaName: "Schengen Short-Stay Visa",
    visaNameZh: "申根短期签证",
    description: "Type C short-stay form for Hungary as main destination.",
    descriptionZh: "以匈牙利为主要目的地的申根 C 类短期签证表单。",
    flag: "🇭🇺",
    region: "Schengen",
    supportLabel: "Schengen Type C",
  },
  {
    id: "norway-schengen",
    country: "norway",
    countryName: "Norway",
    countryNameZh: "挪威",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    visaName: "Schengen Short-Stay Visa",
    visaNameZh: "申根短期签证",
    description: "Type C short-stay form for Norway as main destination.",
    descriptionZh: "以挪威为主要目的地的申根 C 类短期签证表单。",
    flag: "🇳🇴",
    region: "Schengen",
    supportLabel: "Schengen Type C",
  },
  {
    id: "sweden-schengen",
    country: "sweden",
    countryName: "Sweden",
    countryNameZh: "瑞典",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    visaName: "Schengen Short-Stay Visa",
    visaNameZh: "申根短期签证",
    description: "Type C short-stay form for Sweden as main destination.",
    descriptionZh: "以瑞典为主要目的地的申根 C 类短期签证表单。",
    flag: "🇸🇪",
    region: "Schengen",
    supportLabel: "Schengen Type C",
  },
  {
    id: "poland-schengen",
    country: "poland",
    countryName: "Poland",
    countryNameZh: "波兰",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    visaName: "Schengen Short-Stay Visa",
    visaNameZh: "申根短期签证",
    description: "Type C short-stay form for Poland as main destination.",
    descriptionZh: "以波兰为主要目的地的申根 C 类短期签证表单。",
    flag: "🇵🇱",
    region: "Schengen",
    supportLabel: "Schengen Type C",
  },
  {
    id: "malta-schengen",
    country: "malta",
    countryName: "Malta",
    countryNameZh: "马耳他",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    visaName: "Schengen Short-Stay Visa",
    visaNameZh: "申根短期签证",
    description: "Type C short-stay form for Malta as main destination.",
    descriptionZh: "以马耳他为主要目的地的申根 C 类短期签证表单。",
    flag: "🇲🇹",
    region: "Schengen",
    supportLabel: "Schengen Type C",
  },
  {
    id: "iceland-schengen",
    country: "iceland",
    countryName: "Iceland",
    countryNameZh: "冰岛",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    visaName: "Schengen Short-Stay Visa",
    visaNameZh: "申根短期签证",
    description: "Type C short-stay form for Iceland as main destination.",
    descriptionZh: "以冰岛为主要目的地的申根 C 类短期签证表单。",
    flag: "🇮🇸",
    region: "Schengen",
    supportLabel: "Schengen Type C",
  },
  {
    id: "luxembourg-schengen",
    country: "luxembourg",
    countryName: "Luxembourg",
    countryNameZh: "卢森堡",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    visaName: "Schengen Short-Stay Visa",
    visaNameZh: "申根短期签证",
    description: "Type C short-stay form for Luxembourg as main destination.",
    descriptionZh: "以卢森堡为主要目的地的申根 C 类短期签证表单。",
    flag: "🇱🇺",
    region: "Schengen",
    supportLabel: "Schengen Type C",
  },
  {
    id: "slovenia-schengen",
    country: "slovenia",
    countryName: "Slovenia",
    countryNameZh: "斯洛文尼亚",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    visaName: "Schengen Short-Stay Visa",
    visaNameZh: "申根短期签证",
    description: "Type C short-stay form for Slovenia as main destination.",
    descriptionZh: "以斯洛文尼亚为主要目的地的申根 C 类短期签证表单。",
    flag: "🇸🇮",
    region: "Schengen",
    supportLabel: "Schengen Type C",
  },
];

const COUNTRY_FLAGS = new Map(
  POPULAR_VISA_DESTINATIONS.map((destination) => [
    destination.country,
    destination.flag,
  ]),
);

const COUNTRY_NAMES = new Map(
  POPULAR_VISA_DESTINATIONS.map((destination) => [
    destination.country,
    destination.countryName,
  ]),
);

const COUNTRY_NAMES_ZH = new Map(
  POPULAR_VISA_DESTINATIONS.map((destination) => [
    destination.country,
    destination.countryNameZh,
  ]),
);

const VISA_TYPE_LABELS: Record<string, string> = {
  tourist_b211a: "Tourist Visa B211A",
  B211A: "Tourist Visa B211A",
  B1_B2: "DS-160 Visitor Visa",
  DS160: "DS-160 Visitor Visa",
  UK_STANDARD_VISITOR: "UK Standard Visitor Visa",
  EU_SCHENGEN_C_SHORT_STAY: "Schengen Short-Stay Visa",
};

const VISA_TYPE_LABELS_ZH: Record<string, string> = {
  tourist_b211a: "B211A 旅游签证",
  B211A: "B211A 旅游签证",
  B1_B2: "B1/B2 访客签证",
  DS160: "B1/B2 访客签证",
  UK_STANDARD_VISITOR: "英国标准访客签证",
  EU_SCHENGEN_C_SHORT_STAY: "申根短期签证",
};

export function getPopularVisaDestination(destinationId: string): PopularVisaDestination | null {
  return POPULAR_VISA_DESTINATIONS.find((destination) => destination.id === destinationId) ?? null;
}

export function getPopularVisaDestinationByPackage(country: string, visaType: string): PopularVisaDestination | null {
  const normalizedCountry = country.toLowerCase();
  const normalizedVisaType = getFormVisaType(visaType).toLowerCase();
  return POPULAR_VISA_DESTINATIONS.find((destination) =>
    destination.country === normalizedCountry &&
    getFormVisaType(destination.visaType).toLowerCase() === normalizedVisaType
  ) ?? null;
}

export function getDestinationFlag(country: string): string {
  return COUNTRY_FLAGS.get(country.toLowerCase()) ?? "🌐";
}

export function getDestinationDisplayName(country: string): string {
  return COUNTRY_NAMES.get(country.toLowerCase()) ?? country.replace(/_/g, " ");
}

export function getDestinationDisplayNameZh(country: string): string {
  return COUNTRY_NAMES_ZH.get(country.toLowerCase()) ?? getDestinationDisplayName(country);
}

export function getVisaTypeDisplayName(visaType: string): string {
  return VISA_TYPE_LABELS[visaType] ?? visaType.replace(/_/g, " ");
}

export function getVisaTypeDisplayNameZh(visaType: string): string {
  return VISA_TYPE_LABELS_ZH[visaType] ?? getVisaTypeDisplayName(visaType);
}

export function getFormVisaType(visaType: string): string {
  if (visaType === "B1_B2") return "DS160";
  if (visaType === "tourist_b211a") return "B211A";
  return visaType;
}

export function getVisaDestinationKey(country: string, visaType: string): string {
  return `${country.toLowerCase()}::${getFormVisaType(visaType).toLowerCase()}`;
}

export function getVisaPackageTitleZh(country: string, visaType: string): string {
  const destination = getPopularVisaDestinationByPackage(country, visaType);
  if (destination) return `${destination.countryNameZh}${destination.visaNameZh}`;
  return `${getDestinationDisplayNameZh(country)}${getVisaTypeDisplayNameZh(visaType)}`;
}
