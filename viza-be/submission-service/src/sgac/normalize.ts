import type { SubmissionPayload } from "../country-submissions/types";

export class SgacPortalValidationError extends Error {
  readonly code = "sgac_portal_payload_validation_failed" as const;
  readonly missingFields: string[];

  constructor(message: string, missingFields: string[]) {
    super(message);
    this.name = "SgacPortalValidationError";
    this.missingFields = missingFields;
  }
}

export interface SgacPortalPayload {
  applicationId: string;
  fullName: string;
  passportNumber: string;
  passportExpiryDate: string;
  sex: "M" | "F" | "O";
  dateOfBirth: string;
  nationalityLabel: string;
  placeOfBirthLabel: string;
  residenceCityQuery: string;
  email: string;
  phoneCountryCode: string;
  phoneNumber: string;
  hasUsedDifferentName: boolean;
  hasHealthSymptoms: boolean;
  hasYellowFeverTravelHistory: boolean;
  arrivalDate: string;
  departureDate: string;
  lastCityQuery: string;
  nextCityQuery: string;
  purposeOfTravelLabel: string;
  purposeOfTravelRaw: string;
  transport: SgacTransportPayload;
  accommodation: SgacAccommodationPayload;
}

export type SgacTransportPayload =
  | {
      mode: "air";
      airTransportType: "commercial" | "other";
      carrierCodeQuery?: string;
      flightNo?: string;
      transportNumber: string;
    }
  | {
      mode: "land" | "sea";
      transportNumber: string;
    };

export type SgacAccommodationPayload =
  | { type: "hotel"; hotelNameQuery: string }
  | {
      type: "residential";
      postalCode: string;
      blockNumber: string;
      streetName: string;
      buildingName?: string;
      floorNumber?: string;
      unitNumber?: string;
    }
  | { type: "others"; otherType: "day_trip" | "transit" };

export interface NormalizeSgacOptions {
  now?: Date;
}

const COUNTRY_LABELS: Record<string, string> = {
  china: "CHINA",
  cn: "CHINA",
  malaysia: "MALAYSIA",
  my: "MALAYSIA",
  thailand: "THAILAND",
  th: "THAILAND",
  singapore: "SINGAPORE",
  sg: "SINGAPORE",
  indonesia: "INDONESIA",
  id: "INDONESIA",
  india: "INDIA",
  in: "INDIA",
  vietnam: "VIET NAM",
  "viet nam": "VIET NAM",
  vn: "VIET NAM",
  philippines: "PHILIPPINES",
  ph: "PHILIPPINES",
  "united states": "UNITED STATES",
  "united states of america": "UNITED STATES",
  usa: "UNITED STATES",
  us: "UNITED STATES",
  japan: "JAPAN",
  jp: "JAPAN",
  korea: "KOREA, REPUBLIC OF",
  "south korea": "KOREA, REPUBLIC OF",
};

const NATIONALITY_LABELS: Record<string, string> = {
  china: "CHINESE",
  chinese: "CHINESE",
  cn: "CHINESE",
  malaysia: "MALAYSIAN",
  malaysian: "MALAYSIAN",
  my: "MALAYSIAN",
  thailand: "THAI",
  thai: "THAI",
  th: "THAI",
  indonesia: "INDONESIAN",
  indonesian: "INDONESIAN",
  id: "INDONESIAN",
  india: "INDIAN",
  indian: "INDIAN",
  in: "INDIAN",
  vietnam: "VIETNAMESE",
  "viet nam": "VIETNAMESE",
  vietnamese: "VIETNAMESE",
  vn: "VIETNAMESE",
  philippines: "FILIPINO",
  philippine: "FILIPINO",
  filipino: "FILIPINO",
  ph: "FILIPINO",
  "united states": "UNITED STATES",
  "united states of america": "UNITED STATES",
  usa: "UNITED STATES",
  us: "UNITED STATES",
  american: "UNITED STATES",
  japan: "JAPANESE",
  japanese: "JAPANESE",
  jp: "JAPANESE",
};

