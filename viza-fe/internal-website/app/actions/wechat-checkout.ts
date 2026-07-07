"use server";

import { withAdmin } from "@/lib/auth/with-admin";
import {
  applyCheckoutPrefill,
  decodeCheckoutPrefill,
} from "@/lib/checkout/prefill";
import { wechatPricingFor, WechatPayNotSupportedError } from "@/lib/pricing";
import {
  createNativeOrder,
  generateOutTradeNo,
} from "@/lib/wechatpay/client";

/**
 * Pre-authentication WeChat Pay Native checkout (WeChat Pay direct).
 *
 * Called from the unauthenticated `/checkout/wechat` page after the
 * visitor enters their email + name. We upsert an applicant profile,
 * stand up a draft application + a pending order, then ask WeChat Pay
 * for a Native code_url. The visitor scans the QR in their WeChat app;
 * on payment the callback at /api/wechat-pay/notify flips the order to
 * paid and provisions the auth account (see wechat-provisioning.ts).
 */

export interface StartWechatCheckoutInput {
  country: string;
  visaType: string;
  email: string;
  fullName: string;
  /** Marketing-side locale; persisted on the profile for the magic-link mail. */
  locale: "en" | "zh-CN";
  /** Base64url wizard payload from the marketing /apply funnel (see lib/checkout/prefill.ts). */
  prefill?: string;
}

export interface StartWechatCheckoutOutput {
  orderId: string;
  codeUrl: string;
  amountFen: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function startWechatCheckout(
  input: StartWechatCheckoutInput,
): Promise<StartWechatCheckoutOutput> {
  const email = input.email.toLowerCase().trim();
  if (!EMAIL_RE.test(email)) throw new Error("Invalid email");
  const fullName = input.fullName.trim();
  if (!fullName) throw new Error("Name required");

  // Resolve pricing up-front so an unsupported package surfaces before
  // any DB writes.
  let pricingRes;
  try {
    pricingRes = wechatPricingFor(input.country, input.visaType);
  } catch (err) {
    if (err instanceof WechatPayNotSupportedError) {
      throw new Error(err.message);
    }
    throw err;
  }
  const { pricing, totalFen } = pricingRes;

  return withAdmin(
    "system",
    "actions/wechat-checkout:start",
    async (admin) => {
      // 1. Upsert applicant profile by email. auth_user_id is left
      //    null — populated after payment by wechat-provisioning.
      const { data: existingProfile } = await admin
        .from("applicant_profiles")
        .select("id, auth_user_id, full_name, language_pref")
        .eq("email", email)
        .maybeSingle();

      let applicantId: string;
      if (existingProfile) {
        applicantId = existingProfile.id as string;
        // Refresh name + locale on every checkout so the most recent
        // info wins.
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
        if (insErr || !ins) {
          throw new Error(`profile insert: ${insErr?.message}`);
        }
        applicantId = ins.id as string;
      }

      // 2. Ensure a draft application for this (applicant, country, visa).
      const { data: existingApp } = await admin
        .from("applications")
        .select("id, status")
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
      //    WeChat Pay total is always priced in CNY/fen — the line
      //    items still record the USD-equivalent agency/govt fee for
      //    audit, so settlement and bookkeeping stay reconcilable.
      const { data: openOrder } = await admin
        .from("order")
        .select("id, status, wechat_out_trade_no, wechat_prepay_id")
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
            currency: "CNY",
            status: "pending",
            guest_checkout: true,
          })
          .select("id")
          .single();
        if (orderErr || !orderIns) {
          throw new Error(`order insert: ${orderErr?.message}`);
        }
        orderId = orderIns.id as string;

        await admin.from("order_line").insert([
          {
            order_id: orderId,
            kind: "agency",
            amount_cents: totalFen,
            currency: "CNY",
            payee: "VIZA",
            description: `WeChat Pay — ${input.country}/${input.visaType}`,
          },
        ]);
      }

      // 3b. Persist wizard prefill (passport OCR, arrival date, tier) —
      //     best-effort, never blocks the payment redirect.
      const prefill = decodeCheckoutPrefill(input.prefill);
      if (prefill) {
        await applyCheckoutPrefill(
          admin,
          { applicantId, applicationId },
          prefill,
        );
      }

      // 4. Native unifiedorder. out_trade_no is regenerated on every
      //    call so a stale prepay_id never blocks a retry (WeChat
      //    rejects re-use after 2h anyway).
      const outTradeNo = generateOutTradeNo(orderId);
      const { codeUrl } = await createNativeOrder({
        outTradeNo,
        amountFen: totalFen,
        description: `VIZA · ${input.country}/${input.visaType}`,
      });

      await admin
        .from("order")
        .update({
          wechat_out_trade_no: outTradeNo,
          wechat_prepay_id: codeUrl, // store code_url for support; prepay_id isn't returned by Native
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      return { orderId, codeUrl, amountFen: totalFen };
    },
  );
}
