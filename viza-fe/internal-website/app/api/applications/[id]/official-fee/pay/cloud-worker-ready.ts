import type {
  FlyMachineWakeResult,
  HttpReadinessResult,
} from "@/lib/fly-machine-wake.server";

type WakeLegacy = () => Promise<FlyMachineWakeResult>;
type WaitUntilReady = (url: string) => Promise<HttpReadinessResult>;

export const VIETNAM_CARD_HANDOFF_BUDGET_MS = 40_000;
const VIETNAM_CARD_SESSION_RESERVE_MS = 10_000;
const VIETNAM_READY_MAX_WAIT_MS = 20_000;
const VIETNAM_CARD_POST_MAX_WAIT_MS = 8_000;

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

export type CloudWorkerReadyResult =
  | { ok: true }
  | { ok: false; reason: "wake_failed" | "readiness_timeout"; attempts?: number };

export async function ensureVietnamCardWorkerReady(input: {
  baseUrl: string;
  wakeLegacy: WakeLegacy;
  waitUntilReady: WaitUntilReady;
}): Promise<CloudWorkerReadyResult> {
  const wake = await input.wakeLegacy();
  if (!wake.ok) return { ok: false, reason: "wake_failed" };

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
