import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type StripeTable<Row extends Record<string, unknown>> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type StripeDatabase = {
  public: {
    Tables: {
      applicant_profiles: StripeTable<ApplicantProfileRow>;
      application_documents: StripeTable<ApplicationDocumentRow>;
      application_events: StripeTable<ApplicationEventRow>;
      application_packets: StripeTable<ApplicationPacketRow>;
      application_signatures: StripeTable<ApplicationSignatureRow>;
      applications: StripeTable<ApplicationRow>;
      consent_events: StripeTable<ConsentEventRow>;
      document_requirements: StripeTable<DocumentRequirementRow>;
      notification_events: StripeTable<NotificationEventRow>;
      payment_records: StripeTable<PaymentRecordRow>;
      visa_application_answers: StripeTable<VisaApplicationAnswerRow>;
      visa_packages: StripeTable<VisaPackageRow>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type StripeSupabaseClient = SupabaseClient<StripeDatabase>;
export type JsonObject = { [key: string]: Json | undefined };

export interface ApplicantProfileRow extends Record<string, unknown> {
  id: string;
  auth_user_id: string | null;
  full_name: string | null;
  email: string | null;
}

export interface ApplicationRow extends Record<string, unknown> {
  id: string;
  applicant_id: string;
  country: string;
  visa_type: string;
  status: string;
  visa_package_id: string | null;
  submitted_at: string | null;
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
  is_active: boolean | null;
  metadata: Json | null;
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
  metadata: Json | null;
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
  metadata: Json | null;
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
  payload: Json | null;
  sent_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ApplicationDocumentRow extends Record<string, unknown> {
  application_id: string;
  document_type: string;
  requirement_key: string | null;
  status: string;
  required: boolean | null;
  storage_path: string | null;
  filename: string | null;
}

export interface DocumentRequirementRow extends Record<string, unknown> {
  visa_package_id: string | null;
  country: string;
  visa_type: string;
  requirement_key: string;
  required: boolean;
}

export interface ConsentEventRow extends Record<string, unknown> {
  application_id: string;
  accepted: boolean;
  consent_type: string;
}

export interface ApplicationSignatureRow extends Record<string, unknown> {
  application_id: string;
  signature_type: string;
  signed_at: string | null;
}

export interface ApplicationPacketRow extends Record<string, unknown> {
  application_id: string;
  status: string;
}

export interface VisaApplicationAnswerRow extends Record<string, unknown> {
  application_id: string;
  field_name: string;
  value_text: string | null;
}

export interface VizaStripeMetadata {
  paymentRecordId: string | null;
  userId: string | null;
  applicantId: string | null;
  applicationId: string | null;
  visaPackageId: string | null;
  feeType: string | null;
}

export interface PaymentRecordInput {
  paymentRecordId?: string | null;
  applicationId: string | null;
  applicantId: string | null;
  visaPackageId: string | null;
  providerSessionId: string | null;
  providerPaymentId: string | null;
  amountCents: number;
  currency: string;
  status: string;
  receiptUrl?: string | null;
  metadata?: JsonObject;
}

export interface PaymentRecordIdentifiers {
  paymentRecordId?: string | null;
  providerSessionId?: string | null;
  providerPaymentId?: string | null;
  applicationId?: string | null;
}

export const STRIPE_PROVIDER = "stripe";
export const AGENCY_FEE_TYPE = "agency_fee";

export const PAYMENT_RECORD_SELECT = [
  "id",
  "application_id",
  "applicant_id",
  "visa_package_id",
  "provider",
  "provider_session_id",
  "provider_payment_id",
  "amount_cents",
  "currency",
  "status",
  "fee_type",
  "receipt_url",
  "metadata",
  "created_at",
  "updated_at",
].join(", ");

export class StripeRouteConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeRouteConfigError";
  }
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function createStripeAdminClient(): StripeSupabaseClient {
  return createAdminClient() as unknown as StripeSupabaseClient;
}

export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new StripeRouteConfigError("Stripe secret key is not configured.");
  }

  return new Stripe(secretKey);
}

export function getStripeWebhookSecret(): string {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    throw new StripeRouteConfigError("Stripe webhook secret is not configured.");
  }

  return webhookSecret;
}

