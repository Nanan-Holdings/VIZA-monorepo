import { getSupabaseClient } from "../../db/supabase-client.js";
import type {
  GovernmentFeeRule,
  JsonObject,
  OfficialFeeApplication,
  OfficialFeeAuditEventInput,
  OfficialFeeConsent,
  OfficialFeeMode,
  OfficialFeePaymentAttempt,
  OfficialFeePaymentIntent,
  OfficialFeeReceipt,
  OfficialFeeReceiptInput,
  OfficialFeeReconciliationEntry,
  OfficialFeeQuote,
  PaymentInstrumentRecord,
  UserPaymentEvidence,
} from "./types.js";
import { resolveOfficialFeeCountry } from "./country.js";

export interface InsertOfficialFeeQuoteInput {
  applicationId: string;
  userId: string;
  countryCode: string;
  visaType: string | null;
  officialFeeAmount: number;
  officialFeeCurrency: string;
  serviceFeeAmount: number | null;
  serviceFeeCurrency: string | null;
  totalChargeAmount: number | null;
  totalChargeCurrency: string | null;
  exchangeRate: number | null;
  feeSource: string | null;
  feeSourceUrl: string | null;
  feeBreakdownJson: JsonObject;
  quoteStatus: string;
  expiresAt: string | null;
}

export interface InsertOfficialFeeConsentInput {
  application: OfficialFeeApplication;
  quote: OfficialFeeQuote;
  actorUserId: string;
  consentSnapshot: JsonObject;
  idempotencyKey: string;
}

export interface InsertOfficialFeePaymentIntentInput {
  applicationId: string;
  userId: string;
  feeQuoteId: string;
  countryCode: string;
  provider: string;
  mode: OfficialFeeMode;
  officialFeeAmount: number;
  officialFeeCurrency: string;
  targetPayee: string | null;
  targetSite: string | null;
  paymentMethodType: string | null;
  paymentInstrumentId: string | null;
  status: string;
  idempotencyKey: string;
  requiresAdminApproval: boolean;
  userConsentedAt: string | null;
  userConsentSnapshotJson: JsonObject | null;
}

export interface InsertOfficialFeePaymentAttemptInput {
  officialFeePaymentIntentId: string;
  applicationId: string;
  attemptNumber: number;
  provider: string;
  mode: OfficialFeeMode;
  status: string;
  requestPayloadRedactedJson: JsonObject;
}

export interface InsertReconciliationEntryInput {
  applicationId: string;
  userId: string;
  officialFeePaymentIntentId: string;
  userPaymentId: string | null;
  officialFeeAmount: number;
  officialFeeCurrency: string;
  userCollectedAmount: number | null;
  userCollectedCurrency: string | null;
  fxRate: number | null;
  balanceDelta: number | null;
  reconciliationStatus: string;
  notes: string | null;
}

