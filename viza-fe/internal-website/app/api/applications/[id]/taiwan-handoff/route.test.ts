import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createAdminClient,
  getApplicationApiApplicantProfileId,
  isAllowedTaiwanLiveViewUrl,
} = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getApplicationApiApplicantProfileId: vi.fn(),
  isAllowedTaiwanLiveViewUrl: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/application-api-auth", () => ({ getApplicationApiApplicantProfileId }));
vi.mock("@/lib/taiwan-handoff-url", () => ({ isAllowedTaiwanLiveViewUrl }));

import { GET } from "./route";

type QueryResult = { data: unknown; error: { message: string } | null };

function query(result: QueryResult) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
  };
  return builder;
}

function setupAdmin(
  claimResult: QueryResult,
  resultPatch: Record<string, unknown> = {},
) {
  const applicationQuery = query({
    data: {
      id: "application-id",
      applicant_id: "profile-id",
      submission_result: {
        country: "TW",
        status: "stopped_at_captcha",
        handoffId: "takeover-id",
        ...resultPatch,
      },
    },
    error: null,
  });
  const rpc = vi.fn(async () => claimResult);
  const from = vi.fn((table: string) => {
    if (table === "applications") return applicationQuery;
    throw new Error(`unexpected direct table access: ${table}`);
  });
  createAdminClient.mockReturnValue({ from, rpc });
  return { applicationQuery, from, rpc };
}

function request() {
  return new Request("http://localhost/api/applications/application-id/taiwan-handoff");
}

describe("Taiwan handoff route", () => {
  beforeEach(() => {
    createAdminClient.mockReset();
    getApplicationApiApplicantProfileId.mockReset().mockResolvedValue("profile-id");
    isAllowedTaiwanLiveViewUrl.mockReset().mockReturnValue(true);
  });

  it("claims the authoritative handoff through the Taiwan RPC before returning the URL", async () => {
    const { rpc, from } = setupAdmin({
      data: [{
        claimed: true,
        takeover_id: "takeover-id",
        job_id: "job-id",
        application_id: "application-id",
        vnc_url: "https://live.example.test/view/abc",
        expires_at: "2099-01-01T00:00:00.000Z",
      }],
      error: null,
    });

    const response = await GET(request(), { params: Promise.resolve({ id: "application-id" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      liveViewUrl: "https://live.example.test/view/abc",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    expect(rpc).toHaveBeenCalledWith("claim_tw_applicant_handoff", {
      p_takeover_id: "takeover-id",
      p_application_id: "application-id",
      p_applicant_id: "profile-id",
    });
    expect(from).not.toHaveBeenCalledWith("takeover_session");
  });

  it("returns 409 and performs no direct takeover writes when the claim is lost", async () => {
    const { rpc, from } = setupAdmin({ data: [], error: null });

    const response = await GET(request(), { params: Promise.resolve({ id: "application-id" }) });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("no longer available"),
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalledWith("takeover_session");
  });

  it("requires the authoritative handoff id and never falls back to a latest session", async () => {
    const { rpc, from } = setupAdmin({ data: [], error: null }, { handoffId: undefined });

    const response = await GET(request(), { params: Promise.resolve({ id: "application-id" }) });

    expect(response.status).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalledWith("takeover_session");
  });

  it("rejects a claim row for the wrong application and an expired handoff", async () => {
    const wrong = setupAdmin({
      data: [{
        claimed: true,
        takeover_id: "takeover-id",
        job_id: "job-id",
        application_id: "other-application",
        vnc_url: "https://live.example.test/view/abc",
        expires_at: "2099-01-01T00:00:00.000Z",
      }],
      error: null,
    });
    const wrongResponse = await GET(request(), { params: Promise.resolve({ id: "application-id" }) });
    expect(wrongResponse.status).toBe(409);
    expect(wrong.rpc).toHaveBeenCalledTimes(1);

    createAdminClient.mockReset();
    const expired = setupAdmin({
      data: [{
        claimed: true,
        takeover_id: "takeover-id",
        job_id: "job-id",
        application_id: "application-id",
        vnc_url: "https://live.example.test/view/abc",
        expires_at: "2000-01-01T00:00:00.000Z",
      }],
      error: null,
    });
    const expiredResponse = await GET(request(), { params: Promise.resolve({ id: "application-id" }) });
    expect(expiredResponse.status).toBe(410);
    expect(expired.rpc).toHaveBeenCalledTimes(1);
  });
});
