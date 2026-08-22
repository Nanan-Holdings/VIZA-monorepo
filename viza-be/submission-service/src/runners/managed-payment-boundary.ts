/**
 * Country-neutral managed-card boundary for generic e-Visa runners.
 *
 * Card material is acquired lazily only after a country adapter has verified
 * the official payment amount/currency and is ready to fill evidenced payment
 * controls. Generic prefill runners without such controls return a durable
 * staff-review state without issuing a card or directing the applicant away.
 */

export interface ManagedPaymentCard {
  attemptId: string;
  pan: string;
  expiry: string;
  cvv: string;
  holderName: string;
}

export type ManagedPaymentCardOutcome = "consumed" | "review_required";

export interface ManagedPaymentHooks {
  takePaymentCard?: () => Promise<ManagedPaymentCard | null>;
  finalizePaymentCard?: (
    card: ManagedPaymentCard,
    outcome: ManagedPaymentCardOutcome,
    evidence?: Record<string, unknown>,
  ) => Promise<void>;
}

export type ManagedPortalPaymentResult =
  | { status: "paid"; receiptId?: string | null; reference?: string | null }
  | {
      status: "declined" | "three_ds_required" | "layout_uncertain" | "unknown";
      reason?: string;
    };

export interface ManagedPaymentAdapter {
  pay(input: {
    card: ManagedPaymentCard;
    amountCents: number;
    currency: string;
  }): Promise<ManagedPortalPaymentResult>;
}

export interface GenericManagedFeeExpectation {
  country: string;
  visaType: string;
  amountCents: number;
  currency: string;
}

export const GENERIC_MANAGED_FEE_EXPECTATIONS = [
  { country: "egypt", visaType: "EG_E_VISA", amountCents: 2_500, currency: "USD" },
  { country: "saudi_arabia", visaType: "SA_E_VISA", amountCents: 8_000, currency: "USD" },
  { country: "malaysia", visaType: "MY_TOURIST_E_VISA", amountCents: 1_500, currency: "USD" },
  { country: "thailand", visaType: "TH_TOURIST_E_VISA", amountCents: 4_000, currency: "USD" },
  { country: "united_arab_emirates", visaType: "AE_TOURIST_VISA", amountCents: 9_000, currency: "USD" },
  { country: "turkey", visaType: "TR_E_VISA", amountCents: 5_000, currency: "USD" },
  { country: "canada", visaType: "CA_TRV", amountCents: 10_000, currency: "CAD" },
  { country: "india", visaType: "IN_E_VISA", amountCents: 2_500, currency: "USD" },
  { country: "cambodia", visaType: "KH_TOURIST_E_VISA", amountCents: 3_600, currency: "USD" },
  { country: "laos", visaType: "LA_TOURIST_E_VISA", amountCents: 5_000, currency: "USD" },
  { country: "sri_lanka", visaType: "LK_ETA", amountCents: 5_000, currency: "USD" },
  { country: "south_africa", visaType: "ZA_VISITOR_VISA", amountCents: 4_750, currency: "ZAR" },
] as const satisfies readonly GenericManagedFeeExpectation[];

function normalize(value: string): string {
  return value.trim().toUpperCase().replace(/[\s/-]+/g, "_");
}

export function genericManagedFeeExpectation(
  country: string,
  visaType: string,
): GenericManagedFeeExpectation {
  const countryKey = country.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const visaTypeKey = normalize(visaType);
  const expectation = GENERIC_MANAGED_FEE_EXPECTATIONS.find(
    (entry) => entry.country === countryKey && entry.visaType === visaTypeKey,
  );
  if (!expectation) {
    throw new Error(`No managed official-fee expectation for ${country}/${visaType}`);
  }
  return expectation;
}

export type ManagedPaymentBoundaryResult =
  | {
      status: "paid";
      reason: string;
      receiptId: string | null;
      reference: string | null;
    }
  | {
      status: "managed_payment_adapter_unavailable" | "managed_payment_review_required";
      reason: string;
      receiptId: null;
      reference: null;
    };

