import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const withAdminMock = vi.hoisted(() => vi.fn());
const ensureFlyMachineCapacityMock = vi.hoisted(() => vi.fn());
const wakeCloudSubmissionWorkerMock = vi.hoisted(() => vi.fn());
const enqueueRunnerJobWakeMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/with-admin", () => ({ withAdmin: withAdminMock }));
vi.mock("@/lib/fly-machine-wake.server", () => ({
  ensureFlyMachineCapacity: ensureFlyMachineCapacityMock,
}));
vi.mock("@/lib/submission-worker-wake.server", () => ({
  wakeCloudSubmissionWorker: wakeCloudSubmissionWorkerMock,
}));
vi.mock("@/lib/resilience/runner-job-wakeup", () => ({
  enqueueRunnerJobWake: enqueueRunnerJobWakeMock,
}));

import { desiredRunnerPoolCapacity, enqueueRunnerPoolJob } from "./enqueue";

type RpcRow = {
  runner_job_id: string | null;
  reused_existing: boolean;
  blocked_by_legacy: boolean;
  legacy_queue_id: string | null;
  legacy_queue_status: string | null;
};

type RunnerJobState = {
  id: string;
  status: string;
  available_at: string | null;
};

function configureAdmin(
  row: Partial<RpcRow> = {},
  depthRows = [{
    max_concurrent: 10,
    paused: false,
    claimable: 1,
    running: 0,
  }],
  runnerJobState: RunnerJobState | null = {
    id: "job-1",
    status: "queued",
    available_at: null,
  },
  runnerJobError: { message: string } | null = null,
) {
  const rpc = vi.fn().mockResolvedValue({
    data: {
      runner_job_id: "job-1",
      reused_existing: false,
      blocked_by_legacy: false,
      legacy_queue_id: null,
      legacy_queue_status: null,
      ...row,
    },
    error: null,
  });
  const depthQuery = {
    select: vi.fn(() => depthQuery),
    data: depthRows,
    error: null,
  };
  const runnerJobQuery = {
    select: vi.fn(() => runnerJobQuery),
    eq: vi.fn(() => runnerJobQuery),
    maybeSingle: vi.fn().mockResolvedValue({ data: runnerJobState, error: runnerJobError }),
  };
  withAdminMock.mockImplementation(async (_mode: string, actor: string, fn: (admin: unknown) => Promise<unknown>) => {
    if (actor === "lib/queue:pool-depth") {
      return fn({ from: vi.fn(() => depthQuery) });
    }
    return fn({
      rpc,
      from: vi.fn((table: string) => {
        if (table !== "runner_job") throw new Error(`unexpected table: ${table}`);
        return runnerJobQuery;
      }),
    });
  });
  return { rpc };
}

