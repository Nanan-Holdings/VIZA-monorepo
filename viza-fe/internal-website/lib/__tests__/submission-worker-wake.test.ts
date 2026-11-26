import { describe, expect, it, vi } from "vitest";

import {
  wakeCloudSubmissionWorker,
  wakeDs160SubmissionWorker,
  wakeUkSubmissionWorker,
  wakeFranceSubmissionWorker,
} from "../submission-worker-wake.server";

describe("wakeCloudSubmissionWorker", () => {
  it("does not start a Machine or call a wake endpoint during cutover pause", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;

    const result = await wakeCloudSubmissionWorker("job-paused", {
      env: {
        RUNNER_CUTOVER_PAUSED: "true",
        FLY_SUBMISSION_ORG_TOKEN: "fly-token",
        SUBMISSION_QUEUE_INTERNAL_TOKEN: "internal-token",
      },
      fetchImpl,
      target: "legacy",
    });

    expect(result).toEqual({ ok: false, reason: "cutover_paused" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("returns not_configured when the endpoint is absent", async () => {
    const result = await wakeCloudSubmissionWorker("job-1", {
      env: {},
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });

    expect(result).toEqual({ ok: false, reason: "not_configured" });
  });

  it("rejects an insecure production endpoint", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const result = await wakeCloudSubmissionWorker("job-1", {
      env: {
        NODE_ENV: "production",
        SUBMISSION_SERVICE_CLOUD_URL: "http://worker.example.test",
        SUBMISSION_QUEUE_INTERNAL_TOKEN: "secret-token",
      },
      fetchImpl,
    });

    expect(result).toEqual({ ok: false, reason: "insecure_url" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts the job id and token to the internal wake endpoint", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 202 }));
    const result = await wakeCloudSubmissionWorker("job-1", {
      env: {
        NODE_ENV: "production",
        SUBMISSION_SERVICE_CLOUD_URL: "https://worker.example.test/",
        SUBMISSION_QUEUE_INTERNAL_TOKEN: "secret-token",
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://worker.example.test/internal/submission-queue/wake",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer secret-token",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ jobId: "job-1" }),
      }),
    );
  });

  it("starts the country-specific Fly machine before calling the wake endpoint", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/apps/viza-runner-pool/machines")) {
        return Response.json([{ id: "machine-vn", state: "stopped" }]);
      }
      if (url.endsWith("/apps/viza-runner-pool/machines/machine-vn/start")) {
        return new Response(null, { status: 202 });
      }
      if (url.endsWith("/internal/submission-queue/wake")) {
        return new Response(null, { status: 202 });
      }
      return new Response(null, { status: 404 });
    });

    const result = await wakeCloudSubmissionWorker("job-vn", {
      target: "vietnam",
      env: {
        NODE_ENV: "production",
        FLY_SUBMISSION_ORG_TOKEN: "fly-token",
        SUBMISSION_SERVICE_CLOUD_URL: "https://worker.example.test",
        SUBMISSION_QUEUE_INTERNAL_TOKEN: "secret-token",
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.machines.dev/v1/apps/viza-runner-pool/machines",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer fly-token",
        }),
      }),
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.machines.dev/v1/apps/viza-runner-pool/machines/machine-vn/start",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("keeps the generic legacy wake on the Vietnam compatibility endpoint", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "https://vietnam-worker.example.test/internal/submission-queue/wake") {
        return new Response(null, { status: 202 });
      }
      return new Response(null, { status: 404 });
    });

    const result = await wakeCloudSubmissionWorker("job-vietnam", {
      target: "legacy",
      env: {
        NODE_ENV: "production",
        VIETNAM_SUBMISSION_SERVICE_URL: "https://vietnam-worker.example.test",
        SUBMISSION_SERVICE_CLOUD_URL: "https://legacy-worker.example.test",
        SUBMISSION_QUEUE_INTERNAL_TOKEN: "secret-token",
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://vietnam-worker.example.test/internal/submission-queue/wake",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ jobId: "job-vietnam" }),
      }),
    );
  });

  it("cold-starts DS-160 on the US East DS-160 app and uses its endpoint", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/apps/viza-prod-submission-ds160/machines")) {
        return Response.json([{ id: "ds160-machine", state: "stopped" }]);
      }
      if (url.endsWith("/apps/viza-prod-submission-ds160/machines/ds160-machine/start")) {
        return new Response(null, { status: 202 });
      }
      if (url === "https://viza-prod-submission-ds160.fly.dev/internal/submission-queue/wake") {
        return new Response(null, { status: 202 });
      }
      return new Response(null, { status: 404 });
    });

    const result = await wakeDs160SubmissionWorker("job-ds160", {
      env: {
        NODE_ENV: "production",
        FLY_SUBMISSION_ORG_TOKEN: "fly-token",
        FLY_SUBMISSION_LEGACY_APP: "viza-prod-submission-legacy",
        SUBMISSION_SERVICE_CLOUD_URL: "https://legacy-worker.example.test",
        VIETNAM_SUBMISSION_SERVICE_URL: "https://vietnam-worker.example.test",
        SUBMISSION_QUEUE_INTERNAL_TOKEN: "secret-token",
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.machines.dev/v1/apps/viza-prod-submission-ds160/machines",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer fly-token" }),
      }),
    );
    // Never the Singapore legacy worker's URL.
    expect(fetchImpl).not.toHaveBeenCalledWith(
      "https://legacy-worker.example.test/internal/submission-queue/wake",
      expect.anything(),
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://viza-prod-submission-ds160.fly.dev/internal/submission-queue/wake",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ jobId: "job-ds160" }),
      }),
    );
  });

  it("cold-starts France on the Frankfurt France app and uses its endpoint, not legacy's or Vietnam's", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/apps/viza-prod-submission-france/machines")) {
        return Response.json([{ id: "france-machine", state: "stopped" }]);
      }
      if (url.endsWith("/apps/viza-prod-submission-france/machines/france-machine/start")) {
        return new Response(null, { status: 202 });
      }
      if (url === "https://viza-prod-submission-france.fly.dev/internal/submission-queue/wake") {
        return new Response(null, { status: 202 });
      }
      return new Response(null, { status: 404 });
    });

    const result = await wakeFranceSubmissionWorker("job-france", {
      env: {
        NODE_ENV: "production",
        FLY_SUBMISSION_ORG_TOKEN: "fly-token",
        FLY_SUBMISSION_LEGACY_APP: "viza-prod-submission-legacy",
        SUBMISSION_SERVICE_CLOUD_URL: "https://legacy-worker.example.test",
        VIETNAM_SUBMISSION_SERVICE_URL: "https://vietnam-worker.example.test",
        SUBMISSION_QUEUE_INTERNAL_TOKEN: "secret-token",
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.machines.dev/v1/apps/viza-prod-submission-france/machines",
      expect.anything(),
    );
    for (const otherWake of [
      "https://vietnam-worker.example.test/internal/submission-queue/wake",
      "https://legacy-worker.example.test/internal/submission-queue/wake",
    ]) {
      expect(fetchImpl).not.toHaveBeenCalledWith(otherWake, expect.anything());
    }
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://viza-prod-submission-france.fly.dev/internal/submission-queue/wake",
      expect.objectContaining({ body: JSON.stringify({ jobId: "job-france" }) }),
    );
  });

  it("uses the retained pool Fly endpoint when the pool URL is not configured", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/apps/viza-runner-pool/machines")) {
        return Response.json([{ id: "machine-pool", state: "started" }]);
      }
      if (url === "https://viza-runner-pool.fly.dev/internal/runner-job/wake") {
        return new Response(null, { status: 202 });
      }
      return new Response(null, { status: 404 });
    });

    const result = await wakeCloudSubmissionWorker("job-pool", {
      target: "pool",
      env: {
        NODE_ENV: "production",
        FLY_SUBMISSION_ORG_TOKEN: "fly-token",
        SUBMISSION_QUEUE_INTERNAL_TOKEN: "secret-token",
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://viza-runner-pool.fly.dev/internal/runner-job/wake",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ jobId: "job-pool" }),
      }),
    );
  });

  it("does not report an already-running machine as woken when the endpoint fails", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/apps/viza-runner-pool/machines")) {
        return Response.json([{ id: "machine-pool", state: "started" }]);
      }
      return new Response(null, { status: 503 });
    });

    const result = await wakeCloudSubmissionWorker("job-pool", {
      target: "pool",
      env: {
        NODE_ENV: "production",
        FLY_SUBMISSION_ORG_TOKEN: "fly-token",
        SUBMISSION_QUEUE_INTERNAL_TOKEN: "secret-token",
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ ok: false, reason: "request_failed" });
  });
});