export interface OfficialFeeRepository {
  getApplicationContext(applicationId: string): Promise<OfficialFeeApplication | null>;
  getLatestGovernmentFeeRule(application: OfficialFeeApplication): Promise<GovernmentFeeRule | null>;
  getLatestFeeQuote(applicationId: string): Promise<OfficialFeeQuote | null>;
  getFeeQuoteById(quoteId: string): Promise<OfficialFeeQuote | null>;
  insertFeeQuote(input: InsertOfficialFeeQuoteInput): Promise<OfficialFeeQuote>;
  updateFeeQuote(
    quoteId: string,
    patch: Partial<Pick<OfficialFeeQuote, "quoteStatus" | "expiresAt">>,
  ): Promise<OfficialFeeQuote>;
  insertConsentEvent(input: InsertOfficialFeeConsentInput): Promise<OfficialFeeConsent>;
  getLatestConsent(applicationId: string): Promise<OfficialFeeConsent | null>;
  findPaymentIntentByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<OfficialFeePaymentIntent | null>;
  insertPaymentIntent(
    input: InsertOfficialFeePaymentIntentInput,
  ): Promise<OfficialFeePaymentIntent>;
  getPaymentIntent(intentId: string): Promise<OfficialFeePaymentIntent | null>;
  getLatestPaymentIntent(applicationId: string): Promise<OfficialFeePaymentIntent | null>;
  updatePaymentIntent(
    intentId: string,
    patch: Partial<
      Pick<
        OfficialFeePaymentIntent,
        | "status"
        | "paymentMethodType"
        | "paymentInstrumentId"
        | "adminApprovedBy"
        | "adminApprovedAt"
      >
    >,
  ): Promise<OfficialFeePaymentIntent>;
  listPaymentAttempts(intentId: string): Promise<OfficialFeePaymentAttempt[]>;
  insertPaymentAttempt(
    input: InsertOfficialFeePaymentAttemptInput,
  ): Promise<OfficialFeePaymentAttempt>;
  updatePaymentAttempt(
    attemptId: string,
    patch: Partial<
      Pick<
        OfficialFeePaymentAttempt,
        | "status"
        | "responsePayloadRedactedJson"
        | "errorCode"
        | "errorMessage"
        | "officialReceiptNumber"
        | "officialReceiptUrl"
        | "screenshotUrl"
        | "finishedAt"
      >
    >,
  ): Promise<OfficialFeePaymentAttempt>;
  insertReceipt(input: OfficialFeeReceiptInput): Promise<OfficialFeeReceipt>;
  getReceiptByIntent(intentId: string): Promise<OfficialFeeReceipt | null>;
  getPaidUserPayment(applicationId: string): Promise<UserPaymentEvidence | null>;
  selectPaymentInstrument(input: {
    countryCode: string;
    amount: number;
    currency: string;
    provider: string;
  }): Promise<PaymentInstrumentRecord | null>;
  insertReconciliationEntry(
    input: InsertReconciliationEntryInput,
  ): Promise<OfficialFeeReconciliationEntry>;
  getReconciliationByIntent(
    intentId: string,
  ): Promise<OfficialFeeReconciliationEntry | null>;
  updateApplicationOfficialFeeState(
    applicationId: string,
    patch: {
      officialFeeStatus?: string;
      officialFeeQuoteId?: string | null;
      officialFeePaymentIntentId?: string | null;
      officialFeeReceiptId?: string | null;
      officialFeeReconciliationStatus?: string | null;
    },
  ): Promise<void>;
  addApplicationEvent(input: OfficialFeeAuditEventInput): Promise<void>;
}

type SupabaseObject = Record<string, unknown>;

const READY_PAYMENT_STATUSES = ["paid", "succeeded", "success", "complete", "completed", "captured"];

function parseNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function requiredString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = parseNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toJsonObject(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonObject;
}

function readProfileAuthUserId(value: unknown): string | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return readProfileAuthUserId(value[0]);
  }
  if (typeof value === "object") {
    return nullableString((value as SupabaseObject).auth_user_id);
  }
  return null;
}

function mapQuote(row: SupabaseObject): OfficialFeeQuote {
  return {
    id: requiredString(row.id),
    applicationId: requiredString(row.application_id),
    userId: requiredString(row.user_id),
    countryCode: requiredString(row.country_code),
    visaType: nullableString(row.visa_type),
    officialFeeAmount: parseNumber(row.official_fee_amount),
    officialFeeCurrency: requiredString(row.official_fee_currency),
    serviceFeeAmount: nullableNumber(row.service_fee_amount),
    serviceFeeCurrency: nullableString(row.service_fee_currency),
    totalChargeAmount: nullableNumber(row.total_charge_amount),
    totalChargeCurrency: nullableString(row.total_charge_currency),
    exchangeRate: nullableNumber(row.exchange_rate),
    feeSource: nullableString(row.fee_source),
    feeSourceUrl: nullableString(row.fee_source_url),
    feeBreakdownJson: toJsonObject(row.fee_breakdown_json),
    quoteStatus: requiredString(row.quote_status),
    expiresAt: nullableString(row.expires_at),
    createdAt: nullableString(row.created_at),
    updatedAt: nullableString(row.updated_at),
  };
}

