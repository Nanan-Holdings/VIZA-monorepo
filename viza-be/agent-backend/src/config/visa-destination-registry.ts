export type SupportedKnowledgeCountry =
  | 'austria'
  | 'australia'
  | 'belgium'
  | 'bulgaria'
  | 'canada'
  | 'cambodia'
  | 'croatia'
  | 'czech_republic'
  | 'denmark'
  | 'egypt'
  | 'estonia'
  | 'finland'
  | 'france'
  | 'germany'
  | 'greece'
  | 'hong_kong'
  | 'hungary'
  | 'iceland'
  | 'india'
  | 'indonesia'
  | 'italy'
  | 'japan'
  | 'laos'
  | 'latvia'
  | 'liechtenstein'
  | 'lithuania'
  | 'luxembourg'
  | 'macau'
  | 'malaysia'
  | 'maldives'
  | 'malta'
  | 'mexico'
  | 'morocco'
  | 'nepal'
  | 'netherlands'
  | 'new_zealand'
  | 'norway'
  | 'philippines'
  | 'poland'
  | 'portugal'
  | 'qatar'
  | 'romania'
  | 'russia'
  | 'saudi_arabia'
  | 'singapore'
  | 'slovakia'
  | 'slovenia'
  | 'south_africa'
  | 'south_korea'
  | 'spain'
  | 'sri_lanka'
  | 'switzerland'
  | 'sweden'
  | 'thailand'
  | 'taiwan'
  | 'turkey'
  | 'uk'
  | 'united_arab_emirates'
  | 'us'
  | 'vietnam';

export interface VisaDestinationConfig {
  country: SupportedKnowledgeCountry;
  displayName: string;
  aliases: string[];
  isSchengen: boolean;
  supportedVisaTypes: string[];
  defaultVisitorVisaType: string;
  ragDocumentTypes: string[];
  formIntakeSchemaKey: string;
}

const SCHENGEN_VISITOR_TYPE = 'schengen_short_stay_tourism';

function destination(
  country: SupportedKnowledgeCountry,
  displayName: string,
  aliases: string[],
  defaultVisitorVisaType: string,
  options?: { isSchengen?: boolean; supportedVisaTypes?: string[]; schemaKey?: string }
): VisaDestinationConfig {
  const isSchengen = options?.isSchengen ?? false;
  return {
    country,
    displayName,
    aliases,
    isSchengen,
    supportedVisaTypes: options?.supportedVisaTypes ?? [defaultVisitorVisaType],
    defaultVisitorVisaType,
    ragDocumentTypes: ['requirements', 'process', 'form_requirements'],
    formIntakeSchemaKey:
      options?.schemaKey ?? (isSchengen ? 'schengen_short_stay' : defaultVisitorVisaType),
  };
}

export const VISA_DESTINATION_REGISTRY: Record<
  SupportedKnowledgeCountry,
  VisaDestinationConfig
