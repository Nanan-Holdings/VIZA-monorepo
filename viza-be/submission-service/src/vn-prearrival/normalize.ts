import type { SubmissionPayload } from "../country-submissions/types";

export const VN_PREARRIVAL_OFFICIAL_PORTAL_URL = "https://prearrival.immigration.gov.vn/";

export interface VnPrearrivalPortalPayload {
  applicationId: string;
  fullName: string;
  dateOfBirth: string;
  sex: string;
  nationality: string;
  emailAddress: string;
  phoneCountryCode: string;
  phoneNumber: string;
  passportNumber: string;
  passportIssueDate: string;
  passportExpiryDate: string;
  entryPermissionType: string;
  entryPermissionNumber: string | null;
  arrivalDate: string;
  transportMode: string;
  flightOrTransportNumber: string;
  entryPort: string;
  countryBoarded: string;
  purposeOfEntry: string;
  purposeOfEntryOther: string | null;
  addressInVietnam: string;
  provinceCity: string;
  wardCommune: string | null;
  contactInVietnamName: string | null;
  contactInVietnamPhone: string | null;
  isGroupSubmission: boolean;
  finalDeclaration: boolean;
  officialFreeAcknowledgement: boolean;
  prearrivalWindowAcknowledgement: boolean;
  healthDeclarationStatus: string;
  healthGuidanceAcknowledgement: boolean;
}

export class VnPrearrivalPortalValidationError extends Error {
  readonly code = "vn_prearrival_portal_payload_validation_failed";

  constructor(message: string, readonly missingFields: string[]) {
    super(message);
    this.name = "VnPrearrivalPortalValidationError";
  }
}

function answer(payload: SubmissionPayload, key: string): string {
  return (payload.countrySpecific[key] ?? "").trim();
}

function requireAnswer(payload: SubmissionPayload, key: string, missing: string[]): string {
  const value = answer(payload, key);
  if (!value) missing.push(`answers.${key}`);
  return value;
}

function booleanAnswer(payload: SubmissionPayload, key: string): boolean {
  const value = answer(payload, key).toLowerCase();
  return value === "true" || value === "yes" || value === "1";
}

function requireBooleanTrue(payload: SubmissionPayload, key: string, missing: string[]): boolean {
  const value = booleanAnswer(payload, key);
  if (!value) missing.push(`answers.${key}`);
  return value;
}

export function normalizeVnPrearrivalPortalPayload(payload: SubmissionPayload): VnPrearrivalPortalPayload {
  const missing: string[] = [];
  if (payload.countryCode !== "VN") missing.push("countryCode");
  if (payload.visaType !== "VN_PREARRIVAL_DECLARATION") missing.push("visaType");

  const purposeOfEntry = requireAnswer(payload, "purpose_of_entry", missing);
  const healthDeclarationStatus = answer(payload, "health_declaration_status") || "inactive_no_routine_health_declaration";
  const isGroupSubmission = booleanAnswer(payload, "is_group_submission");
  if (isGroupSubmission) {
    missing.push("answers.is_group_submission(v1_individual_only)");
  }

  const normalized: VnPrearrivalPortalPayload = {
    applicationId: payload.applicationId,
    fullName: requireAnswer(payload, "full_name", missing),
    dateOfBirth: requireAnswer(payload, "date_of_birth", missing),
    sex: requireAnswer(payload, "sex", missing),
    nationality: requireAnswer(payload, "nationality", missing),
    emailAddress: requireAnswer(payload, "email_address", missing),
    phoneCountryCode: requireAnswer(payload, "phone_country_code", missing),
    phoneNumber: requireAnswer(payload, "phone_number", missing),
    passportNumber: requireAnswer(payload, "passport_number", missing),
    passportIssueDate: requireAnswer(payload, "passport_issue_date", missing),
    passportExpiryDate: requireAnswer(payload, "passport_expiry_date", missing),
    entryPermissionType: requireAnswer(payload, "entry_permission_type", missing),
    entryPermissionNumber: answer(payload, "entry_permission_number") || null,
    arrivalDate: requireAnswer(payload, "arrival_date", missing),
    transportMode: requireAnswer(payload, "transport_mode", missing),
    flightOrTransportNumber: requireAnswer(payload, "flight_or_transport_number", missing),
    entryPort: requireAnswer(payload, "entry_port", missing),
    countryBoarded: requireAnswer(payload, "country_boarded", missing),
    purposeOfEntry,
    purposeOfEntryOther: answer(payload, "purpose_of_entry_other") || null,
    addressInVietnam: requireAnswer(payload, "address_in_vietnam", missing),
    provinceCity: requireAnswer(payload, "province_city", missing),
    wardCommune: answer(payload, "ward_commune") || null,
    contactInVietnamName: answer(payload, "contact_in_vietnam_name") || null,
    contactInVietnamPhone: answer(payload, "contact_in_vietnam_phone") || null,
    isGroupSubmission,
    finalDeclaration: requireBooleanTrue(payload, "final_declaration", missing),
    officialFreeAcknowledgement: requireBooleanTrue(payload, "official_free_acknowledgement", missing),
    prearrivalWindowAcknowledgement: requireBooleanTrue(payload, "prearrival_window_acknowledgement", missing),
    healthDeclarationStatus,
    healthGuidanceAcknowledgement: booleanAnswer(payload, "health_guidance_acknowledgement"),
  };

  if (purposeOfEntry === "other" && !normalized.purposeOfEntryOther) {
    missing.push("answers.purpose_of_entry_other");
  }
  if (
    healthDeclarationStatus === "active_guidance_applies" &&
    !normalized.healthGuidanceAcknowledgement
  ) {
    missing.push("answers.health_guidance_acknowledgement");
  }

  if (missing.length > 0) {
    throw new VnPrearrivalPortalValidationError(
      `Vietnam Pre-Arrival declaration cannot be submitted because required fields are missing or unsupported: ${missing.join(", ")}.`,
      missing,
    );
  }

  return normalized;
}
