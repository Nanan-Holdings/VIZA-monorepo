import {
  DS160_EXTENDED_DERIVATION_TARGETS,
  deriveDs160ExtendedAnswers,
  parseDs160DateForPrecision,
} from "./ds160-extended-derivations";
import { normalizeDs160CountryValue } from "./ds160-nationality-gate";

export interface Ds160AnswerRow {
  field_name: string;
  value_text: string | null;
  value_json: unknown;
}

/**
 * Materialize stored DS-160 rows without treating an explicit empty answer as
 * missing. Callers use key presence to distinguish an intentional clear from
 * an absent answer, so profile fallback and alias derivation can respect it.
 */
export function buildDs160AnswerMap(
  rows: ReadonlyArray<Ds160AnswerRow>,
): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const row of rows) {
    const value = row.value_json != null ? String(row.value_json) : row.value_text;
    if (value !== null && value !== undefined) answers[row.field_name] = value;
  }
  return answers;
}

/**
 * DS-160 Answer Derivation
 *
 * Bridges the gap between the field_name namespace produced by the
 * /client/application form (driven by seed-ds160-form-fields.ts) and the
 * field_name namespace expected by the CEAC autofill orchestrator
 * (ds160-form-mappings.ts).
 *
 * The orchestrator silently skips fields without a matching answer, so any
 * shape divergence drops user data on the floor. This module closes the
 * mechanical gaps via three deterministic transforms applied to the merged
 * answer set:
 *
 *   1. Date splits     — yyyy-mm-dd values exploded into _day/_month/_year
 *                        (orchestrator fills three CEAC dropdowns, not one
 *                        date input).
 *   2. NA flags        — when a form field stores "DOES_NOT_APPLY" or
 *                        "DO_NOT_KNOW", the companion *_na key is set to "Y".
 *   3. Key aliases     — form uses fuller names (home_address_state_province)
 *                        while orchestrator uses CEAC-shortened forms
 *                        (home_address_state). Aliased non-destructively.
 *
 * Derivation never overwrites an existing key — if the answer set already
 * contains a derived target, the existing value wins. This keeps the
 * function idempotent and safe to re-run.
 */

interface DateSplit {
  /** Source field whose value is parsed as a yyyy-mm-dd date. */
  source: string;
  /** Output prefix; produces `${prefix}_day`, `${prefix}_month`, `${prefix}_year`. */
  targetPrefix: string;
  /**
   * If true, month is emitted as a 3-letter uppercase abbreviation (JAN, FEB...)
   * — CEAC's dropdowns for date_of_birth/parent_dob expect this format.
   * Default: numeric two-digit ("01", "02"...).
   */
  monthAsAbbrev?: boolean;
}

const DATE_SPLITS: ReadonlyArray<DateSplit> = [
  { source: "date_of_birth", targetPrefix: "date_of_birth", monthAsAbbrev: true },
  { source: "passport_issuance_date", targetPrefix: "passport_issue" },
  { source: "passport_expiration_date", targetPrefix: "passport_expiry" },
  { source: "employment_start_date", targetPrefix: "employment_start_date", monthAsAbbrev: true },
  { source: "father_date_of_birth", targetPrefix: "father_dob", monthAsAbbrev: true },
  { source: "mother_date_of_birth", targetPrefix: "mother_dob", monthAsAbbrev: true },
  { source: "spouse_date_of_birth", targetPrefix: "spouse_date_of_birth", monthAsAbbrev: true },
  // CEAC date dropdown values use three-letter month codes (JAN, FEB...),
  // including the Travel Information page. The active arrival source is
  // reconciled by deriveIntendedArrivalDate before these splits run.
  { source: "arrival_date", targetPrefix: "arrival_date", monthAsAbbrev: true },
  { source: "intended_arrival_date", targetPrefix: "intended_arrival_date", monthAsAbbrev: true },
  { source: "departure_date", targetPrefix: "departure_date", monthAsAbbrev: true },
];

interface NaPair {
  /** Form field whose value, when "DOES_NOT_APPLY"/"DO_NOT_KNOW", flips the flag. */
  source: string;
  /** Companion field that orchestrator reads ("Y" when source is NA). */
  naKey: string;
}

