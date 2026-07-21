"use server";

import { revalidatePath } from "next/cache";
// eslint-disable-next-line no-restricted-imports -- This is a server action module; uploads use service-role only after applicant ownership checks.
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getImpersonationSession } from "@/lib/impersonation-session";
import {
  getDestinationDisplayName,
  getDestinationDisplayNameZh,
  getDestinationFlag,
  getFormVisaType,
  getVisaTypeDisplayName,
  getVisaTypeDisplayNameZh,
} from "@/lib/visa-destinations";
import { normalizeBirthplace } from "@/lib/birthplace-options";
import { isVietnamEVisaApplication as isVietnamEVisaQueueApplication } from "@/lib/submission-queue";
import {
  resolveVisaFormSchemaVisaType,
  visaFormSchemaVisaTypesMatch,
} from "@/lib/visa-form-schema-aliases";
import {
  PassportOcrProviderError,
  extractPassportOcr,
} from "@/app/api/passport-ocr/provider";
import type {
  PassportOcrProviderResult,
  SupportedPassportMimeType,
} from "@/app/api/passport-ocr/types";
import {
  buildOfficialImageValidationMessage,
  validateOfficialDocumentImage,
  type DocumentImageSignals,
  type OfficialDocumentImageSlot,
} from "@/lib/document-image-validation";

type JsonRecord = Record<string, unknown>;

export type DocumentCenterResult =
  | { ok: true; data: DocumentCenterData }
  | { ok: false; code: "not_authenticated" | "not_found" | "server_error"; error: string };

export type DocumentMutationResult =
  | { ok: true }
  | { ok: false; code: "not_authenticated" | "not_found" | "invalid_request" | "server_error"; error: string };

export interface DocumentCenterData {
  applicantId: string;
  applications: DocumentApplication[];
  selectedApplication: DocumentApplication | null;
  packageSummary: DocumentPackageSummary | null;
  requirements: DocumentRequirement[];
  documents: ApplicationDocument[];
  ocrExtractions: PassportOcrExtraction[];
}

export interface DocumentApplication {
  id: string;
  country: string;
  visaType: string;
  countryName: string;
  countryNameZh: string;
  countryFlag: string;
  visaTypeLabel: string;
  visaTypeLabelZh: string;
  status: string;
  packageId: string | null;
  packageName: string | null;
  updatedAt: string | null;
  createdAt: string | null;
}

export interface DocumentPackageSummary {
  id: string | null;
  name: string;
  description: string | null;
  country: string;
  visaType: string;
  source: "document_requirements" | "package_metadata" | "fallback";
}

export interface DocumentRequirement {
  key: string;
  documentType: string;
  labelEn: string;
  labelZh: string;
  description: string | null;
  required: boolean;
  sortOrder: number;
  accept: string[];
  source: "document_requirements" | "package_metadata" | "fallback";
}

export interface ApplicationDocument {
  id: string;
  applicationId: string;
  documentType: string;
  requirementKey: string | null;
  filename: string | null;
  status: string;
  rejectionReason: string | null;
  required: boolean | null;
  reviewNotes: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  source: "application_documents" | "application_answer";
}

export interface PassportOcrExtraction {
  id: string;
  documentId: string | null;
  status: string;
  extractedFields: JsonRecord;
  errorMessage: string | null;
  confirmedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export type UniversalProfilePassportUploadStatus =
  | {
      ok: true;
      uploaded: boolean;
      fileName: string | null;
      status: string | null;
      updatedAt: string | null;
    }
  | { ok: false; code: "not_authenticated" | "not_found" | "server_error"; error: string };

export interface UniversalProfileReusableDocumentStatus {
  uploaded: boolean;
  fileName: string | null;
  status: string | null;
  updatedAt: string | null;
}

export type UniversalProfileReusableDocumentsResult =
  | {
      ok: true;
      documents: Record<"photo" | "signature", UniversalProfileReusableDocumentStatus>;
    }
  | { ok: false; code: "not_authenticated" | "not_found" | "server_error"; error: string };

interface ApplicantContext {
  applicantId: string;
  authUserId: string | null;
  email: string | null;
}

interface ApplicantProfileRow {
  id: string;
  auth_user_id?: string | null;
  email?: string | null;
}

interface ApplicationRow {
  id: string;
  country: string;
  visa_type: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  submitted_at?: string | null;
  visa_package_id: string | null;
  visa_packages?: VisaPackageRow | VisaPackageRow[] | null;
}

interface VisaPackageRow {
  id: string;
  country: string;
  visa_type: string;
  name: string | null;
  description: string | null;
  metadata: unknown;
}

interface UserPackageRow {
  id: string;
  visa_package_id: string | null;
  application_id: string | null;
  assigned_at: string | null;
  visa_packages: VisaPackageRow | VisaPackageRow[] | null;
}

interface DocumentRequirementRow {
  requirement_key: string;
  label_en: string;
  label_zh: string;
  description: string | null;
  required: boolean | null;
  sort_order: number | null;
  metadata: unknown;
}

interface ApplicationDocumentRow {
  id: string;
  application_id: string;
  document_type: string;
  requirement_key?: string | null;
  filename: string | null;
  status: string;
  rejection_reason: string | null;
  required?: boolean | null;
  review_notes?: string | null;
  reviewed_at?: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface UniversalProfileDocumentRow {
  id: string;
  applicant_id: string;
  auth_user_id?: string | null;
  document_type: string;
  storage_path: string;
  filename: string | null;
  status: string;
  source_application_id?: string | null;
  metadata?: unknown;
  created_at: string | null;
  updated_at: string | null;
}

interface AnswerRow {
  field_name: string;
  value_text: string | null;
  value_json?: unknown;
  updated_at: string | null;
}

interface OcrExtractionRow {
  id: string;
  document_id: string | null;
  status: string;
  extracted_fields: unknown;
  error_message: string | null;
  confirmed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

const FALLBACK_REQUIREMENTS: DocumentRequirement[] = [
  {
    key: "passport_copy",
    documentType: "passport_copy",
    labelEn: "Passport bio page",
    labelZh: "护照资料页",
    description: "Clear scan or photo of the passport bio-data page.",
    required: true,
    sortOrder: 10,
    accept: [".pdf", ".jpg", ".jpeg", ".png", ".webp"],
    source: "fallback",
  },
  {
    key: "photo",
    documentType: "photo",
    labelEn: "Passport-size photo",
    labelZh: "证件照",
    description: "Recent passport-style photo that follows the destination photo rules.",
    required: true,
    sortOrder: 20,
    accept: [".jpg", ".jpeg", ".png", ".webp"],
    source: "fallback",
  },
  {
    key: "travel_itinerary",
    documentType: "travel_itinerary",
    labelEn: "Travel itinerary",
    labelZh: "旅行行程",
    description: "Day-by-day route, dates, cities, and major planned activities.",
    required: true,
    sortOrder: 30,
    accept: [".pdf", ".doc", ".docx", ".json"],
    source: "fallback",
  },
  {
    key: "bank_statement",
    documentType: "bank_statement",
    labelEn: "Proof of funds",
    labelZh: "资金证明",
    description: "Recent bank statement or equivalent financial evidence.",
    required: true,
    sortOrder: 40,
    accept: [".pdf", ".jpg", ".jpeg", ".png", ".webp"],
    source: "fallback",
  },
  {
    key: "flight_booking",
    documentType: "flight_booking",
    labelEn: "Flight booking",
    labelZh: "机票预订",
    description: "Reservation or planned arrival and departure details, if available.",
    required: false,
    sortOrder: 50,
    accept: [".pdf", ".jpg", ".jpeg", ".png", ".webp"],
    source: "fallback",
  },
  {
    key: "hotel_booking",
    documentType: "hotel_booking",
    labelEn: "Accommodation booking",
    labelZh: "住宿预订",
    description: "Hotel, host, or accommodation confirmation, if available.",
    required: false,
    sortOrder: 60,
    accept: [".pdf", ".jpg", ".jpeg", ".png", ".webp"],
    source: "fallback",
  },
];

const VIETNAM_E_VISA_REQUIREMENTS: DocumentRequirement[] = [
  {
    key: "passport_copy",
    documentType: "passport_copy",
    labelEn: "Passport data page image",
    labelZh: "护照资料页图片",
    description: "Clear passport bio-data page image under 2MB, with a detectable face for Vietnam e-Visa matching.",
    required: true,
    sortOrder: 10,
    accept: [".jpg", ".jpeg", ".png", ".webp"],
    source: "fallback",
  },
  {
    key: "photo",
    documentType: "photo",
    labelEn: "Portrait photo",
    labelZh: "本人证件照片",
    description: "Recent front-facing portrait photo under 2MB that matches the passport data page face.",
    required: true,
    sortOrder: 20,
    accept: [".jpg", ".jpeg", ".png", ".webp"],
    source: "fallback",
  },
  {
    key: "travel_itinerary",
    documentType: "travel_itinerary",
    labelEn: "Travel itinerary",
    labelZh: "旅行行程（可选）",
    description: "Optional VIZA review aid. Vietnam official e-Visa intake does not require this upload by default.",
    required: false,
    sortOrder: 30,
    accept: [".pdf", ".doc", ".docx", ".json"],
    source: "fallback",
  },
];

const KOREA_C39_REQUIREMENTS: DocumentRequirement[] = [
  {
    key: "photo",
    documentType: "photo",
    labelEn: "Passport-size photo (optional)",
    labelZh: "证件照（选填）",
    description: "Optional 3.5cm x 4.5cm passport-style photo for completeness checks before the Korea visa appointment.",
    required: false,
    sortOrder: 10,
    accept: [".jpg", ".jpeg", ".png", ".webp"],
    source: "fallback",
  },
];

const PH_ETRAVEL_REQUIREMENTS: DocumentRequirement[] = [
  {
    key: "profile_photo",
    documentType: "applicant_photo",
    labelEn: "Profile photo",
    labelZh: "个人证件照",
    description: "Reuse the portrait saved in Universal Profile or upload a JPEG/PNG photo for the eTravel traveller record.",
    required: true,
    sortOrder: 10,
    accept: [".jpg", ".jpeg", ".png"],
    source: "fallback",
  },
  {
    key: "customs_signature_file",
    documentType: "customs_signature_file",
    labelEn: "For Customs — Declaration Signature",
    labelZh: "海关申报电子签名",
    description: "Upload the declaration signature image or PDF used for the Philippine customs declaration.",
    required: true,
    sortOrder: 20,
    accept: [".pdf", ".jpg", ".jpeg", ".png"],
    source: "fallback",
  },
];

const INDONESIA_B1_EVOA_REQUIREMENTS: DocumentRequirement[] = [
  {
    key: "passport_copy",
    documentType: "passport_copy",
    labelEn: "Passport bio page",
    labelZh: "护照资料页",
    description:
      "Official requirement: upload a sharp, in-focus, landscape passport bio page photo or scan. It must not be ghosted, covered, cropped, folded, or blurry.",
    required: true,
    sortOrder: 10,
    accept: [".pdf", ".jpg", ".jpeg", ".png", ".webp"],
    source: "fallback",
  },
  {
    key: "photo",
    documentType: "photo",
    labelEn: "Newest formal photo",
    labelZh: "近期证件照",
    description:
      "Official requirement: JPEG/JPG/PNG color photo, minimum 400x600px, maximum 2MB, proper composition. Head including hair to chin should be 50%-60% of image height; eye height should be 50%-60%. Avoid blurry, non-face, expression, too-close, or too-far photos.",
    required: true,
    sortOrder: 20,
    accept: [".jpg", ".jpeg", ".png"],
    source: "fallback",
  },
  {
    key: "return_ticket",
    documentType: "return_ticket",
    labelEn: "Return or onward ticket",
    labelZh: "返程或续程机票",
    description:
      "Official requirement: return ticket or onward ticket to continue the journey to another country. PDF format.",
    required: true,
    sortOrder: 30,
    accept: [".pdf"],
    source: "fallback",
  },
  {
    key: "passport_validity_support",
    documentType: "passport_validity_support",
    labelEn: "Passport validity support document",
    labelZh: "护照有效期支持材料",
    description:
      "Official support document: passport valid for at least 6 months. For travel documents other than passports, validity must be at least 12 months. PDF format only. VIZA can generate this PDF from the passport bio page when possible.",
    required: false,
    sortOrder: 40,
    accept: [".pdf"],
    source: "fallback",
  },
];

const INDONESIA_C1_TOURIST_REQUIREMENTS: DocumentRequirement[] = [
  {
    key: "passport_copy",
    documentType: "passport_copy",
    labelEn: "Passport bio page",
    labelZh: "护照资料页",
    description:
      "Official registration requirement: JPEG/JPG/PNG only. Upload a clear, complete bio page. The eVisa is electronically linked to this travel document and is valid only when travelling with it.",
    required: true,
    sortOrder: 10,
    accept: [".jpg", ".jpeg", ".png"],
    source: "fallback",
  },
  {
    key: "photo",
    documentType: "photo",
    labelEn: "Latest color photo",
    labelZh: "近期彩色证件照",
    description:
      "Official registration requirement: latest color photo facing forward, 4 x 6 cm, at least 400 x 600 pixels, in JPEG/JPG/PNG only.",
    required: true,
    sortOrder: 20,
    accept: [".jpg", ".jpeg", ".png"],
    source: "fallback",
  },
  {
    key: "bank_statement",
    documentType: "bank_statement",
    labelEn: "Personal bank statement with minimum USD 2,000 or equivalent",
    labelZh: "个人银行对账单（最低 USD 2,000 或等值金额）",
    description:
      "Official C1 requirement: personal bank statement for the last 3 months showing the applicant name, statement period, and account balance, with a minimum amount of USD 2,000 or equivalent. PDF format only.",
    required: true,
    sortOrder: 30,
    accept: [".pdf"],
    source: "fallback",
  },
];

const PASSPORT_DOCUMENT_TYPES = ["passport_copy", "passport_bio_page", "passport_scan", "passport"] as const;
const PHOTO_DOCUMENT_TYPES = [
  "photo",
  "applicant_photo",
  "profile_photo",
  "formal_photo",
  "formal_photo_upload",
  "passport_photo",
  "portrait_photo",
] as const;
const SIGNATURE_DOCUMENT_TYPES = ["electronic_signature", "customs_signature_file", "signature", "signature_image"] as const;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(record: JsonRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function getNumber(record: JsonRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

function getBoolean(record: JsonRecord, keys: string[]): boolean | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
    }
  }
  return null;
}

function getStringArray(record: JsonRecord, keys: string[]): string[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    }
  }
  return [];
}

