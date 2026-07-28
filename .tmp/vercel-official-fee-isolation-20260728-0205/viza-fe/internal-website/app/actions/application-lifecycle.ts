"use server";

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

export type ApplicationLifecycleStatus =
  | "not_started"
  | "not_submitted"
  | "in_progress"
  | "needs_documents"
  | "submitting"
  | "submitted"
  | "needs_attention"
  | "approved"
  | "rejected";

export type ApplicationNextAction =
  | "start"
  | "continue"
  | "upload_documents"
  | "wait"
  | "fix"
  | "view";

export interface ApplicationLifecycleDocumentCounts {
  total: number;
  uploaded: number;
  validated: number;
  missing: number;
  rejected: number;
}

export interface ApplicationLifecycleSubmission {
  status: string;
  attempts: number;
  lastError: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ApplicationLifecycleChecklist {
  destination: boolean;
  form: boolean;
  photo: boolean;
  documents: boolean;
  submitted: boolean;
}

export interface ApplicationLifecycleSummary {
  key: string;
  applicationId: string | null;
  packageId: string | null;
  country: string;
  visaType: string;
  countryName: string;
  countryNameZh: string;
  countryFlag: string;
  visaTypeLabel: string;
  visaTypeLabelZh: string;
  status: ApplicationLifecycleStatus;
  rawApplicationStatus: string | null;
  progressPercent: number;
  nextAction: ApplicationNextAction;
  createdAt: string | null;
  updatedAt: string | null;
  submittedAt: string | null;
  confirmationNumber: string | null;
  receiptUrl: string | null;
  formAnswerCount: number;
  hasPhoto: boolean;
  documentCounts: ApplicationLifecycleDocumentCounts;
  latestSubmission: ApplicationLifecycleSubmission | null;
  checklist: ApplicationLifecycleChecklist;
}

export interface ApplicationLifecycleResult {
  summaries: ApplicationLifecycleSummary[];
  error?: string;
}

export interface ApplicationLifecycleOptions {
  startedOnly?: boolean;
}

export interface ApplicationPaymentRecord {
  id: string;
  application_id: string | null;
  visa_package_id: string | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
}

interface ApplicantProfileRow {
  id: string;
}

interface VisaPackageRow {
  id: string;
  country: string;
  visa_type: string;
  name: string | null;
  description: string | null;
}

interface UserPackageRow {
  visa_package_id: string | null;
  assigned_at: string | null;
  visa_packages: VisaPackageRow | VisaPackageRow[] | null;
}

interface ApplicationRow {
  id: string;
  country: string;
  visa_type: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  submitted_at: string | null;
  confirmation_number: string | null;
  receipt_url: string | null;
  visa_package_id: string | null;
}

interface DocumentRow {
  application_id: string;
  document_type: string;
  status: string;
}

interface AnswerRow {
  application_id: string;
  field_name: string;
  value_text: string | null;
}

interface SubmissionQueueRow {
  application_id: string;
  status: string;
  attempts: number | null;
  last_error: string | null;
  created_at: string | null;
  updated_at: string | null;
}

function unwrapVisaPackage(row: UserPackageRow): VisaPackageRow | null {
  if (Array.isArray(row.visa_packages)) {
    return row.visa_packages[0] ?? null;
  }
  return row.visa_packages ?? null;
}

function groupRowsByApplication<T extends { application_id: string }>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const existing = grouped.get(row.application_id) ?? [];
    existing.push(row);
    grouped.set(row.application_id, existing);
  }
  return grouped;
}

function sortByMostRecentSubmission(a: SubmissionQueueRow, b: SubmissionQueueRow): number {
  const aTime = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
  const bTime = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
  return bTime - aTime;
}

function buildDocumentCounts(documents: DocumentRow[]): ApplicationLifecycleDocumentCounts {
  return documents.reduce<ApplicationLifecycleDocumentCounts>(
    (counts, document) => {
      counts.total += 1;
      if (document.status === "validated") counts.validated += 1;
      else if (document.status === "missing") counts.missing += 1;
      else if (document.status === "rejected") counts.rejected += 1;
      else counts.uploaded += 1;
      return counts;
    },
    { total: 0, uploaded: 0, validated: 0, missing: 0, rejected: 0 },
  );
}

