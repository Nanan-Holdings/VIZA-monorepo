import { TwDuplicateRunError } from "./errors.js";

export const TW_ACTIVE_RUNNER_JOB_STATUSES = ["queued", "running", "needs_human", "paused"] as const;

export interface TwPrepareGuardSnapshot {
  submissionResultStatus?: string | null;
  submissionResult?: Record<string, unknown> | null;
  activeRunnerJobs: Array<{ id: string }>;
  currentJobId?: string;
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
}