const NA_PAIRS: ReadonlyArray<NaPair> = [
  { source: "national_id_number", naKey: "national_id_number_na" },
  { source: "us_social_security_number", naKey: "us_social_security_number_na" },
  { source: "us_taxpayer_id", naKey: "us_taxpayer_id_na" },
  { source: "us_contact_organization", naKey: "us_contact_organization_na" },
  { source: "us_contact_email", naKey: "us_contact_email_na" },
  { source: "passport_book_number", naKey: "passport_book_number_na" },
  { source: "passport_expiration_date", naKey: "passport_expiry_na" },
  { source: "home_address_state_province", naKey: "home_address_state_na" },
  { source: "home_address_state", naKey: "home_address_state_na" },
  { source: "home_address_postal_code", naKey: "home_address_postal_na" },
  { source: "home_address_postal", naKey: "home_address_postal_na" },
  { source: "employer_state_province", naKey: "employer_address_state_na" },
  { source: "employer_address_state", naKey: "employer_address_state_na" },
  { source: "employer_postal_code", naKey: "employer_address_postal_na" },
  { source: "employer_address_postal", naKey: "employer_address_postal_na" },
  { source: "education_state_province", naKey: "education_address_state_na" },
  { source: "education_postal_code", naKey: "education_address_postal_na" },
  { source: "monthly_salary", naKey: "monthly_income_na" },
  { source: "monthly_income", naKey: "monthly_income_na" },
  { source: "mobile_phone", naKey: "mobile_phone_na" },
  { source: "work_phone", naKey: "work_phone_na" },
  { source: "secondary_phone", naKey: "secondary_phone_na" },
  { source: "full_name_native_alphabet", naKey: "full_name_native_alphabet_na" },
  { source: "state_of_birth", naKey: "state_of_birth_na" },
  // Live CEAC controls for conditional travel/address branches.  These keys
  // are applicant-facing values; CEAC expects the companion checkbox instead
  // of the literal DOES_NOT_APPLY/DO_NOT_KNOW token in the text input.
  { source: "payer_email", naKey: "payer_email_na" },
  { source: "payer_address_state", naKey: "payer_address_state_na" },
  { source: "payer_address_postal", naKey: "payer_address_postal_na" },
  { source: "payer_org_address_state", naKey: "payer_org_address_state_na" },
  { source: "payer_org_address_postal", naKey: "payer_org_address_postal_na" },
  { source: "mailing_address_state", naKey: "mailing_address_state_na" },
  { source: "mailing_address_postal", naKey: "mailing_address_postal_na" },
  { source: "us_drivers_license_number", naKey: "us_drivers_license_number_unknown" },
  { source: "visa_number", naKey: "visa_number_unknown" },
  { source: "lost_passport_number", naKey: "lost_passport_number_unknown" },
  { source: "spouse_city_of_birth", naKey: "spouse_city_of_birth_na" },
  { source: "spouse_address_state", naKey: "spouse_address_state_na" },
  { source: "spouse_address_zip", naKey: "spouse_address_zip_na" },
  { source: "partner_city_of_birth", naKey: "partner_city_of_birth_na" },
  { source: "partner_address_state", naKey: "partner_address_state_na" },
  { source: "partner_address_zip", naKey: "partner_address_zip_na" },
  { source: "deceased_spouse_city_of_birth", naKey: "deceased_spouse_city_of_birth_unknown" },
  { source: "former_spouse_city_of_birth", naKey: "former_spouse_city_of_birth_unknown" },
  { source: "prev_employer_state", naKey: "prev_employer_state_na" },
  { source: "prev_employer_postal", naKey: "prev_employer_postal_na" },
  { source: "prev_supervisor_surname", naKey: "prev_supervisor_surname_unknown" },
  { source: "prev_supervisor_given_names", naKey: "prev_supervisor_given_names_unknown" },
  // Parent-relative "unknown" flags. CEAC names these *_unknown rather than
  // *_na but the trigger is identical — a "Do Not Know" checkbox on the
  // form sets the source value to DO_NOT_KNOW.
  { source: "father_surname", naKey: "father_surname_unknown" },
  { source: "father_given_names", naKey: "father_given_names_unknown" },
  { source: "father_date_of_birth", naKey: "father_dob_unknown" },
  { source: "mother_surname", naKey: "mother_surname_unknown" },
  { source: "mother_given_names", naKey: "mother_given_names_unknown" },
  { source: "mother_date_of_birth", naKey: "mother_dob_unknown" },
];

