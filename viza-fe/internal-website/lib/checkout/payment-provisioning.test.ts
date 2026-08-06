import { describe, expect, it } from "vitest";
import {
  executePaymentProvisioningSteps,
  isPayableOrderStatus,
  recordCommercialPaymentPaid,
  type PaymentProvisioningJob,
  type ProvisioningStepRunner,
} from "./payment-provisioning";

const account = {
  authUserId: "user-1",
  applicantId: "profile-1",
  applicationId: "application-1",
  country: "vietnam",
  visaType: "evisa",
};

function job(overrides: Partial<PaymentProvisioningJob> = {}): PaymentProvisioningJob {
  return {
    id: "job-1",
    order_id: "order-1",
    provider: "stripe",
    status: "running",
    user_status: "pending",
    profile_status: "pending",
    application_status: "pending",
    inbox_status: "pending",
    runner_status: "pending",
    allocation_status: "completed",
    attempts: 1,
    max_attempts: 8,
    ...overrides,
  };
}

function fakeRunner(params: {
  initialJob?: PaymentProvisioningJob;
  failInboxOnce?: boolean;
  failRunnerMarkOnce?: boolean;
}) {
  const state = { ...(params.initialJob ?? job()) };
  let inboxFailures = params.failInboxOnce ? 1 : 0;
  let runnerMarkFailures = params.failRunnerMarkOnce ? 1 : 0;
  let runnerCalls = 0;
  const runner: ProvisioningStepRunner = {
    loadAccount: async () => account,
    ensureAccount: async () => account,
    ensureAllocation: async () => undefined,
    ensureInbox: async () => {
      if (inboxFailures > 0) {
        inboxFailures -= 1;
        throw new Error("temporary inbox outage");
      }
    },
    enqueueRunner: async () => {
      runnerCalls += 1;
    },
    markStep: async (patch) => {
      if (runnerMarkFailures > 0 && patch.runner_status === "completed") {
        runnerMarkFailures -= 1;
        throw new Error("worker restarted after runner enqueue");
      }
      Object.assign(state, patch);
    },
  };
  return { runner, state, getRunnerCalls: () => runnerCalls };
}

describe("payment provisioning state machine", () => {
  it("resumes after a partial failure without repeating completed account work", async () => {
    const first = fakeRunner({ failInboxOnce: true });
    await expect(executePaymentProvisioningSteps(job(), first.runner)).rejects.toThrow("inbox outage");
    expect(first.state.user_status).toBe("completed");
    expect(first.state.application_status).toBe("completed");

    const second = fakeRunner({
      initialJob: first.state,
    });
    await executePaymentProvisioningSteps(second.state, second.runner);
    expect(second.state.inbox_status).toBe("completed");
    expect(second.state.runner_status).toBe("completed");
  });

  it("recovers a runner enqueue after a worker restart", async () => {
    const first = fakeRunner({ failRunnerMarkOnce: true });
    await expect(executePaymentProvisioningSteps(job({
      user_status: "completed",
      profile_status: "completed",
      application_status: "completed",
      inbox_status: "completed",
    }), first.runner)).rejects.toThrow("worker restarted");
    expect(first.getRunnerCalls()).toBe(1);

    const second = fakeRunner({
      initialJob: {
        ...job({
          user_status: "completed",
          profile_status: "completed",
          application_status: "completed",
          inbox_status: "completed",
        }),
      },
    });
    await executePaymentProvisioningSteps(second.state, second.runner);
    expect(second.state.runner_status).toBe("completed");
  });

  it("uses the provider event id as the duplicate webhook key", async () => {
    const responses = [
      { event_id: "event-1", job_id: "job-1", event_replayed: false },
      { event_id: "event-1", job_id: "job-1", event_replayed: true },
    ];
    const admin = {
      rpc: async () => ({ data: [responses.shift()], error: null }),
    };

    const first = await recordCommercialPaymentPaid(admin as never, {
      orderId: "order-1",
      provider: "stripe",
      providerEventId: " evt_123 ",
      payloadRedacted: { checkout_session_id: "cs_test" },
    });
    const second = await recordCommercialPaymentPaid(admin as never, {
      orderId: "order-1",
      provider: "stripe",
      providerEventId: "evt_123",
    });
    expect(first).toEqual({ eventId: "event-1", jobId: "job-1", replayed: false });
    expect(second).toEqual({ eventId: "event-1", jobId: "job-1", replayed: true });
  });

  it("does not allow a delayed success to revive a non-payable order", () => {
    expect(isPayableOrderStatus("refunded")).toBe(false);
    expect(isPayableOrderStatus("disputed")).toBe(false);
    expect(isPayableOrderStatus("paid")).toBe(true);
  });
});
