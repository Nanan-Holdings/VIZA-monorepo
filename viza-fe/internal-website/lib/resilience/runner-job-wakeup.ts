import "server-only";

import { enqueueResilienceQueueEvent } from "./gateway";
import { assertRunnerCutoverActive } from "../runner-cutover-pause.server";

export const RUNNER_JOB_WAKE_EVENT = "runner_job.wakeup.v1" as const;

export type RunnerWakeTarget = "pool" | "legacy" | "indonesia" | "south_korea";

export type RunnerJobWakeEvent = {
  version: 1;
  jobId: string;
  target: RunnerWakeTarget;
};

const RUNNER_WAKE_TARGETS: readonly RunnerWakeTarget[] = [
  "pool",
  "legacy",
  "indonesia",
  "south_korea",
];

function normalizeJobId(value: unknown): string {
  const jobId = typeof value === "string" ? value.trim() : "";
  if (!jobId) throw new Error("Runner job id is required");
  return jobId;
}

function normalizeTarget(value: unknown): RunnerWakeTarget {
  if (typeof value !== "string") throw new Error("Runner job target is invalid");
  const target = value.trim().toLowerCase();
  if ((RUNNER_WAKE_TARGETS as readonly string[]).includes(target)) {
    return target as RunnerWakeTarget;
  }
  throw new Error("Runner job target is invalid");
}

export async function enqueueRunnerJobWake(input: {
  jobId: string;
  target: RunnerWakeTarget;
}): Promise<{ accepted: boolean; duplicate: boolean; queued: boolean }> {
  assertRunnerCutoverActive();
  const candidate = (typeof input === "object" && input !== null)
    ? input as { jobId?: unknown; target?: unknown }
    : {};
  const jobId = normalizeJobId(candidate.jobId);
  const target = normalizeTarget(candidate.target);
  const event: RunnerJobWakeEvent = { version: 1, jobId, target };

  return await enqueueResilienceQueueEvent({
    idempotencyKey: `runner-job-wakeup:${jobId}`,
    workloadType: "background",
    eventType: RUNNER_JOB_WAKE_EVENT,
    scope: "runner_job",
    value: event,
  });
}
