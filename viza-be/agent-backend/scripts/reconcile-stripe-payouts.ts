#!/usr/bin/env npx tsx
/**
 * Daily treasury reconciliation.
 *
 * This keeps the original Stripe-charge-to-order control and adds a separate
 * payout/balance-transaction evidence control. It is read-only with respect to
 * Stripe and PhotonPay: it never creates a payout, transfers funds, recharges
 * a card, or issues a card.
 *
 * Required for the Stripe controls:
 *   STRIPE_SECRET_KEY
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   RESEND_API_KEY, RESEND_OPS_ALERT_TO
 *   TREASURY_RESERVED_AMOUNT, TREASURY_POOL_CURRENCY
 *   PHOTONPAY_RECOVERY_URL, PHOTONPAY_RECOVERY_TOKEN
 */

import "dotenv/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildTreasuryExceptions,
  listStripeBalanceTransactions,
  listStripePayouts,
  payoutInputFromStripe,
  recordPayoutInputs,
  upsertTreasuryExceptions,
  type ReconciliationFetch,
  type StripeBalanceTransactionRecord,
  type StripePayoutRecord,
} from "./treasury-reconciliation.js";

const ALERT_THRESHOLD_CENTS = 500;
const DEFAULT_WINDOW_SECONDS = 86_400;

interface StripeCharge {
  id: string;
  amount: number;
  amount_refunded: number;
  currency: string;
  paid: boolean;
  status: string;
  created: number;
}

interface StripeListResponse<T> {
  data: T[];
  has_more: boolean;
}

interface PhotonPayRecoveryEvent {
  providerEventId: string;
  eventType?: string;
  providerTransactionId?: string | null;
  fundingAccountId?: string | null;
  status?: "pending" | "confirmed" | "failed" | "reversed";
  amount?: number;
  currency?: string;
  sourceStripePayoutId?: string | null;
  bankReference?: string | null;
  balanceAfter?: number | null;
  confirmedAt?: string | null;
  eventCreatedAt?: string;
  payloadRedacted?: Record<string, unknown>;
}

