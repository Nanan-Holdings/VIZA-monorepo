export const PH_ETRAVEL_OFFICIAL_PORTAL_URL = "https://etravel.gov.ph";

export const PH_ETRAVEL_TRAVEL_TYPES = ["ARRIVAL", "DEPARTURE"] as const;
export const PH_ETRAVEL_TRANSPORT_TYPES = ["AIR", "SEA"] as const;
export const PH_ETRAVEL_REFERENCE_PATTERNS = [
  /(?:reference|transaction|qr)\s*(?:no\.?|number|id|code)?\s*[:#-]?\s*([A-Z0-9-]{6,})/i,
  /\b(ETRAVEL[A-Z0-9-]{6,})\b/i,
] as const;

/**
 * E46 is a dated public-option baseline. Purpose values are the only arrival
 * options whose complete current code set is suitable for an in-process
 * allowlist; airline, flight, and port catalogues must be supplied at runtime.
 */
export const PH_ETRAVEL_CURRENT_ARRIVAL_PURPOSE_OPTIONS = [
  { code: "OFW", name: "OFW" },
  { code: "POV001", name: "Holiday/Pleasure/Vacation" },
  { code: "POV002", name: "Convention/Conference" },
  { code: "POV003", name: "Education/Training/Studies" },
  { code: "POV004", name: "Government/Official Mission" },
  { code: "POV005", name: "Health/Medical Reason" },
  { code: "POV006", name: "Business/Professional" },
  { code: "POV007", name: "Visit Friends/Relatives" },
  { code: "POV008", name: "Work/Employment" },
  { code: "POV009", name: "Religion/Pilgrimage" },
  { code: "POV010", name: "Incentive" },
  { code: "POV011", name: "Returning Resident" },
  { code: "POV012", name: "Transit" },
  { code: "POV017", name: "Meetings" },
  { code: "POV018", name: "Trade Fair/Exhibition" },
] as const;

const PH_ETRAVEL_CURRENT_ARRIVAL_PURPOSE_CODES = new Set<string>(
  PH_ETRAVEL_CURRENT_ARRIVAL_PURPOSE_OPTIONS.map((option) => option.code),
);

export interface PhEtravelOfficialCodeNameOption {
  code: string;
  name: string;
}

export interface PhEtravelOfficialFlightOption extends PhEtravelOfficialCodeNameOption {
  travel_company_code: string;
  travel_port_code?: string | null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Option codes are opaque values. Labels and numeric API row ids are never identities. */
export function isPhEtravelOfficialOptionCode(value: unknown): value is string {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(text(value));
}

export function isPhEtravelCurrentArrivalPurposeCode(value: unknown): value is string {
  return PH_ETRAVEL_CURRENT_ARRIVAL_PURPOSE_CODES.has(text(value));
}

export function resolvePhEtravelAirlineOption(input: {
  code: unknown;
  options: readonly PhEtravelOfficialCodeNameOption[];
}): PhEtravelOfficialCodeNameOption | null {
  const code = text(input.code);
  if (!isPhEtravelOfficialOptionCode(code)) return null;
  return input.options.find((option) => option.code === code) ?? null;
}

/**
 * Flight recovery is scoped to its selected airline. E46's endpoint has no
 * `flight_number` property, so callers must use `code` and retain the parent.
 */
export function resolvePhEtravelAirFlightOption(input: {
  airlineCode: unknown;
  flightCode: unknown;
  options: readonly PhEtravelOfficialFlightOption[];
}): PhEtravelOfficialFlightOption | null {
  const airlineCode = text(input.airlineCode);
  const flightCode = text(input.flightCode);
  if (!isPhEtravelOfficialOptionCode(airlineCode) || !isPhEtravelOfficialOptionCode(flightCode)) return null;
  return input.options.find((option) =>
    option.code === flightCode && option.travel_company_code === airlineCode,
  ) ?? null;
}

/**
 * SEA labels are not unique. Exact code matching is deliberately the only
 * resolver, preventing a duplicate label from selecting or recovering a port.
 */
export function resolvePhEtravelSeaDestinationPortOption(input: {
  code: unknown;
  options: readonly PhEtravelOfficialCodeNameOption[];
}): PhEtravelOfficialCodeNameOption | null {
  const code = text(input.code);
  if (!isPhEtravelOfficialOptionCode(code)) return null;
  return input.options.find((option) => option.code === code) ?? null;
}
