import type { SubmissionPayload } from "../country-submissions/types";

export const JP_VJW_OFFICIAL_PORTAL_URL = "https://www.vjw.digital.go.jp/";
export const JP_VJW_VISA_TYPE = "JP_VISIT_JAPAN_WEB" as const;

/** Canonical answer keys emitted by the DB seed and consumed by the runner. */
export const JP_VJW_REQUIRED_ANSWER_KEYS = [
  "surname",
  "given_names",
  "date_of_birth",
  "nationality",
  "passport_number",
  "passport_expiry_date",
  "residence_country",
  "occupation",
  "residence_city",
  "arrival_date",
  "arrival_airline",
  "flight_number",
  "departure_city_or_port",
  "purpose_of_visit",
  "planned_stay_days",
  "accommodation_name",
  "accommodation_prefecture",
  "accommodation_city",
  "accommodation_address",
  "accommodation_phone",
  "has_been_deported",
  "has_criminal_record",
  "has_controlled_substances_or_weapons",
  "has_prohibited_goods",
  "has_restricted_goods",
  "has_gold_or_gold_products",
  "has_dutiable_goods",
  "has_commercial_goods",
  "has_goods_for_other_person",
  "has_unaccompanied_baggage",
  "has_cash_or_valuables_over_threshold",
  "customs_declaration_confirmed",
] as const;

export type JpVjwYesNo = "yes" | "no";

export interface JpVjwCustomsAnswers {
  hasProhibitedGoods: JpVjwYesNo;
  hasRestrictedGoods: JpVjwYesNo;
  hasGoldOrGoldProducts: JpVjwYesNo;
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
  surname: string;
  givenNames: string;
  emailAddress: string;
  fullName: string;
  dateOfBirth: string;
  sex?: string;
  nationality: string;
  passportNumber: string;
  passportExpiryDate: string;
  residenceCountry: string;
  occupation: string;
  residenceCity: string;
  arrivalDate: string;
  departureDate?: string;
  arrivalAirline: string;
  flightNumber: string;
  departureCityOrPort: string;
  purposeOfVisit: string;
  plannedStayDays: number;
  accommodationName: string;
  accommodationPrefecture: string;
  accommodationCity: string;
  accommodationAddress: string;
  accommodationPostalCode?: string;
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

function canonicalNationality(value: string): string {
  const normalized = value.trim().toUpperCase();
  return ["CHN", "CHINA", "中国", "中华人民共和国"].includes(normalized) ? "CHN" : value.trim();
}

function canonicalPurpose(value: string): string {
  const normalized = value.trim().toUpperCase();
  return ["0", "TOURISM", "旅游", "観光"].includes(normalized) ? "0" : value.trim();
}

/**
 * These are the small, stable code sets exposed by the reviewed VJW form.
 * The full airline and city catalogs are intentionally not duplicated here:
 * they are owned by the backend schema snapshot and must be checked against
 * the live official `<select>` controls by the browser adapter (see
 * `selectNative`).
 */
export const JP_VJW_OFFICIAL_PURPOSE_CODES = new Set(["0"]);
export const JP_VJW_OFFICIAL_OCCUPATION_CODES = new Set([
  "0100",
  "0200",
  "0300",
  "0400",
  "0500",
  "0600",
  "0700",
  "0800",
  "0900",
  "0990",
]);
export const JP_VJW_OFFICIAL_PREFECTURE_CODES = new Set(
  Array.from({ length: 47 }, (_, index) => String(index + 1).padStart(2, "0")),
);

function normalizedOccupation(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLowerCase();
}

/** Resolve a saved occupation label to one of the reviewed VJW codes. */
export function resolveJpVjwOccupationCode(value: string): string | null {
  const normalized = normalizedOccupation(value);
  if (JP_VJW_OFFICIAL_OCCUPATION_CODES.has(normalized)) return normalized;
  const aliases: Array<[RegExp, string]> = [
    [/^(?:company employee|employee|engineer|developer|manager|公司职员|工程师|職員)$/u, "0100"],
    [/^(?:company president or executive|president|executive|director|总经理|董事)$/u, "0200"],
    [/^(?:public servant|civil servant|公务员|公務員)$/u, "0300"],
    [/^(?:association staff member|association staff|团体职员|團體職員)$/u, "0400"],
    [/^(?:self-owned business|self-employed|business owner|个体经营|个体经营（自雇）|自雇|自營)$/u, "0500"],
    [/^(?:medical doctor|doctor|physician|医生|醫生)$/u, "0600"],
    [/^(?:teacher|professor|教师|教師|教員)$/u, "0700"],
    [/^(?:student|学生|學生)$/u, "0800"],
    [/^(?:unemployed|无业|無業|無職)$/u, "0900"],
    [/^(?:other|其他|其它|其他职业|其他職業|その他|retired|退休|退休人员|退休人員)$/u, "0990"],
  ];
  return aliases.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}

function canonicalOccupation(value: string): string {
  return resolveJpVjwOccupationCode(value) ?? value.trim();
}

function canonicalAirline(value: string): string {
  const normalized = value.normalize("NFKC").trim().toUpperCase();
  // Accept a legacy official-label value such as `NH: ...` but retain only
  // the official two-character code for the browser control.
  return normalized.match(/^([A-Z0-9]{2})(?:\s|[-:：]|$)/u)?.[1] ?? normalized;
}

function normalizeYesNo(value: unknown, key: string, missing: string[]): JpVjwYesNo {
  const normalized = text(value).toLowerCase();
  if (["yes", "true", "1", "y", "on"].includes(normalized)) return "yes";
  if (["no", "false", "0", "n", "off"].includes(normalized)) return "no";
  missing.push(key);
  return "no";
}

function normalizeSplitLegacyNo(
  currentValue: unknown,
  legacyCombinedValue: unknown,
  key: string,
  missing: string[],
): JpVjwYesNo {
  if (text(currentValue)) return normalizeYesNo(currentValue, key, missing);
  const legacy = text(legacyCombinedValue).toLowerCase();
  if (["no", "false", "0", "n", "off"].includes(legacy)) return "no";
  missing.push(key);
  return "no";
}

function splitFlightNumber(value: string): { airlineHint: string; number: string } {
  const compact = value.replace(/\s+/gu, "").toUpperCase();
  const match = compact.match(/^([A-Z0-9]{2})[- ]?([0-9]{1,8})$/u);
  if (match) return { airlineHint: match[1], number: match[2] };
  return { airlineHint: "", number: compact };
}

function requireConfirmed(value: unknown, key: string, missing: string[]): "yes" {
  if (normalizeYesNo(value, key, missing) !== "yes") missing.push(key);
  return "yes";
}

function assertIsoDate(value: string, key: string, missing: string[]): void {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) missing.push(key);
}

