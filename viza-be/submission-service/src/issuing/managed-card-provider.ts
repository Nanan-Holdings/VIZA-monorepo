import { rejectRemovedPayment } from "../payment-removed.js";
import {
  type ManagedOfficialFeeExecutionContext
} from "../official-fee/execution-context.js";
import {
  ensureAirwallexEscrowCard, type AirwallexEscrowDependencies
} from "./airwallex-card-provider.js";
import {
  ensurePhotonPayEscrowCard, resolvePhotonPayCardConfig,
  type EscrowCard,
  type EscrowCardOutcome,
  type PhotonPayClientLike,
  type PhotonPayEscrowDependencies
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

export async function ensureManagedOfficialFeeCard(
  _context: ManagedOfficialFeeCardContext,
  _dependencies: ManagedCardProviderDependencies = {},
): Promise<ManagedOfficialFeeCard> {
  return rejectRemovedPayment();
}

export async function finalizeManagedOfficialFeeCard(
  _card: ManagedOfficialFeeCard,
  _workerId: string,
  _outcome: EscrowCardOutcome,
  _dependencies: ManagedCardProviderDependencies = {},
): Promise<void> {
  return rejectRemovedPayment();
}
