import type { GenericSubmissionResult } from "../submission-result";
import { probeIndonesiaPortal, type IndonesiaPortalProbeResult } from "./runner";

export const INDONESIA_C1_PORTAL_URL = "https://evisa.imigrasi.go.id/";
export const INDONESIA_B1_EVOA_PORTAL_URL = INDONESIA_C1_PORTAL_URL;
export const INDONESIA_B1_EVOA_VFS_FALLBACK_PORTAL_URL =
  "https://indonesiavoa.vfsevisa.id/";

export type IndonesiaPackageKey = "c1" | "b1_evoa";
export type IndonesiaProvider = "indonesia_c1_live" | "indonesia_b1_evoa_live";

export interface IndonesiaNormalizeInput {
  applicationId: string;
  visaType: string;
  answers: Record<string, string | undefined>;
  officialReference?: string | null;
}

export interface NormalizedIndonesiaSubmission {
  applicationId: string;
  packageKey: IndonesiaPackageKey;
  provider: IndonesiaProvider;
  visaType: "ID_C1_TOURIST" | "ID_B1_EVOA";
  portalUrl: string;
  officialReference: string | null;
  fullName: string | null;
  motherFullName: string | null;
  passportNumber: string | null;
  passportCountry: string | null;
  email: string | null;
  mobileNumber: string | null;
  arrivalDate: string | null;
  departureDate: string | null;
  portOfEntry: string | null;
  accommodationName: string | null;
  accommodationAddress: string | null;
}

export interface IndonesiaLiveSubmissionInput extends IndonesiaNormalizeInput {
  managedAccountAvailable: boolean;
  managedAccountEmail?: string | null;
  managedAccountPassword?: string | null;
  applicantId?: string | null;
  passportImagePath?: string | null;
  photoImagePath?: string | null;
  returnTicketPath?: string | null;
  passportSupportPath?: string | null;
  profile?: {
    fullName?: string | null;
    gender?: string | null;
    dateOfBirth?: string | null;
    placeOfBirth?: string | null;
    nationality?: string | null;
    passportNumber?: string | null;
    passportIssueDate?: string | null;
    passportExpiryDate?: string | null;
    passportIssuingCountry?: string | null;
    passportIssuingAuthority?: string | null;
    phone?: string | null;
  };
  paymentAuthorized?: boolean;
  probeOfficialPortal?: boolean;
  portalProbeHeadless?: boolean;
  userPaymentHandoff?: {
    enabled?: boolean;
    waitTimeoutMs?: number;
    onWaitingForUser?: (snapshot: {
      url: string;
      title: string | null;
      state: IndonesiaPortalProbeResult["state"];
      diagnostics: string[];
    }) => Promise<void>;
  };
}

function normalizeVisaType(visaType: string): string {
  return visaType.trim().toUpperCase().replace(/[\s/-]+/g, "_");
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function readFirst(
  answers: Record<string, string | undefined>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = clean(answers[key]);
    if (value) return value;
  }
  return null;
}

function fullNameFromAnswers(answers: Record<string, string | undefined>): string | null {
  const fullName = readFirst(answers, [
    "full_name",
    "traveller_full_name",
    "applicant_full_name",
    "name_as_in_passport",
  ]);
  if (fullName) return fullName;

  const given = readFirst(answers, ["given_name", "given_names", "first_name"]);
  const surname = readFirst(answers, ["surname", "last_name", "family_name"]);
  return clean([given, surname].filter(Boolean).join(" "));
}

function packageForVisaType(visaType: string): {
  packageKey: IndonesiaPackageKey;
  provider: IndonesiaProvider;
  normalizedVisaType: "ID_C1_TOURIST" | "ID_B1_EVOA";
  portalUrl: string;
} {
  const normalized = normalizeVisaType(visaType);
  if (normalized === "ID_B1_EVOA" || normalized === "B1_EVOA" || normalized === "EVOA") {
    return {
      packageKey: "b1_evoa",
      provider: "indonesia_b1_evoa_live",
      normalizedVisaType: "ID_B1_EVOA",
      portalUrl: INDONESIA_B1_EVOA_PORTAL_URL,
    };
  }

  return {
    packageKey: "c1",
    provider: "indonesia_c1_live",
    normalizedVisaType: "ID_C1_TOURIST",
    portalUrl: INDONESIA_C1_PORTAL_URL,
  };
}