describe("UK Fly wake", () => {
  const env = {
    NODE_ENV: "production" as const,
    FLY_SUBMISSION_ORG_TOKEN: "fly-token",
    FLY_SUBMISSION_LEGACY_APP: "viza-prod-legacy",
    SUBMISSION_QUEUE_INTERNAL_TOKEN: "internal-token",
    VIETNAM_SUBMISSION_SERVICE_URL: "https://unrelated-vietnam.example.test",
  };

  it.each(["stopped", "started"])("readies the legacy Machine (%s) before dispatching the same UK job", async (state) => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/machines")) return Response.json([{ id: "uk-machine", state }]);
      return new Response(null, { status: url.endsWith("/ready") ? 200 : 202 });
    });
    expect(await wakeUkSubmissionWorker("uk-job", { env, fetchImpl })).toEqual({ ok: true });
    expect(calls[0]).toBe("https://api.machines.dev/v1/apps/viza-prod-legacy/machines");
    expect(calls.at(-2)).toBe("https://viza-prod-legacy.fly.dev/ready");
    expect(fetchImpl).toHaveBeenLastCalledWith("https://viza-prod-legacy.fly.dev/internal/submission-queue/wake", expect.objectContaining({
      method: "POST", body: JSON.stringify({ jobId: "uk-job" }),
      headers: expect.objectContaining({ Authorization: "Bearer internal-token" }),
    }));
    expect(calls.some((url) => url.includes("/start"))).toBe(state === "stopped");
    expect(calls.some((url) => url.includes("unrelated-vietnam"))).toBe(false);
  });

  it("rejects a mismatched endpoint before starting a Machine", async () => {
    const fetchImpl = vi.fn();
    expect(await wakeUkSubmissionWorker("uk-job", { env: { ...env, SUBMISSION_SERVICE_CLOUD_URL: "https://other-app.fly.dev" }, fetchImpl })).toEqual({ ok: false, reason: "target_mismatch" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("preserves the pending job when no retained Machine exists", async () => {
    const fetchImpl = vi.fn(async () => Response.json([]));
    expect(await wakeUkSubmissionWorker("uk-job", { env, fetchImpl })).toEqual({ ok: false, reason: "machine_not_found" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not call Fly when paused or the internal token is missing", async () => {
    const fetchImpl = vi.fn();
    expect(await wakeUkSubmissionWorker("uk-job", { env: { ...env, RUNNER_CUTOVER_PAUSED: "true" }, fetchImpl })).toEqual({ ok: false, reason: "cutover_paused" });
    expect(await wakeUkSubmissionWorker("uk-job", { env: { ...env, SUBMISSION_QUEUE_INTERNAL_TOKEN: "" }, fetchImpl })).toEqual({ ok: false, reason: "not_configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not call a start acknowledgement a successful wake when dispatch fails", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/machines")) return Response.json([{ id: "uk-machine", state: "stopped" }]);
      return new Response(null, { status: url.endsWith("/wake") ? 503 : 200 });
    });
    expect(await wakeUkSubmissionWorker("uk-job", { env, fetchImpl })).toEqual({ ok: false, reason: "request_failed" });
  });

  it("leaves wake pending when the Machine never becomes HTTP-ready", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).endsWith("/machines")) return Response.json([{ id: "uk-machine", state: "started" }]);
        return new Response(null, { status: 503 });
      });
      const operation = wakeUkSubmissionWorker("uk-job", { env, fetchImpl });
      await vi.advanceTimersByTimeAsync(13_000);
      expect(await operation).toEqual({ ok: false, reason: "readiness_timeout" });
      expect(fetchImpl.mock.calls.some(([url]) => String(url).endsWith("/wake"))).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
