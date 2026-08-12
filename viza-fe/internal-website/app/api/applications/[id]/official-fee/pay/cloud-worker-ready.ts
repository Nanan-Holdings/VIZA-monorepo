import type {
  FlyMachineWakeResult,
  HttpReadinessResult,
} from "@/lib/fly-machine-wake.server";

type WakeLegacy = () => Promise<FlyMachineWakeResult>;
type WaitUntilReady = (url: string) => Promise<HttpReadinessResult>;

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
