import { describe, expect, it } from "vitest";
import { deriveConcurrencyAlerts, percentile } from "./page";

describe("runner concurrency admin signals", () => {
  it("uses an upper-tail p95 and returns null for missing samples", () => {
    expect(percentile([], 0.95)).toBeNull();
    expect(percentile([100, 200, 900, 300], 0.95)).toBe(900);
  });

  it("surfaces every required fail-closed alert from the DB health contract", () => {
    const alerts = deriveConcurrencyAlerts({
      poolHealth: [
        {
          country: "vn",
          max_concurrent: 2,
          paused: false,
          claimable: 1,
          scheduled: 0,
          running: 3,
          expired_running: 0,
          capacity_headroom: 0,
          oldest_claimable_at: new Date(Date.now() - 121_000).toISOString(),
          oldest_claimable_age_seconds: 121,
        },
      ],
      slotHealth: {
        max_slots: 10,
        live_slots: 8,
        free_slots: 2,
        pool_live_slots: 8,
        sticky_live_slots: 0,
        expired_owned_slots: 1,
        stale_renewal_slots: 1,
        utilization_percent: 80,
      },
      metrics: [
        {
          event_type: "claim",
          outcome: "claimed",
          duration_ms: 600,
          country: "vn",
          machine_kind: "pool",
          count: 1,
          recorded_at: new Date().toISOString(),
        },
      ],
    });

    expect(alerts).toEqual([
      "claim_p95_high",
      "oldest_claimable_high",
      "capacity_overshoot",
      "expired_slots",
      "stale_slot_renewals",
    ]);
  });

  it("does not claim green when the required health rows or samples are absent", () => {
    expect(
      deriveConcurrencyAlerts({ poolHealth: [], slotHealth: null, metrics: [] }),
    ).toEqual(["capacity_health_unavailable", "claim_metrics_unavailable"]);
  });
});
