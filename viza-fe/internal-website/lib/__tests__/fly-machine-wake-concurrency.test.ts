import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
const metricInsertMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/with-admin", () => ({
  withAdmin: vi.fn(async (_mode: string, _actor: string, fn: (admin: unknown) => Promise<unknown>) =>
    fn({ rpc: rpcMock, from: fromMock }),
  ),
}));

import {
  ensureFlyMachineCapacity,
  MAX_PARALLEL_MACHINE_STARTS,
} from "../fly-machine-wake.server";

const env = {
  FLY_SUBMISSION_ORG_TOKEN: "org-token",
  SUPABASE_URL: "https://supabase.example.test",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
};

function machineList(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `pool-${index + 1}`,
    state: "stopped",
  }));
}

describe("Fly capacity concurrency guard", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
    metricInsertMock.mockReset();
    rpcMock.mockImplementation((name: string) => {
      if (name === "reserve_runner_machine_slot") {
        return Promise.resolve({ data: 1, error: null });
      }
      if (name === "release_runner_machine_slot") {
        return Promise.resolve({ data: null, error: null });
      }
      throw new Error(`unexpected rpc ${name}`);
    });
    fromMock.mockReturnValue({
      insert: metricInsertMock.mockResolvedValue({ data: null, error: null }),
    });
  });

  it("keeps retained machine start calls at or below the bounded parallelism", async () => {
    let inFlightStarts = 0;
    let maxInFlightStarts = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith("/machines")) {
        return new Response(JSON.stringify(machineList(6)), { status: 200 });
      }
      inFlightStarts += 1;
      maxInFlightStarts = Math.max(maxInFlightStarts, inFlightStarts);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlightStarts -= 1;
      return new Response(null, { status: 200 });
    });

    await expect(
      ensureFlyMachineCapacity("pool", 6, {
        env,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toMatchObject({ ok: true, started: 6, active: 6 });

    expect(maxInFlightStarts).toBeLessThanOrEqual(MAX_PARALLEL_MACHINE_STARTS);
  });

  it("releases only the slot whose start failed and treats Fly 409 as success", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith("/machines")) {
        return new Response(JSON.stringify(machineList(3)), { status: 200 });
      }
      if (url.includes("pool-2/start")) return new Response(null, { status: 500 });
      if (url.includes("pool-3/start")) return new Response(null, { status: 409 });
      return new Response(null, { status: 200 });
    });

    await expect(
      ensureFlyMachineCapacity("pool", 3, {
        env,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toEqual({ ok: false, target: "pool", reason: "request_failed" });

    expect(rpcMock).toHaveBeenCalledWith(
      "release_runner_machine_slot",
      { p_machine_id: "pool-2" },
    );
    expect(rpcMock).not.toHaveBeenCalledWith(
      "release_runner_machine_slot",
      { p_machine_id: "pool-1" },
    );
    expect(rpcMock).not.toHaveBeenCalledWith(
      "release_runner_machine_slot",
      { p_machine_id: "pool-3" },
    );
    expect(metricInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "machine_start",
        country: null,
        machine_kind: "pool",
      }),
    );
  });

  it("does not turn a metric insert failure into a start failure", async () => {
    fromMock.mockReturnValue({
      insert: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "runner_concurrency_metric is not installed" },
      }),
    });
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith("/machines")) {
        return new Response(JSON.stringify(machineList(1)), { status: 200 });
      }
      return new Response(null, { status: 200 });
    });

    await expect(
      ensureFlyMachineCapacity("pool", 1, {
        env,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toMatchObject({ ok: true, started: 1 });
  });
});