> = {
  austria: destination('austria', 'Austria', ['奥地利', 'austria', 'vienna', 'salzburg', '维也纳', '萨尔茨堡'], SCHENGEN_VISITOR_TYPE, { isSchengen: true }),
  australia: destination('australia', 'Australia', ['澳大利亚', '澳洲', 'australia', 'sydney', 'melbourne', '悉尼', '墨尔本'], 'visitor_subclass_600'),
  belgium: destination('belgium', 'Belgium', ['比利时', 'belgium', 'brussels', 'bruges', '布鲁塞尔', '布鲁日'], SCHENGEN_VISITOR_TYPE, { isSchengen: true }),
  bulgaria: destination('bulgaria', 'Bulgaria', ['保加利亚', 'bulgaria', 'sofia', '索非亚'], SCHENGEN_VISITOR_TYPE, { isSchengen: true }),
  canada: destination('canada', 'Canada', ['加拿大', 'canada', 'vancouver', 'toronto', 'montreal', '温哥华', '多伦多', '蒙特利尔'], 'visitor_visa'),
  cambodia: destination('cambodia', 'Cambodia', ['柬埔寨', 'cambodia', 'phnom penh', 'siem reap', '金边', '暹粒'], 'tourist_evisa'),
  croatia: destination('croatia', 'Croatia', ['克罗地亚', 'croatia', 'zagreb', 'dubrovnik', '萨格勒布', '杜布罗夫尼克'], SCHENGEN_VISITOR_TYPE, { isSchengen: true }),
  czech_republic: destination('czech_republic', 'Czech Republic', ['捷克', 'czech republic', 'czechia', 'prague', '布拉格'], SCHENGEN_VISITOR_TYPE, { isSchengen: true }),
  denmark: destination('denmark', 'Denmark', ['丹麦', 'denmark', 'copenhagen', '哥本哈根'], SCHENGEN_VISITOR_TYPE, { isSchengen: true }),
  egypt: destination('egypt', 'Egypt', ['埃及', 'egypt', 'cairo', 'luxor', '开罗', '卢克索'], 'evisa_tourism'),
  estonia: destination('estonia', 'Estonia', ['爱沙尼亚', 'estonia', 'tallinn', '塔林'], SCHENGEN_VISITOR_TYPE, { isSchengen: true }),
  finland: destination('finland', 'Finland', ['芬兰', 'finland', 'helsinki', '赫尔辛基'], SCHENGEN_VISITOR_TYPE, { isSchengen: true }),
  france: destination('france', 'France', ['法国', 'france', 'paris', '巴黎'], SCHENGEN_VISITOR_TYPE, { isSchengen: true }),
  germany: destination('germany', 'Germany', ['德国', 'germany', 'berlin', 'munich', 'frankfurt', '柏林', '慕尼黑', '法兰克福'], SCHENGEN_VISITOR_TYPE, { isSchengen: true }),
  greece: destination('greece', 'Greece', ['希腊', 'greece', 'athens', 'santorini', '雅典', '圣托里尼'], SCHENGEN_VISITOR_TYPE, { isSchengen: true }),
  hong_kong: destination('hong_kong', 'Hong Kong', ['香港', 'hong kong', 'hksar', 'hong kong sar', 'hk visit visa', 'hk visa'], 'hk_visit_visa'),
  hungary: destination('hungary', 'Hungary', ['匈牙利', 'hungary', 'budapest', '布达佩斯'], SCHENGEN_VISITOR_TYPE, { isSchengen: true }),
  iceland: destination('iceland', 'Iceland', ['冰岛', 'iceland', 'reykjavik', '雷克雅未克'], SCHENGEN_VISITOR_TYPE, { isSchengen: true }),
  india: destination('india', 'India', ['india', 'delhi', 'mumbai', 'new delhi', '新德里', '孟买'], 'regular_tourist_visa'),
  indonesia: destination('indonesia', 'Indonesia', ['印尼', '印度尼西亚', 'indonesia', 'bali', '巴厘岛'], 'tourist_b211a'),
  italy: destination('italy', 'Italy', ['意大利', 'italy', 'rome', 'milan', 'venice', '罗马', '米兰', '威尼斯'], SCHENGEN_VISITOR_TYPE, { isSchengen: true }),
  japan: destination('japan', 'Japan', ['日本', 'japan', 'tokyo', 'osaka', 'kyoto', '东京', '大阪', '京都', 'japan evisa'], 'short_term_tourism_evisa'),
  laos: destination('laos', 'Laos', ['老挝', 'laos', 'vientiane', 'luang prabang', '万象', '琅勃拉邦'], 'tourist_evisa'),
  latvia: destination('latvia', 'Latvia', ['拉脱维亚', 'latvia', 'riga', '里加'], SCHENGEN_VISITOR_TYPE, { isSchengen: true }),
  liechtenstein: destination('liechtenstein', 'Liechtenstein', ['列支敦士登', 'liechtenstein', 'vaduz', '瓦杜兹'], SCHENGEN_VISITOR_TYPE, { isSchengen: true }),
  lithuania: destination('lithuania', 'Lithuania', ['立陶宛', 'lithuania', 'vilnius', '维尔纽斯'], SCHENGEN_VISITOR_TYPE, { isSchengen: true }),
  luxembourg: destination('luxembourg', 'Luxembourg', ['卢森堡', 'luxembourg'], SCHENGEN_VISITOR_TYPE, { isSchengen: true }),
  macau: destination('macau', 'Macau', ['澳门', '澳門', 'macau', 'macao', 'macau sar', 'macao sar'], 'mo_visit_visa'),
  malaysia: destination('malaysia', 'Malaysia', ['马来西亚', 'malaysia', 'kuala lumpur', 'penang', 'sabah', '吉隆坡', '槟城', '沙巴', 'mdac', 'malaysia digital arrival card'], 'MY_MDAC_ARRIVAL_CARD'),
  maldives: destination('maldives', 'Maldives', ['马尔代夫', 'maldives', 'male', '马累'], 'tourist_visa_on_arrival'),
  malta: destination('malta', 'Malta', ['马耳他', 'malta', 'valletta', '瓦莱塔'], SCHENGEN_VISITOR_TYPE, { isSchengen: true }),
  mexico: destination('mexico', 'Mexico', ['墨西哥', 'mexico', 'mexico city', 'cancun', '墨西哥城', '坎昆'], 'visitor_visa_or_exemption'),
  morocco: destination('morocco', 'Morocco', ['摩洛哥', 'morocco', 'marrakech', 'casablanca', '马拉喀什', '卡萨布兰卡'], 'visa_free_or_evisa'),
  nepal: destination('nepal', 'Nepal', ['尼泊尔', 'nepal', 'kathmandu', 'pokhara', '加德满都', '博卡拉'], 'tourist_visa_on_arrival'),
  netherlands: destination('netherlands', 'Netherlands', ['荷兰', 'netherlands', 'holland', 'amsterdam', '阿姆斯特丹'], SCHENGEN_VISITOR_TYPE, { isSchengen: true }),
  new_zealand: destination('new_zealand', 'New Zealand', ['新西兰', 'new zealand', 'auckland', 'queenstown', '奥克兰', '皇后镇'], 'visitor_visa'),
  norway: destination('norway', 'Norway', ['挪威', 'norway', 'oslo', 'bergen', '奥斯陆', '卑尔根'], SCHENGEN_VISITOR_TYPE, { isSchengen: true }),
  philippines: destination('philippines', 'Philippines', ['菲律宾', 'philippines', 'manila', 'cebu', '马尼拉', '宿务', 'etravel', 'philippines etravel', 'philippines arrival card'], 'PH_ETRAVEL_ARRIVAL_CARD', {
    supportedVisaTypes: ['PH_ETRAVEL_ARRIVAL_CARD', 'PH_TEMPORARY_VISITOR_VISA', 'visa_free_14_days_or_evisa'],
  }),
  poland: destination('poland', 'Poland', ['波兰', 'poland', 'warsaw', 'krakow', '华沙', '克拉科夫'], SCHENGEN_VISITOR_TYPE, { isSchengen: true }),
  portugal: destination('portugal', 'Portugal', ['葡萄牙', 'portugal', 'lisbon', 'porto', '里斯本', '波尔图'], SCHENGEN_VISITOR_TYPE, { isSchengen: true }),
  qatar: destination('qatar', 'Qatar', ['卡塔尔', 'qatar', 'doha', '多哈', 'hayya'], 'hayya_a1_tourist_visa'),
  romania: destination('romania', 'Romania', ['罗马尼亚', 'romania', 'bucharest', '布加勒斯特'], SCHENGEN_VISITOR_TYPE, { isSchengen: true }),
  russia: destination('russia', 'Russia', ['俄罗斯', '俄签', 'russia', 'russian federation', 'moscow', 'saint petersburg', '莫斯科', '圣彼得堡'], 'unified_evisa'),
  saudi_arabia: destination('saudi_arabia', 'Saudi Arabia', ['沙特', '沙特阿拉伯', 'saudi', 'saudi arabia', 'riyadh', 'jeddah', '利雅得', '吉达'], 'tourist_evisa'),
  singapore: destination('singapore', 'Singapore', ['新加坡', 'singapore', 'singapore visa', 'sg arrival card', 'sgac'], 'SG_ARRIVAL_CARD'),
  slovakia: destination('slovakia', 'Slovakia', ['斯洛伐克', 'slovakia', 'bratislava', '布拉迪斯拉发'], SCHENGEN_VISITOR_TYPE, { isSchengen: true }),
  slovenia: destination('slovenia', 'Slovenia', ['斯洛文尼亚', 'slovenia', 'ljubljana', '卢布尔雅那'], SCHENGEN_VISITOR_TYPE, { isSchengen: true }),
  south_africa: destination('south_africa', 'South Africa', ['南非', 'south africa', 'cape town', 'johannesburg', '开普敦', '约翰内斯堡'], 'visitor_visa_tourism'),
  south_korea: destination('south_korea', 'South Korea', ['韩国', '南韩', 'south korea', 'korea', 'seoul', '首尔', 'k-eta', 'keta'], 'c3_or_keta'),
  spain: destination('spain', 'Spain', ['西班牙', 'spain', 'madrid', 'barcelona', '马德里', '巴塞罗那'], SCHENGEN_VISITOR_TYPE, { isSchengen: true }),
  sri_lanka: destination('sri_lanka', 'Sri Lanka', ['斯里兰卡', 'sri lanka', 'colombo', '科伦坡'], 'eta_tourism'),
  switzerland: destination('switzerland', 'Switzerland', ['瑞士', 'switzerland', 'swiss', 'zurich', 'geneva', '苏黎世', '日内瓦'], SCHENGEN_VISITOR_TYPE, { isSchengen: true }),
  sweden: destination('sweden', 'Sweden', ['瑞典', 'sweden', 'stockholm', '斯德哥尔摩'], SCHENGEN_VISITOR_TYPE, { isSchengen: true }),
  thailand: destination('thailand', 'Thailand', ['泰国', 'thailand', 'bangkok', 'phuket', 'chiang mai', '曼谷', '普吉', '清迈', 'tdac', 'thailand digital arrival card'], 'TH_TDAC_ARRIVAL_CARD'),
  taiwan: destination('taiwan', 'Taiwan', ['台湾', '中國台灣', '中国台湾', 'taiwan', 'taipei', '台北', '入台证', '入臺證', 'taiwan entry permit'], 'TW_OVERSEAS_CN_TOURISM_ENTRY_PERMIT'),
  turkey: destination('turkey', 'Turkiye', ['土耳其', 'turkey', 'turkiye', 'istanbul', '伊斯坦布尔'], 'evisa_tourism_business'),
  uk: destination('uk', 'United Kingdom', ['英国', '英签', 'united kingdom', 'britain', 'england', 'london', '伦敦'], 'standard_visitor'),
  united_arab_emirates: destination('united_arab_emirates', 'United Arab Emirates', ['阿联酋', '迪拜', '阿布扎比', 'uae', 'united arab emirates', 'dubai', 'abu dhabi'], 'visa_free_or_tourist_visa'),
  us: destination('us', 'United States', ['美国', '美签', 'united states', 'u.s.', 'usa', 'us visa', 'b1/b2', 'b-1/b-2', 'ds-160', 'ds160'], 'b1_b2'),
  vietnam: destination('vietnam', 'Vietnam', ['越南', 'vietnam', 'hanoi', '河内', 'ho chi minh', 'saigon', '胡志明'], 'evisa_tourism'),
};

