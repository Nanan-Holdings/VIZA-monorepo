export const PAYMENT_REMOVED_CODE = "PAYMENT_REMOVED";
export const PAYMENT_REMOVED_MESSAGE = "Payment processing has been removed.";

/**
 * Stable error for retired payment server actions. Callers can distinguish a
 * deliberate retirement from a provider outage without seeing credentials or
 * provider payloads.
 */
export function paymentRemovedError(action: string): Error {
  const error = new Error(`${PAYMENT_REMOVED_CODE}: ${PAYMENT_REMOVED_MESSAGE}`);
  error.name = `${PAYMENT_REMOVED_CODE}:${action}`;
  return error;
}
