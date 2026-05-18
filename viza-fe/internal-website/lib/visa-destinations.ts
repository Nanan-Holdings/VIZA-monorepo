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
  kind?: "destination" | "group";
  href?: string;
  countryCount?: number;
  searchAliases?: string[];
};

type DestinationInput = Omit<PopularVisaDestination, "id" | "kind" | "supportLabel"> & {
  id?: string;
  supportLabel?: string;
};

const RAG_VISITOR_SUPPORT_LABEL = "RAG visitor intake";
const SCHENGEN_VISA_TYPE = "EU_SCHENGEN_C_SHORT_STAY";

function slug(value: string): string {
  return value.toLowerCase().replace(/_/g, "-");
}

function destination(input: DestinationInput): PopularVisaDestination {
  return {
    ...input,
    id: input.id ?? `${slug(input.country)}-${slug(input.visaType)}`,
    kind: "destination",
    supportLabel: input.supportLabel ?? RAG_VISITOR_SUPPORT_LABEL,
  };
}

function schengenDestination(
  country: string,
  countryName: string,
  countryNameZh: string,
  flag: string,
): PopularVisaDestination {
  return destination({
    country,
    countryName,
    countryNameZh,
    visaType: SCHENGEN_VISA_TYPE,
    visaName: "Schengen Short-Stay Visa",
    visaNameZh: "申根短期签证",
    description: `Type C short-stay form for ${countryName} as main destination.`,
    descriptionZh: `以${countryNameZh}为主要目的地的申根 C 类短期签证表单。`,
    flag,
    region: "Schengen",
    supportLabel: "Schengen Type C",
    searchAliases: ["Schengen", "申根"],
  });
}

function sortDestinations(destinations: PopularVisaDestination[]): PopularVisaDestination[] {
  return [...destinations].sort((a, b) => a.countryName.localeCompare(b.countryName, "en"));
}

export const SCHENGEN_VISA_DESTINATIONS: PopularVisaDestination[] = sortDestinations([
  schengenDestination("austria", "Austria", "奥地利", "🇦🇹"),
  schengenDestination("belgium", "Belgium", "比利时", "🇧🇪"),
  schengenDestination("bulgaria", "Bulgaria", "保加利亚", "🇧🇬"),
  schengenDestination("croatia", "Croatia", "克罗地亚", "🇭🇷"),
  schengenDestination("czech_republic", "Czech Republic", "捷克", "🇨🇿"),
  schengenDestination("denmark", "Denmark", "丹麦", "🇩🇰"),
  schengenDestination("estonia", "Estonia", "爱沙尼亚", "🇪🇪"),
  schengenDestination("finland", "Finland", "芬兰", "🇫🇮"),
  schengenDestination("france", "France", "法国", "🇫🇷"),
  schengenDestination("germany", "Germany", "德国", "🇩🇪"),
  schengenDestination("greece", "Greece", "希腊", "🇬🇷"),
  schengenDestination("hungary", "Hungary", "匈牙利", "🇭🇺"),
  schengenDestination("iceland", "Iceland", "冰岛", "🇮🇸"),
  schengenDestination("italy", "Italy", "意大利", "🇮🇹"),
  schengenDestination("latvia", "Latvia", "拉脱维亚", "🇱🇻"),
  schengenDestination("liechtenstein", "Liechtenstein", "列支敦士登", "🇱🇮"),
  schengenDestination("lithuania", "Lithuania", "立陶宛", "🇱🇹"),
  schengenDestination("luxembourg", "Luxembourg", "卢森堡", "🇱🇺"),
  schengenDestination("malta", "Malta", "马耳他", "🇲🇹"),
  schengenDestination("netherlands", "Netherlands", "荷兰", "🇳🇱"),
  schengenDestination("norway", "Norway", "挪威", "🇳🇴"),
  schengenDestination("poland", "Poland", "波兰", "🇵🇱"),
  schengenDestination("portugal", "Portugal", "葡萄牙", "🇵🇹"),
  schengenDestination("romania", "Romania", "罗马尼亚", "🇷🇴"),
  schengenDestination("slovakia", "Slovakia", "斯洛伐克", "🇸🇰"),
  schengenDestination("slovenia", "Slovenia", "斯洛文尼亚", "🇸🇮"),
  schengenDestination("spain", "Spain", "西班牙", "🇪🇸"),
  schengenDestination("sweden", "Sweden", "瑞典", "🇸🇪"),
  schengenDestination("switzerland", "Switzerland", "瑞士", "🇨🇭"),
]);

