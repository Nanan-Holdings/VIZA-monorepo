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
import { POST as REGENERATE } from "./regenerate/route";

type QueryResult = { data: unknown; error: { message: string } | null };

const FUTURE = new Date(Date.now() + 30 * 60_000).toISOString();
const LIVE_URL = "https://www.browserbase.com/devtools-fullscreen/inspector.html?wss=connect.browserbase.com/debug/x";

function setupAdmin(options: {
  application?: Record<string, unknown> | null;
  claim?: QueryResult;
  resultPatch?: Record<string, unknown>;
}) {
  const application = options.application === undefined
    ? {
        id: "application-id",
        applicant_id: "profile-id",
        submission_result: {
          country: "GENERIC",
          targetCountry: "ID",
          status: "awaiting_applicant_official_submit",
          handoffId: "takeover-id",
          ...options.resultPatch,
        },
      }
    : options.application;
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({ data: application, error: null })),
  };
  const rpc = vi.fn(async () =>
    options.claim ?? {
      data: [{ claimed: true, takeover_id: "takeover-id", application_id: "application-id", live_view_url: LIVE_URL, expires_at: FUTURE }],
      error: null,
    },
  );
  const from = vi.fn((table: string) => {
    if (table === "applications") return builder;
    throw new Error(`unexpected direct table access: ${table}`);
  });
  createAdminClient.mockReturnValue({ from, rpc });
  return { rpc, from };
}

const context = { params: Promise.resolve({ id: "application-id" }) };
const request = () => new Request("http://localhost/api/applications/application-id/official-handoff", { method: "POST" });

describe("official handoff route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApplicationApiApplicantProfileId.mockResolvedValue("profile-id");
    getImpersonationSession.mockResolvedValue(null);
  });

  it("refuses staff impersonation before any database access", async () => {
    getImpersonationSession.mockResolvedValue({ userId: "profile-id" });
    const { rpc, from } = setupAdmin({});
    expect((await POST(request(), context)).status).toBe(403);
    expect((await REGENERATE(request(), context)).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("returns the live view only to the owner through the claim RPC", async () => {
    const { rpc } = setupAdmin({});
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ liveViewUrl: LIVE_URL, expiresAt: FUTURE });
    expect(rpc).toHaveBeenCalledWith("claim_official_applicant_handoff", {
      p_takeover_id: "takeover-id",
      p_application_id: "application-id",
      p_applicant_id: "profile-id",
    });
  });

  it("rejects unauthenticated and non-owner requests before any RPC", async () => {
    getApplicationApiApplicantProfileId.mockResolvedValueOnce(null);
    expect((await POST(request(), context)).status).toBe(401);
    const { rpc } = setupAdmin({ application: { id: "application-id", applicant_id: "someone-else", submission_result: {} } });
    expect((await POST(request(), context)).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses when no handoff is ready or it already expired", async () => {
    setupAdmin({ resultPatch: { status: "submitted" } });
    expect((await POST(request(), context)).status).toBe(409);
    const { rpc } = setupAdmin({ resultPatch: { handoffExpired: true } });
    expect((await POST(request(), context)).status).toBe(410);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("lets the applicant return to a still-open session after submitting, to pay", async () => {
    const { rpc } = setupAdmin({
      resultPatch: { country: "ID", status: "submitted", submittedBy: "applicant_on_official_portal" },
    });
    expect((await POST(request(), context)).status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("returns 409 when the claim RPC returns no row or a different takeover", async () => {
    setupAdmin({ claim: { data: [], error: null } });
    expect((await POST(request(), context)).status).toBe(409);
    setupAdmin({
      claim: {
        data: [{ claimed: true, takeover_id: "other", application_id: "application-id", live_view_url: LIVE_URL, expires_at: FUTURE }],
        error: null,
      },
    });
    expect((await POST(request(), context)).status).toBe(409);
  });

  it("never returns a non-Browserbase URL", async () => {
    setupAdmin({
      claim: {
        data: [{ claimed: true, takeover_id: "takeover-id", application_id: "application-id", live_view_url: "https://evil.example/x", expires_at: FUTURE }],
        error: null,
      },
    });
    expect((await POST(request(), context)).status).toBe(503);
  });

  it("regeneration is scoped to the signed-in applicant and reports refusals", async () => {
    const { rpc } = setupAdmin({ claim: { data: [{ requested: true, submission_queue_id: "q" }], error: null } });
    expect((await REGENERATE(request(), context)).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("request_official_applicant_handoff_regeneration", {
      p_application_id: "application-id",
      p_applicant_id: "profile-id",
    });
    setupAdmin({ claim: { data: [], error: null } });
    expect((await REGENERATE(request(), context)).status).toBe(409);
  });
});
