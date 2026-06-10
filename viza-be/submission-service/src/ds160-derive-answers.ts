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
  { source: "father_date_of_birth", targetPrefix: "father_dob", monthAsAbbrev: true },
  { source: "mother_date_of_birth", targetPrefix: "mother_dob", monthAsAbbrev: true },
  // Travel dates: arrival is split twice — CEAC's travel page exposes both
  // an "arrival" trio and an "intended arrival" trio, distinct repeaters.
  { source: "arrival_date", targetPrefix: "arrival_date" },
  { source: "arrival_date", targetPrefix: "intended_arrival_date" },
  { source: "intended_arrival_date", targetPrefix: "intended_arrival_date" },
  { source: "departure_date", targetPrefix: "departure_date" },
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
  { source: "passport_book_number", naKey: "passport_book_number_na" },
  { source: "home_address_state_province", naKey: "home_address_state_na" },
  { source: "home_address_postal_code", naKey: "home_address_postal_na" },
  { source: "mobile_phone", naKey: "mobile_phone_na" },
  { source: "work_phone", naKey: "work_phone_na" },
  { source: "secondary_phone", naKey: "secondary_phone_na" },
  { source: "full_name_native_alphabet", naKey: "full_name_native_alphabet_na" },
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

const DEFAULT_NA_SOURCES: ReadonlySet<string> = new Set([
  "us_social_security_number",
  "us_taxpayer_id",
]);

interface KeyAlias {
  /** Form key. */
  from: string;
  /** Orchestrator key. */
  to: string;
}

