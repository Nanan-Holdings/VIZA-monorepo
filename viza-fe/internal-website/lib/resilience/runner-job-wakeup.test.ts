import { beforeEach, describe, expect, it, vi } from "vitest";

const enqueueResilienceQueueEventMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("./gateway", () => ({
  enqueueResilienceQueueEvent: enqueueResilienceQueueEventMock,
}));

import { enqueueRunnerJobWake } from "./runner-job-wakeup";

describe("runner job wake resilience events", () => {
  beforeEach(() => {
    delete process.env.RUNNER_CUTOVER_PAUSED;
    enqueueResilienceQueueEventMock.mockReset();
    enqueueResilienceQueueEventMock.mockResolvedValue({
      accepted: true,
      duplicate: false,
      queued: true,
    });
  });

  it("blocks Queue publication during a controlled cutover", async () => {
    process.env.RUNNER_CUTOVER_PAUSED = "true";

    await expect(enqueueRunnerJobWake({ jobId: "job-1", target: "pool" }))
      .rejects.toMatchObject({ code: "runner_cutover_paused" });
    expect(enqueueResilienceQueueEventMock).not.toHaveBeenCalled();
  });

  it("publishes an encrypted background pointer for a pool job", async () => {
    await enqueueRunnerJobWake({ jobId: "job-1", target: "pool" });

    expect(enqueueResilienceQueueEventMock).toHaveBeenCalledWith({
      idempotencyKey: "runner-job-wakeup:job-1",
      workloadType: "background",
      eventType: "runner_job.wakeup.v1",
      scope: "runner_job",
      value: { version: 1, jobId: "job-1", target: "pool" },
    });
  });

  it("rejects a missing or blank runner job id", async () => {
    await expect(enqueueRunnerJobWake({ jobId: "   ", target: "pool" }))
      .rejects.toThrow("Runner job id is required");

    expect(enqueueResilienceQueueEventMock).not.toHaveBeenCalled();
  });

  it("rejects an untyped runner target outside the managed target set", async () => {
    const untypedInput = {
      jobId: "job-1",
      target: "mars",
    } as unknown as Parameters<typeof enqueueRunnerJobWake>[0];

    await expect(enqueueRunnerJobWake(untypedInput))
      .rejects.toThrow("Runner job target is invalid");

    expect(enqueueResilienceQueueEventMock).not.toHaveBeenCalled();
  });
});
