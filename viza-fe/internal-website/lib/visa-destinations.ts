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

const VISA_TYPE_LABELS: Record<string, string> = {
  tourist_b211a: "Tourist Visa B211A",
  B211A: "Tourist Visa B211A",
  B1_B2: "DS-160 Visitor Visa",
  DS160: "DS-160 Visitor Visa",
  UK_STANDARD_VISITOR: "UK Standard Visitor Visa",
  EU_SCHENGEN_C_SHORT_STAY: "Schengen Short-Stay Visa",
};

export function getPopularVisaDestination(destinationId: string): PopularVisaDestination | null {
  return POPULAR_VISA_DESTINATIONS.find((destination) => destination.id === destinationId) ?? null;
}

export function getDestinationFlag(country: string): string {
  return COUNTRY_FLAGS.get(country.toLowerCase()) ?? "🌐";
}

export function getDestinationDisplayName(country: string): string {
  return COUNTRY_NAMES.get(country.toLowerCase()) ?? country.replace(/_/g, " ");
}

export function getVisaTypeDisplayName(visaType: string): string {
  return VISA_TYPE_LABELS[visaType] ?? visaType.replace(/_/g, " ");
}

export function getFormVisaType(visaType: string): string {
  if (visaType === "B1_B2") return "DS160";
  if (visaType === "tourist_b211a") return "B211A";
  return visaType;
}
