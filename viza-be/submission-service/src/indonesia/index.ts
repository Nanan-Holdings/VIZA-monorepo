import type { GenericEvisaSubmissionResult, GenericSubmissionResult } from "../submission-result";
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
  documentTravelType: string | null;
  passportCountry: string | null;
  email: string | null;
  phoneCountryCode: string | null;
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
  bankStatementPath?: string | null;
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
  onStage?: (stage: string, snapshot: { url: string; title?: string | null }) => Promise<void>;
}

export type IndonesiaLiveSubmissionResult =
  | (GenericSubmissionResult & { operatorDiagnostics?: string[] })
  | (GenericEvisaSubmissionResult & { country: "ID"; status: "submitted"; evidencePdf: Buffer });

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
    documentTravelType: readFirst(answers, [
      "document_travel_id",
      "document_type",
      "travel_document_type",
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
    phoneCountryCode: readFirst(answers, ["phone_country_code", "phone_code", "mobile_phone_country_code"]),
    mobileNumber: readFirst(answers, [
      "mobile_phone",
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
): Promise<IndonesiaLiveSubmissionResult> {
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
        documentTravelType: normalized.documentTravelType,
        fullName: normalized.fullName ?? input.profile?.fullName,
        gender: readFirst(input.answers, ["gender", "sex"]) ?? input.profile?.gender,
        birthPlace: readFirst(input.answers, ["birth_place", "place_of_birth"]) ?? input.profile?.placeOfBirth,
        dateOfBirth: readFirst(input.answers, ["date_of_birth", "birth_date", "birthday"]) ?? input.profile?.dateOfBirth,
        phoneCountryCode: normalized.phoneCountryCode,
        phoneCodeCountry: normalized.passportCountry ?? input.profile?.passportIssuingCountry ?? input.profile?.nationality,
        mobilePhone: normalized.mobileNumber ?? input.profile?.phone,
        motherName: normalized.motherFullName,
        passportNumber: normalized.passportNumber ?? input.profile?.passportNumber,
        passportCountry: normalized.passportCountry ?? input.profile?.passportIssuingCountry ?? input.profile?.nationality,
        passportIssueDate: readFirst(input.answers, ["passport_issue_date", "passport_issuance_date"]) ?? input.profile?.passportIssueDate,
        passportExpiryDate: readFirst(input.answers, ["passport_expiry_date", "passport_expiration_date"]) ?? input.profile?.passportExpiryDate,
        passportIssuingCountry: readFirst(input.answers, ["passport_issuing_country", "issuing_country"]) ?? input.profile?.passportIssuingCountry,
        passportIssuePlace: readFirst(input.answers, ["passport_place_of_issue", "passport_issuance_city", "passport_issuing_authority"]) ?? input.profile?.passportIssuingAuthority,
        passportImagePath: input.passportImagePath,
        photoImagePath: input.photoImagePath,
      },
      application: {
        documentTravelType: normalized.documentTravelType,
        fullName: normalized.fullName ?? input.profile?.fullName,
        gender: readFirst(input.answers, ["gender", "sex"]) ?? input.profile?.gender,
        birthPlace: readFirst(input.answers, ["birth_place", "place_of_birth", "city_of_birth", "birth_city"]) ?? input.profile?.placeOfBirth,
        dateOfBirth: readFirst(input.answers, ["date_of_birth", "birth_date", "birthday", "dob"]) ?? input.profile?.dateOfBirth,
        mobilePhone: normalized.mobileNumber ?? input.profile?.phone,
        passportNumber: normalized.passportNumber ?? input.profile?.passportNumber,
        passportCountry: normalized.passportCountry ?? input.profile?.passportIssuingCountry ?? input.profile?.nationality,
        passportIssueDate: readFirst(input.answers, ["passport_issue_date", "passport_issuance_date", "date_of_issue", "passport_date_of_issue"]) ?? input.profile?.passportIssueDate,
        passportExpiryDate: readFirst(input.answers, ["passport_expiry_date", "passport_expiration_date", "valid_until", "passport_date_of_expiry"]) ?? input.profile?.passportExpiryDate,
        passportIssuingCountry: readFirst(input.answers, ["passport_issuing_country", "issuing_country"]) ?? input.profile?.passportIssuingCountry,
        passportIssuePlace: readFirst(input.answers, ["passport_place_of_issue", "passport_issuance_city", "passport_issuing_authority"]) ?? input.profile?.passportIssuingAuthority,
        residenceType: readFirst(input.answers, ["residence_type", "accommodation_type", "stay_type"]) ?? "HOTEL",
        addressInIndonesia: normalized.accommodationAddress ??
          readFirst(input.answers, [
            "address_in_indonesia",
            "hotel_address",
            "accommodation_address",
            "place_of_stay",
            "indonesia_stay_address",
          ]) ??
          "Jalan MH Thamrin No. 1, Menteng, Jakarta Pusat",
        postalCode: readFirst(input.answers, ["postal_code", "indonesia_postal_code"]),
        province: readFirst(input.answers, ["province", "province_name", "indonesia_province"]),
        city: normalized.accommodationName?.match(/jakarta/i) ? "JAKARTA" : readFirst(input.answers, ["city", "city_name", "accommodation_city_or_district", "indonesia_city"]),
        district: readFirst(input.answers, ["district", "district_name", "indonesia_district"]),
        village: readFirst(input.answers, ["village", "village_name", "indonesia_village"]),
        email: managedEmail,
        passportImagePath: input.passportImagePath,
        photoImagePath: input.photoImagePath,
        returnTicketPath: input.returnTicketPath,
        bankStatementPath: input.bankStatementPath,
        passportSupportPath: input.passportSupportPath,
      },
      headless: input.portalProbeHeadless ?? true,
      userPaymentHandoff: input.userPaymentHandoff,
      onStage: input.onStage,
    });
    if (
      probe.state === "submitted_or_approved" &&
      probe.officialPaymentConfirmed &&
      probe.evidencePdf
    ) {
      return {
        country: "ID",
        status: "submitted",
        reference: probe.officialReference,
        portalUrl: probe.url,
        evidencePdf: probe.evidencePdf,
      };
    }
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
      operatorDiagnostics: probe.diagnostics.slice(-30),
      message: probe.state === "payment_failed" || probe.actionType === "official_step_2_validation_blocked"
        ? probe.instruction
        : `${normalized.provider} reached Indonesia official portal state ${probe.state}.`,
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
