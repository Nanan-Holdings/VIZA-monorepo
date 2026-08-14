export const SHENYANG_REQUIRED_FIELDS = [
  "surname",
  "givenNames",
  "dateOfBirth",
  "passportNumber",
  "passportExpiryDate",
  "mobilePhone",
] as const;

export type ShenyangApplicantField = (typeof SHENYANG_REQUIRED_FIELDS)[number];

export type ShenyangApplicantSource =
  | "korea_form"
  | "universal_profile"
  | "appointment_supplement";

export interface ShenyangResolvedValue {
  rawValue: string;
  displayValue: string;
  source: ShenyangApplicantSource;
}

export interface ShenyangResolvedDetails {
  fields: Partial<Record<ShenyangApplicantField, ShenyangResolvedValue>>;
  missingFields: ShenyangApplicantField[];
  complete: boolean;
}

export interface ShenyangApplicantReviewValue {
  displayValue: string;
  source: ShenyangApplicantSource;
  required: boolean;
}

export interface ShenyangApplicantReviewSnapshot {
  fields: Partial<Record<ShenyangApplicantField, ShenyangApplicantReviewValue>>;
  missingFields: ShenyangApplicantField[];
  complete: boolean;
}

export function shouldRequireShenyangApplicantDetails(
  centerCode: string | null | undefined,
): boolean {
  return centerCode === "shenyang";
}

/**
 * Convert the internal resolver output into the narrow shape returned by the
 * appointment review API. Raw identity values are intentionally omitted;
 * passport and phone values are already redacted in `displayValue`.
 */
export function toShenyangApplicantReviewSnapshot(
  details: ShenyangResolvedDetails,
): ShenyangApplicantReviewSnapshot {
  const fields: Partial<Record<ShenyangApplicantField, ShenyangApplicantReviewValue>> = {};

  for (const field of SHENYANG_REQUIRED_FIELDS) {
    const resolved = details.fields[field];
    if (!resolved) continue;
    fields[field] = {
      displayValue: resolved.displayValue,
      source: resolved.source,
      required: true,
    };
  }

  return {
    fields,
    missingFields: [...details.missingFields],
    complete: details.complete,
  };
}

export type ShenyangApplicationAnswer = {
  value: string;
  origin?: string | null;
};

export function selectKvacCenterCode(
  explicitCenterCode: string | null | undefined,
  persistedCenterCode: string | null | undefined,
  validCenterCodes: readonly string[],
): string | undefined {
  if (
    typeof explicitCenterCode === "string"
    && explicitCenterCode.trim()
    && validCenterCodes.includes(explicitCenterCode)
  ) {
    return explicitCenterCode;
  }
  if (typeof persistedCenterCode === "string" && validCenterCodes.includes(persistedCenterCode)) {
    return persistedCenterCode;
  }
  return undefined;
}

/**
 * A persisted center may be skipped only when the caller supplied a valid
 * explicit center preview. Malformed values must still load persisted state
 * so a saved Shenyang job remains the routing source of truth.
 */
export function shouldUsePersistedKvacCenter(
  explicitCenterCode: string | null | undefined,
  validCenterCodes: readonly string[],
): boolean {
  return !(
    typeof explicitCenterCode === "string"
    && explicitCenterCode.trim()
    && validCenterCodes.includes(explicitCenterCode)
  );
}

const ANSWER_KEYS: Record<ShenyangApplicantField, readonly string[]> = {
  surname: ["surname_en", "surname", "family_name_en", "family_name", "last_name"],
  givenNames: ["given_names_en", "given_names", "given_name", "first_name"],
  dateOfBirth: ["date_of_birth", "dob", "birth_date", "birthday"],
  passportNumber: ["passport_number", "passport_no", "travel_document_number", "document_number"],
  passportExpiryDate: ["passport_expiry_date", "passport_expiration_date", "passport_date_of_expiry", "valid_until"],
  mobilePhone: ["mobile_phone", "phone", "phone_number", "primary_phone_number", "booker_phone"],
};

