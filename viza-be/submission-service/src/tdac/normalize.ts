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
  fullName: string;
  passportNumber: string;
  nationality: string;
  dateOfBirth: string;
  sex: string;
  occupation: string;
  emailAddress: string;
  mobileNumber: string;
  arrivalDate: string;
  departureDate: string;
  purposeOfTravel: string;
  modeOfTravel: string;
  transportNumber: string;
  countryBoarded: string;
  portOfArrival: string;
  accommodationType: string;
  addressInThailand: string;
  province: string;
  district: string;
  countriesVisitedLast14Days: string;
  hasHealthSymptoms: string;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function requireText(fields: Record<string, string>, key: string, missing: string[]): string {
  const value = text(fields[key]);
  if (!value) missing.push(key);
  return value;
}

function firstText(values: Array<unknown>): string {
  for (const value of values) {
    const normalized = text(value);
    if (normalized) return normalized;
  }
  return "";
}

function requireFirstText(values: Array<unknown>, key: string, missing: string[]): string {
  const normalized = firstText(values);
  if (!normalized) missing.push(key);
  return normalized;
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
  const modeOfTravel = requireText(answers, "mode_of_travel", missing);
  const transportNumber =
    modeOfTravel === "air"
      ? requireText(answers, "flight_number", missing)
      : requireText(answers, "vehicle_or_vessel_number", missing);
  const fields = {
    fullName: requireFirstText([answers.full_name, payload.personal.fullName], "answers.full_name", missing),
    passportNumber: requireFirstText(
      [answers.passport_number, payload.personal.passportNumber],
      "answers.passport_number",
      missing,
    ),
    nationality: requireFirstText([answers.nationality, payload.personal.nationality], "answers.nationality", missing),
    dateOfBirth: requireFirstText([answers.date_of_birth, payload.personal.dateOfBirth], "answers.date_of_birth", missing),
    sex: requireFirstText([answers.sex, payload.personal.gender], "answers.sex", missing),
    occupation: requireFirstText([answers.occupation, payload.personal.occupation], "answers.occupation", missing),
    emailAddress: requireFirstText([answers.email_address, payload.personal.email], "answers.email_address", missing),
    mobileNumber: requireFirstText([answers.mobile_number, payload.personal.phone], "answers.mobile_number", missing),
    arrivalDate: requireFirstText([answers.arrival_date, payload.trip.arrivalDate], "answers.arrival_date", missing),
    departureDate: requireFirstText([answers.departure_date, payload.trip.departureDate], "answers.departure_date", missing),
    purposeOfTravel: requireText(answers, "purpose_of_travel", missing),
    modeOfTravel,
    transportNumber,
    countryBoarded: requireText(answers, "country_boarded", missing),
    portOfArrival: requireText(answers, "port_of_arrival", missing),
    accommodationType: requireText(answers, "accommodation_type", missing),
    addressInThailand: requireText(answers, "address_in_thailand", missing),
    province: requireText(answers, "province", missing),
    district: requireText(answers, "district", missing),
    countriesVisitedLast14Days: requireText(answers, "countries_visited_last_14_days", missing),
    hasHealthSymptoms: requireText(answers, "has_health_symptoms", missing),
  };

  if (missing.length > 0) {
    throw new TdacPortalValidationError(`TDAC payload is missing: ${missing.join(", ")}`, missing);
  }

  return { applicationId: payload.applicationId, ...fields };
}
