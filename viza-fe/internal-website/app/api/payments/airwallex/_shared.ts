import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { createPaymentIntent, normalizeAirwallexStatus, retrievePaymentIntent } from "@/lib/airwallex/client";
import { getCommercialAuthenticatedUser } from "@/lib/payments/commercial-session";
import { awardPurchasePointsForPayment } from "@/lib/rewards/purchase-points";
import { createAdminClient } from "@/lib/supabase/admin";

type JsonObject = Record<string, unknown>;

export interface AirwallexPaymentRecord {
  id: string;
  application_id: string | null;
  auth_user_id: string | null;
  provider: string;
  provider_session_id: string | null;
  provider_payment_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  fee_type: string;
  metadata: JsonObject | null;
  paid_at: string | null;
}

export async function getAppBaseUrl(): Promise<string> {
  const configuredUrl = (process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL)?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/+$/, "");

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  if (origin) return origin.replace(/\/+$/, "");

  const host = requestHeaders.get("host");
  if (!host) throw new Error("Application URL is not available.");
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`.replace(/\/+$/, "");
}

export async function getAuthorizedAirwallexRecord(paymentId: string): Promise<AirwallexPaymentRecord | null> {
  const user = await getCommercialAuthenticatedUser();
  if (!user) return null;

  const { data, error } = await createAdminClient()
    .from("payment_records")
    .select(
      "id, application_id, auth_user_id, provider, provider_session_id, provider_payment_id, amount_cents, currency, status, fee_type, metadata, paid_at",
    )
    .eq("id", paymentId)
    .eq("auth_user_id", user.id)
    .eq("provider", "airwallex")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as AirwallexPaymentRecord | null;
}

function mergeMetadata(existing: unknown, next: JsonObject): JsonObject {
  const base = existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {};
  return {
    ...(base as JsonObject),
    airwallex: {
      ...((base as { airwallex?: JsonObject }).airwallex ?? {}),
      ...next,
    },
  };
}

export async function ensureAirwallexIntent(record: AirwallexPaymentRecord) {
  if (record.provider_session_id) return retrievePaymentIntent(record.provider_session_id);

  const appBaseUrl = await getAppBaseUrl();
  const returnUrl = new URL("/payments/result", appBaseUrl);
  returnUrl.searchParams.set("paymentId", record.id);

  const intent = await createPaymentIntent({
    amountFen: record.amount_cents,
    currency: "CNY",
    merchantOrderId: record.id,
    requestId: `viza-${record.id}`.slice(0, 64),
    returnUrl: returnUrl.toString(),
    metadata: {
      payment_record_id: record.id,
      fee_type: record.fee_type,
    },
  });

  const { error } = await createAdminClient()
    .from("payment_records")
    .update({
      provider_session_id: intent.id,
      provider_payment_id: intent.id,
      status: normalizeAirwallexStatus(intent.status),
      metadata: mergeMetadata(record.metadata, {
        intent_id: intent.id,
        intent_status: intent.status,
        request_id: intent.request_id ?? `viza-${record.id}`,
      }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", record.id);

  if (error) throw new Error(error.message);
  return intent;
}

export async function updateRecordFromAirwallexIntent(recordId: string, intentId: string) {
  const intent = await retrievePaymentIntent(intentId);
  const status = normalizeAirwallexStatus(intent.status);
  const now = new Date().toISOString();
  const paidAt = status === "paid" ? now : null;
  const failedAt = status === "failed" ? now : null;

  const { data: current } = await createAdminClient()
    .from("payment_records")
    .select("metadata, paid_at")
    .eq("id", recordId)
    .maybeSingle();

  const { error } = await createAdminClient()
    .from("payment_records")
    .update({
      provider_session_id: intent.id,
      provider_payment_id: intent.id,
      status,
      paid_at: paidAt ?? current?.paid_at ?? null,
      failed_at: failedAt,
      updated_at: now,
      metadata: mergeMetadata(current?.metadata, {
        intent_id: intent.id,
        intent_status: intent.status,
        next_action: intent.next_action ?? null,
      }),
    })
    .eq("id", recordId);

  if (error) throw new Error(error.message);
  return { intent, status, paidAt: paidAt ?? current?.paid_at ?? null };
}

export async function handleAirwallexPaymentSucceeded(recordId: string, intentId: string): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: record, error } = await admin
    .from("payment_records")
    .select("id, status, application_id, applicant_id, auth_user_id, amount_cents, currency, provider, metadata, paid_at")
    .eq("id", recordId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!record || record.status === "paid") return;

  const { error: updateError } = await admin
    .from("payment_records")
    .update({
      provider_session_id: intentId,
      provider_payment_id: intentId,
      status: "paid",
      paid_at: record.paid_at ?? now,
      updated_at: now,
      metadata: mergeMetadata(record.metadata, {
        intent_id: intentId,
        succeeded_at: now,
      }),
    })
    .eq("id", record.id);

  if (updateError) throw new Error(updateError.message);

  await awardPurchasePointsForPayment({
    paymentRecordId: record.id,
    applicantId: record.applicant_id,
    userId: record.auth_user_id,
    amountCents: record.amount_cents,
    currency: record.currency,
    provider: record.provider,
  });

  if (record.application_id) {
    await admin
      .from("applications")
      .update({ payment_status: "paid", updated_at: now })
      .eq("id", record.application_id);
  }
}

export function safePaymentResponse(record: AirwallexPaymentRecord, intent: Awaited<ReturnType<typeof ensureAirwallexIntent>>) {
  return {
    paymentId: record.id,
    intentId: intent.id,
    clientSecret: intent.client_secret ?? null,
    amountFen: record.amount_cents,
    currency: record.currency,
    status: normalizeAirwallexStatus(intent.status),
    providerStatus: intent.status,
  };
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value);
}

export function syntheticPaymentRecordId(): string {
  return randomUUID();
}
