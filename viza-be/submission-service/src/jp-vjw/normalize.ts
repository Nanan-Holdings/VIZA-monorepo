import type { SubmissionPayload } from "../country-submissions/types";

export const JP_VJW_OFFICIAL_PORTAL_URL = "https://www.vjw.digital.go.jp/";
export const JP_VJW_VISA_TYPE = "JP_VISIT_JAPAN_WEB" as const;

/** Canonical answer keys emitted by the DB seed and consumed by the runner. */
export const JP_VJW_REQUIRED_ANSWER_KEYS = [
  "passport_type",
  "surname",
  "given_names",
  "date_of_birth",
  "nationality",
  "sex",
  "passport_number",
  "passport_expiry_date",
  "passport_issuing_country",
  "email_address",
  "phone_number",
  "residence_country",
  "arrival_date",
  "arrival_airport",
  "flight_number",
  "last_embarkation_country",
  "departure_city_or_port",
  "purpose_of_visit",
  "planned_stay_days",
  "accommodation_name",
  "accommodation_address",
  "accommodation_postal_code",
  "accommodation_phone",
  "has_been_deported",
  "has_criminal_record",
  "has_controlled_substances_or_weapons",
  "has_prohibited_or_restricted_goods",
  "has_dutiable_goods",
  "has_commercial_goods",
  "has_goods_for_other_person",
  "has_unaccompanied_baggage",
  "has_cash_or_valuables_over_threshold",
  "customs_declaration_confirmed",
  "immigration_declaration",
] as const;

export type JpVjwYesNo = "yes" | "no";

export interface JpVjwCustomsAnswers {
  hasProhibitedOrRestrictedGoods: JpVjwYesNo;
  hasDutiableGoods: JpVjwYesNo;
  hasCommercialGoods: JpVjwYesNo;
  hasGoodsForOtherPerson: JpVjwYesNo;
  hasUnaccompaniedBaggage: JpVjwYesNo;
  hasCashOrValuablesOverThreshold: JpVjwYesNo;
  declarationConfirmed: "yes";
}

export interface JpVjwImmigrationAnswers {
  hasBeenDeported: JpVjwYesNo;
  hasCriminalRecord: JpVjwYesNo;
  hasControlledSubstancesOrWeapons: JpVjwYesNo;
  declarationConfirmed: "yes";
}

export class JpVjwPortalValidationError extends Error {
  readonly code = "jp_vjw_payload_validation_failed" as const;

  constructor(message: string, readonly missingFields: string[] = []) {
    super(message);
    this.name = "JpVjwPortalValidationError";
  }
}

export interface JpVjwPortalPayload {
  applicationId: string;
  idempotencyKey: string;
  passportType: string;
  surname: string;
  givenNames: string;
  emailAddress: string;
  fullName: string;
  dateOfBirth: string;
  sex: string;
  nationality: string;
  passportNumber: string;
  passportExpiryDate: string;
  passportIssuingCountry: string;
  phoneNumber: string;
  residenceCountry: string;
  arrivalDate: string;
  departureDate?: string;
  portOfEntry: string;
  flightNumber: string;
  lastEmbarkationCountry: string;
  departureCityOrPort: string;
  purposeOfVisit: string;
  plannedStayDays: number;
  accommodationName: string;
  accommodationAddress: string;
  accommodationPostalCode: string;
  accommodationPhone: string;
  immigrationAnswers: JpVjwImmigrationAnswers;
  customsAnswers: JpVjwCustomsAnswers;

  /** Convenience values retained for result/log consumers; derived from canonical answers. */
  customsDeclaration: JpVjwYesNo;
  immigrationDeclaration: "yes";
  finalDeclaration: "yes";
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function firstText(values: unknown[]): string {
  for (const value of values) {
    const normalized = text(value);
    if (normalized) return normalized;
  }
  return "";
}

function required(value: string, key: string, missing: string[]): string {
  if (!value) missing.push(key);
  return value;
}

function normalizeYesNo(value: unknown, key: string, missing: string[]): JpVjwYesNo {
  const normalized = text(value).toLowerCase();
  if (["yes", "true", "1", "y", "on"].includes(normalized)) return "yes";
  if (["no", "false", "0", "n", "off"].includes(normalized)) return "no";
  missing.push(key);
  return "no";
}

function requireConfirmed(value: unknown, key: string, missing: string[]): "yes" {
  if (normalizeYesNo(value, key, missing) !== "yes") missing.push(key);
  return "yes";
}

function assertIsoDate(value: string, key: string, missing: string[]): void {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) missing.push(key);
}

