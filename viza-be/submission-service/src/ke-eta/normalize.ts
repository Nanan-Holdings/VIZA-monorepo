import type { SubmissionPayload } from "../country-submissions/types";

export const KE_ETA_OFFICIAL_PORTAL_URL = "https://etakenya.go.ke/";
export const KE_ETA_VISA_TYPE = "KE_ETA" as const;
export const KE_ETA_STANDARD_FEE_USD = 30;
export const KE_ETA_EXPEDITED_FEE_USD = 130;

/** Canonical answer keys emitted by the DB seed and consumed by the runner. */
export const KE_ETA_REQUIRED_ANSWER_KEYS = [
  "surname",
  "given_names",
  "date_of_birth",
  "sex",
  "nationality",
  "passport_number",
  "passport_issue_date",
  "passport_expiry_date",
  "passport_issuing_country",
  "email_address",
  "phone_number",
  "residential_address",
  "country_of_residence",
  "arrival_date",
  "departure_date",
  "entry_point",
  "flight_number",
  "purpose_of_travel",
  "accommodation_name",
  "accommodation_address",
  "accommodation_phone",
  "processing_speed",
  "has_currency_over_usd_10000",
  "declaration_confirmed",
] as const;

export type KeEtaYesNo = "yes" | "no";

/**
 * Document paths are deliberately optional here. They are resolved from
 * application_documents by the queue, never read from answer values.
 */
export interface KeEtaAttachmentSet {
  passportBioPage?: string;
  passportPhoto?: string;
  flightItinerary?: string;
  accommodationProof?: string;
  invitationLetter?: string;
  additionalDocuments?: string[];
}

export class KeEtaPortalValidationError extends Error {
  readonly code = "ke_eta_payload_validation_failed" as const;

  constructor(message: string, readonly missingFields: string[] = []) {
    super(message);
    this.name = "KeEtaPortalValidationError";
  }
}

export interface KeEtaPortalPayload {
  applicationId: string;
  idempotencyKey: string;
  emailAddress: string;
  surname: string;
  givenNames: string;
  fullName: string;
  dateOfBirth: string;
  sex: string;
  nationality: string;
  passportNumber: string;
  passportIssueDate: string;
  passportExpiryDate: string;
  passportIssuingCountry: string;
  phoneNumber: string;
  residentialAddress: string;
  arrivalDate: string;
  departureDate: string;
  arrivalPoint: string;
  purposeOfVisit: string;
  flightNumber: string;
  accommodationName: string;
  accommodationAddress: string;
  accommodationPhone: string;
  processingSpeed: "Standard" | "Expedited";
  hasCurrencyOverUsd10000: KeEtaYesNo;
  declarationConfirmed: "yes";
  attachments?: KeEtaAttachmentSet;
  officialFeeCurrency: "USD";
  officialFeeAmount: number;

