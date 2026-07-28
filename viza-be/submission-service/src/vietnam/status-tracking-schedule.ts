import { createHash } from "node:crypto";

const VIETNAM_TIME_OFFSET_MS = 7 * 60 * 60 * 1_000;

export interface VietnamTrackingSlot {
  hour: number;
  minute: number;
  nextDailyCheckAt: string;
}

export function computeVietnamTrackingSlot(
  applicationId: string,
  now = new Date(),
): VietnamTrackingSlot {
  const digest = createHash("sha256").update(applicationId).digest();
  const distributedMinutes = digest.readUInt16BE(0) % 180;
  const hour = 2 + Math.floor(distributedMinutes / 60);
  const minute = distributedMinutes % 60;
  const vietnamNow = new Date(now.getTime() + VIETNAM_TIME_OFFSET_MS);
  let nextUtcMs = Date.UTC(
    vietnamNow.getUTCFullYear(),
    vietnamNow.getUTCMonth(),
    vietnamNow.getUTCDate(),
    hour - 7,
    minute,
    0,
    0,
  );
  if (nextUtcMs <= now.getTime()) {
    nextUtcMs += 24 * 60 * 60 * 1_000;
  }
  return {
    hour,
    minute,
    nextDailyCheckAt: new Date(nextUtcMs).toISOString(),
  };
}
