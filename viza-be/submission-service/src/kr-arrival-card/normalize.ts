import type { SubmissionPayload } from "../country-submissions/types.js";
import {
  isOfficialAdditionalQuestionKey,
  officialGenderCode,
  officialOccupationCode,
  officialPurposeCode,
} from "./official-options.js";

export const KR_EARRIVAL_OFFICIAL_PORTAL_URL =
  "https://www.e-arrivalcard.go.kr/portal/apply/agreementPolicy.do?applyType=P&type=PC";
export const KR_EARRIVAL_CHECK_EDIT_URL =
  "https://www.e-arrivalcard.go.kr/portal/apply/srchEacInfo.do";

export type KrEArrivalTravelMode = "air" | "sea";

export interface KrEArrivalPortalPayload {
  applicationId: string;
  surname: string;
  givenName: string;
  dateOfBirth: string;
  nationality: string;
  gender: "F" | "M" | "X";
  passportNumber: string;
  passportExpiryDate: string;
  arrivalMode: KrEArrivalTravelMode;
  arrivalDate: string;
  arrivalFlightNumber: string | null;
  arrivalShipName: string | null;
  previousDepartureCountry: string | null;
  previousDepartureCity: string | null;
  departureMode: KrEArrivalTravelMode;
  departureDate: string;
  departureFlightNumber: string | null;
  departureShipName: string | null;
  nextDestinationCountry: string | null;
  nextDestinationCity: string | null;
  purposeCode: string;
  purposeOther: string | null;
  addressKorean: string;
  addressEnglish: string;
  addressDetail: string;
  postalCode: string;
  koreaContactNumber: string;
  occupationCode: string;
  occupationOther: string | null;
  emailAddress: string;
  dodIdNumber: string | null;
  /** Versioned official conditional fields. Empty in the baseline snapshot. */
  additionalAnswers: Record<string, string>;
}

export class KrEArrivalPortalValidationError extends Error {
  readonly code = "kr_earrival_portal_payload_validation_failed" as const;

  constructor(message: string, readonly missingFields: string[]) {
    super(message);
    this.name = "KrEArrivalPortalValidationError";
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function answer(payload: SubmissionPayload, ...keys: string[]): string {
  for (const key of keys) {
    const value = text(payload.countrySpecific[key]);
    if (value) return value;
  }
  return "";
}

function profileAnswer(payload: SubmissionPayload, ...keys: Array<keyof SubmissionPayload["personal"]>): string {
  for (const key of keys) {
    const value = text(payload.personal[key]);
    if (value) return value;
  }
  return "";
}

function requireAnswer(payload: SubmissionPayload, key: string, missing: string[], aliases: string[] = []): string {
  const value = answer(payload, key, ...aliases);
  if (!value) missing.push(`answers.${key}`);
  return value;
}

function requireProfileOrAnswer(
  payload: SubmissionPayload,
  answerKey: string,
  profileKeys: Array<keyof SubmissionPayload["personal"]>,
  missing: string[],
  aliases: string[] = [],
): string {
  const value = answer(payload, answerKey, ...aliases) || profileAnswer(payload, ...profileKeys);
  if (!value) missing.push(`answers.${answerKey}`);
  return value;
}

function normalizeDate(value: string, key: string, missing: string[]): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    missing.push(`answers.${key}(YYYY-MM-DD)`);
    return value;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    missing.push(`answers.${key}(valid_date)`);
  }
  return value;
}

function dateFromCandidates(payload: SubmissionPayload, key: string, aliases: string[], missing: string[]): string {
  return normalizeDate(requireAnswer(payload, key, missing, aliases), key, missing);
}

function splitProfileFullName(fullName: string): { surname: string; givenName: string } {
  const parts = fullName.trim().split(/\s+/u).filter(Boolean);
  if (parts.length < 2) return { surname: parts[0] ?? "", givenName: "" };
  return { surname: parts[0] ?? "", givenName: parts.slice(1).join(" ") };
}

function requiredMode(value: string, key: string, missing: string[]): KrEArrivalTravelMode {
  const normalized = value.trim().toLowerCase();
  if (normalized === "air" || normalized === "a" || normalized === "flight") return "air";
  if (normalized === "sea" || normalized === "s" || normalized === "ship" || normalized === "boat") return "sea";
  missing.push(`answers.${key}(air|sea)`);
  return "air";
}

function optionalAnswer(payload: SubmissionPayload, ...keys: string[]): string | null {
  return answer(payload, ...keys) || null;
}