function mapPaymentIntent(row: SupabaseObject): OfficialFeePaymentIntent {
  return {
    id: requiredString(row.id),
    applicationId: requiredString(row.application_id),
    userId: requiredString(row.user_id),
    feeQuoteId: nullableString(row.fee_quote_id),
    countryCode: requiredString(row.country_code),
    provider: requiredString(row.provider),
    mode: requiredString(row.mode, "dry_run") as OfficialFeeMode,
    officialFeeAmount: parseNumber(row.official_fee_amount),
    officialFeeCurrency: requiredString(row.official_fee_currency),
    targetPayee: nullableString(row.target_payee),
    targetSite: nullableString(row.target_site),
    paymentMethodType: nullableString(row.payment_method_type),
    paymentInstrumentId: nullableString(row.payment_instrument_id),
    status: requiredString(row.status, "created") as OfficialFeePaymentIntent["status"],
    idempotencyKey: requiredString(row.idempotency_key),
    requiresAdminApproval: row.requires_admin_approval === true,
    adminApprovedBy: nullableString(row.admin_approved_by),
    adminApprovedAt: nullableString(row.admin_approved_at),
    userConsentedAt: nullableString(row.user_consented_at),
    userConsentSnapshotJson: row.user_consent_snapshot_json
      ? toJsonObject(row.user_consent_snapshot_json)
      : null,
    createdAt: nullableString(row.created_at),
    updatedAt: nullableString(row.updated_at),
  };
}

function mapAttempt(row: SupabaseObject): OfficialFeePaymentAttempt {
  return {
    id: requiredString(row.id),
    officialFeePaymentIntentId: nullableString(row.official_fee_payment_intent_id),
    applicationId: requiredString(row.application_id),
    attemptNumber: parseNumber(row.attempt_number),
    provider: requiredString(row.provider),
    mode: requiredString(row.mode, "dry_run") as OfficialFeeMode,
    status: requiredString(row.status),
    requestPayloadRedactedJson: row.request_payload_redacted_json
      ? toJsonObject(row.request_payload_redacted_json)
      : null,
    responsePayloadRedactedJson: row.response_payload_redacted_json
      ? toJsonObject(row.response_payload_redacted_json)
      : null,
    errorCode: nullableString(row.error_code),
    errorMessage: nullableString(row.error_message),
    officialReceiptNumber: nullableString(row.official_receipt_number),
    officialReceiptUrl: nullableString(row.official_receipt_url),
    screenshotUrl: nullableString(row.screenshot_url),
    startedAt: nullableString(row.started_at),
    finishedAt: nullableString(row.finished_at),
  };
}

function mapReceipt(row: SupabaseObject): OfficialFeeReceipt {
  return {
    id: requiredString(row.id),
    applicationId: requiredString(row.application_id),
    userId: requiredString(row.user_id),
    officialFeePaymentIntentId: nullableString(row.official_fee_payment_intent_id),
    countryCode: requiredString(row.country_code),
    receiptNumber: nullableString(row.receipt_number),
    receiptUrl: nullableString(row.receipt_url),
    receiptFileUrl: nullableString(row.receipt_file_url),
    amount: parseNumber(row.amount),
    currency: requiredString(row.currency),
    paidAt: nullableString(row.paid_at),
    source: nullableString(row.source),
    rawReceiptRedactedJson: row.raw_receipt_redacted_json
      ? toJsonObject(row.raw_receipt_redacted_json)
      : null,
    createdAt: nullableString(row.created_at),
  };
}

