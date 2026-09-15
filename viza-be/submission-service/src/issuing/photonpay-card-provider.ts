import { rejectRemovedPayment } from "../payment-removed.js";
/**
 * Durable PhotonPay card issuing for government-fee portal payments.
 *
 * The database owns idempotency and restart recovery. A card is scoped to one
 * application allocation/payment intent, not to an applicant or inbox. Only
 * the PhotonPay card id and a masked PAN are persisted; PAN, expiry, and CVV
 * stay in memory until the official payment form consumes them.
 */

import { createPhotonPayClient } from "../clients/photonpay.js";
import {
  type IssuerCardRepository
} from "./issuer-card-repository.js";

export type { IssuerCardRepository } from "./issuer-card-repository.js";

export interface EscrowCard {
  attemptId: string;
  cardId: string;
  /** Full PAN. Sensitive: never persist or log. */
  pan: string;
  /** MM/YY. Sensitive: never persist or log. */
  expiry: string;
  /** Sensitive: use once and never persist or log. */
  cvv: string;
  holderName: string;
}

export interface PhotonPayEscrowContext {
  applicationId: string;
  allocationId: string;
  officialFeePaymentIntentId: string;
  workerId: string;
  country: string;
  visaType: string;
}

export interface PhotonPayCardConfig {
  currency: string;
  bin: string;
  account: string;
}

export type EscrowCardOutcome = "consumed" | "cancelled" | "review_required";

export interface PhotonPayClientLike {
  openCard: NonNullable<ReturnType<typeof createPhotonPayClient>>["openCard"];
  getRequestResult: NonNullable<ReturnType<typeof createPhotonPayClient>>["getRequestResult"];
  getCardDetail: NonNullable<ReturnType<typeof createPhotonPayClient>>["getCardDetail"];
  getCvv: NonNullable<ReturnType<typeof createPhotonPayClient>>["getCvv"];
  freezeCard: NonNullable<ReturnType<typeof createPhotonPayClient>>["freezeCard"];
  cancelCard: NonNullable<ReturnType<typeof createPhotonPayClient>>["cancelCard"];
}

export interface PhotonPayEscrowDependencies {
  client?: PhotonPayClientLike | null;
  repository?: IssuerCardRepository;
  cardConfig?: PhotonPayCardConfig | null;
}

function envEnabled(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test((value ?? "").trim());
}

export function resolvePhotonPayCardConfig(
  currency: string,
  env: NodeJS.ProcessEnv = process.env,
): PhotonPayCardConfig | null {
  const normalized = currency.trim().toUpperCase();
  if (!envEnabled(env.PHOTONPAY_ENABLED) || !["USD", "EUR", "GBP"].includes(normalized)) {
    return null;
  }

  const configuredBin = env[`PHOTONPAY_ISSUING_BIN_${normalized}`]?.trim();
  const configuredAccount = env[`PHOTONPAY_ISSUING_ACCOUNT_${normalized}`]?.trim();
  if (configuredBin && configuredAccount) {
    return { currency: normalized, bin: configuredBin, account: configuredAccount };
  }

  const legacyCurrency = env.PHOTONPAY_ISSUING_CURRENCY?.trim().toUpperCase();
  const legacyBin = env.PHOTONPAY_ISSUING_BIN?.trim();
  const legacyAccount = env.PHOTONPAY_ISSUING_ACCOUNT?.trim();
  return legacyCurrency === normalized && legacyBin && legacyAccount
    ? { currency: normalized, bin: legacyBin, account: legacyAccount }
    : null;
}

/**
 * Claim, issue, or recover the one card for an application payment attempt.
 * Returns null while PhotonPay is disabled. All card secrets remain in memory.
 */
export async function ensurePhotonPayEscrowCard(
  _context: PhotonPayEscrowContext,
  _dependencies: PhotonPayEscrowDependencies = {},
): Promise<EscrowCard | null> {
  return rejectRemovedPayment();
}

/** Cancel/freeze the provider card and atomically transition its allocation. */
export async function finalizePhotonPayEscrowCard(
  _card: Pick<EscrowCard, "attemptId" | "cardId">,
  _workerId: string,
  _outcome: EscrowCardOutcome,
  _dependencies: PhotonPayEscrowDependencies = {},
): Promise<void> {
  return rejectRemovedPayment();
}