function isVietnamEVisaDocumentApplication(application: ApplicationRow): boolean {
  return isVietnamEVisaQueueApplication(application.country, application.visa_type);
}

function isKoreaC39DocumentApplication(application: ApplicationRow): boolean {
  return (
    application.country === "south_korea" &&
    resolveVisaFormSchemaVisaType(getFormVisaType(application.visa_type), application.country) ===
      "KR_C39_SHORT_TERM_VISIT"
  );
}

function isIndonesiaB1EvoaDocumentApplication(application: ApplicationRow): boolean {
  return (
    application.country.toLowerCase() === "indonesia" &&
    resolveVisaFormSchemaVisaType(getFormVisaType(application.visa_type), application.country) === "ID_B1_EVOA"
  );
}

function isIndonesiaC1TouristDocumentApplication(application: ApplicationRow): boolean {
  return (
    application.country.toLowerCase() === "indonesia" &&
    resolveVisaFormSchemaVisaType(getFormVisaType(application.visa_type), application.country) === "ID_C1_TOURIST"
  );
}

function isPhilippinesEtravelDocumentApplication(application: ApplicationRow): boolean {
  return (
    ["philippines", "ph", "菲律宾"].includes(application.country.toLowerCase()) &&
    ["PH_ETRAVEL_ARRIVAL_CARD", "PH_ETRAVEL_DEPARTURE_CARD"].includes(
      resolveVisaFormSchemaVisaType(getFormVisaType(application.visa_type), application.country),
    )
  );
}

function isIndonesiaB1OfficialPdfDocument(documentType: string, requirementKey?: string): boolean {
  return [documentType, requirementKey].some((value) =>
    value === "return_ticket" || value === "passport_validity_support",
  );
}

function forceIndonesiaB1PdfRequirements(requirements: DocumentRequirement[]): DocumentRequirement[] {
  return requirements.map((requirement) =>
    isIndonesiaB1OfficialPdfDocument(requirement.documentType, requirement.key)
      ? { ...requirement, accept: [".pdf"] }
      : requirement,
  );
}

function forceIndonesiaC1RegistrationImageRequirements(requirements: DocumentRequirement[]): DocumentRequirement[] {
  return requirements.map((requirement) => {
    if ([requirement.key, requirement.documentType].some((value) =>
      ["passport_copy", "passport_bio_page", "passport_bio_page_upload"].includes(value),
    )) {
      return {
        ...requirement,
        accept: [".jpg", ".jpeg", ".png"],
        description:
          "Official registration requirement: JPEG/JPG/PNG only. Upload a clear, complete bio page. The eVisa is electronically linked to this travel document and is valid only when travelling with it.",
      };
    }
    if ([requirement.key, requirement.documentType].some((value) =>
      ["photo", "formal_photo", "formal_photo_upload"].includes(value),
    )) {
      return {
        ...requirement,
        accept: [".jpg", ".jpeg", ".png"],
        description:
          "Official registration requirement: latest color photo facing forward, 4 x 6 cm, at least 400 x 600 pixels, in JPEG/JPG/PNG only.",
      };
    }
    return requirement;
  });
}

function normalizeRequirementsForApplication(
  application: ApplicationRow,
  requirements: DocumentRequirement[],
): DocumentRequirement[] {
  if (isIndonesiaB1EvoaDocumentApplication(application)) {
    return forceIndonesiaB1PdfRequirements(requirements);
  }
  if (isIndonesiaC1TouristDocumentApplication(application)) {
    return forceIndonesiaC1RegistrationImageRequirements(requirements);
  }
  return requirements;
}

function cloneRequirements(requirements: DocumentRequirement[]): DocumentRequirement[] {
  return requirements.map((requirement) => ({
    ...requirement,
    accept: [...requirement.accept],
  }));
}

function fallbackLabelFor(key: string): Pick<DocumentRequirement, "labelEn" | "labelZh" | "description" | "accept"> {
  const fallback = FALLBACK_REQUIREMENTS.find(
    (requirement) => requirement.key === key || requirement.documentType === key,
  );

  if (fallback) {
    return {
      labelEn: fallback.labelEn,
      labelZh: fallback.labelZh,
      description: fallback.description,
      accept: fallback.accept,
    };
  }

  const label = key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return {
    labelEn: label || "Supporting document",
    labelZh: label || "补充文件",
    description: null,
    accept: [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".doc", ".docx"],
  };
}

function unwrapVisaPackage(value: VisaPackageRow | VisaPackageRow[] | null | undefined): VisaPackageRow | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeApplication(row: ApplicationRow): DocumentApplication {
  const packageRow = unwrapVisaPackage(row.visa_packages);
  const visaType = getFormVisaType(row.visa_type);

  return {
    id: row.id,
    country: row.country,
    visaType,
    countryName: getDestinationDisplayName(row.country),
    countryNameZh: getDestinationDisplayNameZh(row.country),
    countryFlag: getDestinationFlag(row.country),
    visaTypeLabel: getVisaTypeDisplayName(visaType),
    visaTypeLabelZh: getVisaTypeDisplayNameZh(visaType),
    status: row.status,
    packageId: row.visa_package_id ?? packageRow?.id ?? null,
    packageName: packageRow?.name ?? null,
    updatedAt: row.updated_at ?? row.submitted_at ?? row.created_at,
    createdAt: row.created_at,
  };
}