function assertMinimumLength(
  value: string,
  key: string,
  minimum: number,
  missing: string[],
): void {
  if (value.trim().length < minimum) missing.push(key);
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

  const flight = splitFlightNumber(firstText([answers.flight_number]));
  const officialFinalConfirmation = requireConfirmed(
    answers.customs_declaration_confirmed ?? answers.immigration_declaration,
    "customs_declaration_confirmed",
    missing,
  );
  const customsAnswers: JpVjwCustomsAnswers = {
    hasProhibitedGoods: normalizeSplitLegacyNo(
      answers.has_prohibited_goods,
      answers.has_prohibited_or_restricted_goods,
      "has_prohibited_goods",
      missing,
    ),
    hasRestrictedGoods: normalizeSplitLegacyNo(
      answers.has_restricted_goods,
      answers.has_prohibited_or_restricted_goods,
      "has_restricted_goods",
      missing,
    ),
    hasGoldOrGoldProducts: normalizeYesNo(answers.has_gold_or_gold_products, "has_gold_or_gold_products", missing),
    hasDutiableGoods: normalizeYesNo(answers.has_dutiable_goods, "has_dutiable_goods", missing),
    hasCommercialGoods: normalizeYesNo(answers.has_commercial_goods, "has_commercial_goods", missing),
    hasGoodsForOtherPerson: normalizeYesNo(answers.has_goods_for_other_person, "has_goods_for_other_person", missing),
    hasUnaccompaniedBaggage: normalizeYesNo(answers.has_unaccompanied_baggage, "has_unaccompanied_baggage", missing),
    hasCashOrValuablesOverThreshold: normalizeYesNo(answers.has_cash_or_valuables_over_threshold, "has_cash_or_valuables_over_threshold", missing),
    declarationConfirmed: officialFinalConfirmation,
  };
  const immigrationAnswers: JpVjwImmigrationAnswers = {
    hasBeenDeported: normalizeYesNo(answers.has_been_deported, "has_been_deported", missing),
    hasCriminalRecord: normalizeYesNo(answers.has_criminal_record, "has_criminal_record", missing),
    hasControlledSubstancesOrWeapons: normalizeYesNo(
      answers.has_controlled_substances_or_weapons ?? answers.has_drug_or_trafficking_history,
      "has_controlled_substances_or_weapons",
      missing,
    ),
    declarationConfirmed: officialFinalConfirmation,
  };

  const result: JpVjwPortalPayload = {
    applicationId: required(text(payload.applicationId), "applicationId", missing),
    idempotencyKey: required(text(payload.idempotencyKey), "idempotencyKey", missing),
    surname,
    givenNames,
    emailAddress: required(firstText([answers.alias_email_address, answers.email_address, personal.email]), "email_address", missing),
    fullName: [surname, givenNames].filter(Boolean).join(" "),
    dateOfBirth: required(firstText([answers.date_of_birth, personal.dateOfBirth]), "date_of_birth", missing),
    sex: firstText([answers.sex, answers.gender, personal.gender]) || undefined,
    nationality: canonicalNationality(required(firstText([answers.nationality, personal.nationality]), "nationality", missing)),
    passportNumber: required(firstText([answers.passport_number, personal.passportNumber]), "passport_number", missing),
    passportExpiryDate: required(firstText([answers.passport_expiry_date, personal.passportExpiryDate]), "passport_expiry_date", missing),
    residenceCountry: required(firstText([answers.residence_country, personal.nationality]), "residence_country", missing),
    occupation: canonicalOccupation(required(firstText([answers.occupation]), "occupation", missing)),
    residenceCity: required(firstText([answers.residence_city]), "residence_city", missing),
    arrivalDate,
    departureDate,
    arrivalAirline: canonicalAirline(required(firstText([answers.arrival_airline, flight.airlineHint]), "arrival_airline", missing)),
    flightNumber: required(flight.number, "flight_number", missing),
    departureCityOrPort: required(firstText([answers.departure_city_or_port]), "departure_city_or_port", missing),
    purposeOfVisit: canonicalPurpose(required(firstText([answers.purpose_of_visit, trip.purpose]), "purpose_of_visit", missing)),
    plannedStayDays,
    accommodationName: required(firstText([answers.accommodation_name, trip.accommodationName]), "accommodation_name", missing),
    accommodationPrefecture: required(firstText([answers.accommodation_prefecture]), "accommodation_prefecture", missing),
    accommodationCity: required(firstText([answers.accommodation_city]), "accommodation_city", missing),
    accommodationAddress: required(firstText([answers.accommodation_address, trip.accommodationAddress]), "accommodation_address", missing),
    accommodationPostalCode: firstText([answers.accommodation_postal_code]) || undefined,
    accommodationPhone: required(firstText([answers.accommodation_phone]), "accommodation_phone", missing),
    immigrationAnswers,
    customsAnswers,
    customsDeclaration: [
      customsAnswers.hasProhibitedGoods,
      customsAnswers.hasRestrictedGoods,
      customsAnswers.hasGoldOrGoldProducts,
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
  if (!/^\d{10,15}$/u.test(result.accommodationPhone.replace(/[^0-9]/gu, ""))) {
    missing.push("accommodation_phone");
  }
  if (result.flightNumber && !/^\d{1,8}$/u.test(result.flightNumber)) missing.push("flight_number");
  assertMinimumLength(result.residenceCountry, "residence_country", 2, missing);
  assertMinimumLength(result.residenceCity, "residence_city", 2, missing);
  assertMinimumLength(result.arrivalAirline, "arrival_airline", 2, missing);
  assertMinimumLength(result.departureCityOrPort, "departure_city_or_port", 2, missing);
  assertMinimumLength(result.accommodationName, "accommodation_name", 2, missing);
  assertMinimumLength(result.accommodationPrefecture, "accommodation_prefecture", 2, missing);
  assertMinimumLength(result.accommodationCity, "accommodation_city", 2, missing);
  assertMinimumLength(result.accommodationAddress, "accommodation_address", 3, missing);

  // These controls have a reviewed, finite code contract. Airline and city
  // membership is checked against the official live DOM because their full
  // catalogs are maintained outside this independently deployed package.
  if (!/^[A-Z0-9]{2}$/u.test(result.arrivalAirline)) missing.push("arrival_airline");
  if (!JP_VJW_OFFICIAL_OCCUPATION_CODES.has(result.occupation)) missing.push("occupation");
  if (!JP_VJW_OFFICIAL_PURPOSE_CODES.has(result.purposeOfVisit)) missing.push("purpose_of_visit");
  if (!JP_VJW_OFFICIAL_PREFECTURE_CODES.has(result.accommodationPrefecture)) {
    missing.push("accommodation_prefecture");
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
