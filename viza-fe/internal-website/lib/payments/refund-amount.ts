export type RefundAmountLine<TKind extends string = string> = {
  kind: TKind;
  amountCents: number;
};

export function applyAgencyDiscountToRefundLines<T extends RefundAmountLine>(
  lines: T[],
  discountCents: number,
): T[] {
  let remainingDiscount = Math.max(0, Math.floor(discountCents));
  return lines.map((line) => {
    if (line.kind !== "agency" || remainingDiscount === 0) return line;
    const applied = Math.min(Math.max(0, line.amountCents), remainingDiscount);
    remainingDiscount -= applied;
    return { ...line, amountCents: Math.max(0, line.amountCents - applied) };
  });
}

export function capRefundToCollectedAmount(requestedMinor: number, metadata: unknown): number {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return requestedMinor;
  const checkout = (metadata as Record<string, unknown>).checkout_payment;
  if (!checkout || typeof checkout !== "object" || Array.isArray(checkout)) return requestedMinor;
  const expected = (checkout as Record<string, unknown>).expected_amount_minor;
  if (typeof expected !== "number" || !Number.isSafeInteger(expected) || expected < 0) {
    return requestedMinor;
  }
  return Math.min(requestedMinor, expected);
}

export function betaAgencyDiscount(metadata: unknown): number {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return 0;
  const beta = (metadata as Record<string, unknown>).beta;
  if (!beta || typeof beta !== "object" || Array.isArray(beta)) return 0;
  const discount = (beta as Record<string, unknown>).discount_cents;
  return typeof discount === "number" && Number.isSafeInteger(discount) && discount > 0
    ? discount
    : 0;
}
