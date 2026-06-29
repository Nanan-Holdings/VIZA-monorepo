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
  passportNumber: string;
  passportIssueDate: string;
  passportExpiryDate: string;
  passportIssuingAuthority: string;
  nationality: string;
  countryOfBirth: string;
  countryOfResidence: string;
  occupation: string;
  dateOfBirth: string;
  sex: string;
  emailAddress: string;
  mobileCountryCode: string;
  mobileNumber: string;
  travelType: string;
  transportType: string;
  flightNumber: string;
  airlineOrVesselName: string | null;
  portOfEntry: string;
  arrivalDate: string;
  departureDate: string;
  originCountry: string;
  purposeOfTravel: string;
  philippinesAddress: string;
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
  const match = normalized.match(/^\s*(\+\d{1,4})\b/);
  return match?.[1] ?? "";
}

function phoneWithoutDialCode(value: unknown): string {
  return text(value).replace(/^\+\d{1,4}\s*/, "").trim();
}

function optionalCount(value: unknown, enabled: boolean): string | null {
  const normalized = text(value);
  return enabled && normalized ? normalized : null;
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
  const arrivalDate = requireFirstText([answers.arrival_date, payload.trip.arrivalDate], "arrival_date", missing);
  const window = evaluatePhEtravelSubmissionWindow(arrivalDate, options.now);
  if (window.status !== "open") {
    const reason = window.status === "scheduled"
      ? `Philippines eTravel may normally be submitted only within 72 hours before arrival; earliest date is ${window.earliestSubmissionDate}.`
      : window.status === "past"
        ? "Philippines eTravel arrival date is already past."
        : "Philippines eTravel arrival date must use YYYY-MM-DD.";
    throw new PhEtravelPortalValidationError(reason, ["arrival_date"]);
  }

  const finalDeclaration = boolAnswer(answers.final_declaration);
  if (!finalDeclaration) {
    throw new PhEtravelPortalValidationError(
      "Philippines eTravel final declaration must be accepted before live submission.",
      ["final_declaration"],
    );
  }

  const hasCheckedBaggage = boolAnswer(answers.has_checked_baggage);
  const hasHandcarryBaggage = boolAnswer(answers.has_handcarry_baggage);
  const hasDutiableGoods = boolAnswer(answers.has_dutiable_goods);
  const hasCurrencyOverThreshold = boolAnswer(answers.has_currency_over_threshold);
  const hasHealthSymptoms = boolAnswer(answers.has_health_symptoms);

  const mapped = {
    fullName: requireFirstText([answers.full_name, payload.personal.fullName], "full_name", missing),
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
    flightNumber: requireFirstText(
      [answers.flight_number, answers.vehicle_or_vessel_number, answers.transport_number],
      "flight_number",
      missing,
    ),
    airlineOrVesselName: firstText([answers.airline_or_vessel_name]) || null,
    portOfEntry: requireFirstText([answers.port_of_entry], "port_of_entry", missing),
    arrivalDate,
    departureDate: requireFirstText([answers.departure_date, payload.trip.departureDate], "departure_date", missing),
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
    philippinesAddress: requireFirstText(
      [answers.philippines_address, payload.trip.accommodationAddress],
      "philippines_address",
      missing,
    ),
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
    },
    finalDeclaration,
  };
}
