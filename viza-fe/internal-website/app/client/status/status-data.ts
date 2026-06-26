import "server-only";

// eslint-disable-next-line no-restricted-imports -- This server-only data loader uses service-role access after authenticating the applicant and scoping rows to their profile.
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getDestinationDisplayName,
  getDestinationDisplayNameZh,
  getDestinationFlag,
  getFormVisaType,
  getVisaDestinationKey,
  getVisaTypeDisplayName,
  getVisaTypeDisplayNameZh,
} from "@/lib/visa-destinations";
import {
  loadLiveSubmissionSummaries,
  type LiveSubmissionSummary,
} from "@/lib/submission-live-status";

export type StatusStepKey =
  | "payment"
  | "consent"
  | "form"
  | "documents"
  | "packet"
  | "handoff"
  | "result";

export type StatusStepState = "complete" | "current" | "attention" | "blocked" | "upcoming";

export type ClientStatusState =
  | "not_started"
  | "needs_payment"
  | "needs_consent"
  | "in_progress"
  | "needs_documents"
  | "packet_pending"
  | "external_pending"
  | "submitted"
  | "needs_attention"
  | "approved"
  | "rejected";

export type StatusActionKey =
  | "startApplication"
  | "pay"
  | "giveConsent"
  | "continueForm"
  | "uploadDocuments"
  | "waitPacket"
  | "waitExternal"
  | "downloadResult"
  | "contactSupport";

export type StatusFileKey =
  | "applicationReceipt"
  | "paymentReceipt"
  | "packet"
  | "arrivalCardConfirmation"
  | "approvedResult"
  | "rejectionLetter"
  | "resultFile";

export interface StatusStep {
  key: StatusStepKey;
  state: StatusStepState;
  updatedAt: string | null;
  statusValue: string | null;
  metricValue: string | null;
}

export interface StatusAction {
  key: StatusActionKey;
  href: string;
  primary: boolean;
}

export interface StatusFile {
  key: StatusFileKey;
  href: string | null;
  reference: string;
  createdAt: string | null;
}

export interface StatusEvent {
  eventType: string;
  createdAt: string | null;
}

export interface CountryApplicationRecord {
  id: string;
  packageId: string | null;
  country: string;
  visaType: string;
  visaTypeLabel: string;
  visaTypeLabelZh: string;
  state: ClientStatusState;
  progressPercent: number;
  createdAt: string | null;
  updatedAt: string | null;
  submittedAt: string | null;
  confirmationNumber: string | null;
  file: StatusFile | null;
  detailHref: string;
}

export interface StatusApplication {
  key: string;
  countryKey: string;
  id: string | null;
  packageId: string | null;
  country: string;
  visaType: string;
  countryName: string;
  countryNameZh: string;
  countryFlag: string;
  visaTypeLabel: string;
  visaTypeLabelZh: string;
  packageName: string | null;
  state: ClientStatusState;
  progressPercent: number;
  createdAt: string | null;
  updatedAt: string | null;
  submittedAt: string | null;
  officialReference: string | null;
  officialReferenceKind: "official" | "viza" | null;
  rawApplicationStatus: string | null;
  externalStatus: string | null;
  resultStatus: string | null;
  liveSubmission: LiveSubmissionSummary | null;
  governmentFee: {
    amountCents: number | null;
    currency: string | null;
    mode: string | null;
  };
  officialFee: {
    status: string | null;
    quoteId: string | null;
    paymentIntentId: string | null;
    receiptId: string | null;
  };
  payment: {
    status: string | null;
    amountCents: number | null;
    currency: string | null;
    updatedAt: string | null;
  };
  consent: {
    accepted: boolean;
    signaturePresent: boolean;
    updatedAt: string | null;
  };
  formAnswerCount: number;
  documents: {
    total: number;
    uploaded: number;
    validated: number;
    missing: number;
    rejected: number;
  };
  packet: {
    status: string | null;
    readyAt: string | null;
    storagePath: string | null;
  };
  notifications: {
    total: number;
    lastSentAt: string | null;
  };
  steps: StatusStep[];
  actions: StatusAction[];
  files: StatusFile[];
  events: StatusEvent[];
  applicationRecords: CountryApplicationRecord[];
}

export interface ClientStatusData {
  applications: StatusApplication[];
  detailApplications: StatusApplication[];
  partialData: boolean;
}

interface ApplicantProfileRow {
  id: string;
  email: string | null;
}

interface VisaPackageRow {
  id: string;
  country: string;
  visa_type: string;
  name: string | null;
  description: string | null;
  price_cents: number | null;
  currency: string | null;
  metadata: Record<string, unknown> | null;
}

interface UserPackageRow {
  visa_package_id: string | null;
  application_id: string | null;
  assigned_at: string | null;
  status: string | null;
  visa_packages: VisaPackageRow | VisaPackageRow[] | null;
}

interface ApplicationRow {
  id: string;
  applicant_id: string;
  country: string;
  visa_type: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  submitted_at: string | null;
  confirmation_number: string | null;
  receipt_url: string | null;
  visa_package_id: string | null;
  packet_status: string | null;
  packet_storage_path: string | null;
  packet_ready_at: string | null;
  external_status: string | null;
  external_reference: string | null;
  external_status_updated_at: string | null;
  result_status: string | null;
  result_storage_path: string | null;
  submission_result: unknown | null;
  submission_result_status: string | null;
  submission_result_updated_at: string | null;
  government_fee_cents: number | null;
  government_fee_currency: string | null;
  government_fee_mode: string | null;
  official_fee_status: string | null;
  official_fee_quote_id: string | null;
  official_fee_payment_intent_id: string | null;
  official_fee_receipt_id: string | null;
}

interface SubmissionResultColumnRow {
  id: string;
  submission_result: unknown | null;
  submission_result_status: string | null;
  submission_result_updated_at: string | null;
}

