/**
 * Product-level classification for official government fees.
 *
 * This catalog intentionally does not preserve the old applicant-direct
 * routing vocabulary. Electronically payable fees are VIZA-managed; paper,
 * appointment, collection, and genuinely free flows are explicit exceptions.
 */

export type OfficialFeeFundingClass =
  | "viza_managed_card"
  | "offline"
  | "free";

export interface OfficialFeeCatalogEntry {
  country: string;
  visaType: string;
  countryCode: string;
  fundingClass: OfficialFeeFundingClass;
  provider: string;
  targetPayee: string;
  officialUrl: string;
  feeSource: string;
  /** Canonical runner_job country. Omitted when no safe runner exists yet. */
  runnerCountry?: string;
}

export const OFFICIAL_FEE_CATALOG = [
  {
    country: "united_states",
    visaType: "B1_B2",
    countryCode: "US",
    fundingClass: "viza_managed_card",
    provider: "us_mrv_official_fee",
    targetPayee: "U.S. visa appointment and MRV fee service",
    officialUrl: "https://travel.state.gov/content/travel/en/us-visas.html",
    feeSource: "us_mrv_payment_page",
    runnerCountry: "united_states",
  },
  {
    country: "united_kingdom",
    visaType: "UK_STANDARD_VISITOR",
    countryCode: "GB",
    fundingClass: "viza_managed_card",
    provider: "ukvi_standard_visitor_official_fee",
    targetPayee: "UK Visas and Immigration",
    officialUrl: "https://visas-immigration.service.gov.uk/",
    feeSource: "ukvi_official_payment_page",
    runnerCountry: "united_kingdom",
  },
  {
    country: "european_union",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    countryCode: "EU",
    fundingClass: "viza_managed_card",
    provider: "schengen_official_fee",
    targetPayee: "Destination Schengen authority or visa application centre",
    officialUrl: "https://home-affairs.ec.europa.eu/policies/schengen-borders-and-visa/visa-policy_en",
    feeSource: "schengen_destination_payment_page",
  },
  {
    country: "france",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    countryCode: "FR",
    fundingClass: "viza_managed_card",
    provider: "france_visas_official_fee",
    targetPayee: "France-Visas or the assigned visa application centre",
    officialUrl: "https://france-visas.gouv.fr/",
    feeSource: "france_visas_payment_page",
    runnerCountry: "france",
  },
  {
    country: "vietnam",
    visaType: "VN_E_VISA",
    countryCode: "VN",
    fundingClass: "viza_managed_card",
    provider: "vietnam_evisa_official_fee",
    targetPayee: "Vietnam e-Visa official portal",
    officialUrl: "https://evisa.gov.vn/",
    feeSource: "vietnam_evisa_official_payment_page",
    runnerCountry: "vietnam",
  },
  {
    country: "australia",
    visaType: "AU_VISITOR_600",
    countryCode: "AU",
    fundingClass: "viza_managed_card",
    provider: "australia_immiaccount_official_fee",
    targetPayee: "Australian Department of Home Affairs",
    officialUrl: "https://online.immi.gov.au/",
    feeSource: "australia_immiaccount_payment_page",
    runnerCountry: "australia",
  },
  ...["B211A", "ID_C1_TOURIST", "ID_B1_EVOA"].map((visaType) => ({
    country: "indonesia",
    visaType,
    countryCode: "ID",
    fundingClass: "viza_managed_card" as const,
    provider: "indonesia_evisa_official_fee",
    targetPayee: "Indonesia Immigration e-Visa portal",
    officialUrl: "https://evisa.imigrasi.go.id/",
    feeSource: "indonesia_evisa_official_payment_page",
    runnerCountry: "indonesia",
  })),
  {
    country: "egypt",
    visaType: "EG_E_VISA",
    countryCode: "EG",
    fundingClass: "viza_managed_card",
    provider: "egypt_evisa_official_fee",
    targetPayee: "Egypt e-Visa portal",
    officialUrl: "https://visa2egypt.gov.eg/",
    feeSource: "egypt_evisa_payment_page",
    runnerCountry: "egypt",
  },
  {
    country: "south_korea",
    visaType: "KR_C39_SHORT_TERM_VISIT",
    countryCode: "KR",
    fundingClass: "viza_managed_card",
    provider: "korea_visa_official_fee",
    targetPayee: "Korea Visa Portal or assigned visa application centre",
    officialUrl: "https://www.visa.go.kr/",
    feeSource: "korea_visa_payment_page",
    runnerCountry: "south_korea",
  },
  {
    country: "thailand",
    visaType: "TH_TOURIST_E_VISA",
    countryCode: "TH",
    fundingClass: "viza_managed_card",
    provider: "thailand_evisa_official_fee",
    targetPayee: "Thailand e-Visa portal",
    officialUrl: "https://www.thaievisa.go.th/",
    feeSource: "thailand_evisa_payment_page",
    runnerCountry: "thailand",
  },
  {
    country: "malaysia",
    visaType: "MY_TOURIST_E_VISA",
    countryCode: "MY",
    fundingClass: "viza_managed_card",
    provider: "malaysia_evisa_official_fee",
    targetPayee: "Malaysia Immigration eVISA portal",
    officialUrl: "https://malaysiavisa.imi.gov.my/",
    feeSource: "malaysia_evisa_payment_page",
    runnerCountry: "malaysia",
  },
  {
    country: "singapore",
    visaType: "SG_VISITOR_VISA",
    countryCode: "SG",
    fundingClass: "viza_managed_card",
    provider: "singapore_save_official_fee",
    targetPayee: "Singapore Immigration and Checkpoints Authority",
    officialUrl: "https://eservices.ica.gov.sg/esvclandingpage/save",
    feeSource: "singapore_save_payment_page",
  },
  {
    country: "new_zealand",
    visaType: "NZ_VISITOR_VISA",
    countryCode: "NZ",
    fundingClass: "viza_managed_card",
    provider: "new_zealand_immigration_official_fee",
    targetPayee: "Immigration New Zealand",
    officialUrl: "https://onlineservices.immigration.govt.nz/",
    feeSource: "new_zealand_immigration_payment_page",
  },
  {
    country: "russia",
    visaType: "RU_E_VISA",
    countryCode: "RU",
    fundingClass: "viza_managed_card",
    provider: "russia_evisa_official_fee",
    targetPayee: "Russian unified e-Visa portal",
    officialUrl: "https://evisa.kdmid.ru/",
    feeSource: "russia_evisa_payment_page",
  },
  {
    country: "turkey",
    visaType: "TR_E_VISA",
    countryCode: "TR",
    fundingClass: "viza_managed_card",
    provider: "turkiye_evisa_official_fee",
    targetPayee: "Republic of Türkiye e-Visa portal",
    officialUrl: "https://www.evisa.gov.tr/",
    feeSource: "turkiye_evisa_payment_page",
    runnerCountry: "turkey",
  },
  {
    country: "united_arab_emirates",
    visaType: "AE_TOURIST_VISA",
    countryCode: "AE",
    fundingClass: "viza_managed_card",
    provider: "uae_icp_official_fee",
    targetPayee: "UAE Federal Authority for Identity, Citizenship, Customs and Port Security",
    officialUrl: "https://smartservices.icp.gov.ae/",
    feeSource: "uae_icp_payment_page",
    runnerCountry: "united_arab_emirates",
  },
  {
    country: "canada",
    visaType: "CA_TRV",
    countryCode: "CA",
    fundingClass: "viza_managed_card",
    provider: "canada_ircc_official_fee",
    targetPayee: "Immigration, Refugees and Citizenship Canada",
    officialUrl: "https://ircc.canada.ca/",
    feeSource: "canada_ircc_payment_page",
    runnerCountry: "canada",
  },
  {
    country: "philippines",
    visaType: "PH_TEMPORARY_VISITOR_VISA",
    countryCode: "PH",
    fundingClass: "viza_managed_card",
    provider: "philippines_visitor_visa_official_fee",
    targetPayee: "Philippine embassy or consulate handling the application",
    officialUrl: "https://visa.gov.ph/",
    feeSource: "philippines_post_specific_payment_page",
  },
  {
    country: "cambodia",
    visaType: "KH_TOURIST_E_VISA",
    countryCode: "KH",
    fundingClass: "viza_managed_card",
    provider: "cambodia_evisa_official_fee",
    targetPayee: "Cambodia e-Visa portal",
    officialUrl: "https://www.evisa.gov.kh/",
    feeSource: "cambodia_evisa_payment_page",
    runnerCountry: "cambodia",
  },
  {
    country: "laos",
    visaType: "LA_TOURIST_E_VISA",
    countryCode: "LA",
    fundingClass: "viza_managed_card",
    provider: "laos_evisa_official_fee",
    targetPayee: "Lao eVisa portal",
    officialUrl: "https://laoevisa.gov.la/",
    feeSource: "laos_evisa_payment_page",
    runnerCountry: "laos",
  },
  {
    country: "sri_lanka",
    visaType: "LK_ETA",
    countryCode: "LK",
    fundingClass: "viza_managed_card",
    provider: "sri_lanka_eta_official_fee",
    targetPayee: "Sri Lanka ETA portal",
    officialUrl: "https://www.eta.gov.lk/",
    feeSource: "sri_lanka_eta_payment_page",
    runnerCountry: "sri_lanka",
  },
  {
    country: "india",
    visaType: "IN_E_VISA",
    countryCode: "IN",
    fundingClass: "viza_managed_card",
    provider: "india_evisa_official_fee",
    targetPayee: "India e-Visa portal",
    officialUrl: "https://indianvisaonline.gov.in/evisa/",
    feeSource: "india_evisa_payment_page",
    runnerCountry: "india",
  },
  {
    country: "south_africa",
    visaType: "ZA_VISITOR_VISA",
    countryCode: "ZA",
    fundingClass: "viza_managed_card",
    provider: "south_africa_vfs_official_fee",
    targetPayee: "VFS Global South Africa visa service",
    officialUrl: "https://visa.vfsglobal.com/zaf/en/dha",
    feeSource: "south_africa_vfs_payment_page",
    runnerCountry: "south_africa",
  },
  {
    country: "saudi_arabia",
    visaType: "SA_E_VISA",
    countryCode: "SA",
    fundingClass: "viza_managed_card",
    provider: "saudi_evisa_official_fee",
    targetPayee: "Saudi eVisa portal",
    officialUrl: "https://visa.visitsaudi.com/",
    feeSource: "saudi_evisa_payment_page",
    runnerCountry: "saudi_arabia",
  },
  {
    country: "taiwan",
    visaType: "TW_ENTRY_PERMIT",
    countryCode: "TW",
    fundingClass: "viza_managed_card",
    provider: "taiwan_entry_permit_official_fee",
    targetPayee: "Taiwan National Immigration Agency",
    officialUrl: "https://coa.immigration.gov.tw/coa-frontend/overseas-foreign-china",
    feeSource: "taiwan_entry_permit_post_approval_payment_page",
    runnerCountry: "taiwan",
  },
  {
    country: "italy",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    countryCode: "IT",
    fundingClass: "offline",
    provider: "italy_vfs_offline_fee",
    targetPayee: "Italy visa application centre",
    officialUrl: "https://visa.vfsglobal.com/chn/en/ita/",
    feeSource: "italy_vfs_appointment_collection",
    runnerCountry: "italy",
  },
  {
    country: "japan",
    visaType: "JP_TOURIST",
    countryCode: "JP",
    fundingClass: "offline",
    provider: "japan_consular_offline_fee",
    targetPayee: "Japanese embassy, consulate, or accredited agency",
    officialUrl: "https://www.mofa.go.jp/j_info/visit/visa/",
    feeSource: "japan_consular_collection",
    runnerCountry: "japan",
  },
  {
    country: "japan",
    visaType: "JP_VISIT_JAPAN_WEB",
    countryCode: "JP",
    fundingClass: "free",
    provider: "japan_visit_japan_web_free",
    targetPayee: "Japan Digital Agency / Visit Japan Web",
    officialUrl: "https://www.vjw.digital.go.jp/",
    feeSource: "free_official_arrival_declaration",
    runnerCountry: "japan",
  },
  {
    country: "kenya",
    visaType: "KE_ETA",
    countryCode: "KE",
    fundingClass: "viza_managed_card",
    provider: "kenya_eta_official_fee",
    targetPayee: "Kenya Electronic Travel Authorisation portal",
    officialUrl: "https://etakenya.go.ke/",
    feeSource: "kenya_eta_official_payment_page",
    runnerCountry: "kenya",
  },
  {
    country: "hong_kong",
    visaType: "HK_VISIT_VISA",
    countryCode: "HK",
    fundingClass: "offline",
    provider: "hong_kong_collection_fee",
    targetPayee: "Hong Kong Immigration Department",
    officialUrl: "https://www.immd.gov.hk/",
    feeSource: "hong_kong_fee_on_collection",
  },
  {
    country: "macau",
    visaType: "MO_VISIT_VISA",
    countryCode: "MO",
    fundingClass: "offline",
    provider: "macau_collection_fee",
    targetPayee: "Macao Public Security Police Force",
    officialUrl: "https://www.fsm.gov.mo/psp/eng/",
    feeSource: "macau_fee_on_entry_or_collection",
  },
  {
    country: "maldives",
    visaType: "MV_IMUGA",
    countryCode: "MV",
    fundingClass: "free",
    provider: "maldives_imuga_free",
    targetPayee: "Maldives Immigration",
    officialUrl: "https://imuga.immigration.gov.mv/",
    feeSource: "free_official_declaration",
  },
  ...[
    ["singapore", "SG_ARRIVAL_CARD", "SG", "https://eservices.ica.gov.sg/sgarrivalcard/"],
    ["malaysia", "MY_MDAC_ARRIVAL_CARD", "MY", "https://imigresen-online.imi.gov.my/mdac/main"],
    ["thailand", "TH_TDAC_ARRIVAL_CARD", "TH", "https://tdac.immigration.go.th/arrival-card/#/home"],
    ["philippines", "PH_ETRAVEL_ARRIVAL_CARD", "PH", "https://etravel.gov.ph/"],
    ["philippines", "PH_ETRAVEL_DEPARTURE_CARD", "PH", "https://etravel.gov.ph/"],
    ["vietnam", "VN_PREARRIVAL_DECLARATION", "VN", "https://prearrival.immigration.gov.vn/"],
    ["south_korea", "KR_E_ARRIVAL_CARD", "KR", "https://www.e-arrivalcard.go.kr/portal/"],
  ].map(([country, visaType, countryCode, officialUrl]) => ({
    country,
    visaType,
    countryCode,
    fundingClass: "free" as const,
    provider: `${visaType.toLowerCase()}_free`,
    targetPayee: `${countryCode} immigration authority`,
    officialUrl,
    feeSource: "free_official_declaration",
  })),
] satisfies readonly OfficialFeeCatalogEntry[];