const CLEAR_NA_TEXT_FIELDS: ReadonlySet<string> = new Set([
  "passport_issuance_state",
]);

interface KeyAlias {
  /** Form key. */
  from: string;
  /** Orchestrator key. */
  to: string;
}

const KEY_ALIASES: ReadonlyArray<KeyAlias> = [
  { from: "other_names_used", to: "has_other_names" },
  { from: "has_specific_plans", to: "has_specific_travel_plans" },
  { from: "has_other_phones", to: "has_other_phone" },
  { from: "has_other_emails", to: "has_other_email" },
  { from: "lost_passport", to: "passport_lost_or_stolen" },
  { from: "has_attended_education", to: "has_other_education" },
  { from: "has_traveled_last_five_years", to: "has_countries_visited" },
  { from: "has_belonged_to_organization", to: "has_organization" },
  { from: "has_served_paramilitary", to: "has_served_insurgent" },
  { from: "trip_payer_type", to: "who_is_paying" },
  { from: "employer_city", to: "employer_address_city" },
  { from: "employer_country", to: "employer_address_country" },
  { from: "employer_postal_code", to: "employer_address_postal" },
  { from: "employer_state_province", to: "employer_address_state" },
  { from: "monthly_salary", to: "monthly_income" },
  { from: "home_address_state_province", to: "home_address_state" },
  { from: "home_address_postal_code", to: "home_address_postal" },
  { from: "us_address_street1", to: "us_address_street" },
  { from: "intended_length_of_stay_value", to: "intended_length_of_stay" },
  { from: "social_media_platform", to: "social_media_provider" },
  { from: "social_media_handle", to: "social_media_identifier" },
  // Travel page asks one question ("who is paying for your trip?"); the
  // orchestrator binds it to two CEAC selectors that point at the same
  // dropdown (one historical, one current). Populate both from the single
  // form field so either selector path resolves.
  { from: "who_is_paying", to: "travel_payer" },
];

const CEAC_COUNTRY_CODES: Readonly<Record<string, string>> = {
  ASTL: "ASTL",
  AU: "ASTL",
  AUS: "ASTL",
  AUSTRALIA: "ASTL",
  CAN: "CAN",
  CA: "CAN",
  CANADA: "CAN",
  CHIN: "CHIN",
  CN: "CHIN",
  CHN: "CHIN",
  CHINA: "CHIN",
  "PEOPLE'S REPUBLIC OF CHINA": "CHIN",
  EGYP: "EGYP",
  EG: "EGYP",
  EGY: "EGYP",
  EGYPT: "EGYP",
  FRAN: "FRAN",
  FR: "FRAN",
  FRA: "FRAN",
  FRANCE: "FRAN",
  GRBR: "GRBR",
  GB: "GRBR",
  GBR: "GRBR",
  UK: "GRBR",
  "UNITED KINGDOM": "GRBR",
  "UNITED KINGDOM OF GREAT BRITAIN AND NORTHERN IRELAND": "GRBR",
  IND: "IND",
  IN: "IND",
  INDIA: "IND",
  JPN: "JPN",
  JP: "JPN",
  JAPAN: "JPN",
  KOR: "KOR",
  KR: "KOR",
  KOREA: "KOR",
  "SOUTH KOREA": "KOR",
  "KOREA, REPUBLIC OF": "KOR",
  "KOREA, REPUBLIC OF (SOUTH)": "KOR",
  SING: "SING",
  SG: "SING",
  SGP: "SING",
  SINGAPORE: "SING",
  SRL: "SRL",
  LK: "SRL",
  LKA: "SRL",
  "SRI LANKA": "SRL",
  USA: "USA",
  US: "USA",
  "UNITED STATES": "USA",
  "UNITED STATES OF AMERICA": "USA",
  VTNM: "VTNM",
  VN: "VTNM",
  VNM: "VTNM",
  VIETNAM: "VTNM",
  "VIET NAM": "VTNM",
};

