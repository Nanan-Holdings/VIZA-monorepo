import "server-only";

import { isOngoingApplicationState } from "@/lib/client/active-application-selection";
import type {
  ApplicationRow,
  DocumentRow,
  PaymentRow,
} from "@/lib/client/application-progress";
import { getClientSessionReadResult } from "@/lib/client-session";
import { isQaDryRunPurpose } from "@/lib/applications/qa-safety";
import {
  recordPortalReadOutcome,
  tracePortalReadStage,
} from "@/lib/observability/portal-read";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFormVisaType } from "@/lib/visa-destinations";
import {
  CLIENT_STATUS_APPLICATION_SELECT,
  loadClientHomeTimeline,
  type ClientHomeTimelineApplication,
  type ClientStatusApplicationRow,
  type ClientStatusDocumentRow,
  type ClientStatusPaymentRow,
} from "@/app/client/status/status-data";

export interface ClientHomeProfile {
  full_name: string | null;
  surname: string | null;
  given_names: string | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  birth_country: string | null;
  birth_province_or_state: string | null;
  birth_city: string | null;
  gender: string | null;
  nationality: string | null;
  occupation: string | null;
  address: string | null;
  passport_number: string | null;
  passport_issue_date: string | null;
  passport_expiry_date: string | null;
  passport_issuing_country: string | null;
  email: string | null;
  phone: string | null;
  wechat: string | null;
}

export interface ClientHomeDashboardData {
  authenticated: boolean;
  authEmail: string | null;
  profile: ClientHomeProfile | null;
  applications: ApplicationRow[];
  documents: DocumentRow[];
  payments: PaymentRow[];
  error?: string;
  /** True when identity resolution failed because the provider was unavailable. */
  unavailable?: boolean;
}

export interface ClientHomeDashboardWithTimelineData extends ClientHomeDashboardData {
  timeline: ClientHomeTimelineApplication | null;
  timelineApplicationId: string | null;
  timelinePartialData: boolean;
}

export interface ClientHomeApplicationSelectionHint {
  /** A browser selection hint; the server verifies it against owned rows. */
  applicationId?: string | null;
  country?: string | null;
  visaType?: string | null;
}

export interface ClientHomeDashboardReadOptions {
  selection?: ClientHomeApplicationSelectionHint | null;
  includeTimeline?: boolean;
}

export interface ClientHomeDashboardReadResult {
  data: ClientHomeDashboardData;
  timeline: ClientHomeTimelineApplication | null;
  timelineApplicationId: string | null;
  timelinePartialData: boolean;
}

const PROFILE_COLUMNS = [
  "full_name",
  "surname",
  "given_names",
  "date_of_birth",
  "place_of_birth",
  "birth_country",
  "birth_province_or_state",
  "birth_city",
  "gender",
  "nationality",
  "occupation",
  "address",
  "passport_number",
  "passport_issue_date",
  "passport_expiry_date",
  "passport_issuing_country",
  "email",
  "phone",
  "wechat",
].join(", ");

const DOCUMENT_COLUMNS =
  "id, application_id, document_type, status, required, created_at, updated_at";
