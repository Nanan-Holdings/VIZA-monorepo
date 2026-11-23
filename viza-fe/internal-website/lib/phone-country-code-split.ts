import { countries } from "country-data-list";

/**
 * Some official forms ask for the international calling code in its own
 * select (`phone_country_code`, values like "+65") and the number itself in a
 * digits-only field (Indonesia `mobile_phone`, pattern ^\d{4,15}$). The
 * Universal Profile stores one free-text phone such as "+65 80381309", which
 * fails that pattern and leaves the code empty. This splits it, only for
 * schemas that have that exact shape, so forms that expect the full
 * international number keep it unchanged.
 */

export const PHONE_COUNTRY_CODE_FIELD = "phone_country_code";
const NUMBER_FIELD_CANDIDATES = ["mobile_phone", "phone_number"] as const;

type SchemaField = {
  fieldName: string;
  validationRules?: unknown;
};

type CountryRecord = { status?: string; countryCallingCodes?: string[] };

let callingCodes: Set<string> | null = null;

/** All known calling codes as digit strings ("1", "65", "1268"...). */
function knownCallingCodes(): Set<string> {
  if (callingCodes) return callingCodes;
  callingCodes = new Set(
    (countries.all as CountryRecord[])
      .filter((country) => country.status !== "deleted")
      .flatMap((country) => country.countryCallingCodes ?? [])
      .map((code) => code.replace(/\s+/g, ""))
      .filter((code) => /^\+\d+$/.test(code))
      .map((code) => code.slice(1)),
  );
  return callingCodes;
}

function patternOf(field: SchemaField): string | null {
  const rules = field.validationRules;
  if (!rules || typeof rules !== "object") return null;
  const pattern = (rules as { pattern?: unknown }).pattern;
  return typeof pattern === "string" ? pattern : null;
}

/** True when the field's own pattern accepts digits but not a leading "+". */
function isDigitsOnlyNumberField(field: SchemaField): boolean {
  const pattern = patternOf(field);
  if (!pattern) return false;
  try {
    const regex = new RegExp(pattern);
    return regex.test("80381309") && !regex.test("+6580381309") && !regex.test("+65 80381309");
  } catch {
    return false;
  }
}

/**
 * Split an international number into calling code and national digits.
 * Accepts "+65 80381309", "+65-8038-1309", "(+65) 80381309", "006580381309"
 * and "+6580381309" (longest known code wins). Returns null when the value
 * does not start with an international prefix or no known code matches.
 */
export function splitInternationalPhone(
  raw: string | null | undefined,
): { countryCode: string; nationalNumber: string } | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  const compact = value.replace(/[()\s.-]/g, "");
  const international = compact.startsWith("+")
    ? compact.slice(1)
    : compact.startsWith("00")
      ? compact.slice(2)
      : null;
  if (international === null || !/^\d+$/.test(international)) return null;

  // When the user separated the code ("+65 8038..."), trust that boundary.
  const explicit = value.match(/^\(?(?:\+|00)(\d{1,4})\)?[\s\-.]+(.+)$/);
  if (explicit && knownCallingCodes().has(explicit[1])) {
    const nationalNumber = explicit[2].replace(/\D/g, "");
    if (nationalNumber) return { countryCode: `+${explicit[1]}`, nationalNumber };
  }
  for (let length = Math.min(4, international.length - 1); length >= 1; length -= 1) {
    const code = international.slice(0, length);
    if (knownCallingCodes().has(code)) {
      return { countryCode: `+${code}`, nationalNumber: international.slice(length) };
    }
  }
  return null;
}

/**
 * For a schema with a `phone_country_code` field and a digits-only number
 * field, move an international prefix out of the number into the code field.
 * Never overwrites a code the applicant already chose; only fixes a number
 * that the digits-only pattern would reject.
 */
export function splitPhoneCountryCodeForSchema(
  values: Record<string, string>,
  fields: readonly SchemaField[],
): Record<string, string> {
  if (!fields.some((field) => field.fieldName === PHONE_COUNTRY_CODE_FIELD)) return values;
  let next = values;
  for (const name of NUMBER_FIELD_CANDIDATES) {
    const field = fields.find((candidate) => candidate.fieldName === name);
    if (!field || !isDigitsOnlyNumberField(field)) continue;
    const parts = splitInternationalPhone(next[name]);
    if (!parts) continue;
    const currentCode = (next[PHONE_COUNTRY_CODE_FIELD] ?? "").trim();
    next = {
      ...next,
      [name]: parts.nationalNumber,
      ...(currentCode ? {} : { [PHONE_COUNTRY_CODE_FIELD]: parts.countryCode }),
    };
  }
  return next;
}
