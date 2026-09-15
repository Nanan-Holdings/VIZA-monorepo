/**
 * Pure source-to-contract mapping for the first USVisaScheduling applicant
 * details page.
 *
 * This module deliberately accepts already-loaded profile/application records
 * instead of importing a database client.  The caller owns the application,
 * applicant, and account fences; this helper only decides whether the values
 * it received are complete enough to hand to the portal adapter.
 */

export interface USAppointmentPhone {
  callingCode: string;
  nationalNumber: string;
}

export interface USAppointmentApplicantDetails {
  firstName: string;
  lastName: string;
  birthCountry: string;
  homePhone: USAppointmentPhone;
  mobilePhone: USAppointmentPhone;
  email: string;
  mailingStreet: string;
  mailingCity: string;
  mailingState: string;
  mailingPostalCode: string;
  passportNumber: string;
  passportIssueDate: string;
  passportPlaceOfIssue: string;
  passportExpiryDate: string;
  dateOfBirth: string;
  nationality: string;
  nationalId: string;
}

export interface USAppointmentApplicantDetailsInput {
  /** A row-shaped profile object using the persisted snake_case columns. */
  profile: Record<string, unknown>;
  /** Current application answers keyed by their dynamic schema field_name. */
  answers: Record<string, unknown>;
  /** The application-bound managed account email, never a new address. */
  accountEmail: string;
  /** Explicitly user-confirmed mobile calling code, when the answer is local. */
  mobileCallingCode?: string;
}

