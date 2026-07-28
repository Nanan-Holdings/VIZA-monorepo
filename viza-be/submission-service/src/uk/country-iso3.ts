/** Resolve wizard/profile country labels or ISO-3166 alpha-3 codes to ISO-3 for gov.uk. */
const NAME_TO_ISO3: Record<string, string> = {
  china: "CHN",
  "people's republic of china": "CHN",
  "prc": "CHN",
  singapore: "SGP",
  malaysia: "MYS",
  "united states": "USA",
  "united states of america": "USA",
  usa: "USA",
  "united kingdom": "GBR",
  uk: "GBR",
  "great britain": "GBR",
  india: "IND",
  japan: "JPN",
  "south korea": "KOR",
  korea: "KOR",
  "hong kong": "HKG",
  "hong kong sar": "HKG",
  taiwan: "TWN",
  australia: "AUS",
  canada: "CAN",
  france: "FRA",
  germany: "DEU",
  thailand: "THA",
  vietnam: "VNM",
  "viet nam": "VNM",
};

export function resolveCountryIso3(codeOrLabel: string | null | undefined): string | undefined {
  const raw = (codeOrLabel ?? "").trim();
  if (!raw) return undefined;
  if (/^[A-Za-z]{3}$/.test(raw)) return raw.toUpperCase();
  const mapped = NAME_TO_ISO3[raw.toLowerCase()];
  return mapped ?? undefined;
}

export function deriveUkBiometricsCountryIso3(
  answers: Record<string, string>,
  profileNationality?: string | null,
): string {
  const candidates = [
    answers.home_address_country,
    answers.home_country,
    answers.country_of_nationality,
    answers.current_nationality,
    answers.nationality,
    profileNationality,
  ];
  for (const candidate of candidates) {
    const iso = resolveCountryIso3(candidate);
    if (iso) return iso;
  }
  return "CHN";
}
