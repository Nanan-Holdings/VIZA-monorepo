import type { Locator, Page } from "@playwright/test";
import type {
  USAppointmentApplicantDetails,
  USAppointmentApplicantDetailsResult,
} from "./applicant-details-data";

export const US_VISA_SCHEDULING_APPLICANT_DETAILS_PATH = "/en-US/applicant_details/";
export const US_VISA_SCHEDULING_OFFICIAL_ORIGIN = "https://www.usvisascheduling.com";

export const US_VISA_SCHEDULING_APPLICANT_DETAILS_SELECTORS = {
  firstName: "#atlas_first_name",
  lastName: "#atlas_last_name",
  birthCountry: "#atlas_pob_country",
  homePhoneCallingCode: "#atlas_home_phone_country_code",
  homePhoneNumber: "#atlas_home_phone",
  mobilePhoneCallingCode: "#atlas_mobile_phone_country_code",
  mobilePhoneNumber: "#atlas_mobile_phone",
  email: "#atlas_email",
  mailingStreet: "#atlas_mailing_street",
  mailingCity: "#atlas_mailing_city",
  mailingState: "#atlas_mailing_state",
  mailingPostalCode: "#atlas_mailing_postal_code",
  passportNumber: "#atlas_passport_number",
  passportIssueDate: "#atlas_passport_issuance_date_datepicker_description",
  passportPlaceOfIssue: "#atlas_passport_place_of_issue",
  passportExpiryDate: "#atlas_passport_expiration_date_datepicker_description",
  dateOfBirth: "#atlas_birthdate_datepicker_description",
  nationality: "#atlas_nationality",
  nationalId: "#atlas_national_id",
} as const;

export type USVisaSchedulingApplicantDetailsField =
  | "firstName"
  | "lastName"
  | "birthCountry"
  | "homePhone.callingCode"
  | "homePhone.nationalNumber"
  | "mobilePhone.callingCode"
  | "mobilePhone.nationalNumber"
  | "email"
  | "mailingStreet"
  | "mailingCity"
  | "mailingState"
  | "mailingPostalCode"
  | "passportNumber"
  | "passportIssueDate"
  | "passportPlaceOfIssue"
  | "passportExpiryDate"
  | "dateOfBirth"
  | "nationality"
  | "nationalId";

export type USVisaSchedulingApplicantDetailsCode =
  | "invalid_origin_override"
  | "not_applicant_details_path"
  | "applicant_details_data_missing"
  | "applicant_details_data_invalid"
  | "applicant_details_selector_drift"
  | "applicant_details_option_missing"
  | "applicant_details_fill_failed"
  | "applicant_details_filled";

export interface FillUSVisaSchedulingApplicantDetailsInput {
  page: Page;
  applicant: USAppointmentApplicantDetailsResult | undefined;
  /** Test-only loopback origin. Production callers must omit this. */
  originOverride?: string;
  timeoutMs?: number;
}

export interface FillUSVisaSchedulingApplicantDetailsResult {
  state: "notapplicant" | "filled" | "gate";
  code?: USVisaSchedulingApplicantDetailsCode;
  missingFields?: string[];
}

interface VisibleOption {
  value: string;
  text: string;
}