function selectDocumentApplication(
  applications: DocumentApplication[],
  params: LoadDocumentCenterParams,
): DocumentApplication | null {
  if (params.country && params.visaType) {
    const countryMatch = applications.find(
      (application) =>
        application.country.toLowerCase() === params.country!.toLowerCase() &&
        visaFormSchemaVisaTypesMatch(application.visaType, getFormVisaType(params.visaType!), application.country),
    );
    if (countryMatch) return countryMatch;
  }

  if (params.applicationId) {
    return applications.find((application) => application.id === params.applicationId) ?? null;
  }

  return applications[0] ?? null;
}

function normalizeRequirementRow(row: DocumentRequirementRow): DocumentRequirement {
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  const key = row.requirement_key;
  const labels = fallbackLabelFor(key);
  const documentType = getString(metadata, ["document_type", "documentType", "type"]) ?? key;

  return {
    key,
    documentType,
    labelEn: row.label_en || labels.labelEn,
    labelZh: row.label_zh || labels.labelZh,
    description: row.description ?? getString(metadata, ["description", "help_text", "helpText"]) ?? labels.description,
    required: row.required ?? true,
    sortOrder: row.sort_order ?? 0,
    accept: getStringArray(metadata, ["accept", "accepted_file_types", "acceptedFileTypes", "mime_types", "mimeTypes"])
      .concat(labels.accept)
      .filter((value, index, list) => list.indexOf(value) === index),
    source: "document_requirements",
  };
}

function normalizeMetadataChecklistItem(
  item: unknown,
  index: number,
  defaultRequired: boolean,
): DocumentRequirement | null {
  if (typeof item === "string") {
    const labels = fallbackLabelFor(item);
    return {
      key: item,
      documentType: item,
      labelEn: labels.labelEn,
      labelZh: labels.labelZh,
      description: labels.description,
      required: defaultRequired,
      sortOrder: index * 10,
      accept: labels.accept,
      source: "package_metadata",
    };
  }

  if (!isRecord(item)) return null;

  const key =
    getString(item, ["requirement_key", "requirementKey", "key", "id", "document_type", "documentType", "type"]) ??
    `supporting_document_${index + 1}`;
  const labels = fallbackLabelFor(key);
  const optional = getBoolean(item, ["optional"]);
  const explicitRequired = getBoolean(item, ["required", "is_required", "isRequired"]);
  const required = explicitRequired ?? (optional === null ? defaultRequired : !optional);

  return {
    key,
    documentType: getString(item, ["document_type", "documentType", "type"]) ?? key,
    labelEn: getString(item, ["label_en", "labelEn", "label", "name", "title"]) ?? labels.labelEn,
    labelZh: getString(item, ["label_zh", "labelZh", "zh", "name_zh", "nameZh"]) ?? labels.labelZh,
    description: getString(item, ["description", "help_text", "helpText"]) ?? labels.description,
    required,
    sortOrder: getNumber(item, ["sort_order", "sortOrder", "order"]) ?? index * 10,
    accept:
      getStringArray(item, ["accept", "accepted_file_types", "acceptedFileTypes", "mime_types", "mimeTypes"]).length > 0
        ? getStringArray(item, ["accept", "accepted_file_types", "acceptedFileTypes", "mime_types", "mimeTypes"])
        : labels.accept,
    source: "package_metadata",
  };
}

function getChecklistArray(metadata: JsonRecord): unknown[] {
  const direct = metadata.document_checklist ?? metadata.documentChecklist ?? metadata.documents;
  if (Array.isArray(direct)) return direct;

  if (isRecord(direct)) {
    const required = Array.isArray(direct.required) ? direct.required : [];
    const optional = Array.isArray(direct.optional) ? direct.optional : [];
    return [
      ...required.map((item) => ({ item, required: true })),
      ...optional.map((item) => ({ item, required: false })),
    ];
  }

  return [];
}

function normalizeMetadataChecklist(metadata: unknown): DocumentRequirement[] {
  if (!isRecord(metadata)) return [];

  return getChecklistArray(metadata)
    .map((item, index) => {
      if (isRecord(item) && "item" in item) {
        return normalizeMetadataChecklistItem(item.item, index, getBoolean(item, ["required"]) ?? true);
      }
      return normalizeMetadataChecklistItem(item, index, true);
    })
    .filter((requirement): requirement is DocumentRequirement => Boolean(requirement))
    .sort(sortRequirements);
}

function sortRequirements(a: DocumentRequirement, b: DocumentRequirement): number {
  if (a.required !== b.required) return a.required ? -1 : 1;
  return a.sortOrder - b.sortOrder || a.labelEn.localeCompare(b.labelEn);
}

function normalizeDocument(row: ApplicationDocumentRow): ApplicationDocument {
  return {
    id: row.id,
    applicationId: row.application_id,
    documentType: row.document_type,
    requirementKey: row.requirement_key ?? null,
    filename: row.filename,
    status: row.status,
    rejectionReason: row.rejection_reason,
    required: row.required ?? null,
    reviewNotes: row.review_notes ?? null,
    reviewedAt: row.reviewed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    source: "application_documents",
  };
}

function normalizeOcrExtraction(row: OcrExtractionRow): PassportOcrExtraction {
  return {
    id: row.id,
    documentId: row.document_id,
    status: row.status,
    extractedFields: isRecord(row.extracted_fields) ? row.extracted_fields : {},
    errorMessage: row.error_message,
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getApplicantContext(): Promise<
  | { ok: true; context: ApplicantContext }
  | { ok: false; code: "not_authenticated" | "server_error"; error: string }
> {
  const impersonation = await getImpersonationSession();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!impersonation && !user) {
    return { ok: false, code: "not_authenticated", error: "Not authenticated" };
  }

  const adminClient = createAdminClient();

  if (impersonation) {
    const { data: profileById } = await adminClient
      .from("applicant_profiles")
      .select("id, auth_user_id, email")
      .eq("id", impersonation.userId)
      .maybeSingle();

    if (profileById) {
      const profile = profileById as ApplicantProfileRow;
      return {
        ok: true,
        context: {
          applicantId: profile.id,
          authUserId: profile.auth_user_id ?? null,
          email: profile.email ?? impersonation.userEmail,
        },
      };
    }

    const { data: profileByEmail } = await adminClient
      .from("applicant_profiles")
      .select("id, auth_user_id, email")
      .eq("email", impersonation.userEmail)
      .maybeSingle();

    if (profileByEmail) {
      const profile = profileByEmail as ApplicantProfileRow;
      return {
        ok: true,
        context: {
          applicantId: profile.id,
          authUserId: profile.auth_user_id ?? null,
          email: profile.email ?? impersonation.userEmail,
        },
      };
    }

    return { ok: false, code: "not_authenticated", error: "No applicant profile found for impersonation session" };
  }

  if (!user?.email) {
    return { ok: false, code: "not_authenticated", error: "Not authenticated" };
  }

  const { data: profileByAuthUser } = await adminClient
    .from("applicant_profiles")
    .select("id, auth_user_id, email")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileByAuthUser) {
    const profile = profileByAuthUser as ApplicantProfileRow;
    return {
      ok: true,
      context: {
        applicantId: profile.id,
        authUserId: profile.auth_user_id ?? user.id,
        email: profile.email ?? user.email,
      },
    };
  }

  const { data: profileByEmail } = await adminClient
    .from("applicant_profiles")
    .select("id, auth_user_id, email")
    .eq("email", user.email)
    .maybeSingle();

  if (profileByEmail) {
    const profile = profileByEmail as ApplicantProfileRow;
    await adminClient.from("applicant_profiles").update({ auth_user_id: user.id }).eq("id", profile.id);
    return { ok: true, context: { applicantId: profile.id, authUserId: user.id, email: user.email } };
  }

  const { data: createdProfile, error: createError } = await adminClient
    .from("applicant_profiles")
    .insert({ auth_user_id: user.id, email: user.email, language_pref: "en" })
    .select("id")
    .single();

  if (createError || !createdProfile) {
    return { ok: false, code: "server_error", error: createError?.message ?? "Could not create applicant profile" };
  }

  return {
    ok: true,
    context: { applicantId: (createdProfile as ApplicantProfileRow).id, authUserId: user.id, email: user.email },
  };
}

async function getOwnedApplication(applicationId: string, applicantId: string): Promise<ApplicationRow | null> {
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("applications")
    .select("id, country, visa_type, status, created_at, updated_at, submitted_at, visa_package_id")
    .eq("id", applicationId)
    .eq("applicant_id", applicantId)
    .maybeSingle();

  return (data as ApplicationRow | null) ?? null;
}

async function loadApplications(applicantId: string): Promise<ApplicationRow[]> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("applications")
    .select(
      "id, country, visa_type, status, created_at, updated_at, submitted_at, visa_package_id, visa_packages(id, country, visa_type, name, description, metadata)",
    )
    .eq("applicant_id", applicantId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as ApplicationRow[];
}

async function loadActiveUserPackages(authUserId: string | null): Promise<UserPackageRow[]> {
  if (!authUserId) return [];

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("user_packages")
    .select("id, visa_package_id, application_id, assigned_at, visa_packages(id, country, visa_type, name, description, metadata)")
    .eq("auth_user_id", authUserId)
    .eq("status", "active")
    .order("assigned_at", { ascending: false });

  if (error || !data) return [];
  return data as UserPackageRow[];
}

function findApplicationForPackage(applications: ApplicationRow[], userPackage: UserPackageRow): ApplicationRow | null {
  const packageRow = unwrapVisaPackage(userPackage.visa_packages);
  if (!packageRow) return null;

  return (
    applications.find((application) => userPackage.application_id && application.id === userPackage.application_id) ??
    applications.find((application) => application.visa_package_id && application.visa_package_id === packageRow.id) ??
    applications.find(
      (application) =>
        application.country.toLowerCase() === packageRow.country.toLowerCase() &&
        visaFormSchemaVisaTypesMatch(
          getFormVisaType(application.visa_type),
          getFormVisaType(packageRow.visa_type),
          application.country,
        ),
    ) ??
    null
  );
}

