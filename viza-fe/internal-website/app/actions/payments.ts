"use server";

import { paymentRemovedError } from "./payment-removed";

/** Legacy output shape retained while callers migrate away from checkout. */
export interface CheckoutOutput {
  url: string;
  orderId: string | null;
  amountCents: number;
  currency: string;
  decision: unknown;
}

/**
 * Application checkout is retired. This action deliberately performs no
 * authentication, database, entitlement, or provider work before failing.
 */
export async function startCheckoutForApplication(
  _applicationId: string,
  _requestedReturnTo?: string,
): Promise<CheckoutOutput> {
  throw paymentRemovedError("startCheckoutForApplication");
}

/**
 * The former submission queue payment gate is retired with checkout. Keep the
 * export until all queue callers are removed so it cannot accidentally permit
 * a submission based on stale payment state.
 */
export async function applicationIsPaidFor(
  _applicationId: string,
): Promise<boolean> {
  throw paymentRemovedError("applicationIsPaidFor");
}
