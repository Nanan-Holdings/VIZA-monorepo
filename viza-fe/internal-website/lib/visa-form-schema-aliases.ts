const VIETNAM_COUNTRY_ALIASES = new Set([
  "vietnam",
  "viet_nam",
  "vn",
  "越南",
]);

const COUNTRY_ALIASES = {
  canada: new Set(["ca", "canada", "加拿大"]),
  france: new Set(["fr", "france", "法国"]),
  india: new Set(["in", "india", "印度"]),
  indonesia: new Set(["id", "indonesia", "印尼", "印度尼西亚"]),
  malaysia: new Set(["my", "malaysia", "马来西亚"]),
  philippines: new Set(["ph", "philippines", "菲律宾"]),
  singapore: new Set(["sg", "singapore", "新加坡"]),
  south_korea: new Set(["kr", "korea", "south_korea", "韩国", "南韩"]),
  taiwan: new Set(["tw", "taiwan", "台湾", "中国台湾", "中國台灣"]),
  thailand: new Set(["th", "thailand", "泰国"]),
  turkey: new Set(["tr", "turkey", "turkiye", "türkiye", "土耳其"]),
  united_arab_emirates: new Set(["ae", "uae", "united_arab_emirates", "united arab emirates", "阿联酋"]),
  saudi_arabia: new Set(["sa", "saudi_arabia", "saudi arabia", "沙特", "沙特阿拉伯"]),
  uk: new Set(["uk", "united_kingdom", "united kingdom", "英国"]),
  us: new Set(["us", "usa", "united_states", "united states", "美国"]),
  vietnam: VIETNAM_COUNTRY_ALIASES,
} as const;

const VIETNAM_E_VISA_ROUTE_ALIASES = new Set([
  "evisa_tourism",
  "e_visa_tourism",
  "evista_tourism",
  "tourist_evisa",
  "tourist_e_visa",
  "vietnam_evisa",
  "vietnam_e_visa",
  "vn_evisa",
  "vn_e_visa",
  "VN_E_VISA",
].map((value) => value.toLowerCase()));