async function ensureApplicationsForActivePackages(
  applicantId: string,
  userPackages: UserPackageRow[],
  applicationRows: ApplicationRow[],
): Promise<ApplicationRow[]> {
  if (userPackages.length === 0) return applicationRows;

  const adminClient = createAdminClient();
  const applications = [...applicationRows];

  for (const userPackage of userPackages) {
    const packageRow = unwrapVisaPackage(userPackage.visa_packages);
    if (!packageRow) continue;

    const existingApplication = findApplicationForPackage(applications, userPackage);
    if (existingApplication) {
      if (userPackage.application_id !== existingApplication.id) {
        await adminClient
          .from("user_packages")
          .update({ application_id: existingApplication.id, updated_at: new Date().toISOString() })
          .eq("id", userPackage.id);
      }
      continue;
    }

    const { data: newApplication, error } = await adminClient
      .from("applications")
      .insert({
        applicant_id: applicantId,
        status: "draft",
        country: packageRow.country,
        visa_type: packageRow.visa_type,
        visa_package_id: packageRow.id,
      })
      .select("id, country, visa_type, status, created_at, updated_at, submitted_at, visa_package_id")
      .single();

    if (error || !newApplication) continue;

    const application = {
      ...(newApplication as ApplicationRow),
      visa_packages: packageRow,
    };

    applications.push(application);
    await adminClient
      .from("user_packages")
      .update({ application_id: application.id, updated_at: new Date().toISOString() })
      .eq("id", userPackage.id);
  }

  return applications;
}

async function resolvePackage(application: ApplicationRow): Promise<VisaPackageRow | null> {
  const packageFromJoin = unwrapVisaPackage(application.visa_packages);
  if (packageFromJoin) return packageFromJoin;

  const adminClient = createAdminClient();

  if (application.visa_package_id) {
    const { data } = await adminClient
      .from("visa_packages")
      .select("id, country, visa_type, name, description, metadata")
      .eq("id", application.visa_package_id)
      .maybeSingle();

    if (data) return data as VisaPackageRow;
  }

  const { data } = await adminClient
    .from("visa_packages")
    .select("id, country, visa_type, name, description, metadata")
    .eq("country", application.country)
    .eq("visa_type", resolveVisaFormSchemaVisaType(getFormVisaType(application.visa_type), application.country))
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  return (data as VisaPackageRow | null) ?? null;
}

async function loadDocumentRequirements(application: ApplicationRow, packageRow: VisaPackageRow | null) {
  const adminClient = createAdminClient();
  const packageId = packageRow?.id ?? application.visa_package_id;

  // The official C1 intake owns this fixed set of documents. Do not allow an
  // older generic package checklist to reintroduce duplicate uploads or omit
  // the required three-month financial statement.
  if (isIndonesiaC1TouristDocumentApplication(application)) {
    return { source: "fallback" as const, requirements: cloneRequirements(INDONESIA_C1_TOURIST_REQUIREMENTS) };
  }
  if (isPhilippinesEtravelDocumentApplication(application)) {
    return { source: "fallback" as const, requirements: cloneRequirements(PH_ETRAVEL_REQUIREMENTS) };
  }

  if (packageId) {
    const { data, error } = await adminClient
      .from("document_requirements")
      .select("requirement_key, label_en, label_zh, description, required, sort_order, metadata")
      .eq("visa_package_id", packageId)
      .order("sort_order", { ascending: true });

    if (!error && data && data.length > 0) {
      return {
        source: "document_requirements" as const,
        requirements: normalizeRequirementsForApplication(application, (data as DocumentRequirementRow[]).map(normalizeRequirementRow).sort(sortRequirements)),
      };
    }
  }

  const { data, error } = await adminClient
    .from("document_requirements")
    .select("requirement_key, label_en, label_zh, description, required, sort_order, metadata")
    .eq("country", application.country)
    .eq("visa_type", resolveVisaFormSchemaVisaType(getFormVisaType(application.visa_type), application.country))
    .order("sort_order", { ascending: true });

  if (!error && data && data.length > 0) {
    return {
      source: "document_requirements" as const,
        requirements: normalizeRequirementsForApplication(application, (data as DocumentRequirementRow[]).map(normalizeRequirementRow).sort(sortRequirements)),
    };
  }

  const metadataRequirements = normalizeMetadataChecklist(packageRow?.metadata);
  if (metadataRequirements.length > 0) {
    return { source: "package_metadata" as const, requirements: metadataRequirements };
  }

  if (isVietnamEVisaDocumentApplication(application)) {
    return { source: "fallback" as const, requirements: cloneRequirements(VIETNAM_E_VISA_REQUIREMENTS) };
  }

  if (isKoreaC39DocumentApplication(application)) {
    return { source: "fallback" as const, requirements: cloneRequirements(KOREA_C39_REQUIREMENTS) };
  }

  if (isIndonesiaB1EvoaDocumentApplication(application)) {
    return { source: "fallback" as const, requirements: cloneRequirements(INDONESIA_B1_EVOA_REQUIREMENTS) };
  }

  if (isIndonesiaC1TouristDocumentApplication(application)) {
    return { source: "fallback" as const, requirements: cloneRequirements(INDONESIA_C1_TOURIST_REQUIREMENTS) };
  }

  return { source: "fallback" as const, requirements: FALLBACK_REQUIREMENTS };
}

async function loadDocuments(applicationId: string): Promise<ApplicationDocument[]> {
  const adminClient = createAdminClient();
  const extendedSelect =
    "id, application_id, document_type, requirement_key, filename, status, rejection_reason, required, review_notes, reviewed_at, created_at, updated_at";
  const baseSelect = "id, application_id, document_type, filename, status, rejection_reason, created_at, updated_at";

  const { data, error } = await adminClient
    .from("application_documents")
    .select(extendedSelect)
    .eq("application_id", applicationId)
    .order("updated_at", { ascending: false, nullsFirst: false });

  if (!error && data) return (data as ApplicationDocumentRow[]).map(normalizeDocument);

  const { data: baseData } = await adminClient
    .from("application_documents")
    .select(baseSelect)
    .eq("application_id", applicationId)
    .order("updated_at", { ascending: false, nullsFirst: false });

  return ((baseData ?? []) as ApplicationDocumentRow[]).map(normalizeDocument);
}

async function loadLatestReusablePassportDocument(applicantId: string): Promise<ApplicationDocument | null> {
  const adminClient = createAdminClient();
  const { data: applications, error: applicationsError } = await adminClient
    .from("applications")
    .select("id")
    .eq("applicant_id", applicantId);

  if (applicationsError || !applications?.length) return null;

  const applicationIds = (applications as Array<{ id: string }>).map((application) => application.id).filter(Boolean);
  if (applicationIds.length === 0) return null;

  const { data, error } = await adminClient
    .from("application_documents")
    .select("id, application_id, document_type, filename, status, rejection_reason, created_at, updated_at")
    .in("application_id", applicationIds)
    .in("document_type", [...PASSPORT_DOCUMENT_TYPES])
    .neq("status", "missing")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return normalizeDocument(data as ApplicationDocumentRow);
}

async function loadLatestUniversalProfilePassportDocument(
  applicantId: string,
): Promise<UniversalProfileDocumentRow | null> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("universal_profile_documents")
    .select("id, applicant_id, auth_user_id, document_type, storage_path, filename, status, source_application_id, metadata, created_at, updated_at")
    .eq("applicant_id", applicantId)
    .in("document_type", [...PASSPORT_DOCUMENT_TYPES])
    .neq("status", "missing")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as UniversalProfileDocumentRow;
}

function toPassportUploadStatus(passportDocument: ApplicationDocument | UniversalProfileDocumentRow): UniversalProfilePassportUploadStatus {
  const filename = "filename" in passportDocument ? passportDocument.filename : null;
  const status = "status" in passportDocument ? passportDocument.status : null;
  const updatedAt =
    "updatedAt" in passportDocument
      ? passportDocument.updatedAt ?? passportDocument.createdAt
      : passportDocument.updated_at ?? passportDocument.created_at;

  return {
    ok: true,
    uploaded: status !== "missing",
    fileName: filename,
    status,
    updatedAt,
  };
}

export async function loadUniversalProfilePassportUploadStatus(
  applicationId: string | null | undefined,
): Promise<UniversalProfilePassportUploadStatus> {
  try {
    const contextResult = await getApplicantContext();
    if (!contextResult.ok) return contextResult;

    const universalPassportDocument = await loadLatestUniversalProfilePassportDocument(contextResult.context.applicantId);
    if (universalPassportDocument) return toPassportUploadStatus(universalPassportDocument);

    if (!applicationId) {
      return { ok: true, uploaded: false, fileName: null, status: null, updatedAt: null };
    }

    const application = await getOwnedApplication(applicationId, contextResult.context.applicantId);
    if (!application) return { ok: false, code: "not_found", error: "Application not found" };

    const documents = await loadDocuments(applicationId);
    const passportDocuments = documents.filter((document) =>
      PASSPORT_DOCUMENT_TYPES.includes(document.documentType as (typeof PASSPORT_DOCUMENT_TYPES)[number]),
    );
    const passportDocument = passportDocuments.find((document) => document.status !== "missing") ?? passportDocuments[0];

    if (!passportDocument || passportDocument.status === "missing") {
      const reusablePassportDocument = await loadLatestReusablePassportDocument(contextResult.context.applicantId);
      return reusablePassportDocument
        ? toPassportUploadStatus(reusablePassportDocument)
        : { ok: true, uploaded: false, fileName: null, status: null, updatedAt: null };
    }

    return toPassportUploadStatus(passportDocument);
  } catch (error) {
    return {
      ok: false,
      code: "server_error",
      error: error instanceof Error ? error.message : "Failed to load passport upload status",
    };
  }
}

