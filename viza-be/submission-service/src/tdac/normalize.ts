import type { SubmissionPayload } from "../country-submissions/types";

export const TDAC_OFFICIAL_PORTAL_URL = "https://tdac.immigration.go.th/arrival-card/#/home";

export class TdacPortalValidationError extends Error {
  readonly code = "tdac_portal_payload_validation_failed" as const;
  constructor(message: string, readonly missingFields: string[]) {
    super(message);
    this.name = "TdacPortalValidationError";
  }
}

export interface TdacPortalPayload {
  applicationId: string;
  familyName: string;
  firstName: string;
  middleName?: string;
  passportNumber: string;
  nationality: string;
  dateOfBirth: string;
  gender: string;
  occupation: string;
  visaNumber?: string;
  residenceCountry: string;
  residenceCity: string;
  phoneCountryCode: string;
  phoneNumber: string;
  emailAddress: string;
  arrivalDate: string;
  departureDate: string;
  countryBoarded: string;
  purposeOfTravel: string;
  purposeOfTravelOther?: string;
  arrivalModeOfTravel: string;
  arrivalModeOfTransport: string;
  arrivalTransportOther?: string;
  arrivalTransportNumber: string;
  departureModeOfTravel: string;
  departureModeOfTransport: string;
  departureTransportOther?: string;
  departureTransportNumber: string;
  isTransitTraveler: boolean;
  accommodationType?: string;
  accommodationTypeOther?: string;
  addressInThailand?: string;
  province?: string;
  district?: string;
  subDistrict?: string;
  postalCode?: string;
  countriesVisitedLast14Days: string[];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function firstText(values: unknown[]): string {
  for (const value of values) {
    const normalized = text(value);
    if (normalized) return normalized;
  }
  return "";
}

function requireFirstText(values: unknown[], key: string, missing: string[]): string {
  const normalized = firstText(values);
  if (!normalized) missing.push(key);
  return normalized;
}

function splitFullName(fullName: string): { familyName: string; firstName: string; middleName: string } {
  const parts = fullName.toUpperCase().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { familyName: "", firstName: "", middleName: "" };
  if (parts.length === 1) return { familyName: parts[0] ?? "", firstName: "", middleName: "" };
  return {
    familyName: parts[0] ?? "",
    firstName: parts[1] ?? "",
    middleName: parts.slice(2).join(" "),
  };
}

function listAnswer(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  return text(value)
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function normalizeTdacPortalPayload(payload: SubmissionPayload): TdacPortalPayload {
  if (payload.countryCode !== "TH" || payload.visaType !== "TH_TDAC_ARRIVAL_CARD") {
    throw new TdacPortalValidationError(
      `TDAC portal runner only accepts TH_TDAC_ARRIVAL_CARD payloads; got ${payload.countryCode}/${payload.visaType}.`,
      ["countryCode", "visaType"],
    );
  }

  const answers = payload.countrySpecific;
  const missing: string[] = [];
  const splitName = splitFullName(firstText([answers.full_name, payload.personal.fullName]));
  const arrivalDate = requireFirstText([answers.arrival_date, payload.trip.arrivalDate], "answers.arrival_date", missing);
  const departureDate = requireFirstText([answers.departure_date, payload.trip.departureDate], "answers.departure_date", missing);
  const sameDayTransit = arrivalDate === departureDate;
  const isTransitTraveler = sameDayTransit;

  const arrivalModeOfTravel = requireFirstText(
    [answers.arrival_mode_of_travel, answers.mode_of_travel],
    "answers.arrival_mode_of_travel",
    missing,
  );
  const departureModeOfTravel = requireFirstText(
    [answers.departure_mode_of_travel, answers.mode_of_travel],
    "answers.departure_mode_of_travel",
    missing,
  );
  const arrivalModeOfTransport = requireFirstText(
    [answers.arrival_mode_of_transport, answers.mode_of_transport],
    "answers.arrival_mode_of_transport",
    missing,
  );
  const departureModeOfTransport = requireFirstText(
    [answers.departure_mode_of_transport, answers.mode_of_transport],
    "answers.departure_mode_of_transport",
    missing,
  );
  const arrivalTransportNumber = requireFirstText(
    [answers.arrival_transport_number, answers.transport_number, answers.flight_number, answers.vehicle_or_vessel_number],
    "answers.arrival_transport_number",
    missing,
  );
  const departureTransportNumber = requireFirstText(
    [answers.departure_transport_number, answers.transport_number, answers.flight_number, answers.vehicle_or_vessel_number],
    "answers.departure_transport_number",
    missing,
  );
  const countriesVisitedLast14Days = listAnswer(answers.countries_visited_last_14_days);
  if (countriesVisitedLast14Days.length === 0) missing.push("answers.countries_visited_last_14_days");

  const accommodationType = firstText([answers.accommodation_type]);
  const province = firstText([answers.province]);
  const district = firstText([answers.district]);
  const subDistrict = firstText([answers.sub_district, answers.subdistrict]);
  const postalCode = firstText([answers.postcode, answers.postal_code]);
  const addressInThailand = firstText([answers.address_in_thailand]);
  if (!isTransitTraveler) {
    if (!accommodationType) missing.push("answers.accommodation_type");
    if (!province) missing.push("answers.province");
    if (!district) missing.push("answers.district");
    if (!subDistrict) missing.push("answers.sub_district");
    if (!postalCode) missing.push("answers.postcode");
    if (!addressInThailand) missing.push("answers.address_in_thailand");
  }

  const fields: TdacPortalPayload = {
    applicationId: payload.applicationId,
    familyName: requireFirstText([answers.family_name, splitName.familyName], "answers.family_name", missing),
    firstName: requireFirstText([answers.first_name, splitName.firstName], "answers.first_name", missing),
    middleName: firstText([answers.middle_name, splitName.middleName]),
    passportNumber: requireFirstText([answers.passport_number, payload.personal.passportNumber], "answers.passport_number", missing),
    nationality: requireFirstText([answers.nationality, payload.personal.nationality], "answers.nationality", missing),
    dateOfBirth: requireFirstText([answers.date_of_birth, payload.personal.dateOfBirth], "answers.date_of_birth", missing),
    gender: requireFirstText([answers.gender, answers.sex, payload.personal.gender], "answers.gender", missing),
    occupation: requireFirstText([answers.occupation, payload.personal.occupation], "answers.occupation", missing),
    visaNumber: firstText([answers.visa_number]),
    residenceCountry: requireFirstText(
      [answers.country_territory_of_residence, payload.personal.nationality],
      "answers.country_territory_of_residence",
      missing,
    ),
    residenceCity: requireFirstText([answers.city_state_of_residence], "answers.city_state_of_residence", missing),
    phoneCountryCode: requireFirstText([answers.phone_country_code], "answers.phone_country_code", missing),
    phoneNumber: requireFirstText([answers.phone_number, answers.mobile_number, payload.personal.phone], "answers.phone_number", missing),
    emailAddress: requireFirstText([answers.email_address, payload.personal.email], "answers.email_address", missing),
    arrivalDate,
    departureDate,
    countryBoarded: requireFirstText([answers.country_boarded], "answers.country_boarded", missing),
    purposeOfTravel: requireFirstText([answers.purpose_of_travel], "answers.purpose_of_travel", missing),
    purposeOfTravelOther: firstText([answers.purpose_of_travel_other]),
    arrivalModeOfTravel,
    arrivalModeOfTransport,
    arrivalTransportOther: firstText([answers.arrival_transport_other]),
    arrivalTransportNumber,
    departureModeOfTravel,
    departureModeOfTransport,
    departureTransportOther: firstText([answers.departure_transport_other]),
    departureTransportNumber,
    isTransitTraveler,
    accommodationType,
    accommodationTypeOther: firstText([answers.accommodation_type_other]),
    addressInThailand,
    province,
    district,
    subDistrict,
    postalCode,
    countriesVisitedLast14Days,
  };

  if (fields.purposeOfTravel === "others" && !fields.purposeOfTravelOther) missing.push("answers.purpose_of_travel_other");
  if (fields.arrivalModeOfTransport === "others" && !fields.arrivalTransportOther) missing.push("answers.arrival_transport_other");
  if (fields.departureModeOfTransport === "others" && !fields.departureTransportOther) missing.push("answers.departure_transport_other");
  if (!fields.isTransitTraveler && fields.accommodationType === "others" && !fields.accommodationTypeOther) {
    missing.push("answers.accommodation_type_other");
  }

  if (missing.length > 0) {
    throw new TdacPortalValidationError(`TDAC payload is missing: ${missing.join(", ")}`, missing);
  }

  return fields;
}