interface NormalizedApplicantDetails {
  firstName: string;
  lastName: string;
  birthCountry: string;
  homePhoneCallingCode: string;
  homePhoneNumber: string;
  mobilePhoneCallingCode: string;
  mobilePhoneNumber: string;
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

const REQUIRED_FIELDS: readonly USVisaSchedulingApplicantDetailsField[] = [
  "firstName",
  "lastName",
  "birthCountry",
  "homePhone.callingCode",
  "homePhone.nationalNumber",
  "mobilePhone.callingCode",
  "mobilePhone.nationalNumber",
  "email",
  "mailingStreet",
  "mailingCity",
  "mailingState",
  "mailingPostalCode",
  "passportNumber",
  "passportIssueDate",
  "passportPlaceOfIssue",
  "passportExpiryDate",
  "dateOfBirth",
  "nationality",
  "nationalId",
];

const TEXT_FIELD_SELECTORS: Readonly<Record<USVisaSchedulingApplicantDetailsField, string>> = {
  firstName: US_VISA_SCHEDULING_APPLICANT_DETAILS_SELECTORS.firstName,
  lastName: US_VISA_SCHEDULING_APPLICANT_DETAILS_SELECTORS.lastName,
  birthCountry: US_VISA_SCHEDULING_APPLICANT_DETAILS_SELECTORS.birthCountry,
  "homePhone.callingCode": US_VISA_SCHEDULING_APPLICANT_DETAILS_SELECTORS.homePhoneCallingCode,
  "homePhone.nationalNumber": US_VISA_SCHEDULING_APPLICANT_DETAILS_SELECTORS.homePhoneNumber,
  "mobilePhone.callingCode": US_VISA_SCHEDULING_APPLICANT_DETAILS_SELECTORS.mobilePhoneCallingCode,
  "mobilePhone.nationalNumber": US_VISA_SCHEDULING_APPLICANT_DETAILS_SELECTORS.mobilePhoneNumber,
  email: US_VISA_SCHEDULING_APPLICANT_DETAILS_SELECTORS.email,
  mailingStreet: US_VISA_SCHEDULING_APPLICANT_DETAILS_SELECTORS.mailingStreet,
  mailingCity: US_VISA_SCHEDULING_APPLICANT_DETAILS_SELECTORS.mailingCity,
  mailingState: US_VISA_SCHEDULING_APPLICANT_DETAILS_SELECTORS.mailingState,
  mailingPostalCode: US_VISA_SCHEDULING_APPLICANT_DETAILS_SELECTORS.mailingPostalCode,
  passportNumber: US_VISA_SCHEDULING_APPLICANT_DETAILS_SELECTORS.passportNumber,
  passportIssueDate: US_VISA_SCHEDULING_APPLICANT_DETAILS_SELECTORS.passportIssueDate,
  passportPlaceOfIssue: US_VISA_SCHEDULING_APPLICANT_DETAILS_SELECTORS.passportPlaceOfIssue,
  passportExpiryDate: US_VISA_SCHEDULING_APPLICANT_DETAILS_SELECTORS.passportExpiryDate,
  dateOfBirth: US_VISA_SCHEDULING_APPLICANT_DETAILS_SELECTORS.dateOfBirth,
  nationality: US_VISA_SCHEDULING_APPLICANT_DETAILS_SELECTORS.nationality,
  nationalId: US_VISA_SCHEDULING_APPLICANT_DETAILS_SELECTORS.nationalId,
};

const SELECT_FIELD_KEYS = new Set<USVisaSchedulingApplicantDetailsField>([
  "birthCountry",
  "homePhone.callingCode",
  "mobilePhone.callingCode",
  "nationality",
]);

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.normalize("NFKC").replace(/\s+/gu, " ").trim() : "";
}

function normalizeOptionText(value: string): string {
  return normalizeText(value).toLocaleLowerCase("en-US");
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLocaleLowerCase("en-US");
  return normalized === "localhost"
    || normalized === "127.0.0.1"
    || normalized === "[::1]"
    || normalized === "::1";
}

