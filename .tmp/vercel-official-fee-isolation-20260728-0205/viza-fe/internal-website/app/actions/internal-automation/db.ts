import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, type UserRole } from "@/lib/rbac";
import {
  actionFail,
  actionOk,
  type AutomationActionResult,
  type AutomationJson,
} from "./types";

export const AUTOMATION_ADMIN_ROLES = [
  "admin",
  "staff",
  "customer_service",
] as const satisfies UserRole[];

export interface SupabaseErrorLike {
  message: string;
  code?: string;
}

export interface InternalQueryResponse<T> {
  data: T | null;
  error: SupabaseErrorLike | null;
  count?: number | null;
}

type RowFromArray<T> = T extends (infer Row)[] ? Row : T;

export interface InternalQuery<T> extends PromiseLike<InternalQueryResponse<T>> {
  select<Result = T>(
    columns?: string,
    options?: { count?: "exact"; head?: boolean },
  ): InternalQuery<Result>;
  insert<Result = T>(
    values: Record<string, unknown> | Record<string, unknown>[],
  ): InternalQuery<Result>;
  update<Result = T>(values: Record<string, unknown>): InternalQuery<Result>;
  upsert<Result = T>(
    values: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean },
  ): InternalQuery<Result>;
  eq(column: string, value: unknown): InternalQuery<T>;
  neq(column: string, value: unknown): InternalQuery<T>;
  is(column: string, value: unknown): InternalQuery<T>;
  in(column: string, values: unknown[]): InternalQuery<T>;
  gte(column: string, value: unknown): InternalQuery<T>;
  lte(column: string, value: unknown): InternalQuery<T>;
  order(
    column: string,
    options?: { ascending?: boolean; foreignTable?: string },
  ): InternalQuery<T>;
  limit(count: number): InternalQuery<T>;
  range(from: number, to: number): InternalQuery<T>;
  maybeSingle(): InternalQuery<RowFromArray<T> | null>;
  single(): InternalQuery<RowFromArray<T>>;
}

export interface InternalSupabaseClient {
  from<Row extends Record<string, unknown>>(
    relation: string,
  ): InternalQuery<Row[]>;
}

export interface AuthenticatedUserContext {
  userId: string;
  email: string | null;
}

export interface ApplicantProfileRow extends Record<string, unknown> {
  id: string;
  auth_user_id: string | null;
  full_name: string | null;
  email: string | null;
}

export interface CustomerAutomationContext extends AuthenticatedUserContext {
  applicantId: string;
  applicant: ApplicantProfileRow;
  adminClient: InternalSupabaseClient;
}

export interface AdminAutomationContext {
  adminUser: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  };
  adminClient: InternalSupabaseClient;
}