export function getAppBaseUrl(request: Request): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/+$/, "");

  return new URL(request.url).origin.replace(/\/+$/, "");
}

export function normalizeCurrency(currency: string | null | undefined): string {
  const normalized = (currency || "USD").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : "USD";
}

export function asJsonObject(value: Json | null | undefined): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function readMetadataValue(
  metadata: Stripe.Metadata | null | undefined,
  keys: string[],
): string | null {
  if (!metadata) return null;

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
}

export function extractVizaMetadata(
  metadata: Stripe.Metadata | null | undefined,
): VizaStripeMetadata {
  return {
    paymentRecordId: readMetadataValue(metadata, [
      "paymentRecordId",
      "payment_record_id",
      "viza_payment_record_id",
    ]),
    userId: readMetadataValue(metadata, ["userId", "user_id", "viza_user_id"]),
    applicantId: readMetadataValue(metadata, [
      "applicantId",
      "applicant_id",
      "viza_applicant_id",
    ]),
    applicationId: readMetadataValue(metadata, [
      "applicationId",
      "application_id",
      "viza_application_id",
    ]),
    visaPackageId: readMetadataValue(metadata, [
      "visaPackageId",
      "visa_package_id",
      "viza_package_id",
    ]),
    feeType: readMetadataValue(metadata, ["feeType", "fee_type", "viza_fee_type"]),
  };
}

export function isAgencyFeeMetadata(metadata: VizaStripeMetadata): boolean {
  return metadata.feeType === AGENCY_FEE_TYPE || Boolean(metadata.paymentRecordId);
}

export function stripeObjectId(
  value: string | { id?: string } | null | undefined,
): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value !== "string" && typeof value.id === "string" && value.id.trim()) {
    return value.id;
  }
  return null;
}

export function chargeReceiptUrl(
  charge: string | Stripe.Charge | null | undefined,
): string | null {
  if (!charge || typeof charge === "string") return null;
  return charge.receipt_url ?? null;
}

export function paymentIntentReceiptUrl(
  paymentIntent: Stripe.PaymentIntent | null | undefined,
): string | null {
  return paymentIntent ? chargeReceiptUrl(paymentIntent.latest_charge) : null;
}

export function invoiceReceiptUrl(invoice: string | Stripe.Invoice | null | undefined): string | null {
  if (!invoice || typeof invoice === "string") return null;
  return invoice.hosted_invoice_url ?? invoice.invoice_pdf ?? null;
}

function getSupabaseErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function paymentStatusAllowsDowngrade(currentStatus: string | null, nextStatus: string): boolean {
  if (!currentStatus) return true;
  if (["refunded", "partially_refunded"].includes(currentStatus)) {
    return nextStatus.startsWith("refund");
  }
  if (currentStatus === "paid") {
    return !["pending", "failed", "canceled", "expired"].includes(nextStatus);
  }
  return true;
}

function resolvePaymentStatus(currentStatus: string | null, nextStatus: string): string {
  return paymentStatusAllowsDowngrade(currentStatus, nextStatus) ? nextStatus : currentStatus ?? nextStatus;
}

function buildPaymentMetadata(
  existing: PaymentRecordRow | null,
  next: JsonObject | undefined,
): JsonObject {
  const existingMetadata = asJsonObject(existing?.metadata ?? null);
  const existingStripe = asJsonObject(existingMetadata.stripe ?? null);
  const nextStripe = asJsonObject(next?.stripe ?? null);

  return {
    ...existingMetadata,
    ...(next ?? {}),
    stripe: {
      ...existingStripe,
      ...nextStripe,
    },
  };
}

