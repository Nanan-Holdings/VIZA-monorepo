import {
  ensureManagedOfficialFeeCard,
  finalizeManagedOfficialFeeCard,
  type ManagedOfficialFeeCard,
  type ManagedOfficialFeeCardContext,
} from "../issuing/managed-card-provider.js";
import type { EscrowCardOutcome } from "../issuing/photonpay-card-provider.js";
import type { ManagedPaymentHooks } from "../runners/managed-payment-boundary.js";
import {
  loadManagedOfficialFeeExecutionContext,
  type ManagedOfficialFeeExecutionContext,
} from "./execution-context.js";

export interface ManagedPaymentHookDependencies {
  loadExecutionContext?: (
    applicationId: string,
  ) => Promise<ManagedOfficialFeeExecutionContext>;
  ensureCard?: (
    context: ManagedOfficialFeeCardContext,
  ) => Promise<ManagedOfficialFeeCard>;
  finalizeCard?: (
    card: ManagedOfficialFeeCard,
    workerId: string,
    outcome: EscrowCardOutcome,
  ) => Promise<void>;
}

/**
 * Build lazy hooks for a generic country runner. Constructing the hooks does
 * no database or issuer work; the execution context and card are resolved only
 * when an evidenced portal adapter requests card material.
 */
export function createManagedPaymentHooks(
  input: {
    applicationId: string;
    workerId: string;
    country: string;
    visaType: string;
  },
  dependencies: ManagedPaymentHookDependencies = {},
): ManagedPaymentHooks {
  const loadExecution = dependencies.loadExecutionContext
    ?? loadManagedOfficialFeeExecutionContext;
  const ensureCard = dependencies.ensureCard ?? ensureManagedOfficialFeeCard;
  const finalizeCard = dependencies.finalizeCard ?? finalizeManagedOfficialFeeCard;
  let executionPromise: Promise<ManagedOfficialFeeExecutionContext> | null = null;
  let issuedCard: ManagedOfficialFeeCard | null = null;

  const execution = (): Promise<ManagedOfficialFeeExecutionContext> => {
    executionPromise ??= loadExecution(input.applicationId);
    return executionPromise;
  };

  return {
    async takePaymentCard() {
      if (!issuedCard) {
        issuedCard = await ensureCard({
          execution: await execution(),
          workerId: input.workerId,
          country: input.country,
          visaType: input.visaType,
        });
      }
      return {
        attemptId: issuedCard.attemptId,
        pan: issuedCard.pan,
        expiry: issuedCard.expiry,
        cvv: issuedCard.cvv,
        holderName: issuedCard.holderName,
      };
    },

    async finalizePaymentCard(card, outcome) {
      if (!issuedCard || issuedCard.attemptId !== card.attemptId) {
        throw new Error("Managed payment finalizer received an unknown card attempt");
      }
      await finalizeCard(issuedCard, input.workerId, outcome);
    },
  };
}

