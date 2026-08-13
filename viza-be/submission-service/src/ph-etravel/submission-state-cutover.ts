import { safePhEtravelErrorSummary } from "./error-safety";
import type { PhEtravelArrivalLaunchPreflight } from "./launch-preflight";
import type {
  PhEtravelSubmissionStateSyncAdapter,
  PhEtravelSubmissionStateSyncInput,
  PhEtravelSubmissionStateSyncOutcome,
} from "./submission-state-sync";

export type PhEtravelSubmissionStateCutoverDryRun =
  | {
    stage: "preflight_blocked";
    safeReasonCode: string;
    rpc: "not_called";
    accountPreparation: "not_started";
    browser: "not_started";
    legacySequentialWrites: "prohibited";
    officialResubmitAllowed: false;
  }
  | {
    stage: "synchronized";
    safeReasonCode: string;
    idempotentReplay: boolean;
    rpc: "called";
    accountPreparation: "not_started";
    browser: "not_started";
    legacySequentialWrites: "prohibited";
    officialResubmitAllowed: false;
  }
  | {
    stage: "recovery_required";
    safeReasonCode: string;
    rpc: "called";
    accountPreparation: "not_started";
    browser: "not_started";
    legacySequentialWrites: "prohibited";
    officialResubmitAllowed: false;
  };

export interface PhEtravelSubmissionStateCutoverDryRunInput {
  preflight: PhEtravelArrivalLaunchPreflight;
  syncAdapter: Pick<PhEtravelSubmissionStateSyncAdapter, "sync">;
  syncInput: PhEtravelSubmissionStateSyncInput;
}

function recoveryOutcome(outcome: PhEtravelSubmissionStateSyncOutcome): PhEtravelSubmissionStateCutoverDryRun {
  return {
    stage: "recovery_required",
    safeReasonCode: safePhEtravelErrorSummary({ code: outcome.safeReasonCode }).code,
    rpc: "called",
    accountPreparation: "not_started",
    browser: "not_started",
    legacySequentialWrites: "prohibited",
    officialResubmitAllowed: false,
  };
}

/**
 * Dry-run-only v2 cutover decision. It deliberately has no Supabase writer,
 * account, browser, or portal dependency: a real worker cutover is allowed
 * only after the DB owner deploys the atomic RPC and its complete reply shape.
 */
export async function dryRunPhEtravelSubmissionStateCutover(
  input: PhEtravelSubmissionStateCutoverDryRunInput,
): Promise<PhEtravelSubmissionStateCutoverDryRun> {
  if (input.preflight.status !== "allowed") {
    return {
      stage: "preflight_blocked",
      safeReasonCode: safePhEtravelErrorSummary({ code: input.preflight.code }).code,
      rpc: "not_called",
      accountPreparation: "not_started",
      browser: "not_started",
      legacySequentialWrites: "prohibited",
      officialResubmitAllowed: false,
    };
  }

  const outcome = await input.syncAdapter.sync(input.syncInput);
  if (outcome.outcome !== "synchronized") return recoveryOutcome(outcome);

  return {
    stage: "synchronized",
    safeReasonCode: safePhEtravelErrorSummary({ code: outcome.safeReasonCode }).code,
    idempotentReplay: outcome.idempotentReplay,
    rpc: "called",
    accountPreparation: "not_started",
    browser: "not_started",
    legacySequentialWrites: "prohibited",
    officialResubmitAllowed: false,
  };
}