export const COUNTRY_DISPLAY_NAMES: Record<SupportedKnowledgeCountry, string> =
  Object.fromEntries(
    Object.entries(VISA_DESTINATION_REGISTRY).map(([country, config]) => [
      country,
      config.displayName,
    ])
  ) as Record<SupportedKnowledgeCountry, string>;

export const COUNTRY_ALIASES: Record<SupportedKnowledgeCountry, string[]> =
  Object.fromEntries(
    Object.entries(VISA_DESTINATION_REGISTRY).map(([country, config]) => [
      country,
      config.aliases,
    ])
  ) as Record<SupportedKnowledgeCountry, string[]>;

export const VISA_SERVICE_COUNTRIES = new Set<SupportedKnowledgeCountry>([
  'austria',
  'australia',
  'belgium',
  'bulgaria',
  'canada',
  'cambodia',
  'croatia',
  'czech_republic',
  'denmark',
  'egypt',
  'estonia',
  'finland',
  'france',
  'germany',
  'greece',
  'hong_kong',
  'hungary',
  'iceland',
  'india',
  'indonesia',
  'italy',
  'japan',
  'laos',
  'latvia',
  'liechtenstein',
  'lithuania',
  'luxembourg',
  'macau',
  'malaysia',
  'maldives',
  'malta',
  'netherlands',
  'new_zealand',
  'norway',
  'philippines',
  'poland',
  'portugal',
  'romania',
  'russia',
  'singapore',
  'slovakia',
  'slovenia',
  'south_africa',
  'south_korea',
  'spain',
  'sri_lanka',
  'switzerland',
  'sweden',
  'thailand',
  'taiwan',
  'turkey',
  'uk',
  'united_arab_emirates',
  'us',
  'vietnam',
]);

