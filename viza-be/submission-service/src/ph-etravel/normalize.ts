import type { SubmissionPayload } from "../country-submissions/types";
import { evaluatePhEtravelSubmissionWindow } from "./date-window";

export const PH_ETRAVEL_OFFICIAL_PORTAL_URL = "https://etravel.gov.ph";

export class PhEtravelPortalValidationError extends Error {
  readonly code = "ph_etravel_portal_payload_validation_failed" as const;
  constructor(message: string, readonly missingFields: string[]) {
    super(message);
    this.name = "PhEtravelPortalValidationError";
  }
}

export interface PhEtravelPortalPayload {
  countryCode: "PH";
  visaType: "PH_ETRAVEL_ARRIVAL_CARD";
  applicationId: string;
  fullName: string;
  firstName: string;
  middleName: string | null;
  lastName: string | null;
  suffix: string | null;
  passportNumber: string;
  passportIssueDate: string;
  passportExpiryDate: string;
  passportIssuingAuthority: string;
  nationality: string;
  countryOfBirth: string;
  countryOfResidence: string;
  residenceAddress: string | null;
  occupation: string;
  dateOfBirth: string;
  sex: string;
  emailAddress: string;
  mobileCountryCode: string;
  mobileNumber: string;
  travelType: string;
  transportType: string;
  registrationFor: string | null;
  isSpecialFlight: boolean;
  travellerType: string | null;
  flightNumber: string;
  airlineOrVesselName: string | null;
  airportOfOrigin: string | null;
  portOfEntry: string;
  arrivalDate: string;
  departureDate: string;
  originCountry: string;
  purposeOfTravel: string;
  withTransit: boolean;
  transitCountry: string | null;
  transitAirport: string | null;
  transitDate: string | null;
  destinationType: string | null;
  philippinesAddress: string;
  accompaniedUnder18Count: string | null;
  accompanied18PlusCount: string | null;
  firstTimeVisitingPhilippines: boolean | null;
  hasHealthSymptoms: boolean;
  healthSymptomsDetails: string | null;
  customs: {
    hasCheckedBaggage: boolean;
    checkedBaggageCount: string | null;
    hasHandcarryBaggage: boolean;
    handcarryBaggageCount: string | null;
    hasDutiableGoods: boolean;
    dutiableGoodsDetails: string | null;
    hasCurrencyOverThreshold: boolean;
    currencyDeclarationDetails: string | null;
    hasBaggageOrCurrencyToDeclare: boolean;
    customsSignatureFile: string | null;
  };
  finalDeclaration: boolean;
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

function normalizeIsoDate(value: unknown): string {
  const raw = text(value);
  if (!raw) return "";

  const compact = raw.replace(/\s+/g, " ").trim();
  const directMatch = compact.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
  if (directMatch) {
    const [, year, month, day] = directMatch;
    const normalized = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    const date = new Date(`${normalized}T00:00:00.000Z`);
    if (
      date.getUTCFullYear() === Number(year) &&
      date.getUTCMonth() === Number(month) - 1 &&
      date.getUTCDate() === Number(day)
    ) {
      return normalized;
    }
    return "";
  }

  const slashMatch = compact.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T].*)?$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    const normalized = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    const date = new Date(`${normalized}T00:00:00.000Z`);
    if (
      date.getUTCFullYear() === Number(year) &&
      date.getUTCMonth() === Number(month) - 1 &&
      date.getUTCDate() === Number(day)
    ) {
      return normalized;
    }
    return "";
  }

  const altMatch = compact.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:[ T].*)?$/);
  if (altMatch) {
    const [, month, day, year] = altMatch;
    const normalized = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    const date = new Date(`${normalized}T00:00:00.000Z`);
    if (
      date.getUTCFullYear() === Number(year) &&
      date.getUTCMonth() === Number(month) - 1 &&
      date.getUTCDate() === Number(day)
    ) {
      return normalized;
    }
  }

  return "";
}

function firstIsoDate(values: unknown[], key: string, missing: string[]): string {
  for (const value of values) {
    const normalized = normalizeIsoDate(value);
    if (normalized) return normalized;
  }
  missing.push(key);
  return "";
}

function requireFirstText(values: unknown[], key: string, missing: string[]): string {
  const normalized = firstText(values);
  if (!normalized) missing.push(key);
  return normalized;
}

function boolAnswer(value: unknown): boolean {
  const normalized = text(value).toLowerCase();
  return ["yes", "y", "true", "1", "on", "checked"].includes(normalized);
}

function dialCodeFromPhone(value: unknown): string {
  const normalized = text(value);
  if (!normalized) return "";
  const plusMatch = normalized.match(/^\s*(\+\d{1,4})(?:\D|$)/);
  if (plusMatch) return plusMatch[1];

  const noSignDigits = normalized.replace(/\D/g, "");
  const zeroPrefixMatch = noSignDigits.match(/^00(\d{1,4})/);
  if (zeroPrefixMatch) {
    return `+${zeroPrefixMatch[1]}`;
  }
  return "";
}

