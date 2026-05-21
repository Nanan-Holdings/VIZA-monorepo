/**
 * Translate VIZA seed answer keys (`AU_VISITOR_600` schema) into the
 * shape required by the live ImmiAccount form. Handles:
 *
 * - Date format conversion (`YYYY-MM-DD` → `DD MMM YYYY`)
 * - Phone number digit-only normalisation
 * - Sex / stream / employment-status / length-of-stay enum mapping
 * - Country-conditional field type switches (PRC place-of-issue is a
 *   province dropdown, others are free text).
 *
 * Mirrors `france-visas/normalize.ts` and `ds160-normalize.ts` in
 * spirit. All field renames go through this layer rather than into
 * the seed schema, so historical answers stay portable.
 */

import { EMPLOYMENT_STATUS_MAP, LENGTH_OF_STAY_MAP, SEX_VALUE_MAP, STREAM_VALUE_MAP } from "./selectors";

export type AnswerMap = Record<string, string | number | boolean | null | undefined>;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** ISO `YYYY-MM-DD` (or `DD/MM/YYYY`) → `DD MMM YYYY` (live form display). */
export function formatAuDate(value: string | null | undefined): string {
  if (!value) return "";
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
  }
  const dmyMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
  }
  // Already `DD MMM YYYY` or some other shape — return as-is and let
  // the form reject it visibly.
  return value;
}

/** Strip everything except digits. ImmiAccount rejects spaces in phone fields. */
export function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D+/g, "");
}

/** Map a seed `sex` value to the live form's radio value (1/2/3). */
export function mapSex(value: string | null | undefined): string | null {
  if (!value) return null;
  return SEX_VALUE_MAP[value.toLowerCase()] ?? null;
}

/** Map a seed `stream` value to the live form's radio value. */
export function mapStream(value: string | null | undefined): string | null {
  if (!value) return null;
  return STREAM_VALUE_MAP[value.toLowerCase()] ?? null;
}

/** Map a seed `employment_status` value to the live form's enum. */
export function mapEmploymentStatus(value: string | null | undefined): string | null {
  if (!value) return null;
  return EMPLOYMENT_STATUS_MAP[value.toLowerCase()] ?? null;
}

/** Map a length-of-stay value (e.g. "3" months) to the live form's enum. */
export function mapLengthOfStay(months: number | string | null | undefined): string | null {
  if (months === null || months === undefined || months === "") return null;
  const n = typeof months === "number" ? months : Number(months);
  if (n <= 3) return LENGTH_OF_STAY_MAP["3_months"];
  if (n <= 6) return LENGTH_OF_STAY_MAP["6_months"];
  return LENGTH_OF_STAY_MAP["12_months"];
}

/**
 * eVisitor 651 + ETA 601 eligible nationalities. Submitting any of
 * these to Subclass 600's online form returns a server-side
 * "not eligible" rejection (verified 2026-04-27 with a Singapore
 * passport).
 */
export const NOT_SUBCLASS_600_ELIGIBLE: ReadonlySet<string> = new Set([
  // eVisitor (651): EU, UK, EEA, etc.
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IS", "IE", "IT", "LV", "LI", "LT", "LU", "MT", "MC", "NL", "NO", "PL", "PT",
  "RO", "SM", "SK", "SI", "ES", "SE", "CH", "GB", "VA",
  // ETA (601): subclass-eligible richer-passport set
  "BN", "CA", "JP", "KR", "MY", "SG", "US", "TW", "HK",
]);

/**
 * Returns true if the given ISO 3166 alpha-2 country code is rejected
 * by the Subclass 600 online form. Caller should catch this BEFORE
 * starting the application to avoid burning a session.
 */
export function isLikelyIneligibleForSubclass600(passportCountry: string | null | undefined): boolean {
  if (!passportCountry) return false;
  return NOT_SUBCLASS_600_ELIGIBLE.has(passportCountry.toUpperCase());
}

/**
 * Normalise the seed answer map into the live form's field map.
 * Only fields the orchestrator wants to fill are returned; the rest
 * are left to the orchestrator's "default-No" fallback.
 */