describe("runner pool enqueue wake transport", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    delete process.env.RESILIENCE_RUNNER_WAKE_ENABLED;
    ensureFlyMachineCapacityMock.mockReset();
    wakeCloudSubmissionWorkerMock.mockReset();
    enqueueRunnerJobWakeMock.mockReset();
    ensureFlyMachineCapacityMock.mockResolvedValue({ ok: true, desired: 1 });
    wakeCloudSubmissionWorkerMock.mockResolvedValue({ ok: true });
    enqueueRunnerJobWakeMock.mockResolvedValue({ accepted: true, duplicate: false, queued: true });
    configureAdmin();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => warnSpy.mockRestore());

  it("publishes a Queue wake after a committed runner_job", async () => {
    process.env.RESILIENCE_RUNNER_WAKE_ENABLED = "true";

    const result = await enqueueRunnerPoolJob("app-1", "vietnam", "vn_evisa");

    expect(enqueueRunnerJobWakeMock).toHaveBeenCalledWith({ jobId: "job-1", target: "pool" });
    expect(wakeCloudSubmissionWorkerMock).not.toHaveBeenCalled();
    expect(result.workerTriggered).toBe(true);
  });

  it("reuses the bounded runner_pool_depth capacity policy", async () => {
    configureAdmin({}, [
      { max_concurrent: 4, paused: false, claimable: 3, running: 2 },
      { max_concurrent: 20, paused: false, claimable: 8, running: 8 },
      { max_concurrent: 10, paused: true, claimable: 10, running: 10 },
    ]);

    await expect(desiredRunnerPoolCapacity()).resolves.toBe(10);
  });

  it("falls back to a direct wake when Queue publishing throws", async () => {
    process.env.RESILIENCE_RUNNER_WAKE_ENABLED = "on";
    enqueueRunnerJobWakeMock.mockRejectedValue(new Error("gateway unavailable"));

    const result = await enqueueRunnerPoolJob("app-1", "vietnam", "vn_evisa");

    expect(wakeCloudSubmissionWorkerMock).toHaveBeenCalledWith("job-1", { target: "pool" });
    expect(result.workerTriggered).toBe(true);
  });

  it.each([undefined, "false", "off", "0", "TRUE "])("keeps direct wake behavior when flag is %s", async (flag) => {
    if (flag === undefined) delete process.env.RESILIENCE_RUNNER_WAKE_ENABLED;
    else process.env.RESILIENCE_RUNNER_WAKE_ENABLED = flag;

    const result = await enqueueRunnerPoolJob("app-1", "vietnam", "vn_evisa");

    expect(enqueueRunnerJobWakeMock).not.toHaveBeenCalled();
    expect(wakeCloudSubmissionWorkerMock).toHaveBeenCalledWith("job-1", { target: "pool" });
    expect(result.workerTriggered).toBe(true);
  });

  it.each([
    { accepted: true, duplicate: false, queued: false },
    { accepted: false, duplicate: true, queued: true },
  ])("treats accepted or duplicate Queue responses as triggered (%o)", async (queueResult) => {
    process.env.RESILIENCE_RUNNER_WAKE_ENABLED = "1";
    enqueueRunnerJobWakeMock.mockResolvedValue(queueResult);

    const result = await enqueueRunnerPoolJob("app-1", "vietnam", "vn_evisa");

    expect(wakeCloudSubmissionWorkerMock).not.toHaveBeenCalled();
    expect(result.workerTriggered).toBe(true);
  });

  it("falls back when the Queue response is unusable", async () => {
    process.env.RESILIENCE_RUNNER_WAKE_ENABLED = "true";
    enqueueRunnerJobWakeMock.mockResolvedValue({ accepted: false, duplicate: false, queued: false });

    const result = await enqueueRunnerPoolJob("app-1", "vietnam", "vn_evisa");

    expect(wakeCloudSubmissionWorkerMock).toHaveBeenCalledWith("job-1", { target: "pool" });
    expect(result.workerTriggered).toBe(true);
  });

  it("does not queue or directly wake future pool work when Queue mode is enabled", async () => {
    process.env.RESILIENCE_RUNNER_WAKE_ENABLED = "true";
    const availableAt = new Date(Date.now() + 60_000).toISOString();

    const result = await enqueueRunnerPoolJob("app-1", "vietnam", "vn_evisa", { availableAt });

    expect(enqueueRunnerJobWakeMock).not.toHaveBeenCalled();
    expect(wakeCloudSubmissionWorkerMock).not.toHaveBeenCalled();
    expect(result.workerTriggered).toBe(false);
  });

  it("does not wake a future legacy collision when Queue mode is enabled", async () => {
    process.env.RESILIENCE_RUNNER_WAKE_ENABLED = "on";
    configureAdmin({
      blocked_by_legacy: true,
      runner_job_id: null,
      legacy_queue_id: "legacy-1",
      legacy_queue_status: "sgac_live_assisted_scheduled",
    });
    const availableAt = new Date(Date.now() + 60_000).toISOString();

    const result = await enqueueRunnerPoolJob("app-1", "singapore", "sgac", { availableAt });

    expect(enqueueRunnerJobWakeMock).not.toHaveBeenCalled();
    expect(wakeCloudSubmissionWorkerMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ transport: "submission_queue", workerTriggered: false });
  });

  it("uses the canonical runner_job available_at for a legacy collision", async () => {
    process.env.RESILIENCE_RUNNER_WAKE_ENABLED = "1";
    configureAdmin({
      blocked_by_legacy: true,
      runner_job_id: "job-1",
      legacy_queue_id: "legacy-1",
      legacy_queue_status: "sgac_live_assisted_scheduled",
    }, undefined, {
      id: "job-1",
      status: "queued",
      available_at: new Date(Date.now() + 60_000).toISOString(),
    });

    const result = await enqueueRunnerPoolJob("app-1", "singapore", "sgac");

    expect(enqueueRunnerJobWakeMock).not.toHaveBeenCalled();
    expect(wakeCloudSubmissionWorkerMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ transport: "submission_queue", workerTriggered: false });
  });

  it.each([
    { label: "missing", state: null, error: null },
    { label: "lookup error", state: null, error: { message: "database unavailable" } },
  ])("fails closed when the canonical runner_job state is $label", async ({ state, error }) => {
    process.env.RESILIENCE_RUNNER_WAKE_ENABLED = "true";
    configureAdmin({}, undefined, state, error);

    const result = await enqueueRunnerPoolJob("app-1", "vietnam", "vn_evisa");

    expect(enqueueRunnerJobWakeMock).not.toHaveBeenCalled();
    expect(wakeCloudSubmissionWorkerMock).not.toHaveBeenCalled();
    expect(result.workerTriggered).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      "[runner-pool] Authoritative runner state unavailable; reconciler will recover.",
      { jobId: "job-1", reason: "authoritative_state_unavailable" },
    );
  });

  it("does not wake or publish when the enqueue RPC fails", async () => {
    const { rpc } = configureAdmin();
    rpc.mockRejectedValue(new Error("database unavailable"));

    await expect(enqueueRunnerPoolJob("app-1", "vietnam", "vn_evisa")).rejects.toThrow("database unavailable");
    expect(enqueueRunnerJobWakeMock).not.toHaveBeenCalled();
    expect(wakeCloudSubmissionWorkerMock).not.toHaveBeenCalled();
  });

  it("does not wake or publish without a durable runner job id", async () => {
    configureAdmin({ runner_job_id: null });

    await expect(enqueueRunnerPoolJob("app-1", "vietnam", "vn_evisa")).rejects.toThrow("no runner job id");
    expect(enqueueRunnerJobWakeMock).not.toHaveBeenCalled();
    expect(wakeCloudSubmissionWorkerMock).not.toHaveBeenCalled();
  });
});
