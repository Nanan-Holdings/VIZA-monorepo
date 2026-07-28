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
  yellowFeverVaccinationCertificate?: boolean;
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

function optionalBooleanAnswer(value: unknown): boolean | undefined {
  const normalized = text(value).toLowerCase();
  if (["yes", "true", "1"].includes(normalized)) return true;
  if (["no", "false", "0"].includes(normalized)) return false;
  return undefined;
}

const TDAC_PURPOSE_ALIASES: Record<string, string> = {
  holiday: "holiday",
  tourism: "holiday",
  vacation: "holiday",
  leisure: "holiday",
  meeting: "meeting",
  sports: "sports",
  business: "business",
  incentive: "incentive",
  medical: "medical_wellness",
  medical_wellness: "medical_wellness",
  education: "education",
  convention: "convention",
  employment: "employment",
  exhibition: "exhibition",
  others: "others",
};

export function normalizeTdacPurpose(
  purpose: string,
  purposeOther?: string,
): { purpose: string; purposeOther?: string; valid: boolean } {
  const normalized = purpose.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "transit") {
    return { purpose: "others", purposeOther: purposeOther?.trim() || "TRANSIT", valid: true };
  }
  if (normalized === "return_resident") {
    return { purpose: "others", purposeOther: purposeOther?.trim() || "RETURN RESIDENT", valid: true };
  }

  const canonical = TDAC_PURPOSE_ALIASES[normalized];
  if (!canonical) return { purpose: normalized, purposeOther: purposeOther?.trim() || undefined, valid: false };
  return {
    purpose: canonical,
    purposeOther: purposeOther?.trim() || undefined,
    valid: true,
  };
}

export function normalizeTdacPortalPayload(payload: SubmissionPayload): TdacPortalPayload {
  if (payload.countryCode !== "TH" || payload.visaType !== "TH_TDAC_ARRIVAL_CARD") {
    throw new TdacPortalValidationError(
      `TDAC portal runner only accepts TH_TDAC_ARRIVAL_CARD payloads; got ${payload.countryCode}/${payload.visaType}.`,
      ["countryCode", "visaType"],
    );
  }

  const answers = payload.countrySpecific ?? {};
  const personal = payload.personal ?? {};
  const trip = payload.trip ?? {};
  const missing: string[] = [];
  const splitName = splitFullName(firstText([answers.full_name, personal.fullName]));
  const arrivalDate = requireFirstText([answers.arrival_date, trip.arrivalDate], "answers.arrival_date", missing);
  const departureDate = requireFirstText([answers.departure_date, trip.departureDate], "answers.departure_date", missing);
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
    if (!addressInThailand) missing.push("answers.address_in_thailand");
  }
  const purpose = normalizeTdacPurpose(
    requireFirstText([answers.purpose_of_travel], "answers.purpose_of_travel", missing),
    firstText([answers.purpose_of_travel_other]),
  );
  if (!purpose.valid) missing.push("answers.purpose_of_travel(official_option)");

  const fields: TdacPortalPayload = {
    applicationId: payload.applicationId,
    familyName: requireFirstText([answers.family_name, splitName.familyName], "answers.family_name", missing),
    firstName: requireFirstText([answers.first_name, splitName.firstName], "answers.first_name", missing),
    middleName: firstText([answers.middle_name, splitName.middleName]),
    passportNumber: requireFirstText([answers.passport_number, personal.passportNumber], "answers.passport_number", missing),
    nationality: requireFirstText([answers.nationality, personal.nationality], "answers.nationality", missing),
    dateOfBirth: requireFirstText([answers.date_of_birth, personal.dateOfBirth], "answers.date_of_birth", missing),
    gender: requireFirstText([answers.gender, answers.sex, personal.gender], "answers.gender", missing),
    occupation: requireFirstText([answers.occupation, personal.occupation], "answers.occupation", missing),
    visaNumber: firstText([answers.visa_number]),
    residenceCountry: requireFirstText(
      [answers.country_territory_of_residence, personal.nationality],
      "answers.country_territory_of_residence",
      missing,
    ),
    residenceCity: requireFirstText([answers.city_state_of_residence], "answers.city_state_of_residence", missing),
    phoneCountryCode: requireFirstText([answers.phone_country_code], "answers.phone_country_code", missing),
    phoneNumber: requireFirstText([answers.phone_number, answers.mobile_number, personal.phone], "answers.phone_number", missing),
    emailAddress: requireFirstText([answers.email_address, personal.email], "answers.email_address", missing),
    arrivalDate,
    departureDate,
    countryBoarded: requireFirstText([answers.country_boarded], "answers.country_boarded", missing),
    purposeOfTravel: purpose.purpose,
    purposeOfTravelOther: purpose.purposeOther,
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
    yellowFeverVaccinationCertificate: optionalBooleanAnswer(
      answers.yellow_fever_vaccination_certificate,
    ),
  };

  if (fields.purposeOfTravel === "others" && !fields.purposeOfTravelOther) missing.push("answers.purpose_of_travel_other");
  if (fields.arrivalModeOfTransport === "others" && !fields.arrivalTransportOther) missing.push("answers.arrival_transport_other");
  if (fields.departureModeOfTransport === "others" && !fields.departureTransportOther) missing.push("answers.departure_transport_other");
  if (!fields.isTransitTraveler && fields.accommodationType === "others" && !fields.accommodationTypeOther) {
    missing.push("answers.accommodation_type_other");
  }
  if (fields.addressInThailand && fields.addressInThailand.length > 215) {
    missing.push("answers.address_in_thailand(max_215)");
  }

  if (missing.length > 0) {
    throw new TdacPortalValidationError(`TDAC payload is missing: ${missing.join(", ")}`, missing);
  }

  return fields;
}