function buildLatestSubmission(queueRows: SubmissionQueueRow[]): ApplicationLifecycleSubmission | null {
  const latest = [...queueRows].sort(sortByMostRecentSubmission)[0];
  if (!latest) return null;

  return {
    status: latest.status,
    attempts: latest.attempts ?? 0,
    lastError: latest.last_error,
    createdAt: latest.created_at,
    updatedAt: latest.updated_at,
  };
}

function getLifecycleStatus({
  rawStatus,
  submittedAt,
  latestSubmission,
  documentCounts,
  formAnswerCount,
  hasPhoto,
}: {
  rawStatus: string | null;
  submittedAt: string | null;
  latestSubmission: ApplicationLifecycleSubmission | null;
  documentCounts: ApplicationLifecycleDocumentCounts;
  formAnswerCount: number;
  hasPhoto: boolean;
}): ApplicationLifecycleStatus {
  if (rawStatus === "approved") return "approved";
  if (rawStatus === "rejected") return "rejected";
  if (latestSubmission?.status === "failed") return "needs_attention";
  if (latestSubmission?.status === "pending" || latestSubmission?.status === "processing") return "submitting";
  if (rawStatus === "submitted" || submittedAt) return "submitted";
  if (documentCounts.rejected > 0 || documentCounts.missing > 0) return "needs_documents";
  if (formAnswerCount > 0 || hasPhoto || documentCounts.uploaded > 0 || documentCounts.validated > 0) {
    return "in_progress";
  }
  return "not_submitted";
}

function getProgressPercent(
  status: ApplicationLifecycleStatus,
  formAnswerCount: number,
  hasPhoto: boolean,
  documentCounts: ApplicationLifecycleDocumentCounts,
): number {
  if (status === "not_started") return 0;
  if (status === "approved" || status === "rejected") return 100;
  if (status === "submitted") return 92;
  if (status === "submitting") return 84;
  if (status === "needs_attention") return 76;
  if (status === "needs_documents") return 68;
  if (status === "not_submitted") return 10;

  const documentProgress = Math.min(20, (documentCounts.uploaded + documentCounts.validated) * 5);
  const answerProgress = Math.min(46, formAnswerCount * 2);
  return Math.min(78, 12 + answerProgress + (hasPhoto ? 10 : 0) + documentProgress);
}

function getNextAction(status: ApplicationLifecycleStatus): ApplicationNextAction {
  if (status === "not_started") return "start";
  if (status === "not_submitted" || status === "in_progress") return "continue";
  if (status === "needs_documents") return "upload_documents";
  if (status === "needs_attention") return "fix";
  if (status === "submitting" || status === "submitted") return "wait";
  return "view";
}

function buildSummaryBase(country: string, visaType: string) {
  const normalizedVisaType = getFormVisaType(visaType);

  return {
    key: getVisaDestinationKey(country, normalizedVisaType),
    country,
    visaType: normalizedVisaType,
    countryName: getDestinationDisplayName(country),
    countryNameZh: getDestinationDisplayNameZh(country),
    countryFlag: getDestinationFlag(country),
    visaTypeLabel: getVisaTypeDisplayName(normalizedVisaType),
    visaTypeLabelZh: getVisaTypeDisplayNameZh(normalizedVisaType),
  };
}

