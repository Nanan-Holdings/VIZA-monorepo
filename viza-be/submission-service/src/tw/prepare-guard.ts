import { TwDuplicateRunError } from "./errors.js";

export const TW_ACTIVE_RUNNER_JOB_STATUSES = ["queued", "running", "needs_human", "paused"] as const;
export const TW_ACTIVE_HANDOFF_STATUSES = ["queued", "claimed"] as const;
export const TW_APPLICANT_HANDOFF_KIND = "taiwan_applicant_final_submit";

export interface TwPrepareGuardSnapshot {
  submissionResultStatus?: string | null;
  submissionResult?: Record<string, unknown> | null;
  activeRunnerJobs: Array<{ id: string }>;
  activeHandoffs: Array<{ expiresAt?: string | null }>;
  currentJobId?: string;
  nowMs?: number;
}

function hasReusableHandoff(snapshot: TwPrepareGuardSnapshot): boolean {
  const nowMs = snapshot.nowMs ?? Date.now();
  const resultExpiry = typeof snapshot.submissionResult?.handoffExpiresAt === "string"
    ? snapshot.submissionResult.handoffExpiresAt
    : null;

  return snapshot.activeHandoffs.some((handoff) => {
    const expiresAt = handoff.expiresAt ?? resultExpiry;
    return Boolean(expiresAt && Date.parse(expiresAt) > nowMs);
  });
}

export function assertTwPrepareGuard(snapshot: TwPrepareGuardSnapshot): void {
  const result = snapshot.submissionResult;
  if (result?.country === "TW" && result.status === "submitted") {
    throw new TwDuplicateRunError("taiwan: duplicate run blocked; this application is already submitted", {
      details: {
        blocker: "submitted",
        submissionResultStatus: snapshot.submissionResultStatus ?? null,
      },
    });
  }

  const hasOtherActiveJob = snapshot.activeRunnerJobs.some((job) => job.id !== snapshot.currentJobId);
  if (hasOtherActiveJob) {
    throw new TwDuplicateRunError("taiwan: duplicate run blocked; another active runner job exists", {
      details: { blocker: "active_runner_job" },
    });
  }

  if (hasReusableHandoff(snapshot)) {
    throw new TwDuplicateRunError("taiwan: duplicate run blocked; an applicant handoff is still active", {
      details: { blocker: "active_applicant_handoff" },
    });
  }
}