const FIELD_VALUE_CODES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  sex: { male: "M", female: "F", m: "M", f: "F" },
  marital_status: {
    married: "M",
    common_law: "C",
    civil_union: "P",
    single: "S",
    widowed: "W",
    divorced: "D",
    legally_separated: "L",
    other: "O",
  },
  purpose_of_trip_specify: {
    "B1/B2": "B1-B2",
  },
  intended_length_of_stay_unit: {
    "YEAR(S)": "Y",
    YEARS: "Y",
    YEAR: "Y",
    "MONTH(S)": "M",
    MONTHS: "M",
    MONTH: "M",
    "WEEK(S)": "W",
    WEEKS: "W",
    WEEK: "W",
    "DAY(S)": "D",
    DAYS: "D",
    DAY: "D",
    LESS_THAN_24_HOURS: "H",
    "LESS THAN 24 HOURS": "H",
  },
  who_is_paying: {
    self: "S",
    other_person: "O",
    present_employer: "P",
    employer_in_us: "U",
    other_company: "C",
  },
  travel_payer: {
    self: "S",
    other_person: "O",
    present_employer: "P",
    employer_in_us: "U",
    other_company: "C",
  },
};

const NA_VALUE_TOKENS: ReadonlySet<string> = new Set([
  "DOES_NOT_APPLY",
  "does_not_apply",
  "DOES NOT APPLY",
  "DO_NOT_KNOW",
  "do_not_know",
  "DO NOT KNOW",
  "N/A",
]);