  /** Compatibility names for the generic submission/result surfaces. */
  purposeOfTravel: string;
  entryPoint: string;
  countryOfResidence?: string;
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

function normalizeYesNo(value: unknown, key: string, missing: string[]): KeEtaYesNo {
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

function readAttachments(metadata: Record<string, unknown>): KeEtaAttachmentSet | undefined {
  const raw = metadata.attachments ?? metadata.applicationDocuments;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const source = raw as Record<string, unknown>;
  const additionalDocuments = Array.isArray(source.additionalDocuments)
    ? source.additionalDocuments.map(text).filter(Boolean)
    : undefined;
  const attachments: KeEtaAttachmentSet = {
    passportBioPage: firstText([source.passportBioPage, source.passport_bio_page]) || undefined,
    passportPhoto: firstText([source.passportPhoto, source.passport_photo]) || undefined,
    flightItinerary: firstText([source.flightItinerary, source.flight_itinerary]) || undefined,
    accommodationProof: firstText([source.accommodationProof, source.accommodation_proof]) || undefined,
    invitationLetter: firstText([source.invitationLetter, source.invitation_letter]) || undefined,
    additionalDocuments,
  };
  return Object.values(attachments).some((value) => Array.isArray(value) ? value.length > 0 : Boolean(value))
    ? attachments
    : undefined;
}

function splitFullName(value: string): { surname: string; givenNames: string } {
  const parts = value.trim().split(/\s+/u).filter(Boolean);
  if (parts.length <= 1) return { surname: parts[0] ?? "", givenNames: "" };
  return { surname: parts.at(-1) ?? "", givenNames: parts.slice(0, -1).join(" ") };
}

function resolveFeeAmount(
  processingSpeed: "Standard" | "Expedited",
  metadata: Record<string, unknown>,
  missing: string[],
): number {
  const candidate = metadata.officialFeeAmount
    ?? (processingSpeed === "Standard" ? KE_ETA_STANDARD_FEE_USD : undefined);
  const amount = Number(candidate);
  const expectedAmount = processingSpeed === "Expedited"
    ? KE_ETA_EXPEDITED_FEE_USD
    : KE_ETA_STANDARD_FEE_USD;
  if (!Number.isFinite(amount) || amount !== expectedAmount) missing.push("officialFeeAmount");
  return amount;
}

export function normalizeKeEtaPortalPayload(payload: SubmissionPayload): KeEtaPortalPayload {
  if (payload.countryCode !== "KE" || payload.visaType !== KE_ETA_VISA_TYPE) {
    throw new KeEtaPortalValidationError(
      `Kenya eTA runner only accepts KE/${KE_ETA_VISA_TYPE}; got ${payload.countryCode}/${payload.visaType}.`,
      ["countryCode", "visaType"],
    );
  }

  const answers = payload.countrySpecific ?? {};
  const personal = payload.personal ?? {};
  const trip = payload.trip ?? {};
  const metadata = payload.metadata ?? {};
  const missing: string[] = [];
  const profileName = splitFullName(firstText([personal.fullName]));
  const surname = required(firstText([answers.surname, profileName.surname]), "surname", missing);
  const givenNames = required(firstText([answers.given_names, profileName.givenNames]), "given_names", missing);
  const processingSpeedValue = firstText([answers.processing_speed]);
  const processingSpeed = processingSpeedValue.toLowerCase() === "expedited" ? "Expedited" : "Standard";
  if (!processingSpeedValue || !["standard", "expedited"].includes(processingSpeedValue.toLowerCase())) {
    missing.push("processing_speed");
  }

  const hasCurrencyOverUsd10000 = normalizeYesNo(
    answers.has_currency_over_usd_10000,
    "has_currency_over_usd_10000",
    missing,
  );
  const result: KeEtaPortalPayload = {
    applicationId: required(text(payload.applicationId), "applicationId", missing),
    idempotencyKey: required(text(payload.idempotencyKey), "idempotencyKey", missing),
    emailAddress: required(firstText([answers.alias_email_address, answers.email_address, personal.email]), "email_address", missing),
    surname,
    givenNames,
    fullName: [surname, givenNames].filter(Boolean).join(" "),
    dateOfBirth: required(firstText([answers.date_of_birth, personal.dateOfBirth]), "date_of_birth", missing),
    sex: required(firstText([answers.sex, answers.gender, personal.gender]), "sex", missing),
    nationality: required(firstText([answers.nationality, personal.nationality]), "nationality", missing),
    passportNumber: required(firstText([answers.passport_number, personal.passportNumber]), "passport_number", missing),
    passportIssueDate: required(firstText([answers.passport_issue_date, personal.passportIssueDate]), "passport_issue_date", missing),
    passportExpiryDate: required(firstText([answers.passport_expiry_date, personal.passportExpiryDate]), "passport_expiry_date", missing),
    passportIssuingCountry: required(firstText([answers.passport_issuing_country, personal.passportIssuingCountry]), "passport_issuing_country", missing),
    phoneNumber: required(firstText([answers.phone_number, personal.phone]), "phone_number", missing),
    residentialAddress: required(firstText([answers.residential_address, personal.address]), "residential_address", missing),
    countryOfResidence: required(firstText([answers.country_of_residence]), "country_of_residence", missing),
    arrivalDate: required(firstText([answers.arrival_date, trip.arrivalDate]), "arrival_date", missing),
    departureDate: required(firstText([answers.departure_date, trip.departureDate]), "departure_date", missing),
    arrivalPoint: required(firstText([answers.entry_point, answers.arrival_point]), "entry_point", missing),
    purposeOfVisit: required(firstText([answers.purpose_of_travel, answers.purpose_of_visit, trip.purpose]), "purpose_of_travel", missing),
    purposeOfTravel: firstText([answers.purpose_of_travel, answers.purpose_of_visit, trip.purpose]),
    flightNumber: required(firstText([answers.flight_number]), "flight_number", missing),
    entryPoint: firstText([answers.entry_point, answers.arrival_point]),
    accommodationName: required(firstText([answers.accommodation_name, trip.accommodationName]), "accommodation_name", missing),
    accommodationAddress: required(firstText([answers.accommodation_address, trip.accommodationAddress]), "accommodation_address", missing),
    accommodationPhone: required(firstText([answers.accommodation_phone]), "accommodation_phone", missing),
    processingSpeed,
    hasCurrencyOverUsd10000,
    declarationConfirmed: requireConfirmed(answers.declaration_confirmed, "declaration_confirmed", missing),
    attachments: readAttachments(metadata),
    officialFeeCurrency: "USD",
    officialFeeAmount: 0,
  };
  result.officialFeeAmount = resolveFeeAmount(processingSpeed, metadata, missing);

  assertIsoDate(result.dateOfBirth, "date_of_birth", missing);
  assertIsoDate(result.passportIssueDate, "passport_issue_date", missing);
  assertIsoDate(result.passportExpiryDate, "passport_expiry_date", missing);
  assertIsoDate(result.arrivalDate, "arrival_date", missing);
  assertIsoDate(result.departureDate, "departure_date", missing);
  if (result.arrivalDate && result.departureDate && result.departureDate < result.arrivalDate) {
    missing.push("departure_date");
  }
  if (!/^\S+@\S+\.\S+$/u.test(result.emailAddress)) missing.push("email_address");

  if (missing.length > 0) {
    const uniqueMissing = [...new Set(missing)];
    throw new KeEtaPortalValidationError(
      `Kenya eTA payload is missing or invalid: ${uniqueMissing.join(", ")}`,
      uniqueMissing,
    );
  }
  return result;
}
