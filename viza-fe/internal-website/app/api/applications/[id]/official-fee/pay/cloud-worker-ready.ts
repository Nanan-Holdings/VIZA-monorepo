import type {
  FlyMachineWakeResult,
  HttpReadinessResult,
} from "@/lib/fly-machine-wake.server";
import {
  wakeCloudSubmissionWorker,
  type SubmissionWorkerWakeResult,
} from "@/lib/submission-worker-wake.server";

type WakeLegacy = () => Promise<FlyMachineWakeResult>;
type WaitUntilReady = (url: string) => Promise<HttpReadinessResult>;
type WakeSubmissionJob = (
  jobId: string | null,
  options: { target: string },
) => Promise<SubmissionWorkerWakeResult>;

export const VIETNAM_CARD_HANDOFF_BUDGET_MS = 40_000;
const VIETNAM_CARD_SESSION_RESERVE_MS = 10_000;
const VIETNAM_WAKE_MAX_WAIT_MS = 15_000;
const VIETNAM_READY_MAX_WAIT_MS = 20_000;
const VIETNAM_CARD_POST_MAX_WAIT_MS = 8_000;

export function vietnamCardWakeTimeoutMs(
  deadlineAt: number,
  now = Date.now(),
): number {
  return Math.min(
    VIETNAM_WAKE_MAX_WAIT_MS,
    Math.max(0, deadlineAt - now - VIETNAM_CARD_SESSION_RESERVE_MS),
  );
}

export function vietnamCardReadinessTimeoutMs(
  deadlineAt: number,
  now = Date.now(),
): number {
  return Math.min(
    VIETNAM_READY_MAX_WAIT_MS,
    Math.max(0, deadlineAt - now - VIETNAM_CARD_SESSION_RESERVE_MS),
  );
}

export function vietnamCardPostTimeoutMs(
  deadlineAt: number,
  now = Date.now(),
): number {
  return Math.min(
    VIETNAM_CARD_POST_MAX_WAIT_MS,
    Math.max(0, deadlineAt - now),
  );
}

type FlyWakeFailureReason =
  | Extract<FlyMachineWakeResult, { ok: false }>["reason"]
  | "timeout";

export type CloudWorkerReadyResult =
  | { ok: true }
  | { ok: false; reason: "wake_failed"; wakeReason: FlyWakeFailureReason }
  | { ok: false; reason: "readiness_timeout"; attempts: number };

export type VietnamCardSessionPostResult =
  | { ok: true; redactedCard: unknown; expiresAtIso: string | null }
  | { ok: false; error: string; retryable?: boolean };

export type VietnamCardHandoffResult =
  | Extract<VietnamCardSessionPostResult, { ok: true }>
  | {
      ok: false;
      stage: "ready";
      reason: Extract<CloudWorkerReadyResult, { ok: false }>["reason"];
      attempts?: number;
      wakeReason?: FlyWakeFailureReason;
    }
  | { ok: false; stage: "post"; error: string };

export async function wakeQueuedVietnamPaymentJob(
  queueId: string,
  wakeSubmissionJob: WakeSubmissionJob = wakeCloudSubmissionWorker,
): Promise<SubmissionWorkerWakeResult> {
  return wakeSubmissionJob(queueId, { target: "legacy" });
}

export async function ensureVietnamCardWorkerReady(input: {
  baseUrl: string;
  wakeLegacy: WakeLegacy;
  waitUntilReady: WaitUntilReady;
  wakeTimeoutMs?: number;
}): Promise<CloudWorkerReadyResult> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const wakeTimeoutMs = input.wakeTimeoutMs;
  const wake = wakeTimeoutMs === undefined
    ? await input.wakeLegacy()
    : await Promise.race([
        input.wakeLegacy(),
        new Promise<null>((resolve) => {
          timeout = setTimeout(
            () => resolve(null),
            Math.max(0, wakeTimeoutMs),
          );
        }),
      ]).finally(() => {
        if (timeout) clearTimeout(timeout);
      });
  if (!wake) {
    return { ok: false, reason: "wake_failed", wakeReason: "timeout" };
  }
  if (!wake.ok) {
    return { ok: false, reason: "wake_failed", wakeReason: wake.reason };
  }

  const ready = await input.waitUntilReady(`${input.baseUrl}/ready`);
  if (!ready.ok) {
    return {
      ok: false,
      reason: "readiness_timeout",
      attempts: ready.attempts,
    };
  }
  return { ok: true };
}

export async function recoverVietnamCardHandoff(input: {
  ensureReady: () => Promise<CloudWorkerReadyResult>;
  postCardSession: () => Promise<VietnamCardSessionPostResult>;
  maxAttempts?: number;
  deadlineAt?: number;
  now?: () => number;
}): Promise<VietnamCardHandoffResult> {
  const maxAttempts = Math.max(1, Math.min(3, input.maxAttempts ?? 3));
  const now = input.now ?? Date.now;
  let lastFailure: VietnamCardHandoffResult = {
    ok: false,
    stage: "post",
    error: "card_session_handoff_timeout",
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (
      input.deadlineAt !== undefined &&
      input.deadlineAt - now() <= VIETNAM_CARD_SESSION_RESERVE_MS
    ) {
      break;
    }
    const ready = await input.ensureReady();
    if (!ready.ok) {
      lastFailure = {
        ok: false,
        stage: "ready",
        reason: ready.reason,
        attempts: "attempts" in ready ? ready.attempts : undefined,
        wakeReason: "wakeReason" in ready ? ready.wakeReason : undefined,
      };
      continue;
    }
    if (input.deadlineAt !== undefined && now() >= input.deadlineAt) {
      break;
    }

    const post = await input.postCardSession();
    if (post.ok) return post;
    lastFailure = { ok: false, stage: "post", error: post.error };
    if (post.retryable === false) return lastFailure;
  }

  return lastFailure;
}
