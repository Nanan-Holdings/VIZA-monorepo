"use server";

import { withAdmin } from "@/lib/auth/with-admin";
import { createClient } from "@/lib/supabase/server";
import { createCheckoutSession } from "@/lib/stripe/client";
import { pricingFor } from "@/lib/pricing";

/**
 * Stripe Checkout for the agency fee (PAY-002).
 *
 * Flow:
 *   1. Client calls `startCheckoutForApplication(applicationId)`.
 *   2. We look up the application + per-package pricing, ensure an
 *      `order` row exists, then mint a Stripe Checkout session.
 *   3. Stripe redirects the user back to `success_url`/`cancel_url`.
 *   4. The webhook handler at `/api/stripe/webhook` flips
 *      `order.status` to `paid` on `checkout.session.completed`.
 *   5. The runner enqueue helper checks `order.status === 'paid'`
 *      before submitting the application.
 */

export interface CheckoutOutput {
  url: string;
  orderId: string;
  amountCents: number;
  currency: string;
}

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "TWD", "CLP", "ISK"]);
function stripeAmount(amountCents: number, currency: string): number {
  // Stripe expects minor units except for zero-decimal currencies, where
  // amount is whole units. Our config stores cents-equivalent (i.e.
  // already-minor units); convert back when the destination is zero-decimal.
  return ZERO_DECIMAL.has(currency.toUpperCase())
    ? Math.round(amountCents / 100)
    : amountCents;
}

export async function startCheckoutForApplication(
  applicationId: string,
): Promise<CheckoutOutput> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  return withAdmin("system", "actions/payments:startCheckout", async (admin) => {
    const { data: app, error: appErr } = await admin
      .from("applications")
      .select("id, applicant_id, country, visa_type")
      .eq("id", applicationId)
      .single();
    if (appErr || !app) throw new Error("Application not found");

    const { data: profile } = await admin
      .from("applicant_profiles")
      .select("auth_user_id")
      .eq("id", app.applicant_id)
      .maybeSingle();
    if (!profile || profile.auth_user_id !== user.id) {
      throw new Error("Unauthorized");
    }

    const pricing = pricingFor(app.country, app.visa_type);
    if (!pricing) {
      throw new Error(
        `No pricing for package ${app.country}/${app.visa_type}`,
      );
    }

    // Idempotent order row: reuse an existing draft if present.
    const { data: existing } = await admin
      .from("order")
      .select("id, status, currency, agency_fee_cents, govt_fee_cents")
      .eq("application_id", applicationId)
      .in("status", ["draft", "pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let orderId = existing?.id as string | undefined;
    if (!orderId) {
      const { data: ins, error: insErr } = await admin
        .from("order")
        .insert({
          application_id: applicationId,
          applicant_id: app.applicant_id,
          agency_fee_cents: pricing.agencyFeeCents,
          govt_fee_cents: pricing.govtFeeCents,
          currency: pricing.currency,
          status: "pending",
        })
        .select("id")
        .single();
      if (insErr || !ins) throw new Error(`order insert: ${insErr?.message}`);
      orderId = ins.id as string;

      const lines = [
        {
          order_id: orderId,
          kind: "agency",
          amount_cents: pricing.agencyFeeCents,
          currency: pricing.currency,
          payee: "VIZA",
          description: `Agency fee — ${app.country}/${app.visa_type}`,
        },
      ];
      if (pricing.govtFeeChannel === "viza_passthrough" && pricing.govtFeeCents > 0) {
        lines.push({
          order_id: orderId,
          kind: "govt",
          amount_cents: pricing.govtFeeCents,
          currency: pricing.currency,
          payee: app.country,
          description: `Government fee pass-through — ${app.country}`,
        });
      }
      const { error: lineErr } = await admin.from("order_line").insert(lines);
      if (lineErr) throw new Error(`order_line insert: ${lineErr.message}`);
    }

    const totalForCheckout = pricing.agencyFeeCents +
      (pricing.govtFeeChannel === "viza_passthrough" ? pricing.govtFeeCents : 0);

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.haggstorm.com";
    const session = await createCheckoutSession({
      amountCents: stripeAmount(totalForCheckout, pricing.currency),
      currency: pricing.currency,
      productName: `VIZA — ${app.country}/${app.visa_type}`,
      applicationId: applicationId,
      orderId: orderId,
      customerEmail: user.email ?? undefined,
      successUrl: `${origin}/client/application/${applicationId}?paid=1`,
      cancelUrl: `${origin}/client/application/${applicationId}?paid=0`,
    });

    await admin
      .from("order")
      .update({
        stripe_checkout_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    return {
      url: session.url,
      orderId,
      amountCents: totalForCheckout,
      currency: pricing.currency,
    };
  });
}

/**
 * Runner gate: returns true if the application has a paid order. The
 * submission queue worker calls this before flipping a row to
 * `*_pending`. Keeps the gate in one well-known place.
 */
export async function applicationIsPaidFor(
  applicationId: string,
): Promise<boolean> {
  return withAdmin("system", "actions/payments:isPaidFor", async (admin) => {
    const { data, error } = await admin
      .from("order")
      .select("id, status")
      .eq("application_id", applicationId)
      .in("status", ["paid", "submitted", "completed"])
      .limit(1);
    if (error) throw new Error(`isPaidFor: ${error.message}`);
    return (data ?? []).length > 0;
  });
}
