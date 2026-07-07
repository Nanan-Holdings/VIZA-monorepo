import type { Page } from "playwright";
import {
  auditKoreaOfficialEformFirstPageFill,
  auditKoreaOfficialEformSecondPageFill,
  completeKoreaOfficialEformAndDownloadPdf,
  fillKoreaOfficialEformFirstPage,
  fillKoreaOfficialEformSecondPage,
  type KoreaOfficialEformFillOptions,
  type KoreaOfficialEformFillAuditItem,
} from "./portal";

export const KOREA_VISA_PORTAL_EFORM_URL = "https://www.visa.go.kr/openPage.do?MENU_ID=10204";

export interface KoreaOfficialEformPayload {
  applicationId: string;
  familyName: string | null;
  givenNames: string | null;
  dateOfBirth: string | null;
  gender: "male" | "female" | null;
  nationality: string | null;
  nationalIdentityNo: string | null;
  passportNumber: string | null;
  passportExpiryDate: string | null;
  passportIssueDate: string | null;
  passportPlaceOfIssue: string | null;
  email: string | null;
  phone: string | null;
  homeAddress: string | null;
  homeAddressStreet: string | null;
  homeAddressCity: string | null;
  homeAddressState: string | null;
  homeAddressCountry: string | null;
  purpose:
    | "tourism_transit"
    | "meeting_conference"
    | "medical_tourism"
    | "business_trip"
    | "study_training"
    | "work"
    | "trade_investment_ict"
    | "visiting_family_relatives_friends"
    | "overseas_korean_visit"
    | "marriage_migrant"
    | "diplomatic_official"
    | "other";
  stayStatus: "C-3";
}

export interface KoreaOfficialEformInput {
  applicationId: string;
  answers: Record<string, string | null | undefined>;
  officialPdfStoragePath?: string | null;
  finalReviewApproved?: boolean;
  pdfLanguage?: "zh-CN" | "en" | "ko" | null;
}

