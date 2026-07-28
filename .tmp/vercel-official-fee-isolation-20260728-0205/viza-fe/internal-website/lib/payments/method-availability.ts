import { wechatPricingFor } from "@/lib/pricing";

/**
 * Payment-method availability per country (PAYP-004).
 *
 * Card (Stripe) is always available. WeChat Pay / Alipay are gated by a
 * config set rather than hardcoded to Indonesia — a country is WeChat-eligible
 * when it has a CNY total wired in pricing (`wechatPayTotalFen`) AND appears in
 * WECHAT_COUNTRIES; Alipay by ALIPAY_COUNTRIES. Countries outside the sets fall
 * back to card only.
 */

/** Countries where WeChat Pay Native is offered (Mainland-China merchant, CNY). */
export const WECHAT_COUNTRIES = new Set<string>(["indonesia"]);

/** Countries where Alipay is offered. */
export const ALIPAY_COUNTRIES = new Set<string>(["indonesia"]);

export interface PaymentMethods {
  card: boolean;
  wechat: boolean;
  alipay: boolean;
}

function hasWechatPricing(country: string, visaType: string): boolean {
  try {
    return Boolean(wechatPricingFor(country, visaType));
  } catch {
    return false; // WechatPayNotSupportedError → not eligible
  }
}

export function paymentMethodsFor(country: string, visaType: string): PaymentMethods {
  return {
    card: true,
    wechat: WECHAT_COUNTRIES.has(country) && hasWechatPricing(country, visaType),
    alipay: ALIPAY_COUNTRIES.has(country),
  };
}
