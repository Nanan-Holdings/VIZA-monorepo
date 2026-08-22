import { createHash } from "node:crypto";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TreasuryPayoutStatus = "pending" | "in_transit" | "paid" | "failed" | "canceled";
export type TreasuryFundingStatus = "pending" | "confirmed" | "failed" | "reversed";

export interface TreasuryPayoutEvent {
  providerEventId: string;
  eventType: string;
  stripePayoutId: string;
  status: TreasuryPayoutStatus;
  amountCents: number;
  feeCents: number;
  netCents: number;
  currency: string;
  arrivalAt: string | null;
  payoutCreatedAt: string | null;
  eventCreatedAt: string;
  destinationFingerprint: string | null;
  destinationLast4: string | null;
  bankReference: string | null;
  payloadRedacted: Record<string, unknown>;
}

export interface TreasuryFundingEvent {
  providerEventId: string;
  eventType: string;
  providerTransactionId: string | null;
  fundingAccountId: string | null;
  status: TreasuryFundingStatus;
  amount: number;
  currency: string;
  sourceStripePayoutId: string | null;
  bankReference: string | null;
  balanceAfter: number | null;
  confirmedAt: string | null;
  eventCreatedAt: string;
  payloadRedacted: Record<string, unknown>;
}

export interface PayoutState {
  status: TreasuryPayoutStatus;
  eventCreatedAt: string;
  bankReference: string | null;
  payloadRedacted: Record<string, unknown>;
}

