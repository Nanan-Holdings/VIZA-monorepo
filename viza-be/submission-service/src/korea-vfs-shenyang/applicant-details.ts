const INVALID_APPLICANT_DETAILS_MESSAGE =
  "The Shenyang VFS applicant details are incomplete or invalid.";

export interface ShenyangVfsApplicantDetails {
  surname: string;
  givenNames: string;
  dateOfBirth: string;
  passportNumber: string;
  passportExpiryDate: string;
  mobilePhone: string;
}

const ALIASES = {
  surname: ["surname", "surname_en", "family_name_en", "family_name", "last_name"],
  givenNames: ["given_names", "given_names_en", "given_name", "first_name"],
  dateOfBirth: ["date_of_birth", "dob", "birth_date", "birthday"],
  passportNumber: ["passport_number", "passport_no", "travel_document_number", "document_number"],
  passportExpiryDate: ["passport_expiry_date", "passport_expiration_date", "passport_date_of_expiry", "valid_until"],
  mobilePhone: ["mobile_phone", "phone", "phone_number", "primary_phone_number", "booker_phone"],
} as const;

const NAME_PATTERN = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/u;
const PASSPORT_PATTERN = /^[A-Za-z0-9]{5,20}$/u;
const PHONE_ALLOWED_PATTERN = /^[0-9\s()+-]+$/u;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export interface ShenyangUniversalProfileAnswerRow {
  canonical_key: string;
  value_text: string | null;
  updated_at?: string | null;
}

const UNIVERSAL_SHENYANG_KEYS: Record<string, string> = {
  surname: "surname",
  surname_en: "surname",
  family_name: "surname",
  family_name_en: "surname",
  last_name: "surname",
  given_names: "given_names",
  given_names_en: "given_names",
  given_name: "given_names",
  first_name: "given_names",
  date_of_birth: "date_of_birth",
  dob: "date_of_birth",
  birth_date: "date_of_birth",
  birthday: "date_of_birth",
  passport_number: "passport_number",
  passport_no: "passport_number",
  passportnumber: "passport_number",
  travel_document_number: "passport_number",
  passport_expiry_date: "passport_expiry_date",
  passport_expiration_date: "passport_expiry_date",
  passport_date_of_expiry: "passport_expiry_date",
  valid_until: "passport_expiry_date",
  travel_document_expiry_date: "passport_expiry_date",
  phone: "mobile_phone",
  mobile_phone: "mobile_phone",
  mobile_number: "mobile_phone",
  phone_number: "mobile_phone",
  primary_phone: "mobile_phone",
  primary_phone_number: "mobile_phone",
  telephone_number: "mobile_phone",
};

function invalid(): never {
  throw new Error(INVALID_APPLICANT_DETAILS_MESSAGE);
}

function normalizeUniversalKey(value: string): string {
  return value.trim().replace(/([a-z0-9])([A-Z])/gu, "$1_$2").replace(/[^A-Za-z0-9_]+/gu, "_").toLowerCase();
}

export function buildShenyangUniversalProfileAnswers(
  rows: ShenyangUniversalProfileAnswerRow[],
): Record<string, string> {
  const ordered = rows
    .map((row, index) => ({ row, index, timestamp: Date.parse(row.updated_at ?? "") }))
    .sort((left, right) => {
      const leftTimestamp = Number.isFinite(left.timestamp) ? left.timestamp : Number.NEGATIVE_INFINITY;
      const rightTimestamp = Number.isFinite(right.timestamp) ? right.timestamp : Number.NEGATIVE_INFINITY;
      return rightTimestamp - leftTimestamp || left.index - right.index;
    });
  const seen = new Set<string>();
  const answers: Record<string, string> = {};
  for (const { row } of ordered) {
    const canonicalKey = UNIVERSAL_SHENYANG_KEYS[normalizeUniversalKey(row.canonical_key)];
    if (!canonicalKey || seen.has(canonicalKey)) continue;
    seen.add(canonicalKey);
    const value = typeof row.value_text === "string" ? row.value_text.trim() : "";
    if (value) answers[canonicalKey] = value;
  }
  return answers;
}

function firstValidAlias(
  answers: Record<string, string>,
  aliases: readonly string[],
  normalize: (value: string) => string | null,
): string | null {
  for (const alias of aliases) {
    const value = answers[alias];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const normalized = normalize(trimmed);
    if (normalized) return normalized;
  }
  return null;
}

function tryCalendarDate(value: string): string | null {
  if (!ISO_DATE_PATTERN.test(value)) return null;
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;
  return value;
}

function shanghaiCalendarDate(now: Date): string {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return invalid();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return invalid();
  return `${year.padStart(4, "0")}-${month}-${day}`;
}

function tryNormalizePhone(value: string): string | null {
  if (!PHONE_ALLOWED_PATTERN.test(value)) return null;
  const digits = value.replace(/\D/gu, "").replace(/^86(?=1\d{10}$)/u, "");
  return /^1\d{10}$/u.test(digits) ? digits : null;
}

function resolveAliasLayers(
  answerSources: readonly Record<string, string>[],
  aliases: readonly string[],
  normalize: (value: string) => string | null,
): string {
  for (const source of answerSources) {
    const value = firstValidAlias(source, aliases, normalize);
    if (value) return value;
  }
  return invalid();
}

export function requireShenyangVfsApplicantDetailsFromSourceLayers(
  applicationAnswers: Record<string, string>,
  reusableAnswers: Record<string, string>,
  profileAnswers: Record<string, string>,
  now = new Date(),
): ShenyangVfsApplicantDetails {
  const todayInShanghai = shanghaiCalendarDate(now);
  const sources = [applicationAnswers, reusableAnswers, profileAnswers];
  const surname = resolveAliasLayers(sources, ALIASES.surname, (value) => (
    NAME_PATTERN.test(value) ? value : null
  ));
  const givenNames = resolveAliasLayers(sources, ALIASES.givenNames, (value) => (
    NAME_PATTERN.test(value) ? value : null
  ));
  const dateOfBirth = resolveAliasLayers(sources, ALIASES.dateOfBirth, (value) => {
    const date = tryCalendarDate(value);
    return date && date <= todayInShanghai ? date : null;
  });
  const passportNumber = resolveAliasLayers(sources, ALIASES.passportNumber, (value) => (
    PASSPORT_PATTERN.test(value) ? value.toUpperCase() : null
  ));
  const passportExpiryDate = resolveAliasLayers(sources, ALIASES.passportExpiryDate, (value) => {
    const date = tryCalendarDate(value);
    return date && date > todayInShanghai ? date : null;
  });
  const mobilePhone = resolveAliasLayers(sources, ALIASES.mobilePhone, tryNormalizePhone);

  return {
    surname,
    givenNames,
    dateOfBirth,
    passportNumber,
    passportExpiryDate,
    mobilePhone,
  };
}

export function requireShenyangVfsApplicantDetailsFromSources(
  applicationAnswers: Record<string, string>,
  profileAnswers: Record<string, string>,
  now = new Date(),
): ShenyangVfsApplicantDetails {
  return requireShenyangVfsApplicantDetailsFromSourceLayers(applicationAnswers, {}, profileAnswers, now);
}

export function requireShenyangVfsApplicantDetails(
  answers: Record<string, string>,
  now = new Date(),
): ShenyangVfsApplicantDetails {
  return requireShenyangVfsApplicantDetailsFromSources(answers, {}, now);
}
