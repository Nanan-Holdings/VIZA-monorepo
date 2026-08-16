import {
  normalizeOfficialFeeCountry,
  normalizeOfficialFeeVisaType,
  type ManagedOfficialFeeExecutionContext,
} from "../official-fee/execution-context.js";
import {
  createPhotonPayClient,
  PhotonPayConfigError,
} from "../clients/photonpay.js";
import { decisionFor } from "../payment-routing.js";
import {
  ensureAirwallexEscrowCard,
  finalizeAirwallexEscrowCard,
  type AirwallexEscrowDependencies,
} from "./airwallex-card-provider.js";
import {
  ensurePhotonPayEscrowCard,
  finalizePhotonPayEscrowCard,
  resolvePhotonPayCardConfig,
  type EscrowCard,
  type EscrowCardOutcome,
  type PhotonPayClientLike,
  type PhotonPayEscrowDependencies,
} from "./photonpay-card-provider.js";
import type { ManagedCardIssuer } from "./issuer-card-repository.js";

export interface ManagedOfficialFeeCard extends EscrowCard {
  issuer: ManagedCardIssuer;
}

export interface ManagedOfficialFeeCardContext {
  execution: ManagedOfficialFeeExecutionContext;
  workerId: string;
  country: string;
  visaType: string;
}

export class ManagedCardIssuerError extends Error {
  constructor(
    readonly code:
      | "issuer_currency_unsupported"
      | "issuer_capability_config_invalid"
      | "issuer_unavailable"
      | "unsafe_provider_failover_blocked"
      | "canonical_fee_binding_invalid",
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ManagedCardIssuerError";
  }
}

export type ManagedCardFallbackReason =
  | "photonpay_provider_unavailable"
  | "photonpay_currency_unsupported"
  | "photonpay_configuration_invalid";

export interface ManagedCardIssuerSelection {
  issuer: ManagedCardIssuer;
  photonpayConfig: ReturnType<typeof resolvePhotonPayCardConfig>;
  /** Present only when Airwallex is a safe, pre-issuance fallback. */
  fallbackReason: ManagedCardFallbackReason | null;
}

export interface ManagedCardProviderDependencies {
  env?: NodeJS.ProcessEnv;
  loadExistingIssuer?: (allocationId: string) => Promise<ManagedCardIssuer | null>;
  photonpay?: PhotonPayEscrowDependencies;
  airwallex?: AirwallexEscrowDependencies;
  resolvePhotonPayClient?: () => PhotonPayClientLike | null;
  ensurePhotonPayCard?: typeof ensurePhotonPayEscrowCard;
  ensureAirwallexCard?: typeof ensureAirwallexEscrowCard;
}

function enabled(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test((value ?? "").trim());
}

export function airwallexSupportedCurrencies(
  env: NodeJS.ProcessEnv = process.env,
): ReadonlySet<string> {
  if (!enabled(env.AIRWALLEX_ISSUING_ENABLED)) return new Set();
  const raw = env.AIRWALLEX_ISSUING_SUPPORTED_CURRENCIES?.trim();
  if (!raw) return new Set();
  const values = raw.split(",").map((value) => value.trim().toUpperCase()).filter(Boolean);
  if (values.some((value) => !/^[A-Z]{3}$/.test(value))) {
    throw new ManagedCardIssuerError(
      "issuer_capability_config_invalid",
      "AIRWALLEX_ISSUING_SUPPORTED_CURRENCIES must contain comma-separated ISO 4217 currency codes",
    );
  }
  return new Set(values);
}

