import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());
const wakeCloudSubmissionWorkerMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));
vi.mock("@/lib/submission-worker-wake.server", () => ({
  wakeCloudSubmissionWorker: wakeCloudSubmissionWorkerMock,
}));

import { POST } from "./route";

describe("submission worker wake route", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    wakeCloudSubmissionWorkerMock.mockReset();
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
    });
  });

  it("returns a retryable maintenance response when the cutover guard suppresses the wake", async () => {
    wakeCloudSubmissionWorkerMock.mockResolvedValue({
      ok: false,
      reason: "cutover_paused",
    });

    const response = await POST(new Request("https://viza.test/api/submission-worker/wake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: "job-1" }),
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Cloud submission worker wake is temporarily unavailable.",
      reason: "cutover_paused",
    });
  });

  it("does not reach the wake sink without an authenticated user", async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });

    const response = await POST(new Request("https://viza.test/api/submission-worker/wake", {
      method: "POST",
      body: "{}",
    }));

    expect(response.status).toBe(401);
    expect(wakeCloudSubmissionWorkerMock).not.toHaveBeenCalled();
  });
});