const PURPOSE_LABELS: Record<string, string> = {
  holiday: "Holiday/Sightseeing/Leisure",
  leisure: "Holiday/Sightseeing/Leisure",
  sightseeing: "Holiday/Sightseeing/Leisure",
  business: "Business/Meeting/Conference/Convention/Exhibition",
  meeting: "Business/Meeting/Conference/Convention/Exhibition",
  conference: "Business/Meeting/Conference/Convention/Exhibition",
  family_friends: "Visiting Friends/Relatives",
  visiting_friends: "Visiting Friends/Relatives",
  visit_family_or_friends: "Visiting Friends/Relatives",
  visiting_friends_relatives: "Visiting Friends/Relatives",
  official_government_visit: "Official/Government visit",
  official_visit: "Official/Government visit",
  medical: "Medical Care",
  medical_care: "Medical Care",
  transit: "1-day Transit/Visa Free Transit Facility (VFTF)",
  transit_with_clearance: "1-day Transit/Visa Free Transit Facility (VFTF)",
  other: "Others",
  others: "Others",
};

const COUNTRY_DIALING_CODES = [
  "86",
  "65",
  "60",
  "66",
  "62",
  "91",
  "84",
  "63",
  "1",
  "81",
  "82",
  "44",
  "61",
];

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s/-]+/g, "_");
}

