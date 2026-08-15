import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ensureFlyMachineStartedMock = vi.hoisted(() => vi.fn());
const createAdminClientMock = vi.hoisted(() => vi.fn());
const getClientSessionWithFallbackMock = vi.hoisted(() => vi.fn());
const getImpersonationSessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/fly-machine-wake.server", () => ({
  ensureFlyMachineStarted: ensureFlyMachineStartedMock,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));
vi.mock("@/lib/client-session", () => ({
  getClientSessionWithFallback: getClientSessionWithFallbackMock,
}));
vi.mock("@/lib/impersonation-session", () => ({
  getImpersonationSession: getImpersonationSessionMock,
}));

import { POST } from "./route";

const application = {
  id: "app-kr-1",
  applicant_id: "profile-1",
  visa_type: "KR_C39_SHORT_TERM_VISIT",
  submission_result: null,
};

function adminMock(tables: string[]) {
  const applicationRead = {
    select: vi.fn(() => applicationRead),
    eq: vi.fn(() => applicationRead),
    maybeSingle: vi.fn().mockResolvedValue({ data: application, error: null }),
  };
  const applicationUpdate = {
    eq: vi.fn().mockResolvedValue({ error: null }),
  };
  const profileRead = {
    select: vi.fn(() => profileRead),
    eq: vi.fn(() => profileRead),
    maybeSingle: vi.fn().mockResolvedValue({ data: {}, error: null }),
  };
  return {
    from: vi.fn((table: string) => {
      tables.push(table);
      if (table === "applications") {
        return {
          ...applicationRead,
          update: vi.fn(() => applicationUpdate),
        };
      }
      if (table === "visa_application_answers") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        };
      }
      if (table === "applicant_profiles") return profileRead;
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function request(): Request {
  return new Request("https://viza.test/api/applications/app-kr-1/korea-official-eform", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ finalReviewApproved: true }),
  });
}

describe("Korea official e-Form cutover boundary", () => {
  let tables: string[];

  beforeEach(() => {
    delete process.env.RUNNER_CUTOVER_PAUSED;
    tables = [];
    createAdminClientMock.mockReset();
    ensureFlyMachineStartedMock.mockReset();
    getClientSessionWithFallbackMock.mockReset();
    getImpersonationSessionMock.mockReset();
    createAdminClientMock.mockReturnValue(adminMock(tables));
    getClientSessionWithFallbackMock.mockResolvedValue({ userId: "profile-1" });
    getImpersonationSessionMock.mockResolvedValue(null);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetch must not run"));
  });

  afterEach(() => {
    delete process.env.RUNNER_CUTOVER_PAUSED;
    vi.restoreAllMocks();
  });

  it("returns 503 before answer reads, Machine wake, local spawn, or service POST while paused", async () => {
    process.env.RUNNER_CUTOVER_PAUSED = "true";

    const response = await POST(request(), { params: Promise.resolve({ id: "app-kr-1" }) });

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "runner_cutover_paused" });
    expect(tables).toEqual(["applications"]);
    expect(ensureFlyMachineStartedMock).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("does not POST or attempt a local fallback when the Fly wake fails", async () => {
    ensureFlyMachineStartedMock.mockResolvedValue({
      ok: false,
      target: "south_korea",
      reason: "request_failed",
    });

    const response = await POST(request(), { params: Promise.resolve({ id: "app-kr-1" }) });
    const body = await response.json() as { error?: string };

    expect(response.status).toBe(502);
    expect(body.error).toContain("unavailable after wake request");
    expect(ensureFlyMachineStartedMock).toHaveBeenCalledWith("south_korea");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
