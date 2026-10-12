import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient, createClient, getClientSessionWithFallback } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  getClientSessionWithFallback: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/client-session", () => ({ getClientSessionWithFallback }));

import { getTeamApplicationContext } from "./application-group";

function query(result: unknown) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
  };
  return builder;
}

const application = {
  id: "application-id",
  applicant_id: "profile-id",
  group_id: null,
  country: "south_korea",
  visa_type: "KR_E_ARRIVAL_CARD",
  visa_package_id: "package-id",
  status: "draft",
  confirmation_number: null,
  submitted_at: null,
  submission_result: null,
  submission_result_status: null,
  arrival_date: null,
  departure_date: null,
  port_of_entry: null,
  purpose: null,
  accommodation_name: null,
  accommodation_address: null,
};

describe("getTeamApplicationContext", () => {
  beforeEach(() => {
    createAdminClient.mockReset();
    createClient.mockReset();
    getClientSessionWithFallback.mockReset();
  });

  it("loads an explicit application with a signed VIZA client session only", async () => {
    getClientSessionWithFallback.mockResolvedValue({
      userId: "profile-id",
      email: "applicant@example.com",
    });

    const applicationQuery = query({ data: application, error: null });
    const ownerQuery = query({
      data: {
        id: "profile-id",
        auth_user_id: "auth-user-id",
        dependant_of_user_id: null,
      },
      error: null,
    });
    const profileQuery = query({
      data: {
        id: "profile-id",
        surname: "Kim",
        given_names: "Mina",
        date_of_birth: "2001-06-22",
        nationality: "KR",
        gender: "F",
        passport_number: "REDACTED",
        passport_expiry_date: "2030-01-01",
      },
      error: null,
    });
    const from = vi
      .fn()
      .mockReturnValueOnce(applicationQuery)
      .mockReturnValueOnce(ownerQuery)
      .mockReturnValueOnce(profileQuery);
    createAdminClient.mockReturnValue({ from });

    const result = await getTeamApplicationContext("application-id");

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      application: expect.objectContaining({
        id: "application-id",
        country: "south_korea",
        visa_type: "KR_E_ARRIVAL_CARD",
      }),
      profile: expect.objectContaining({
        id: "profile-id",
        surname: "Kim",
        given_names: "Mina",
        date_of_birth: "2001-06-22",
      }),
    }));
    expect(createClient).not.toHaveBeenCalled();
    expect(ownerQuery.eq).toHaveBeenCalledWith("id", "profile-id");
  });

  it("does not authorize a different applicant profile", async () => {
    getClientSessionWithFallback.mockResolvedValue({
      userId: "different-profile-id",
      email: "other@example.com",
    });

    const applicationQuery = query({ data: application, error: null });
    const ownerQuery = query({
      data: {
        id: "profile-id",
        auth_user_id: "auth-user-id",
        dependant_of_user_id: null,
      },
      error: null,
    });
    const from = vi
      .fn()
      .mockReturnValueOnce(applicationQuery)
      .mockReturnValueOnce(ownerQuery);
    createAdminClient.mockReturnValue({ from });

    await expect(getTeamApplicationContext("application-id")).resolves.toEqual({
      ok: false,
      reason: "Unauthorized",
    });
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("returns an authentication error when neither client session is available", async () => {
    getClientSessionWithFallback.mockResolvedValue(null);

    await expect(getTeamApplicationContext("application-id")).resolves.toEqual({
      ok: false,
      reason: "Not authenticated",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});
