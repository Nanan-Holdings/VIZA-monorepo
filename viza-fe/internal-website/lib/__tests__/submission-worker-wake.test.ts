import { describe, expect, it, vi } from "vitest";

import { wakeCloudSubmissionWorker } from "../submission-worker-wake.server";

describe("wakeCloudSubmissionWorker", () => {
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
});
