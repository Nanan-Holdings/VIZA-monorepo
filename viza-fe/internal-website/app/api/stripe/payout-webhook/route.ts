import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordStripePayoutEvent, stripePayoutEventFromStripe } from "@/lib/treasury/reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_EVENTS = new Set([
  "payout.created",
  "payout.updated",
  "payout.paid",
  "payout.failed",
  "payout.canceled",
]);

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_PAYOUT_WEBHOOK_SECRET?.trim();
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

  // This route is intentionally dormant until a separately configured Stripe
  // payout endpoint exists. It never changes payout settings or initiates a
  // payout.
  if (!webhookSecret || !secretKey) {
    return NextResponse.json({ error: "payout webhook not configured" }, { status: 503 });
  }
  if (!signature) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(secretKey);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (!SUPPORTED_EVENTS.has(event.type)) return NextResponse.json({ received: true });
  const payoutEvent = stripePayoutEventFromStripe(event);
  if (!payoutEvent) return NextResponse.json({ received: true });

  try {
    await recordStripePayoutEvent(createAdminClient(), payoutEvent);
  } catch (error) {
    console.error("[stripe-payout-webhook] recording failed:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "recording failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