const NON_SCHENGEN_VISA_DESTINATIONS: PopularVisaDestination[] = sortDestinations([
  destination({
    country: "australia",
    countryName: "Australia",
    countryNameZh: "澳大利亚",
    visaType: "visitor_subclass_600",
    visaName: "Visitor Visa Subclass 600",
    visaNameZh: "访客签证 Subclass 600",
    description: "Visitor visa intake for tourism, family visits or short business visits.",
    descriptionZh: "适合旅游、探亲访友或短期商务访问的澳大利亚访客签证信息采集。",
    flag: "🇦🇺",
    region: "Oceania",
    searchAliases: ["澳洲", "Home Affairs", "ImmiAccount"],
  }),
  destination({
    country: "cambodia",
    countryName: "Cambodia",
    countryNameZh: "柬埔寨",
    visaType: "tourist_evisa",
    visaName: "Tourist eVisa",
    visaNameZh: "旅游电子签证",
    description: "Tourist eVisa intake for short tourism visits.",
    descriptionZh: "适合短期旅游访问的柬埔寨电子签证信息采集。",
    flag: "🇰🇭",
    region: "Asia",
  }),
  destination({
    country: "canada",
    countryName: "Canada",
    countryNameZh: "加拿大",
    visaType: "visitor_visa",
    visaName: "Visitor Visa",
    visaNameZh: "访客签证",
    description: "Temporary resident visitor intake for tourism, family visits or business.",
    descriptionZh: "适合旅游、探亲访友或商务访问的加拿大访客签证信息采集。",
    flag: "🇨🇦",
    region: "North America",
    searchAliases: ["TRV", "IRCC"],
  }),
  destination({
    country: "egypt",
    countryName: "Egypt",
    countryNameZh: "埃及",
    visaType: "evisa_tourism",
    visaName: "Tourist e-Visa",
    visaNameZh: "旅游电子签证",
    description: "Official e-Visa portal intake for tourism travel to Egypt.",
    descriptionZh: "基于埃及官方 e-Visa 入口的旅游签证信息采集。",
    flag: "🇪🇬",
    region: "Africa",
    searchAliases: ["visa2egypt", "Egypt e-Visa Portal"],
  }),
  destination({
    country: "india",
    countryName: "India",
    countryNameZh: "印度",
    visaType: "regular_tourist_visa",
    visaName: "Tourist Visa",
    visaNameZh: "旅游签证",
    description: "Tourist visa intake for short travel to India.",
    descriptionZh: "适合短期赴印度旅游的签证信息采集。",
    flag: "🇮🇳",
    region: "Asia",
  }),
  destination({
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
  }),
  destination({
    country: "japan",
    countryName: "Japan",
    countryNameZh: "日本",
    visaType: "short_term_tourism_evisa",
    visaName: "Short-Term Tourism eVisa",
    visaNameZh: "短期旅游电子签证",
    description: "Short-term tourism intake for eligible Japan eVISA or consular routes.",
    descriptionZh: "适合日本短期旅游电子签证或领馆路径的信息采集。",
    flag: "🇯🇵",
    region: "Asia",
  }),
  destination({
    country: "laos",
    countryName: "Laos",
    countryNameZh: "老挝",
    visaType: "tourist_evisa",
    visaName: "Tourist eVisa",
    visaNameZh: "旅游电子签证",
    description: "Tourist eVisa intake for short tourism visits.",
    descriptionZh: "适合短期旅游访问的老挝电子签证信息采集。",
    flag: "🇱🇦",
    region: "Asia",
  }),
  destination({
    country: "malaysia",
    countryName: "Malaysia",
    countryNameZh: "马来西亚",
    visaType: "visa_exemption_or_evisa_tourism",
    visaName: "Tourism Entry / eVisa",
    visaNameZh: "旅游入境 / 电子签证",
    description: "Tourism intake for visa-exempt or eVisa routes where applicable.",
    descriptionZh: "适合免签或电子签证路径的马来西亚旅游入境信息采集。",
    flag: "🇲🇾",
    region: "Asia",
  }),
  destination({
    country: "maldives",
    countryName: "Maldives",
    countryNameZh: "马尔代夫",
    visaType: "tourist_visa_on_arrival",
    visaName: "Tourist Visa on Arrival",
    visaNameZh: "旅游落地签",
    description: "Arrival-card and tourism intake for Maldives visitor travel.",
    descriptionZh: "适合马尔代夫旅游落地签和入境资料准备的信息采集。",
    flag: "🇲🇻",
    region: "Asia",
  }),
  destination({
    country: "mexico",
    countryName: "Mexico",
    countryNameZh: "墨西哥",
    visaType: "visitor_visa_or_exemption",
    visaName: "Visitor Visa / Exemption",
    visaNameZh: "访客签证 / 豁免",
    description: "Visitor intake for Mexico visa or eligible exemption scenarios.",
    descriptionZh: "适合墨西哥访客签证或符合条件豁免场景的信息采集。",
    flag: "🇲🇽",
    region: "North America",
  }),
  destination({
    country: "morocco",
    countryName: "Morocco",
    countryNameZh: "摩洛哥",
    visaType: "visa_free_or_evisa",
    visaName: "Visitor Entry / eVisa",
    visaNameZh: "访客入境 / 电子签证",
    description: "Tourism intake for visa-free or eVisa routes where applicable.",
    descriptionZh: "适合摩洛哥免签或电子签证路径的信息采集。",
    flag: "🇲🇦",
    region: "Africa",
  }),
  destination({
    country: "nepal",
    countryName: "Nepal",
    countryNameZh: "尼泊尔",
    visaType: "tourist_visa_on_arrival",
    visaName: "Tourist Visa on Arrival",
    visaNameZh: "旅游落地签",
    description: "Tourist visa on arrival intake for Nepal travel.",
    descriptionZh: "适合尼泊尔旅游落地签的信息采集。",
    flag: "🇳🇵",
    region: "Asia",
  }),
  destination({
    country: "new_zealand",
    countryName: "New Zealand",
    countryNameZh: "新西兰",
    visaType: "visitor_visa",
    visaName: "Visitor Visa",
    visaNameZh: "访客签证",
    description: "Visitor visa intake for tourism or family visits.",
    descriptionZh: "适合旅游或探亲访友的新西兰访客签证信息采集。",
    flag: "🇳🇿",
    region: "Oceania",
  }),
  destination({
    country: "philippines",
    countryName: "Philippines",
    countryNameZh: "菲律宾",
    visaType: "visa_free_14_days_or_evisa",
    visaName: "Visitor Entry / eVisa",
    visaNameZh: "访客入境 / 电子签证",
    description: "Visitor intake for visa-free or eVisa routes where applicable.",
    descriptionZh: "适合菲律宾免签或电子签证路径的信息采集。",
    flag: "🇵🇭",
    region: "Asia",
  }),
  destination({
    country: "qatar",
    countryName: "Qatar",
    countryNameZh: "卡塔尔",
    visaType: "hayya_a1_tourist_visa",
    visaName: "Hayya A1 Tourist Visa",
    visaNameZh: "Hayya A1 旅游签证",
    description: "Hayya tourist intake for Qatar visitor travel.",
    descriptionZh: "适合卡塔尔 Hayya A1 旅游签证的信息采集。",
    flag: "🇶🇦",
    region: "Middle East",
  }),
  destination({
    country: "saudi_arabia",
    countryName: "Saudi Arabia",
    countryNameZh: "沙特阿拉伯",
    visaType: "tourist_evisa",
    visaName: "Tourist eVisa",
    visaNameZh: "旅游电子签证",
    description: "Tourist eVisa intake for Saudi Arabia visitor travel.",
    descriptionZh: "适合沙特阿拉伯旅游电子签证的信息采集。",
    flag: "🇸🇦",
    region: "Middle East",
  }),
  destination({
    country: "singapore",
    countryName: "Singapore",
    countryNameZh: "新加坡",
    visaType: "entry_visa_or_visit_pass",
    visaName: "Entry Visa / Visit Pass",
    visaNameZh: "入境签证 / 访问准证",
    description: "Visitor entry intake for Singapore travel.",
    descriptionZh: "适合新加坡访客入境资料准备的信息采集。",
    flag: "🇸🇬",
    region: "Asia",
  }),
  destination({
    country: "south_africa",
    countryName: "South Africa",
    countryNameZh: "南非",
    visaType: "visitor_visa_tourism",
    visaName: "Visitor Visa",
    visaNameZh: "访客签证",
    description: "Visitor visa intake for tourism travel to South Africa.",
    descriptionZh: "适合赴南非旅游访问的签证信息采集。",
    flag: "🇿🇦",
    region: "Africa",
  }),
  destination({
    country: "south_korea",
    countryName: "South Korea",
    countryNameZh: "韩国",
    visaType: "c3_or_keta",
    visaName: "C-3 Visa / K-ETA",
    visaNameZh: "C-3 签证 / K-ETA",
    description: "Short-stay visitor intake for South Korea travel.",
    descriptionZh: "适合韩国短期访问签证或 K-ETA 路径的信息采集。",
    flag: "🇰🇷",
    region: "Asia",
  }),
  destination({
    country: "sri_lanka",
    countryName: "Sri Lanka",
    countryNameZh: "斯里兰卡",
    visaType: "eta_tourism",
    visaName: "Tourist ETA",
    visaNameZh: "旅游 ETA",
    description: "Tourist ETA intake for Sri Lanka visitor travel.",
    descriptionZh: "适合斯里兰卡旅游 ETA 的信息采集。",
    flag: "🇱🇰",
    region: "Asia",
  }),
  destination({
    country: "thailand",
    countryName: "Thailand",
    countryNameZh: "泰国",
    visaType: "visa_exemption_or_tourist_visa",
    visaName: "Tourist Entry",
    visaNameZh: "旅游入境",
    description: "Tourism intake for visa-exempt or tourist visa routes.",
    descriptionZh: "适合泰国免签或旅游签证路径的信息采集。",
    flag: "🇹🇭",
    region: "Asia",
  }),
  destination({
    country: "turkey",
    countryName: "Turkiye",
    countryNameZh: "土耳其",
    visaType: "evisa_tourism_business",
    visaName: "eVisa Tourism / Business",
    visaNameZh: "旅游 / 商务电子签证",
    description: "eVisa intake for tourism or commerce travel to Turkiye.",
    descriptionZh: "适合土耳其旅游或商务电子签证的信息采集。",
    flag: "🇹🇷",
    region: "Europe / Asia",
    searchAliases: ["Turkey"],
  }),
  destination({
    country: "united_arab_emirates",
    countryName: "United Arab Emirates",
    countryNameZh: "阿联酋",
    visaType: "visa_free_or_tourist_visa",
    visaName: "Tourist Entry / Visa",
    visaNameZh: "旅游入境 / 签证",
    description: "Visitor intake for UAE visa-free or tourist visa routes.",
    descriptionZh: "适合阿联酋免签或旅游签证路径的信息采集。",
    flag: "🇦🇪",
    region: "Middle East",
    searchAliases: ["UAE", "Dubai", "Abu Dhabi", "迪拜", "阿布扎比"],
  }),
  destination({
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
    searchAliases: ["UK", "Britain", "England", "GOV.UK"],
  }),
  destination({
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
    searchAliases: ["US", "USA", "B1/B2", "DS-160"],
  }),
  destination({
    country: "vietnam",
    countryName: "Vietnam",
    countryNameZh: "越南",
    visaType: "evisa_tourism",
    visaName: "Tourist eVisa",
    visaNameZh: "旅游电子签证",
    description: "Tourist eVisa intake for Vietnam visitor travel.",
    descriptionZh: "适合越南旅游电子签证的信息采集。",
    flag: "🇻🇳",
    region: "Asia",
  }),
]);

