export type VisaProductKind =
  | 'visa'
  | 'entry_permit'
  | 'travel_authorization'
  | 'arrival_declaration'
  | 'departure_declaration';

export type VisaProductProvider = 'viza' | 'official';
export type VisaProductSupportLevel =
  | 'form_only'
  | 'assisted_submission'
  | 'automated'
  | 'official_redirect';
export type VisaProductRequirement = 'required' | 'conditional' | 'optional';

export interface VisaProductDefinition {
  productCode: string;
  country: string;
  kind: VisaProductKind;
  provider: VisaProductProvider;
  supportLevel: VisaProductSupportLevel;
  displayNameZh: string;
  displayNameEn: string;
  url: string;
  packageCountry?: string;
}

export interface VisaProductRecommendation extends VisaProductDefinition {
  requirement: VisaProductRequirement;
}

const product = (definition: VisaProductDefinition): VisaProductDefinition => definition;

export const VISA_PRODUCT_REGISTRY: Readonly<Record<string, VisaProductDefinition>> = {
  ID_B1_EVOA: product({ productCode: 'ID_B1_EVOA', country: 'indonesia', kind: 'visa', provider: 'viza', supportLevel: 'assisted_submission', displayNameZh: '印度尼西亚落地电子签证', displayNameEn: 'Indonesia B1 e-VoA', url: '/client/application?country=indonesia&visaType=ID_B1_EVOA' }),
  ID_C1_TOURIST: product({ productCode: 'ID_C1_TOURIST', country: 'indonesia', kind: 'visa', provider: 'viza', supportLevel: 'assisted_submission', displayNameZh: '印度尼西亚C1旅游签证', displayNameEn: 'Indonesia C1 Tourist Visa', url: '/client/application?country=indonesia&visaType=ID_C1_TOURIST' }),
  VN_E_VISA: product({ productCode: 'VN_E_VISA', country: 'vietnam', kind: 'visa', provider: 'viza', supportLevel: 'assisted_submission', displayNameZh: '越南旅游电子签证', displayNameEn: 'Vietnam e-Visa', url: '/client/application?country=vietnam&visaType=VN_E_VISA' }),
  VN_PREARRIVAL_DECLARATION: product({ productCode: 'VN_PREARRIVAL_DECLARATION', country: 'vietnam', kind: 'arrival_declaration', provider: 'viza', supportLevel: 'assisted_submission', displayNameZh: '越南入境前申报', displayNameEn: 'Vietnam Pre-Arrival Declaration', url: '/client/application?country=vietnam&visaType=VN_PREARRIVAL_DECLARATION' }),
  SG_VISITOR_VISA: product({ productCode: 'SG_VISITOR_VISA', country: 'singapore', kind: 'visa', provider: 'viza', supportLevel: 'form_only', displayNameZh: '新加坡入境签证', displayNameEn: 'Singapore Entry Visa', url: '/client/application?country=singapore&visaType=SG_VISITOR_VISA' }),
  SG_ARRIVAL_CARD: product({ productCode: 'SG_ARRIVAL_CARD', country: 'singapore', kind: 'arrival_declaration', provider: 'viza', supportLevel: 'automated', displayNameZh: '新加坡电子入境卡', displayNameEn: 'Singapore Arrival Card', url: '/client/application?country=singapore&visaType=SG_ARRIVAL_CARD' }),
  MY_TOURIST_E_VISA: product({ productCode: 'MY_TOURIST_E_VISA', country: 'malaysia', kind: 'visa', provider: 'viza', supportLevel: 'form_only', displayNameZh: '马来西亚旅游电子签证', displayNameEn: 'Malaysia Tourist eVISA', url: '/client/application?country=malaysia&visaType=MY_TOURIST_E_VISA' }),
  MY_MDAC_ARRIVAL_CARD: product({ productCode: 'MY_MDAC_ARRIVAL_CARD', country: 'malaysia', kind: 'arrival_declaration', provider: 'viza', supportLevel: 'automated', displayNameZh: '马来西亚电子入境卡', displayNameEn: 'Malaysia Digital Arrival Card', url: '/client/application?country=malaysia&visaType=MY_MDAC_ARRIVAL_CARD' }),
  TH_TOURIST_E_VISA: product({ productCode: 'TH_TOURIST_E_VISA', country: 'thailand', kind: 'visa', provider: 'viza', supportLevel: 'form_only', displayNameZh: '泰国旅游电子签证', displayNameEn: 'Thailand Tourist e-Visa', url: '/client/application?country=thailand&visaType=TH_TOURIST_E_VISA' }),
  TH_TDAC_ARRIVAL_CARD: product({ productCode: 'TH_TDAC_ARRIVAL_CARD', country: 'thailand', kind: 'arrival_declaration', provider: 'viza', supportLevel: 'automated', displayNameZh: '泰国电子入境卡', displayNameEn: 'Thailand Digital Arrival Card', url: '/client/application?country=thailand&visaType=TH_TDAC_ARRIVAL_CARD' }),
  KR_C39_SHORT_TERM_VISIT: product({ productCode: 'KR_C39_SHORT_TERM_VISIT', country: 'south_korea', kind: 'visa', provider: 'viza', supportLevel: 'form_only', displayNameZh: '韩国C-3-9短期旅游签证', displayNameEn: 'Korea C-3-9 Short-Term Visit Visa', url: '/client/application?country=south_korea&visaType=KR_C39_SHORT_TERM_VISIT' }),
  KR_KETA: product({ productCode: 'KR_KETA', country: 'south_korea', kind: 'travel_authorization', provider: 'official', supportLevel: 'official_redirect', displayNameZh: '韩国电子旅行许可', displayNameEn: 'Korea Electronic Travel Authorization', url: 'https://www.k-eta.go.kr/portal/apply/index.do' }),
  DS160: product({ productCode: 'DS160', country: 'us', packageCountry: 'united_states', kind: 'visa', provider: 'viza', supportLevel: 'assisted_submission', displayNameZh: '美国访客签证申请表', displayNameEn: 'U.S. DS-160 Visitor Visa Form', url: '/client/application?country=united_states&visaType=DS160' }),
  US_ESTA: product({ productCode: 'US_ESTA', country: 'us', kind: 'travel_authorization', provider: 'official', supportLevel: 'official_redirect', displayNameZh: '美国电子旅行授权', displayNameEn: 'U.S. Electronic System for Travel Authorization', url: 'https://esta.cbp.dhs.gov/' }),
  EU_SCHENGEN_C_SHORT_STAY: product({ productCode: 'EU_SCHENGEN_C_SHORT_STAY', country: 'france', kind: 'visa', provider: 'viza', supportLevel: 'assisted_submission', displayNameZh: '法国申根短期旅游签证', displayNameEn: 'France Schengen Short-Stay Visa', url: '/client/application?country=france&visaType=EU_SCHENGEN_C_SHORT_STAY' }),
  EU_ETIAS: product({ productCode: 'EU_ETIAS', country: 'france', kind: 'travel_authorization', provider: 'official', supportLevel: 'official_redirect', displayNameZh: '欧洲旅行信息和授权', displayNameEn: 'European Travel Information and Authorisation', url: 'https://travel-europe.europa.eu/etias_en' }),
  PH_TEMPORARY_VISITOR_VISA: product({ productCode: 'PH_TEMPORARY_VISITOR_VISA', country: 'philippines', kind: 'visa', provider: 'viza', supportLevel: 'form_only', displayNameZh: '菲律宾临时访客签证', displayNameEn: 'Philippines Temporary Visitor Visa', url: '/client/application?country=philippines&visaType=PH_TEMPORARY_VISITOR_VISA' }),
  PH_ETRAVEL_ARRIVAL_CARD: product({ productCode: 'PH_ETRAVEL_ARRIVAL_CARD', country: 'philippines', kind: 'arrival_declaration', provider: 'viza', supportLevel: 'assisted_submission', displayNameZh: '菲律宾电子入境申报', displayNameEn: 'Philippines eTravel Arrival Declaration', url: '/client/application?country=philippines&visaType=PH_ETRAVEL_ARRIVAL_CARD' }),
  PH_ETRAVEL_DEPARTURE_CARD: product({ productCode: 'PH_ETRAVEL_DEPARTURE_CARD', country: 'philippines', kind: 'departure_declaration', provider: 'viza', supportLevel: 'assisted_submission', displayNameZh: '菲律宾电子出境申报', displayNameEn: 'Philippines eTravel Departure Declaration', url: '/client/application?country=philippines&visaType=PH_ETRAVEL_DEPARTURE_CARD' }),
  UK_STANDARD_VISITOR: product({ productCode: 'UK_STANDARD_VISITOR', country: 'uk', packageCountry: 'united_kingdom', kind: 'visa', provider: 'viza', supportLevel: 'assisted_submission', displayNameZh: '英国标准访客签证', displayNameEn: 'UK Standard Visitor Visa', url: '/client/application?country=united_kingdom&visaType=UK_STANDARD_VISITOR' }),
  UK_ETA: product({ productCode: 'UK_ETA', country: 'uk', kind: 'travel_authorization', provider: 'official', supportLevel: 'official_redirect', displayNameZh: '英国电子旅行许可', displayNameEn: 'UK Electronic Travel Authorisation', url: 'https://www.gov.uk/guidance/apply-for-an-electronic-travel-authorisation-eta' }),
  TW_ENTRY_PERMIT: product({ productCode: 'TW_ENTRY_PERMIT', country: 'taiwan', kind: 'entry_permit', provider: 'viza', supportLevel: 'assisted_submission', displayNameZh: '台湾入境许可证', displayNameEn: 'Taiwan Entry Permit', url: '/client/application?country=taiwan&visaType=TW_ENTRY_PERMIT' }),
  CA_TRV: product({ productCode: 'CA_TRV', country: 'canada', kind: 'visa', provider: 'viza', supportLevel: 'form_only', displayNameZh: '加拿大旅游访客签证', displayNameEn: 'Canada Tourist Visitor Visa (TRV)', url: '/client/application?country=canada&visaType=CA_TRV' }),
  IN_E_VISA: product({ productCode: 'IN_E_VISA', country: 'india', kind: 'visa', provider: 'viza', supportLevel: 'form_only', displayNameZh: '印度电子旅游签证', displayNameEn: 'India e-Tourist Visa', url: '/client/application?country=india&visaType=IN_E_VISA' }),
  SA_E_VISA: product({ productCode: 'SA_E_VISA', country: 'saudi_arabia', kind: 'visa', provider: 'viza', supportLevel: 'form_only', displayNameZh: '沙特阿拉伯旅游电子签证', displayNameEn: 'Saudi Arabia Tourist eVisa', url: '/client/application?country=saudi_arabia&visaType=SA_E_VISA' }),
  TR_E_VISA: product({ productCode: 'TR_E_VISA', country: 'turkey', kind: 'visa', provider: 'viza', supportLevel: 'form_only', displayNameZh: '土耳其旅游电子签证', displayNameEn: 'Türkiye Tourist e-Visa', url: '/client/application?country=turkey&visaType=TR_E_VISA' }),
  AE_TOURIST_VISA: product({ productCode: 'AE_TOURIST_VISA', country: 'united_arab_emirates', kind: 'visa', provider: 'viza', supportLevel: 'form_only', displayNameZh: '阿联酋五年多次入境旅游签证', displayNameEn: 'UAE 5-Year Multiple-Entry Tourist Visa', url: '/client/application?country=united_arab_emirates&visaType=AE_TOURIST_VISA' }),
  TW_ARRIVAL_CARD: product({ productCode: 'TW_ARRIVAL_CARD', country: 'taiwan', kind: 'arrival_declaration', provider: 'official', supportLevel: 'official_redirect', displayNameZh: '台湾网络入境卡', displayNameEn: 'Taiwan Arrival Card', url: 'https://twac.immigration.gov.tw/' }),
};