function ensureCode(
  value: string,
  key: string,
  missing: string[],
  resolver: (candidate: string) => string | null,
): string {
  const code = resolver(value);
  if (!code) missing.push(`answers.${key}(official_code_or_label)`);
  return code ?? value;
}

function requireEmail(payload: SubmissionPayload, missing: string[]): string {
  // The government portal must receive only the VIZA-managed inbox alias.
  // Applicant/profile email remains a notification destination and must never
  // become an implicit official-form fallback.
  const email = answer(payload, "alias_email_address");
  if (!email) {
    missing.push("answers.alias_email_address");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    missing.push("answers.alias_email_address(valid_email)");
  }
  return email.toLowerCase();
}

function requireConfirmedDeclaration(payload: SubmissionPayload, missing: string[]): void {
  const raw: unknown = payload.countrySpecific.declaration_confirmed;
  const confirmed = raw === true
    || (typeof raw === "string" && raw.trim().toLowerCase() === "true");
  if (!confirmed) missing.push("answers.declaration_confirmed(true)");
}

/**
 * Convert canonical VIZA answers into the exact fields used by the official
 * Korea e-Arrival Card page.  This function deliberately rejects a wrong
 * country/package and unknown option codes before a browser is opened.
 */
export function normalizeKrEArrivalPortalPayload(payload: SubmissionPayload): KrEArrivalPortalPayload {
  const missing: string[] = [];
  if (payload.countryCode !== "KR") missing.push("countryCode");
  if (payload.visaType !== "KR_E_ARRIVAL_CARD") missing.push("visaType");

  const fullName = profileAnswer(payload, "fullName");
  const splitName = splitProfileFullName(fullName);
  const explicitSurname = answer(payload, "surname", "family_name", "last_name", "ps_fmnm");
  const explicitGivenName = answer(payload, "given_name", "first_name", "ps_gvnm");
  const surname = explicitSurname || splitName.surname;
  const resolvedGivenName = explicitGivenName || splitName.givenName;
  if (!surname) missing.push("answers.surname");
  if (!resolvedGivenName) missing.push("answers.given_name");

  const dateOfBirth = dateFromCandidates(payload, "date_of_birth", ["birth_date", "btd"], missing);
  const passportExpiryDate = dateFromCandidates(
    payload,
    "passport_expiry_date",
    ["passport_expiry", "ps_expr_ymd"],
    missing,
  );
  const arrivalDate = dateFromCandidates(payload, "arrival_date", ["expected_arrival_date", "ent_prr_ymd"], missing);
  const departureDate = dateFromCandidates(payload, "departure_date", ["dep_prr_ymd"], missing);

  const gender = ensureCode(
    requireProfileOrAnswer(payload, "gender", ["gender"], missing, ["sex", "sd_cd"]),
    "gender",
    missing,
    officialGenderCode,
  ) as KrEArrivalPortalPayload["gender"];
  const purposeCode = ensureCode(
    requireAnswer(payload, "purpose_code", missing, ["purpose_of_entry", "purpose_of_visit", "ent_purp_cd"]),
    "purpose_code",
    missing,
    officialPurposeCode,
  );
  const occupationCode = ensureCode(
    requireAnswer(payload, "occupation_code", missing, ["occupation", "occp_cd"]),
    "occupation_code",
    missing,
    officialOccupationCode,
  );

  const arrivalMode = requiredMode(
    requireAnswer(payload, "arrival_mode", missing, ["mode_of_arrival", "mode_of_travel", "ent_tr_mn_nm"]),
    "arrival_mode",
    missing,
  );
  const departureMode = requiredMode(
    requireAnswer(payload, "departure_mode", missing, ["mode_of_departure", "dep_tr_mn_nm"]),
    "departure_mode",
    missing,
  );
  const arrivalFlightNumber = arrivalMode === "air"
    ? requireAnswer(payload, "arrival_flight_number", missing, ["flight_number", "arrival_flight_or_ship", "ent_cno_nm"])
    : null;
  const arrivalShipName = arrivalMode === "sea"
    ? requireAnswer(payload, "arrival_ship_name", missing, ["ship_name", "arrival_flight_or_ship", "ent_ship_nm"])
    : null;
  const departureFlightNumber = departureMode === "air"
    ? optionalAnswer(payload, "departure_flight_number", "departure_flight_or_ship", "dep_cno_nm")
    : null;
  const departureShipName = departureMode === "sea"
    ? optionalAnswer(payload, "departure_ship_name", "departure_flight_or_ship", "dep_ship_nm")
    : null;

  const purposeOther = purposeCode === "99"
    ? requireAnswer(payload, "purpose_other", missing, ["purpose_other_detail", "ent_purp_cd_dir"])
    : optionalAnswer(payload, "purpose_other", "purpose_other_detail", "ent_purp_cd_dir");
  const occupationOther = occupationCode === "99"
    ? requireAnswer(payload, "occupation_other", missing, ["occupation_other_detail", "occp_cd_dir"])
    : optionalAnswer(payload, "occupation_other", "occupation_other_detail", "occp_cd_dir");
  requireConfirmedDeclaration(payload, missing);

  const suppliedAddressEnglish = optionalAnswer(payload, "address_english", "stay_address_english", "stay_address_en", "soj_prrpl_rnm_bs_eng_addr");
  const suppliedAddressKorean = optionalAnswer(payload, "address_korean", "stay_address_korean", "stay_address_ko", "soj_prrpl_rnm_bs_han_addr");
  if (!suppliedAddressEnglish && !suppliedAddressKorean) missing.push("answers.stay_address(english_or_korean)");
  // The current VIZA schema collects a single address in either language and
  // does not require a separate detail line.  The official page accepts the
  // same canonical stay address in both language controls; a future schema
  // can provide distinct values without changing the runner contract.
  const addressEnglish = suppliedAddressEnglish ?? suppliedAddressKorean ?? "";
  const addressKorean = suppliedAddressKorean ?? suppliedAddressEnglish ?? "";
  const addressDetail = optionalAnswer(payload, "address_detail", "stay_address_detail", "soj_prrpl_rnm_det_addr") ?? "";
  const postalCode = requireAnswer(payload, "postal_code", missing, ["stay_postal_code", "zip"]);
  const koreaContactNumber = requireAnswer(payload, "korea_contact_number", missing, ["contact_number", "stay_contact_phone", "soj_prrar_tel"]);
  if (postalCode && !/^\d{5}$/u.test(postalCode)) missing.push("answers.postal_code(5_digits)");

  const additionalAnswers = Object.fromEntries(
    Object.entries(payload.countrySpecific)
      .filter(([key, value]) => key.startsWith("official_") && text(value))
      .map(([key, value]) => [key.slice("official_".length), text(value)]),
  );
  if (Object.keys(additionalAnswers).some((key) => !isOfficialAdditionalQuestionKey(key))) {
    missing.push("answers.official_additional_questions(versioned_snapshot)");
  }

  const normalized: KrEArrivalPortalPayload = {
    applicationId: payload.applicationId,
    surname,
    givenName: resolvedGivenName,
    dateOfBirth,
    nationality: requireProfileOrAnswer(payload, "nationality", ["nationality"], missing, ["nat_cd"]),
    gender,
    passportNumber: requireProfileOrAnswer(payload, "passport_number", ["passportNumber"], missing, ["ps_no"]),
    passportExpiryDate,
    arrivalMode,
    arrivalDate,
    arrivalFlightNumber,
    arrivalShipName,
    previousDepartureCountry: optionalAnswer(payload, "previous_departure_country", "departure_country_before_arrival", "befr_strp_nat_nm", "ent_strp_nat_nm"),
    previousDepartureCity: optionalAnswer(payload, "previous_departure_city", "befr_str_area_nm", "ent_str_apt"),
    departureMode,
    departureDate,
    departureFlightNumber,
    departureShipName,
    nextDestinationCountry: optionalAnswer(payload, "next_destination_country", "nxt_arvlp_nat_nm", "dep_strp_nat_nm"),
    nextDestinationCity: optionalAnswer(payload, "next_destination_city", "next_destination", "nxt_arvl_area_nm", "dep_str_apt"),
    purposeCode,
    purposeOther,
    addressKorean,
    addressEnglish,
    addressDetail,
    postalCode,
    koreaContactNumber,
    occupationCode,
    occupationOther,
    emailAddress: requireEmail(payload, missing),
    dodIdNumber: optionalAnswer(payload, "dod_id_number", "idcd_no"),
    additionalAnswers,
  };

  if (passportExpiryDate && arrivalDate && passportExpiryDate < arrivalDate) {
    missing.push("answers.passport_expiry_date(after_arrival)");
  }
  if (missing.length > 0) {
    throw new KrEArrivalPortalValidationError(
      `Korea e-Arrival Card cannot be submitted because required fields are missing or unsupported: ${missing.join(", ")}.`,
      Array.from(new Set(missing)),
    );
  }
  return normalized;
}