const HAS_CJK = /[\u3400-\u4DBF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/;

const CEAC_TEXT_TRANSLITERATIONS: Readonly<Record<string, string>> = {
  北京: "BEIJING",
  上海: "SHANGHAI",
  广州: "GUANGZHOU",
  深圳: "SHENZHEN",
  长沙: "CHANGSHA",
  湖南: "HUNAN",
};

const CEAC_CITY_TEXT_KEYS: ReadonlySet<string> = new Set([
  "home_address_city",
  "mailing_address_city",
  "employer_address_city",
  "passport_issuance_city",
  "city_of_birth",
  "place_of_birth_city",
  "us_contact_city",
  "spouse_city_of_birth",
]);

const MONTH_ABBREVS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

function isNaToken(value: string | undefined): boolean {
  if (!value) return false;
  return NA_VALUE_TOKENS.has(value.trim());
}

function isDoNotKnowToken(value: string): boolean {
  return value.trim().replace(/\s+/g, "_").toUpperCase() === "DO_NOT_KNOW";
}

function parseIsoDate(value: string): { day: string; month: number; year: string } | null {
  // Accept yyyy-mm-dd, yyyy/mm/dd, or anything Date.parse() understands.
  // The form uses a DatePicker that emits yyyy-mm-dd; this branch is the
  // common path. Fall back to Date construction for robustness.
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const monthNum = Number(m);
    if (monthNum < 1 || monthNum > 12) return null;
    return { day: d, month: monthNum, year: y };
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return {
    day: String(d.getUTCDate()).padStart(2, "0"),
    month: d.getUTCMonth() + 1,
    year: String(d.getUTCFullYear()),
  };
}

function datePrecisionForSource(source: string): "full" | "month" | "year" {
  if (source === "intended_arrival_date") return "month";
  if (
    source === "father_date_of_birth" ||
    source === "mother_date_of_birth" ||
    source === "spouse_date_of_birth" ||
    source === "partner_date_of_birth" ||
    source === "deceased_spouse_date_of_birth" ||
    source === "former_spouse_date_of_birth" ||
    source === "employment_start_date" ||
    source === "previous_visit_date_arrived" ||
    source === "prev_employment_start_date" ||
    source === "prev_employment_end_date"
  ) return "year";
  if (
    source === "education_start_date" ||
    source === "education_end_date" ||
    source === "military_date_from" ||
    source === "military_date_to"
  ) return "month";
  return "full";
}

/** Return saved DS-160 date fields that do not match their live precision. */
export function findInvalidDs160DateAnswers(
  answers: Readonly<Record<string, string>>,
): string[] {
  const invalid = new Set<string>();
  for (const [key, value] of Object.entries(answers)) {
    if (!value.trim()) continue;
    const base = key.replace(/__\d+$/, "");
    const precision = [
      "intended_arrival_date",
      "previous_visit_date_arrived",
      "father_date_of_birth",
      "mother_date_of_birth",
      "spouse_date_of_birth",
      "partner_date_of_birth",
      "deceased_spouse_date_of_birth",
      "former_spouse_date_of_birth",
      "employment_start_date",
      "prev_employment_start_date",
      "prev_employment_end_date",
      "education_start_date",
      "education_end_date",
      "military_date_from",
      "military_date_to",
    ].includes(base)
      ? datePrecisionForSource(base)
      : null;
    if ((base === "father_date_of_birth" || base === "mother_date_of_birth") && isDoNotKnowToken(value)) continue;
    if (precision && !parseDs160DateForPrecision(value, precision)) invalid.add(key);
  }
  return [...invalid];
}

function deriveDateSplits(answers: Record<string, string>): void {
  for (const { source, targetPrefix, monthAsAbbrev } of DATE_SPLITS) {
    const raw = answers[source];
    if (!raw || isNaToken(raw)) continue;
    const precision = datePrecisionForSource(source);
    const parts = precision === "full"
      ? parseIsoDate(raw)
      : parseDs160DateForPrecision(raw, precision);
    if (!parts) continue;
    const dayKey = `${targetPrefix}_day`;
    const monthKey = `${targetPrefix}_month`;
    const yearKey = `${targetPrefix}_year`;
    if (parts.day !== undefined && answers[dayKey] === undefined) answers[dayKey] = parts.day;
    if (parts.month !== undefined && answers[monthKey] === undefined) {
      answers[monthKey] = monthAsAbbrev
        ? MONTH_ABBREVS[parts.month - 1]
        : String(parts.month).padStart(2, "0");
    }
    if (answers[yearKey] === undefined) answers[yearKey] = parts.year;
  }
}

function deriveNaFlags(answers: Record<string, string>): void {
  for (const key of CLEAR_NA_TEXT_FIELDS) {
    if (isNaToken(answers[key])) delete answers[key];
  }

  for (const { source, naKey } of NA_PAIRS) {
    for (const sourceKey of Object.keys(answers)) {
      const suffix = repeatSuffixForKey(sourceKey, source);
      if (suffix === null) continue;

      const value = answers[sourceKey];
      if (!isNaToken(value)) continue;
      const targetKey = `${naKey}${suffix}`;
      if (answers[targetKey] === undefined) answers[targetKey] = "Y";
      // Clear the source so the orchestrator doesn't try to type
      // "DOES_NOT_APPLY"/"DO_NOT_KNOW" into the underlying CEAC text field.
      // The companion checkbox handles disabling the input on CEAC's side.
      delete answers[sourceKey];
    }
  }
}

/**
 * Return the storage suffix for a canonical key or a repeat-row key.
 * Repeat rows use the persisted `__2`, `__3`, ... convention; a similarly
 * named field with another suffix must not be treated as a row accidentally.
 */
function repeatSuffixForKey(key: string, base: string): string | null {
  if (key === base) return "";
  if (!key.startsWith(`${base}__`)) return null;
  const suffix = key.slice(base.length);
  return /^__\d+$/.test(suffix) ? suffix : null;
}

function applyAliases(answers: Record<string, string>): void {
  for (const { from, to } of KEY_ALIASES) {
    const value = answers[from];
    if (value === undefined) continue;
    // An explicit empty source clears a stale derived target. For non-empty
    // sources, preserve the historical target-first compatibility behavior.
    if (value === "" || answers[to] === undefined) answers[to] = value;
  }
}

function applyEnglishAliases(answers: Record<string, string>): void {
  for (const [key, value] of Object.entries(answers)) {
    if (!key.endsWith("_en")) continue;
    const baseKey = key.slice(0, -3);
    if (!baseKey || !value.trim()) continue;
    // CEAC explicitly asks for this answer in the applicant's native script.
    // A translated review alias must never replace the supplied name.
    if (baseKey === "full_name_native_alphabet") continue;

    const current = answers[baseKey];
    // An explicitly cleared canonical answer is authoritative. Only a missing
    // key or an existing native-script value may use the English alias.
    if (current === undefined || HAS_CJK.test(current)) {
      answers[baseKey] = value;
    }
  }
}

function normalizedLookupKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function normalizeCountryValue(value: string): string {
  const normalized = normalizeDs160CountryValue(value);
  return normalized === value
    ? CEAC_COUNTRY_CODES[normalizedLookupKey(value)] ?? value
    : normalized;
}

function shouldNormalizeCountryKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return normalized.includes("country") || normalized.endsWith("_nationality") || normalized === "nationality";
}

