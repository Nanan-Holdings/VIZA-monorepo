import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient, getApplicationApiApplicantProfileId, getImpersonationSession, wakeCloudSubmissionWorker } =
  vi.hoisted(() => ({
    createAdminClient: vi.fn(),
    getApplicationApiApplicantProfileId: vi.fn(),
    getImpersonationSession: vi.fn(),
    wakeCloudSubmissionWorker: vi.fn(async () => ({ ok: true })),
  }));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/application-api-auth", () => ({ getApplicationApiApplicantProfileId }));
vi.mock("@/lib/impersonation-session", () => ({ getImpersonationSession }));
vi.mock("@/lib/submission-worker-wake.server", () => ({ wakeCloudSubmissionWorker }));

import { POST } from "./route";

const context = { params: Promise.resolve({ id: "application-id" }) };
const request = () => new Request("http://localhost/x", { method: "POST" });

function setup(rpcResult: { data: unknown; error: { message: string } | null }) {
  const rpc = vi.fn(async () => rpcResult);
  createAdminClient.mockReturnValue({ rpc });
  return { rpc };
}

describe("official handoff regenerate route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApplicationApiApplicantProfileId.mockResolvedValue("profile-id");
    getImpersonationSession.mockResolvedValue(null);
  });

  it("wakes the workers that own handoff providers after a regeneration", async () => {
    setup({ data: [{ requested: true, submission_queue_id: "queue-vn" }], error: null });
    expect((await POST(request(), context)).status).toBe(200);
    expect(wakeCloudSubmissionWorker).toHaveBeenCalledWith("queue-vn", { target: "legacy" });
    expect(wakeCloudSubmissionWorker).toHaveBeenCalledWith("queue-vn", { target: "indonesia" });
  });

  it("does not wake anything when regeneration is refused", async () => {
    setup({ data: [], error: null });
    expect((await POST(request(), context)).status).toBe(409);
    expect(wakeCloudSubmissionWorker).not.toHaveBeenCalled();
  });
});
