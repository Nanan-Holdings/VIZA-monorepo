import { createAdminClient } from "@/lib/supabase/admin";
import {
  getDestinationDisplayName,
  getFormVisaType,
  getVisaTypeDisplayName,
} from "@/lib/visa-destinations";
import {
  loadLiveSubmissionSummaries,
  type LiveSubmissionSummary,
} from "@/lib/submission-live-status";

export type LifecycleState =
  | "intake"
  | "payment_pending"
  | "consent_pending"
  | "document_collection"
  | "packet_generation"
  | "ready_for_external_handoff"
  | "external_submission"
  | "result_delivery"
  | "completed"
  | "attention";

export type PaymentState = "missing" | "pending" | "paid" | "failed" | "refunded";
export type ConsentState = "missing" | "missing_signature" | "complete" | "declined";
export type DocumentState = "not_started" | "missing" | "complete" | "rejected";
export type PacketState = "not_started" | "generating" | "ready" | "failed";
export type ExternalState =
  | "not_handed_off"
  | "ready_for_handoff"
  | "in_progress"
  | "submitted"
  | "approved"
  | "rejected"
  | "attention";
export type ResultState = "none" | "pending" | "received" | "delivered" | "approved" | "rejected";

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | { [key: string]: JsonValue | undefined } | JsonValue[];

interface ApplicationRow {
  id: string;
  applicant_id: string;
  country: string;
  visa_type: string;
  status: string;
  arrival_date: string | null;
  departure_date: string | null;
  confirmation_number: string | null;
  submitted_at: string | null;
  visa_package_id: string | null;
  packet_status: string | null;
  packet_manifest: JsonValue | null;
  packet_storage_path: string | null;
  packet_ready_at: string | null;
  external_status: string | null;
  external_reference: string | null;
  external_status_updated_at: string | null;
  result_status: string | null;
  result_storage_path: string | null;
  result_notes: string | null;
  government_fee_cents: number | null;
  government_fee_currency: string | null;
  government_fee_mode: string | null;
  created_at: string | null;
  updated_at: string | null;
}

type QueryErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

type QueryResultLike<T> = {
  data: T[] | null;
  error: QueryErrorLike | null;
};

export interface ApplicantProfileRow {
  id: string;
  auth_user_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  passport_number: string | null;
  passport_expiry_date: string | null;
  language_pref: string | null;
  created_at: string | null;
}

export interface VisaPackageRow {
  id: string;
  name: string;
  country: string;
  visa_type: string;
  price_cents: number | null;
  currency: string | null;
  metadata: JsonValue | null;
}

export interface ApplicationDocumentRow {
  id: string;
  application_id: string;
  document_type: string;
  requirement_key: string | null;
  required: boolean | null;
  filename: string | null;
  storage_path: string | null;
  status: string;
  rejection_reason: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  updated_at: string | null;
  created_at: string | null;
}

export interface DocumentRequirementRow {
  id: string;
  visa_package_id: string | null;
  country: string;
  visa_type: string;
  requirement_key: string;
  label_en: string;
  label_zh: string;
  required: boolean;
  sort_order: number;
}

export interface ApplicationAnswerRow {
  id: string;
  application_id: string;
  field_name: string;
  value_text: string | null;
  value_json: JsonValue | null;
  updated_at: string | null;
}

