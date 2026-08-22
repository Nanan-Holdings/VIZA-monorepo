import type { CataloguePricing } from "@/lib/public-catalogue";

export interface PriceBreakdownSgd {
  /** Government fee in whole SGD. */
  govtSgd: number;
  /** VIZA agency/processing fee in whole SGD. */
  agencySgd: number;
  /** Sum of the two, in whole SGD. */
  totalSgd: number;
}

/**
 * Government / agency / total split in whole SGD for the price card. Drives the
 * sticky price card across all country pages so displayed numbers always match
 * the canonical pricing mirror. null if the visa type is unknown.
 */
export function priceBreakdownSgd(pricing: CataloguePricing | null): PriceBreakdownSgd | null {
  if (!pricing) return null;
  const govtSgd = pricing.governmentFeeMinor / 100;
  const agencySgd = pricing.agencyFeeMinor / 100;
  return { govtSgd, agencySgd, totalSgd: govtSgd + agencySgd };
}

export function totalSgd(pricing: CataloguePricing | null): number | null {
  const breakdown = priceBreakdownSgd(pricing);
  return breakdown ? breakdown.totalSgd : null;
}

/** Formatted published display fee, e.g. "SGD 264". */
export function displayFeeSGD(pricing: CataloguePricing | null): string | null {
  const total = totalSgd(pricing);
  return total == null ? null : `SGD ${Number.isInteger(total) ? total.toFixed(0) : total.toFixed(2)}`;
}
