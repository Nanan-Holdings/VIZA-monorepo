const VIETNAM_COUNTRY_ALIASES = new Set([
  "vietnam",
  "viet_nam",
  "vn",
  "越南",
]);

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
    countries: new Set(["sg", "singapore", "新加坡"]),
    visaTypes: new Set(["sgac", "sg_arrival_card"]),
    canonicalVisaType: "SG_ARRIVAL_CARD",
  },
  {
    countries: new Set(["my", "malaysia", "马来西亚"]),
    visaTypes: new Set(["mdac", "my_mdac", "my_mdac_arrival_card"]),
    canonicalVisaType: "MY_MDAC_ARRIVAL_CARD",
  },
  {
    countries: new Set(["th", "thailand", "泰国"]),
    visaTypes: new Set(["tdac", "th_tdac", "th_tdac_arrival_card"]),
    canonicalVisaType: "TH_TDAC_ARRIVAL_CARD",
  },
  {
    countries: VIETNAM_COUNTRY_ALIASES,
    visaTypes: new Set([
      "prearrival_declaration",
      "vn_prearrival",
      "vn_prearrival_declaration",
    ]),
    canonicalVisaType: "VN_PREARRIVAL_DECLARATION",
  },
];

function normalizeAliasInput(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
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