function buildApplicationSummary(
  application: ApplicationRow,
  documents: DocumentRow[],
  answers: AnswerRow[],
  queueRows: SubmissionQueueRow[],
): ApplicationLifecycleSummary {
  const nonEmptyAnswers = answers.filter((answer) => answer.value_text?.trim());
  const formAnswerCount = new Set(
    nonEmptyAnswers
      .filter((answer) => answer.field_name !== "photo_path")
      .map((answer) => answer.field_name),
  ).size;
  const hasPhoto = nonEmptyAnswers.some((answer) => answer.field_name === "photo_path");
  const documentCounts = buildDocumentCounts(documents);
  const latestSubmission = buildLatestSubmission(queueRows);
  const status = getLifecycleStatus({
    rawStatus: application.status,
    submittedAt: application.submitted_at,
    latestSubmission,
    documentCounts,
    formAnswerCount,
    hasPhoto,
  });
  const submitted = status === "submitted" || status === "approved" || status === "rejected";
  const documentsReady =
    submitted ||
    (documentCounts.total > 0 && documentCounts.missing === 0 && documentCounts.rejected === 0);

  return {
    ...buildSummaryBase(application.country, application.visa_type),
    applicationId: application.id,
    packageId: application.visa_package_id,
    status,
    rawApplicationStatus: application.status,
    progressPercent: getProgressPercent(status, formAnswerCount, hasPhoto, documentCounts),
    nextAction: getNextAction(status),
    createdAt: application.created_at,
    updatedAt: application.updated_at ?? application.submitted_at ?? application.created_at,
    submittedAt: application.submitted_at,
    confirmationNumber: application.confirmation_number,
    receiptUrl: application.receipt_url,
    formAnswerCount,
    hasPhoto,
    documentCounts,
    latestSubmission,
    checklist: {
      destination: true,
      form: submitted || formAnswerCount > 0,
      photo: submitted || hasPhoto,
      documents: documentsReady,
      submitted,
    },
  };
}

function buildPackageOnlySummary(userPackage: VisaPackageRow, assignedAt: string | null): ApplicationLifecycleSummary {
  const status: ApplicationLifecycleStatus = "not_started";

  return {
    ...buildSummaryBase(userPackage.country, userPackage.visa_type),
    applicationId: null,
    packageId: userPackage.id,
    status,
    rawApplicationStatus: null,
    progressPercent: 0,
    nextAction: "start",
    createdAt: assignedAt,
    updatedAt: assignedAt,
    submittedAt: null,
    confirmationNumber: null,
    receiptUrl: null,
    formAnswerCount: 0,
    hasPhoto: false,
    documentCounts: { total: 0, uploaded: 0, validated: 0, missing: 0, rejected: 0 },
    latestSubmission: null,
    checklist: {
      destination: true,
      form: false,
      photo: false,
      documents: false,
      submitted: false,
    },
  };
}

function hasStartedApplication(summary: ApplicationLifecycleSummary): boolean {
  const terminalOrSubmittedStatus =
    summary.rawApplicationStatus === "submitted" ||
    summary.rawApplicationStatus === "approved" ||
    summary.rawApplicationStatus === "rejected";

  return Boolean(summary.applicationId) && (
    summary.formAnswerCount > 0 ||
    Boolean(summary.latestSubmission) ||
    Boolean(summary.submittedAt) ||
    Boolean(summary.confirmationNumber) ||
    Boolean(summary.receiptUrl) ||
    terminalOrSubmittedStatus
  );
}

