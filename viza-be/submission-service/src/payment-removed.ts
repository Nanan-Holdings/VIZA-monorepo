/** Product policy, not an environment-controlled feature flag. */
export const PAYMENT_REMOVED = "payment_removed";

export function rejectRemovedPayment(): never {
  const error = new Error("payment_removed: automated payments and payment cards have been removed; the official fee checkpoint needs attention.");
  error.name = "PaymentRemovedError";
  throw error;
}