export type USAppointmentApplicantDetailsResult =
  | { state: "ready"; data: USAppointmentApplicantDetails }
  | { state: "missing"; missingFields: string[] };

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const E164_PATTERN = /^\+[1-9]\d{7,14}$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const NAME_PATTERN = /^\p{L}+(?:[ '\u2019.-]\p{L}+)*$/u;
const PASSPORT_PATTERN = /^[A-Za-z0-9]{5,20}$/u;
const NATIONAL_ID_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} ./'\u2019()_-]{1,63}$/u;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;

/**
 * This is an allowlist rather than a guessed prefix parser.  Longest prefixes
 * are tried first so +886/+852/+853 are not mistaken for a shorter prefix.
 */
const KNOWN_CALLING_CODES = [
  // The appointment form currently runs in the mainland-China corridor. Keep
  // this allowlist small and explicit; +1 is the NANP country code, not an
  // area-code prefix.
  "+886", "+853", "+852", "+86", "+65", "+66", "+64", "+61", "+60", "+84", "+82", "+81",
  "+91", "+90", "+49", "+44", "+39", "+33", "+31", "+7", "+1",
].filter((code, index, all) => all.indexOf(code) === index).sort((left, right) => right.length - left.length);

const KNOWN_CALLING_CODE_SET = new Set(KNOWN_CALLING_CODES);

const COUNTRY_LABELS: Record<string, string> = {
  AU: "Australia",
  CA: "Canada",
  CN: "China",
  DE: "Germany",
  ES: "Spain",
  FR: "France",
  GB: "United Kingdom",
  HK: "Hong Kong",
  IN: "India",
  IT: "Italy",
  JP: "Japan",
  KR: "South Korea",
  MO: "Macao",
  MY: "Malaysia",
  NL: "Netherlands",
  NZ: "New Zealand",
  RU: "Russia",
  SG: "Singapore",
  TH: "Thailand",
  TW: "Taiwan",
  US: "United States",
  VN: "Vietnam",
};

const COUNTRY_CODE_BY_ALIAS: Record<string, string> = {
  au: "AU", aus: "AU", australia: "AU",
  ca: "CA", can: "CA", canada: "CA",
  cn: "CN", chn: "CN", chin: "CN", china: "CN", chinese: "CN", prc: "CN",
  "people's republic of china": "CN", "中国": "CN", "中华人民共和国": "CN",
  de: "DE", deu: "DE", germany: "DE",
  es: "ES", esp: "ES", spain: "ES",
  fr: "FR", fra: "FR", france: "FR",
  gb: "GB", gbr: "GB", uk: "GB", "united kingdom": "GB",
  hk: "HK", hkg: "HK", "hong kong": "HK", "香港": "HK",
  in: "IN", ind: "IN", india: "IN",
  it: "IT", ita: "IT", italy: "IT",
  jp: "JP", jpn: "JP", japan: "JP",
  kr: "KR", kor: "KR", korea: "KR", "south korea": "KR",
  mo: "MO", mac: "MO", macao: "MO", macau: "MO",
  my: "MY", mys: "MY", malaysia: "MY",
  nl: "NL", nld: "NL", netherlands: "NL",
  nz: "NZ", nzl: "NZ", "new zealand": "NZ",
  ru: "RU", rus: "RU", russia: "RU",
  sg: "SG", sgp: "SG", sing: "SG", singapore: "SG", singaporean: "SG", "新加坡": "SG",
  th: "TH", tha: "TH", thailand: "TH",
  tw: "TW", twn: "TW", taiwan: "TW",
  us: "US", usa: "US", "united states": "US", "united states of america": "US",
  vn: "VN", vnm: "VN", vietnam: "VN",
};

const FIRST_NAME_EN_KEYS = [
  "given_names_en", "given_name_en", "first_name_en", "givenNamesEn",
] as const;
const FIRST_NAME_FALLBACK_KEYS = [
  "given_names", "given_name", "first_name", "givenNames", "givenName", "firstName",
] as const;
const LAST_NAME_EN_KEYS = [
  "surname_en", "family_name_en", "last_name_en", "surnameEn",
] as const;
const LAST_NAME_FALLBACK_KEYS = [
  "surname", "family_name", "last_name", "familyName", "lastName",
] as const;
const BIRTH_COUNTRY_KEYS = [
  // DS-160's current field is country_of_birth.  Profile and older form
  // records use birth_country; it is a fallback, not an equal authority.
  "country_of_birth", "birth_country",
] as const;
const NATIONALITY_KEYS = [
  // DS-160's current field is nationality_country.  Keep legacy aliases
  // behind it so a stale answer cannot mask the current canonical value.
  "nationality_country", "nationality",
] as const;
const HOME_PHONE_KEYS = [
  "primary_phone", "primary_phone_number", "phone", "phone_number", "telephone_number",
] as const;
const MOBILE_PHONE_KEYS = [
  "mobile_phone",
] as const;
const DOB_KEYS = ["date_of_birth", "dob", "birth_date"] as const;
const PASSPORT_NUMBER_KEYS = [
  // passport_number is the current DS-160 field.  The camel-case and travel
  // document names are compatibility fallbacks only; generic document_number
  // is intentionally excluded because it can identify another document.
  "passport_number", "passportNumber", "travel_document_number",
] as const;
const PASSPORT_ISSUE_DATE_KEYS = [
  "passport_issuance_date", "passport_issue_date", "passport_date_of_issue",
] as const;
const PASSPORT_EXPIRY_DATE_KEYS = [
  "passport_expiration_date", "passport_expiry_date", "valid_until",
] as const;
const PASSPORT_PLACE_KEYS = [
  "passport_issuance_city", "passport_place_of_issue",
] as const;
const NATIONAL_ID_KEYS = [
  "national_id_number",
] as const;

const HOME_STREET_KEYS = [
  "home_address_line1", "home_address_line_1", "home_address_street",
] as const;
const HOME_CITY_KEYS = ["home_address_city"] as const;
const HOME_STATE_KEYS = [
  "home_address_state_province", "home_address_state",
] as const;
const HOME_POSTAL_KEYS = [
  "home_address_postal_code", "home_address_postal",
] as const;
const MAILING_STREET_KEYS = [
  "mailing_address_line1", "mailing_address_line_1", "mailing_street",
] as const;
const MAILING_CITY_KEYS = ["mailing_address_city", "mailing_city"] as const;
const MAILING_STATE_KEYS = ["mailing_address_state", "mailing_state"] as const;
const MAILING_POSTAL_KEYS = [
  "mailing_address_postal_code", "mailing_address_postal", "mailing_postal_code",
] as const;

const MISSING_FIELD_ORDER = [
  "firstName", "lastName", "birthCountry", "homePhone", "homePhone.callingCode", "homePhone.nationalNumber",
  "mobilePhone", "mobilePhone.callingCode", "mobilePhone.nationalNumber", "email", "mailingSameAsHome",
  "mailingStreet", "mailingCity", "mailingState", "mailingPostalCode", "passportNumber", "passportIssueDate",
  "passportPlaceOfIssue", "passportExpiryDate", "dateOfBirth", "nationality", "nationalId",
] as const;

type Resolution<T> =
  | { status: "ok"; value: T }
  | { status: "missing" }
  | { status: "ambiguous" };

type PhoneResolution =
  | { status: "ok"; value: USAppointmentPhone }
  | { status: "missing"; reason: "callingCode" | "nationalNumber" }
  | { status: "ambiguous" };

function persistedScalar(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;

  // Dynamic form writes normally use value_text.  A small number of legacy
  // rows use value_json for the same scalar contract; accept only the
  // established { value: string } shape and never stringify an arbitrary
  // JSON object into an official field.
  const record = value as Record<string, unknown>;
  return typeof record.value === "string" ? record.value : null;
}

function hasPersistedValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  return typeof value === "string" ? value.trim().length > 0 : true;
}

