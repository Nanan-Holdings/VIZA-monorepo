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
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    update: vi.fn(() => builder),
    insert: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
  };
  return builder;
}

function setupAdmin(claimResult: QueryResult) {
  const applicationQuery = query({
    data: {
      id: "application-id",
      applicant_id: "profile-id",
      submission_result: {
        country: "TW",
        status: "stopped_at_captcha",
        handoffId: "takeover-id",
      },
    },
    error: null,
  });
  const handoffQuery = query({
    data: {
      id: "takeover-id",
      applicant_id: "profile-id",
      status: "queued",
      vnc_url: "https://live.example.test/view/abc",
      expires_at: "2099-01-01T00:00:00.000Z",
    },
    error: null,
  });
  const actionLogQuery = query({ data: null, error: null });
  const rpc = vi.fn(async () => claimResult);
  const from = vi.fn((table: string) => {
    if (table === "applications") return applicationQuery;
    if (table === "takeover_session") return handoffQuery;
    if (table === "takeover_action_log") return actionLogQuery;
    throw new Error(`unexpected table ${table}`);
  });
  createAdminClient.mockReturnValue({ from, rpc });
  return { applicationQuery, handoffQuery, actionLogQuery, from, rpc };
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

  it("claims the handoff through the guarded RPC before returning the verified URL", async () => {
    const { rpc, handoffQuery, actionLogQuery } = setupAdmin({
      data: [{
        claimed: true,
        job_id: "job-id",
        application_id: "application-id",
        handoff_kind: "taiwan_applicant_final_submit",
      }],
      error: null,
    });

    const response = await GET(request(), { params: Promise.resolve({ id: "application-id" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      liveViewUrl: "https://live.example.test/view/abc",
    });
    expect(rpc).toHaveBeenCalledWith("claim_takeover_session", {
      p_takeover_id: "takeover-id",
      p_claimant_id: "profile-id",
      p_expected_handoff_kind: "taiwan_applicant_final_submit",
    });
    expect(handoffQuery.update).not.toHaveBeenCalled();
    expect(actionLogQuery.insert).not.toHaveBeenCalled();
  });

  it("returns 409 and performs no writes when the claim is lost", async () => {
    const { rpc, handoffQuery, actionLogQuery } = setupAdmin({ data: [], error: null });

    const response = await GET(request(), { params: Promise.resolve({ id: "application-id" }) });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("no longer available"),
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(handoffQuery.update).not.toHaveBeenCalled();
    expect(actionLogQuery.insert).not.toHaveBeenCalled();
  });
});
