export type VisaKnowledgeIntent =
  | "route_recommendation"
  | "requirements"
  | "form_intake"
  | "fees_timing"
  | "eligibility"
  | "source_check";

export interface VisaKnowledgeFilterInput {
  country?: string | null;
  visaType?: string | null;
}

export interface VisaKnowledgeFilters {
  country: string | null | undefined;
  visaType: string | null | undefined;
}

export function documentTypesForIntent(
  intent?: VisaKnowledgeIntent,
): string[] | undefined {
  if (!intent) return undefined;
  const mapping: Record<VisaKnowledgeIntent, string[]> = {
    route_recommendation: ["requirements", "process"],
    requirements: ["requirements", "form_requirements", "photo_requirements"],
    form_intake: ["form_requirements", "photo_requirements", "requirements", "process"],
    fees_timing: ["requirements", "process"],
    eligibility: ["requirements"],
    source_check: ["requirements", "process", "form_requirements", "photo_requirements"],
  };
  return mapping[intent];
}

function normalizeCountryFilter(country?: string | null): string | null | undefined {
  if (!country) return country;
  const normalized = country.trim().toLowerCase();
  const aliases: Record<string, string> = {
    united_states: "us",
    usa: "us",
    "united states": "us",
    united_kingdom: "uk",
    "united kingdom": "uk",
    britain: "uk",
    "hong kong": "hong_kong",
    hksar: "hong_kong",
    macao: "macau",
    "russian federation": "russia",
    schengen_area: "france",
  };
  return aliases[normalized] ?? normalized;
}

function normalizeVisaTypeFilter(visaType?: string | null): string | null | undefined {
  if (!visaType) return visaType;
  const normalized = visaType.trim();
  const aliasKey = normalized.toUpperCase();
  const aliases: Record<string, string> = {
    DS160: "b1_b2",
    B1_B2: "b1_b2",
    B211A: "tourist_b211a",
    ID_C1_TOURIST: "tourist_b211a",
    AU_VISITOR_600: "visitor_subclass_600",
    JP_TOURIST: "short_term_tourism_evisa",
    KR_C39_SHORT_TERM_VISIT: "c3_or_keta",
    EG_E_VISA: "evisa_tourism",
    UK_STANDARD_VISITOR: "standard_visitor",
    EU_SCHENGEN_C_SHORT_STAY: "schengen_short_stay_tourism",
    HK_VISIT_VISA: "hk_visit_visa",
    MO_VISIT_VISA: "mo_visit_visa",
    RU_E_VISA: "unified_evisa",
  };
  return aliases[aliasKey] ?? normalized;
}

export function normalizeKnowledgeFilters(
  filters: VisaKnowledgeFilterInput = {},
): VisaKnowledgeFilters {
  return {
    country: normalizeCountryFilter(filters.country),
    visaType: normalizeVisaTypeFilter(filters.visaType),
  };
}
