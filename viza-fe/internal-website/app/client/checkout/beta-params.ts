import { createHash } from "node:crypto";
import type { BetaDeliveryMethod } from "@/lib/checkout/beta-access";

type SearchValue = string | string[] | undefined;

export interface CheckoutBetaParams {
  token: string;
  deliveryMethod: BetaDeliveryMethod | "";
}

function first(value: SearchValue): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/** Stable IDs make concurrent first claims converge on the same ledger rows. */
export function deterministicCheckoutUuid(
  kind: "order" | "payment",
  applicationId: string,
): string {
  const hex = createHash("sha256")
    .update(`viza:client-checkout:${kind}:${applicationId}`)
    .digest("hex")
    .slice(0, 32)
    .split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16] ?? "0", 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

/** Parse only the explicit A/B channel; never guess a channel from a token. */
export function checkoutBetaParams(params: {
  beta?: SearchValue;
  betaToken?: SearchValue;
  betaDeliveryMethod?: SearchValue;
  deliveryMethod?: SearchValue;
}): CheckoutBetaParams {
  const token = first(params.betaToken) || first(params.beta);
  const requestedMethod = first(params.betaDeliveryMethod) || first(params.deliveryMethod);
  const deliveryMethod = requestedMethod === "promo_code" || requestedMethod === "link_suffix"
    ? requestedMethod
    : "";
  return { token: token.slice(0, 128), deliveryMethod };
}