export function isVisaServiceSupportedCountry(
  country: SupportedKnowledgeCountry | null | undefined
): country is SupportedKnowledgeCountry {
  return Boolean(country && VISA_SERVICE_COUNTRIES.has(country));
}

export const SCHENGEN_KNOWLEDGE_COUNTRIES = new Set<SupportedKnowledgeCountry>(
  Object.values(VISA_DESTINATION_REGISTRY)
    .filter((config) => config.isSchengen)
    .map((config) => config.country)
);

export function getCountryDisplayName(country: SupportedKnowledgeCountry): string {
  return VISA_DESTINATION_REGISTRY[country].displayName;
}

export function getCountryAliases(country: SupportedKnowledgeCountry): string[] {
  return VISA_DESTINATION_REGISTRY[country].aliases;
}

export function getDefaultVisitorVisaType(
  country: SupportedKnowledgeCountry | null
): string | null {
  return country ? VISA_DESTINATION_REGISTRY[country]?.defaultVisitorVisaType ?? null : null;
}

export function isSchengenKnowledgeCountry(
  country: SupportedKnowledgeCountry | null
): boolean {
  return Boolean(country && VISA_DESTINATION_REGISTRY[country]?.isSchengen);
}

export function countrySupportsVisaType(
  country: SupportedKnowledgeCountry | null,
  visaType?: string | null
): boolean {
  if (!country || !visaType) return false;
  return VISA_DESTINATION_REGISTRY[country].supportedVisaTypes.includes(visaType);
}