const PAYMENT_COLUMNS =
  "id, application_id, visa_package_id, status, amount_cents, currency, fee_type, receipt_url, created_at, updated_at";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type HomeDocumentRow = ClientStatusDocumentRow & {
  id: string;
  application_id: string;
  document_type: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type HomePaymentRow = ClientStatusPaymentRow;

function emptyDashboard(
  authenticated: boolean,
  authEmail: string | null = null,
  error?: string,
): ClientHomeDashboardData {
  return {
    authenticated,
    authEmail,
    profile: null,
    applications: [],
    documents: [],
    payments: [],
    ...(error ? { error } : {}),
  };
}

function toDashboardApplication(row: ClientStatusApplicationRow): ApplicationRow {
  return {
    id: row.id,
    status: row.status,
    country: row.country,
    visa_type: row.visa_type,
    purpose: row.purpose,
    visa_package_id: row.visa_package_id,
    submission_result_status: row.submission_result_status,
    submitted_at: row.submitted_at,
    created_at: row.created_at ?? "",
    updated_at: row.updated_at,
  };
}

function toDashboardDocument(row: HomeDocumentRow): DocumentRow {
  return {
    id: row.id,
    application_id: row.application_id,
    document_type: row.document_type,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toDashboardPayment(row: HomePaymentRow): PaymentRow {
  return {
    id: row.id,
    application_id: row.application_id,
    visa_package_id: row.visa_package_id,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function buildUuidInFilter(
  column: "application_id" | "visa_package_id",
  ids: string[],
): string {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0 || uniqueIds.some((id) => !UUID_PATTERN.test(id))) {
    throw new Error(`Cannot build ${column} payment filter from invalid identifiers`);
  }
  return `${column}.in.(${uniqueIds.join(",")})`;
}

function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

function selectHomeApplication(
  applications: ClientStatusApplicationRow[],
  selection?: ClientHomeApplicationSelectionHint | null,
): ClientStatusApplicationRow | null {
  const requestedId = selection?.applicationId?.trim();
  if (requestedId) {
    const selected = applications.find((application) => application.id === requestedId);
    if (selected) return selected;
  }

  const country = selection?.country?.trim().toLowerCase();
  const visaType = selection?.visaType
    ? getFormVisaType(selection.visaType.trim()).toLowerCase()
    : null;
  if (country && visaType) {
    const selected = applications.find(
      (application) =>
        application.country.trim().toLowerCase() === country &&
        getFormVisaType(application.visa_type).trim().toLowerCase() === visaType,
    );
    if (selected) return selected;
  }

  return applications.find((application) => isOngoingApplicationState(application.status)) ?? null;
}

function buildDashboardReadResult(
  data: ClientHomeDashboardData,
): ClientHomeDashboardReadResult {
  return {
    data,
    timeline: null,
    timelineApplicationId: null,
    timelinePartialData: false,
  };
}

export async function loadClientHomeDashboard(
  options: ClientHomeDashboardReadOptions = {},
): Promise<ClientHomeDashboardReadResult> {
  const sessionResult = await tracePortalReadStage(
    "auth",
    () => getClientSessionReadResult({
      requestTimeoutMs: 3_000,
      retryDelaysMs: [250],
    }),
  );
  if (sessionResult.status === "unavailable") {
    recordPortalReadOutcome(
      sessionResult.reason === "cancelled" ? "cancelled" : "unavailable",
    );
    return buildDashboardReadResult({
      ...emptyDashboard(false),
      error: "Client session unavailable",
      unavailable: true,
    });
  }
  if (sessionResult.status !== "authenticated") {
    recordPortalReadOutcome("unauthenticated");
    return buildDashboardReadResult(emptyDashboard(false));
  }
  const session = sessionResult.session;

  const adminClient = createAdminClient({
    requestTimeoutMs: 4_000,
    retryDelaysMs: [250],
  });
  const [profileResult, applicationResult] = await Promise.all([
    tracePortalReadStage("profile", () =>
      adminClient
        .from("applicant_profiles")
        .select(PROFILE_COLUMNS)
        .eq("id", session.userId)
        .maybeSingle(),
    ),
    tracePortalReadStage("applications", () =>
      adminClient
        .from("applications")
        .select(CLIENT_STATUS_APPLICATION_SELECT)
        .eq("applicant_id", session.userId)
        .order("created_at", { ascending: false }),
    ),
  ]);

  const { data: profile, error: profileError } = profileResult;
  if (profileError) {
    return buildDashboardReadResult(
      emptyDashboard(true, session.email, profileError.message),
    );
  }
  if (!profile) {
    return buildDashboardReadResult({
      ...emptyDashboard(true, session.email),
    });
  }

  const { data: applicationRows, error: applicationError } = applicationResult;
  if (applicationError) {
    return buildDashboardReadResult({
      authenticated: true,
      authEmail: session.email,
      profile: profile as unknown as ClientHomeProfile,
      applications: [],
      documents: [],
      payments: [],
      error: applicationError.message,
    });
  }

  const rawApplications = ((applicationRows ?? []) as unknown as ClientStatusApplicationRow[]).filter(
    (application) => !isQaDryRunPurpose(application.purpose),
  );
  const applicationIds = rawApplications.map((application) => application.id);
  const packageIds = rawApplications
    .map((application) => application.visa_package_id)
    .filter((id): id is string => Boolean(id));

  let rawDocuments: HomeDocumentRow[] = [];
  let rawPayments: HomePaymentRow[] = [];
  if (applicationIds.length > 0) {
    const paymentFilters = [
      buildUuidInFilter("application_id", applicationIds),
      ...(packageIds.length > 0
        ? [buildUuidInFilter("visa_package_id", packageIds)]
        : []),
    ];
    const [documentResult, paymentResult] = await Promise.all([
      tracePortalReadStage("documents", () =>
        adminClient
          .from("application_documents")
          .select(DOCUMENT_COLUMNS)
          .in("application_id", applicationIds),
      ),
      tracePortalReadStage("payments", () =>
        adminClient
          .from("payment_records")
          .select(PAYMENT_COLUMNS)
          .eq("applicant_id", session.userId)
          .or(paymentFilters.join(",")),
      ),
    ]);
    const { data: documentRows, error: documentError } = documentResult;
    if (documentError) {
      return buildDashboardReadResult({
        authenticated: true,
        authEmail: session.email,
        profile: profile as unknown as ClientHomeProfile,
        applications: rawApplications.map(toDashboardApplication),
        documents: [],
        payments: [],
        error: documentError.message,
      });
    }
    const paymentError = paymentResult.error;
    if (paymentError) {
      return buildDashboardReadResult({
        authenticated: true,
        authEmail: session.email,
        profile: profile as unknown as ClientHomeProfile,
        applications: rawApplications.map(toDashboardApplication),
        documents: ((documentRows ?? []) as unknown as HomeDocumentRow[]).map(toDashboardDocument),
        payments: [],
        error: paymentError.message,
      });
    }
    rawDocuments = (documentRows ?? []) as unknown as HomeDocumentRow[];
    rawPayments = dedupeById(
      (paymentResult.data ?? []) as unknown as HomePaymentRow[],
    );
  }

  const data: ClientHomeDashboardData = {
    authenticated: true,
    authEmail: session.email,
    profile: profile as unknown as ClientHomeProfile,
    applications: rawApplications.map(toDashboardApplication),
    documents: rawDocuments.map(toDashboardDocument),
    payments: rawPayments.map(toDashboardPayment),
  };
  const result = buildDashboardReadResult(data);
  if (!options.includeTimeline) return result;

  const selectedApplication = selectHomeApplication(rawApplications, options.selection);
  if (!selectedApplication) return result;

  try {
    const timelineResult = await loadClientHomeTimeline(adminClient, {
      application: selectedApplication,
      documents: rawDocuments,
      payments: rawPayments,
    });
    return {
      ...result,
      timeline: timelineResult.application,
      timelineApplicationId: selectedApplication.id,
      timelinePartialData: timelineResult.partialData,
    };
  } catch {
    recordPortalReadOutcome("unavailable");
    return {
      ...result,
      timelineApplicationId: selectedApplication.id,
      timelinePartialData: true,
    };
  }
}

export function recordHomeDashboardReadOutcome(
  result: ClientHomeDashboardReadResult,
): void {
  if (result.data.unavailable) {
    recordPortalReadOutcome("unavailable");
  } else if (!result.data.authenticated) {
    recordPortalReadOutcome("unauthenticated");
  } else if (result.data.error) {
    recordPortalReadOutcome("error");
  } else if (result.timelinePartialData) {
    recordPortalReadOutcome("partial");
  } else {
    recordPortalReadOutcome("ok");
  }
}