export function normalizeIndonesiaAnswers(
  input: IndonesiaNormalizeInput,
): NormalizedIndonesiaSubmission {
  const packageInfo = packageForVisaType(input.visaType);
  const answers = input.answers;

  return {
    applicationId: input.applicationId,
    packageKey: packageInfo.packageKey,
    provider: packageInfo.provider,
    visaType: packageInfo.normalizedVisaType,
    portalUrl: packageInfo.portalUrl,
    officialReference: clean(input.officialReference),
    fullName: fullNameFromAnswers(answers),
    motherFullName: readFirst(answers, [
      "mother_full_name",
      "mothers_full_name",
      "mother_name",
    ]),
    passportNumber: readFirst(answers, [
      "passport_number",
      "travel_document_number",
      "passport_no",
    ]),
    passportCountry: readFirst(answers, [
      "passport_country",
      "passport_issuing_country",
      "nationality",
      "citizenship",
      "country_of_citizenship",
    ]),
    email: readFirst(answers, [
      "email",
      "email_address",
      "contact_email",
      "applicant_email",
    ]),
    mobileNumber: readFirst(answers, [
      "mobile_number",
      "phone",
      "telephone_number",
      "contact_phone",
    ]),
    arrivalDate: readFirst(answers, [
      "arrival_date",
      "intended_date_of_entry",
      "date_of_arrival",
    ]),
    departureDate: readFirst(answers, [
      "departure_date",
      "intended_date_of_departure",
      "date_of_departure",
    ]),
    portOfEntry: readFirst(answers, [
      "port_of_entry",
      "arrival_port",
      "entry_port",
    ]),
    accommodationName: readFirst(answers, [
      "accommodation_name",
      "hotel_name",
      "place_of_stay",
    ]),
    accommodationAddress: readFirst(answers, [
      "accommodation_address",
      "hotel_address",
      "address_in_indonesia",
    ]),
  };
}