function shouldNormalizeBooleanKey(key: string): boolean {
  const normalized = key.toLowerCase();
  // `other_nationality_country` and its repeat rows are country values, while
  // `other_nationality` is the yes/no controller.  Likewise the
  // permanent-resident controller contains "country" in its historical key.
  if (normalized.includes("country") && normalized !== "permanent_resident_other_country") {
    return false;
  }
  return /^(has_|is_|intend_|vwp_|immigrant_|mailing_same_as_home|passport_has_|passport_lost_or_stolen|other_nationality|permanent_resident_other_country|father_in_us|mother_in_us)/.test(normalized);
}

function normalizeCeacValueCodes(answers: Record<string, string>): void {
  for (const [key, value] of Object.entries(answers)) {
    const trimmed = value.trim();
    if (!trimmed) continue;

    const fieldMap = FIELD_VALUE_CODES[key];
    if (fieldMap) {
      answers[key] = fieldMap[trimmed] ?? fieldMap[normalizedLookupKey(trimmed)] ?? trimmed;
      continue;
    }

    if (shouldNormalizeBooleanKey(key)) {
      const normalized = trimmed.toLowerCase();
      if (normalized === "yes") answers[key] = "Y";
      if (normalized === "no") answers[key] = "N";
      continue;
    }

    if (shouldNormalizeCountryKey(key)) {
      answers[key] = normalizeCountryValue(trimmed);
    }
  }
}

function normalizeCeacTextFields(answers: Record<string, string>): void {
  for (const key of CEAC_CITY_TEXT_KEYS) {
    const value = answers[key]?.trim();
    if (!value || !HAS_CJK.test(value)) continue;
    const transliterated = CEAC_TEXT_TRANSLITERATIONS[value];
    if (transliterated) answers[key] = transliterated;
  }
}

/**
 * Length of stay in days, derived from arrival_date + departure_date.
 * CEAC's travel page accepts a numeric value plus a unit dropdown; we set
 * the unit to "D" (days) since we always emit a day-count.
 */
function deriveLengthOfStay(answers: Record<string, string>): void {
  // The arrival/departure pair belongs to the specific-plans branch. When an
  // applicant selects "No", any persisted pair is inactive and must never be
  // used to replace the intended stay they supplied for that branch.
  if (answers.has_specific_travel_plans !== "Y") return;

  const arrival = answers.arrival_date;
  const departure = answers.departure_date;
  if (!arrival || !departure || isNaToken(arrival) || isNaToken(departure)) {
    delete answers.intended_length_of_stay;
    delete answers.intended_length_of_stay_value;
    delete answers.intended_length_of_stay_unit;
    return;
  }
  const a = parseIsoDate(arrival);
  const d = parseIsoDate(departure);
  if (!a || !d) {
    delete answers.intended_length_of_stay;
    delete answers.intended_length_of_stay_value;
    delete answers.intended_length_of_stay_unit;
    return;
  }
  const aMs = Date.UTC(Number(a.year), a.month - 1, Number(a.day));
  const dMs = Date.UTC(Number(d.year), d.month - 1, Number(d.day));
  const diffDays = Math.round((dMs - aMs) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) {
    delete answers.intended_length_of_stay;
    delete answers.intended_length_of_stay_value;
    delete answers.intended_length_of_stay_unit;
    return;
  }
  const stayValue = String(diffDays);
  answers.intended_length_of_stay_value = stayValue;
  answers.intended_length_of_stay = stayValue;
  answers.intended_length_of_stay_unit = "D";
}

/**
 * Copy arrival_date verbatim into intended_arrival_date — CEAC's travel page
 * has a hidden "intended arrival" full-date alias separate from the
 * day/month/year trio.
 */
