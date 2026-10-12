"use server";

import { paymentRemovedError } from "./payment-removed";

/** Legacy guest WeChat checkout input retained for stale callers. */
export interface StartWechatCheckoutInput {
  country: string;
  visaType: string;
  email: string;
  fullName: string;
  locale: "en" | "zh-CN";
  prefill?: string;
}

export interface StartWechatCheckoutOutput {
  orderId: string;
  codeUrl: string;
  amountFen: number;
  redirectUrl?: string;
}

/**
 * WeChat collection is retired. Fail before any validation, database write,
 * QR generation, or provider call.
 */
export async function startWechatCheckout(
  _input: StartWechatCheckoutInput,
): Promise<StartWechatCheckoutOutput> {
  throw paymentRemovedError("startWechatCheckout");
}