function mapReconciliation(row: SupabaseObject): OfficialFeeReconciliationEntry {
  return {
    id: requiredString(row.id),
    applicationId: requiredString(row.application_id),
    userId: requiredString(row.user_id),
    officialFeePaymentIntentId: nullableString(row.official_fee_payment_intent_id),
    userPaymentId: nullableString(row.user_payment_id),
    officialFeeAmount: parseNumber(row.official_fee_amount),
    officialFeeCurrency: requiredString(row.official_fee_currency),
    userCollectedAmount: nullableNumber(row.user_collected_amount),
    userCollectedCurrency: nullableString(row.user_collected_currency),
    fxRate: nullableNumber(row.fx_rate),
    balanceDelta: nullableNumber(row.balance_delta),
    reconciliationStatus: requiredString(row.reconciliation_status),
    notes: nullableString(row.notes),
    createdAt: nullableString(row.created_at),
    updatedAt: nullableString(row.updated_at),
  };
}

function mapConsent(row: SupabaseObject): OfficialFeeConsent | null {
  const scope = toJsonObject(row.consent_scope);
  const officialFee =
    scope.official_fee && typeof scope.official_fee === "object" && !Array.isArray(scope.official_fee)
      ? (scope.official_fee as JsonObject)
      : null;
  const quoteId = nullableString(officialFee?.quote_id);
  const userId = nullableString(row.auth_user_id);
  const applicationId = nullableString(row.application_id);
  if (!quoteId || !userId || !applicationId) return null;

  return {
    id: requiredString(row.id),
    applicationId,
    userId,
    quoteId,
    accepted: row.accepted === true,
    snapshot: officialFee,
    createdAt: nullableString(row.created_at),
  };
}