export interface PaymentRecordRow {
  id: string;
  application_id: string | null;
  applicant_id: string | null;
  visa_package_id: string | null;
  provider: string;
  provider_session_id: string | null;
  provider_payment_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  fee_type: string;
  receipt_url: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ConsentEventRow {
  id: string;
  application_id: string;
  applicant_id: string | null;
  consent_type: string;
  version: string;
  accepted: boolean;
  document_hash: string | null;
  created_at: string | null;
}

export interface ApplicationSignatureRow {
  id: string;
  application_id: string;
  applicant_id: string | null;
  signature_type: string;
  signer_name: string;
  signed_document_path: string | null;
  document_hash: string | null;
  signed_at: string | null;
  created_at: string | null;
}

export interface ApplicationPacketRow {
  id: string;
  application_id: string;
  applicant_id: string | null;
  status: string;
  manifest: JsonValue | null;
  storage_path: string | null;
  generated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ApplicationEventRow {
  id: string;
  application_id: string;
  applicant_id: string | null;
  event_type: string;
  actor_type: string;
  actor_id: string | null;
  message: string | null;
  metadata: JsonValue | null;
  created_at: string | null;
}

export interface NotificationEventRow {
  id: string;
  application_id: string | null;
  applicant_id: string | null;
  channel: string;
  template_key: string;
  recipient: string | null;
  status: string;
  sent_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface DocumentStatusSummary {
  state: DocumentState;
  totalRequired: number;
  complete: number;
  uploaded: number;
  missing: number;
  rejected: number;
  missingLabels: string[];
}

export interface PaymentStatusSummary {
  state: PaymentState;
  latest: PaymentRecordRow | null;
  paidTotalCents: number;
  currency: string | null;
}

export interface ConsentStatusSummary {
  state: ConsentState;
  latestConsent: ConsentEventRow | null;
  latestSignature: ApplicationSignatureRow | null;
}

export interface PacketStatusSummary {
  state: PacketState;
  latestPacket: ApplicationPacketRow | null;
  storagePath: string | null;
}

export interface ExternalStatusSummary {
  state: ExternalState;
  rawStatus: string | null;
  reference: string | null;
  updatedAt: string | null;
}

export interface ResultStatusSummary {
  state: ResultState;
  rawStatus: string | null;
  storagePath: string | null;
  notes: string | null;
}

export interface AdminApplicationModel {
  id: string;
  applicantId: string;
  country: string;
  visaType: string;
  countryLabel: string;
  visaTypeLabel: string;
  rawStatus: string;
  lifecycleState: LifecycleState;
  missingItems: string[];
  profile: ApplicantProfileRow | null;
  visaPackage: VisaPackageRow | null;
  payment: PaymentStatusSummary;
  consent: ConsentStatusSummary;
  documents: DocumentStatusSummary;
  packet: PacketStatusSummary;
  external: ExternalStatusSummary;
  result: ResultStatusSummary;
  liveSubmission: LiveSubmissionSummary | null;
  answers: ApplicationAnswerRow[];
  applicationDocuments: ApplicationDocumentRow[];
  payments: PaymentRecordRow[];
  consents: ConsentEventRow[];
  signatures: ApplicationSignatureRow[];
  packets: ApplicationPacketRow[];
  events: ApplicationEventRow[];
  notifications: NotificationEventRow[];
  latestEvent: ApplicationEventRow | null;
  latestNotification: NotificationEventRow | null;
  arrivalDate: string | null;
  departureDate: string | null;
  confirmationNumber: string | null;
  submittedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  governmentFeeCents: number | null;
  governmentFeeCurrency: string | null;
  governmentFeeMode: string | null;
}

export interface AdminPackageAssignmentSummary {
  id: string;
  status: string;
  assignedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  applicationId: string | null;
  visaPackageId: string | null;
  packageName: string;
  countryLabel: string;
  visaTypeLabel: string;
  priceLabel: string;
}

export interface AdminApplicantOverview {
  applicantId: string;
  profile: ApplicantProfileRow | null;
  applications: AdminApplicationModel[];
  packages: AdminPackageAssignmentSummary[];
  latestApplication: AdminApplicationModel | null;
  latestUpdatedAt: string | null;
  earliestExpiryAt: string | null;
  applicationCount: number;
  activePackageCount: number;
  needsSupportCount: number;
  completionPercent: number;
  lifecycleState: LifecycleState;
  missingItems: string[];
  countries: string[];
  packageNames: string[];
}

interface UserPackageAssignmentQueryRow {
  id: string;
  auth_user_id: string;
  visa_package_id: string | null;
  application_id: string | null;
  status: string;
  assigned_at: string | null;
  completed_at: string | null;
  expires_at?: string | null;
  visa_packages: VisaPackageRow | VisaPackageRow[] | null;
}

interface RelatedData {
  profilesById: Map<string, ApplicantProfileRow>;
  packagesById: Map<string, VisaPackageRow>;
  requirements: DocumentRequirementRow[];
  documentsByApplication: Map<string, ApplicationDocumentRow[]>;
  answersByApplication: Map<string, ApplicationAnswerRow[]>;
  paymentsByApplication: Map<string, PaymentRecordRow[]>;
  consentsByApplication: Map<string, ConsentEventRow[]>;
  signaturesByApplication: Map<string, ApplicationSignatureRow[]>;
  packetsByApplication: Map<string, ApplicationPacketRow[]>;
  eventsByApplication: Map<string, ApplicationEventRow[]>;
  notificationsByApplication: Map<string, NotificationEventRow[]>;
  liveSubmissionByApplication: Map<string, LiveSubmissionSummary>;
}

export const LIFECYCLE_LABELS: Record<LifecycleState, string> = {
  intake: "Intake",
  payment_pending: "Payment pending",
  consent_pending: "Consent pending",
  document_collection: "Document collection",
  packet_generation: "Packet generation",
  ready_for_external_handoff: "Ready for external handoff",
  external_submission: "External submission",
  result_delivery: "Result delivery",
  completed: "Completed",
  attention: "Needs attention",
};

export const PAYMENT_LABELS: Record<PaymentState, string> = {
  missing: "Missing",
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
};

export const CONSENT_LABELS: Record<ConsentState, string> = {
  missing: "Missing consent",
  missing_signature: "Missing signature",
  complete: "Complete",
  declined: "Declined",
};

export const DOCUMENT_LABELS: Record<DocumentState, string> = {
  not_started: "Not started",
  missing: "Missing items",
  complete: "Complete",
  rejected: "Rejected",
};

export const PACKET_LABELS: Record<PacketState, string> = {
  not_started: "Not started",
  generating: "Generating",
  ready: "Ready",
  failed: "Failed",
};

export const EXTERNAL_LABELS: Record<ExternalState, string> = {
  not_handed_off: "Not handed off",
  ready_for_handoff: "Ready for handoff",
  in_progress: "In progress",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  attention: "Needs attention",
};

export const RESULT_LABELS: Record<ResultState, string> = {
  none: "No result yet",
  pending: "Pending",
  received: "Received",
  delivered: "Delivered",
  approved: "Approved",
  rejected: "Rejected",
};

const PAID_STATUSES = new Set(["paid", "succeeded", "success", "complete", "completed"]);
const PENDING_PAYMENT_STATUSES = new Set(["pending", "open", "processing", "requires_payment"]);
const FAILED_PAYMENT_STATUSES = new Set(["failed", "canceled", "cancelled", "expired", "void"]);
const REFUNDED_PAYMENT_STATUSES = new Set(["refunded", "partially_refunded"]);

const PACKET_READY_STATUSES = new Set(["ready", "generated", "complete", "completed"]);
const PACKET_PENDING_STATUSES = new Set(["pending", "not_started", "generating", "processing", "queued"]);
const PACKET_FAILED_STATUSES = new Set(["failed", "error", "blocked"]);

const EXTERNAL_PROGRESS_STATUSES = new Set(["in_progress", "processing", "handoff_sent", "received"]);
const EXTERNAL_SUBMITTED_STATUSES = new Set(["submitted", "lodged", "filed"]);
const EXTERNAL_APPROVED_STATUSES = new Set(["approved", "issued", "granted"]);
const EXTERNAL_REJECTED_STATUSES = new Set(["rejected", "refused", "denied"]);
const EXTERNAL_ATTENTION_STATUSES = new Set(["failed", "needs_attention", "blocked", "returned"]);

const RESULT_APPROVED_STATUSES = new Set(["approved", "issued", "granted"]);
const RESULT_REJECTED_STATUSES = new Set(["rejected", "refused", "denied"]);
const RESULT_DELIVERED_STATUSES = new Set(["delivered", "sent_to_customer"]);
const RESULT_RECEIVED_STATUSES = new Set(["received", "available", "ready"]);
const RESULT_PENDING_STATUSES = new Set(["pending", "processing"]);

const APPLICATION_BASE_SELECT =
  "id, applicant_id, country, visa_type, status, arrival_date, departure_date, confirmation_number, submitted_at, visa_package_id, created_at, updated_at";

const APPLICATION_AUTOMATION_SELECT = `${APPLICATION_BASE_SELECT}, packet_status, packet_manifest, packet_storage_path, packet_ready_at, external_status, external_reference, external_status_updated_at, result_status, result_storage_path, result_notes, government_fee_cents, government_fee_currency, government_fee_mode`;

function normalizeStatus(status: string | null | undefined): string {
  return (status ?? "").trim().toLowerCase();
}

function isSchemaMissingError(error: QueryErrorLike | null | undefined): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const message = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  return (
    code === "PGRST204" ||
    code === "PGRST205" ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    (message.includes("could not find the") && message.includes("column"))
  );
}

function getQueryErrorMessage(error: QueryErrorLike): string {
  return error.message ?? error.details ?? error.hint ?? "Unknown query error";
}

function withApplicationDefaults(row: Partial<ApplicationRow> & Pick<
  ApplicationRow,
  | "id"
  | "applicant_id"
  | "country"
  | "visa_type"
  | "status"
>): ApplicationRow {
  return {
    id: row.id,
    applicant_id: row.applicant_id,
    country: row.country,
    visa_type: row.visa_type,
    status: row.status,
    arrival_date: row.arrival_date ?? null,
    departure_date: row.departure_date ?? null,
    confirmation_number: row.confirmation_number ?? null,
    submitted_at: row.submitted_at ?? null,
    visa_package_id: row.visa_package_id ?? null,
    packet_status: row.packet_status ?? null,
    packet_manifest: row.packet_manifest ?? null,
    packet_storage_path: row.packet_storage_path ?? null,
    packet_ready_at: row.packet_ready_at ?? null,
    external_status: row.external_status ?? null,
    external_reference: row.external_reference ?? null,
    external_status_updated_at: row.external_status_updated_at ?? null,
    result_status: row.result_status ?? null,
    result_storage_path: row.result_storage_path ?? null,
    result_notes: row.result_notes ?? null,
    government_fee_cents: row.government_fee_cents ?? null,
    government_fee_currency: row.government_fee_currency ?? null,
    government_fee_mode: row.government_fee_mode ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

function compact<T>(items: Array<T | null | undefined>): T[] {
  return items.filter((item): item is T => item !== null && item !== undefined);
}

function mapById<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

function groupByApplication<T extends { application_id: string | null }>(rows: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    if (!row.application_id) continue;
    const existing = groups.get(row.application_id) ?? [];
    existing.push(row);
    groups.set(row.application_id, existing);
  }
  return groups;
}

function sortByUpdatedAt<T extends { updated_at?: string | null; created_at?: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aTime = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
    const bTime = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
    return bTime - aTime;
  });
}

function sortByCreatedAt<T extends { created_at?: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aTime = new Date(a.created_at ?? 0).getTime();
    const bTime = new Date(b.created_at ?? 0).getTime();
    return bTime - aTime;
  });
}

