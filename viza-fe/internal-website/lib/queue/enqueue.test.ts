import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const withAdminMock = vi.hoisted(() => vi.fn());
const ensureFlyMachineCapacityMock = vi.hoisted(() => vi.fn());
const wakeCloudSubmissionWorkerMock = vi.hoisted(() => vi.fn());
const enqueueRunnerJobWakeMock = vi.hoisted(() => vi.fn());
const authorityTables: string[] = [];
const authoritySelects: string[] = [];

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

import { desiredRunnerPoolCapacity, enqueueRunnerJob, enqueueRunnerPoolJob } from "./enqueue";

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
  available_at?: string | null;
};

function configureAdmin(
  row: Partial<RpcRow> = {},
  depthRows = [{
    max_concurrent: 10,
    paused: false,
    claimable: 1,
    running: 0,
  }],
  authorityState: RunnerJobState | null = {
    id: "job-1",
    status: "queued",
    available_at: null,
  },
  authorityError: { message: string } | null = null,
  applicationVisaType: string | null = null,
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
    select: vi.fn((columns: string) => {
      authoritySelects.push(columns);
      return runnerJobQuery;
    }),
    eq: vi.fn(() => runnerJobQuery),
    maybeSingle: vi.fn().mockResolvedValue({ data: authorityState, error: authorityError }),
  };
  const applicationQuery = {
    select: vi.fn(() => applicationQuery),
    eq: vi.fn(() => applicationQuery),
    single: vi.fn().mockResolvedValue({ data: { visa_type: applicationVisaType }, error: null }),
  };
  const insertedRunnerJobs: unknown[] = [];
  const rollbackQuery = {
    select: vi.fn(() => rollbackQuery),
    eq: vi.fn(() => rollbackQuery),
    in: vi.fn(() => rollbackQuery),
    order: vi.fn(() => rollbackQuery),
    limit: vi.fn(() => rollbackQuery),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn((values: unknown) => {
      insertedRunnerJobs.push(values);
      return rollbackQuery;
    }),
    single: vi.fn().mockResolvedValue({ data: { id: "job-rollback" }, error: null }),
  };
  withAdminMock.mockImplementation(async (_mode: string, actor: string, fn: (admin: unknown) => Promise<unknown>) => {
    if (actor === "lib/queue:pool-depth") {
      return fn({ from: vi.fn(() => depthQuery) });
    }
    if (actor === "lib/queue:application-flow") {
      return fn({ from: vi.fn(() => applicationQuery) });
    }
    if (actor === "lib/queue:enqueue-rollback") {
      return fn({ from: vi.fn(() => rollbackQuery) });
    }
    return fn({
      rpc,
      from: vi.fn((table: string) => {
        if (table !== "runner_job" && table !== "submission_queue") {
          throw new Error(`unexpected table: ${table}`);
        }
        authorityTables.push(table);
        return runnerJobQuery;
      }),
    });
  });
  return { rpc, insertedRunnerJobs };
}