function derivedStayDays(arrivalDate: string, departureDate: string): string {
  if (!arrivalDate || !departureDate) return "";
  const arrival = Date.parse(`${arrivalDate}T12:00:00.000Z`);
  const departure = Date.parse(`${departureDate}T12:00:00.000Z`);
  if (!Number.isFinite(arrival) || !Number.isFinite(departure) || departure < arrival) return "";
  return String(Math.floor((departure - arrival) / 86_400_000) + 1);
}

function splitFullName(value: string): { surname: string; givenNames: string } {
  const parts = value.trim().split(/\s+/u).filter(Boolean);
  if (parts.length <= 1) return { surname: parts[0] ?? "", givenNames: "" };
  return { surname: parts.at(-1) ?? "", givenNames: parts.slice(0, -1).join(" ") };
}

export function normalizeJpVjwPortalPayload(payload: SubmissionPayload): JpVjwPortalPayload {
  if (payload.countryCode !== "JP" || payload.visaType !== JP_VJW_VISA_TYPE) {
    throw new JpVjwPortalValidationError(
      `Japan Visit Japan Web runner only accepts JP/${JP_VJW_VISA_TYPE}; got ${payload.countryCode}/${payload.visaType}.`,
      ["countryCode", "visaType"],
    );
  }

  const answers = payload.countrySpecific ?? {};
  const personal = payload.personal ?? {};
  const trip = payload.trip ?? {};
  const missing: string[] = [];
  const profileName = splitFullName(firstText([personal.fullName]));
  const surname = required(firstText([answers.surname, profileName.surname]), "surname", missing);
  const givenNames = required(firstText([answers.given_names, profileName.givenNames]), "given_names", missing);
  const arrivalDate = required(firstText([answers.arrival_date, trip.arrivalDate]), "arrival_date", missing);
  const departureDate = firstText([answers.departure_date, trip.departureDate]) || undefined;
  const plannedStayValue = firstText([
    answers.planned_stay_days,
    derivedStayDays(arrivalDate, departureDate ?? ""),
  ]);
  const plannedStayDays = Number(plannedStayValue);
  if (!plannedStayValue || !Number.isInteger(plannedStayDays) || plannedStayDays < 1 || plannedStayDays > 90) {
    missing.push("planned_stay_days");
  }

  const customsAnswers: JpVjwCustomsAnswers = {
    hasProhibitedOrRestrictedGoods: normalizeYesNo(answers.has_prohibited_or_restricted_goods, "has_prohibited_or_restricted_goods", missing),
    hasDutiableGoods: normalizeYesNo(answers.has_dutiable_goods, "has_dutiable_goods", missing),
    hasCommercialGoods: normalizeYesNo(answers.has_commercial_goods, "has_commercial_goods", missing),
    hasGoodsForOtherPerson: normalizeYesNo(answers.has_goods_for_other_person, "has_goods_for_other_person", missing),
    hasUnaccompaniedBaggage: normalizeYesNo(answers.has_unaccompanied_baggage, "has_unaccompanied_baggage", missing),
    hasCashOrValuablesOverThreshold: normalizeYesNo(answers.has_cash_or_valuables_over_threshold, "has_cash_or_valuables_over_threshold", missing),
    declarationConfirmed: requireConfirmed(answers.customs_declaration_confirmed, "customs_declaration_confirmed", missing),
  };
  const immigrationAnswers: JpVjwImmigrationAnswers = {
    hasBeenDeported: normalizeYesNo(answers.has_been_deported, "has_been_deported", missing),
    hasCriminalRecord: normalizeYesNo(answers.has_criminal_record, "has_criminal_record", missing),
    hasControlledSubstancesOrWeapons: normalizeYesNo(
      answers.has_controlled_substances_or_weapons ?? answers.has_drug_or_trafficking_history,
      "has_controlled_substances_or_weapons",
      missing,
    ),
    declarationConfirmed: requireConfirmed(answers.immigration_declaration, "immigration_declaration", missing),
  };

  const result: JpVjwPortalPayload = {
    applicationId: required(text(payload.applicationId), "applicationId", missing),
    idempotencyKey: required(text(payload.idempotencyKey), "idempotencyKey", missing),
    passportType: required(firstText([answers.passport_type]), "passport_type", missing),
    surname,
    givenNames,
    emailAddress: required(firstText([answers.alias_email_address, answers.email_address, personal.email]), "email_address", missing),
    fullName: [surname, givenNames].filter(Boolean).join(" "),
    dateOfBirth: required(firstText([answers.date_of_birth, personal.dateOfBirth]), "date_of_birth", missing),
    sex: required(firstText([answers.sex, answers.gender, personal.gender]), "sex", missing),
    nationality: required(firstText([answers.nationality, personal.nationality]), "nationality", missing),
    passportNumber: required(firstText([answers.passport_number, personal.passportNumber]), "passport_number", missing),
    passportExpiryDate: required(firstText([answers.passport_expiry_date, personal.passportExpiryDate]), "passport_expiry_date", missing),
    passportIssuingCountry: required(firstText([answers.passport_issuing_country, personal.passportIssuingCountry]), "passport_issuing_country", missing),
    phoneNumber: required(firstText([answers.phone_number, personal.phone]), "phone_number", missing),
    residenceCountry: required(firstText([answers.residence_country, personal.nationality]), "residence_country", missing),
    arrivalDate,
    departureDate,
    portOfEntry: required(firstText([answers.arrival_airport]), "arrival_airport", missing),
    flightNumber: required(firstText([answers.flight_number]), "flight_number", missing),
    lastEmbarkationCountry: required(firstText([answers.last_embarkation_country]), "last_embarkation_country", missing),
    departureCityOrPort: required(firstText([answers.departure_city_or_port]), "departure_city_or_port", missing),
    purposeOfVisit: required(firstText([answers.purpose_of_visit, trip.purpose]), "purpose_of_visit", missing),
    plannedStayDays,
    accommodationName: required(firstText([answers.accommodation_name, trip.accommodationName]), "accommodation_name", missing),
    accommodationAddress: required(firstText([answers.accommodation_address, trip.accommodationAddress]), "accommodation_address", missing),
    accommodationPostalCode: required(firstText([answers.accommodation_postal_code]), "accommodation_postal_code", missing),
    accommodationPhone: required(firstText([answers.accommodation_phone]), "accommodation_phone", missing),
    immigrationAnswers,
    customsAnswers,
    customsDeclaration: [
      customsAnswers.hasProhibitedOrRestrictedGoods,
      customsAnswers.hasDutiableGoods,
      customsAnswers.hasCommercialGoods,
      customsAnswers.hasGoodsForOtherPerson,
      customsAnswers.hasUnaccompaniedBaggage,
      customsAnswers.hasCashOrValuablesOverThreshold,
    ].some((value) => value === "yes") ? "yes" : "no",
    immigrationDeclaration: immigrationAnswers.declarationConfirmed,
    finalDeclaration: "yes",
  };

  assertIsoDate(result.dateOfBirth, "date_of_birth", missing);
  assertIsoDate(result.arrivalDate, "arrival_date", missing);
  if (result.departureDate) {
    assertIsoDate(result.departureDate, "departure_date", missing);
  }
  assertIsoDate(result.passportExpiryDate, "passport_expiry_date", missing);
  if (!/^\S+@\S+\.\S+$/u.test(result.emailAddress)) missing.push("email_address");
  if (result.accommodationPostalCode && !/^\d{3}-?\d{4}$/u.test(result.accommodationPostalCode)) {
    missing.push("accommodation_postal_code");
  }

  if (missing.length > 0) {
    const uniqueMissing = [...new Set(missing)];
    throw new JpVjwPortalValidationError(
      `Visit Japan Web payload is missing or invalid: ${uniqueMissing.join(", ")}`,
      uniqueMissing,
    );
  }

  return result;
}
