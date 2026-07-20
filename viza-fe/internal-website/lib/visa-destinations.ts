import { matchesSearchText, normalizeSearchText } from "@/lib/utils";

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

export type VisaDestinationRegionId =
  | "indonesia"
  | "vietnam"
  | "north-america"
  | "south-america"
  | "middle-east"
  | "africa"
  | "schengen"
  | "europe-non-schengen"
  | "southeast-asia"
  | "east-asia"
  | "south-asia"
  | "oceania";

/**
 * Matches destination cards only against their country name. Latin queries use
 * the English country name; queries containing Chinese characters use the
 * Chinese country name. Visa names, descriptions, regions, and aliases are
 * deliberately excluded so short terms cannot produce incidental matches.
 */
export function matchesVisaDestinationSearch(
  destinationItem: PopularVisaDestination,
  searchQuery: string,
): boolean {
  const normalizedSearch = normalizeSearchText(searchQuery);
  if (!normalizedSearch) return true;

  const countryName = /\p{Script=Han}/u.test(normalizedSearch)
    ? destinationItem.countryNameZh
    : destinationItem.countryName;

  return matchesSearchText(normalizedSearch, [countryName]);
}

export type VisaDestinationRegionGroup = {
  id: VisaDestinationRegionId;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  flag: string;
  destinationIds: string[];
  href: string;
};

type DestinationInput = Omit<PopularVisaDestination, "id" | "kind" | "supportLabel"> & {
  id?: string;
  supportLabel?: string;
};

const VISITOR_INTAKE_SUPPORT_LABEL = "Visitor intake";
const SCHENGEN_VISA_TYPE = "EU_SCHENGEN_C_SHORT_STAY";

function slug(value: string): string {
  return value.toLowerCase().replace(/_/g, "-");
}

