"use server";

import { paymentRemovedError } from "./payment-removed";

export type ReceiptMode = "receipt" | "invoice";

/**
 * Receipt generation is retired with payment records. Keep this callable
 * export during migration, but do not read order data or render a document.
 */
export async function getOrderReceiptPdf(
  _orderId: string,
  _mode: ReceiptMode,
  _invoice?: unknown,
): Promise<{ pdf: Buffer; filename: string }> {
  throw paymentRemovedError("getOrderReceiptPdf");
}

/** Receipt email delivery is retired and performs no outbound request. */
export async function mailReceiptOnPaid(_orderId: string): Promise<void> {
  throw paymentRemovedError("mailReceiptOnPaid");
}