export function includesAnyText(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function hasUsKeyword(value: string): boolean {
  return (
    /\bus\b/.test(value) ||
    includesAnyText(value, [
      '美国',
      '美签',
      'united states',
      'u.s.',
      'usa',
      'us visa',
      'b1/b2',
      'b-1/b-2',
      'ds-160',
      'ds160',
    ])
  );
}

export function matchesKnowledgeCountry(
  normalized: string,
  country: SupportedKnowledgeCountry
): boolean {
  if (country === 'us') {
    return hasUsKeyword(normalized);
  }

  if (country === 'uk') {
    return (
      /\buk\b/.test(normalized) ||
      includesAnyText(normalized, COUNTRY_ALIASES[country])
    );
  }

  if (country === 'india') {
    return (
      (normalized.includes('印度') && !normalized.includes('印度尼西亚')) ||
      includesAnyText(normalized, COUNTRY_ALIASES[country])
    );
  }

  return includesAnyText(normalized, COUNTRY_ALIASES[country]);
}

export function normalizeKnowledgeCountry(
  country?: string | null
): SupportedKnowledgeCountry | null {
  if (!country) return null;
  const normalized = country.toLowerCase();

  for (const knowledgeCountry of Object.keys(
    COUNTRY_ALIASES
  ) as SupportedKnowledgeCountry[]) {
    if (matchesKnowledgeCountry(normalized, knowledgeCountry)) {
      return knowledgeCountry;
    }
  }

  return null;
}

export function detectKnowledgeCountries(value: string): SupportedKnowledgeCountry[] {
  const normalized = value.toLowerCase();
  return (Object.keys(COUNTRY_ALIASES) as SupportedKnowledgeCountry[]).filter(
    (country) => matchesKnowledgeCountry(normalized, country)
  );
}

export function earliestCountryIndex(
  normalized: string,
  country: SupportedKnowledgeCountry
): number {
  const indices = COUNTRY_ALIASES[country]
    .map((alias) => normalized.indexOf(alias.toLowerCase()))
    .filter((index) => index >= 0);

  if (country === 'us') {
    const usMatch = /\bus\b/.exec(normalized);
    if (usMatch?.index !== undefined) {
      indices.push(usMatch.index);
    }
  }

  return indices.length > 0 ? Math.min(...indices) : -1;
}

export function detectKnowledgeCountriesInOrder(
  value: string
): SupportedKnowledgeCountry[] {
  const normalized = value.toLowerCase();
  return (Object.keys(COUNTRY_ALIASES) as SupportedKnowledgeCountry[])
    .map((country) => ({ country, index: earliestCountryIndex(normalized, country) }))
    .filter((entry) => entry.index >= 0)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.country);
}