export interface ApplicationAutomationRow extends Record<string, unknown> {
  id: string;
  applicant_id: string;
  country: string;
  visa_type: string;
  status: string;
  visa_package_id: string | null;
  confirmation_number: string | null;
  submitted_at: string | null;
  receipt_url: string | null;
  packet_status: string | null;
  packet_manifest: AutomationJson | null;
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

export interface ApplicationDocumentRow extends Record<string, unknown> {
  id: string;
  application_id: string;
  document_type: string;
  requirement_key: string | null;
  storage_path: string | null;
  filename: string | null;
  status: string;
  rejection_reason: string | null;
  required: boolean | null;
  review_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface VisaPackageRow extends Record<string, unknown> {
  id: string;
  country: string;
  visa_type: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  currency: string | null;
  is_active: boolean;
  metadata: AutomationJson | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface DocumentRequirementRow extends Record<string, unknown> {
  id: string;
  visa_package_id: string | null;
  country: string;
  visa_type: string;
  requirement_key: string;
  label_en: string;
  label_zh: string;
  description: string | null;
  required: boolean;
  sort_order: number;
  metadata: AutomationJson | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PaymentRecordRow extends Record<string, unknown> {
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
  metadata: AutomationJson | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface InvoiceRequestRow extends Record<string, unknown> {
  id: string;
  payment_record_id: string | null;
  application_id: string | null;
  applicant_id: string | null;
  invoice_name: string | null;
  tax_identifier: string | null;
  billing_email: string | null;
  status: string;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface RefundRecordRow extends Record<string, unknown> {
  id: string;
  payment_record_id: string | null;
  application_id: string | null;
  applicant_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  reason: string | null;
  policy_snapshot: AutomationJson | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ConsentEventRow extends Record<string, unknown> {
  id: string;
  application_id: string;
  applicant_id: string | null;
  consent_type: string;
  version: string;
  accepted: boolean;
  document_hash: string | null;
  created_at: string | null;
}

export interface ApplicationSignatureRow extends Record<string, unknown> {
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

export interface ApplicationPacketRow extends Record<string, unknown> {
  id: string;
  application_id: string;
  applicant_id: string | null;
  status: string;
  manifest: AutomationJson;
  storage_path: string | null;
  handoff_token: string | null;
  generated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ApplicationEventRow extends Record<string, unknown> {
  id: string;
  application_id: string;
  applicant_id: string | null;
  event_type: string;
  actor_type: string;
  actor_id: string | null;
  message: string | null;
  metadata: AutomationJson | null;
  created_at: string | null;
}

export interface NotificationEventRow extends Record<string, unknown> {
  id: string;
  application_id: string | null;
  applicant_id: string | null;
  channel: string;
  template_key: string;
  recipient: string | null;
  status: string;
  payload: AutomationJson | null;
  sent_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface OcrExtractionRow extends Record<string, unknown> {
  id: string;
  application_id: string;
  applicant_id: string | null;
  document_id: string | null;
  provider: string;
  status: string;
  extracted_fields: AutomationJson;
  error_message: string | null;
  confirmed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface DataPrivacyRequestRow extends Record<string, unknown> {
  id: string;
  applicant_id: string | null;
  request_type: string;
  status: string;
  notes: string | null;
  fulfilled_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export const APPLICATION_AUTOMATION_SELECT = [
  "id",
  "applicant_id",
  "country",
  "visa_type",
  "status",
  "visa_package_id",
  "confirmation_number",
  "submitted_at",
  "receipt_url",
  "packet_status",
  "packet_manifest",
  "packet_storage_path",
  "packet_ready_at",
  "external_status",
  "external_reference",
  "external_status_updated_at",
  "result_status",
  "result_storage_path",
  "result_notes",
  "government_fee_cents",
  "government_fee_currency",
  "government_fee_mode",
  "created_at",
  "updated_at",
].join(", ");

export function getInternalAdminClient(): InternalSupabaseClient {
  return createAdminClient() as unknown as InternalSupabaseClient;
}

export async function getAuthenticatedUserContext(): Promise<
  AutomationActionResult<AuthenticatedUserContext>
> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return actionFail("UNAUTHENTICATED", "You must be signed in.");
  }

  return actionOk({
    userId: user.id,
    email: user.email ?? null,
  });
}

export async function getCustomerAutomationContext(): Promise<
  AutomationActionResult<CustomerAutomationContext>
> {
  const authResult = await getAuthenticatedUserContext();
  if (!authResult.ok) return authResult;

  const adminClient = getInternalAdminClient();
  const { data, error } = await adminClient
    .from<ApplicantProfileRow>("applicant_profiles")
    .select("id, auth_user_id, full_name, email")
    .eq("auth_user_id", authResult.data.userId)
    .maybeSingle();

  if (error) {
    return actionFail("DB_ERROR", "Could not load applicant profile.");
  }

  if (!data) {
    return actionFail("NOT_FOUND", "Applicant profile was not found.");
  }

  return actionOk({
    ...authResult.data,
    applicantId: data.id,
    applicant: data,
    adminClient,
  });
}

export async function getAdminAutomationContext(): Promise<
  AutomationActionResult<AdminAutomationContext>
> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return actionFail("UNAUTHENTICATED", "You must be signed in.");
  }

  if (!AUTOMATION_ADMIN_ROLES.includes(currentUser.role)) {
    return actionFail("FORBIDDEN", "Internal automation access is restricted.");
  }

  return actionOk({
    adminUser: {
      id: currentUser.id,
      email: currentUser.email,
      name: currentUser.name,
      role: currentUser.role,
    },
    adminClient: getInternalAdminClient(),
  });
}

export async function getOwnedApplication(
  adminClient: InternalSupabaseClient,
  applicantId: string,
  applicationId: string,
): Promise<AutomationActionResult<ApplicationAutomationRow>> {
  const { data, error } = await adminClient
    .from<ApplicationAutomationRow>("applications")
    .select(APPLICATION_AUTOMATION_SELECT)
    .eq("id", applicationId)
    .eq("applicant_id", applicantId)
    .maybeSingle();

  if (error) {
    return actionFail("DB_ERROR", "Could not load application.");
  }

  if (!data) {
    return actionFail("NOT_FOUND", "Application was not found.");
  }

  return actionOk(data);
}

export async function listOwnedApplications(
  adminClient: InternalSupabaseClient,
  applicantId: string,
  applicationId?: string,
): Promise<AutomationActionResult<ApplicationAutomationRow[]>> {
  let query = adminClient
    .from<ApplicationAutomationRow>("applications")
    .select(APPLICATION_AUTOMATION_SELECT)
    .eq("applicant_id", applicantId)
    .order("updated_at", { ascending: false });

  if (applicationId) {
    query = query.eq("id", applicationId);
  }

  const { data, error } = await query;

  if (error) {
    return actionFail("DB_ERROR", "Could not load applications.");
  }

  return actionOk(data ?? []);
}

export async function insertApplicationEvent(
  adminClient: InternalSupabaseClient,
  event: {
    applicationId: string;
    applicantId: string | null;
    eventType: string;
    actorType: "customer" | "staff" | "system";
    actorId: string | null;
    message: string;
    metadata?: AutomationJson;
  },
): Promise<void> {
  await adminClient.from<ApplicationEventRow>("application_events").insert({
    application_id: event.applicationId,
    applicant_id: event.applicantId,
    event_type: event.eventType,
    actor_type: event.actorType,
    actor_id: event.actorId,
    message: event.message,
    metadata: event.metadata ?? null,
  });
}
