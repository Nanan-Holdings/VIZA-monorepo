import { describe, expect, it, vi } from "vitest";

import {
  ensureFlyMachineCapacity,
  ensureFlyMachineStarted,
} from "../fly-machine-wake.server";

describe("ensureFlyMachineStarted", () => {
  it("does not manage countries outside the shared/sticky topology", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(
      ensureFlyMachineStarted("france", { env: {}, fetchImpl }),
    ).resolves.toEqual({
      ok: false,
      target: "france",
      reason: "unmanaged_target",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("routes Vietnam aliases to the shared pool", async () => {
    await expect(
      ensureFlyMachineStarted("vn", {
        env: {},
        fetchImpl: vi.fn() as unknown as typeof fetch,
      }),
    ).resolves.toEqual({
      ok: false,
      target: "pool",
      reason: "not_configured",
    });
  });

  it("starts one retained stopped machine for a country alias", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: "machine-1", state: "stopped" }]), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    await expect(
      ensureFlyMachineStarted("kr", {
        env: {
          FLY_SUBMISSION_ORG_TOKEN: "org-token",
          FLY_MACHINES_API_URL: "https://machines.example.test/v1/",
        },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toEqual({
      ok: true,
      target: "south_korea",
      app: "viza-runner-south-korea",
      state: "start_requested",
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://machines.example.test/v1/apps/viza-runner-south-korea/machines/machine-1/start",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer org-token" }),
      }),
    );
  });

  it("routes Indonesia to its retained sticky app", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: "id-machine-1", state: "stopped" }]), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    await expect(
      ensureFlyMachineStarted("indonesia", {
        env: { FLY_SUBMISSION_ORG_TOKEN: "org-token" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toMatchObject({
      ok: true,
      target: "indonesia",
      app: "viza-runner-indonesia",
      state: "start_requested",
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://api.machines.dev/v1/apps/viza-runner-indonesia/machines/id-machine-1/start",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("uses account-specific app names when production overrides are configured", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: "kr-machine-2", state: "stopped" }]), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    await expect(
      ensureFlyMachineStarted("kr", {
        env: {
          FLY_SUBMISSION_ORG_TOKEN: "org-token",
          FLY_RUNNER_SOUTH_KOREA_APP: "viza-prod-runner-south-korea",
        },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toMatchObject({
      ok: true,
      app: "viza-prod-runner-south-korea",
      state: "start_requested",
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://api.machines.dev/v1/apps/viza-prod-runner-south-korea/machines/kr-machine-2/start",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("does not issue a start request when a machine is already starting", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify([{ id: "machine-1", state: "starting" }]), {
        status: 200,
      }),
    );
    await expect(
      ensureFlyMachineStarted("legacy", {
        env: { FLY_SUBMISSION_ORG_TOKEN: "org-token" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toMatchObject({ ok: true, state: "already_running" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("starts exactly the requested retained shared-pool capacity", async () => {
    const machines = Array.from({ length: 10 }, (_, index) => ({
      id: `pool-${String(index + 1).padStart(2, "0")}`,
      state: "stopped",
    }));
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(machines), { status: 200 }),
      )
      .mockResolvedValue(new Response(null, { status: 200 }));

    await expect(
      ensureFlyMachineCapacity("pool", 3, {
        env: { FLY_SUBMISSION_ORG_TOKEN: "org-token" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toMatchObject({
      ok: true,
      target: "pool",
      desired: 3,
      active: 3,
      started: 3,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });
});
