/**
 * Tiny Stripe REST client (PAY-002).
 *
 * Avoids the official `stripe` npm package — we make at most two API
 * calls (checkout.sessions.create + retrieve) and verify webhook
 * signatures with `node:crypto`. Keeps the dep surface small.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const STRIPE_API = "https://api.stripe.com/v1";

function getKey(): string {
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) throw new Error("STRIPE_SECRET_KEY env not set");
  return k;
}

function getWebhookSecret(): string {
  const k = process.env.STRIPE_WEBHOOK_SECRET;
  if (!k) throw new Error("STRIPE_WEBHOOK_SECRET env not set");
  return k;
}

function authHeader(): string {
  return `Bearer ${getKey()}`;
}

type StripeForm = Record<string, string | number | undefined>;

function encodeForm(input: StripeForm): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    sp.set(k, String(v));
  }
  return sp.toString();
}

interface StripeError {
  error?: { message?: string; code?: string };
}

async function postForm<T>(path: string, body: string): Promise<T> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const json = (await res.json()) as T & StripeError;
  if (!res.ok) {
    throw new Error(`Stripe ${path}: ${json.error?.message ?? res.status}`);
  }
  return json;
}

export interface CheckoutSession {
  id: string;
  url: string;
  payment_intent: string | null;
  payment_status: "paid" | "unpaid" | "no_payment_required";
  status: "open" | "complete" | "expired";
  metadata: Record<string, string> | null;
  amount_total: number | null;
  currency: string | null;
  total_details?: {
    amount_tax?: number;
    amount_discount?: number;
    amount_shipping?: number;
  } | null;
  customer_details?: {
    address?: { country?: string } | null;
  } | null;
}

export interface CreateCheckoutInput {
  amountCents: number;
  currency: string;
  productName: string;
  successUrl: string;
  cancelUrl: string;
  applicationId: string;
  orderId: string;
  customerEmail?: string;
}

export interface RefundResult {
  id: string;
  amount: number;
  currency: string;
  status: "pending" | "succeeded" | "failed" | "canceled" | "requires_action";
  payment_intent: string;
  reason: string | null;
}

export interface CreateRefundInput {
  paymentIntentId: string;
  amountCents: number;
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";
  /** Free-form metadata copied to the refund object. */
  metadata?: Record<string, string>;
}

export async function createRefund(
  input: CreateRefundInput,
): Promise<RefundResult> {
  const form: StripeForm = {
    payment_intent: input.paymentIntentId,
    amount: input.amountCents,
  };
  if (input.reason) form.reason = input.reason;
  if (input.metadata) {
    for (const [k, v] of Object.entries(input.metadata)) {
      form[`metadata[${k}]`] = v;
    }
  }
  return postForm<RefundResult>("/refunds", encodeForm(form));
}

export async function createCheckoutSession(
  input: CreateCheckoutInput,
): Promise<CheckoutSession> {
  const form: StripeForm = {
    mode: "payment",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    "line_items[0][price_data][currency]": input.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": input.amountCents,
    "line_items[0][price_data][product_data][name]": input.productName,
    "line_items[0][price_data][tax_behavior]": "exclusive",
    "line_items[0][quantity]": 1,
    // PAY-006: enable Stripe Tax. Stripe geolocates the customer via
    // the billing address it collects during checkout and applies the
    // right rate per jurisdiction. The tax amount lands on
    // `total_details.amount_tax` on the session.
    "automatic_tax[enabled]": "true",
    billing_address_collection: "required",
    "tax_id_collection[enabled]": "true",
    "metadata[order_id]": input.orderId,
    "metadata[application_id]": input.applicationId,
  };
  if (input.customerEmail) {
    form.customer_email = input.customerEmail;
  }
  return postForm<CheckoutSession>("/checkout/sessions", encodeForm(form));
}

/**
 * Verify a Stripe-Signature header per
 * https://docs.stripe.com/webhooks/signatures
 *
 * Returns the parsed JSON body when the signature matches and the
 * timestamp is within `toleranceSeconds` of `now`.
 */
export interface StripeEventBase {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

export class StripeSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeSignatureError";
  }
}

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  toleranceSeconds = 300,
  now: number = Math.floor(Date.now() / 1000),
): StripeEventBase {
  if (!signatureHeader) {
    throw new StripeSignatureError("Missing Stripe-Signature header");
  }
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const idx = p.indexOf("=");
      return idx === -1 ? [p, ""] : [p.slice(0, idx), p.slice(idx + 1)];
    }),
  ) as Record<string, string>;
  const ts = Number.parseInt(parts.t ?? "", 10);
  const sig = parts.v1;
  if (!ts || !sig) {
    throw new StripeSignatureError("Malformed Stripe-Signature header");
  }
  if (Math.abs(now - ts) > toleranceSeconds) {
    throw new StripeSignatureError("Stripe-Signature timestamp outside tolerance");
  }
  const expected = createHmac("sha256", getWebhookSecret())
    .update(`${ts}.${rawBody}`)
    .digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(sig, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new StripeSignatureError("Stripe-Signature mismatch");
  }
  return JSON.parse(rawBody) as StripeEventBase;
}