export function normalize(answers: AnswerMap): AnswerMap {
  const out: AnswerMap = {};
  const get = (k: string) => (answers[k] ?? null) as string | null;

  // Page 2: Application context
  out.stream = mapStream(get("stream"));
  out.applying_outside_australia = get("applying_outside_australia");
  out.applying_all_outside_australia = get("applying_all_outside_australia");
  out.current_location_country = get("current_location_country");
  out.current_location_legal_status = get("current_location_legal_status");
  out.purpose_of_stay_initial = get("purpose_of_stay_initial");
  out.significant_dates_in_australia = get("significant_dates_in_australia");

  // Page 3: Primary applicant
  out.family_name = get("family_name");
  out.given_names = get("given_names");
  out.sex = mapSex(get("sex"));
  out.date_of_birth = formatAuDate(get("date_of_birth"));
  out.passport_number = get("passport_number");
  out.passport_country_of_issue = get("passport_country_of_issue");
  out.passport_nationality = get("passport_nationality") ?? get("country_of_nationality");
  out.passport_date_of_issue = formatAuDate(get("passport_date_of_issue"));
  out.passport_date_of_expiry = formatAuDate(get("passport_date_of_expiry"));
  out.passport_place_of_issue = get("passport_place_of_issue");
  out.passport_issuing_authority = get("passport_issuing_authority");
  out.has_national_id = get("has_national_id");
  out.national_id_reason_for_not_providing = get("national_id_reason_for_not_providing")
    ?? "No national ID card held.";
  out.has_pacific_australia_card = get("has_pacific_australia_card") ?? "no";
  out.country_of_birth = get("country_of_birth");
  out.town_of_birth = get("town_of_birth");
  out.state_or_province_of_birth = get("state_or_province_of_birth");
  out.relationship_status = get("relationship_status");

  // Page 6: Contact details
  out.country_of_residence = get("country_of_residence");
  out.residential_address_line_1 = get("residential_address_line_1");
  out.residential_address_line_2 = get("residential_address_line_2");
  out.residential_address_suburb = get("residential_address_suburb");
  out.residential_address_state = get("residential_address_state");
  out.residential_address_postcode = get("residential_address_postcode");
  out.residential_address_country = get("residential_address_country");
  out.phone_number_home = digitsOnly(get("phone_number_home"));
  out.phone_number_business = digitsOnly(get("phone_number_business"));
  out.phone_number_mobile = digitsOnly(get("phone_number") || get("phone_number_mobile"));
  out.email_address = get("email_address");

  // Page 9: Entry to Australia
  out.length_of_stay = mapLengthOfStay(get("intended_length_of_stay_months"));
  out.intended_arrival_date = formatAuDate(get("intended_arrival_date"));
  out.intended_departure_date = formatAuDate(get("intended_departure_date"));

  // Page 11: Employment
  out.employment_status = mapEmploymentStatus(get("current_employment_status"));

  // Page 12: Financial support — funding source narrowed to live's 4
  // values. Anything beyond Self funded / employer / organisation /
  // person → fall back to Self funded with a description note.
  out.funding_source = mapFundingSource(get("funding_source"));
  out.funds_available_description = composeFundsDescription(answers);

  return out;
}

function mapFundingSource(value: string | null): string | null {
  if (!value) return null;
  switch (value.toLowerCase()) {
    case "self":
    case "self_funded":
      return "Self funded";
    case "employer":
      return "Supported by current overseas employer";
    case "australian_sponsor":
    case "tour_operator":
    case "scholarship_grant":
      return "Supported by other organisation";
    case "family":
      return "Supported by other person";
    default:
      return "Self funded";
  }
}

function composeFundsDescription(answers: AnswerMap): string {
  const amount = answers["funds_available_amount"];
  const currency = answers["funds_currency"];
  const funder = answers["funder_full_name"];
  const relation = answers["funder_relationship"];
  const lines: string[] = [];
  if (amount && currency) lines.push(`Funds available: ${currency} ${amount}.`);
  if (funder && relation) lines.push(`Supported by ${funder} (${relation}).`);
  return lines.join(" ").slice(0, 500) || "Self-funded; personal savings cover all trip expenses.";
}