function cleanText(value: unknown): string | null {
  const scalar = persistedScalar(value);
  if (scalar === null) return null;
  const trimmed = scalar.trim();
  if (!trimmed || CONTROL_CHARACTER_PATTERN.test(trimmed)) return null;
  return trimmed.replace(/\s+/gu, " ");
}

function normalizeName(value: unknown): string | null {
  const text = cleanText(value);
  return text && NAME_PATTERN.test(text) ? text : null;
}

function normalizeFreeText(value: unknown): string | null {
  return cleanText(value);
}

function normalizeEmail(value: unknown): string | null {
  const text = cleanText(value)?.toLowerCase();
  return text && EMAIL_PATTERN.test(text) ? text : null;
}

function normalizeIsoDate(value: unknown): string | null {
  const text = cleanText(value);
  if (!text || !ISO_DATE_PATTERN.test(text)) return null;
  const [yearText, monthText, dayText] = text.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 1) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime())
    || date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;
  return text;
}

function normalizePassportNumber(value: unknown): string | null {
  const text = cleanText(value);
  return text && PASSPORT_PATTERN.test(text) ? text.toUpperCase() : null;
}

function normalizeNationalId(value: unknown): string | null {
  const text = cleanText(value);
  return text && NATIONAL_ID_PATTERN.test(text) ? text : null;
}