const KEY_ALIASES: ReadonlyArray<KeyAlias> = [
  { from: "trip_payer_type", to: "who_is_paying" },
  { from: "home_address_state_province", to: "home_address_state" },
  { from: "home_address_postal_code", to: "home_address_postal" },
  { from: "us_address_street1", to: "us_address_street" },
  { from: "intended_length_of_stay_value", to: "intended_length_of_stay" },
  { from: "us_contact_address_street1", to: "us_address_street" },
  { from: "us_contact_city", to: "us_address_city" },
  { from: "us_contact_state", to: "us_address_state" },
  { from: "us_contact_zip", to: "us_address_zip" },
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

const MONTH_ABBREVS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

function isNaToken(value: string | undefined): boolean {
  if (!value) return false;
  return NA_VALUE_TOKENS.has(value.trim());
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

function deriveDateSplits(answers: Record<string, string>): void {
  for (const { source, targetPrefix, monthAsAbbrev } of DATE_SPLITS) {
    const raw = answers[source];
    if (!raw || isNaToken(raw)) continue;
    const parts = parseIsoDate(raw);
    if (!parts) continue;
    const dayKey = `${targetPrefix}_day`;
    const monthKey = `${targetPrefix}_month`;
    const yearKey = `${targetPrefix}_year`;
    if (answers[dayKey] === undefined) answers[dayKey] = parts.day;
    if (answers[monthKey] === undefined) {
      answers[monthKey] = monthAsAbbrev
        ? MONTH_ABBREVS[parts.month - 1]
        : String(parts.month).padStart(2, "0");
    }
    if (answers[yearKey] === undefined) answers[yearKey] = parts.year;
  }
}

function deriveNaFlags(answers: Record<string, string>): void {
  for (const { source, naKey } of NA_PAIRS) {
    const value = answers[source];
    if (value === undefined && DEFAULT_NA_SOURCES.has(source) && answers[naKey] === undefined) {
      answers[naKey] = "Y";
      continue;
    }
    if (!isNaToken(value)) continue;
    if (answers[naKey] === undefined) answers[naKey] = "Y";
    // Clear the source so the orchestrator doesn't try to type "DOES_NOT_APPLY"
    // into the underlying CEAC text field. The NA checkbox handles disabling
    // the input on CEAC's side.
    delete answers[source];
  }
}

function applyAliases(answers: Record<string, string>): void {
  for (const { from, to } of KEY_ALIASES) {
    const value = answers[from];
    if (value === undefined) continue;
    if (answers[to] === undefined) answers[to] = value;
  }
}

function applyEnglishAliases(answers: Record<string, string>): void {
  for (const [key, value] of Object.entries(answers)) {
    if (!key.endsWith("_en")) continue;
    const baseKey = key.slice(0, -3);
    if (!baseKey || !value.trim()) continue;

    const current = answers[baseKey];
    if (!current || HAS_CJK.test(current)) {
      answers[baseKey] = value;
    }
  }
}

function normalizedLookupKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function normalizeCountryValue(value: string): string {
  return CEAC_COUNTRY_CODES[normalizedLookupKey(value)] ?? value;
}

function shouldNormalizeCountryKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return normalized.includes("country") || normalized.endsWith("_nationality") || normalized === "nationality";
}

function shouldNormalizeBooleanKey(key: string): boolean {
  return /^(has_|is_|intend_|vwp_|immigrant_|mailing_same_as_home|passport_has_|passport_lost_or_stolen|other_nationality|permanent_resident_other_country)/.test(key);
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

/**
 * Length of stay in days, derived from arrival_date + departure_date.
 * CEAC's travel page accepts a numeric value plus a unit dropdown; we set
 * the unit to "D" (days) since we always emit a day-count.
 */
function deriveLengthOfStay(answers: Record<string, string>): void {
  const arrival = answers.arrival_date;
  const departure = answers.departure_date;
  if (!arrival || !departure || isNaToken(arrival) || isNaToken(departure)) return;
  const a = parseIsoDate(arrival);
  const d = parseIsoDate(departure);
  if (!a || !d) return;
  const aMs = Date.UTC(Number(a.year), a.month - 1, Number(a.day));
  const dMs = Date.UTC(Number(d.year), d.month - 1, Number(d.day));
  const diffDays = Math.max(1, Math.round((dMs - aMs) / (1000 * 60 * 60 * 24)));
  const stayValue = String(diffDays);
  if (answers.intended_length_of_stay_value === undefined) {
    answers.intended_length_of_stay_value = stayValue;
  }
  if (answers.intended_length_of_stay === undefined) {
    answers.intended_length_of_stay = stayValue;
  }
  if (answers.intended_length_of_stay_unit === undefined) {
    answers.intended_length_of_stay_unit = "D";
  }
}

/**
 * Copy arrival_date verbatim into intended_arrival_date — CEAC's travel page
 * has a hidden "intended arrival" full-date alias separate from the
 * day/month/year trio.
 */
function deriveIntendedArrivalDate(answers: Record<string, string>): void {
  const arrival = answers.arrival_date;
  if (!arrival || isNaToken(arrival)) return;
  if (answers.intended_arrival_date === undefined) {
    answers.intended_arrival_date = arrival;
  }
}

/**
 * Apply all DS-160 derivations in place. Returns the mutated reference for
 * call-site convenience. The function is idempotent: running it twice
 * produces the same result as running it once.
 */
export function deriveDS160Answers(
  answers: Record<string, string>,
): Record<string, string> {
  // Order matters: aliases first so date-split sources resolve to their
  // canonical key, then CEAC value-code normalization, then date splits,
  // then NA flags (NA may delete source keys, so do it last to avoid losing
  // data needed by date-split source resolution).
  applyEnglishAliases(answers);
  applyAliases(answers);
  normalizeCeacValueCodes(answers);
  deriveDateSplits(answers);
  deriveIntendedArrivalDate(answers);
  deriveLengthOfStay(answers);
  deriveNaFlags(answers);
  return answers;
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
];

/** Exposed for the parity audit script to simulate post-derivation coverage. */
export const __DERIVATION_TARGETS = {
  dateSplits: DATE_SPLITS,
  naPairs: NA_PAIRS,
  keyAliases: KEY_ALIASES,
  customDerivations: CUSTOM_DERIVATIONS,
};