export const SCHENGEN_GROUP_DESTINATION: PopularVisaDestination = {
  id: "schengen-area",
  country: "schengen_area",
  countryName: "Schengen Area",
  countryNameZh: "申根区",
  visaType: SCHENGEN_VISA_TYPE,
  visaName: "Schengen Short-Stay Visa",
  visaNameZh: "申根短期签证",
  description: "Choose a main destination country inside the Schengen Area.",
  descriptionZh: "先进入申根国家列表，再选择主要目的地国家。",
  flag: "🇪🇺",
  region: "Schengen",
  supportLabel: "Schengen countries",
  kind: "group",
  href: "/client/destinations/schengen",
  countryCount: SCHENGEN_VISA_DESTINATIONS.length,
  searchAliases: SCHENGEN_VISA_DESTINATIONS.flatMap((destinationItem) => [
    destinationItem.countryName,
    destinationItem.countryNameZh,
    ...(destinationItem.searchAliases ?? []),
  ]),
};

export const POPULAR_VISA_DESTINATIONS: PopularVisaDestination[] = sortDestinations([
  ...NON_SCHENGEN_VISA_DESTINATIONS,
  SCHENGEN_GROUP_DESTINATION,
]);

const SELECTABLE_VISA_DESTINATIONS = [
  ...NON_SCHENGEN_VISA_DESTINATIONS,
  ...SCHENGEN_VISA_DESTINATIONS,
];

