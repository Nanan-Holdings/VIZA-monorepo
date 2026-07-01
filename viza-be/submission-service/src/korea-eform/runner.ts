import type { Page } from "playwright";
import { fillKoreaOfficialEformFirstPage, type KoreaOfficialEformFillOptions } from "./portal";

export const KOREA_VISA_PORTAL_EFORM_URL = "https://www.visa.go.kr/openPage.do?MENU_ID=10204";

export interface KoreaOfficialEformPayload {
  applicationId: string;
  familyName: string | null;
  givenNames: string | null;
  dateOfBirth: string | null;
  gender: "male" | "female" | null;
  nationality: string | null;
  passportNumber: string | null;
  passportExpiryDate: string | null;
  passportIssueDate: string | null;
  email: string | null;
  phone: string | null;
  homeAddress: string | null;
  purpose: "tourism_transit" | "event" | "medical" | "business" | "family_visit" | "other";
  stayStatus: "C-3";
}

export interface KoreaOfficialEformInput {
  applicationId: string;
  answers: Record<string, string | null | undefined>;
  officialPdfStoragePath?: string | null;
  finalReviewApproved?: boolean;
}

export type KoreaOfficialEformResult =
  | {
      status: "official_eform_ready";
      applicationId: string;
      portalUrl: string;
      officialPdfStoragePath: string;
      message: string;
    }
  | {
      status: "manual_required";
      applicationId: string;
      portalUrl: string;
      manualActionType:
        | "official_eform_generation_required"
        | "official_eform_first_page_filled"
        | "official_eform_portal_review_required"
        | "official_eform_download_required"
        | "official_eform_unsupported_for_post";
      message: string;
      payload: KoreaOfficialEformPayload;
      evidence?: {
        filledSelectors?: string[];
        missingUploads?: string[];
      };
    }
  | {
      status: "validation_failed";
      applicationId: string;
      missingFields: string[];
      message: string;
    };

function readFirst(answers: Record<string, string | null | undefined>, keys: string[]): string | null {
  for (const key of keys) {
    const value = answers[key]?.trim();
    if (value) return value;
  }
  return null;
}

function normalizeGender(value: string | null): KoreaOfficialEformPayload["gender"] {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (["m", "male", "man", "男"].includes(normalized)) return "male";
  if (["f", "female", "woman", "女"].includes(normalized)) return "female";
  return null;
}

export function buildKoreaOfficialEformPayload(input: KoreaOfficialEformInput): KoreaOfficialEformPayload {
  const answers = input.answers;
  return {
    applicationId: input.applicationId,
    familyName: readFirst(answers, ["family_name", "surname", "last_name"]),
    givenNames: readFirst(answers, ["given_names", "given_name", "first_name"]),
    dateOfBirth: readFirst(answers, ["date_of_birth", "birth_date"]),
    gender: normalizeGender(readFirst(answers, ["gender", "sex"])),
    nationality: readFirst(answers, ["nationality", "current_nationality"]),
    passportNumber: readFirst(answers, ["passport_number"]),
    passportExpiryDate: readFirst(answers, ["passport_expiry_date", "passport_expiration_date"]),
    passportIssueDate: readFirst(answers, ["passport_issue_date"]),
    email: readFirst(answers, ["email", "email_address"]),
    phone: readFirst(answers, ["phone", "mobile_phone", "mobile_number"]),
    homeAddress: readFirst(answers, ["home_address", "current_address", "residential_address"]),
    purpose: "tourism_transit",
    stayStatus: "C-3",
  };
}

export function validateKoreaOfficialEformPayload(payload: KoreaOfficialEformPayload): string[] {
  const missing: string[] = [];
  if (!payload.familyName) missing.push("family_name");
  if (!payload.givenNames) missing.push("given_names");
  if (!payload.dateOfBirth) missing.push("date_of_birth");
  if (!payload.gender) missing.push("gender");
  if (!payload.nationality) missing.push("nationality");
  if (!payload.passportNumber) missing.push("passport_number");
  if (!payload.passportExpiryDate) missing.push("passport_expiry_date");
  if (!payload.email) missing.push("email");
  if (!payload.phone) missing.push("phone");
  if (!payload.homeAddress) missing.push("home_address");
  return missing;
}