function unwrapVisaPackage(value: VisaPackageRow | VisaPackageRow[] | null): VisaPackageRow | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function groupApplicationsByApplicant(rows: AdminApplicationModel[]): Map<string, AdminApplicationModel[]> {
  const groups = new Map<string, AdminApplicationModel[]>();

  for (const row of rows) {
    const existing = groups.get(row.applicantId) ?? [];
    existing.push(row);
    groups.set(row.applicantId, existing);
  }

  return groups;
}

export function getLifecycleProgressPercent(application: AdminApplicationModel): number {
  const progressByState: Record<LifecycleState, number> = {
    intake: 8,
    payment_pending: 18,
    consent_pending: 32,
    document_collection: 48,
    packet_generation: 64,
    ready_for_external_handoff: 76,
    external_submission: 86,
    result_delivery: 95,
    completed: 100,
    attention: 42,
  };

  return progressByState[application.lifecycleState];
}

function chooseApplicantLifecycle(applications: AdminApplicationModel[]): LifecycleState {
  if (applications.some((application) => application.lifecycleState === "attention")) return "attention";
  if (applications.length > 0 && applications.every((application) => application.lifecycleState === "completed")) {
    return "completed";
  }

  const sorted = [...applications].sort((a, b) => getLifecycleProgressPercent(b) - getLifecycleProgressPercent(a));
  return sorted[0]?.lifecycleState ?? "intake";
}

function getLatestApplication(applications: AdminApplicationModel[]): AdminApplicationModel | null {
  return [...applications].sort((a, b) => {
    const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
    const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
    return bTime - aTime;
  })[0] ?? null;
}

function getEarliestExpiry(packages: AdminPackageAssignmentSummary[]): string | null {
  const expiries = packages
    .map((assignment) => assignment.expiresAt)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  return expiries[0] ?? null;
}

function getUniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function toPackageAssignmentSummary(
  assignment: UserPackageAssignmentQueryRow,
): AdminPackageAssignmentSummary {
  const visaPackage = unwrapVisaPackage(assignment.visa_packages);

  return {
    id: assignment.id,
    status: assignment.status,
    assignedAt: assignment.assigned_at,
    completedAt: assignment.completed_at,
    expiresAt: assignment.expires_at ?? null,
    applicationId: assignment.application_id,
    visaPackageId: assignment.visa_package_id,
    packageName: visaPackage?.name ?? "Unknown package",
    countryLabel: visaPackage ? getDestinationDisplayName(visaPackage.country) : "Unknown country",
    visaTypeLabel: visaPackage ? getVisaTypeDisplayName(getFormVisaType(visaPackage.visa_type)) : "Unknown visa type",
    priceLabel: visaPackage ? formatMoney(visaPackage.price_cents, visaPackage.currency) : "Not set",
  };
}

function derivePackageSummariesFromApplications(
  applications: AdminApplicationModel[],
): AdminPackageAssignmentSummary[] {
  const summaries = new Map<string, AdminPackageAssignmentSummary>();

  for (const application of applications) {
    if (!application.visaPackage) continue;
    const key = application.visaPackage.id;
    if (summaries.has(key)) continue;

    summaries.set(key, {
      id: `application-package-${key}`,
      status: "linked",
      assignedAt: application.createdAt,
      completedAt: null,
      expiresAt: null,
      applicationId: application.id,
      visaPackageId: application.visaPackage.id,
      packageName: application.visaPackage.name,
      countryLabel: getDestinationDisplayName(application.visaPackage.country),
      visaTypeLabel: getVisaTypeDisplayName(getFormVisaType(application.visaPackage.visa_type)),
      priceLabel: formatMoney(application.visaPackage.price_cents, application.visaPackage.currency),
    });
  }

  return [...summaries.values()];
}

