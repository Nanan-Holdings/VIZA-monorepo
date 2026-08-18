export type PhEtravelOfficialOptionSourceKind =
  "complete_small_list" | "dynamic_query";

export type PhEtravelOfficialOptionSource = {
  key:
    | "arrival_purpose"
    | "occupation"
    | "monetary_instrument"
    | "country"
    | "currency"
    | "sea_destination_port";
  kind: PhEtravelOfficialOptionSourceKind;
  endpoint: string;
  query: Readonly<Record<string, string>>;
  valueField: "code" | "id";
  labelField: "name";
  retrievedAt: "2026-08-04" | "2026-08-18";
  evidence: "verified_public" | "verified_public_bundle";
};

export type PhEtravelStaticOption = {
  value: string | number;
  label: string;
};

export type PhEtravelOccupationOption = PhEtravelStaticOption & {
  forArrival: boolean;
  forDeparture: boolean;
};

const PUBLIC_QUERY = { paginate: "0", q: "" } as const;

export const PH_ETRAVEL_OFFICIAL_OPTION_SOURCES: readonly PhEtravelOfficialOptionSource[] =
  [
    {
      key: "arrival_purpose",
      kind: "complete_small_list",
      endpoint: "/api/v1/common/purpose_of_visits",
      query: {
        ...PUBLIC_QUERY,
        for_arrival: "1",
        order_by: "name",
        status_by: "asc",
      },
      valueField: "code",
      labelField: "name",
      retrievedAt: "2026-08-18",
      evidence: "verified_public",
    },
    {
      key: "occupation",
      kind: "complete_small_list",
      endpoint: "/api/v1/common/occupations",
      query: { ...PUBLIC_QUERY, order_by: "name", status_by: "asc" },
      valueField: "code",
      labelField: "name",
      retrievedAt: "2026-08-04",
      evidence: "verified_public",
    },
    {
      key: "monetary_instrument",
      kind: "complete_small_list",
      endpoint: "/api/v1/common/monetary_instruments",
      query: PUBLIC_QUERY,
      valueField: "id",
      labelField: "name",
      retrievedAt: "2026-08-04",
      evidence: "verified_public",
    },
    {
      key: "country",
      kind: "dynamic_query",
      endpoint: "/api/v1/common/countries",
      query: PUBLIC_QUERY,
      valueField: "code",
      labelField: "name",
      retrievedAt: "2026-08-04",
      evidence: "verified_public",
    },
    {
      key: "currency",
      kind: "dynamic_query",
      endpoint: "/api/v1/common/currencies",
      query: PUBLIC_QUERY,
      valueField: "id",
      labelField: "name",
      retrievedAt: "2026-08-04",
      evidence: "verified_public",
    },
    {
      key: "sea_destination_port",
      kind: "dynamic_query",
      endpoint: "/api/v1/common/travel_ports",
      query: {
        ...PUBLIC_QUERY,
        order_by: "name",
        status_by: "asc",
        transportation_type: "SEA",
      },
      valueField: "code",
      labelField: "name",
      retrievedAt: "2026-08-04",
      evidence: "verified_public",
    },
  ] as const;

export const PH_ETRAVEL_ARRIVAL_PURPOSE_OPTIONS: readonly PhEtravelStaticOption[] =
  [
    { value: "OFW", label: "OFW" },
    { value: "POV006", label: "Business/Professional" },
    { value: "POV002", label: "Convention/Conference" },
    { value: "POV003", label: "Education/Training/Studies" },
    { value: "POV004", label: "Government/Official Mission" },
    { value: "POV005", label: "Health/Medical Reason" },
    { value: "POV001", label: "Holiday/Pleasure/Vacation" },
    { value: "POV010", label: "Incentive" },
    { value: "POV017", label: "Meetings" },
    { value: "POV999", label: "Others" },
    { value: "POV009", label: "Religion/Pilgrimage" },
    { value: "POV011", label: "Returning Resident" },
    { value: "POV018", label: "Trade Fair/Exhibition" },
    { value: "POV012", label: "Transit" },
    { value: "POV007", label: "Visit Friends/Relatives" },
    { value: "POV008", label: "Work/Employment" },
  ] as const;