export async function runKoreaOfficialEform(input: KoreaOfficialEformInput): Promise<KoreaOfficialEformResult> {
  if (input.officialPdfStoragePath?.trim()) {
    return {
      status: "official_eform_ready",
      applicationId: input.applicationId,
      portalUrl: KOREA_VISA_PORTAL_EFORM_URL,
      officialPdfStoragePath: input.officialPdfStoragePath.trim(),
      message: "Official Korea Visa Portal barcode e-Form PDF is available.",
    };
  }

  const payload = buildKoreaOfficialEformPayload(input);
  const missingFields = validateKoreaOfficialEformPayload(payload);
  if (missingFields.length > 0) {
    return {
      status: "validation_failed",
      applicationId: input.applicationId,
      missingFields,
      message: `Korea official e-Form requires missing fields: ${missingFields.join(", ")}`,
    };
  }

  if (process.env.KR_VISA_PORTAL_EFORM_LIVE_ENABLED !== "true") {
    return {
      status: "manual_required",
      applicationId: input.applicationId,
      portalUrl: KOREA_VISA_PORTAL_EFORM_URL,
      manualActionType: "official_eform_generation_required",
      message:
        "Korea Visa Portal e-Form live automation is disabled. Enable KR_VISA_PORTAL_EFORM_LIVE_ENABLED only after selectors, post search, document upload, CAPTCHA, and barcode PDF download are validated.",
      payload,
    };
  }

  if (!input.finalReviewApproved) {
    return {
      status: "manual_required",
      applicationId: input.applicationId,
      portalUrl: KOREA_VISA_PORTAL_EFORM_URL,
      manualActionType: "official_eform_portal_review_required",
      message:
        "Official Korea Visa Portal e-Form can be filled, but the applicant/operator must review the official page before final submission and barcode PDF download.",
      payload,
    };
  }

  return {
    status: "manual_required",
    applicationId: input.applicationId,
    portalUrl: KOREA_VISA_PORTAL_EFORM_URL,
    manualActionType: "official_eform_download_required",
    message:
      "Final review was approved. Continue in the validated Playwright portal session and persist the official barcode PDF before reporting success.",
    payload,
  };
}

export async function runKoreaOfficialEformLiveFill(
  page: Page,
  input: KoreaOfficialEformInput,
  options: KoreaOfficialEformFillOptions = {},
): Promise<KoreaOfficialEformResult> {
  const payload = buildKoreaOfficialEformPayload(input);
  const missingFields = validateKoreaOfficialEformPayload(payload);
  if (missingFields.length > 0) {
    return {
      status: "validation_failed",
      applicationId: input.applicationId,
      missingFields,
      message: `Korea official e-Form requires missing fields: ${missingFields.join(", ")}`,
    };
  }

  if (process.env.KR_VISA_PORTAL_EFORM_LIVE_ENABLED !== "true") {
    return {
      status: "manual_required",
      applicationId: input.applicationId,
      portalUrl: KOREA_VISA_PORTAL_EFORM_URL,
      manualActionType: "official_eform_generation_required",
      message:
        "Korea Visa Portal e-Form live fill is disabled. Set KR_VISA_PORTAL_EFORM_LIVE_ENABLED=true only for an authorized official portal run.",
      payload,
    };
  }

  const fillResult = await fillKoreaOfficialEformFirstPage(page, payload, options);
  return {
    status: "manual_required",
    applicationId: input.applicationId,
    portalUrl: fillResult.portalUrl,
    manualActionType: "official_eform_first_page_filled",
    message:
      "Korea Visa Portal e-Form first page was filled with VIZA answers. Review official fields, upload any missing files, then continue to the next official portal page.",
    payload,
    evidence: {
      filledSelectors: fillResult.filledSelectors,
      missingUploads: fillResult.missingUploads,
    },
  };
}
