const TERMINAL_NON_PAYABLE_ORDER_STATUSES = new Set([
  "refunded",
  "disputed",
  "cancelled",
  "canceled",
]);

export function isPayableOrderStatus(status: string | null | undefined): boolean {
  return Boolean(status) && !TERMINAL_NON_PAYABLE_ORDER_STATUSES.has(status as string);
}