function text(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function read(payload: SubmissionPayload, key: string): string | null {
  return text(payload.countrySpecific[key]);
}

function required(value: string | null | undefined, field: string, label: string, missing: string[]): string {
  if (value?.trim()) return value.trim();
  missing.push(field);
  return "";
}

function formatDate(value: string): string {
  const trimmed = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (dmy) return trimmed;
  return trimmed;
}

function parseIsoLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function assertArrivalInIcaWindow(arrivalIso: string, now: Date): void {
  const arrival = parseIsoLocalDate(arrivalIso);
  if (!arrival) return;
  const today = startOfLocalDay(now);
  const max = new Date(today);
  max.setDate(today.getDate() + 2);
  if (arrival < today || arrival > max) {
    throw new SgacPortalValidationError(
      "Date of arrival in Singapore must be within three days including today for ICA SGAC submission.",
      ["arrival_date"],
    );
  }
}

function mapCountryLabel(value: string, field: string, missing: string[]): string {
  const direct = COUNTRY_LABELS[normalizeKey(value)] ?? COUNTRY_LABELS[value.trim().toLowerCase()];
  if (direct) return direct;
  if (/^[A-Z ,.'-]{3,}$/.test(value.trim())) return value.trim().toUpperCase();
  missing.push(field);
  return "";
}

function mapNationalityLabel(value: string, missing: string[]): string {
  const direct = NATIONALITY_LABELS[normalizeKey(value)] ?? NATIONALITY_LABELS[value.trim().toLowerCase()];
  if (direct) return direct;
  if (/^[A-Z /,'-]{3,}$/.test(value.trim())) return value.trim().toUpperCase();
  missing.push("nationality");
  return "";
}

function mapPurpose(value: string | null, missing: string[]): { label: string; raw: string } {
  const raw = required(value, "purpose_of_travel", "Purpose of travel", missing);
  if (!raw) return { label: "", raw: "" };
  const mapped = PURPOSE_LABELS[normalizeKey(raw)] ?? PURPOSE_LABELS[raw.trim().toLowerCase()];
  if (mapped) return { label: mapped, raw };
  if (/holiday|sightseeing|leisure/i.test(raw)) return { label: "Holiday/Sightseeing/Leisure", raw };
  if (/business|meeting|conference|exhibition/i.test(raw)) {
    return { label: "Business/Meeting/Conference/Convention/Exhibition", raw };
  }
  if (/friend|relative|family/i.test(raw)) return { label: "Visiting Friends/Relatives", raw };
  if (/medical/i.test(raw)) return { label: "Medical Care", raw };
  if (/transit/i.test(raw)) return { label: "1-day Transit/Visa Free Transit Facility (VFTF)", raw };
  if (/other/i.test(raw)) return { label: "Others", raw };
  missing.push("purpose_of_travel");
  return { label: "", raw };
}

function mapSex(value: string | null, missing: string[]): "M" | "F" | "O" {
  const raw = required(value, "sex", "Sex", missing).toLowerCase();
  if (["m", "male"].includes(raw)) return "M";
  if (["f", "female"].includes(raw)) return "F";
  if (raw) return "O";
  return "O";
}

function boolYes(value: string | null): boolean {
  if (!value) return false;
  return ["yes", "y", "true", "1", "on"].includes(normalizeKey(value));
}

function splitPhone(rawPhone: string): { countryCode: string; phoneNumber: string } {
  const compact = rawPhone.trim().replace(/[()\s-]+/g, "");
  if (compact.startsWith("+")) {
    const internationalDigits = compact.slice(1).replace(/\D+/g, "");
    const countryCode = COUNTRY_DIALING_CODES.find((code) => internationalDigits.startsWith(code));
    if (countryCode) {
      return {
        countryCode,
        phoneNumber: internationalDigits.slice(countryCode.length),
      };
    }
    const plus = /^(\d{1,4})(\d{6,15})$/.exec(internationalDigits);
    if (plus) return { countryCode: plus[1], phoneNumber: plus[2] };
  }
  return { countryCode: "", phoneNumber: compact.replace(/^\+/, "") };
}

function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D+/g, "");
}

function normalizePhoneForIca(
  payload: SubmissionPayload,
  missing: string[],
): { countryCode: string; phoneNumber: string } {
  const rawPhone = required(
    read(payload, "mobile_number") ??
      read(payload, "phone_number") ??
      read(payload, "telephone_number") ??
      payload.personal.phone,
    "mobile_number",
    "Mobile number",
    missing,
  );
  const split = splitPhone(rawPhone);
  const countryCode = digitsOnly(read(payload, "phone_country_code") ?? split.countryCode);
  let phoneNumber = digitsOnly(split.phoneNumber || rawPhone);

  if (countryCode && phoneNumber.startsWith(countryCode) && phoneNumber.length - countryCode.length >= 6) {
    phoneNumber = phoneNumber.slice(countryCode.length);
  }

  if (!countryCode) missing.push("phone_country_code");
  if (!/^\d{6,15}$/.test(phoneNumber)) missing.push("mobile_number");
  return { countryCode, phoneNumber };
}

function splitFlightNumber(raw: string): { carrierCodeQuery: string; flightNo: string } {
  const match = /^([A-Za-z]{2}|[A-Za-z0-9]{3})\s*-?\s*(\d+[A-Za-z]?)$/.exec(raw.trim());
  if (match) {
    return {
      carrierCodeQuery: match[1].toUpperCase(),
      flightNo: match[2].toUpperCase(),
    };
  }
  return { carrierCodeQuery: raw.trim(), flightNo: "" };
}

function buildTransport(payload: SubmissionPayload, missing: string[]): SgacTransportPayload {
  const mode = normalizeKey(required(read(payload, "mode_of_travel"), "mode_of_travel", "Mode of travel", missing));
  const transportNumber = required(read(payload, "transport_number"), "transport_number", "Transport number", missing);
  if (mode === "air") {
    const transportType = normalizeKey(read(payload, "air_transport_type") ?? "commercial");
    const isCommercial = transportType !== "private" && transportType !== "cargo" && transportType !== "other";
    const split = splitFlightNumber(transportNumber);
    if (isCommercial && (!split.carrierCodeQuery || !split.flightNo)) {
      missing.push("transport_number");
    }
    return {
      mode: "air",
      airTransportType: isCommercial ? "commercial" : "other",
      carrierCodeQuery: split.carrierCodeQuery,
      flightNo: split.flightNo,
      transportNumber,
    };
  }
  if (mode === "sea") return { mode: "sea", transportNumber };
  return { mode: "land", transportNumber };
}

function buildAccommodation(payload: SubmissionPayload, missing: string[]): SgacAccommodationPayload {
  const type = normalizeKey(read(payload, "accommodation_type") ?? "residential");
  if (type === "hotel") {
    return {
      type: "hotel",
      hotelNameQuery: required(
        read(payload, "accommodation_name"),
        "accommodation_name",
        "Hotel name",
        missing,
      ),
    };
  }
  if (type === "others" || type === "other") {
    const other = normalizeKey(read(payload, "accommodation_other_type") ?? read(payload, "accommodation_name") ?? "transit");
    return {
      type: "others",
      otherType: other.includes("day") ? "day_trip" : "transit",
    };
  }
  return {
    type: "residential",
    postalCode: required(read(payload, "accommodation_postcode"), "accommodation_postcode", "Singapore postal code", missing),
    blockNumber: required(read(payload, "accommodation_block_number"), "accommodation_block_number", "Block/house number", missing),
    streetName: required(read(payload, "accommodation_street_name"), "accommodation_street_name", "Street name", missing),
    buildingName: read(payload, "accommodation_building_name") ?? undefined,
    floorNumber: read(payload, "accommodation_floor_number") ?? undefined,
    unitNumber: read(payload, "accommodation_unit_number") ?? undefined,
  };
}

export function normalizeSgacPortalPayload(
  payload: SubmissionPayload,
  options: NormalizeSgacOptions = {},
): SgacPortalPayload {
  const missing: string[] = [];
  const now = options.now ?? new Date();

  if (payload.countryCode !== "SG" || payload.visaType !== "SG_ARRIVAL_CARD") {
    throw new SgacPortalValidationError(
      `SGAC portal runner only accepts SG_ARRIVAL_CARD payloads; got ${payload.countryCode}/${payload.visaType}.`,
      ["visa_type"],
    );
  }

  const arrivalIso = required(payload.trip.arrivalDate, "arrival_date", "Arrival date", missing);
  if (arrivalIso) assertArrivalInIcaWindow(arrivalIso, now);
  const departure = required(payload.trip.departureDate, "departure_date", "Departure date", missing);
  const purpose = mapPurpose(read(payload, "purpose_of_travel") ?? payload.trip.purpose ?? null, missing);
  const phone = normalizePhoneForIca(payload, missing);

  const normalized: SgacPortalPayload = {
    applicationId: payload.applicationId,
    fullName: required(payload.personal.fullName, "full_name", "Full name", missing),
    passportNumber: required(payload.personal.passportNumber, "passport_number", "Passport number", missing),
    passportExpiryDate: formatDate(required(payload.personal.passportExpiryDate, "passport_expiry_date", "Passport expiry date", missing)),
    sex: mapSex(payload.personal.gender ?? read(payload, "sex"), missing),
    dateOfBirth: formatDate(required(payload.personal.dateOfBirth, "date_of_birth", "Date of birth", missing)),
    nationalityLabel: mapNationalityLabel(required(payload.personal.nationality, "nationality", "Nationality", missing), missing),
    placeOfBirthLabel: mapCountryLabel(
      required(
        read(payload, "place_of_birth_country") ?? read(payload, "date_of_birth_country") ?? payload.personal.nationality,
        "place_of_birth_country",
        "Country/place of birth",
        missing,
      ),
      "place_of_birth_country",
      missing,
    ),
    residenceCityQuery: required(
      read(payload, "place_of_residence") ?? read(payload, "place_of_residence_city"),
      "place_of_residence",
      "Place of residence",
      missing,
    ),
    email: required(payload.personal.email, "email_address", "Email address", missing),
    phoneCountryCode: phone.countryCode,
    phoneNumber: phone.phoneNumber,
    hasUsedDifferentName: boolYes(read(payload, "has_used_different_name_to_enter_singapore")),
    hasHealthSymptoms: boolYes(read(payload, "has_health_symptoms")),
    hasYellowFeverTravelHistory: boolYes(read(payload, "recent_country_visit_history")),
    arrivalDate: formatDate(arrivalIso),
    departureDate: formatDate(departure),
    lastCityQuery: required(
      read(payload, "last_city_or_port_before_singapore"),
      "last_city_or_port_before_singapore",
      "Last city / port before Singapore",
      missing,
    ),
    nextCityQuery:
      read(payload, "next_city_or_port_after_singapore") ??
      read(payload, "last_city_or_port_before_singapore") ??
      "",
    purposeOfTravelLabel: purpose.label,
    purposeOfTravelRaw: purpose.raw,
    transport: buildTransport(payload, missing),
    accommodation: buildAccommodation(payload, missing),
  };

  if (!normalized.nextCityQuery) {
    missing.push("next_city_or_port_after_singapore");
  }

  const uniqueMissing = [...new Set(missing)];
  if (uniqueMissing.length > 0) {
    const labels: Record<string, string> = {
      purpose_of_travel: "Purpose of travel",
      arrival_date: "Date of arrival in Singapore",
      departure_date: "Date of departure from Singapore",
      place_of_residence: "Place of residence",
      transport_number: "Transport number",
    };
    const readableMissing = uniqueMissing.map((field) => labels[field] ?? field).join(", ");
    throw new SgacPortalValidationError(
      `SG Arrival Card portal payload is missing or cannot map required information: ${readableMissing}.`,
      uniqueMissing,
    );
  }

  return normalized;
}