async function loadExistingIssuerFromDatabase(
  allocationId: string,
): Promise<ManagedCardIssuer | null> {
  const { supabase } = await import("../supabase.js");
  const { data, error } = await supabase
    .from("issuer_card_attempts")
    .select("issuer")
    .eq("allocation_id", allocationId)
    .neq("status", "cancelled")
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load existing issuer-card attempt: ${error.message}`);
  const issuer = (data as { issuer?: unknown } | null)?.issuer;
  if (issuer === undefined || issuer === null) return null;
  if (issuer !== "photonpay" && issuer !== "airwallex") {
    throw new Error(`Existing issuer-card attempt has unsupported issuer ${String(issuer)}`);
  }
  return issuer;
}

export function selectManagedCardIssuer(
  currency: string,
  env: NodeJS.ProcessEnv = process.env,
  existingIssuer: ManagedCardIssuer | null = null,
): ManagedCardIssuerSelection {
  const normalized = currency.trim().toUpperCase();
  const photonpayConfig = resolvePhotonPayCardConfig(normalized, env);

  if (existingIssuer === "photonpay" && photonpayConfig) {
    return { issuer: "photonpay", photonpayConfig, fallbackReason: null };
  }
  if (existingIssuer === "photonpay") {
    throw new ManagedCardIssuerError(
      "issuer_currency_unsupported",
      `Existing PhotonPay attempt cannot be recovered for ${normalized}`,
    );
  }
  if (existingIssuer === "airwallex") {
    if (airwallexSupportedCurrencies(env).has(normalized)) {
      return { issuer: "airwallex", photonpayConfig: null, fallbackReason: null };
    }
    throw new ManagedCardIssuerError(
      "issuer_currency_unsupported",
      `Existing Airwallex attempt cannot be recovered for ${normalized}`,
    );
  }

  // PhotonPay is always first. A malformed fallback configuration must not
  // prevent a fully configured PhotonPay path from issuing.
  if (photonpayConfig) {
    return { issuer: "photonpay", photonpayConfig, fallbackReason: null };
  }

  const fallbackReason: ManagedCardFallbackReason = !["USD", "EUR", "GBP"].includes(normalized)
    ? "photonpay_currency_unsupported"
    : !enabled(env.PHOTONPAY_ENABLED)
      ? "photonpay_provider_unavailable"
      : "photonpay_configuration_invalid";
  const airwallexCurrencies = airwallexSupportedCurrencies(env);
  if (airwallexCurrencies.has(normalized)) {
    return { issuer: "airwallex", photonpayConfig: null, fallbackReason };
  }
  throw new ManagedCardIssuerError(
    fallbackReason === "photonpay_provider_unavailable"
      ? "issuer_unavailable"
      : "issuer_currency_unsupported",
    `No configured managed-card issuer supports ${normalized || "(empty currency)"}`,
  );
}

async function ensureAirwallexFallbackCard(
  context: ManagedOfficialFeeCardContext,
  issuerContext: {
    applicationId: string;
    allocationId: string;
    officialFeePaymentIntentId: string;
    workerId: string;
    country: string;
    visaType: string;
  },
  dependencies: ManagedCardProviderDependencies,
  reason: ManagedCardFallbackReason,
  existingIssuer: ManagedCardIssuer | null,
  cause?: unknown,
): Promise<ManagedOfficialFeeCard> {
  if (existingIssuer !== null) {
    throw new ManagedCardIssuerError(
      "unsafe_provider_failover_blocked",
      `Cannot switch an existing ${existingIssuer} issuer-card attempt to Airwallex`,
      cause,
    );
  }
  const currency = context.execution.allocation.currency.trim().toUpperCase();
  if (!airwallexSupportedCurrencies(dependencies.env).has(currency)) {
    throw new ManagedCardIssuerError(
      reason === "photonpay_provider_unavailable"
        ? "issuer_unavailable"
        : "issuer_currency_unsupported",
      `PhotonPay preflight failed (${reason}) and Airwallex does not support ${currency}`,
      cause,
    );
  }
  const ensureAirwallex = dependencies.ensureAirwallexCard ?? ensureAirwallexEscrowCard;
  const card = await ensureAirwallex(issuerContext, dependencies.airwallex);
  if (!card) throw new Error("Airwallex was selected but its API client is disabled");
  return { ...card, issuer: "airwallex" };
}

function rejectCanonicalBinding(message: string): never {
  throw new ManagedCardIssuerError("canonical_fee_binding_invalid", message);
}

function exactMinorUnits(value: number | string): number | null {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const cents = Math.round(amount * 100);
  return Number.isSafeInteger(cents) && Math.abs(cents / 100 - amount) <= Number.EPSILON
    ? cents
    : null;
}

function assertCanonicalFeeBinding(context: ManagedOfficialFeeCardContext): void {
  const execution = context.execution;
  const country = normalizeOfficialFeeCountry(context.country);
  const visaType = normalizeOfficialFeeVisaType(context.visaType);
  if (
    country !== execution.applicationCountry ||
    visaType !== execution.applicationVisaType
  ) {
    rejectCanonicalBinding("Issuer country or visa type differs from the canonical application package");
  }
  if (
    execution.intent.application_id !== execution.applicationId ||
    execution.allocation.application_id !== execution.applicationId ||
    execution.intent.id !== execution.officialFeePaymentIntentId ||
    execution.allocation.id !== execution.allocationId ||
    (execution.allocation.official_fee_payment_intent_id !== null &&
      execution.allocation.official_fee_payment_intent_id !== execution.officialFeePaymentIntentId)
  ) {
    rejectCanonicalBinding("Issuer execution identifiers are not bound to one application intent and allocation");
  }
  if (normalizeOfficialFeeCountry(execution.intent.country_code) !== execution.applicationCountry) {
    rejectCanonicalBinding("Official-fee intent country differs from the canonical application country");
  }

  let canonical: ReturnType<typeof decisionFor>;
  try {
    canonical = decisionFor(execution.applicationCountry, execution.applicationVisaType);
  } catch {
    rejectCanonicalBinding("No canonical payment-routing entry exists for the issuer package");
  }
  const intentCents = exactMinorUnits(execution.intent.official_fee_amount);
  const allocationCents = Number(execution.allocation.amount_cents);
  const currency = execution.intent.official_fee_currency.trim().toUpperCase();
  const allocationCurrency = execution.allocation.currency.trim().toUpperCase();
  if (
    canonical.mechanism !== "runner_escrow_card" ||
    execution.canonicalAmountCents !== canonical.govtFeeCents ||
    execution.canonicalCurrency.trim().toUpperCase() !== canonical.currency.toUpperCase() ||
    intentCents !== canonical.govtFeeCents ||
    !Number.isSafeInteger(allocationCents) ||
    allocationCents !== canonical.govtFeeCents ||
    currency !== canonical.currency.toUpperCase() ||
    allocationCurrency !== canonical.currency.toUpperCase()
  ) {
    rejectCanonicalBinding("Official-fee intent/allocation amount or currency differs from canonical routing");
  }
}

export async function ensureManagedOfficialFeeCard(
  context: ManagedOfficialFeeCardContext,
  dependencies: ManagedCardProviderDependencies = {},
): Promise<ManagedOfficialFeeCard> {
  assertCanonicalFeeBinding(context);
  const currency = context.execution.allocation.currency;
  const loadExisting = dependencies.loadExistingIssuer ?? loadExistingIssuerFromDatabase;
  const existingIssuer = await loadExisting(context.execution.allocationId);
  const selection = selectManagedCardIssuer(currency, dependencies.env, existingIssuer);
  const issuerContext = {
    applicationId: context.execution.applicationId,
    allocationId: context.execution.allocationId,
    officialFeePaymentIntentId: context.execution.officialFeePaymentIntentId,
    workerId: context.workerId,
    country: context.country,
    visaType: context.visaType,
  };

  if (selection.issuer === "photonpay") {
    let client: PhotonPayClientLike | null;
    try {
      const resolveClient = dependencies.resolvePhotonPayClient ?? createPhotonPayClient;
      client = dependencies.photonpay?.client === undefined
        ? resolveClient()
        : dependencies.photonpay.client;
    } catch (error) {
      if (!(error instanceof PhotonPayConfigError)) throw error;
      return ensureAirwallexFallbackCard(
        context,
        issuerContext,
        dependencies,
        "photonpay_configuration_invalid",
        existingIssuer,
        error,
      );
    }
    if (!client) {
      return ensureAirwallexFallbackCard(
        context,
        issuerContext,
        dependencies,
        "photonpay_provider_unavailable",
        existingIssuer,
      );
    }

    const ensurePhotonPay = dependencies.ensurePhotonPayCard ?? ensurePhotonPayEscrowCard;
    const card = await ensurePhotonPay(issuerContext, {
      ...dependencies.photonpay,
      client,
      cardConfig: selection.photonpayConfig,
    });
    // A non-null client was supplied, so null is an invalid/ambiguous provider
    // outcome. Never reinterpret it as proof that no card was created.
    if (!card) {
      throw new ManagedCardIssuerError(
        "unsafe_provider_failover_blocked",
        "PhotonPay returned no card after issuance started; Airwallex fallback is blocked",
      );
    }
    return { ...card, issuer: "photonpay" };
  }

  const ensureAirwallex = dependencies.ensureAirwallexCard ?? ensureAirwallexEscrowCard;
  const card = await ensureAirwallex(issuerContext, dependencies.airwallex);
  if (!card) throw new Error("Airwallex was selected but its API client is disabled");
  return { ...card, issuer: "airwallex" };
}

export async function finalizeManagedOfficialFeeCard(
  card: ManagedOfficialFeeCard,
  workerId: string,
  outcome: EscrowCardOutcome,
  dependencies: ManagedCardProviderDependencies = {},
): Promise<void> {
  if (card.issuer === "photonpay") {
    await finalizePhotonPayEscrowCard(card, workerId, outcome, dependencies.photonpay);
    return;
  }
  await finalizeAirwallexEscrowCard(card, workerId, outcome, dependencies.airwallex);
}
