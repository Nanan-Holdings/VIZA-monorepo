import type { VisaFormFieldOption } from "@/types/visa-form-fields";

export type AddressLookupLocation = {
  formattedAddress: string;
  state: string;
  cityCandidates: string[];
  postalCode: string;
  countryCode: string;
};

type GoogleAddressComponent = {
  long_name?: string;
  short_name?: string;
  types?: string[];
};

type GoogleGeocodePayload = {
  status?: string;
  results?: Array<{
    formatted_address?: string;
    address_components?: GoogleAddressComponent[];
  }>;
};

const MALAYSIA_LOCATION_ALIASES: Record<string, string> = {
  "PENANG": "PULAU PINANG",
  "P PINANG": "PULAU PINANG",
  "MALACCA": "MELAKA",
  "FEDERAL TERRITORY OF KUALA LUMPUR": "WP KUALA LUMPUR",
  "WILAYAH PERSEKUTUAN KUALA LUMPUR": "WP KUALA LUMPUR",
  "FEDERAL TERRITORY OF LABUAN": "WP LABUAN",
  "WILAYAH PERSEKUTUAN LABUAN": "WP LABUAN",
  "FEDERAL TERRITORY OF PUTRAJAYA": "WP PUTRAJAYA",
  "WILAYAH PERSEKUTUAN PUTRAJAYA": "WP PUTRAJAYA",
  "GEORGE TOWN": "GEORGETOWN",
};

function normalizeLocationText(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
  return MALAYSIA_LOCATION_ALIASES[normalized] ?? normalized;
}

function componentValues(
  components: GoogleAddressComponent[],
  type: string,
): string[] {
  const values: string[] = [];
  for (const component of components) {
    if (!component.types?.includes(type)) continue;
    if (component.long_name?.trim()) values.push(component.long_name.trim());
    if (component.short_name?.trim()) values.push(component.short_name.trim());
  }
  return values;
}

function firstComponentValue(
  components: GoogleAddressComponent[],
  type: string,
  preferShort = false,
): string {
  if (preferShort) {
    const component = components.find((candidate) => candidate.types?.includes(type));
    return component?.short_name?.trim() || component?.long_name?.trim() || "";
  }
  return componentValues(components, type)[0] ?? "";
}

export function parseGoogleAddressLookup(payload: unknown): AddressLookupLocation | null {
  if (!payload || typeof payload !== "object") return null;
  const response = payload as GoogleGeocodePayload;
  if (response.status !== "OK" || !Array.isArray(response.results)) return null;

  const first = response.results[0];
  const components = first?.address_components;
  if (!first || !Array.isArray(components)) return null;

  const cityCandidates = [
    ...componentValues(components, "locality"),
    ...componentValues(components, "postal_town"),
    ...componentValues(components, "sublocality_level_1"),
    ...componentValues(components, "sublocality"),
    ...componentValues(components, "administrative_area_level_2"),
  ].filter((value, index, all) => value && all.indexOf(value) === index);

  return {
    formattedAddress: first.formatted_address?.trim() ?? "",
    state: firstComponentValue(components, "administrative_area_level_1"),
    cityCandidates,
    postalCode: firstComponentValue(components, "postal_code"),
    countryCode: firstComponentValue(components, "country", true).toUpperCase(),
  };
}

function optionSearchValues(option: VisaFormFieldOption): string[] {
  if (typeof option === "string") return [option];
  return [
    option.text,
    option.label_en,
    option.official_label,
    option.label_zh,
  ].filter((value): value is string => Boolean(value?.trim()));
}

function locationMatchScore(optionText: string, candidate: string): number {
  const option = normalizeLocationText(optionText);
  const target = normalizeLocationText(candidate);
  if (!option || !target) return 0;
  if (option === target) return 100;
  if (option.replace(/\s/g, "") === target.replace(/\s/g, "")) return 95;
  if (Math.min(option.length, target.length) >= 5 && (option.includes(target) || target.includes(option))) {
    return 70 + Math.round((Math.min(option.length, target.length) / Math.max(option.length, target.length)) * 20);
  }
  return 0;
}

export function matchAddressOptionValue(
  options: VisaFormFieldOption[] | null | undefined,
  candidates: string[],
): string | null {
  let best: { value: string; score: number } | null = null;
  for (const option of options ?? []) {
    const value = typeof option === "string" ? option : option.value;
    for (const optionText of optionSearchValues(option)) {
      for (const candidate of candidates) {
        const score = locationMatchScore(optionText, candidate);
        if (score > (best?.score ?? 0)) best = { value, score };
      }
    }
  }
  return best?.score && best.score >= 70 ? best.value : null;
}