async function loadPackageAssignmentsByApplicant(
  rows: AdminApplicationModel[],
): Promise<Map<string, AdminPackageAssignmentSummary[]>> {
  const authToApplicant = new Map<string, string>();
  for (const row of rows) {
    if (row.profile?.auth_user_id) {
      authToApplicant.set(row.profile.auth_user_id, row.applicantId);
    }
  }

  const authUserIds = [...authToApplicant.keys()];
  if (authUserIds.length === 0) return new Map();

  const adminClient = createAdminClient();
  const baseSelect =
    "id, auth_user_id, visa_package_id, application_id, status, assigned_at, completed_at, visa_packages(id, name, country, visa_type, price_cents, currency, metadata)";
  const fullResult = await adminClient
    .from("user_packages")
    .select(`${baseSelect}, expires_at`)
    .in("auth_user_id", authUserIds)
    .order("assigned_at", { ascending: false });

  const { data, error } = fullResult.error && isSchemaMissingError(fullResult.error)
    ? await adminClient
        .from("user_packages")
        .select(baseSelect)
        .in("auth_user_id", authUserIds)
        .order("assigned_at", { ascending: false })
    : fullResult;

  if (error) return new Map();

  const grouped = new Map<string, AdminPackageAssignmentSummary[]>();
  for (const assignment of (data ?? []) as UserPackageAssignmentQueryRow[]) {
    const applicantId = authToApplicant.get(assignment.auth_user_id);
    if (!applicantId) continue;
    const existing = grouped.get(applicantId) ?? [];
    existing.push(toPackageAssignmentSummary(assignment));
    grouped.set(applicantId, existing);
  }

  return grouped;
}

function buildApplicantOverview(
  applicantId: string,
  applications: AdminApplicationModel[],
  assignedPackages: AdminPackageAssignmentSummary[],
): AdminApplicantOverview {
  const latestApplication = getLatestApplication(applications);
  const packages = assignedPackages.length > 0
    ? assignedPackages
    : derivePackageSummariesFromApplications(applications);
  const missingItems = getUniqueStrings(applications.flatMap((application) => application.missingItems));
  const completionPercent =
    applications.length === 0
      ? 0
      : Math.round(
          applications.reduce((sum, application) => sum + getLifecycleProgressPercent(application), 0) /
            applications.length,
        );

  return {
    applicantId,
    profile: latestApplication?.profile ?? applications[0]?.profile ?? null,
    applications,
    packages,
    latestApplication,
    latestUpdatedAt: latestApplication?.updatedAt ?? latestApplication?.createdAt ?? null,
    earliestExpiryAt: getEarliestExpiry(packages),
    applicationCount: applications.length,
    activePackageCount: packages.filter((pkg) => pkg.status === "active").length,
    needsSupportCount: applications.filter(
      (application) => application.lifecycleState === "attention" || application.missingItems.length > 0,
    ).length,
    completionPercent,
    lifecycleState: chooseApplicantLifecycle(applications),
    missingItems,
    countries: getUniqueStrings(applications.map((application) => application.countryLabel)),
    packageNames: getUniqueStrings(packages.map((pkg) => pkg.packageName)),
  };
}

function sortApplicantOverviews(applicants: AdminApplicantOverview[]): AdminApplicantOverview[] {
  return [...applicants].sort((a, b) => {
    const aNeedsSupport = a.needsSupportCount > 0 ? 1 : 0;
    const bNeedsSupport = b.needsSupportCount > 0 ? 1 : 0;
    if (aNeedsSupport !== bNeedsSupport) return bNeedsSupport - aNeedsSupport;

    const aTime = new Date(a.latestUpdatedAt ?? 0).getTime();
    const bTime = new Date(b.latestUpdatedAt ?? 0).getTime();
    return bTime - aTime;
  });
}

async function loadApplicationDocumentRows(
  applicationIds: string[],
): Promise<QueryResultLike<ApplicationDocumentRow>> {
  if (applicationIds.length === 0) return { data: [], error: null };

  const adminClient = createAdminClient();
  const fullResult = await adminClient
    .from("application_documents")
    .select("id, application_id, document_type, requirement_key, required, filename, storage_path, status, rejection_reason, review_notes, reviewed_at, updated_at, created_at")
    .in("application_id", applicationIds);

  if (!fullResult.error || !isSchemaMissingError(fullResult.error)) {
    return fullResult as QueryResultLike<ApplicationDocumentRow>;
  }

  const legacyResult = await adminClient
    .from("application_documents")
    .select("id, application_id, document_type, filename, storage_path, status, rejection_reason, updated_at, created_at")
    .in("application_id", applicationIds);

  if (legacyResult.error) {
    return legacyResult as QueryResultLike<ApplicationDocumentRow>;
  }

  const legacyRows = (legacyResult.data ?? []).map((document) => ({
    ...(document as Omit<ApplicationDocumentRow, "requirement_key" | "required" | "review_notes" | "reviewed_at">),
    requirement_key: null,
    required: true,
    review_notes: null,
    reviewed_at: null,
  }));

  return { data: legacyRows, error: null };
}

function formatRequirementLabel(requirement: DocumentRequirementRow): string {
  return requirement.label_en || requirement.requirement_key.replace(/_/g, " ");
}

function isDocumentComplete(document: ApplicationDocumentRow | undefined): boolean {
  if (!document) return false;
  const status = normalizeStatus(document.status);
  return (status === "uploaded" || status === "validated" || status === "accepted") && Boolean(document.storage_path);
}

function isDocumentRejected(document: ApplicationDocumentRow): boolean {
  const status = normalizeStatus(document.status);
  return status === "rejected" || status === "failed";
}

function getRelevantRequirements(
  application: ApplicationRow,
  requirements: DocumentRequirementRow[],
): DocumentRequirementRow[] {
  const normalizedVisaType = getFormVisaType(application.visa_type).toLowerCase();

  return requirements
    .filter((requirement) => {
      if (!requirement.required) return false;
      const countryMatches = requirement.country.toLowerCase() === application.country.toLowerCase();
      const visaMatches = getFormVisaType(requirement.visa_type).toLowerCase() === normalizedVisaType;
      const packageMatches =
        !requirement.visa_package_id || requirement.visa_package_id === application.visa_package_id;
      return countryMatches && visaMatches && packageMatches;
    })
    .sort((a, b) => a.sort_order - b.sort_order);
}

function findDocumentForRequirement(
  requirement: DocumentRequirementRow,
  documents: ApplicationDocumentRow[],
): ApplicationDocumentRow | undefined {
  return documents.find((document) => {
    return (
      document.requirement_key === requirement.requirement_key ||
      document.document_type === requirement.requirement_key
    );
  });
}

