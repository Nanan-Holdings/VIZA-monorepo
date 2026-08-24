import { normalizeCountry } from "@/lib/queue/countries";

export const STATUS_VISIBLE_RUNNER_FLOWS = [
  {
    country: "singapore",
    visaType: "SG_ARRIVAL_CARD",
    provider: "sg_arrival_card_runner_job",
    statusPrefix: "sgac_live_assisted",
    waitingStage: "waiting_for_singapore_runner",
    runningStage: "official_portal_submission",
    singaporeArrivalCard: true,
  },
  {
    country: "canada",
    visaType: "CA_TRV",
    provider: "canada_trv_runner_job",
    statusPrefix: "ca_trv_runner",
    waitingStage: "waiting_for_canada_runner",
    runningStage: "canada_official_portal_session",
    singaporeArrivalCard: false,
  },
  {
    country: "turkey",
    visaType: "TR_E_VISA",
    provider: "turkey_evisa_runner_job",
    statusPrefix: "tr_evisa_runner",
    waitingStage: "waiting_for_turkiye_runner",
    runningStage: "turkiye_official_portal_session",
    singaporeArrivalCard: false,
  },
  {
    country: "india",
    visaType: "IN_E_VISA",
    provider: "india_evisa_runner_job",
    statusPrefix: "in_evisa_runner",
    waitingStage: "waiting_for_india_runner",
    runningStage: "india_official_portal_session",
    singaporeArrivalCard: false,
  },
  {
    country: "saudi_arabia",
    visaType: "SA_E_VISA",
    provider: "saudi_evisa_runner_job",
    statusPrefix: "sa_evisa_runner",
    waitingStage: "waiting_for_saudi_runner",
    runningStage: "saudi_official_portal_session",
    singaporeArrivalCard: false,
  },
  {
    country: "united_arab_emirates",
    visaType: "AE_TOURIST_VISA",
    provider: "uae_tourist_runner_job",
    statusPrefix: "ae_tourist_runner",
    waitingStage: "waiting_for_uae_runner",
    runningStage: "uae_official_portal_session",
    singaporeArrivalCard: false,
  },
] as const;

export type StatusVisibleRunnerFlow = (typeof STATUS_VISIBLE_RUNNER_FLOWS)[number];

export type RunnerJobPresentationState =
  | "pending"
  | "running"
  | "action_required"
  | "completed"
  | "failed";

export interface RunnerJobPresentation {
  queueStatus: string;
  state: RunnerJobPresentationState;
  provider: string;
  currentStage: string | null;
  manualActionStatus: string | null;
  officialStatus: string | null;
  officialSubmissionProven: boolean;
}

const OFFICIAL_SUBMISSION_RESULT_STATUSES = new Set([
  "submitted",
  "completed",
  "lodged",
  "filed",
  "approved",
  "issued",
  "granted",
]);

function normalizeVisaType(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/[\s/-]+/gu, "_");
}

export function hasPersistedOfficialSubmissionProof(
  submissionResultStatus: string | null | undefined,
  submissionResult: unknown,
): boolean {
  const applicationStatus = (submissionResultStatus ?? "").trim().toLowerCase();
  if (applicationStatus !== "submitted" && applicationStatus !== "completed") {
    return false;
  }
  if (
    typeof submissionResult !== "object" ||
    submissionResult === null ||
    Array.isArray(submissionResult)
  ) {
    return false;
  }
  const resultStatus = (submissionResult as Record<string, unknown>).status;
  return (
    typeof resultStatus === "string" &&
    OFFICIAL_SUBMISSION_RESULT_STATUSES.has(resultStatus.trim().toLowerCase())
  );
}

/** Resolve only the exact application products whose runner_job is surfaced. */
export function statusVisibleRunnerFlowForApplication(
  country: string | null | undefined,
  visaType: string | null | undefined,
): StatusVisibleRunnerFlow | null {
  const canonicalCountry = normalizeCountry(country ?? "");
  const canonicalVisaType = normalizeVisaType(visaType);
  return (
    STATUS_VISIBLE_RUNNER_FLOWS.find(
      (flow) =>
        flow.country === canonicalCountry && flow.visaType === canonicalVisaType,
    ) ?? null
  );
}

/**
 * Convert a durable runner status into the existing status-card vocabulary.
 * Singapore keeps its established semantics. For the five tourist runners,
 * `succeeded` means only that the worker returned; it may be a pre-payment or
 * safe-review halt, so official completion requires independent persisted
 * application-result proof.
 */
export function presentRunnerJobStatus(
  statusValue: string,
  flow: StatusVisibleRunnerFlow,
  officialSubmissionProven = false,
): RunnerJobPresentation {
  const status = statusValue.trim().toLowerCase();
  if (status === "queued") {
    return {
      queueStatus: `${flow.statusPrefix}_pending`,
      state: "pending",
      provider: flow.provider,
      currentStage: flow.waitingStage,
      manualActionStatus: null,
      officialStatus: null,
      officialSubmissionProven: false,
    };
  }
  if (status === "running") {
    return {
      queueStatus: `${flow.statusPrefix}_processing`,
      state: "running",
      provider: flow.provider,
      currentStage: flow.runningStage,
      manualActionStatus: null,
      officialStatus: null,
      officialSubmissionProven: false,
    };
  }
  if (status === "needs_human") {
    return {
      queueStatus: `${flow.statusPrefix}_blocked`,
      state: "action_required",
      provider: flow.provider,
      currentStage: "applicant_action_required",
      manualActionStatus: "pending",
      officialStatus: null,
      officialSubmissionProven: false,
    };
  }
  if (status === "succeeded") {
    const mayReportSubmitted = flow.singaporeArrivalCard || officialSubmissionProven;
    if (mayReportSubmitted) {
      return {
        queueStatus: "done",
        state: "completed",
        provider: flow.provider,
        currentStage: "official_submission_confirmed",
        manualActionStatus: null,
        officialStatus: "submitted",
        officialSubmissionProven: true,
      };
    }
    return {
      queueStatus: `${flow.statusPrefix}_blocked`,
      state: "action_required",
      provider: flow.provider,
      currentStage: "safe_checkpoint_reached",
      manualActionStatus: "pending",
      officialStatus: null,
      officialSubmissionProven: false,
    };
  }
  if (status === "paused") {
    return {
      queueStatus: "stalled",
      state: "pending",
      provider: flow.provider,
      currentStage: "runner_paused",
      manualActionStatus: null,
      officialStatus: null,
      officialSubmissionProven: false,
    };
  }
  const cancelled = status === "cancelled" || status === "canceled";
  return {
    queueStatus: cancelled
      ? `${flow.statusPrefix}_cancelled`
      : `${flow.statusPrefix}_failed`,
    state: "failed",
    provider: flow.provider,
    currentStage: cancelled ? "runner_cancelled" : "runner_failed",
    manualActionStatus: null,
    officialStatus: null,
    officialSubmissionProven: false,
  };
}