describe("runner pool enqueue wake transport", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    delete process.env.RESILIENCE_RUNNER_WAKE_ENABLED;
    delete process.env.RUNNER_POOL_MIGRATION_ENABLED;
    ensureFlyMachineCapacityMock.mockReset();
    wakeCloudSubmissionWorkerMock.mockReset();
    enqueueRunnerJobWakeMock.mockReset();
    authorityTables.length = 0;
    authoritySelects.length = 0;
    ensureFlyMachineCapacityMock.mockResolvedValue({ ok: true, desired: 1 });
    wakeCloudSubmissionWorkerMock.mockResolvedValue({ ok: true });
    enqueueRunnerJobWakeMock.mockResolvedValue({ accepted: true, duplicate: false, queued: true });
    configureAdmin();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => warnSpy.mockRestore());

  it("publishes a Queue wake after a committed runner_job", async () => {
    process.env.RESILIENCE_RUNNER_WAKE_ENABLED = "true";

    const result = await enqueueRunnerPoolJob("app-1", "vietnam", "vn_prearrival");

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

    const result = await enqueueRunnerPoolJob("app-1", "vietnam", "vn_prearrival");

    expect(wakeCloudSubmissionWorkerMock).toHaveBeenCalledWith("job-1", { target: "pool" });
    expect(result.workerTriggered).toBe(true);
  });

  it.each([undefined, "false", "off", "0", "TRUE "])("keeps direct wake behavior when flag is %s", async (flag) => {
    if (flag === undefined) delete process.env.RESILIENCE_RUNNER_WAKE_ENABLED;
    else process.env.RESILIENCE_RUNNER_WAKE_ENABLED = flag;

    const result = await enqueueRunnerPoolJob("app-1", "vietnam", "vn_prearrival");

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

    const result = await enqueueRunnerPoolJob("app-1", "vietnam", "vn_prearrival");

    expect(wakeCloudSubmissionWorkerMock).not.toHaveBeenCalled();
    expect(result.workerTriggered).toBe(true);
  });

  it("falls back when the Queue response is unusable", async () => {
    process.env.RESILIENCE_RUNNER_WAKE_ENABLED = "true";
    enqueueRunnerJobWakeMock.mockResolvedValue({ accepted: false, duplicate: false, queued: false });

    const result = await enqueueRunnerPoolJob("app-1", "vietnam", "vn_prearrival");

    expect(wakeCloudSubmissionWorkerMock).toHaveBeenCalledWith("job-1", { target: "pool" });
    expect(result.workerTriggered).toBe(true);
  });

  it("does not queue or directly wake future pool work when Queue mode is enabled", async () => {
    process.env.RESILIENCE_RUNNER_WAKE_ENABLED = "true";
    const availableAt = new Date(Date.now() + 60_000).toISOString();

    const result = await enqueueRunnerPoolJob("app-1", "vietnam", "vn_prearrival", { availableAt });

    expect(enqueueRunnerJobWakeMock).not.toHaveBeenCalled();
    expect(wakeCloudSubmissionWorkerMock).not.toHaveBeenCalled();
    expect(result.workerTriggered).toBe(false);
  });

  it("does not wake a scheduled legacy collision when Queue mode is enabled", async () => {
    process.env.RESILIENCE_RUNNER_WAKE_ENABLED = "on";
    configureAdmin({
      blocked_by_legacy: true,
      runner_job_id: null,
      legacy_queue_id: "legacy-1",
      legacy_queue_status: "sgac_live_assisted_scheduled",
    }, undefined, {
      id: "legacy-1",
      status: "sgac_live_assisted_scheduled",
    });

    const result = await enqueueRunnerPoolJob("app-1", "singapore", "sgac");

    expect(enqueueRunnerJobWakeMock).not.toHaveBeenCalled();
    expect(wakeCloudSubmissionWorkerMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ transport: "submission_queue", workerTriggered: false });
  });

  it("publishes a due retained collision to its target-specific Queue", async () => {
    process.env.RESILIENCE_RUNNER_WAKE_ENABLED = "true";
    configureAdmin({
      blocked_by_legacy: true,
      runner_job_id: null,
      legacy_queue_id: "legacy-1",
      legacy_queue_status: "sgac_live_assisted_pending",
    }, undefined, {
      id: "legacy-1",
      status: "sgac_live_assisted_pending",
    });

    const result = await enqueueRunnerPoolJob("app-1", "singapore", "sgac");

    expect(authorityTables).toContain("submission_queue");
    expect(authoritySelects).toContain("id,status");
    expect(authoritySelects).not.toContain("id,status,available_at");
    expect(enqueueRunnerJobWakeMock).toHaveBeenCalledWith({ jobId: "legacy-1", target: "legacy" });
    expect(wakeCloudSubmissionWorkerMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ transport: "submission_queue", workerTriggered: true });
  });

  it.each([
    { label: "missing", state: null, error: null },
    { label: "lookup error", state: null, error: { message: "database unavailable" } },
  ])("fails closed when retained authority is $label", async ({ state, error }) => {
    process.env.RESILIENCE_RUNNER_WAKE_ENABLED = "1";
    configureAdmin({
      blocked_by_legacy: true,
      runner_job_id: null,
      legacy_queue_id: "legacy-1",
      legacy_queue_status: "sgac_live_assisted_pending",
    }, undefined, state, error);

    const result = await enqueueRunnerPoolJob("app-1", "singapore", "sgac");

    expect(enqueueRunnerJobWakeMock).not.toHaveBeenCalled();
    if (error) {
      expect(wakeCloudSubmissionWorkerMock).toHaveBeenCalledWith("legacy-1", { target: "legacy" });
      expect(result).toMatchObject({ transport: "submission_queue", workerTriggered: true });
    } else {
      expect(wakeCloudSubmissionWorkerMock).not.toHaveBeenCalled();
      expect(result).toMatchObject({ transport: "submission_queue", workerTriggered: false });
    }
    if (error) {
      expect(warnSpy).toHaveBeenCalledWith(
        "[runner-pool] Authoritative runner state unavailable; reconciler will recover.",
        { jobId: "legacy-1", reason: "authoritative_state_unavailable" },
      );
    } else {
      expect(warnSpy).not.toHaveBeenCalled();
    }
  });

  it.each([
    { label: "missing", state: null, error: null },
    { label: "lookup error", state: null, error: { message: "database unavailable" } },
  ])("fails closed when the canonical runner_job state is $label", async ({ state, error }) => {
    process.env.RESILIENCE_RUNNER_WAKE_ENABLED = "true";
    configureAdmin({}, undefined, state, error);

    const result = await enqueueRunnerPoolJob("app-1", "vietnam", "vn_prearrival");

    expect(enqueueRunnerJobWakeMock).not.toHaveBeenCalled();
    if (error) {
      expect(ensureFlyMachineCapacityMock).toHaveBeenCalledWith("pool", 1);
      expect(wakeCloudSubmissionWorkerMock).toHaveBeenCalledWith("job-1", { target: "pool" });
      expect(result.workerTriggered).toBe(true);
    } else {
      expect(wakeCloudSubmissionWorkerMock).not.toHaveBeenCalled();
      expect(result.workerTriggered).toBe(false);
    }
    if (error) {
      expect(warnSpy).toHaveBeenCalledWith(
        "[runner-pool] Authoritative runner state unavailable; reconciler will recover.",
        { jobId: "job-1", reason: "authoritative_state_unavailable" },
      );
    } else {
      expect(warnSpy).not.toHaveBeenCalled();
    }
  });

  it("does not wake or publish when the enqueue RPC fails", async () => {
    const { rpc } = configureAdmin();
    rpc.mockRejectedValue(new Error("database unavailable"));

    await expect(enqueueRunnerPoolJob("app-1", "vietnam", "vn_prearrival")).rejects.toThrow("database unavailable");
    expect(enqueueRunnerJobWakeMock).not.toHaveBeenCalled();
    expect(wakeCloudSubmissionWorkerMock).not.toHaveBeenCalled();
  });

  it("does not wake or publish without a durable runner job id", async () => {
    configureAdmin({ runner_job_id: null });

    await expect(enqueueRunnerPoolJob("app-1", "vietnam", "vn_prearrival")).rejects.toThrow("no runner job id");
    expect(enqueueRunnerJobWakeMock).not.toHaveBeenCalled();
    expect(wakeCloudSubmissionWorkerMock).not.toHaveBeenCalled();
  });

  it("fails closed before insert or wake when a shared-pool country has no resolved flow", async () => {
    const { rpc, insertedRunnerJobs } = configureAdmin({}, undefined, undefined, null, "MY_TOURIST_E_VISA");

    await expect(enqueueRunnerJob("app-unsupported", "malaysia")).rejects.toThrow(
      "unsupported or ambiguous shared-pool visa flow",
    );
    expect(rpc).not.toHaveBeenCalled();
    expect(insertedRunnerJobs).toHaveLength(0);
    expect(ensureFlyMachineCapacityMock).not.toHaveBeenCalled();
    expect(wakeCloudSubmissionWorkerMock).not.toHaveBeenCalled();
    expect(enqueueRunnerJobWakeMock).not.toHaveBeenCalled();
  });

  it("rejects a shared-pool country and flow tuple mismatch before the RPC", async () => {
    const { rpc } = configureAdmin();

    await expect(enqueueRunnerPoolJob("app-mismatch", "vietnam", "mdac")).rejects.toThrow(
      "runner pool flow mismatch",
    );
    expect(rpc).not.toHaveBeenCalled();
    expect(ensureFlyMachineCapacityMock).not.toHaveBeenCalled();
    expect(wakeCloudSubmissionWorkerMock).not.toHaveBeenCalled();
    expect(enqueueRunnerJobWakeMock).not.toHaveBeenCalled();
  });

  it("rejects the retired sticky Vietnam eVisa flow from the shared-pool caller", async () => {
    const { rpc } = configureAdmin();

    await expect(enqueueRunnerPoolJob("app-retired", "vietnam", "vn_evisa")).rejects.toThrow(
      "runner pool flow mismatch",
    );
    expect(rpc).not.toHaveBeenCalled();
    expect(ensureFlyMachineCapacityMock).not.toHaveBeenCalled();
    expect(wakeCloudSubmissionWorkerMock).not.toHaveBeenCalled();
    expect(enqueueRunnerJobWakeMock).not.toHaveBeenCalled();
  });

  it("fails closed for every generic country with no explicit supported flow", async () => {
    const { rpc, insertedRunnerJobs } = configureAdmin({}, undefined, undefined, null, null);

    await expect(enqueueRunnerJob("app-unsupported-generic", "japan")).rejects.toThrow(
      "unsupported or ambiguous runner flow",
    );
    expect(rpc).not.toHaveBeenCalled();
    expect(insertedRunnerJobs).toHaveLength(0);
    expect(ensureFlyMachineCapacityMock).not.toHaveBeenCalled();
    expect(wakeCloudSubmissionWorkerMock).not.toHaveBeenCalled();
    expect(enqueueRunnerJobWakeMock).not.toHaveBeenCalled();
  });

  it("writes the exact resolved flow key on the rollback insert when migration is off", async () => {
    delete process.env.RUNNER_POOL_MIGRATION_ENABLED;
    const { insertedRunnerJobs } = configureAdmin({}, undefined, undefined, null, "MY_MDAC_ARRIVAL_CARD");

    const result = await enqueueRunnerJob("app-mdac", "malaysia");

    expect(result).toEqual({ id: "job-rollback", created: true });
    expect(insertedRunnerJobs).toEqual([
      expect.objectContaining({
        application_id: "app-mdac",
        country: "malaysia",
        flow_key: "mdac",
      }),
    ]);
    expect(wakeCloudSubmissionWorkerMock).toHaveBeenCalledWith("job-rollback", { target: "pool" });
  });
});
