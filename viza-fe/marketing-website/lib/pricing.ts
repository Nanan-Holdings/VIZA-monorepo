import type { CataloguePricing } from "@/lib/public-catalogue";

/**
 * VIZA's service is free (payments were retired on 2026-09-15). The only cost
 * left for an applicant is a government fee, which the applicant pays directly
 * to the issuing authority. This returns that published government fee in
 * whole SGD for display, or null when no published snapshot is available.
 */
export function governmentFeeSgd(pricing: CataloguePricing | null): number | null {
  if (!pricing) return null;
  return pricing.governmentFeeMinor / 100;
}

/** Formatted government fee, e.g. "SGD 25", or null when unknown. */
export function displayGovernmentFeeSgd(pricing: CataloguePricing | null): string | null {
  const fee = governmentFeeSgd(pricing);
  if (fee == null) return null;
  return `SGD ${Number.isInteger(fee) ? fee.toFixed(0) : fee.toFixed(2)}`;
}