function destination(input: DestinationInput): PopularVisaDestination {
  return {
    ...input,
    id: input.id ?? `${slug(input.country)}-${slug(input.visaType)}`,
    kind: "destination",
    supportLabel: input.supportLabel ?? VISITOR_INTAKE_SUPPORT_LABEL,
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

export const NON_SCHENGEN_VISA_DESTINATIONS: PopularVisaDestination[] = sortDestinations([
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
    country: "argentina",
    countryName: "Argentina",
    countryNameZh: "阿根廷",
    visaType: "tourist_visa_or_ave",
    visaName: "Tourist Visa / AVE",
    visaNameZh: "旅游签证 / AVE",
    description: "Tourist visa or electronic travel authorization intake for Argentina travel.",
    descriptionZh: "适合阿根廷旅游签证或电子旅行授权路径的信息采集。",
    flag: "🇦🇷",
    region: "South America",
    searchAliases: ["AVE Argentina", "Argentina.gob.ar", "Cancilleria Argentina"],
  }),
  destination({
    country: "brazil",
    countryName: "Brazil",
    countryNameZh: "巴西",
    visaType: "visitor_visa_or_evisa",
    visaName: "Visitor Visa / eVisa",
    visaNameZh: "访客签证 / 电子签证",
    description: "Visitor visa or eVisa intake for Brazil tourism and short stays.",
    descriptionZh: "适合巴西旅游和短期停留的访客签证或电子签证信息采集。",
    flag: "🇧🇷",
    region: "South America",
    searchAliases: ["Brazil eVisa", "VFS Brazil", "MRE Brazil"],
  }),
  destination({
    country: "cambodia",
    countryName: "Cambodia",
    countryNameZh: "柬埔寨",
    visaType: "tourist_evisa",
    visaName: "Tourist eVisa / e-Arrival",
    visaNameZh: "旅游电子签证 / e-Arrival",
    description: "Tourist eVisa and Cambodia e-Arrival intake for short tourism visits.",
    descriptionZh: "适合短期旅游访问的柬埔寨电子签证和 e-Arrival 入境资料采集。",
    flag: "🇰🇭",
    region: "Asia",
    searchAliases: ["Cambodia e-Arrival", "arrival.gov.kh"],
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
    country: "chile",
    countryName: "Chile",
    countryNameZh: "智利",
    visaType: "tourist_visa",
    visaName: "Tourist Visa",
    visaNameZh: "旅游签证",
    description: "Tourist visa intake for Chile visitor travel where a visa is required.",
    descriptionZh: "适合需要签证时赴智利旅游访问的信息采集。",
    flag: "🇨🇱",
    region: "South America",
    searchAliases: ["Chile Consulado", "Chile tourist visa"],
  }),
  destination({
    country: "china",
    countryName: "China",
    countryNameZh: "中国",
    visaType: "tourist_l_visa",
    visaName: "Tourist Visa (L Visa)",
    visaNameZh: "旅游签证（L 签证）",
    description: "Tourist L visa intake for mainland China visitor travel.",
    descriptionZh: "适合赴中国大陆旅游访问的 L 字旅游签证信息采集。",
    flag: "🇨🇳",
    region: "Asia",
    searchAliases: ["China L visa", "COVA", "visaforchina"],
  }),
  destination({
    country: "colombia",
    countryName: "Colombia",
    countryNameZh: "哥伦比亚",
    visaType: "check_mig_or_visitor_visa",
    visaName: "Check-Mig / Visitor Visa",
    visaNameZh: "Check-Mig / 访客签证",
    description: "Check-Mig pre-registration and visitor visa intake for Colombia travel.",
    descriptionZh: "适合哥伦比亚 Check-Mig 预登记和访客签证路径的信息采集。",
    flag: "🇨🇴",
    region: "South America",
    searchAliases: ["Check-Mig", "Migracion Colombia"],
  }),
  destination({
    country: "cuba",
    countryName: "Cuba",
    countryNameZh: "古巴",
    visaType: "dviajeros_entry_form",
    visaName: "D'Viajeros Entry Form",
    visaNameZh: "D'Viajeros 入境申报",
    description: "D'Viajeros traveller information intake for Cuba entry.",
    descriptionZh: "适合古巴 D'Viajeros 旅客信息和入境申报资料采集。",
    flag: "🇨🇺",
    region: "North America",
    searchAliases: ["D'Viajeros", "DViajeros Cuba"],
  }),
  destination({
    country: "dominican_republic",
    countryName: "Dominican Republic",
    countryNameZh: "多米尼加共和国",
    visaType: "eticket_entry_exit",
    visaName: "e-Ticket Entry / Exit Form",
    visaNameZh: "e-Ticket 入出境表",
    description: "Electronic entry and exit ticket intake for Dominican Republic travel.",
    descriptionZh: "适合多米尼加共和国电子入境和离境表的信息采集。",
    flag: "🇩🇴",
    region: "North America",
    searchAliases: ["Dominican Republic e-Ticket", "eticket migracion"],
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
    visaType: "ID_C1_TOURIST",
    visaName: "C1 Tourist Single Entry eVisa",
    visaNameZh: "C1 单次入境旅游电子签证",
    description: "Official Indonesia eVisa tourist route for single-entry short stays.",
    descriptionZh: "通过印尼官方 eVisa 门户办理的单次入境短期旅游签证。",
    flag: "🇮🇩",
    region: "Asia",
    supportLabel: "Indonesia eVisa",
    searchAliases: ["Indonesia C1", "B211A", "Tourist Single Entry", "evisa.imigrasi.go.id"],
  }),
  destination({
    country: "indonesia",
    countryName: "Indonesia",
    countryNameZh: "印度尼西亚",
    visaType: "ID_B1_EVOA",
    visaName: "B1 e-VoA",
    visaNameZh: "B1 电子落地签",
    description: "Official Indonesia eVisa route for eligible short tourist arrivals.",
    descriptionZh: "通过印尼官方 eVisa 门户办理，适合符合条件旅客短期旅游入境。",
    flag: "🇮🇩",
    region: "Asia",
    supportLabel: "Indonesia e-VoA",
    searchAliases: ["Indonesia B1", "e-VoA", "eVOA", "Visa on Arrival", "evisa.imigrasi.go.id"],
  }),
  destination({
    country: "ireland",
    countryName: "Ireland",
    countryNameZh: "爱尔兰",
    visaType: "short_stay_c_visit_visa",
    visaName: "Short Stay C Visit Visa",
    visaNameZh: "短期 C 类访问签证",
    description: "Short stay visit or holiday visa intake for Ireland travel.",
    descriptionZh: "适合赴爱尔兰短期访问或旅游的 C 类签证信息采集。",
    flag: "🇮🇪",
    region: "Europe",
    searchAliases: ["Irish short stay C visa", "AVATS"],
  }),
  destination({
    country: "israel",
    countryName: "Israel",
    countryNameZh: "以色列",
    visaType: "eta_il_or_visitor_visa",
    visaName: "ETA-IL / Visitor Visa",
    visaNameZh: "ETA-IL / 访客签证",
    description: "ETA-IL or visitor visa intake for Israel short-stay travel.",
    descriptionZh: "适合以色列 ETA-IL 或短期访客签证路径的信息采集。",
    flag: "🇮🇱",
    region: "Middle East",
    searchAliases: ["ETA-IL", "Israel Population and Immigration Authority"],
  }),
  destination({
    country: "japan",
    countryName: "Japan",
    countryNameZh: "日本",
    visaType: "short_term_tourism_evisa",
    visaName: "Short-Term eVisa / Visit Japan Web",
    visaNameZh: "短期电子签证 / Visit Japan Web",
    description: "Japan eVISA or consular intake plus Visit Japan Web entry and customs preparation.",
    descriptionZh: "适合日本电子签证或领馆路径，并准备 Visit Japan Web 入境和海关资料。",
    flag: "🇯🇵",
    region: "Asia",
    searchAliases: ["Japan eVISA", "Visit Japan Web", "VJW"],
  }),
  destination({
    country: "jordan",
    countryName: "Jordan",
    countryNameZh: "约旦",
    visaType: "evisa_or_visitor_visa",
    visaName: "eVisa / Visitor Visa",
    visaNameZh: "电子签证 / 访客签证",
    description: "eVisa or visitor visa intake for Jordan tourism travel.",
    descriptionZh: "适合约旦旅游访问的电子签证或访客签证信息采集。",
    flag: "🇯🇴",
    region: "Middle East",
    searchAliases: ["Jordan eVisa", "Jordan Pass"],
  }),
  destination({
    country: "kenya",
    countryName: "Kenya",
    countryNameZh: "肯尼亚",
    visaType: "eta_travel_authorization",
    visaName: "Electronic Travel Authorisation",
    visaNameZh: "电子旅行授权 eTA",
    description: "Kenya eTA intake for visitor travel and short stays.",
    descriptionZh: "适合肯尼亚 eTA 电子旅行授权和短期访问的信息采集。",
    flag: "🇰🇪",
    region: "Africa",
    searchAliases: ["Kenya eTA", "etakenya"],
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
    visaType: "MY_MDAC_ARRIVAL_CARD",
    visaName: "Malaysia Digital Arrival Card",
    visaNameZh: "MDAC 数字入境卡",
    description: "Malaysia Digital Arrival Card traveller declaration preparation.",
    descriptionZh: "适合马来西亚 MDAC 数字入境卡旅客申报资料准备。",
    flag: "🇲🇾",
    region: "Asia",
    searchAliases: ["MDAC", "Malaysia Digital Arrival Card"],
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
    visaName: "Visitor Visa / NZeTA / NZTD",
    visaNameZh: "访客签证 / NZeTA / NZTD",
    description: "Visitor visa, NZeTA and New Zealand Traveller Declaration intake.",
    descriptionZh: "适合新西兰访客签证、NZeTA 和 NZTD 旅客申报资料采集。",
    flag: "🇳🇿",
    region: "Oceania",
    searchAliases: ["NZeTA", "NZTD", "New Zealand Traveller Declaration"],
  }),
  destination({
    country: "oman",
    countryName: "Oman",
    countryNameZh: "阿曼",
    visaType: "tourist_evisa",
    visaName: "Tourist eVisa",
    visaNameZh: "旅游电子签证",
    description: "Tourist eVisa intake for Oman visitor travel.",
    descriptionZh: "适合阿曼旅游访问的电子签证信息采集。",
    flag: "🇴🇲",
    region: "Middle East",
    searchAliases: ["Oman eVisa", "Royal Oman Police eVisa"],
  }),
  destination({
    country: "peru",
    countryName: "Peru",
    countryNameZh: "秘鲁",
    visaType: "tourist_visa",
    visaName: "Tourist Visa",
    visaNameZh: "旅游签证",
    description: "Tourist visa intake for Peru visitor travel where a visa is required.",
    descriptionZh: "适合需要签证时赴秘鲁旅游访问的信息采集。",
    flag: "🇵🇪",
    region: "South America",
    searchAliases: ["Peru tourist visa", "Gob.pe Peru visa"],
  }),
  destination({
    country: "philippines",
    countryName: "Philippines",
    countryNameZh: "菲律宾",
    visaType: "PH_ETRAVEL_ARRIVAL_CARD",
    visaName: "Philippines eTravel Arrival Card",
    visaNameZh: "eTravel 入境卡",
    description: "Philippines eTravel arrival declaration intake for border, health, and customs information.",
    descriptionZh: "适合菲律宾 eTravel 入境申报，采集边检、健康和海关资料。",
    flag: "🇵🇭",
    region: "Asia",
    searchAliases: ["Philippines eTravel", "eTravel", "Philippines arrival card"],
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
    country: "russia",
    countryName: "Russia",
    countryNameZh: "俄罗斯",
    visaType: "unified_evisa",
    visaName: "Unified eVisa",
    visaNameZh: "统一电子签证",
    description: "Unified electronic visa intake for eligible short visits to Russia.",
    descriptionZh: "适合符合条件的俄罗斯短期访问统一电子签证信息采集。",
    flag: "🇷🇺",
    region: "Europe",
    searchAliases: ["Russia eVisa", "Unified e-visa", "evisa.kdmid.ru"],
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
    visaType: "SG_ARRIVAL_CARD",
    visaName: "SG Arrival Card",
    visaNameZh: "SG Arrival Card 入境卡",
    description: "SG Arrival Card traveller declaration and ICA submission preparation.",
    descriptionZh: "适合新加坡 SG Arrival Card 入境申报资料填写和 ICA 提交准备。",
    flag: "🇸🇬",
    region: "Asia",
    searchAliases: ["SG Arrival Card", "ICA Singapore", "SGAC"],
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
    visaType: "KR_C39_SHORT_TERM_VISIT",
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
    country: "taiwan",
    countryName: "Taiwan",
    countryNameZh: "中国台湾",
    visaType: "TW_OVERSEAS_CN_TOURISM_ENTRY_PERMIT",
    visaName: "Overseas Chinese Mainland Tourist Entry Permit",
    visaNameZh: "旅居新加坡大陆居民观光入台证",
    description: "Taiwan tourist entry-permit intake for Chinese mainland passport holders resident in Singapore.",
    descriptionZh: "适合旅居新加坡的中国大陆护照持有人办理观光入台证。",
    flag: "🇹🇼",
    region: "Asia",
    searchAliases: ["Taiwan entry permit", "Taiwan tourist entry permit", "入台证"],
  }),
  destination({
    country: "tanzania",
    countryName: "Tanzania",
    countryNameZh: "坦桑尼亚",
    visaType: "tourist_evisa",
    visaName: "Tourist eVisa",
    visaNameZh: "旅游电子签证",
    description: "Tourist eVisa intake for Tanzania visitor travel.",
    descriptionZh: "适合坦桑尼亚旅游访问的电子签证信息采集。",
    flag: "🇹🇿",
    region: "Africa",
    searchAliases: ["Tanzania eVisa", "Immigration Tanzania"],
  }),
  destination({
    country: "thailand",
    countryName: "Thailand",
    countryNameZh: "泰国",
    visaType: "TH_TDAC_ARRIVAL_CARD",
    visaName: "Thailand Digital Arrival Card",
    visaNameZh: "TDAC 数字入境卡",
    description: "Thailand Digital Arrival Card traveller declaration preparation.",
    descriptionZh: "适合泰国 TDAC 数字入境卡旅客申报资料准备。",
    flag: "🇹🇭",
    region: "Asia",
    searchAliases: ["TDAC", "Thailand Digital Arrival Card"],
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
  destination({
    country: "vietnam",
    countryName: "Vietnam",
    countryNameZh: "越南",
    visaType: "VN_PREARRIVAL_DECLARATION",
    visaName: "Pre-Arrival Information Declaration",
    visaNameZh: "入境前申报",
    description: "Official pre-arrival information declaration for eligible Vietnam arrivals.",
    descriptionZh: "适合符合条件旅客入境越南前填写的官方入境信息申报。",
    flag: "🇻🇳",
    region: "Asia",
    supportLabel: "Vietnam pre-arrival declaration",
    searchAliases: ["Vietnam arrival card", "Pre-arrival", "prearrival.immigration.gov.vn"],
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

const DESTINATION_REGION_INPUTS: Array<Omit<VisaDestinationRegionGroup, "destinationIds" | "href"> & { countries: string[] }> = [
  {
    id: "indonesia",
    name: "Indonesia",
    nameZh: "印度尼西亚",
    description: "Choose the Indonesia visa category you want to apply for, then load the matching form.",
    descriptionZh: "选择要申请的印尼签证类别，并加载对应申请表。",
    flag: "🇮🇩",
    countries: ["indonesia"],
  },
  {
    id: "vietnam",
    name: "Vietnam",
    nameZh: "越南",
    description: "Choose the Vietnam visa or arrival-card schema you want to complete.",
    descriptionZh: "选择要填写的越南签证或入境卡类别，并加载对应表单。",
    flag: "🇻🇳",
    countries: ["vietnam"],
  },
  {
    id: "north-america",
    name: "North America",
    nameZh: "北美",
    description: "United States, Canada, Mexico, Caribbean and nearby visitor routes.",
    descriptionZh: "美国、加拿大、墨西哥、加勒比等北美访客签证和入境路线。",
    flag: "🇺🇸",
    countries: ["canada", "cuba", "dominican_republic", "mexico", "united_states"],
  },
  {
    id: "south-america",
    name: "South America",
    nameZh: "南美",
    description: "Brazil, Argentina, Colombia and other South America visitor workflows.",
    descriptionZh: "巴西、阿根廷、哥伦比亚等南美访客签证和入境路线。",
    flag: "🇧🇷",
    countries: ["argentina", "brazil", "chile", "colombia", "peru"],
  },
  {
    id: "middle-east",
    name: "Middle East",
    nameZh: "中东",
    description: "Gulf and Middle East eVisa or visitor-entry workflows.",
    descriptionZh: "海湾及中东地区电子签证、访客入境资料采集。",
    flag: "🇦🇪",
    countries: ["israel", "jordan", "oman", "qatar", "saudi_arabia", "united_arab_emirates"],
  },
  {
    id: "africa",
    name: "Africa",
    nameZh: "非洲",
    description: "Africa tourist eVisa and visitor visa intake routes.",
    descriptionZh: "非洲旅游电子签证和访客签证信息采集路线。",
    flag: "🇪🇬",
    countries: ["egypt", "kenya", "morocco", "south_africa", "tanzania"],
  },
  {
    id: "schengen",
    name: "Schengen Area",
    nameZh: "申根区",
    description: "Choose the main Schengen destination for the shared Type C form.",
    descriptionZh: "进入申根国家列表，选择 C 类短期签证的主要目的地。",
    flag: "🇪🇺",
    countries: SCHENGEN_VISA_DESTINATIONS.map((destinationItem) => destinationItem.country),
  },
  {
    id: "europe-non-schengen",
    name: "Europe outside Schengen",
    nameZh: "欧洲非申根区",
    description: "European visitor routes that do not use the Schengen Type C form.",
    descriptionZh: "不使用申根 C 类表单的欧洲访客签证路线。",
    flag: "🇬🇧",
    countries: ["ireland", "russia", "turkey", "united_kingdom"],
  },
  {
    id: "southeast-asia",
    name: "Southeast Asia",
    nameZh: "东南亚",
    description: "ASEAN visitor entry, eVisa and short-stay workflows.",
    descriptionZh: "东南亚访客入境、电子签证和短期停留资料采集。",
    flag: "🇸🇬",
    countries: [
      "cambodia",
      "indonesia",
      "laos",
      "malaysia",
      "philippines",
      "singapore",
      "thailand",
      "vietnam",
    ],
  },
  {
    id: "east-asia",
    name: "East Asia",
    nameZh: "东亚",
    description: "China, Japan, Korea and Taiwan short-stay visitor workflows.",
    descriptionZh: "中国、日本、韩国、中国台湾等东亚短期访问签证或入境路线。",
    flag: "🇯🇵",
    countries: ["china", "japan", "south_korea", "taiwan"],
  },
  {
    id: "south-asia",
    name: "South Asia",
    nameZh: "南亚",
    description: "South Asia tourist visa, ETA and arrival-card routes.",
    descriptionZh: "南亚旅游签证、ETA 和落地入境资料路线。",
    flag: "🇮🇳",
    countries: ["india", "maldives", "nepal", "sri_lanka"],
  },
  {
    id: "oceania",
    name: "Oceania",
    nameZh: "大洋洲",
    description: "Australia and New Zealand visitor visa workflows.",
    descriptionZh: "澳大利亚、新西兰访客签证资料采集。",
    flag: "🇦🇺",
    countries: ["australia", "new_zealand"],
  },
];

const SELECTABLE_VISA_DESTINATIONS = [
  ...NON_SCHENGEN_VISA_DESTINATIONS,
  ...SCHENGEN_VISA_DESTINATIONS,
];

function destinationIdsForCountries(countries: string[]): string[] {
  const countrySet = new Set(countries);
  return SELECTABLE_VISA_DESTINATIONS
    .filter((destinationItem) => countrySet.has(destinationItem.country))
    .map((destinationItem) => destinationItem.id);
}

function regionGroupToDestination(group: VisaDestinationRegionGroup): PopularVisaDestination {
  const destinations = getVisaDestinationsForRegion(group.id);
  const isSchemaChoiceGroup = group.id === "indonesia" || group.id === "vietnam";
  return {
    id: `region-${group.id}`,
    country: group.id,
    countryName: group.name,
    countryNameZh: group.nameZh,
    visaType: "REGION_GROUP",
    visaName: isSchemaChoiceGroup ? "Choose application category" : "Browse destination forms",
    visaNameZh: isSchemaChoiceGroup ? "选择申请类别" : "浏览分区签证表单",
    description: group.description,
    descriptionZh: group.descriptionZh,
    flag: group.flag,
    region: group.name,
    supportLabel: isSchemaChoiceGroup ? "Application categories" : "Destination region",
    kind: "group",
    href: group.href,
    countryCount: destinations.length,
    searchAliases: destinations.flatMap((destinationItem) => [
      destinationItem.countryName,
      destinationItem.countryNameZh,
      destinationItem.visaName,
      destinationItem.visaNameZh,
      ...(destinationItem.searchAliases ?? []),
    ]),
  };
}

export const VISA_DESTINATION_REGION_GROUPS: VisaDestinationRegionGroup[] = DESTINATION_REGION_INPUTS.map((group) => ({
  id: group.id,
  name: group.name,
  nameZh: group.nameZh,
  description: group.description,
  descriptionZh: group.descriptionZh,
  flag: group.flag,
  destinationIds: group.id === "schengen"
    ? SCHENGEN_VISA_DESTINATIONS.map((destinationItem) => destinationItem.id)
    : destinationIdsForCountries(group.countries),
  href: group.id === "schengen" ? "/client/destinations/schengen" : `/client/destinations/${group.id}`,
}));

const INDONESIA_DESTINATION_GROUP = VISA_DESTINATION_REGION_GROUPS.find((group) => group.id === "indonesia");
const VIETNAM_DESTINATION_GROUP = VISA_DESTINATION_REGION_GROUPS.find((group) => group.id === "vietnam");

export const FEATURED_VISA_DESTINATIONS: PopularVisaDestination[] = [
  ...(INDONESIA_DESTINATION_GROUP ? [regionGroupToDestination(INDONESIA_DESTINATION_GROUP)] : []),
  ...(VIETNAM_DESTINATION_GROUP ? [regionGroupToDestination(VIETNAM_DESTINATION_GROUP)] : []),
  ...[
    "united_states",
    "united_kingdom",
    "france",
    "japan",
    "canada",
    "australia",
  ].map((country) => SELECTABLE_VISA_DESTINATIONS.find((destinationItem) => destinationItem.country === country)),
]
  .filter((destinationItem): destinationItem is PopularVisaDestination => Boolean(destinationItem));

export const DESTINATION_REGION_GROUP_DESTINATIONS: PopularVisaDestination[] =
  VISA_DESTINATION_REGION_GROUPS
    .filter((group) => group.id !== "indonesia" && group.id !== "vietnam")
    .map(regionGroupToDestination);

export const POPULAR_VISA_DESTINATIONS: PopularVisaDestination[] = [
  ...FEATURED_VISA_DESTINATIONS,
  ...DESTINATION_REGION_GROUP_DESTINATIONS,
];

export const SEARCHABLE_VISA_DESTINATIONS: PopularVisaDestination[] = sortDestinations([
  ...SELECTABLE_VISA_DESTINATIONS,
  ...(INDONESIA_DESTINATION_GROUP ? [regionGroupToDestination(INDONESIA_DESTINATION_GROUP)] : []),
  ...(VIETNAM_DESTINATION_GROUP ? [regionGroupToDestination(VIETNAM_DESTINATION_GROUP)] : []),
  ...DESTINATION_REGION_GROUP_DESTINATIONS,
]);

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
  ID_C1_TOURIST: "C1 Tourist Single Entry eVisa",
  ID_B1_EVOA: "B1 e-VoA",
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
  visitor_visa_or_evisa: "Visitor Visa / eVisa",
  tourist_visa_or_ave: "Tourist Visa / AVE",
  tourist_visa: "Tourist Visa",
  tourist_l_visa: "Tourist Visa (L Visa)",
  check_mig_or_visitor_visa: "Check-Mig / Visitor Visa",
  dviajeros_entry_form: "D'Viajeros Entry Form",
  eticket_entry_exit: "e-Ticket Entry / Exit Form",
  short_stay_c_visit_visa: "Short Stay C Visit Visa",
  eta_il_or_visitor_visa: "ETA-IL / Visitor Visa",
  evisa_or_visitor_visa: "eVisa / Visitor Visa",
  eta_travel_authorization: "Electronic Travel Authorisation",
  unified_evisa: "Unified eVisa",
  TW_OVERSEAS_CN_TOURISM_ENTRY_PERMIT: "Taiwan Overseas Chinese Mainland Tourist Entry Permit",
  visa_free_or_evisa: "Visitor Entry / eVisa",
  visa_free_14_days_or_evisa: "Visitor Entry / eVisa",
  hayya_a1_tourist_visa: "Hayya A1 Tourist Visa",
  entry_visa_or_visit_pass: "Entry Visa / Visit Pass",
  visitor_visa_tourism: "Visitor Visa",
  SG_ARRIVAL_CARD: "SG Arrival Card",
  MY_MDAC_ARRIVAL_CARD: "Malaysia Digital Arrival Card",
  TH_TDAC_ARRIVAL_CARD: "Thailand Digital Arrival Card",
  PH_ETRAVEL_ARRIVAL_CARD: "Philippines eTravel Arrival Card",
  VN_PREARRIVAL_DECLARATION: "Vietnam Pre-Arrival Information Declaration",
  KR_C39_SHORT_TERM_VISIT: "C-3 Visa / K-ETA",
  c3_or_keta: "C-3 Visa / K-ETA",
  eta_tourism: "Tourist ETA",
  visa_exemption_or_tourist_visa: "Tourist Entry",
  evisa_tourism_business: "eVisa Tourism / Business",
  visa_free_or_tourist_visa: "Tourist Entry / Visa",
};

const VISA_TYPE_LABELS_ZH: Record<string, string> = {
  tourist_b211a: "B211A 旅游签证",
  B211A: "B211A 旅游签证",
  ID_C1_TOURIST: "C1 单次入境旅游电子签证",
  ID_B1_EVOA: "B1 电子落地签",
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
  visitor_visa_or_evisa: "访客签证 / 电子签证",
  tourist_visa_or_ave: "旅游签证 / AVE",
  tourist_visa: "旅游签证",
  tourist_l_visa: "旅游签证（L 签证）",
  check_mig_or_visitor_visa: "Check-Mig / 访客签证",
  dviajeros_entry_form: "D'Viajeros 入境申报",
  eticket_entry_exit: "e-Ticket 入出境表",
  short_stay_c_visit_visa: "短期 C 类访问签证",
  eta_il_or_visitor_visa: "ETA-IL / 访客签证",
  evisa_or_visitor_visa: "电子签证 / 访客签证",
  eta_travel_authorization: "电子旅行授权 eTA",
  unified_evisa: "统一电子签证",
  TW_OVERSEAS_CN_TOURISM_ENTRY_PERMIT: "旅居新加坡大陆居民观光入台证",
  visa_free_or_evisa: "访客入境 / 电子签证",
  visa_free_14_days_or_evisa: "访客入境 / 电子签证",
  hayya_a1_tourist_visa: "Hayya A1 旅游签证",
  entry_visa_or_visit_pass: "入境签证 / 访问准证",
  visitor_visa_tourism: "访客签证",
  SG_ARRIVAL_CARD: "SG Arrival Card 入境卡",
  MY_MDAC_ARRIVAL_CARD: "MDAC 数字入境卡",
  TH_TDAC_ARRIVAL_CARD: "TDAC 数字入境卡",
  PH_ETRAVEL_ARRIVAL_CARD: "eTravel 入境卡",
  VN_PREARRIVAL_DECLARATION: "越南入境前申报",
  KR_C39_SHORT_TERM_VISIT: "C-3 签证 / K-ETA",
  c3_or_keta: "C-3 签证 / K-ETA",
  eta_tourism: "旅游 ETA",
  visa_exemption_or_tourist_visa: "旅游入境",
  evisa_tourism_business: "旅游 / 商务电子签证",
  visa_free_or_tourist_visa: "旅游入境 / 签证",
};

const REGION_LABELS_ZH: Record<string, string> = {
  Africa: "非洲",
  Asia: "亚洲",
  Europe: "欧洲",
  "Europe / Asia": "欧洲 / 亚洲",
  "Europe outside Schengen": "欧洲非申根区",
  "Middle East": "中东",
  "North America": "北美",
  Oceania: "大洋洲",
  Schengen: "申根区",
  "Schengen Area": "申根区",
  "South America": "南美",
  "Southeast Asia": "东南亚",
  "East Asia": "东亚",
  "South Asia": "南亚",
};

export function getPopularVisaDestination(destinationId: string): PopularVisaDestination | null {
  return SELECTABLE_VISA_DESTINATIONS.find((destinationItem) => destinationItem.id === destinationId) ?? null;
}

export function getVisaDestinationRegionGroup(regionId: string): VisaDestinationRegionGroup | null {
  return VISA_DESTINATION_REGION_GROUPS.find((group) => group.id === regionId) ?? null;
}

export function getVisaDestinationsForRegion(regionId: string): PopularVisaDestination[] {
  const group = VISA_DESTINATION_REGION_GROUPS.find((regionGroup) => regionGroup.id === regionId);
  if (!group) return [];
  const destinationIdSet = new Set(group.destinationIds);
  return SELECTABLE_VISA_DESTINATIONS.filter((destinationItem) => destinationIdSet.has(destinationItem.id));
}

export function getPopularVisaDestinationByPackage(country: string, visaType: string): PopularVisaDestination | null {
  const normalizedCountry = getCanonicalVisaDestinationCountry(country);
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
  const canonicalCountry = getCanonicalVisaDestinationCountry(country);
  return COUNTRY_NAMES.get(canonicalCountry) ?? country.replace(/_/g, " ");
}

export function getDestinationDisplayNameZh(country: string): string {
  const canonicalCountry = getCanonicalVisaDestinationCountry(country);
  return COUNTRY_NAMES_ZH.get(canonicalCountry) ?? getDestinationDisplayName(country);
}

function isChineseDisplayLocale(locale?: string | null): boolean {
  return locale?.toLowerCase().startsWith("zh") ?? false;
}

export function getDestinationDisplayNameForLocale(country: string, locale?: string | null): string {
  return isChineseDisplayLocale(locale) ? getDestinationDisplayNameZh(country) : getDestinationDisplayName(country);
}

export function getVisaTypeDisplayName(visaType: string): string {
  return VISA_TYPE_LABELS[visaType] ?? visaType.replace(/_/g, " ");
}

export function getVisaTypeDisplayNameZh(visaType: string): string {
  return VISA_TYPE_LABELS_ZH[visaType] ?? getVisaTypeDisplayName(visaType);
}

export function getVisaTypeDisplayNameForLocale(visaType: string, locale?: string | null): string {
  return isChineseDisplayLocale(locale) ? getVisaTypeDisplayNameZh(visaType) : getVisaTypeDisplayName(visaType);
}

export function getVisaDestinationCountryName(
  destinationItem: Pick<PopularVisaDestination, "countryName" | "countryNameZh">,
  locale?: string | null,
): string {
  return isChineseDisplayLocale(locale) ? destinationItem.countryNameZh : destinationItem.countryName;
}

export function getVisaDestinationVisaName(
  destinationItem: Pick<PopularVisaDestination, "visaName" | "visaNameZh">,
  locale?: string | null,
): string {
  return isChineseDisplayLocale(locale) ? destinationItem.visaNameZh : destinationItem.visaName;
}

export function getVisaDestinationDescription(
  destinationItem: Pick<PopularVisaDestination, "description" | "descriptionZh">,
  locale?: string | null,
): string {
  return isChineseDisplayLocale(locale) ? destinationItem.descriptionZh : destinationItem.description;
}

export function getVisaDestinationRegionName(region: string, locale?: string | null): string {
  return isChineseDisplayLocale(locale) ? REGION_LABELS_ZH[region] ?? region : region;
}

export function getFormVisaType(visaType: string): string {
  const normalized = visaType.trim().toLowerCase().replace(/[\s/-]+/g, "_");
  if (
    normalized === "b1_b2" ||
    normalized === "b_1_b_2" ||
    normalized === "ds_160" ||
    normalized === "ds160"
  ) {
    return "DS160";
  }
  if (normalized === "tourist_b211a" || normalized === "b211a") return "B211A";
  return visaType;
}

export function getCanonicalVisaDestinationCountry(country: string): string {
  const normalized = country.trim().toLowerCase().replace(/[\s/-]+/g, "_");
  const aliases: Record<string, string> = {
    america: "united_states",
    england: "united_kingdom",
    great_britain: "united_kingdom",
    u_k: "united_kingdom",
    uk: "united_kingdom",
    united_states_of_america: "united_states",
    us: "united_states",
    usa: "united_states",
  };
  if (aliases[normalized]) return aliases[normalized];

  const destination = SELECTABLE_VISA_DESTINATIONS.find((destinationItem) => {
    const normalizedCountryName = destinationItem.countryName.toLowerCase().replace(/[\s/-]+/g, "_");
    const normalizedCountryNameZh = destinationItem.countryNameZh.toLowerCase().replace(/[\s/-]+/g, "_");
    return (
      destinationItem.country === normalized ||
      normalizedCountryName === normalized ||
      normalizedCountryNameZh === normalized
    );
  });

  return destination?.country ?? normalized;
}

export function getVisaDestinationKey(country: string, visaType: string): string {
  return `${getCanonicalVisaDestinationCountry(country)}::${getFormVisaType(visaType).toLowerCase()}`;
}

export function getVisaPackageTitleZh(country: string, visaType: string): string {
  const destinationItem = getPopularVisaDestinationByPackage(country, visaType);
  if (destinationItem) return `${destinationItem.countryNameZh}${destinationItem.visaNameZh}`;
  return `${getDestinationDisplayNameZh(country)}${getVisaTypeDisplayNameZh(visaType)}`;
}

export function getVisaPackageTitle(country: string, visaType: string, locale?: string | null): string {
  if (isChineseDisplayLocale(locale)) return getVisaPackageTitleZh(country, visaType);

  const destinationItem = getPopularVisaDestinationByPackage(country, visaType);
  if (destinationItem) return `${destinationItem.countryName} ${destinationItem.visaName}`;
  return `${getDestinationDisplayName(country)} ${getVisaTypeDisplayName(visaType)}`;
}
