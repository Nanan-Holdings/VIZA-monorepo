/**
 * Country-neutral official-fee execution context for VIZA-managed cards.
 *
 * Card issuance is allowed only when one explicitly consented managed-card
 * intent can be matched to one exact treasury-issuable allocation. The caller
 * passes that allocation id into the atomic database claim; no issuer path may
 * choose an allocation merely because it is the newest row for an application.
*/

import { decisionFor, UnknownPackageError } from "../payment-routing.js";

const EXECUTABLE_INTENT_STATUSES = new Set([
  "admin_approved",
  "ready",
  "pending",
  "failed",
]);

const ISSUABLE_ALLOCATION_STATES = new Set([
  "issuable",
  "card_issued",
  "portal_processing",
]);

export interface ManagedOfficialFeeIntent {
  id: string;
  application_id: string;
  user_id: string;
  fee_quote_id: string | null;
  country_code: string;
  mode: string | null;
  provider: string | null;
  payment_method_type: string;
  official_fee_amount: number | string;
  official_fee_currency: string;
  status: string;
  user_consented_at: string | null;
  user_consent_snapshot_json: Record<string, unknown> | null;
  created_at: string;
}

export interface GovernmentFeeAllocation {
  id: string;
  application_id: string;
  official_fee_payment_intent_id: string | null;
  amount_cents: number | string;
  currency: string;
  state: string;
  created_at: string;
}

export interface ManagedOfficialFeeExecutionContext {
  applicationId: string;
  applicationCountry: string;
  applicationVisaType: string;
  canonicalAmountCents: number;
  canonicalCurrency: string;
  allocationId: string;
  officialFeePaymentIntentId: string;
  intent: ManagedOfficialFeeIntent;
  allocation: GovernmentFeeAllocation;
}

export interface OfficialFeeExecutionContextRepository {
  loadApplicationPackage(applicationId: string): Promise<{
    country: string;
    visa_type: string;
  } | null>;
  loadLatestManagedIntent(applicationId: string): Promise<ManagedOfficialFeeIntent | null>;
  loadAllocations(applicationId: string): Promise<GovernmentFeeAllocation[]>;
}

export class OfficialFeeExecutionContextError extends Error {
  constructor(
    readonly code:
      | "managed_intent_missing"
      | "managed_intent_not_consented"
      | "managed_intent_not_executable"
      | "allocation_missing"
      | "allocation_ambiguous"
      | "allocation_not_issuable"
      | "allocation_amount_invalid"
      | "allocation_amount_mismatch"
      | "allocation_currency_mismatch"
      | "canonical_package_missing"
      | "canonical_route_not_managed"
      | "canonical_country_mismatch"
      | "canonical_amount_mismatch"
      | "canonical_currency_mismatch",
    message: string,
  ) {
    super(message);
    this.name = "OfficialFeeExecutionContextError";
  }
}

