"use server";

import { headers } from "next/headers";
import { withAdmin } from "@/lib/auth/with-admin";
import {
  applyCheckoutPrefill,
  decodeCheckoutPrefill,
} from "@/lib/checkout/prefill";
import { isFreePackage, pricingFor } from "@/lib/pricing";
import { completeFreeOrder } from "@/lib/checkout/free-order";
import { createCheckoutSession } from "@/lib/stripe/client";
import {
  getPhotonPayClient,
  getPhotonPaySiteId,
  isPhotonPayEnabled,
} from "@/lib/photonpay/client";
import { encodeReqId } from "@/lib/photonpay/reqid";

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
  /** Base64url wizard payload from the marketing /apply funnel (see lib/checkout/prefill.ts). */
  prefill?: string;
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

// PhotonPay expects the ISO 4217 smallest unit — same arithmetic as Stripe's.
function minorUnits(amountCents: number, currency: string): number {
  return stripeAmount(amountCents, currency);
}

// PhotonPay's risk engine rejects empty/loopback/private shopper IPs; fall back
// to a routable placeholder for local dev.
function shopperIpFrom(hdrs: { get(name: string): string | null }): string {
  const xff = (hdrs.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const ip = xff || (hdrs.get("x-real-ip") ?? "").trim();
  if (!ip || /^(::1|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) {
    return "203.0.113.10";
  }
  return ip;
}

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.viza.it.com"
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

    // 3b. Persist wizard prefill (passport OCR, arrival date, tier) —
    //     best-effort, never blocks the payment redirect.
    const prefill = decodeCheckoutPrefill(input.prefill);
    if (prefill) {
      await applyCheckoutPrefill(admin, { applicantId, applicationId }, prefill);
    }

    // 4. Mint the checkout session. success → check-your-email;
    //    cancel → back to the guest checkout page. PhotonPay is used when it is
    //    the configured gateway; otherwise Stripe (kept as a fallback).
    const origin = siteUrl();
    const successUrl = `${origin}/checkout/card/check-your-email?locale=${input.locale}`;
    const cancelUrl = `${origin}/checkout/card?country=${encodeURIComponent(
      input.country,
    )}&visa=${encodeURIComponent(input.visaType)}&locale=${input.locale}`;

    // Free demo package — nothing to collect: mark the order paid and run
    // the post-paid side-effects the webhook would, then send the visitor
    // straight to the check-your-email page.
    if (isFreePackage(pricing)) {
      await completeFreeOrder(admin, orderId);
      return {
        orderId,
        url: successUrl,
        amountCents: 0,
        currency: pricing.currency,
      };
    }

    if (isPhotonPayEnabled()) {
      const photon = getPhotonPayClient();
      const siteId = getPhotonPaySiteId();
      if (!photon || !siteId) {
        throw new Error("PhotonPay is enabled but PHOTONPAY_* env is incomplete");
      }
      const reqId = encodeReqId(orderId, Date.now().toString(36));
      const hdrs = await headers();
      const notifyUrl =
        process.env.PHOTONPAY_NOTIFY_URL ?? `${origin}/api/webhooks/photonpay`;
      const session = await photon.createCashierSession({
        reqId,
        amountMinor: minorUnits(totalCents, pricing.currency),
        currency: pricing.currency,
        siteId,
        goods: [
          {
            name: `VIZA — ${input.country}/${input.visaType}`,
            virtual: true,
            price: (totalCents / 100).toFixed(2),
            quantity: "1",
          },
        ],
        shopper: {
          id: applicantId,
          nickName: fullName,
          platform: "pc",
          shopperIp: shopperIpFrom(hdrs),
          email,
        },
        risk: { fingerprintId: orderId, platform: "pc", retryTimes: "1" },
        notifyUrl,
        redirectUrl: successUrl,
        autoRedirect: true,
      });
      if (!session.payRedirectUrl) {
        throw new Error("PhotonPay did not return a hosted checkout URL");
      }
      await admin
        .from("order")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", orderId);
      return {
        orderId,
        url: session.payRedirectUrl,
        amountCents: totalCents,
        currency: pricing.currency,
      };
    }

    // Default gateway: Stripe Checkout.
    const session = await createCheckoutSession({
      amountCents: stripeAmount(totalCents, pricing.currency),
      currency: pricing.currency,
      productName: `VIZA — ${input.country}/${input.visaType}`,
      applicationId,
      orderId,
      customerEmail: email,
      guestCheckout: true,
      successUrl,
      cancelUrl,
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