const COUNTRY_FLAGS = new Map(
  SELECTABLE_VISA_DESTINATIONS.map((destinationItem) => [
    destinationItem.country,
    destinationItem.flag,
  ]),
);

const COUNTRY_NAMES = new Map(
  SELECTABLE_VISA_DESTINATIONS.map((destinationItem) => [
    destinationItem.country,
    destinationItem.countryName,
  ]),
);

const COUNTRY_NAMES_ZH = new Map(
  SELECTABLE_VISA_DESTINATIONS.map((destinationItem) => [
    destinationItem.country,
    destinationItem.countryNameZh,
  ]),
);

const VISA_TYPE_LABELS: Record<string, string> = {
  tourist_b211a: "Tourist Visa B211A",
  B211A: "Tourist Visa B211A",
  B1_B2: "DS-160 Visitor Visa",
  DS160: "DS-160 Visitor Visa",
  UK_STANDARD_VISITOR: "UK Standard Visitor Visa",
  EU_SCHENGEN_C_SHORT_STAY: "Schengen Short-Stay Visa",
  visitor_subclass_600: "Australia Visitor Visa Subclass 600",
  visitor_visa: "Visitor Visa",
  evisa_tourism: "Tourist eVisa",
  tourist_evisa: "Tourist eVisa",
  short_term_tourism_evisa: "Short-Term Tourism eVisa",
  regular_tourist_visa: "Tourist Visa",
  visa_exemption_or_evisa_tourism: "Tourism Entry / eVisa",
  tourist_visa_on_arrival: "Tourist Visa on Arrival",
  visitor_visa_or_exemption: "Visitor Visa / Exemption",
  visa_free_or_evisa: "Visitor Entry / eVisa",
  visa_free_14_days_or_evisa: "Visitor Entry / eVisa",
  hayya_a1_tourist_visa: "Hayya A1 Tourist Visa",
  entry_visa_or_visit_pass: "Entry Visa / Visit Pass",
  visitor_visa_tourism: "Visitor Visa",
  c3_or_keta: "C-3 Visa / K-ETA",
  eta_tourism: "Tourist ETA",
  visa_exemption_or_tourist_visa: "Tourist Entry",
  evisa_tourism_business: "eVisa Tourism / Business",
  visa_free_or_tourist_visa: "Tourist Entry / Visa",
};

