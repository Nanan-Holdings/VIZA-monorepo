import {
type ManagedOfficialFeeCard,
type ManagedOfficialFeeCardContext
} from "../issuing/managed-card-provider.js";
import type { EscrowCardOutcome } from "../issuing/photonpay-card-provider.js";
import type { ManagedPaymentHooks } from "../runners/managed-payment-boundary.js";
import {
type ManagedOfficialFeeExecutionContext
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

/** Compatibility hooks. Payment execution is removed; no data or card provider is accessed. */
export function createManagedPaymentHooks(
  _input: {
    applicationId: string;
    workerId: string;
    country: string;
    visaType: string;
  },
  _dependencies: ManagedPaymentHookDependencies = {},
): ManagedPaymentHooks {
  return { takePaymentCard: async () => null };
}
