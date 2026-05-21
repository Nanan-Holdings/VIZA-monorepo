#!/usr/bin/env npx tsx
/**
 * Daily Stripe payout reconciliation (PAY-007).
 *
 * Compares the past 24h of Stripe charges against the internal `order`
 * table (status='paid' AND paid_at within window). Any net delta over
 * USD 5 surfaces as an OPS alert email.
 *
 * Usage (run from a daily cron):
 *   npx tsx viza-be/agent-backend/scripts/reconcile-stripe-payouts.ts
 *
 * Required env:
 *   STRIPE_SECRET_KEY
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   RESEND_API_KEY
 *   RESEND_OPS_ALERT_TO    e.g. ops@haggstorm.com
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const ALERT_THRESHOLD_CENTS = 500; // USD 5

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

async function listStripeCharges(sinceUnix: number): Promise<StripeCharge[]> {
  const out: StripeCharge[] = [];
  let starting_after: string | undefined;
  for (;;) {
    const params = new URLSearchParams({
      limit: "100",
      "created[gte]": String(sinceUnix),
    });
    if (starting_after) params.set("starting_after", starting_after);
    const res = await fetch(`https://api.stripe.com/v1/charges?${params}`, {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
    });
    if (!res.ok) {
      throw new Error(`Stripe charges list ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as StripeListResponse<StripeCharge>;
    out.push(...json.data);
    if (!json.has_more || json.data.length === 0) break;
    starting_after = json.data[json.data.length - 1].id;
  }
  return out;
}

async function fetchInternalNetCents(sinceIso: string): Promise<number> {
  const supabase = createClient(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  );
  const { data, error } = await supabase
    .from("order")
    .select("agency_fee_cents, govt_fee_cents, status, paid_at, refunded_at")
    .gte("created_at", sinceIso);
  if (error) throw new Error(`internal sum: ${error.message}`);
  let net = 0;
  for (const o of data ?? []) {
    const agency = (o.agency_fee_cents as number) ?? 0;
    if (["paid", "submitted", "completed"].includes(o.status as string)) {
      net += agency;
    }
    if (o.status === "refunded") {
      net -= agency;
    }
  }
  return net;
}

async function sendAlert(subject: string, body: string): Promise<void> {
  const to = process.env.RESEND_OPS_ALERT_TO;
  if (!to) {
    console.warn("[reconcile] RESEND_OPS_ALERT_TO not set — skipping alert");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "VIZA OPS <ops@haggstorm.com>",
      to,
      subject,
      text: body,
    }),
  });
  if (!res.ok) {
    console.error(`[reconcile] alert send failed: ${res.status}`);
  }
}

async function main() {
  const since = Math.floor(Date.now() / 1000) - 86_400;
  const sinceIso = new Date(since * 1000).toISOString();

  const charges = await listStripeCharges(since);
  const stripeNetCents = charges
    .filter((c) => c.paid && c.status === "succeeded")
    .reduce((sum, c) => sum + (c.amount - c.amount_refunded), 0);

  const internalNetCents = await fetchInternalNetCents(sinceIso);
  const delta = stripeNetCents - internalNetCents;

  console.log(
    `[reconcile] stripe_net=${stripeNetCents} cents · internal_net=${internalNetCents} cents · delta=${delta} cents`,
  );

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
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(2);
});