const COUNTRY_SCOPED_SCHEMA_ALIASES: ReadonlyArray<{
  countries: ReadonlySet<string>;
  visaTypes: ReadonlySet<string>;
  canonicalVisaType: string;
}> = [
  {
    countries: COUNTRY_ALIASES.canada,
    visaTypes: new Set(["ca_trv", "visitor_visa", "visitor_visa_or_evisa"]),
    canonicalVisaType: "CA_TRV",
  },
  {
    countries: COUNTRY_ALIASES.india,
    visaTypes: new Set(["in_e_visa", "regular_tourist_visa", "tourist_evisa", "tourist_e_visa"]),
    canonicalVisaType: "IN_E_VISA",
  },
  {
    countries: COUNTRY_ALIASES.saudi_arabia,
    visaTypes: new Set(["sa_e_visa", "tourist_evisa", "tourist_e_visa"]),
    canonicalVisaType: "SA_E_VISA",
  },
  {
    countries: COUNTRY_ALIASES.turkey,
    visaTypes: new Set(["tr_e_visa", "evisa_tourism_business", "tourist_evisa", "tourist_e_visa"]),
    canonicalVisaType: "TR_E_VISA",
  },
  {
    countries: COUNTRY_ALIASES.united_arab_emirates,
    visaTypes: new Set(["ae_tourist_visa", "visa_free_or_tourist_visa", "tourist_visa"]),
    canonicalVisaType: "AE_TOURIST_VISA",
  },
  {
    countries: COUNTRY_ALIASES.singapore,
    visaTypes: new Set(["sgac", "sg_arrival_card"]),
    canonicalVisaType: "SG_ARRIVAL_CARD",
  },
  {
    countries: COUNTRY_ALIASES.singapore,
    visaTypes: new Set(["sg_visitor_visa", "visitor_visa"]),
    canonicalVisaType: "SG_VISITOR_VISA",
  },
  {
    countries: COUNTRY_ALIASES.malaysia,
    visaTypes: new Set(["mdac", "my_mdac", "my_mdac_arrival_card"]),
    canonicalVisaType: "MY_MDAC_ARRIVAL_CARD",
  },
  {
    countries: COUNTRY_ALIASES.malaysia,
    visaTypes: new Set(["my_tourist_e_visa", "tourist_evisa", "tourist_e_visa"]),
    canonicalVisaType: "MY_TOURIST_E_VISA",
  },
  {
    countries: COUNTRY_ALIASES.thailand,
    visaTypes: new Set(["tdac", "th_tdac", "th_tdac_arrival_card"]),
    canonicalVisaType: "TH_TDAC_ARRIVAL_CARD",
  },
  {
    countries: COUNTRY_ALIASES.thailand,
    visaTypes: new Set(["th_tourist_e_visa", "tourist_evisa", "tourist_e_visa"]),
    canonicalVisaType: "TH_TOURIST_E_VISA",
  },
  {
    countries: COUNTRY_ALIASES.indonesia,
    visaTypes: new Set(["id_b1_evoa", "b1_evoa", "b1_e_voa", "evoa"]),
    canonicalVisaType: "ID_B1_EVOA",
  },
  {
    countries: COUNTRY_ALIASES.indonesia,
    visaTypes: new Set(["id_c1_tourist", "c1_tourist", "tourist_b211a", "b211a"]),
    canonicalVisaType: "ID_C1_TOURIST",
  },
  {
    countries: COUNTRY_ALIASES.philippines,
    visaTypes: new Set(["ph_temporary_visitor_visa", "temporary_visitor_visa", "visa_free_14_days_or_evisa"]),
    canonicalVisaType: "PH_TEMPORARY_VISITOR_VISA",
  },
  {
    countries: COUNTRY_ALIASES.philippines,
    visaTypes: new Set(["ph_etravel_arrival_card", "etravel_arrival_card"]),
    canonicalVisaType: "PH_ETRAVEL_ARRIVAL_CARD",
  },
  {
    countries: COUNTRY_ALIASES.philippines,
    visaTypes: new Set(["ph_etravel_departure_card", "etravel_departure_card"]),
    canonicalVisaType: "PH_ETRAVEL_DEPARTURE_CARD",
  },
  {
    countries: COUNTRY_ALIASES.south_korea,
    visaTypes: new Set(["kr_c39_short_term_visit", "kr_c39", "c39", "c3_9", "c3_or_keta"]),
    canonicalVisaType: "KR_C39_SHORT_TERM_VISIT",
  },
  {
    countries: COUNTRY_ALIASES.taiwan,
    visaTypes: new Set(["tw_entry_permit", "taiwan_entry_permit", "tw_overseas_cn_tourism_entry_permit"]),
    canonicalVisaType: "TW_ENTRY_PERMIT",
  },
  {
    countries: COUNTRY_ALIASES.uk,
    visaTypes: new Set(["uk_standard_visitor", "standard_visitor"]),
    canonicalVisaType: "UK_STANDARD_VISITOR",
  },
  {
    countries: COUNTRY_ALIASES.us,
    visaTypes: new Set(["ds160", "ds_160", "b1_b2", "b_1_b_2"]),
    canonicalVisaType: "DS160",
  },
  {
    countries: COUNTRY_ALIASES.france,
    visaTypes: new Set(["eu_schengen_c_short_stay", "schengen_short_stay", "schengen_short_stay_tourism"]),
    canonicalVisaType: "EU_SCHENGEN_C_SHORT_STAY",
  },
  {
    countries: COUNTRY_ALIASES.vietnam,
    visaTypes: new Set([
      "prearrival_declaration",
      "vn_prearrival",
      "vn_prearrival_declaration",
    ]),
    canonicalVisaType: "VN_PREARRIVAL_DECLARATION",
  },
];

function normalizeAliasInput(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[\s/-]+/g, "_");
}

export function resolveVisaFormSchemaVisaType(
  visaType: string,
  country?: string | null,
): string {
  const normalizedCountry = normalizeAliasInput(country);
  const normalizedVisaType = normalizeAliasInput(visaType);

  const countryScopedAlias = COUNTRY_SCOPED_SCHEMA_ALIASES.find(
    (entry) =>
      entry.countries.has(normalizedCountry) &&
      entry.visaTypes.has(normalizedVisaType),
  );
  if (countryScopedAlias) {
    return countryScopedAlias.canonicalVisaType;
  }

  if (
    VIETNAM_COUNTRY_ALIASES.has(normalizedCountry) &&
    VIETNAM_E_VISA_ROUTE_ALIASES.has(normalizedVisaType)
  ) {
    return "VN_E_VISA";
  }

  return visaType;
}

export function visaFormSchemaVisaTypesMatch(
  leftVisaType: string,
  rightVisaType: string,
  country?: string | null,
): boolean {
  return (
    resolveVisaFormSchemaVisaType(leftVisaType, country).toLowerCase() ===
    resolveVisaFormSchemaVisaType(rightVisaType, country).toLowerCase()
  );
}