export type KoreaOfficialEformResult =
  | {
      status: "official_eform_ready";
      applicationId: string;
      portalUrl: string;
      officialPdfStoragePath: string;
      officialEformApplicationNumber?: string | null;
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
        fillAuditFailures?: KoreaOfficialEformFillAuditItem[];
        screenshotPath?: string;
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

function joinHomeAddress(answers: Record<string, string | null | undefined>): string | null {
  const direct = readFirst(answers, ["home_address", "home_country_address", "current_address", "current_residential_address", "residential_address"]);
  if (direct) return direct;
  const parts = [
    readFirst(answers, ["home_address_street"]),
    readFirst(answers, ["home_address_city"]),
    readFirst(answers, ["home_address_state"]),
    readFirst(answers, ["home_address_country"]),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function normalizePurpose(value: string | null): KoreaOfficialEformPayload["purpose"] {
  const normalized = value?.trim().toLowerCase();
  const allowed = new Set<KoreaOfficialEformPayload["purpose"]>([
    "tourism_transit",
    "meeting_conference",
    "medical_tourism",
    "business_trip",
    "study_training",
    "work",
    "trade_investment_ict",
    "visiting_family_relatives_friends",
    "overseas_korean_visit",
    "marriage_migrant",
    "diplomatic_official",
    "other",
  ]);
  return allowed.has(normalized as KoreaOfficialEformPayload["purpose"])
    ? (normalized as KoreaOfficialEformPayload["purpose"])
    : "tourism_transit";
}

export function buildKoreaOfficialEformPayload(input: KoreaOfficialEformInput): KoreaOfficialEformPayload {
  const answers = input.answers;
  return {
    applicationId: input.applicationId,
    familyName: readFirst(answers, ["family_name", "family_name_en", "surname", "last_name"]),
    givenNames: readFirst(answers, ["given_names", "given_names_en", "given_name", "first_name"]),
    dateOfBirth: readFirst(answers, ["date_of_birth", "birth_date"]),
    gender: normalizeGender(readFirst(answers, ["gender", "sex"])),
    nationality: readFirst(answers, ["nationality", "current_nationality"]),
    nationalIdentityNo: readFirst(answers, ["national_identity_no", "national_id_number"]),
    passportNumber: readFirst(answers, ["passport_number", "passport_no"]),
    passportExpiryDate: readFirst(answers, ["passport_expiry_date", "passport_expiration_date", "passport_date_of_expiry"]),
    passportIssueDate: readFirst(answers, ["passport_issue_date", "passport_date_of_issue"]),
    passportPlaceOfIssue: readFirst(answers, ["passport_place_of_issue", "passport_issue_place"]),
    email: readFirst(answers, ["email", "email_address"]),
    phone: readFirst(answers, ["phone", "mobile_phone", "mobile_number", "cell_phone"]),
    homeAddress: joinHomeAddress(answers),
    homeAddressStreet: readFirst(answers, ["home_address_street"]),
    homeAddressCity: readFirst(answers, ["home_address_city"]),
    homeAddressState: readFirst(answers, ["home_address_state"]),
    homeAddressCountry: readFirst(answers, ["home_address_country"]),
    purpose: normalizePurpose(readFirst(answers, ["purpose_of_visit"])),
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

  const fillResult = await fillKoreaOfficialEformFirstPage(page, payload, {
    ...options,
    pdfLanguage: options.pdfLanguage ?? input.pdfLanguage ?? "zh-CN",
  });
  const firstPageAudit = await auditKoreaOfficialEformFirstPageFill(page, payload, options);
  const firstPageAuditFailures = firstPageAudit.filter((item) => !item.ok);
  const canContinueToSecondPage =
    process.env.KR_VISA_PORTAL_EFORM_SECOND_PAGE_ENABLED === "true" &&
    fillResult.missingUploads.length === 0 &&
    firstPageAuditFailures.length === 0;

  if (canContinueToSecondPage) {
    const nextButton = page.locator("#REG_STEP1");
    await nextButton.waitFor({ state: "visible", timeout: 15000 });
    await nextButton.click();
    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    const secondPageResult = await fillKoreaOfficialEformSecondPage(page, input.answers);
    const secondPageAudit = await auditKoreaOfficialEformSecondPageFill(page, input.answers);
    const secondPageAuditFailures = secondPageAudit.filter((item) => !item.ok);

    if (secondPageAuditFailures.length > 0) {
      return {
        status: "manual_required",
        applicationId: input.applicationId,
        portalUrl: page.url(),
        manualActionType: "official_eform_portal_review_required",
        message:
          "Korea Visa Portal e-Form was filled, but VIZA detected official-page fields that did not retain their values. Review the audit failures before final submission.",
        payload,
        evidence: {
          filledSelectors: [...fillResult.filledSelectors, ...secondPageResult.filledSelectors],
          missingUploads: fillResult.missingUploads,
          fillAuditFailures: secondPageAuditFailures,
        },
      };
    }

    if (input.finalReviewApproved) {
      const completion = await completeKoreaOfficialEformAndDownloadPdf(page, input.applicationId);
      return {
        status: "official_eform_ready",
        applicationId: input.applicationId,
        portalUrl: page.url(),
        officialPdfStoragePath: completion.officialPdfStoragePath,
        officialEformApplicationNumber: completion.applicationNumber,
        message: completion.applicationNumber
          ? `Official Korea Visa Portal e-Form generated and downloaded. Application No.: ${completion.applicationNumber}`
          : "Official Korea Visa Portal e-Form generated and downloaded.",
      };
    }

    return {
      status: "manual_required",
      applicationId: input.applicationId,
      portalUrl: page.url(),
      manualActionType: "official_eform_portal_review_required",
      message:
        "Korea Visa Portal e-Form pages 1 and 2 were filled with VIZA answers. Review the official portal, confirm the final declaration yourself, then download the official barcode PDF.",
      payload,
      evidence: {
        filledSelectors: [...fillResult.filledSelectors, ...secondPageResult.filledSelectors],
        missingUploads: fillResult.missingUploads,
        fillAuditFailures: [],
      },
    };
  }

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
      fillAuditFailures: firstPageAuditFailures,
    },
  };
}
