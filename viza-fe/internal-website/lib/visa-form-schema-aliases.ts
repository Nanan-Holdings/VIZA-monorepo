const VIETNAM_COUNTRY_ALIASES = new Set([
  "vietnam",
  "viet_nam",
  "viet nam",
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

function normalizeAliasInput(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function resolveVisaFormSchemaVisaType(
  visaType: string,
  country?: string | null,
): string {
  const normalizedCountry = normalizeAliasInput(country);
  const normalizedVisaType = normalizeAliasInput(visaType);

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