export const PH_ETRAVEL_OCCUPATION_OPTIONS: readonly PhEtravelOccupationOption[] =
  [
    {
      value: "OCC003",
      label: "Agriculture",
      forArrival: true,
      forDeparture: true,
    },
    {
      value: "OCC010",
      label: "Airline Crew",
      forArrival: true,
      forDeparture: true,
    },
    {
      value: "OCC015",
      label: "Businessman",
      forArrival: true,
      forDeparture: true,
    },
    {
      value: "OCC002",
      label: "Clerical/Sales",
      forArrival: true,
      forDeparture: true,
    },
    {
      value: "OCC011",
      label: "Diplomat",
      forArrival: true,
      forDeparture: true,
    },
    {
      value: "OCC013",
      label: "Domestic Helper",
      forArrival: false,
      forDeparture: true,
    },
    {
      value: "OCC012",
      label: "Entertainer",
      forArrival: true,
      forDeparture: true,
    },
    {
      value: "OCC006",
      label: "Housewife",
      forArrival: true,
      forDeparture: true,
    },
    {
      value: "OCC005",
      label: "Military/Government Personnel",
      forArrival: true,
      forDeparture: true,
    },
    {
      value: "OCC001",
      label: "Professional/Technical/Administrative",
      forArrival: true,
      forDeparture: true,
    },
    {
      value: "OCC008",
      label: "Retired/Pensioner",
      forArrival: true,
      forDeparture: true,
    },
    { value: "OCC009", label: "Seaman", forArrival: true, forDeparture: true },
    {
      value: "OCC007",
      label: "Student/Minor",
      forArrival: true,
      forDeparture: true,
    },
    {
      value: "OCC014",
      label: "Unemployed",
      forArrival: true,
      forDeparture: true,
    },
    {
      value: "OCC004",
      label: "Worker/Laborer",
      forArrival: true,
      forDeparture: true,
    },
  ] as const;

export const PH_ETRAVEL_MONETARY_INSTRUMENT_OPTIONS: readonly PhEtravelStaticOption[] =
  [
    { value: 1, label: "CASH" },
    { value: 2, label: "BONDS" },
    { value: 3, label: "COMMERCIAL PAPERS" },
    { value: 4, label: "CONFIRMATION OF SALE/INVESTMENT" },
    { value: 5, label: "COSTUDIAL RECEIPTS" },
    { value: 6, label: "DEPOSIT CERTIFICATES" },
    { value: 7, label: "DEPOSIT SUBSTITUTE INSTRUMENTS" },
    { value: 8, label: "DRAFTS" },
    { value: 9, label: "MONEY ORDERS" },
    { value: 10, label: "NOTES" },
    { value: 11, label: "OTHER CHECKS" },
    { value: 12, label: "SECURITIES" },
    { value: 13, label: "TRADING ORDERS" },
    { value: 14, label: "TRANSACTION TICKETS" },
    { value: 15, label: "TRAVELER'S CHECK" },
    { value: 16, label: "TRUST CERTIFICATES" },
  ] as const;

export function getPhEtravelOfficialOptionSource(
  key: PhEtravelOfficialOptionSource["key"]
): PhEtravelOfficialOptionSource {
  const source = PH_ETRAVEL_OFFICIAL_OPTION_SOURCES.find(
    (item) => item.key === key
  );
  if (!source) {
    throw new Error(`Unknown PH eTravel official option source: ${key}`);
  }
  return source;
}

export function hasUniqueOfficialOptionValues(
  options: readonly PhEtravelStaticOption[]
): boolean {
  return (
    options.every((option) => option.label.length > 0) &&
    new Set(options.map((option) => option.value)).size === options.length
  );
}

export function getPhEtravelStaticOptionValue(
  options: readonly PhEtravelStaticOption[],
  submittedValue: string | number | null | undefined
): string | number | null {
  if (submittedValue === null || submittedValue === undefined) return null;
  const rawValue =
    typeof submittedValue === "string" ? submittedValue.trim() : submittedValue;
  const match = options.find((option) => option.value === rawValue);
  return match ? match.value : null;
}

export function getPhEtravelArrivalPurposeCode(
  submittedValue: string | null | undefined
): string | null {
  const value = getPhEtravelStaticOptionValue(
    PH_ETRAVEL_ARRIVAL_PURPOSE_OPTIONS,
    submittedValue
  );
  return typeof value === "string" ? value : null;
}
