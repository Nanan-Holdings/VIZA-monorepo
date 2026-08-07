import type { SupabaseClient } from "@supabase/supabase-js";

export type ReconciliationFetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface StripePayoutRecord {
  id: string;
  amount: number;
  status: string;
  currency: string;
  arrival_date: number;
  created: number;
  balance_transaction?: string | { id?: string } | null;
  destination?: string | { fingerprint?: string; last4?: string } | null;
}

export interface StripeBalanceTransactionRecord {
  id: string;
  amount: number;
  fee: number;
  net: number;
  currency: string;
  type: string;
  source?: string | { id?: string } | null;
}

interface StripeListResponse<T> {
  data: T[];
  has_more: boolean;
}

export interface TreasuryPayoutInput {
  providerEventId: string;
  eventType: string;
  stripePayoutId: string;
  status: "pending" | "in_transit" | "paid" | "failed" | "canceled";
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

export interface TreasuryExceptionInput {
  exceptionKey: string;
  kind: string;
  severity: "warning" | "critical";
  provider: string | null;
  entityKey: string | null;
  message: string;
  metadataRedacted: Record<string, unknown>;
}

export interface TreasuryThresholdInput {
  now: Date;
  reservedAmount: number;
  reconciledPoolBalance: number | null;
  currency: string;
  unreconciledPayouts: Array<{ id: string; createdAt: string }>;
  failedEvents: Array<{ id: string; provider: string; status: string }>;
  agedAllocations: Array<{ id: string; ageHours: number }>;
  payoutAgeHours: number;
  allocationAgeHours: number;
}

export interface PayoutState {
  status: TreasuryPayoutInput["status"];
  eventCreatedAt: string;
  bankReference: string | null;
}

export function mergePayoutState(current: PayoutState | null, incoming: PayoutState): PayoutState {
  if (!current) return incoming;
  const currentTime = Date.parse(current.eventCreatedAt);
  const incomingTime = Date.parse(incoming.eventCreatedAt);
  if (Number.isFinite(currentTime) && Number.isFinite(incomingTime) && incomingTime < currentTime) return current;
  return {
    status: incoming.status,
    eventCreatedAt: incoming.eventCreatedAt,
    bankReference: incoming.bankReference ?? current.bankReference,
  };
}

function statusFromStripe(value: string): TreasuryPayoutInput["status"] {
  if (value === "in_transit" || value === "paid" || value === "failed" || value === "canceled") return value;
  return "pending";
}

function sourceId(value: StripeBalanceTransactionRecord["source"]): string | null {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

function destinationValue(value: StripePayoutRecord["destination"], key: "fingerprint" | "last4"): string | null {
  if (!value || typeof value === "string") return null;
  return value[key] ?? null;
}

async function listStripeResource<T>(
  resource: string,
  sinceUnix: number,
  fetchImpl: ReconciliationFetch = globalThis.fetch,
): Promise<T[]> {
  const out: T[] = [];
  let startingAfter: string | undefined;
  for (;;) {
    const params = new URLSearchParams({
      limit: "100",
      "created[gte]": String(sinceUnix),
    });
    if (resource === "balance_transactions") params.set("type", "payout");
    if (startingAfter) params.set("starting_after", startingAfter);
    const response = await fetchImpl(`https://api.stripe.com/v1/${resource}?${params}`, {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY ?? ""}` },
    });
    if (!response.ok) throw new Error(`Stripe ${resource} list ${response.status}: ${await response.text()}`);
    const json = (await response.json()) as StripeListResponse<T>;
    out.push(...json.data);
    if (!json.has_more || json.data.length === 0) break;
    const last = json.data[json.data.length - 1];
    const id = last && typeof last === "object" && "id" in last ? String(last.id) : "";
    if (!id) throw new Error(`Stripe ${resource} list returned a page without an id`);
    startingAfter = id;
  }
  return out;
}

export function listStripePayouts(sinceUnix: number, fetchImpl?: ReconciliationFetch): Promise<StripePayoutRecord[]> {
  return listStripeResource<StripePayoutRecord>("payouts", sinceUnix, fetchImpl);
}

export function listStripeBalanceTransactions(
  sinceUnix: number,
  fetchImpl?: ReconciliationFetch,
): Promise<StripeBalanceTransactionRecord[]> {
  return listStripeResource<StripeBalanceTransactionRecord>("balance_transactions", sinceUnix, fetchImpl);
}

export function payoutInputFromStripe(
  payout: StripePayoutRecord,
  balanceTransaction: StripeBalanceTransactionRecord | null,
): TreasuryPayoutInput {
  const amount = Math.max(0, Math.trunc(payout.amount));
  const fee = Math.max(0, Math.trunc(balanceTransaction?.fee ?? 0));
  const net = Math.trunc(balanceTransaction?.net ?? amount - fee);
  return {
    providerEventId: `reconciliation:${payout.id}:${payout.created}`,
    eventType: `reconciliation.${payout.status}`,
    stripePayoutId: payout.id,
    status: statusFromStripe(payout.status),
    amountCents: amount,
    feeCents: fee,
    netCents: net,
    currency: payout.currency.toLowerCase(),
    arrivalAt: Number.isFinite(payout.arrival_date) ? new Date(payout.arrival_date * 1000).toISOString() : null,
    payoutCreatedAt: Number.isFinite(payout.created) ? new Date(payout.created * 1000).toISOString() : null,
    eventCreatedAt: Number.isFinite(payout.created) ? new Date(payout.created * 1000).toISOString() : new Date().toISOString(),
    destinationFingerprint: destinationValue(payout.destination, "fingerprint"),
    destinationLast4: destinationValue(payout.destination, "last4"),
    bankReference: payout.id,
    payloadRedacted: {
      source: "scheduled_reconciliation",
      stripe_payout_id: payout.id,
      status: payout.status,
      amount_cents: amount,
      fee_cents: fee,
      net_cents: net,
      currency: payout.currency.toLowerCase(),
      arrival_at: Number.isFinite(payout.arrival_date) ? new Date(payout.arrival_date * 1000).toISOString() : null,
      balance_transaction_id: sourceId(balanceTransaction?.source ?? null) ?? (typeof payout.balance_transaction === "string" ? payout.balance_transaction : payout.balance_transaction?.id ?? null),
    },
  };
}

export function buildTreasuryExceptions(input: TreasuryThresholdInput): TreasuryExceptionInput[] {
  const exceptions: TreasuryExceptionInput[] = [];
  if (input.reconciledPoolBalance !== null && input.reconciledPoolBalance < input.reservedAmount) {
    exceptions.push({
      exceptionKey: `pool-below-reserved:${input.currency}`,
      kind: "pool_below_reserved",
      severity: "critical",
      provider: "photonpay",
      entityKey: input.currency,
      message: `Reconciled PhotonPay pool ${input.reconciledPoolBalance} is below reserved ${input.reservedAmount} ${input.currency}.`,
      metadataRedacted: {
        currency: input.currency,
        reconciled_pool_balance: input.reconciledPoolBalance,
        reserved_amount: input.reservedAmount,
      },
    });
  }
  for (const event of input.failedEvents) {
    exceptions.push({
      exceptionKey: `failed-provider-event:${event.provider}:${event.id}`,
      kind: "failed_provider_event",
      severity: "critical",
      provider: event.provider,
      entityKey: event.id,
      message: `${event.provider} treasury event ${event.id} is ${event.status}.`,
      metadataRedacted: { provider: event.provider, status: event.status },
    });
  }
  const payoutCutoff = input.now.getTime() - input.payoutAgeHours * 3_600_000;
  for (const payout of input.unreconciledPayouts) {
    if (Date.parse(payout.createdAt) <= payoutCutoff) {
      exceptions.push({
        exceptionKey: `unreconciled-payout:${payout.id}`,
        kind: "unreconciled_payout_age",
        severity: "warning",
        provider: "stripe",
        entityKey: payout.id,
        message: `Stripe payout ${payout.id} has remained unreconciled beyond the SLA.`,
        metadataRedacted: { payout_id: payout.id },
      });
    }
  }
  for (const allocation of input.agedAllocations) {
    if (allocation.ageHours >= input.allocationAgeHours) {
      exceptions.push({
        exceptionKey: `aged-allocation:${allocation.id}`,
        kind: "allocation_age",
        severity: "warning",
        provider: null,
        entityKey: allocation.id,
        message: `Government-fee allocation ${allocation.id} is older than the treasury SLA.`,
        metadataRedacted: { age_hours: allocation.ageHours },
      });
    }
  }
  return exceptions;
}

export async function recordPayoutInputs(
  admin: SupabaseClient,
  payouts: TreasuryPayoutInput[],
): Promise<number> {
  for (const payout of payouts) {
    const { error } = await admin.rpc("record_treasury_payout_event", {
      p_provider_event_id: payout.providerEventId,
      p_event_type: payout.eventType,
      p_stripe_payout_id: payout.stripePayoutId,
      p_status: payout.status,
      p_amount_cents: payout.amountCents,
      p_fee_cents: payout.feeCents,
      p_net_cents: payout.netCents,
      p_currency: payout.currency,
      p_arrival_at: payout.arrivalAt,
      p_payout_created_at: payout.payoutCreatedAt,
      p_event_created_at: payout.eventCreatedAt,
      p_destination_fingerprint: payout.destinationFingerprint,
      p_destination_last4: payout.destinationLast4,
      p_bank_reference: payout.bankReference,
      p_payload_redacted: payout.payloadRedacted,
    });
    if (error) throw new Error(`treasury payout record: ${error.message}`);
  }
  return payouts.length;
}

export async function upsertTreasuryExceptions(
  admin: SupabaseClient,
  exceptions: TreasuryExceptionInput[],
): Promise<number> {
  for (const exception of exceptions) {
    const { error } = await admin.rpc("upsert_treasury_exception", {
      p_exception_key: exception.exceptionKey,
      p_kind: exception.kind,
      p_severity: exception.severity,
      p_provider: exception.provider,
      p_entity_key: exception.entityKey,
      p_message: exception.message,
      p_metadata_redacted: exception.metadataRedacted,
    });
    if (error) throw new Error(`treasury exception record: ${error.message}`);
  }
  return exceptions.length;
}