interface PaymentRow {
  id: string;
  application_id: string | null;
  visa_package_id: string | null;
  status: string;
  amount_cents: number;
  currency: string;
  fee_type: string;
  receipt_url: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ConsentRow {
  application_id: string;
  accepted: boolean;
  created_at: string | null;
}

interface SignatureRow {
  application_id: string;
  signed_at: string | null;
  created_at: string | null;
}

interface DocumentRow {
  application_id: string;
  status: string;
  required: boolean | null;
}

interface AnswerRow {
  application_id: string;
  field_name: string;
  value_text: string | null;
  value_json: unknown;
}

interface PacketRow {
  application_id: string;
  status: string;
  storage_path: string | null;
  generated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface EventRow {
  application_id: string;
  event_type: string;
  created_at: string | null;
}

interface NotificationRow {
  application_id: string | null;
  status: string;
  sent_at: string | null;
  created_at: string | null;
}

interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

interface ReadRowsResult<T> {
  rows: T[];
  failed: boolean;
}

const STEP_ORDER: StatusStepKey[] = [
  "payment",
  "consent",
  "form",
  "documents",
  "packet",
  "handoff",
  "result",
];

const PAID_PAYMENT_STATUSES = new Set(["paid", "succeeded", "complete", "completed"]);
const PENDING_PAYMENT_STATUSES = new Set(["pending", "processing", "requires_payment_method"]);
const ATTENTION_PAYMENT_STATUSES = new Set(["failed", "canceled", "cancelled", "refunded"]);
const READY_PACKET_STATUSES = new Set(["ready", "generated", "complete", "completed", "sent", "handed_off"]);
const ATTENTION_STATUSES = new Set(["failed", "error", "needs_attention", "blocked", "rejected"]);
const EXTERNAL_ACTIVE_STATUSES = new Set(["submitted", "received", "in_review", "processing", "under_review"]);
const APPROVED_RESULT_STATUSES = new Set(["approved", "issued", "granted"]);
const REJECTED_RESULT_STATUSES = new Set(["rejected", "refused", "denied"]);
const SUCCESS_SUBMISSION_RESULT_STATUSES = new Set(["completed", "complete", "submitted", "success", "done"]);
const ARRIVAL_CARD_READY_RESULT_STATUSES = new Set(["form_ready_for_agency"]);
const SGAC_VISA_TYPE = "SG_ARRIVAL_CARD";
const ARRIVAL_CARD_VISA_TYPES = new Set([SGAC_VISA_TYPE, "MY_MDAC_ARRIVAL_CARD", "TH_TDAC_ARRIVAL_CARD"]);
const SGAC_OWNER_EMAIL_FIELD_NAMES = ["email_address"];
const STORAGE_BUCKETS = new Set(["application-documents", "application-results", "application-packets", "visa-results", "submission-artifacts"]);
const APPLICATION_STATUS_SELECT =
  "id, applicant_id, country, visa_type, status, created_at, updated_at, submitted_at, confirmation_number, receipt_url, visa_package_id, packet_status, packet_storage_path, packet_ready_at, external_status, external_reference, external_status_updated_at, result_status, result_storage_path, government_fee_cents, government_fee_currency, government_fee_mode";

function normalizeStatus(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function isAbsoluteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getStringValue(record: Record<string, unknown> | null, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function getStringArrayValue(record: Record<string, unknown> | null, key: string): string[] {
  if (!record) return [];
  const value = record[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function getSubmissionResult(application: ApplicationRow): Record<string, unknown> | null {
  return isRecord(application.submission_result) ? application.submission_result : null;
}

function submissionResultIsSubmitted(application: ApplicationRow): boolean {
  const result = getSubmissionResult(application);
  const resultStatus = normalizeStatus(getStringValue(result, ["status"]));
  const storedStatus = normalizeStatus(application.submission_result_status);
  return (
    result?.submitted === true ||
    resultStatus === "submitted" ||
    SUCCESS_SUBMISSION_RESULT_STATUSES.has(storedStatus)
  );
}

export function isArrivalCardVisaType(visaType: string | null | undefined): boolean {
  const normalizedVisaType = getFormVisaType(visaType ?? "").trim();
  const upperVisaType = normalizedVisaType.toUpperCase();
  return ARRIVAL_CARD_VISA_TYPES.has(upperVisaType) || upperVisaType.endsWith("_ARRIVAL_CARD");
}

function isArrivalCardStatusTarget(target: {
  country?: string | null;
  visaType?: string | null;
  visaTypeLabel?: string | null;
  visaTypeLabelZh?: string | null;
}): boolean {
  if (isArrivalCardVisaType(target.visaType)) return true;
  const haystack = [target.country, target.visaTypeLabel, target.visaTypeLabelZh]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
  return (
    haystack.includes("arrival card") ||
    haystack.includes("sgac") ||
    haystack.includes("mdac") ||
    haystack.includes("tdac") ||
    haystack.includes("入境卡")
  );
}

function arrivalCardResultIsReady(application: ApplicationRow): boolean {
  return isArrivalCardVisaType(application.visa_type) && ARRIVAL_CARD_READY_RESULT_STATUSES.has(normalizeStatus(application.submission_result_status));
}

function getSubmissionResultReference(application: ApplicationRow): string | null {
  const result = getSubmissionResult(application);
  return getStringValue(result, ["confirmationNumber", "referenceNumber", "applicationReference", "reference"]);
}

function getSubmissionResultPdfPaths(application: ApplicationRow): string[] {
  const result = getSubmissionResult(application);
  const paths = new Set<string>();
  const primaryPath = getStringValue(result, ["confirmationPdfStoragePath", "printablePdfStoragePath", "artifactStoragePath"]);
  if (primaryPath) paths.add(primaryPath);

  const artifacts = isRecord(result?.artifacts) ? result.artifacts : null;
  for (const path of getStringArrayValue(artifacts, "pdfs")) paths.add(path);

  return [...paths];
}

function sortByNewest<T>(rows: T[], getDate: (row: T) => string | null | undefined): T[] {
  return [...rows].sort((a, b) => {
    const aTime = new Date(getDate(a) ?? 0).getTime();
    const bTime = new Date(getDate(b) ?? 0).getTime();
    return bTime - aTime;
  });
}

function groupByApplication<T extends { application_id: string | null }>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    if (!row.application_id) continue;
    const existing = grouped.get(row.application_id) ?? [];
    existing.push(row);
    grouped.set(row.application_id, existing);
  }
  return grouped;
}

function unwrapVisaPackage(row: UserPackageRow): VisaPackageRow | null {
  if (Array.isArray(row.visa_packages)) return row.visa_packages[0] ?? null;
  return row.visa_packages ?? null;
}

function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

function withApplicationDefaults(row: ApplicationRow): ApplicationRow {
  return {
    ...row,
    submission_result: row.submission_result ?? null,
    submission_result_status: row.submission_result_status ?? null,
    submission_result_updated_at: row.submission_result_updated_at ?? null,
    official_fee_status: row.official_fee_status ?? null,
    official_fee_quote_id: row.official_fee_quote_id ?? null,
    official_fee_payment_intent_id: row.official_fee_payment_intent_id ?? null,
    official_fee_receipt_id: row.official_fee_receipt_id ?? null,
  };
}

function getApplicationTime(application: StatusApplication): number {
  return new Date(application.updatedAt ?? application.submittedAt ?? application.createdAt ?? 0).getTime();
}

function normalizeCountryGroupKey(country: string): string {
  return country.trim().toLowerCase();
}

function getCountryApplicationRecordTime(record: CountryApplicationRecord): number {
  return new Date(record.updatedAt ?? record.submittedAt ?? record.createdAt ?? record.file?.createdAt ?? 0).getTime();
}

function getPrimaryResultFile(application: StatusApplication): StatusFile | null {
  return (
    application.files.find((file) => file.key === "arrivalCardConfirmation") ??
    application.files.find((file) => file.key === "approvedResult") ??
    application.files.find((file) => file.key === "resultFile") ??
    application.files.find((file) => file.key === "rejectionLetter") ??
    null
  );
}

function toCountryApplicationRecord(application: StatusApplication): CountryApplicationRecord {
  const detailHref = application.id
    ? `/client/status?applicationId=${encodeURIComponent(application.id)}&view=detail`
    : application.packageId
      ? `/client/status?packageId=${encodeURIComponent(application.packageId)}&view=detail`
      : `/client/status?country=${encodeURIComponent(application.countryKey)}&view=detail`;

  return {
    id: application.id ?? application.key,
    packageId: application.packageId,
    country: application.country,
    visaType: application.visaType,
    visaTypeLabel: application.visaTypeLabel,
    visaTypeLabelZh: application.visaTypeLabelZh,
    state: getArrivalCardDisplayState(application),
    progressPercent: application.progressPercent,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
    submittedAt: application.submittedAt ?? application.updatedAt,
    confirmationNumber: application.officialReference,
    file: getPrimaryResultFile(application),
    detailHref,
  };
}

function getArrivalCardDisplayState(
  application: Pick<
    StatusApplication,
    "country" | "visaType" | "visaTypeLabel" | "visaTypeLabelZh" | "state" | "officialReference" | "submittedAt" | "files"
  >,
): ClientStatusState {
  if (!isArrivalCardStatusTarget(application)) return application.state;
  if (
    application.state === "submitted" ||
    application.state === "approved" ||
    application.officialReference ||
    application.submittedAt ||
    application.files.some((file) => file.key === "arrivalCardConfirmation")
  ) {
    return "submitted";
  }
  if (application.state === "needs_payment" || application.state === "needs_consent") return "in_progress";
  return application.state;
}

function getCountryGroupState(records: CountryApplicationRecord[]): ClientStatusState {
  const latest = records[0];
  if (!latest) return "not_started";
  if (records.some((record) => record.state === "needs_attention" || record.state === "rejected")) {
    return records.find((record) => record.state === "needs_attention" || record.state === "rejected")?.state ?? latest.state;
  }
  const arrivalCardRecords = records.filter((record) => isArrivalCardStatusTarget(record));
  if (arrivalCardRecords.some((record) => record.state === "submitted" || record.state === "approved")) return "submitted";
  if (arrivalCardRecords.length > 0 && (latest.state === "needs_payment" || latest.state === "needs_consent")) return "in_progress";
  return latest.state;
}

function groupCountryApplications(applications: StatusApplication[]): StatusApplication[] {
  const grouped = new Map<string, StatusApplication[]>();

  for (const application of applications) {
    const key = application.countryKey;
    grouped.set(key, [...(grouped.get(key) ?? []), application]);
  }

  return [...grouped.values()]
    .map((groupApplications) => {
      const sortedApplications = [...groupApplications].sort((a, b) => getApplicationTime(b) - getApplicationTime(a));
      const representative = sortedApplications[0];
      const records = sortedApplications
        .map(toCountryApplicationRecord)
        .sort((a, b) => getCountryApplicationRecordTime(b) - getCountryApplicationRecordTime(a));
      const state = getCountryGroupState(records);

      return {
        ...representative,
        key: `country:${representative.countryKey}`,
        id: null,
        packageId: null,
        state,
        progressPercent:
          records.length > 0
            ? Math.round(records.reduce((sum, record) => sum + record.progressPercent, 0) / records.length)
            : representative.progressPercent,
        updatedAt: getLatestDate(records.map((record) => record.updatedAt ?? record.submittedAt ?? record.createdAt)),
        officialReference: null,
        officialReferenceKind: null,
        liveSubmission: null,
        actions: [],
        files: records.map((record) => record.file).filter((file): file is StatusFile => Boolean(file)),
        events: [],
        applicationRecords: records,
        visaTypeLabel: records.length === 1 ? representative.visaTypeLabel : `${records.length} application records`,
        visaTypeLabelZh: records.length === 1 ? representative.visaTypeLabelZh : `${records.length} 条申请记录`,
      };
    })
    .sort((a, b) => getApplicationTime(b) - getApplicationTime(a));
}

async function readRows<T>(query: PromiseLike<QueryResult>): Promise<ReadRowsResult<T>> {
  try {
    const { data, error } = await query;
    if (error) return { rows: [], failed: true };
    return { rows: (Array.isArray(data) ? data : []) as T[], failed: false };
  } catch {
    return { rows: [], failed: true };
  }
}

async function hydrateSubmissionResults(
  adminClient: ReturnType<typeof createAdminClient>,
  applications: ApplicationRow[],
): Promise<{ applications: ApplicationRow[]; failed: boolean }> {
  const applicationIds = applications.map((application) => application.id);
  if (applicationIds.length === 0) return { applications, failed: false };

  const { rows, failed } = await readRows<SubmissionResultColumnRow>(
    adminClient
      .from("applications")
      .select("id, submission_result, submission_result_status, submission_result_updated_at")
      .in("id", applicationIds),
  );
  const submissionResultsById = new Map(rows.map((row) => [row.id, row]));
  return {
    failed,
    applications: applications.map((application) => {
      const submissionResult = submissionResultsById.get(application.id);
      if (!submissionResult) return application;
      return {
        ...application,
        submission_result: submissionResult.submission_result,
        submission_result_status: submissionResult.submission_result_status,
        submission_result_updated_at: submissionResult.submission_result_updated_at,
      };
    }),
  };
}

function getLatestPayment(rows: PaymentRow[]): PaymentRow | null {
  return sortByNewest(rows, (row) => row.updated_at ?? row.created_at)[0] ?? null;
}

function getLatestPacket(rows: PacketRow[]): PacketRow | null {
  return sortByNewest(rows, (row) => row.updated_at ?? row.generated_at ?? row.created_at)[0] ?? null;
}

function getDocumentCounts(rows: DocumentRow[]): StatusApplication["documents"] {
  return rows.reduce<StatusApplication["documents"]>(
    (counts, document) => {
      if (document.required === false) return counts;
      const status = normalizeStatus(document.status);
      counts.total += 1;
      if (status === "validated" || status === "approved") counts.validated += 1;
      else if (status === "missing") counts.missing += 1;
      else if (status === "rejected") counts.rejected += 1;
      else counts.uploaded += 1;
      return counts;
    },
    { total: 0, uploaded: 0, validated: 0, missing: 0, rejected: 0 },
  );
}

function getAnswerCount(rows: AnswerRow[]): number {
  return new Set(
    rows
      .filter((row) => row.field_name !== "photo_path")
      .filter((row) => {
        if (typeof row.value_text === "string" && row.value_text.trim()) return true;
        return row.value_json !== null && row.value_json !== undefined;
      })
      .map((row) => row.field_name),
  ).size;
}

function getLatestDate(values: Array<string | null | undefined>): string | null {
  const latest = values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  return latest ?? null;
}

function buildPackageBase(country: string, visaType: string) {
  const normalizedVisaType = getFormVisaType(visaType);
  const countryName = getDestinationDisplayName(country);
  const countryNameZh = getDestinationDisplayNameZh(country);
  const countryKey = normalizeCountryGroupKey(countryNameZh || countryName || country);
  return {
    key: getVisaDestinationKey(country, normalizedVisaType),
    countryKey,
    country,
    visaType: normalizedVisaType,
    countryName,
    countryNameZh,
    countryFlag: getDestinationFlag(country),
    visaTypeLabel: getVisaTypeDisplayName(normalizedVisaType),
    visaTypeLabelZh: getVisaTypeDisplayNameZh(normalizedVisaType),
  };
}

function paymentIsComplete(payment: PaymentRow | null): boolean {
  return PAID_PAYMENT_STATUSES.has(normalizeStatus(payment?.status));
}

function paymentNeedsAttention(payment: PaymentRow | null): boolean {
  return ATTENTION_PAYMENT_STATUSES.has(normalizeStatus(payment?.status));
}

function getPaymentState(payment: PaymentRow | null): StatusStepState {
  if (paymentIsComplete(payment)) return "complete";
  if (paymentNeedsAttention(payment)) return "attention";
  if (PENDING_PAYMENT_STATUSES.has(normalizeStatus(payment?.status))) return "current";
  return "blocked";
}

function getConsentState(consents: ConsentRow[], signatures: SignatureRow[], paymentComplete: boolean): StatusStepState {
  const latestConsent = sortByNewest(consents, (row) => row.created_at)[0];
  if (latestConsent?.accepted || signatures.length > 0) return "complete";
  if (latestConsent && !latestConsent.accepted) return "attention";
  return paymentComplete ? "current" : "upcoming";
}

function getFormState(application: ApplicationRow | null, answerCount: number, consentComplete: boolean): StatusStepState {
  if (!application) return consentComplete ? "current" : "upcoming";
  const rawStatus = normalizeStatus(application.status);
  if (application.submitted_at || rawStatus === "submitted" || APPROVED_RESULT_STATUSES.has(rawStatus) || REJECTED_RESULT_STATUSES.has(rawStatus)) {
    return "complete";
  }
  if (answerCount > 0) return "current";
  return consentComplete ? "blocked" : "upcoming";
}

function getDocumentState(
  documents: StatusApplication["documents"],
  formStarted: boolean,
  applicationSubmitted: boolean,
): StatusStepState {
  if (applicationSubmitted) return "complete";
  if (documents.rejected > 0 || documents.missing > 0) return "attention";
  if (documents.total > 0 && documents.rejected === 0 && documents.missing === 0) return "complete";
  return formStarted ? "current" : "upcoming";
}

function getPacketState(
  application: ApplicationRow,
  latestPacket: PacketRow | null,
  documentsComplete: boolean,
): StatusStepState {
  const status = normalizeStatus(latestPacket?.status ?? application.packet_status);
  if (READY_PACKET_STATUSES.has(status) || latestPacket?.storage_path || application.packet_storage_path || application.packet_ready_at) {
    return "complete";
  }
  if (ATTENTION_STATUSES.has(status)) return "attention";
  return documentsComplete ? "current" : "upcoming";
}

function getHandoffState(
  application: ApplicationRow,
  packetComplete: boolean,
  liveSubmission: LiveSubmissionSummary | null,
): StatusStepState {
  if (submissionResultIsSubmitted(application)) return "complete";
  if (liveSubmission?.state === "action_required" || liveSubmission?.state === "failed") return "attention";
  if (
    liveSubmission?.state === "pending" ||
    liveSubmission?.state === "running" ||
    liveSubmission?.state === "submitted" ||
    liveSubmission?.state === "completed"
  ) {
    return "complete";
  }

  const status = normalizeStatus(application.external_status);
  if (application.external_reference || EXTERNAL_ACTIVE_STATUSES.has(status) || APPROVED_RESULT_STATUSES.has(status) || REJECTED_RESULT_STATUSES.has(status)) {
    return "complete";
  }
  if (ATTENTION_STATUSES.has(status)) return "attention";
  return packetComplete ? "current" : "upcoming";
}

function getResultState(
  application: ApplicationRow,
  handoffComplete: boolean,
  liveSubmission: LiveSubmissionSummary | null,
): StatusStepState {
  const resultStatus = normalizeStatus(application.result_status);
  const submissionResultStatus = normalizeStatus(application.submission_result_status);
  const rawStatus = normalizeStatus(application.status);
  if (liveSubmission?.state === "failed" && !submissionResultIsSubmitted(application)) return "attention";
  if (
    liveSubmission?.state === "submitted" ||
    liveSubmission?.state === "completed" ||
    application.result_storage_path ||
    submissionResultIsSubmitted(application) ||
    APPROVED_RESULT_STATUSES.has(resultStatus) ||
    SUCCESS_SUBMISSION_RESULT_STATUSES.has(submissionResultStatus) ||
    REJECTED_RESULT_STATUSES.has(resultStatus) ||
    APPROVED_RESULT_STATUSES.has(rawStatus) ||
    REJECTED_RESULT_STATUSES.has(rawStatus)
  ) {
    return "complete";
  }
  if (liveSubmission?.state === "pending" || liveSubmission?.state === "running") return "current";
  if (ATTENTION_STATUSES.has(resultStatus) || ATTENTION_STATUSES.has(submissionResultStatus)) return "attention";
  return handoffComplete ? "current" : "upcoming";
}

function getOverallState(steps: StatusStep[], application: ApplicationRow | null): ClientStatusState {
  const rawStatus = normalizeStatus(application?.status);
  const resultStatus = normalizeStatus(application?.result_status);
  const submissionResultStatus = normalizeStatus(application?.submission_result_status);
  if (APPROVED_RESULT_STATUSES.has(rawStatus) || APPROVED_RESULT_STATUSES.has(resultStatus)) return "approved";
  if (REJECTED_RESULT_STATUSES.has(rawStatus) || REJECTED_RESULT_STATUSES.has(resultStatus)) return "rejected";
  if (application && (submissionResultIsSubmitted(application) || SUCCESS_SUBMISSION_RESULT_STATUSES.has(submissionResultStatus))) return "submitted";
  if (!application) return "not_started";
  if (steps.some((step) => step.state === "attention")) return "needs_attention";

  const firstOpenStep = steps.find((step) => step.state !== "complete");
  if (!firstOpenStep) return "submitted";
  if (firstOpenStep.key === "payment") return "needs_payment";
  if (firstOpenStep.key === "consent") return "needs_consent";
  if (firstOpenStep.key === "documents") return "needs_documents";
  if (firstOpenStep.key === "packet") return "packet_pending";
  if (firstOpenStep.key === "handoff") return "external_pending";
  if (firstOpenStep.key === "result") return "submitted";
  return "in_progress";
}

function getProgressPercent(steps: StatusStep[], state: ClientStatusState): number {
  if (state === "approved" || state === "rejected") return 100;
  const complete = steps.filter((step) => step.state === "complete").length;
  if (complete === STEP_ORDER.length) return 100;
  const active = steps.filter((step) => step.state === "current" || step.state === "attention").length;
  return Math.min(98, Math.round(((complete + active * 0.5) / STEP_ORDER.length) * 100));
}

function getArrivalCardProgressPercent({
  liveSubmission,
  state,
  fallback,
  submissionResultSubmitted,
}: {
  liveSubmission: LiveSubmissionSummary | null;
  state: ClientStatusState;
  fallback: number;
  submissionResultSubmitted: boolean;
}): number {
  if (submissionResultSubmitted || liveSubmission?.state === "submitted" || liveSubmission?.state === "completed") {
    return 100;
  }
  if (liveSubmission?.state === "running") return 72;
  if (liveSubmission?.state === "pending") return 52;
  if (liveSubmission?.state === "action_required" || liveSubmission?.state === "failed") return Math.max(52, fallback);
  if (state === "external_pending" || state === "submitted") return Math.max(52, fallback);
  return Math.max(36, fallback);
}

function buildActions(
  application: ApplicationRow | null,
  packageBase: { country: string; visaType: string },
  steps: StatusStep[],
  resultFile: StatusFile | null,
): StatusAction[] {
  const applicationHref = `/client/application?country=${encodeURIComponent(packageBase.country)}&visaType=${encodeURIComponent(packageBase.visaType)}`;
  const actions: StatusAction[] = [];

  if (!application) {
    actions.push({ key: "startApplication", href: applicationHref, primary: true });
    return actions;
  }

  const firstOpenStep = steps.find((step) => step.state !== "complete");
  if (!firstOpenStep) {
    if (resultFile?.href) actions.push({ key: "downloadResult", href: resultFile.href, primary: true });
    else actions.push({ key: "contactSupport", href: "/client/support", primary: true });
    return actions;
  }

  if (firstOpenStep.state === "attention") {
    if (firstOpenStep.key === "documents") {
      actions.push({ key: "uploadDocuments", href: "/client/documents", primary: true });
    } else {
      actions.push({ key: "contactSupport", href: "/client/support", primary: true });
    }
    return actions;
  }

  if (firstOpenStep.key === "payment") {
    actions.push({ key: "pay", href: `/client/checkout?applicationId=${encodeURIComponent(application.id)}`, primary: true });
  } else if (firstOpenStep.key === "consent") {
    actions.push({ key: "giveConsent", href: `/client/consent?applicationId=${encodeURIComponent(application.id)}`, primary: true });
  } else if (firstOpenStep.key === "form") {
    actions.push({ key: "continueForm", href: applicationHref, primary: true });
  } else if (firstOpenStep.key === "documents") {
    actions.push({ key: "uploadDocuments", href: "/client/documents", primary: true });
  } else if (firstOpenStep.key === "packet") {
    actions.push({ key: "waitPacket", href: `/client/status?applicationId=${encodeURIComponent(application.id)}`, primary: true });
  } else if (firstOpenStep.key === "handoff") {
    actions.push({ key: "waitExternal", href: `/client/status?applicationId=${encodeURIComponent(application.id)}`, primary: true });
  } else if (resultFile?.href) {
    actions.push({ key: "downloadResult", href: resultFile.href, primary: true });
  } else {
    actions.push({ key: "contactSupport", href: "/client/support", primary: true });
  }

  if (!actions.some((action) => action.key === "continueForm")) {
    actions.push({ key: "continueForm", href: applicationHref, primary: false });
  }

  return actions;
}

function getStepMetric(key: StatusStepKey, application: StatusApplication): string | null {
  if (key === "payment" && application.payment.amountCents !== null) return String(application.payment.amountCents);
  if (key === "consent") return application.consent.signaturePresent ? "signed" : application.consent.accepted ? "accepted" : null;
  if (key === "form") return String(application.formAnswerCount);
  if (key === "documents") return `${application.documents.uploaded + application.documents.validated}/${application.documents.total}`;
  if (key === "packet") return application.packet.storagePath ? "file" : null;
  if (key === "handoff") return application.officialReference;
  if (key === "result") return application.files.some((file) => file.key !== "applicationReceipt" && file.key !== "paymentReceipt") ? "file" : null;
  return null;
}

function buildSteps(application: StatusApplication): StatusStep[] {
  return application.steps.map((step) => ({
    ...step,
    metricValue: getStepMetric(step.key, application),
  }));
}

function parseStoragePath(reference: string): { bucket: string; path: string } {
  const normalized = reference.replace(/^\/+/, "");
  const [firstSegment, ...rest] = normalized.split("/");
  if (firstSegment && STORAGE_BUCKETS.has(firstSegment) && rest.length > 0) {
    return { bucket: firstSegment, path: rest.join("/") };
  }
  return { bucket: "application-documents", path: normalized };
}

async function resolveStorageHref(adminClient: ReturnType<typeof createAdminClient>, reference: string | null): Promise<string | null> {
  if (!reference) return null;
  if (isAbsoluteUrl(reference)) return reference;

  const { bucket, path } = parseStoragePath(reference);
  const { data, error } = await adminClient.storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

async function resolveSubmissionArtifactHref(adminClient: ReturnType<typeof createAdminClient>, reference: string | null): Promise<string | null> {
  if (!reference) return null;
  if (isAbsoluteUrl(reference)) return reference;

  const { bucket, path } = parseStoragePath(reference);
  const artifactPath = bucket === "submission-artifacts" ? path : reference.replace(/^\/+/, "");
  const { data, error } = await adminClient.storage.from("submission-artifacts").createSignedUrl(artifactPath, 60 * 60);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

function buildNotificationSummary(rows: NotificationRow[]): StatusApplication["notifications"] {
  return {
    total: rows.length,
    lastSentAt: getLatestDate(rows.map((row) => row.sent_at ?? row.created_at)),
  };
}

async function buildFiles({
  adminClient,
  application,
  latestPayment,
  latestPacket,
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  application: ApplicationRow;
  latestPayment: PaymentRow | null;
  latestPacket: PacketRow | null;
}): Promise<StatusFile[]> {
  const files: StatusFile[] = [];
  if (application.receipt_url) {
    files.push({
      key: "applicationReceipt",
      href: await resolveStorageHref(adminClient, application.receipt_url),
      reference: application.receipt_url,
      createdAt: application.submitted_at ?? application.updated_at,
    });
  }

  if (latestPayment?.receipt_url) {
    files.push({
      key: "paymentReceipt",
      href: await resolveStorageHref(adminClient, latestPayment.receipt_url),
      reference: latestPayment.receipt_url,
      createdAt: latestPayment.updated_at ?? latestPayment.created_at,
    });
  }

  const packetPath = latestPacket?.storage_path ?? application.packet_storage_path;
  if (packetPath) {
    files.push({
      key: "packet",
      href: await resolveStorageHref(adminClient, packetPath),
      reference: packetPath,
      createdAt: latestPacket?.generated_at ?? application.packet_ready_at,
    });
  }

  if (application.result_storage_path) {
    const resultStatus = normalizeStatus(application.result_status ?? application.status);
    const resultKey: StatusFileKey = REJECTED_RESULT_STATUSES.has(resultStatus)
      ? "rejectionLetter"
      : APPROVED_RESULT_STATUSES.has(resultStatus)
        ? "approvedResult"
        : "resultFile";
    files.push({
      key: resultKey,
      href: await resolveStorageHref(adminClient, application.result_storage_path),
      reference: application.result_storage_path,
      createdAt: application.updated_at,
    });
  }

  for (const path of getSubmissionResultPdfPaths(application)) {
    files.push({
      key: isArrivalCardVisaType(application.visa_type) ? "arrivalCardConfirmation" : "resultFile",
      href: await resolveSubmissionArtifactHref(adminClient, path),
      reference: path,
      createdAt: application.submission_result_updated_at ?? application.submitted_at ?? application.updated_at,
    });
  }

  return files;
}

function buildPackageOnlyApplication(userPackage: {
  assignedAt: string | null;
  package: VisaPackageRow;
  payment: PaymentRow | null;
}): StatusApplication {
  const base = buildPackageBase(userPackage.package.country, userPackage.package.visa_type);
  const paymentState = getPaymentState(userPackage.payment);
  const paymentComplete = paymentState === "complete";
  const steps: StatusStep[] = [
    {
      key: "payment",
      state: paymentState,
      updatedAt: userPackage.payment?.updated_at ?? userPackage.payment?.created_at ?? userPackage.assignedAt,
      statusValue: userPackage.payment?.status ?? null,
      metricValue: null,
    },
    {
      key: "consent",
      state: paymentComplete ? "current" : "upcoming",
      updatedAt: null,
      statusValue: null,
      metricValue: null,
    },
    { key: "form", state: "upcoming", updatedAt: null, statusValue: null, metricValue: null },
    { key: "documents", state: "upcoming", updatedAt: null, statusValue: null, metricValue: null },
    { key: "packet", state: "upcoming", updatedAt: null, statusValue: null, metricValue: null },
    { key: "handoff", state: "upcoming", updatedAt: null, statusValue: null, metricValue: null },
    { key: "result", state: "upcoming", updatedAt: null, statusValue: null, metricValue: null },
  ];
  const state = paymentComplete ? "needs_consent" : "not_started";

  const shell: StatusApplication = {
    ...base,
    id: null,
    packageId: userPackage.package.id,
    packageName: userPackage.package.name,
    state,
    progressPercent: getProgressPercent(steps, state),
    createdAt: userPackage.assignedAt,
    updatedAt: userPackage.assignedAt,
    submittedAt: null,
    officialReference: null,
    officialReferenceKind: null,
    rawApplicationStatus: null,
    externalStatus: null,
    resultStatus: null,
    liveSubmission: null,
    governmentFee: {
      amountCents: null,
      currency: userPackage.package.currency,
      mode: null,
    },
    officialFee: {
      status: null,
      quoteId: null,
      paymentIntentId: null,
      receiptId: null,
    },
    payment: {
      status: userPackage.payment?.status ?? null,
      amountCents: userPackage.payment?.amount_cents ?? userPackage.package.price_cents,
      currency: userPackage.payment?.currency ?? userPackage.package.currency,
      updatedAt: userPackage.payment?.updated_at ?? userPackage.payment?.created_at ?? null,
    },
    consent: {
      accepted: false,
      signaturePresent: false,
      updatedAt: null,
    },
    formAnswerCount: 0,
    documents: { total: 0, uploaded: 0, validated: 0, missing: 0, rejected: 0 },
    packet: { status: null, readyAt: null, storagePath: null },
    notifications: { total: 0, lastSentAt: null },
    steps,
    actions: [],
    files: [],
    events: [],
    applicationRecords: [],
  };

  const metricSteps = buildSteps(shell);
  return {
    ...shell,
    steps: metricSteps,
    actions: buildActions(null, base, metricSteps, null),
  };
}

async function buildApplicationStatus({
  adminClient,
  application,
  visaPackage,
  liveSubmission,
  payments,
  consents,
  signatures,
  documents,
  answers,
  packets,
  events,
  notifications,
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  application: ApplicationRow;
  visaPackage: VisaPackageRow | null;
  liveSubmission: LiveSubmissionSummary | null;
  payments: PaymentRow[];
  consents: ConsentRow[];
  signatures: SignatureRow[];
  documents: DocumentRow[];
  answers: AnswerRow[];
  packets: PacketRow[];
  events: EventRow[];
  notifications: NotificationRow[];
}): Promise<StatusApplication> {
  const base = buildPackageBase(application.country, application.visa_type);
  const latestPayment = getLatestPayment(payments);
  const latestPacket = getLatestPacket(packets);
  const documentCounts = getDocumentCounts(documents);
  const answerCount = getAnswerCount(answers);
  const isArrivalCard = isArrivalCardStatusTarget({
    country: application.country,
    visaType: application.visa_type,
    visaTypeLabel: base.visaTypeLabel,
    visaTypeLabelZh: base.visaTypeLabelZh,
  });
  const paymentState = getPaymentState(latestPayment);
  const paymentComplete = paymentState === "complete";
  const consentState = getConsentState(consents, signatures, paymentComplete);
  const consentComplete = consentState === "complete";
  const formState = getFormState(application, answerCount, consentComplete);
  const formStarted = answerCount > 0 || formState === "complete";
  const submissionResultReference = getSubmissionResultReference(application);
  const submissionResultSubmitted = submissionResultIsSubmitted(application) || arrivalCardResultIsReady(application);
  const applicationSubmitted = Boolean(application.submitted_at) || normalizeStatus(application.status) === "submitted" || submissionResultSubmitted;
  const documentState = getDocumentState(documentCounts, formStarted, applicationSubmitted);
  const documentsComplete = documentState === "complete";
  const packetState = getPacketState(application, latestPacket, documentsComplete);
  const packetComplete = packetState === "complete";
  const handoffState = getHandoffState(application, packetComplete, liveSubmission);
  const handoffComplete = handoffState === "complete";
  const resultState = getResultState(application, handoffComplete, liveSubmission);
  const latestConsent = sortByNewest(consents, (row) => row.created_at)[0];
  const latestSignature = sortByNewest(signatures, (row) => row.signed_at ?? row.created_at)[0];
  const files = await buildFiles({ adminClient, application, latestPayment, latestPacket });

  const initialSteps: StatusStep[] = [
    {
      key: "payment",
      state: paymentState,
      updatedAt: latestPayment?.updated_at ?? latestPayment?.created_at ?? null,
      statusValue: latestPayment?.status ?? null,
      metricValue: null,
    },
    {
      key: "consent",
      state: consentState,
      updatedAt: getLatestDate([latestConsent?.created_at, latestSignature?.signed_at, latestSignature?.created_at]),
      statusValue: latestConsent?.accepted ? "accepted" : null,
      metricValue: null,
    },
    {
      key: "form",
      state: formState,
      updatedAt: application.updated_at,
      statusValue: application.status,
      metricValue: null,
    },
    {
      key: "documents",
      state: documentState,
      updatedAt: null,
      statusValue: documentCounts.rejected > 0 ? "rejected" : documentCounts.missing > 0 ? "missing" : null,
      metricValue: null,
    },
    {
      key: "packet",
      state: packetState,
      updatedAt: latestPacket?.updated_at ?? latestPacket?.generated_at ?? application.packet_ready_at,
      statusValue: latestPacket?.status ?? application.packet_status,
      metricValue: null,
    },
    {
      key: "handoff",
      state: handoffState,
      updatedAt: liveSubmission?.updatedAt ?? application.external_status_updated_at,
      statusValue: liveSubmission?.status ?? application.external_status,
      metricValue: null,
    },
    {
      key: "result",
      state: resultState,
      updatedAt: liveSubmission?.liveSubmittedAt ?? application.submission_result_updated_at ?? application.updated_at,
      statusValue: liveSubmission?.officialStatus ?? application.result_status ?? application.submission_result_status ?? (APPROVED_RESULT_STATUSES.has(normalizeStatus(application.status)) || REJECTED_RESULT_STATUSES.has(normalizeStatus(application.status)) ? application.status : null),
      metricValue: null,
    },
  ];
  const arrivalCardSteps = isArrivalCard
    ? initialSteps.map((step) => {
        if (submissionResultSubmitted) {
          return {
            ...step,
            state: "complete" as const,
            updatedAt: step.updatedAt ?? application.submission_result_updated_at ?? application.submitted_at ?? application.updated_at,
          };
        }
        if (step.key === "payment" || step.key === "consent" || step.key === "documents" || step.key === "packet") {
          return {
            ...step,
            state: "complete" as const,
            updatedAt: step.updatedAt ?? application.updated_at,
          };
        }
        if (step.key === "handoff" && formState === "complete") {
          return {
            ...step,
            state: "current" as const,
            updatedAt: step.updatedAt ?? application.updated_at,
          };
        }
        return step;
      })
    : null;
  const resolvedSteps = arrivalCardSteps ?? initialSteps;
  const overallState = getOverallState(resolvedSteps, application);
  const progressPercent = isArrivalCard
    ? getArrivalCardProgressPercent({
        liveSubmission,
        state: overallState,
        fallback: getProgressPercent(resolvedSteps, overallState),
        submissionResultSubmitted,
      })
    : getProgressPercent(resolvedSteps, overallState);

  const shell: StatusApplication = {
    ...base,
    id: application.id,
    packageId: application.visa_package_id,
    packageName: visaPackage?.name ?? null,
    state: overallState,
    progressPercent,
    createdAt: application.created_at,
    updatedAt: getLatestDate([
      application.updated_at,
      application.external_status_updated_at,
      application.submission_result_updated_at,
      latestPacket?.updated_at,
      latestPayment?.updated_at,
    ]),
    submittedAt: application.submitted_at,
    officialReference: liveSubmission?.officialReference ?? application.external_reference ?? application.confirmation_number ?? submissionResultReference,
    officialReferenceKind: liveSubmission?.officialReference || application.external_reference || submissionResultReference ? "official" : application.confirmation_number ? "viza" : null,
    rawApplicationStatus: application.status,
    externalStatus: liveSubmission?.status ?? application.external_status,
    resultStatus: liveSubmission?.officialStatus ?? application.result_status ?? application.submission_result_status,
    liveSubmission,
    governmentFee: {
      amountCents: application.government_fee_cents,
      currency: application.government_fee_currency,
      mode: application.government_fee_mode,
    },
    officialFee: {
      status: application.official_fee_status,
      quoteId: application.official_fee_quote_id,
      paymentIntentId: application.official_fee_payment_intent_id,
      receiptId: application.official_fee_receipt_id,
    },
    payment: {
      status: latestPayment?.status ?? null,
      amountCents: latestPayment?.amount_cents ?? visaPackage?.price_cents ?? null,
      currency: latestPayment?.currency ?? visaPackage?.currency ?? null,
      updatedAt: latestPayment?.updated_at ?? latestPayment?.created_at ?? null,
    },
    consent: {
      accepted: Boolean(latestConsent?.accepted),
      signaturePresent: signatures.length > 0,
      updatedAt: getLatestDate([latestConsent?.created_at, latestSignature?.signed_at, latestSignature?.created_at]),
    },
    formAnswerCount: answerCount,
    documents: documentCounts,
    packet: {
      status: latestPacket?.status ?? application.packet_status,
      readyAt: latestPacket?.generated_at ?? application.packet_ready_at,
      storagePath: latestPacket?.storage_path ?? application.packet_storage_path,
    },
    notifications: buildNotificationSummary(notifications),
    steps: resolvedSteps,
    actions: [],
    files,
    events: sortByNewest(
      [
        ...(submissionResultSubmitted
          ? [{ event_type: "arrival_card_submitted", created_at: application.submission_result_updated_at ?? application.submitted_at ?? application.updated_at }]
          : []),
        ...events,
      ],
      (row) => row.created_at,
    )
      .slice(0, 3)
      .map((row) => ({ eventType: row.event_type, createdAt: row.created_at })),
    applicationRecords: [],
  };

  const metricSteps = buildSteps(shell);
  const resultFile = files.find((file) => ["arrivalCardConfirmation", "approvedResult", "rejectionLetter", "resultFile"].includes(file.key)) ?? null;
  return {
    ...shell,
    steps: metricSteps,
    actions: buildActions(application, base, metricSteps, resultFile),
  };
}

export async function hasClientSession(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return Boolean(user);
}

export async function getClientStatusData(): Promise<ClientStatusData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { applications: [], detailApplications: [], partialData: false };

  const adminClient = createAdminClient();
  let partialData = false;

  const profileReads: Array<Promise<ReadRowsResult<ApplicantProfileRow>>> = [
    readRows<ApplicantProfileRow>(
      adminClient
        .from("applicant_profiles")
        .select("id, email")
        .eq("auth_user_id", user.id),
    ),
    readRows<ApplicantProfileRow>(
      adminClient
        .from("applicant_profiles")
        .select("id, email")
        .eq("id", user.id),
    ),
  ];
  if (user.email) {
    profileReads.push(
      readRows<ApplicantProfileRow>(
        adminClient
          .from("applicant_profiles")
          .select("id, email")
          .eq("email", user.email),
      ),
    );
  }
  const profileResults = await Promise.all(profileReads);
  partialData = partialData || profileResults.some((result) => result.failed);
  const profiles = dedupeById(profileResults.flatMap((result) => result.rows));
  const profileIds = profiles.map((profile) => profile.id);
  const ownerEmails = [
    ...new Set(
      [user.email, ...profiles.map((profile) => profile.email)]
        .filter((email): email is string => Boolean(email))
        .map((email) => email.trim().toLowerCase()),
    ),
  ];

  const { rows: userPackageRows, failed: packagesFailed } = await readRows<UserPackageRow>(
    adminClient
      .from("user_packages")
      .select("visa_package_id, application_id, assigned_at, status, visa_packages(id, country, visa_type, name, description, price_cents, currency, metadata)")
      .eq("auth_user_id", user.id)
      .order("assigned_at", { ascending: false }),
  );
  partialData = partialData || packagesFailed;

  const userPackages = userPackageRows
    .map((row) => ({
      assignedAt: row.assigned_at,
      applicationId: row.application_id,
      status: row.status,
      package: unwrapVisaPackage(row),
    }))
    .filter((row): row is { assignedAt: string | null; applicationId: string | null; status: string | null; package: VisaPackageRow } => Boolean(row.package));

  const packageIds = userPackages.map((row) => row.package.id);
  const packageApplicationIds = userPackages
    .map((row) => row.applicationId)
    .filter((id): id is string => Boolean(id));
  let applications: ApplicationRow[] = [];
  let sgacEmailLinkedApplicationIds = new Set<string>();

  if (profileIds.length > 0) {
    const { rows, failed } = await readRows<ApplicationRow>(
      adminClient
        .from("applications")
        .select(APPLICATION_STATUS_SELECT)
        .in("applicant_id", profileIds)
        .order("created_at", { ascending: false }),
    );
    applications = rows.map(withApplicationDefaults);
    partialData = partialData || failed;
  }

  const missingPackageApplicationIds = packageApplicationIds.filter((id) => !applications.some((application) => application.id === id));
  if (missingPackageApplicationIds.length > 0) {
    const { rows: linkedRows, failed: linkedFailed } = await readRows<ApplicationRow>(
      adminClient
        .from("applications")
        .select(APPLICATION_STATUS_SELECT)
        .in("id", missingPackageApplicationIds),
    );
    partialData = partialData || linkedFailed;
    applications = dedupeById([
      ...applications,
      ...linkedRows.map(withApplicationDefaults),
    ]);
  }

  if (ownerEmails.length > 0) {
    const { rows: sgacEmailAnswers, failed: sgacEmailAnswersFailed } = await readRows<AnswerRow>(
      adminClient
        .from("visa_application_answers")
        .select("application_id, field_name, value_text, value_json")
        .in("field_name", SGAC_OWNER_EMAIL_FIELD_NAMES)
        .in("value_text", ownerEmails),
    );
    partialData = partialData || sgacEmailAnswersFailed;
    const sgacEmailApplicationIds = [
      ...new Set(
        sgacEmailAnswers
          .map((row) => row.application_id)
          .filter((id): id is string => Boolean(id) && !applications.some((application) => application.id === id)),
      ),
    ];
    sgacEmailLinkedApplicationIds = new Set(sgacEmailApplicationIds);
    if (sgacEmailApplicationIds.length > 0) {
      const { rows: sgacEmailApplications, failed: sgacEmailApplicationsFailed } = await readRows<ApplicationRow>(
        adminClient
          .from("applications")
          .select(APPLICATION_STATUS_SELECT)
          .in("id", sgacEmailApplicationIds)
          .eq("visa_type", SGAC_VISA_TYPE),
      );
      partialData = partialData || sgacEmailApplicationsFailed;
      applications = dedupeById([
        ...applications,
        ...sgacEmailApplications.map(withApplicationDefaults),
      ]);
    }
  }

  const hydratedApplications = await hydrateSubmissionResults(adminClient, applications);
  partialData = partialData || hydratedApplications.failed;
  applications = hydratedApplications.applications.filter(
    (application) => !sgacEmailLinkedApplicationIds.has(application.id) || submissionResultIsSubmitted(application),
  );

  const applicationIds = applications.map((application) => application.id);
  let liveSubmissionByApplication = new Map<string, LiveSubmissionSummary>();
  try {
    liveSubmissionByApplication = await loadLiveSubmissionSummaries(adminClient, applicationIds);
  } catch {
    partialData = true;
  }
  const applicationPackageIds = applications
    .map((application) => application.visa_package_id)
    .filter((id): id is string => Boolean(id));
  const allPackageIds = [...new Set([...packageIds, ...applicationPackageIds])];

  let payments: PaymentRow[] = [];
  const paymentReads: Array<Promise<ReadRowsResult<PaymentRow>>> = [];
  if (profileIds.length > 0) {
    paymentReads.push(
      readRows<PaymentRow>(
        adminClient
          .from("payment_records")
          .select("id, application_id, visa_package_id, status, amount_cents, currency, fee_type, receipt_url, created_at, updated_at")
          .in("applicant_id", profileIds),
      ),
    );
  }
  if (applicationIds.length > 0) {
    paymentReads.push(
      readRows<PaymentRow>(
        adminClient
          .from("payment_records")
          .select("id, application_id, visa_package_id, status, amount_cents, currency, fee_type, receipt_url, created_at, updated_at")
          .in("application_id", applicationIds),
      ),
    );
  }
  if (allPackageIds.length > 0) {
    paymentReads.push(
      readRows<PaymentRow>(
        adminClient
          .from("payment_records")
          .select("id, application_id, visa_package_id, status, amount_cents, currency, fee_type, receipt_url, created_at, updated_at")
          .in("visa_package_id", allPackageIds),
      ),
    );
  }

  const paymentResults = await Promise.all(paymentReads);
  partialData = partialData || paymentResults.some((result) => result.failed);
  payments = dedupeById(paymentResults.flatMap((result) => result.rows));

  let consents: ConsentRow[] = [];
  let signatures: SignatureRow[] = [];
  let documents: DocumentRow[] = [];
  let answers: AnswerRow[] = [];
  let packets: PacketRow[] = [];
  let events: EventRow[] = [];
  let notifications: NotificationRow[] = [];

  if (applicationIds.length > 0) {
    const [
      consentResult,
      signatureResult,
      documentResult,
      answerResult,
      packetResult,
      eventResult,
      notificationResult,
    ] = await Promise.all([
      readRows<ConsentRow>(
        adminClient
          .from("consent_events")
          .select("application_id, accepted, created_at")
          .in("application_id", applicationIds),
      ),
      readRows<SignatureRow>(
        adminClient
          .from("application_signatures")
          .select("application_id, signed_at, created_at")
          .in("application_id", applicationIds),
      ),
      readRows<DocumentRow>(
        adminClient
          .from("application_documents")
          .select("application_id, status, required")
          .in("application_id", applicationIds),
      ),
      readRows<AnswerRow>(
        adminClient
          .from("visa_application_answers")
          .select("application_id, field_name, value_text, value_json")
          .in("application_id", applicationIds),
      ),
      readRows<PacketRow>(
        adminClient
          .from("application_packets")
          .select("application_id, status, storage_path, generated_at, created_at, updated_at")
          .in("application_id", applicationIds),
      ),
      readRows<EventRow>(
        adminClient
          .from("application_events")
          .select("application_id, event_type, created_at")
          .in("application_id", applicationIds)
          .order("created_at", { ascending: false })
          .limit(30),
      ),
      readRows<NotificationRow>(
        adminClient
          .from("notification_events")
          .select("application_id, status, sent_at, created_at")
          .in("application_id", applicationIds),
      ),
    ]);

    partialData = partialData || [
      consentResult,
      signatureResult,
      documentResult,
      answerResult,
      packetResult,
      eventResult,
      notificationResult,
    ].some((result) => result.failed);

    consents = consentResult.rows;
    signatures = signatureResult.rows;
    documents = documentResult.rows;
    answers = answerResult.rows;
    packets = packetResult.rows;
    events = eventResult.rows;
    notifications = notificationResult.rows;
  }

  const packagesById = new Map(userPackages.map((row) => [row.package.id, row.package]));
  const paymentsByApplication = groupByApplication(payments);
  const paymentsByPackage = new Map<string, PaymentRow[]>();
  for (const payment of payments) {
    if (!payment.visa_package_id) continue;
    const existing = paymentsByPackage.get(payment.visa_package_id) ?? [];
    existing.push(payment);
    paymentsByPackage.set(payment.visa_package_id, existing);
  }

  const consentsByApplication = groupByApplication(consents);
  const signaturesByApplication = groupByApplication(signatures);
  const documentsByApplication = groupByApplication(documents);
  const answersByApplication = groupByApplication(answers);
  const packetsByApplication = groupByApplication(packets);
  const eventsByApplication = groupByApplication(events);
  const notificationsByApplication = groupByApplication(notifications);

  const statusApplications = await Promise.all(
    applications.map((application) =>
      buildApplicationStatus({
        adminClient,
        application,
        visaPackage: application.visa_package_id ? packagesById.get(application.visa_package_id) ?? null : null,
        liveSubmission: liveSubmissionByApplication.get(application.id) ?? null,
        payments: [
          ...(paymentsByApplication.get(application.id) ?? []),
          ...(application.visa_package_id ? paymentsByPackage.get(application.visa_package_id) ?? [] : []),
        ],
        consents: consentsByApplication.get(application.id) ?? [],
        signatures: signaturesByApplication.get(application.id) ?? [],
        documents: documentsByApplication.get(application.id) ?? [],
        answers: answersByApplication.get(application.id) ?? [],
        packets: packetsByApplication.get(application.id) ?? [],
        events: eventsByApplication.get(application.id) ?? [],
        notifications: notificationsByApplication.get(application.id) ?? [],
      }),
    ),
  );

  const applicationKeys = new Set(statusApplications.map((application) => application.key));
  for (const userPackage of userPackages) {
    const key = getVisaDestinationKey(userPackage.package.country, userPackage.package.visa_type);
    if (applicationKeys.has(key)) continue;
    if (userPackage.status && !["active", "completed"].includes(normalizeStatus(userPackage.status))) continue;
    statusApplications.push(
      buildPackageOnlyApplication({
        assignedAt: userPackage.assignedAt,
        package: userPackage.package,
        payment: getLatestPayment(paymentsByPackage.get(userPackage.package.id) ?? []),
      }),
    );
  }

  statusApplications.sort((a, b) => {
    const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
    const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
    return bTime - aTime;
  });

  return {
    applications: groupCountryApplications(statusApplications),
    detailApplications: statusApplications,
    partialData,
  };
}