export async function findPaymentRecord(
  adminClient: StripeSupabaseClient,
  identifiers: PaymentRecordIdentifiers,
): Promise<PaymentRecordRow | null> {
  if (identifiers.paymentRecordId) {
    const { data, error } = await adminClient
      .from("payment_records")
      .select(PAYMENT_RECORD_SELECT)
      .eq("id", identifiers.paymentRecordId)
      .eq("fee_type", AGENCY_FEE_TYPE)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as unknown as PaymentRecordRow;
  }

  if (identifiers.providerSessionId) {
    const { data, error } = await adminClient
      .from("payment_records")
      .select(PAYMENT_RECORD_SELECT)
      .eq("provider", STRIPE_PROVIDER)
      .eq("provider_session_id", identifiers.providerSessionId)
      .eq("fee_type", AGENCY_FEE_TYPE)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as unknown as PaymentRecordRow;
  }

  if (identifiers.providerPaymentId) {
    let query = adminClient
      .from("payment_records")
      .select(PAYMENT_RECORD_SELECT)
      .eq("provider", STRIPE_PROVIDER)
      .eq("provider_payment_id", identifiers.providerPaymentId)
      .eq("fee_type", AGENCY_FEE_TYPE)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (identifiers.applicationId) {
      query = query.eq("application_id", identifiers.applicationId);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (data) return data as unknown as PaymentRecordRow;
  }

  return null;
}

export async function findLatestPaymentRecordByApplication(
  adminClient: StripeSupabaseClient,
  applicationId: string,
): Promise<PaymentRecordRow | null> {
  const { data, error } = await adminClient
    .from("payment_records")
    .select(PAYMENT_RECORD_SELECT)
    .eq("provider", STRIPE_PROVIDER)
    .eq("application_id", applicationId)
    .eq("fee_type", AGENCY_FEE_TYPE)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as PaymentRecordRow | null) ?? null;
}

async function updatePaymentRecord(
  adminClient: StripeSupabaseClient,
  existing: PaymentRecordRow,
  input: PaymentRecordInput,
): Promise<PaymentRecordRow> {
  const nextStatus = resolvePaymentStatus(existing.status, input.status);
  const updatePayload: Partial<PaymentRecordRow> = {
    application_id: input.applicationId ?? existing.application_id,
    applicant_id: input.applicantId ?? existing.applicant_id,
    visa_package_id: input.visaPackageId ?? existing.visa_package_id,
    provider_session_id: input.providerSessionId ?? existing.provider_session_id,
    provider_payment_id: input.providerPaymentId ?? existing.provider_payment_id,
    amount_cents: input.amountCents || existing.amount_cents,
    currency: normalizeCurrency(input.currency || existing.currency),
    status: nextStatus,
    receipt_url: input.receiptUrl ?? existing.receipt_url,
    metadata: buildPaymentMetadata(existing, input.metadata),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await adminClient
    .from("payment_records")
    .update(updatePayload)
    .eq("id", existing.id)
    .select(PAYMENT_RECORD_SELECT)
    .single();

  if (error) throw error;
  return data as unknown as PaymentRecordRow;
}

export async function upsertPaymentRecord(
  adminClient: StripeSupabaseClient,
  input: PaymentRecordInput,
): Promise<PaymentRecordRow> {
  const existing = await findPaymentRecord(adminClient, {
    paymentRecordId: input.paymentRecordId,
    providerSessionId: input.providerSessionId,
    providerPaymentId: input.providerPaymentId,
    applicationId: input.applicationId,
  });

  if (existing) return updatePaymentRecord(adminClient, existing, input);

  const now = new Date().toISOString();
  const insertPayload: Partial<PaymentRecordRow> = {
    application_id: input.applicationId,
    applicant_id: input.applicantId,
    visa_package_id: input.visaPackageId,
    provider: STRIPE_PROVIDER,
    provider_session_id: input.providerSessionId,
    provider_payment_id: input.providerPaymentId,
    amount_cents: input.amountCents,
    currency: normalizeCurrency(input.currency),
    status: input.status,
    fee_type: AGENCY_FEE_TYPE,
    receipt_url: input.receiptUrl ?? null,
    metadata: buildPaymentMetadata(null, input.metadata),
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await adminClient
    .from("payment_records")
    .insert(insertPayload)
    .select(PAYMENT_RECORD_SELECT)
    .single();

  if (!error) return data as unknown as PaymentRecordRow;

  if (getSupabaseErrorCode(error) === "23505" && input.providerSessionId) {
    const duplicate = await findPaymentRecord(adminClient, {
      providerSessionId: input.providerSessionId,
    });
    if (duplicate) return updatePaymentRecord(adminClient, duplicate, input);
  }

  throw error;
}

export async function insertApplicationEventOnce(
  adminClient: StripeSupabaseClient,
  event: {
    applicationId: string | null;
    applicantId: string | null;
    eventType: string;
    message: string;
    metadata: JsonObject;
    dedupe: JsonObject;
  },
): Promise<void> {
  if (!event.applicationId) return;

  const { data: existing, error: findError } = await adminClient
    .from("application_events")
    .select("id")
    .eq("application_id", event.applicationId)
    .eq("event_type", event.eventType)
    .contains("metadata", event.dedupe)
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) return;

  const { error } = await adminClient.from("application_events").insert({
    application_id: event.applicationId,
    applicant_id: event.applicantId,
    event_type: event.eventType,
    actor_type: "system",
    actor_id: null,
    message: event.message,
    metadata: event.metadata,
    created_at: new Date().toISOString(),
  });

  if (error) throw error;
}

export async function insertNotificationEventOnce(
  adminClient: StripeSupabaseClient,
  notification: {
    applicationId: string | null;
    applicantId: string | null;
    templateKey: string;
    recipient: string | null;
    payload: JsonObject;
    dedupe: JsonObject;
  },
): Promise<void> {
  const { data: existing, error: findError } = await adminClient
    .from("notification_events")
    .select("id")
    .eq("template_key", notification.templateKey)
    .contains("payload", notification.dedupe)
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) return;

  const now = new Date().toISOString();
  const { error } = await adminClient.from("notification_events").insert({
    application_id: notification.applicationId,
    applicant_id: notification.applicantId,
    channel: "email",
    template_key: notification.templateKey,
    recipient: notification.recipient,
    status: "queued",
    payload: notification.payload,
    sent_at: null,
    created_at: now,
    updated_at: now,
  });

  if (error) throw error;
}