export async function loadUniversalProfileReusableDocumentStatuses(): Promise<UniversalProfileReusableDocumentsResult> {
  const emptyStatus: UniversalProfileReusableDocumentStatus = {
    uploaded: false,
    fileName: null,
    status: null,
    updatedAt: null,
  };

  try {
    const contextResult = await getApplicantContext();
    if (!contextResult.ok) return contextResult;

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from("universal_profile_documents")
      .select("document_type, filename, status, created_at, updated_at")
      .eq("applicant_id", contextResult.context.applicantId)
      .in("document_type", [...PHOTO_DOCUMENT_TYPES, ...SIGNATURE_DOCUMENT_TYPES])
      .neq("status", "missing")
      .order("updated_at", { ascending: false, nullsFirst: false });

    if (error) {
      if (isMissingUniversalProfileDocumentsError(error)) {
        return { ok: true, documents: { photo: emptyStatus, signature: emptyStatus } };
      }
      return { ok: false, code: "server_error", error: error.message };
    }

    const rows = (data ?? []) as Array<Pick<UniversalProfileDocumentRow, "document_type" | "filename" | "status" | "created_at" | "updated_at">>;
    const toStatus = (documentTypes: readonly string[]): UniversalProfileReusableDocumentStatus => {
      const row = rows.find((candidate) => documentTypes.includes(candidate.document_type));
      if (!row) return { ...emptyStatus };
      return {
        uploaded: true,
        fileName: row.filename,
        status: row.status,
        updatedAt: row.updated_at ?? row.created_at,
      };
    };

    return {
      ok: true,
      documents: {
        photo: toStatus(PHOTO_DOCUMENT_TYPES),
        signature: toStatus(SIGNATURE_DOCUMENT_TYPES),
      },
    };
  } catch (error) {
    return {
      ok: false,
      code: "server_error",
      error: error instanceof Error ? error.message : "Failed to load reusable profile documents",
    };
  }
}

async function loadVirtualAnswerDocuments(applicationId: string): Promise<ApplicationDocument[]> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("visa_application_answers")
    .select("field_name, value_text, value_json, updated_at")
    .eq("application_id", applicationId)
    .in("field_name", ["photo_path"]);

  if (error || !data) return [];

  return (data as AnswerRow[])
    .filter((row) => row.field_name === "photo_path" && Boolean(row.value_text?.trim()))
    .map((row) => ({
      id: `answer:${row.field_name}`,
      applicationId,
      documentType: "photo",
      requirementKey: "photo",
      filename: "Photo from application form",
      status: "uploaded",
      rejectionReason: null,
      required: true,
      reviewNotes: "Photo was uploaded inside the application form.",
      reviewedAt: null,
      createdAt: row.updated_at,
      updatedAt: row.updated_at,
      source: "application_answer" as const,
    }));
}

async function loadOcrExtractions(applicationId: string): Promise<PassportOcrExtraction[]> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("ocr_extractions")
    .select("id, document_id, status, extracted_fields, error_message, confirmed_at, created_at, updated_at")
    .eq("application_id", applicationId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(5);

  if (error || !data) return [];
  return (data as OcrExtractionRow[]).map(normalizeOcrExtraction);
}

function mergeVirtualDocuments(documents: ApplicationDocument[], virtualDocuments: ApplicationDocument[]) {
  const documentTypes = new Set(documents.map((document) => document.documentType));
  return [...documents, ...virtualDocuments.filter((document) => !documentTypes.has(document.documentType))];
}

export interface LoadDocumentCenterParams {
  applicationId?: string | null;
  country?: string | null;
  visaType?: string | null;
}

export async function loadDocumentCenterData(params: LoadDocumentCenterParams = {}): Promise<DocumentCenterResult> {
  try {
    const contextResult = await getApplicantContext();
    if (!contextResult.ok) return contextResult;

    const { applicantId, authUserId } = contextResult.context;
    const [rawApplicationRows, activeUserPackages] = await Promise.all([
      loadApplications(applicantId),
      loadActiveUserPackages(authUserId),
    ]);
    const applicationRows = await ensureApplicationsForActivePackages(applicantId, activeUserPackages, rawApplicationRows);
    const applications = applicationRows.map(normalizeApplication);
    const selectedApplication = selectDocumentApplication(applications, params);

    if (!selectedApplication) {
      return {
        ok: true,
        data: {
          applicantId,
          applications,
          selectedApplication: null,
          packageSummary: null,
          requirements: [],
          documents: [],
          ocrExtractions: [],
        },
      };
    }

    const selectedApplicationRow = applicationRows.find((application) => application.id === selectedApplication.id);
    if (!selectedApplicationRow) {
      return { ok: false, code: "not_found", error: "Application not found" };
    }

    const packageRow = await resolvePackage(selectedApplicationRow);
    const requirementResult = await loadDocumentRequirements(selectedApplicationRow, packageRow);
    const [storedDocuments, virtualDocuments, ocrExtractions] = await Promise.all([
      loadDocuments(selectedApplication.id),
      loadVirtualAnswerDocuments(selectedApplication.id),
      loadOcrExtractions(selectedApplication.id),
    ]);

    return {
      ok: true,
      data: {
        applicantId,
        applications,
        selectedApplication,
        packageSummary: {
          id: packageRow?.id ?? selectedApplication.packageId,
          name:
            packageRow?.name ??
            selectedApplication.packageName ??
            `${selectedApplication.countryName} ${selectedApplication.visaTypeLabel}`,
          description: packageRow?.description ?? null,
          country: selectedApplication.country,
          visaType: selectedApplication.visaType,
          source: requirementResult.source,
        },
        requirements: requirementResult.requirements,
        documents: mergeVirtualDocuments(storedDocuments, virtualDocuments),
        ocrExtractions,
      },
    };
  } catch (error) {
    return {
      ok: false,
      code: "server_error",
      error: error instanceof Error ? error.message : "Failed to load documents",
    };
  }
}

export interface RecordDocumentUploadInput {
  applicationId: string;
  documentType: string;
  requirementKey: string;
  filename: string;
  storagePath: string;
  required: boolean;
  source?: "manual_upload" | "travel_ai";
  scope?: "application" | "universal_profile";
}

export async function reuseUniversalProfileDocument(input: {
  applicationId: string;
  documentType: string;
  requirementKey: string;
  required: boolean;
}): Promise<DocumentMutationResult> {
  try {
    const contextResult = await getApplicantContext();
    if (!contextResult.ok) return contextResult;

    const application = await getOwnedApplication(input.applicationId, contextResult.context.applicantId);
    if (!application) return { ok: false, code: "not_found", error: "Application not found" };

    const types = PASSPORT_DOCUMENT_TYPES.includes(input.documentType as (typeof PASSPORT_DOCUMENT_TYPES)[number])
      ? [...PASSPORT_DOCUMENT_TYPES]
      : PHOTO_DOCUMENT_TYPES.includes(input.documentType as (typeof PHOTO_DOCUMENT_TYPES)[number])
        ? [...PHOTO_DOCUMENT_TYPES]
        : SIGNATURE_DOCUMENT_TYPES.includes(input.documentType as (typeof SIGNATURE_DOCUMENT_TYPES)[number])
          ? [...SIGNATURE_DOCUMENT_TYPES]
          : [input.documentType];
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from("universal_profile_documents")
      .select("storage_path, filename, document_type, status")
      .eq("applicant_id", contextResult.context.applicantId)
      .in("document_type", types)
      .neq("status", "missing")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    // Older databases may not have the universal document table yet. The
    // application-document fallback below remains a valid reusable source.
    if (error && !isMissingUniversalProfileDocumentsError(error)) {
      return { ok: false, code: "server_error", error: error.message };
    }

    let reusableDocument = error ? null : data;
    if (!reusableDocument?.storage_path) {
      const { data: ownedApplications, error: ownedApplicationsError } = await adminClient
        .from("applications")
        .select("id")
        .eq("applicant_id", contextResult.context.applicantId);
      if (ownedApplicationsError) {
        return { ok: false, code: "server_error", error: ownedApplicationsError.message };
      }
      const applicationIds = (ownedApplications ?? []).map((row: { id: string }) => row.id).filter(Boolean);
      if (applicationIds.length > 0) {
        const { data: applicationDocument, error: applicationDocumentError } = await adminClient
          .from("application_documents")
          .select("storage_path, filename, document_type, status")
          .in("application_id", applicationIds)
          .in("document_type", types)
          .neq("status", "missing")
          .order("updated_at", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();
        if (applicationDocumentError) {
          return { ok: false, code: "server_error", error: applicationDocumentError.message };
        }
        reusableDocument = applicationDocument;
      }
    }
    if (!reusableDocument?.storage_path) {
      return { ok: false, code: "not_found", error: "No saved profile document is available" };
    }

    return recordDocumentUpload({
      applicationId: input.applicationId,
      documentType: input.documentType,
      requirementKey: input.requirementKey,
      filename: reusableDocument.filename ?? `${input.documentType}-profile-document`,
      storagePath: reusableDocument.storage_path,
      required: input.required,
      source: "manual_upload",
    });
  } catch (error) {
    return {
      ok: false,
      code: "server_error",
      error: error instanceof Error ? error.message : "Failed to reuse profile document",
    };
  }
}

const APPLICATION_DOCUMENTS_BUCKET = "application-documents";
const APPLICATION_DOCUMENTS_MAX_BYTES = 50 * 1024 * 1024;
const VIETNAM_OFFICIAL_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const VIETNAM_OFFICIAL_IMAGE_DOCUMENT_TYPES = new Set(["passport_copy", "photo"]);
const VIETNAM_OFFICIAL_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIETNAM_OFFICIAL_IMAGE_OCR_MIME_TYPES = new Set<SupportedPassportMimeType>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function getFormDataString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getFormDataBoolean(formData: FormData, key: string): boolean {
  return getFormDataString(formData, key) !== "false";
}

function sanitizeUploadFilename(name: string): string {
  const cleaned = name.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_");
  const fallback = cleaned || "document";
  return fallback.length > 120 ? fallback.slice(fallback.length - 120) : fallback;
}

function isLegacyDocumentSchemaError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST204" ||
    message.includes("schema cache") ||
    message.includes("required column") ||
    message.includes("requirement_key") ||
    message.includes("review_notes") ||
    message.includes("no unique or exclusion constraint")
  );
}