function summarizeDocuments(
  application: ApplicationRow,
  documents: ApplicationDocumentRow[],
  requirements: DocumentRequirementRow[],
): DocumentStatusSummary {
  const relevantRequirements = getRelevantRequirements(application, requirements);
  const requiredDocuments = documents.filter((document) => document.required !== false);
  const missingLabels: string[] = [];
  let complete = 0;
  let uploaded = 0;
  let rejected = 0;

  if (relevantRequirements.length > 0) {
    for (const requirement of relevantRequirements) {
      const document = findDocumentForRequirement(requirement, requiredDocuments);
      if (document && isDocumentComplete(document)) {
        complete += 1;
        uploaded += normalizeStatus(document.status) === "uploaded" ? 1 : 0;
        continue;
      }

      if (document && isDocumentRejected(document)) {
        rejected += 1;
      }
      missingLabels.push(formatRequirementLabel(requirement));
    }

    const state: DocumentState =
      rejected > 0 ? "rejected" : missingLabels.length > 0 ? "missing" : "complete";

    return {
      state,
      totalRequired: relevantRequirements.length,
      complete,
      uploaded,
      missing: missingLabels.length,
      rejected,
      missingLabels,
    };
  }

  for (const document of requiredDocuments) {
    const status = normalizeStatus(document.status);
    if (isDocumentRejected(document)) {
      rejected += 1;
      missingLabels.push(document.document_type.replace(/_/g, " "));
    } else if (isDocumentComplete(document)) {
      complete += 1;
      if (status === "uploaded") uploaded += 1;
    } else if (status === "missing" || !document.storage_path) {
      missingLabels.push(document.document_type.replace(/_/g, " "));
    }
  }

  const state: DocumentState =
    rejected > 0
      ? "rejected"
      : missingLabels.length > 0
        ? "missing"
        : requiredDocuments.length > 0
          ? "complete"
          : "not_started";

  return {
    state,
    totalRequired: requiredDocuments.length,
    complete,
    uploaded,
    missing: missingLabels.length,
    rejected,
    missingLabels,
  };
}

function summarizePayment(payments: PaymentRecordRow[]): PaymentStatusSummary {
  const sorted = sortByUpdatedAt(payments);
  const latest = sorted[0] ?? null;
  const paidPayments = payments.filter((payment) => PAID_STATUSES.has(normalizeStatus(payment.status)));
  const paidTotalCents = paidPayments.reduce((total, payment) => total + payment.amount_cents, 0);
  const currency = latest?.currency ?? paidPayments[0]?.currency ?? null;

  if (!latest) {
    return { state: "missing", latest: null, paidTotalCents, currency };
  }

  const status = normalizeStatus(latest.status);
  if (PAID_STATUSES.has(status)) return { state: "paid", latest, paidTotalCents, currency };
  if (REFUNDED_PAYMENT_STATUSES.has(status)) return { state: "refunded", latest, paidTotalCents, currency };
  if (FAILED_PAYMENT_STATUSES.has(status)) return { state: "failed", latest, paidTotalCents, currency };
  if (PENDING_PAYMENT_STATUSES.has(status)) return { state: "pending", latest, paidTotalCents, currency };
  return { state: "pending", latest, paidTotalCents, currency };
}

function summarizeConsent(
  consents: ConsentEventRow[],
  signatures: ApplicationSignatureRow[],
): ConsentStatusSummary {
  const latestConsent = sortByCreatedAt(consents)[0] ?? null;
  const latestSignature = sortByCreatedAt(signatures)[0] ?? null;

  if (latestConsent?.accepted === false) {
    return { state: "declined", latestConsent, latestSignature };
  }

  if (!latestConsent) {
    return { state: "missing", latestConsent, latestSignature };
  }

  if (!latestSignature) {
    return { state: "missing_signature", latestConsent, latestSignature };
  }

  return { state: "complete", latestConsent, latestSignature };
}

function summarizePacket(application: ApplicationRow, packets: ApplicationPacketRow[]): PacketStatusSummary {
  const latestPacket = sortByUpdatedAt(packets)[0] ?? null;
  const rawStatus = normalizeStatus(latestPacket?.status ?? application.packet_status);
  const storagePath = latestPacket?.storage_path ?? application.packet_storage_path;

  if (PACKET_READY_STATUSES.has(rawStatus) || application.packet_ready_at || storagePath) {
    return { state: "ready", latestPacket, storagePath };
  }

  if (PACKET_FAILED_STATUSES.has(rawStatus)) {
    return { state: "failed", latestPacket, storagePath };
  }

  if (PACKET_PENDING_STATUSES.has(rawStatus)) {
    return { state: rawStatus === "not_started" ? "not_started" : "generating", latestPacket, storagePath };
  }

  return { state: "not_started", latestPacket, storagePath };
}

function summarizeExternal(application: ApplicationRow, packet: PacketStatusSummary): ExternalStatusSummary {
  const rawStatus = normalizeStatus(application.external_status);

  if (!rawStatus) {
    return {
      state: packet.state === "ready" ? "ready_for_handoff" : "not_handed_off",
      rawStatus: application.external_status,
      reference: application.external_reference,
      updatedAt: application.external_status_updated_at,
    };
  }

  let state: ExternalState = "in_progress";
  if (EXTERNAL_SUBMITTED_STATUSES.has(rawStatus)) state = "submitted";
  else if (EXTERNAL_APPROVED_STATUSES.has(rawStatus)) state = "approved";
  else if (EXTERNAL_REJECTED_STATUSES.has(rawStatus)) state = "rejected";
  else if (EXTERNAL_ATTENTION_STATUSES.has(rawStatus)) state = "attention";
  else if (EXTERNAL_PROGRESS_STATUSES.has(rawStatus)) state = "in_progress";

  return {
    state,
    rawStatus: application.external_status,
    reference: application.external_reference,
    updatedAt: application.external_status_updated_at,
  };
}

function summarizeResult(application: ApplicationRow): ResultStatusSummary {
  const rawStatus = normalizeStatus(application.result_status || application.status);
  let state: ResultState = "none";

  if (RESULT_APPROVED_STATUSES.has(rawStatus)) state = "approved";
  else if (RESULT_REJECTED_STATUSES.has(rawStatus)) state = "rejected";
  else if (RESULT_DELIVERED_STATUSES.has(rawStatus)) state = "delivered";
  else if (RESULT_RECEIVED_STATUSES.has(rawStatus) || application.result_storage_path) state = "received";
  else if (RESULT_PENDING_STATUSES.has(rawStatus)) state = "pending";

  return {
    state,
    rawStatus: application.result_status,
    storagePath: application.result_storage_path,
    notes: application.result_notes,
  };
}