function resolveExpectedOrigin(originOverride: string | undefined): string | null {
  if (originOverride === undefined) return US_VISA_SCHEDULING_OFFICIAL_ORIGIN;
  try {
    const parsed = new URL(originOverride);
    if (
      !["http:", "https:"].includes(parsed.protocol)
      || parsed.username
      || parsed.password
      || parsed.pathname !== "/"
      || parsed.search
      || parsed.hash
    ) {
      return null;
    }
    if (parsed.origin !== US_VISA_SCHEDULING_OFFICIAL_ORIGIN && !isLoopbackHost(parsed.hostname)) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function isExactApplicantDetailsUrl(value: string, expectedOrigin: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.origin === expectedOrigin
      && parsed.pathname === US_VISA_SCHEDULING_APPLICANT_DETAILS_PATH
      && parsed.search === ""
      && parsed.hash === "";
  } catch {
    return false;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readMissingFields(value: unknown): string[] {
  const record = asRecord(value);
  const fields = record?.missingFields;
  if (!Array.isArray(fields)) return [...REQUIRED_FIELDS];
  const normalized = fields.filter((field): field is string => typeof field === "string")
    .map((field) => normalizeText(field))
    .filter((field) => field.length > 0);
  return normalized.length > 0 ? normalized : [...REQUIRED_FIELDS];
}

function extractApplicantDetails(
  result: USAppointmentApplicantDetailsResult,
): USAppointmentApplicantDetails | null {
  const record = asRecord(result);
  if (!record || record.state !== "ready") return null;
  const data = asRecord(record.data);
  return data ? data as unknown as USAppointmentApplicantDetails : null;
}

function normalizeIsoDate(value: unknown): string | null {
  const match = normalizeText(value).match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() !== month - 1
    || candidate.getUTCDate() !== day
  ) {
    return null;
  }
  return `${match[2]}/${match[3]}/${match[1]}`;
}

function normalizeCallingCode(value: unknown): string {
  const normalized = normalizeText(value);
  return /^\+[0-9]+(?:-[0-9]+)*$/u.test(normalized) ? normalized : "";
}

function normalizeApplicant(
  applicant: USAppointmentApplicantDetails,
): { details: NormalizedApplicantDetails | null; missingFields: string[]; invalidFields: string[] } {
  const source = asRecord(applicant) ?? {};
  const homePhone = asRecord(source.homePhone) ?? {};
  const mobilePhone = asRecord(source.mobilePhone) ?? {};
  const raw = {
    firstName: normalizeText(source.firstName),
    lastName: normalizeText(source.lastName),
    birthCountry: normalizeText(source.birthCountry),
    homePhoneCallingCode: normalizeCallingCode(homePhone.callingCode),
    homePhoneNumber: normalizeText(homePhone.nationalNumber),
    mobilePhoneCallingCode: normalizeCallingCode(mobilePhone.callingCode),
    mobilePhoneNumber: normalizeText(mobilePhone.nationalNumber),
    email: normalizeText(source.email),
    mailingStreet: normalizeText(source.mailingStreet),
    mailingCity: normalizeText(source.mailingCity),
    mailingState: normalizeText(source.mailingState),
    mailingPostalCode: normalizeText(source.mailingPostalCode),
    passportNumber: normalizeText(source.passportNumber),
    passportIssueDate: normalizeIsoDate(source.passportIssueDate),
    passportPlaceOfIssue: normalizeText(source.passportPlaceOfIssue),
    passportExpiryDate: normalizeIsoDate(source.passportExpiryDate),
    dateOfBirth: normalizeIsoDate(source.dateOfBirth),
    nationality: normalizeText(source.nationality),
    nationalId: normalizeText(source.nationalId),
  };

  const missingFields: string[] = [];
  const invalidFields: string[] = [];
  const requiredValues: Array<[USVisaSchedulingApplicantDetailsField, string | null]> = [
    ["firstName", raw.firstName],
    ["lastName", raw.lastName],
    ["birthCountry", raw.birthCountry],
    ["homePhone.callingCode", raw.homePhoneCallingCode],
    ["homePhone.nationalNumber", raw.homePhoneNumber],
    ["mobilePhone.callingCode", raw.mobilePhoneCallingCode],
    ["mobilePhone.nationalNumber", raw.mobilePhoneNumber],
    ["email", raw.email],
    ["mailingStreet", raw.mailingStreet],
    ["mailingCity", raw.mailingCity],
    ["mailingState", raw.mailingState],
    ["mailingPostalCode", raw.mailingPostalCode],
    ["passportNumber", raw.passportNumber],
    ["passportIssueDate", raw.passportIssueDate],
    ["passportPlaceOfIssue", raw.passportPlaceOfIssue],
    ["passportExpiryDate", raw.passportExpiryDate],
    ["dateOfBirth", raw.dateOfBirth],
    ["nationality", raw.nationality],
    ["nationalId", raw.nationalId],
  ];
  for (const [field, value] of requiredValues) {
    if (value === null || value.length === 0) {
      if (
        (field === "passportIssueDate" && normalizeText(source.passportIssueDate))
        || (field === "passportExpiryDate" && normalizeText(source.passportExpiryDate))
        || (field === "dateOfBirth" && normalizeText(source.dateOfBirth))
        || ((field === "homePhone.callingCode" || field === "mobilePhone.callingCode")
          && normalizeText(field.startsWith("homePhone") ? homePhone.callingCode : mobilePhone.callingCode))
      ) {
        invalidFields.push(field);
      } else {
        missingFields.push(field);
      }
    }
  }

  if (missingFields.length > 0 || invalidFields.length > 0) {
    return { details: null, missingFields, invalidFields };
  }
  return {
    details: raw as NormalizedApplicantDetails,
    missingFields: [],
    invalidFields: [],
  };
}

async function readVisibleOptions(select: Locator): Promise<VisibleOption[]> {
  return select.locator("option").evaluateAll((nodes) => nodes.flatMap((node) => {
    const option = node as HTMLOptionElement;
    const style = window.getComputedStyle(option);
    if (option.hidden || option.disabled || style.display === "none" || style.visibility === "hidden") {
      return [];
    }
    return [{
      value: option.value,
      text: (option.textContent ?? "").replace(/\s+/gu, " ").trim(),
    }];
  }));
}

function findExactOption(options: VisibleOption[], expectedLabel: string): VisibleOption | null {
  const expected = normalizeOptionText(expectedLabel);
  const matches = options.filter((option) => normalizeOptionText(option.text) === expected);
  return matches.length === 1 ? matches[0] : null;
}

function findCallingCodeOption(options: VisibleOption[], expectedCode: string): VisibleOption | null {
  const matches = options.filter((option) => {
    const match = option.text.match(/\+[0-9]+(?:-[0-9]+)*/u)?.[0] ?? "";
    return match === expectedCode;
  });
  return matches.length === 1 ? matches[0] : null;
}

function gate(
  code: USVisaSchedulingApplicantDetailsCode,
  missingFields?: readonly string[],
): FillUSVisaSchedulingApplicantDetailsResult {
  return {
    state: "gate",
    code,
    ...(missingFields && missingFields.length > 0 ? { missingFields: [...missingFields] } : {}),
  };
}

function optionValue(option: VisibleOption): { value: string } | { label: string } {
  return option.value ? { value: option.value } : { label: option.text };
}

/**
 * Fills the verified Applicant Details page only. It performs no Next/submit
 * action and never touches the provider's `frm_pref_*` honeypot control.
 */
export async function fillUSVisaSchedulingApplicantDetails(
  input: FillUSVisaSchedulingApplicantDetailsInput,
): Promise<FillUSVisaSchedulingApplicantDetailsResult> {
  const expectedOrigin = resolveExpectedOrigin(input.originOverride);
  if (!expectedOrigin) return { state: "notapplicant", code: "invalid_origin_override" };

  let currentUrl: string;
  try {
    if (input.page.isClosed()) return gate("applicant_details_fill_failed");
    currentUrl = input.page.url();
  } catch {
    return gate("applicant_details_fill_failed");
  }
  if (!isExactApplicantDetailsUrl(currentUrl, expectedOrigin)) {
    return { state: "notapplicant", code: "not_applicant_details_path" };
  }

  if (!input.applicant) return gate("applicant_details_data_missing", REQUIRED_FIELDS);
  const applicantRecord = asRecord(input.applicant);
  if (applicantRecord?.state === "missing") {
    return gate("applicant_details_data_missing", readMissingFields(input.applicant));
  }
  const applicant = extractApplicantDetails(input.applicant);
  if (!applicant) return gate("applicant_details_data_missing", REQUIRED_FIELDS);
  const normalized = normalizeApplicant(applicant);
  if (normalized.missingFields.length > 0) {
    return gate("applicant_details_data_missing", normalized.missingFields);
  }
  if (normalized.invalidFields.length > 0) {
    return gate("applicant_details_data_invalid", normalized.invalidFields);
  }
  const details = normalized.details;
  if (!details) return gate("applicant_details_data_invalid", REQUIRED_FIELDS);

  const timeoutMs = Math.max(1_000, Math.min(input.timeoutMs ?? 15_000, 60_000));
  const controls = new Map<USVisaSchedulingApplicantDetailsField, Locator>();
  for (const field of REQUIRED_FIELDS) {
    const selector = TEXT_FIELD_SELECTORS[field];
    const locator = input.page.locator(selector);
    let count: number;
    try {
      count = await locator.count();
      if (count !== 1) return gate("applicant_details_selector_drift", [field]);
      await locator.waitFor({ state: "visible", timeout: timeoutMs });
      if (!(await locator.isVisible()) || !(await locator.isEnabled())) {
        return gate("applicant_details_selector_drift", [field]);
      }
    } catch {
      return gate("applicant_details_selector_drift", [field]);
    }
    controls.set(field, locator);
  }

  const selections = new Map<USVisaSchedulingApplicantDetailsField, { value: string } | { label: string }>();
  for (const field of SELECT_FIELD_KEYS) {
    const locator = controls.get(field);
    if (!locator) return gate("applicant_details_selector_drift", [field]);
    let options: VisibleOption[];
    try {
      options = await readVisibleOptions(locator);
    } catch {
      return gate("applicant_details_selector_drift", [field]);
    }
    const option = field === "birthCountry" || field === "nationality"
      ? findExactOption(options, field === "birthCountry" ? details.birthCountry : details.nationality)
      : findCallingCodeOption(
        options,
        field === "homePhone.callingCode" ? details.homePhoneCallingCode : details.mobilePhoneCallingCode,
      );
    if (!option) {
      return gate("applicant_details_option_missing", [field]);
    }
    selections.set(field, optionValue(option));
  }

  const values: Readonly<Record<USVisaSchedulingApplicantDetailsField, string>> = {
    firstName: details.firstName,
    lastName: details.lastName,
    birthCountry: "",
    "homePhone.callingCode": "",
    "homePhone.nationalNumber": details.homePhoneNumber,
    "mobilePhone.callingCode": "",
    "mobilePhone.nationalNumber": details.mobilePhoneNumber,
    email: details.email,
    mailingStreet: details.mailingStreet,
    mailingCity: details.mailingCity,
    mailingState: details.mailingState,
    mailingPostalCode: details.mailingPostalCode,
    passportNumber: details.passportNumber,
    passportIssueDate: details.passportIssueDate,
    passportPlaceOfIssue: details.passportPlaceOfIssue,
    passportExpiryDate: details.passportExpiryDate,
    dateOfBirth: details.dateOfBirth,
    nationality: "",
    nationalId: details.nationalId,
  };

  try {
    for (const field of REQUIRED_FIELDS) {
      const locator = controls.get(field);
      if (!locator) return gate("applicant_details_selector_drift", [field]);
      const selection = selections.get(field);
      if (selection) {
        await locator.selectOption(selection, { timeout: timeoutMs });
      } else {
        await locator.fill(values[field], { timeout: timeoutMs });
      }
    }
  } catch {
    return gate("applicant_details_fill_failed");
  }

  return { state: "filled", code: "applicant_details_filled" };
}