function isMissingUniversalProfileDocumentsError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST204" ||
    message.includes("universal_profile_documents") ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("relation")
  );
}

async function ensureApplicationDocumentsBucketWithAdmin(adminClient: ReturnType<typeof createAdminClient>) {
  const { data: bucket, error: bucketError } = await adminClient.storage.getBucket(APPLICATION_DOCUMENTS_BUCKET);
  if (bucket && !bucketError) return null;

  const { error: createError } = await adminClient.storage.createBucket(APPLICATION_DOCUMENTS_BUCKET, {
    public: false,
    fileSizeLimit: APPLICATION_DOCUMENTS_MAX_BYTES,
  });

  if (createError && !createError.message.toLowerCase().includes("already exists")) {
    return createError.message;
  }

  return null;
}

export async function ensureApplicationDocumentsBucket(): Promise<DocumentMutationResult> {
  try {
    const contextResult = await getApplicantContext();
    if (!contextResult.ok) return contextResult;

    const adminClient = createAdminClient();
    const bucketError = await ensureApplicationDocumentsBucketWithAdmin(adminClient);
    if (bucketError) return { ok: false, code: "server_error", error: bucketError };

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      code: "server_error",
      error: error instanceof Error ? error.message : "Failed to prepare document storage",
    };
  }
}

function getVietnamOfficialImageSlot(documentType: string): OfficialDocumentImageSlot | null {
  if (documentType === "photo") return "portrait_photo";
  if (documentType === "passport_copy") return "passport_data_page";
  return null;
}

function isSupportedVietnamOfficialImageOcrMimeType(mimeType: string): mimeType is SupportedPassportMimeType {
  return VIETNAM_OFFICIAL_IMAGE_OCR_MIME_TYPES.has(mimeType as SupportedPassportMimeType);
}

function countPassportOcrFields(result: PassportOcrProviderResult): number {
  return Object.values(result.fields).filter((field) => Boolean(field.value?.trim())).length;
}