function deriveLifecycleState({
  rawStatus,
  payment,
  consent,
  documents,
  packet,
  external,
  result,
  liveSubmission,
  answers,
}: {
  rawStatus: string;
  payment: PaymentStatusSummary;
  consent: ConsentStatusSummary;
  documents: DocumentStatusSummary;
  packet: PacketStatusSummary;
  external: ExternalStatusSummary;
  result: ResultStatusSummary;
  liveSubmission: LiveSubmissionSummary | null;
  answers: ApplicationAnswerRow[];
}): LifecycleState {
  const normalizedRawStatus = normalizeStatus(rawStatus);

  if (
    liveSubmission?.state === "action_required" ||
    liveSubmission?.state === "failed" ||
    payment.state === "failed" ||
    consent.state === "declined" ||
    documents.state === "rejected" ||
    packet.state === "failed" ||
    external.state === "attention" ||
    external.state === "rejected" ||
    result.state === "rejected" ||
    normalizedRawStatus === "rejected"
  ) {
    return "attention";
  }

  if (result.state === "approved" || result.state === "delivered" || normalizedRawStatus === "completed") {
    return "completed";
  }

  if (liveSubmission?.state === "submitted" || liveSubmission?.state === "completed") return "result_delivery";
  if (liveSubmission?.state === "pending" || liveSubmission?.state === "running") return "external_submission";
  if (result.state !== "none") return "result_delivery";
  if (external.state === "in_progress" || external.state === "submitted" || external.state === "approved") {
    return "external_submission";
  }
  if (external.state === "ready_for_handoff") return "ready_for_external_handoff";
  if (packet.state === "generating") return "packet_generation";
  if (payment.state !== "paid" && payment.state !== "refunded") return "payment_pending";
  if (consent.state !== "complete") return "consent_pending";
  if (documents.state !== "complete") return "document_collection";
  if (packet.state !== "ready") return "packet_generation";
  if (answers.length === 0 || normalizedRawStatus === "draft") return "intake";
  return "ready_for_external_handoff";
}

function buildMissingItems({
  payment,
  consent,
  documents,
  packet,
  external,
  liveSubmission,
  answers,
}: {
  payment: PaymentStatusSummary;
  consent: ConsentStatusSummary;
  documents: DocumentStatusSummary;
  packet: PacketStatusSummary;
  external: ExternalStatusSummary;
  liveSubmission: LiveSubmissionSummary | null;
  answers: ApplicationAnswerRow[];
}): string[] {
  const items: string[] = [];

  if (answers.length === 0) items.push("Application answers not started");
  if (payment.state === "missing") items.push("Agency fee payment missing");
  if (payment.state === "pending") items.push("Agency fee payment pending");
  if (payment.state === "failed") items.push("Payment needs customer support");
  if (consent.state === "missing") items.push("Consent not accepted");
  if (consent.state === "missing_signature") items.push("Signature not captured");
  if (consent.state === "declined") items.push("Consent was declined");
  for (const label of documents.missingLabels.slice(0, 4)) {
    items.push(`Document needed: ${label}`);
  }
  if (documents.missingLabels.length > 4) {
    items.push(`${documents.missingLabels.length - 4} more document items`);
  }
  if (packet.state === "failed") items.push("Packet generation failed");
  if (packet.state === "not_started" && payment.state === "paid" && consent.state === "complete" && documents.state === "complete") {
    items.push("Packet not generated yet");
  }
  if (external.state === "attention" || external.state === "rejected") {
    items.push("External status needs follow-up");
  }
  if (liveSubmission?.pendingManualAction) {
    items.push(`Official-site action needed: ${liveSubmission.pendingManualAction.actionType.replace(/_/g, " ")}`);
  }
  if (liveSubmission?.state === "failed") {
    items.push("Live-assisted submission failed");
  }

  return items;
}

function buildApplicationModel(
  application: ApplicationRow,
  related: RelatedData,
): AdminApplicationModel {
  const payments = sortByUpdatedAt(related.paymentsByApplication.get(application.id) ?? []);
  const consents = sortByCreatedAt(related.consentsByApplication.get(application.id) ?? []);
  const signatures = sortByCreatedAt(related.signaturesByApplication.get(application.id) ?? []);
  const packets = sortByUpdatedAt(related.packetsByApplication.get(application.id) ?? []);
  const events = sortByCreatedAt(related.eventsByApplication.get(application.id) ?? []);
  const notifications = sortByUpdatedAt(related.notificationsByApplication.get(application.id) ?? []);
  const answers = sortByUpdatedAt(related.answersByApplication.get(application.id) ?? []);
  const applicationDocuments = sortByUpdatedAt(related.documentsByApplication.get(application.id) ?? []);
  const payment = summarizePayment(payments);
  const consent = summarizeConsent(consents, signatures);
  const documents = summarizeDocuments(application, applicationDocuments, related.requirements);
  const packet = summarizePacket(application, packets);
  const liveSubmission = related.liveSubmissionByApplication.get(application.id) ?? null;
  const external = summarizeExternal(application, packet);
  const result = summarizeResult(application);
  const lifecycleState = deriveLifecycleState({
    rawStatus: application.status,
    payment,
    consent,
    documents,
    packet,
    external,
    result,
    liveSubmission,
    answers,
  });

  return {
    id: application.id,
    applicantId: application.applicant_id,
    country: application.country,
    visaType: application.visa_type,
    countryLabel: getDestinationDisplayName(application.country),
    visaTypeLabel: getVisaTypeDisplayName(getFormVisaType(application.visa_type)),
    rawStatus: application.status,
    lifecycleState,
    missingItems: buildMissingItems({ payment, consent, documents, packet, external, liveSubmission, answers }),
    profile: related.profilesById.get(application.applicant_id) ?? null,
    visaPackage: application.visa_package_id ? related.packagesById.get(application.visa_package_id) ?? null : null,
    payment,
    consent,
    documents,
    packet,
    external,
    result,
    liveSubmission,
    answers,
    applicationDocuments,
    payments,
    consents,
    signatures,
    packets,
    events,
    notifications,
    latestEvent: events[0] ?? null,
    latestNotification: notifications[0] ?? null,
    arrivalDate: application.arrival_date,
    departureDate: application.departure_date,
    confirmationNumber: application.confirmation_number,
    submittedAt: application.submitted_at,
    createdAt: application.created_at,
    updatedAt: application.updated_at,
    governmentFeeCents: application.government_fee_cents,
    governmentFeeCurrency: application.government_fee_currency,
    governmentFeeMode: application.government_fee_mode,
  };
}