const LEGACY_PRODUCT_ALIASES: Readonly<Record<string, string>> = {
  tourist_b211a: 'ID_C1_TOURIST',
  B211A: 'ID_C1_TOURIST',
  evisa_tourism: 'VN_E_VISA',
  c3_or_keta: 'KR_C39_SHORT_TERM_VISIT',
  b1_b2: 'DS160',
  B1_B2: 'DS160',
  schengen_short_stay_tourism: 'EU_SCHENGEN_C_SHORT_STAY',
  standard_visitor: 'UK_STANDARD_VISITOR',
  TW_OVERSEAS_CN_TOURISM_ENTRY_PERMIT: 'TW_ENTRY_PERMIT',
};

export function canonicalProductCode(productCode: string): string {
  return LEGACY_PRODUCT_ALIASES[productCode] ?? productCode;
}

export function getVisaProduct(productCode: string): VisaProductDefinition | null {
  return VISA_PRODUCT_REGISTRY[canonicalProductCode(productCode)] ?? null;
}

export function recommendVisaProduct(
  productCode: string,
  requirement: VisaProductRequirement = 'required'
): VisaProductRecommendation | null {
  const definition = getVisaProduct(productCode);
  return definition ? { ...definition, requirement } : null;
}

const OFFICIAL_PRODUCT_HOSTS = new Set([
  'www.k-eta.go.kr',
  'esta.cbp.dhs.gov',
  'travel-europe.europa.eu',
  'www.gov.uk',
  'twac.immigration.gov.tw',
]);

export function isAllowedOfficialProductUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && OFFICIAL_PRODUCT_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}
