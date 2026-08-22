export interface PoolConcurrencyHealth {
  country: string;
  max_concurrent: number;
  paused: boolean;
  claimable: number;
  scheduled: number;
  running: number;
  expired_running: number;
  capacity_headroom: number;
  oldest_claimable_at: string | null;
  oldest_claimable_age_seconds: number | null;
}

export interface SlotCapacityHealth {
  max_slots: number;
  live_slots: number;
  free_slots: number;
  pool_live_slots: number;
  sticky_live_slots: number;
  expired_owned_slots: number;
  stale_renewal_slots: number;
  utilization_percent: number;
}

export interface ConcurrencyMetric {
  event_type: "claim" | "machine_start";
  outcome: string;
  duration_ms: number | null;
  country: string | null;
  machine_kind: string | null;
  count: number;
  recorded_at: string;
}

export interface ConcurrencyAlertInput {
  poolHealth: readonly PoolConcurrencyHealth[];
  slotHealth: SlotCapacityHealth | null;
  metrics: readonly ConcurrencyMetric[];
}

export type ConcurrencyAlert =
  | "capacity_health_unavailable"
  | "claim_metrics_unavailable"
  | "claim_p95_high"
  | "oldest_claimable_high"
  | "capacity_overshoot"
  | "expired_slots"
  | "stale_slot_renewals";

export function percentile(values: readonly number[], quantile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * quantile) - 1));
  return sorted[index];
}

export function deriveConcurrencyAlerts(input: ConcurrencyAlertInput): ConcurrencyAlert[] {
  const alerts: ConcurrencyAlert[] = [];
  const expectedCountries = new Set([
    "vietnam",
    "singapore",
    "malaysia",
    "thailand",
    "south_korea",
    "taiwan",
  ]);
  const observedCountries = new Set(input.poolHealth.map((row) => row.country));
  const hasCompletePoolHealth =
    observedCountries.size === expectedCountries.size
    && [...expectedCountries].every((country) => observedCountries.has(country));
  if (!input.slotHealth || Number(input.slotHealth.max_slots) !== 10 || !hasCompletePoolHealth) {
    alerts.push("capacity_health_unavailable");
  }
  const claimDurations = input.metrics
    .filter((metric) => metric.event_type === "claim" && metric.duration_ms != null)
    .map((metric) => Number(metric.duration_ms))
    .filter((duration) => Number.isFinite(duration) && duration >= 0);
  if (claimDurations.length === 0) alerts.push("claim_metrics_unavailable");
  const claimP95 = percentile(claimDurations, 0.95);
  if (claimP95 != null && claimP95 >= 500) alerts.push("claim_p95_high");

  const oldestClaimableAge = input.poolHealth.reduce((maxAge, row) => {
    if (row.paused || Number(row.claimable) <= 0) return maxAge;
    return Math.max(maxAge, Number(row.oldest_claimable_age_seconds ?? 0));
  }, 0);
  if (oldestClaimableAge > 120 && Number(input.slotHealth?.free_slots ?? 0) > 0) {
    alerts.push("oldest_claimable_high");
  }
  if (input.poolHealth.some((row) => Number(row.running) > Number(row.max_concurrent))) {
    alerts.push("capacity_overshoot");
  }
  const expiredRunning = input.poolHealth.some((row) => Number(row.expired_running) > 0);
  if (expiredRunning || Number(input.slotHealth?.expired_owned_slots ?? 0) > 0) alerts.push("expired_slots");
  if (Number(input.slotHealth?.stale_renewal_slots ?? 0) > 0) alerts.push("stale_slot_renewals");
  return alerts;
}
