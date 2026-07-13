import {
  normalizeKnowledgeCountry,
  type SupportedKnowledgeCountry,
} from "../../config/visa-destination-registry.js";

const COUNTRY_CODE_BY_KNOWLEDGE_COUNTRY: Record<SupportedKnowledgeCountry, string> = {
  austria: "AT",
  australia: "AU",
  belgium: "BE",
  bulgaria: "BG",
  canada: "CA",
  cambodia: "KH",
  croatia: "HR",
  czech_republic: "CZ",
  denmark: "DK",
  egypt: "EG",
  estonia: "EE",
  finland: "FI",
  france: "FR",
  germany: "DE",
  greece: "GR",
  hong_kong: "HK",
  hungary: "HU",
  iceland: "IS",
  india: "IN",
  indonesia: "ID",
  italy: "IT",
  japan: "JP",
  laos: "LA",
  latvia: "LV",
  liechtenstein: "LI",
  lithuania: "LT",
  luxembourg: "LU",
  macau: "MO",
  malaysia: "MY",
  maldives: "MV",
  malta: "MT",
  mexico: "MX",
  morocco: "MA",
  nepal: "NP",
  netherlands: "NL",
  new_zealand: "NZ",
  norway: "NO",
  philippines: "PH",
  poland: "PL",
  portugal: "PT",
  qatar: "QA",
  romania: "RO",
  russia: "RU",
  saudi_arabia: "SA",
  singapore: "SG",
  slovakia: "SK",
  slovenia: "SI",
  south_africa: "ZA",
  south_korea: "KR",
  spain: "ES",
  sri_lanka: "LK",
  switzerland: "CH",
  sweden: "SE",
  thailand: "TH",
  taiwan: "TW",
  turkey: "TR",
  uk: "GB",
  united_arab_emirates: "AE",
  us: "US",
  vietnam: "VN",
};

const KNOWLEDGE_COUNTRY_BY_CODE = new Map<string, SupportedKnowledgeCountry>(
  Object.entries(COUNTRY_CODE_BY_KNOWLEDGE_COUNTRY).map(([country, code]) => [
    code,
    country as SupportedKnowledgeCountry,
  ]),
);

KNOWLEDGE_COUNTRY_BY_CODE.set("UK", "uk");

export interface OfficialFeeCountryResolution {
  knowledgeCountry: SupportedKnowledgeCountry;
  countryCode: string;
}

export function resolveOfficialFeeCountry(
  value: string | null | undefined,
): OfficialFeeCountryResolution | null {
  if (!value?.trim()) return null;

  const normalizedCode = value.trim().toUpperCase();
  const countryFromCode = KNOWLEDGE_COUNTRY_BY_CODE.get(normalizedCode);
  if (countryFromCode) {
    return {
      knowledgeCountry: countryFromCode,
      countryCode: COUNTRY_CODE_BY_KNOWLEDGE_COUNTRY[countryFromCode],
    };
  }

  const knowledgeCountry = normalizeKnowledgeCountry(value);
  if (!knowledgeCountry) return null;

  return {
    knowledgeCountry,
    countryCode: COUNTRY_CODE_BY_KNOWLEDGE_COUNTRY[knowledgeCountry],
  };
}

export function getOfficialFeeCountryCode(value: string): string | null {
  return resolveOfficialFeeCountry(value)?.countryCode ?? null;
}
