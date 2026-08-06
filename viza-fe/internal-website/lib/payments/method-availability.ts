import {
  PACKAGE_PRICING,
  pricingFor,
  wechatPricingFor,
} from "@/lib/pricing";

/**
 * Payment-method availability per country (PAYP-004).
 *
 * Card (Stripe) is always available. Wallet availability comes from the
 * package pricing matrix rather than a single country hard-code. Stripe wallet
 * methods still have currency-specific limits, so the Stripe mapping below
 * applies those limits without changing direct WeChat Pay behavior.
 */

/** Stripe currencies documented for WeChat Pay Checkout. */
export const STRIPE_WECHAT_CURRENCIES = new Set([
  "aud",
  "cad",
  "chf",
  "cny",
  "dkk",
  "eur",
  "gbp",
  "hkd",
  "jpy",
  "nok",
  "sek",
  "sgd",
  "usd",
]);

/** Stripe currencies documented for Alipay Checkout. */
export const STRIPE_ALIPAY_CURRENCIES = new Set([
  "aud",
  "cad",
  "cny",
  "eur",
  "gbp",
  "hkd",
  "jpy",
  "myr",
  "nzd",
  "sgd",
  "usd",
]);

/** Countries with a configured CNY total for the direct WeChat Pay rail. */
export const WECHAT_COUNTRIES = new Set<string>(
  PACKAGE_PRICING.filter((packagePricing) => packagePricing.wechatPayTotalFen).map(
    (packagePricing) => packagePricing.country,
  ),
);

/** Countries whose configured package currency supports Stripe Alipay. */
export const ALIPAY_COUNTRIES = new Set<string>(
  PACKAGE_PRICING.filter((packagePricing) =>
    STRIPE_ALIPAY_CURRENCIES.has(packagePricing.currency.toLowerCase()),
  ).map((packagePricing) => packagePricing.country),
);

export interface PaymentMethods {
  card: boolean;
  wechat: boolean;
  alipay: boolean;
}

export type StripeCheckoutPaymentMethod = "card" | "alipay" | "wechat_pay";

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

/** Explicit one-time Stripe Checkout methods for the configured package. */
export function stripeCheckoutPaymentMethodsFor(
  country: string,
  visaType: string,
): StripeCheckoutPaymentMethod[] {
  const available = paymentMethodsFor(country, visaType);
  const currency = pricingFor(country, visaType)?.currency.toLowerCase();
  const alipayAvailable =
    available.alipay &&
    currency !== undefined &&
    STRIPE_ALIPAY_CURRENCIES.has(currency);
  const wechatAvailable =
    available.wechat &&
    currency !== undefined &&
    STRIPE_WECHAT_CURRENCIES.has(currency);

  return [
    "card",
    ...(alipayAvailable ? (["alipay"] as const) : []),
    ...(wechatAvailable ? (["wechat_pay"] as const) : []),
  ];
}