function reviewResult(
  status: "managed_payment_adapter_unavailable" | "managed_payment_review_required",
  code: string,
  detail: string,
): ManagedPaymentBoundaryResult {
  return {
    status,
    reason: `${code}: ${detail}; staff review required`,
    receiptId: null,
    reference: null,
  };
}

export async function executeManagedPaymentBoundary(input: {
  country: string;
  visaType: string;
  observedAmountCents?: number | null;
  observedCurrency?: string | null;
  adapter?: ManagedPaymentAdapter;
  hooks?: ManagedPaymentHooks;
}): Promise<ManagedPaymentBoundaryResult> {
  const expected = genericManagedFeeExpectation(input.country, input.visaType);

  if (!input.adapter) {
    return reviewResult(
      "managed_payment_adapter_unavailable",
      "managed_payment_adapter_unavailable",
      `no evidenced official payment controls are configured for ${expected.country}/${expected.visaType}`,
    );
  }

  const observedCurrency = input.observedCurrency?.trim().toUpperCase() ?? "";
  if (
    !Number.isSafeInteger(input.observedAmountCents)
    || Number(input.observedAmountCents) !== expected.amountCents
    || observedCurrency !== expected.currency
  ) {
    return reviewResult(
      "managed_payment_review_required",
      "managed_payment_amount_or_currency_mismatch",
      `expected ${expected.amountCents} ${expected.currency} but observed ${String(input.observedAmountCents ?? "unknown")} ${observedCurrency || "unknown"}`,
    );
  }

  const card = await input.hooks?.takePaymentCard?.();
  if (!card) {
    return reviewResult(
      "managed_payment_review_required",
      "managed_payment_card_unavailable",
      "the application-scoped managed card could not be acquired",
    );
  }

  let portalResult: ManagedPortalPaymentResult;
  try {
    portalResult = await input.adapter.pay({
      card,
      amountCents: expected.amountCents,
      currency: expected.currency,
    });
  } catch (error) {
    await input.hooks?.finalizePaymentCard?.(card, "review_required", {
      error_code: "managed_payment_adapter_exception",
    });
    return reviewResult(
      "managed_payment_review_required",
      "managed_payment_adapter_exception",
      error instanceof Error ? error.message : String(error),
    );
  }

  if (portalResult.status === "paid") {
    const receiptId = portalResult.receiptId?.trim() || null;
    const reference = portalResult.reference?.trim() || null;
    if (!receiptId && !reference) {
      await input.hooks?.finalizePaymentCard?.(card, "review_required", {
        error_code: "managed_payment_receipt_missing",
      });
      return reviewResult(
        "managed_payment_review_required",
        "managed_payment_receipt_missing",
        "the official portal did not return a receipt or reference",
      );
    }
    await input.hooks?.finalizePaymentCard?.(card, "consumed", {
      receipt_id: receiptId,
      reference,
    });
    return {
      status: "paid",
      reason: "managed_payment_succeeded: official receipt or reference captured",
      receiptId,
      reference,
    };
  }

  await input.hooks?.finalizePaymentCard?.(card, "review_required", {
    error_code: `managed_payment_${portalResult.status}`,
  });
  return reviewResult(
    "managed_payment_review_required",
    `managed_payment_${portalResult.status}`,
    portalResult.reason ?? "the official payment result is not safely terminal",
  );
}

export async function unavailableManagedPaymentBoundary(input: {
  country: string;
  visaType: string;
  hooks?: ManagedPaymentHooks;
}): Promise<{
  status: "managed_payment_adapter_unavailable";
  reason: string;
  receiptId: null;
  reference: null;
}> {
  const expected = genericManagedFeeExpectation(input.country, input.visaType);
  return {
    status: "managed_payment_adapter_unavailable",
    reason:
      "managed_payment_adapter_unavailable: " +
      `no evidenced official payment controls are configured for ${expected.country}/${expected.visaType}; ` +
      "staff review required",
    receiptId: null,
    reference: null,
  };
}