function passportOcrText(result: PassportOcrProviderResult): string {
  return Object.values(result.fields)
    .map((field) => field.value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

async function readVietnamOfficialImageSignals(input: {
  file: File;
  runPassportOcr: boolean;
}): Promise<DocumentImageSignals> {
  const mimeType = input.file.type.toLowerCase();
  const bytes = Buffer.from(await input.file.arrayBuffer());
  const signals: DocumentImageSignals = {
    mimeType,
    sizeBytes: input.file.size,
  };

  try {
    const sharp = (await import("sharp")).default;
    const metadata = await sharp(bytes).metadata();
    signals.width = metadata.width ?? null;
    signals.height = metadata.height ?? null;
  } catch {
    signals.width = null;
    signals.height = null;
  }

  if (!input.runPassportOcr || !isSupportedVietnamOfficialImageOcrMimeType(mimeType)) {
    return signals;
  }

  try {
    const result = await extractPassportOcr({
      bytes,
      filename: input.file.name || "upload",
      mimeType,
    });
    signals.readablePassport = result.isReadable;
    signals.passportFieldCount = countPassportOcrFields(result);
    signals.ocrText = passportOcrText(result);
  } catch (error) {
    if (error instanceof PassportOcrProviderError && error.code === "unreadable") {
      signals.readablePassport = false;
      signals.passportFieldCount = 0;
    }
  }

  return signals;
}

async function validateVietnamOfficialImageUpload(input: {
  application: ApplicationRow;
  documentType: string;
  file: File;
}): Promise<string | null> {
  if (!isVietnamEVisaDocumentApplication(input.application)) return null;
  if (!VIETNAM_OFFICIAL_IMAGE_DOCUMENT_TYPES.has(input.documentType)) return null;

  const expected = getVietnamOfficialImageSlot(input.documentType);
  if (!expected) return null;
  const mimeType = input.file.type.toLowerCase();
  const runPassportOcr =
    input.file.size <= VIETNAM_OFFICIAL_IMAGE_MAX_BYTES &&
    isSupportedVietnamOfficialImageOcrMimeType(mimeType);
  const signals = await readVietnamOfficialImageSignals({ file: input.file, runPassportOcr });
  const validation = validateOfficialDocumentImage({
    expected,
    signals,
    maxBytes: VIETNAM_OFFICIAL_IMAGE_MAX_BYTES,
    allowedMimeTypes: VIETNAM_OFFICIAL_IMAGE_MIME_TYPES,
  });

  return validation.ok ? null : buildOfficialImageValidationMessage(validation.issues, "zh");
}

async function validateIndonesiaB1OfficialPdfUpload(input: {
  application: ApplicationRow;
  documentType: string;
  requirementKey: string;
  file: File;
}): Promise<string | null> {
  if (!isIndonesiaB1EvoaDocumentApplication(input.application)) return null;
  if (!isIndonesiaB1OfficialPdfDocument(input.documentType, input.requirementKey)) return null;

  const filename = input.file.name.toLowerCase();
  const mimeType = input.file.type.toLowerCase();
  if (!filename.endsWith(".pdf") || (mimeType && mimeType !== "application/pdf")) {
    return "Indonesia B1 return/onward ticket and passport-validity support documents must be PDF files.";
  }
  const header = new Uint8Array(await input.file.slice(0, 5).arrayBuffer());
  if (header.length !== 5 || String.fromCharCode(...header) !== "%PDF-") {
    return "Indonesia B1 return/onward ticket and passport-validity support documents must be valid PDF files.";
  }
  return null;
}

async function validateIndonesiaC1BankStatementUpload(input: {
  application: ApplicationRow;
  documentType: string;
  requirementKey: string;
  file: File;
}): Promise<string | null> {
  if (!isIndonesiaC1TouristDocumentApplication(input.application)) return null;
  if (![input.documentType, input.requirementKey].includes("bank_statement")) return null;

  const filename = input.file.name.toLowerCase();
  const mimeType = input.file.type.toLowerCase();
  if (!filename.endsWith(".pdf") || (mimeType && mimeType !== "application/pdf")) {
    return "Indonesia C1 personal bank statements must be uploaded as PDF files.";
  }
  const header = new Uint8Array(await input.file.slice(0, 5).arrayBuffer());
  if (header.length !== 5 || String.fromCharCode(...header) !== "%PDF-") {
    return "Indonesia C1 personal bank statements must be valid PDF files.";
  }
  return null;
}

function isIndonesiaC1RegistrationImageDocument(documentType: string, requirementKey: string): boolean {
  return [documentType, requirementKey].some((value) =>
    ["passport_copy", "passport_bio_page", "passport_bio_page_upload", "photo", "formal_photo", "formal_photo_upload"].includes(value),
  );
}

function isIndonesiaC1PortraitDocument(documentType: string, requirementKey: string): boolean {
  return [documentType, requirementKey].some((value) =>
    ["photo", "formal_photo", "formal_photo_upload"].includes(value),
  );
}

async function validateIndonesiaC1RegistrationImageUpload(input: {
  application: ApplicationRow;
  documentType: string;
  requirementKey: string;
  file: File;
}): Promise<string | null> {
  if (!isIndonesiaC1TouristDocumentApplication(input.application)) return null;
  if (!isIndonesiaC1RegistrationImageDocument(input.documentType, input.requirementKey)) return null;

  const filename = input.file.name.toLowerCase();
  const mimeType = input.file.type.toLowerCase();
  const allowedMimeTypes = new Set(["image/jpeg", "image/png"]);
  if (!/\.(?:jpe?g|png)$/.test(filename) || (mimeType && !allowedMimeTypes.has(mimeType))) {
    return "Indonesia C1 official account registration accepts the passport bio page and photo in JPEG/JPG/PNG format only.";
  }

  if (!isIndonesiaC1PortraitDocument(input.documentType, input.requirementKey)) return null;
  const signals = await readVietnamOfficialImageSignals({ file: input.file, runPassportOcr: false });
  if (!signals.width || !signals.height || signals.width < 400 || signals.height < 600) {
    return "Indonesia C1 official account registration requires a color portrait photo of at least 400 x 600 pixels.";
  }
  return null;
}

export type UploadApplicationDocumentResult =
  | { ok: true; storagePath: string; filename: string }
  | {
      ok: false;
      code: "not_authenticated" | "not_found" | "invalid_request" | "server_error";
      error: string;
    };

export async function uploadApplicationDocument(formData: FormData): Promise<UploadApplicationDocumentResult> {
  try {
    const applicationId = getFormDataString(formData, "applicationId");
    const documentType = getFormDataString(formData, "documentType");
    const requirementKey = getFormDataString(formData, "requirementKey") ?? documentType;
    const source = getFormDataString(formData, "source") === "travel_ai" ? "travel_ai" : "manual_upload";
    const scope = getFormDataString(formData, "scope") === "universal_profile" ? "universal_profile" : "application";
    const file = formData.get("file");

    if (!applicationId || !documentType || !requirementKey || !(file instanceof File) || file.size === 0) {
      return { ok: false, code: "invalid_request", error: "Missing upload details" };
    }

    if (file.size > APPLICATION_DOCUMENTS_MAX_BYTES) {
      return { ok: false, code: "invalid_request", error: "File exceeds the 50MB upload limit" };
    }

    const contextResult = await getApplicantContext();
    if (!contextResult.ok) return contextResult;

    const application = await getOwnedApplication(applicationId, contextResult.context.applicantId);
    if (!application) return { ok: false, code: "not_found", error: "Application not found" };

    const vietnamImageUploadError = await validateVietnamOfficialImageUpload({ application, documentType, file });
    if (vietnamImageUploadError) {
      return { ok: false, code: "invalid_request", error: vietnamImageUploadError };
    }

    const indonesiaPdfUploadError = await validateIndonesiaB1OfficialPdfUpload({
      application,
      documentType,
      requirementKey,
      file,
    });
    if (indonesiaPdfUploadError) {
      return { ok: false, code: "invalid_request", error: indonesiaPdfUploadError };
    }

    const indonesiaC1BankStatementUploadError = await validateIndonesiaC1BankStatementUpload({
      application,
      documentType,
      requirementKey,
      file,
    });
    if (indonesiaC1BankStatementUploadError) {
      return { ok: false, code: "invalid_request", error: indonesiaC1BankStatementUploadError };
    }

    const indonesiaC1ImageUploadError = await validateIndonesiaC1RegistrationImageUpload({
      application,
      documentType,
      requirementKey,
      file,
    });
    if (indonesiaC1ImageUploadError) {
      return { ok: false, code: "invalid_request", error: indonesiaC1ImageUploadError };
    }

    const adminClient = createAdminClient();
    const bucketError = await ensureApplicationDocumentsBucketWithAdmin(adminClient);
    if (bucketError) return { ok: false, code: "server_error", error: bucketError };

    const filename = sanitizeUploadFilename(getFormDataString(formData, "filename") ?? file.name);
    const ownerSegment = contextResult.context.authUserId ?? contextResult.context.applicantId;
    const scopeSegment = scope === "universal_profile" ? "universal-profile" : applicationId;
    const storagePath = `${ownerSegment}/${scopeSegment}/${documentType}/${Date.now()}-${filename}`;
    const { error: uploadError } = await adminClient.storage.from(APPLICATION_DOCUMENTS_BUCKET).upload(storagePath, file, {
      upsert: true,
      contentType: file.type || undefined,
    });

    if (uploadError) return { ok: false, code: "server_error", error: uploadError.message };

    const recordResult = await recordDocumentUpload({
      applicationId,
      documentType,
      requirementKey,
      filename,
      storagePath,
      required: getFormDataBoolean(formData, "required"),
      source,
      scope,
    });

    if (!recordResult.ok) {
      await Promise.all([
        adminClient.from("application_documents").delete().eq("storage_path", storagePath),
        scope === "universal_profile"
          ? adminClient.from("universal_profile_documents").delete().eq("storage_path", storagePath)
          : Promise.resolve(),
        adminClient.storage.from(APPLICATION_DOCUMENTS_BUCKET).remove([storagePath]),
      ]);
      return recordResult;
    }
    return { ok: true, storagePath, filename };
  } catch (error) {
    return {
      ok: false,
      code: "server_error",
      error: error instanceof Error ? error.message : "Failed to upload document",
    };
  }
}

async function saveApplicationDocumentRecord(
  adminClient: ReturnType<typeof createAdminClient>,
  input: RecordDocumentUploadInput,
): Promise<string | null> {
  const now = new Date().toISOString();
  const reviewNotes =
    input.source === "travel_ai"
      ? "Saved from Travel AI itinerary output. Awaiting VIZA review."
      : "Uploaded by applicant. Awaiting VIZA review.";

  const { error } = await adminClient.from("application_documents").upsert(
    {
      application_id: input.applicationId,
      document_type: input.documentType,
      requirement_key: input.requirementKey,
      storage_path: input.storagePath,
      filename: input.filename,
      status: "uploaded",
      rejection_reason: null,
      required: input.required,
      review_notes: reviewNotes,
      reviewed_at: null,
      reviewed_by: null,
      updated_at: now,
    },
    { onConflict: "application_id,document_type" },
  );

  if (!error) return null;
  if (!isLegacyDocumentSchemaError(error)) return error.message;

  const legacyPayload = {
    application_id: input.applicationId,
    document_type: input.documentType,
    storage_path: input.storagePath,
    filename: input.filename,
    status: "uploaded",
    rejection_reason: null,
    updated_at: now,
  };

  const { data: existing, error: lookupError } = await adminClient
    .from("application_documents")
    .select("id")
    .eq("application_id", input.applicationId)
    .eq("document_type", input.documentType)
    .maybeSingle();

  if (lookupError && !isLegacyDocumentSchemaError(lookupError)) return lookupError.message;

  if (existing?.id) {
    const { error: updateError } = await adminClient
      .from("application_documents")
      .update(legacyPayload)
      .eq("id", existing.id);
    return updateError?.message ?? null;
  }

  const { error: insertError } = await adminClient.from("application_documents").insert(legacyPayload);
  return insertError?.message ?? null;
}

async function saveUniversalProfileDocumentRecord(
  adminClient: ReturnType<typeof createAdminClient>,
  context: ApplicantContext,
  input: RecordDocumentUploadInput,
): Promise<string | null> {
  const now = new Date().toISOString();
  const { error } = await adminClient.from("universal_profile_documents").upsert(
    {
      applicant_id: context.applicantId,
      auth_user_id: context.authUserId,
      document_type: input.documentType,
      storage_path: input.storagePath,
      filename: input.filename,
      status: "uploaded",
      source_application_id: input.applicationId,
      metadata: {
        requirementKey: input.requirementKey,
        source: input.source ?? "manual_upload",
      },
      updated_at: now,
    },
    { onConflict: "applicant_id,document_type" },
  );

  return error?.message ?? null;
}

export async function recordDocumentUpload(input: RecordDocumentUploadInput): Promise<DocumentMutationResult> {
  try {
    if (!input.applicationId || !input.documentType || !input.storagePath || !input.filename) {
      return { ok: false, code: "invalid_request", error: "Missing upload details" };
    }

    const contextResult = await getApplicantContext();
    if (!contextResult.ok) return contextResult;

    const application = await getOwnedApplication(input.applicationId, contextResult.context.applicantId);
    if (!application) return { ok: false, code: "not_found", error: "Application not found" };

    const adminClient = createAdminClient();
    const saveError = await saveApplicationDocumentRecord(adminClient, input);
    if (saveError) return { ok: false, code: "server_error", error: saveError };

    if (input.scope === "universal_profile") {
      const profileDocumentError = await saveUniversalProfileDocumentRecord(
        adminClient,
        contextResult.context,
        input,
      );
      if (profileDocumentError) return { ok: false, code: "server_error", error: profileDocumentError };
      revalidatePath("/client/universal-info");
    }

    revalidatePath("/client/documents");
    revalidatePath("/client/status");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      code: "server_error",
      error: error instanceof Error ? error.message : "Failed to save document upload",
    };
  }
}

function pickExtractedField(fields: JsonRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = fields[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (isRecord(value)) {
      const text = getString(value, ["value", "text", "raw"]);
      if (text) return text;
    }
  }
  return null;
}

function hasChineseText(value: string | null | undefined): boolean {
  return /[\u3400-\u9fff]/.test(value ?? "");
}

const OCR_BILINGUAL_PROFILE_COLUMNS = [
  "full_name_zh",
  "full_name_en",
  "surname",
  "surname_zh",
  "surname_en",
  "given_names",
  "given_names_zh",
  "given_names_en",
  "place_of_birth_zh",
  "place_of_birth_en",
  "birth_country",
  "birth_province_or_state",
  "birth_province_or_state_zh",
  "birth_province_or_state_en",
  "birth_city",
  "birth_city_zh",
  "birth_city_en",
] as const;

function isMissingOcrBilingualColumnError(message: string) {
  const normalized = message.toLowerCase();
  return OCR_BILINGUAL_PROFILE_COLUMNS.some((column) => normalized.includes(column)) &&
    (normalized.includes("schema cache") || normalized.includes("column") || normalized.includes("relation"));
}

function buildPassportProfileUpdates(fields: JsonRecord) {
  const updates: Record<string, string> = {};
  const fullName = pickExtractedField(fields, ["full_name", "fullName", "name", "passport_full_name", "holder_name"]);
  const surname = pickExtractedField(fields, ["surname", "last_name", "family_name"]);
  const givenNames = pickExtractedField(fields, ["given_names", "givenNames", "given_name", "first_name"]);
  const nativeFullName = pickExtractedField(fields, [
    "full_name_zh",
    "native_full_name",
    "nativeFullName",
    "local_script_name",
    "localScriptName",
    "full_name_native_alphabet",
  ]);
  const compactNativeFullName = nativeFullName?.replace(/\s+/g, "") ?? "";
  const nativeSurname = /^[\u3400-\u9fff]{2,}$/.test(compactNativeFullName) ? compactNativeFullName.slice(0, 1) : null;
  const nativeGivenNames = /^[\u3400-\u9fff]{2,}$/.test(compactNativeFullName) ? compactNativeFullName.slice(1) : null;
  if (fullName) {
    updates.full_name = fullName;
    if (!hasChineseText(fullName)) updates.full_name_en = fullName;
    if (hasChineseText(fullName) && !nativeFullName) updates.full_name_zh = fullName;
  }
  if (nativeFullName) updates.full_name_zh = nativeFullName;
  if (surname) {
    updates.surname = surname;
    if (!hasChineseText(surname)) updates.surname_en = surname;
  }
  if (givenNames) {
    updates.given_names = givenNames;
    if (!hasChineseText(givenNames)) updates.given_names_en = givenNames;
  }
  if (nativeSurname) updates.surname_zh = nativeSurname;
  if (nativeGivenNames) updates.given_names_zh = nativeGivenNames;

  const placeOfBirth = pickExtractedField(fields, ["place_of_birth", "placeOfBirth", "birth_place", "place_of_birth_raw"]);
  const birthCountry = pickExtractedField(fields, ["birth_country", "birthCountry", "country_of_birth", "countryOfBirth"]);
  const birthProvince = pickExtractedField(fields, [
    "birth_province_or_state",
    "birthProvinceOrState",
    "birth_province",
    "birth_state",
    "state_of_birth",
    "province_of_birth",
  ]);
  const birthProvinceZh = pickExtractedField(fields, ["birth_province_or_state_zh", "birthProvinceOrStateZh"]);
  const birthProvinceEn = pickExtractedField(fields, ["birth_province_or_state_en", "birthProvinceOrStateEn"]);
  const birthCity = pickExtractedField(fields, ["birth_city", "birthCity", "city_of_birth", "cityOfBirth"]);
  const birthCityZh = pickExtractedField(fields, ["birth_city_zh", "birthCityZh"]);
  const birthCityEn = pickExtractedField(fields, ["birth_city_en", "birthCityEn"]);
  const nationality = pickExtractedField(fields, ["nationality", "citizenship"]);
  const normalizedBirthplace = normalizeBirthplace({
    placeOfBirth,
    country: birthCountry || (placeOfBirth ? nationality : null),
    province: birthProvince,
    provinceZh: birthProvinceZh,
    provinceEn: birthProvinceEn,
    city: birthCity,
    cityZh: birthCityZh,
    cityEn: birthCityEn,
    nationality: placeOfBirth ? nationality : null,
  });
  if (placeOfBirth || birthCountry || birthProvince || birthProvinceZh || birthProvinceEn || birthCity || birthCityZh || birthCityEn) {
    const normalizedPlaceOfBirth = normalizedBirthplace.placeOfBirthEn || placeOfBirth || "";
    if (normalizedPlaceOfBirth) updates.place_of_birth = normalizedPlaceOfBirth;
    if (normalizedBirthplace.placeOfBirthZh) updates.place_of_birth_zh = normalizedBirthplace.placeOfBirthZh;
    if (normalizedBirthplace.placeOfBirthEn) updates.place_of_birth_en = normalizedBirthplace.placeOfBirthEn;
    if (normalizedBirthplace.country?.en) updates.birth_country = normalizedBirthplace.country.en;
    if (normalizedBirthplace.province.en || normalizedBirthplace.province.zh) {
      updates.birth_province_or_state = normalizedBirthplace.province.en || normalizedBirthplace.province.zh;
    }
    if (normalizedBirthplace.province.zh) updates.birth_province_or_state_zh = normalizedBirthplace.province.zh;
    if (normalizedBirthplace.province.en) updates.birth_province_or_state_en = normalizedBirthplace.province.en;
    if (normalizedBirthplace.city.en || normalizedBirthplace.city.zh) {
      updates.birth_city = normalizedBirthplace.city.en || normalizedBirthplace.city.zh;
    }
    if (normalizedBirthplace.city.zh) updates.birth_city_zh = normalizedBirthplace.city.zh;
    if (normalizedBirthplace.city.en) updates.birth_city_en = normalizedBirthplace.city.en;
  }

  const mappings: Array<[string, string[]]> = [
    ["date_of_birth", ["date_of_birth", "dateOfBirth", "birth_date", "dob"]],
    ["gender", ["gender", "sex"]],
    ["nationality", ["nationality", "citizenship"]],
    ["passport_number", ["passport_number", "passportNumber", "document_number", "passport_no"]],
    ["passport_issue_date", ["passport_issue_date", "issueDate", "issue_date", "date_of_issue"]],
    ["passport_expiry_date", ["passport_expiry_date", "expiryDate", "expiry_date", "expiration_date", "date_of_expiry"]],
    ["passport_issuing_country", ["passport_issuing_country", "issuingCountry", "issuing_country", "country_of_issue"]],
  ];

  for (const [target, keys] of mappings) {
    const value = pickExtractedField(fields, keys);
    if (value) updates[target] = value;
  }

  return updates;
}

function buildPassportAnswerRows(applicationId: string, fields: JsonRecord) {
  const profileUpdates = buildPassportProfileUpdates(fields);
  const answerMappings: Array<[string, string | undefined]> = [
    ["full_name", profileUpdates.full_name],
    ["full_name_zh", profileUpdates.full_name_zh],
    ["full_name_en", profileUpdates.full_name_en],
    ["surname", profileUpdates.surname],
    ["surname_zh", profileUpdates.surname_zh],
    ["surname_en", profileUpdates.surname_en],
    ["given_names", profileUpdates.given_names],
    ["given_names_zh", profileUpdates.given_names_zh],
    ["given_names_en", profileUpdates.given_names_en],
    ["fullName", profileUpdates.full_name],
    ["fullName_zh", profileUpdates.full_name_zh],
    ["fullName_en", profileUpdates.full_name_en],
    ["full_name_native_alphabet", profileUpdates.full_name_zh],
    ["date_of_birth", profileUpdates.date_of_birth],
    ["place_of_birth", profileUpdates.place_of_birth],
    ["place_of_birth_zh", profileUpdates.place_of_birth_zh],
    ["place_of_birth_en", profileUpdates.place_of_birth_en],
    ["birth_country", profileUpdates.birth_country],
    ["birth_province_or_state", profileUpdates.birth_province_or_state],
    ["birth_province_or_state_zh", profileUpdates.birth_province_or_state_zh],
    ["birth_province_or_state_en", profileUpdates.birth_province_or_state_en],
    ["birth_city", profileUpdates.birth_city],
    ["birth_city_zh", profileUpdates.birth_city_zh],
    ["birth_city_en", profileUpdates.birth_city_en],
    ["gender", profileUpdates.gender],
    ["sex", profileUpdates.gender],
    ["nationality", profileUpdates.nationality],
    ["nationality_country", profileUpdates.nationality],
    ["passport_number", profileUpdates.passport_number],
    ["passport_issue_date", profileUpdates.passport_issue_date],
    ["passport_issuance_date", profileUpdates.passport_issue_date],
    ["passport_expiry_date", profileUpdates.passport_expiry_date],
    ["passport_expiration_date", profileUpdates.passport_expiry_date],
    ["passport_issuing_country", profileUpdates.passport_issuing_country],
  ];
  const now = new Date().toISOString();

  return answerMappings
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([fieldName, value]) => ({
      application_id: applicationId,
      field_name: fieldName,
      value_text: value,
      updated_at: now,
    }));
}