async function loadRelatedData(applications: ApplicationRow[]): Promise<RelatedData> {
  const adminClient = createAdminClient();
  const applicationIds = applications.map((application) => application.id);
  const applicantIds = [...new Set(applications.map((application) => application.applicant_id))];
  const packageIds = compact([...new Set(applications.map((application) => application.visa_package_id))]);
  const countries = [...new Set(applications.map((application) => application.country))];
  const visaTypes = [...new Set(applications.map((application) => application.visa_type))];

  const [
    profileRes,
    packageRes,
    packageRequirementRes,
    countryRequirementRes,
    documentRes,
    answerRes,
    paymentRes,
    consentRes,
    signatureRes,
    packetRes,
    eventRes,
    notificationRes,
    liveSubmissionByApplication,
  ] = await Promise.all([
    applicantIds.length > 0
      ? adminClient
          .from("applicant_profiles")
          .select("id, auth_user_id, full_name, email, phone, nationality, passport_number, passport_expiry_date, language_pref, created_at")
          .in("id", applicantIds)
      : Promise.resolve({ data: [], error: null }),
    packageIds.length > 0
      ? adminClient
          .from("visa_packages")
          .select("id, name, country, visa_type, price_cents, currency, metadata")
          .in("id", packageIds)
      : Promise.resolve({ data: [], error: null }),
    packageIds.length > 0
      ? adminClient
          .from("document_requirements")
          .select("id, visa_package_id, country, visa_type, requirement_key, label_en, label_zh, required, sort_order")
          .in("visa_package_id", packageIds)
      : Promise.resolve({ data: [], error: null }),
    countries.length > 0 && visaTypes.length > 0
      ? adminClient
          .from("document_requirements")
          .select("id, visa_package_id, country, visa_type, requirement_key, label_en, label_zh, required, sort_order")
          .in("country", countries)
          .in("visa_type", visaTypes)
          .is("visa_package_id", null)
      : Promise.resolve({ data: [], error: null }),
    loadApplicationDocumentRows(applicationIds),
    applicationIds.length > 0
      ? adminClient
          .from("visa_application_answers")
          .select("id, application_id, field_name, value_text, value_json, updated_at")
          .in("application_id", applicationIds)
          .limit(5000)
      : Promise.resolve({ data: [], error: null }),
    applicationIds.length > 0
      ? adminClient
          .from("payment_records")
          .select("id, application_id, applicant_id, visa_package_id, provider, provider_session_id, provider_payment_id, amount_cents, currency, status, fee_type, receipt_url, created_at, updated_at")
          .in("application_id", applicationIds)
          .limit(1000)
      : Promise.resolve({ data: [], error: null }),
    applicationIds.length > 0
      ? adminClient
          .from("consent_events")
          .select("id, application_id, applicant_id, consent_type, version, accepted, document_hash, created_at")
          .in("application_id", applicationIds)
          .limit(1000)
      : Promise.resolve({ data: [], error: null }),
    applicationIds.length > 0
      ? adminClient
          .from("application_signatures")
          .select("id, application_id, applicant_id, signature_type, signer_name, signed_document_path, document_hash, signed_at, created_at")
          .in("application_id", applicationIds)
          .limit(1000)
      : Promise.resolve({ data: [], error: null }),
    applicationIds.length > 0
      ? adminClient
          .from("application_packets")
          .select("id, application_id, applicant_id, status, manifest, storage_path, generated_at, created_at, updated_at")
          .in("application_id", applicationIds)
          .limit(1000)
      : Promise.resolve({ data: [], error: null }),
    applicationIds.length > 0
      ? adminClient
          .from("application_events")
          .select("id, application_id, applicant_id, event_type, actor_type, actor_id, message, metadata, created_at")
          .in("application_id", applicationIds)
          .limit(2000)
      : Promise.resolve({ data: [], error: null }),
    applicationIds.length > 0
      ? adminClient
          .from("notification_events")
          .select("id, application_id, applicant_id, channel, template_key, recipient, status, sent_at, created_at, updated_at")
          .in("application_id", applicationIds)
          .limit(1000)
      : Promise.resolve({ data: [], error: null }),
    loadLiveSubmissionSummaries(adminClient, applicationIds).catch(() => new Map<string, LiveSubmissionSummary>()),
  ]);

  const firstError = [
    profileRes.error,
    packageRes.error,
    packageRequirementRes.error,
    countryRequirementRes.error,
    documentRes.error,
    answerRes.error,
    paymentRes.error,
    consentRes.error,
    signatureRes.error,
    packetRes.error,
    eventRes.error,
    notificationRes.error,
  ].find((error) => Boolean(error) && !isSchemaMissingError(error));

  if (firstError) {
    throw new Error(getQueryErrorMessage(firstError));
  }

  const requirements = [
    ...((packageRequirementRes.data ?? []) as DocumentRequirementRow[]),
    ...((countryRequirementRes.data ?? []) as DocumentRequirementRow[]),
  ];
  const uniqueRequirements = Array.from(new Map(requirements.map((row) => [row.id, row])).values());

  return {
    profilesById: mapById((profileRes.data ?? []) as ApplicantProfileRow[]),
    packagesById: mapById((packageRes.data ?? []) as VisaPackageRow[]),
    requirements: uniqueRequirements,
    documentsByApplication: groupByApplication((documentRes.data ?? []) as ApplicationDocumentRow[]),
    answersByApplication: groupByApplication((answerRes.data ?? []) as ApplicationAnswerRow[]),
    paymentsByApplication: groupByApplication((paymentRes.data ?? []) as PaymentRecordRow[]),
    consentsByApplication: groupByApplication((consentRes.data ?? []) as ConsentEventRow[]),
    signaturesByApplication: groupByApplication((signatureRes.data ?? []) as ApplicationSignatureRow[]),
    packetsByApplication: groupByApplication((packetRes.data ?? []) as ApplicationPacketRow[]),
    eventsByApplication: groupByApplication((eventRes.data ?? []) as ApplicationEventRow[]),
    notificationsByApplication: groupByApplication((notificationRes.data ?? []) as NotificationEventRow[]),
    liveSubmissionByApplication,
  };
}

