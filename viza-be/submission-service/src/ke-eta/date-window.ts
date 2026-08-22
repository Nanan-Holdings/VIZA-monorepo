const DAY_MS = 24 * 60 * 60 * 1_000;

export type KeEtaScheduleStatus = "scheduled" | "ready" | "expired" | "invalid";

export interface KeEtaScheduleDecision {
  status: KeEtaScheduleStatus;
  arrivalDate: string;
  submitAt: string | null;
  expectedValidityUntil: string | null;
  reason: string;
}

function parseDate(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = Date.parse(`${value}T12:00:00.000Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/**
 * Kenya eTA should be requested before travel and is valid for 90 days from
 * issue. The default queue policy opens the official submission window 14
 * days before arrival, which avoids consuming validity too early.
 */
export function computeKeEtaSchedule(
  arrivalDate: string,
  now = new Date(),
  leadDays = 14,
  validityDays = 90,
): KeEtaScheduleDecision {
  const arrivalAt = parseDate(arrivalDate);
  if (arrivalAt === null || leadDays < 0 || validityDays <= 0) {
    return {
      status: "invalid",
      arrivalDate,
      submitAt: null,
      expectedValidityUntil: null,
      reason: "Arrival date or schedule policy is invalid.",
    };
  }
  const submitAt = arrivalAt - leadDays * DAY_MS;
  const nowAt = now.getTime();
  if (arrivalAt < nowAt - DAY_MS) {
    return {
      status: "expired",
      arrivalDate,
      submitAt: new Date(submitAt).toISOString(),
      expectedValidityUntil: new Date(submitAt + validityDays * DAY_MS).toISOString(),
      reason: "Arrival date is in the past; do not create a new eTA submission.",
    };
  }
  const status: KeEtaScheduleStatus = nowAt < submitAt ? "scheduled" : "ready";
  return {
    status,
    arrivalDate,
    submitAt: new Date(submitAt).toISOString(),
    expectedValidityUntil: new Date(submitAt + validityDays * DAY_MS).toISOString(),
    reason: status === "scheduled"
      ? `Queue for ${isoDate(submitAt)} before submitting the official eTA.`
      : "The default pre-arrival submission window is open.",
  };
}
