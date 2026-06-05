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
        application.visaType.toLowerCase() === getFormVisaType(params.visaType!).toLowerCase(),
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
        getFormVisaType(application.visa_type).toLowerCase() === getFormVisaType(packageRow.visa_type).toLowerCase(),
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
    .eq("visa_type", getFormVisaType(application.visa_type))
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  return (data as VisaPackageRow | null) ?? null;
}

async function loadDocumentRequirements(application: ApplicationRow, packageRow: VisaPackageRow | null) {
  const adminClient = createAdminClient();
  const packageId = packageRow?.id ?? application.visa_package_id;

  if (packageId) {
    const { data, error } = await adminClient
      .from("document_requirements")
      .select("requirement_key, label_en, label_zh, description, required, sort_order, metadata")
      .eq("visa_package_id", packageId)
      .order("sort_order", { ascending: true });

    if (!error && data && data.length > 0) {
      return {
        source: "document_requirements" as const,
        requirements: (data as DocumentRequirementRow[]).map(normalizeRequirementRow).sort(sortRequirements),
      };
    }
  }

  const { data, error } = await adminClient
    .from("document_requirements")
    .select("requirement_key, label_en, label_zh, description, required, sort_order, metadata")
    .eq("country", application.country)
    .eq("visa_type", getFormVisaType(application.visa_type))
    .order("sort_order", { ascending: true });

  if (!error && data && data.length > 0) {
    return {
      source: "document_requirements" as const,
      requirements: (data as DocumentRequirementRow[]).map(normalizeRequirementRow).sort(sortRequirements),
    };
  }

  const metadataRequirements = normalizeMetadataChecklist(packageRow?.metadata);
  if (metadataRequirements.length > 0) {
    return { source: "package_metadata" as const, requirements: metadataRequirements };
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
}

const APPLICATION_DOCUMENTS_BUCKET = "application-documents";
const APPLICATION_DOCUMENTS_MAX_BYTES = 50 * 1024 * 1024;

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

    const adminClient = createAdminClient();
    const bucketError = await ensureApplicationDocumentsBucketWithAdmin(adminClient);
    if (bucketError) return { ok: false, code: "server_error", error: bucketError };

    const filename = sanitizeUploadFilename(getFormDataString(formData, "filename") ?? file.name);
    const ownerSegment = contextResult.context.authUserId ?? contextResult.context.applicantId;
    const storagePath = `${ownerSegment}/${applicationId}/${documentType}/${Date.now()}-${filename}`;
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
    });

    if (!recordResult.ok) return recordResult;
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

const OCR_BILINGUAL_PROFILE_COLUMNS = ["full_name_zh", "full_name_en"] as const;

function isMissingOcrBilingualColumnError(message: string) {
  const normalized = message.toLowerCase();
  return OCR_BILINGUAL_PROFILE_COLUMNS.some((column) => normalized.includes(column)) &&
    (normalized.includes("schema cache") || normalized.includes("column") || normalized.includes("relation"));
}

function buildPassportProfileUpdates(fields: JsonRecord) {
  const updates: Record<string, string> = {};
  const fullName = pickExtractedField(fields, ["full_name", "fullName", "name", "passport_full_name", "holder_name"]);
  const nativeFullName = pickExtractedField(fields, [
    "full_name_zh",
    "native_full_name",
    "nativeFullName",
    "local_script_name",
    "localScriptName",
    "full_name_native_alphabet",
  ]);
  if (fullName) {
    updates.full_name = fullName;
    if (!hasChineseText(fullName)) updates.full_name_en = fullName;
    if (hasChineseText(fullName) && !nativeFullName) updates.full_name_zh = fullName;
  }
  if (nativeFullName) updates.full_name_zh = nativeFullName;

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
    ["fullName", profileUpdates.full_name],
    ["fullName_zh", profileUpdates.full_name_zh],
    ["fullName_en", profileUpdates.full_name_en],
    ["full_name_native_alphabet", profileUpdates.full_name_zh],
    ["date_of_birth", profileUpdates.date_of_birth],
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
    const profileUpdates = buildPassportProfileUpdates(fields);
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
          const { full_name_zh: _fullNameZh, full_name_en: _fullNameEn, ...baseProfileUpdates } = profileUpdates;
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