function phoneWithoutDialCode(value: unknown): string {
  const raw = text(value);
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const countryCode = dialCodeFromPhone(value).replace("+", "");
  return countryCode && digits.startsWith(countryCode) ? digits.slice(countryCode.length) : digits;
}

function optionalCount(value: unknown, enabled: boolean): string | null {
  const normalized = text(value);
  return enabled && normalized ? normalized : null;
}

function combineNameParts(input: {
  firstName: string;
  middleName?: string | null;
  lastName?: string | null;
  suffix?: string | null;
  fallback?: string;
}): string {
  const parts = [input.firstName, input.middleName, input.lastName, input.suffix]
    .map((part) => text(part))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : text(input.fallback);
}

export function normalizePhEtravelPortalPayload(
  payload: SubmissionPayload,
  options: { now?: Date } = {},
): PhEtravelPortalPayload {
  if (payload.countryCode !== "PH") {
    throw new PhEtravelPortalValidationError(
      `Philippines eTravel runner only accepts PH payloads; got ${payload.countryCode}.`,
      ["countryCode"],
    );
  }
  if (payload.visaType !== "PH_ETRAVEL_ARRIVAL_CARD") {
    throw new PhEtravelPortalValidationError(
      `Philippines eTravel runner only accepts PH_ETRAVEL_ARRIVAL_CARD payloads; got ${payload.visaType}.`,
      ["visaType"],
    );
  }

  const answers = payload.countrySpecific;
  const missing: string[] = [];
  const arrivalDate = firstIsoDate(
    [answers.flight_arrival_date, answers.arrival_date, payload.trip.arrivalDate],
    "flight_arrival_date",
    missing,
  );
  const window = evaluatePhEtravelSubmissionWindow(arrivalDate, options.now);
  if (window.status !== "open") {
    const reason = window.status === "scheduled"
      ? `Philippines eTravel may normally be submitted only within 72 hours before arrival; earliest date is ${window.earliestSubmissionDate}.`
      : window.status === "past"
        ? "Philippines eTravel arrival date is already past."
        : "Philippines eTravel arrival date must use YYYY-MM-DD.";
    throw new PhEtravelPortalValidationError(reason, ["flight_arrival_date"]);
  }

  const finalDeclaration = boolAnswer(answers.final_declaration);
  if (!finalDeclaration) {
    throw new PhEtravelPortalValidationError(
      "Philippines eTravel final declaration must be accepted before live submission.",
      ["final_declaration"],
    );
  }

  const checkedBaggageCount = firstText([answers.checked_baggage_count]);
  const handcarryBaggageCount = firstText([answers.handcarry_baggage_count]);
  const hasCheckedBaggage = boolAnswer(answers.has_checked_baggage) || checkedBaggageCount !== "" && checkedBaggageCount !== "0";
  const hasHandcarryBaggage = boolAnswer(answers.has_handcarry_baggage) || handcarryBaggageCount !== "" && handcarryBaggageCount !== "0";
  const hasBaggageOrCurrencyToDeclare = boolAnswer(answers.has_baggage_or_currency_to_declare);
  const hasDutiableGoods = boolAnswer(answers.has_dutiable_goods);
  const hasCurrencyOverThreshold = boolAnswer(answers.has_currency_over_threshold);
  const hasHealthSymptoms =
    boolAnswer(answers.has_health_symptoms) ||
    boolAnswer(answers.has_recent_travel_history_30d) ||
    boolAnswer(answers.has_exposure_to_sick_person_30d) ||
    boolAnswer(answers.has_been_sick_30d);
  const firstName = firstText([answers.first_name]);
  const middleName = firstText([answers.middle_name]) || null;
  const lastName = firstText([answers.last_name]) || null;
  const suffix = firstText([answers.suffix]) || null;
  const fullName = combineNameParts({
    firstName,
    middleName,
    lastName,
    suffix,
    fallback: firstText([answers.full_name, payload.personal.fullName]),
  });
  if (!fullName) missing.push("first_name");
  const hasTransit = boolAnswer(answers.with_transit);
  const destinationType = firstText([answers.destination_type]) || null;
  const philippinesAddress = requireFirstText(
    [
      answers.philippines_address,
      answers.destination_residence_address,
      answers.destination_hotel_address,
      answers.destination_hotel_name,
      answers.destination_transit_airport,
      payload.trip.accommodationAddress,
    ],
    "destination_type",
    missing,
  );

  const mapped = {
    fullName,
    firstName: firstName || fullName.split(/\s+/)[0] || fullName,
    middleName,
    lastName,
    suffix,
    passportNumber: requireFirstText(
      [answers.passport_number, payload.personal.passportNumber],
      "passport_number",
      missing,
    ),
    passportIssueDate: requireFirstText(
      [answers.passport_issue_date, payload.personal.passportIssueDate],
      "passport_issue_date",
      missing,
    ),
    passportExpiryDate: requireFirstText(
      [answers.passport_expiry_date, payload.personal.passportExpiryDate],
      "passport_expiry_date",
      missing,
    ),
    passportIssuingAuthority: requireFirstText(
      [
        answers.passport_issuing_authority,
        answers.passport_issuing_country,
        payload.personal.passportIssuingCountry,
      ],
      "passport_issuing_authority",
      missing,
    ),
    nationality: requireFirstText([answers.nationality, payload.personal.nationality], "nationality", missing),
    countryOfBirth: requireFirstText([answers.country_of_birth], "country_of_birth", missing),
    countryOfResidence: requireFirstText([answers.country_of_residence], "country_of_residence", missing),
    residenceAddress: firstText([
      answers.residence_address_line1,
      answers.residence_address_line2,
      answers.residential_address,
      answers.home_address,
      answers.home_address_line1,
      answers.address,
      payload.personal.address,
    ]) || null,
    occupation: requireFirstText([answers.occupation, payload.personal.occupation], "occupation", missing),
    dateOfBirth: requireFirstText([answers.date_of_birth, payload.personal.dateOfBirth], "date_of_birth", missing),
    sex: requireFirstText([answers.sex, payload.personal.gender], "sex", missing),
    emailAddress: requireFirstText([answers.email_address, payload.personal.email], "email_address", missing),
    mobileCountryCode: requireFirstText(
      [answers.mobile_country_code, dialCodeFromPhone(payload.personal.phone)],
      "mobile_country_code",
      missing,
    ),
    mobileNumber: requireFirstText(
      [answers.mobile_number, phoneWithoutDialCode(payload.personal.phone)],
      "mobile_number",
      missing,
    ),
    travelType: requireFirstText([answers.travel_type], "travel_type", missing),
    transportType: requireFirstText([answers.transport_type], "transport_type", missing),
    registrationFor: firstText([answers.registration_for]) || null,
    isSpecialFlight: boolAnswer(answers.is_special_flight),
    travellerType: firstText([answers.traveller_type]) || null,
    flightNumber: requireFirstText(
      [
        answers.flight_number === "OTHER" ? answers.flight_number_other : answers.flight_number,
        answers.vehicle_or_vessel_number,
        answers.transport_number,
      ],
      "flight_number",
      missing,
    ),
    airlineOrVesselName: firstText([
      answers.airline_name === "OTHERS" ? answers.airline_name_other : answers.airline_name,
      answers.airline_or_vessel_name,
    ]) || null,
    airportOfOrigin: firstText([answers.airport_of_origin]) || null,
    portOfEntry: requireFirstText([answers.port_of_entry], "port_of_entry", missing),
    arrivalDate,
    departureDate: firstIsoDate(
      [answers.flight_departure_date, answers.departure_date, payload.trip.departureDate],
      "flight_departure_date",
      missing,
    ),
    originCountry: requireFirstText(
      [answers.origin_country, answers.country_of_residence, payload.personal.nationality],
      "origin_country",
      missing,
    ),
    purposeOfTravel: requireFirstText(
      [answers.purpose_of_travel, answers.purpose_of_visit, payload.trip.purpose],
      "purpose_of_travel",
      missing,
    ),
    withTransit: hasTransit,
    transitCountry: hasTransit ? requireFirstText([answers.transit_country], "transit_country", missing) : null,
    transitAirport: hasTransit ? requireFirstText([answers.transit_airport], "transit_airport", missing) : null,
    transitDate: hasTransit ? firstIsoDate([answers.transit_date], "transit_date", missing) : null,
    destinationType,
    philippinesAddress,
    accompaniedUnder18Count: firstText([answers.accompanied_under_18_count]) || null,
    accompanied18PlusCount: firstText([answers.accompanied_18_plus_count]) || null,
    firstTimeVisitingPhilippines: text(answers.first_time_visiting_philippines)
      ? boolAnswer(answers.first_time_visiting_philippines)
      : null,
    healthSymptomsDetails: hasHealthSymptoms ? requireFirstText([answers.health_symptoms_details], "health_symptoms_details", missing) : null,
  };

  if (missing.length > 0) {
    throw new PhEtravelPortalValidationError(`Philippines eTravel payload is missing: ${missing.join(", ")}`, missing);
  }

  return {
    countryCode: "PH",
    visaType: "PH_ETRAVEL_ARRIVAL_CARD",
    applicationId: payload.applicationId,
    ...mapped,
    hasHealthSymptoms,
    customs: {
      hasCheckedBaggage,
      checkedBaggageCount: optionalCount(answers.checked_baggage_count, hasCheckedBaggage),
      hasHandcarryBaggage,
      handcarryBaggageCount: optionalCount(answers.handcarry_baggage_count, hasHandcarryBaggage),
      hasDutiableGoods,
      dutiableGoodsDetails: hasDutiableGoods ? text(answers.dutiable_goods_details) || null : null,
      hasCurrencyOverThreshold,
      currencyDeclarationDetails: hasCurrencyOverThreshold
        ? text(answers.currency_declaration_details) || null
        : null,
      hasBaggageOrCurrencyToDeclare,
      customsSignatureFile: text(answers.customs_signature_file) || null,
    },
    finalDeclaration,
  };
}