async function buildModels(applications: ApplicationRow[]): Promise<AdminApplicationModel[]> {
  if (applications.length === 0) return [];
  const related = await loadRelatedData(applications);
  return applications.map((application) => buildApplicationModel(application, related));
}

export async function fetchAdminApplicationQueue(): Promise<{
  rows: AdminApplicationModel[];
  error: string | null;
}> {
  try {
    const adminClient = createAdminClient();
    const fullResult = await adminClient
      .from("applications")
      .select(APPLICATION_AUTOMATION_SELECT)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(250);

    const { data, error } = fullResult.error && isSchemaMissingError(fullResult.error)
      ? await adminClient
          .from("applications")
          .select(APPLICATION_BASE_SELECT)
          .order("updated_at", { ascending: false, nullsFirst: false })
          .limit(250)
      : fullResult;

    if (error) throw new Error(error.message);

    const applicationRows = ((data ?? []) as Array<Partial<ApplicationRow> & Pick<ApplicationRow, "id" | "applicant_id" | "country" | "visa_type" | "status">>)
      .map(withApplicationDefaults);
    const rows = await buildModels(applicationRows);
    rows.sort((a, b) => {
      const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
      const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
      return bTime - aTime;
    });

    return { rows, error: null };
  } catch (error) {
    return {
      rows: [],
      error: error instanceof Error ? error.message : "Failed to load applications",
    };
  }
}

export async function fetchAdminApplicantQueue(): Promise<{
  applicants: AdminApplicantOverview[];
  applications: AdminApplicationModel[];
  error: string | null;
}> {
  const { rows, error } = await fetchAdminApplicationQueue();
  if (error) return { applicants: [], applications: rows, error };

  const packageAssignmentsByApplicant = await loadPackageAssignmentsByApplicant(rows);
  const applicationGroups = groupApplicationsByApplicant(rows);
  const applicants = [...applicationGroups.entries()].map(([applicantId, applications]) =>
    buildApplicantOverview(
      applicantId,
      applications,
      packageAssignmentsByApplicant.get(applicantId) ?? [],
    ),
  );

  return {
    applicants: sortApplicantOverviews(applicants),
    applications: rows,
    error: null,
  };
}

export async function fetchAdminApplicantDetail(id: string): Promise<{
  applicant: AdminApplicantOverview | null;
  error: string | null;
}> {
  const { applicants, applications, error } = await fetchAdminApplicantQueue();
  if (error) return { applicant: null, error };

  const directMatch = applicants.find((applicant) => applicant.applicantId === id);
  if (directMatch) return { applicant: directMatch, error: null };

  const applicationMatch = applications.find((application) => application.id === id);
  if (!applicationMatch) return { applicant: null, error: null };

  return {
    applicant: applicants.find((applicant) => applicant.applicantId === applicationMatch.applicantId) ?? null,
    error: null,
  };
}

export async function fetchAdminApplicationDetail(id: string): Promise<{
  application: AdminApplicationModel | null;
  error: string | null;
}> {
  try {
    const adminClient = createAdminClient();
    const fullResult = await adminClient
      .from("applications")
      .select(APPLICATION_AUTOMATION_SELECT)
      .eq("id", id)
      .maybeSingle();

    const { data, error } = fullResult.error && isSchemaMissingError(fullResult.error)
      ? await adminClient
          .from("applications")
          .select(APPLICATION_BASE_SELECT)
          .eq("id", id)
          .maybeSingle()
      : fullResult;

    if (error) throw new Error(error.message);
    if (!data) return { application: null, error: null };

    const models = await buildModels([
      withApplicationDefaults(data as Partial<ApplicationRow> & Pick<ApplicationRow, "id" | "applicant_id" | "country" | "visa_type" | "status">),
    ]);
    return { application: models[0] ?? null, error: null };
  } catch (error) {
    return {
      application: null,
      error: error instanceof Error ? error.message : "Failed to load application",
    };
  }
}

export function maskPassport(passportNumber: string | null): string {
  if (!passportNumber) return "Not provided";
  const visible = passportNumber.slice(-4);
  return visible ? `**** ${visible}` : "Masked";
}

export function formatMoney(cents: number | null | undefined, currency: string | null | undefined): string {
  if (typeof cents !== "number") return "Not set";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(cents / 100);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Singapore",
  }).format(new Date(value));
}

export function shortenId(value: string | null | undefined): string {
  if (!value) return "Not set";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function isHttpUrl(value: string | null | undefined): boolean {
  return Boolean(value && /^https?:\/\//i.test(value));
}

export function isSensitiveField(fieldName: string): boolean {
  return /(passport|address|phone|email|birth|surname|given|full_name|name)/i.test(fieldName);
}

export function previewAnswer(answer: ApplicationAnswerRow): string {
  if (isSensitiveField(answer.field_name)) return "Masked for support view";
  if (answer.value_text?.trim()) return answer.value_text.trim();
  if (answer.value_json === null) return "Not provided";
  if (typeof answer.value_json === "string") return answer.value_json;
  if (typeof answer.value_json === "number" || typeof answer.value_json === "boolean") {
    return String(answer.value_json);
  }
  return JSON.stringify(answer.value_json);
}

export function buildStatusSummary(application: AdminApplicationModel): string {
  const applicantName = application.profile?.full_name || "Unnamed applicant";
  const missingItems =
    application.missingItems.length > 0 ? application.missingItems.join("; ") : "No blocking support items";

  return [
    `Application ${shortenId(application.id)} for ${applicantName}`,
    `${application.countryLabel} - ${application.visaTypeLabel}`,
    `Lifecycle: ${LIFECYCLE_LABELS[application.lifecycleState]}`,
    `Payment: ${PAYMENT_LABELS[application.payment.state]}`,
    `Consent: ${CONSENT_LABELS[application.consent.state]}`,
    `Documents: ${DOCUMENT_LABELS[application.documents.state]}`,
    `Packet: ${PACKET_LABELS[application.packet.state]}`,
    `External: ${EXTERNAL_LABELS[application.external.state]}`,
    `Result: ${RESULT_LABELS[application.result.state]}`,
    `Missing/support items: ${missingItems}`,
  ].join("\n");
}
