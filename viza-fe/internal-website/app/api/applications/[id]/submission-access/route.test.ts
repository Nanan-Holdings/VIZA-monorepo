import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getApplicationApiApplicantProfileId: vi.fn(),
  evaluateSubmissionAccess: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/application-api-auth", () => ({
  getApplicationApiApplicantProfileId:
    mocks.getApplicationApiApplicantProfileId,
}));
vi.mock("@/lib/payments/submission-access", () => ({
  APPLICATION_PAYMENT_REQUIRED: "application_payment_required",
  evaluateSubmissionAccess: mocks.evaluateSubmissionAccess,
  submissionAccessHttpBody: vi.fn((decision) => decision),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import { POST } from "./route";

const applicationId = "a2212775-20eb-4e34-9c3c-d5ca62ae21bf";

function request() {
  return new NextRequest(
    `https://viza.test/api/applications/${applicationId}/submission-access`,
    {
      method: "POST",
      body: JSON.stringify({ returnTo: "/client/application?step=review" }),
      headers: { "Content-Type": "application/json" },
    },
  );
}

function adminFor({
  requesterProfileId = "profile-owner",
  requesterAuthUserId = "auth-owner",
}: {
  requesterProfileId?: string;
  requesterAuthUserId?: string;
} = {}) {
  const application = {
    id: applicationId,
    applicant_id: "profile-owner",
    purpose: null,
    group_id: null,
  };
  const profiles = new Map([
    ["profile-owner", {
      id: "profile-owner",
      auth_user_id: "auth-owner",
      dependant_of_user_id: null,
    }],
    [requesterProfileId, {
      id: requesterProfileId,
      auth_user_id: requesterAuthUserId,
      dependant_of_user_id: null,
    }],
  ]);
  return {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn((_column: string, value: string) => ({
          maybeSingle: vi.fn(async () => ({
            data: table === "applications"
              ? value === applicationId ? application : null
              : table === "applicant_profiles"
                ? profiles.get(value) ?? null
                : null,
            error: null,
          })),
        })),
      })),
    })),
  };
}

describe("submission access route authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.evaluateSubmissionAccess.mockResolvedValue({ status: "ready" });
  });

  it("accepts the signed VIZA client profile used by the applicant portal", async () => {
    mocks.getApplicationApiApplicantProfileId.mockResolvedValue("profile-owner");
    const admin = adminFor();
    mocks.createAdminClient.mockReturnValue(admin);

    const response = await POST(request(), {
      params: Promise.resolve({ id: applicationId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      decision: { status: "ready" },
    });
    expect(mocks.evaluateSubmissionAccess).toHaveBeenCalledWith(
      admin,
      applicationId,
      expect.objectContaining({
        payerAuthUserId: "auth-owner",
        lockHighAccess: true,
      }),
    );
  });

  it("returns a coded 401 when neither supported login session exists", async () => {
    mocks.getApplicationApiApplicantProfileId.mockResolvedValue(null);

    const response = await POST(request(), {
      params: Promise.resolve({ id: applicationId }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Authentication required.",
      code: "authentication_required",
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("does not allow an unrelated signed client profile to submit the application", async () => {
    mocks.getApplicationApiApplicantProfileId.mockResolvedValue("profile-other");
    const admin = adminFor({
      requesterProfileId: "profile-other",
      requesterAuthUserId: "auth-other",
    });
    mocks.createAdminClient.mockReturnValue(admin);

    const response = await POST(request(), {
      params: Promise.resolve({ id: applicationId }),
    });

    expect(response.status).toBe(404);
    expect(mocks.evaluateSubmissionAccess).not.toHaveBeenCalled();
  });
});
