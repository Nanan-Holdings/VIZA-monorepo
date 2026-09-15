import { rejectRemovedPayment } from "../payment-removed.js";
/** Durable, vault-free Airwallex adapter for managed government-fee cards. */

import {
  createAirwallexIssuingClient
} from "../clients/airwallex-issuing.js";
import type { EscrowCard, EscrowCardOutcome } from "./photonpay-card-provider.js";
import {
  type IssuerCardRepository
} from "./issuer-card-repository.js";

export interface AirwallexEscrowContext {
  applicationId: string;
  allocationId: string;
  officialFeePaymentIntentId: string;
  workerId: string;
  country: string;
  visaType: string;
}

export interface AirwallexClientLike {
  getIssuingConfig: NonNullable<ReturnType<typeof createAirwallexIssuingClient>>["getIssuingConfig"];
  createApplicationFeeCard: NonNullable<ReturnType<typeof createAirwallexIssuingClient>>["createApplicationFeeCard"];
  getSensitiveDetails: NonNullable<ReturnType<typeof createAirwallexIssuingClient>>["getSensitiveDetails"];
  freezeCard: NonNullable<ReturnType<typeof createAirwallexIssuingClient>>["freezeCard"];
}

export interface AirwallexEscrowDependencies {
  client?: AirwallexClientLike | null;
  repository?: IssuerCardRepository;
  now?: () => Date;
  env?: NodeJS.ProcessEnv;
}

export async function ensureAirwallexEscrowCard(
  _context: AirwallexEscrowContext,
  _dependencies: AirwallexEscrowDependencies = {},
): Promise<EscrowCard | null> {
  return rejectRemovedPayment();
}

export async function finalizeAirwallexEscrowCard(
  _card: Pick<EscrowCard, "attemptId" | "cardId">,
  _workerId: string,
  _outcome: EscrowCardOutcome,
  _dependencies: AirwallexEscrowDependencies = {},
): Promise<void> {
  return rejectRemovedPayment();
}