export async function getApplicantEmail(
  adminClient: StripeSupabaseClient,
  applicantId: string | null,
): Promise<string | null> {
  if (!applicantId) return null;

  const { data, error } = await adminClient
    .from("applicant_profiles")
    .select("email")
    .eq("id", applicantId)
    .maybeSingle();

  if (error) throw error;
  return data?.email ?? null;
}

async function countAcceptedConsents(
  adminClient: StripeSupabaseClient,
  applicationId: string,
): Promise<number> {
  const { count, error } = await adminClient
    .from("consent_events")
    .select("application_id", { count: "exact", head: true })
    .eq("application_id", applicationId)
    .eq("accepted", true);

  if (error) throw error;
  return count ?? 0;
}

async function countSignatures(
  adminClient: StripeSupabaseClient,
  applicationId: string,
): Promise<number> {
  const { count, error } = await adminClient
    .from("application_signatures")
    .select("application_id", { count: "exact", head: true })
    .eq("application_id", applicationId);

  if (error) throw error;
  return count ?? 0;
}

async function countFormAnswers(
  adminClient: StripeSupabaseClient,
  applicationId: string,
): Promise<number> {
  const { count, error } = await adminClient
    .from("visa_application_answers")
    .select("application_id", { count: "exact", head: true })
    .eq("application_id", applicationId);

  if (error) throw error;
  return count ?? 0;
}

function documentSatisfiesRequirement(
  requirement: DocumentRequirementRow,
  documents: ApplicationDocumentRow[],
): boolean {
  return documents.some((document) => {
    const matches =
      document.requirement_key === requirement.requirement_key ||
      document.document_type === requirement.requirement_key;
    const hasFile = Boolean(document.storage_path || document.filename);
    return matches && hasFile && ["uploaded", "validated", "approved"].includes(document.status);
  });
}

async function getDocumentRequirements(
  adminClient: StripeSupabaseClient,
  application: ApplicationRow,
): Promise<DocumentRequirementRow[]> {
  if (application.visa_package_id) {
    const { data, error } = await adminClient
      .from("document_requirements")
      .select("visa_package_id, country, visa_type, requirement_key, required")
      .eq("visa_package_id", application.visa_package_id);

    if (error) throw error;
    if ((data ?? []).length > 0) return data ?? [];
  }

  const { data, error } = await adminClient
    .from("document_requirements")
    .select("visa_package_id, country, visa_type, requirement_key, required")
    .is("visa_package_id", null)
    .eq("country", application.country)
    .eq("visa_type", application.visa_type);

  if (error) throw error;
  return data ?? [];
}

