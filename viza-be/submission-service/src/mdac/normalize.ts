import type { SubmissionPayload } from "../country-submissions/types";

export const MDAC_OFFICIAL_PORTAL_URL = "https://imigresen-online.imi.gov.my/mdac/main";

export class MdacPortalValidationError extends Error {
  readonly code = "mdac_portal_payload_validation_failed" as const;
  constructor(message: string, readonly missingFields: string[]) {
    super(message);
    this.name = "MdacPortalValidationError";
  }
}

export interface MdacPortalPayload {
  applicationId: string;
  fullName: string;
  passportNumber: string;
  passportExpiryDate: string;
  nationality: string;
  placeOfBirth: string;
  dateOfBirth: string;
  sex: string;
  emailAddress: string;
  mobileCountryCode: string;
  mobileNumber: string;
  arrivalDate: string;
  departureDate: string;
  modeOfTravel: string;
  transportNumber: string;
  lastEmbarkationCountry: string;
  purposeOfVisit: string;
  accommodationType: string;
  addressInMalaysia: string;
  city: string;
  state: string;
  postcode: string;
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

export function normalizeMdacPortalPayload(payload: SubmissionPayload): MdacPortalPayload {
  if (payload.countryCode !== "MY" || payload.visaType !== "MY_MDAC_ARRIVAL_CARD") {
    throw new MdacPortalValidationError(
      `MDAC portal runner only accepts MY_MDAC_ARRIVAL_CARD payloads; got ${payload.countryCode}/${payload.visaType}.`,
      ["countryCode", "visaType"],
    );
  }

  const answers = payload.countrySpecific ?? {};
  const personal = payload.personal ?? {};
  const trip = payload.trip ?? {};
  const missing: string[] = [];
  const fields = {
    fullName: requireFirstText([answers.full_name, personal.fullName], "answers.full_name", missing),
    passportNumber: requireFirstText(
      [answers.passport_number, personal.passportNumber],
      "answers.passport_number",
      missing,
    ),
    passportExpiryDate: requireFirstText(
      [answers.passport_expiry_date, personal.passportExpiryDate],
      "answers.passport_expiry_date",
      missing,
    ),
    nationality: requireFirstText([answers.nationality, personal.nationality], "answers.nationality", missing),
    placeOfBirth: requireText(answers, "place_of_birth", missing),
    dateOfBirth: requireFirstText([answers.date_of_birth, personal.dateOfBirth], "answers.date_of_birth", missing),
    sex: requireFirstText([answers.sex, personal.gender], "answers.sex", missing),
    emailAddress: requireFirstText([answers.email_address, personal.email], "answers.email_address", missing),
    mobileCountryCode: requireText(answers, "mobile_country_code", missing),
    mobileNumber: requireFirstText([answers.mobile_number, personal.phone], "answers.mobile_number", missing),
    arrivalDate: requireFirstText([answers.arrival_date, trip.arrivalDate], "answers.arrival_date", missing),
    departureDate: requireFirstText([answers.departure_date, trip.departureDate], "answers.departure_date", missing),
    modeOfTravel: requireText(answers, "mode_of_travel", missing),
    transportNumber: requireText(answers, "transport_number", missing),
    lastEmbarkationCountry: requireText(answers, "last_embarkation_country", missing),
    purposeOfVisit: requireText(answers, "purpose_of_visit", missing),
    accommodationType: requireText(answers, "accommodation_type", missing),
    addressInMalaysia: requireText(answers, "address_in_malaysia", missing),
    city: requireText(answers, "city", missing),
    state: requireText(answers, "state", missing),
    postcode: requireText(answers, "postcode", missing),
  };

  if (missing.length > 0) {
    throw new MdacPortalValidationError(`MDAC payload is missing: ${missing.join(", ")}`, missing);
  }

  if (!/^\d{5}$/.test(fields.postcode)) {
    throw new MdacPortalValidationError("MDAC postcode must be exactly 5 digits.", ["answers.postcode"]);
  }

  return { applicationId: payload.applicationId, ...fields };
}
