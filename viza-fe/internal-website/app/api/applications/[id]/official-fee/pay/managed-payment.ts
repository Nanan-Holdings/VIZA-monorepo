import {
  officialFeeCatalogFor,
  type OfficialFeeCatalogEntry,
} from "@/lib/payments/official-fee-catalog";
import { pricingFor } from "@/lib/pricing";

export interface OfficialFeeApplicationInput {
  id: string;
  country: string | null;
  visa_type: string | null;
  government_fee_cents?: number | null;
  government_fee_currency?: string | null;
}

export interface GovernmentFeeAllocationInput {
  id: string;
  amount_cents: number | string | null;
  currency: string | null;
  state: string | null;
}

export type OfficialFeePaymentMethod =
  | "one_time_user_card"
  | "viza_managed_virtual_card";

export type ManagedOfficialFeeResolution =
  | {
      ok: true;
      catalog: OfficialFeeCatalogEntry;
      amountCents: number;
      currency: string;
    }
  | {
      ok: false;
      code: "unsupported_official_fee_route" | "official_fee_not_electronic" | "official_fee_amount_missing";
      message: string;
    };

const ELIGIBLE_ALLOCATION_STATES = new Set([
  "reserved_pending_treasury",
  "reserved",
  "issuable",
  "card_issued",
  "portal_processing",
]);

export function normalizeOfficialFeePaymentMethod(body: unknown): OfficialFeePaymentMethod {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const value = (body as { paymentMethod?: unknown }).paymentMethod;
    if (value === "one_time_user_card" || value === "viza_managed_virtual_card") {
      return value;
    }
  }
  return "viza_managed_virtual_card";
}

export function resolveManagedOfficialFee(
  application: OfficialFeeApplicationInput,
): ManagedOfficialFeeResolution {
  const catalog = officialFeeCatalogFor(application.country, application.visa_type);
  if (!catalog) {
    return {
      ok: false,
      code: "unsupported_official_fee_route",
      message: "This application has no official-fee payment configuration.",
    };
  }
  if (catalog.fundingClass !== "viza_managed_card") {
    return {
      ok: false,
      code: "official_fee_not_electronic",
      message: catalog.fundingClass === "free"
        ? "This official application has no government fee."
        : "This official fee is collected offline.",
    };
  }

  const pricingVisaType = application.visa_type?.trim().toUpperCase() === "B211A"
    ? "ID_C1_TOURIST"
    : application.visa_type;
  const pricing = application.country && pricingVisaType
    ? pricingFor(application.country, pricingVisaType)
    : null;
  const applicationAmount = Number(application.government_fee_cents ?? 0);
  const amountCents = applicationAmount > 0
    ? applicationAmount
    : Number(pricing?.govtFeeCents ?? 0);
  const currency = (
    application.government_fee_currency?.trim()
    || pricing?.currency
    || ""
  ).toUpperCase();

  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || !currency) {
    return {
      ok: false,
      code: "official_fee_amount_missing",
      message: "The application has no payable official-fee amount and currency.",
    };
  }
  return { ok: true, catalog, amountCents, currency };
}

export function isEligibleGovernmentFeeAllocation(
  allocation: GovernmentFeeAllocationInput | null | undefined,
  charge: Pick<Extract<ManagedOfficialFeeResolution, { ok: true }>, "amountCents" | "currency">,
): boolean {
  if (!allocation || !allocation.state || !ELIGIBLE_ALLOCATION_STATES.has(allocation.state)) {
    return false;
  }
  return (
    Number(allocation.amount_cents) === charge.amountCents
    && (allocation.currency ?? "").trim().toUpperCase() === charge.currency
  );
}

export function officialFeeCheckoutUrl(applicationId: string): string {
  return `/client/checkout?applicationId=${encodeURIComponent(applicationId)}`;
}