function deriveIntendedArrivalDate(answers: Record<string, string>): void {
  const hasSpecificPlans = answers.has_specific_travel_plans;
  const arrival = answers.arrival_date;
  const intendedArrival = answers.intended_arrival_date;

  // Both conditional fields may remain persisted when an applicant changes
  // the "specific travel plans" answer. CEAC has only one active branch. Use
  // only that branch's source; never fill a missing active answer from the
  // other branch's stale value.
  const activeArrival = hasSpecificPlans === "N"
    ? intendedArrival
    : hasSpecificPlans === "Y"
      ? arrival
      : undefined;

  if (!activeArrival || isNaToken(activeArrival)) {
    if (hasSpecificPlans === "Y") {
      delete answers.intended_arrival_date;
      delete answers.intended_arrival_date_day;
      delete answers.intended_arrival_date_month;
      delete answers.intended_arrival_date_year;
    } else if (hasSpecificPlans === "N") {
      delete answers.intended_arrival_date_day;
      delete answers.intended_arrival_date_month;
      delete answers.intended_arrival_date_year;
    }
    return;
  }
  answers.intended_arrival_date = activeArrival;

  // Stored split fields can also be stale. Clear only the derived CEAC trio;
  // deriveDateSplits immediately rebuilds it from the active full date.
  delete answers.intended_arrival_date_day;
  delete answers.intended_arrival_date_month;
  delete answers.intended_arrival_date_year;
}

/**
 * Apply all DS-160 derivations in place. Returns the mutated reference for
 * call-site convenience. The function is idempotent: running it twice
 * produces the same result as running it once.
 */
export function deriveDS160Answers(
  answers: Record<string, string>,
): Record<string, string> {
  // Order matters: aliases first so date sources resolve to their canonical
  // keys, then CEAC value-code normalization, travel-branch reconciliation,
  // and finally date splits,
  // then NA flags (NA may delete source keys, so do it last to avoid losing
  // data needed by date-split source resolution).
  applyEnglishAliases(answers);
  applyAliases(answers);
  normalizeCeacValueCodes(answers);
  normalizeCeacTextFields(answers);
  derivePassportPageConsistency(answers);
  deriveIntendedArrivalDate(answers);
  deriveDateSplits(answers);
  deriveDs160ExtendedAnswers(answers);
  deriveLengthOfStay(answers);
  deriveContactPageConsistency(answers);
  deriveNaFlags(answers);
  return answers;
}

/**
 * Reconcile the applicant-facing "passport has an expiration date" answer
 * with CEAC's inverse "No Expiration / Does Not Apply" checkbox.
 *
 * A persisted expiration date is the strongest source of truth. This also
 * repairs older records that stored passport_has_expiry=N while retaining a
 * date, which would otherwise submit contradictory states to CEAC.
 */
function derivePassportPageConsistency(answers: Record<string, string>): void {
  const expirationDate = answers.passport_expiration_date?.trim();
  const hasExpirationDate = Boolean(
    expirationDate &&
    !isNaToken(expirationDate) &&
    parseIsoDate(expirationDate),
  );

  if (hasExpirationDate) {
    answers.passport_has_expiry = "Y";
    answers.passport_expiry_na = "N";
    return;
  }

  if (answers.passport_has_expiry === "N") {
    answers.passport_expiry_na = "Y";
    delete answers.passport_expiry_day;
    delete answers.passport_expiry_month;
    delete answers.passport_expiry_year;
    return;
  }

  if (answers.passport_has_expiry === "Y") {
    answers.passport_expiry_na = "N";
  }
}

function deriveContactPageConsistency(answers: Record<string, string>): void {
  deriveUsContactNameNa(answers);
  deriveSocialMediaPresence(answers);
  deriveDuplicatePhoneNaFlags(answers);
}

function deriveUsContactNameNa(answers: Record<string, string>): void {
  const surnameNa = isNaToken(answers.us_contact_surname);
  const givenNa = isNaToken(answers.us_contact_given_names);
  if (!surnameNa && !givenNa) return;
  answers.us_contact_name_na = "Y";
  if (surnameNa) delete answers.us_contact_surname;
  if (givenNa) delete answers.us_contact_given_names;
}