export class SupabaseOfficialFeeRepository implements OfficialFeeRepository {
  async getApplicationContext(applicationId: string): Promise<OfficialFeeApplication | null> {
    const { data, error } = await getSupabaseClient()
      .from("applications")
      .select(
        "id, applicant_id, country, visa_type, visa_package_id, status, payment_status, packet_status, automation_status, government_fee_cents, government_fee_currency, applicant_profiles!inner(auth_user_id)",
      )
      .eq("id", applicationId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    const row = data as SupabaseObject;
    const userId = readProfileAuthUserId(row.applicant_profiles);
    const country = requiredString(row.country);
    const countryResolution = resolveOfficialFeeCountry(country);
    if (!userId || !countryResolution) return null;

    return {
      id: requiredString(row.id),
      applicantId: requiredString(row.applicant_id),
      userId,
      country,
      countryCode: countryResolution.countryCode,
      visaType: nullableString(row.visa_type),
      visaPackageId: nullableString(row.visa_package_id),
      status: requiredString(row.status),
      paymentStatus: nullableString(row.payment_status),
      packetStatus: nullableString(row.packet_status),
      automationStatus: nullableString(row.automation_status),
      governmentFeeCents: nullableNumber(row.government_fee_cents),
      governmentFeeCurrency: nullableString(row.government_fee_currency),
    };
  }

  async getLatestGovernmentFeeRule(
    application: OfficialFeeApplication,
  ): Promise<GovernmentFeeRule | null> {
    if (!application.visaType) return null;
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await getSupabaseClient()
      .from("government_fee_rules")
      .select("id, amount_cents, currency, source_url, mode, metadata")
      .eq("country", application.country)
      .eq("visa_type", application.visaType)
      .or(`effective_to.is.null,effective_to.gte.${today}`)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return null;
    if (!data) return null;
    const row = data as SupabaseObject;
    return {
      id: requiredString(row.id),
      amountCents: parseNumber(row.amount_cents),
      currency: requiredString(row.currency, "USD"),
      sourceUrl: nullableString(row.source_url),
      mode: requiredString(row.mode),
      metadata: row.metadata ? toJsonObject(row.metadata) : null,
    };
  }

  async getLatestFeeQuote(applicationId: string): Promise<OfficialFeeQuote | null> {
    const { data, error } = await getSupabaseClient()
      .from("official_fee_quotes")
      .select("*")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapQuote(data as SupabaseObject) : null;
  }

  async getFeeQuoteById(quoteId: string): Promise<OfficialFeeQuote | null> {
    const { data, error } = await getSupabaseClient()
      .from("official_fee_quotes")
      .select("*")
      .eq("id", quoteId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapQuote(data as SupabaseObject) : null;
  }

  async insertFeeQuote(input: InsertOfficialFeeQuoteInput): Promise<OfficialFeeQuote> {
    const now = new Date().toISOString();
    const { data, error } = await getSupabaseClient()
      .from("official_fee_quotes")
      .insert({
        application_id: input.applicationId,
        user_id: input.userId,
        country_code: input.countryCode,
        visa_type: input.visaType,
        official_fee_amount: input.officialFeeAmount,
        official_fee_currency: input.officialFeeCurrency,
        service_fee_amount: input.serviceFeeAmount,
        service_fee_currency: input.serviceFeeCurrency,
        total_charge_amount: input.totalChargeAmount,
        total_charge_currency: input.totalChargeCurrency,
        exchange_rate: input.exchangeRate,
        fee_source: input.feeSource,
        fee_source_url: input.feeSourceUrl,
        fee_breakdown_json: input.feeBreakdownJson,
        quote_status: input.quoteStatus,
        expires_at: input.expiresAt,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "official_fee_quote insert failed");
    return mapQuote(data as SupabaseObject);
  }

  async updateFeeQuote(
    quoteId: string,
    patch: Partial<Pick<OfficialFeeQuote, "quoteStatus" | "expiresAt">>,
  ): Promise<OfficialFeeQuote> {
    const { data, error } = await getSupabaseClient()
      .from("official_fee_quotes")
      .update({
        quote_status: patch.quoteStatus,
        expires_at: patch.expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", quoteId)
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "official_fee_quote update failed");
    return mapQuote(data as SupabaseObject);
  }

  async insertConsentEvent(input: InsertOfficialFeeConsentInput): Promise<OfficialFeeConsent> {
    const now = new Date().toISOString();
    const scope: JsonObject = {
      official_fee: {
        quote_id: input.quote.id,
        official_fee_amount: input.quote.officialFeeAmount,
        official_fee_currency: input.quote.officialFeeCurrency,
        authorized_to_pay_on_behalf: true,
        consent_snapshot: input.consentSnapshot,
        accepted_at: now,
      },
    };

    const { data, error } = await getSupabaseClient()
      .from("consent_events")
      .upsert(
        {
          application_id: input.application.id,
          applicant_id: input.application.applicantId,
          auth_user_id: input.actorUserId,
          consent_type: "official_fee_payment_authorization",
          version: "2026-06-official-fee-v1",
          accepted: true,
          consent_scope: scope,
          source: "official_fee_api",
          idempotency_key: input.idempotencyKey,
          created_at: now,
        },
        { onConflict: "idempotency_key" },
      )
      .select("id, application_id, auth_user_id, accepted, consent_scope, created_at")
      .single();

    if (error || !data) throw new Error(error?.message ?? "official fee consent insert failed");
    const consent = mapConsent(data as SupabaseObject);
    if (!consent) throw new Error("official fee consent response was malformed");
    return consent;
  }

  async getLatestConsent(applicationId: string): Promise<OfficialFeeConsent | null> {
    const { data, error } = await getSupabaseClient()
      .from("consent_events")
      .select("id, application_id, auth_user_id, accepted, consent_scope, created_at")
      .eq("application_id", applicationId)
      .eq("consent_type", "official_fee_payment_authorization")
      .eq("accepted", true)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapConsent(data as SupabaseObject) : null;
  }

  async findPaymentIntentByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<OfficialFeePaymentIntent | null> {
    const { data, error } = await getSupabaseClient()
      .from("official_fee_payment_intents")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapPaymentIntent(data as SupabaseObject) : null;
  }

  async insertPaymentIntent(
    input: InsertOfficialFeePaymentIntentInput,
  ): Promise<OfficialFeePaymentIntent> {
    const now = new Date().toISOString();
    const { data, error } = await getSupabaseClient()
      .from("official_fee_payment_intents")
      .insert({
        application_id: input.applicationId,
        user_id: input.userId,
        fee_quote_id: input.feeQuoteId,
        country_code: input.countryCode,
        provider: input.provider,
        mode: input.mode,
        official_fee_amount: input.officialFeeAmount,
        official_fee_currency: input.officialFeeCurrency,
        target_payee: input.targetPayee,
        target_site: input.targetSite,
        payment_method_type: input.paymentMethodType,
        payment_instrument_id: input.paymentInstrumentId,
        status: input.status,
        idempotency_key: input.idempotencyKey,
        requires_admin_approval: input.requiresAdminApproval,
        user_consented_at: input.userConsentedAt,
        user_consent_snapshot_json: input.userConsentSnapshotJson,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "official fee intent insert failed");
    return mapPaymentIntent(data as SupabaseObject);
  }

  async getPaymentIntent(intentId: string): Promise<OfficialFeePaymentIntent | null> {
    const { data, error } = await getSupabaseClient()
      .from("official_fee_payment_intents")
      .select("*")
      .eq("id", intentId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapPaymentIntent(data as SupabaseObject) : null;
  }

  async getLatestPaymentIntent(applicationId: string): Promise<OfficialFeePaymentIntent | null> {
    const { data, error } = await getSupabaseClient()
      .from("official_fee_payment_intents")
      .select("*")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapPaymentIntent(data as SupabaseObject) : null;
  }

  async updatePaymentIntent(
    intentId: string,
    patch: Partial<
      Pick<
        OfficialFeePaymentIntent,
        | "status"
        | "paymentMethodType"
        | "paymentInstrumentId"
        | "adminApprovedBy"
        | "adminApprovedAt"
      >
    >,
  ): Promise<OfficialFeePaymentIntent> {
    const { data, error } = await getSupabaseClient()
      .from("official_fee_payment_intents")
      .update({
        status: patch.status,
        payment_method_type: patch.paymentMethodType,
        payment_instrument_id: patch.paymentInstrumentId,
        admin_approved_by: patch.adminApprovedBy,
        admin_approved_at: patch.adminApprovedAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", intentId)
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "official fee intent update failed");
    return mapPaymentIntent(data as SupabaseObject);
  }

  async listPaymentAttempts(intentId: string): Promise<OfficialFeePaymentAttempt[]> {
    const { data, error } = await getSupabaseClient()
      .from("official_fee_payment_attempts")
      .select("*")
      .eq("official_fee_payment_intent_id", intentId)
      .order("attempt_number", { ascending: true });

    if (error) throw new Error(error.message);
    return ((data ?? []) as SupabaseObject[]).map(mapAttempt);
  }

  async insertPaymentAttempt(
    input: InsertOfficialFeePaymentAttemptInput,
  ): Promise<OfficialFeePaymentAttempt> {
    const { data, error } = await getSupabaseClient()
      .from("official_fee_payment_attempts")
      .insert({
        official_fee_payment_intent_id: input.officialFeePaymentIntentId,
        application_id: input.applicationId,
        attempt_number: input.attemptNumber,
        provider: input.provider,
        mode: input.mode,
        status: input.status,
        request_payload_redacted_json: input.requestPayloadRedactedJson,
        started_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "official fee attempt insert failed");
    return mapAttempt(data as SupabaseObject);
  }

  async updatePaymentAttempt(
    attemptId: string,
    patch: Partial<
      Pick<
        OfficialFeePaymentAttempt,
        | "status"
        | "responsePayloadRedactedJson"
        | "errorCode"
        | "errorMessage"
        | "officialReceiptNumber"
        | "officialReceiptUrl"
        | "screenshotUrl"
        | "finishedAt"
      >
    >,
  ): Promise<OfficialFeePaymentAttempt> {
    const { data, error } = await getSupabaseClient()
      .from("official_fee_payment_attempts")
      .update({
        status: patch.status,
        response_payload_redacted_json: patch.responsePayloadRedactedJson,
        error_code: patch.errorCode,
        error_message: patch.errorMessage,
        official_receipt_number: patch.officialReceiptNumber,
        official_receipt_url: patch.officialReceiptUrl,
        screenshot_url: patch.screenshotUrl,
        finished_at: patch.finishedAt,
      })
      .eq("id", attemptId)
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "official fee attempt update failed");
    return mapAttempt(data as SupabaseObject);
  }

  async insertReceipt(input: OfficialFeeReceiptInput): Promise<OfficialFeeReceipt> {
    const { data, error } = await getSupabaseClient()
      .from("official_fee_receipts")
      .insert({
        application_id: input.applicationId,
        user_id: input.userId,
        official_fee_payment_intent_id: input.officialFeePaymentIntentId,
        country_code: input.countryCode,
        receipt_number: input.receiptNumber,
        receipt_url: input.receiptUrl,
        receipt_file_url: input.receiptFileUrl,
        amount: input.amount,
        currency: input.currency,
        paid_at: input.paidAt,
        source: input.source,
        raw_receipt_redacted_json: input.rawReceiptRedactedJson,
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "official fee receipt insert failed");
    return mapReceipt(data as SupabaseObject);
  }

  async getReceiptByIntent(intentId: string): Promise<OfficialFeeReceipt | null> {
    const { data, error } = await getSupabaseClient()
      .from("official_fee_receipts")
      .select("*")
      .eq("official_fee_payment_intent_id", intentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapReceipt(data as SupabaseObject) : null;
  }

  async getPaidUserPayment(applicationId: string): Promise<UserPaymentEvidence | null> {
    const { data: paymentRecord, error: paymentError } = await getSupabaseClient()
      .from("payment_records")
      .select("id, amount_cents, currency, status, fee_type, paid_at, updated_at")
      .eq("application_id", applicationId)
      .in("status", READY_PAYMENT_STATUSES)
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (paymentError) throw new Error(paymentError.message);
    if (paymentRecord) {
      const row = paymentRecord as SupabaseObject;
      return {
        id: requiredString(row.id),
        amount: amountFromCents(parseNumber(row.amount_cents)),
        currency: requiredString(row.currency),
        status: requiredString(row.status),
        feeType: requiredString(row.fee_type),
        source: "payment_records",
      };
    }

    const { data: order, error: orderError } = await getSupabaseClient()
      .from("order")
      .select("id, status, govt_fee_cents, currency, paid_at, updated_at")
      .eq("application_id", applicationId)
      .in("status", READY_PAYMENT_STATUSES)
      .gt("govt_fee_cents", 0)
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (orderError || !order) return null;
    const row = order as SupabaseObject;
    return {
      id: requiredString(row.id),
      amount: amountFromCents(parseNumber(row.govt_fee_cents)),
      currency: requiredString(row.currency),
      status: requiredString(row.status),
      feeType: "official_fee_deposit",
      source: "order",
    };
  }

  async selectPaymentInstrument(input: {
    countryCode: string;
    amount: number;
    currency: string;
    provider: string;
  }): Promise<PaymentInstrumentRecord | null> {
    const { data, error } = await getSupabaseClient()
      .from("payment_instruments")
      .select(
        "id, provider, instrument_type, status, currency, spending_limit_amount, spending_limit_currency, allowed_country_codes",
      )
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(25);

    if (error) throw new Error(error.message);

    for (const row of (data ?? []) as SupabaseObject[]) {
      const allowedCountries = Array.isArray(row.allowed_country_codes)
        ? row.allowed_country_codes.filter((country): country is string => typeof country === "string")
        : [];
      const currency = nullableString(row.currency);
      const limitCurrency = nullableString(row.spending_limit_currency);
      const limitAmount = nullableNumber(row.spending_limit_amount);

      if (allowedCountries.length > 0 && !allowedCountries.includes(input.countryCode)) continue;
      if (currency && currency !== input.currency) continue;
      if (limitCurrency && limitCurrency !== input.currency) continue;
      if (limitAmount !== null && limitAmount < input.amount) continue;

      return {
        paymentInstrumentId: requiredString(row.id),
        paymentMethodType: requiredString(row.instrument_type),
        provider: requiredString(row.provider, input.provider),
        instrumentType: requiredString(row.instrument_type),
        status: requiredString(row.status),
        currency,
        spendingLimitAmount: limitAmount,
        spendingLimitCurrency: limitCurrency,
      };
    }

    return null;
  }

  async insertReconciliationEntry(
    input: InsertReconciliationEntryInput,
  ): Promise<OfficialFeeReconciliationEntry> {
    const now = new Date().toISOString();
    const { data, error } = await getSupabaseClient()
      .from("official_fee_reconciliation_entries")
      .insert({
        application_id: input.applicationId,
        user_id: input.userId,
        official_fee_payment_intent_id: input.officialFeePaymentIntentId,
        user_payment_id: input.userPaymentId,
        official_fee_amount: input.officialFeeAmount,
        official_fee_currency: input.officialFeeCurrency,
        user_collected_amount: input.userCollectedAmount,
        user_collected_currency: input.userCollectedCurrency,
        fx_rate: input.fxRate,
        balance_delta: input.balanceDelta,
        reconciliation_status: input.reconciliationStatus,
        notes: input.notes,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "official fee reconciliation insert failed");
    return mapReconciliation(data as SupabaseObject);
  }

  async getReconciliationByIntent(
    intentId: string,
  ): Promise<OfficialFeeReconciliationEntry | null> {
    const { data, error } = await getSupabaseClient()
      .from("official_fee_reconciliation_entries")
      .select("*")
      .eq("official_fee_payment_intent_id", intentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapReconciliation(data as SupabaseObject) : null;
  }

  async updateApplicationOfficialFeeState(
    applicationId: string,
    patch: {
      officialFeeStatus?: string;
      officialFeeQuoteId?: string | null;
      officialFeePaymentIntentId?: string | null;
      officialFeeReceiptId?: string | null;
      officialFeeReconciliationStatus?: string | null;
    },
  ): Promise<void> {
    const { error } = await getSupabaseClient()
      .from("applications")
      .update({
        official_fee_status: patch.officialFeeStatus,
        official_fee_quote_id: patch.officialFeeQuoteId,
        official_fee_payment_intent_id: patch.officialFeePaymentIntentId,
        official_fee_receipt_id: patch.officialFeeReceiptId,
        official_fee_reconciliation_status: patch.officialFeeReconciliationStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicationId);

    if (error) throw new Error(error.message);
  }

  async addApplicationEvent(input: OfficialFeeAuditEventInput): Promise<void> {
    const { error } = await getSupabaseClient()
      .from("application_events")
      .upsert(
        {
          application_id: input.applicationId,
          applicant_id: input.applicantId,
          auth_user_id: input.userId,
          event_type: input.eventType,
          actor_type: input.actorType,
          actor_id: input.actorId,
          source: "official_fee",
          visibility: "staff",
          idempotency_key: input.idempotencyKey,
          message: input.message,
          metadata: input.metadata,
          occurred_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
        { onConflict: "idempotency_key", ignoreDuplicates: true },
      );

    if (error && !error.message.toLowerCase().includes("duplicate")) {
      throw new Error(error.message);
    }
  }
}

function amountFromCents(cents: number): number {
  return Math.round(cents) / 100;
}