const CANONICAL_FIELD_NAMES: Record<ShenyangApplicantField, string> = {
  surname: "surname",
  givenNames: "given_names",
  dateOfBirth: "date_of_birth",
  passportNumber: "passport_number",
  passportExpiryDate: "passport_expiry_date",
  mobilePhone: "mobile_phone",
};

/**
 * Return a mainland China mobile number in its canonical eleven-digit form.
 *
 * The country prefix is removed only when the remaining digits are already a
 * valid mainland mobile number. This avoids turning arbitrary numbers that
 * happen to contain 86 into a valid value.
 */
export function normalizeMainlandPhone(value: string): string | null {
  if (!/^[0-9\s()+-]+$/u.test(value)) return null;
  const digits = value.replace(/\D/gu, "").replace(/^86(?=1\d{10}$)/u, "");
  return /^1\d{10}$/u.test(digits) ? digits : null;
}

function clean(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function maskPassport(value: string): string {
  const normalized = clean(value);
  if (!isSafePassportNumber(normalized)) return "****";
  return `**** ${normalized.slice(-4)}`;
}

function maskMobilePhone(value: string): string {
  const normalized = normalizeMainlandPhone(value);
  if (normalized) return `${normalized.slice(0, 3)}****${normalized.slice(-4)}`;
  return "****";
}

function displayValue(field: ShenyangApplicantField, rawValue: string): string {
  if (field === "passportNumber") return maskPassport(rawValue);
  if (field === "mobilePhone") return maskMobilePhone(rawValue);
  return rawValue;
}

function applicationSource(origin: string | null | undefined): ShenyangApplicantSource {
  if (origin === "universal_profile") return "universal_profile";
  if (origin === "appointment_supplement") return "appointment_supplement";
  return "korea_form";
}

function readApplicationValue(
  answers: Record<string, ShenyangApplicationAnswer>,
  aliases: readonly string[],
): { value: string; source: ShenyangApplicantSource } | null {
  for (const alias of aliases) {
    const answer = answers[alias];
    const value = clean(answer?.value);
    if (value) return { value, source: applicationSource(answer?.origin) };
  }
  return null;
}

function readProfileValue(
  answers: Record<string, string>,
  aliases: readonly string[],
): string | null {
  for (const alias of aliases) {
    const value = clean(answers[alias]);
    if (value) return value;
  }
  return null;
}

export function resolveShenyangApplicantDetails(input: {
  applicationAnswers: Record<string, ShenyangApplicationAnswer>;
  profileAnswers: Record<string, string>;
  supplements?: Partial<Record<ShenyangApplicantField, string>>;
  now?: Date;
}): ShenyangResolvedDetails {
  const fields: Partial<Record<ShenyangApplicantField, ShenyangResolvedValue>> = {};
  const missingFields: ShenyangApplicantField[] = [];
  const now = input.now ?? new Date();

  for (const field of SHENYANG_REQUIRED_FIELDS) {
    const aliases = ANSWER_KEYS[field];
    const applicationValue = readApplicationValue(input.applicationAnswers, aliases);
    const profileValue = applicationValue ? null : readProfileValue(input.profileAnswers, aliases);
    const persistentValue = applicationValue
      ?? (profileValue ? { value: profileValue, source: "universal_profile" as const } : null);
    const persistentError = persistentValue
      ? validateShenyangSupplement({ [field]: persistentValue.value }, now)[field]
      : undefined;
    const supplementValue = clean(input.supplements?.[field]);
    const supplementError = supplementValue
      ? validateShenyangSupplement({ [field]: supplementValue }, now)[field]
      : undefined;

    const resolved = persistentValue && !persistentError
      ? persistentValue
      : supplementValue && !supplementError
        ? { value: supplementValue, source: "appointment_supplement" as const }
        : null;

    if (!resolved) {
      missingFields.push(field);
      continue;
    }

    fields[field] = {
      rawValue: resolved.value,
      displayValue: displayValue(field, resolved.value),
      source: resolved.source,
    };
  }

  return {
    fields,
    missingFields,
    complete: missingFields.length === 0,
  };
}

function isRealIsoDate(value: string): boolean {
  const match = clean(value).match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function isLatinName(value: string): boolean {
  return /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/u.test(clean(value));
}

function isSafePassportNumber(value: string): boolean {
  return /^[A-Za-z0-9]{5,20}$/u.test(clean(value));
}

function shanghaiCalendarDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
}

function isExpired(value: string, now: Date): boolean {
  return clean(value) <= shanghaiCalendarDate(now);
}

function isFuture(value: string, now: Date): boolean {
  return clean(value) > shanghaiCalendarDate(now);
}

export function validateShenyangSupplement(
  input: Partial<Record<ShenyangApplicantField, string>>,
  now: Date = new Date(),
): Partial<Record<ShenyangApplicantField, string>> {
  const errors: Partial<Record<ShenyangApplicantField, string>> = {};

  if (input.surname !== undefined && !isLatinName(input.surname)) {
    errors.surname = "latin_name_required";
  }
  if (input.givenNames !== undefined && !isLatinName(input.givenNames)) {
    errors.givenNames = "latin_name_required";
  }
  if (input.dateOfBirth !== undefined && !isRealIsoDate(input.dateOfBirth)) {
    errors.dateOfBirth = "invalid_date";
  } else if (input.dateOfBirth !== undefined && isFuture(input.dateOfBirth, now)) {
    errors.dateOfBirth = "date_in_future";
  }
  if (input.passportNumber !== undefined && !isSafePassportNumber(input.passportNumber)) {
    errors.passportNumber = "invalid_passport";
  }
  if (input.passportExpiryDate !== undefined) {
    if (!isRealIsoDate(input.passportExpiryDate)) {
      errors.passportExpiryDate = "invalid_date";
    } else if (isExpired(input.passportExpiryDate, now)) {
      errors.passportExpiryDate = "passport_expired";
    }
  }
  if (input.mobilePhone !== undefined && !normalizeMainlandPhone(input.mobilePhone)) {
    errors.mobilePhone = "invalid_mainland_phone";
  }

  return errors;
}

export function validateShenyangResolvedValues(
  details: ShenyangResolvedDetails,
  now: Date = new Date(),
): Partial<Record<ShenyangApplicantField, string>> {
  const values: Partial<Record<ShenyangApplicantField, string>> = {};
  for (const field of SHENYANG_REQUIRED_FIELDS) {
    const resolved = details.fields[field];
    if (resolved) values[field] = resolved.rawValue;
  }
  return validateShenyangSupplement(values, now);
}

export function filterShenyangSupplementsToMissingFields(
  details: Pick<ShenyangResolvedDetails, "missingFields">,
  supplements: Partial<Record<ShenyangApplicantField, string>>,
): Partial<Record<ShenyangApplicantField, string>> {
  const missing = new Set(details.missingFields);
  return Object.fromEntries(
    SHENYANG_REQUIRED_FIELDS
      .filter((field) => missing.has(field) && supplements[field] !== undefined)
      .map((field) => [field, supplements[field]]),
  ) as Partial<Record<ShenyangApplicantField, string>>;
}

type ShenyangCanonicalInputValue = Pick<ShenyangResolvedValue, "rawValue" | "source">
  & Partial<Pick<ShenyangResolvedValue, "displayValue">>;

export function buildShenyangCanonicalRows(
  applicationId: string,
  fields: Record<ShenyangApplicantField, ShenyangCanonicalInputValue>,
  updatedAt = new Date().toISOString(),
): Array<{
  application_id: string;
  field_name: string;
  value_text: string;
  updated_at: string;
  source: ShenyangApplicantSource;
  source_metadata: { origin: ShenyangApplicantSource };
}> {
  return SHENYANG_REQUIRED_FIELDS.map((field) => ({
    application_id: applicationId,
    field_name: CANONICAL_FIELD_NAMES[field],
    value_text: clean(fields[field].rawValue),
    updated_at: updatedAt,
    source: fields[field].source,
    source_metadata: { origin: fields[field].source },
  }));
}
