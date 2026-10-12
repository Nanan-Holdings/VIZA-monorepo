"use server";

import { paymentRemovedError } from "./payment-removed";

/**
 * Legacy guest card checkout input retained for stale callers.
 *
 * Payment collection has been retired. The action intentionally throws before
 * validating input or touching a provider/database, even when payment
 * credentials remain configured in the environment.
 */
export interface StartCardCheckoutInput {
  country: string;
  visaType: string;
  email: string;
  fullName: string;
  locale: "en" | "zh-CN";
  prefill?: string;
}

export interface StartCardCheckoutOutput {
  orderId: string;
  url: string;
  amountCents: number;
  currency: string;
}

export async function startCardCheckout(
  _input: StartCardCheckoutInput,
): Promise<StartCardCheckoutOutput> {
  throw paymentRemovedError("startCardCheckout");
}
