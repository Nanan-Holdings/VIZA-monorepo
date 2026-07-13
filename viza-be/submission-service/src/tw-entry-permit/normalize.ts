import type { SubmissionPayload } from "../country-submissions/types";

export const TW_ENTRY_PERMIT_VISA_TYPE = "TW_OVERSEAS_CN_TOURISM_ENTRY_PERMIT";
export const TW_ENTRY_PERMIT_OFFICIAL_PORTAL_URL = "https://coa.immigration.gov.tw/coa-frontend/overseas-foreign-china/apply/verify";

export type TaiwanEligibilityRoute = "student" | "permanent_resident" | "work_one_year" | "dependent_with_funds" | "accompanying_family";

export interface TaiwanEntryPermitPortalPayload {
  applicationId: string;
  aliasEmailAddress: string;
  realEmailAddress: string | null;
  eligibilityRoute: TaiwanEligibilityRoute;
  permitType: "single" | "one_year_multiple";
  passportNumber: string;
  passportExpiryDate: string;
  surname: string;
  givenNames: string;
  chineseName: string;
  dateOfBirth: string;
  gender: "male" | "female";
  singaporeResidencePassNumber: string;
  singaporeResidenceExpiryDate: string;
  phoneCountryCode: string;
  phoneNumber: string;
  intendedArrivalDate: string;
  intendedDepartureDate: string;
  taiwanAccommodationAddress: string;
  officialDeclaration: boolean;
}

export class TaiwanEntryPermitValidationError extends Error {
  readonly code = "tw_entry_permit_payload_validation_failed";
  constructor(message: string, readonly missingFields: string[]) {
    super(message);
    this.name = "TaiwanEntryPermitValidationError";
  }
}

function answer(payload: SubmissionPayload, key: string): string {
  return (payload.countrySpecific[key] ?? "").trim();
}
function required(payload: SubmissionPayload, key: string, missing: string[]): string {
  const value = answer(payload, key);
  if (!value) missing.push(`answers.${key}`);
  return value;
}
function enumValue<T extends string>(value: string, key: string, values: readonly T[], missing: string[]): T {
  if ((values as readonly string[]).includes(value)) return value as T;
  missing.push(`answers.${key}`);
  return values[0];
}
function truthy(value: string): boolean { return ["true", "yes", "1", "on"].includes(value.toLowerCase()); }

export function normalizeTaiwanEntryPermitPortalPayload(payload: SubmissionPayload): TaiwanEntryPermitPortalPayload {
  const missing: string[] = [];
  if (payload.countryCode !== "TW") missing.push("countryCode");
  if (payload.visaType !== TW_ENTRY_PERMIT_VISA_TYPE) missing.push("visaType");
  const route = enumValue(required(payload, "eligibility_route", missing), "eligibility_route", ["student", "permanent_resident", "work_one_year", "dependent_with_funds", "accompanying_family"] as const, missing);
  const permitType = enumValue(required(payload, "permit_type", missing), "permit_type", ["single", "one_year_multiple"] as const, missing);
  const passportExpiryDate = required(payload, "passport_expiry_date", missing);
  if (passportExpiryDate && new Date(passportExpiryDate).getTime() < Date.now() + 183 * 24 * 60 * 60 * 1000) missing.push("answers.passport_expiry_date(minimum_six_months)");
  const officialDeclaration = truthy(answer(payload, "official_declaration"));
  if (!officialDeclaration) missing.push("answers.official_declaration");
  const output: TaiwanEntryPermitPortalPayload = {
    applicationId: payload.applicationId,
    aliasEmailAddress: required(payload, "alias_email_address", missing),
    realEmailAddress: answer(payload, "real_email_address") || answer(payload, "email_address") || null,
    eligibilityRoute: route,
    permitType,
    passportNumber: required(payload, "passport_number", missing),
    passportExpiryDate,
    surname: required(payload, "surname", missing),
    givenNames: required(payload, "given_names", missing),
    chineseName: required(payload, "chinese_name", missing),
    dateOfBirth: required(payload, "date_of_birth", missing),
    gender: enumValue(required(payload, "gender", missing), "gender", ["male", "female"] as const, missing),
    singaporeResidencePassNumber: required(payload, "singapore_residence_pass_number", missing),
    singaporeResidenceExpiryDate: required(payload, "singapore_residence_expiry_date", missing),
    phoneCountryCode: required(payload, "phone_country_code", missing),
    phoneNumber: required(payload, "phone_number", missing),
    intendedArrivalDate: required(payload, "intended_arrival_date", missing),
    intendedDepartureDate: required(payload, "intended_departure_date", missing),
    taiwanAccommodationAddress: required(payload, "taiwan_accommodation_address", missing),
    officialDeclaration,
  };
  if (output.intendedArrivalDate && output.intendedDepartureDate && output.intendedDepartureDate < output.intendedArrivalDate) missing.push("answers.intended_departure_date(after_arrival)");
  if (missing.length) throw new TaiwanEntryPermitValidationError(`Taiwan entry permit cannot be submitted: ${missing.join(", ")}.`, missing);
  return output;
}