export async function confirmPassportOcrExtraction(input: {
  applicationId: string;
  extractionId: string;
  saveToUniversalProfile?: boolean;
}): Promise<DocumentMutationResult> {
  try {
    if (!input.applicationId || !input.extractionId) {
      return { ok: false, code: "invalid_request", error: "Missing OCR confirmation details" };
    }

    const contextResult = await getApplicantContext();
    if (!contextResult.ok) return contextResult;

    const application = await getOwnedApplication(input.applicationId, contextResult.context.applicantId);
    if (!application) return { ok: false, code: "not_found", error: "Application not found" };

    const adminClient = createAdminClient();
    const { data: extractionData, error: extractionError } = await adminClient
      .from("ocr_extractions")
      .select("id, extracted_fields, confirmed_at")
      .eq("id", input.extractionId)
      .eq("application_id", input.applicationId)
      .maybeSingle();

    if (extractionError) return { ok: false, code: "server_error", error: extractionError.message };
    if (!extractionData) return { ok: false, code: "not_found", error: "OCR extraction not found" };

    const extraction = extractionData as { extracted_fields: unknown; confirmed_at: string | null };
    const fields = isRecord(extraction.extracted_fields) ? extraction.extracted_fields : {};
    const profileUpdates = input.saveToUniversalProfile ? buildPassportProfileUpdates(fields) : {};
    const answerRows = buildPassportAnswerRows(input.applicationId, fields);

    if (Object.keys(profileUpdates).length === 0 && answerRows.length === 0) {
      return { ok: false, code: "invalid_request", error: "No extracted passport fields are available to confirm" };
    }

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await adminClient
        .from("applicant_profiles")
        .update({ ...profileUpdates, updated_at: new Date().toISOString() })
        .eq("id", contextResult.context.applicantId);

      if (profileError) {
        if (isMissingOcrBilingualColumnError(profileError.message)) {
          const {
            full_name_zh: _fullNameZh,
            full_name_en: _fullNameEn,
            surname: _surname,
            surname_zh: _surnameZh,
            surname_en: _surnameEn,
            given_names: _givenNames,
            given_names_zh: _givenNamesZh,
            given_names_en: _givenNamesEn,
            place_of_birth_zh: _placeOfBirthZh,
            place_of_birth_en: _placeOfBirthEn,
            birth_country: _birthCountry,
            birth_province_or_state: _birthProvinceOrState,
            birth_province_or_state_zh: _birthProvinceOrStateZh,
            birth_province_or_state_en: _birthProvinceOrStateEn,
            birth_city: _birthCity,
            birth_city_zh: _birthCityZh,
            birth_city_en: _birthCityEn,
            ...baseProfileUpdates
          } = profileUpdates;
          const { error: fallbackProfileError } = await adminClient
            .from("applicant_profiles")
            .update({ ...baseProfileUpdates, updated_at: new Date().toISOString() })
            .eq("id", contextResult.context.applicantId);
          if (fallbackProfileError) {
            return { ok: false, code: "server_error", error: fallbackProfileError.message };
          }
        } else {
          return { ok: false, code: "server_error", error: profileError.message };
        }
      }
    }

    if (answerRows.length > 0) {
      const { error: answersError } = await adminClient
        .from("visa_application_answers")
        .upsert(answerRows, { onConflict: "application_id,field_name" });

      if (answersError) return { ok: false, code: "server_error", error: answersError.message };
    }

    const { error: confirmError } = await adminClient
      .from("ocr_extractions")
      .update({ confirmed_at: new Date().toISOString(), status: "confirmed", updated_at: new Date().toISOString() })
      .eq("id", input.extractionId)
      .eq("application_id", input.applicationId);

    if (confirmError) return { ok: false, code: "server_error", error: confirmError.message };

    revalidatePath("/client/documents");
    revalidatePath("/client/application");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      code: "server_error",
      error: error instanceof Error ? error.message : "Failed to confirm OCR fields",
    };
  }
}