const VISA_TYPE_LABELS_ZH: Record<string, string> = {
  tourist_b211a: "B211A 旅游签证",
  B211A: "B211A 旅游签证",
  B1_B2: "B1/B2 访客签证",
  DS160: "B1/B2 访客签证",
  UK_STANDARD_VISITOR: "英国标准访客签证",
  EU_SCHENGEN_C_SHORT_STAY: "申根短期签证",
  visitor_subclass_600: "澳大利亚访客签证 Subclass 600",
  visitor_visa: "访客签证",
  evisa_tourism: "旅游电子签证",
  tourist_evisa: "旅游电子签证",
  short_term_tourism_evisa: "短期旅游电子签证",
  regular_tourist_visa: "旅游签证",
  visa_exemption_or_evisa_tourism: "旅游入境 / 电子签证",
  tourist_visa_on_arrival: "旅游落地签",
  visitor_visa_or_exemption: "访客签证 / 豁免",
  visa_free_or_evisa: "访客入境 / 电子签证",
  visa_free_14_days_or_evisa: "访客入境 / 电子签证",
  hayya_a1_tourist_visa: "Hayya A1 旅游签证",
  entry_visa_or_visit_pass: "入境签证 / 访问准证",
  visitor_visa_tourism: "访客签证",
  c3_or_keta: "C-3 签证 / K-ETA",
  eta_tourism: "旅游 ETA",
  visa_exemption_or_tourist_visa: "旅游入境",
  evisa_tourism_business: "旅游 / 商务电子签证",
  visa_free_or_tourist_visa: "旅游入境 / 签证",
};

export function getPopularVisaDestination(destinationId: string): PopularVisaDestination | null {
  return SELECTABLE_VISA_DESTINATIONS.find((destinationItem) => destinationItem.id === destinationId) ?? null;
}

export function getPopularVisaDestinationByPackage(country: string, visaType: string): PopularVisaDestination | null {
  const normalizedCountry = country.toLowerCase();
  const normalizedVisaType = getFormVisaType(visaType).toLowerCase();
  return SELECTABLE_VISA_DESTINATIONS.find((destinationItem) =>
    destinationItem.country === normalizedCountry &&
    getFormVisaType(destinationItem.visaType).toLowerCase() === normalizedVisaType
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
  const destinationItem = getPopularVisaDestinationByPackage(country, visaType);
  if (destinationItem) return `${destinationItem.countryNameZh}${destinationItem.visaNameZh}`;
  return `${getDestinationDisplayNameZh(country)}${getVisaTypeDisplayNameZh(visaType)}`;
}