function deriveSocialMediaPresence(answers: Record<string, string>): void {
  const provider = answers.social_media_provider?.trim();
  const handle = answers.social_media_identifier?.trim();

  if (provider) {
    const normalizedProvider = provider.toUpperCase();
    answers.social_media_provider = normalizedProvider;
    if (answers.has_social_media === undefined) {
      answers.has_social_media = normalizedProvider === "NONE" ? "N" : "Y";
    }
    if (normalizedProvider === "NONE" && !handle) {
      delete answers.social_media_identifier;
    }
    return;
  }

  if (!handle && answers.has_social_media === "N" && answers.social_media_provider === undefined) {
    answers.social_media_provider = "NONE";
  }
}

function deriveDuplicatePhoneNaFlags(answers: Record<string, string>): void {
  const seen: string[] = [];
  const phoneFields: Array<{ key: string; naKey?: string }> = [
    { key: "primary_phone" },
    { key: "mobile_phone", naKey: "mobile_phone_na" },
    { key: "work_phone", naKey: "work_phone_na" },
    { key: "secondary_phone", naKey: "secondary_phone_na" },
  ];

  for (const { key, naKey } of phoneFields) {
    const value = answers[key];
    if (!value || isNaToken(value)) continue;
    const normalized = normalizePhoneForDuplicateCheck(value);
    if (!normalized) continue;
    if (seen.some((existing) => areDuplicatePhoneNumbers(existing, normalized))) {
      delete answers[key];
      if (naKey && answers[naKey] === undefined) answers[naKey] = "Y";
      continue;
    }
    seen.push(normalized);
  }
}

function normalizePhoneForDuplicateCheck(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 5 ? digits : null;
}

function areDuplicatePhoneNumbers(left: string, right: string): boolean {
  if (left === right) return true;
  const shortest = left.length <= right.length ? left : right;
  const longest = left.length > right.length ? left : right;
  return shortest.length >= 7 && longest.endsWith(shortest);
}

/**
 * Custom (non-table-driven) derivations: each entry declares the source
 * keys that must all be present and the additional keys produced. Exposed
 * for the parity audit; the runtime functions enforce the same contract.
 */
const CUSTOM_DERIVATIONS: ReadonlyArray<{ requires: string[]; produces: string[] }> = [
  { requires: ["arrival_date"], produces: ["intended_arrival_date"] },
  {
    requires: ["intended_arrival_date"],
    produces: [
      "intended_arrival_date_day",
      "intended_arrival_date_month",
      "intended_arrival_date_year",
    ],
  },
  { requires: ["intended_length_of_stay_value"], produces: ["intended_length_of_stay"] },
  {
    requires: ["arrival_date", "departure_date"],
    produces: [
      "intended_length_of_stay",
      "intended_length_of_stay_value",
      "intended_length_of_stay_unit",
    ],
  },
  // Either U.S. contact name field can carry the official "Do Not Know"
  // token, which derives the shared CEAC name checkbox.
  { requires: ["us_contact_surname"], produces: ["us_contact_name_na"] },
  { requires: ["us_contact_given_names"], produces: ["us_contact_name_na"] },
  // CEAC represents the passport expiration choice as the inverse checkbox;
  // either persisted source can establish that checkbox's state.
  { requires: ["passport_expiration_date"], produces: ["passport_expiry_na"] },
  { requires: ["passport_has_expiry"], produces: ["passport_expiry_na"] },
];

/** Exposed for the parity audit script to simulate post-derivation coverage. */
export const __DERIVATION_TARGETS = {
  dateSplits: [...DATE_SPLITS, ...DS160_EXTENDED_DERIVATION_TARGETS.dateSplits],
  naPairs: [...NA_PAIRS, ...DS160_EXTENDED_DERIVATION_TARGETS.naPairs],
  keyAliases: [...KEY_ALIASES, ...DS160_EXTENDED_DERIVATION_TARGETS.keyAliases],
  customDerivations: [...CUSTOM_DERIVATIONS, ...DS160_EXTENDED_DERIVATION_TARGETS.customDerivations],
};

/** Stable runtime name for consumers that need to trace derived inputs. */
export const DS160_DERIVATION_TARGETS = __DERIVATION_TARGETS;
