import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  return secret;
}

function getPaymentRecordId(metadata: Stripe.Metadata | null | undefined): string | null {
  const value = metadata?.paymentRecordId ?? metadata?.payment_record_id;
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

function statusFromSession(session: Stripe.Checkout.Session): string {
  if (session.mode === "setup") {
    if (session.status === "complete") return "bound";
    if (session.status === "expired") return "expired";
    return "requires_action";
  }
  if (session.payment_status === "paid") return "paid";
  if (session.status === "expired") return "expired";
  return "pending";
}

function metadataPatch(event: Stripe.Event, payload: Record<string, unknown>) {
  return {
    stripe: {
      event_id: event.id,
      event_type: event.type,
      ...payload,
    },
  };
}

async function updatePaymentRecord(params: {
  paymentRecordId: string;
  providerSessionId?: string | null;
  providerPaymentId?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  status: string;
  metadata: Record<string, unknown>;
}) {
  const paid = params.status === "paid";
  const now = new Date().toISOString();
  await createAdminClient()
    .from("payment_records")
    .update({
      provider_session_id: params.providerSessionId ?? undefined,
      provider_payment_id: params.providerPaymentId ?? undefined,
      amount_cents: params.amountCents ?? undefined,
      currency: params.currency?.toUpperCase() ?? undefined,
      status: params.status,
      paid_at: paid ? now : undefined,
      failed_at: ["failed", "expired", "canceled"].includes(params.status) ? now : undefined,
      updated_at: now,
      metadata: params.metadata,
    })
    .eq("id", params.paymentRecordId)
    .eq("provider", "stripe");
}

async function handleCheckoutSession(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  const paymentRecordId = getPaymentRecordId(session.metadata);
  if (!paymentRecordId) return;

  await updatePaymentRecord({
    paymentRecordId,
    providerSessionId: session.id,
    providerPaymentId:
      typeof session.setup_intent === "string"
        ? session.setup_intent
        : typeof session.payment_intent === "string"
        ? session.payment_intent
        : typeof session.subscription === "string"
          ? session.subscription
          : null,
    amountCents: session.amount_total,
    currency: session.currency,
    status: statusFromSession(session),
    metadata: metadataPatch(event, {
      checkout_session_id: session.id,
      setup_intent_id: typeof session.setup_intent === "string" ? session.setup_intent : null,
      payment_status: session.payment_status,
      session_status: session.status,
      session_mode: session.mode,
      subscription_id: typeof session.subscription === "string" ? session.subscription : null,
    }),
  });
}

async function handleInvoice(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  const paymentRecordId = getPaymentRecordId(invoice.metadata);
  if (!paymentRecordId) return;

  await updatePaymentRecord({
    paymentRecordId,
    providerPaymentId: invoice.id,
    amountCents: invoice.amount_paid || invoice.amount_due,
    currency: invoice.currency,
    status: event.type === "invoice.payment_failed" ? "failed" : invoice.status === "paid" ? "paid" : "pending",
    metadata: metadataPatch(event, {
      invoice_id: invoice.id,
      invoice_status: invoice.status,
      hosted_invoice_url: invoice.hosted_invoice_url,
    }),
  });
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(await request.text(), signature, getStripeWebhookSecret());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid Stripe signature." },
      { status: 400 },
    );
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded" ||
      event.type === "checkout.session.async_payment_failed" ||
      event.type === "checkout.session.expired"
    ) {
      await handleCheckoutSession(event);
    }

    if (
      event.type === "invoice.paid" ||
      event.type === "invoice.payment_succeeded" ||
      event.type === "invoice.payment_failed"
    ) {
      await handleInvoice(event);
    }
  } catch (error) {
    console.error(
      `[payments-stripe-webhook] Failed to process ${event.type}:`,
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