export async function getApplicationLifecycleSummaries(
  options: ApplicationLifecycleOptions = {},
): Promise<ApplicationLifecycleResult> {
  try {
    const startedOnly = options.startedOnly ?? false;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { summaries: [], error: "Not authenticated" };

    const adminClient = createAdminClient();

    const { data: profile } = await adminClient
      .from("applicant_profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    const applicantProfile = profile as ApplicantProfileRow | null;

    const { data: packageData } = await adminClient
      .from("user_packages")
      .select("visa_package_id, assigned_at, visa_packages(id, country, visa_type, name, description)")
      .eq("auth_user_id", user.id)
      .eq("status", "active")
      .order("assigned_at", { ascending: false });

    const packageRows = (packageData ?? []) as UserPackageRow[];
    const userPackages = packageRows
      .map((row) => ({
        assignedAt: row.assigned_at,
        package: unwrapVisaPackage(row),
      }))
      .filter((row): row is { assignedAt: string | null; package: VisaPackageRow } => Boolean(row.package));

    let applications: ApplicationRow[] = [];
    if (applicantProfile) {
      const { data: applicationData } = await adminClient
        .from("applications")
        .select(
          "id, country, visa_type, status, created_at, updated_at, submitted_at, confirmation_number, receipt_url, visa_package_id",
        )
        .eq("applicant_id", applicantProfile.id)
        .order("created_at", { ascending: false });

      applications = (applicationData ?? []) as ApplicationRow[];
    }

    const applicationIds = applications.map((application) => application.id);
    let documents: DocumentRow[] = [];
    let answers: AnswerRow[] = [];
    let submissionQueue: SubmissionQueueRow[] = [];

    if (applicationIds.length > 0) {
      const [{ data: documentData }, { data: answerData }, { data: queueData }] = await Promise.all([
        adminClient
          .from("application_documents")
          .select("application_id, document_type, status")
          .in("application_id", applicationIds),
        adminClient
          .from("visa_application_answers")
          .select("application_id, field_name, value_text")
          .in("application_id", applicationIds),
        adminClient
          .from("submission_queue")
          .select("application_id, status, attempts, last_error, created_at, updated_at")
          .in("application_id", applicationIds),
      ]);

      documents = (documentData ?? []) as DocumentRow[];
      answers = (answerData ?? []) as AnswerRow[];
      submissionQueue = (queueData ?? []) as SubmissionQueueRow[];
    }

    const documentsByApplication = groupRowsByApplication(documents);
    const answersByApplication = groupRowsByApplication(answers);
    const queueByApplication = groupRowsByApplication(submissionQueue);
    let summaries = applications.map((application) =>
      buildApplicationSummary(
        application,
        documentsByApplication.get(application.id) ?? [],
        answersByApplication.get(application.id) ?? [],
        queueByApplication.get(application.id) ?? [],
      ),
    );

    if (startedOnly) {
      summaries = summaries.filter(hasStartedApplication);
    } else {
      const applicationKeys = new Set(summaries.map((summary) => summary.key));
      for (const userPackage of userPackages) {
        const key = getVisaDestinationKey(userPackage.package.country, userPackage.package.visa_type);
        if (!applicationKeys.has(key)) {
          summaries.push(buildPackageOnlySummary(userPackage.package, userPackage.assignedAt));
        }
      }
    }

    summaries.sort((a, b) => {
      const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
      const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
      return bTime - aTime;
    });

    return { summaries };
  } catch (error) {
    return {
      summaries: [],
      error: error instanceof Error ? error.message : "Failed to load application lifecycle",
    };
  }
}

export async function getApplicationPaymentRecords(
  applicationIds: string[],
  packageIds: string[],
): Promise<ApplicationPaymentRecord[]> {
  const uniqueApplicationIds = [...new Set(applicationIds.filter(Boolean))];
  const uniquePackageIds = [...new Set(packageIds.filter(Boolean))];

  if (uniqueApplicationIds.length === 0 && uniquePackageIds.length === 0) return [];

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return [];

    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from("applicant_profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    const applicantProfile = profile as ApplicantProfileRow | null;
    if (!applicantProfile) return [];

    const paymentReads: Array<Promise<{ data: ApplicationPaymentRecord[] | null }>> = [];
    const columns = "id, application_id, visa_package_id, status, created_at, updated_at";

    if (uniqueApplicationIds.length > 0) {
      paymentReads.push(
        adminClient
          .from("payment_records")
          .select(columns)
          .eq("applicant_id", applicantProfile.id)
          .in("application_id", uniqueApplicationIds) as unknown as Promise<{ data: ApplicationPaymentRecord[] | null }>,
      );
    }

    if (uniquePackageIds.length > 0) {
      paymentReads.push(
        adminClient
          .from("payment_records")
          .select(columns)
          .eq("applicant_id", applicantProfile.id)
          .in("visa_package_id", uniquePackageIds) as unknown as Promise<{ data: ApplicationPaymentRecord[] | null }>,
      );
    }

    const results = await Promise.all(paymentReads);
    const paymentsById = new Map<string, ApplicationPaymentRecord>();
    for (const result of results) {
      for (const payment of result.data ?? []) {
        paymentsById.set(payment.id, payment);
      }
    }

    return Array.from(paymentsById.values());
  } catch {
    return [];
  }
}