async function listStripeCharges(sinceUnix: number, fetchImpl: ReconciliationFetch = globalThis.fetch): Promise<StripeCharge[]> {
  const out: StripeCharge[] = [];
  let startingAfter: string | undefined;
  for (;;) {
    const params = new URLSearchParams({ limit: "100", "created[gte]": String(sinceUnix) });
    if (startingAfter) params.set("starting_after", startingAfter);
    const response = await fetchImpl(`https://api.stripe.com/v1/charges?${params}`, {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY ?? ""}` },
    });
    if (!response.ok) throw new Error(`Stripe charges list ${response.status}: ${await response.text()}`);
    const json = (await response.json()) as StripeListResponse<StripeCharge>;
    out.push(...json.data);
    if (!json.has_more || json.data.length === 0) break;
    startingAfter = json.data[json.data.length - 1].id;
  }
  return out;
}

async function fetchInternalNetCents(admin: SupabaseClient, sinceIso: string): Promise<number> {
  const { data, error } = await admin
    .from("order")
    .select("agency_fee_cents, status, created_at")
    .gte("created_at", sinceIso);
  if (error) throw new Error(`internal order sum: ${error.message}`);
  let net = 0;
  for (const order of data ?? []) {
    const agency = Number(order.agency_fee_cents ?? 0);
    if (["paid", "submitted", "completed"].includes(String(order.status))) net += agency;
    if (order.status === "refunded") net -= agency;
  }
  return net;
}

async function sendAlert(subject: string, body: string): Promise<void> {
  const to = process.env.RESEND_OPS_ALERT_TO;
  const apiKey = process.env.RESEND_API_KEY;
  if (!to || !apiKey) {
    console.warn("[reconcile] alert email not configured — exception remains in Supabase");
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "VIZA OPS <ops@haggstorm.com>",
      to,
      subject,
      text: body,
    }),
  });
  if (!response.ok) console.error(`[reconcile] alert send failed: ${response.status}`);
}

function matchBalanceTransaction(
  payout: StripePayoutRecord,
  transactions: StripeBalanceTransactionRecord[],
): StripeBalanceTransactionRecord | null {
  const balanceTransactionId = typeof payout.balance_transaction === "string"
    ? payout.balance_transaction
    : payout.balance_transaction?.id;
  return transactions.find((transaction) =>
    transaction.id === balanceTransactionId || sourceId(transaction.source) === payout.id,
  ) ?? null;
}

function sourceId(value: StripeBalanceTransactionRecord["source"]): string | null {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

async function loadPhotonPayRecovery(fetchImpl: ReconciliationFetch): Promise<PhotonPayRecoveryEvent[]> {
  const url = process.env.PHOTONPAY_RECOVERY_URL?.trim();
  if (!url) return [];
  const token = process.env.PHOTONPAY_RECOVERY_TOKEN?.trim();
  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) throw new Error(`PhotonPay recovery query ${response.status}: ${await response.text()}`);
  const body = (await response.json()) as unknown;
  if (!Array.isArray(body)) throw new Error("PhotonPay recovery query did not return an array");
  return body.filter((event): event is PhotonPayRecoveryEvent => {
    return Boolean(event && typeof event === "object" && "providerEventId" in event);
  });
}

async function recordPhotonPayRecovery(admin: SupabaseClient, events: PhotonPayRecoveryEvent[]): Promise<number> {
  for (const event of events) {
    const { error } = await admin.rpc("record_treasury_funding_event", {
      p_provider: "photonpay",
      p_provider_event_id: event.providerEventId,
      p_event_type: event.eventType ?? "recovery.funding.updated",
      p_provider_transaction_id: event.providerTransactionId ?? null,
      p_funding_account_id: event.fundingAccountId ?? null,
      p_status: event.status ?? "pending",
      p_amount: event.amount ?? 0,
      p_currency: (event.currency ?? "USD").toUpperCase(),
      p_source_stripe_payout_id: event.sourceStripePayoutId ?? null,
      p_bank_reference: event.bankReference ?? null,
      p_balance_after: event.balanceAfter ?? null,
      p_confirmed_at: event.confirmedAt ?? null,
      p_event_created_at: event.eventCreatedAt ?? new Date().toISOString(),
      p_payload_redacted: event.payloadRedacted ?? { source: "recovery_query", provider_event_id: event.providerEventId },
    });
    if (error) throw new Error(`PhotonPay recovery record: ${error.message}`);
  }
  return events.length;
}

async function loadThresholdData(admin: SupabaseClient, sinceIso: string, now: Date) {
  const currency = (process.env.TREASURY_POOL_CURRENCY ?? "USD").toUpperCase();
  const { data: balances, error: balanceError } = await admin
    .from("treasury_funding_events")
    .select("balance_after, currency, event_created_at")
    .eq("provider", "photonpay")
    .eq("currency", currency)
    .not("balance_after", "is", null)
    .order("event_created_at", { ascending: false })
    .limit(1);
  if (balanceError) throw new Error(`treasury balance lookup: ${balanceError.message}`);

  const { data: payouts, error: payoutError } = await admin
    .from("treasury_payouts")
    .select("id, event_created_at")
    .eq("reconciliation_status", "unreconciled")
    .gte("event_created_at", sinceIso);
  if (payoutError) throw new Error(`treasury payout lookup: ${payoutError.message}`);

  // Allocation rows are intentionally read-only here. Phase 3 owns card issue
  // transitions; this control only reports aged rows already reserved by the
  // commercial/official-fee workflow.
  const { data: allocations, error: allocationError } = await admin
    .from("government_fee_allocations")
    .select("id, reserved_at, state, amount_cents, currency")
    .in("state", ["reserved_pending_treasury", "reserved", "issuable", "card_issued", "portal_processing"]);
  if (allocationError && !/relation .*government_fee_allocations .*does not exist/i.test(allocationError.message)) {
    throw new Error(`treasury allocation lookup: ${allocationError.message}`);
  }

  const failedPayouts = await admin.from("treasury_payouts").select("id, provider, status").in("status", ["failed", "canceled"]);
  if (failedPayouts.error) throw new Error(`treasury failed payout lookup: ${failedPayouts.error.message}`);
  const failedFundingEvents = await admin.from("treasury_funding_events").select("id, provider, status").in("status", ["failed", "reversed"]);
  if (failedFundingEvents.error) throw new Error(`treasury failed funding lookup: ${failedFundingEvents.error.message}`);
  const failedEvents = [
    ...(failedPayouts.data ?? []),
    ...(failedFundingEvents.data ?? []),
  ].map((event) => ({ id: String(event.id), provider: String(event.provider), status: String(event.status) }));

  const configuredReserveFloor = Number(process.env.TREASURY_RESERVED_AMOUNT ?? "0");
  const allocationReserved = (allocations ?? [])
    .filter((allocation) => String(allocation.currency ?? currency).toUpperCase() === currency)
    .reduce((sum, allocation) => sum + Number(allocation.amount_cents ?? 0) / 100, 0);

  return {
    now,
    reservedAmount: Math.max(configuredReserveFloor, allocationReserved),
    reconciledPoolBalance: balances?.[0]?.balance_after === null || balances?.[0]?.balance_after === undefined
      ? null
      : Number(balances[0].balance_after),
    currency,
    unreconciledPayouts: (payouts ?? []).map((payout) => ({ id: String(payout.id), createdAt: String(payout.event_created_at) })),
    failedEvents,
    agedAllocations: (allocations ?? []).map((allocation) => ({
      id: String(allocation.id),
      ageHours: allocation.reserved_at ? (now.getTime() - Date.parse(String(allocation.reserved_at))) / 3_600_000 : 0,
    })),
    payoutAgeHours: Number(process.env.TREASURY_PAYOUT_AGE_HOURS ?? "24"),
    allocationAgeHours: Number(process.env.TREASURY_ALLOCATION_AGE_HOURS ?? "24"),
  };
}

export async function runTreasuryReconciliation(
  admin: SupabaseClient,
  sinceUnix: number,
  fetchImpl: ReconciliationFetch = globalThis.fetch,
): Promise<{ payouts: number; fundingEvents: number; exceptions: number }> {
  const sinceIso = new Date(sinceUnix * 1000).toISOString();
  const payoutRows = await listStripePayouts(sinceUnix, fetchImpl);
  const balanceRows = await listStripeBalanceTransactions(sinceUnix, fetchImpl);
  const payoutInputs = payoutRows.map((payout) => payoutInputFromStripe(payout, matchBalanceTransaction(payout, balanceRows)));
  await recordPayoutInputs(admin, payoutInputs);
  const recoveryEvents = await loadPhotonPayRecovery(fetchImpl);
  await recordPhotonPayRecovery(admin, recoveryEvents);
  const thresholdData = await loadThresholdData(admin, sinceIso, new Date());
  const exceptions = buildTreasuryExceptions(thresholdData);
  await upsertTreasuryExceptions(admin, exceptions);
  return { payouts: payoutInputs.length, fundingEvents: recoveryEvents.length, exceptions: exceptions.length };
}

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is required");
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const sinceUnix = Math.floor(Date.now() / 1000) - DEFAULT_WINDOW_SECONDS;
  const sinceIso = new Date(sinceUnix * 1000).toISOString();
  const run = await admin.from("treasury_reconciliation_runs").insert({
    provider: "stripe+photonpay",
    window_start: sinceIso,
    window_end: new Date().toISOString(),
  }).select("id").single();
  if (run.error || !run.data) throw new Error(`reconciliation run start: ${run.error?.message ?? "no run id"}`);

  try {
    const treasury = await runTreasuryReconciliation(admin, sinceUnix);
    const charges = await listStripeCharges(sinceUnix);
    const stripeNetCents = charges
      .filter((charge) => charge.paid && charge.status === "succeeded")
      .reduce((sum, charge) => sum + charge.amount - charge.amount_refunded, 0);
    const internalNetCents = await fetchInternalNetCents(admin, sinceIso);
    const delta = stripeNetCents - internalNetCents;
    console.log(`[reconcile] payouts=${treasury.payouts} funding_events=${treasury.fundingEvents} exceptions=${treasury.exceptions}`);
    console.log(`[reconcile] charge_control stripe_net=${stripeNetCents} internal_net=${internalNetCents} delta=${delta}`);

    if (Math.abs(delta) > ALERT_THRESHOLD_CENTS) {
      await sendAlert(
        `[VIZA] Stripe ↔ orders reconciliation delta ${delta} cents`,
        `Stripe charges (24h, succeeded - refunded): ${stripeNetCents} cents\n` +
          `Internal orders (24h, paid - refunded): ${internalNetCents} cents\n` +
          `Delta: ${delta} cents (threshold ${ALERT_THRESHOLD_CENTS}).\n\n` +
          `Investigate at /admin/revenue.`,
      );
      process.exitCode = 1;
    }
    const { error } = await admin.from("treasury_reconciliation_runs").update({
      status: "succeeded",
      payout_count: treasury.payouts,
      funding_event_count: treasury.fundingEvents,
      exception_count: treasury.exceptions,
      completed_at: new Date().toISOString(),
    }).eq("id", run.data.id);
    if (error) throw new Error(`reconciliation run complete: ${error.message}`);
  } catch (error) {
    await admin.from("treasury_reconciliation_runs").update({
      status: "failed",
      error_message: String(error instanceof Error ? error.message : error).slice(0, 2000),
      completed_at: new Date().toISOString(),
    }).eq("id", run.data.id);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 2;
  });
}