async function documentsAreReady(
  adminClient: StripeSupabaseClient,
  application: ApplicationRow,
): Promise<boolean> {
  const [{ data: documents, error: documentsError }, requirements] = await Promise.all([
    adminClient
      .from("application_documents")
      .select("application_id, document_type, requirement_key, status, required, storage_path, filename")
      .eq("application_id", application.id),
    getDocumentRequirements(adminClient, application),
  ]);

  if (documentsError) throw documentsError;

  const documentRows = documents ?? [];
  const requiredRequirements = requirements.filter((requirement) => requirement.required);
  if (requiredRequirements.length > 0) {
    return requiredRequirements.every((requirement) =>
      documentSatisfiesRequirement(requirement, documentRows),
    );
  }

  const requiredDocuments = documentRows.filter((document) => document.required !== false);
  return (
    requiredDocuments.length > 0 &&
    requiredDocuments.every(
      (document) =>
        Boolean(document.storage_path || document.filename) &&
        ["uploaded", "validated", "approved"].includes(document.status),
    )
  );
}

async function packetIsReady(
  adminClient: StripeSupabaseClient,
  applicationId: string,
): Promise<boolean> {
  const { data, error } = await adminClient
    .from("application_packets")
    .select("application_id, status")
    .eq("application_id", applicationId)
    .in("status", ["ready", "generated", "complete", "completed"])
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function resolveNextApplicationStatusAfterPayment(
  adminClient: StripeSupabaseClient,
  application: ApplicationRow,
): Promise<string> {
  if ((await countAcceptedConsents(adminClient, application.id)) === 0) {
    return "awaiting_consent";
  }

  if ((await countSignatures(adminClient, application.id)) === 0) {
    return "awaiting_consent";
  }

  if ((await countFormAnswers(adminClient, application.id)) === 0) {
    return "awaiting_documents";
  }

  if (!(await documentsAreReady(adminClient, application))) {
    return "awaiting_documents";
  }

  if (await packetIsReady(adminClient, application.id)) {
    return "packet_ready";
  }

  return "ready_for_packet";
}

export async function advanceApplicationAfterConfirmedPayment(
  adminClient: StripeSupabaseClient,
  context: {
    applicationId: string | null;
    applicantId: string | null;
    paymentRecordId: string;
    stripeEventId: string;
  },
): Promise<{ advanced: boolean; status: string | null }> {
  if (!context.applicationId) return { advanced: false, status: null };

  const { data: application, error } = await adminClient
    .from("applications")
    .select("id, applicant_id, country, visa_type, status, visa_package_id, submitted_at, updated_at")
    .eq("id", context.applicationId)
    .maybeSingle();

  if (error) throw error;
  if (!application) return { advanced: false, status: null };

  const lockedStatuses = new Set([
    "submitted",
    "approved",
    "rejected",
    "external_submission_in_progress",
    "packet_ready",
  ]);

  if (lockedStatuses.has(application.status)) {
    return { advanced: false, status: application.status };
  }

  const nextStatus = await resolveNextApplicationStatusAfterPayment(adminClient, application);
  if (application.status === nextStatus) {
    return { advanced: false, status: nextStatus };
  }

  const { error: updateError } = await adminClient
    .from("applications")
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", application.id);

  if (updateError) throw updateError;

  await insertApplicationEventOnce(adminClient, {
    applicationId: application.id,
    applicantId: context.applicantId ?? application.applicant_id,
    eventType: "application_state_advanced",
    message: `Application state advanced to ${nextStatus} after agency fee payment.`,
    metadata: {
      provider: STRIPE_PROVIDER,
      payment_record_id: context.paymentRecordId,
      stripe_event_id: context.stripeEventId,
      from_status: application.status,
      to_status: nextStatus,
    },
    dedupe: {
      payment_record_id: context.paymentRecordId,
      to_status: nextStatus,
    },
  });

  return { advanced: true, status: nextStatus };
}