function normalizeCountryKey(value: string): string {
  return value
    .replace(/\u2019/gu, "'")
    .replace(/[_-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

interface RegionDisplayNames {
  of(value: string): string | undefined;
}

interface IntlWithDisplayNames {
  DisplayNames?: new (locales: string | string[], options: { type: "region" }) => RegionDisplayNames;
}

function countryLabelForIso2(code: string): string | null {
  const fallback = COUNTRY_LABELS[code] ?? null;
  const DisplayNames = (Intl as unknown as IntlWithDisplayNames).DisplayNames;
  if (!DisplayNames) return fallback;
  try {
    const label = new DisplayNames("en", { type: "region" }).of(code);
    if (label && !/^unknown\s+region$/iu.test(label) && label.toUpperCase() !== code) return label;
  } catch {
    // The static allowlist below remains the safe fallback on older runtimes.
  }
  return fallback;
}

function normalizeCountry(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  const key = normalizeCountryKey(text);
  const code = COUNTRY_CODE_BY_ALIAS[key] ?? (
    /^[A-Za-z]{2}$/u.test(text) ? text.toUpperCase() : null
  );
  if (!code) return null;
  return countryLabelForIso2(code);
}

function resolveFromSources<T>(
  sources: readonly Record<string, unknown>[],
  keys: readonly string[],
  normalize: (value: unknown) => T | null,
  options: { conflictAcrossSources?: boolean } = {},
): Resolution<T> {
  let selected: T | undefined;
  for (const source of sources) {
    let valueForSource: T | undefined;
    for (const key of keys) {
      const raw = source[key];
      if (!hasPersistedValue(raw)) continue;
      const value = normalize(raw);
      // A present canonical value that fails validation must not be silently
      // replaced by an older alias or a profile fallback.
      if (value === null) return { status: "ambiguous" };
      valueForSource = value;
      break;
    }
    if (valueForSource === undefined) continue;
    if (selected === undefined) {
      selected = valueForSource;
      continue;
    }
    if (options.conflictAcrossSources && !Object.is(selected, valueForSource)) {
      return { status: "ambiguous" };
    }
  }
  return selected === undefined ? { status: "missing" } : { status: "ok", value: selected };
}

function resolveVerifiedName(
  sources: readonly Record<string, unknown>[],
  englishKeys: readonly string[],
  fallbackKeys: readonly string[],
): Resolution<string> {
  const english = resolveFromSources(sources, englishKeys, normalizeName);
  return english.status === "missing"
    ? resolveFromSources(sources, fallbackKeys, normalizeName)
    : english;
}

function normalizeCallingCode(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  const compact = text.replace(/[\s().-]/gu, "");
  const candidate = compact.startsWith("+") ? compact : `+${compact}`;
  return /^\+\d{1,3}$/u.test(candidate) && KNOWN_CALLING_CODE_SET.has(candidate)
    ? candidate
    : null;
}

function parseExplicitPhone(value: unknown): USAppointmentPhone | null {
  const text = cleanText(value);
  if (!text || !text.startsWith("+")) return null;
  const compact = text.replace(/[\s().-]/gu, "");
  if (!E164_PATTERN.test(compact)) return null;
  const callingCode = KNOWN_CALLING_CODES.find((code) => compact.startsWith(code));
  if (!callingCode) return null;
  const nationalNumber = compact.slice(callingCode.length);
  if (!/^\d{4,14}$/u.test(nationalNumber)) return null;
  return { callingCode, nationalNumber };
}

function normalizeNationalNumber(value: unknown): string | null {
  const text = cleanText(value);
  if (!text || text.startsWith("+")) return null;
  const compact = text.replace(/[\s().-]/gu, "");
  return /^\d{4,14}$/u.test(compact) ? compact : null;
}

function phoneEquals(left: USAppointmentPhone, right: USAppointmentPhone): boolean {
  return left.callingCode === right.callingCode && left.nationalNumber === right.nationalNumber;
}

function resolveExplicitPhone(
  sources: readonly Record<string, unknown>[],
  keys: readonly string[],
): PhoneResolution {
  let sawUnprefixed = false;
  let sawValue = false;
  for (const source of sources) {
    const values: USAppointmentPhone[] = [];
    for (const key of keys) {
      const raw = cleanText(source[key]);
      if (!raw) continue;
      sawValue = true;
      if (!raw.startsWith("+")) {
        sawUnprefixed = true;
        continue;
      }
      const parsed = parseExplicitPhone(raw);
      if (parsed && !values.some((existing) => phoneEquals(existing, parsed))) values.push(parsed);
    }
    if (values.length > 1) return { status: "ambiguous" };
    if (values.length === 1) return { status: "ok", value: values[0] };
  }
  return {
    status: "missing",
    reason: sawValue && sawUnprefixed ? "callingCode" : "nationalNumber",
  };
}

function resolveMobilePhone(
  answers: Record<string, unknown>,
  mobileCallingCode: string | undefined,
): PhoneResolution {
  const explicitOverrideText = cleanText(mobileCallingCode);
  const explicitOverride = normalizeCallingCode(mobileCallingCode);
  const explicitPhones: USAppointmentPhone[] = [];
  const nationalNumbers: string[] = [];
  let sawValue = false;
  let sawLocalNumber = false;
  let embeddedOverrideConflict = false;

  for (const key of MOBILE_PHONE_KEYS) {
    const raw = cleanText(answers[key]);
    if (!raw) continue;
    sawValue = true;
    const explicit = parseExplicitPhone(raw);
    if (explicit) {
      if (explicitOverride && explicit.callingCode !== explicitOverride) {
        embeddedOverrideConflict = true;
      } else if (!explicitPhones.some((existing) => phoneEquals(existing, explicit))) {
        explicitPhones.push(explicit);
      }
      continue;
    }
    const national = normalizeNationalNumber(raw);
    if (!national) continue;
    sawLocalNumber = true;
    if (explicitOverride && national.startsWith(explicitOverride.slice(1))) continue;
    if (!nationalNumbers.includes(national)) nationalNumbers.push(national);
  }

  if (embeddedOverrideConflict || explicitPhones.length > 1 || nationalNumbers.length > 1) {
    return { status: "ambiguous" };
  }
  // An explicit E.164 answer carries its own code; a separate override is not
  // needed and cannot replace it.
  if (explicitPhones.length === 1) return { status: "ok", value: explicitPhones[0] };
  if (nationalNumbers.length === 1 && explicitOverride) {
    return {
      status: "ok",
      value: { callingCode: explicitOverride, nationalNumber: nationalNumbers[0] },
    };
  }
  if (sawLocalNumber || explicitOverrideText) return { status: "missing", reason: "callingCode" };
  return { status: "missing", reason: sawValue ? "nationalNumber" : "nationalNumber" };
}

function normalizeSameAsHome(value: unknown): boolean | null {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const text = cleanText(value)?.toLowerCase();
  if (!text) return null;
  if (["true", "yes", "y", "1", "same", "same as home", "same_as_home", "same-as-home"].includes(text)) return true;
  if (["false", "no", "n", "0", "different", "different from home", "different_from_home", "different-from-home"].includes(text)) return false;
  return null;
}

function addResolutionMissing<T>(
  missing: Set<string>,
  field: string,
  resolution: Resolution<T>,
): T | undefined {
  if (resolution.status === "ok") return resolution.value;
  missing.add(field);
  return undefined;
}

function addPhoneMissing(missing: Set<string>, field: string, resolution: PhoneResolution): USAppointmentPhone | undefined {
  if (resolution.status === "ok") return resolution.value;
  if (resolution.status === "ambiguous") {
    missing.add(field);
  } else {
    missing.add(`${field}.${resolution.reason}`);
  }
  return undefined;
}

function orderMissingFields(missing: Set<string>): string[] {
  const ordered: string[] = MISSING_FIELD_ORDER.filter((field) => missing.has(field));
  for (const field of missing) {
    if (!ordered.includes(field as (typeof MISSING_FIELD_ORDER)[number])) ordered.push(field);
  }
  return ordered;
}

/**
 * Map persisted profile/application values to the authenticated applicant
 * details contract.  No full-name splitting, country guessing, date parsing,
 * or mobile calling-code inference is performed.
 */
export function buildUSAppointmentApplicantDetails(
  input: USAppointmentApplicantDetailsInput,
): USAppointmentApplicantDetailsResult {
  const profile = input.profile ?? {};
  const answers = input.answers ?? {};
  const missing = new Set<string>();

  const firstName = addResolutionMissing(
    missing,
    "firstName",
    resolveVerifiedName([answers, profile], FIRST_NAME_EN_KEYS, FIRST_NAME_FALLBACK_KEYS),
  );
  const lastName = addResolutionMissing(
    missing,
    "lastName",
    resolveVerifiedName([answers, profile], LAST_NAME_EN_KEYS, LAST_NAME_FALLBACK_KEYS),
  );
  const birthCountry = addResolutionMissing(
    missing,
    "birthCountry",
    resolveFromSources([answers, profile], BIRTH_COUNTRY_KEYS, normalizeCountry, {
      conflictAcrossSources: true,
    }),
  );
  const nationality = addResolutionMissing(
    missing,
    "nationality",
    resolveFromSources([answers, profile], NATIONALITY_KEYS, normalizeCountry, {
      conflictAcrossSources: true,
    }),
  );
  const homePhone = addPhoneMissing(
    missing,
    "homePhone",
    resolveExplicitPhone([answers, profile], HOME_PHONE_KEYS),
  );
  const mobilePhone = addPhoneMissing(
    missing,
    "mobilePhone",
    resolveMobilePhone(answers, input.mobileCallingCode),
  );

  const email = normalizeEmail(input.accountEmail);
  if (!email) missing.add("email");

  const mailingFlagResolution = resolveFromSources(
    [answers, profile],
    ["mailing_same_as_home", "mailingSameAsHome"],
    normalizeSameAsHome,
  );
  const mailingSameAsHome = addResolutionMissing(missing, "mailingSameAsHome", mailingFlagResolution);

  let mailingStreet: string | undefined;
  let mailingCity: string | undefined;
  let mailingState: string | undefined;
  let mailingPostalCode: string | undefined;
  if (mailingSameAsHome === true) {
    mailingStreet = addResolutionMissing(
      missing,
      "mailingStreet",
      resolveFromSources([answers, profile], HOME_STREET_KEYS, normalizeFreeText),
    );
    mailingCity = addResolutionMissing(
      missing,
      "mailingCity",
      resolveFromSources([answers, profile], HOME_CITY_KEYS, normalizeFreeText),
    );
    mailingState = addResolutionMissing(
      missing,
      "mailingState",
      resolveFromSources([answers, profile], HOME_STATE_KEYS, normalizeFreeText),
    );
    mailingPostalCode = addResolutionMissing(
      missing,
      "mailingPostalCode",
      resolveFromSources([answers, profile], HOME_POSTAL_KEYS, normalizeFreeText),
    );
  } else if (mailingSameAsHome === false) {
    mailingStreet = addResolutionMissing(
      missing,
      "mailingStreet",
      resolveFromSources([answers, profile], MAILING_STREET_KEYS, normalizeFreeText),
    );
    mailingCity = addResolutionMissing(
      missing,
      "mailingCity",
      resolveFromSources([answers, profile], MAILING_CITY_KEYS, normalizeFreeText),
    );
    mailingState = addResolutionMissing(
      missing,
      "mailingState",
      resolveFromSources([answers, profile], MAILING_STATE_KEYS, normalizeFreeText),
    );
    mailingPostalCode = addResolutionMissing(
      missing,
      "mailingPostalCode",
      resolveFromSources([answers, profile], MAILING_POSTAL_KEYS, normalizeFreeText),
    );
  } else {
    // The branch cannot be selected safely, so never treat a home address as
    // mailing address when the persisted flag is absent or unclear.
    missing.add("mailingStreet");
    missing.add("mailingCity");
    missing.add("mailingState");
    missing.add("mailingPostalCode");
  }

  const passportNumber = addResolutionMissing(
    missing,
    "passportNumber",
    resolveFromSources([answers, profile], PASSPORT_NUMBER_KEYS, normalizePassportNumber, {
      conflictAcrossSources: true,
    }),
  );
  const passportIssueDate = addResolutionMissing(
    missing,
    "passportIssueDate",
    resolveFromSources([answers, profile], PASSPORT_ISSUE_DATE_KEYS, normalizeIsoDate, {
      conflictAcrossSources: true,
    }),
  );
  const passportPlaceOfIssue = addResolutionMissing(
    missing,
    "passportPlaceOfIssue",
    resolveFromSources([answers, profile], PASSPORT_PLACE_KEYS, normalizeFreeText),
  );
  const passportExpiryDate = addResolutionMissing(
    missing,
    "passportExpiryDate",
    resolveFromSources([answers, profile], PASSPORT_EXPIRY_DATE_KEYS, normalizeIsoDate, {
      conflictAcrossSources: true,
    }),
  );
  const dateOfBirth = addResolutionMissing(
    missing,
    "dateOfBirth",
    resolveFromSources([answers, profile], DOB_KEYS, normalizeIsoDate, {
      conflictAcrossSources: true,
    }),
  );
  const nationalId = addResolutionMissing(
    missing,
    "nationalId",
    resolveFromSources([answers, profile], NATIONAL_ID_KEYS, normalizeNationalId),
  );

  if (missing.size > 0) return { state: "missing", missingFields: orderMissingFields(missing) };

  return {
    state: "ready",
    data: {
      firstName: firstName as string,
      lastName: lastName as string,
      birthCountry: birthCountry as string,
      homePhone: homePhone as USAppointmentPhone,
      mobilePhone: mobilePhone as USAppointmentPhone,
      email: email as string,
      mailingStreet: mailingStreet as string,
      mailingCity: mailingCity as string,
      mailingState: mailingState as string,
      mailingPostalCode: mailingPostalCode as string,
      passportNumber: passportNumber as string,
      passportIssueDate: passportIssueDate as string,
      passportPlaceOfIssue: passportPlaceOfIssue as string,
      passportExpiryDate: passportExpiryDate as string,
      dateOfBirth: dateOfBirth as string,
      nationality: nationality as string,
      nationalId: nationalId as string,
    },
  };
}