const defaultRepository: OfficialFeeExecutionContextRepository = {
  async loadApplicationPackage(applicationId) {
    const { supabase } = await import("../supabase.js");
    const { data, error } = await supabase
      .from("applications")
      .select("country, visa_type")
      .eq("id", applicationId)
      .maybeSingle();
    if (error) throw new Error(`Failed to load application package: ${error.message}`);
    return (data ?? null) as { country: string; visa_type: string } | null;
  },
  async loadLatestManagedIntent(applicationId) {
    const { supabase } = await import("../supabase.js");
    const { data, error } = await supabase
      .from("official_fee_payment_intents")
      .select(
        "id, application_id, user_id, fee_quote_id, country_code, mode, provider, payment_method_type, official_fee_amount, official_fee_currency, status, user_consented_at, user_consent_snapshot_json, created_at",
      )
      .eq("application_id", applicationId)
      .eq("payment_method_type", "viza_managed_virtual_card")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to load managed official-fee intent: ${error.message}`);
    }
    return (data ?? null) as ManagedOfficialFeeIntent | null;
  },

  async loadAllocations(applicationId) {
    const { supabase } = await import("../supabase.js");
    const { data, error } = await supabase
      .from("government_fee_allocations")
      .select(
        "id, application_id, official_fee_payment_intent_id, amount_cents, currency, state, created_at",
      )
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false });
    if (error) {
      throw new Error(`Failed to load government-fee allocations: ${error.message}`);
    }
    return (data ?? []) as GovernmentFeeAllocation[];
  },
};

const COUNTRY_ALIASES: Readonly<Record<string, string>> = {
  US: "united_states",
  GB: "united_kingdom",
  UK: "united_kingdom",
  VN: "vietnam",
  AU: "australia",
  JP: "japan",
  ID: "indonesia",
  EG: "egypt",
  KR: "south_korea",
  TH: "thailand",
  MY: "malaysia",
  SG: "singapore",
  HK: "hong_kong",
  MO: "macau",
  NZ: "new_zealand",
  RU: "russia",
  TR: "turkey",
  AE: "united_arab_emirates",
  CA: "canada",
  PH: "philippines",
  KH: "cambodia",
  LA: "laos",
  LK: "sri_lanka",
  IN: "india",
  ZA: "south_africa",
  SA: "saudi_arabia",
  FR: "france",
  IT: "italy",
  EU: "european_union",
};

export function normalizeOfficialFeeCountry(value: string): string {
  const trimmed = value.trim();
  const upper = trimmed.toUpperCase();
  return COUNTRY_ALIASES[upper] ?? trimmed.toLowerCase().replace(/[\s-]+/g, "_");
}

export function normalizeOfficialFeeVisaType(value: string): string {
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (["VIETNAM_E_VISA", "E_VISA_TOURISM", "EVISA_TOURISM", "TOURIST_E_VISA", "TOURIST_EVISA"].includes(normalized)) {
    return "VN_E_VISA";
  }
  if (normalized === "C1_TOURIST") return "ID_C1_TOURIST";
  if (["B1_EVOA", "EVOA"].includes(normalized)) return "ID_B1_EVOA";
  return normalized;
}

function amountInMinorUnits(value: number | string): number | null {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const minorUnits = Math.round(amount * 100);
  return Number.isSafeInteger(minorUnits) &&
    minorUnits > 0 &&
    Math.abs(minorUnits / 100 - amount) <= Number.EPSILON
    ? minorUnits
    : null;
}

function allocationMinorUnits(value: number | string): number | null {
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

function selectExactAllocation(
  intent: ManagedOfficialFeeIntent,
  allocations: GovernmentFeeAllocation[],
): GovernmentFeeAllocation {
  const bound = allocations.filter(
    (allocation) => allocation.official_fee_payment_intent_id === intent.id,
  );
  if (bound.length > 1) {
    throw new OfficialFeeExecutionContextError(
      "allocation_ambiguous",
      "Multiple government-fee allocations are bound to the managed payment intent",
    );
  }
  if (bound.length === 1) return bound[0];

  const unboundIssuable = allocations.filter(
    (allocation) =>
      allocation.official_fee_payment_intent_id === null &&
      ISSUABLE_ALLOCATION_STATES.has(allocation.state),
  );
  if (unboundIssuable.length === 0) {
    throw new OfficialFeeExecutionContextError(
      "allocation_missing",
      "No unbound treasury-issuable government-fee allocation exists for the managed payment intent",
    );
  }
  if (unboundIssuable.length > 1) {
    throw new OfficialFeeExecutionContextError(
      "allocation_ambiguous",
      "More than one unbound treasury-issuable government-fee allocation exists for the application",
    );
  }
  return unboundIssuable[0];
}

export async function loadManagedOfficialFeeExecutionContext(
  applicationId: string,
  repository: OfficialFeeExecutionContextRepository = defaultRepository,
): Promise<ManagedOfficialFeeExecutionContext> {
  if (!applicationId.trim()) {
    throw new OfficialFeeExecutionContextError(
      "managed_intent_missing",
      "Application id is required for managed official-fee execution",
    );
  }

  const applicationPackage = await repository.loadApplicationPackage(applicationId);
  if (!applicationPackage?.country?.trim() || !applicationPackage.visa_type?.trim()) {
    throw new OfficialFeeExecutionContextError(
      "canonical_package_missing",
      "Application country and visa type are required for canonical official-fee execution",
    );
  }
  const applicationCountry = normalizeOfficialFeeCountry(applicationPackage.country);
  const applicationVisaType = normalizeOfficialFeeVisaType(applicationPackage.visa_type);
  let canonical;
  try {
    canonical = decisionFor(applicationCountry, applicationVisaType);
  } catch (error) {
    if (!(error instanceof UnknownPackageError)) throw error;
    throw new OfficialFeeExecutionContextError(
      "canonical_package_missing",
      `No canonical official-fee package exists for ${applicationCountry}/${applicationVisaType}`,
    );
  }
  if (canonical.mechanism !== "runner_escrow_card") {
    throw new OfficialFeeExecutionContextError(
      "canonical_route_not_managed",
      `Canonical package ${applicationCountry}/${applicationVisaType} is not managed-card payable`,
    );
  }

  const intent = await repository.loadLatestManagedIntent(applicationId);
  if (!intent || intent.application_id !== applicationId) {
    throw new OfficialFeeExecutionContextError(
      "managed_intent_missing",
      "No VIZA-managed virtual-card payment intent exists for the application",
    );
  }
  if (!intent.user_consented_at || !intent.user_consent_snapshot_json) {
    throw new OfficialFeeExecutionContextError(
      "managed_intent_not_consented",
      "The managed official-fee payment intent has no durable user consent",
    );
  }
  if (!EXECUTABLE_INTENT_STATUSES.has(intent.status)) {
    throw new OfficialFeeExecutionContextError(
      "managed_intent_not_executable",
      `The managed official-fee payment intent cannot execute from status ${intent.status}`,
    );
  }
  if (normalizeOfficialFeeCountry(intent.country_code) !== applicationCountry) {
    throw new OfficialFeeExecutionContextError(
      "canonical_country_mismatch",
      "Managed official-fee intent country does not match the canonical application package",
    );
  }

  const allocations = await repository.loadAllocations(applicationId);
  const allocation = selectExactAllocation(intent, allocations);
  if (
    allocation.application_id !== applicationId ||
    !ISSUABLE_ALLOCATION_STATES.has(allocation.state)
  ) {
    throw new OfficialFeeExecutionContextError(
      "allocation_not_issuable",
      `Government-fee allocation ${allocation.id} cannot issue from state ${allocation.state}`,
    );
  }

  const intentAmountCents = amountInMinorUnits(intent.official_fee_amount);
  const allocatedAmountCents = allocationMinorUnits(allocation.amount_cents);
  if (intentAmountCents === null || allocatedAmountCents === null) {
    throw new OfficialFeeExecutionContextError(
      "allocation_amount_invalid",
      "The managed official-fee intent or allocation has an invalid amount",
    );
  }
  if (intentAmountCents !== allocatedAmountCents) {
    throw new OfficialFeeExecutionContextError(
      "allocation_amount_mismatch",
      `Managed official-fee intent amount ${intentAmountCents} does not match allocation amount ${allocatedAmountCents}`,
    );
  }

  const intentCurrency = intent.official_fee_currency.trim().toUpperCase();
  const allocationCurrency = allocation.currency.trim().toUpperCase();
  if (!intentCurrency || intentCurrency !== allocationCurrency) {
    throw new OfficialFeeExecutionContextError(
      "allocation_currency_mismatch",
      `Managed official-fee intent currency ${intentCurrency || "(empty)"} does not match allocation currency ${allocationCurrency || "(empty)"}`,
    );
  }
  if (intentAmountCents !== canonical.govtFeeCents) {
    throw new OfficialFeeExecutionContextError(
      "canonical_amount_mismatch",
      `Managed official-fee amount ${intentAmountCents} does not match canonical amount ${canonical.govtFeeCents}`,
    );
  }
  const canonicalCurrency = canonical.currency.trim().toUpperCase();
  if (intentCurrency !== canonicalCurrency) {
    throw new OfficialFeeExecutionContextError(
      "canonical_currency_mismatch",
      `Managed official-fee currency ${intentCurrency} does not match canonical currency ${canonicalCurrency}`,
    );
  }

  return {
    applicationId,
    applicationCountry,
    applicationVisaType,
    canonicalAmountCents: canonical.govtFeeCents,
    canonicalCurrency,
    allocationId: allocation.id,
    officialFeePaymentIntentId: intent.id,
    intent,
    allocation,
  };
}