export async function runIndonesiaLiveSubmission(
  input: IndonesiaLiveSubmissionInput,
): Promise<GenericSubmissionResult> {
  const normalized = normalizeIndonesiaAnswers(input);
  const managedEmail = clean(input.managedAccountEmail);
  const managedPassword = clean(input.managedAccountPassword);

  if (!input.managedAccountAvailable || !managedEmail) {
    return {
      country: "GENERIC",
      targetCountry: "ID",
      visaType: normalized.visaType,
      status: "action_required",
      mode: "live_assisted",
      applicationId: input.applicationId,
      portalUrl: normalized.portalUrl,
      actionType: "managed_account_alias_unavailable",
      actionInstructions:
        "VIZA could not prepare a managed Indonesia portal alias email for this applicant. Retry after the applicant profile inbox alias is available.",
      implementationStatus: "blocked",
      message:
        "Indonesia live submission stopped before official portal login because the managed alias email is unavailable.",
    };
  }

  if (!input.paymentAuthorized && !input.probeOfficialPortal) {
    return {
      country: "GENERIC",
      targetCountry: "ID",
      visaType: normalized.visaType,
      status: "action_required",
      mode: "live_assisted",
      applicationId: input.applicationId,
      portalUrl: normalized.portalUrl,
      actionType: "official_fee_payment_required",
      actionInstructions:
        "VIZA prepared the managed official portal email. Provide an authorized official-fee card session before continuing to the Indonesia portal payment step.",
      implementationStatus: "partial",
      message:
        "Indonesia live submission is ready for official portal execution, but official-fee payment authorization is not attached yet.",
    };
  }

  if (input.probeOfficialPortal) {
    const probe = await probeIndonesiaPortal({
      portalUrl: normalized.portalUrl,
      provider: normalized.provider,
      visaType: normalized.visaType,
      applicationId: input.applicationId,
      passportCountry: normalized.passportCountry,
      applicantId: input.applicantId,
      accountEmail: managedEmail,
      accountPassword: managedPassword,
      registration: {
        fullName: normalized.fullName ?? input.profile?.fullName,
        gender: readFirst(input.answers, ["gender", "sex"]) ?? input.profile?.gender,
        birthPlace: readFirst(input.answers, ["birth_place", "place_of_birth"]) ?? input.profile?.placeOfBirth,
        dateOfBirth: readFirst(input.answers, ["date_of_birth", "birth_date", "birthday"]) ?? input.profile?.dateOfBirth,
        phoneCodeCountry: normalized.passportCountry ?? input.profile?.passportIssuingCountry ?? input.profile?.nationality,
        mobilePhone: normalized.mobileNumber ?? input.profile?.phone,
        motherName: normalized.motherFullName,
        passportNumber: normalized.passportNumber ?? input.profile?.passportNumber,
        passportCountry: normalized.passportCountry ?? input.profile?.passportIssuingCountry ?? input.profile?.nationality,
        passportIssueDate: readFirst(input.answers, ["passport_issue_date", "passport_issuance_date"]) ?? input.profile?.passportIssueDate,
        passportExpiryDate: readFirst(input.answers, ["passport_expiry_date", "passport_expiration_date"]) ?? input.profile?.passportExpiryDate,
        passportIssuePlace: readFirst(input.answers, ["passport_place_of_issue", "passport_issuance_city", "passport_issuing_authority"]) ?? input.profile?.passportIssuingAuthority,
        passportImagePath: input.passportImagePath,
        photoImagePath: input.photoImagePath,
      },
      application: {
        fullName: normalized.fullName ?? input.profile?.fullName,
        gender: readFirst(input.answers, ["gender", "sex"]) ?? input.profile?.gender,
        birthPlace: readFirst(input.answers, ["birth_place", "place_of_birth", "city_of_birth", "birth_city"]) ?? input.profile?.placeOfBirth,
        dateOfBirth: readFirst(input.answers, ["date_of_birth", "birth_date", "birthday", "dob"]) ?? input.profile?.dateOfBirth,
        mobilePhone: normalized.mobileNumber ?? input.profile?.phone,
        passportNumber: normalized.passportNumber ?? input.profile?.passportNumber,
        passportCountry: normalized.passportCountry ?? input.profile?.passportIssuingCountry ?? input.profile?.nationality,
        passportIssueDate: readFirst(input.answers, ["passport_issue_date", "passport_issuance_date", "date_of_issue", "passport_date_of_issue"]) ?? input.profile?.passportIssueDate,
        passportExpiryDate: readFirst(input.answers, ["passport_expiry_date", "passport_expiration_date", "valid_until", "passport_date_of_expiry"]) ?? input.profile?.passportExpiryDate,
        passportIssuePlace: readFirst(input.answers, ["passport_place_of_issue", "passport_issuance_city", "passport_issuing_authority"]) ?? input.profile?.passportIssuingAuthority,
        residenceType: readFirst(input.answers, ["residence_type", "accommodation_type", "stay_type"]) ?? "HOTEL",
        addressInIndonesia: normalized.accommodationAddress ?? readFirst(input.answers, ["address_in_indonesia", "us_address_street1", "us_address_street"]),
        postalCode: readFirst(input.answers, ["postal_code", "indonesia_postal_code"]),
        province: readFirst(input.answers, ["province", "province_name", "indonesia_province"]),
        city: normalized.accommodationName?.match(/jakarta/i) ? "JAKARTA" : readFirst(input.answers, ["city", "city_name", "accommodation_city_or_district", "indonesia_city"]),
        district: readFirst(input.answers, ["district", "district_name", "indonesia_district"]),
        village: readFirst(input.answers, ["village", "village_name", "indonesia_village"]),
        email: managedEmail,
        passportImagePath: input.passportImagePath,
        photoImagePath: input.photoImagePath,
        returnTicketPath: input.returnTicketPath,
        passportSupportPath: input.passportSupportPath,
      },
      headless: input.portalProbeHeadless ?? true,
      userPaymentHandoff: input.userPaymentHandoff,
    });
    return {
      country: "GENERIC",
      targetCountry: "ID",
      visaType: normalized.visaType,
      status: "action_required",
      mode: "live_assisted",
      applicationId: input.applicationId,
      portalUrl: probe.url,
      actionType: probe.actionType,
      actionInstructions: probe.instruction,
      implementationStatus: probe.implementationStatus,
      message:
        `${normalized.provider} reached Indonesia official portal state ${probe.state} at ${probe.url}. Diagnostics: ${probe.diagnostics.slice(-8).join("; ") || "none"}.`,
    };
  }

  return {
    country: "GENERIC",
    targetCountry: "ID",
    visaType: normalized.visaType,
    status: "action_required",
    mode: "live_assisted",
    applicationId: input.applicationId,
    portalUrl: normalized.portalUrl,
    actionType: "live_portal_recon_required",
    actionInstructions:
      `Continue in ${normalized.portalUrl} with the VIZA-managed account. Stop at 3DS/OTP, unknown payment gateway, or official anti-automation gate.`,
    implementationStatus: "partial",
    message:
      `${normalized.provider} normalized the application and prepared the managed account email; live portal selector recon is required before final automatic submit can be enabled.`,
  };
}