export function mergePayoutState(current: PayoutState | null, incoming: PayoutState): PayoutState {
  if (!current) return incoming;
  const incomingTime = Date.parse(incoming.eventCreatedAt);
  const currentTime = Date.parse(current.eventCreatedAt);
  if (Number.isFinite(currentTime) && Number.isFinite(incomingTime) && incomingTime < currentTime) {
    return current;
  }
  return {
    status: incoming.status,
    eventCreatedAt: incoming.eventCreatedAt,
    bankReference: incoming.bankReference ?? current.bankReference,
    payloadRedacted: incoming.payloadRedacted,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown, fallback = 0): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function isoFromUnix(value: unknown): string | null {
  const seconds = numberValue(value, NaN);
  return Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : null;
}

function payoutStatus(value: unknown): TreasuryPayoutStatus {
  switch (value) {
    case "in_transit":
      return "in_transit";
    case "paid":
      return "paid";
    case "failed":
      return "failed";
    case "canceled":
      return "canceled";
    default:
      return "pending";
  }
}

function fundingStatus(value: unknown): TreasuryFundingStatus {
  const text = String(value ?? "").toLowerCase();
  if (/(success|succeed|confirm|complete|paid)/.test(text)) return "confirmed";
  if (/(fail|reject|declin)/.test(text)) return "failed";
  if (/(reverse|refund|cancel)/.test(text)) return "reversed";
  return "pending";
}

function firstValue(sources: Record<string, unknown>[], keys: string[]): unknown {
  for (const source of sources) {
    for (const key of keys) {
      if (source[key] !== undefined && source[key] !== null && source[key] !== "") return source[key];
    }
  }
  return null;
}

function redactFundingPayload(sources: Record<string, unknown>[], event: TreasuryFundingEvent): Record<string, unknown> {
  return {
    provider_event_id: event.providerEventId,
    event_type: event.eventType,
    provider_transaction_id: event.providerTransactionId,
    funding_account_id: event.fundingAccountId,
    status: event.status,
    amount: event.amount,
    currency: event.currency,
    source_stripe_payout_id: event.sourceStripePayoutId,
    bank_reference: event.bankReference,
    balance_after: event.balanceAfter,
    source_status: firstValue(sources, ["status", "state", "code"]),
  };
}

export function stripePayoutEventFromStripe(event: Stripe.Event): TreasuryPayoutEvent | null {
  if (!event.type.startsWith("payout.")) return null;
  const payout = event.data.object as Stripe.Payout;
  const destination = asRecord(payout.destination);
  const payoutId = stringValue(payout.id);
  if (!payoutId) return null;

  const payoutEvent: TreasuryPayoutEvent = {
    providerEventId: event.id,
    eventType: event.type,
    stripePayoutId: payoutId,
    status: payoutStatus(payout.status),
    amountCents: Math.max(0, Math.trunc(numberValue(payout.amount))),
    feeCents: 0,
    netCents: Math.trunc(numberValue(payout.amount)),
    currency: String(payout.currency ?? "").toLowerCase(),
    arrivalAt: isoFromUnix(payout.arrival_date),
    payoutCreatedAt: isoFromUnix(payout.created),
    eventCreatedAt: new Date(event.created * 1000).toISOString(),
    destinationFingerprint: stringValue(destination.fingerprint),
    destinationLast4: stringValue(destination.last4),
    bankReference: stringValue(payout.id),
    payloadRedacted: {},
  };
  payoutEvent.payloadRedacted = {
    provider_event_id: payoutEvent.providerEventId,
    event_type: payoutEvent.eventType,
    stripe_payout_id: payoutEvent.stripePayoutId,
    status: payoutEvent.status,
    amount_cents: payoutEvent.amountCents,
    currency: payoutEvent.currency,
    arrival_at: payoutEvent.arrivalAt,
    destination_last4: payoutEvent.destinationLast4,
  };
  return payoutEvent;
}

export function parsePhotonPayFundingEvent(rawBody: string, payload: unknown): TreasuryFundingEvent {
  const root = asRecord(payload);
  const nested = [asRecord(root.data), asRecord(root.result), asRecord(root.payload)];
  const sources = [root, ...nested];
  const hash = createHash("sha256").update(rawBody, "utf8").digest("hex");
  const providerEventId = String(firstValue(sources, ["eventId", "event_id", "notificationId", "requestId", "id"]) ?? hash);
  const providerTransactionId = stringValue(firstValue(sources, ["transactionId", "transaction_id", "tradeNo", "trade_no", "流水号"]));
  const statusRaw = firstValue(sources, ["status", "state", "result", "code"]);
  const confirmed = fundingStatus(statusRaw) === "confirmed";
  const eventCreatedAtValue = firstValue(sources, ["eventCreatedAt", "event_created_at", "createdAt", "created_at", "timestamp"]);
  const eventCreatedAt = typeof eventCreatedAtValue === "string"
    ? new Date(eventCreatedAtValue).toISOString()
    : isoFromUnix(eventCreatedAtValue) ?? new Date().toISOString();
  const event: TreasuryFundingEvent = {
    providerEventId,
    eventType: String(firstValue(sources, ["eventType", "event_type", "topic", "type"]) ?? "funding.updated"),
    providerTransactionId,
    fundingAccountId: stringValue(firstValue(sources, ["fundingAccountId", "funding_account_id", "accountId", "account_id"])),
    status: fundingStatus(statusRaw),
    amount: numberValue(firstValue(sources, ["amount", "amountValue", "amount_value", "arrivalAmount"])),
    currency: String(firstValue(sources, ["currency", "currencyCode", "currency_code"]) ?? "USD").toUpperCase(),
    sourceStripePayoutId: stringValue(firstValue(sources, ["stripePayoutId", "stripe_payout_id", "payoutId", "payout_id"])),
    bankReference: stringValue(firstValue(sources, ["bankReference", "bank_reference", "reference", "memo"])),
    balanceAfter: firstValue(sources, ["balanceAfter", "balance_after", "availableBalance", "available_balance"]) === null
      ? null
      : numberValue(firstValue(sources, ["balanceAfter", "balance_after", "availableBalance", "available_balance"]), NaN),
    confirmedAt: confirmed ? eventCreatedAt : null,
    eventCreatedAt,
    payloadRedacted: {},
  };
  event.payloadRedacted = redactFundingPayload(sources, event);
  return event;
}

export async function recordStripePayoutEvent(
  admin: SupabaseClient,
  event: TreasuryPayoutEvent,
): Promise<{ payoutRowId: string; replayed: boolean }> {
  const { data, error } = await admin.rpc("record_treasury_payout_event", {
    p_provider_event_id: event.providerEventId,
    p_event_type: event.eventType,
    p_stripe_payout_id: event.stripePayoutId,
    p_status: event.status,
    p_amount_cents: event.amountCents,
    p_fee_cents: event.feeCents,
    p_net_cents: event.netCents,
    p_currency: event.currency,
    p_arrival_at: event.arrivalAt,
    p_payout_created_at: event.payoutCreatedAt,
    p_event_created_at: event.eventCreatedAt,
    p_destination_fingerprint: event.destinationFingerprint,
    p_destination_last4: event.destinationLast4,
    p_bank_reference: event.bankReference,
    p_payload_redacted: event.payloadRedacted,
  });
  if (error) throw new Error(`treasury payout record: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object" || !("payout_row_id" in row)) throw new Error("treasury payout record returned no row");
  const result = row as { payout_row_id: string; event_replayed: boolean };
  return { payoutRowId: result.payout_row_id, replayed: Boolean(result.event_replayed) };
}

export async function recordPhotonPayFundingEvent(
  admin: SupabaseClient,
  event: TreasuryFundingEvent,
): Promise<{ fundingEventRowId: string; replayed: boolean }> {
  const { data, error } = await admin.rpc("record_treasury_funding_event", {
    p_provider: "photonpay",
    p_provider_event_id: event.providerEventId,
    p_event_type: event.eventType,
    p_provider_transaction_id: event.providerTransactionId,
    p_funding_account_id: event.fundingAccountId,
    p_status: event.status,
    p_amount: event.amount,
    p_currency: event.currency,
    p_source_stripe_payout_id: event.sourceStripePayoutId,
    p_bank_reference: event.bankReference,
    p_balance_after: event.balanceAfter,
    p_confirmed_at: event.confirmedAt,
    p_event_created_at: event.eventCreatedAt,
    p_payload_redacted: event.payloadRedacted,
  });
  if (error) throw new Error(`treasury funding record: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object" || !("funding_event_row_id" in row)) throw new Error("treasury funding record returned no row");
  const result = row as { funding_event_row_id: string; event_replayed: boolean };
  return { fundingEventRowId: result.funding_event_row_id, replayed: Boolean(result.event_replayed) };
}