const COUNTRY_ALIASES: Readonly<Record<string, string>> = {
  ae: "united_arab_emirates",
  au: "australia",
  ca: "canada",
  eg: "egypt",
  eu: "european_union",
  fr: "france",
  gb: "united_kingdom",
  hk: "hong_kong",
  id: "indonesia",
  in: "india",
  it: "italy",
  jp: "japan",
  ke: "kenya",
  kh: "cambodia",
  kor: "south_korea",
  korea: "south_korea",
  kr: "south_korea",
  la: "laos",
  lk: "sri_lanka",
  mo: "macau",
  mv: "maldives",
  my: "malaysia",
  nz: "new_zealand",
  ph: "philippines",
  ru: "russia",
  sa: "saudi_arabia",
  schengen: "european_union",
  sg: "singapore",
  th: "thailand",
  tr: "turkey",
  tw: "taiwan",
  uae: "united_arab_emirates",
  uk: "united_kingdom",
  us: "united_states",
  usa: "united_states",
  viet_nam: "vietnam",
  vn: "vietnam",
  za: "south_africa",
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s/-]+/g, "_");
}

function normalizeVisaType(value: string): string {
  const normalized = normalizeKey(value).toUpperCase();
  if (["DS160", "DS_160", "US_B1_B2", "US_DS160"].includes(normalized)) {
    return "B1_B2";
  }
  if (["VIETNAM_E_VISA", "E_VISA_TOURISM", "EVISA_TOURISM", "TOURIST_E_VISA", "TOURIST_EVISA"].includes(normalized)) {
    return "VN_E_VISA";
  }
  return normalized;
}

export function officialFeeCatalogKey(country: string, visaType: string): string {
  const normalizedCountry = normalizeKey(country);
  const canonicalCountry = COUNTRY_ALIASES[normalizedCountry] ?? normalizedCountry;
  return `${canonicalCountry}:${normalizeVisaType(visaType)}`;
}

const CATALOG_BY_KEY = new Map(
  OFFICIAL_FEE_CATALOG.map((entry) => [
    officialFeeCatalogKey(entry.country, entry.visaType),
    entry,
  ]),
);

export function officialFeeCatalogFor(
  country: string | null | undefined,
  visaType: string | null | undefined,
): OfficialFeeCatalogEntry | null {
  if (!country || !visaType) return null;
  return CATALOG_BY_KEY.get(officialFeeCatalogKey(country, visaType)) ?? null;
}
