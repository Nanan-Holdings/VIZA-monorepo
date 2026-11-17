import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient, getApplicationApiApplicantProfileId, getImpersonationSession } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getApplicationApiApplicantProfileId: vi.fn(),
  getImpersonationSession: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/application-api-auth", () => ({ getApplicationApiApplicantProfileId }));
vi.mock("@/lib/impersonation-session", () => ({ getImpersonationSession }));

import { POST } from "./route";

const context = { params: Promise.resolve({ id: "application-id" }) };
const request = () => new Request("http://localhost/api/applications/application-id/official-handoff/cancel", { method: "POST" });

function setupRpc(result: { data: unknown; error: { message: string } | null }) {
  const rpc = vi.fn(async () => result);
  createAdminClient.mockReturnValue({ rpc });
  return rpc;
}

describe("official submission cancel route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApplicationApiApplicantProfileId.mockResolvedValue("profile-id");
    getImpersonationSession.mockResolvedValue(null);
  });

  it("cancels through the RPC scoped to the signed-in applicant", async () => {
    const rpc = setupRpc({ data: [{ outcome: "cancelled", submission_queue_id: "q" }], error: null });
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: "cancelled" });
    expect(rpc).toHaveBeenCalledWith("cancel_official_applicant_submission", {
      p_application_id: "application-id",
      p_applicant_id: "profile-id",
    });
  });

  it("reports a cooperative cancel for a run in progress", async () => {
    setupRpc({ data: [{ outcome: "cancel_requested", submission_queue_id: "q" }], error: null });
    expect(await (await POST(request(), context)).json()).toEqual({ outcome: "cancel_requested" });
  });

  it("returns 503, not 409, when the cancel RPC itself fails", async () => {
    setupRpc({ data: null, error: { message: "function does not exist" } });
    expect((await POST(request(), context)).status).toBe(503);
  });

  it("returns 409 when nothing can be cancelled and refuses impersonation", async () => {
    setupRpc({ data: [], error: null });
    expect((await POST(request(), context)).status).toBe(409);
    getImpersonationSession.mockResolvedValue({ userId: "profile-id" });
    const rpc = setupRpc({ data: [{ outcome: "cancelled" }], error: null });
    expect((await POST(request(), context)).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
});
