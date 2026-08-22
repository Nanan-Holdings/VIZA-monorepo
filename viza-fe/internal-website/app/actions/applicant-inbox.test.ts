import { beforeEach, describe, expect, it, vi } from "vitest";

const getClientSessionWithFallback = vi.hoisted(() => vi.fn());
const withAdmin = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("@/lib/client-session", () => ({
  getClientSessionWithFallback,
}));

vi.mock("@/lib/auth/with-admin", () => ({
  withAdmin,
}));

import { initializeAuthenticatedApplicantInbox } from "./applicant-inbox";

type QueryResult = {
  data: Record<string, unknown> | null;
  error: { message: string } | null;
};

function profileQuery(result: QueryResult) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
}

describe("initializeAuthenticatedApplicantInbox", () => {
  beforeEach(() => {
    getClientSessionWithFallback.mockReset();
    withAdmin.mockReset();
  });

  it("resolves legacy auth-UUID client sessions through auth_user_id", async () => {
    getClientSessionWithFallback.mockResolvedValue({
      userId: "auth-user-id",
      email: "user@example.com",
    });

    const byProfileId = profileQuery({ data: null, error: null });
    const byAuthUserId = profileQuery({
      data: {
        id: "applicant-profile-id",
        auth_user_id: "auth-user-id",
        email: "user@example.com",
        inbox_alias: "appl-test@viza.it.com",
        inbox_alias_retired_at: null,
      },
      error: null,
    });
    const consentQuery = profileQuery({ data: { id: "consent-id" }, error: null });

    const admin = {
      from: vi.fn((table: string) => {
        if (table === "applicant_profiles") {
          const applicantCall = admin.from.mock.calls.filter(
            ([calledTable]) => calledTable === "applicant_profiles",
          ).length;
          return applicantCall === 1 ? byProfileId : byAuthUserId;
        }
        if (table === "consent_event") return consentQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
    };
    withAdmin.mockImplementation(
      async (_mode: string, _actor: string, callback: (client: typeof admin) => unknown) =>
        callback(admin),
    );

    await expect(initializeAuthenticatedApplicantInbox()).resolves.toEqual({
      ok: true,
      data: {
        alias: "appl-test@viza.it.com",
        destinationEmail: "user@example.com",
        forwardingAuthorized: true,
      },
    });
    expect(byAuthUserId.eq).toHaveBeenCalledWith("auth_user_id", "auth-user-id");
  });
});
