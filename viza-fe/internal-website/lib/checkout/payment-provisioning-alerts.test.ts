import { describe, expect, it } from "vitest";
import {
  PAYMENT_PROVISIONING_STALE_AFTER_MS,
  classifyProvisioningAlert,
  reconcilePaymentProvisioningAlerts,
  type ProvisioningAlertJob,
  type ProvisioningAlertRepository,
} from "./payment-provisioning-alerts";

const now = new Date("2026-09-09T12:00:00.000Z");

function job(overrides: Partial<ProvisioningAlertJob> = {}): ProvisioningAlertJob {
  return {
    id: "job-1",
    order_id: "order-1",
    provider: "stripe",
    status: "retry",
    attempts: 2,
    max_attempts: 8,
    created_at: new Date(now.getTime() - PAYMENT_PROVISIONING_STALE_AFTER_MS).toISOString(),
    updated_at: new Date(now.getTime() - 60_000).toISOString(),
    ...overrides,
  };
}

function repository(params: {
  jobs?: ProvisioningAlertJob[];
  workItems?: Awaited<ReturnType<ProvisioningAlertRepository["listWorkItems"]>>;
}) {
  const creates: Parameters<ProvisioningAlertRepository["createWorkItem"]>[0][] = [];
  const updates: Array<{ id: string; patch: Parameters<ProvisioningAlertRepository["updateWorkItem"]>[1] }> = [];
  const repo: ProvisioningAlertRepository = {
    listJobs: async () => params.jobs ?? [],
    listWorkItems: async () => params.workItems ?? [],
    createWorkItem: async (input) => {
      creates.push(input);
      return "created";
    },
    updateWorkItem: async (id, patch) => {
      updates.push({ id, patch });
    },
  };
  return { repo, creates, updates };
}

describe("payment provisioning alert reconciliation", () => {
  it("opens at the retry age boundary but not one millisecond before it", () => {
    expect(classifyProvisioningAlert(job(), now.getTime())).toMatchObject({
      reason: "stale_retry",
      priority: "p1",
      ageMs: PAYMENT_PROVISIONING_STALE_AFTER_MS,
    });
    expect(classifyProvisioningAlert(job({
      created_at: new Date(now.getTime() - PAYMENT_PROVISIONING_STALE_AFTER_MS + 1).toISOString(),
    }), now.getTime())).toBeNull();
    expect(classifyProvisioningAlert(job({ status: "running" }), now.getTime())).toMatchObject({
      reason: "stale_running",
      priority: "p1",
    });
    expect(classifyProvisioningAlert(job({ status: "queued" }), now.getTime())).toMatchObject({
      reason: "stale_queued",
      priority: "p1",
    });
  });

  it("flags dead letters immediately, including free beta provisioning", async () => {
    const state = repository({
      jobs: [job({
        provider: "free",
        status: "dead_letter",
        created_at: new Date(now.getTime() - 1).toISOString(),
      })],
    });
    const result = await reconcilePaymentProvisioningAlerts(state.repo, { now });

    expect(result).toEqual({ opened: 1, reopened: 0, escalated: 0, resolved: 0 });
    expect(state.creates[0]).toMatchObject({
      dedupe_key: "payment-provisioning-alert:job-1",
      priority: "p0",
      order_id: "order-1",
      metadata_redacted: { provider: "free", alert_reason: "dead_letter" },
    });
  });

  it("deduplicates an already-active alert and escalates it only once at dead letter", async () => {
    const workItem = {
      id: "work-1",
      source_id: "job-1",
      status: "open" as const,
      priority: "p1" as const,
      metadata_redacted: { alert_active: true },
    };
    const first = repository({ jobs: [job()], workItems: [workItem] });
    expect(await reconcilePaymentProvisioningAlerts(first.repo, { now })).toEqual({
      opened: 0, reopened: 0, escalated: 0, resolved: 0,
    });
    expect(first.creates).toEqual([]);
    expect(first.updates).toEqual([]);

    const dead = repository({
      jobs: [job({ status: "dead_letter" })],
      workItems: [workItem],
    });
    expect(await reconcilePaymentProvisioningAlerts(dead.repo, { now })).toMatchObject({ escalated: 1 });
    expect(dead.updates).toHaveLength(1);
    expect(dead.updates[0].patch).toMatchObject({ priority: "p0" });
  });

  it("resolves on recovery and reopens the same durable item on relapse", async () => {
    const active = {
      id: "work-1",
      source_id: "job-1",
      status: "open" as const,
      priority: "p1" as const,
      metadata_redacted: { alert_active: true },
    };
    const recovered = repository({
      jobs: [job({ status: "succeeded" })],
      workItems: [active],
    });
    expect(await reconcilePaymentProvisioningAlerts(recovered.repo, { now })).toMatchObject({ resolved: 1 });
    expect(recovered.updates[0].patch).toMatchObject({
      status: "resolved",
      resolution_code: "provisioning_recovered",
      metadata_redacted: { alert_active: false, recovered_status: "succeeded" },
    });

    const relapsed = repository({
      jobs: [job({ status: "dead_letter" })],
      workItems: [{
        ...active,
        status: "resolved",
        metadata_redacted: { alert_active: false },
      }],
    });
    expect(await reconcilePaymentProvisioningAlerts(relapsed.repo, { now })).toMatchObject({ reopened: 1 });
    expect(relapsed.creates).toEqual([]);
    expect(relapsed.updates[0].patch).toMatchObject({
      status: "open",
      priority: "p0",
      resolved_at: null,
      metadata_redacted: { alert_active: true, alert_reason: "dead_letter" },
    });
  });
});
