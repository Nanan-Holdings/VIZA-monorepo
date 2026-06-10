"use server";

import { withAdmin } from "@/lib/auth/with-admin";
import { pricingFor } from "@/lib/pricing";
import { createCheckoutSession } from "@/lib/stripe/client";

/**
 * Pre-authentication guest card checkout (Stripe Checkout).
 *
 * The card sibling of `wechat-checkout.ts`: the marketing funnel links an
 * unauthenticated visitor here with `?country=&visa=&locale=`; they enter
 * email + name; we upsert an applicant profile, stand up a draft
 * application + a pending `order` (guest_checkout=true), then mint a
 * Stripe Checkout session carrying `metadata.order_id` + the guest marker.
 *
 * On payment the guest branch of `/api/stripe/webhook` flips the order to
 * paid and runs the shared post-paid side-effects (account provisioning +
 * magic-link mail). The visitor never has an account before paying.
 */

export interface StartCardCheckoutInput {
  country: string;
  visaType: string;
  email: string;
  fullName: string;
  /** Marketing-side locale; persisted on the profile for the magic-link mail. */
  locale: "en" | "zh-CN";
}

export interface StartCardCheckoutOutput {
  orderId: string;
  url: string;
  amountCents: number;
  currency: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Zero-decimal currencies take whole units, not minor units; our pricing
// config stores cents-equivalent, so divide back. Mirrors payments.ts.
const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "TWD", "CLP", "ISK"]);
function stripeAmount(amountCents: number, currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase())
    ? Math.round(amountCents / 100)
    : amountCents;
}

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.haggstorm.com"
  ).replace(/\/+$/, "");
}

export async function startCardCheckout(
  input: StartCardCheckoutInput,
): Promise<StartCardCheckoutOutput> {
  const email = input.email.toLowerCase().trim();
  if (!EMAIL_RE.test(email)) throw new Error("Invalid email");
  const fullName = input.fullName.trim();
  if (!fullName) throw new Error("Name required");

  const pricing = pricingFor(input.country, input.visaType);
  if (!pricing) {
    throw new Error(
      `No pricing for package ${input.country}/${input.visaType}`,
    );
  }
  const passthroughGovt =
    pricing.govtFeeChannel === "viza_passthrough" ? pricing.govtFeeCents : 0;
  const totalCents = pricing.agencyFeeCents + passthroughGovt;

  return withAdmin("system", "actions/card-checkout:start", async (admin) => {
    // 1. Upsert applicant profile by email. auth_user_id stays null —
    //    populated after payment by provisionAccountAndMagicLink.
    const { data: existingProfile } = await admin
      .from("applicant_profiles")
      .select("id, full_name")
      .eq("email", email)
      .maybeSingle();

    let applicantId: string;
    if (existingProfile) {
      applicantId = existingProfile.id as string;
      await admin
        .from("applicant_profiles")
        .update({
          full_name: existingProfile.full_name ?? fullName,
          language_pref: input.locale === "zh-CN" ? "zh-CN" : "en",
          updated_at: new Date().toISOString(),
        })
        .eq("id", applicantId);
    } else {
      const { data: ins, error: insErr } = await admin
        .from("applicant_profiles")
        .insert({
          email,
          full_name: fullName,
          language_pref: input.locale === "zh-CN" ? "zh-CN" : "en",
        })
        .select("id")
        .single();
      if (insErr || !ins) throw new Error(`profile insert: ${insErr?.message}`);
      applicantId = ins.id as string;
    }

    // 2. Ensure a draft application for this (applicant, country, visa).
    const { data: existingApp } = await admin
      .from("applications")
      .select("id")
      .eq("applicant_id", applicantId)
      .eq("country", input.country)
      .eq("visa_type", input.visaType)
      .in("status", ["draft", "pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let applicationId: string;
    if (existingApp) {
      applicationId = existingApp.id as string;
    } else {
      const { data: appIns, error: appErr } = await admin
        .from("applications")
        .insert({
          applicant_id: applicantId,
          country: input.country,
          visa_type: input.visaType,
          status: "draft",
        })
        .select("id")
        .single();
      if (appErr || !appIns) {
        throw new Error(`application insert: ${appErr?.message}`);
      }
      applicationId = appIns.id as string;
    }

    // 3. Reuse an open order for this application, else create one.
    const { data: openOrder } = await admin
      .from("order")
      .select("id")
      .eq("application_id", applicationId)
      .in("status", ["draft", "pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let orderId: string;
    if (openOrder?.id) {
      orderId = openOrder.id as string;
    } else {
      const { data: orderIns, error: orderErr } = await admin
        .from("order")
        .insert({
          application_id: applicationId,
          applicant_id: applicantId,
          agency_fee_cents: pricing.agencyFeeCents,
          govt_fee_cents: pricing.govtFeeCents,
          currency: pricing.currency,
          status: "pending",
          guest_checkout: true,
        })
        .select("id")
        .single();
      if (orderErr || !orderIns) {
        throw new Error(`order insert: ${orderErr?.message}`);
      }
      orderId = orderIns.id as string;

      const lines = [
        {
          order_id: orderId,
          kind: "agency",
          amount_cents: pricing.agencyFeeCents,
          currency: pricing.currency,
          payee: "VIZA",
          description: `Agency fee — ${input.country}/${input.visaType}`,
        },
      ];
      if (passthroughGovt > 0) {
        lines.push({
          order_id: orderId,
          kind: "govt",
          amount_cents: pricing.govtFeeCents,
          currency: pricing.currency,
          payee: input.country,
          description: `Government fee pass-through — ${input.country}`,
        });
      }
      const { error: lineErr } = await admin.from("order_line").insert(lines);
      if (lineErr) throw new Error(`order_line insert: ${lineErr.message}`);
    }

    // 4. Mint the Stripe Checkout session. success → check-your-email;
    //    cancel → back to the guest checkout page.
    const origin = siteUrl();
    const session = await createCheckoutSession({
      amountCents: stripeAmount(totalCents, pricing.currency),
      currency: pricing.currency,
      productName: `VIZA — ${input.country}/${input.visaType}`,
      applicationId,
      orderId,
      customerEmail: email,
      guestCheckout: true,
      successUrl: `${origin}/checkout/card/check-your-email?locale=${input.locale}`,
      cancelUrl: `${origin}/checkout/card?country=${encodeURIComponent(
        input.country,
      )}&visa=${encodeURIComponent(input.visaType)}&locale=${input.locale}`,
    });

    await admin
      .from("order")
      .update({
        stripe_checkout_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    return {
      orderId,
      url: session.url,
      amountCents: totalCents,
      currency: pricing.currency,
    };
  });
}
